"""
Celery background workflows for the Order Processing Engine.

Tasks:
  - process_payment_task: PENDING -> PAID (or FAILED after max retries)
  - process_shipping_task: PAID -> SHIPPED (or FAILED after max retries)
  - process_cancellation_task: PENDING/PAID -> CANCELLED
  - process_update_task: Update item_name/price while PENDING

Retry Strategy:
  Exponential backoff: T = 2^retries * 5 seconds
  Max retries: 3 (so delays are 5s, 10s, 20s)

Idempotency:
  Each task checks/inserts a key in the idempotent_keys table within
  the SAME database transaction as the state update, ensuring
  exactly-once semantics even on Celery retries.

Audit & Retry Logging:
  Every state transition logs an OrderEvent.
  Every retry attempt logs a RetryLog entry.
"""

import random
import uuid
import time
import logging
from sqlalchemy import text
from app.core.celery_app import celery_app
from app.db.models import SessionLocal, Order, OrderEvent, RetryLog
from app.core.kafka_manager import publish_event

logger = logging.getLogger(__name__)


# ─── Helpers ───

def _log_event(db, order_id: str, event_type: str, from_status: str = None,
               to_status: str = None, detail: str = None):
    """Insert an audit trail entry."""
    event = OrderEvent(
        order_id=order_id,
        event_type=event_type,
        from_status=from_status,
        to_status=to_status,
        detail=detail,
    )
    db.add(event)


def _log_retry(db, order_id: str, task_name: str, attempt: int,
               max_retries: int, error_msg: str, backoff: int, status: str):
    """Insert a retry log entry."""
    entry = RetryLog(
        order_id=order_id,
        task_name=task_name,
        attempt=attempt,
        max_retries=max_retries,
        error_message=error_msg,
        backoff_seconds=backoff,
        status=status,
    )
    db.add(entry)


def _mark_order_failed(order_id: str, stage: str):
    """Mark an order as FAILED when all retries are exhausted."""
    db = SessionLocal()
    try:
        order = db.query(Order).filter(Order.id == order_id).with_for_update().first()
        if order and order.status not in ("SHIPPED", "FAILED", "CANCELLED"):
            old_status = order.status
            order.status = "FAILED"
            _log_event(db, order_id, f"{stage}.failed",
                       from_status=old_status, to_status="FAILED",
                       detail=f"All retries exhausted during {stage} processing.")
            _log_retry(db, order_id, f"process_{stage}_task",
                       attempt=4, max_retries=3, error_msg="Max retries exceeded",
                       backoff=0, status="EXHAUSTED")
            db.commit()

            # Notify via Kafka for WebSocket bridge
            publish_event(
                topic="order-events",
                key=order_id,
                payload={"event_type": f"{stage}.failed", "order_id": order_id,
                         "status": "FAILED"},
            )
            logger.error(f"Order {order_id} marked as FAILED after {stage} retries exhausted.")
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to mark order {order_id} as FAILED: {e}")
    finally:
        db.close()


def _push_ws_notification(order_id: str, event_type: str, status: str, **extra):
    """Push a notification to the WebSocket bridge queue."""
    try:
        from app.core.ws_manager import ws_notification_queue
        notification = {"order_id": order_id, "event_type": event_type, "status": status}
        notification.update(extra)
        ws_notification_queue.put(notification)
    except Exception as e:
        logger.debug(f"WS notification skipped (expected in worker process): {e}")


# ─── Delivery Task ───

@celery_app.task(bind=True, max_retries=3)
def process_delivery_task(self, order_id: str):
    """Process delivery: SHIPPED -> DELIVERED."""
    db = SessionLocal()
    idempotency_key = f"delivery-{order_id}"

    try:
        key_exists = db.execute(
            text("SELECT 1 FROM idempotent_keys WHERE `key` = :key"),
            {"key": idempotency_key},
        ).fetchone()

        if key_exists:
            logger.info(f"Idempotency hit — skipping duplicate: {idempotency_key}")
            return

        order = db.query(Order).filter(Order.id == order_id).with_for_update().first()
        if not order or order.status != "SHIPPED":
            logger.warning(f"Delivery skipped — order {order_id} status={order.status if order else 'NOT FOUND'}")
            return

        order.status = "DELIVERED"
        db.execute(
            text("INSERT INTO idempotent_keys (`key`) VALUES (:key)"),
            {"key": idempotency_key},
        )
        _log_event(db, order_id, "order.delivered",
                   from_status="SHIPPED", to_status="DELIVERED",
                   detail="Order delivered to customer.")
        db.commit()

        publish_event(
            topic="order-events",
            key=order_id,
            payload={"event_type": "order.delivered", "order_id": order_id, "status": "DELIVERED"},
        )
        _push_ws_notification(order_id, "order.delivered", "DELIVERED")
        logger.info(f"Delivery successful for order {order_id}")

    except Exception as exc:
        db.rollback()
        attempt = self.request.retries + 1
        max_retries = self.max_retries
        _log_retry(db, order_id, "process_delivery_task", attempt, max_retries, str(exc), 5, "RETRYING")
        db.commit()

        if attempt > max_retries:
            _mark_order_failed(order_id, "delivery")
            return
        raise self.retry(countdown=5)
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=3)
def process_manual_payment_task(self, order_id: str):
    """Process manual payment: PENDING -> PAID."""
    db = SessionLocal()
    idempotency_key = f"manual-payment-{order_id}"

    try:
        key_exists = db.execute(
            text("SELECT 1 FROM idempotent_keys WHERE `key` = :key"),
            {"key": idempotency_key},
        ).fetchone()

        if key_exists:
            logger.info(f"Idempotency hit — skipping duplicate: {idempotency_key}")
            return

        order = db.query(Order).filter(Order.id == order_id).with_for_update().first()
        if not order or order.status != "PENDING":
            logger.warning(f"Payment skipped — order {order_id} status={order.status if order else 'NOT FOUND'}")
            return

        # Atomic state update + idempotency key + audit log
        order.status = "PAID"
        db.execute(
            text("INSERT INTO idempotent_keys (`key`) VALUES (:key)"),
            {"key": idempotency_key},
        )
        _log_event(db, order_id, "payment.processed",
                   from_status="PENDING", to_status="PAID",
                   detail="Manual payment received successfully.")
        db.commit()

        publish_event(
            topic="order-events",
            key=order_id,
            payload={"event_type": "payment.processed", "order_id": order_id, "status": "PAID"},
        )
        _push_ws_notification(order_id, "payment.processed", "PAID")
        logger.info(f"Manual payment successful for order {order_id}")

    except Exception as exc:
        db.rollback()
        backoff = 5 * (2 ** self.request.retries)
        logger.warning(f"Manual payment failed for order {order_id}: {exc}")
        try:
            raise self.retry(exc=exc, countdown=backoff)
        except self.MaxRetriesExceededError:
            _mark_order_failed(order_id, "manual_payment")
    finally:
        db.close()


# ─── Shipping Task ───

@celery_app.task(bind=True, max_retries=3)
def process_shipping_task(self, order_id: str):
    """Process shipping for an order: PAID -> SHIPPED."""
    db = SessionLocal()
    idempotency_key = f"shipping-processing-{order_id}"

    try:
        key_exists = db.execute(
            text("SELECT 1 FROM idempotent_keys WHERE `key` = :key"),
            {"key": idempotency_key},
        ).fetchone()

        if key_exists:
            logger.info(f"Idempotency hit — skipping duplicate: {idempotency_key}")
            return

        order = db.query(Order).filter(Order.id == order_id).with_for_update().first()
        if not order or order.status != "PAID":
            logger.warning(f"Shipping skipped — order {order_id} status={order.status if order else 'NOT FOUND'}")
            return

        # Atomic state update + idempotency key + audit log
        order.tracking_number = f"TRK-{uuid.uuid4().hex[:12].upper()}"
        order.status = "SHIPPED"
        db.execute(
            text("INSERT INTO idempotent_keys (`key`) VALUES (:key)"),
            {"key": idempotency_key},
        )
        _log_event(db, order_id, "order.shipped",
                   from_status="PAID", to_status="SHIPPED",
                   detail=f"Order shipped with tracking: {order.tracking_number}")
        _log_retry(db, order_id, "process_shipping_task",
                   attempt=self.request.retries + 1, max_retries=self.max_retries,
                   error_msg=None, backoff=0, status="SUCCEEDED")
        db.commit()

        publish_event(
            topic="order-events",
            key=order_id,
            payload={"event_type": "order.shipped", "order_id": order_id, "status": "SHIPPED", "tracking_number": order.tracking_number},
        )
        _push_ws_notification(order_id, "order.shipped", "SHIPPED",
                              tracking_number=order.tracking_number)
        logger.info(f"Order {order_id} SHIPPED with tracking {order.tracking_number}")

    except Exception as exc:
        db.rollback()
        attempt = self.request.retries + 1
        retries_left = self.max_retries - self.request.retries
        backoff = 5 * (2 ** self.request.retries)

        retry_db = SessionLocal()
        try:
            _log_retry(retry_db, order_id, "process_shipping_task",
                       attempt=attempt, max_retries=self.max_retries,
                       error_msg=str(exc), backoff=backoff, status="RETRYING")
            _log_event(retry_db, order_id, "shipping.retry",
                       from_status="PAID", to_status="PAID",
                       detail=f"Retry {attempt}/{self.max_retries}: {exc}. Backoff: {backoff}s")
            retry_db.commit()
        except Exception:
            retry_db.rollback()
        finally:
            retry_db.close()

        _push_ws_notification(order_id, "shipping.retry", "PAID",
                              attempt=attempt, max_retries=self.max_retries,
                              backoff=backoff, error=str(exc))

        logger.error(
            f"Shipping failed for order {order_id} "
            f"(retries left: {retries_left}, next backoff: {backoff}s). "
            f"Error: {exc}"
        )
        try:
            raise self.retry(exc=exc, countdown=backoff)
        except self.MaxRetriesExceededError:
            _mark_order_failed(order_id, "shipping")
    finally:
        db.close()


# ─── Cancellation Task ───

@celery_app.task(bind=True, max_retries=2)
def process_cancellation_task(self, order_id: str):
    """Cancel an order: PENDING/PAID -> CANCELLED."""
    db = SessionLocal()
    idempotency_key = f"cancellation-{order_id}"

    try:
        key_exists = db.execute(
            text("SELECT 1 FROM idempotent_keys WHERE `key` = :key"),
            {"key": idempotency_key},
        ).fetchone()

        if key_exists:
            logger.info(f"Idempotency hit — skipping duplicate: {idempotency_key}")
            return

        order = db.query(Order).filter(Order.id == order_id).with_for_update().first()
        if not order:
            logger.warning(f"Cancel skipped — order {order_id} not found.")
            return

        if order.status not in ("PENDING", "PAID", "SHIPPED"):
            logger.warning(f"Cancel skipped — order {order_id} is {order.status}, cannot cancel.")
            return

        old_status = order.status
        detail = "Order cancelled by user."

        # If PAID or SHIPPED, simulate refund processing
        if old_status in ("PAID", "SHIPPED"):
            time.sleep(0.5)  # Simulate refund gateway call
            detail = f"Order cancelled by user (was {old_status}). Refund initiated for payment."

        order.status = "CANCELLED"
        db.execute(
            text("INSERT INTO idempotent_keys (`key`) VALUES (:key)"),
            {"key": idempotency_key},
        )
        _log_event(db, order_id, "order.cancelled",
                   from_status=old_status, to_status="CANCELLED",
                   detail=detail)
        db.commit()

        publish_event(
            topic="order-events",
            key=order_id,
            payload={"event_type": "order.cancelled", "order_id": order_id, "status": "CANCELLED"},
        )
        _push_ws_notification(order_id, "order.cancelled", "CANCELLED")
        logger.info(f"Order {order_id} cancelled (was {old_status}). {detail}")

    except Exception as exc:
        db.rollback()
        backoff = 5 * (2 ** self.request.retries)
        logger.error(f"Cancellation failed for order {order_id}: {exc}")
        try:
            raise self.retry(exc=exc, countdown=backoff)
        except self.MaxRetriesExceededError:
            logger.error(f"Cancellation permanently failed for order {order_id}")
    finally:
        db.close()


# ─── Update Task ───

@celery_app.task(bind=True, max_retries=2)
def process_update_task(self, order_id: str, new_item_name: str = None, new_price: float = None):
    """Update an order's item_name and/or price while still PENDING."""
    db = SessionLocal()
    idempotency_key = f"update-{order_id}-{new_item_name}-{new_price}"

    try:
        key_exists = db.execute(
            text("SELECT 1 FROM idempotent_keys WHERE `key` = :key"),
            {"key": idempotency_key},
        ).fetchone()

        if key_exists:
            logger.info(f"Idempotency hit — skipping duplicate: {idempotency_key}")
            return

        order = db.query(Order).filter(Order.id == order_id).with_for_update().first()
        if not order:
            logger.warning(f"Update skipped — order {order_id} not found.")
            return

        if order.status != "PENDING":
            logger.warning(f"Update skipped — order {order_id} is {order.status}, not PENDING.")
            return

        changes = []
        if new_item_name and new_item_name != order.item_name:
            old_name = order.item_name
            order.item_name = new_item_name
            changes.append(f"Item: '{old_name}' -> '{new_item_name}'")
        if new_price is not None and new_price != order.price:
            old_price = order.price
            order.price = new_price
            changes.append(f"Price: ${old_price:.2f} -> ${new_price:.2f}")

        if not changes:
            logger.info(f"No changes to apply for order {order_id}")
            return

        db.execute(
            text("INSERT INTO idempotent_keys (`key`) VALUES (:key)"),
            {"key": idempotency_key},
        )
        _log_event(db, order_id, "order.updated",
                   from_status="PENDING", to_status="PENDING",
                   detail="Updated: " + "; ".join(changes))
        db.commit()

        publish_event(
            topic="order-events",
            key=order_id,
            payload={"event_type": "order.updated", "order_id": order_id, "status": "PENDING", "item_name": order.item_name, "price": order.price},
        )
        _push_ws_notification(order_id, "order.updated", "PENDING",
                              item_name=order.item_name, price=order.price)
        logger.info(f"Order {order_id} updated: {'; '.join(changes)}")

    except Exception as exc:
        db.rollback()
        backoff = 5 * (2 ** self.request.retries)
        logger.error(f"Update failed for order {order_id}: {exc}")
        try:
            raise self.retry(exc=exc, countdown=backoff)
        except self.MaxRetriesExceededError:
            logger.error(f"Update permanently failed for order {order_id}")
    finally:
        db.close()

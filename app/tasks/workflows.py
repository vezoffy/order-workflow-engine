"""
Celery background workflows for the Order Processing Engine.

Tasks:
  - process_payment_task: PENDING -> PAID (or FAILED after max retries)
  - process_shipping_task: PAID -> SHIPPED (or FAILED after max retries)

Retry Strategy:
  Exponential backoff: T = 2^retries × 5 seconds
  Max retries: 3 (so delays are 5s, 10s, 20s)

Idempotency:
  Each task checks/inserts a key in the idempotent_keys table within
  the SAME database transaction as the state update, ensuring
  exactly-once semantics even on Celery retries.
"""

import random
import uuid
import logging
from sqlalchemy import text
from app.core.celery_app import celery_app
from app.db.models import SessionLocal, Order
from app.core.kafka_manager import publish_event

logger = logging.getLogger(__name__)


def _mark_order_failed(order_id: str, stage: str):
    """Mark an order as FAILED when all retries are exhausted."""
    db = SessionLocal()
    try:
        order = db.query(Order).filter(Order.id == order_id).with_for_update().first()
        if order and order.status not in ("SHIPPED", "FAILED"):
            order.status = "FAILED"
            db.commit()
            logger.error(f"Order {order_id} marked as FAILED after {stage} retries exhausted.")
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to mark order {order_id} as FAILED: {e}")
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=3)
def process_payment_task(self, order_id: str):
    """
    Process payment for an order: PENDING -> PAID.

    - 20% simulated failure probability to exercise retry/backoff logic.
    - Idempotency guard prevents duplicate processing.
    - On max retries exhausted, order transitions to FAILED.
    """
    db = SessionLocal()
    idempotency_key = f"payment-processing-{order_id}"

    try:
        # --- Idempotency barrier ---
        key_exists = db.execute(
            text("SELECT 1 FROM idempotent_keys WHERE `key` = :key"),
            {"key": idempotency_key},
        ).fetchone()

        if key_exists:
            logger.info(f"Idempotency hit — skipping duplicate: {idempotency_key}")
            return

        order = db.query(Order).filter(Order.id == order_id).with_for_update().first()
        if not order or order.status != "PENDING":
            logger.warning(f"Payment skipped — order {order_id} is not PENDING (status={order.status if order else 'NOT FOUND'})")
            return

        # --- Simulate 20% payment gateway failure ---
        if random.random() > 0.8:
            raise Exception("Payment gateway communication timeout.")

        # --- Atomic state update + idempotency key insert ---
        order.status = "PAID"
        db.execute(
            text("INSERT INTO idempotent_keys (`key`) VALUES (:key)"),
            {"key": idempotency_key},
        )
        db.commit()

        # --- Publish downstream event ---
        publish_event(
            topic="order-events",
            key=order_id,
            payload={"event_type": "payment.processed", "order_id": order_id},
        )
        logger.info(f"Payment successful for order {order_id}")

    except Exception as exc:
        db.rollback()
        retries_left = self.max_retries - self.request.retries
        backoff = 5 * (2 ** self.request.retries)
        logger.warning(
            f"Payment failed for order {order_id} "
            f"(retries left: {retries_left}, next backoff: {backoff}s). "
            f"Error: {exc}"
        )
        try:
            raise self.retry(exc=exc, countdown=backoff)
        except self.MaxRetriesExceededError:
            _mark_order_failed(order_id, "payment")
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=3)
def process_shipping_task(self, order_id: str):
    """
    Process shipping for an order: PAID -> SHIPPED.

    - Generates a tracking number on success.
    - Idempotency guard prevents duplicate processing.
    - On max retries exhausted, order transitions to FAILED.
    """
    db = SessionLocal()
    idempotency_key = f"shipping-processing-{order_id}"

    try:
        # --- Idempotency barrier ---
        key_exists = db.execute(
            text("SELECT 1 FROM idempotent_keys WHERE `key` = :key"),
            {"key": idempotency_key},
        ).fetchone()

        if key_exists:
            logger.info(f"Idempotency hit — skipping duplicate: {idempotency_key}")
            return

        order = db.query(Order).filter(Order.id == order_id).with_for_update().first()
        if not order or order.status != "PAID":
            logger.warning(f"Shipping skipped — order {order_id} is not PAID (status={order.status if order else 'NOT FOUND'})")
            return

        # --- Atomic state update + idempotency key insert ---
        order.tracking_number = f"TRK-{uuid.uuid4().hex[:12].upper()}"
        order.status = "SHIPPED"
        db.execute(
            text("INSERT INTO idempotent_keys (`key`) VALUES (:key)"),
            {"key": idempotency_key},
        )
        db.commit()

        # --- Publish terminal event ---
        publish_event(
            topic="order-events",
            key=order_id,
            payload={
                "event_type": "order.shipped",
                "order_id": order_id,
                "tracking_number": order.tracking_number,
            },
        )
        logger.info(f"Order {order_id} SHIPPED with tracking {order.tracking_number}")

    except Exception as exc:
        db.rollback()
        retries_left = self.max_retries - self.request.retries
        backoff = 5 * (2 ** self.request.retries)
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

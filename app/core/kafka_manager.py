"""
Decoupled Kafka Controller Thread for the Order Workflow Engine.

Architecture:
  - Producer: Thread-safe singleton (guarded by threading.Lock), registered
    in FastAPI's lifespan context. Uses idempotent writes (acks=all).
  - Consumer: Runs in an isolated daemon thread, communicates shutdown
    via threading.Event. Subscribes to 'order-events' and dispatches
    Celery tasks based on event_type.

This design prevents bidirectional messaging loops by keeping the
consumer fully decoupled from the FastAPI request-response cycle.
"""

import json
import logging
from threading import Thread, Event, Lock
from confluent_kafka import Producer, Consumer, KafkaError
from app.core.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Thread-safe Producer Singleton ---
_producer: Producer | None = None
_producer_lock = Lock()

consumer_thread: Thread | None = None
shutdown_event = Event()


def get_producer() -> Producer:
    """Return a thread-safe singleton Kafka producer."""
    global _producer
    if _producer is None:
        with _producer_lock:
            # Double-checked locking
            if _producer is None:
                _producer = Producer({
                    "bootstrap.servers": settings.KAFKA_SERVERS,
                    "acks": "all",
                    "enable.idempotence": True,
                })
                logger.info("Kafka producer initialized.")
    return _producer


def _delivery_report(err, msg):
    """Callback invoked once per produced message to report delivery status."""
    if err is not None:
        logger.error(f"Message delivery failed: {err}")
    else:
        logger.debug(
            f"Message delivered to {msg.topic()} [{msg.partition()}] @ offset {msg.offset()}"
        )


def publish_event(topic: str, key: str, payload: dict):
    """Produce a JSON event to a Kafka topic with delivery confirmation."""
    try:
        p = get_producer()
        p.produce(
            topic=topic,
            key=key,
            value=json.dumps(payload).encode("utf-8"),
            callback=_delivery_report,
        )
        p.poll(0)  # Trigger delivery callbacks
    except Exception as e:
        logger.error(f"Failed to produce message to '{topic}': {e}")


def consume_loop():
    """
    Background consumer loop — runs in its own daemon thread.

    Listens to 'order-events' and dispatches Celery tasks:
      - order.created   -> process_payment_task
      - payment.processed -> process_shipping_task

    Uses manual commit (enable.auto.commit=False) so messages are only
    committed after successful task dispatch.
    """
    # Deferred import to avoid circular dependency at module load time
    from app.tasks.workflows import process_payment_task, process_shipping_task

    consumer = Consumer({
        "bootstrap.servers": settings.KAFKA_SERVERS,
        "group.id": "order-engine-group",
        "auto.offset.reset": "earliest",
        "enable.auto.commit": False,
    })
    consumer.subscribe(["order-events"])
    logger.info("Kafka consumer loop started — listening on 'order-events'...")

    try:
        while not shutdown_event.is_set():
            msg = consumer.poll(1.0)

            if msg is None:
                continue

            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    continue
                logger.error(f"Kafka consumer error: {msg.error()}")
                continue

            try:
                event = json.loads(msg.value().decode("utf-8"))
                event_type = event.get("event_type")
                order_id = event.get("order_id")

                logger.info(f"Consumed event: {event_type} for order {order_id}")

                if event_type == "order.created":
                    process_payment_task.delay(order_id)
                elif event_type == "payment.processed":
                    process_shipping_task.delay(order_id)
                # order.shipped is a terminal event — no further dispatch

                consumer.commit(message=msg)
            except Exception as e:
                logger.error(f"Error processing consumed event: {e}")
    finally:
        consumer.close()
        logger.info("Kafka consumer loop stopped.")

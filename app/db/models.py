"""
SQLAlchemy ORM models for the Order Processing Workflow Engine.

Tables:
  - orders: Tracks order state machine (PENDING -> PAID -> SHIPPED | FAILED | CANCELLED)
  - idempotent_keys: Ensures exactly-once processing for Celery task retries
  - order_events: Audit timeline tracking every state transition
  - retry_logs: Records every retry attempt with backoff details
"""

import uuid
from sqlalchemy import Column, String, Float, Integer, Text, TIMESTAMP, text, Boolean
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy import create_engine
from app.core.config import settings

Base = declarative_base()

engine = create_engine(
    settings.DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(bind=engine)


class Order(Base):
    """Represents an order in the state machine.

    Valid state transitions:
        PENDING  ->  PAID       (payment processed successfully)
        PENDING  ->  FAILED     (payment retries exhausted)
        PENDING  ->  CANCELLED  (user cancelled before payment)
        PENDING  ->  PENDING    (order updated while still pending)
        PAID     ->  SHIPPED    (shipment confirmed with tracking number)
        PAID     ->  FAILED     (shipping retries exhausted)
        PAID     ->  CANCELLED  (user cancelled after payment, refund issued)
        SHIPPED  ->  DELIVERED  (delivery confirmed 5 minutes after shipping)
    """

    __tablename__ = "orders"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    item_name = Column(String(255), nullable=False)
    price = Column(Float, nullable=False)
    status = Column(String(32), nullable=False, default="PENDING")
    is_bulk = Column(Boolean, nullable=False, default=False)
    tracking_number = Column(String(128), nullable=True)
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(
        TIMESTAMP, server_default=text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
    )

    def __repr__(self):
        return f"<Order(id={self.id}, item={self.item_name}, status={self.status})>"


class IdempotentKey(Base):
    """Guards against duplicate Celery task execution.

    A key is inserted in the SAME transaction as the state update,
    ensuring exactly-once semantics even on retries.
    """

    __tablename__ = "idempotent_keys"

    key = Column(String(255), primary_key=True)
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))

    def __repr__(self):
        return f"<IdempotentKey(key={self.key})>"


class OrderEvent(Base):
    """Audit timeline entry for an order.

    Records every significant event: state transitions, updates,
    cancellations, retries, etc. Provides a complete audit trail.
    """

    __tablename__ = "order_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(String(36), nullable=False, index=True)
    event_type = Column(String(64), nullable=False)
    from_status = Column(String(32), nullable=True)
    to_status = Column(String(32), nullable=True)
    detail = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))

    def __repr__(self):
        return f"<OrderEvent(order={self.order_id}, type={self.event_type})>"


class RetryLog(Base):
    """Records retry attempts for Celery tasks.

    Tracks each attempt number, error message, backoff delay,
    and whether the retry succeeded, is retrying, or exhausted.
    """

    __tablename__ = "retry_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(String(36), nullable=False, index=True)
    task_name = Column(String(128), nullable=False)
    attempt = Column(Integer, nullable=False)
    max_retries = Column(Integer, nullable=False)
    error_message = Column(Text, nullable=True)
    backoff_seconds = Column(Integer, nullable=True)
    status = Column(String(32), nullable=False)  # RETRYING, SUCCEEDED, EXHAUSTED
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))

    def __repr__(self):
        return f"<RetryLog(order={self.order_id}, task={self.task_name}, attempt={self.attempt})>"

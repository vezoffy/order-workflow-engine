"""
SQLAlchemy ORM models for the Order Processing Workflow Engine.

Tables:
  - orders: Tracks order state machine (PENDING -> PAID -> SHIPPED | FAILED)
  - idempotent_keys: Ensures exactly-once processing for Celery task retries
"""

import uuid
from sqlalchemy import Column, String, Float, TIMESTAMP, text
# pyrefly: ignore [missing-import]
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
        PENDING  ->  PAID    (payment processed successfully)
        PENDING  ->  FAILED  (payment retries exhausted)
        PAID     ->  SHIPPED (shipment confirmed with tracking number)
        PAID     ->  FAILED  (shipping retries exhausted)
    """

    __tablename__ = "orders"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    item_name = Column(String(255), nullable=False)
    price = Column(Float, nullable=False)
    status = Column(String(32), nullable=False, default="PENDING")
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

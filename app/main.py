"""
FastAPI application for the Order Processing Workflow Engine.

Endpoints:
  POST /api/v1/orders          — Create a new order (returns 202 Accepted)
  GET  /api/v1/orders/{id}     — Poll a single order's status
  GET  /api/v1/orders          — List all orders (for history table)

Lifespan:
  - Startup: Initializes Kafka producer + starts consumer thread
  - Shutdown: Signals consumer to stop, flushes producer
"""

from contextlib import asynccontextmanager
from threading import Thread
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.models import Base, engine, Order, SessionLocal
from app.core.kafka_manager import (
    publish_event,
    consume_loop,
    shutdown_event,
    get_producer,
)

# Create tables on import (idempotent — safe to call multiple times)
Base.metadata.create_all(bind=engine)

# --- Consumer thread reference ---
consumer_thread: Thread | None = None


@asynccontextmanager
async def app_lifespan(app: FastAPI):
    """Manage Kafka producer + consumer lifecycle."""
    global consumer_thread

    # Startup
    get_producer()
    shutdown_event.clear()
    consumer_thread = Thread(target=consume_loop, daemon=True, name="kafka-consumer")
    consumer_thread.start()

    yield

    # Shutdown
    shutdown_event.set()
    if consumer_thread and consumer_thread.is_alive():
        consumer_thread.join(timeout=5)

    p = get_producer()
    p.flush(timeout=5)


app = FastAPI(
    title="Order Processing Engine",
    description="Event-driven state machine for order workflow management",
    version="1.0.0",
    lifespan=app_lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Pydantic Schemas ---

class OrderCreate(BaseModel):
    item_name: str
    price: float


class OrderResponse(BaseModel):
    order_id: str
    item_name: str
    price: float
    status: str
    tracking_number: str | None
    created_at: str | None
    updated_at: str | None


# --- Dependency ---

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --- Routes ---

@app.post("/api/v1/orders", status_code=202)
def create_order(payload: OrderCreate, db: Session = Depends(get_db)):
    """Create a new order and publish an 'order.created' event to Kafka."""
    try:
        new_order = Order(
            item_name=payload.item_name,
            price=payload.price,
            status="PENDING",
        )
        db.add(new_order)
        db.commit()
        db.refresh(new_order)

        publish_event(
            topic="order-events",
            key=new_order.id,
            payload={"event_type": "order.created", "order_id": new_order.id},
        )

        return {
            "order_id": new_order.id,
            "status": new_order.status,
            "message": "Order created and queued for payment processing.",
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to submit order: {e}")


@app.get("/api/v1/orders/{order_id}")
def get_order_status(order_id: str, db: Session = Depends(get_db)):
    """Poll a single order's current status."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    return {
        "order_id": order.id,
        "item_name": order.item_name,
        "price": order.price,
        "status": order.status,
        "tracking_number": order.tracking_number,
        "created_at": str(order.created_at) if order.created_at else None,
        "updated_at": str(order.updated_at) if order.updated_at else None,
    }


@app.get("/api/v1/orders")
def list_orders(db: Session = Depends(get_db)):
    """List all orders, newest first (for the history table)."""
    orders = db.query(Order).order_by(Order.created_at.desc()).all()
    return [
        {
            "order_id": o.id,
            "item_name": o.item_name,
            "price": o.price,
            "status": o.status,
            "tracking_number": o.tracking_number,
            "created_at": str(o.created_at) if o.created_at else None,
            "updated_at": str(o.updated_at) if o.updated_at else None,
        }
        for o in orders
    ]

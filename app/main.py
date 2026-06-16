"""
FastAPI application for the Order Processing Workflow Engine.

Endpoints:
  POST   /api/v1/orders              — Create a new order (202)
  POST   /api/v1/orders/bulk         — Create multiple orders (202)
  GET    /api/v1/orders              — List orders with search & filters
  GET    /api/v1/orders/{id}         — Get single order status
  PUT    /api/v1/orders/{id}         — Update order (PENDING only)
  DELETE /api/v1/orders/{id}         — Cancel order (PENDING/PAID only)
  GET    /api/v1/orders/{id}/timeline — Audit timeline for an order
  GET    /api/v1/orders/{id}/retries  — Retry logs for an order
  WS     /ws/orders/{id}             — WebSocket for real-time updates

Lifespan:
  - Startup: Kafka producer + consumer thread + WebSocket broadcast loop
  - Shutdown: Graceful teardown of all background tasks
"""

import asyncio
import json
import logging
import threading
from datetime import datetime
from contextlib import asynccontextmanager
from threading import Thread
from typing import Optional
from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.db.models import Base, engine, Order, OrderEvent, RetryLog, SessionLocal
from app.core.kafka_manager import (
    publish_event,
    consume_loop,
    shutdown_event,
    get_producer,
)
from app.core.ws_manager import manager, ws_broadcast_loop

# Create tables on import (idempotent)
Base.metadata.create_all(bind=engine)

# --- Background task references ---
consumer_thread: Thread | None = None
ws_task: asyncio.Task | None = None


@asynccontextmanager
async def app_lifespan(app: FastAPI):
    """Manage Kafka producer + consumer + WebSocket broadcast lifecycle."""
    global consumer_thread, ws_task

    # Startup
    get_producer()
    shutdown_event.clear()
    consumer_thread = Thread(target=consume_loop, daemon=True, name="kafka-consumer")
    consumer_thread.start()

    # Start WebSocket broadcast loop
    ws_task = asyncio.create_task(ws_broadcast_loop())

    yield

    # Shutdown
    shutdown_event.set()
    if consumer_thread and consumer_thread.is_alive():
        consumer_thread.join(timeout=5)

    if ws_task:
        ws_task.cancel()
        try:
            await ws_task
        except asyncio.CancelledError:
            pass

    p = get_producer()
    p.flush(timeout=5)


app = FastAPI(
    title="Order Processing Engine",
    description="Event-driven state machine for order workflow management",
    version="2.0.0",
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


class OrderUpdate(BaseModel):
    item_name: Optional[str] = None
    price: Optional[float] = None


class BulkOrderCreate(BaseModel):
    orders: list[OrderCreate]


# --- Dependency ---

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --- Helper ---

def _order_to_dict(o: Order) -> dict:
    return {
        "order_id": o.id,
        "item_name": o.item_name,
        "price": o.price,
        "status": o.status,
        "is_bulk": o.is_bulk,
        "tracking_number": o.tracking_number,
        "created_at": str(o.created_at) if o.created_at else None,
        "updated_at": str(o.updated_at) if o.updated_at else None,
    }


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
        db.flush()  # Generate ID before using it in OrderEvent
        
        # Log the creation event
        creation_event = OrderEvent(
            order_id=new_order.id,
            event_type="order.created",
            from_status=None,
            to_status="PENDING",
            detail=f"Order created: {payload.item_name} at ${payload.price:.2f}",
        )
        db.add(creation_event)
        db.commit()
        db.refresh(new_order)

        publish_event(
            topic="order-events",
            key=new_order.id,
            payload={"event_type": "order.created", "order_id": new_order.id, "status": "PENDING"},
        )

        return {
            "order_id": new_order.id,
            "status": new_order.status,
            "message": "Order created and queued for payment processing.",
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to submit order: {e}")


@app.post("/api/v1/orders/bulk", status_code=202)
def create_bulk_orders(payload: BulkOrderCreate, db: Session = Depends(get_db)):
    """Create multiple orders at once (max 50 per batch)."""
    if len(payload.orders) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 orders per bulk request.")
    if len(payload.orders) == 0:
        raise HTTPException(status_code=400, detail="At least one order is required.")

    created = []
    try:
        for item in payload.orders:
            new_order = Order(
                item_name=item.item_name,
                price=item.price,
                status="PENDING",
                is_bulk=True,
            )
            db.add(new_order)
            db.flush()  # Generate ID before using it in OrderEvent
            
            db.add(OrderEvent(
                order_id=new_order.id,
                event_type="order.created",
                from_status=None,
                to_status="PENDING",
                detail=f"Bulk order: {item.item_name} at ${item.price:.2f}",
            ))
            created.append(new_order)

        db.commit()

        # Publish events after commit
        for order in created:
            db.refresh(order)
            publish_event(
                topic="order-events",
                key=order.id,
                payload={"event_type": "order.created", "order_id": order.id, "status": "PENDING"},
            )

        return {
            "created": len(created),
            "order_ids": [o.id for o in created],
            "message": f"{len(created)} orders created and queued for processing.",
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Bulk order failed: {e}")


@app.get("/api/v1/orders/{order_id}")
def get_order_status(order_id: str, db: Session = Depends(get_db)):
    """Get a single order's current status."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return _order_to_dict(order)


@app.get("/api/v1/orders")
def list_orders(
    status: Optional[str] = Query(None, description="Filter by status: PENDING, PAID, SHIPPED, FAILED, CANCELLED"),
    search: Optional[str] = Query(None, description="Search by item name"),
    sort: str = Query("created_at", description="Sort field: created_at, updated_at, price"),
    order: str = Query("desc", description="Sort order: asc, desc"),
    db: Session = Depends(get_db),
):
    """List orders with optional filtering, searching, and sorting."""
    query = db.query(Order)

    # Filter by status
    if status:
        statuses = [s.strip().upper() for s in status.split(",")]
        query = query.filter(Order.status.in_(statuses))

    # Search by item name
    if search:
        query = query.filter(Order.item_name.ilike(f"%{search}%"))

    # Sort
    sort_column = getattr(Order, sort, Order.created_at)
    if order.lower() == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())

    orders = query.all()
    return [_order_to_dict(o) for o in orders]


@app.put("/api/v1/orders/{order_id}", status_code=202)
def update_order(order_id: str, payload: OrderUpdate, db: Session = Depends(get_db)):
    """Request an order update (only PENDING orders can be updated)."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != "PENDING":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot update order in '{order.status}' state. Only PENDING orders can be updated.",
        )

    publish_event(
        topic="order-events",
        key=order_id,
        payload={
            "event_type": "order.update_requested",
            "order_id": order_id,
            "item_name": payload.item_name,
            "price": payload.price,
        },
    )

    return {
        "order_id": order_id,
        "message": "Update request queued for processing.",
    }


@app.post("/api/v1/orders/{order_id}/pay", status_code=202)
def pay_for_order(order_id: str, db: Session = Depends(get_db)):
    """Simulate manual payment for a pending order."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != "PENDING":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot pay for order in '{order.status}' state. Only PENDING orders can be paid.",
        )

    publish_event(
        topic="order-events",
        key=order_id,
        payload={"event_type": "payment.received", "order_id": order_id},
    )

    return {
        "order_id": order_id,
        "message": "Payment received, processing...",
    }


@app.post("/api/v1/orders/{order_id}/retry", status_code=202)
def retry_payment(order_id: str, db: Session = Depends(get_db)):
    """Request a payment retry (resets 30s timer)."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != "PENDING":
        raise HTTPException(status_code=400, detail=f"Cannot retry order in '{order.status}' state.")

    # Record audit event
    db.add(OrderEvent(
        order_id=order.id,
        event_type="payment.retry",
        from_status="PENDING",
        to_status="PENDING",
        detail="User requested a manual retry. Timer reset."
    ))
    order.created_at = datetime.utcnow()
    db.commit()

    return {"order_id": order_id, "message": "Payment retry initiated."}


@app.post("/api/v1/orders/{order_id}/fail", status_code=202)
def fail_payment(order_id: str, db: Session = Depends(get_db)):
    """Explicitly fail an order when manual retries are exhausted."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != "PENDING":
        raise HTTPException(status_code=400, detail=f"Cannot fail order in '{order.status}' state.")

    order.status = "FAILED"
    db.add(OrderEvent(
        order_id=order.id,
        event_type="payment.failed",
        from_status="PENDING",
        to_status="FAILED",
        detail="Manual retries exhausted."
    ))
    db.commit()

    publish_event(
        topic="order-events",
        key=order_id,
        payload={"event_type": "payment.failed", "order_id": order_id, "status": "FAILED"},
    )

    return {"order_id": order_id, "message": "Order marked as FAILED."}


@app.delete("/api/v1/orders/{order_id}", status_code=202)
def cancel_order(order_id: str, db: Session = Depends(get_db)):
    """Request order cancellation (only PENDING/PAID orders)."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status not in ("PENDING", "PAID", "SHIPPED"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel order in '{order.status}' state. Only PENDING/PAID/SHIPPED orders can be cancelled.",
        )

    publish_event(
        topic="order-events",
        key=order_id,
        payload={"event_type": "order.cancel_requested", "order_id": order_id},
    )

    return {
        "order_id": order_id,
        "message": "Cancellation request queued for processing.",
    }


@app.get("/api/v1/orders/{order_id}/timeline")
def get_order_timeline(order_id: str, db: Session = Depends(get_db)):
    """Return the audit timeline for an order."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    events = (
        db.query(OrderEvent)
        .filter(OrderEvent.order_id == order_id)
        .order_by(OrderEvent.created_at.asc())
        .all()
    )

    return {
        "order_id": order_id,
        "events": [
            {
                "id": e.id,
                "event_type": e.event_type,
                "from_status": e.from_status,
                "to_status": e.to_status,
                "detail": e.detail,
                "created_at": str(e.created_at) if e.created_at else None,
            }
            for e in events
        ],
    }


@app.get("/api/v1/orders/{order_id}/retries")
def get_order_retries(order_id: str, db: Session = Depends(get_db)):
    """Return retry logs for an order."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    retries = (
        db.query(RetryLog)
        .filter(RetryLog.order_id == order_id)
        .order_by(RetryLog.created_at.asc())
        .all()
    )

    return {
        "order_id": order_id,
        "retries": [
            {
                "id": r.id,
                "task_name": r.task_name,
                "attempt": r.attempt,
                "max_retries": r.max_retries,
                "error_message": r.error_message,
                "backoff_seconds": r.backoff_seconds,
                "status": r.status,
                "created_at": str(r.created_at) if r.created_at else None,
            }
            for r in retries
        ],
    }


# --- WebSocket ---

@app.websocket("/ws/orders/{order_id}")
async def websocket_order(websocket: WebSocket, order_id: str):
    """WebSocket endpoint for real-time order status updates."""
    await manager.connect(order_id, websocket)
    try:
        while True:
            # Keep connection alive — listen for client messages (ping/pong)
            data = await websocket.receive_text()
            # Echo back as heartbeat acknowledgment
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(order_id, websocket)
    except Exception:
        manager.disconnect(order_id, websocket)

"""
WebSocket Connection Manager for real-time order status updates.

Architecture:
  - ConnectionManager: Tracks per-order WebSocket connections
  - ws_notification_queue: Thread-safe queue bridging Kafka consumer → async WebSocket
  - notify_order_update(): Called from Celery tasks via Redis pub/sub or directly
    from the Kafka consumer thread to push updates to connected clients
"""

import asyncio
import json
import logging
from queue import Queue, Empty
from fastapi import WebSocket

logger = logging.getLogger(__name__)

# Thread-safe queue for Kafka consumer thread → async WebSocket bridge
ws_notification_queue: Queue = Queue()


class ConnectionManager:
    """Manages WebSocket connections grouped by order_id."""

    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, order_id: str, websocket: WebSocket):
        """Accept and register a WebSocket connection for an order."""
        await websocket.accept()
        if order_id not in self.active_connections:
            self.active_connections[order_id] = []
        self.active_connections[order_id].append(websocket)
        logger.info(f"WebSocket connected for order {order_id} (total: {len(self.active_connections[order_id])})")

    def disconnect(self, order_id: str, websocket: WebSocket):
        """Remove a WebSocket connection."""
        if order_id in self.active_connections:
            self.active_connections[order_id] = [
                ws for ws in self.active_connections[order_id] if ws != websocket
            ]
            if not self.active_connections[order_id]:
                del self.active_connections[order_id]
        logger.info(f"WebSocket disconnected for order {order_id}")

    async def notify(self, order_id: str, data: dict):
        """Send a JSON message to all WebSocket clients tracking an order."""
        if order_id not in self.active_connections:
            return
        dead = []
        for ws in self.active_connections[order_id]:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        # Clean up dead connections
        for ws in dead:
            self.disconnect(order_id, ws)

    async def broadcast_all(self, data: dict):
        """Broadcast to ALL connected WebSocket clients (for bulk updates)."""
        for order_id in list(self.active_connections.keys()):
            await self.notify(order_id, data)


# Global singleton
manager = ConnectionManager()


async def ws_broadcast_loop():
    """
    Async loop that reads from ws_notification_queue (fed by Kafka consumer thread)
    and pushes updates to WebSocket clients.

    Runs as a background asyncio task during FastAPI lifespan.
    """
    logger.info("WebSocket broadcast loop started.")
    loop = asyncio.get_event_loop()
    while True:
        try:
            # Non-blocking check with short sleep to avoid busy-wait
            try:
                notification = await loop.run_in_executor(None, lambda: ws_notification_queue.get(timeout=0.5))
            except Empty:
                await asyncio.sleep(0.1)
                continue

            order_id = notification.get("order_id")
            if order_id:
                await manager.notify(order_id, notification)
                await manager.notify("all", notification)
                logger.debug(f"WS notification sent for order {order_id}: {notification.get('event_type')}")
        except asyncio.CancelledError:
            logger.info("WebSocket broadcast loop stopped.")
            break
        except Exception as e:
            logger.error(f"Error in WS broadcast loop: {e}")
            await asyncio.sleep(1)

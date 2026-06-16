"""
Celery application instance for the Order Workflow Engine.

Uses Redis as both the message broker and result backend.
All tasks are serialized as JSON for interoperability.
"""

from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "order_workflow",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    broker_connection_retry_on_startup=True,
    # Route task discovery to the workflows module
    imports=["app.tasks.workflows"],
)

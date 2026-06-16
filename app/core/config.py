"""
Central configuration for the Order Workflow Engine.

All settings can be overridden via environment variables.
"""

import os
# pyrefly: ignore [missing-import]
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "mysql+pymysql://root:root_password@localhost:3306/order_db",
    )
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    KAFKA_SERVERS: str = os.getenv("KAFKA_SERVERS", "localhost:9092")

    @property
    def CELERY_BROKER_URL(self) -> str:
        return self.REDIS_URL

    @property
    def CELERY_RESULT_BACKEND(self) -> str:
        return self.REDIS_URL


settings = Settings()

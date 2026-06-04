"""Application settings for the Halberd & Co FastAPI workflow service.

Loaded from environment variables (and an optional api/.env file). Kept
intentionally small — the FastAPI service only needs database access plus the
secrets used by the workflow runtime.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Neon connection string — MUST use the postgresql+asyncpg:// scheme so
    # SQLAlchemy selects the async driver. See api/.env.example.
    database_url: str = Field(..., alias="DATABASE_URL")

    # Workflow runtime secrets
    anthropic_api_key: str | None = Field(default=None, alias="ANTHROPIC_API_KEY")
    better_auth_secret: str | None = Field(default=None, alias="BETTER_AUTH_SECRET")
    trigger_dot_dev_secret: str | None = Field(default=None, alias="TRIGGER_DOT_DEV_SECRET")

    # Toggle SQL echo for local debugging
    db_echo: bool = Field(default=False, alias="DB_ECHO")


@lru_cache
def get_settings() -> Settings:
    """Cached settings singleton."""
    return Settings()  # type: ignore[call-arg]


settings = get_settings()

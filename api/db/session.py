"""Async SQLAlchemy engine + session factory for the FastAPI service.

The engine is created at import time from settings.database_url (which must use
the ``postgresql+asyncpg://`` scheme) and disposed on app shutdown via the
FastAPI lifespan handler in api/main.py.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from api.config import settings

engine = create_async_engine(settings.database_url, echo=settings.db_echo)

AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency yielding a request-scoped async session."""
    async with AsyncSessionLocal() as session:
        yield session

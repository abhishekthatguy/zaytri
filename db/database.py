"""
Zaytri — Database Engine & Session (PostgreSQL + AsyncPG)
"""

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from config import settings


# ─── Async Engine ────────────────────────────────────────────────────────────
engine = create_async_engine(
    settings.database_url,
    echo=settings.app_debug,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
)

# ─── Session Factory ────────────────────────────────────────────────────────
async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ─── Base Model ──────────────────────────────────────────────────────────────
class Base(DeclarativeBase):
    pass


# ─── Dependency for FastAPI ──────────────────────────────────────────────────
async def get_db() -> AsyncSession:
    """Yield a database session for FastAPI dependency injection."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ─── Init / Teardown ────────────────────────────────────────────────────────
async def init_db():
    """Create pgvector extension and all tables on startup."""
    # 1. Enable pgvector extension in its own transaction (non-fatal)
    try:
        async with engine.begin() as conn:
            await conn.execute(
                __import__("sqlalchemy").text("CREATE EXTENSION IF NOT EXISTS vector")
            )
    except Exception as e:
        from logging import getLogger
        getLogger("zaytri.db").warning(f"⚠️ pgvector extension not available: {e}. Falling back to text-based similarity.")
    
    # 2. Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db():
    """Dispose engine on shutdown."""
    await engine.dispose()

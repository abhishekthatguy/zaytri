"""
Zaytri — FastAPI Application Entrypoint
Main application with all routers, middleware, and lifecycle events.
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from db.database import init_db, close_db

# ─── Register ALL SQLAlchemy models (MUST be before any router/session import) ──
# This single import ensures all models are loaded in correct dependency order
# and all relationship() string references are eagerly resolved.
import db.register_models  # noqa: F401

# ─── Logging ─────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper()),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# ─── Lifespan ────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    # Startup
    logger.info("🚀 Starting Zaytri...")

    await init_db()
    logger.info("✅ Database initialized")

    # Seed default admin user
    from auth.seed import seed_default_user
    from db.database import async_session
    async with async_session() as session:
        await seed_default_user(session)

    # Check Ollama connectivity
    from brain.llm_router import llm_router
    default_llm = llm_router.get_default_provider()
    if await default_llm.health_check():
        logger.info(f"✅ Ollama connected (model: {settings.ollama_model})")
    else:
        logger.warning(f"⚠️  Ollama not available or model '{settings.ollama_model}' not found")

    yield

    # Shutdown
    logger.info("🛑 Shutting down Zaytri...")
    await close_db()
    logger.info("✅ Database connections closed")


# ─── App ─────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Zaytri API",
    description="Multi-Agent Social Media Automation System",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─── CORS ────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ─────────────────────────────────────────────────────────────────
from auth.router import router as auth_router
from api.workflows import router as workflow_router
from api.content import router as content_router
from api.analytics import router as analytics_router
from api.platforms import router as platforms_router
from api.settings import router as settings_router
from api.llm_settings import router as llm_settings_router
from api.chat import router as chat_router
from api.social_connections import router as social_connections_router
from api.whatsapp_approval import router as whatsapp_router
from api.calendar import router as calendar_router
from api.embeddings import router as embeddings_router

app.include_router(auth_router)
app.include_router(workflow_router)
app.include_router(content_router)
app.include_router(analytics_router)
app.include_router(platforms_router)
app.include_router(settings_router)
app.include_router(llm_settings_router)
app.include_router(chat_router)
app.include_router(social_connections_router)
app.include_router(whatsapp_router)
app.include_router(calendar_router)
app.include_router(embeddings_router)


# ─── Health Check ────────────────────────────────────────────────────────────
@app.get("/health", tags=["System"])
async def health_check():
    """System health check endpoint."""
    from brain.llm_router import llm_router
    ollama_ok = await llm_router.get_default_provider().health_check()

    return {
        "status": "healthy",
        "app": settings.app_name,
        "env": settings.app_env,
        "ollama": "connected" if ollama_ok else "disconnected",
    }


@app.get("/", tags=["System"])
async def root():
    """API root — basic info."""
    return {
        "name": "Zaytri API",
        "version": "1.0.0",
        "docs": "/docs",
    }

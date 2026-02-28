"""
Zaytri — Celery Application Configuration
Task queue with Redis broker and periodic task scheduling.
"""

from celery import Celery
from config import settings
from cron_config import CELERY_BEAT_SCHEDULE, TIMEZONE

# ─── Celery App ──────────────────────────────────────────────────────────────
celery_app = Celery(
    "zaytri",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

# ─── Configuration ──────────────────────────────────────────────────────────
celery_app.conf.update(
    # Serialization
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",

    # Timezone
    timezone=TIMEZONE,
    enable_utc=True,

    # Beat schedule (cron jobs)
    beat_schedule=CELERY_BEAT_SCHEDULE,

    # Task routing
    task_routes={
        "agents.scheduler_bot.*": {"queue": "scheduler"},
        "agents.publisher_bot.*": {"queue": "publisher"},
        "agents.engagement_bot.*": {"queue": "engagement"},
        "agents.analytics_agent.*": {"queue": "analytics"},
        "workflow.pipeline.*": {"queue": "pipeline"},
    },

    # Worker settings
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    task_reject_on_worker_lost=True,

    # Fix deprecation warning for Celery 6.0+
    broker_connection_retry_on_startup=True,

    # Result backend
    result_expires=86400,  # 24 hours
)

# ─── Register Tasks ──────────────────────────────────────────────────────────
# Explicitly import modules holding tasks to ensuring they are registered
# before autodiscover or when the worker starts.
import agents
import workflow.pipeline

# ─── Auto-discover tasks ────────────────────────────────────────────────────
celery_app.autodiscover_tasks([
    "agents",
    "workflow",
])

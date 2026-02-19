"""
Zaytri — Cron Schedule Configuration
All cron schedules are centralized here for easy modification.
Override any value via .env variables.
"""

import os
from celery.schedules import crontab


# ─── Helper to read env with defaults ────────────────────────────────────────
def _env_int(key: str, default: int) -> int:
    return int(os.getenv(key, str(default)))


def _env_str(key: str, default: str) -> str:
    return os.getenv(key, default)


# ─── Timezone ────────────────────────────────────────────────────────────────
TIMEZONE = _env_str("TIMEZONE", "Asia/Kolkata")

# ─── Scheduler Bot (Agent 4) ─────────────────────────────────────────────────
# Runs daily to fetch approved content and push to publish queue
SCHEDULER_CRON = crontab(
    hour=_env_int("SCHEDULER_CRON_HOUR", 9),
    minute=_env_int("SCHEDULER_CRON_MINUTE", 0),
)

# ─── Engagement Bot (Agent 6) ────────────────────────────────────────────────
# Delay (in hours) after publishing before monitoring comments
ENGAGEMENT_DELAY_HOURS = _env_int("ENGAGEMENT_DELAY_HOURS", 2)

# ─── Analytics Agent (Agent 7) ───────────────────────────────────────────────
# Weekly analytics report — default: Monday at 8:00 AM
ANALYTICS_CRON = crontab(
    hour=_env_int("ANALYTICS_CRON_HOUR", 8),
    minute=_env_int("ANALYTICS_CRON_MINUTE", 0),
    day_of_week=_env_int("ANALYTICS_CRON_DAY_OF_WEEK", 1),  # 1 = Monday
)

# ─── Celery Beat Schedule Dictionary ─────────────────────────────────────────
# Import this in celery_app.py as the beat_schedule
CELERY_BEAT_SCHEDULE = {
    "scheduler-bot-daily": {
        "task": "agents.scheduler_bot.run_scheduler",
        "schedule": SCHEDULER_CRON,
        "options": {"queue": "scheduler"},
    },
    "analytics-agent-weekly": {
        "task": "agents.analytics_agent.run_analytics",
        "schedule": ANALYTICS_CRON,
        "options": {"queue": "analytics"},
    },
}

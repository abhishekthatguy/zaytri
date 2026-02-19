"""
Zaytri — Alembic Migrations Environment
Automatically discovers all models and configures the database URL from config.py.
"""

from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

# ─── Alembic Config ──────────────────────────────────────────────────────────
config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ─── Import ALL models so metadata knows about them ─────────────────────────
from db.database import Base       # noqa: E402
import db.models                   # noqa: E402, F401
import db.settings_models          # noqa: E402, F401
import db.social_connections       # noqa: E402, F401
import db.whatsapp_approval        # noqa: E402, F401
import auth.models                 # noqa: E402, F401

target_metadata = Base.metadata

# ─── Override sqlalchemy.url from app config ─────────────────────────────────
from config import settings        # noqa: E402
# Alembic uses SYNC driver (not asyncpg)
config.set_main_option("sqlalchemy.url", settings.database_url_sync)


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode — generates SQL without connecting."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode — connects to the database."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

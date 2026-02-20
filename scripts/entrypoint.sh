#!/bin/bash
set -e

echo "═══════════════════════════════════════════════════════════════════"
echo "  Zaytri — Production Entrypoint"
echo "═══════════════════════════════════════════════════════════════════"

# ─── Wait for PostgreSQL ─────────────────────────────────────────────────────
echo "⏳ Waiting for PostgreSQL to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0
until python -c "
import psycopg2
import os

url = os.environ.get('DATABASE_URL_SYNC', '')
# Parse the URL for psycopg2
if url.startswith('postgresql://'):
    parts = url.replace('postgresql://', '')
    user_pass, host_db = parts.split('@')
    user, password = user_pass.split(':')
    host_port, db = host_db.split('/')
    host = host_port.split(':')[0]
    port = host_port.split(':')[1] if ':' in host_port else '5432'
    conn = psycopg2.connect(host=host, port=port, user=user, password=password, dbname=db)
    conn.close()
    print('✅ PostgreSQL is ready')
" 2>/dev/null; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "❌ PostgreSQL did not become ready in time. Exiting."
        exit 1
    fi
    echo "  Retry $RETRY_COUNT/$MAX_RETRIES..."
    sleep 2
done

# ─── Wait for Redis ──────────────────────────────────────────────────────────
echo "⏳ Waiting for Redis to be ready..."
RETRY_COUNT=0
until python -c "
import redis
import os
r = redis.from_url(os.environ.get('REDIS_URL', 'redis://redis:6379/0'))
r.ping()
print('✅ Redis is ready')
" 2>/dev/null; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "❌ Redis did not become ready in time. Exiting."
        exit 1
    fi
    echo "  Retry $RETRY_COUNT/$MAX_RETRIES..."
    sleep 2
done

# ─── Run Database Migrations ────────────────────────────────────────────────
echo "🔄 Running database migrations..."

# First, ensure all tables exist using SQLAlchemy create_all (handles ordering)
python -c "
import os
from sqlalchemy import create_engine
from db.database import Base
# Import ALL models so metadata knows about them
import auth.models
import db.models
import db.settings_models
import db.social_connections
import db.whatsapp_approval
try:
    import db.calendar_models
except ImportError:
    pass

url = os.environ.get('DATABASE_URL_SYNC', '')
engine = create_engine(url)
Base.metadata.create_all(bind=engine)
print('✅ Tables created/verified')
engine.dispose()
"

# Then stamp alembic to current head (so future migrations work)
alembic stamp head 2>/dev/null || echo "⚠️  Alembic stamp skipped"

# Run any pending migrations
alembic upgrade head 2>/dev/null && echo "✅ Migrations complete" || echo "⚠️  Migrations skipped (tables already up to date)"

# ─── Start the Application ──────────────────────────────────────────────────
echo "🚀 Starting Zaytri ($1)..."
exec "$@"

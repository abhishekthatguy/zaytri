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
alembic upgrade head
echo "✅ Migrations complete"

# ─── Start the Application ──────────────────────────────────────────────────
echo "🚀 Starting Zaytri ($1)..."
exec "$@"

#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Zaytri — Start Script
# Reads all port config from .env → starts everything on the right ports.
# Usage:
#   ./scripts/start.sh                  # Development mode (local)
#   ./scripts/start.sh --flush-redis    # Dev mode + flush Redis cache first
#   ./scripts/start.sh --docker         # Docker Compose mode
# ─────────────────────────────────────────────────────────────────────────────

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()  { echo -e "${CYAN}[Zaytri]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[Zaytri]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[Zaytri]${NC} $1"; }
log_error() { echo -e "${RED}[Zaytri]${NC} $1"; }

# ─── Load .env ───────────────────────────────────────────────────────────────
if [ -f .env ]; then
    # Source .env but skip comments and empty lines
    set -a
    source .env
    set +a
else
    log_warn ".env file not found. Copying from .env.example..."
    cp .env.example .env 2>/dev/null || true
    if [ -f .env ]; then set -a; source .env; set +a; fi
fi

# ─── Read ports (with defaults) ─────────────────────────────────────────────
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
REDIS_PORT="${REDIS_PORT:-6379}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
OLLAMA_PORT="${OLLAMA_PORT:-11434}"
FLUSH_REDIS="${FLUSH_REDIS_ON_START:-false}"

# Auto-derive URLs from ports (these are the canonical values)
REDIS_URL="${REDIS_URL:-redis://localhost:${REDIS_PORT}/0}"
OLLAMA_HOST="${OLLAMA_HOST:-http://localhost:${OLLAMA_PORT}}"
NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:${BACKEND_PORT}}"
CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:${FRONTEND_PORT},http://localhost:${BACKEND_PORT}}"

# ─── Docker Mode ─────────────────────────────────────────────────────────────
if [[ "$1" == "--docker" || "$1" == "--prod" ]]; then
    log_info "Starting Zaytri in Docker mode..."
    BACKEND_PORT="${BACKEND_PORT}" \
    FRONTEND_PORT="${FRONTEND_PORT}" \
    REDIS_PORT="${REDIS_PORT}" \
    POSTGRES_PORT="${POSTGRES_PORT}" \
    OLLAMA_PORT="${OLLAMA_PORT}" \
    docker compose up --build -d
    log_ok "All services started!"
    echo ""
    log_info "Services:"
    echo "  🌐 Frontend:     http://localhost:${FRONTEND_PORT}"
    echo "  🔧 Backend API:  http://localhost:${BACKEND_PORT}"
    echo "  📚 API Docs:     http://localhost:${BACKEND_PORT}/docs"
    echo ""
    log_info "Run 'docker compose logs -f' to view logs"
    exit 0
fi

# ═════════════════════════════════════════════════════════════════════════════
# Dev Mode (Local)
# ═════════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║            Zaytri — Starting Up                ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
log_info "Port Config:"
echo "  🔧 Backend:     ${BACKEND_PORT}"
echo "  🌐 Frontend:    ${FRONTEND_PORT}"
echo "  🗄️  Redis:       ${REDIS_PORT}"
echo "  🐘 PostgreSQL:  ${POSTGRES_PORT}"
echo "  🧠 Ollama:      ${OLLAMA_PORT}"
echo ""

# ─── Flush Redis cache if flag is set ────────────────────────────────────────
if [[ "$FLUSH_REDIS" == "true" || "$1" == "--flush-redis" ]]; then
    log_warn "Flushing Redis cache on port ${REDIS_PORT}..."
    if command -v redis-cli &> /dev/null; then
        redis-cli -p "${REDIS_PORT}" FLUSHALL 2>/dev/null && log_ok "  ✓ Redis cache flushed!" || log_warn "  ✗ Could not connect to Redis"
    elif python3 -c "import redis" 2>/dev/null; then
        python3 -c "import redis; r = redis.Redis(host='localhost', port=${REDIS_PORT}); r.flushall(); print('  ✓ Redis cache flushed!')" 2>/dev/null || log_warn "  ✗ Could not connect to Redis"
    else
        log_warn "  Neither redis-cli nor python redis module found. Skipping flush."
    fi
    echo ""
fi

# ─── Trap to cleanup background processes ────────────────────────────────────
cleanup() {
    echo ""
    log_info "Shutting down all services..."
    kill $BACKEND_PID $CELERY_PID $BEAT_PID $FRONTEND_PID 2>/dev/null
    wait $BACKEND_PID $CELERY_PID $BEAT_PID $FRONTEND_PID 2>/dev/null
    log_ok "All services stopped."
    exit 0
}
trap cleanup SIGINT SIGTERM

# ─── Start Backend (FastAPI) ─────────────────────────────────────────────────
log_info "Starting FastAPI backend on :${BACKEND_PORT}..."
python3 -m uvicorn main:app --host 0.0.0.0 --port "${BACKEND_PORT}" --reload &
BACKEND_PID=$!

# ─── Start Celery Worker ─────────────────────────────────────────────────────
log_info "Starting Celery worker..."
python3 -m celery -A celery_app worker --loglevel=info --concurrency=2 -Q pipeline,scheduler,publisher,engagement,analytics &
CELERY_PID=$!

# ─── Start Celery Beat ───────────────────────────────────────────────────────
log_info "Starting Celery Beat..."
python3 -m celery -A celery_app beat --loglevel=info &
BEAT_PID=$!

# ─── Start Frontend (Next.js) ────────────────────────────────────────────────
log_info "Starting Next.js frontend on :${FRONTEND_PORT}..."
cd frontend && \
    NEXT_PUBLIC_API_URL="http://localhost:${BACKEND_PORT}" \
    PORT="${FRONTEND_PORT}" \
    npm run dev -- -p "${FRONTEND_PORT}" &
FRONTEND_PID=$!
cd "$PROJECT_ROOT"

echo ""
log_ok "All services started!"
echo ""
log_info "Access Zaytri:"
echo "  🌐 Frontend:     http://localhost:${FRONTEND_PORT}"
echo "  🔧 Backend API:  http://localhost:${BACKEND_PORT}"
echo "  📚 API Docs:     http://localhost:${BACKEND_PORT}/docs"
echo ""
log_info "Ollama tip: Run 'OLLAMA_HOST=0.0.0.0:${OLLAMA_PORT} ollama serve' in another terminal"
log_info "Press Ctrl+C to stop all services"

# Wait for any process to exit
wait

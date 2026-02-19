#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Zaytri — Stop / Kill Script
# Kills all processes using Zaytri ports for a clean fresh start.
# Usage:
#   ./scripts/stop.sh                # Kill all Zaytri port processes
#   ./scripts/stop.sh --flush-redis  # Also flush Redis cache
#   ./scripts/stop.sh --all          # Kill ports + flush Redis
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
    set -a; source .env; set +a
fi

# ─── Read ports (with defaults) ─────────────────────────────────────────────
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
REDIS_PORT="${REDIS_PORT:-6379}"

echo ""
echo -e "${RED}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║          Zaytri — Stop All Services            ║${NC}"
echo -e "${RED}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ─── Kill processes on each port ─────────────────────────────────────────────
kill_port() {
    local port=$1
    local label=$2
    local pids=$(lsof -ti :$port 2>/dev/null)

    if [ -n "$pids" ]; then
        log_warn "Killing processes on port ${port} (${label})..."
        for pid in $pids; do
            local proc_name=$(ps -p $pid -o comm= 2>/dev/null)
            kill -9 "$pid" 2>/dev/null && log_ok "  ✓ Killed PID ${pid} (${proc_name:-unknown})" || true
        done
    else
        log_info "  Port ${port} (${label}) — already free ✓"
    fi
}

log_info "Stopping services on configured ports..."
echo ""

kill_port "$BACKEND_PORT"  "Backend / FastAPI"
kill_port "$FRONTEND_PORT" "Frontend / Next.js"

echo ""

# ─── Kill orphan Celery/uvicorn processes ────────────────────────────────────
log_info "Checking for orphan Zaytri processes..."

CELERY_PIDS=$(pgrep -f "celery_app" 2>/dev/null)
if [ -n "$CELERY_PIDS" ]; then
    log_warn "Killing Celery workers..."
    for pid in $CELERY_PIDS; do
        kill -9 "$pid" 2>/dev/null && log_ok "  ✓ Killed Celery PID ${pid}" || true
    done
else
    log_info "  Celery — no running workers ✓"
fi

UVICORN_PIDS=$(pgrep -f "uvicorn main:app" 2>/dev/null)
if [ -n "$UVICORN_PIDS" ]; then
    log_warn "Killing uvicorn processes..."
    for pid in $UVICORN_PIDS; do
        kill -9 "$pid" 2>/dev/null && log_ok "  ✓ Killed uvicorn PID ${pid}" || true
    done
else
    log_info "  Uvicorn — no running processes ✓"
fi

# ─── Flush Redis Cache ──────────────────────────────────────────────────────
if [[ "$1" == "--flush-redis" || "$1" == "--all" || "$1" == "--flush" ]]; then
    echo ""
    log_warn "Flushing Redis cache on port ${REDIS_PORT}..."
    if command -v redis-cli &> /dev/null; then
        redis-cli -p "${REDIS_PORT}" FLUSHALL 2>/dev/null && log_ok "  ✓ Redis cache flushed!" || log_warn "  ✗ Could not connect to Redis on port ${REDIS_PORT}"
    elif python3 -c "import redis" 2>/dev/null; then
        python3 -c "
import redis
try:
    r = redis.Redis(host='localhost', port=${REDIS_PORT})
    r.flushall()
    print('  ✓ Redis cache flushed!')
except Exception as e:
    print(f'  ✗ Could not connect to Redis: {e}')
" 2>/dev/null
    else
        log_warn "  Neither redis-cli nor python redis module available."
    fi
fi

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          All Zaytri services stopped!          ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
log_info "Port status:"
for port in "$BACKEND_PORT" "$FRONTEND_PORT"; do
    if lsof -ti :$port &>/dev/null; then
        log_error "  Port ${port} — STILL IN USE ✗"
    else
        log_ok "  Port ${port} — Free ✓"
    fi
done
echo ""
log_info "Run ./scripts/start.sh to restart Zaytri"
echo ""

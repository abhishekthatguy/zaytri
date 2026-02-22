#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Zaytri — Build Script
# Runs all tests first, then builds both backend and frontend.
# Usage:
#   ./scripts/build.sh              # Full: tests + build
#   ./scripts/build.sh --skip-tests # Build only (skip tests)
#   ./scripts/build.sh --tests-only # Run tests without building
#   ./scripts/build.sh --frontend   # Build frontend only (with tests)
#   ./scripts/build.sh --backend    # Validate backend only (with tests)
# ─────────────────────────────────────────────────────────────────────────────

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_info()  { echo -e "${CYAN}[Build]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[Build]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[Build]${NC} $1"; }
log_error() { echo -e "${RED}[Build]${NC} $1"; }

SKIP_TESTS=false
TESTS_ONLY=false
FRONTEND_ONLY=false
BACKEND_ONLY=false
EXIT_CODE=0

# ─── Parse args ──────────────────────────────────────────────────────────────
for arg in "$@"; do
    case $arg in
        --skip-tests)  SKIP_TESTS=true ;;
        --tests-only)  TESTS_ONLY=true ;;
        --frontend)    FRONTEND_ONLY=true ;;
        --backend)     BACKEND_ONLY=true ;;
        -h|--help)
            echo "Usage: ./scripts/build.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --skip-tests   Skip tests, build only"
            echo "  --tests-only   Run tests without building"
            echo "  --frontend     Build frontend only (with tests)"
            echo "  --backend      Validate backend only (with tests)"
            echo "  -h, --help     Show this help"
            exit 0
            ;;
        *)
            log_error "Unknown option: $arg"
            exit 1
            ;;
    esac
done

# ─── Load .env ───────────────────────────────────────────────────────────────
if [ -f .env ]; then
    set -a; source .env; set +a
fi

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║            Zaytri — Build Pipeline             ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""

START_TIME=$(date +%s)

# ═════════════════════════════════════════════════════════════════════════════
# PHASE 1: Tests
# ═════════════════════════════════════════════════════════════════════════════

PYTHON_BIN="python3"
if [ -d "$PROJECT_ROOT/.venv" ]; then
    PYTHON_BIN="$PROJECT_ROOT/.venv/bin/python3"
fi

run_tests() {
    echo -e "${BOLD}━━━ Phase 1: Running Tests ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    # ── 1a. Python import check ──────────────────────────────────────────
    log_info "Checking Python imports..."
    $PYTHON_BIN -c "
from config import settings
from main import app
from agents.master_agent import MasterAgent, ActionExecutor
from api.chat import router as chat_router
from utils.crypto import encrypt_value, decrypt_value, mask_value
from db.settings_models import ChatMessage
from brain.llm_router import AGENT_IDS
print('All imports OK')
" 2>&1
    if [ $? -ne 0 ]; then
        log_error "❌ Python import check FAILED"
        return 1
    fi
    log_ok "  ✓ Python imports pass"

    # ── 1b. Python unit tests (pytest) ───────────────────────────────────
    log_info "Running Python tests..."
    if $PYTHON_BIN -m pytest --version &>/dev/null; then
        $PYTHON_BIN -m pytest tests/ -v --tb=short --no-header -q 2>&1
        if [ $? -ne 0 ]; then
            log_error "❌ Python tests FAILED"
            return 1
        fi
        log_ok "  ✓ Python tests pass"
    else
        log_warn "  ⚠ pytest not installed, skipping Python tests"
    fi

    # ── 1c. TypeScript type check ────────────────────────────────────────
    log_info "Running TypeScript type check..."
    cd "$PROJECT_ROOT/frontend"
    if [ -f "node_modules/.bin/tsc" ]; then
        npx tsc --noEmit 2>&1
        if [ $? -ne 0 ]; then
            log_error "❌ TypeScript type check FAILED"
            cd "$PROJECT_ROOT"
            return 1
        fi
        log_ok "  ✓ TypeScript types pass"
    elif command -v npx &>/dev/null; then
        npx tsc --noEmit 2>&1
        if [ $? -ne 0 ]; then
            log_error "❌ TypeScript type check FAILED"
            cd "$PROJECT_ROOT"
            return 1
        fi
        log_ok "  ✓ TypeScript types pass"
    else
        log_warn "  ⚠ npx not found, skipping TypeScript check"
    fi
    cd "$PROJECT_ROOT"

    # ── 1d. ESLint (frontend) ────────────────────────────────────────────
    log_info "Running ESLint..."
    cd "$PROJECT_ROOT/frontend"
    if [ -f "node_modules/.bin/eslint" ]; then
        npx eslint src/ --max-warnings 50 2>&1
        if [ $? -ne 0 ]; then
            log_warn "  ⚠ ESLint found issues (non-blocking)"
        else
            log_ok "  ✓ ESLint pass"
        fi
    else
        log_warn "  ⚠ ESLint not available, skipping"
    fi
    cd "$PROJECT_ROOT"

    echo ""
    log_ok "✅ All tests passed!"
    echo ""
    return 0
}

# ═════════════════════════════════════════════════════════════════════════════
# PHASE 2: Build Backend
# ═════════════════════════════════════════════════════════════════════════════

build_backend() {
    echo -e "${BOLD}━━━ Phase 2a: Backend Validation ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    # ── Check all dependencies ───────────────────────────────────────────
    log_info "Checking Python dependencies..."
    $PYTHON_BIN -c "import fastapi, uvicorn, sqlalchemy, celery, httpx, cryptography; print('All deps OK')" 2>&1
    if [ $? -ne 0 ]; then
        log_error "❌ Missing Python dependencies. Run: pip3 install -r requirements.txt"
        return 1
    fi
    log_ok "  ✓ Python dependencies OK"

    # ── Validate app loads ───────────────────────────────────────────────
    log_info "Validating FastAPI app..."
    ROUTE_COUNT=$($PYTHON_BIN -c "from main import app; print(len(app.routes))" 2>&1)
    if [ $? -ne 0 ]; then
        log_error "❌ FastAPI app failed to load"
        echo "$ROUTE_COUNT"
        return 1
    fi
    log_ok "  ✓ FastAPI app loaded — ${ROUTE_COUNT} routes registered"

    # ── Validate config ──────────────────────────────────────────────────
    log_info "Validating config..."
    $PYTHON_BIN -c "
from config import settings
assert settings.backend_port > 0, 'Invalid backend port'
assert settings.frontend_port > 0, 'Invalid frontend port'
assert settings.redis_url, 'Redis URL is empty'
assert settings.database_url, 'Database URL is empty'
print(f'  Backend:{settings.backend_port} Frontend:{settings.frontend_port} Redis:{settings.redis_port}')
" 2>&1
    if [ $? -ne 0 ]; then
        log_error "❌ Config validation failed"
        return 1
    fi
    log_ok "  ✓ Config valid"

    echo ""
    log_ok "✅ Backend validation passed!"
    echo ""
    return 0
}

# ═════════════════════════════════════════════════════════════════════════════
# PHASE 3: Build Frontend
# ═════════════════════════════════════════════════════════════════════════════

build_frontend() {
    echo -e "${BOLD}━━━ Phase 2b: Frontend Build ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    cd "$PROJECT_ROOT/frontend"

    # ── Check node_modules ───────────────────────────────────────────────
    if [ ! -d "node_modules" ]; then
        log_info "Installing npm dependencies..."
        npm ci 2>&1
        if [ $? -ne 0 ]; then
            log_error "❌ npm ci failed"
            cd "$PROJECT_ROOT"
            return 1
        fi
        log_ok "  ✓ npm dependencies installed"
    fi

    # ── Production build ─────────────────────────────────────────────────
    log_info "Building Next.js production bundle..."
    NEXT_PUBLIC_API_URL="http://localhost:${BACKEND_PORT}" npx next build 2>&1
    if [ $? -ne 0 ]; then
        log_error "❌ Next.js build FAILED"
        cd "$PROJECT_ROOT"
        return 1
    fi

    cd "$PROJECT_ROOT"
    echo ""
    log_ok "✅ Frontend build passed!"
    echo ""
    return 0
}

# ═════════════════════════════════════════════════════════════════════════════
# Orchestration
# ═════════════════════════════════════════════════════════════════════════════

# Run tests (unless skipped)
if [ "$SKIP_TESTS" = false ]; then
    run_tests
    if [ $? -ne 0 ]; then
        echo ""
        log_error "🛑 Tests failed — build aborted."
        log_error "   Fix the issues above, or use --skip-tests to bypass."
        echo ""
        exit 1
    fi
fi

# Stop here if tests-only mode
if [ "$TESTS_ONLY" = true ]; then
    END_TIME=$(date +%s)
    ELAPSED=$((END_TIME - START_TIME))
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║          All tests passed! (${ELAPSED}s)                 ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
    echo ""
    exit 0
fi

# Build backend (unless frontend-only)
if [ "$FRONTEND_ONLY" = false ]; then
    build_backend
    if [ $? -ne 0 ]; then
        log_error "🛑 Backend validation failed — build aborted."
        exit 1
    fi
fi

# Build frontend (unless backend-only)
if [ "$BACKEND_ONLY" = false ]; then
    build_frontend
    if [ $? -ne 0 ]; then
        log_error "🛑 Frontend build failed — build aborted."
        exit 1
    fi
fi

# ═════════════════════════════════════════════════════════════════════════════
# Summary
# ═════════════════════════════════════════════════════════════════════════════

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        🎉 Build Successful! (${ELAPSED}s)                ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════╣${NC}"
if [ "$SKIP_TESTS" = false ]; then
echo -e "${GREEN}║  ✓ Tests          — All passed                  ║${NC}"
fi
if [ "$FRONTEND_ONLY" = false ]; then
echo -e "${GREEN}║  ✓ Backend        — Validated & ready           ║${NC}"
fi
if [ "$BACKEND_ONLY" = false ]; then
echo -e "${GREEN}║  ✓ Frontend       — Production bundle built     ║${NC}"
fi
echo -e "${GREEN}╠══════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Run:  ./scripts/start.sh                       ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""

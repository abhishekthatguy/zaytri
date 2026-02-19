#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Zaytri — Test Runner Script
# Runs the test suite with coverage. CI/CD ready.
# Usage:
#   ./scripts/run_tests.sh          # Run all tests with coverage
#   ./scripts/run_tests.sh --ci     # CI mode — XML output for pipeline parsing
#   ./scripts/run_tests.sh --quick  # Run without coverage
# ─────────────────────────────────────────────────────────────────────────────

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()  { echo -e "${CYAN}[Zaytri Tests]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[Zaytri Tests]${NC} $1"; }
log_error() { echo -e "${RED}[Zaytri Tests]${NC} $1"; }

# ─── Parse Arguments ─────────────────────────────────────────────────────────
CI_MODE=false
QUICK_MODE=false

for arg in "$@"; do
    case $arg in
        --ci)     CI_MODE=true ;;
        --quick)  QUICK_MODE=true ;;
    esac
done

# ─── Build Command ──────────────────────────────────────────────────────────
CMD="python -m pytest tests/ -v"

if [ "$CI_MODE" = true ]; then
    log_info "Running in CI mode..."
    CMD="$CMD --junitxml=test-results/results.xml --cov=. --cov-report=xml:test-results/coverage.xml"
    mkdir -p test-results
elif [ "$QUICK_MODE" = true ]; then
    log_info "Running quick tests (no coverage)..."
else
    log_info "Running tests with coverage..."
    CMD="$CMD --cov=. --cov-report=html:htmlcov --cov-report=term-missing"
fi

# ─── Run ─────────────────────────────────────────────────────────────────────
log_info "Command: $CMD"
echo ""

if eval $CMD; then
    echo ""
    log_ok "✅ All tests passed!"

    if [ "$QUICK_MODE" = false ] && [ "$CI_MODE" = false ]; then
        log_info "Coverage report: htmlcov/index.html"
    fi
    exit 0
else
    echo ""
    log_error "❌ Some tests failed!"
    exit 1
fi

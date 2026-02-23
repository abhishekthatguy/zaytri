#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Zaytri — One-Line Installer
# Install Zaytri on any system with a single command:
#
#   curl -fsSL https://raw.githubusercontent.com/abhishekthatguy/zaytri/main/install.sh | bash
#
# Modes:
#   ... | bash                     # Auto-detect best method
#   ... | bash -s -- --docker      # Force Docker Compose (development)
#   ... | bash -s -- --production  # Force Docker Compose (production)
#   ... | bash -s -- --local       # Force local (Python + Node) install
#   ... | bash -s -- --dir /path   # Custom install directory
# ─────────────────────────────────────────────────────────────────────────────

set -e

# ─── Config ──────────────────────────────────────────────────────────────────
REPO_URL="https://github.com/abhishekthatguy/zaytri.git"
INSTALL_DIR="${HOME}/projects/zaytri"
MODE="auto"   # auto | docker | production | local
BRANCH="main"
DOMAIN="zaytri.abhishekthatguy.in"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()      { echo -e "${CYAN}[Zaytri]${NC} $1"; }
log_ok()   { echo -e "${GREEN}[Zaytri]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[Zaytri]${NC} $1"; }
log_err()  { echo -e "${RED}[Zaytri]${NC} $1"; }

# ─── Security Warning ────────────────────────────────────────────────────────
show_security_warning() {
    echo ""
    echo -e "${YELLOW}${BOLD}  ⚠️  SECURITY NOTIFICATION${NC}"
    echo -e "  ─────────────────────────────────────────────────────"
    echo -e "  Zaytri wants to install the '${BOLD}zaytri${NC}' command to your system"
    echo -e "  so you can run it from anywhere. This requires ${BOLD}sudo${NC} privileges."
    echo ""
    echo -e "  ${BOLD}Security Risk:${NC} Only grant sudo access to scripts you trust."
    echo -e "  Repository: ${REPO_URL}"
    echo -e "  ─────────────────────────────────────────────────────"
    echo ""
}

# ─── Parse args ──────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case $1 in
        --docker)      MODE="docker"; shift ;;
        --production)  MODE="production"; shift ;;
        --prod)        MODE="production"; shift ;;
        --local)       MODE="local"; shift ;;
        --dir)         INSTALL_DIR="$2"; shift 2 ;;
        --branch)      BRANCH="$2"; shift 2 ;;
        --domain)      DOMAIN="$2"; shift 2 ;;
        *)             shift ;;
    esac
done

# ─── Banner ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}"
cat << 'BANNER'

 ______              _            
|___  /             | |       
   / /  __ _ _   _  | |_ _ __  _
  / /  / _` | | | || __ | '_ || |
 / /__| (_| | |_| | | |_| |   | |
\_____/\__,_|\__, |  \__|_|   |_| -------------------------------------------------
               __/ |              
              |___/               


BANNER
echo -e "${NC}"
echo -e "${BOLD}  Welcome to Zaytri! - AI Orchestration Engine ${NC}"
echo -e "  ─────────────────────────────────────────────────────"
echo ""

# ─── System Detection ───────────────────────────────────────────────────────
OS="unknown"
ARCH="$(uname -m)"

case "$(uname -s)" in
    Linux*)   OS="linux" ;;
    Darwin*)  OS="macos" ;;
    MINGW*|MSYS*|CYGWIN*) OS="windows" ;;
esac

log "Detected: ${OS} (${ARCH})"

# ─── Dependency Checks ──────────────────────────────────────────────────────
HAS_GIT=false
HAS_DOCKER=false
HAS_PYTHON=false
HAS_NODE=false
HAS_PIP=false

command -v git     &>/dev/null && HAS_GIT=true
command -v docker  &>/dev/null && HAS_DOCKER=true
(command -v python3 &>/dev/null || command -v python &>/dev/null) && HAS_PYTHON=true
command -v node    &>/dev/null && HAS_NODE=true
(command -v pip3 &>/dev/null || command -v pip &>/dev/null) && HAS_PIP=true

log "Dependencies:"
$HAS_GIT    && log_ok "  ✓ git"     || log_err "  ✗ git (required)"
$HAS_DOCKER && log_ok "  ✓ docker"  || log_warn "  ✗ docker (optional)"
$HAS_PYTHON && log_ok "  ✓ python3" || log_warn "  ✗ python3"
$HAS_NODE   && log_ok "  ✓ node"    || log_warn "  ✗ node"
$HAS_PIP    && log_ok "  ✓ pip"     || log_warn "  ✗ pip"
echo ""

# ─── Auto-detect mode ───────────────────────────────────────────────────────
if [ "$MODE" = "auto" ]; then
    if $HAS_DOCKER && docker info &>/dev/null 2>&1; then
        MODE="docker"
        log "Auto-selected: ${BOLD}Docker mode${NC} (Docker is running)"
    elif $HAS_PYTHON && $HAS_NODE; then
        MODE="local"
        log "Auto-selected: ${BOLD}Local mode${NC} (Python + Node available)"
    elif $HAS_DOCKER; then
        MODE="docker"
        log "Auto-selected: ${BOLD}Docker mode${NC}"
    else
        log_err "Cannot auto-detect install mode."
        log_err "Please install either Docker or Python3 + Node.js, then re-run."
        exit 1
    fi
fi
echo ""

# ─── Validate requirements ──────────────────────────────────────────────────
if ! $HAS_GIT; then
    log_err "git is required. Install it first:"
    case $OS in
        macos)   echo "  brew install git" ;;
        linux)   echo "  sudo apt install git  (Debian/Ubuntu)" ;;
        *)       echo "  https://git-scm.com/downloads" ;;
    esac
    exit 1
fi

if [ "$MODE" = "docker" ] || [ "$MODE" = "production" ]; then
    if ! $HAS_DOCKER; then
        log_err "Docker mode selected but Docker is not installed."
        log_err "Install Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi
    if ! docker info &>/dev/null 2>&1; then
        log_err "Docker is installed but not running. Start Docker first."
        exit 1
    fi
    # Check docker compose
    if ! docker compose version &>/dev/null 2>&1; then
        log_err "Docker Compose V2 is required but not available."
        log_err "Update Docker or install docker-compose-plugin."
        exit 1
    fi
fi

if [ "$MODE" = "local" ]; then
    if ! $HAS_PYTHON; then
        log_err "Python 3.9+ is required for local mode."
        exit 1
    fi
    if ! $HAS_NODE; then
        log_err "Node.js 18+ is required for local mode."
        exit 1
    fi
fi

# ═════════════════════════════════════════════════════════════════════════════
# Step 1: Clone Repository
# ═════════════════════════════════════════════════════════════════════════════

# Ensure parent directory exists
PARENT_DIR="$(dirname "$INSTALL_DIR")"
if [ ! -d "$PARENT_DIR" ]; then
    log "Creating directory ${PARENT_DIR}..."
    mkdir -p "$PARENT_DIR"
fi

if [ -d "$INSTALL_DIR/.git" ]; then
    log "Directory $INSTALL_DIR already exists."
    log "Updating with git pull..."
    cd "$INSTALL_DIR"
    git pull origin "$BRANCH" 2>/dev/null || true
else
    if [ -d "$INSTALL_DIR" ] && [ "$(ls -A "$INSTALL_DIR" 2>/dev/null)" ]; then
        log_warn "Directory $INSTALL_DIR exists but is not a git repo."
        log_warn "Backing up to ${INSTALL_DIR}.bak..."
        mv "$INSTALL_DIR" "${INSTALL_DIR}.bak.$(date +%s)"
    fi
    log "Cloning Zaytri into ${INSTALL_DIR}..."
    git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

log_ok "  ✓ Repository ready at ${INSTALL_DIR}"
echo ""

# ═════════════════════════════════════════════════════════════════════════════
# Step 2: Generate Secrets & Setup Environment
# ═════════════════════════════════════════════════════════════════════════════

generate_secret() {
    # Generate a secure random string (64 chars)
    python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || \
        openssl rand -hex 32 2>/dev/null || \
        head -c 64 /dev/urandom | base64 | tr -d '=/+' | head -c 64
}

if [ "$MODE" = "production" ]; then
    # ── Production: create .env.production if missing ──────────────────
    if [ ! -f .env.production ]; then
        log "Creating .env.production with secure secrets..."

        POSTGRES_PASS=$(generate_secret)
        REDIS_PASS=$(generate_secret)
        JWT_SECRET=$(generate_secret)

        cp .env.example .env.production

        # Apply production overrides
        if [[ "$OS" == "macos" ]]; then
            SED_I="sed -i ''"
        else
            SED_I="sed -i"
        fi

        # Database
        $SED_I "s|POSTGRES_USER=zaytri_user|POSTGRES_USER=zaytri_prod|" .env.production
        $SED_I "s|POSTGRES_PASSWORD=your_secure_password_here|POSTGRES_PASSWORD=${POSTGRES_PASS}|" .env.production
        $SED_I "s|POSTGRES_DB=zaytri_db|POSTGRES_DB=zaytri_production|" .env.production
        $SED_I "s|DATABASE_URL=postgresql+asyncpg://zaytri_user:your_secure_password_here@localhost:5432/zaytri_db|DATABASE_URL=postgresql+asyncpg://zaytri_prod:${POSTGRES_PASS}@postgres:5432/zaytri_production|" .env.production
        $SED_I "s|DATABASE_URL_SYNC=postgresql://zaytri_user:your_secure_password_here@localhost:5432/zaytri_db|DATABASE_URL_SYNC=postgresql://zaytri_prod:${POSTGRES_PASS}@postgres:5432/zaytri_production|" .env.production

        # Redis
        $SED_I "s|REDIS_URL=redis://localhost:6379/0|REDIS_URL=redis://:${REDIS_PASS}@redis:6379/0|" .env.production

        # Add REDIS_PASSWORD if not present
        if ! grep -q "REDIS_PASSWORD" .env.production; then
            echo "REDIS_PASSWORD=${REDIS_PASS}" >> .env.production
        fi

        # JWT
        $SED_I "s|JWT_SECRET_KEY=your-super-secret-jwt-key-change-this-in-production|JWT_SECRET_KEY=${JWT_SECRET}|" .env.production

        # JWT expiry (shorter for production)
        $SED_I "s|JWT_ACCESS_TOKEN_EXPIRE_MINUTES=1440|JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60|" .env.production

        # Ollama (Docker hostname)
        $SED_I "s|OLLAMA_HOST=http://localhost:11434|OLLAMA_HOST=http://ollama:11434|" .env.production

        # Frontend API URL
        $SED_I "s|NEXT_PUBLIC_API_URL=http://localhost:8000|NEXT_PUBLIC_API_URL=https://api.${DOMAIN}|" .env.production

        # Application settings
        $SED_I "s|APP_ENV=development|APP_ENV=production|" .env.production
        $SED_I "s|APP_DEBUG=true|APP_DEBUG=false|" .env.production
        $SED_I "s|LOG_LEVEL=INFO|LOG_LEVEL=WARNING|" .env.production
        $SED_I "s|CORS_ORIGINS=http://localhost:3000,http://localhost:8000|CORS_ORIGINS=https://${DOMAIN},https://api.${DOMAIN}|" .env.production

        log_ok "  ✓ .env.production created with secure secrets"
        log_ok "  ✓ Postgres password: ${POSTGRES_PASS:0:8}..."
        log_ok "  ✓ Redis password:    ${REDIS_PASS:0:8}..."
        log_ok "  ✓ JWT secret:        ${JWT_SECRET:0:8}..."
    else
        log_ok "  ✓ .env.production already exists — keeping current config"
    fi
else
    # ── Development: create .env if missing ────────────────────────────
    if [ ! -f .env ]; then
        log "Creating .env from template..."
        cp .env.example .env

        JWT_SECRET=$(generate_secret)
        if [[ "$OS" == "macos" ]]; then
            sed -i '' "s/your-super-secret-jwt-key-change-this-in-production/${JWT_SECRET}/" .env
        else
            sed -i "s/your-super-secret-jwt-key-change-this-in-production/${JWT_SECRET}/" .env
        fi
        log_ok "  ✓ .env created with secure JWT secret"
    else
        log_ok "  ✓ .env already exists — keeping current config"
    fi
fi

echo ""

# ═════════════════════════════════════════════════════════════════════════════
# Step 3A: Production Docker Install
# ═════════════════════════════════════════════════════════════════════════════

if [ "$MODE" = "production" ]; then
    log "Starting ${BOLD}PRODUCTION${NC} deployment..."
    echo ""

    # Ensure nginx dirs exist
    mkdir -p nginx/ssl nginx/conf.d

    # Build and start via production compose
    log "Building and starting production services..."
    docker compose -f docker-compose.prod.yml --env-file .env.production up --build -d

    echo ""
    log_ok "═══════════════════════════════════════════════════"
    log_ok "  Zaytri is running in PRODUCTION! 🚀"
    log_ok "═══════════════════════════════════════════════════"
    echo ""
    log "  🌐 Frontend:    http://${DOMAIN} (configure DNS → server IP)"
    log "  🔧 Backend API: https://api.${DOMAIN}"
    log "  📚 API Docs:    http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'SERVER_IP')/docs"
    log "  ❤️  Health:      http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'SERVER_IP')/health"
    echo ""
    log "  📊 Management:"
    echo "    ./scripts/deploy-prod.sh status      # Service status"
    echo "    ./scripts/deploy-prod.sh logs         # View logs"
    echo "    ./scripts/deploy-prod.sh logs app     # Backend logs only"
    echo "    ./scripts/deploy-prod.sh backup       # Database backup"
    echo "    ./scripts/deploy-prod.sh restart      # Restart all"
    echo ""
    log "  ⚠️  Next Steps:"
    echo "    1. Point DNS A record for ${DOMAIN} → your server IP"
    echo "    2. Point DNS A record for api.${DOMAIN} → your server IP"
    echo "    3. Install SSL certs (Let's Encrypt):"
    echo "       sudo certbot certonly --standalone -d ${DOMAIN} -d api.${DOMAIN}"
    echo "    4. Copy certs to nginx/ssl/ and uncomment HTTPS in nginx.conf"
    echo ""
fi

# ═════════════════════════════════════════════════════════════════════════════
# Step 3B: Docker Development Install
# ═════════════════════════════════════════════════════════════════════════════

if [ "$MODE" = "docker" ]; then
    log "Building and starting via Docker Compose (development)..."
    echo ""

    docker compose up --build -d

    echo ""
    log_ok "═══════════════════════════════════════════════════"
    log_ok "  Zaytri is running! 🚀"
    log_ok "═══════════════════════════════════════════════════"
    echo ""
    log "  🌐 Frontend:    http://localhost:${FRONTEND_PORT:-3000}"
    log "  🔧 Backend API: http://localhost:${BACKEND_PORT:-8000}"
    log "  📚 API Docs:    http://localhost:${BACKEND_PORT:-8000}/docs"
    echo ""
    log "  Manage with:"
    echo "    zaytri start    # Start services"
    echo "    zaytri stop     # Stop services"
    echo "    zaytri logs     # View logs"
    echo "    zaytri status   # Check health"
    echo ""
fi

# ═════════════════════════════════════════════════════════════════════════════
# Step 3C: Local Install
# ═════════════════════════════════════════════════════════════════════════════

if [ "$MODE" = "local" ]; then
    # Python virtual environment
    log "Setting up Python virtual environment (.venv)..."
    if [ ! -d ".venv" ]; then
        # Prefer stable python versions over dev/beta versions (like 3.14)
        PYTHON_EXEC="python3"
        for p in python3.13 python3.12 python3.11 python3; do
            if command -v "$p" &>/dev/null; then
                # Check version - don't use 3.14+ if older is available
                ver=$($p -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
                if [[ "$ver" < "3.14" ]]; then
                    PYTHON_EXEC="$p"
                    break
                fi
            fi
        done
        log "Using $PYTHON_EXEC to create venv..."
        $PYTHON_EXEC -m venv .venv || { log_err "Failed to create virtual environment. Ensure 'python3-venv' is installed."; exit 1; }
        log_ok "  ✓ Virtual environment created"
    else
        log_ok "  ✓ Virtual environment already exists"
    fi

    log "Installing Python dependencies..."
    ./.venv/bin/pip install --upgrade pip --quiet
    ./.venv/bin/pip install -r requirements.txt --quiet
    log_ok "  ✓ Python packages installed in .venv"

    # Node dependencies
    log "Installing frontend dependencies..."
    cd frontend && npm ci --silent 2>/dev/null || npm install --silent
    cd "$INSTALL_DIR"
    log_ok "  ✓ Frontend packages installed"

    echo ""
    log_ok "═══════════════════════════════════════════════════"
    log_ok "  Zaytri installed successfully! 🚀"
    log_ok "═══════════════════════════════════════════════════"
    echo ""
    log "  Local mode is using a virtual environment (.venv)"
    log "  To start Zaytri:"
    echo "    zaytri start"
    echo ""
    log "  Or manually:"
    echo "    source .venv/bin/activate && ./scripts/start.sh"
    echo ""
fi

# ═════════════════════════════════════════════════════════════════════════════
# Step 4: Install CLI
# ═════════════════════════════════════════════════════════════════════════════

log "Installing 'zaytri' CLI command..."

CLI_PATH="$INSTALL_DIR/zaytri"
chmod +x "$CLI_PATH" 2>/dev/null || true

# Also make all scripts executable
chmod +x "$INSTALL_DIR/scripts/"*.sh 2>/dev/null || true

# Potential bind targets (prioritized for local/non-sudo use)
BIN_DIRS=("$HOME/.local/bin" "$HOME/bin" "/usr/local/bin")
LINK_TARGET=""

for dir in "${BIN_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        LINK_TARGET="$dir/zaytri"
        break
    fi
done

# If no standard bin dir exists, fall back to creating ~/.local/bin
if [ -z "$LINK_TARGET" ]; then
    mkdir -p "$HOME/.local/bin"
    LINK_TARGET="$HOME/.local/bin/zaytri"
fi

if [ -n "$LINK_TARGET" ]; then
    # Try to install without sudo (standard local approach)
    if [ -w "$(dirname "$LINK_TARGET")" ] || [ -w "$LINK_TARGET" 2>/dev/null ]; then
        ln -sf "$CLI_PATH" "$LINK_TARGET" 2>/dev/null && \
            log_ok "  ✓ 'zaytri' command bound locally → ${LINK_TARGET}"
    else
        # If it's a system path and we don't have write access, don't force sudo automatically
        log_warn "  ⚠ Cannot write to ${LINK_TARGET} without elevated permissions."
        log_warn "  To bind 'zaytri' to your system manually, run:"
        echo -e "    ${BOLD}sudo ln -sf ${CLI_PATH} ${LINK_TARGET}${NC}"
        echo ""
        log_warn "  Alternatively, skip system binding and run directly from:"
        echo -e "    ${BOLD}${CLI_PATH}${NC}"
        echo ""
        log_warn "  Or add Zaytri to your PATH in your shell profile (~/.bashrc or ~/.zshrc):"
        echo -e "    ${BOLD}export PATH=\"${INSTALL_DIR}:\$PATH\"${NC}"
    fi
else
    log_warn "  ⚠ No writable bin directory found."
    log "  Run Zaytri directly using: ${CLI_PATH}"
fi

echo ""
if [ "$MODE" = "production" ]; then
    log "Config: ${INSTALL_DIR}/.env.production"
else
    log "Config: ${INSTALL_DIR}/.env"
fi
log "API Keys: ${INSTALL_DIR}/docs/HOW_TO_GET_API_KEYS.md"
echo ""
log_ok "Done! 🎉"
if [ "$MODE" != "production" ]; then
    log_ok "Run 'zaytri start' to launch."
fi
echo ""

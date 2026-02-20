#!/bin/bash
# =============================================================================
# Zaytri — Production Deployment Script
# 
# LOCAL (on server):  ./scripts/deploy-prod.sh [up|down|restart|logs|status|...]
# REMOTE (from Mac):  ./scripts/deploy-prod.sh [deploy|upload|ssl|remote-*]
# =============================================================================

set -e

PROJECT_NAME="zaytri"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"

# ─── GCE Configuration ─────────────────────────────────────────────────
GCP_PROJECT="zaytri-test-app"
GCP_ZONE="northamerica-northeast2-b"
GCP_VM="zaytri-prod-test"
GCP_USER="clawtbot"
REMOTE_DIR="/home/clawtbot/projects/zaytri"
DOMAIN="zaytri.abhishekthatguy.in"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

banner() {
    echo -e "${BLUE}"
    echo "═══════════════════════════════════════════════════════════════════"
    echo "  Zaytri — Production Deployment"
    echo "═══════════════════════════════════════════════════════════════════"
    echo -e "${NC}"
}

check_env_file() {
    if [ ! -f "$ENV_FILE" ]; then
        echo -e "${RED}❌ $ENV_FILE not found!${NC}"
        echo "Copy .env.production to the project root and fill in your values."
        exit 1
    fi
}

# ─── GCE Remote Helpers ────────────────────────────────────────────────
ssh_cmd() {
    gcloud compute ssh "$GCP_USER@$GCP_VM" \
        --zone="$GCP_ZONE" --project="$GCP_PROJECT" -- "$@"
}

sudo_ssh() {
    gcloud compute ssh "$GCP_USER@$GCP_VM" \
        --zone="$GCP_ZONE" --project="$GCP_PROJECT" -- "sudo bash -c '$*'"
}

# ─── Upload code to VM ─────────────────────────────────────────────────
do_upload() {
    local SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
    local LOCAL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

    echo -e "${GREEN}▸${NC} Creating deployment archive..."
    COPYFILE_DISABLE=1 tar czf /tmp/zaytri-deploy.tar.gz \
        --exclude='.git' \
        --exclude='node_modules' \
        --exclude='.next' \
        --exclude='.pytest_cache' \
        --exclude='__pycache__' \
        --exclude='celerybeat-schedule.db' \
        --exclude='.DS_Store' \
        --exclude='._*' \
        --exclude='.gemini' \
        --exclude='.agents' \
        --exclude='.env' \
        -C "$(dirname "$LOCAL_DIR")" "$(basename "$LOCAL_DIR")"

    local SIZE=$(ls -lh /tmp/zaytri-deploy.tar.gz | awk '{print $5}')
    echo -e "${GREEN}▸${NC} Archive size: ${BOLD}$SIZE${NC}"

    echo -e "${GREEN}▸${NC} Uploading to $GCP_VM..."
    gcloud compute scp /tmp/zaytri-deploy.tar.gz \
        "$GCP_USER@$GCP_VM":~/zaytri-deploy.tar.gz \
        --zone="$GCP_ZONE" --project="$GCP_PROJECT"

    echo -e "${GREEN}▸${NC} Extracting on VM..."
    ssh_cmd "sudo bash -c 'mkdir -p $(dirname $REMOTE_DIR) && cd $(dirname $REMOTE_DIR) && tar xzf /home/$GCP_USER/zaytri-deploy.tar.gz && chown -R $GCP_USER:$GCP_USER $REMOTE_DIR && rm /home/$GCP_USER/zaytri-deploy.tar.gz'"

    echo -e "${GREEN}✅ Code uploaded to $REMOTE_DIR${NC}"
    rm -f /tmp/zaytri-deploy.tar.gz
}

# ─── Deploy on VM (build + start) ──────────────────────────────────────
do_remote_up() {
    echo -e "${GREEN}▸${NC} Building and starting containers on VM..."
    ssh_cmd "sudo bash -c 'cd $REMOTE_DIR && docker compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d --build'"
    
    echo -e "${YELLOW}▸${NC} Waiting 20s for containers to initialize..."
    sleep 20
    
    do_remote_status
}

# ─── Remote status ──────────────────────────────────────────────────────
do_remote_status() {
    echo ""
    echo -e "${BLUE}📊 Container Status:${NC}"
    ssh_cmd "sudo docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'" 2>/dev/null
    echo ""
    echo -e "  🌐 ${BOLD}https://$DOMAIN${NC}"
    echo -e "  📡 ${BOLD}https://$DOMAIN/api${NC}"
    echo -e "  📖 ${BOLD}https://$DOMAIN/docs${NC}"
}

# ─── Remote logs ────────────────────────────────────────────────────────
do_remote_logs() {
    local SERVICE="${1:-}"
    if [ -z "$SERVICE" ]; then
        echo -e "${GREEN}▸${NC} Showing all container logs (last 50 lines)..."
        ssh_cmd "sudo bash -c 'cd $REMOTE_DIR && docker compose -f $COMPOSE_FILE logs --tail=50'"
    else
        echo -e "${GREEN}▸${NC} Showing zaytri-$SERVICE logs (last 100 lines)..."
        ssh_cmd "sudo docker logs zaytri-$SERVICE --tail=100"
    fi
}

# ─── SSL Setup ──────────────────────────────────────────────────────────
do_ssl() {
    echo -e "${GREEN}▸${NC} Stopping Nginx for SSL acquisition..."
    ssh_cmd "sudo bash -c 'cd $REMOTE_DIR && docker compose -f $COMPOSE_FILE stop nginx'" 2>/dev/null
    sleep 2

    echo -e "${GREEN}▸${NC} Obtaining SSL certificate from Let's Encrypt..."
    ssh_cmd "sudo certbot certonly --standalone -d $DOMAIN --non-interactive --agree-tos -m clawtbot@gmail.com --preferred-challenges http"

    echo -e "${GREEN}▸${NC} Copying certificates..."
    ssh_cmd "sudo bash -c 'cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $REMOTE_DIR/nginx/ssl/fullchain.pem && cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $REMOTE_DIR/nginx/ssl/privkey.pem'"

    echo -e "${GREEN}▸${NC} Restarting Nginx..."
    ssh_cmd "sudo bash -c 'cd $REMOTE_DIR && docker compose -f $COMPOSE_FILE up -d nginx'"

    echo -e "${GREEN}▸${NC} Setting up auto-renewal cron..."
    ssh_cmd "sudo bash -c '(crontab -l 2>/dev/null | grep -v certbot; echo \"0 2 * * * certbot renew --quiet --deploy-hook \\\"cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $REMOTE_DIR/nginx/ssl/fullchain.pem && cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $REMOTE_DIR/nginx/ssl/privkey.pem && docker restart zaytri-nginx\\\"\") | crontab -'"

    echo -e "${GREEN}✅ SSL setup complete! 🔒${NC}"
}

# ─── Full Deploy (upload + build + ssl) ─────────────────────────────────
do_full_deploy() {
    banner
    echo -e "  VM:     ${BOLD}$GCP_VM${NC} ($GCP_ZONE)"
    echo -e "  Domain: ${BOLD}$DOMAIN${NC}"
    echo ""

    do_upload
    do_remote_up

    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ✅ Deployment Complete!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════════${NC}"
}

# ─── Main ───────────────────────────────────────────────────────────────
case "${1:-help}" in

    # ════════════════════════════════════════════════════════════════════
    # Remote commands (run from your Mac)
    # ════════════════════════════════════════════════════════════════════
    deploy)
        do_full_deploy
        ;;
    upload)
        banner
        echo -e "${BLUE}📤 Uploading code to VM...${NC}"
        do_upload
        ;;
    remote-up)
        banner
        do_remote_up
        ;;
    remote-restart)
        banner
        echo -e "${YELLOW}🔄 Restarting containers on VM...${NC}"
        ssh_cmd "sudo bash -c 'cd $REMOTE_DIR && docker compose -f $COMPOSE_FILE --env-file $ENV_FILE restart'"
        sleep 5
        do_remote_status
        ;;
    remote-down)
        banner
        echo -e "${YELLOW}🛑 Stopping containers on VM...${NC}"
        ssh_cmd "sudo bash -c 'cd $REMOTE_DIR && docker compose -f $COMPOSE_FILE --env-file $ENV_FILE down'"
        echo -e "${GREEN}✅ Stopped${NC}"
        ;;
    remote-status)
        do_remote_status
        ;;
    remote-logs)
        do_remote_logs "$2"
        ;;
    ssl)
        banner
        echo -e "${BLUE}🔒 Setting up SSL...${NC}"
        do_ssl
        ;;
    vm-ssh)
        echo -e "${GREEN}▸${NC} Connecting to $GCP_VM..."
        gcloud compute ssh "$GCP_USER@$GCP_VM" --zone="$GCP_ZONE" --project="$GCP_PROJECT"
        ;;

    # ════════════════════════════════════════════════════════════════════
    # Local commands (run ON the server)
    # ════════════════════════════════════════════════════════════════════
    up)
        banner
        check_env_file
        echo -e "${GREEN}🚀 Starting all services...${NC}"
        docker compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d --build
        echo ""
        echo -e "${GREEN}✅ All services started!${NC}"
        echo -e "   Frontend: https://$DOMAIN"
        echo -e "   API Docs: https://$DOMAIN/docs"
        echo -e "   Health:   https://$DOMAIN/api/health"
        ;;

    down)
        banner
        echo -e "${YELLOW}🛑 Stopping all services...${NC}"
        docker compose -f $COMPOSE_FILE --env-file $ENV_FILE down
        echo -e "${GREEN}✅ All services stopped.${NC}"
        ;;

    restart)
        banner
        check_env_file
        echo -e "${YELLOW}🔄 Restarting all services...${NC}"
        docker compose -f $COMPOSE_FILE --env-file $ENV_FILE down
        docker compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d --build
        echo -e "${GREEN}✅ All services restarted!${NC}"
        ;;

    logs)
        SERVICE="${2:-}"
        if [ -z "$SERVICE" ]; then
            docker compose -f $COMPOSE_FILE --env-file $ENV_FILE logs -f --tail=100
        else
            docker compose -f $COMPOSE_FILE --env-file $ENV_FILE logs -f --tail=100 "$SERVICE"
        fi
        ;;

    status)
        banner
        echo -e "${BLUE}📊 Service Status:${NC}"
        docker compose -f $COMPOSE_FILE --env-file $ENV_FILE ps
        echo ""
        echo -e "${BLUE}📈 Resource Usage:${NC}"
        docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" \
            $(docker compose -f $COMPOSE_FILE --env-file $ENV_FILE ps -q 2>/dev/null) 2>/dev/null || echo "No running containers"
        ;;

    migrate)
        banner
        check_env_file
        echo -e "${BLUE}🔄 Running database migrations...${NC}"
        docker compose -f $COMPOSE_FILE --env-file $ENV_FILE exec app alembic upgrade head
        echo -e "${GREEN}✅ Migrations complete!${NC}"
        ;;

    backup)
        banner
        check_env_file
        TIMESTAMP=$(date +%Y%m%d_%H%M%S)
        BACKUP_DIR="./backups"
        mkdir -p "$BACKUP_DIR"

        echo -e "${BLUE}💾 Backing up database...${NC}"

        # Source .env.production for variables
        export $(grep -v '^#' $ENV_FILE | xargs)

        docker compose -f $COMPOSE_FILE --env-file $ENV_FILE exec -T postgres \
            pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
            | gzip > "$BACKUP_DIR/${PROJECT_NAME}_${TIMESTAMP}.sql.gz"

        echo -e "${GREEN}✅ Backup saved: $BACKUP_DIR/${PROJECT_NAME}_${TIMESTAMP}.sql.gz${NC}"

        # Keep only last 7 backups
        ls -t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | tail -n +8 | xargs -r rm
        echo -e "${YELLOW}🧹 Kept latest 7 backups.${NC}"
        ;;

    pull)
        banner
        echo -e "${BLUE}📥 Pulling latest images...${NC}"
        docker compose -f $COMPOSE_FILE --env-file $ENV_FILE pull
        echo -e "${GREEN}✅ Images pulled!${NC}"
        ;;

    shell)
        SERVICE="${2:-app}"
        echo -e "${BLUE}🐚 Opening shell in $SERVICE...${NC}"
        docker compose -f $COMPOSE_FILE --env-file $ENV_FILE exec "$SERVICE" /bin/sh
        ;;

    help|*)
        echo ""
        echo -e "${BOLD}Zaytri Deploy CLI${NC}"
        echo ""
        echo "Usage: $0 <command> [options]"
        echo ""
        echo -e "${CYAN}Remote Commands (from your Mac):${NC}"
        echo "  deploy         Full deploy (upload + build + start)"
        echo "  upload         Upload code to VM only"
        echo "  remote-up      Build & start on VM"
        echo "  remote-restart Restart containers on VM"
        echo "  remote-down    Stop containers on VM"
        echo "  remote-status  Check container status on VM"
        echo "  remote-logs    View VM logs (optionally: remote-logs <service>)"
        echo "  ssl            Setup/renew SSL certificate"
        echo "  vm-ssh         SSH into the VM"
        echo ""
        echo -e "${CYAN}Local Commands (on the server):${NC}"
        echo "  up             Build and start all production services"
        echo "  down           Stop all services"
        echo "  restart        Stop and restart all services"
        echo "  logs           View logs (optionally: logs <service>)"
        echo "  status         Show service status and resource usage"
        echo "  migrate        Run database migrations"
        echo "  backup         Backup PostgreSQL database"
        echo "  pull           Pull latest Docker images"
        echo "  shell          Open shell in container (default: app)"
        echo ""
        echo "Examples:"
        echo "  $0 deploy              # Full deployment from Mac"
        echo "  $0 remote-logs app     # View backend logs"
        echo "  $0 remote-status       # Check health"
        echo "  $0 ssl                 # Get/renew SSL cert"
        echo "  $0 vm-ssh              # SSH into server"
        echo ""
        ;;
esac

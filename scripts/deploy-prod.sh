#!/bin/bash
# =============================================================================
# Zaytri — Production Deployment Script
# Usage: ./scripts/deploy-prod.sh [up|down|restart|logs|status|migrate|backup]
# =============================================================================

set -e

PROJECT_NAME="zaytri"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

case "${1:-help}" in
    up)
        banner
        check_env_file
        echo -e "${GREEN}🚀 Starting all services...${NC}"
        docker compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d --build
        echo ""
        echo -e "${GREEN}✅ All services started!${NC}"
        echo -e "   Frontend: http://localhost"
        echo -e "   API Docs: http://localhost/docs"
        echo -e "   Health:   http://localhost/health"
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
        echo "Usage: $0 <command> [options]"
        echo ""
        echo "Commands:"
        echo "  up         Build and start all production services"
        echo "  down       Stop all services"
        echo "  restart    Stop and restart all services"
        echo "  logs       View logs (optionally: logs <service>)"
        echo "  status     Show service status and resource usage"
        echo "  migrate    Run database migrations"
        echo "  backup     Backup PostgreSQL database"
        echo "  pull       Pull latest Docker images"
        echo "  shell      Open shell in a container (default: app)"
        echo "  help       Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0 up                 # Start everything"
        echo "  $0 logs app           # View backend logs"
        echo "  $0 shell postgres     # Open psql shell"
        echo "  $0 backup             # Backup database"
        echo ""
        ;;
esac

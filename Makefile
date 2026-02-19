# =============================================================================
# Zaytri — Makefile
# Quick shortcuts for development and production
# =============================================================================

.PHONY: dev prod prod-down prod-restart prod-logs prod-status migrate backup help

# ─── Development ─────────────────────────────────────────────────────────────
dev:
	docker compose up -d --build

dev-down:
	docker compose down

# ─── Production ──────────────────────────────────────────────────────────────
prod:
	./scripts/deploy-prod.sh up

prod-down:
	./scripts/deploy-prod.sh down

prod-restart:
	./scripts/deploy-prod.sh restart

prod-logs:
	./scripts/deploy-prod.sh logs $(SERVICE)

prod-status:
	./scripts/deploy-prod.sh status

# ─── Database ────────────────────────────────────────────────────────────────
migrate:
	./scripts/deploy-prod.sh migrate

backup:
	./scripts/deploy-prod.sh backup

# ─── Generate Alembic Migration ─────────────────────────────────────────────
migration:
	@read -p "Migration message: " msg; \
	docker compose -f docker-compose.prod.yml --env-file .env.production exec app \
		alembic revision --autogenerate -m "$$msg"

# ─── Help ────────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "Zaytri — Available Commands"
	@echo "=============================="
	@echo ""
	@echo "Development:"
	@echo "  make dev              Start development environment"
	@echo "  make dev-down         Stop development environment"
	@echo ""
	@echo "Production:"
	@echo "  make prod             Start production environment"
	@echo "  make prod-down        Stop production environment"
	@echo "  make prod-restart     Restart production environment"
	@echo "  make prod-logs        View logs (SERVICE=app for specific)"
	@echo "  make prod-status      Show service status"
	@echo ""
	@echo "Database:"
	@echo "  make migrate          Run database migrations"
	@echo "  make migration        Generate new migration from models"
	@echo "  make backup           Backup production database"
	@echo ""

.PHONY: up down dev dev-backend dev-frontend build logs clean prod-up prod-down prod-logs prod-build lint lint-fix lint-backend lint-backend-fix lint-frontend lint-frontend-fix setup service-install service-uninstall service-update service-status service-logs

# ============================================
# PRODUCTION (Docker) - Branch: main
# Backend: 8090 | Frontend: 8446
# Database: ~/.crewhub/crewhub.db
# ============================================

# Start production containers
prod-up:
	docker compose -f docker-compose.prod.yml up -d

# Stop production containers
prod-down:
	docker compose -f docker-compose.prod.yml down

# View production logs
prod-logs:
	docker compose -f docker-compose.prod.yml logs -f

# Build production images
prod-build:
	docker compose -f docker-compose.prod.yml build

# Rebuild and restart production
prod-rebuild: prod-down prod-build prod-up

# ============================================
# DEVELOPMENT (Local) - Branch: develop
# Backend: 8091 | Frontend: 5181
# Database: ~/.crewhub/crewhub-dev.db
# ============================================

# Start both backend and frontend for development
dev:
	@echo "Starting CrewHub development environment..."
	@echo "Backend: http://localhost:8091"
	@echo "Frontend: http://localhost:5181"
	@make -j2 dev-backend dev-frontend

# Start backend only (uvicorn with hot reload)
dev-backend:
	@cd backend && \
	export $$(cat .env.development | grep -v '^#' | xargs) && \
	CREWHUB_DB_PATH=$$(eval echo $$CREWHUB_DB_PATH) && \
	python -m uvicorn app.main:app --reload --port $${CREWHUB_PORT:-8091}

# Start frontend only (Vite dev server)
dev-frontend:
	@cd frontend && \
	export $$(cat .env.development | grep -v '^#' | xargs) && \
	npm run dev -- --port $${VITE_DEV_PORT:-5181}

# ============================================
# LEGACY (Docker dev mode) - kept for compatibility
# ============================================

# Start all services in background (Docker dev)
up:
	docker compose up -d

# Rebuild and restart (Docker dev)
rebuild:
	docker compose down
	docker compose build
	docker compose up -d

# Stop all services (Docker dev)
down:
	docker compose down

# Development mode with hot reload (Docker)
docker-dev:
	docker compose up

# Build containers
build:
	docker compose build

# View logs
logs:
	docker compose logs -f

# Clean up
clean:
	docker compose down -v
	docker compose -f docker-compose.prod.yml down -v 2>/dev/null || true
	rm -rf frontend/node_modules frontend/dist
	rm -rf backend/__pycache__ backend/.pytest_cache

# ============================================
# ZEN STANDALONE (port 5183)
# ============================================

# Start Zen standalone app
dev-zen:
	@echo "Starting Zen Standalone on http://localhost:5183"
	@cd apps/zen-standalone && npm run dev

# Start all dev (backend + frontend + zen)
dev-all:
	@echo "Starting CrewHub + Zen Standalone..."
	@echo "Backend: http://localhost:8091"
	@echo "Frontend: http://localhost:5180"
	@echo "Zen Standalone: http://localhost:5183"
	@make -j3 dev-backend dev-frontend dev-zen

# ============================================
# UTILITIES
# ============================================

# Backend only (legacy alias)
backend:
	make dev-backend

# Frontend only (legacy alias)
frontend:
	make dev-frontend

# Show status
status:
	@echo "=== Production Docker ==="
	@docker compose -f docker-compose.prod.yml ps 2>/dev/null || echo "Not running"
	@echo ""
	@echo "=== Development Docker ==="
	@docker compose ps 2>/dev/null || echo "Not running"
	@echo ""
	@echo "=== Local processes ==="
	@lsof -i :8090 -i :8091 -i :5180 -i :5181 -i :5183 -i :8445 2>/dev/null | grep LISTEN || echo "None"

# ============================================
# LINTING
# ============================================

# Run all linters (check mode)
lint:
	@echo "=== Backend (Ruff) ==="
	@cd backend && python3 -m ruff check app/ --statistics
	@echo ""
	@echo "=== Frontend (ESLint) ==="
	@cd frontend && npm run lint

# Auto-fix all fixable issues
lint-fix:
	@echo "=== Backend (Ruff fix) ==="
	@cd backend && python3 -m ruff check app/ --fix
	@cd backend && python3 -m ruff format app/
	@echo ""
	@echo "=== Frontend (ESLint fix) ==="
	@cd frontend && npm run lint:fix
	@cd frontend && npm run format

# Backend lint only
lint-backend:
	@cd backend && python3 -m ruff check app/ --statistics

lint-backend-fix:
	@cd backend && python3 -m ruff check app/ --fix && python3 -m ruff format app/

# Frontend lint only
lint-frontend:
	@cd frontend && npm run lint

lint-frontend-fix:
	@cd frontend && npm run lint:fix && npm run format

# ============================================
# SERVICE MANAGEMENT
# ============================================

# Install CrewHub as a background service (starts on login)
service-install:
	@./scripts/service.sh install

# Remove the CrewHub background service
service-uninstall:
	@./scripts/service.sh uninstall

# Pull updates, rebuild, and restart the service
service-update:
	@./scripts/service.sh update

# Show service and process status
service-status:
	@./scripts/service.sh status

# Tail the service log file
service-logs:
	@./scripts/service.sh logs

# ============================================
# SETUP
# ============================================

# Run one-time setup (prerequisites check + install deps)
setup:
	@./scripts/setup.sh

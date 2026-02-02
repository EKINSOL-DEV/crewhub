.PHONY: up down dev build logs clean

# Start all services in background
up:
	docker compose up -d

# Stop all services
down:
	docker compose down

# Development mode with hot reload
dev:
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
	rm -rf frontend/node_modules frontend/dist
	rm -rf backend/__pycache__ backend/.pytest_cache

# Backend only
backend:
	cd backend && python -m uvicorn app.main:app --reload --port 8090

# Frontend only
frontend:
	cd frontend && npm run dev

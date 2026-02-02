"""ClawCrew Backend - Main application."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.config import settings
from app.routes import health, agents, sessions, sse, gateway_status, rooms, assignments, display_names, rules
from app.db.database import init_database, check_database_health

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    logger.info("Initializing database...")
    await init_database()
    health_info = await check_database_health()
    logger.info(f"Database health: {health_info}")
    yield
    # Shutdown
    logger.info("Shutting down...")


app = FastAPI(
    title="ClawCrew API",
    description="Multi-agent orchestration platform",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, tags=["health"])
app.include_router(agents.router, prefix="/api/agents", tags=["agents"])
app.include_router(sessions.router, prefix="/api/sessions", tags=["sessions"])
app.include_router(sse.router, prefix="/api", tags=["sse"])
app.include_router(gateway_status.router, prefix="/api/gateway", tags=["gateway"])

# New database-backed routes
app.include_router(rooms.router, prefix="/api/rooms", tags=["rooms"])
app.include_router(assignments.router, prefix="/api/session-room-assignments", tags=["assignments"])
app.include_router(display_names.router, prefix="/api/session-display-names", tags=["display-names"])
app.include_router(rules.router, prefix="/api/room-assignment-rules", tags=["rules"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "ClawCrew API",
        "version": "0.1.0",
        "status": "running",
    }

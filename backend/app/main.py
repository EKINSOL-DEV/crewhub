"""ClawCrew Backend - Main application."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes import health, agents

app = FastAPI(
    title="ClawCrew API",
    description="Multi-agent orchestration platform",
    version="0.1.0",
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


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "ClawCrew API",
        "version": "0.1.0",
        "status": "running",
    }

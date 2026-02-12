"""CrewHub Backend - Main application."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
import asyncio
import json
import os
from pathlib import Path

from app.config import settings
from app.routes import health, agents, sessions, sse, gateway_status, rooms, assignments, display_names, rules, cron, history, connections, projects, blueprints, media
from app.routes import project_files, project_documents, tasks, project_history, context
from app.routes.project_files import discover_router as project_discover_router
from app.routes.chat import router as chat_router
from app.routes import discovery, settings as settings_routes, backup, onboarding
from app.routes.self_routes import router as self_router
from app.routes.auth_routes import router as auth_router
from app.routes.creator import router as creator_router
from app.routes.personas import router as personas_router
from app.routes import agent_files
from app.routes.standups import router as standups_router
from app.db.database import init_database, check_database_health
from app.auth import init_api_keys
from app.services.connections import get_connection_manager
from app.routes.sse import broadcast

logger = logging.getLogger(__name__)


def _get_version() -> str:
    """Read version from version.json (repo root) or CREWHUB_VERSION env var."""
    env_ver = os.getenv("CREWHUB_VERSION")
    if env_ver:
        return env_ver
    # Try version.json next to backend/ (repo root) or in /app (Docker)
    for candidate in [
        Path(__file__).resolve().parent.parent.parent / "version.json",
        Path("/app/version.json"),
    ]:
        try:
            return json.loads(candidate.read_text())["version"]
        except (FileNotFoundError, KeyError, json.JSONDecodeError):
            continue
    return "0.0.0-unknown"


APP_VERSION = _get_version()

# Background task handle
_polling_task = None


async def poll_sessions_loop():
    """Background task that polls all connections for sessions and broadcasts to SSE clients."""
    manager = await get_connection_manager()
    while True:
        try:
            sessions_data = await manager.get_all_sessions()
            if sessions_data:
                await broadcast(
                    "sessions-refresh",
                    {"sessions": [s.to_dict() for s in sessions_data]},
                )
        except Exception as e:
            logger.debug(f"Polling error: {e}")
        await asyncio.sleep(5)  # Poll every 5 seconds


async def load_connections_from_db():
    """Load enabled connections from database into ConnectionManager.
    
    If no connections are configured in the DB, auto-creates a default
    OpenClaw connection from environment variables for backward compat.
    """
    import json
    import aiosqlite
    from app.db.database import DB_PATH
    
    manager = await get_connection_manager()
    
    loaded_count = 0
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = lambda cursor, row: dict(
                zip([col[0] for col in cursor.description], row)
            )
            async with db.execute(
                "SELECT * FROM connections WHERE enabled = 1"
            ) as cursor:
                rows = await cursor.fetchall()
        
        for row in rows:
            try:
                config = json.loads(row["config"]) if isinstance(row["config"], str) else row["config"]
                await manager.add_connection(
                    connection_id=row["id"],
                    connection_type=row["type"],
                    config=config,
                    name=row["name"],
                    auto_connect=True,
                )
                loaded_count += 1
                logger.info(f"Loaded connection: {row['id']} ({row['type']})")
            except Exception as e:
                logger.error(f"Failed to load connection {row['id']}: {e}")
                
    except Exception as e:
        logger.error(f"Failed to load connections from database: {e}")
    
    # Backward compat: if no OpenClaw connections loaded, create one from env
    # Only if BOTH url and token are provided (skip when token is empty/missing
    # so that fresh installs with empty .env show 0 connections → onboarding wizard)
    if not manager.get_default_openclaw():
        url = os.getenv("OPENCLAW_GATEWAY_URL", "").strip()
        token = os.getenv("OPENCLAW_GATEWAY_TOKEN", "").strip()
        if url and token:
            logger.info(
                f"No OpenClaw connections in DB — creating default from env: {url}"
            )
            try:
                await manager.add_connection(
                    connection_id="default-openclaw",
                    connection_type="openclaw",
                    config={"url": url, "token": token},
                    name="OpenClaw (default)",
                    auto_connect=True,
                )
            except Exception as e:
                logger.error(f"Failed to create default OpenClaw connection: {e}")
        else:
            logger.info(
                "No OpenClaw connections in DB and no env credentials — skipping default connection"
            )


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    global _polling_task
    
    # Startup
    logger.info("Initializing database...")
    await init_database()
    
    # Initialize API keys table and generate default keys
    logger.info("Initializing API keys...")
    await init_api_keys()
    
    health_info = await check_database_health()
    logger.info(f"Database health: {health_info}")
    
    # Initialize Connection Manager with stored connections
    logger.info("Loading connections from database...")
    await load_connections_from_db()
    
    # Start Connection Manager health monitoring
    manager = await get_connection_manager()
    await manager.start(health_interval=30.0)
    logger.info("ConnectionManager started")
    
    # Start background polling task
    _polling_task = asyncio.create_task(poll_sessions_loop())
    logger.info("Started sessions polling task")
    
    yield
    
    # Shutdown
    if _polling_task:
        _polling_task.cancel()
        try:
            await _polling_task
        except asyncio.CancelledError:
            pass
    
    # Stop Connection Manager
    manager = await get_connection_manager()
    await manager.stop()
    
    logger.info("Shutting down...")


app = FastAPI(
    title="CrewHub API",
    description="Multi-agent orchestration platform",
    version=APP_VERSION,
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
app.include_router(agent_files.router, prefix="/api/agents", tags=["agent-files"])
app.include_router(sessions.router, prefix="/api/sessions", tags=["sessions"])
app.include_router(sse.router, prefix="/api", tags=["sse"])
app.include_router(gateway_status.router, prefix="/api/gateway", tags=["gateway"])

# New database-backed routes
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(project_files.router, prefix="/api/projects", tags=["project-files"])
app.include_router(project_documents.router, prefix="/api/projects", tags=["project-documents"])
app.include_router(project_discover_router, prefix="/api", tags=["project-discovery"])
app.include_router(rooms.router, prefix="/api/rooms", tags=["rooms"])
app.include_router(assignments.router, prefix="/api/session-room-assignments", tags=["assignments"])
app.include_router(display_names.router, prefix="/api/session-display-names", tags=["display-names"])
app.include_router(rules.router, prefix="/api/room-assignment-rules", tags=["rules"])
app.include_router(cron.router, prefix="/api/cron", tags=["cron"])
app.include_router(history.router, prefix="/api/sessions/archived", tags=["history"])
app.include_router(connections.router, prefix="/api", tags=["connections"])
app.include_router(chat_router)

# Phase 0+1: Discovery, Settings, Backup, Onboarding
app.include_router(discovery.router, prefix="/api", tags=["discovery"])
app.include_router(settings_routes.router, prefix="/api", tags=["settings"])
app.include_router(backup.router, prefix="/api", tags=["backup"])
app.include_router(onboarding.router, prefix="/api", tags=["onboarding"])

# Phase 2a: Blueprint import/export (modding)
app.include_router(blueprints.router, prefix="/api", tags=["blueprints"])

# Phase 3: Task Management
app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])
app.include_router(project_history.router, prefix="/api/projects", tags=["project-history"])

# Phase 4: Bot Context Injection
app.include_router(context.router, prefix="/api/sessions", tags=["context"])

# Media serving (images in chat)
app.include_router(media.router, tags=["media"])

# Phase 1: Auth + Self-service endpoints
app.include_router(self_router)
app.include_router(auth_router)

# Creator Zone: AI prop generation
app.include_router(creator_router)

# Phase 5: Agent Persona Tuning
app.include_router(personas_router, prefix="/api", tags=["personas"])

# Phase 6: Stand-up Meetings
app.include_router(standups_router, prefix="/api/standups", tags=["standups"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "CrewHub API",
        "version": APP_VERSION,
        "status": "running",
    }

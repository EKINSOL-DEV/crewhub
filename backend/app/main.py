"""CrewHub Backend - Main application."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
import asyncio

from app.config import settings
from app.routes import health, agents, sessions, sse, gateway_status, rooms, assignments, display_names, rules, cron, history, connections
from app.db.database import init_database, check_database_health
from app.services.gateway import GatewayClient
from app.services.connections import get_connection_manager
from app.routes.sse import broadcast

logger = logging.getLogger(__name__)

# Background task handle
_polling_task = None


async def poll_sessions_loop():
    """Background task that polls Gateway for sessions and broadcasts to SSE clients."""
    gateway = await GatewayClient.get_instance()
    while True:
        try:
            sessions_data = await gateway.get_sessions()
            if sessions_data:
                await broadcast("sessions-refresh", {"sessions": sessions_data})
        except Exception as e:
            logger.debug(f"Polling error: {e}")
        await asyncio.sleep(5)  # Poll every 5 seconds


async def load_connections_from_db():
    """Load enabled connections from database into ConnectionManager."""
    import json
    import aiosqlite
    from app.db.database import DB_PATH
    
    manager = await get_connection_manager()
    
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
                logger.info(f"Loaded connection: {row['id']} ({row['type']})")
            except Exception as e:
                logger.error(f"Failed to load connection {row['id']}: {e}")
                
    except Exception as e:
        logger.error(f"Failed to load connections from database: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    global _polling_task
    
    # Startup
    logger.info("Initializing database...")
    await init_database()
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
app.include_router(cron.router, prefix="/api/cron", tags=["cron"])
app.include_router(history.router, prefix="/api/sessions/archived", tags=["history"])
app.include_router(connections.router, prefix="/api", tags=["connections"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "CrewHub API",
        "version": "0.1.0",
        "status": "running",
    }

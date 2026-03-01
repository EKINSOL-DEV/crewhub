"""Pydantic models for CrewHub database entities."""

import uuid
from typing import Literal, Optional

from pydantic import BaseModel


def generate_id() -> str:
    """Generate a unique UUID string for model IDs."""
    return str(uuid.uuid4())


# ========================================
# PROJECTS
# ========================================


class ProjectCreate(BaseModel):
    """Request model for creating a new project."""

    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    folder_path: Optional[str] = None
    docs_path: Optional[str] = None


class ProjectUpdate(BaseModel):
    """Request model for updating a project."""

    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    status: Optional[str] = None
    folder_path: Optional[str] = None
    docs_path: Optional[str] = None


class ProjectResponse(BaseModel):
    """Response model for a project."""

    id: str
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    folder_path: Optional[str] = None
    docs_path: Optional[str] = None
    status: str = "active"
    created_at: int
    updated_at: int
    rooms: list[str] = []


class RoomProjectAssign(BaseModel):
    """Request model for assigning a project to a room."""

    project_id: str


# ========================================
# ROOMS
# ========================================


class Room(BaseModel):
    """Workspace area for organizing agents/sessions."""

    id: str
    name: str
    icon: Optional[str] = None
    color: Optional[str] = None
    sort_order: int = 0
    default_model: Optional[str] = None
    speed_multiplier: float = 1.0
    floor_style: str = "default"
    wall_style: str = "default"
    project_id: Optional[str] = None
    project_name: Optional[str] = None
    project_color: Optional[str] = None
    is_hq: bool = False
    created_at: int
    updated_at: int


class RoomCreate(BaseModel):
    """Request model for creating a new room."""

    id: str
    name: str
    icon: Optional[str] = None
    color: Optional[str] = None
    sort_order: int = 0
    default_model: Optional[str] = None
    speed_multiplier: float = 1.0
    floor_style: str = "default"
    wall_style: str = "default"


class RoomUpdate(BaseModel):
    """Request model for updating a room."""

    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    sort_order: Optional[int] = None
    default_model: Optional[str] = None
    speed_multiplier: Optional[float] = None
    floor_style: Optional[str] = None
    wall_style: Optional[str] = None


# ========================================
# AGENTS
# ========================================


class Agent(BaseModel):
    """Permanent top-level agent definition."""

    id: str
    name: str
    icon: Optional[str] = None
    avatar_url: Optional[str] = None
    color: Optional[str] = None
    agent_session_key: Optional[str] = None
    default_model: Optional[str] = None
    default_room_id: Optional[str] = None
    sort_order: int = 0
    is_pinned: bool = False
    auto_spawn: bool = True
    bio: Optional[str] = None
    created_at: int
    updated_at: int


class AgentCreate(BaseModel):
    """Request model for creating a new agent."""

    id: str
    name: str
    icon: Optional[str] = None
    avatar_url: Optional[str] = None
    color: Optional[str] = None
    agent_session_key: Optional[str] = None
    default_model: Optional[str] = None
    default_room_id: Optional[str] = None
    sort_order: int = 0
    is_pinned: bool = False
    auto_spawn: bool = True
    bio: Optional[str] = None


class AgentUpdate(BaseModel):
    """Request model for updating an agent."""

    name: Optional[str] = None
    icon: Optional[str] = None
    avatar_url: Optional[str] = None
    color: Optional[str] = None
    agent_session_key: Optional[str] = None
    default_model: Optional[str] = None
    default_room_id: Optional[str] = None
    sort_order: Optional[int] = None
    is_pinned: Optional[bool] = None
    auto_spawn: Optional[bool] = None
    bio: Optional[str] = None


# ========================================
# SESSION ROOM ASSIGNMENTS
# ========================================


class SessionRoomAssignment(BaseModel):
    """Override assignment of a session to a room."""

    session_key: str
    room_id: str
    assigned_at: int


class SessionRoomAssignmentCreate(BaseModel):
    """Request model for assigning a session to a room."""

    session_key: str
    room_id: str


# ========================================
# SESSION DISPLAY NAMES
# ========================================


class SessionDisplayName(BaseModel):
    """Custom display name for a session."""

    session_key: str
    display_name: str
    updated_at: int


class SessionDisplayNameUpdate(BaseModel):
    """Request model for updating a session display name."""

    display_name: str


# ========================================
# ROOM ASSIGNMENT RULES
# ========================================


class RoomAssignmentRule(BaseModel):
    """Heuristic rule for auto-assigning sessions to rooms."""

    id: str
    room_id: str
    rule_type: str  # 'keyword', 'model', 'label_pattern', 'session_type'
    rule_value: str
    priority: int = 0
    created_at: int


class RoomAssignmentRuleCreate(BaseModel):
    """Request model for creating a room assignment rule."""

    room_id: str
    rule_type: str
    rule_value: str
    priority: int = 0


class RoomAssignmentRuleUpdate(BaseModel):
    """Request model for updating a room assignment rule."""

    room_id: Optional[str] = None
    rule_type: Optional[str] = None
    rule_value: Optional[str] = None
    priority: Optional[int] = None


# ========================================
# SETTINGS
# ========================================


class Setting(BaseModel):
    """Global key-value setting."""

    key: str
    value: str
    updated_at: int


class SettingUpdate(BaseModel):
    """Request model for updating a setting."""

    value: str


# ========================================
# CONNECTIONS
# ========================================


class Connection(BaseModel):
    """
    Agent connection configuration.

    Stores connection details for different agent systems
    (OpenClaw, Claude Code, Codex, etc.)
    """

    id: str
    name: str
    type: str  # 'openclaw', 'claude_code', 'codex'
    config: dict  # JSON config (url, token, etc.)
    enabled: bool = True
    created_at: int
    updated_at: int


class ConnectionCreate(BaseModel):
    """Request model for creating a new connection."""

    id: Optional[str] = None  # Auto-generated if not provided
    name: str
    type: str  # 'openclaw', 'claude_code', 'codex'
    config: dict = {}  # Connection-specific config
    enabled: bool = True


class ConnectionUpdate(BaseModel):
    """Request model for updating a connection."""

    name: Optional[str] = None
    config: Optional[dict] = None
    enabled: Optional[bool] = None


# ========================================
# CUSTOM BLUEPRINTS (modding)
# ========================================


class BlueprintPlacementSpan(BaseModel):
    """Span dimensions for a blueprint placement."""

    w: int = 1
    d: int = 1


class BlueprintPlacement(BaseModel):
    """A single prop placement in a blueprint."""

    propId: str
    x: int
    z: int
    type: Optional[str] = None
    interactionType: Optional[str] = None
    span: Optional[BlueprintPlacementSpan] = None


class BlueprintDoor(BaseModel):
    """Door position in a blueprint."""

    x: int
    z: int
    facing: Optional[str] = None


class BlueprintPoint(BaseModel):
    """A point on the grid (x, z)."""

    x: int
    z: int


class BlueprintInteractionPoints(BaseModel):
    """Interaction points grouped by type."""

    work: list[BlueprintPoint] = []
    coffee: list[BlueprintPoint] = []
    sleep: list[BlueprintPoint] = []


class BlueprintJson(BaseModel):
    """The full blueprint JSON structure."""

    id: Optional[str] = None
    name: str
    gridWidth: int
    gridDepth: int
    cellSize: float = 0.6
    placements: list[BlueprintPlacement] = []
    doors: list[BlueprintDoor] = []
    doorPositions: list[BlueprintDoor] = []
    walkableCenter: BlueprintPoint
    interactionPoints: Optional[BlueprintInteractionPoints] = None
    metadata: Optional[dict] = None


class CustomBlueprintCreate(BaseModel):
    """Request model for creating a custom blueprint."""

    name: str
    room_id: Optional[str] = None
    blueprint: BlueprintJson
    source: Literal["user", "import", "mod"] = "user"


class CustomBlueprintUpdate(BaseModel):
    """Request model for updating a custom blueprint."""

    name: Optional[str] = None
    room_id: Optional[str] = None
    blueprint: Optional[BlueprintJson] = None
    source: Optional[Literal["user", "import", "mod"]] = None


class CustomBlueprintResponse(BaseModel):
    """Response model for a custom blueprint."""

    id: str
    name: str
    room_id: Optional[str] = None
    blueprint: dict
    source: str
    created_at: int
    updated_at: int
    warnings: Optional[list[str]] = None

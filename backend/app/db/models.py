"""Pydantic models for CrewHub database entities."""
from pydantic import BaseModel
from typing import Optional
import uuid


def generate_id() -> str:
    """Generate a unique UUID string for model IDs."""
    return str(uuid.uuid4())


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


class RoomUpdate(BaseModel):
    """Request model for updating a room."""
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    sort_order: Optional[int] = None
    default_model: Optional[str] = None
    speed_multiplier: Optional[float] = None


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

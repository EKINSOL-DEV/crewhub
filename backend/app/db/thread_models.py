"""Pydantic models for CrewHub Group Chat / Threads."""
from pydantic import BaseModel
from typing import Optional, List, Literal


# ========================================
# THREADS
# ========================================

class ThreadCreate(BaseModel):
    """Request model for creating a thread."""
    kind: Literal["direct", "group"] = "group"
    title: Optional[str] = None
    participant_agent_ids: List[str]  # agent IDs to add
    settings: Optional[dict] = None


class ThreadUpdate(BaseModel):
    """Request model for updating a thread."""
    title: Optional[str] = None
    archived: Optional[bool] = None


class ThreadParticipantAdd(BaseModel):
    """Request to add participants."""
    agent_ids: List[str]


class ThreadMessageSend(BaseModel):
    """Request to send a message in a thread."""
    content: str
    routing_mode: Literal["broadcast", "targeted"] = "broadcast"
    target_agent_ids: Optional[List[str]] = None


class ThreadResponse(BaseModel):
    """Response model for a thread."""
    id: str
    kind: str
    title: Optional[str] = None
    title_auto: Optional[str] = None
    created_by: str
    created_at: int
    updated_at: int
    archived_at: Optional[int] = None
    last_message_at: Optional[int] = None
    participant_count: int
    participants: List[dict] = []
    settings: dict = {}


class ThreadParticipantResponse(BaseModel):
    """Response model for a participant."""
    id: str
    thread_id: str
    agent_id: str
    agent_name: str
    agent_icon: Optional[str] = None
    agent_color: Optional[str] = None
    role: str
    is_active: bool
    joined_at: int
    left_at: Optional[int] = None


class ThreadMessageResponse(BaseModel):
    """Response model for a thread message."""
    id: str
    thread_id: str
    role: str
    content: str
    agent_id: Optional[str] = None
    agent_name: Optional[str] = None
    routing_mode: Optional[str] = None
    target_agent_ids: Optional[List[str]] = None
    created_at: int

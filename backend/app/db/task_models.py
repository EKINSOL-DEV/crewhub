"""Pydantic models for Tasks and Project History."""

from typing import Literal, Optional

from pydantic import BaseModel

# ========================================
# TASKS
# ========================================

TaskStatus = Literal["todo", "in_progress", "review", "done", "blocked"]
TaskPriority = Literal["low", "medium", "high", "urgent"]


class TaskCreate(BaseModel):
    """Request model for creating a new task."""

    project_id: str
    room_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    status: TaskStatus = "todo"
    priority: TaskPriority = "medium"
    assigned_session_key: Optional[str] = None


class TaskUpdate(BaseModel):
    """Request model for updating a task."""

    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    room_id: Optional[str] = None
    assigned_session_key: Optional[str] = None


class TaskResponse(BaseModel):
    """Response model for a task."""

    id: str
    project_id: str
    room_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    status: TaskStatus
    priority: TaskPriority
    assigned_session_key: Optional[str] = None
    assigned_display_name: Optional[str] = None  # Joined from session_display_names
    created_by: Optional[str] = None
    created_at: int
    updated_at: int


class TaskListResponse(BaseModel):
    """Response model for a list of tasks."""

    tasks: list[TaskResponse]
    total: int


# ========================================
# PROJECT HISTORY
# ========================================


class HistoryEventResponse(BaseModel):
    """Response model for a project history event."""

    id: str
    project_id: str
    task_id: Optional[str] = None
    event_type: str
    actor_session_key: Optional[str] = None
    actor_display_name: Optional[str] = None  # Joined from session_display_names
    payload: Optional[dict] = None
    created_at: int


class HistoryListResponse(BaseModel):
    """Response model for a list of history events."""

    events: list[HistoryEventResponse]
    total: int

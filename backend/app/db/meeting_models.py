"""Pydantic models for AI-orchestrated meetings."""

from enum import Enum
from typing import Optional, Literal
from pydantic import BaseModel, Field


class MeetingState(str, Enum):
    GATHERING = "gathering"
    ROUND_1 = "round_1"
    ROUND_2 = "round_2"
    ROUND_3 = "round_3"
    ROUND_4 = "round_4"
    ROUND_5 = "round_5"
    SYNTHESIZING = "synthesizing"
    COMPLETE = "complete"
    CANCELLED = "cancelled"
    ERROR = "error"


# Map round number to state
ROUND_STATES = {
    1: MeetingState.ROUND_1,
    2: MeetingState.ROUND_2,
    3: MeetingState.ROUND_3,
    4: MeetingState.ROUND_4,
    5: MeetingState.ROUND_5,
}


class MeetingConfig(BaseModel):
    participants: list[str]  # agent IDs or session keys, in speaking order
    num_rounds: int = Field(default=3, ge=1, le=5)
    round_topics: list[str] = Field(default_factory=lambda: [
        "What have you been working on?",
        "What will you focus on next?",
        "Any blockers, risks, or things you need help with?",
    ])
    max_tokens_per_turn: int = 200
    synthesis_max_tokens: int = 500
    document_path: Optional[str] = None
    document_context: Optional[str] = None


class MeetingParticipant(BaseModel):
    meeting_id: str
    agent_id: str
    agent_name: str = ""
    agent_icon: Optional[str] = None
    agent_color: Optional[str] = None
    sort_order: int = 0


class Turn(BaseModel):
    id: str
    meeting_id: str
    round_num: int
    turn_index: int
    agent_id: str
    agent_name: str = ""
    response: Optional[str] = None
    prompt_tokens: Optional[int] = None
    response_tokens: Optional[int] = None
    started_at: Optional[int] = None
    completed_at: Optional[int] = None


class Round(BaseModel):
    round_num: int
    topic: str
    status: Literal["pending", "in_progress", "complete", "skipped"] = "pending"
    turns: list[Turn] = Field(default_factory=list)


class Meeting(BaseModel):
    id: str
    title: str = "Daily Standup"
    goal: str = ""
    state: MeetingState = MeetingState.GATHERING
    room_id: Optional[str] = None
    project_id: Optional[str] = None
    config: MeetingConfig
    current_round: int = 0
    current_turn: int = 0
    output_md: Optional[str] = None
    output_path: Optional[str] = None
    error_message: Optional[str] = None
    created_by: str = "user"
    started_at: Optional[int] = None
    completed_at: Optional[int] = None
    cancelled_at: Optional[int] = None
    created_at: int = 0


class StartMeetingRequest(BaseModel):
    title: str = "Team Meeting"
    goal: str = ""
    room_id: Optional[str] = None
    project_id: Optional[str] = None
    participants: list[str]  # agent IDs or session keys
    num_rounds: int = Field(default=3, ge=1, le=5)
    round_topics: Optional[list[str]] = None
    max_tokens_per_turn: int = 200
    document_path: Optional[str] = None
    document_context: Optional[str] = None
    parent_meeting_id: Optional[str] = None  # F4: follow-up meeting


class ActionItem(BaseModel):
    id: str = ""
    text: str
    assignee_agent_id: Optional[str] = None
    priority: str = "medium"
    status: str = "pending"
    planner_task_id: Optional[str] = None
    execution_session_id: Optional[str] = None
    sort_order: int = 0


class SaveActionItemsRequest(BaseModel):
    items: list[ActionItem]


class ActionItemToPlannerRequest(BaseModel):
    title: str
    assignee: Optional[str] = None
    priority: Optional[str] = "medium"
    project_id: Optional[str] = None


class ActionItemExecuteRequest(BaseModel):
    agent_id: Optional[str] = None

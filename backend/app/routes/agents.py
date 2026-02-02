"""Agent management endpoints."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class AgentCreate(BaseModel):
    """Request model for creating an agent."""

    name: str
    model: str = "sonnet"
    prompt: Optional[str] = None


class Agent(BaseModel):
    """Agent response model."""

    id: str
    name: str
    model: str
    status: str


@router.get("")
async def list_agents():
    """List all agents."""
    # TODO: Implement agent listing via OpenClaw Gateway
    return {"agents": []}


@router.post("")
async def create_agent(agent: AgentCreate):
    """Create a new agent."""
    # TODO: Implement agent creation via OpenClaw Gateway
    return {
        "id": "placeholder",
        "name": agent.name,
        "model": agent.model,
        "status": "created",
    }


@router.get("/{agent_id}")
async def get_agent(agent_id: str):
    """Get agent details."""
    # TODO: Implement agent retrieval via OpenClaw Gateway
    raise HTTPException(status_code=404, detail="Agent not found")


@router.delete("/{agent_id}")
async def delete_agent(agent_id: str):
    """Delete an agent."""
    # TODO: Implement agent deletion via OpenClaw Gateway
    return {"status": "deleted", "id": agent_id}

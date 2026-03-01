"""Tests for project context parsing and project agents routes."""

import importlib.util
import sys
from pathlib import Path

import pytest

# Import directly to avoid circular import through __init__
_spec = importlib.util.spec_from_file_location(
    "claude_transcript_parser",
    Path(__file__).parent.parent / "app" / "services" / "connections" / "claude_transcript_parser.py",
)
_mod = importlib.util.module_from_spec(_spec)
sys.modules["claude_transcript_parser"] = _mod
_spec.loader.exec_module(_mod)

ClaudeTranscriptParser = _mod.ClaudeTranscriptParser
ProjectContextEvent = _mod.ProjectContextEvent
project_name_from_cwd = _mod.project_name_from_cwd


class TestProjectNameFromCwd:
    def test_basic(self):
        assert project_name_from_cwd("/Users/nicky/ekinapps/crewhub") == "crewhub"

    def test_trailing_slash(self):
        assert project_name_from_cwd("/Users/nicky/ekinapps/crewhub/") == "crewhub"

    def test_single_component(self):
        assert project_name_from_cwd("/project") == "project"

    def test_empty(self):
        assert project_name_from_cwd("") == ""

    def test_home_dir(self):
        assert project_name_from_cwd("/Users/nicky") == "nicky"


class TestProjectContextParsing:
    def test_parse_init_event(self):
        parser = ClaudeTranscriptParser()
        line = '{"type":"system","subtype":"init","cwd":"/Users/nicky/ekinapps/crewhub"}'
        events = parser.parse_line(line)
        assert len(events) == 1
        ev = events[0]
        assert isinstance(ev, ProjectContextEvent)
        assert ev.cwd == "/Users/nicky/ekinapps/crewhub"
        assert ev.project_name == "crewhub"

    def test_parse_init_no_cwd(self):
        parser = ClaudeTranscriptParser()
        line = '{"type":"system","subtype":"init"}'
        events = parser.parse_line(line)
        assert len(events) == 0


@pytest.mark.anyio
class TestProjectAgentsRoutes:
    async def test_crud_agents(self, client):
        # Create a room first
        import uuid

        room_resp = await client.post(
            "/api/rooms",
            json={
                "id": str(uuid.uuid4()),
                "name": "Test Room",
                "icon": "🧪",
            },
        )
        assert room_resp.status_code == 200 or room_resp.status_code == 201
        room_id = room_resp.json()["id"]

        # List agents (empty)
        resp = await client.get(f"/api/rooms/{room_id}/agents")
        assert resp.status_code == 200
        assert resp.json()["agents"] == []

        # Create agent
        resp = await client.post(
            f"/api/rooms/{room_id}/agents",
            json={
                "name": "Dev Agent",
                "cwd": "/home/user/project",
                "startup_prompt": "Fix all bugs",
            },
        )
        assert resp.status_code == 200
        agent = resp.json()
        assert agent["name"] == "Dev Agent"
        agent_id = agent["id"]

        # List agents (1)
        resp = await client.get(f"/api/rooms/{room_id}/agents")
        assert len(resp.json()["agents"]) == 1

        # Delete agent
        resp = await client.delete(f"/api/rooms/{room_id}/agents/{agent_id}")
        assert resp.status_code == 200

        # List agents (empty again)
        resp = await client.get(f"/api/rooms/{room_id}/agents")
        assert resp.json()["agents"] == []

    async def test_agent_not_found(self, client):
        resp = await client.delete("/api/rooms/fake-room/agents/fake-agent")
        assert resp.status_code == 404

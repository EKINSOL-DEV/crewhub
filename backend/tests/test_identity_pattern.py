"""Tests for Agent Identity Pattern — single identity, multiple surfaces."""

import pytest
import time

from app.services.personas import (
    build_identity_block,
    build_full_persona_prompt,
    DEFAULT_SURFACE_RULES,
    KNOWN_SURFACES,
)


# ========================================
# Identity Block Tests
# ========================================

class TestBuildIdentityBlock:
    def test_basic_identity_with_name(self):
        block = build_identity_block(agent_name="Assistent")
        assert "You are Assistent" in block
        assert "Identity stability rule" in block

    def test_identity_anchor_overrides_name(self):
        block = build_identity_block(
            identity_anchor="I am the Director of Bots. I coordinate the crew.",
            agent_name="Assistent",
        )
        assert "Director of Bots" in block
        assert "You are Assistent" not in block

    def test_surface_rules_included(self):
        block = build_identity_block(
            current_surface="whatsapp",
            agent_name="Bot",
        )
        assert "whatsapp" in block.lower()
        assert "Format rules" in block

    def test_custom_surface_rules(self):
        block = build_identity_block(
            surface_rules="Always sign off with 🦞",
            agent_name="Bot",
        )
        assert "🦞" in block
        assert "Custom surface rules" in block

    def test_identity_stability_rule_always_present(self):
        block = build_identity_block(agent_name="Bot")
        assert "personality" in block.lower()
        assert "constant" in block.lower() or "format" in block.lower()

    def test_empty_identity_still_has_stability_rule(self):
        block = build_identity_block()
        assert "Identity stability rule" in block

    def test_discord_surface_rules(self):
        block = build_identity_block(current_surface="discord")
        assert "discord" in block.lower() or "Discord" in block

    def test_unknown_surface_no_format_rules(self):
        block = build_identity_block(current_surface="carrier-pigeon")
        assert "carrier-pigeon" in block
        # Unknown surfaces won't have default format rules
        assert "Format rules:" not in block


class TestBuildFullPersonaPrompt:
    def test_combines_identity_and_behavior(self):
        prompt = build_full_persona_prompt(
            start_behavior=1,
            checkin_frequency=4,
            response_detail=2,
            approach_style=3,
            identity_anchor="I am Test Agent.",
            agent_name="Test Agent",
        )
        # Should have both identity and behavior sections
        assert "## Identity" in prompt
        assert "## Behavior Guidelines" in prompt
        assert "Test Agent" in prompt
        assert "Execute tasks immediately" in prompt

    def test_no_identity_just_behavior(self):
        prompt = build_full_persona_prompt(
            start_behavior=1,
            checkin_frequency=4,
            response_detail=2,
            approach_style=3,
        )
        # Without identity info, should only have behavior section
        assert "## Behavior Guidelines" in prompt
        assert "## Identity" not in prompt

    def test_surface_specific_prompt(self):
        prompt = build_full_persona_prompt(
            start_behavior=2,
            checkin_frequency=3,
            response_detail=3,
            approach_style=3,
            current_surface="whatsapp",
            agent_name="Bot",
        )
        assert "whatsapp" in prompt.lower()
        assert "## Identity" in prompt
        assert "## Behavior Guidelines" in prompt

    def test_custom_instructions_preserved(self):
        prompt = build_full_persona_prompt(
            custom_instructions="Always respond in Dutch",
            identity_anchor="I am NL Bot",
            agent_name="NL Bot",
        )
        assert "Always respond in Dutch" in prompt
        assert "NL Bot" in prompt

    def test_full_configuration(self):
        prompt = build_full_persona_prompt(
            start_behavior=1,
            checkin_frequency=5,
            response_detail=1,
            approach_style=3,
            custom_instructions="No emojis please",
            identity_anchor="I am a coding assistant. I help with TypeScript and Python.",
            surface_rules="Keep responses under 300 words.",
            current_surface="slack",
            agent_name="CodeBot",
        )
        assert "coding assistant" in prompt
        assert "under 300 words" in prompt
        assert "No emojis" in prompt
        assert "slack" in prompt.lower()


# ========================================
# Surface Rules Tests
# ========================================

class TestSurfaceRules:
    def test_all_known_surfaces_have_defaults(self):
        """Every known surface should have default format rules."""
        for surface in ["whatsapp", "discord", "slack", "telegram", "crewhub-ui", "email", "sms"]:
            assert surface in DEFAULT_SURFACE_RULES, f"Missing default rules for {surface}"
            assert len(DEFAULT_SURFACE_RULES[surface]) > 0

    def test_known_surfaces_list(self):
        assert "whatsapp" in KNOWN_SURFACES
        assert "discord" in KNOWN_SURFACES
        assert "slack" in KNOWN_SURFACES
        assert "crewhub-ui" in KNOWN_SURFACES

    def test_surface_rules_content_quality(self):
        """Rules should be actionable format guidance."""
        for surface, rules in DEFAULT_SURFACE_RULES.items():
            assert len(rules) > 10, f"Rules for {surface} seem too short"
            # Rules should contain formatting advice, not personality guidance
            lower = rules.lower()
            assert "personality" not in lower, f"Rules for {surface} mention personality — should be format only"


# ========================================
# API Integration Tests
# ========================================

@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def test_db(tmp_path):
    """Create a temporary database with schema for testing."""
    import aiosqlite
    import app.db.database as db_mod

    db_path = tmp_path / "test.db"
    import app.routes.personas as personas_mod
    original_path = db_mod.DB_PATH
    db_mod.DB_PATH = db_path
    personas_mod.DB_PATH = db_path

    async with aiosqlite.connect(db_path) as db:
        await db.execute("""
            CREATE TABLE agents (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                icon TEXT, avatar_url TEXT, color TEXT,
                agent_session_key TEXT UNIQUE,
                default_model TEXT, default_room_id TEXT,
                sort_order INTEGER DEFAULT 0,
                is_pinned BOOLEAN DEFAULT FALSE,
                auto_spawn BOOLEAN DEFAULT TRUE,
                bio TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
        """)
        await db.execute("""
            CREATE TABLE agent_personas (
                agent_id TEXT PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
                preset TEXT,
                start_behavior INTEGER NOT NULL DEFAULT 1,
                checkin_frequency INTEGER NOT NULL DEFAULT 4,
                response_detail INTEGER NOT NULL DEFAULT 2,
                approach_style INTEGER NOT NULL DEFAULT 3,
                custom_instructions TEXT DEFAULT '',
                identity_anchor TEXT DEFAULT '',
                surface_rules TEXT DEFAULT '',
                identity_locked BOOLEAN DEFAULT FALSE,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
        """)
        await db.execute("""
            CREATE TABLE agent_surfaces (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
                surface TEXT NOT NULL,
                format_rules TEXT DEFAULT '',
                enabled BOOLEAN DEFAULT TRUE,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
                updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
                UNIQUE(agent_id, surface)
            )
        """)
        now = int(time.time() * 1000)
        await db.execute(
            "INSERT INTO agents (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
            ("test-agent", "Test Agent", now, now),
        )
        await db.execute(
            "INSERT INTO agents (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
            ("locked-agent", "Locked Agent", now, now),
        )
        await db.commit()

    yield db_path

    db_mod.DB_PATH = original_path
    personas_mod.DB_PATH = original_path


@pytest.fixture
def client(test_db):
    """Create a test client with temporary DB."""
    from fastapi.testclient import TestClient
    from app.routes.personas import router
    from fastapi import FastAPI

    app = FastAPI()
    app.include_router(router, prefix="/api")
    return TestClient(app)


class TestIdentityAPI:
    def test_get_identity_defaults(self, client):
        resp = client.get("/api/agents/test-agent/identity")
        assert resp.status_code == 200
        data = resp.json()
        assert data["agent_id"] == "test-agent"
        assert data["identity_anchor"] == ""
        assert data["identity_locked"] is False

    def test_put_identity(self, client):
        resp = client.put("/api/agents/test-agent/identity", json={
            "identity_anchor": "I am a helpful coding assistant.",
            "surface_rules": "Always be concise.",
            "identity_locked": True,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["identity_anchor"] == "I am a helpful coding assistant."
        assert data["identity_locked"] is True

    def test_put_then_get_identity(self, client):
        client.put("/api/agents/test-agent/identity", json={
            "identity_anchor": "I am the director.",
            "surface_rules": "Use emoji sparingly.",
            "identity_locked": True,
        })
        resp = client.get("/api/agents/test-agent/identity")
        data = resp.json()
        assert data["identity_anchor"] == "I am the director."
        assert data["surface_rules"] == "Use emoji sparingly."
        assert data["identity_locked"] is True

    def test_identity_not_found_agent(self, client):
        resp = client.get("/api/agents/nonexistent/identity")
        assert resp.status_code == 404

    def test_identity_persists_with_persona(self, client):
        """Identity and persona should coexist in the same row."""
        # Set identity first
        client.put("/api/agents/test-agent/identity", json={
            "identity_anchor": "I am Bot.",
            "surface_rules": "",
            "identity_locked": False,
        })
        # Now set persona (which uses the same agent_personas table)
        client.put("/api/agents/test-agent/persona", json={
            "preset": "advisor",
            "start_behavior": 4,
            "checkin_frequency": 2,
            "response_detail": 4,
            "approach_style": 2,
        })
        # Identity fields should still be readable via persona endpoint
        resp = client.get("/api/agents/test-agent/persona")
        data = resp.json()
        assert data["preset"] == "advisor"
        assert data["identity_anchor"] == "I am Bot."


class TestSurfacesAPI:
    def test_get_surfaces_defaults(self, client):
        resp = client.get("/api/agents/test-agent/surfaces")
        assert resp.status_code == 200
        data = resp.json()
        surfaces = data["surfaces"]
        assert len(surfaces) > 0
        # All should be non-custom (defaults)
        for s in surfaces:
            assert s["is_custom"] is False

    def test_put_surface(self, client):
        resp = client.put("/api/agents/test-agent/surfaces/whatsapp", json={
            "format_rules": "Always use bullet points.",
            "enabled": True,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["surface"] == "whatsapp"
        assert data["format_rules"] == "Always use bullet points."

    def test_put_then_get_surface(self, client):
        client.put("/api/agents/test-agent/surfaces/discord", json={
            "format_rules": "Use code blocks for all code.",
            "enabled": True,
        })
        resp = client.get("/api/agents/test-agent/surfaces")
        data = resp.json()
        discord = next(s for s in data["surfaces"] if s["surface"] == "discord")
        assert discord["is_custom"] is True
        assert discord["format_rules"] == "Use code blocks for all code."

    def test_delete_surface(self, client):
        # Create first
        client.put("/api/agents/test-agent/surfaces/slack", json={
            "format_rules": "Use threads.",
            "enabled": True,
        })
        # Delete
        resp = client.delete("/api/agents/test-agent/surfaces/slack")
        assert resp.status_code == 200
        # Verify it's back to default
        resp = client.get("/api/agents/test-agent/surfaces")
        data = resp.json()
        slack = next(s for s in data["surfaces"] if s["surface"] == "slack")
        assert slack["is_custom"] is False

    def test_delete_nonexistent_surface(self, client):
        resp = client.delete("/api/agents/test-agent/surfaces/nonexistent")
        assert resp.status_code == 404

    def test_list_known_surfaces(self, client):
        resp = client.get("/api/personas/surfaces")
        assert resp.status_code == 200
        data = resp.json()
        surface_names = [s["surface"] for s in data["surfaces"]]
        assert "whatsapp" in surface_names
        assert "discord" in surface_names


class TestPreviewWithSurface:
    def test_preview_with_surface(self, client):
        resp = client.post("/api/personas/preview", json={
            "prompt": "Say Hello World",
            "preset": "executor",
            "surface": "whatsapp",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "identity_block" in data
        assert "whatsapp" in data["identity_block"].lower()

    def test_preview_without_surface(self, client):
        resp = client.post("/api/personas/preview", json={
            "prompt": "Say Hello World",
            "preset": "executor",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["identity_block"] == ""

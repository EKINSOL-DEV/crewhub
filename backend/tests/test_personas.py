"""Tests for Agent Persona Tuning system."""

import pytest
import time

from app.services.personas import (
    PRESETS,
    build_persona_prompt,
    get_default_persona,
    get_preset_values,
    get_preview_response,
    START_BEHAVIOR_PROMPTS,
    CHECKIN_FREQUENCY_PROMPTS,
    RESPONSE_DETAIL_PROMPTS,
    APPROACH_STYLE_PROMPTS,
)


# ========================================
# Unit tests for personas service
# ========================================

class TestPresets:
    def test_all_presets_have_required_fields(self):
        required = {"name", "icon", "tagline", "description", "recommended",
                     "start_behavior", "checkin_frequency", "response_detail", "approach_style"}
        for key, preset in PRESETS.items():
            assert required.issubset(preset.keys()), f"Preset {key} missing fields"

    def test_all_dimension_values_in_range(self):
        for key, preset in PRESETS.items():
            for dim in ("start_behavior", "checkin_frequency", "response_detail", "approach_style"):
                assert 1 <= preset[dim] <= 5, f"{key}.{dim} = {preset[dim]} out of range"

    def test_executor_is_default_and_recommended(self):
        assert "executor" in PRESETS
        assert PRESETS["executor"]["recommended"] is True

    def test_get_preset_values(self):
        vals = get_preset_values("executor")
        assert vals == {
            "start_behavior": 1,
            "checkin_frequency": 4,
            "response_detail": 2,
            "approach_style": 3,
        }

    def test_get_preset_values_unknown(self):
        assert get_preset_values("nonexistent") is None

    def test_get_default_persona(self):
        persona = get_default_persona()
        assert persona["preset"] == "executor"
        assert persona["start_behavior"] == 1


class TestBuildPersonaPrompt:
    def test_default_prompt_contains_all_dimensions(self):
        prompt = build_persona_prompt()
        assert "Execute tasks immediately" in prompt
        assert "Report the final result" in prompt
        assert "Keep responses brief" in prompt
        assert "Balance reliability" in prompt

    def test_custom_instructions_appended(self):
        prompt = build_persona_prompt(custom_instructions="Always respond in Dutch")
        assert "Always respond in Dutch" in prompt
        assert "Additional instructions from your user" in prompt

    def test_empty_custom_instructions_not_appended(self):
        prompt = build_persona_prompt(custom_instructions="")
        assert "Additional instructions" not in prompt

    def test_all_dimension_levels_have_prompts(self):
        for level in range(1, 6):
            assert level in START_BEHAVIOR_PROMPTS
            assert level in CHECKIN_FREQUENCY_PROMPTS
            assert level in RESPONSE_DETAIL_PROMPTS
            assert level in APPROACH_STYLE_PROMPTS

    def test_advisor_preset_prompt(self):
        vals = get_preset_values("advisor")
        prompt = build_persona_prompt(**vals)
        assert "Err on the side of asking" in prompt
        assert "brief status updates" in prompt

    def test_explorer_preset_prompt(self):
        vals = get_preset_values("explorer")
        prompt = build_persona_prompt(**vals)
        assert "Actively explore creative" in prompt


class TestPreviewResponses:
    def test_known_preset_known_prompt(self):
        resp = get_preview_response("executor", "Say Hello World")
        assert "Hello World" in resp

    def test_known_preset_unknown_prompt(self):
        resp = get_preview_response("executor", "Do something random")
        assert resp  # Falls back to default

    def test_unknown_preset_fallback(self):
        resp = get_preview_response("nonexistent", "Say Hello World")
        assert resp  # Falls back to executor


# ========================================
# API integration tests
# ========================================

@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def test_db(tmp_path):
    """Create a temporary database with schema for testing."""
    import aiosqlite
    import app.db.database as db_mod

    import app.routes.personas as personas_mod

    db_path = tmp_path / "test.db"
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


class TestPersonaAPI:
    def test_get_persona_defaults(self, client):
        resp = client.get("/api/agents/test-agent/persona")
        assert resp.status_code == 200
        data = resp.json()
        assert data["agent_id"] == "test-agent"
        assert data["preset"] == "executor"
        assert data["start_behavior"] == 1

    def test_get_persona_not_found(self, client):
        resp = client.get("/api/agents/nonexistent/persona")
        assert resp.status_code == 404

    def test_put_persona(self, client):
        resp = client.put("/api/agents/test-agent/persona", json={
            "preset": "advisor",
            "start_behavior": 4,
            "checkin_frequency": 2,
            "response_detail": 4,
            "approach_style": 2,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["preset"] == "advisor"
        assert data["start_behavior"] == 4

    def test_put_then_get(self, client):
        client.put("/api/agents/test-agent/persona", json={
            "preset": "explorer",
            "start_behavior": 2,
            "checkin_frequency": 4,
            "response_detail": 3,
            "approach_style": 5,
            "custom_instructions": "Be creative!",
        })
        resp = client.get("/api/agents/test-agent/persona")
        data = resp.json()
        assert data["preset"] == "explorer"
        assert data["custom_instructions"] == "Be creative!"

    def test_put_invalid_preset(self, client):
        resp = client.put("/api/agents/test-agent/persona", json={
            "preset": "invalid_preset",
            "start_behavior": 1,
        })
        assert resp.status_code == 400

    def test_put_invalid_range(self, client):
        resp = client.put("/api/agents/test-agent/persona", json={
            "start_behavior": 6,
        })
        assert resp.status_code == 422  # Pydantic validation

    def test_list_presets(self, client):
        resp = client.get("/api/personas/presets")
        assert resp.status_code == 200
        data = resp.json()
        assert "executor" in data["presets"]
        assert "advisor" in data["presets"]
        assert "explorer" in data["presets"]

    def test_preview(self, client):
        resp = client.post("/api/personas/preview", json={
            "prompt": "Say Hello World",
            "preset": "executor",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "system_prompt_fragment" in data
        assert "sample_response" in data
        assert "Execute tasks immediately" in data["system_prompt_fragment"]

    def test_upsert_updates_existing(self, client):
        # Create
        client.put("/api/agents/test-agent/persona", json={
            "preset": "executor",
            "start_behavior": 1,
        })
        # Update
        resp = client.put("/api/agents/test-agent/persona", json={
            "preset": "advisor",
            "start_behavior": 4,
        })
        assert resp.status_code == 200
        assert resp.json()["preset"] == "advisor"

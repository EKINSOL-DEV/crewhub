"""Tests for Creator Zone Phase 2-3 endpoints and services."""

import pytest

# ── Service Tests ────────────────────────────────────────────────


class TestQualityScorer:
    """Test prop_quality_scorer.QualityScorer."""

    def _scorer(self):
        from app.services.prop_quality_scorer import QualityScorer

        return QualityScorer()

    def test_score_minimal_prop(self):
        code = """
export function Box() {
  return (
    <group>
      <mesh><boxGeometry args={[1,1,1]} /><meshStandardMaterial color="#ff0000" /></mesh>
    </group>
  )
}"""
        score = self._scorer().score_prop(code)
        assert score.overall >= 0
        assert score.overall < 50  # minimal prop = low score
        assert score.composition_score < 50
        assert len(score.suggestions) > 0

    def test_score_showcase_quality_prop(self):
        code = """
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useToonMaterialProps } from '../../utils/toonMaterials'
import * as THREE from 'three'

interface CoolPropProps {
  position?: [number, number, number]
  scale?: number
}

export function CoolProp({ position = [0,0,0], scale = 1 }: CoolPropProps) {
  const toon0 = useToonMaterialProps('#cc3333')
  const toon1 = useToonMaterialProps('#3366cc')
  const groupRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.15
    }
  })

  return (
    <group ref={groupRef} position={position} scale={scale}>
      <mesh castShadow><boxGeometry args={[0.5,0.5,0.5]} /><meshToonMaterial {...toon0} /></mesh>
      <mesh castShadow><cylinderGeometry args={[0.1,0.1,0.3]} /><meshToonMaterial {...toon1} /></mesh>
      <mesh castShadow><sphereGeometry args={[0.2,12,12]} /><meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={2} toneMapped={false} /></mesh>
      <mesh><torusGeometry args={[0.15,0.02,8,16]} /><meshStandardMaterial color="#ffcc00" transparent opacity={0.5} /></mesh>
      <mesh><coneGeometry args={[0.1,0.2,6]} /><meshToonMaterial {...toon0} /></mesh>
      <mesh><boxGeometry args={[0.3,0.02,0.3]} /><meshToonMaterial {...toon1} /></mesh>
      <mesh><sphereGeometry args={[0.05,8,8]} /><meshStandardMaterial color="#ff4444" emissive="#ff4444" emissiveIntensity={3} /></mesh>
      <mesh><boxGeometry args={[0.1,0.1,0.1]} /><meshToonMaterial {...toon0} /></mesh>
      <pointLight position={[0,1,0]} color="#00ff88" intensity={1.5} />
    </group>
  )
}"""
        score = self._scorer().score_prop(code)
        assert score.overall >= 60  # showcase-grade
        assert score.animation_score >= 60
        assert score.color_score >= 50
        assert score.composition_score >= 50

    def test_score_parts_data(self):
        parts = [
            {"type": "box", "position": [0, 0, 0], "args": [1, 1, 1], "color": "#ff0000", "emissive": False},
            {"type": "sphere", "position": [0, 1, 0], "args": [0.5, 12, 12], "color": "#00ff00", "emissive": True},
            {"type": "cylinder", "position": [1, 0, 0], "args": [0.2, 0.2, 0.5], "color": "#0000ff", "emissive": False},
        ]
        score = self._scorer().score_parts(parts)
        assert score.overall >= 0
        assert score.animation_score == 0  # parts can't have animation

    def test_to_dict(self):
        score = self._scorer().score_prop("export function X() { return <group><mesh><boxGeometry /></mesh></group> }")
        d = score.to_dict()
        assert "overall" in d
        assert "suggestions" in d
        assert isinstance(d["suggestions"], list)


class TestMultiPassGenerator:
    """Test multi_pass_generator.MultiPassGenerator."""

    def _gen(self):
        from app.services.multi_pass_generator import MultiPassGenerator

        return MultiPassGenerator()

    @pytest.mark.asyncio
    async def test_generate_prop_adds_components(self):
        base_code = """import { useToonMaterialProps } from '../../utils/toonMaterials'
export function CoffeePot({ position = [0,0,0], scale = 1 }) {
  const toon = useToonMaterialProps('#8B4513')
  return (
    <group position={position} scale={scale}>
      <mesh><cylinderGeometry args={[0.2,0.2,0.5]} /><meshToonMaterial {...toon} /></mesh>
    </group>
  )
}"""
        code, diagnostics = self._gen().generate_prop("a hot coffee pot with steam", base_code)
        assert "SteamParticles" in code
        assert any("Pass 2" in d for d in diagnostics)

    @pytest.mark.asyncio
    async def test_generate_prop_no_keywords(self):
        base_code = """import { useToonMaterialProps } from '../../utils/toonMaterials'
export function Thing({ position = [0,0,0] }) {
  const toon = useToonMaterialProps('#333')
  return (
    <group position={position}>
      <mesh><boxGeometry args={[1,1,1]} /><meshToonMaterial {...toon} /></mesh>
    </group>
  )
}"""
        _, diagnostics = self._gen().generate_prop("a generic thing", base_code)
        assert "Pass 1" in diagnostics[0]

    def test_get_refinement_options(self):
        opts = self._gen().get_refinement_options("a coffee machine with steam")
        assert "components" in opts
        assert "materialPresets" in opts
        assert "animationPresets" in opts
        # SteamParticles should be suggested for coffee
        steam = [c for c in opts["components"] if c["name"] == "SteamParticles"]
        assert len(steam) == 1
        assert steam[0]["suggested"] is True

    def test_apply_refinement_color_change(self):
        code = '<meshStandardMaterial color="#ff0000" />'
        result, diags = self._gen().apply_refinement(code, {"colorChanges": {"#ff0000": "#00ff00"}})
        assert "#00ff00" in result
        assert any("Changed color" in d for d in diags)

    def test_apply_refinement_add_component(self):
        code = """import { useToonMaterialProps } from '../../utils/toonMaterials'
export function Test() {
  return (
    <group>
      <mesh><boxGeometry /><meshToonMaterial /></mesh>
    </group>
  )
}"""
        result, diags = self._gen().apply_refinement(code, {"addComponents": ["LED"]})
        assert "LED" in result
        assert any("Added LED" in d for d in diags)


class TestStyleTransfer:
    """Test style_transfer module."""

    def test_get_available_styles(self):
        from app.services.style_transfer import get_available_styles

        styles = get_available_styles()
        assert len(styles) >= 5
        assert all("id" in s and "name" in s and "palette" in s for s in styles)

    def test_build_style_transfer_prompt(self):
        from app.services.style_transfer import build_style_transfer_prompt

        prompt = build_style_transfer_prompt(
            generated_code="export function Test() {}",
            style_source="coffee-machine",
            component_name="Test",
        )
        assert "Coffee Machine" in prompt
        assert "#8B4513" in prompt or "brown" in prompt.lower()

    def test_invalid_style_raises(self):
        from app.services.style_transfer import build_style_transfer_prompt

        with pytest.raises(ValueError, match="Unknown style"):
            build_style_transfer_prompt("code", "nonexistent-style", "Test")


class TestHybridGenerator:
    """Test hybrid_generator module."""

    def test_get_templates(self):
        from app.services.hybrid_generator import HybridGenerator

        gen = HybridGenerator()
        templates = gen.get_templates()
        assert len(templates) >= 5
        assert all("id" in t and "name" in t for t in templates)

    def test_build_hybrid_prompt_no_template(self):
        from app.services.hybrid_generator import build_hybrid_prompt

        prompt = build_hybrid_prompt("a cool robot", "CoolRobot")
        assert "CoolRobot" in prompt
        assert "useToonMaterialProps" in prompt

    def test_build_hybrid_prompt_with_template(self):
        from app.services.hybrid_generator import build_hybrid_prompt

        prompt = build_hybrid_prompt("a robot", "Robot", template_code="// template code", _template_name="test")
        assert "template code" in prompt
        assert "Robot" in prompt


class TestPropGenetics:
    """Test prop_genetics module."""

    def test_build_crossbreed_prompt_default_traits(self):
        from app.services.prop_genetics import build_crossbreed_prompt

        prompt = build_crossbreed_prompt(
            parent_a_code="// parent A",
            parent_b_code="// parent B",
            parent_a_name="CoffeeMachine",
            parent_b_name="AIBrain",
            component_name="CoffeeBrain",
            traits=[],
        )
        assert "CoffeeMachine" in prompt
        assert "AIBrain" in prompt
        assert "CoffeeBrain" in prompt

    def test_build_crossbreed_prompt_specific_traits(self):
        from app.services.prop_genetics import build_crossbreed_prompt

        prompt = build_crossbreed_prompt(
            parent_a_code="// A",
            parent_b_code="// B",
            parent_a_name="A",
            parent_b_name="B",
            component_name="AB",
            traits=["color from a", "animation from b"],
        )
        assert "COLOR PALETTE" in prompt
        assert "ANIMATIONS" in prompt


class TestPropIterator:
    """Test prop_iterator module."""

    def test_detect_feedback_type(self):
        from app.services.prop_iterator import detect_feedback_type

        assert detect_feedback_type("make it more colorful") == "color"
        assert detect_feedback_type("scale up the prop") == "size"
        assert detect_feedback_type("add blinking lights") == "detail"
        assert detect_feedback_type("spin faster") == "animation"
        assert detect_feedback_type("more futuristic") == "style"
        assert detect_feedback_type("I like it but change something") == "general"

    def test_build_iteration_prompt(self):
        from app.services.prop_iterator import build_iteration_prompt

        prompt = build_iteration_prompt(
            original_code="// original",
            feedback="make it red",
            component_name="MyProp",
            feedback_type="color",
        )
        assert "MyProp" in prompt
        assert "make it red" in prompt
        assert "color" in prompt.lower()


# ── API Endpoint Tests ───────────────────────────────────────────


class TestCreatorEndpoints:
    """Test creator API endpoints."""

    @pytest.mark.asyncio
    async def test_list_models(self, client):
        res = await client.get("/api/creator/models")
        assert res.status_code == 200
        data = res.json()
        assert "models" in data
        assert "default" in data
        assert len(data["models"]) >= 2

    @pytest.mark.asyncio
    async def test_list_templates(self, client):
        res = await client.get("/api/creator/props/templates")
        assert res.status_code == 200
        data = res.json()
        assert "templates" in data
        assert len(data["templates"]) >= 5

    @pytest.mark.asyncio
    async def test_list_styles(self, client):
        res = await client.get("/api/creator/props/styles")
        assert res.status_code == 200
        data = res.json()
        assert "styles" in data
        assert len(data["styles"]) >= 5

    @pytest.mark.asyncio
    async def test_quality_score(self, client):
        code = """
export function Test() {
  return (
    <group>
      <mesh><boxGeometry args={[1,1,1]} /><meshStandardMaterial color="#ff0000" /></mesh>
    </group>
  )
}"""
        res = await client.post("/api/creator/props/quality-score", json={"code": code})
        assert res.status_code == 200
        data = res.json()
        assert "overall" in data
        assert "composition_score" in data
        assert "suggestions" in data

    @pytest.mark.asyncio
    async def test_refinement_options(self, client):
        res = await client.get("/api/creator/props/refinement-options?prompt=a+robot+with+lights")
        assert res.status_code == 200
        data = res.json()
        assert "components" in data
        assert "materialPresets" in data

    @pytest.mark.asyncio
    async def test_generate_prop_template_fallback(self, client):
        """Non-streaming generation should fall back to template when no AI connection."""
        res = await client.post(
            "/api/creator/generate-prop",
            json={
                "prompt": "a wooden barrel",
                "use_ai": False,
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert data["method"] == "template"
        assert data["name"] == "AWoodenBarrel"
        assert len(data["parts"]) > 0

    @pytest.mark.asyncio
    async def test_save_and_list_props(self, client):
        # Save
        res = await client.post(
            "/api/creator/save-prop",
            json={
                "name": "TestProp",
                "propId": "test-prop",
                "parts": [
                    {
                        "type": "box",
                        "position": [0, 0, 0],
                        "rotation": [0, 0, 0],
                        "args": [1, 1, 1],
                        "color": "#ff0000",
                        "emissive": False,
                    }
                ],
            },
        )
        assert res.status_code == 200
        assert res.json()["propId"] == "test-prop"

        # List
        res = await client.get("/api/creator/saved-props")
        assert res.status_code == 200
        props = res.json()
        assert any(p["propId"] == "test-prop" for p in props)

        # Delete
        res = await client.delete("/api/creator/saved-props/test-prop")
        assert res.status_code == 200

    @pytest.mark.asyncio
    async def test_generation_history(self, client):
        res = await client.get("/api/creator/generation-history?limit=5")
        assert res.status_code == 200
        data = res.json()
        assert "records" in data

    @pytest.mark.asyncio
    async def test_refine_prop_not_found(self, client):
        res = await client.post(
            "/api/creator/props/refine",
            json={
                "propId": "nonexistent",
                "changes": {},
            },
        )
        assert res.status_code == 404

    @pytest.mark.asyncio
    async def test_crossbreed_no_connection(self, client):
        """Crossbreed should fail gracefully without AI connection."""
        res = await client.post(
            "/api/creator/props/crossbreed",
            json={
                "parentACode": "export function A() {}",
                "parentBCode": "export function B() {}",
                "componentName": "AB",
            },
        )
        assert res.status_code == 500  # no AI connection in test

    @pytest.mark.asyncio
    async def test_iterate_no_connection(self, client):
        """Iterate should fail gracefully without AI connection."""
        res = await client.post(
            "/api/creator/props/iterate",
            json={
                "code": "export function X() {}",
                "feedback": "more colorful",
            },
        )
        assert res.status_code == 500

    @pytest.mark.asyncio
    async def test_style_transfer_no_connection(self, client):
        res = await client.post(
            "/api/creator/props/style-transfer",
            json={
                "code": "export function X() {}",
                "styleSource": "coffee-machine",
            },
        )
        assert res.status_code == 500

    @pytest.mark.asyncio
    async def test_hybrid_generate_no_connection(self, client):
        res = await client.post(
            "/api/creator/props/hybrid-generate",
            json={
                "prompt": "a cool thing",
            },
        )
        assert res.status_code == 500

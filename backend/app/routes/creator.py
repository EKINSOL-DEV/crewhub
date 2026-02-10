"""Creator Zone routes — AI prop generation endpoints."""

import re
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/creator", tags=["creator"])


class GeneratePropRequest(BaseModel):
    prompt: str


class GeneratePropResponse(BaseModel):
    name: str
    filename: str
    code: str


def _prompt_to_filename(prompt: str) -> tuple[str, str]:
    """Derive a PascalCase component name and filename from a prompt."""
    # Take first few meaningful words
    words = re.sub(r'[^a-zA-Z0-9\s]', '', prompt).split()[:4]
    pascal = ''.join(w.capitalize() for w in words) if words else 'CustomProp'
    return pascal, f"{pascal}.tsx"


# TODO: Replace mock with actual subagent integration.
# The subagent should receive the prompt + the template from docs/creator-zone-prompt.md,
# generate real R3F code, and return it here. For now we return a simple template.

MOCK_TEMPLATE = '''import {{ useToonMaterialProps }} from '../utils/toonMaterials'

interface {name}Props {{
  position?: [number, number, number]
  scale?: number
}}

export function {name}({{ position = [0, 0, 0], scale = 1 }}: {name}Props) {{
  const mainToon = useToonMaterialProps('#6a8caf')

  return (
    <group position={{position}} scale={{scale}}>
      <mesh position={{[0, 0.25, 0]}} castShadow>
        <boxGeometry args={{[0.4, 0.5, 0.4]}} />
        <meshToonMaterial {{...mainToon}} />
      </mesh>
    </group>
  )
}}
'''


@router.post("/generate-prop", response_model=GeneratePropResponse)
async def generate_prop(req: GeneratePropRequest):
    """Generate a 3D prop component from a text prompt.
    
    Currently returns a mock/template response.
    TODO: Wire up to CrewHub subagent for real AI generation.
    """
    if not req.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    name, filename = _prompt_to_filename(req.prompt)
    code = MOCK_TEMPLATE.format(name=name)

    logger.info(f"Generated mock prop: {name} from prompt: {req.prompt[:80]}")

    return GeneratePropResponse(name=name, filename=filename, code=code)

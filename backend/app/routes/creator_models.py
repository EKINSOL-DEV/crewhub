"""Pydantic request/response models for Creator Zone endpoints."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel

from ..services.creator import DEFAULT_MODEL


class PropPart(BaseModel):
    type: str
    position: list[float]
    rotation: list[float] = [0, 0, 0]
    args: list[float]
    color: str
    emissive: bool = False


class GeneratePropRequest(BaseModel):
    prompt: str
    use_ai: bool = True
    model: str = DEFAULT_MODEL


class GeneratePropResponse(BaseModel):
    name: str
    filename: str
    code: str
    method: str
    parts: list[PropPart] = []


class PropRefinementRequest(BaseModel):
    propId: str
    changes: dict = {}


class PropRefinementResponse(BaseModel):
    propId: str
    code: str
    parts: list[PropPart] = []
    diagnostics: list[str] = []
    refinementOptions: dict = {}


class SavePropRequest(BaseModel):
    name: str
    propId: str
    code: str = ""
    parts: list[PropPart] = []
    mountType: str = "floor"
    yOffset: float = 0.16


class SavedPropResponse(BaseModel):
    propId: str
    name: str
    parts: list[PropPart] = []
    mountType: str = "floor"
    yOffset: float = 0.16
    createdAt: str = ""


class GenerationRecord(BaseModel):
    id: str
    prompt: str
    name: str
    model: str
    modelLabel: str
    method: str
    fullPrompt: str = ""
    toolCalls: list[dict] = []
    corrections: list[str] = []
    diagnostics: list[str] = []
    parts: list[PropPart] = []
    code: str = ""
    createdAt: str = ""
    error: Optional[str] = None


class IteratePropRequest(BaseModel):
    code: str
    feedback: str
    componentName: str = "CustomProp"


class StyleTransferRequest(BaseModel):
    code: str
    styleSource: str
    componentName: str = "CustomProp"


class HybridGenerateRequest(BaseModel):
    prompt: str
    templateBase: Optional[str] = None
    model: str = DEFAULT_MODEL


class CrossbreedRequest(BaseModel):
    parentACode: str
    parentBCode: str
    parentAName: str = "ParentA"
    parentBName: str = "ParentB"
    componentName: str = "HybridProp"
    traits: list[str] = []


class QualityScoreRequest(BaseModel):
    code: str

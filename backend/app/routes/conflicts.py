"""File conflict detection routes."""
from fastapi import APIRouter
from app.services.conflict_detector import get_conflict_detector

router = APIRouter(tags=["conflicts"])

@router.get("/api/conflicts")
async def get_conflicts():
    detector = get_conflict_detector()
    return {"edits": detector.get_recent_edits()}

@router.get("/api/conflicts/{session_key}")
async def get_session_conflicts(session_key: str):
    detector = get_conflict_detector()
    return {"edits": detector.get_recent_edits(session_key)}

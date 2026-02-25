"""
Docs API - Serve markdown documentation from the docs/ folder.
Provides tree listing and file content endpoints.
"""

from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter()

# Docs root relative to project root
DOCS_ROOT = Path(__file__).parent.parent.parent.parent / "docs"


class DocNode(BaseModel):
    name: str
    path: str  # Relative path from docs root
    type: str  # "file" or "directory"
    children: Optional[list["DocNode"]] = None
    lastModified: Optional[float] = None  # Unix timestamp


class DocContent(BaseModel):
    path: str
    name: str
    content: str
    size: int


def _build_tree(base: Path, rel: str = "") -> list[DocNode]:
    """Recursively build a tree of markdown files and directories."""
    nodes: list[DocNode] = []

    if not base.exists():
        return nodes

    entries = sorted(base.iterdir(), key=lambda e: (not e.is_dir(), e.name.lower()))

    for entry in entries:
        # Skip hidden files/dirs and non-md files
        if entry.name.startswith(".") or entry.name.startswith("__"):
            continue

        entry_rel = f"{rel}/{entry.name}" if rel else entry.name

        if entry.is_dir():
            children = _build_tree(entry, entry_rel)
            if children:  # Only include dirs that have md files
                nodes.append(
                    DocNode(
                        name=entry.name,
                        path=entry_rel,
                        type="directory",
                        children=children,
                    )
                )
        elif entry.suffix.lower() == ".md":
            nodes.append(
                DocNode(
                    name=entry.name,
                    path=entry_rel,
                    type="file",
                    lastModified=entry.stat().st_mtime,
                )
            )

    return nodes


def _safe_path(rel_path: str) -> Path:
    """Resolve a relative path safely (no path traversal)."""
    resolved = (DOCS_ROOT / rel_path).resolve()
    if not str(resolved).startswith(str(DOCS_ROOT.resolve())):
        raise HTTPException(status_code=403, detail="Path traversal not allowed")
    return resolved


@router.get("/tree", response_model=list[DocNode])
async def get_docs_tree():
    """Get the full docs directory tree (markdown files only)."""
    return _build_tree(DOCS_ROOT)


@router.get("/content")
async def get_doc_content(path: str = Query(..., description="Relative path to doc file")):
    """Get the content of a specific documentation file."""
    file_path = _safe_path(path)

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Document not found")

    if not file_path.is_file() or file_path.suffix.lower() != ".md":
        raise HTTPException(status_code=400, detail="Not a markdown file")

    try:
        content = file_path.read_text(encoding="utf-8")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading file: {e}")

    return DocContent(
        path=path,
        name=file_path.name,
        content=content,
        size=len(content),
    )


@router.get("/search")
async def search_docs(q: str = Query(..., min_length=2, description="Search query")):
    """Search through docs content and filenames."""
    results = []
    query = q.lower()

    for md_file in DOCS_ROOT.rglob("*.md"):
        if md_file.name.startswith("."):
            continue

        rel_path = str(md_file.relative_to(DOCS_ROOT))
        name_match = query in md_file.name.lower()

        try:
            content = md_file.read_text(encoding="utf-8")
            content_match = query in content.lower()
        except Exception:
            continue

        if name_match or content_match:
            # Extract a snippet around the match
            snippet = ""
            if content_match:
                idx = content.lower().find(query)
                start = max(0, idx - 80)
                end = min(len(content), idx + len(query) + 80)
                snippet = ("..." if start > 0 else "") + content[start:end] + ("..." if end < len(content) else "")

            results.append(
                {
                    "path": rel_path,
                    "name": md_file.name,
                    "nameMatch": name_match,
                    "snippet": snippet,
                }
            )

        if len(results) >= 30:
            break

    return results

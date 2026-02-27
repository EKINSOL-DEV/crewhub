from pathlib import Path

import pytest
from fastapi import HTTPException

from app.routes import docs as routes

pytestmark = pytest.mark.anyio


def test_safe_path_and_snippet(tmp_path, monkeypatch):
    docs_root = tmp_path / "docs"
    docs_root.mkdir()
    monkeypatch.setattr(routes, "DOCS_ROOT", docs_root)

    p = routes._safe_path("a.md")
    assert p == docs_root / "a.md"

    with pytest.raises(HTTPException):
        routes._safe_path("../etc/passwd")

    content = "0123456789 " * 30 + "needle" + " x" * 30
    snip = routes._extract_doc_snippet(content, "needle")
    assert "needle" in snip
    assert routes._extract_doc_snippet(content, "missing") == ""


def test_build_tree(tmp_path, monkeypatch):
    docs_root = tmp_path / "docs"
    docs_root.mkdir()
    (docs_root / "README.md").write_text("# hi")
    (docs_root / "note.txt").write_text("ignore")
    hidden = docs_root / ".hidden.md"
    hidden.write_text("x")
    sub = docs_root / "guide"
    sub.mkdir()
    (sub / "intro.md").write_text("intro")
    (sub / "__tmp").mkdir()

    monkeypatch.setattr(routes, "DOCS_ROOT", docs_root)
    tree = routes._build_tree(docs_root)
    s = str(tree)
    assert "README.md" in s and "intro.md" in s
    assert ".hidden.md" not in s and "note.txt" not in s


async def test_docs_tree_content_and_search(client, tmp_path, monkeypatch):
    docs_root = tmp_path / "docs"
    docs_root.mkdir()
    (docs_root / "README.md").write_text("CrewHub docs here")
    sub = docs_root / "folder"
    sub.mkdir()
    (sub / "topic.md").write_text("This section mentions planner and crew")
    (sub / ".secret.md").write_text("hidden")

    monkeypatch.setattr(routes, "DOCS_ROOT", docs_root)

    tree = await client.get("/api/docs/tree")
    assert tree.status_code == 200
    assert any(n["name"] == "README.md" for n in tree.json())

    content = await client.get("/api/docs/content", params={"path": "README.md"})
    assert content.status_code == 200
    assert content.json()["size"] > 0

    nf = await client.get("/api/docs/content", params={"path": "missing.md"})
    assert nf.status_code == 404

    bad = await client.get("/api/docs/content", params={"path": "folder"})
    assert bad.status_code == 400

    trav = await client.get("/api/docs/content", params={"path": "../x.md"})
    assert trav.status_code == 403

    search = await client.get("/api/docs/search", params={"q": "planner"})
    assert search.status_code == 200
    assert any("topic.md" == r["name"] for r in search.json())


async def test_docs_content_read_error_and_search_limit(client, tmp_path, monkeypatch):
    docs_root = tmp_path / "docs"
    docs_root.mkdir()
    target = docs_root / "err.md"
    target.write_text("x")
    monkeypatch.setattr(routes, "DOCS_ROOT", docs_root)

    orig = Path.read_text

    def boom(self, *args, **kwargs):
        if self.name == "err.md":
            raise RuntimeError("read fail")
        return orig(self, *args, **kwargs)

    monkeypatch.setattr(Path, "read_text", boom)
    err = await client.get("/api/docs/content", params={"path": "err.md"})
    assert err.status_code == 500

    # Build >30 docs and ensure capped
    monkeypatch.setattr(Path, "read_text", orig)
    for i in range(40):
        (docs_root / f"doc-{i}.md").write_text("keyword")
    sr = await client.get("/api/docs/search", params={"q": "keyword"})
    assert sr.status_code == 200
    assert len(sr.json()) == 30

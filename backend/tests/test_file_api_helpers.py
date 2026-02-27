"""Comprehensive tests for shared file API helper utilities."""

from __future__ import annotations

import datetime as dt
import importlib.util
import sys
from pathlib import Path

import pytest
from fastapi import HTTPException

# Python 3.9 compatibility for module using `from datetime import UTC`
if not hasattr(dt, "UTC"):
    dt.UTC = dt.UTC

MODULE_PATH = Path(__file__).resolve().parents[1] / "app" / "routes" / "_file_api_helpers.py"
SPEC = importlib.util.spec_from_file_location("app.routes._file_api_helpers", MODULE_PATH)
helpers = importlib.util.module_from_spec(SPEC)
sys.modules["app.routes._file_api_helpers"] = helpers
assert SPEC and SPEC.loader
SPEC.loader.exec_module(helpers)


@pytest.mark.asyncio
async def test_async_smoke_pytest_asyncio_enabled():
    """Simple async smoke test to ensure pytest-asyncio is active."""
    assert True


def test_validate_relative_path_allows_safe_path_values():
    helpers.validate_relative_path("docs/readme.md")
    helpers.validate_relative_path("nested/path/file.txt")


def test_validate_relative_path_blocks_traversal_with_default_message():
    with pytest.raises(HTTPException) as exc:
        helpers.validate_relative_path("../secrets.txt")

    assert exc.value.status_code == 400
    assert exc.value.detail == helpers.MSG_INVALID_PATH


def test_validate_relative_path_blocks_traversal_with_custom_message():
    with pytest.raises(HTTPException) as exc:
        helpers.validate_relative_path("safe/..", error_message="Custom invalid path")

    assert exc.value.status_code == 400
    assert exc.value.detail == "Custom invalid path"


def test_is_safe_path_true_for_inside_base_false_for_outside(tmp_path: Path):
    base = tmp_path / "workspace"
    base.mkdir()

    inside = base / "docs" / "a.md"
    inside.parent.mkdir()
    inside.write_text("ok")

    outside = tmp_path / "outside.md"
    outside.write_text("nope")

    assert helpers.is_safe_path(base, inside)
    assert not helpers.is_safe_path(base, outside)


def test_ensure_safe_path_raises_403_for_outside(tmp_path: Path):
    base = tmp_path / "workspace"
    base.mkdir()
    outside = tmp_path / "outside.txt"
    outside.write_text("x")

    with pytest.raises(HTTPException) as exc:
        helpers.ensure_safe_path(base, outside, outside_message=helpers.MSG_PATH_OUTSIDE_WORKSPACE)

    assert exc.value.status_code == 403
    assert exc.value.detail == helpers.MSG_PATH_OUTSIDE_WORKSPACE


def test_ensure_safe_path_noop_for_inside(tmp_path: Path):
    base = tmp_path / "workspace"
    base.mkdir()
    inside = base / "ok.txt"
    inside.write_text("x")

    helpers.ensure_safe_path(base, inside, outside_message=helpers.MSG_PATH_OUTSIDE_PROJECT)


def test_count_lines_counts_text_lines(tmp_path: Path):
    f = tmp_path / "lines.txt"
    f.write_text("a\nb\nc\n")
    assert helpers.count_lines(f) == 3


def test_count_lines_returns_zero_on_unreadable(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    f = tmp_path / "will_fail.txt"
    f.write_text("x")

    def raise_open(*_args, **_kwargs):
        raise OSError("boom")

    monkeypatch.setattr("builtins.open", raise_open)
    assert helpers.count_lines(f) == 0


def test_build_file_info_includes_relative_path_size_modified_and_lines(tmp_path: Path):
    base = tmp_path / "workspace"
    base.mkdir()
    file_path = base / "docs" / "readme.md"
    file_path.parent.mkdir()
    file_path.write_text("line1\nline2")

    info = helpers.build_file_info(base, file_path)

    assert info["name"] == "readme.md"
    assert info["path"] == "docs/readme.md"
    assert info["type"] == "file"
    assert info["size"] == file_path.stat().st_size
    assert info["lines"] == 2
    assert info["modified"].endswith("+00:00")


def test_build_file_info_skips_line_count_for_large_files(tmp_path: Path):
    base = tmp_path / "workspace"
    base.mkdir()
    f = base / "big.txt"
    f.write_text("abcdef")

    info = helpers.build_file_info(base, f, max_file_size=5)
    assert info["lines"] is None


def test_scan_directory_happy_path_recursive_and_filters(tmp_path: Path):
    base = tmp_path / "workspace"
    base.mkdir()

    (base / "README.md").write_text("root")
    (base / "notes.txt").write_text("n1\nn2")
    (base / "script.py").write_text("print('not allowed')")

    hidden_dir = base / ".hidden"
    hidden_dir.mkdir()
    (hidden_dir / "secret.md").write_text("skip")

    skip_dir = base / "node_modules"
    skip_dir.mkdir()
    (skip_dir / "pkg.md").write_text("skip")

    docs = base / "docs"
    docs.mkdir()
    (docs / "guide.md").write_text("guide")
    (docs / "image.png").write_text("not allowed ext")

    nested = docs / "nested"
    nested.mkdir()
    (nested / "deep.txt").write_text("deep")

    only_hidden = base / "only_hidden"
    only_hidden.mkdir()
    (only_hidden / ".ignore.md").write_text("hidden file")

    items = helpers.scan_directory(base, base, depth=0, max_depth=5)

    names = [item["name"] for item in items]
    assert "README.md" in names
    assert "notes.txt" in names
    assert "script.py" not in names
    assert ".hidden" not in names
    assert "node_modules" not in names
    assert "only_hidden" not in names  # no visible allowed children

    docs_item = next(item for item in items if item["name"] == "docs")
    assert docs_item["type"] == "directory"
    assert docs_item["path"] == "docs/"

    doc_children_names = [child["name"] for child in docs_item["children"]]
    assert "guide.md" in doc_children_names
    assert "nested" in doc_children_names
    assert "image.png" not in doc_children_names

    nested_item = next(child for child in docs_item["children"] if child["name"] == "nested")
    assert [c["name"] for c in nested_item["children"]] == ["deep.txt"]


def test_scan_directory_respects_max_depth(tmp_path: Path):
    base = tmp_path / "workspace"
    base.mkdir()
    (base / "root.md").write_text("root")

    level1 = base / "level1"
    level1.mkdir()
    (level1 / "one.md").write_text("1")

    level2 = level1 / "level2"
    level2.mkdir()
    (level2 / "two.md").write_text("2")

    items = helpers.scan_directory(base, base, depth=0, max_depth=1)
    level1_item = next(item for item in items if item["name"] == "level1")
    assert [child["name"] for child in level1_item["children"]] == ["one.md"]


def test_scan_directory_returns_empty_on_permission_error(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    base = tmp_path / "workspace"
    base.mkdir()

    class FakeDir:
        def iterdir(self):
            raise PermissionError("denied")

    items = helpers.scan_directory(base, FakeDir(), depth=0, max_depth=1)
    assert items == []


def test_ensure_readable_file_validates_exists_is_file_and_extension(tmp_path: Path):
    missing = tmp_path / "missing.md"
    with pytest.raises(HTTPException) as exc_missing:
        helpers.ensure_readable_file(missing, "missing.md")
    assert exc_missing.value.status_code == 404
    assert "File not found" in exc_missing.value.detail

    folder = tmp_path / "folder"
    folder.mkdir()
    with pytest.raises(HTTPException) as exc_not_file:
        helpers.ensure_readable_file(folder, "folder")
    assert exc_not_file.value.status_code == 400
    assert exc_not_file.value.detail == "Path is not a file"

    bad = tmp_path / "bad.py"
    bad.write_text("print('x')")
    with pytest.raises(HTTPException) as exc_ext:
        helpers.ensure_readable_file(bad, "bad.py")
    assert exc_ext.value.status_code == 400
    assert "File type not allowed" in exc_ext.value.detail

    good = tmp_path / "good.MD"
    good.write_text("ok")
    helpers.ensure_readable_file(good, "good.MD")


def test_read_file_content_returns_expected_payload_and_language(tmp_path: Path):
    f = tmp_path / "doc.yaml"
    f.write_text("a: 1\nb: 2")

    payload = helpers.read_file_content(f, "doc.yaml")

    assert payload["path"] == "doc.yaml"
    assert payload["content"] == "a: 1\nb: 2"
    assert payload["size"] == f.stat().st_size
    assert payload["lines"] == 2
    assert payload["language"] == "yaml"
    assert payload["modified"].endswith("+00:00")


def test_read_file_content_uses_default_text_language_for_unknown_extension(tmp_path: Path):
    f = tmp_path / "file.unknown"
    f.write_text("x")

    payload = helpers.read_file_content(f, "file.unknown")
    assert payload["language"] == "text"


def test_read_file_content_handles_empty_file_line_count(tmp_path: Path):
    f = tmp_path / "empty.txt"
    f.write_text("")

    payload = helpers.read_file_content(f, "empty.txt")
    assert payload["lines"] == 0


def test_read_file_content_rejects_large_file(tmp_path: Path):
    f = tmp_path / "big.txt"
    f.write_text("abcdef")

    with pytest.raises(HTTPException) as exc:
        helpers.read_file_content(f, "big.txt", max_file_size=5)

    assert exc.value.status_code == 413
    assert "File too large" in exc.value.detail


def test_read_file_content_wraps_read_errors(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    f = tmp_path / "readme.md"
    f.write_text("hello")

    def raise_read_text(*_args, **_kwargs):
        raise UnicodeDecodeError("utf-8", b"x", 0, 1, "bad")

    monkeypatch.setattr(Path, "read_text", raise_read_text)

    with pytest.raises(HTTPException) as exc:
        helpers.read_file_content(f, "readme.md")

    assert exc.value.status_code == 500
    assert "Failed to read file" in exc.value.detail


def test_build_saved_file_response_has_expected_fields(tmp_path: Path):
    f = tmp_path / "saved.md"
    content = "l1\nl2\nl3"
    f.write_text(content)

    response = helpers.build_saved_file_response("saved.md", content, f)

    assert response["path"] == "saved.md"
    assert response["size"] == f.stat().st_size
    assert response["lines"] == 3
    assert response["status"] == "saved"
    assert response["modified"].endswith("+00:00")


def test_build_saved_file_response_empty_content_has_zero_lines(tmp_path: Path):
    f = tmp_path / "saved.md"
    f.write_text("")

    response = helpers.build_saved_file_response("saved.md", "", f)
    assert response["lines"] == 0

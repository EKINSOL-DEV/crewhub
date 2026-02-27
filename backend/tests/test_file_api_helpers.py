from pathlib import Path

import pytest
from fastapi import HTTPException

from app.routes._file_api_helpers import (
    MSG_INVALID_PATH,
    MSG_PATH_OUTSIDE_PROJECT,
    build_file_info,
    build_saved_file_response,
    count_lines,
    ensure_readable_file,
    ensure_safe_path,
    is_safe_path,
    read_file_content,
    scan_directory,
    validate_relative_path,
)


def test_validate_relative_path_rejects_traversal():
    with pytest.raises(HTTPException) as exc:
        validate_relative_path("../secrets")
    assert exc.value.status_code == 400
    assert exc.value.detail == MSG_INVALID_PATH


def test_validate_relative_path_allows_normal_path():
    validate_relative_path("docs/readme.md")


def test_is_safe_path_and_ensure_safe_path(tmp_path: Path):
    base = tmp_path / "workspace"
    base.mkdir()
    inside = base / "ok.md"
    inside.write_text("ok")

    outside = tmp_path / "outside.md"
    outside.write_text("nope")

    assert is_safe_path(base, inside)
    assert not is_safe_path(base, outside)

    ensure_safe_path(base, inside, outside_message=MSG_PATH_OUTSIDE_PROJECT)
    with pytest.raises(HTTPException) as exc:
        ensure_safe_path(base, outside, outside_message=MSG_PATH_OUTSIDE_PROJECT)
    assert exc.value.status_code == 403
    assert exc.value.detail == MSG_PATH_OUTSIDE_PROJECT


def test_count_lines_and_build_file_info(tmp_path: Path):
    base = tmp_path
    f = tmp_path / "doc.md"
    f.write_text("a\nb\n")

    assert count_lines(f) == 2
    info = build_file_info(base, f, max_file_size=999999)
    assert info["name"] == "doc.md"
    assert info["path"] == "doc.md"
    assert info["type"] == "file"
    assert info["lines"] == 2


def test_count_lines_handles_read_error(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    f = tmp_path / "broken.txt"
    f.write_text("x")

    def _boom(*args, **kwargs):
        raise OSError("bad")

    monkeypatch.setattr("builtins.open", _boom)
    assert count_lines(f) == 0


def test_scan_directory_filters_and_nests(tmp_path: Path):
    base = tmp_path
    (base / "visible").mkdir()
    (base / "visible" / "keep.md").write_text("ok")

    (base / "emptydir").mkdir()
    (base / "node_modules").mkdir()
    (base / "node_modules" / "skip.md").write_text("x")
    (base / ".hidden.md").write_text("x")
    (base / "bad.exe").write_text("x")

    result = scan_directory(base, base, depth=0, max_depth=5)

    # only visible dir with allowed file should remain
    assert [item["name"] for item in result] == ["visible"]
    child = result[0]["children"][0]
    assert child["name"] == "keep.md"
    assert child["type"] == "file"


def test_scan_directory_depth_cutoff_and_permission_error(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    assert scan_directory(tmp_path, tmp_path, depth=3, max_depth=2) == []

    class BadDir:
        def iterdir(self):
            raise PermissionError

    assert scan_directory(tmp_path, BadDir(), depth=0, max_depth=2) == []


def test_ensure_readable_file_validations(tmp_path: Path):
    missing = tmp_path / "missing.md"
    with pytest.raises(HTTPException) as exc1:
        ensure_readable_file(missing, "missing.md")
    assert exc1.value.status_code == 404

    folder = tmp_path / "folder"
    folder.mkdir()
    with pytest.raises(HTTPException) as exc2:
        ensure_readable_file(folder, "folder")
    assert exc2.value.status_code == 400
    assert exc2.value.detail == "Path is not a file"

    bad = tmp_path / "file.exe"
    bad.write_text("x")
    with pytest.raises(HTTPException) as exc3:
        ensure_readable_file(bad, "file.exe")
    assert exc3.value.status_code == 400


def test_read_file_content_and_errors(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    f = tmp_path / "doc.md"
    f.write_text("line1\nline2")

    payload = read_file_content(f, "doc.md")
    assert payload["path"] == "doc.md"
    assert payload["content"] == "line1\nline2"
    assert payload["lines"] == 2
    assert payload["language"] == "markdown"

    with pytest.raises(HTTPException) as too_big:
        read_file_content(f, "doc.md", max_file_size=1)
    assert too_big.value.status_code == 413

    def _read_boom(*args, **kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(Path, "read_text", _read_boom)
    with pytest.raises(HTTPException) as read_err:
        read_file_content(f, "doc.md")
    assert read_err.value.status_code == 500


def test_build_saved_file_response(tmp_path: Path):
    f = tmp_path / "saved.md"
    content = "a\nb\nc"
    f.write_text(content)

    payload = build_saved_file_response("saved.md", content, f)
    assert payload["path"] == "saved.md"
    assert payload["status"] == "saved"
    assert payload["lines"] == 3
    assert payload["size"] == len(content)

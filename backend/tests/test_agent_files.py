"""Tests for agent files API."""
import os
import json
import tempfile
from pathlib import Path
from unittest.mock import patch, AsyncMock

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def temp_workspace():
    """Create a temporary workspace with test files."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create test files
        Path(tmpdir, "README.md").write_text("# README\nHello world")
        Path(tmpdir, "SOUL.md").write_text("# Soul\nI am a bot")
        Path(tmpdir, "secret.py").write_text("password = 'hunter2'")  # Should not be listed
        
        # Create subdirectory
        memory_dir = Path(tmpdir, "memory")
        memory_dir.mkdir()
        Path(memory_dir, "2026-02-10.md").write_text("# Daily Log\nDid stuff")
        
        # Hidden dir (should be skipped)
        git_dir = Path(tmpdir, ".git")
        git_dir.mkdir()
        Path(git_dir, "config").write_text("git config")
        
        yield tmpdir


def test_is_safe_path():
    """Test path traversal prevention."""
    from app.routes.agent_files import _is_safe_path
    
    base = Path("/home/user/workspace")
    assert _is_safe_path(base, Path("/home/user/workspace/file.md"))
    assert _is_safe_path(base, Path("/home/user/workspace/sub/file.md"))
    assert not _is_safe_path(base, Path("/home/user/other/file.md"))
    assert not _is_safe_path(base, Path("/etc/passwd"))


def test_scan_directory(temp_workspace):
    """Test directory scanning."""
    from app.routes.agent_files import _scan_directory, ALLOWED_EXTENSIONS
    
    base = Path(temp_workspace)
    files = _scan_directory(base, base, 0, 2)
    
    # Should find .md files but not .py
    names = []
    def collect_names(items):
        for item in items:
            names.append(item["name"])
            if item.get("children"):
                collect_names(item["children"])
    
    collect_names(files)
    assert "README.md" in names
    assert "SOUL.md" in names
    assert "2026-02-10.md" in names
    assert "secret.py" not in names  # .py not in default allowed extensions
    assert ".git" not in names  # hidden dirs skipped


def test_file_info(temp_workspace):
    """Test file info generation."""
    from app.routes.agent_files import _file_info
    
    base = Path(temp_workspace)
    info = _file_info(base, base / "README.md")
    
    assert info["name"] == "README.md"
    assert info["path"] == "README.md"
    assert info["type"] == "file"
    assert info["size"] > 0
    assert info["lines"] == 2

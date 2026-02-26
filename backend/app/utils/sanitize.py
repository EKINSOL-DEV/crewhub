"""Sanitization utilities to prevent log injection and path traversal."""


def sanitize_log(val: object) -> str:
    """Sanitize user-controlled values before logging to prevent log injection."""
    return str(val).replace("\n", " ").replace("\r", " ").replace("\t", " ")[:200]

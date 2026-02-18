"""
Legacy GatewayClient shim.

DEPRECATED — All functionality has been moved to:
  - app.services.connections.openclaw.OpenClawConnection
  - app.services.connections.connection_manager.ConnectionManager

This module exists solely for backward compatibility.
Use `get_connection_manager()` or `get_connection_manager().get_default_openclaw()`
for new code.
"""
import logging
import warnings
from typing import Optional, Any

logger = logging.getLogger(__name__)


class GatewayClient:
    """
    Thin shim that delegates to ConnectionManager's default OpenClawConnection.
    
    DEPRECATED — Use ConnectionManager directly.
    """
    
    _instance: Optional["GatewayClient"] = None
    
    def __init__(self) -> None:
        self._conn = None
    
    @classmethod
    async def get_instance(cls) -> "GatewayClient":
        """Get singleton (delegates to ConnectionManager)."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    async def _get_conn(self):
        """Lazily get the default OpenClaw connection."""
        if self._conn is None or not self._conn.is_connected():
            from .connections import get_connection_manager
            manager = await get_connection_manager()
            self._conn = manager.get_default_openclaw()
        return self._conn
    
    @property
    def connected(self) -> bool:
        return self._conn is not None and self._conn.is_connected()
    
    @property
    def uri(self) -> str:
        return getattr(self._conn, "uri", "ws://127.0.0.1:18789") if self._conn else "ws://127.0.0.1:18789"
    
    async def connect(self) -> bool:
        conn = await self._get_conn()
        return await conn.connect() if conn else False
    
    async def get_status(self) -> dict[str, Any]:
        conn = await self._get_conn()
        if not conn:
            return {}
        result = await conn.call("status")
        return result or {}
    
    async def get_sessions(self) -> list[dict[str, Any]]:
        conn = await self._get_conn()
        return await conn.get_sessions_raw() if conn else []
    
    async def get_session_history(self, session_key: str, limit: int = 50) -> list[dict[str, Any]]:
        conn = await self._get_conn()
        return await conn.get_session_history_raw(session_key, limit) if conn else []
    
    async def kill_session(self, session_key: str) -> bool:
        conn = await self._get_conn()
        return await conn.kill_session(session_key) if conn else False
    
    async def send_chat(self, message: str, agent_id: str = "main", session_id=None, timeout: float = 120.0):
        conn = await self._get_conn()
        return await conn.send_chat(message, agent_id, session_id, timeout) if conn else None
    
    async def patch_session(self, session_id: str, model=None) -> bool:
        conn = await self._get_conn()
        return await conn.patch_session(session_id, model) if conn else False
    
    async def list_cron_jobs(self, all_jobs: bool = True):
        conn = await self._get_conn()
        return await conn.list_cron_jobs(all_jobs) if conn else []
    
    async def create_cron_job(self, schedule, payload, session_target="main", name=None, enabled=True):
        conn = await self._get_conn()
        return await conn.create_cron_job(schedule, payload, session_target, name, enabled) if conn else None
    
    async def update_cron_job(self, job_id, patch):
        conn = await self._get_conn()
        return await conn.update_cron_job(job_id, patch) if conn else None
    
    async def delete_cron_job(self, job_id):
        conn = await self._get_conn()
        return await conn.delete_cron_job(job_id) if conn else False
    
    async def enable_cron_job(self, job_id):
        conn = await self._get_conn()
        return await conn.enable_cron_job(job_id) if conn else False
    
    async def disable_cron_job(self, job_id):
        conn = await self._get_conn()
        return await conn.disable_cron_job(job_id) if conn else False
    
    async def run_cron_job(self, job_id, force=False):
        conn = await self._get_conn()
        return await conn.run_cron_job(job_id, force) if conn else False
    
    async def call(self, method, params=None, timeout=30.0, **kwargs):
        conn = await self._get_conn()
        return await conn.call(method, params, timeout, **kwargs) if conn else None
    
    def subscribe(self, event_name, handler):
        if self._conn:
            self._conn.subscribe(event_name, handler)
    
    def unsubscribe(self, event_name, handler):
        if self._conn:
            self._conn.unsubscribe(event_name, handler)
    
    async def close(self):
        if self._conn:
            await self._conn.disconnect()


async def get_gateway() -> GatewayClient:
    """
    Get the legacy Gateway client (thin shim).
    
    DEPRECATED — Use get_connection_manager() instead.
    """
    return await GatewayClient.get_instance()

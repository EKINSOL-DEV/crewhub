"""
Connection Manager service.

Manages multiple agent connections with:
- Auto-reconnect logic with exponential backoff
- Health checks per connection
- Event aggregation (combine sessions from all sources)
- Centralized connection lifecycle management
"""

import asyncio
import logging
import time
from typing import Any, Callable, Optional

from ...routes.sse import broadcast

from .base import (
    AgentConnection,
    ConnectionStatus,
    ConnectionType,
    HistoryMessage,
    SessionInfo,
)
from .openclaw import OpenClawConnection
from .claude_code import ClaudeCodeConnection
from .codex import CodexConnection

logger = logging.getLogger(__name__)


# Type alias for aggregated session callbacks
AggregatedSessionCallback = Callable[[SessionInfo, str], None]  # (session, event_type)


class ConnectionManager:
    """
    Manages multiple agent connections.
    
    Provides:
    - Centralized connection registry
    - Auto-connect on startup
    - Health monitoring with configurable intervals
    - Event aggregation across all connections
    - Exponential backoff reconnection
    
    Usage:
        manager = ConnectionManager()
        await manager.add_connection("main", "openclaw", {"url": "ws://..."})
        await manager.connect_all()
        sessions = await manager.get_all_sessions()
    """
    
    _instance: Optional["ConnectionManager"] = None
    _init_lock: Optional[asyncio.Lock] = None
    
    def __init__(self) -> None:
        """Initialize the Connection Manager."""
        self._connections: dict[str, AgentConnection] = {}
        self._health_task: Optional[asyncio.Task] = None
        self._health_interval: float = 30.0  # seconds
        self._running = False
        
        # Session callbacks
        self._session_callbacks: list[AggregatedSessionCallback] = []
        self._status_callbacks: list[Callable[[str, ConnectionStatus], None]] = []
        
        logger.info("ConnectionManager initialized")
    
    @classmethod
    async def get_instance(cls) -> "ConnectionManager":
        """Get or create singleton instance."""
        if cls._init_lock is None:
            cls._init_lock = asyncio.Lock()
        
        if cls._instance is None:
            async with cls._init_lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance
    
    # =========================================================================
    # Connection Registry
    # =========================================================================
    
    def _create_connection(
        self,
        connection_id: str,
        connection_type: str,
        name: str,
        config: dict[str, Any],
    ) -> AgentConnection:
        """
        Create a connection instance based on type.
        
        Args:
            connection_id: Unique identifier
            connection_type: Type string (openclaw/claude_code/codex)
            name: Human-readable name
            config: Connection configuration
            
        Returns:
            AgentConnection instance
            
        Raises:
            ValueError: If connection type is unknown
        """
        conn_type = connection_type.lower().replace("-", "_")
        
        if conn_type == "openclaw":
            return OpenClawConnection(connection_id, name, config)
        elif conn_type == "claude_code":
            return ClaudeCodeConnection(connection_id, name, config)
        elif conn_type == "codex":
            return CodexConnection(connection_id, name, config)
        else:
            raise ValueError(f"Unknown connection type: {connection_type}")
    
    async def add_connection(
        self,
        connection_id: str,
        connection_type: str,
        config: dict[str, Any],
        name: Optional[str] = None,
        auto_connect: bool = False,
    ) -> AgentConnection:
        """
        Add a new connection to the manager.
        
        Args:
            connection_id: Unique identifier for the connection
            connection_type: Type of connection (openclaw/claude_code/codex)
            config: Connection-specific configuration
            name: Human-readable name (defaults to connection_id)
            auto_connect: Whether to connect immediately
            
        Returns:
            The created AgentConnection instance
            
        Raises:
            ValueError: If connection_id already exists or type is unknown
        """
        if connection_id in self._connections:
            raise ValueError(f"Connection already exists: {connection_id}")
        
        name = name or connection_id
        connection = self._create_connection(connection_id, connection_type, name, config)
        
        # Register callbacks
        connection.on_session_update(
            lambda session: self._handle_session_update(session, "update")
        )
        connection.on_status_change(self._handle_status_change)
        
        self._connections[connection_id] = connection
        logger.info(f"Added connection: {connection_id} ({connection_type})")
        
        if auto_connect:
            await connection.connect()
        
        return connection
    
    async def remove_connection(self, connection_id: str) -> bool:
        """
        Remove a connection from the manager.
        
        Args:
            connection_id: ID of connection to remove
            
        Returns:
            True if removed, False if not found
        """
        connection = self._connections.pop(connection_id, None)
        if connection is None:
            return False
        
        await connection.disconnect()
        logger.info(f"Removed connection: {connection_id}")
        return True
    
    def get_connection(self, connection_id: str) -> Optional[AgentConnection]:
        """
        Get a connection by ID.
        
        Args:
            connection_id: Connection identifier
            
        Returns:
            AgentConnection or None if not found
        """
        return self._connections.get(connection_id)
    
    def get_connections(self) -> dict[str, AgentConnection]:
        """
        Get all registered connections.
        
        Returns:
            Dictionary of connection_id -> AgentConnection
        """
        return dict(self._connections)
    
    def list_connections(self) -> list[dict[str, Any]]:
        """
        Get connection summary for all connections.
        
        Returns:
            List of connection info dictionaries
        """
        return [
            {
                "id": conn.connection_id,
                "name": conn.name,
                "type": conn.connection_type.value,
                "status": conn.status.value,
                "error": conn.error_message,
            }
            for conn in self._connections.values()
        ]
    
    # =========================================================================
    # Connection Lifecycle
    # =========================================================================
    
    async def connect_all(self) -> dict[str, bool]:
        """
        Connect all registered connections.
        
        Returns:
            Dictionary of connection_id -> success
        """
        results = {}
        tasks = []
        
        for conn_id, conn in self._connections.items():
            tasks.append((conn_id, conn.connect()))
        
        if tasks:
            completed = await asyncio.gather(
                *[t[1] for t in tasks],
                return_exceptions=True,
            )
            
            for i, (conn_id, _) in enumerate(tasks):
                result = completed[i]
                if isinstance(result, Exception):
                    logger.error(f"Connect failed for {conn_id}: {result}")
                    results[conn_id] = False
                else:
                    results[conn_id] = result
        
        return results
    
    async def disconnect_all(self) -> None:
        """Disconnect all connections."""
        tasks = [conn.disconnect() for conn in self._connections.values()]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        logger.info("All connections disconnected")
    
    async def reconnect(self, connection_id: str) -> bool:
        """
        Reconnect a specific connection.
        
        Args:
            connection_id: Connection to reconnect
            
        Returns:
            True if successful, False otherwise
        """
        connection = self._connections.get(connection_id)
        if not connection:
            return False
        
        await connection.disconnect()
        return await connection.connect()
    
    # =========================================================================
    # Health Monitoring
    # =========================================================================
    
    async def start(self, health_interval: float = 30.0) -> None:
        """
        Start the connection manager.
        
        Begins health monitoring loop.
        
        Args:
            health_interval: Seconds between health checks
        """
        if self._running:
            return
        
        self._running = True
        self._health_interval = health_interval
        
        # Start health check loop
        self._health_task = asyncio.create_task(self._health_loop())
        logger.info(f"ConnectionManager started (health interval: {health_interval}s)")
    
    async def stop(self) -> None:
        """Stop the connection manager and disconnect all."""
        self._running = False
        
        if self._health_task:
            self._health_task.cancel()
            try:
                await self._health_task
            except asyncio.CancelledError:
                pass
        
        await self.disconnect_all()
        logger.info("ConnectionManager stopped")
    
    async def _health_loop(self) -> None:
        """Background health check loop."""
        logger.debug("Health check loop started")
        
        while self._running:
            try:
                await asyncio.sleep(self._health_interval)
                await self._check_health()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Health check error: {e}")
    
    async def _check_health(self) -> dict[str, bool]:
        """
        Run health checks on all connections.
        
        Returns:
            Dictionary of connection_id -> healthy
        """
        results = {}
        
        for conn_id, conn in self._connections.items():
            try:
                healthy = await asyncio.wait_for(
                    conn.health_check(),
                    timeout=10.0,
                )
                results[conn_id] = healthy
                
                if not healthy and conn.status == ConnectionStatus.CONNECTED:
                    logger.warning(f"Connection {conn_id} failed health check")
                    # Connection's auto-reconnect should handle this
                    
            except asyncio.TimeoutError:
                logger.warning(f"Health check timeout for {conn_id}")
                results[conn_id] = False
            except Exception as e:
                logger.error(f"Health check error for {conn_id}: {e}")
                results[conn_id] = False
        
        return results
    
    async def get_health_status(self) -> dict[str, Any]:
        """
        Get detailed health status for all connections.
        
        Returns:
            Health status dictionary
        """
        health = await self._check_health()
        
        return {
            "timestamp": int(time.time() * 1000),
            "connections": [
                {
                    "id": conn.connection_id,
                    "name": conn.name,
                    "type": conn.connection_type.value,
                    "status": conn.status.value,
                    "healthy": health.get(conn.connection_id, False),
                    "error": conn.error_message,
                }
                for conn in self._connections.values()
            ],
            "summary": {
                "total": len(self._connections),
                "connected": sum(
                    1 for c in self._connections.values()
                    if c.status == ConnectionStatus.CONNECTED
                ),
                "healthy": sum(1 for h in health.values() if h),
            },
        }
    
    # =========================================================================
    # Aggregated Session Operations
    # =========================================================================
    
    async def get_all_sessions(self) -> list[SessionInfo]:
        """
        Get sessions from all connected sources.
        
        Returns:
            Aggregated list of sessions from all connections
        """
        all_sessions: list[SessionInfo] = []
        
        for conn in self._connections.values():
            if not conn.is_connected():
                continue
            
            try:
                sessions = await asyncio.wait_for(
                    conn.get_sessions(),
                    timeout=10.0,
                )
                all_sessions.extend(sessions)
            except asyncio.TimeoutError:
                logger.warning(f"Timeout getting sessions from {conn.connection_id}")
            except Exception as e:
                logger.error(f"Error getting sessions from {conn.connection_id}: {e}")
        
        return all_sessions
    
    async def get_session_history(
        self,
        session_key: str,
        connection_id: Optional[str] = None,
        limit: int = 50,
    ) -> list[HistoryMessage]:
        """
        Get history for a session.
        
        Args:
            session_key: Session identifier
            connection_id: Optional connection ID to search in
            limit: Maximum messages to return
            
        Returns:
            List of history messages
        """
        # If connection specified, use it directly
        if connection_id:
            conn = self._connections.get(connection_id)
            if conn and conn.is_connected():
                return await conn.get_session_history(session_key, limit)
            return []
        
        # Otherwise search all connections
        for conn in self._connections.values():
            if not conn.is_connected():
                continue
            
            try:
                history = await conn.get_session_history(session_key, limit)
                if history:
                    return history
            except Exception as e:
                logger.debug(f"No history from {conn.connection_id}: {e}")
        
        return []
    
    async def kill_session(
        self,
        session_key: str,
        connection_id: Optional[str] = None,
    ) -> bool:
        """
        Kill a session.
        
        Args:
            session_key: Session to terminate
            connection_id: Optional connection ID
            
        Returns:
            True if successful
        """
        # If connection specified
        if connection_id:
            conn = self._connections.get(connection_id)
            if conn and conn.is_connected():
                try:
                    return await conn.kill_session(session_key)
                except NotImplementedError:
                    return False
            return False
        
        # Try all connections
        for conn in self._connections.values():
            if not conn.is_connected():
                continue
            
            try:
                if await conn.kill_session(session_key):
                    return True
            except NotImplementedError:
                continue
            except Exception as e:
                logger.debug(f"Kill failed on {conn.connection_id}: {e}")
        
        return False
    
    # =========================================================================
    # Default connection helper
    # =========================================================================
    
    def get_default_openclaw(self) -> Optional["OpenClawConnection"]:
        """
        Get the first connected OpenClaw connection (the "default").
        
        Falls back to the first OpenClaw connection even if disconnected,
        so callers can attempt a reconnect via connect().
        
        Returns:
            OpenClawConnection or None if none registered.
        """
        # Prefer a connected one
        for conn in self._connections.values():
            if isinstance(conn, OpenClawConnection) and conn.is_connected():
                return conn
        # Fall back to any OpenClaw connection
        for conn in self._connections.values():
            if isinstance(conn, OpenClawConnection):
                return conn
        return None
    
    async def send_message(
        self,
        session_key: str,
        message: str,
        connection_id: Optional[str] = None,
        timeout: float = 90.0,
    ) -> Optional[str]:
        """
        Send a message to a session, routing to the correct connection.
        
        Args:
            session_key: Target session
            message: Message text
            connection_id: Specific connection to use (optional)
            timeout: Timeout in seconds
            
        Returns:
            Response text or None
        """
        if connection_id:
            conn = self._connections.get(connection_id)
            if conn and conn.is_connected():
                return await conn.send_message(session_key, message, timeout)
            return None
        
        # Try all connected
        for conn in self._connections.values():
            if not conn.is_connected():
                continue
            try:
                result = await conn.send_message(session_key, message, timeout)
                if result is not None:
                    return result
            except NotImplementedError:
                continue
            except Exception as e:
                logger.debug(f"send_message failed on {conn.connection_id}: {e}")
        
        return None
    
    # =========================================================================
    # Event Handling
    # =========================================================================
    
    def on_session_update(self, callback: AggregatedSessionCallback) -> None:
        """
        Register callback for session updates from any connection.
        
        Args:
            callback: Function(session, event_type) to call on updates
        """
        if callback not in self._session_callbacks:
            self._session_callbacks.append(callback)
    
    def off_session_update(self, callback: AggregatedSessionCallback) -> None:
        """Unregister session update callback."""
        if callback in self._session_callbacks:
            self._session_callbacks.remove(callback)
    
    def on_connection_status_change(
        self,
        callback: Callable[[str, ConnectionStatus], None],
    ) -> None:
        """
        Register callback for connection status changes.
        
        Args:
            callback: Function(connection_id, status) to call on changes
        """
        if callback not in self._status_callbacks:
            self._status_callbacks.append(callback)
    
    def off_connection_status_change(
        self,
        callback: Callable[[str, ConnectionStatus], None],
    ) -> None:
        """Unregister status change callback."""
        if callback in self._status_callbacks:
            self._status_callbacks.remove(callback)
    
    def _handle_session_update(self, session: SessionInfo, event_type: str) -> None:
        """Internal handler for session updates from connections."""
        for callback in self._session_callbacks:
            try:
                callback(session, event_type)
            except Exception as e:
                logger.error(f"Session callback error: {e}")
    
    def _handle_status_change(
        self,
        connection: AgentConnection,
        status: ConnectionStatus,
    ) -> None:
        """Internal handler for connection status changes."""
        for callback in self._status_callbacks:
            try:
                callback(connection.connection_id, status)
            except Exception as e:
                logger.error(f"Status callback error: {e}")

        # Broadcast status change via SSE to all connected clients
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(broadcast("connection-status", {
                "id": connection.connection_id,
                "name": connection.name,
                "type": connection.connection_type.value,
                "status": status.value,
                "error": connection.error_message,
            }))
        except RuntimeError:
            # No running event loop (shouldn't happen in normal operation)
            logger.debug("No event loop for SSE broadcast of connection status")


# Convenience function
async def get_connection_manager() -> ConnectionManager:
    """Get the singleton ConnectionManager instance."""
    return await ConnectionManager.get_instance()

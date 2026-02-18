"""
Abstract base class for agent connections.

Defines the interface that all connection types must implement.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Optional, TypeVar
import logging

logger = logging.getLogger(__name__)


class ConnectionStatus(Enum):
    """Status of a connection."""
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    RECONNECTING = "reconnecting"
    ERROR = "error"


class ConnectionType(Enum):
    """Type of agent connection."""
    OPENCLAW = "openclaw"
    CLAUDE_CODE = "claude_code"
    CODEX = "codex"


@dataclass
class SessionInfo:
    """
    Standardized session information across all connection types.
    
    Attributes:
        key: Unique session identifier (format varies by source)
        session_id: Internal session ID
        source: Connection source (openclaw/claude_code/codex)
        connection_id: ID of the connection this session belongs to
        agent_id: Agent identifier within the system
        channel: Communication channel (e.g., slack, whatsapp, cli)
        label: Human-readable label/name
        model: AI model being used
        status: Session status (active, idle, etc.)
        created_at: Unix timestamp (ms) when session was created
        last_activity: Unix timestamp (ms) of last activity
        metadata: Additional source-specific data
    """
    key: str
    session_id: str
    source: str
    connection_id: str
    agent_id: str = "main"
    channel: Optional[str] = None
    label: Optional[str] = None
    model: Optional[str] = None
    status: str = "unknown"
    created_at: Optional[int] = None
    last_activity: Optional[int] = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization.
        
        Metadata fields are flattened to the top level for backward
        compatibility with the legacy GatewayClient raw format.
        Standard fields always take precedence over metadata keys.
        """
        result: dict[str, Any] = dict(self.metadata)  # raw fields first
        result.update({
            "key": self.key,
            "sessionId": self.session_id,
            "source": self.source,
            "connectionId": self.connection_id,
            "agentId": self.agent_id,
            "channel": self.channel,
            "label": self.label,
            "model": self.model,
            "status": self.status,
            "createdAt": self.created_at,
            "lastActivity": self.last_activity,
        })
        return result


@dataclass
class HistoryMessage:
    """
    Standardized message from session history.
    
    Attributes:
        role: Message role (user/assistant/system)
        content: Message content
        timestamp: Unix timestamp (ms)
        metadata: Additional data (tool calls, etc.)
    """
    role: str
    content: str
    timestamp: Optional[int] = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "role": self.role,
            "content": self.content,
            "timestamp": self.timestamp,
            "metadata": self.metadata,
        }


# Type for session update callbacks
SessionUpdateCallback = Callable[[SessionInfo], None]
ConnectionStatusCallback = Callable[["AgentConnection", ConnectionStatus], None]


class AgentConnection(ABC):
    """
    Abstract base class for all agent connections.
    
    Implementations must handle:
    - Connection lifecycle (connect, disconnect, reconnect)
    - Session management (list, get history)
    - Event handling (session updates)
    
    Attributes:
        connection_id: Unique identifier for this connection
        name: Human-readable name
        connection_type: Type of connection (openclaw/claude_code/codex)
        config: Connection-specific configuration
    """
    
    def __init__(
        self,
        connection_id: str,
        name: str,
        connection_type: ConnectionType,
        config: dict[str, Any],
    ) -> None:
        """
        Initialize the connection.
        
        Args:
            connection_id: Unique identifier for this connection
            name: Human-readable name for display
            connection_type: Type of connection
            config: Configuration dictionary (varies by type)
        """
        self.connection_id = connection_id
        self.name = name
        self.connection_type = connection_type
        self.config = config
        
        self._status = ConnectionStatus.DISCONNECTED
        self._error_message: Optional[str] = None
        
        # Callbacks
        self._session_callbacks: list[SessionUpdateCallback] = []
        self._status_callbacks: list[ConnectionStatusCallback] = []
        
        logger.info(
            f"AgentConnection initialized: id={connection_id}, "
            f"name={name}, type={connection_type.value}"
        )
    
    @property
    def status(self) -> ConnectionStatus:
        """Get current connection status."""
        return self._status
    
    @status.setter
    def status(self, value: ConnectionStatus) -> None:
        """Set connection status and notify callbacks."""
        old_status = self._status
        self._status = value
        if old_status != value:
            logger.info(
                f"Connection {self.name} status changed: "
                f"{old_status.value} -> {value.value}"
            )
            self._notify_status_change()
    
    @property
    def error_message(self) -> Optional[str]:
        """Get the last error message if status is ERROR."""
        return self._error_message
    
    def is_connected(self) -> bool:
        """Check if the connection is currently active."""
        return self._status == ConnectionStatus.CONNECTED
    
    # =========================================================================
    # Abstract methods - must be implemented by subclasses
    # =========================================================================
    
    @abstractmethod
    async def connect(self) -> bool:
        """
        Establish connection to the agent system.
        
        Returns:
            True if connection successful, False otherwise.
            
        Note:
            - Should be idempotent (safe to call multiple times)
            - Should update self.status appropriately
            - Should set self._error_message on failure
        """
        pass
    
    @abstractmethod
    async def disconnect(self) -> None:
        """
        Close the connection gracefully.
        
        Note:
            - Should be idempotent (safe to call when disconnected)
            - Should clean up all resources
            - Should update self.status to DISCONNECTED
        """
        pass
    
    @abstractmethod
    async def get_sessions(self) -> list[SessionInfo]:
        """
        Get list of active sessions from this connection.
        
        Returns:
            List of SessionInfo objects representing active sessions.
            
        Note:
            - Should return empty list if not connected
            - Should handle errors gracefully (log and return empty list)
        """
        pass
    
    @abstractmethod
    async def get_session_history(
        self,
        session_key: str,
        limit: int = 50,
    ) -> list[HistoryMessage]:
        """
        Get message history for a specific session.
        
        Args:
            session_key: Unique identifier for the session
            limit: Maximum number of messages to return
            
        Returns:
            List of HistoryMessage objects, most recent last.
            
        Note:
            - Should return empty list if session not found
            - Should handle errors gracefully
        """
        pass
    
    @abstractmethod
    async def get_status(self) -> dict[str, Any]:
        """
        Get detailed status information about the connection.
        
        Returns:
            Dictionary with status details specific to the connection type.
        """
        pass
    
    # =========================================================================
    # Optional methods - can be overridden for extended functionality
    # =========================================================================
    
    async def send_message(
        self,
        session_key: str,
        message: str,
        timeout: float = 120.0,
    ) -> Optional[str]:
        """
        Send a message to a session.
        
        Args:
            session_key: Session to send message to
            message: Message content
            timeout: Timeout in seconds
            
        Returns:
            Response text if successful, None otherwise.
            
        Note:
            Default implementation raises NotImplementedError.
            Override in subclasses that support sending messages.
        """
        raise NotImplementedError(
            f"{self.__class__.__name__} does not support sending messages"
        )
    
    async def kill_session(self, session_key: str) -> bool:
        """
        Terminate a session.
        
        Args:
            session_key: Session to terminate
            
        Returns:
            True if successful, False otherwise.
            
        Note:
            Default implementation raises NotImplementedError.
            Override in subclasses that support session termination.
        """
        raise NotImplementedError(
            f"{self.__class__.__name__} does not support killing sessions"
        )
    
    async def health_check(self) -> bool:
        """
        Perform a health check on the connection.
        
        Returns:
            True if healthy, False otherwise.
            
        Note:
            Default implementation checks if status is CONNECTED.
            Override for more sophisticated health checks.
        """
        return self.is_connected()
    
    # =========================================================================
    # Callback registration
    # =========================================================================
    
    def on_session_update(self, callback: SessionUpdateCallback) -> None:
        """
        Register a callback for session updates.
        
        Args:
            callback: Function to call when a session is updated.
                      Receives the updated SessionInfo as argument.
        """
        if callback not in self._session_callbacks:
            self._session_callbacks.append(callback)
            logger.debug(f"Session callback registered for {self.name}")
    
    def off_session_update(self, callback: SessionUpdateCallback) -> None:
        """
        Unregister a session update callback.
        
        Args:
            callback: Previously registered callback function.
        """
        if callback in self._session_callbacks:
            self._session_callbacks.remove(callback)
            logger.debug(f"Session callback unregistered for {self.name}")
    
    def on_status_change(self, callback: ConnectionStatusCallback) -> None:
        """
        Register a callback for connection status changes.
        
        Args:
            callback: Function to call when status changes.
                      Receives (connection, new_status) as arguments.
        """
        if callback not in self._status_callbacks:
            self._status_callbacks.append(callback)
    
    def off_status_change(self, callback: ConnectionStatusCallback) -> None:
        """
        Unregister a status change callback.
        
        Args:
            callback: Previously registered callback function.
        """
        if callback in self._status_callbacks:
            self._status_callbacks.remove(callback)
    
    # =========================================================================
    # Protected helper methods
    # =========================================================================
    
    def _notify_session_update(self, session: SessionInfo) -> None:
        """Notify all registered callbacks of a session update."""
        for callback in self._session_callbacks:
            try:
                callback(session)
            except Exception as e:
                logger.error(f"Session callback error: {e}")
    
    def _notify_status_change(self) -> None:
        """Notify all registered callbacks of a status change."""
        for callback in self._status_callbacks:
            try:
                callback(self, self._status)
            except Exception as e:
                logger.error(f"Status callback error: {e}")
    
    def _set_error(self, message: str) -> None:
        """Set error status with message."""
        self._error_message = message
        self.status = ConnectionStatus.ERROR
        logger.error(f"Connection {self.name} error: {message}")
    
    def __repr__(self) -> str:
        return (
            f"<{self.__class__.__name__} "
            f"id={self.connection_id!r} "
            f"name={self.name!r} "
            f"status={self._status.value}>"
        )

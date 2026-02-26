"""
OpenClaw v2 device-identity handshake.

Extracted from OpenClawConnection._do_connect so the core class stays lean.
Call ``await perform_handshake(conn)`` from ``_do_connect``; it mutates
``conn.ws``, ``conn._identity_manager`` and ``conn._device_identity`` in-place
and returns ``True`` on success.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from typing import TYPE_CHECKING

import websockets

if TYPE_CHECKING:
    from .openclaw import OpenClawConnection

from .base import ConnectionStatus

logger = logging.getLogger(__name__)


async def _reset_existing_connection(conn: OpenClawConnection) -> None:
    if conn.ws:
        try:
            await conn.ws.close()
        except Exception as exc:
            logger.debug(f"Error closing old connection: {exc}")
        conn.ws = None
    if conn._listen_task and not conn._listen_task.done():
        conn._listen_task.cancel()
        try:
            await conn._listen_task
        except asyncio.CancelledError:
            pass


def _choose_auth(identity, conn: OpenClawConnection) -> tuple[bool, str]:
    use_device_token = bool(identity.device_token)
    auth_token = identity.device_token if use_device_token else (conn.token or "")
    if use_device_token:
        logger.debug(f"Auth: stored device token (device {identity.device_id[:16]}...)")
    elif conn.token:
        logger.info(f"Auth: gateway token for initial device registration (device {identity.device_id[:16]}...)")
    else:
        logger.warning("No auth credentials available")
    return use_device_token, auth_token


async def perform_handshake(conn: OpenClawConnection) -> bool:
    """Perform the OpenClaw v2 device-identity WebSocket handshake."""
    try:
        logger.info(f"Connecting to Gateway at {conn.uri}...")
        await _reset_existing_connection(conn)

        from .device_identity import CREWHUB_SCOPES, DeviceIdentityManager

        identity_manager = DeviceIdentityManager()
        identity = await identity_manager.get_or_create_device_identity(
            connection_id=conn.connection_id,
            device_name=f"CrewHub-{conn.name}",
        )
        conn._identity_manager = identity_manager
        conn._device_identity = identity

        conn.ws = await asyncio.wait_for(websockets.connect(conn.uri, ping_interval=20, ping_timeout=20), timeout=10.0)
        challenge = json.loads(await asyncio.wait_for(conn.ws.recv(), timeout=5.0))
        if challenge.get("type") != "event" or challenge.get("event") != "connect.challenge":
            raise Exception(f"Expected connect.challenge, got: {challenge}")

        nonce = challenge.get("payload", {}).get("nonce", "")
        logger.debug(f"Received challenge nonce: {nonce[:16]}...")
        use_device_token, auth_token = _choose_auth(identity, conn)
        device_block = identity.build_device_block(
            nonce=nonce, auth_token=auth_token, signed_at_ms=int(time.time() * 1000)
        )

        await conn.ws.send(
            json.dumps(
                {
                    "type": "req",
                    "id": f"connect-{uuid.uuid4()}",
                    "method": "connect",
                    "params": {
                        "minProtocol": 3,
                        "maxProtocol": 3,
                        "client": {"id": "cli", "version": "1.0.0", "platform": "crewhub", "mode": "cli"},
                        "device": device_block,
                        "role": "operator",
                        "scopes": CREWHUB_SCOPES,
                        "auth": {"token": auth_token} if auth_token else {},
                        "locale": "en-US",
                        "userAgent": f"crewhub/{conn.connection_id}/1.0.0",
                    },
                }
            )
        )

        response = json.loads(await asyncio.wait_for(conn.ws.recv(), timeout=5.0))
        if not response.get("ok"):
            error = response.get("error", {})
            error_code = error.get("code", "")
            if use_device_token and error_code in (
                "DEVICE_TOKEN_INVALID",
                "DEVICE_NOT_FOUND",
                "TOKEN_EXPIRED",
                "UNAUTHORIZED",
            ):
                logger.warning(f"Device token rejected ({error_code}) — clearing; will re-register")
                identity.device_token = None
                await identity_manager.clear_device_token(identity.device_id)
            raise Exception(f"Connect rejected: {error.get('message', error)}")

        response_auth = (response.get("payload", {}) or {}).get("auth") or {}
        new_device_token = response_auth.get("deviceToken") or response_auth.get("token")
        if new_device_token and new_device_token != auth_token:
            identity.device_token = new_device_token
            await identity_manager.update_device_token(identity.device_id, new_device_token)
            logger.info(
                f"✓ Device token stored for {identity.device_id[:16]}... (future connects use device-token auth)"
            )

        conn.status = ConnectionStatus.CONNECTED
        auth_mode = "device-token" if use_device_token else "gateway-token"
        got_token = " (got new device token ✓)" if (new_device_token and not use_device_token) else ""
        logger.info(f"Gateway '{conn.name}' connected [{auth_mode}]{got_token}")
        conn._listen_task = asyncio.create_task(conn._listen_loop())
        return True
    except TimeoutError:
        conn._set_error("Connection timed out")
        return False
    except Exception as exc:
        conn._set_error(str(exc))
        return False

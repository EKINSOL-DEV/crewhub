"""OpenClaw Gateway service."""

import asyncio
from typing import Optional
import websockets
import json

from app.config import settings


class GatewayService:
    """Service for communicating with OpenClaw Gateway."""

    def __init__(self):
        self.url = settings.openclaw_gateway_url
        self.token = settings.openclaw_gateway_token
        self.ws: Optional[websockets.WebSocketClientProtocol] = None

    async def connect(self):
        """Connect to the gateway."""
        headers = {}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        self.ws = await websockets.connect(self.url, extra_headers=headers)

    async def disconnect(self):
        """Disconnect from the gateway."""
        if self.ws:
            await self.ws.close()
            self.ws = None

    async def send(self, message: dict):
        """Send a message to the gateway."""
        if not self.ws:
            await self.connect()

        await self.ws.send(json.dumps(message))

    async def receive(self) -> dict:
        """Receive a message from the gateway."""
        if not self.ws:
            raise ConnectionError("Not connected to gateway")

        data = await self.ws.recv()
        return json.loads(data)


# Singleton instance
gateway = GatewayService()

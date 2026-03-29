from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketHub:
    """Simple hub for broadcasting JSON messages to connected clients."""

    def __init__(self):
        self._clients: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._clients.add(ws)
        logger.info("WebSocket connected. clients=%s", len(self._clients))

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self._clients.discard(ws)
        logger.info("WebSocket disconnected. clients=%s", len(self._clients))

    async def broadcast(self, message: dict[str, Any]) -> None:
        payload = json.dumps(message, ensure_ascii=False)
        async with self._lock:
            clients = list(self._clients)
        if not clients:
            return

        to_remove: list[WebSocket] = []
        for ws in clients:
            try:
                await ws.send_text(payload)
            except Exception:
                to_remove.append(ws)

        if to_remove:
            async with self._lock:
                for ws in to_remove:
                    self._clients.discard(ws)


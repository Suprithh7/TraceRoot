"""WebSocket broadcaster — per-case pub/sub for real-time analyst updates.

In-memory only (single-process). For multi-worker deploys, back this with
Redis Pub/Sub or NATS; the public interface stays the same.
"""
from __future__ import annotations
import asyncio
import json
from collections import defaultdict
from datetime import datetime, timezone
from typing import Dict, Set
from fastapi import WebSocket


class Broadcaster:
    def __init__(self) -> None:
        self._rooms: Dict[str, Set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, case_id: str, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._rooms[case_id].add(ws)

    async def disconnect(self, case_id: str, ws: WebSocket) -> None:
        async with self._lock:
            self._rooms[case_id].discard(ws)
            if not self._rooms[case_id]:
                self._rooms.pop(case_id, None)

    async def broadcast(self, case_id: str, event: str, payload: dict | None = None) -> None:
        """Fire-and-forget send to every socket subscribed to this case."""
        msg = json.dumps({
            "event": event,
            "payload": payload or {},
            "at": datetime.now(timezone.utc).isoformat(),
        })
        # Snapshot then send outside the lock to allow concurrent broadcasts.
        async with self._lock:
            sockets = list(self._rooms.get(case_id, ()))
        dead: list[WebSocket] = []
        for ws in sockets:
            try:
                await ws.send_text(msg)
            except Exception:  # noqa: BLE001
                dead.append(ws)
        if dead:
            async with self._lock:
                for ws in dead:
                    self._rooms[case_id].discard(ws)


broadcaster = Broadcaster()

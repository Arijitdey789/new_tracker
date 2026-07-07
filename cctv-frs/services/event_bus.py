"""
Event Bus — Asynchronous pub/sub messaging backbone.

Allows backend services (Edge Inference, Trajectory Engine, Alert Service,
Audit Service) to publish and subscribe to events asynchronously without direct coupling.
"""

import asyncio
import logging
from typing import Dict, List, Set

logger = logging.getLogger(__name__)


class EventBus:
    """
    Lightweight, in-memory async Event Bus.
    
    Provides pub/sub topic registration to decouple event flows.
    """

    def __init__(self):
        # Maps event_type -> set of asyncio.Queue instances
        self._subscribers: Dict[str, Set[asyncio.Queue]] = {}
        self._lock = asyncio.Lock()

    async def subscribe(self, event_type: str) -> asyncio.Queue:
        """
        Subscribe to an event type. Returns an asyncio.Queue from which
        events can be read.
        """
        queue = asyncio.Queue(maxsize=1000)
        async with self._lock:
            if event_type not in self._subscribers:
                self._subscribers[event_type] = set()
            self._subscribers[event_type].add(queue)
        logger.debug(f"Subscribed queue {id(queue)} to topic '{event_type}'")
        return queue

    async def unsubscribe(self, event_type: str, queue: asyncio.Queue):
        """Remove a queue subscription."""
        async with self._lock:
            if event_type in self._subscribers:
                self._subscribers[event_type].discard(queue)
                if not self._subscribers[event_type]:
                    del self._subscribers[event_type]
        logger.debug(f"Unsubscribed queue {id(queue)} from topic '{event_type}'")

    async def publish(self, event_type: str, data: dict):
        """
        Publish an event to all subscribers of the given event_type.
        Non-blocking: pushes to queues without waiting for consumer processing.
        """
        async with self._lock:
            queues = list(self._subscribers.get(event_type, []))
            # Also support global subscribers via '*' wildcard
            global_queues = list(self._subscribers.get("*", []))
            all_queues = set(queues + global_queues)

        if not all_queues:
            logger.debug(f"No subscribers for topic '{event_type}'")
            return

        for queue in all_queues:
            try:
                queue.put_nowait(data)
            except asyncio.QueueFull:
                logger.warning(f"Queue {id(queue)} full for topic '{event_type}'. Event dropped.")


# Global EventBus singleton
event_bus = EventBus()

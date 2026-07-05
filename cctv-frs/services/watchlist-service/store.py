"""
Watchlist Store — In-memory target embedding storage.

In production this would be backed by a distributed Vector DB (sharded ANN index).
For this detection-only phase, an in-memory dict suffices.

Each entry corresponds to architecture Data Artifact #14 (Watchlist entry):
  {target_id, reference_embedding, case_ref, authorization_ref, expiry}
"""

import threading
from typing import Dict, List, Optional
from dataclasses import dataclass, field
from datetime import datetime
import uuid
import numpy as np


@dataclass
class WatchlistEntry:
    """A single enrolled target in the watchlist."""
    target_id: str
    target_name: str
    embedding: np.ndarray  # 512-d L2-normalized ArcFace vector
    enrolled_at: datetime
    source_image_b64: Optional[str] = None  # base64 JPEG of the enrolled image
    face_crop_b64: Optional[str] = None     # base64 JPEG of the extracted face crop


class WatchlistStore:
    """
    Thread-safe in-memory watchlist.

    Stores target embeddings for comparison by the Recognition Service.
    """

    def __init__(self):
        self._entries: Dict[str, WatchlistEntry] = {}
        self._lock = threading.Lock()

    def enroll(
        self,
        target_name: str,
        embedding: np.ndarray,
        source_image_b64: Optional[str] = None,
        face_crop_b64: Optional[str] = None,
    ) -> WatchlistEntry:
        """Add a new target to the watchlist."""
        target_id = f"target-{uuid.uuid4().hex[:8]}"
        entry = WatchlistEntry(
            target_id=target_id,
            target_name=target_name,
            embedding=embedding,
            enrolled_at=datetime.utcnow(),
            source_image_b64=source_image_b64,
            face_crop_b64=face_crop_b64,
        )
        with self._lock:
            self._entries[target_id] = entry
        return entry

    def remove(self, target_id: str) -> bool:
        """Remove a target from the watchlist. Returns True if found and removed."""
        with self._lock:
            if target_id in self._entries:
                del self._entries[target_id]
                return True
            return False

    def get(self, target_id: str) -> Optional[WatchlistEntry]:
        """Get a specific target by ID."""
        with self._lock:
            return self._entries.get(target_id)

    def list_all(self) -> List[WatchlistEntry]:
        """Return all enrolled targets."""
        with self._lock:
            return list(self._entries.values())

    def get_all_embeddings(self) -> List[tuple]:
        """
        Return list of (target_id, target_name, embedding, face_crop_b64)
        for use by the Recognition Service matcher.
        """
        with self._lock:
            return [
                (e.target_id, e.target_name, e.embedding, e.face_crop_b64)
                for e in self._entries.values()
            ]

    def count(self) -> int:
        """Number of enrolled targets."""
        with self._lock:
            return len(self._entries)

    def clear(self):
        """Remove all targets."""
        with self._lock:
            self._entries.clear()


# Singleton instance — shared across the application
watchlist_store = WatchlistStore()

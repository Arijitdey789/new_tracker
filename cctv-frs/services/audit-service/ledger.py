"""
Audit Service — Immutable ledger with sequential hash-chaining.

Every security-sensitive event (enrollment, match, alert, operator decision,
evidentiary clip creation) is written to an append-only JSONL file where each
entry carries ``SHA-256(entry_data + previous_entry_hash)``.

Tampering with any single line invalidates the chain from that point forward,
making it detectable via ``verify_chain()``.
"""

import asyncio
import hashlib
import json
import logging
import os
from datetime import datetime
from typing import List, Optional

from services.event_bus import event_bus

logger = logging.getLogger(__name__)

_service_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(os.path.dirname(_service_dir))
LEDGER_DIR = os.path.join(_project_root, "storage", "audit")
LEDGER_FILE = os.path.join(LEDGER_DIR, "audit_ledger.jsonl")

# Genesis hash — the "previous hash" for the very first entry
GENESIS_HASH = "0" * 64


class AuditLedger:
    """
    Append-only, hash-chained audit ledger.

    Each line in the JSONL file is a JSON object with fields:
      seq, actor, action, timestamp, object_ref, details, prev_hash, hash
    """

    def __init__(self):
        self._lock = asyncio.Lock()
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._seq: int = 0
        self._prev_hash: str = GENESIS_HASH

        os.makedirs(LEDGER_DIR, exist_ok=True)

        # Resume sequence from existing ledger file
        if os.path.exists(LEDGER_FILE):
            try:
                with open(LEDGER_FILE, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        entry = json.loads(line)
                        self._seq = entry.get("seq", self._seq)
                        self._prev_hash = entry.get("hash", self._prev_hash)
                logger.info(
                    f"Audit ledger resumed at seq={self._seq}, "
                    f"prev_hash=…{self._prev_hash[-12:]}"
                )
            except Exception as e:
                logger.warning(f"Could not resume audit ledger state: {e}")

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------
    async def start(self):
        """Subscribe to ``audit_log`` events on the bus."""
        async with self._lock:
            if self._running:
                return
            self._running = True
            self._task = asyncio.create_task(self._consume_events())
            logger.info(f"Audit Service started. Ledger: {LEDGER_FILE}")

    async def stop(self):
        async with self._lock:
            self._running = False
            if self._task:
                self._task.cancel()
                try:
                    await self._task
                except asyncio.CancelledError:
                    pass
                self._task = None
            logger.info("Audit Service stopped.")

    # ------------------------------------------------------------------
    # Core write
    # ------------------------------------------------------------------
    async def append(self, actor: str, action: str, object_ref: str,
                     details: Optional[dict] = None,
                     timestamp: Optional[str] = None):
        """
        Append a single entry to the ledger.

        The entry hash is computed as::

            SHA-256( json(entry_without_hash) + prev_hash )
        """
        async with self._lock:
            self._seq += 1
            ts = timestamp or (datetime.utcnow().isoformat() + "Z")

            entry = {
                "seq": self._seq,
                "actor": actor,
                "action": action,
                "timestamp": ts,
                "object_ref": object_ref,
                "details": details or {},
                "prev_hash": self._prev_hash,
            }

            # Deterministic serialisation for hashing
            canonical = json.dumps(entry, sort_keys=True, separators=(",", ":"))
            entry_hash = hashlib.sha256(
                (canonical + self._prev_hash).encode("utf-8")
            ).hexdigest()

            entry["hash"] = entry_hash
            self._prev_hash = entry_hash

            # Append to file
            with open(LEDGER_FILE, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry, separators=(",", ":")) + "\n")

            logger.debug(
                f"[AUDIT] seq={self._seq} action={action} "
                f"hash=…{entry_hash[-12:]}"
            )

    # ------------------------------------------------------------------
    # Verification
    # ------------------------------------------------------------------
    def verify_chain(self) -> dict:
        """
        Walk the entire ledger file and verify every hash link.

        Returns a dict with ``valid`` (bool), ``entries_checked`` (int),
        and ``error`` (str | None).
        """
        if not os.path.exists(LEDGER_FILE):
            return {"valid": True, "entries_checked": 0, "error": None}

        prev_hash = GENESIS_HASH
        count = 0

        with open(LEDGER_FILE, "r", encoding="utf-8") as f:
            for lineno, raw in enumerate(f, start=1):
                raw = raw.strip()
                if not raw:
                    continue
                try:
                    entry = json.loads(raw)
                except json.JSONDecodeError as e:
                    return {
                        "valid": False,
                        "entries_checked": count,
                        "error": f"Line {lineno}: malformed JSON — {e}",
                    }

                stored_hash = entry.pop("hash", None)
                if stored_hash is None:
                    return {
                        "valid": False,
                        "entries_checked": count,
                        "error": f"Line {lineno}: missing 'hash' field",
                    }

                if entry.get("prev_hash") != prev_hash:
                    return {
                        "valid": False,
                        "entries_checked": count,
                        "error": (
                            f"Line {lineno}: prev_hash mismatch — "
                            f"expected …{prev_hash[-12:]}, "
                            f"got …{entry.get('prev_hash', '?')[-12:]}"
                        ),
                    }

                canonical = json.dumps(entry, sort_keys=True, separators=(",", ":"))
                expected = hashlib.sha256(
                    (canonical + prev_hash).encode("utf-8")
                ).hexdigest()

                if expected != stored_hash:
                    return {
                        "valid": False,
                        "entries_checked": count,
                        "error": (
                            f"Line {lineno}: hash mismatch — "
                            f"expected …{expected[-12:]}, "
                            f"got …{stored_hash[-12:]}"
                        ),
                    }

                prev_hash = stored_hash
                count += 1

        return {"valid": True, "entries_checked": count, "error": None}

    # ------------------------------------------------------------------
    # Query
    # ------------------------------------------------------------------
    def tail(self, n: int = 50) -> List[dict]:
        """Return the last *n* entries from the ledger file."""
        if not os.path.exists(LEDGER_FILE):
            return []

        entries: List[dict] = []
        with open(LEDGER_FILE, "r", encoding="utf-8") as f:
            for raw in f:
                raw = raw.strip()
                if raw:
                    try:
                        entries.append(json.loads(raw))
                    except json.JSONDecodeError:
                        pass
        return entries[-n:]

    # ------------------------------------------------------------------
    # Event-bus consumer loop
    # ------------------------------------------------------------------
    async def _consume_events(self):
        """Background loop — reads ``audit_log`` events and appends them."""
        queue = await event_bus.subscribe("audit_log")
        try:
            while self._running:
                event = await queue.get()
                await self.append(
                    actor=event.get("actor", "unknown"),
                    action=event.get("action", "unknown"),
                    object_ref=event.get("object_ref", ""),
                    details=event.get("details"),
                    timestamp=event.get("timestamp"),
                )
                queue.task_done()
        except asyncio.CancelledError:
            pass
        finally:
            await event_bus.unsubscribe("audit_log", queue)


# Global singleton
audit_ledger = AuditLedger()

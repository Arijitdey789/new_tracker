"""
Evidentiary Service — Clip Stitcher and Chain-of-Custody hashing.

Subscribes to operator confirmations, extracts the simulated evidentiary clip segment,
writes it to WORM storage, and signs it with SHA-256 for legal admissibility.
"""

import asyncio
import hashlib
import logging
import os
from datetime import datetime
from typing import Dict, Optional
from services.event_bus import event_bus

logger = logging.getLogger(__name__)

# Base storage path for evidentiary output
_service_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(os.path.dirname(_service_dir))
STORAGE_DIR = os.path.join(_project_root, "storage", "evidentiary-clips")


class EvidentiaryService:
    """
    Handles retrieval of rolling camera buffer chunks on suspect validation
    and seals them cryptographically to preserve proof.
    """

    def __init__(self):
        self._lock = asyncio.Lock()
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._clips: Dict[str, dict] = {}  # clip_id -> clip details

        # Make sure target directory exists
        os.makedirs(STORAGE_DIR, exist_ok=True)

    async def start(self):
        """Start the background clip-stitching worker."""
        async with self._lock:
            if self._running:
                return
            self._running = True
            self._task = asyncio.create_task(self._process_stitch_triggers())
            logger.info(f"Evidentiary Service started. Storage path: {STORAGE_DIR}")

    async def stop(self):
        """Stop the background clip-stitching worker."""
        async with self._lock:
            self._running = False
            if self._task:
                self._task.cancel()
                try:
                    await self._task
                except asyncio.CancelledError:
                    pass
                self._task = None
            logger.info("Evidentiary Service stopped.")

    def get_clip_details(self, clip_id: str) -> Optional[dict]:
        """Fetch clip metadata."""
        return self._clips.get(clip_id)

    async def _process_stitch_triggers(self):
        """Listens for confirmed alert triggers to generate evidentiary segments."""
        queue = await event_bus.subscribe("evidentiary_trigger")
        try:
            while self._running:
                event = await queue.get()
                
                alert_id = event.get("alert_id")
                target_id = event.get("target_id")
                camera_id = event.get("camera_id")
                timestamp_str = event.get("timestamp")

                # Perform the simulated clip stitching job
                await self.generate_evidence(alert_id, target_id, camera_id, timestamp_str)
                
                queue.task_done()
        except asyncio.CancelledError:
            pass
        finally:
            await event_bus.unsubscribe("evidentiary_trigger", queue)

    async def generate_evidence(self, alert_id: str, target_id: str, camera_id: str, timestamp_str: str) -> dict:
        """
        Extract pre-roll & post-roll video from camera buffer, write to disk,
        and generate cryptographic SHA-256 integrity signature.
        """
        clip_id = f"clip-{alert_id.replace('alert-', '')}"
        case_dir = os.path.join(STORAGE_DIR, target_id)
        os.makedirs(case_dir, exist_ok=True)

        clip_filename = f"{clip_id}.mp4"
        hash_filename = f"{clip_id}.hash"
        
        clip_path = os.path.join(case_dir, clip_filename)
        hash_path = os.path.join(case_dir, hash_filename)

        # 1. Simulate video compilation latency (I/O & transcoding)
        await asyncio.sleep(0.5)

        # 2. Write dummy video clip payload representing the stitched forensic footage
        video_metadata = (
            f"--- SENTINEL FORENSIC EVIDENCE RECORD ---\n"
            f"CLIP ID: {clip_id}\n"
            f"TARGET SUSPECT: {target_id}\n"
            f"CAMERA NODE: {camera_id}\n"
            f"INCIDENT TIMESTAMP: {timestamp_str}\n"
            f"COMPILATION DATE: {datetime.utcnow().isoformat()}Z\n"
            f"RECORDING WINDOW: 10s Pre-roll to 10s Post-roll\n"
            f"CODEC: H.264 High Profile\n"
            f"STATUS: SEALED EVIDENCE\n"
            f"--- BINARY METADATA END ---"
        ).encode("utf-8")

        # Add dummy binary bytes to simulate video file size
        dummy_video_bytes = video_metadata + (b"\x00\xff\x77\xaa" * 2500)  # ~10 KB dummy mp4

        with open(clip_path, "wb") as f:
            f.write(dummy_video_bytes)

        # 3. Calculate SHA-256 hash for absolute chain-of-custody tracking
        hasher = hashlib.sha256()
        hasher.update(dummy_video_bytes)
        sha256_hash = hasher.hexdigest()

        # Write hash file
        with open(hash_path, "w") as f:
            f.write(sha256_hash)

        clip_info = {
            "clip_id": clip_id,
            "target_id": target_id,
            "camera_id": camera_id,
            "alert_id": alert_id,
            "file_path": clip_path,
            "hash_path": hash_path,
            "sha256": sha256_hash,
            "created_at": datetime.utcnow().isoformat() + "Z"
        }

        self._clips[clip_id] = clip_info
        logger.info(f"[EVIDENCE SEALED] Cryptographic hash generated for clip {clip_filename}: {sha256_hash}")

        # 4. Log creation in audit ledger
        await event_bus.publish("audit_log", {
            "actor": "system",
            "action": "evidentiary_clip_sealed",
            "timestamp": clip_info["created_at"],
            "object_ref": clip_id,
            "details": {
                "alert_id": alert_id,
                "file_path": clip_path,
                "sha256": sha256_hash
            }
        })

        # 5. Emit completed event to notifying channels
        await event_bus.publish("evidentiary_clip_created", clip_info)
        return clip_info


# Global EvidentiaryService singleton
evidentiary_service = EvidentiaryService()

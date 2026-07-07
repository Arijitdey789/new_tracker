"""
Alert Service — Alert generation, database mapping, and notification orchestration.

Subscribes to trajectory updates, manages operator validation lifecycles
(pending, confirmed, rejected), and triggers evidentiary actions.
"""

import asyncio
import logging
import uuid
from datetime import datetime
from typing import Dict, List, Optional
from services.event_bus import event_bus

logger = logging.getLogger(__name__)


class AlertPayload:
    """Represents a structured suspect sighting alert."""

    def __init__(self, target_id: str, target_name: str, camera_id: str, confidence: str, coords: dict, face_crop_b64: Optional[str] = None, target_image_b64: Optional[str] = None):
        self.alert_id = f"alert-{uuid.uuid4().hex[:8]}"
        self.target_id = target_id
        self.target_name = target_name
        self.camera_id = camera_id
        self.confidence = confidence
        self.coords = coords
        self.timestamp = datetime.utcnow()
        self.status = "pending"  # pending | confirmed | rejected
        self.face_crop_b64 = face_crop_b64
        self.target_image_b64 = target_image_b64
        self.notes: Optional[str] = None
        self.actioned_at: Optional[datetime] = None
        self.operator_id: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "alert_id": self.alert_id,
            "target_id": self.target_id,
            "target_name": self.target_name,
            "camera_id": self.camera_id,
            "confidence": self.confidence,
            "coords": self.coords,
            "timestamp": self.timestamp.isoformat() + "Z",
            "status": self.status,
            "face_crop_b64": self.face_crop_b64,
            "target_image_b64": self.target_image_b64,
            "notes": self.notes,
            "actioned_at": self.actioned_at.isoformat() + "Z" if self.actioned_at else None,
            "operator_id": self.operator_id
        }


class AlertService:
    """
    Orchestrates live alerts, state validation gates, and dispatches updates
    to the operator dashboard and mobile patrol receivers.
    """

    def __init__(self):
        # Maps alert_id -> AlertPayload
        self._alerts: Dict[str, AlertPayload] = {}
        self._lock = asyncio.Lock()
        self._running = False
        self._task: Optional[asyncio.Task] = None

    async def start(self):
        """Start the background alert listener."""
        async with self._lock:
            if self._running:
                return
            self._running = True
            self._task = asyncio.create_task(self._process_trajectory_events())
            logger.info("Alert Service started.")

    async def stop(self):
        """Stop the background alert listener."""
        async with self._lock:
            self._running = False
            if self._task:
                self._task.cancel()
                try:
                    await self._task
                except asyncio.CancelledError:
                    pass
                self._task = None
            logger.info("Alert Service stopped.")

    def get_alert(self, alert_id: str) -> Optional[AlertPayload]:
        """Fetch alert detail by ID."""
        return self._alerts.get(alert_id)

    def list_alerts(self, limit: int = 50) -> List[dict]:
        """List active and historical alerts."""
        sorted_alerts = sorted(
            self._alerts.values(),
            key=lambda a: a.timestamp,
            reverse=True
        )
        return [a.to_dict() for a in sorted_alerts[:limit]]

    async def handle_operator_action(self, alert_id: str, action: str, operator_id: str, notes: Optional[str] = None) -> bool:
        """
        Process Operator Decision Record (Data Artifact #10).
        Validates decision and triggers the downstream clip-stitching / audit tasks.
        """
        if action not in ["confirm", "reject"]:
            raise ValueError("Action must be 'confirm' or 'reject'")

        async with self._lock:
            alert = self._alerts.get(alert_id)
            if not alert:
                logger.warning(f"[ALERT] Action failed: alert '{alert_id}' not found.")
                return False

            if alert.status != "pending":
                logger.warning(f"[ALERT] Action failed: alert '{alert_id}' is already {alert.status}.")
                return False

            alert.status = "confirmed" if action == "confirm" else "rejected"
            alert.actioned_at = datetime.utcnow()
            alert.operator_id = operator_id
            alert.notes = notes

            logger.info(f"[ALERT DECISION] Alert {alert_id} {alert.status} by operator {operator_id}.")

            # 1. Publish audit event for absolute accountability
            await event_bus.publish("audit_log", {
                "actor": operator_id,
                "action": f"alert_{action}",
                "timestamp": alert.actioned_at.isoformat() + "Z",
                "object_ref": alert_id,
                "details": {
                    "target_id": alert.target_id,
                    "target_name": alert.target_name,
                    "camera_id": alert.camera_id,
                    "notes": notes
                }
            })

            # 2. If confirmed, trigger the evidentiary clip stitcher
            if action == "confirm":
                await event_bus.publish("evidentiary_trigger", {
                    "alert_id": alert_id,
                    "target_id": alert.target_id,
                    "camera_id": alert.camera_id,
                    "timestamp": alert.timestamp.isoformat() + "Z"
                })
                
                # Relayed push event for dispatch notifications
                await event_bus.publish("dispatch_trigger", {
                    "alert_id": alert_id,
                    "target_id": alert.target_id,
                    "target_name": alert.target_name,
                    "camera_id": alert.camera_id,
                    "timestamp": alert.actioned_at.isoformat() + "Z"
                })

            # 3. Publish update status event to UI
            await event_bus.publish("alert_status_update", alert.to_dict())
            return True

    async def _process_trajectory_events(self):
        """Listens for validated trajectory updates to raise alerts."""
        queue = await event_bus.subscribe("trajectory_update")
        try:
            while self._running:
                event = await queue.get()
                
                target_id = event.get("target_id")
                target_name = event.get("target_name")
                camera_id = event.get("camera_id")
                confidence = event.get("confidence")
                coords = event.get("coords")
                
                # Fetch base64 images if available from live tracking updates
                track_summary = event.get("track_summary", {})
                face_crop_b64 = None
                target_image_b64 = None
                
                # Try finding from pipeline matches if we are in the same node process
                import importlib
                pipeline_mod = importlib.import_module("services.edge-inference.pipeline")
                latest = pipeline_mod.pipeline.latest_match
                if latest and latest.get("target_id") == target_id:
                    face_crop_b64 = latest.get("face_crop_b64")
                    target_image_b64 = latest.get("target_image_b64")

                # Generate alert payload
                alert = AlertPayload(
                    target_id=target_id,
                    target_name=target_name,
                    camera_id=camera_id,
                    confidence=confidence,
                    coords=coords,
                    face_crop_b64=face_crop_b64,
                    target_image_b64=target_image_b64
                )

                async with self._lock:
                    self._alerts[alert.alert_id] = alert
                
                logger.info(f"[ALERT RAISED] Suspect Alert generated: ID={alert.alert_id} for target '{target_name}' on {camera_id}")

                # Publish alert log event to audit ledger
                await event_bus.publish("audit_log", {
                    "actor": "system",
                    "action": "alert_raised",
                    "timestamp": alert.timestamp.isoformat() + "Z",
                    "object_ref": alert.alert_id,
                    "details": {
                        "target_id": target_id,
                        "target_name": target_name,
                        "camera_id": camera_id,
                        "confidence": confidence
                    }
                })

                # Publish alert trigger for active websocket dashboards
                await event_bus.publish("alert_trigger", alert.to_dict())

                queue.task_done()
        except asyncio.CancelledError:
            pass
        finally:
            await event_bus.unsubscribe("trajectory_update", queue)


# Global AlertService singleton
alert_service = AlertService()

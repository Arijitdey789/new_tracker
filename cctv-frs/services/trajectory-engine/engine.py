"""
Trajectory Engine — Track fusion and Spatio-Temporal Gating.

Processes detection matches, checks travel plausibility between camera locations,
and synthesizes path trajectories for active targets.
"""

import asyncio
import logging
import math
from datetime import datetime
from typing import Dict, List, Optional
from services.event_bus import event_bus

logger = logging.getLogger(__name__)

# Static cameras database mapping camera_id to geographic coordinates
CAMERAS = {
    "cam-0": {"lat": 22.5744, "lon": 88.3629, "name": "Main Gate"},
    "cam-1": {"lat": 22.5780, "lon": 88.3650, "name": "North Junction"},
    "cam-2": {"lat": 22.5820, "lon": 88.3700, "name": "East Crossing"},
    "cam-3": {"lat": 22.6100, "lon": 88.4000, "name": "Howrah Bridge (Isolated)"}
}

# Max plausible speeds in meters per second
MAX_SPEED_PEDESTRIAN = 2.5
MAX_SPEED_JOGGER = 4.0
MAX_SPEED_VEHICLE = 12.0

# Default gate speed threshold
DEFAULT_MAX_SPEED = MAX_SPEED_VEHICLE


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points in meters."""
    R = 6371.0 * 1000.0  # Earth radius in meters
    
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    
    return R * c


class GlobalTrack:
    """Represents the complete compiled trajectory of a tracked target across cameras."""

    def __init__(self, target_id: str, target_name: str):
        self.target_id = target_id
        self.target_name = target_name
        # List of sightings: {"camera_id": str, "timestamp": datetime, "coords": dict, "confidence": float}
        self.segments: List[dict] = []
        self.created_at = datetime.utcnow()
        self.last_updated = datetime.utcnow()

    def add_segment(self, camera_id: str, timestamp: datetime, coords: dict, confidence: float):
        self.segments.append({
            "camera_id": camera_id,
            "timestamp": timestamp,
            "coords": coords,
            "confidence": confidence
        })
        self.last_updated = datetime.utcnow()

    def to_dict(self) -> dict:
        return {
            "target_id": self.target_id,
            "target_name": self.target_name,
            "segments": [
                {
                    "camera_id": s["camera_id"],
                    "timestamp": s["timestamp"].isoformat() + "Z",
                    "coords": s["coords"],
                    "confidence": s["confidence"]
                }
                for s in self.segments
            ],
            "created_at": self.created_at.isoformat() + "Z",
            "last_updated": self.last_updated.isoformat() + "Z"
        }


class TrajectoryEngine:
    """
    Tracks target paths across all cameras.
    Applies spatio-temporal gating rules to reject impossible transitions.
    """

    def __init__(self):
        # Maps target_id -> GlobalTrack
        self._tracks: Dict[str, GlobalTrack] = {}
        self._lock = asyncio.Lock()
        self._running = False
        self._task: Optional[asyncio.Task] = None

    async def start(self):
        """Start the background trajectory processor."""
        async with self._lock:
            if self._running:
                return
            self._running = True
            self._task = asyncio.create_task(self._process_events())
            logger.info("Trajectory Engine started.")

    async def stop(self):
        """Stop the background trajectory processor."""
        async with self._lock:
            self._running = False
            if self._task:
                self._task.cancel()
                try:
                    await self._task
                except asyncio.CancelledError:
                    pass
                self._task = None
            logger.info("Trajectory Engine stopped.")

    def get_track(self, target_id: str) -> Optional[dict]:
        """Retrieve a target's trajectory file."""
        track = self._tracks.get(target_id)
        return track.to_dict() if track else None

    def list_tracks(self) -> List[dict]:
        """List all active trajectories."""
        return [t.to_dict() for t in self._tracks.values()]

    def clear_tracks(self):
        """Clear all active tracks."""
        self._tracks.clear()

    async def _process_events(self):
        """Listens to matching events from the event bus."""
        queue = await event_bus.subscribe("tracking_start")
        update_queue = await event_bus.subscribe("tracking_update")

        async def listen_start():
            while self._running:
                try:
                    event = await queue.get()
                    await self.handle_sighting(event)
                    queue.task_done()
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.error(f"Error handling tracking_start in TrajectoryEngine: {e}")

        async def listen_update():
            while self._running:
                try:
                    event = await update_queue.get()
                    await self.handle_sighting(event)
                    update_queue.task_done()
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.error(f"Error handling tracking_update in TrajectoryEngine: {e}")

        try:
            await asyncio.gather(listen_start(), listen_update())
        finally:
            await event_bus.unsubscribe("tracking_start", queue)
            await event_bus.unsubscribe("tracking_update", update_queue)

    async def handle_sighting(self, event: dict):
        """
        Process a new camera match/sighting.
        Enforces Spatio-Temporal Gating checks before updating the trajectory.
        """
        camera_id = event.get("camera_id", "unknown")
        target_id = event.get("target_id")
        target_name = event.get("target_name", "Unknown Target")
        confidence_str = event.get("confidence", "0%")
        coords = event.get("coordinates", {"x": 0, "y": 0})
        
        try:
            confidence = float(confidence_str.replace("%", "")) / 100.0
        except ValueError:
            confidence = 0.0

        if not target_id:
            return

        ts_str = event.get("timestamp", datetime.utcnow().isoformat())
        # Parse ISO timestamp
        try:
            timestamp = datetime.fromisoformat(ts_str.replace("Z", "+00:00")).replace(tzinfo=None)
        except Exception:
            timestamp = datetime.utcnow()

        async with self._lock:
            track = self._tracks.get(target_id)
            if not track:
                # First sighting: initialize track and skip gating checks
                track = GlobalTrack(target_id, target_name)
                track.add_segment(camera_id, timestamp, coords, confidence)
                self._tracks[target_id] = track
                logger.info(f"[TRAJECTORY] New global track created for {target_name} ({target_id}) on {camera_id}")
                
                # Emit validated trajectory update
                await event_bus.publish("trajectory_update", {
                    "target_id": target_id,
                    "target_name": target_name,
                    "camera_id": camera_id,
                    "timestamp": timestamp.isoformat() + "Z",
                    "coords": coords,
                    "confidence": confidence_str,
                    "gated": False,
                    "track_summary": track.to_dict()
                })
                return

            # Existing track: check Spatio-Temporal Gate
            last_sighting = track.segments[-1]
            last_camera_id = last_sighting["camera_id"]
            last_timestamp = last_sighting["timestamp"]

            if last_camera_id == camera_id:
                # Same camera update: merge track node
                track.add_segment(camera_id, timestamp, coords, confidence)
                await event_bus.publish("trajectory_update", {
                    "target_id": target_id,
                    "target_name": target_name,
                    "camera_id": camera_id,
                    "timestamp": timestamp.isoformat() + "Z",
                    "coords": coords,
                    "confidence": confidence_str,
                    "gated": False,
                    "track_summary": track.to_dict()
                })
                return

            # Fetch coordinates
            loc1 = CAMERAS.get(last_camera_id)
            loc2 = CAMERAS.get(camera_id)

            if not loc1 or not loc2:
                # Missing coordinates: bypass gate and allow
                logger.warning(f"[ST-GATE] Missing camera coordinates for {last_camera_id} or {camera_id}. Gating bypassed.")
                track.add_segment(camera_id, timestamp, coords, confidence)
                await event_bus.publish("trajectory_update", {
                    "target_id": target_id,
                    "target_name": target_name,
                    "camera_id": camera_id,
                    "timestamp": timestamp.isoformat() + "Z",
                    "coords": coords,
                    "confidence": confidence_str,
                    "gated": False,
                    "track_summary": track.to_dict()
                })
                return

            # Compute delta distance and delta time
            distance = haversine_distance(loc1["lat"], loc1["lon"], loc2["lat"], loc2["lon"])
            time_delta = (timestamp - last_timestamp).total_seconds()

            if time_delta <= 0:
                # Impossible time sequencing
                logger.warning(f"[ST-GATE REJECT] Sighting on camera {camera_id} rejected for target {target_name} ({target_id}): time delta <= 0s.")
                await event_bus.publish("trajectory_gated_reject", {
                    "target_id": target_id,
                    "target_name": target_name,
                    "camera_id": camera_id,
                    "last_camera_id": last_camera_id,
                    "timestamp": timestamp.isoformat() + "Z",
                    "distance_meters": distance,
                    "time_delta_seconds": time_delta,
                    "reason": "Sequential timestamp is before or equal to previous sighting"
                })
                return

            speed_required = distance / time_delta
            logger.info(f"[ST-GATE] Checking transition {last_camera_id} -> {camera_id}: dist={distance:.1f}m, time={time_delta:.1f}s, speed_req={speed_required:.2f} m/s")

            if speed_required > DEFAULT_MAX_SPEED:
                # Transition is geometrically impossible! Reject
                logger.warning(f"[ST-GATE REJECT] Sighting on camera {camera_id} rejected for target {target_name} ({target_id}): travel speed {speed_required:.2f} m/s exceeds max threshold {DEFAULT_MAX_SPEED} m/s.")
                await event_bus.publish("trajectory_gated_reject", {
                    "target_id": target_id,
                    "target_name": target_name,
                    "camera_id": camera_id,
                    "last_camera_id": last_camera_id,
                    "timestamp": timestamp.isoformat() + "Z",
                    "distance_meters": distance,
                    "time_delta_seconds": time_delta,
                    "speed_required": speed_required,
                    "max_speed_limit": DEFAULT_MAX_SPEED,
                    "reason": f"Required speed {speed_required:.2f} m/s exceeds max threshold {DEFAULT_MAX_SPEED} m/s"
                })
                return

            # Gate passed: update trajectory
            track.add_segment(camera_id, timestamp, coords, confidence)
            logger.info(f"[TRAJECTORY] Gating passed. Sighting on {camera_id} appended to {target_name}'s track.")
            
            await event_bus.publish("trajectory_update", {
                "target_id": target_id,
                "target_name": target_name,
                "camera_id": camera_id,
                "timestamp": timestamp.isoformat() + "Z",
                "coords": coords,
                "confidence": confidence_str,
                "gated": False,
                "track_summary": track.to_dict()
            })


# Global TrajectoryEngine singleton
trajectory_engine = TrajectoryEngine()

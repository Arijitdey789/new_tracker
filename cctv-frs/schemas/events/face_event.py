"""
FaceEvent schema — versioned message contract (v1).

Generated at: Edge AI Node
Published to: Event Bus (asyncio.Queue in this phase)
Consumed by: Recognition Service, Trajectory Engine, Audit Service

Schema fields mirror the architecture's Data Artifact Table row #5:
  {event_id, camera_id, zone_id, ts, vector, bbox, quality_score}
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
import uuid


class BoundingBox(BaseModel):
    """Face bounding box coordinates within the source frame."""
    x1: int = Field(..., description="Top-left X coordinate")
    y1: int = Field(..., description="Top-left Y coordinate")
    x2: int = Field(..., description="Bottom-right X coordinate")
    y2: int = Field(..., description="Bottom-right Y coordinate")


class FaceEvent(BaseModel):
    """
    Structured event emitted by the Edge AI Node for every detected face.

    Only structured metadata + embedding leave the edge — never raw video.
    """
    event_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="Unique event identifier"
    )
    camera_id: str = Field(
        default="cam-0",
        description="Source camera identifier"
    )
    zone_id: str = Field(
        default="zone-local",
        description="Deployment zone identifier"
    )
    timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        description="UTC timestamp of detection"
    )
    embedding: List[float] = Field(
        ...,
        description="Face embedding vector (512-d ArcFace, L2-normalized)"
    )
    bbox: BoundingBox = Field(
        ...,
        description="Face bounding box in source frame"
    )
    quality_score: float = Field(
        default=0.0,
        ge=0.0, le=1.0,
        description="Face quality/detection confidence score"
    )
    face_crop_b64: Optional[str] = Field(
        default=None,
        description="Base64-encoded JPEG face crop (optional, for UI display)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "event_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                "camera_id": "cam-0",
                "zone_id": "zone-local",
                "timestamp": "2026-06-28T09:00:00Z",
                "embedding": [0.01] * 512,
                "bbox": {"x1": 100, "y1": 50, "x2": 250, "y2": 300},
                "quality_score": 0.95,
            }
        }

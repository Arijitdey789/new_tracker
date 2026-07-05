"""
MatchResult schema — versioned message contract (v1).

Generated at: Recognition Service
Published to: Event Bus / WebSocket
Consumed by: Trajectory Engine, Alert Service, ICCC Dashboard

Schema fields mirror the architecture's Data Artifact Table row #6:
  {event_id, target_id, confidence, watchlist_ref}
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
import uuid


class MatchResult(BaseModel):
    """
    Result of comparing a FaceEvent embedding against the watchlist.

    Only emitted when similarity exceeds the configured threshold —
    non-matches are silently discarded (no output for non-target persons).
    """
    match_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="Unique match identifier"
    )
    event_id: str = Field(
        ...,
        description="Source FaceEvent that triggered this match"
    )
    target_id: str = Field(
        ...,
        description="Matched target identifier from the watchlist"
    )
    target_name: str = Field(
        default="Unknown",
        description="Human-readable target name"
    )
    confidence: float = Field(
        ...,
        ge=0.0, le=1.0,
        description="Cosine similarity score (higher = more similar)"
    )
    threshold: float = Field(
        default=0.45,
        description="Threshold used for this match decision"
    )
    is_match: bool = Field(
        ...,
        description="True if confidence >= threshold"
    )
    timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        description="UTC timestamp of match decision"
    )
    camera_id: str = Field(
        default="cam-0",
        description="Source camera where the match was detected"
    )
    face_crop_b64: Optional[str] = Field(
        default=None,
        description="Base64-encoded JPEG of the matched face crop"
    )
    target_image_b64: Optional[str] = Field(
        default=None,
        description="Base64-encoded JPEG of the enrolled target image"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "match_id": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
                "event_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                "target_id": "target-001",
                "target_name": "John Doe",
                "confidence": 0.82,
                "threshold": 0.45,
                "is_match": True,
                "camera_id": "cam-0",
            }
        }

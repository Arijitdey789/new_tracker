"""
Schemas package — Versioned message contracts for inter-service communication.

Organized into:
  - events/  — FaceEvent, MatchResult, AlertPayload, etc.
  - api/     — REST/gRPC contracts for BFF ↔ domain services

Provides Pydantic models for:
- FaceEvent: Edge → Bus → Recognition Service
- MatchResult: Recognition Service → Dashboard
"""

# Re-export from new canonical locations for backward compatibility
from .events.face_event import FaceEvent
from .events.match_result import MatchResult

__all__ = ["FaceEvent", "MatchResult"]

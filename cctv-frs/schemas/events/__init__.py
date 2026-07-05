"""
Event schemas — Versioned message contracts for event-driven communication.

Contains Pydantic models for all inter-service events:
- FaceEvent: Edge → Bus → Recognition Service
- MatchResult: Recognition Service → Trajectory Engine / Dashboard
"""

from .face_event import FaceEvent
from .match_result import MatchResult

__all__ = ["FaceEvent", "MatchResult"]

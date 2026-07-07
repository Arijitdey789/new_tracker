"""
Alert Service — API Router.

Endpoints:
  GET  /api/v1/alerts/history           — List recent alerts
  GET  /api/v1/alerts/{alert_id}        — Get alert detail
  POST /api/v1/alerts/{alert_id}/action — Register operator decision (confirm/reject)
"""

import logging
import importlib
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/alerts", tags=["alerts"])


def _get_service():
    """Lazy import to bypass hyphenated directory name."""
    mod = importlib.import_module("services.alert-service.service")
    return mod.alert_service


class OperatorActionRequest(BaseModel):
    action: str  # 'confirm' or 'reject'
    operator_id: str
    notes: Optional[str] = None


@router.get("/history")
async def get_alerts_history(
    limit: int = Query(default=30, ge=1, le=100)
):
    """Retrieve history of raised target alerts."""
    svc = _get_service()
    return svc.list_alerts(limit=limit)


@router.get("/{alert_id}")
async def get_alert_detail(alert_id: str):
    """Retrieve details for a specific alert."""
    svc = _get_service()
    alert = svc.get_alert(alert_id)
    if not alert:
        raise HTTPException(
            status_code=404,
            detail=f"Alert '{alert_id}' not found"
        )
    return alert.to_dict()


@router.post("/{alert_id}/action")
async def register_operator_decision(
    alert_id: str,
    payload: OperatorActionRequest,
):
    """
    Submit operator decision (confirm / reject).

    Confirmed alerts trigger evidentiary clip stitching and field dispatch.
    Both outcomes are written to the immutable audit ledger.
    """
    svc = _get_service()
    try:
        success = await svc.handle_operator_action(
            alert_id=alert_id,
            action=payload.action,
            operator_id=payload.operator_id,
            notes=payload.notes,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not success:
        raise HTTPException(
            status_code=404,
            detail=f"Action failed. Alert '{alert_id}' not found or already processed.",
        )

    return {"status": "success", "alert_id": alert_id, "decision": payload.action}

"""
Audit Service — API Router.

Endpoints:
  GET  /api/v1/audit/log       — Tail the audit ledger
  GET  /api/v1/audit/verify    — Verify the hash-chain integrity
"""

import logging
import importlib
from fastapi import APIRouter, Query

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/audit", tags=["audit"])


def _get_ledger():
    """Lazy import to bypass hyphenated directory name."""
    mod = importlib.import_module("services.audit-service.ledger")
    return mod.audit_ledger


@router.get("/log")
async def get_audit_log(
    limit: int = Query(default=50, ge=1, le=500),
):
    """Return the most recent audit ledger entries."""
    ledger = _get_ledger()
    return ledger.tail(n=limit)


@router.get("/verify")
async def verify_audit_chain():
    """
    Walk the entire ledger and verify every hash link.

    Returns ``{ valid: true/false, entries_checked: N, error: ... }``.
    A tampered or corrupted ledger will report the first broken link.
    """
    ledger = _get_ledger()
    return ledger.verify_chain()

"""
Integration Test — Core Services Pipeline.

Tests the complete event flow:
  Event Bus → Trajectory Engine (ST gating) → Alert Service → Evidentiary Service → Audit Ledger

Validates:
  1. Trajectory engine receives tracking events and builds global tracks
  2. Spatio-temporal gating rejects impossible camera transitions
  3. Alert service generates alerts from validated trajectory updates
  4. Audit ledger records all events with hash-chain integrity
  5. Chain verification detects no tampering
"""

import sys
import os
import asyncio
import json

# Set path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

import importlib

event_bus_mod = importlib.import_module("services.event_bus")
traj_mod = importlib.import_module("services.trajectory-engine.engine")
alert_mod = importlib.import_module("services.alert-service.service")
evid_mod = importlib.import_module("services.evidentiary-service.stitcher")
audit_mod = importlib.import_module("services.audit-service.ledger")

event_bus = event_bus_mod.event_bus
trajectory_engine = traj_mod.trajectory_engine
alert_service = alert_mod.alert_service
evidentiary_service = evid_mod.evidentiary_service
audit_ledger = audit_mod.audit_ledger

# Clean up any previous test ledger
LEDGER_FILE = audit_mod.LEDGER_FILE
if os.path.exists(LEDGER_FILE):
    os.remove(LEDGER_FILE)
    # Reset ledger state
    audit_ledger._seq = 0
    audit_ledger._prev_hash = audit_mod.GENESIS_HASH


async def run_tests():
    print("=" * 60)
    print("Core Services Integration Test")
    print("=" * 60)

    # ── Start all services ────────────────────────────────────────
    print("\n[1] Starting services...")
    await audit_ledger.start()
    await trajectory_engine.start()
    await alert_service.start()
    await evidentiary_service.start()
    await asyncio.sleep(0.5)  # Yield to event loop to allow tasks to establish event subscriptions
    print("    [OK] All services started.")

    # ── Test 1: Valid sighting on single camera ───────────────────
    print("\n[2] Publishing tracking_start event on cam-0...")
    await event_bus.publish("tracking_start", {
        "type": "tracking_start",
        "camera_id": "cam-0",
        "target_id": "target-abc123",
        "target_name": "Suspect Alpha",
        "confidence": "87%",
        "coordinates": {"x": 640, "y": 360},
        "timestamp": "2026-07-07T12:00:00Z"
    })
    await asyncio.sleep(1.0)

    track = trajectory_engine.get_track("target-abc123")
    assert track is not None, "FAIL: Track was not created for target-abc123"
    assert len(track["segments"]) >= 1, "FAIL: Track has no segments"
    print(f"    [OK] Global track created: {len(track['segments'])} segment(s)")

    # ── Test 2: Valid transition to nearby camera ─────────────────
    print("\n[3] Publishing tracking_start on cam-1 (400m away, 300s later — plausible)...")
    await event_bus.publish("tracking_start", {
        "type": "tracking_start",
        "camera_id": "cam-1",
        "target_id": "target-abc123",
        "target_name": "Suspect Alpha",
        "confidence": "82%",
        "coordinates": {"x": 500, "y": 300},
        "timestamp": "2026-07-07T12:05:00Z"
    })
    await asyncio.sleep(1.0)

    track = trajectory_engine.get_track("target-abc123")
    segment_count = len(track["segments"])
    assert segment_count >= 2, f"FAIL: Expected >=2 segments after plausible transition, got {segment_count}"
    print(f"    [OK] Plausible transition accepted: {segment_count} segment(s)")

    # ── Test 3: Impossible transition (ST gate should reject) ─────
    print("\n[4] Publishing tracking_start on cam-3 (4km away, 5s later — IMPOSSIBLE)...")
    await event_bus.publish("tracking_start", {
        "type": "tracking_start",
        "camera_id": "cam-3",
        "target_id": "target-abc123",
        "target_name": "Suspect Alpha",
        "confidence": "91%",
        "coordinates": {"x": 700, "y": 400},
        "timestamp": "2026-07-07T12:05:05Z"
    })
    await asyncio.sleep(1.0)

    track = trajectory_engine.get_track("target-abc123")
    segment_count_after = len(track["segments"])
    assert segment_count_after == segment_count, \
        f"FAIL: Impossible transition was NOT rejected! Segments: {segment_count} → {segment_count_after}"
    print(f"    [OK] Spatio-temporal gate rejected impossible transition (segments stayed at {segment_count_after})")

    # ── Test 4: Alert service generated alerts ────────────────────
    print("\n[5] Checking alert service...")
    alerts = alert_service.list_alerts()
    assert len(alerts) > 0, "FAIL: No alerts were generated"
    print(f"    [OK] {len(alerts)} alert(s) generated")

    # ── Test 5: Operator confirms first alert → triggers evidence ─
    first_alert = alerts[-1]  # oldest
    alert_id = first_alert["alert_id"]
    print(f"\n[6] Operator confirming alert {alert_id}...")
    success = await alert_service.handle_operator_action(
        alert_id=alert_id,
        action="confirm",
        operator_id="officer-01",
        notes="Visual match confirmed on live feed"
    )
    assert success, "FAIL: Operator action was not accepted"
    await asyncio.sleep(1.5)  # allow evidentiary service to process

    confirmed = alert_service.get_alert(alert_id)
    assert confirmed.status == "confirmed", f"FAIL: Alert status is '{confirmed.status}', expected 'confirmed'"
    print(f"    [OK] Alert confirmed by operator. Status: {confirmed.status}")

    # ── Test 6: Audit ledger integrity ────────────────────────────
    print("\n[7] Verifying audit ledger hash-chain integrity...")
    result = audit_ledger.verify_chain()
    print(f"    Chain valid: {result['valid']}")
    print(f"    Entries checked: {result['entries_checked']}")
    if result["error"]:
        print(f"    Error: {result['error']}")
    assert result["valid"], f"FAIL: Audit chain is broken — {result['error']}"
    assert result["entries_checked"] > 0, "FAIL: Audit ledger is empty"
    print(f"    [OK] Audit ledger integrity verified ({result['entries_checked']} entries)")

    # Print a few ledger entries
    entries = audit_ledger.tail(5)
    print(f"\n    Last {len(entries)} ledger entries:")
    for e in entries:
        print(f"      seq={e['seq']}  action={e['action']}  ref={e.get('object_ref','')}")

    # ── Test 7: Tamper detection ──────────────────────────────────
    print("\n[8] Testing tamper detection...")
    if os.path.exists(LEDGER_FILE):
        with open(LEDGER_FILE, "r") as f:
            lines = f.readlines()
        if len(lines) >= 2:
            # Corrupt line 2
            corrupted = json.loads(lines[1])
            corrupted["action"] = "TAMPERED_ACTION"
            lines[1] = json.dumps(corrupted) + "\n"
            with open(LEDGER_FILE, "w") as f:
                f.writelines(lines)

            tamper_result = audit_ledger.verify_chain()
            assert not tamper_result["valid"], "FAIL: Tampered ledger was not detected!"
            print(f"    [OK] Tamper detected at: {tamper_result['error']}")
        else:
            print("    (skipped — not enough entries to tamper)")
    else:
        print("    (skipped — ledger file not found)")

    # ── Stop all services ─────────────────────────────────────────
    print("\n[9] Stopping all services...")
    await evidentiary_service.stop()
    await alert_service.stop()
    await trajectory_engine.stop()
    await audit_ledger.stop()

    print("\n" + "=" * 60)
    print("ALL INTEGRATION TESTS PASSED")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(run_tests())

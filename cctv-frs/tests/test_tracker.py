"""Integration test for target person detection and tracking pipeline."""
import sys
import os
import asyncio
import base64
import numpy as np
import cv2

# Set path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import importlib
edge_init = importlib.import_module("services.edge-inference")
detector_mod = importlib.import_module("services.edge-inference.detector")
matcher_mod = importlib.import_module("services.recognition-service.matcher")
store_mod = importlib.import_module("services.watchlist-service.store")
enrollment_mod = importlib.import_module("services.watchlist-service.enrollment")
pipeline_mod = importlib.import_module("services.edge-inference.pipeline")


async def run_test():
    print("=" * 60)
    print("Running Tracker & Matcher Integration Test")
    print("=" * 60)

    # 1. Initialize models
    print("[TEST] Loading face models...")
    face_app = edge_init.init_face_app()
    assert face_app is not None, "Failed to load FaceAnalysis model"
    print("[TEST] Face models loaded successfully.")

    # 2. Load the generated target face image
    image_path = r"C:\Users\AYAN\Desktop\New_track\new_tracker\cctv-frs\tests\face.png"
    print(f"[TEST] Reading generated face image from: {image_path}")
    with open(image_path, "rb") as f:
        img_bytes = f.read()

    # 3. Extract embedding and enroll in watchlist
    print("[TEST] Extracting embedding and enrolling target...")
    enroll_result = enrollment_mod.extract_face_embedding(img_bytes, face_app)
    assert enroll_result["embedding"] is not None, "Failed to extract face embedding"
    
    target_name = "Suspect Alpha"
    entry = store_mod.watchlist_store.enroll(
        target_name=target_name,
        embedding=enroll_result["embedding"],
        source_image_b64=enroll_result["source_image_b64"],
        face_crop_b64=enroll_result["face_crop_b64"]
    )
    print(f"[TEST] Successfully enrolled target: {entry.target_name} ({entry.target_id})")

    # 4. Start the pipeline in mock/simulated mode
    print("[TEST] Starting EdgePipeline in virtual mock mode...")
    pipeline = pipeline_mod.pipeline
    # Start capturing
    await pipeline.start(source="virtual-cam")
    pipeline._is_mock = True  # force virtual mode
    
    print("[TEST] Let pipeline run for 3 seconds...")
    await asyncio.sleep(3.0)

    # 5. Verify tracking and events
    print("[TEST] Verifying tracking status...")
    print(f"  - Pipeline running: {pipeline.is_running}")
    print(f"  - Tracker active (is_tracking): {pipeline._is_tracking}")
    print(f"  - Current tracked bbox: {pipeline._tracked_bbox}")
    print(f"  - Current tracking lost count: {pipeline._tracking_lost_count}")
    print(f"  - Latest match state: {pipeline.latest_match is not None}")

    # Check events in the queue
    event_count = 0
    while not pipeline.event_queue.empty():
        event = pipeline.event_queue.get_nowait()
        event_count += 1
        print(f"  - Event {event_count}: type={event['type']}, target_id={event.get('target_id')}, confidence={event.get('confidence')}, coords={event.get('coordinates')}")
        assert event["type"] in ["tracking_start", "tracking_stop"], f"Unexpected event type: {event['type']}"
        pipeline.event_queue.task_done()

    # Assertions
    assert pipeline._is_tracking, "Tracker did not start tracking the enrolled target!"
    assert pipeline._tracked_bbox is not None, "Tracker does not have a bounding box!"
    assert event_count > 0, "No tracking events were put into the event queue!"
    print("[TEST] Tracking verified successfully! All assertions passed.")

    # 6. Stop pipeline
    print("[TEST] Stopping pipeline...")
    await pipeline.stop()
    print("[TEST] Test complete. Pipeline stopped.")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(run_test())

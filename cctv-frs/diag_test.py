"""Diagnostic script to test the detection and matching pipeline."""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

import cv2
import numpy as np
import importlib
import time

# Load modules
edge_init = importlib.import_module("services.edge-inference")
detector_mod = importlib.import_module("services.edge-inference.detector")
matcher_mod = importlib.import_module("services.recognition-service.matcher")
store_mod = importlib.import_module("services.watchlist-service.store")
enrollment_mod = importlib.import_module("services.watchlist-service.enrollment")

print("=" * 60)
print("CCTV FRS — Detection & Matching Diagnostic")
print("=" * 60)

# 1. Check model
face_app = edge_init.get_face_app()
if face_app is None:
    print("[INIT] Loading face model...")
    face_app = edge_init.init_face_app()

print(f"[MODEL] Face model loaded: {face_app is not None}")
print(f"[MODEL] Models available: {list(face_app.models.keys())}")
print(f"[MODEL] det_size: {face_app.det_size}")

# 2. Open camera and capture a frame
cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
if not cap.isOpened():
    cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("[CAMERA] ERROR: Cannot open camera")
    sys.exit(1)

# Let the camera warm up
for _ in range(10):
    cap.read()
    time.sleep(0.05)

ret, frame = cap.read()
cap.release()

if not ret or frame is None:
    print("[CAMERA] ERROR: Cannot read frame")
    sys.exit(1)

print(f"[CAMERA] Frame captured: {frame.shape}")

# 3. Detect faces in the captured frame
print("\n--- Face Detection on Live Frame ---")
faces_raw = face_app.get(frame)
print(f"[DETECT] Raw InsightFace faces found: {len(faces_raw)}")
for i, face in enumerate(faces_raw):
    print(f"  Face {i}: bbox={face.bbox.astype(int).tolist()}, "
          f"det_score={face.det_score:.4f}, "
          f"embedding_shape={face.normed_embedding.shape if hasattr(face, 'normed_embedding') and face.normed_embedding is not None else 'NONE'}, "
          f"embedding_norm={np.linalg.norm(face.normed_embedding):.4f if hasattr(face, 'normed_embedding') and face.normed_embedding is not None else 'NONE'}")

# 4. Check enrolled targets
watchlist = store_mod.watchlist_store.get_all_embeddings()
print(f"\n--- Watchlist ---")
print(f"[WATCHLIST] Enrolled targets: {len(watchlist)}")
for target_id, target_name, target_emb, _ in watchlist:
    emb = np.asarray(target_emb, dtype=np.float32).flatten()
    print(f"  Target '{target_name}' (id={target_id}): "
          f"embedding_shape={emb.shape}, "
          f"embedding_norm={np.linalg.norm(emb):.4f}, "
          f"first_5={emb[:5].tolist()}")

# 5. Cross-match: compare live faces against watchlist
print(f"\n--- Cross-Matching (threshold=0.30) ---")
if faces_raw and watchlist:
    for i, face in enumerate(faces_raw):
        live_emb = face.normed_embedding
        live_emb_flat = np.asarray(live_emb, dtype=np.float32).flatten()
        print(f"  Live Face {i}: first_5={live_emb_flat[:5].tolist()}, norm={np.linalg.norm(live_emb_flat):.4f}")
        for target_id, target_name, target_emb, _ in watchlist:
            target_emb_flat = np.asarray(target_emb, dtype=np.float32).flatten()
            # Raw dot product
            dot_score = float(np.dot(live_emb_flat, target_emb_flat))
            # Cosine sim via matcher
            cos_score = matcher_mod.cosine_similarity(live_emb_flat, target_emb_flat)
            print(f"    vs '{target_name}': dot={dot_score:.4f}, cosine={cos_score:.4f}")
            if cos_score >= 0.30:
                print(f"    >>> MATCH at threshold 0.30!")
            elif cos_score >= 0.20:
                print(f"    >>> Near-match at threshold 0.20")
            else:
                print(f"    >>> No match")
else:
    if not faces_raw:
        print("  [ERROR] No faces detected in live frame!")
    if not watchlist:
        print("  [ERROR] No targets enrolled in watchlist!")

# 6. Test enrollment pipeline with current frame
print(f"\n--- Enrollment Test (re-enroll from live frame) ---")
_, frame_jpg = cv2.imencode('.jpg', frame)
frame_bytes = frame_jpg.tobytes()
try:
    result = enrollment_mod.extract_face_embedding(frame_bytes, face_app)
    enroll_emb = np.asarray(result["embedding"], dtype=np.float32).flatten()
    print(f"[ENROLL] Enrollment embedding extracted: shape={enroll_emb.shape}, norm={np.linalg.norm(enroll_emb):.4f}")
    # Compare enrollment embedding against live detection embedding
    if faces_raw:
        live_emb = np.asarray(faces_raw[0].normed_embedding, dtype=np.float32).flatten()
        self_score = matcher_mod.cosine_similarity(live_emb, enroll_emb)
        print(f"[SELF-CHECK] Same-frame self-similarity: {self_score:.4f} (should be ~0.99+)")
except Exception as e:
    print(f"[ENROLL] Failed: {e}")

print("\n" + "=" * 60)
print("Diagnostic complete.")

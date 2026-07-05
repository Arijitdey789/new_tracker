"""
Matcher — Cosine similarity matching for ArcFace embeddings.

In production, this would query a distributed Vector DB with sharded ANN index
(e.g., Milvus, Qdrant, or Pinecone). For this detection-only phase, we perform
direct cosine similarity against the in-memory watchlist store.

ArcFace embeddings are L2-normalized, so cosine similarity = dot product.
"""

import numpy as np
from typing import List, Optional, Tuple
import logging

logger = logging.getLogger(__name__)


def cosine_similarity(embedding_a: np.ndarray, embedding_b: np.ndarray) -> float:
    """
    Compute cosine similarity between two L2-normalized embeddings.

    Since ArcFace embeddings are already L2-normalized,
    cosine_similarity = dot(a, b).

    Returns:
        Similarity score in range [-1, 1]. Higher = more similar.
        Typical match threshold for ArcFace: 0.40 - 0.55
    """
    a = np.asarray(embedding_a, dtype=np.float32).flatten()
    b = np.asarray(embedding_b, dtype=np.float32).flatten()

    if a.shape != b.shape:
        logger.warning(f"Embedding dimension mismatch: {a.shape} vs {b.shape}")
        return 0.0

    # For normalized vectors: cosine_sim = dot product
    similarity = float(np.dot(a, b))

    # Clamp to [-1, 1] for numerical safety
    return max(-1.0, min(1.0, similarity))


def find_best_match(
    query_embedding: np.ndarray,
    watchlist_entries: List[Tuple[str, str, np.ndarray, Optional[str]]],
    threshold: float = 0.45,
) -> Optional[dict]:
    """
    Find the best matching target in the watchlist for a query embedding.

    Args:
        query_embedding: 512-d face embedding from the live feed.
        watchlist_entries: List of (target_id, target_name, embedding, face_crop_b64).
        threshold: Minimum cosine similarity to consider a match.

    Returns:
        Match dict if found, None otherwise.
        Non-matches produce no output (per requirements).
    """
    if not watchlist_entries:
        return None

    best_match = None
    best_score = -1.0

    for target_id, target_name, target_embedding, face_crop_b64 in watchlist_entries:
        score = cosine_similarity(query_embedding, target_embedding)

        if score >= threshold and score > best_score:
            best_score = score
            best_match = {
                "target_id": target_id,
                "target_name": target_name,
                "confidence": score,
                "threshold": threshold,
                "is_match": True,
                "target_image_b64": face_crop_b64,
            }

    return best_match

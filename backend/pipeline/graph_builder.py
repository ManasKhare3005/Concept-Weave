import numpy as np
from itertools import combinations
from sklearn.cluster import KMeans

# Higher threshold = fewer but more meaningful edges
SIMILARITY_THRESHOLD = 0.50
MAX_EDGES_PER_NODE = 3


def build_edges(concepts: list[dict], embeddings: list[list]) -> list[dict]:
    """
    Compare every pair of concept embeddings.
    Keep only edges above threshold, limited to top N per node.
    """
    emb = np.array(embeddings)
    n = len(emb)

    # Collect all candidate edges above threshold
    candidates = []
    for i, j in combinations(range(n), 2):
        sim = float(np.dot(emb[i], emb[j]))
        if sim >= SIMILARITY_THRESHOLD:
            candidates.append({
                "source_idx": i,
                "target_idx": j,
                "weight": round(sim, 4),
                "relation_type": _classify_relation(sim),
            })

    # Sort by weight descending, then greedily pick top edges per node
    candidates.sort(key=lambda e: e["weight"], reverse=True)
    edge_count = [0] * n
    edges = []

    for edge in candidates:
        si, ti = edge["source_idx"], edge["target_idx"]
        if edge_count[si] < MAX_EDGES_PER_NODE and edge_count[ti] < MAX_EDGES_PER_NODE:
            edges.append(edge)
            edge_count[si] += 1
            edge_count[ti] += 1

    return edges


def _classify_relation(sim: float) -> str:
    if sim >= 0.80:
        return "strongly_related"
    elif sim >= 0.60:
        return "related"
    else:
        return "weakly_related"


def assign_clusters(embeddings: list[list]) -> list[str]:
    """
    K-Means clustering to group related concepts by topic.
    Returns a cluster ID string for each concept.
    """
    n = len(embeddings)
    if n < 3:
        return ["0"] * n

    k = max(2, min(8, n // 5))
    km = KMeans(n_clusters=k, random_state=42, n_init=10)
    labels = km.fit_predict(np.array(embeddings))
    return [str(label) for label in labels]

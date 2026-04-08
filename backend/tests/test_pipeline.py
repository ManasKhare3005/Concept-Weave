import numpy as np

from pipeline.graph_builder import MAX_EDGES_PER_NODE, assign_clusters, build_edges
from pipeline.nlp import _parse_json_array


def _normalize(values: list[float]) -> list[float]:
    arr = np.array(values, dtype=float)
    arr /= np.linalg.norm(arr)
    return arr.tolist()


def test_parse_json_array_accepts_wrapped_response():
    raw = 'Some intro text\n[{"label":"Common Criteria"}]\nSome trailing text'
    parsed = _parse_json_array(raw)
    assert parsed == [{"label": "Common Criteria"}]


def test_build_edges_respects_per_node_limits():
    concepts = [{"label": f"Concept {i}", "excerpts": []} for i in range(5)]
    embeddings = [_normalize([1.0, 0.0]) for _ in concepts]
    edges = build_edges(concepts, embeddings)

    counts = [0] * len(concepts)
    for edge in edges:
        counts[edge["source_idx"]] += 1
        counts[edge["target_idx"]] += 1

    assert all(count <= MAX_EDGES_PER_NODE for count in counts)


def test_assign_clusters_returns_single_cluster_for_small_input():
    embeddings = [_normalize([1.0, 0.0]), _normalize([0.0, 1.0])]
    clusters = assign_clusters(embeddings)
    assert clusters == ["0", "0"]


def test_assign_clusters_returns_one_label_per_embedding():
    embeddings = [_normalize([float(i + 1), float((i % 3) + 1)]) for i in range(10)]
    clusters = assign_clusters(embeddings)
    assert len(clusters) == len(embeddings)

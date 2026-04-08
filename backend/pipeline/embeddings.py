from sentence_transformers import SentenceTransformer

_model = None


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        # Lightweight 384-dim model that runs well on CPU.
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def embed_concepts(concepts: list[dict]) -> list[list[float]]:
    """
    Generate normalized embeddings for each concept.
    Uses label + first 3 excerpts as the text to embed.
    """
    texts = [f"{c['label']}: {' '.join(c['excerpts'][:3])}" for c in concepts]
    embeddings = _get_model().encode(texts, normalize_embeddings=True, show_progress_bar=False)
    return embeddings.tolist()


def embed_query(query: str) -> list[float]:
    """Embed a single query string."""
    emb = _get_model().encode([query], normalize_embeddings=True, show_progress_bar=False)
    return emb[0].tolist()

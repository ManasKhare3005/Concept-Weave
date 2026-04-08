import json
import re
import os
import logging
import openai

logger = logging.getLogger(__name__)

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = openai.OpenAI(
            api_key=os.getenv("GROQ_API_KEY"),
            base_url="https://api.groq.com/openai/v1",
        )
    return _client


def _chunk_text(text: str, max_chars: int = 4000) -> list[str]:
    """Split text into chunks at sentence boundaries."""
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks, chunk = [], ""
    for s in sentences:
        if len(chunk) + len(s) > max_chars and chunk:
            chunks.append(chunk.strip())
            chunk = s + " "
        else:
            chunk += s + " "
    if chunk.strip():
        chunks.append(chunk.strip())
    return chunks


def _parse_json_array(raw: str) -> list:
    """Robustly parse a JSON array from LLM output."""
    match = re.search(r'\[.*\]', raw, re.DOTALL)
    text = match.group() if match else raw
    return json.loads(text)


def extract_concepts(text: str) -> list[dict]:
    """
    Two-step LLM extraction:
    1. Send the full document (chunked if needed) to identify topics.
    2. Return the most important concepts (10-18).
    """
    if len(text) <= 6000:
        return _extract_major_topics(text)

    chunks = _chunk_text(text, max_chars=4000)
    raw_concepts = []

    for i, chunk in enumerate(chunks):
        try:
            logger.info(f"Extracting from chunk {i+1}/{len(chunks)}")
            concepts = _extract_from_chunk(chunk)
            raw_concepts.extend(concepts)
        except Exception as e:
            logger.warning(f"Chunk {i+1} failed: {e}")
            continue

    if not raw_concepts:
        logger.error("No concepts extracted, using fallback")
        return _fallback_extract(text)

    return _consolidate(raw_concepts, text)


def _extract_major_topics(text: str) -> list[dict]:
    """Single-shot extraction for shorter documents."""
    prompt = (
        "You are building a knowledge graph from a lecture/document. "
        "Extract 10-18 key concepts that a student MUST know.\n\n"
        "CRITICAL RULES:\n"
        "- Use PRECISE, SPECIFIC labels — include official names, acronyms, and standard numbers\n"
        "  GOOD: 'Common Criteria (ISO 15408)', 'TCSEC (Orange Book)', 'SSE-CMM / ISO 21827'\n"
        "  BAD: 'Security Standards', 'Evaluation Framework', 'System Security'\n"
        "- Do NOT over-generalize. If the document discusses TCSEC, ITSEC, and Common Criteria separately, "
        "they should be SEPARATE concepts, not merged into one\n"
        "- Keep distinct frameworks, models, standards, and roles as their own concepts\n"
        "- Include specific roles/personnel by their actual titles (e.g., 'ISSO' not 'Information Security')\n"
        "- Include specific standards with their numbers (e.g., 'ISO 15408' not 'international standard')\n"
        "- Skip generic filler topics — every concept should have real substance\n"
        "- IGNORE course codes, slide numbers, professor names, page numbers\n"
        "- entity_type: CONCEPT, FRAMEWORK, STANDARD, ROLE, PROCESS, or TECHNIQUE\n"
        "- excerpt: One key sentence from the text that captures the essential detail\n\n"
        "Return ONLY a JSON array:\n"
        '[{"label": "...", "entity_type": "...", "excerpt": "..."}]\n\n'
        f"Document:\n{text[:6000]}\n\nJSON:"
    )

    msg = _get_client().chat.completions.create(
        model="llama-3.3-70b-versatile",
        max_tokens=2000,
        temperature=0.1,
        messages=[{"role": "user", "content": prompt}],
    )

    parsed = _parse_json_array(msg.choices[0].message.content.strip())
    return _normalize(parsed)


def _extract_from_chunk(chunk: str) -> list[dict]:
    """Extract candidate concepts from a single chunk."""
    prompt = (
        "Extract key concepts from this text for a knowledge graph.\n"
        "Use PRECISE labels with official names and acronyms (e.g., 'TCSEC (Orange Book)' not 'Trusted Systems').\n"
        "Keep distinct items separate — don't merge different frameworks/standards.\n"
        "IGNORE course codes, professor names, slide numbers, metadata.\n"
        "Return 4-10 concepts as a JSON array.\n\n"
        '[{"label": "...", "entity_type": "CONCEPT", "excerpt": "..."}]\n\n'
        f"Text:\n{chunk}\n\nJSON:"
    )

    msg = _get_client().chat.completions.create(
        model="llama-3.3-70b-versatile",
        max_tokens=1000,
        temperature=0.1,
        messages=[{"role": "user", "content": prompt}],
    )

    parsed = _parse_json_array(msg.choices[0].message.content.strip())
    return _normalize(parsed)


def _consolidate(raw_concepts: list[dict], text: str) -> list[dict]:
    """Take all extracted concepts and consolidate into 10-18 major topics."""
    labels = [c["label"] for c in raw_concepts]
    label_list = "\n".join(f"- {l}" for l in labels)

    prompt = (
        "A document was analyzed and these candidate concepts were extracted:\n"
        f"{label_list}\n\n"
        "Consolidate into 10-18 key concepts for a knowledge graph.\n\n"
        "Rules:\n"
        "- Only merge concepts that are truly the SAME thing (duplicates/rewordings)\n"
        "- Do NOT merge different frameworks, standards, or models together\n"
        "  e.g., TCSEC and ITSEC are DIFFERENT and should stay separate\n"
        "- Keep precise labels with acronyms and standard numbers\n"
        "- Drop generic filler and minor details\n"
        "- Keep everything a student would need to know for an exam\n"
        "- For each concept, provide a clean label and one key excerpt from the document\n\n"
        "Return ONLY a JSON array:\n"
        '[{"label": "...", "entity_type": "CONCEPT", "excerpt": "one key sentence from the document"}]\n\n'
        f"Original document (for excerpts):\n{text[:4000]}\n\nJSON:"
    )

    try:
        msg = _get_client().chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=2000,
            temperature=0.1,
            messages=[{"role": "user", "content": prompt}],
        )

        parsed = _parse_json_array(msg.choices[0].message.content.strip())
        result = _normalize(parsed)
        if result:
            return result
    except Exception as e:
        logger.warning(f"Consolidation failed: {e}")

    # Fallback: deduplicate and take top 15
    seen = set()
    deduped = []
    for c in raw_concepts:
        key = c["label"].lower()
        if key not in seen:
            seen.add(key)
            deduped.append(c)
    return deduped[:15]


def _normalize(parsed: list) -> list[dict]:
    """Normalize LLM output into standard concept format."""
    results = []
    for item in parsed:
        if not isinstance(item, dict) or "label" not in item:
            continue
        label = item["label"].strip()
        if len(label) < 3:
            continue
        excerpt = (item.get("excerpt") or "").strip()
        results.append({
            "label": label,
            "entity_type": item.get("entity_type", "CONCEPT"),
            "excerpts": [excerpt] if excerpt else [],
        })
    return results[:18]


def _fallback_extract(text: str) -> list[dict]:
    """Basic regex fallback if LLM extraction fails entirely."""
    pattern = r'(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)'
    matches = re.findall(pattern, text)
    sentences = re.split(r'(?<=[.!?])\s+', text)

    concept_map = {}
    for match in matches:
        key = match.lower()
        if len(key) < 5 or key in concept_map:
            continue
        excerpts = [s.strip() for s in sentences if match in s][:3]
        if excerpts:
            concept_map[key] = {
                "label": match,
                "entity_type": "CONCEPT",
                "excerpts": excerpts,
            }

    result = list(concept_map.values())
    result.sort(key=lambda c: len(c["excerpts"]), reverse=True)
    return result[:15]

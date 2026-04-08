import json
import logging
import os
import re

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


def _extract_json_object(raw: str) -> dict:
    fence_match = re.search(r"```(?:json)?\s*({.*?})\s*```", raw, re.DOTALL)
    if fence_match:
        return json.loads(fence_match.group(1))

    object_match = re.search(r"{.*}", raw, re.DOTALL)
    if object_match:
        return json.loads(object_match.group(0))

    return json.loads(raw)


def _fallback_summary(excerpts: list[str]) -> str:
    if excerpts:
        return "\n".join(f"- {line}" for line in excerpts[:3])
    return "- No summary available."


def _fallback_details(label: str, excerpts: list[str], summary: str) -> str:
    quoted = excerpts[:2]
    quoted_text = "\n".join(f"- {line}" for line in quoted) if quoted else "- No excerpts available."
    return (
        f"## Core Idea\n{label} appears as an important concept in this document.\n\n"
        f"## What to Remember\n{summary.replace(chr(10), ' ')}\n\n"
        f"## Evidence from Source\n{quoted_text}"
    )


def summarize_concept(label: str, excerpts: list[str]) -> tuple[str, str]:
    """
    Generate two layers of concept text:
    1) concise card summary bullets
    2) richer sidebar markdown details
    """
    try:
        context = "\n".join(f"- {e}" for e in excerpts[:6])
        msg = _get_client().chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=700,
            temperature=0.2,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Concept: {label}\n"
                        f"Excerpts:\n{context}\n\n"
                        "Return ONLY valid JSON with this shape:\n"
                        "{\n"
                        '  "card_summary_bullets": ["bullet 1", "bullet 2", "bullet 3"],\n'
                        '  "detail_markdown": "## Core Idea\\n...\\n\\n## How It Works\\n...\\n\\n## Why It Matters\\n...\\n\\n## Caveats\\n..."\n'
                        "}\n\n"
                        "Rules:\n"
                        "- card_summary_bullets: 3-5 bullets, each under 20 words.\n"
                        "- Be specific: include terms, standards, names, years, acronyms when present.\n"
                        "- detail_markdown: concise but richer than bullets, with the exact 4 headings shown above.\n"
                        "- Keep details factual and grounded only in the excerpts.\n"
                        "- If evidence is weak, say uncertainty explicitly.\n"
                        "- Do not include code fences or extra text outside JSON."
                    ),
                }
            ],
        )

        payload = _extract_json_object(msg.choices[0].message.content.strip())
        bullets = payload.get("card_summary_bullets") or []
        if isinstance(bullets, list):
            clean_bullets = [str(b).strip() for b in bullets if str(b).strip()]
        else:
            clean_bullets = []

        summary = "\n".join(f"- {line}" for line in clean_bullets[:5]).strip()
        if not summary:
            summary = _fallback_summary(excerpts)

        details = str(payload.get("detail_markdown") or "").strip()
        if not details:
            details = _fallback_details(label, excerpts, summary)

        return summary, details
    except Exception:
        logger.exception("Failed to summarize concept %s", label)
        summary = _fallback_summary(excerpts)
        details = _fallback_details(label, excerpts, summary)
        return summary, details


def answer_graph_query(query: str, graph_context: str) -> str:
    """Answer a user question using the knowledge graph context."""
    try:
        msg = _get_client().chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=400,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a knowledge graph assistant. Answer questions about concepts "
                        "and their relationships based on the graph context provided. "
                        "Be concise, specific, and reference concepts by name."
                    ),
                },
                {
                    "role": "user",
                    "content": f"Graph context:\n{graph_context}\n\nQuestion: {query}",
                },
            ],
        )
        return msg.choices[0].message.content.strip()
    except Exception:
        logger.exception("Failed to answer graph query")
        return "I could not generate an answer right now. Please try again in a moment."

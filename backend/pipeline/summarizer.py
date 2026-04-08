import logging
import os

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


def summarize_concept(label: str, excerpts: list[str]) -> str:
    """Generate a rich, specific summary for a concept node."""
    try:
        context = "\n".join(f"- {e}" for e in excerpts[:6])
        msg = _get_client().chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=350,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Summarize '{label}' based on these excerpts:\n"
                        f"{context}\n\n"
                        "Rules:\n"
                        "- Write 3-5 bullet points, each on its own line starting with '- '\n"
                        "- Be specific and include names, dates, acronyms, and standard numbers\n"
                        "- Include key distinctions, limitations, and why it matters\n"
                        "- Highlight the most important term in each bullet with **bold**\n"
                        "- Ignore course codes, slide numbers, and professor names\n"
                        "- Keep each bullet under 20 words\n"
                        "- Return only the bullets\n\n"
                        "Example for 'TCSEC (Orange Book)':\n"
                        "- **TCSEC** published in 1983 by DoD, first formal security evaluation standard\n"
                        "- Focuses on **confidentiality** and not integrity or availability\n"
                        "- Designed for **U.S. government** and military systems"
                    ),
                }
            ],
        )
        return msg.choices[0].message.content.strip()
    except Exception:
        logger.exception("Failed to summarize concept %s", label)
        return excerpts[0] if excerpts else label


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

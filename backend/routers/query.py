import asyncio
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from pipeline.embeddings import embed_query
from pipeline.summarizer import answer_graph_query

router = APIRouter(prefix="/api/query", tags=["query"])


class QueryRequest(BaseModel):
    document_id: UUID
    question: str

    @field_validator("question")
    @classmethod
    def validate_question(cls, value: str) -> str:
        question = value.strip()
        if not question:
            raise ValueError("Question cannot be empty.")
        return question


@router.post("/")
async def query_graph(req: QueryRequest, db: AsyncSession = Depends(get_db)):
    q_emb = await asyncio.to_thread(embed_query, req.question)

    result = await db.execute(
        text(
            """
            SELECT id, label, summary, excerpts, entity_type,
                   1 - (embedding <=> CAST(:q_emb AS vector)) AS similarity
            FROM concepts
            WHERE document_id = CAST(:doc_id AS uuid)
            ORDER BY similarity DESC
            LIMIT 6
            """
        ),
        {"q_emb": str(q_emb), "doc_id": str(req.document_id)},
    )
    rows = result.fetchall()

    if not rows:
        raise HTTPException(status_code=404, detail="No concepts found for this document.")

    context_parts = []
    for row in rows:
        excerpts = (row.excerpts or [])[:2]
        context_parts.append(
            f"Concept: {row.label} ({row.entity_type})\n"
            f"Summary: {row.summary or 'No summary available.'}\n"
            f"Excerpts: {'; '.join(excerpts)}"
        )

    graph_context = "\n\n".join(context_parts)
    answer = await asyncio.to_thread(answer_graph_query, req.question, graph_context)

    return {
        "answer": answer,
        "relevant_nodes": [str(row.id) for row in rows],
        "top_concepts": [row.label for row in rows[:3]],
    }

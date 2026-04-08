import asyncio
import json
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Concept, Edge
from pipeline.summarizer import summarize_concept

router = APIRouter(prefix="/api/graph", tags=["graph"])


@router.get("/{doc_id}")
async def get_graph(doc_id: str, db: AsyncSession = Depends(get_db)):
    try:
        uid = uuid.UUID(doc_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid document ID") from exc

    concepts = (await db.execute(select(Concept).where(Concept.document_id == uid))).scalars().all()
    edges = (await db.execute(select(Edge).where(Edge.document_id == uid))).scalars().all()

    if not concepts:
        raise HTTPException(status_code=404, detail="No graph data found. Document may still be processing.")

    nodes = [
        {
            "id": str(c.id),
            "label": c.label,
            "entity_type": c.entity_type,
            "summary": c.summary,
            "details": c.details,
            "excerpts": c.excerpts or [],
            "cluster": c.cluster_id,
        }
        for c in concepts
    ]

    links = [
        {
            "source": str(e.source_id),
            "target": str(e.target_id),
            "weight": e.weight,
            "type": e.relation_type,
        }
        for e in edges
    ]

    return {"nodes": nodes, "links": links}


@router.post("/concepts/{concept_id}/details")
async def generate_concept_details(concept_id: str, db: AsyncSession = Depends(get_db)):
    try:
        concept_uuid = uuid.UUID(concept_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid concept ID") from exc

    concept = await db.get(Concept, concept_uuid)
    if not concept:
        raise HTTPException(status_code=404, detail="Concept not found")

    if concept.details and concept.summary:
        return {"id": str(concept.id), "summary": concept.summary, "details": concept.details}

    summary, details = await asyncio.to_thread(
        summarize_concept, concept.label, concept.excerpts or []
    )
    concept.summary = concept.summary or summary
    concept.details = details
    await db.commit()
    await db.refresh(concept)

    return {"id": str(concept.id), "summary": concept.summary, "details": concept.details}


@router.get("/{doc_id}/export")
async def export_graph(doc_id: str, db: AsyncSession = Depends(get_db)):
    graph = await get_graph(doc_id, db)
    content = json.dumps(graph, indent=2)
    return JSONResponse(
        content=graph,
        headers={"Content-Disposition": f"attachment; filename=graph-{doc_id[:8]}.json"},
    )

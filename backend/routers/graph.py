from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid
import json

from database import get_db
from models import Concept, Edge

router = APIRouter(prefix="/api/graph", tags=["graph"])


@router.get("/{doc_id}")
async def get_graph(doc_id: str, db: AsyncSession = Depends(get_db)):
    try:
        uid = uuid.UUID(doc_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid document ID")

    concepts = (await db.execute(
        select(Concept).where(Concept.document_id == uid)
    )).scalars().all()

    edges = (await db.execute(
        select(Edge).where(Edge.document_id == uid)
    )).scalars().all()

    if not concepts:
        raise HTTPException(status_code=404, detail="No graph data found. Document may still be processing.")

    nodes = [{
        "id": str(c.id),
        "label": c.label,
        "entity_type": c.entity_type,
        "summary": c.summary,
        "excerpts": c.excerpts or [],
        "cluster": c.cluster_id,
    } for c in concepts]

    links = [{
        "source": str(e.source_id),
        "target": str(e.target_id),
        "weight": e.weight,
        "type": e.relation_type,
    } for e in edges]

    return {"nodes": nodes, "links": links}


@router.get("/{doc_id}/export")
async def export_graph(doc_id: str, db: AsyncSession = Depends(get_db)):
    graph = await get_graph(doc_id, db)
    content = json.dumps(graph, indent=2)
    return JSONResponse(
        content=graph,
        headers={"Content-Disposition": f"attachment; filename=graph-{doc_id[:8]}.json"}
    )

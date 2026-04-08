import asyncio
import logging
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal, get_db
from models import Concept, Document, Edge
from pipeline.embeddings import embed_concepts
from pipeline.extractor import extract_text
from pipeline.graph_builder import assign_clusters, build_edges
from pipeline.nlp import extract_concepts
from pipeline.summarizer import summarize_concept

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/documents", tags=["documents"])


async def process_document(doc_id: str, text: str):
    """Background task: run full NLP pipeline and populate graph tables."""
    async with AsyncSessionLocal() as db:
        try:
            doc_uuid = uuid.UUID(doc_id)
            logger.info("Starting pipeline for document %s", doc_id)

            raw_concepts = await asyncio.to_thread(extract_concepts, text)
            logger.info("Extracted %s concepts", len(raw_concepts))

            if not raw_concepts:
                doc = await db.get(Document, doc_uuid)
                if doc:
                    doc.status = "error"
                    await db.commit()
                return

            embeddings = await asyncio.to_thread(embed_concepts, raw_concepts)
            cluster_ids = await asyncio.to_thread(assign_clusters, embeddings)

            concepts_db: list[Concept] = []
            for concept, emb, cluster in zip(raw_concepts, embeddings, cluster_ids):
                summary = await asyncio.to_thread(summarize_concept, concept["label"], concept["excerpts"])
                c = Concept(
                    document_id=doc_uuid,
                    label=concept["label"],
                    entity_type=concept["entity_type"],
                    summary=summary,
                    excerpts=concept["excerpts"],
                    cluster_id=cluster,
                    embedding=emb,
                )
                db.add(c)
                concepts_db.append(c)

            await db.flush()

            raw_edges = await asyncio.to_thread(build_edges, raw_concepts, embeddings)
            logger.info("Built %s edges", len(raw_edges))

            for edge in raw_edges:
                e = Edge(
                    document_id=doc_uuid,
                    source_id=concepts_db[edge["source_idx"]].id,
                    target_id=concepts_db[edge["target_idx"]].id,
                    weight=edge["weight"],
                    relation_type=edge["relation_type"],
                )
                db.add(e)

            doc = await db.get(Document, doc_uuid)
            if doc:
                doc.status = "ready"
            await db.commit()
            logger.info("Document %s ready", doc_id)

        except Exception:
            await db.rollback()
            logger.exception("Pipeline error for %s", doc_id)
            try:
                doc = await db.get(Document, uuid.UUID(doc_id))
                if doc:
                    doc.status = "error"
                    await db.commit()
            except Exception:
                logger.exception("Could not mark document %s as error", doc_id)


@router.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    file_bytes = await file.read()

    try:
        text = extract_text(file_bytes, file.filename)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if len(text.strip()) < 100:
        raise HTTPException(status_code=400, detail="Document too short to analyze.")

    doc = Document(filename=file.filename, content=text, status="processing")
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    background_tasks.add_task(process_document, str(doc.id), text)
    return {"document_id": str(doc.id), "status": "processing", "filename": file.filename}


@router.get("/{doc_id}/status")
async def get_status(doc_id: str, db: AsyncSession = Depends(get_db)):
    try:
        doc = await db.get(Document, uuid.UUID(doc_id))
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid document ID") from exc

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    return {"status": doc.status, "filename": doc.filename}


@router.get("/")
async def list_documents(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Document).order_by(Document.created_at.desc()))
    docs = result.scalars().all()
    return [{"id": str(d.id), "filename": d.filename, "status": d.status} for d in docs]

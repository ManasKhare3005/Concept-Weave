from dataclasses import dataclass

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

import routers.documents as documents_router
import routers.query as query_router


@dataclass
class DummyDocument:
    status: str = "processing"
    filename: str = "dummy.txt"


class DummyResult:
    def __init__(self, rows):
        self._rows = rows

    def fetchall(self):
        return self._rows


class DummyDB:
    def __init__(self, document=None, rows=None):
        self.document = document
        self.rows = rows or []

    async def get(self, *_args, **_kwargs):
        return self.document

    async def execute(self, *_args, **_kwargs):
        return DummyResult(self.rows)

    async def commit(self):
        return None

    async def refresh(self, *_args, **_kwargs):
        return None

    async def flush(self):
        return None

    def add(self, *_args, **_kwargs):
        return None


def _build_documents_app(db: DummyDB) -> FastAPI:
    app = FastAPI()
    app.include_router(documents_router.router)

    async def override_get_db():
        yield db

    app.dependency_overrides[documents_router.get_db] = override_get_db
    return app


def _build_query_app(db: DummyDB) -> FastAPI:
    app = FastAPI()
    app.include_router(query_router.router)

    async def override_get_db():
        yield db

    app.dependency_overrides[query_router.get_db] = override_get_db
    return app


@pytest.mark.asyncio
async def test_status_invalid_uuid_returns_400():
    app = _build_documents_app(DummyDB())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/documents/not-a-uuid/status")

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid document ID"


@pytest.mark.asyncio
async def test_upload_short_document_returns_400(monkeypatch):
    monkeypatch.setattr(documents_router, "extract_text", lambda *_args, **_kwargs: "short")
    app = _build_documents_app(DummyDB())

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/documents/upload",
            files={"file": ("notes.txt", b"hello", "text/plain")},
        )

    assert response.status_code == 400
    assert response.json()["detail"] == "Document too short to analyze."


@pytest.mark.asyncio
async def test_query_invalid_document_id_returns_422():
    app = _build_query_app(DummyDB())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/query/",
            json={"document_id": "not-a-uuid", "question": "What is this about?"},
        )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_query_blank_question_returns_422():
    app = _build_query_app(DummyDB())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/query/",
            json={"document_id": "c4d53fd8-64f0-462d-8d5f-c2eb76a7f6e3", "question": "   "},
        )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_query_returns_404_when_no_concepts(monkeypatch):
    monkeypatch.setattr(query_router, "embed_query", lambda _question: [0.1, 0.2, 0.3])
    app = _build_query_app(DummyDB(rows=[]))

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/query/",
            json={"document_id": "c4d53fd8-64f0-462d-8d5f-c2eb76a7f6e3", "question": "Main topics?"},
        )

    assert response.status_code == 404
    assert response.json()["detail"] == "No concepts found for this document."

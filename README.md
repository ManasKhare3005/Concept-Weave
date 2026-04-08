# AI Knowledge Graph Builder

Upload documents (PDF, TXT, MD) and generate an interactive knowledge graph with AI.

## Quick Start

### Prerequisites
- Docker Desktop
- A Groq API key

### 1. Configure environment

From project root:

```bash
cp .env.example .env
```

Set `GROQ_API_KEY` in `.env`.

For frontend-only local dev config:

```bash
cp frontend/.env.example frontend/.env
```

### 2. Start services (development mode)

```bash
docker-compose up --build
```

Services:
- Frontend: http://localhost:5173
- Backend docs: http://localhost:8000/docs

## Dev vs Prod container behavior

- `backend/start.sh` uses `APP_ENV=development` to run `uvicorn --reload`.
- Otherwise backend runs without reload (production-style).
- `frontend/start.sh` uses `NODE_ENV=development` for Vite dev server.
- Otherwise frontend runs `vite build` + `vite preview`.

## How it works

1. Upload document
2. Extract text (PDF/TXT/MD)
3. Extract concepts with LLM
4. Embed concepts with `all-MiniLM-L6-v2`
5. Cluster nodes (K-Means)
6. Build semantic edges
7. Summarize nodes and answer graph queries with LLM context

## API endpoints

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/documents/upload` | Upload a document |
| GET | `/api/documents/{id}/status` | Processing status |
| GET | `/api/documents/` | List uploaded documents |
| GET | `/api/graph/{id}` | Fetch graph nodes + edges |
| GET | `/api/graph/{id}/export` | Export graph JSON |
| POST | `/api/query/` | Query graph in natural language |

## Environment variables

Root `.env`:
- `GROQ_API_KEY`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `CORS_ORIGINS` (comma-separated)

Frontend `.env`:
- `VITE_API_BASE_URL` (default `/api`)
- `VITE_API_PROXY_TARGET` (default `http://localhost:8000`)

## Testing

Backend tests live in `backend/tests`.

```bash
cd backend
pip install -r requirements-dev.txt
pytest
```

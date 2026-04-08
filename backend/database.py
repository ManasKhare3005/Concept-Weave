import os

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import declarative_base, sessionmaker


def _build_default_database_url() -> str:
    user = os.getenv("POSTGRES_USER", "user")
    password = os.getenv("POSTGRES_PASSWORD", "pass")
    db_name = os.getenv("POSTGRES_DB", "knowledgegraph")
    host = os.getenv("POSTGRES_HOST", "localhost")
    return f"postgresql+asyncpg://{user}:{password}@{host}/{db_name}"


DATABASE_URL = os.getenv("DATABASE_URL", _build_default_database_url())

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_concepts_document_id ON concepts (document_id)"
        ))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_edges_document_id ON edges (document_id)"
        ))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_concepts_embedding_ivfflat "
            "ON concepts USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
        ))
        await conn.execute(text(
            "ALTER TABLE concepts ADD COLUMN IF NOT EXISTS details TEXT"
        ))

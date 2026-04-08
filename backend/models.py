from sqlalchemy import Column, String, Text, JSON, Float, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from pgvector.sqlalchemy import Vector
from database import Base
import uuid
import datetime


class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename = Column(String(255))
    content = Column(Text)
    status = Column(String(50), default="processing")  # processing | ready | error
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class Concept(Base):
    __tablename__ = "concepts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"))
    label = Column(String(255), index=True)
    entity_type = Column(String(100))    # PERSON, ORG, CONCEPT, TOPIC ...
    summary = Column(Text)
    details = Column(Text)
    excerpts = Column(JSON)              # list of source sentences
    cluster_id = Column(String(50))
    embedding = Column(Vector(384))      # all-MiniLM-L6-v2 dim


class Edge(Base):
    __tablename__ = "edges"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"))
    source_id = Column(UUID(as_uuid=True), ForeignKey("concepts.id"))
    target_id = Column(UUID(as_uuid=True), ForeignKey("concepts.id"))
    weight = Column(Float)
    relation_type = Column(String(100))  # co-occurrence | semantic | contextual

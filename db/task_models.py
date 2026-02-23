"""
Zaytri — Task Execution State Machine
Tracks every orchestrated workflow invocation through its lifecycle.
"""

import uuid
import enum
from datetime import datetime
from sqlalchemy import (
    Column, String, Text, DateTime, Enum as SAEnum, JSON,
    ForeignKey,
)
from sqlalchemy.dialects.postgresql import UUID
from db.database import Base


class TaskState(str, enum.Enum):
    CREATED = "created"
    PLANNED = "planned"
    EXECUTING = "executing"
    WAITING_APPROVAL = "waiting_approval"
    PUBLISHED = "published"
    FAILED = "failed"


class TaskExecution(Base):
    """
    Persistent record of every orchestrated task.
    Tracks state transitions from CREATED → PUBLISHED/FAILED.
    """
    __tablename__ = "task_executions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    brand_id = Column(UUID(as_uuid=True), ForeignKey("brand_settings.id"), nullable=True, index=True)

    # What was requested
    intent = Column(String(100), nullable=False)
    params_json = Column(JSON, nullable=True)

    # Current state
    state = Column(SAEnum(TaskState), default=TaskState.CREATED, nullable=False, index=True)

    # Execution plan (list of agent steps)
    plan_json = Column(JSON, nullable=True)

    # Result / error
    result_json = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)

    # Idempotency key for Celery dedup
    idempotency_key = Column(String(255), nullable=True, unique=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    planned_at = Column(DateTime, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

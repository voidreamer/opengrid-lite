"""Data models for ShotGrid Lite."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional


class Status(str, Enum):
    """Standard status values."""
    WAITING = "waiting"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    APPROVED = "approved"
    COMPLETE = "complete"
    ON_HOLD = "on_hold"


class AssetType(str, Enum):
    """Standard asset types."""
    CHARACTER = "character"
    PROP = "prop"
    ENVIRONMENT = "environment"
    VEHICLE = "vehicle"
    FX = "fx"
    OTHER = "other"


@dataclass
class Project:
    """A production project."""
    id: int
    name: str
    code: str
    status: str = "active"
    description: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    metadata: dict[str, Any] = field(default_factory=dict)
    
    def __str__(self) -> str:
        return f"Project({self.code})"


@dataclass
class Asset:
    """A production asset."""
    id: int
    project_id: int
    name: str
    asset_type: str
    status: str = "waiting"
    description: Optional[str] = None
    thumbnail: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    metadata: dict[str, Any] = field(default_factory=dict)
    
    # Relationships (populated when queried)
    project: Optional[Project] = None
    tasks: list[Task] = field(default_factory=list)
    
    def __str__(self) -> str:
        return f"Asset({self.name})"


@dataclass
class Shot:
    """A shot in a sequence."""
    id: int
    project_id: int
    sequence: str
    name: str
    frame_start: int = 1001
    frame_end: int = 1100
    status: str = "waiting"
    description: Optional[str] = None
    thumbnail: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    metadata: dict[str, Any] = field(default_factory=dict)
    
    # Relationships
    project: Optional[Project] = None
    tasks: list[Task] = field(default_factory=list)
    
    @property
    def duration(self) -> int:
        """Frame count."""
        return self.frame_end - self.frame_start + 1
    
    def __str__(self) -> str:
        return f"Shot({self.name})"


@dataclass
class Task:
    """A task on an asset or shot."""
    id: int
    entity_type: str  # "asset" or "shot"
    entity_id: int
    name: str
    status: str = "waiting"
    assignee: Optional[str] = None
    due_date: Optional[datetime] = None
    priority: int = 50  # 0-100
    created_at: datetime = field(default_factory=datetime.now)
    metadata: dict[str, Any] = field(default_factory=dict)
    
    # Relationships
    entity: Optional[Asset | Shot] = None
    versions: list[Version] = field(default_factory=list)
    
    def __str__(self) -> str:
        return f"Task({self.name})"


@dataclass
class Version:
    """A published version of a task."""
    id: int
    task_id: int
    version_number: int
    status: str = "pending_review"
    path: Optional[str] = None
    thumbnail: Optional[str] = None
    notes: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    metadata: dict[str, Any] = field(default_factory=dict)
    
    # Relationships
    task: Optional[Task] = None
    
    @property
    def version_string(self) -> str:
        """Formatted version string (e.g., 'v003')."""
        return f"v{self.version_number:03d}"
    
    def __str__(self) -> str:
        return f"Version({self.version_string})"


@dataclass
class User:
    """A user in the system."""
    id: int
    username: str
    email: Optional[str] = None
    display_name: Optional[str] = None
    role: str = "artist"  # artist, lead, supervisor, admin
    active: bool = True
    created_at: datetime = field(default_factory=datetime.now)
    metadata: dict[str, Any] = field(default_factory=dict)
    
    def __str__(self) -> str:
        return f"User({self.username})"

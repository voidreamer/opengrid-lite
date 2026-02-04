"""Studio database interface — PostgreSQL backend."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Optional, Union

import psycopg
from psycopg.rows import dict_row

from opengrid.models import Project, Asset, Shot, Task, Version


class Studio:
    """Main interface for production tracking.
    
    Example:
        studio = Studio("postgresql://localhost/opengrid")
        project = studio.create_project(name="My Film", code="MYFILM")
        asset = studio.create_asset(project, name="hero", asset_type="character")
    """
    
    def __init__(self, conninfo: str = "postgresql://localhost/opengrid") -> None:
        """Initialize studio database.
        
        Args:
            conninfo: PostgreSQL connection string
        """
        self.conninfo = conninfo
        self._conn = psycopg.connect(conninfo, row_factory=dict_row, autocommit=False)
        self._init_schema()
    
    def _init_schema(self) -> None:
        """Create database tables if they don't exist."""
        with self._conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS projects (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    code TEXT UNIQUE NOT NULL,
                    status TEXT DEFAULT 'active',
                    description TEXT,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    metadata JSONB DEFAULT '{}'
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS assets (
                    id SERIAL PRIMARY KEY,
                    project_id INTEGER NOT NULL REFERENCES projects(id),
                    name TEXT NOT NULL,
                    asset_type TEXT NOT NULL,
                    status TEXT DEFAULT 'waiting',
                    description TEXT,
                    thumbnail TEXT,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    metadata JSONB DEFAULT '{}',
                    UNIQUE (project_id, name)
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS shots (
                    id SERIAL PRIMARY KEY,
                    project_id INTEGER NOT NULL REFERENCES projects(id),
                    sequence TEXT NOT NULL,
                    name TEXT NOT NULL,
                    frame_start INTEGER DEFAULT 1001,
                    frame_end INTEGER DEFAULT 1100,
                    status TEXT DEFAULT 'waiting',
                    description TEXT,
                    thumbnail TEXT,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    metadata JSONB DEFAULT '{}',
                    UNIQUE (project_id, name)
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS tasks (
                    id SERIAL PRIMARY KEY,
                    entity_type TEXT NOT NULL,
                    entity_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    status TEXT DEFAULT 'waiting',
                    assignee TEXT,
                    due_date TIMESTAMPTZ,
                    priority INTEGER DEFAULT 50,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    metadata JSONB DEFAULT '{}',
                    UNIQUE (entity_type, entity_id, name)
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS versions (
                    id SERIAL PRIMARY KEY,
                    task_id INTEGER NOT NULL REFERENCES tasks(id),
                    version_number INTEGER NOT NULL,
                    status TEXT DEFAULT 'pending_review',
                    path TEXT,
                    thumbnail TEXT,
                    notes TEXT,
                    created_by TEXT,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    metadata JSONB DEFAULT '{}',
                    UNIQUE (task_id, version_number)
                )
            """)
            cur.execute("CREATE INDEX IF NOT EXISTS idx_assets_project ON assets(project_id)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_shots_project ON shots(project_id)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_tasks_entity ON tasks(entity_type, entity_id)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_versions_task ON versions(task_id)")
        self._conn.commit()
    
    def close(self) -> None:
        """Close database connection."""
        self._conn.close()
    
    def __enter__(self) -> Studio:
        return self
    
    def __exit__(self, *args) -> None:
        self.close()
    
    # =========================================================================
    # Projects
    # =========================================================================
    
    def create_project(
        self,
        name: str,
        code: str,
        status: str = "active",
        description: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> Project:
        """Create a new project."""
        now = datetime.now()
        meta = json.dumps(metadata or {})
        
        with self._conn.cursor() as cur:
            cur.execute(
                """INSERT INTO projects (name, code, status, description, created_at, metadata)
                   VALUES (%s, %s, %s, %s, %s, %s) RETURNING id""",
                (name, code, status, description, now, meta),
            )
            row_id = cur.fetchone()["id"]
        self._conn.commit()
        
        return Project(
            id=row_id, name=name, code=code, status=status,
            description=description, created_at=now, metadata=metadata or {},
        )
    
    def get_project(self, code: str) -> Optional[Project]:
        """Get a project by code."""
        with self._conn.cursor() as cur:
            cur.execute("SELECT * FROM projects WHERE code = %s", (code,))
            row = cur.fetchone()
        return self._row_to_project(row) if row else None
    
    def find_projects(self, status: Optional[str] = None) -> list[Project]:
        """Find projects, optionally filtered by status."""
        with self._conn.cursor() as cur:
            if status:
                cur.execute("SELECT * FROM projects WHERE status = %s", (status,))
            else:
                cur.execute("SELECT * FROM projects")
            return [self._row_to_project(row) for row in cur.fetchall()]
    
    def _row_to_project(self, row: dict) -> Project:
        meta = row["metadata"] if isinstance(row["metadata"], dict) else json.loads(row["metadata"] or "{}")
        return Project(
            id=row["id"], name=row["name"], code=row["code"],
            status=row["status"], description=row["description"],
            created_at=row["created_at"] if isinstance(row["created_at"], datetime) else datetime.now(),
            metadata=meta,
        )
    
    # =========================================================================
    # Assets
    # =========================================================================
    
    def create_asset(
        self,
        project: Union[Project, int, str],
        name: str,
        asset_type: str,
        status: str = "waiting",
        description: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> Asset:
        """Create a new asset."""
        project_id = self._resolve_project_id(project)
        now = datetime.now()
        meta = json.dumps(metadata or {})
        
        with self._conn.cursor() as cur:
            cur.execute(
                """INSERT INTO assets (project_id, name, asset_type, status, description, created_at, metadata)
                   VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id""",
                (project_id, name, asset_type, status, description, now, meta),
            )
            row_id = cur.fetchone()["id"]
        self._conn.commit()
        
        return Asset(
            id=row_id, project_id=project_id, name=name,
            asset_type=asset_type, status=status, description=description,
            created_at=now, metadata=metadata or {},
        )
    
    def get_asset(self, project: Union[Project, int, str], name: str) -> Optional[Asset]:
        """Get an asset by project and name."""
        project_id = self._resolve_project_id(project)
        with self._conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM assets WHERE project_id = %s AND name = %s",
                (project_id, name),
            )
            row = cur.fetchone()
        return self._row_to_asset(row) if row else None
    
    def find_assets(
        self,
        project: Optional[Union[Project, int, str]] = None,
        asset_type: Optional[str] = None,
        status: Optional[str] = None,
    ) -> list[Asset]:
        """Find assets with optional filters."""
        query = "SELECT * FROM assets WHERE 1=1"
        params: list[Any] = []
        
        if project:
            query += " AND project_id = %s"
            params.append(self._resolve_project_id(project))
        if asset_type:
            query += " AND asset_type = %s"
            params.append(asset_type)
        if status:
            query += " AND status = %s"
            params.append(status)
        
        with self._conn.cursor() as cur:
            cur.execute(query, params)
            return [self._row_to_asset(row) for row in cur.fetchall()]
    
    def _row_to_asset(self, row: dict) -> Asset:
        meta = row["metadata"] if isinstance(row["metadata"], dict) else json.loads(row["metadata"] or "{}")
        return Asset(
            id=row["id"], project_id=row["project_id"], name=row["name"],
            asset_type=row["asset_type"], status=row["status"],
            description=row["description"], thumbnail=row.get("thumbnail"),
            created_at=row["created_at"] if isinstance(row["created_at"], datetime) else datetime.now(),
            metadata=meta,
        )
    
    # =========================================================================
    # Shots
    # =========================================================================
    
    def create_shot(
        self,
        project: Union[Project, int, str],
        sequence: str,
        name: str,
        frame_start: int = 1001,
        frame_end: int = 1100,
        status: str = "waiting",
        description: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> Shot:
        """Create a new shot."""
        project_id = self._resolve_project_id(project)
        now = datetime.now()
        meta = json.dumps(metadata or {})
        
        with self._conn.cursor() as cur:
            cur.execute(
                """INSERT INTO shots (project_id, sequence, name, frame_start, frame_end, status, description, created_at, metadata)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
                (project_id, sequence, name, frame_start, frame_end, status, description, now, meta),
            )
            row_id = cur.fetchone()["id"]
        self._conn.commit()
        
        return Shot(
            id=row_id, project_id=project_id, sequence=sequence, name=name,
            frame_start=frame_start, frame_end=frame_end, status=status,
            description=description, created_at=now, metadata=metadata or {},
        )
    
    def get_shot(self, project: Union[Project, int, str], name: str) -> Optional[Shot]:
        """Get a shot by project and name."""
        project_id = self._resolve_project_id(project)
        with self._conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM shots WHERE project_id = %s AND name = %s",
                (project_id, name),
            )
            row = cur.fetchone()
        return self._row_to_shot(row) if row else None
    
    def find_shots(
        self,
        project: Optional[Union[Project, int, str]] = None,
        sequence: Optional[str] = None,
        status: Optional[str] = None,
    ) -> list[Shot]:
        """Find shots with optional filters."""
        query = "SELECT * FROM shots WHERE 1=1"
        params: list[Any] = []
        
        if project:
            query += " AND project_id = %s"
            params.append(self._resolve_project_id(project))
        if sequence:
            query += " AND sequence = %s"
            params.append(sequence)
        if status:
            query += " AND status = %s"
            params.append(status)
        
        with self._conn.cursor() as cur:
            cur.execute(query, params)
            return [self._row_to_shot(row) for row in cur.fetchall()]
    
    def _row_to_shot(self, row: dict) -> Shot:
        meta = row["metadata"] if isinstance(row["metadata"], dict) else json.loads(row["metadata"] or "{}")
        return Shot(
            id=row["id"], project_id=row["project_id"],
            sequence=row["sequence"], name=row["name"],
            frame_start=row["frame_start"], frame_end=row["frame_end"],
            status=row["status"], description=row["description"],
            thumbnail=row.get("thumbnail"),
            created_at=row["created_at"] if isinstance(row["created_at"], datetime) else datetime.now(),
            metadata=meta,
        )
    
    # =========================================================================
    # Tasks
    # =========================================================================
    
    def create_task(
        self,
        entity: Union[Asset, Shot],
        name: str,
        status: str = "waiting",
        assignee: Optional[str] = None,
        due_date: Optional[datetime] = None,
        priority: int = 50,
        metadata: Optional[dict] = None,
    ) -> Task:
        """Create a task on an asset or shot."""
        entity_type = "asset" if isinstance(entity, Asset) else "shot"
        now = datetime.now()
        meta = json.dumps(metadata or {})
        
        with self._conn.cursor() as cur:
            cur.execute(
                """INSERT INTO tasks (entity_type, entity_id, name, status, assignee, due_date, priority, created_at, metadata)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
                (entity_type, entity.id, name, status, assignee, due_date, priority, now, meta),
            )
            row_id = cur.fetchone()["id"]
        self._conn.commit()
        
        return Task(
            id=row_id, entity_type=entity_type, entity_id=entity.id,
            name=name, status=status, assignee=assignee,
            due_date=due_date, priority=priority,
            created_at=now, metadata=metadata or {},
        )
    
    def update_task(
        self,
        task: Union[Task, int],
        status: Optional[str] = None,
        assignee: Optional[str] = None,
        due_date: Optional[datetime] = None,
        priority: Optional[int] = None,
    ) -> None:
        """Update task fields."""
        task_id = task.id if isinstance(task, Task) else task
        
        updates = []
        params: list[Any] = []
        
        if status is not None:
            updates.append("status = %s")
            params.append(status)
        if assignee is not None:
            updates.append("assignee = %s")
            params.append(assignee)
        if due_date is not None:
            updates.append("due_date = %s")
            params.append(due_date)
        if priority is not None:
            updates.append("priority = %s")
            params.append(priority)
        
        if updates:
            params.append(task_id)
            with self._conn.cursor() as cur:
                cur.execute(
                    f"UPDATE tasks SET {', '.join(updates)} WHERE id = %s",
                    params,
                )
            self._conn.commit()
    
    def find_tasks(
        self,
        entity: Optional[Union[Asset, Shot]] = None,
        status: Optional[str] = None,
        assignee: Optional[str] = None,
    ) -> list[Task]:
        """Find tasks with optional filters."""
        query = "SELECT * FROM tasks WHERE 1=1"
        params: list[Any] = []
        
        if entity:
            entity_type = "asset" if isinstance(entity, Asset) else "shot"
            query += " AND entity_type = %s AND entity_id = %s"
            params.extend([entity_type, entity.id])
        if status:
            query += " AND status = %s"
            params.append(status)
        if assignee:
            query += " AND assignee = %s"
            params.append(assignee)
        
        with self._conn.cursor() as cur:
            cur.execute(query, params)
            return [self._row_to_task(row) for row in cur.fetchall()]
    
    def _row_to_task(self, row: dict) -> Task:
        meta = row["metadata"] if isinstance(row["metadata"], dict) else json.loads(row["metadata"] or "{}")
        return Task(
            id=row["id"], entity_type=row["entity_type"],
            entity_id=row["entity_id"], name=row["name"],
            status=row["status"], assignee=row["assignee"],
            due_date=row["due_date"] if isinstance(row.get("due_date"), datetime) else None,
            priority=row["priority"],
            created_at=row["created_at"] if isinstance(row["created_at"], datetime) else datetime.now(),
            metadata=meta,
        )
    
    # =========================================================================
    # Versions
    # =========================================================================
    
    def create_version(
        self,
        task: Union[Task, int],
        path: Optional[str] = None,
        notes: Optional[str] = None,
        created_by: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> Version:
        """Create a new version for a task."""
        task_id = task.id if isinstance(task, Task) else task
        now = datetime.now()
        meta = json.dumps(metadata or {})
        
        with self._conn.cursor() as cur:
            cur.execute(
                "SELECT COALESCE(MAX(version_number), 0) AS max_v FROM versions WHERE task_id = %s",
                (task_id,),
            )
            version_number = cur.fetchone()["max_v"] + 1
            
            cur.execute(
                """INSERT INTO versions (task_id, version_number, path, notes, created_by, created_at, metadata)
                   VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id""",
                (task_id, version_number, path, notes, created_by, now, meta),
            )
            row_id = cur.fetchone()["id"]
        self._conn.commit()
        
        return Version(
            id=row_id, task_id=task_id, version_number=version_number,
            path=path, notes=notes, created_by=created_by,
            created_at=now, metadata=metadata or {},
        )
    
    def find_versions(
        self,
        task: Optional[Union[Task, int]] = None,
    ) -> list[Version]:
        """Find versions, optionally filtered by task."""
        query = "SELECT * FROM versions WHERE 1=1"
        params: list[Any] = []
        
        if task is not None:
            task_id = task.id if isinstance(task, Task) else task
            query += " AND task_id = %s"
            params.append(task_id)
        
        query += " ORDER BY version_number ASC"
        
        with self._conn.cursor() as cur:
            cur.execute(query, params)
            return [self._row_to_version(row) for row in cur.fetchall()]
    
    def _row_to_version(self, row: dict) -> Version:
        meta = row["metadata"] if isinstance(row["metadata"], dict) else json.loads(row["metadata"] or "{}")
        return Version(
            id=row["id"], task_id=row["task_id"],
            version_number=row["version_number"], status=row["status"],
            path=row["path"], thumbnail=row.get("thumbnail"),
            notes=row["notes"], created_by=row["created_by"],
            created_at=row["created_at"] if isinstance(row["created_at"], datetime) else datetime.now(),
            metadata=meta,
        )
    
    # =========================================================================
    # Helpers
    # =========================================================================
    
    def _resolve_project_id(self, project: Union[Project, int, str]) -> int:
        """Resolve project to ID."""
        if isinstance(project, Project):
            return project.id
        if isinstance(project, int):
            return project
        proj = self.get_project(project)
        if not proj:
            raise ValueError(f"Project not found: {project}")
        return proj.id

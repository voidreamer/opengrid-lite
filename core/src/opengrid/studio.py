"""Studio database interface."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Optional, Union

from opengrid.models import Project, Asset, Shot, Task, Version


class Studio:
    """Main interface for production tracking.
    
    Example:
        studio = Studio("my_studio.db")
        project = studio.create_project(name="My Film", code="MYFILM")
        asset = studio.create_asset(project, name="hero", asset_type="character")
    """
    
    def __init__(self, db_path: Union[str, Path] = ":memory:") -> None:
        """Initialize studio database.
        
        Args:
            db_path: Path to SQLite database, or ":memory:" for in-memory
        """
        self.db_path = Path(db_path) if db_path != ":memory:" else db_path
        self._conn = sqlite3.connect(str(db_path))
        self._conn.row_factory = sqlite3.Row
        self._init_schema()
    
    def _init_schema(self) -> None:
        """Create database tables if they don't exist."""
        cursor = self._conn.cursor()
        
        cursor.executescript("""
            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                code TEXT UNIQUE NOT NULL,
                status TEXT DEFAULT 'active',
                description TEXT,
                created_at TEXT,
                metadata TEXT DEFAULT '{}'
            );
            
            CREATE TABLE IF NOT EXISTS assets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                asset_type TEXT NOT NULL,
                status TEXT DEFAULT 'waiting',
                description TEXT,
                thumbnail TEXT,
                created_at TEXT,
                metadata TEXT DEFAULT '{}',
                FOREIGN KEY (project_id) REFERENCES projects(id),
                UNIQUE (project_id, name)
            );
            
            CREATE TABLE IF NOT EXISTS shots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                sequence TEXT NOT NULL,
                name TEXT NOT NULL,
                frame_start INTEGER DEFAULT 1001,
                frame_end INTEGER DEFAULT 1100,
                status TEXT DEFAULT 'waiting',
                description TEXT,
                thumbnail TEXT,
                created_at TEXT,
                metadata TEXT DEFAULT '{}',
                FOREIGN KEY (project_id) REFERENCES projects(id),
                UNIQUE (project_id, name)
            );
            
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_type TEXT NOT NULL,
                entity_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                status TEXT DEFAULT 'waiting',
                assignee TEXT,
                due_date TEXT,
                priority INTEGER DEFAULT 50,
                created_at TEXT,
                metadata TEXT DEFAULT '{}',
                UNIQUE (entity_type, entity_id, name)
            );
            
            CREATE TABLE IF NOT EXISTS versions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id INTEGER NOT NULL,
                version_number INTEGER NOT NULL,
                status TEXT DEFAULT 'pending_review',
                path TEXT,
                thumbnail TEXT,
                notes TEXT,
                created_by TEXT,
                created_at TEXT,
                metadata TEXT DEFAULT '{}',
                FOREIGN KEY (task_id) REFERENCES tasks(id),
                UNIQUE (task_id, version_number)
            );
            
            CREATE INDEX IF NOT EXISTS idx_assets_project ON assets(project_id);
            CREATE INDEX IF NOT EXISTS idx_shots_project ON shots(project_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_entity ON tasks(entity_type, entity_id);
            CREATE INDEX IF NOT EXISTS idx_versions_task ON versions(task_id);
        """)
        
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
        now = datetime.now().isoformat()
        metadata_json = json.dumps(metadata or {})
        
        cursor = self._conn.cursor()
        cursor.execute(
            """INSERT INTO projects (name, code, status, description, created_at, metadata)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (name, code, status, description, now, metadata_json),
        )
        self._conn.commit()
        
        return Project(
            id=cursor.lastrowid,
            name=name,
            code=code,
            status=status,
            description=description,
            created_at=datetime.fromisoformat(now),
            metadata=metadata or {},
        )
    
    def get_project(self, code: str) -> Optional[Project]:
        """Get a project by code."""
        cursor = self._conn.cursor()
        cursor.execute("SELECT * FROM projects WHERE code = ?", (code,))
        row = cursor.fetchone()
        return self._row_to_project(row) if row else None
    
    def find_projects(self, status: Optional[str] = None) -> list[Project]:
        """Find projects, optionally filtered by status."""
        cursor = self._conn.cursor()
        if status:
            cursor.execute("SELECT * FROM projects WHERE status = ?", (status,))
        else:
            cursor.execute("SELECT * FROM projects")
        return [self._row_to_project(row) for row in cursor.fetchall()]
    
    def _row_to_project(self, row: sqlite3.Row) -> Project:
        return Project(
            id=row["id"],
            name=row["name"],
            code=row["code"],
            status=row["status"],
            description=row["description"],
            created_at=datetime.fromisoformat(row["created_at"]) if row["created_at"] else datetime.now(),
            metadata=json.loads(row["metadata"]) if row["metadata"] else {},
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
        now = datetime.now().isoformat()
        metadata_json = json.dumps(metadata or {})
        
        cursor = self._conn.cursor()
        cursor.execute(
            """INSERT INTO assets (project_id, name, asset_type, status, description, created_at, metadata)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (project_id, name, asset_type, status, description, now, metadata_json),
        )
        self._conn.commit()
        
        return Asset(
            id=cursor.lastrowid,
            project_id=project_id,
            name=name,
            asset_type=asset_type,
            status=status,
            description=description,
            created_at=datetime.fromisoformat(now),
            metadata=metadata or {},
        )
    
    def get_asset(self, project: Union[Project, int, str], name: str) -> Optional[Asset]:
        """Get an asset by project and name."""
        project_id = self._resolve_project_id(project)
        cursor = self._conn.cursor()
        cursor.execute(
            "SELECT * FROM assets WHERE project_id = ? AND name = ?",
            (project_id, name),
        )
        row = cursor.fetchone()
        return self._row_to_asset(row) if row else None
    
    def find_assets(
        self,
        project: Optional[Union[Project, int, str]] = None,
        asset_type: Optional[str] = None,
        status: Optional[str] = None,
    ) -> list[Asset]:
        """Find assets with optional filters."""
        query = "SELECT * FROM assets WHERE 1=1"
        params = []
        
        if project:
            query += " AND project_id = ?"
            params.append(self._resolve_project_id(project))
        if asset_type:
            query += " AND asset_type = ?"
            params.append(asset_type)
        if status:
            query += " AND status = ?"
            params.append(status)
        
        cursor = self._conn.cursor()
        cursor.execute(query, params)
        return [self._row_to_asset(row) for row in cursor.fetchall()]
    
    def _row_to_asset(self, row: sqlite3.Row) -> Asset:
        return Asset(
            id=row["id"],
            project_id=row["project_id"],
            name=row["name"],
            asset_type=row["asset_type"],
            status=row["status"],
            description=row["description"],
            thumbnail=row["thumbnail"],
            created_at=datetime.fromisoformat(row["created_at"]) if row["created_at"] else datetime.now(),
            metadata=json.loads(row["metadata"]) if row["metadata"] else {},
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
        now = datetime.now().isoformat()
        due_str = due_date.isoformat() if due_date else None
        metadata_json = json.dumps(metadata or {})
        
        cursor = self._conn.cursor()
        cursor.execute(
            """INSERT INTO tasks (entity_type, entity_id, name, status, assignee, due_date, priority, created_at, metadata)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (entity_type, entity.id, name, status, assignee, due_str, priority, now, metadata_json),
        )
        self._conn.commit()
        
        return Task(
            id=cursor.lastrowid,
            entity_type=entity_type,
            entity_id=entity.id,
            name=name,
            status=status,
            assignee=assignee,
            due_date=due_date,
            priority=priority,
            created_at=datetime.fromisoformat(now),
            metadata=metadata or {},
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
        params = []
        
        if status is not None:
            updates.append("status = ?")
            params.append(status)
        if assignee is not None:
            updates.append("assignee = ?")
            params.append(assignee)
        if due_date is not None:
            updates.append("due_date = ?")
            params.append(due_date.isoformat())
        if priority is not None:
            updates.append("priority = ?")
            params.append(priority)
        
        if updates:
            params.append(task_id)
            cursor = self._conn.cursor()
            cursor.execute(
                f"UPDATE tasks SET {', '.join(updates)} WHERE id = ?",
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
        params = []
        
        if entity:
            entity_type = "asset" if isinstance(entity, Asset) else "shot"
            query += " AND entity_type = ? AND entity_id = ?"
            params.extend([entity_type, entity.id])
        if status:
            query += " AND status = ?"
            params.append(status)
        if assignee:
            query += " AND assignee = ?"
            params.append(assignee)
        
        cursor = self._conn.cursor()
        cursor.execute(query, params)
        return [self._row_to_task(row) for row in cursor.fetchall()]
    
    def _row_to_task(self, row: sqlite3.Row) -> Task:
        return Task(
            id=row["id"],
            entity_type=row["entity_type"],
            entity_id=row["entity_id"],
            name=row["name"],
            status=row["status"],
            assignee=row["assignee"],
            due_date=datetime.fromisoformat(row["due_date"]) if row["due_date"] else None,
            priority=row["priority"],
            created_at=datetime.fromisoformat(row["created_at"]) if row["created_at"] else datetime.now(),
            metadata=json.loads(row["metadata"]) if row["metadata"] else {},
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
        
        # Get next version number
        cursor = self._conn.cursor()
        cursor.execute(
            "SELECT MAX(version_number) FROM versions WHERE task_id = ?",
            (task_id,),
        )
        max_version = cursor.fetchone()[0]
        version_number = (max_version or 0) + 1
        
        now = datetime.now().isoformat()
        metadata_json = json.dumps(metadata or {})
        
        cursor.execute(
            """INSERT INTO versions (task_id, version_number, path, notes, created_by, created_at, metadata)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (task_id, version_number, path, notes, created_by, now, metadata_json),
        )
        self._conn.commit()
        
        return Version(
            id=cursor.lastrowid,
            task_id=task_id,
            version_number=version_number,
            path=path,
            notes=notes,
            created_by=created_by,
            created_at=datetime.fromisoformat(now),
            metadata=metadata or {},
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
        # Assume it's a code
        proj = self.get_project(project)
        if not proj:
            raise ValueError(f"Project not found: {project}")
        return proj.id

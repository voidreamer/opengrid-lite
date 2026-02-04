"""OpenGrid Server — FastAPI application."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pydantic_settings import BaseSettings

from opengrid import Studio, Project, Asset, Shot, Task, Version


class Settings(BaseSettings):
    """Server configuration."""
    
    database_url: str = "postgresql://localhost/opengrid"
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]
    
    class Config:
        env_prefix = "OPENGRID_"


settings = Settings()

# Global studio instance
_studio: Optional[Studio] = None


def get_studio() -> Studio:
    """Get the studio instance."""
    global _studio
    if _studio is None:
        _studio = Studio(settings.database_url)
    return _studio


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle."""
    # Startup
    get_studio()
    yield
    # Shutdown
    if _studio:
        _studio.close()


app = FastAPI(
    title="OpenGrid",
    description="Production tracking API for VFX/Animation pipelines",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS for web frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# Pydantic schemas
# =============================================================================

class ProjectCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None


class ProjectResponse(BaseModel):
    id: int
    name: str
    code: str
    status: str
    description: Optional[str]
    
    class Config:
        from_attributes = True


class AssetCreate(BaseModel):
    name: str
    asset_type: str
    description: Optional[str] = None


class AssetResponse(BaseModel):
    id: int
    project_id: int
    name: str
    asset_type: str
    status: str
    description: Optional[str]
    thumbnail: Optional[str]
    
    class Config:
        from_attributes = True


class TaskCreate(BaseModel):
    name: str
    assignee: Optional[str] = None
    priority: int = 50


class TaskUpdate(BaseModel):
    status: Optional[str] = None
    assignee: Optional[str] = None
    priority: Optional[int] = None


class TaskResponse(BaseModel):
    id: int
    entity_type: str
    entity_id: int
    name: str
    status: str
    assignee: Optional[str]
    priority: int
    
    class Config:
        from_attributes = True


class ShotCreate(BaseModel):
    sequence: str
    name: str
    frame_start: int = 1001
    frame_end: int = 1100
    description: Optional[str] = None


class ShotResponse(BaseModel):
    id: int
    project_id: int
    sequence: str
    name: str
    frame_start: int
    frame_end: int
    status: str
    description: Optional[str]
    
    class Config:
        from_attributes = True


class VersionCreate(BaseModel):
    path: Optional[str] = None
    notes: Optional[str] = None
    created_by: Optional[str] = None


class VersionResponse(BaseModel):
    id: int
    task_id: int
    version_number: int
    status: str
    path: Optional[str]
    notes: Optional[str]
    created_by: Optional[str]
    
    class Config:
        from_attributes = True


# =============================================================================
# Routes — Projects
# =============================================================================

@app.get("/api/projects", response_model=list[ProjectResponse])
def list_projects(status: Optional[str] = None):
    """List all projects."""
    studio = get_studio()
    projects = studio.find_projects(status=status)
    return [ProjectResponse.model_validate(p) for p in projects]


@app.post("/api/projects", response_model=ProjectResponse, status_code=201)
def create_project(data: ProjectCreate):
    """Create a new project."""
    studio = get_studio()
    try:
        project = studio.create_project(
            name=data.name,
            code=data.code,
            description=data.description,
        )
        return ProjectResponse.model_validate(project)
    except Exception as e:
        raise HTTPException(400, str(e))


@app.get("/api/projects/{code}", response_model=ProjectResponse)
def get_project(code: str):
    """Get a project by code."""
    studio = get_studio()
    project = studio.get_project(code)
    if not project:
        raise HTTPException(404, f"Project not found: {code}")
    return ProjectResponse.model_validate(project)


# =============================================================================
# Routes — Assets
# =============================================================================

@app.get("/api/projects/{code}/assets", response_model=list[AssetResponse])
def list_assets(
    code: str,
    asset_type: Optional[str] = None,
    status: Optional[str] = None,
):
    """List assets in a project."""
    studio = get_studio()
    project = studio.get_project(code)
    if not project:
        raise HTTPException(404, f"Project not found: {code}")
    
    assets = studio.find_assets(project=project, asset_type=asset_type, status=status)
    return [AssetResponse.model_validate(a) for a in assets]


@app.post("/api/projects/{code}/assets", response_model=AssetResponse, status_code=201)
def create_asset(code: str, data: AssetCreate):
    """Create an asset in a project."""
    studio = get_studio()
    project = studio.get_project(code)
    if not project:
        raise HTTPException(404, f"Project not found: {code}")
    
    try:
        asset = studio.create_asset(
            project=project,
            name=data.name,
            asset_type=data.asset_type,
            description=data.description,
        )
        return AssetResponse.model_validate(asset)
    except Exception as e:
        raise HTTPException(400, str(e))


@app.get("/api/projects/{code}/assets/{name}", response_model=AssetResponse)
def get_asset(code: str, name: str):
    """Get an asset by name."""
    studio = get_studio()
    project = studio.get_project(code)
    if not project:
        raise HTTPException(404, f"Project not found: {code}")
    
    asset = studio.get_asset(project, name)
    if not asset:
        raise HTTPException(404, f"Asset not found: {name}")
    return AssetResponse.model_validate(asset)


# =============================================================================
# Routes — Shots
# =============================================================================

@app.get("/api/projects/{code}/shots", response_model=list[ShotResponse])
def list_shots(
    code: str,
    sequence: Optional[str] = None,
    status: Optional[str] = None,
):
    """List shots in a project."""
    studio = get_studio()
    project = studio.get_project(code)
    if not project:
        raise HTTPException(404, f"Project not found: {code}")
    
    shots = studio.find_shots(project=project, sequence=sequence, status=status)
    return [ShotResponse.model_validate(s) for s in shots]


@app.post("/api/projects/{code}/shots", response_model=ShotResponse, status_code=201)
def create_shot(code: str, data: ShotCreate):
    """Create a shot in a project."""
    studio = get_studio()
    project = studio.get_project(code)
    if not project:
        raise HTTPException(404, f"Project not found: {code}")
    
    try:
        shot = studio.create_shot(
            project=project,
            sequence=data.sequence,
            name=data.name,
            frame_start=data.frame_start,
            frame_end=data.frame_end,
            description=data.description,
        )
        return ShotResponse.model_validate(shot)
    except Exception as e:
        raise HTTPException(400, str(e))


@app.get("/api/projects/{code}/shots/{name}", response_model=ShotResponse)
def get_shot(code: str, name: str):
    """Get a shot by name."""
    studio = get_studio()
    project = studio.get_project(code)
    if not project:
        raise HTTPException(404, f"Project not found: {code}")
    
    shot = studio.get_shot(project, name)
    if not shot:
        raise HTTPException(404, f"Shot not found: {name}")
    return ShotResponse.model_validate(shot)


# =============================================================================
# Routes — Shot Tasks
# =============================================================================

@app.get("/api/shots/{shot_id}/tasks", response_model=list[TaskResponse])
def list_shot_tasks(shot_id: int):
    """List tasks on a shot."""
    studio = get_studio()
    shot = Shot(id=shot_id, project_id=0, sequence="", name="")
    tasks = studio.find_tasks(entity=shot)
    return [TaskResponse.model_validate(t) for t in tasks]


@app.post("/api/shots/{shot_id}/tasks", response_model=TaskResponse, status_code=201)
def create_shot_task(shot_id: int, data: TaskCreate):
    """Create a task on a shot."""
    studio = get_studio()
    shot = Shot(id=shot_id, project_id=0, sequence="", name="")
    
    try:
        task = studio.create_task(
            entity=shot,
            name=data.name,
            assignee=data.assignee,
            priority=data.priority,
        )
        return TaskResponse.model_validate(task)
    except Exception as e:
        raise HTTPException(400, str(e))


# =============================================================================
# Routes — Tasks
# =============================================================================

@app.get("/api/assets/{asset_id}/tasks", response_model=list[TaskResponse])
def list_asset_tasks(asset_id: int):
    """List tasks on an asset."""
    studio = get_studio()
    # Create a minimal asset for the query
    asset = Asset(id=asset_id, project_id=0, name="", asset_type="")
    tasks = studio.find_tasks(entity=asset)
    return [TaskResponse.model_validate(t) for t in tasks]


@app.post("/api/assets/{asset_id}/tasks", response_model=TaskResponse, status_code=201)
def create_asset_task(asset_id: int, data: TaskCreate):
    """Create a task on an asset."""
    studio = get_studio()
    asset = Asset(id=asset_id, project_id=0, name="", asset_type="")
    
    try:
        task = studio.create_task(
            entity=asset,
            name=data.name,
            assignee=data.assignee,
            priority=data.priority,
        )
        return TaskResponse.model_validate(task)
    except Exception as e:
        raise HTTPException(400, str(e))


@app.patch("/api/tasks/{task_id}", response_model=TaskResponse)
def update_task(task_id: int, data: TaskUpdate):
    """Update a task."""
    studio = get_studio()
    
    try:
        studio.update_task(
            task=task_id,
            status=data.status,
            assignee=data.assignee,
            priority=data.priority,
        )
        # Fetch updated task
        tasks = [t for t in studio.find_tasks() if t.id == task_id]
        if not tasks:
            raise HTTPException(404, f"Task not found: {task_id}")
        return TaskResponse.model_validate(tasks[0])
    except Exception as e:
        raise HTTPException(400, str(e))


# =============================================================================
# Routes — Versions
# =============================================================================

@app.get("/api/tasks/{task_id}/versions", response_model=list[VersionResponse])
def list_versions(task_id: int):
    """List versions for a task."""
    studio = get_studio()
    versions = studio.find_versions(task=task_id)
    return [VersionResponse.model_validate(v) for v in versions]


@app.post("/api/tasks/{task_id}/versions", response_model=VersionResponse, status_code=201)
def create_version(task_id: int, data: VersionCreate):
    """Create a new version."""
    studio = get_studio()
    
    try:
        version = studio.create_version(
            task=task_id,
            path=data.path,
            notes=data.notes,
            created_by=data.created_by,
        )
        return VersionResponse.model_validate(version)
    except Exception as e:
        raise HTTPException(400, str(e))


# =============================================================================
# Health & Info
# =============================================================================

@app.get("/api/health")
def health():
    """Health check."""
    return {"status": "ok", "version": "0.1.0"}


@app.get("/api/stats")
def stats():
    """Database statistics."""
    studio = get_studio()
    return {
        "projects": len(studio.find_projects()),
        "assets": len(studio.find_assets()),
        "shots": len(studio.find_shots()),
        "tasks": len(studio.find_tasks()),
    }


# =============================================================================
# CLI
# =============================================================================

def cli():
    """Run the server."""
    import uvicorn
    uvicorn.run(
        "opengrid_server.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )


if __name__ == "__main__":
    cli()

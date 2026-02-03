# ShotGrid Lite

A lightweight Python SDK and CLI for production tracking. Works standalone or as a simpler alternative to ShotGrid/Flow.

[![Python CI](https://github.com/voidreamer/shotgrid-lite/actions/workflows/python-ci.yml/badge.svg)](https://github.com/voidreamer/shotgrid-lite/actions/workflows/python-ci.yml)

## Features

- **Simple API** — CRUD operations for projects, assets, shots, tasks
- **SQLite backend** — No server required, just a file
- **Optional server** — REST API for team access
- **CLI** — Command-line interface for scripting
- **ShotGrid compatible** — Similar data model for easy migration

## Installation

```bash
pip install shotgrid-lite
```

## Quick Start

### Python API

```python
from shotgrid_lite import Studio

# Create/open a studio database
studio = Studio("my_studio.db")

# Create a project
project = studio.create_project(
    name="My Film",
    code="MYFILM",
)

# Create an asset
asset = studio.create_asset(
    project=project,
    name="hero_character",
    asset_type="character",
)

# Create a task
task = studio.create_task(
    entity=asset,
    name="modeling",
    status="in_progress",
    assignee="alejandro",
)

# Query assets
characters = studio.find_assets(
    project=project,
    asset_type="character",
)

# Update task status
studio.update_task(task, status="complete")
```

### CLI

```bash
# Initialize a new studio database
sgl init my_studio.db

# Create a project
sgl project create "My Film" --code MYFILM

# List projects
sgl project list

# Create an asset
sgl asset create MYFILM hero_character --type character

# Create a task
sgl task create MYFILM/hero_character modeling --assignee alejandro

# Update task status
sgl task update MYFILM/hero_character/modeling --status complete

# Query
sgl asset list MYFILM --type character
sgl task list MYFILM --status in_progress --assignee alejandro
```

### REST API (Optional)

```bash
# Start the server
sgl serve my_studio.db --port 8080

# API endpoints
GET    /api/projects
POST   /api/projects
GET    /api/projects/{code}
GET    /api/projects/{code}/assets
POST   /api/projects/{code}/assets
GET    /api/assets/{id}
PATCH  /api/assets/{id}
GET    /api/tasks
POST   /api/tasks
PATCH  /api/tasks/{id}
```

## Data Model

### Project
```python
{
    "id": 1,
    "name": "My Film",
    "code": "MYFILM",
    "status": "active",
    "created_at": "2024-01-01T00:00:00Z",
    "metadata": {}
}
```

### Asset
```python
{
    "id": 1,
    "project_id": 1,
    "name": "hero_character",
    "asset_type": "character",  # character, prop, environment, vehicle, fx
    "status": "in_progress",
    "description": "Main character",
    "thumbnail": "/path/to/thumb.jpg",
    "metadata": {}
}
```

### Shot
```python
{
    "id": 1,
    "project_id": 1,
    "sequence": "SQ010",
    "name": "SQ010_0010",
    "frame_start": 1001,
    "frame_end": 1100,
    "status": "in_progress",
    "metadata": {}
}
```

### Task
```python
{
    "id": 1,
    "entity_type": "asset",  # asset or shot
    "entity_id": 1,
    "name": "modeling",
    "status": "in_progress",  # waiting, in_progress, review, complete
    "assignee": "alejandro",
    "due_date": "2024-02-01",
    "metadata": {}
}
```

### Version
```python
{
    "id": 1,
    "task_id": 1,
    "version_number": 3,
    "status": "pending_review",
    "path": "/publish/assets/hero/model/v003/hero_model_v003.usd",
    "thumbnail": "/publish/assets/hero/model/v003/thumb.jpg",
    "notes": "Fixed topology issues",
    "created_by": "alejandro",
    "created_at": "2024-01-15T10:30:00Z"
}
```

## Configuration

```yaml
# ~/.shotgrid-lite.yaml
database: ~/studio.db

# Optional server settings
server:
  host: 0.0.0.0
  port: 8080
  
# Hooks for pipeline integration  
hooks:
  on_version_create:
    - notify_slack
    - update_dashboard
```

## Migration from ShotGrid

```python
from shotgrid_lite import Studio
from shotgrid_lite.migrate import from_shotgrid

# Connect to ShotGrid
sg = shotgun_api3.Shotgun(url, script_name, api_key)

# Migrate to ShotGrid Lite
studio = Studio("migrated.db")
from_shotgrid(sg, studio, project_codes=["MYFILM"])
```

## Development

```bash
git clone https://github.com/voidreamer/shotgrid-lite.git
cd shotgrid-lite
uv sync --dev
uv run pytest
```

## License

MIT © Alejandro Cabrera

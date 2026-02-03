# ⚡ OpenGrid

Modern production tracking for VFX/Animation pipelines — fast, simple, beautiful.

[![CI](https://github.com/voidreamer/opengrid-lite/actions/workflows/python-ci.yml/badge.svg)](https://github.com/voidreamer/opengrid-lite/actions/workflows/python-ci.yml)

## What is this?

A lightweight alternative to ShotGrid for tracking assets, shots, tasks, and versions in production.

**Core SDK** — Python library for working with production data  
**REST API** — FastAPI server for web/mobile/DCC integration  
**Web UI** — React dashboard with Rosewood UI theme  

## Quick Start

### 1. Install the SDK

```bash
pip install opengrid
```

```python
from opengrid import Studio

# Create or open a studio database
studio = Studio("~/my_studio.db")

# Create a project
project = studio.create_project(name="My Film", code="MYFILM")

# Create an asset
hero = studio.create_asset(project, name="hero", asset_type="character")

# Create a task
model_task = studio.create_task(hero, name="model", assignee="alejandro")

# Create a version
version = studio.create_version(model_task, path="/path/to/hero_model_v001.usd")
```

### 2. Run the Server

```bash
pip install opengrid-server
opengrid-server
# → http://localhost:8000
# → Docs: http://localhost:8000/docs
```

### 3. Run the Web UI

```bash
cd web
npm install
npm run dev
# → http://localhost:5173
```

## Project Structure

```
opengrid/
├── core/           # Python SDK
│   └── src/opengrid/
│       ├── models.py    # Project, Asset, Shot, Task, Version
│       └── studio.py    # Main Studio class
├── server/         # FastAPI REST API
│   └── src/opengrid_server/
│       └── main.py
├── web/            # React frontend
│   └── src/
│       └── App.tsx
└── cli/            # CLI tools (planned)
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/projects` | List projects |
| `POST` | `/api/projects` | Create project |
| `GET` | `/api/projects/{code}` | Get project |
| `GET` | `/api/projects/{code}/assets` | List assets |
| `POST` | `/api/projects/{code}/assets` | Create asset |
| `GET` | `/api/assets/{id}/tasks` | List tasks |
| `POST` | `/api/assets/{id}/tasks` | Create task |
| `PATCH` | `/api/tasks/{id}` | Update task |
| `POST` | `/api/tasks/{id}/versions` | Create version |

## Data Model

```
Project
  └── Asset (character, prop, environment, ...)
        └── Task (model, rig, surfacing, ...)
              └── Version (v001, v002, ...)

  └── Shot
        └── Task (anim, layout, comp, ...)
              └── Version
```

## Integration with Anvil

OpenGrid + Anvil = The Forge 🔨⚡

```bash
# Set project context
export OPENGRID_PROJECT=MYFILM

# Run Blender with project packages
anvil run blender-4.2 studio-tools -- blender

# Publish creates a version in OpenGrid
# (via studio-tools addon)
```

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENGRID_DATABASE_PATH` | `~/.opengrid/studio.db` | Database location |
| `OPENGRID_HOST` | `0.0.0.0` | Server host |
| `OPENGRID_PORT` | `8000` | Server port |
| `OPENGRID_DEBUG` | `false` | Debug mode |

## Development

```bash
# Core SDK
cd core
pip install -e .
pytest

# Server
cd server
pip install -e .
opengrid-server

# Web
cd web
npm install
npm run dev
```

## Why not ShotGrid?

| | ShotGrid | OpenGrid |
|---|----------|----------|
| **Pricing** | $30+/user/month | Free |
| **Hosting** | SaaS only | Self-hosted |
| **Setup** | Sales call | `pip install` |
| **Speed** | Slow | Fast (SQLite/Postgres) |
| **UI** | 2010 vibes | Modern (Rosewood) |
| **API** | Complex | Simple REST |

OpenGrid is for small studios, freelancers, and teams who want to track their work without the enterprise overhead.

## License

MIT © Alejandro Cabrera

# Cloud Lab

Cloud Lab is a local browser-based cloud physics sandbox for exploring cloud formation, warm-cloud microphysics, surface heating, terrain forcing, and real-time scientific visualization.

## Status

This repository is in its initial scaffold stage. The current app provides:

- A FastAPI backend with a `/health` endpoint.
- A separated Python simulation package boundary under `backend/app/sim`.
- A React + Vite frontend that reports backend connection status.
- A shared simulation config and frame schema with units metadata.
- A minimal 2-D vertical-slice solver that emits time-evolving schema frames.
- Live local simulation playback with start/stop controls and WebSocket frame streaming.
- A first scientific visualization dashboard for streamed 2-D fields and velocity vectors.
- Backend tests, linting, formatting checks, and type checking.
- Frontend linting and production build scripts.
- GitHub Actions CI for pushes and pull requests to `main`.

Serious cloud physics has not been implemented yet. The simulation module currently defines placeholder configuration and frame schemas so future physics work starts from documented, testable boundaries.

## Requirements

- macOS
- Python 3.11 or newer
- Node.js 20.19 or newer
- npm 10 or newer

## Backend Setup

From the repository root:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e ".[dev]"
```

Run the backend:

```bash
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`. Check health with:

```bash
curl http://localhost:8000/health
```

## Frontend Setup

From the repository root:

```bash
cd frontend
npm install
npm run dev
```

The browser app will be available at the URL printed by Vite, usually `http://localhost:5173`.

By default the frontend checks `http://localhost:8000/health`. To use a different backend URL, create `frontend/.env.local`:

```bash
VITE_API_BASE_URL=http://localhost:8000
```

## Test And Quality Commands

Backend:

```bash
cd backend
pytest
ruff format --check .
ruff check .
mypy app tests
```

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

## CI

GitHub Actions runs on pushes and pull requests to `main`. CI installs backend and frontend dependencies, then runs backend tests, backend lint/format/type checks, frontend lint, and frontend build.

## Documentation

- [Architecture](docs/architecture.md)
- [Simulation data model](docs/simulation-data-model.md)
- [Minimal 2-D solver](docs/minimal-solver.md)
- [Live simulation streaming](docs/live-streaming.md)
- [Scientific visualization dashboard](docs/visualization-dashboard.md)
- [Scientific roadmap](docs/scientific-roadmap.md)
- [Development workflow](docs/development.md)

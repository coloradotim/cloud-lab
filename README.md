# Cloud Lab

Cloud Lab helps users explore atmospheric physics through beautiful, interactive cloud experiments grounded in real physical principles.

Short phrase:

> Beautiful cloud experiments. Real atmospheric physics.

Cloud Lab is a local browser-based cloud physics laboratory. It is organized around guided cloud labs where users can manipulate atmospheric initial conditions and forcing, run simulations, visualize the clouds that form, inspect diagnostics, save runs, compare outcomes, and learn real cloud physics.

## Product Direction

Cloud Lab is not a solver demo, a rendering toy, or a generic diagnostics dashboard. It is a lab-driven product.

The core product loop is:

```text
Choose lab → choose scenario → adjust physical controls → run → watch → inspect → save/compare → vary → learn
```

The project starts with simplified and transparent models, but the architecture is intended to support progressively higher-fidelity atmospheric simulation over time.

## Core Labs

The product roadmap is organized around phenomenon labs. The order below is conceptual, not a strict implementation sequence:

1. Lower Atmosphere Cloud Basics
2. Cloud Optics / Beauty
3. Evolving Boundary Layer
4. Layered Atmosphere
5. Orographic / Terrain Clouds
6. Warm Rain / Droplet Growth
7. Fog / Stratus
8. Mixed-Phase / Ice later

Each lab should define the physical question, key controls, expected behavior, diagnostics, visual payoff, limitations, and future upgrade path.

## Current Status

Cloud Lab has a working prototype foundation:

- FastAPI backend and React/Vite frontend.
- Versioned simulation config and frame schemas.
- Multi-solver backend registry.
- `boussinesq_2d` experimental 2-D dynamics scaffold.
- `microphysics_lab` controlled parcel/box warm-cloud mode.
- Legacy `educational_2d` backend for explicit compatibility and regression use.
- WebSocket live run streaming.
- Scientific 2-D visualization and cloud appearance rendering.
- Scenario diagnostics, vertical profiles, probes, replay, saved runs, and comparison prototypes.
- Automated tests, validation docs, and CI.

The current frontend should be treated as a capability prototype. Workbench V2 is the clean-slate product direction: a lab picker and focused lab workbench organized around the product loop above.

## Development Priority

Current product development should prioritize:

1. Lab-driven Workbench V2.
2. A complete Lower Atmosphere Cloud Basics reference lab.
3. Beautiful and honest cloud visualization, including optical controls and 2.5-D views.
4. Evolving boundary-layer and layered-atmosphere capabilities.
5. Orographic, warm-rain, fog/stratus, and later mixed-phase labs.

New features should identify which lab they serve and which physical question they help answer.

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

## Dev Server Helper

After backend and frontend dependencies are installed, you can manage both local dev servers from the repo root:

```bash
scripts/dev.sh start
scripts/dev.sh status
scripts/dev.sh stop
scripts/dev.sh restart
```

Logs are written under `.dev/`, which is ignored by git:

```bash
scripts/dev.sh logs
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
npm run test
npm run lint
npm run build
```

Use targeted test tiers for ordinary work. Full validation is for solver-wide, release/checkpoint, high-risk, or explicitly requested work.

## CI

GitHub Actions runs on pushes and pull requests to `main`. CI installs backend and frontend dependencies, then runs configured backend and frontend checks.

Science validation is separated from ordinary quick checks where practical so UI/docs work does not pay the full solver-validation cost.

## Key Documentation

Start with the [Documentation index](docs/doc-index.md) when unsure what to read.

Strategic direction:

- [Product vision](docs/product-vision.md)
- [Lab roadmap](docs/lab-roadmap.md)
- [Workbench V2 product spec](docs/workbench-v2-product-spec.md)
- [Workbench V2 architecture](docs/workbench-v2-architecture.md)
- [ADR-001: Lab-driven product architecture](docs/architecture-decisions/ADR-001-lab-driven-product.md)
- [Scientific roadmap](docs/scientific-roadmap.md)

Architecture and implementation:

- [Architecture](docs/architecture.md)
- [Simulation data model](docs/simulation-data-model.md)
- [Simulation controls](docs/simulation-controls.md)
- [Live simulation streaming](docs/live-streaming.md)
- [Visualization and workbench views](docs/visualization-and-workbench-views.md)
- [Development workflow](docs/development.md)
- [Testing and validation](docs/testing-and-validation.md)

Solver and science docs:

- [Educational 2-D solver](docs/minimal-solver.md)
- [Boussinesq solver](docs/boussinesq-solver.md)
- [Boussinesq validation](docs/boussinesq-validation.md)
- [Microphysics lab](docs/microphysics-lab.md)
- [Microphysics comparison](docs/microphysics-comparison.md)
- [Microphysics schema proposal](docs/microphysics-schema.md)
- [PySDM evaluation](docs/pysdm-evaluation.md)
- [Lab contract template](docs/lab-contract-template.md)

## Durable Rule

> Solver outputs physical fields. Renderer turns fields into views. UI controls experiments. Diagnostics explain behavior. Documentation explains assumptions. Tests protect the science.

# Architecture

Cloud Lab is a local browser-based cloud physics laboratory organized around guided phenomenon labs.

The product architecture should support beautiful, interactive cloud experiments while keeping the science framework disciplined enough to grow toward higher-fidelity atmospheric modeling over time.

## Product Architecture

Cloud Lab is organized around this product flow:

```text
Lab Picker → Lab Workbench → Run / Inspect / Save / Compare
```

The science/product flow is:

```text
Lab definition
  ↓
Scenario definition
  ↓
Initial state + forcing definition
  ↓
Physics core selection
  ↓
Frame/output schema
  ↓
Diagnostics
  ↓
Visualization/rendering
```

Labs define physical questions. Scenarios define reproducible experiments inside labs. Physics cores implement the needed model behavior. Visualizations and diagnostics explain the result.

Solvers are not the product architecture. They are implementation details that serve labs.

## System Shape

```text
React + Vite frontend
  |
  | HTTP run control + WebSocket frames
  v
FastAPI backend
  |
  | versioned configuration and frame schemas
  v
Python simulation / physics cores
```

## Backend And Frontend Boundary

The frontend owns lab selection, scenario setup, experiment controls, visualization, diagnostics presentation, replay, saved runs, and comparison workflows.

The frontend must not contain solver physics and must not mutate simulation state except through explicit configuration/run-control actions.

The backend owns transport, validation, run orchestration, streaming, and solver dispatch. API route handlers should stay thin and should not accumulate physics rules.

## Simulation-Core Boundary

The simulation core lives under `backend/app/sim`. It must remain importable and testable without FastAPI, React, browser APIs, or network state.

The core exposes documented configuration and output models. `SimulationConfig` defines solver type, domain, grid, timestep, initial atmosphere, heating/forcing, wind, and seed controls. `SimulationFrame` carries grid metadata and unit-bearing scalar fields that can be serialized for HTTP or WebSocket transport without frontend-specific coupling.

Every physical field must document units, shape, and interpretation. Derived diagnostics and visual approximations should remain outside solver state unless they are explicitly modeled outputs.

## Physics Cores

Solver dispatch lives in `backend/app/sim/solver.py`. Concrete backends conform to the solver interface in `backend/app/sim/solver_interface.py`: each backend exposes a descriptor plus `run(config)` and `stream_frames(config)` methods that emit the shared `SimulationFrame` schema.

Current physics cores:

- `educational_2d`: frozen learning/regression backend for explicit legacy configs and compatibility tests.
- `boussinesq_2d`: experimental streamfunction/vorticity 2-D dynamics scaffold for qualitative shallow-cloud and visual experiments.
- `microphysics_lab`: controlled parcel/box warm-cloud microphysics mode with prescribed lift and bulk vapor/cloud/rain outputs.

Future physics cores may include:

- evolving boundary-layer column/profile models
- prescribed-flow microphysics models
- terrain/orographic 2-D cores
- anelastic 2-D or other improved dynamics cores
- PySDM-backed parcel/column/prescribed-flow modes
- true 3-D research cores later

The UI should present these through labs and scenarios, not as a raw solver list.

## Frame And Output Contract

The shared frame schema is the durable bridge among backend, frontend, diagnostics, visualization, saved runs, and comparison.

Current frames include:

- grid coordinates in meters
- absolute temperature
- temperature perturbation
- water vapor
- cloud liquid water
- rain water
- horizontal velocity
- vertical velocity

Future schema extensions should be versioned and optional where possible. Droplet distributions, terrain metadata, profile diagnostics, and richer microphysics outputs should not break existing scalar field consumers.

## Diagnostics Boundary

Diagnostics explain behavior; they should not be buried in renderers or solvers unless they are explicit modeled outputs.

Examples:

- LCL / expected cloud base
- first cloud time
- cloud-top height
- mixed-layer depth
- RH profile
- water budget
- first rain time
- droplet distribution summaries
- scenario expected / observed / status

Diagnostics should be usable by the UI, tests, saved run artifacts, and comparison workflows.

## Visualization Boundary

The renderer consumes physical fields and diagnostics. It does not change solver state.

Visualization modes may include:

- scientific 2-D field view
- cloud appearance view using labeled bulk optical approximations
- 2.5-D visual extrusion view from 2-D fields
- comparison views

Visualizations must label whether they show solver output, derived diagnostics, bulk approximations, or visual approximations.

## Workbench V2 Direction

Workbench V2 is the clean-slate frontend architecture for the lab-driven product.

See:

- `docs/workbench-v2-product-spec.md`
- `docs/workbench-v2-architecture.md`
- `docs/architecture-decisions/ADR-001-lab-driven-product.md`

The current frontend should be treated as a prototype that proved capabilities. Future frontend work should not preserve old dashboard structure merely for code reuse if it conflicts with the lab-driven product model.

## Live Frame Streaming

Cloud Lab supports local run streaming through:

- `POST /simulations/runs`
- `POST /simulations/runs/{run_id}/stop`
- `WebSocket /simulations/runs/{run_id}/stream`

Expected responsibilities:

- simulation core produces deterministic frame data from configuration and seed
- backend serializes frames and handles run/connection lifecycle
- frontend visualizes frames and manages user workflows
- frame schemas remain stable enough for tests, docs, replay, saved runs, and comparison to evolve independently

## Why Start With 2-D Vertical Slices

Cloud Lab starts with 2-D vertical slice modeling because it gives a useful first view of cloud formation while keeping compute cost, debugging complexity, and visualization scope reasonable on a local Mac.

A 2-D slice can show surface heating, buoyant plumes, moisture fields, condensation regions, vertical motion, terrain cross-sections, and layered atmospheric structure without requiring a full 3-D fluid solver.

2.5-D visualization can make those fields feel spatial before the project attempts true 3-D dynamics.

## Future Hard-Core Modeling

Cloud Lab should be architected so more serious physics can be added later without rewriting the product.

Future high-fidelity models should plug into the lab/scenario/frame/diagnostic/visualization pipeline. They should not require the UI to become a solver-specific research interface unless a specific lab intentionally exposes that detail.

## Durable Rule

> Solver outputs physical fields. Renderer turns fields into views. UI controls experiments. Diagnostics explain behavior. Documentation explains assumptions. Tests protect the science.

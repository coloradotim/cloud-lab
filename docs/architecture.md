# Architecture

Cloud Lab starts as a local browser application with a Python backend and a React frontend. The early architecture keeps the simulation core independent from API and rendering concerns so physics work can be tested and improved without rewriting the app shell.

## High-Level Shape

```text
React + Vite frontend
  |
  | HTTP now, WebSocket frames later
  v
FastAPI backend
  |
  | plain configuration and frame schemas
  v
Python simulation core
```

## Backend And Frontend Boundary

The frontend owns browser interaction, controls, and visualization. It calls backend endpoints for health, simulation setup, and eventually live simulation frames. It should not contain solver logic or mutate simulation state directly.

The backend owns transport, validation, run orchestration, and future WebSocket streaming. It wraps the simulation core through explicit request and frame schemas. API route handlers should stay thin and should not accumulate physics rules.

## Simulation-Core Boundary

The simulation core lives under `backend/app/sim`. It must remain importable and testable without FastAPI, React, browser APIs, or network state.

The core exposes plain, documented configuration and output models. `SimulationConfig` defines `solver_type`, domain, grid, timestep, initial atmosphere, heating, wind, and seed controls. `SimulationFrame` carries grid metadata and unit-bearing scalar fields that can be serialized for HTTP or WebSocket transport without frontend-specific coupling.

Every physical field must document units, expected shape, and whether the value is physically meaningful or illustrative. The current sample frame is a deterministic schema sample, not a serious cloud solver.

## Live Frame Streaming

The backend already reserves `/ws/simulations/{run_id}` as the future live-frame boundary. A later milestone will use that endpoint to stream stable frame envelopes to the frontend while a simulation run advances.

Expected live-frame responsibilities:

- The simulation core produces deterministic frame data from a configuration and seed.
- The backend serializes frames and handles connection lifecycle.
- The frontend visualizes frames and sends explicit control messages when needed.
- Frame schemas remain stable enough for tests, docs, and visualization layers to evolve independently.

## Why Start With 2-D Vertical Slices

Cloud Lab starts with 2-D vertical slice modeling because it gives a useful first view of fair-weather cumulus behavior while keeping compute cost, debugging complexity, and visualization scope reasonable on a local Mac.

A 2-D slice can show surface heating, buoyant plumes, moisture fields, condensation regions, and simple vertical motion without requiring a full 3-D fluid solver. This keeps the first physics milestones reviewable while leaving room to level up toward 2.5-D and 3-D dynamics.

Solver dispatch lives in `backend/app/sim/solver.py`. Concrete backends conform to the solver interface in `backend/app/sim/solver_interface.py`: each backend exposes a descriptor plus `run(config)` and `stream_frames(config)` methods that emit the shared `SimulationFrame` schema.

The current available backend is `educational_2d`, implemented in `backend/app/sim/educational_2d.py`. It is frozen as a learning, UI-validation, and regression-test solver rather than the future production scientific model. The registry also advertises a planned `boussinesq_2d` backend so the API and UI can evolve toward better dynamics without changing the frame contract.

Live playback uses `POST /simulations/runs` for run creation, `POST /simulations/runs/{run_id}/stop` for cancellation, and `WebSocket /simulations/runs/{run_id}/stream` for progressive frame delivery.

The first visualization dashboard renders streamed frames on a frontend canvas. Rendering helpers live in `frontend/src/visualization.ts` and the React canvas view lives in `frontend/src/ScientificDashboard.tsx`; neither layer reaches into backend solver internals.

# Live Simulation Streaming

Cloud Lab supports live local playback through an HTTP run lifecycle API plus a WebSocket frame stream.

## Architecture

The simulation core remains independent from transport. Backend API code creates and manages run records, while `backend/app/sim/streaming.py` steps the solver and serializes each frame through the shared `SimulationFrame` schema.

```text
Frontend controls
  |
  | POST /simulations/runs
  v
Run manager creates metadata
  |
  | WebSocket /simulations/runs/{run_id}/stream
  v
Solver frames streamed progressively
  |
  | POST /simulations/runs/{run_id}/stop
  v
Run manager requests graceful stop
```

## Run Lifecycle

1. Browser starts a run with `POST /simulations/runs`.
2. Backend returns run metadata, including `run_id`, duration, frame cadence, and initial status.
3. Browser opens `WebSocket /simulations/runs/{run_id}/stream`.
4. Stream sends one `metadata` message.
5. Stream sends `frame` messages as the solver advances.
6. Stream sends `complete`, `stopped`, or `error`.

Run statuses are:

- `created`
- `running`
- `completed`
- `stopped`
- `cancelled`
- `failed`

## Message Types

Metadata:

```json
{ "type": "metadata", "run": { "run_id": "...", "status": "running" } }
```

Frame:

```json
{ "type": "frame", "run_id": "...", "frame": { "schema_version": "sim-frame-v1" } }
```

Terminal messages:

```json
{ "type": "complete", "run": { "status": "completed" } }
{ "type": "stopped", "run": { "status": "stopped" } }
{ "type": "error", "message": "..." }
```

Frames remain frontend-neutral JSON from `SimulationFrame.to_transport_dict()`.

## Cancellation Behavior

`POST /simulations/runs/{run_id}/stop` sets a stop flag on the run. The active stream checks that flag between solver steps and emits a final `stopped` message. Already-computed frames may arrive before the stopped message; the frontend treats `stopped` as the authoritative terminal state.

If the browser disconnects, the stream marks the run `cancelled`.

## Current Frontend Controls

The first playback UI includes:

- start
- stop
- reset
- progress bar
- frame count
- progress percentage
- frame rate
- max cloud water
- max updraft

This is intentionally a playback shell. Field visualization layers will be added later.

## Scaling Limits

The current run manager is in memory and intended for one local developer session. It does not persist runs, replay stored frames, coordinate multiple workers, or recover streams after backend restart.

The solver uses Python lists and streams small frame grids. Larger grids, shorter frame cadence, or multiple simultaneous runs may need batching, frame thinning, binary transport, worker tasks, or persisted replay storage.

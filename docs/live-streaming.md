# Live Simulation Streaming

Cloud Lab supports local experiment playback through an HTTP run lifecycle API plus a WebSocket frame stream.

Streaming is infrastructure for labs. It should serve the product loop:

```text
Choose lab → choose scenario → adjust physical controls → run → watch → inspect → save/compare → vary → learn
```

The streaming layer should not know whether a run belongs to Lower Atmosphere Cloud Basics, Warm Rain, Orographic Clouds, or a future lab. It should accept a validated configuration, stream versioned frames, and leave interpretation to diagnostics, visualization, saved-run artifacts, and comparison workflows.

## Architecture

The simulation core remains independent from transport. Backend API code creates and manages run records, while `backend/app/sim/streaming.py` steps the selected physics core and serializes each frame through the shared `SimulationFrame` schema.

```text
Lab/scenario workbench controls
  |
  | POST /simulations/runs
  v
Run manager creates metadata
  |
  | WebSocket /simulations/runs/{run_id}/stream
  v
Physics core frames streamed progressively
  |
  | POST /simulations/runs/{run_id}/stop
  v
Run manager requests graceful stop
```

## Run Lifecycle

1. Browser selects a lab/scenario and prepares a `SimulationConfig`.
2. Browser starts a run with `POST /simulations/runs`, optionally sending a `SimulationConfig` request body.
3. Backend validates the config and returns run metadata, including `run_id`, duration, frame cadence, and initial status.
4. Browser opens `WebSocket /simulations/runs/{run_id}/stream`.
5. Stream sends one `metadata` message.
6. Stream sends `frame` messages as the selected physics core advances.
7. Stream sends `complete`, `stopped`, or `error`.

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

## Frontend Use

The current prototype frontend uses streaming for live playback, replay buffering, saved run artifacts, and scenario comparison. Workbench V2 should preserve the same transport boundary but present it through labs and scenarios.

Workbench V2 should treat streaming as:

- one run lifecycle per experiment
- buffered frames for replay and inspection
- source data for diagnostics
- source data for saved run artifacts
- source data for comparison modes

Simulation Run/Stop controls belong in the top-level workbench controls. Replay controls operate on buffered frames and should be visually distinct from simulation lifecycle controls.

## Saved Runs And Comparison

A saved run artifact may store sampled frames and diagnostics derived from streamed frames. This is separate from the run lifecycle API. The run API produces the stream; saved-run logic decides what to preserve locally.

Comparison may run two configs or load two saved run artifacts. Where possible, comparison should synchronize by simulation time rather than raw frame index.

## Scaling Limits

The current run manager is in memory and intended for a local developer/user session. It does not coordinate multiple workers or recover streams after backend restart.

The solver uses Python data structures and streams small-to-moderate frame grids. Larger grids, shorter frame cadence, multiple simultaneous runs, parameter sweeps, true 3-D models, or heavy microphysics may need batching, frame thinning, binary transport, worker tasks, or persisted replay storage.

Those improvements should be introduced when a lab requires them, not as abstract infrastructure work.

## Durable Rule

Streaming is transport. It should not contain cloud physics, rendering assumptions, or lab-specific interpretation.

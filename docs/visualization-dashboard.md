# Scientific Visualization Dashboard

Cloud Lab's first scientific dashboard renders streamed `SimulationFrame` data in the browser with a canvas-based 2-D vertical slice view.

## Rendering Architecture

The frontend keeps rendering separate from solver and API concerns:

- `App.tsx` owns API/WebSocket lifecycle, frame buffering, playback status, and high-level controls.
- `simulationTypes.ts` defines the frontend view of the shared frame schema.
- `visualization.ts` contains pure helper logic for field option mapping, ranges, color mapping, and cursor-to-grid conversion.
- `ScientificDashboard.tsx` renders scalar fields and velocity vectors onto a canvas.

Solver code still lives only in the backend. The dashboard consumes serialized `SimulationFrame` JSON and field metadata.

## Field Visualization Approach

The dashboard supports field switching for any scalar field present in a frame. Known fields are ordered so cloud water, water vapor, temperature, and velocity fields are easy to reach first, while future fields can still appear without hardcoded rendering branches.

Current scalar rendering:

- draws a row-major `x-z` field onto a canvas
- displays the lowest `z` row at the bottom of the plot
- uses field `display_scale` metadata when present
- falls back to observed min/max range when metadata is absent
- converts absolute temperature from Kelvin transport values to Celsius for browser display
- overlays sampled velocity vectors from horizontal and vertical velocity fields

The field readout shows time, buffered frames, displayed frame index, range, local probe value, and local velocity. Hover/cursor inspection maps canvas coordinates back to grid row/column and physical `x`/`z` coordinates.

## Playback Controls

The dashboard adds:

- field selection
- pause/resume
- playback speed
- timeline scrubber
- live progress from streamed frames
- frame rate and field summary readouts

Pausing affects displayed playback, not backend simulation execution. Frames may continue buffering while the displayed frame is paused.

## Known Limitations

- Canvas rendering is 2-D only.
- Color maps are simple built-in approximations.
- Velocity vectors are sampled arrows, not streamlines.
- The frontend buffers frames in memory for the current local run.
- Pause/resume does not yet send flow-control messages to the backend.
- The dashboard does not yet render multiple synchronized panels at once.
- Accessibility is limited to controls and text readouts; the canvas itself needs richer non-visual summaries later.

## Future Level-Up Path

Good next steps:

- Add side-by-side panels for cloud water, vapor, temperature, and velocity.
- Add buoyancy and condensation overlays when those fields are emitted.
- Add better perceptual color maps and legends.
- Add replay/export support backed by persisted frames.
- Move heavy rendering to `OffscreenCanvas` or WebGL if grid sizes grow.
- Add streamlines, probes, and scientific annotations.
- Prepare a rendering abstraction that can evolve toward 2.5-D and 3-D views without changing solver output contracts.

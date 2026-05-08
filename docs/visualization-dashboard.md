# Scientific Visualization Dashboard

Cloud Lab's first scientific dashboard renders streamed `SimulationFrame` data in the browser with a canvas-based 2-D vertical slice view.

## Rendering Architecture

The frontend keeps rendering separate from solver and API concerns:

- `App.tsx` owns API/WebSocket lifecycle, frame buffering, playback status, and high-level controls.
- `simulationTypes.ts` defines the frontend view of the shared frame schema.
- `visualization.ts` contains pure helper logic for field option mapping, ranges, color mapping, and cursor-to-grid conversion.
- `probe.ts` maps frame fields into solver-neutral point and neighborhood diagnostics.
- `ScientificDashboard.tsx` renders scalar fields and velocity vectors onto a canvas.

Solver code still lives only in the backend. The dashboard consumes serialized `SimulationFrame` JSON and field metadata.

## Field Visualization Approach

The dashboard supports field switching for any scalar field present in a frame. Known fields are ordered so cloud water, water vapor, temperature, and velocity fields are easy to reach first, while future fields can still appear without hardcoded rendering branches.

Current scalar rendering:

- draws a row-major `x-z` field onto a canvas
- displays the lowest `z` row at the bottom of the plot
- uses field-aware display scaling rather than one generic min/max rule
- renders condensate fields such as cloud water with logarithmic scaling so early small values remain visible
- renders velocity fields with a symmetric zero-centered scale so upward/downward or left/right motion stays interpretable
- renders temperature with an adaptive observed range after Celsius conversion
- converts absolute temperature from Kelvin transport values to Celsius for browser display
- overlays sampled velocity vectors from horizontal and vertical velocity fields

The cloud liquid water display scale is tuned for the current toy solver's small condensate values, so early fair-weather condensation is visible before the model reaches unrealistically large liquid-water amounts.

## Probe Diagnostics

Probe mode consumes only the shared `SimulationFrame` contract. Hovering the canvas updates an immediate probe, and clicking pins the current cell so values continue to update as playback advances. The probe can sample either the exact cell or a 3x3 neighborhood mean.

The canvas is the stable inspection stage. Probe details live in a right-side readout
panel with its own scroll area on wider screens, so pinning, clearing, or updating a
probe does not resize the plot or create blank space beneath it. On narrow screens the
readout stacks below the canvas.

The readout separates three concepts:

- run/frame metadata, such as time, buffered frames, and displayed frame
- field summaries, such as selected field and field max or min/max
- probe values, such as point coordinates and point/neighborhood diagnostics

The probe readout currently displays:

- absolute temperature, converted from K to deg C for display
- relative humidity, derived from temperature and water vapor using the V1 saturation approximation
- water vapor
- cloud liquid water
- horizontal velocity
- vertical velocity
- approximate buoyancy, derived from `temperature_perturbation_k` when that field is emitted

Missing fields are shown as "Not emitted" instead of failing the dashboard. This keeps probe behavior compatible with future solver backends that may emit different diagnostics.

Relative humidity and buoyancy are derived diagnostics. They are useful for inspecting the current educational model, but they should not be treated as full physical diagnostics from a pressure-coupled or validated cloud model.

## Field Summaries

Field summaries are computed in the frontend from the displayed frame. They do not
change solver output or transport values.

Signed fields such as temperature perturbation and velocity display `Field min / max`
because sign is physically meaningful. Absolute temperature is converted from Kelvin
transport values to Celsius for display. Condensate fields such as cloud liquid water
and rain water display `Field max` when their minimum is below the display-noise
threshold. This prevents roundoff-like tails such as `5e-73 kg kg-1` from being shown
as meaningful cloud-water minima while preserving the useful maximum.

Current condensate display-noise thresholds:

- cloud liquid water: `1e-8 kg kg-1`
- rain water: `1e-8 kg kg-1`

Water vapor remains eligible for ordinary min/max display because small vapor values
can be physically meaningful in dry cases.

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
- Probe diagnostics are point or 3x3 cell samples only; they are not parcel trajectories or pathlines.
- Accessibility is limited to controls and text readouts; the canvas itself needs richer non-visual summaries later.

## Future Level-Up Path

Good next steps:

- Add side-by-side panels for cloud water, vapor, temperature, and velocity.
- Add buoyancy and condensation overlays when those fields are emitted.
- Add better perceptual color maps and legends.
- Add replay/export support backed by persisted frames.
- Move heavy rendering to `OffscreenCanvas` or WebGL if grid sizes grow.
- Add streamlines, parcel/pathline probes, sounding/profile extraction, and scientific annotations.
- Prepare a rendering abstraction that can evolve toward 2.5-D and 3-D views without changing solver output contracts.

# Scientific Visualization Dashboard

Cloud Lab's first scientific dashboard renders streamed `SimulationFrame` data in the browser with a canvas-based 2-D vertical slice view.

Visualization tests should preserve truthful interpretation of solver fields
without encoding solver state in the renderer. See
the [testing and validation plan](testing-and-validation.md) for the broader
distinction between contract, scenario, diagnostic, and visualization checks.

## Truth / Confidence Labels

Cloud Lab labels displayed values and views by what they represent:

- `Solver output`: emitted directly by the selected solver.
- `Derived diagnostic`: computed from solver fields or configuration assumptions,
  such as relative humidity, estimated LCL, cloud-base markers, or approximate
  buoyancy.
- `Bulk approximation`: physically motivated simplified bulk-model output, such
  as controlled parcel/box microphysics or future bulk rain indicators.
- `Visual approximation`: rendering interpretation of fields rather than a
  solver-emitted field, such as future optical-depth cloud appearance.
- `Prescribed forcing`: imposed input rather than predicted dynamics, such as
  `microphysics_lab` vertical lift.
- `Experimental`: available for exploration but not quantitatively validated,
  including the current Boussinesq dynamics scaffold.

Labels should be short in the UI and paired with tooltips or helper text that
explain limitations. New fields, diagnostics, rendering modes, and solver modes
should add metadata in the frontend visualization helpers rather than one-off
copy in individual components.

## Rendering Architecture

The frontend keeps rendering separate from solver and API concerns:

- `App.tsx` owns API/WebSocket lifecycle, frame buffering, playback status, and high-level controls.
- `simulationTypes.ts` defines the frontend view of the shared frame schema.
- `visualization.ts` contains pure helper logic for field option mapping, ranges, color mapping, and cursor-to-grid conversion.
- `probe.ts` maps frame fields into solver-neutral point and neighborhood diagnostics.
- `sounding.ts` derives vertical profiles and LCL/boundary-layer markers from the displayed frame.
- `microphysicsDiagnostics.ts` derives parcel/box water-budget and timing summaries from buffered frames.
- `scenarioDiagnostics.ts` compares buffered frames against built-in scenario
  expectations and returns deterministic expected/observed/status notes.
- `ScientificDashboard.tsx` renders scalar fields and velocity vectors onto a canvas.
- `MicrophysicsDiagnosticsPanel.tsx` renders the `microphysics_lab` summary and optional droplet histogram.

Solver code still lives only in the backend. The dashboard consumes serialized `SimulationFrame` JSON and field metadata.

## Primary Action Bar

The main app keeps core workflow actions visible in a top action bar:

- scenario selection
- setup visibility
- start/stop/reset
- compact run status and progress
- compact backend online/offline state
- inspector visibility
- developer/system drawer visibility

Scenario selection and run controls should not be buried inside setup or
inspector panels. Later workbench layout changes can move panels around, but the
primary action bar remains the discoverable path for choosing an experiment,
starting or stopping a run, and finding analysis views.

## Canvas-First Workbench Shell

The main app layout is organized around the visualization rather than a long
stacked page. The workbench has three regions:

- setup: collapsible scenario/config controls
- stage: the scientific canvas plus replay/playback controls and saved run
  artifacts
- inspector: collapsible Profile, Probe, Diagnostics, and Microphysics tabs

On wide screens setup and inspector can flank the canvas. On narrower screens
they stack without changing the run, replay, probe, profile, or microphysics
data flow. Backend/schema/sample-run details live in the secondary
developer/system drawer so they are available for troubleshooting without
occupying the normal cloud-experiment workflow.

Responsive behavior is intentionally pragmatic rather than phone-first:

- wide desktop: setup and inspector can dock beside the canvas; if both are
  open at intermediate widths, the inspector moves below the stage with its own
  scroll area.
- laptop / medium width: the workbench stacks to preserve canvas width, while
  the top action bar wraps scenario, run controls, status, and system access
  into reachable rows.
- narrow screens: setup, inspector, playback, and developer details stack
  full-width; controls wrap rather than disappearing, and the canvas keeps a
  minimum useful height.

The setup drawer is scenario-first. It starts with a scenario card describing
the selected experiment's phenomenon, expected outcome, diagnostics, and known
limitations, then shows basic controls, atmosphere/moisture controls,
surface/motion forcing, saved experiments, and collapsed advanced model
settings. Scenario selection and run controls remain in the top action bar so
they are not hidden inside the drawer.

The stage also owns saved run artifacts. This keeps run-specific evidence near
the replay timeline: users can save the current buffered run with optional
notes, load a sampled replay snapshot, or inspect the saved diagnostics summary
without opening setup or developer panels. Saved run artifacts are distinct from
saved experiments; experiments describe how to run a setup again, while run
artifacts describe what happened in one run.

The scenario comparison panel is also part of the stage. It supports two
comparison paths:

- run two built-in scenarios side by side, with scenario B aligned to scenario
  A's domain, grid, runtime, and frame cadence
- load two saved run artifacts and inspect their sampled replay frames and
  diagnostics

Comparison playback is synchronized by simulation time rather than frame index.
When one run has fewer frames or a shorter sampled replay, the shared timeline is
limited to the overlapping final time. Scalar fields use a shared display range
across both canvases so differences in color intensity represent differences in
the underlying field, not independent autoscaling.

## Developer / System Drawer

The top action bar shows compact backend state alongside run progress. Detailed
system information is behind the `System` drawer:

- backend health and API base URL
- sample frame schema summary
- sample run summary
- public solver catalog details

The drawer is intended for local development and troubleshooting. Offline
backend state remains visible in the top bar so users can still tell why runs
cannot start even when the drawer is closed.

## Field Visualization Approach

The dashboard supports field switching for any scalar field present in a frame. Known fields are ordered so cloud water, water vapor, temperature, and velocity fields are easy to reach first, while future fields can still appear without hardcoded rendering branches.

Field scaling is centralized so the dashboard does not exaggerate numerical
noise or hide meaningful structure.

| Field or view | Scale | Range | Sign handling | Noise threshold | Comparison behavior |
| --- | --- | --- | --- | --- | --- |
| Cloud liquid water | Log | Adaptive | Non-negative | `1e-8 kg kg-1` | Shared scale by default |
| Rain water | Log | Adaptive | Non-negative | `1e-8 kg kg-1` | Shared scale by default |
| Water vapor | Linear | Metadata/default when available | Non-negative | none | Shared scale by default |
| Absolute temperature | Linear | Padded adaptive, displayed in `deg C` | Non-negative | none | Shared scale by default |
| Temperature perturbation | Linear | Symmetric around zero | Signed | none | Shared scale by default |
| Horizontal velocity | Linear | Symmetric around zero | Signed | none | Shared scale by default |
| Vertical velocity | Linear | Symmetric around zero | Signed | none | Shared scale by default |
| Bulk cloud appearance | Log/optical response | Adaptive/default | Non-negative | `1e-4 optical depth` | Shared scale by default |

Non-negative condensate fields suppress tiny values below the display-noise
threshold so values such as `1e-73 kg kg-1` are not presented as meaningful
cloud or rain. Signed fields use zero-centered ranges so weak positive and
negative motion are comparable. Side-by-side comparison views should share
scales for the same field by default; if an independent adaptive scale is added
later, the UI must label that clearly.

Current scalar rendering:

- draws a row-major `x-z` field onto a canvas
- displays the lowest `z` row at the bottom of the plot
- uses field-aware display scaling rather than one generic min/max rule
- renders condensate fields such as cloud water with logarithmic scaling so early small values remain visible
- renders velocity fields with a symmetric zero-centered scale so upward/downward or left/right motion stays interpretable
- renders temperature with an adaptive observed range after Celsius conversion
- converts absolute temperature from Kelvin transport values to Celsius for browser display
- overlays sampled velocity vectors from horizontal and vertical velocity fields

The cloud liquid water display scale is tuned for prototype solver condensate
values, so delayed fair-weather condensation is visible before the model reaches
unrealistically large liquid-water amounts.

## Bulk Cloud Appearance Mode

The dashboard includes a `Cloud appearance` visualization mode when frames emit
`cloud_liquid_water_kg_per_kg`. This is a visual approximation, not a new solver
field. It estimates optical depth from:

- bulk cloud liquid water mixing ratio
- approximate grid path length
- assumed air density
- assumed liquid-water density
- assumed effective droplet radius, currently `12 um`

The approximation uses the common bulk relationship:

```text
optical depth ~= 3 * liquid water content * path length / (2 * water density * effective radius)
```

Dense cloud regions become more opaque, optically thick lower/interior regions
darken slightly, and cloud edges receive a simple brightness boost. This makes
cloud structures easier to inspect than a raw scalar heatmap while keeping the
label explicit: it is not droplet-resolved Mie scattering, not radiative
transfer, and not a microphysics result. Droplet-aware optics can replace or
improve this helper when future solvers emit effective radius or droplet-size
distributions.

## Tabbed Inspector

The inspector groups analysis views into tabs so the canvas can stay centered
while secondary diagnostics remain discoverable:

- `Profile`: vertical sounding and thermodynamic markers for the pinned column
  or domain average.
- `Probe`: hovered or pinned point/neighborhood diagnostics from the canvas.
- `Diagnostics`: scenario expectation and observed-behavior notes.
- `Microphysics`: parcel/box and droplet summaries for microphysics frames.

Pinning a probe opens the inspector and selects the `Probe` tab. This is a UI
routing change only; the probe, profile, diagnostics, and microphysics panels
still consume serialized frame data and do not change solver state.

## Probe Diagnostics

Probe mode consumes only the shared `SimulationFrame` contract. Hovering the canvas updates an immediate probe, and clicking pins the current cell so values continue to update as playback advances. The probe can sample either the exact cell or a 3x3 neighborhood mean.

The canvas is the stable inspection stage. Probe details live in the inspector
`Probe` tab with its own scroll area on wider screens, so pinning, clearing, or
updating a probe does not resize the plot or create blank space beneath it. On
narrow screens the inspector stacks below the canvas.

The workbench separates four analysis concepts:

- run/frame metadata, such as time, buffered frames, and displayed frame
- field summaries, such as selected field and field max or min/max
- probe values, such as point coordinates and point/neighborhood diagnostics
- scenario/profile/microphysics analysis, each in its own inspector tab

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

## Scenario Diagnostics

The expected/observed scenario panel consumes the selected built-in scenario,
current config, and buffered frames. It surfaces deterministic checks such as:

- no cloud yet versus cloud by configured runtime
- immediate surface-attached cloud
- boundary-dominated cloud water
- multiple cloud regions in multi-thermal scenarios
- dry failed cumulus motion without significant cloud
- microphysics no-lift cloud/rain control behavior

Statuses are intentionally qualitative: `plausible`, `warning`,
`failed_expectation`, or `not_evaluated`. Warnings are visible diagnostics for
prototype behavior that may later become hard validation thresholds. The panel
does not modify solver state and does not replace backend science validation.

The comparison table reuses these diagnostics where possible and reports
first-cloud time, max cloud water, cloud-top height, first rain, max rain water,
max updraft, and estimated LCL. Deltas are reported as run B minus run A; missing
diagnostics are shown as not observed rather than forced to zero.

## Sounding / Profile View

The vertical profile panel displays the current frame as a compact column sounding.
When a probe is pinned in the 2-D field view, the profile uses that x-column. When
no probe is pinned, it falls back to a domain-average profile.

Initial profile fields include:

- absolute temperature, displayed in deg C
- derived relative humidity
- water vapor
- cloud liquid water
- rain water when emitted
- vertical and horizontal velocity when emitted

The panel also shows markers for estimated LCL, boundary-layer top, and moist-source
top when the config is available. These markers are diagnostics for interpretation;
they do not modify the solver state.

For `microphysics_lab`, the profile panel explains that the solver is a 0-D
parcel/box mode broadcast over the shared grid. This keeps the view useful without
implying resolved horizontal structure.

## Microphysics Lab Diagnostics

The current `microphysics_lab` solver emits a controlled 0-D parcel/box state through
the same 2-D frame schema used by the rest of the app. Its spatial plots are therefore
uniform by design. The dashboard shows a separate microphysics diagnostics panel when
`microphysics_lab` is selected or when frames include an optional `microphysics`
payload.

The panel derives:

- initial and final temperature
- initial and final water vapor
- final cloud liquid water and rain water
- prescribed vertical velocity and implied parcel height
- first cloud-water time
- peak cloud-water amount and time
- first rain-water time and peak rain amount
- maximum relative-humidity proxy
- total-water budget drift

The total-water budget uses frame-mean values:

```text
water vapor + cloud liquid water + rain water
```

For the current broadcast parcel this is equivalent to reading any cell, but using a
mean keeps the helper tolerant of later regional or gridded microphysics outputs.

If an optional droplet-size distribution is present under the proposed
`microphysics.global_distribution` payload, the panel shows a histogram for the
displayed frame. If the payload is absent, the panel shows a clear empty state instead
of failing the dashboard.

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

The dashboard keeps the live simulation stream separate from buffered replay.
Incoming frames are stored in browser memory for the current run. Scrubbing,
stepping, or jumping through those buffered frames changes only the displayed
frame; it does not restart the solver or request frames again.

The dashboard adds:

- field selection
- pause/resume
- playback speed
- jump to first/final frame
- step backward/forward one frame
- restart replay from the first buffered frame
- timeline scrubber
- displayed time / final time
- displayed frame index / total frames
- live stream vs buffered/completed replay status
- optional event jump targets for first cloud, max cloud water, first rain, and
  max rain water when those fields are present
- live progress from streamed frames
- frame rate and field summary readouts

Pausing affects displayed playback, not backend simulation execution. Frames may
continue buffering while the displayed frame is paused. Pinned probes, vertical
profiles, and microphysics panels consume the currently displayed frame, so they
update as the user scrubs through the buffered run.

Current replay limitations:

- replay frames are memory-only and disappear when the run/config is reset
- there is no persistent replay file or export format yet
- large runs are bounded by browser memory rather than a streaming archive
- event jump targets are simple field-threshold scans over buffered frames

## Known Limitations

- Canvas rendering is 2-D only.
- Color maps are simple built-in approximations.
- Velocity vectors are sampled arrows, not streamlines.
- The frontend buffers frames in memory for the current local run.
- Pause/resume does not yet send flow-control messages to the backend.
- The dashboard does not yet render multiple synchronized panels at once.
- Probe diagnostics are point or 3x3 cell samples only; they are not parcel trajectories or pathlines.
- Current microphysics summaries are global/per-frame; probe or regional droplet distributions remain future work.
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

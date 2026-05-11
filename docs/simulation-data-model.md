# Simulation Data Model

Cloud Lab uses explicit data models for simulation configuration, frame output, saved artifacts, diagnostics, and future microphysics payloads.

The data model exists to support labs:

```text
Lab / scenario definition
  ↓
SimulationConfig
  ↓
Physics core
  ↓
SimulationFrame
  ↓
Diagnostics / visualization / saved runs / comparison
```

The goal is to keep solvers, API transport, diagnostics, saved runs, and frontend visualization aligned around documented contracts without making the UI depend on solver internals.

Schema and solver-catalog expectations are contract tests under the [testing and validation plan](testing-and-validation.md). Update that plan when the public/default solver contract, lab/scenario config format, saved artifact format, or frame schema changes.

## Configuration Schema

`SimulationConfig` is versioned with `schema_version = "sim-config-v1"`.

A `SimulationConfig` is not the whole product definition. In Workbench V2, labs and scenarios should create or adapt configs. The config remains the backend execution contract; the lab/scenario definitions provide user-facing meaning.

| Section | Field | Unit | Notes |
| --- | --- | --- | --- |
| root | `solver_type` | identifier | Selects the simulation backend. The default and public 2-D cloud solver is `boussinesq_2d`; `microphysics_lab` is a controlled parcel/box microphysics mode; `educational_2d` remains available only for explicit legacy configs and regression tests. |
| `domain` | `width_m` | m | Horizontal domain width. Must be positive. |
| `domain` | `height_m` | m | Vertical domain height. Must be positive. |
| `grid` | `columns` | count | Horizontal grid cell count. Must be greater than 1. |
| `grid` | `rows` | count | Vertical grid cell count. Must be greater than 1. |
| `time` | `time_step_seconds` | s | Numerical timestep. Must be positive. |
| `time` | `duration_seconds` | s | Total simulated duration. Must be at least one timestep. |
| `time` | `frame_interval_seconds` | s | Emitted frame cadence. Must be at least one timestep. |
| `initial_atmosphere` | `surface_temperature_k` | K | Initial near-surface air temperature. |
| `initial_atmosphere` | `lapse_rate_k_per_m` | K m-1 | Environmental temperature decrease with height above the mixed layer. |
| `initial_atmosphere` | `relative_humidity` | fraction | Initial humidity from 0 to 1. |
| `initial_atmosphere` | `boundary_layer_depth_m` | m | Must not exceed domain height. |
| `initial_atmosphere` | `moist_source_layer_depth_m` | m | Depth of the near-surface moist source layer. Must not exceed the boundary-layer depth or domain height. |
| `initial_atmosphere` | `free_atmosphere_relative_humidity` | fraction | RH used above the moist source layer for source-layer-aware profiles. |
| `initial_atmosphere` | `humidity_profile` | identifier | Structured humidity pattern. Current options are `surface_moisture`, `uniform`, `moist_boundary_layer`, `dry_cap`, `moist_layer`, and `custom_layers`. |
| `initial_atmosphere` | `humidity_layers` | m, fraction | Optional vertical RH layers for custom structured scenarios and future painting compatibility. |
| `initial_atmosphere` | `humidity_patch` | m, fraction | Optional horizontal RH patch. |
| `surface_heating` | `max_warming_rate_k_per_s` | K s-1 | Lower-boundary warming rate. |
| `surface_heating` | `patch_center_x_m` | m | Must fit inside the domain width. |
| `surface_heating` | `patch_width_m` | m | Must be positive and no wider than the domain. |
| `surface_heating` | `pattern` | identifier | Structured lower-boundary heating pattern. Current options are `single_patch`, `two_patches`, `broad_plateau`, `weak_random`, and `custom_patches`. |
| `surface_heating` | `patches` | m, fraction | Optional custom heating patches for later painted-map workflows. |
| `background_wind` | `u_m_per_s` | m s-1 | Uniform horizontal background wind. |
| `background_wind` | `w_m_per_s` | m s-1 | Uniform vertical background wind. |
| root | `seed` | integer | Random seed for reproducible generated fields. |

## Solver Interface

Solver backends must emit the shared `SimulationFrame` schema. The API and frontend should depend on `solver_type`, descriptors, and frame fields, not concrete backend internals.

Current solver descriptors are exposed by `GET /simulations/solvers`:

- `boussinesq_2d`: available. Experimental streamfunction/vorticity solver for qualitative 2-D buoyant dynamics.
- `microphysics_lab`: available. Controlled warm-cloud parcel/box experiments with prescribed lift and bulk vapor/cloud/rain outputs broadcast through the shared frame schema.

`educational_2d` is still registered in the backend for explicit legacy configs, but it is intentionally hidden from the public solver catalog because the public Cloud Lab experience is centered on physically meaningful labs rather than the legacy teaching backend.

To add a backend, implement the solver interface, register a descriptor in the solver registry, ensure frames validate against `SimulationFrame`, and document any missing fields or approximations.

## Structured Initial Conditions

Structured controls are scenario configuration, not renderer state. The current 2-D solvers reduce them to deterministic heating weights and relative-humidity fields:

- `single_patch` preserves the legacy heating sliders.
- `two_patches` uses two horizontally separated warm patches, with the width slider controlling both.
- `broad_plateau` creates a wider, smoother central heating region.
- `weak_random` creates a seeded low-amplitude uneven heating pattern.
- `custom_patches` is the schema path for later painting and saved scenarios.

Humidity profiles work similarly:

- `surface_moisture` is the default Boussinesq-oriented profile. It keeps a moist source layer near the surface and a configurable drier free atmosphere above it.
- `uniform` preserves the scalar relative-humidity slider.
- `moist_boundary_layer` moistens the mixed layer and slightly dries the air above.
- `dry_cap` places a dry layer near the boundary-layer top.
- `moist_layer` adds an elevated moist layer around and above the boundary-layer top.
- `custom_layers` is the schema path for later explicit layer editing and painting.

If a solver cannot consume a full map directly, it should document the reduction. The current `microphysics_lab` parcel/box mode still uses the scalar initial humidity and heating controls because it has no resolved horizontal or vertical grid dynamics.

## Frame Schema

`SimulationFrame` is versioned with `schema_version = "sim-frame-v1"` and is safe to serialize with `to_transport_dict()` for HTTP or WebSocket transport.

Each frame contains:

- `step`: zero-based step index.
- `time_seconds`: simulated time for the frame.
- `config`: the configuration that produced the frame.
- `grid`: row/column counts plus cell-center `x_coordinates_m` and `z_coordinates_m`.
- `fields`: row-major 2-D scalar fields.

Every field must match `grid.rows x grid.columns`. Tests reject rectangular mismatches and missing unit metadata.

Future droplet-size distribution and microphysics diagnostics are proposed as an optional frame-level `microphysics` payload rather than required scalar fields. See `docs/microphysics-schema.md` for the proposed schema shape, payload-size guardrails, and migration path.

## Saved Run Artifact Schema

Saved run artifacts are frontend-local records stored separately from saved scenario configs. A saved scenario is a reusable setup recipe; a saved run artifact is an observation record for one completed or buffered run.

Saved run artifacts use `schema_version = "saved-run-artifact-v1"` and contain:

- identity: `id`, `kind = "run_artifact"`, name, notes, and creation timestamp
- scenario reference: built-in scenario slug/name when the run came from one
- schema references: config schema version and emitted frame schema version
- provenance: solver type, app version, backend version when known
- normalized `SimulationConfig`
- run summary: configured duration, frame count, final time, displayed time
- diagnostics summary: scenario status, expected/observed text, cloud/rain timing, cloud height, max cloud water, max updraft, LCL estimate, and notes
- replay metadata: total frame count, stored frame count, sampling stride, and truncation flag
- sampled frames: up to a bounded subset of emitted `SimulationFrame` records

The browser stores sampled frames pragmatically to keep localStorage from becoming a database. If serialized artifacts grow too large, the app falls back to metadata-only artifacts with no stored replay frames. Loading a metadata-only artifact still restores the config and diagnostics summary, but the run cannot be replayed frame-by-frame until exported run files or a stronger local storage backend exist.

## Modeled Frame Fields

| Field | Unit | Initial status |
| --- | --- | --- |
| `temperature_k` | K | Absolute air temperature initialized from a smooth mixed-layer profile. |
| `temperature_perturbation_k` | K | Departure from the initial background profile. |
| `water_vapor_kg_per_kg` | kg kg-1 | Specific humidity. |
| `cloud_liquid_water_kg_per_kg` | kg kg-1 | Cloud liquid water. |
| `rain_water_kg_per_kg` | kg kg-1 | Rain water field, zero or bulk/placeholder depending on solver support. |
| `horizontal_velocity_m_per_s` | m s-1 | Horizontal velocity. |
| `vertical_velocity_m_per_s` | m s-1 | Vertical velocity or prescribed lift depending on solver. |

Each field carries `metadata.unit`, `metadata.display_name`, `metadata.description`, and optional `metadata.display_scale` hints. Display metadata exists for visualization convenience; it is not solver state. The v1 transport contract keeps `temperature_k` in Kelvin, and the browser display layer converts temperature labels, probes, ranges, and color scaling to Celsius.

## Assumptions And Placeholders

The `/simulations/sample-frame` endpoint remains a deterministic contract sample. The `/simulations/sample-run` endpoint emits a short run so the frontend can consume time-evolving frames without knowing solver internals. Live playback streams the same frame schema through `WebSocket /simulations/runs/{run_id}/stream`.

Early placeholders intentionally include cloud liquid water and rain water even when zero so visualization and future microphysics work can depend on stable field names.

## Future Compatibility

Future PySDM, 2.5-D, and 3-D work should either preserve these v1 fields or introduce a new schema version. New modeled fields must document units in code and docs, include validation or validation notes, and keep solver internals separate from frontend rendering.

Droplet-size distributions should follow `docs/microphysics-schema.md`: keep bulk vapor/cloud/rain scalar fields for compatibility, add optional global or probe distributions for charts, use compact cell summaries for heatmaps/optics, and avoid dense per-cell spectra in live frames unless explicitly justified by performance testing.

## Durable Rule

The data model should enable labs without leaking solver internals into the UI.

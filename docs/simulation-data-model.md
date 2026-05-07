# Simulation Data Model

Cloud Lab uses explicit Pydantic models for simulation configuration and frame output. The goal is to keep solver code, API transport, and frontend visualization aligned around one documented contract.

## Configuration Schema

`SimulationConfig` is versioned with `schema_version = "sim-config-v1"`.

| Section | Field | Unit | Notes |
| --- | --- | --- | --- |
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
| `surface_heating` | `max_warming_rate_k_per_s` | K s-1 | Lower-boundary warming rate. |
| `surface_heating` | `patch_center_x_m` | m | Must fit inside the domain width. |
| `surface_heating` | `patch_width_m` | m | Must be positive and no wider than the domain. |
| `background_wind` | `u_m_per_s` | m s-1 | Uniform horizontal background wind. |
| `background_wind` | `w_m_per_s` | m s-1 | Uniform vertical background wind. |
| root | `seed` | integer | Random seed for reproducible generated fields. |

## Frame Schema

`SimulationFrame` is versioned with `schema_version = "sim-frame-v1"` and is safe to serialize with `to_transport_dict()` for HTTP or WebSocket transport.

Each frame contains:

- `step`: zero-based step index.
- `time_seconds`: simulated time for the frame.
- `config`: the configuration that produced the frame.
- `grid`: row/column counts plus cell-center `x_coordinates_m` and `z_coordinates_m`.
- `fields`: row-major 2-D scalar fields.

Every field must match `grid.rows x grid.columns`. Tests reject rectangular mismatches and missing unit metadata.

## Modeled Frame Fields

| Field | Unit | Initial status |
| --- | --- | --- |
| `temperature_k` | K | Absolute air temperature initialized from a smooth mixed-layer profile. |
| `water_vapor_kg_per_kg` | kg kg-1 | Specific humidity placeholder. |
| `cloud_liquid_water_kg_per_kg` | kg kg-1 | Cloud liquid water placeholder, initially zero. |
| `rain_water_kg_per_kg` | kg kg-1 | Rain water placeholder, initially zero for schema stability. |
| `horizontal_velocity_m_per_s` | m s-1 | Background wind with deterministic seeded jitter in sample frames. |
| `vertical_velocity_m_per_s` | m s-1 | Background vertical wind placeholder. |

Each field carries `metadata.unit`, `metadata.display_name`, `metadata.description`, and optional `metadata.display_scale` hints. Display metadata exists for visualization convenience; it is not solver state. The v1 transport contract keeps `temperature_k` in Kelvin, and the browser display layer converts temperature labels, probes, ranges, and color scaling to Celsius.

## Assumptions And Placeholders

The `/simulations/sample-frame` endpoint remains a deterministic contract sample. The `/simulations/sample-run` endpoint emits a short run from the minimal 2-D solver so the frontend can consume time-evolving frames without knowing solver internals. Live playback streams the same frame schema through `WebSocket /simulations/runs/{run_id}/stream`.

Early placeholders intentionally include cloud liquid water and rain water even when zero so visualization and future microphysics work can depend on stable field names.

## Future Compatibility

Future PySDM, 2.5-D, and 3-D work should either preserve these v1 fields or introduce a new schema version. New modeled fields must document units in code and docs, include validation or validation notes, and keep solver internals separate from frontend rendering.

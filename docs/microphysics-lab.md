# Microphysics Lab

`microphysics_lab` is a controlled warm-cloud experiment mode. It is the first
production-facing home for isolated microphysics work, separate from the
`boussinesq_2d` dynamics prototype.

## Purpose

The lab mode answers smaller questions than a full cloud model:

- how vapor, cloud liquid water, and rain water respond to prescribed lift
- when a humid parcel reaches saturation during controlled ascent
- how simple bulk saturation adjustment compares with later PySDM experiments
- how Cloud Lab should expose microphysics quantities through the existing frame API

It is intentionally not a CFD solver. The initial implementation is a 0-D parcel/box
state broadcast over the shared 2-D frame grid so the existing API, WebSocket stream,
and visualization dashboard can consume it without a schema fork.

## Solver Controls

The initial mode reuses the existing `SimulationConfig` controls:

| Config field | Lab interpretation |
| --- | --- |
| `initial_atmosphere.surface_temperature_k` | Initial parcel temperature. |
| `initial_atmosphere.relative_humidity` | Initial parcel relative humidity. |
| `background_wind.w_m_per_s` | Prescribed vertical parcel velocity. Positive values lift and cool the parcel dry adiabatically. |
| `surface_heating.max_warming_rate_k_per_s` | Uniform external temperature tendency applied to the parcel. |
| `time.*` | Parcel integration timestep, duration, and emitted frame cadence. |
| `grid.*` and `domain.*` | Output-grid shape and coordinates only; they do not create resolved dynamics. |

The horizontal velocity field is emitted as zero. The vertical velocity field is the
prescribed parcel velocity, not a Boussinesq-computed circulation.

## Current Physics

Each step applies:

- dry-adiabatic temperature change from prescribed vertical motion
- optional uniform external warming from `surface_heating.max_warming_rate_k_per_s`
- saturation adjustment between vapor and cloud liquid water
- latent heating/cooling from condensation and evaporation
- simple bulk autoconversion from cloud water to rain water above a threshold

All bulk moisture fields are clipped non-negative. Runs are deterministic; the seed is
retained for compatibility even though the initial lab model has no stochastic state.

## Differences From Other Solvers

`educational_2d` is the fast teaching and UI/debug model. It has simple 2-D visual
motion and surface-heating behavior meant to stay stable for demos and regression
tests.

`boussinesq_2d` is the experimental dynamics scaffold. It resolves a 2-D
streamfunction/vorticity flow with buoyancy and simple warm-cloud saturation
adjustment, but it is not the host for advanced microphysics yet.

`microphysics_lab` isolates microphysics. It prescribes the thermodynamic path and
does not depend on Boussinesq velocity, vorticity, pressure, or boundary treatment.

## Frame Schema

The lab mode emits normal `SimulationFrame` values:

- `temperature_k`
- `temperature_perturbation_k`
- `water_vapor_kg_per_kg`
- `cloud_liquid_water_kg_per_kg`
- `rain_water_kg_per_kg`
- `horizontal_velocity_m_per_s`
- `vertical_velocity_m_per_s`

No PySDM-specific internals are added to the generic frame schema. Future
droplet-size distribution outputs should use the optional microphysics payload
proposed in `docs/microphysics-schema.md`.

## Interpreting Runs In The UI

Because the current lab mode is 0-D, spatial plots are intentionally uniform. Use the
microphysics diagnostics panel for the meaningful result:

- initial and final parcel temperature
- initial and final water vapor
- final cloud liquid water and rain water
- prescribed vertical velocity and implied parcel height
- first cloud-water time
- peak cloud-water amount and timing
- first rain-water time and peak rain amount
- maximum relative-humidity proxy
- total-water budget drift

The water budget is computed from the bulk fields:

```text
total water = water vapor + cloud liquid water + rain water
```

Small drift is expected from numerical adjustment and display precision. Large drift
is flagged as a budget concern.

Probe values are spatially uniform for the current lab solver because the parcel/box
state is broadcast across every grid cell. This is expected, not a sign that the
microphysics failed.

The surface-heating control is interpreted as lower-boundary heating in this lab. It
tapers to zero by the configured boundary-layer top as the parcel rises, so a lifted
parcel is not heated indefinitely through the full column.

## Suggested Manual Cases

Case A: no lift / sub-saturated.
Set vertical wind to `0 m s-1`, relative humidity below saturation, and external
heating to `0 K s-1`. Expected result: no cloud water, no rain water, nearly steady
vapor, and nearly steady temperature.

Case B: lift a humid parcel.
Set relative humidity near `0.99`, vertical wind near `2 m s-1`, and external heating
to `0 K s-1`. Expected result: temperature decreases with height, vapor decreases
after saturation, and cloud liquid water appears.

Case C: strong lift / high humidity.
Increase vertical wind or start very near saturation. Expected result: earlier
condensation, more cloud water, and possible rain water if the simple autoconversion
threshold is exceeded.

Case D: heating offsets lift.
Run the same lift case with positive external heating. Expected result: less cooling
and delayed or suppressed condensation compared with the unheated lift case.

## Droplet Outputs

Current production frames do not emit droplet-size distributions. If a future frame
includes the optional `microphysics` payload from `docs/microphysics-schema.md`, the
UI can show a global droplet histogram for the displayed frame. When that payload is
absent, the dashboard keeps showing the bulk parcel diagnostics and a clear empty
state for droplet distributions.

`docs/microphysics-comparison.md` compares the current bulk lab behavior against a
simpler saturation-adjustment baseline across controlled cases.

## Future PySDM Host

If PySDM is adopted, this solver mode is the intended integration point for parcel,
box, column, and prescribed-flow experiments. PySDM should remain optional and
isolated until license, dependency, performance, and validation questions are
resolved. Coupling PySDM directly to `boussinesq_2d` remains out of scope.

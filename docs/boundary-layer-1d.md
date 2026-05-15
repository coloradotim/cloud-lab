# Boundary Layer 1-D Profile Model

Issue: #176

`boundary_layer_1d` is Cloud Lab's first standalone lower-atmosphere reduced
model. It evolves a one-dimensional morning boundary-layer profile and diagnoses
whether the environment becomes favorable for shallow cloud formation.

It answers:

```text
How does the lower atmosphere become favorable, or fail to become favorable, for shallow cloud formation?
```

V1 intentionally emits no cloud liquid water, rain water, droplet distributions,
2-D velocity fields, terrain fields, or rendered cloud fields. It diagnoses
cloud formation potential only.

## Role In The Science Stack

`boundary_layer_1d` implements the first interactive reduced-model layer defined
in `docs/lower-atmosphere-modeling-strategy.md`.

It supports:

- Evolving Boundary Layer v1 profile evolution.
- Lower Atmosphere Cloud Basics v2 design, where evolved profiles may later feed
  controlled cloud-formation or reference-comparison workflows.
- Deterministic validation of heating, moisture, cap, entrainment, LCL, and RH
  relationships without relying on the Yellow-status `boussinesq_2d` prototype.

It does not replace CM1 reference cases, controlled cloud-column formation, warm
rain microphysics, optics, or future free-dynamics work.

## Files

Backend implementation:

- `backend/app/sim/profile_schemas.py`
- `backend/app/sim/profile_diagnostics.py`
- `backend/app/sim/profile_1d.py`
- `backend/tests/test_profile_1d.py`

The model is separate from `SimulationConfig` / `SimulationFrame` v1 because it
is not a 2-D field solver. It uses profile-specific contracts:

- `profile-config-v1`
- `profile-frame-v1`
- `profile-run-v1`

## Configuration

`BoundaryLayer1DConfig` fields:

| Field | Unit / type | Meaning |
| --- | --- | --- |
| `schema_version` | string | `profile-config-v1`. |
| `model_type` | string | `boundary_layer_1d`. |
| `height_m` | m | Profile top height. |
| `levels` | count | Number of vertical profile levels. |
| `time_step_seconds` | s | Numerical timestep. |
| `duration_seconds` | s | Total model duration. |
| `frame_interval_seconds` | s | Emitted profile-frame cadence. |
| `initial_surface_temperature_k` | K | Initial near-surface air temperature. |
| `initial_mixed_layer_depth_m` | m | Starting mixed-layer depth. |
| `initial_relative_humidity` | fraction | Initial mixed-layer RH. |
| `initial_lapse_rate_k_per_m` | K m-1 | Initial environmental lapse rate. |
| `inversion_height_m` | m | Capping inversion height. |
| `inversion_strength_k` | K | Temperature jump / cap resistance proxy. |
| `free_atmosphere_relative_humidity` | fraction | RH above the initial mixed layer. |
| `surface_heating_strength` | 0-1 preset | Dimensionless sensible-heating strength. |
| `surface_moisture_flux_strength` | 0-1 preset | Dimensionless surface moisture-flux strength. |
| `entrainment_strength` | 0-1 preset | Dimensionless mixed-layer-top entrainment strength. |
| `heating_curve` | enum | `steady` or `morning_ramp`. |
| `seed` | integer | Reserved deterministic seed for compatibility. |

The strength fields are user-friendly preset scalars, not measured turbulent
fluxes. The implementation maps them through named constants in
`backend/app/sim/profile_1d.py`.

## Output

Each `BoundaryLayer1DFrame` includes:

- `time_seconds`
- `time_hours_from_sunrise`
- `z_m`
- `temperature_k`
- `water_vapor_kg_per_kg`
- `relative_humidity_percent`
- `mixed_layer_depth_m`
- `lcl_m`
- `inversion_height_m`
- `inversion_strength_k`
- `surface_heating_accumulated_k`
- `surface_moisture_added_kg_per_kg`
- `entrainment_drying_proxy`
- deterministic diagnostics

V1 emits no cloud water field. That is intentional: the model diagnoses whether
the profile has become cloud-favorable; it does not predict or render clouds.

## Tendencies

The v1 parameterization is deliberately simple and deterministic.

Named tendencies:

- sensible heating warms the mixed layer from a steady or morning-ramp curve
- surface moisture flux adds water vapor to the mixed layer
- mixed-layer depth grows with heating and entrainment
- cap resistance slows growth near a capping inversion
- mixed-layer homogenization relaxes temperature and water vapor inside the
  mixed layer
- entrainment mixes air from just above the mixed layer and accumulates a dry-air
  suppression proxy when that air reduces mixed-layer vapor
- LCL is recalculated from mixed-layer mean temperature and vapor
- RH is derived from temperature, vapor, and pressure at height

This is not a turbulence closure, LES, mesoscale model, or weather forecast.

## Diagnostics

Cloud formation potential statuses:

- `not_favorable_yet`
- `cloud_favorable`
- `moisture_limited`
- `heating_limited`
- `cap_suppressed`
- `dry_entrainment_suppressed`
- `no_flux_control`
- `not_evaluated`

Each frame carries a deterministic reason string plus supporting values:

- mixed-layer depth minus LCL
- RH near mixed-layer top
- max RH
- cap suppression index
- heating/moisture/cap/dry-entrainment limitation booleans

Diagnostic text is generated from deterministic thresholds. It is not AI output.

## Built-In Scenarios

Backend presets:

1. `morning-stable-layer-breaks-down`
2. `moist-surface-cumulus-favorable`
3. `dry-entrainment-suppresses-potential`
4. `surface-moisture-flux-enables-potential`
5. `strong-cap-suppresses-growth`
6. `no-flux-control`

These align with the Evolving Boundary Layer lab spec and provide test fixtures
for the model's core relationships.

## Validation Expectations

Tests protect:

- finite fields
- monotonic heights
- bounded RH
- nonnegative water vapor
- mixed-layer depth within the profile domain
- deterministic output for fixed config
- explicit absence of cloud liquid water in v1
- no-flux control remains mostly unchanged
- stronger heating deepens the mixed layer more than weak heating
- stronger moisture flux lowers LCL or increases RH
- higher initial humidity lowers initial LCL
- stronger cap suppresses mixed-layer growth
- dry entrainment worsens potential when air aloft is dry
- longer comparable runs do not reduce accumulated heating
- deterministic cloud-potential status and reason strings

## Limitations

V1 does not include:

- cloud liquid water
- rain water
- droplet distributions
- 2-D or 3-D dynamics
- wind, wind shear, or advection
- terrain
- radiation or solar geometry from date/latitude
- true turbulence closure
- observed sounding import
- live coupling to `boussinesq_2d`

## Relationship To Other Labs

Evolving Boundary Layer v1 should use `boundary_layer_1d` as the standalone
profile model.

Lower Atmosphere Cloud Basics v1 remains a Yellow-labeled `boussinesq_2d`
prototype. Lower Atmosphere Cloud Basics v2 may later consume evolved profiles
from `boundary_layer_1d`, but that export/coupling path is outside #176.

Future `controlled_cloud_column` work should answer the next question:

```text
Given this profile and lift history, does cloud form?
```

That later model, not `boundary_layer_1d` v1, is where cloud water should first
appear in the reduced-model stack.

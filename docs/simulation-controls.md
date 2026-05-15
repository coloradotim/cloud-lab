# Simulation Controls And Presets

This document describes the current/prototype simulation control system. Workbench V2 should reorganize controls around labs and scenario contracts, as described in `docs/workbench-v2-product-spec.md` and `docs/workbench-v2-architecture.md`.

The current control metadata remains useful, but it should not force future UI structure. In the lab-driven model, controls should be selected because they help users explore a lab's physical question.

## Control Philosophy

Cloud Lab controls should expose meaningful atmospheric concepts, not every implementation parameter.

A good lab control:

- affects a physically understandable process
- has clear units or qualitative meaning
- supports the selected lab/scenario
- has an expected effect that diagnostics can explain
- does not imply a solver capability that does not exist

A control should be hidden, disabled, or moved to advanced settings when it is not central to the selected lab.

## Current Browser Run Flow

The current frontend can start a local 2-D vertical-slice run entirely from the browser. The frontend loads versioned presets from `GET /simulations/presets`, lets the user adjust the active `SimulationConfig`, and sends that config to `POST /simulations/runs` before opening the WebSocket stream.

Workbench V2 should continue to use the same backend run contract, but the user-facing flow should be lab-driven:

```text
Choose lab → choose scenario → adjust key physical controls → run
```

## Preset Philosophy

Presets are reproducible starting points, not claims of operational weather realism. Each preset should:

- belong to a lab or reference/debug category
- set a deterministic seed
- use laptop-friendly grid and runtime defaults
- emphasize one interpretable cloud-physics behavior
- stay within the documented `sim-config-v1` schema
- avoid hiding important assumptions from the user

The backend API preset is `multi-thermal-cumulus-field`, shown in the API as
**Multi-thermal cloud field**. It uses the public Yellow-status `boussinesq_2d`
prototype, a surface-moist source layer, paired warm surface patches, light
background wind, and enough runtime for delayed cloud water to appear by the
configured scenario end. The legacy helper function name is retained internally
to avoid import churn, but the public preset contract is multi-thermal rather
than the single-patch fair-weather baseline. This preset should not produce
significant cloud at initialization.

## Current Adjustable Parameters

The current setup UI is solver-aware and scenario-aware. It keeps scenario selection and run controls visible in the workbench top bar while detailed setup lives in groups.

Current setup group concepts:

- selected scenario card: intended phenomenon, thermodynamics, forcing, expected outcome, diagnostics, and limitations
- basic controls: lab-specific controls such as source-layer humidity, surface forcing, model resolution, domain size, and run length
- atmosphere / moisture: lapse rate, boundary-layer top, humidity profile, moist source depth, and free-atmosphere humidity
- surface / motion forcing: heating pattern, heating strength, patch geometry, background wind, or prescribed parcel lift when using `microphysics_lab`
- saved experiments: local saved configurations for rerunning an experiment
- advanced model settings: domain, grid, timestep, frame cadence, and seed

Workbench V2 should replace this with lab-specific setup where practical, but the metadata and relevance ideas remain important.

Control states:

- `active`: applies to the selected solver/scenario and affects the next run.
- `advanced`: applies, but belongs behind an advanced disclosure.
- `disabled`: visible but not editable, with a reason.
- `hidden`: not relevant enough to show for the selected solver/scenario.
- `legacy`: kept for config compatibility, not shown in normal UI.

Controls are hidden when showing them would imply a solver capability that does not exist. For example, Boussinesq surface-heating patch controls are hidden for `microphysics_lab`, and terrain/droplet controls are not shown before those features exist. Controls are disabled when their role is useful to explain.

Changing setup values resets playback and applies to the next run. Controls do not live-edit an already running simulation.

## Current Control Meanings

The current UI exposes the following controls when relevant. Boussinesq-backed
controls should be presented as inputs to an experimental Yellow prototype, not
as controls for a trusted lower-atmosphere cloud-resolving model:

- Surface heating, `max_warming_rate_k_per_s`: stronger values create faster buoyant plume growth.
- Surface temperature, `surface_temperature_k`: displayed in Celsius in the browser and stored in Kelvin in the config.
- Heating width, `patch_width_m`: the full uniformly heated ground-patch width, with only a small taper outside the patch to avoid a hard numerical edge.
- Heating center, `patch_center_x_m`: moves the heated ground patch across the domain.
- Lapse rate, `lapse_rate_k_per_m`: environmental cooling rate with height. Larger values are less stable and support deeper growth; smaller values are more stable/suppressive.
- Boundary layer top, `boundary_layer_depth_m`: approximate top of the mixed layer or inversion. It is a scenario structure marker, not a hard cloud-base rule.
- Moist source layer depth, `moist_source_layer_depth_m`: near-surface layer that supplies vapor to heated thermals. It must not exceed the boundary-layer top.
- Free-atmosphere RH, `free_atmosphere_relative_humidity`: humidity above the moist source layer. Lower values can limit cloud growth and promote drying.
- Source-layer RH, `relative_humidity`: near-surface/source-layer humidity for Boussinesq cases and parcel humidity for `microphysics_lab`. Higher values reduce how much lifting/cooling is needed before cloud water appears.
- Domain width and height: resize the 2-D slice while preserving the same schema.
- Model resolution: public lab controls should prefer Low / Medium / High presets that map to grid columns and rows internally.
- Grid columns and rows: raw spatial resolution. These should stay advanced/custom unless a lab explicitly needs them.
- Runtime, timestep, and frame cadence: run length controls simulated duration; timestep and frame cadence are numerical/output details. Short frame cadence on long runs may accumulate many frames.
- Background wind, `u_m_per_s`: horizontal wind that advects and tilts resolved Boussinesq structures.
- Prescribed lift, `w_m_per_s`: in `microphysics_lab`, imposed parcel lift. This is prescribed forcing, not a predicted updraft. In `boussinesq_2d`, vertical motion is predicted from surface heating/dynamics and imposed lift is not a primary public control.
- Random seed: preserves reproducible perturbations and run-to-run comparisons.

The frontend clamps dependent values, including heating width/center against the domain, boundary-layer depth against the domain height, frame cadence against the timestep, and seed/grid values to integer-friendly ranges. It also shows guidance when a choice may be hard to resolve or slow on a laptop.

## Expected Effects

With the fair-weather cumulus preset, pressing Start should produce thermal
circulation first and non-zero cloud liquid water only after lifted source-layer
air reaches saturation. The scenario contract is delayed cloud onset by the
configured runtime, no immediate surface-attached cloud, and cloud water that is
not dominated by boundary artifacts. This remains a qualitative
Yellow-prototype outcome, not a validated cloud-resolving forecast.

Moving the heating center should move the plume source for single-patch scenarios. Lowering humidity may suppress visible cloud water. Increasing background wind should tilt or displace the evolving structure.

For `microphysics_lab` scenarios, the primary controls are source/parcel RH, runtime, and prescribed lift. Horizontal surface-heating controls are hidden because the solver is a controlled parcel/box mode broadcast through the shared frame schema, not a resolved 2-D dynamics solver.

## Workbench V2 Direction

Future controls should be declared through lab/scenario definitions.

A lab should define:

- primary controls
- secondary controls
- advanced controls
- hidden/irrelevant controls
- control explanations
- expected physical effect
- diagnostics that help confirm the effect

The user should see the controls that help answer the lab's question, not every field in `SimulationConfig`.

## Limitations

These controls drive prototype solvers. The public 2-D cloud workflow currently
uses `boussinesq_2d` as a Yellow prototype visual dynamics scaffold;
`educational_2d` remains available only for explicit legacy configs and
regression tests.

The current model still uses simplified warm-cloud condensation heuristics and Python-list numerics. It does not yet solve full compressible or anelastic fluid dynamics, entrainment, precipitation fallout, radiation, turbulence closure, or terrain forcing.

The UI guardrails are practical local-playback guidance rather than a formal stability proof.

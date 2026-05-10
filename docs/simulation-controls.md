# Simulation Controls And Presets

Cloud Lab can start a local 2-D vertical-slice run entirely from the browser. The frontend loads versioned presets from `GET /simulations/presets`, lets the user adjust the active `SimulationConfig`, and sends that config to `POST /simulations/runs` before opening the WebSocket stream.

## Preset Philosophy

Presets are reproducible starting points, not claims of operational weather realism. Each preset should:

- set a deterministic seed,
- use laptop-friendly grid and runtime defaults,
- emphasize one interpretable cloud-physics behavior,
- stay within the documented `sim-config-v1` schema,
- avoid hiding important assumptions from the user.

The first backend preset is `fair-weather-cumulus`, shown in the API as
**Fair-weather cumulus over heated ground**. It uses the public
`boussinesq_2d` solver, a surface-moist source layer, paired warm surface
patches, light background wind, and enough runtime for delayed cloud water to
appear by the configured scenario end. This preset should not produce
significant cloud at initialization.

## Adjustable Parameters

The current UI exposes the following controls:

- Surface heating, `max_warming_rate_k_per_s`: stronger values create faster buoyant plume growth.
- Surface temperature, `surface_temperature_k`: displayed in Celsius in the browser and stored in Kelvin in the config.
- Heating width, `patch_width_m`: the full uniformly heated ground-patch width, with only a small taper outside the patch to avoid a hard numerical edge.
- Heating center, `patch_center_x_m`: moves the heated ground patch across the domain.
- Lapse rate, `lapse_rate_k_per_m`: environmental cooling rate above the well-mixed boundary layer. The boundary layer itself initializes with a dry-adiabatic temperature decrease.
- Boundary layer top, `boundary_layer_depth_m`: height of the dry-adiabatic mixed layer before the environmental lapse rate takes over.
- Moist source layer depth, `moist_source_layer_depth_m`: near-surface layer that supplies vapor to heated thermals. It must not exceed the boundary-layer top.
- Free-atmosphere RH, `free_atmosphere_relative_humidity`: drier air above the moist source layer for `surface_moisture` scenarios.
- Relative humidity, `relative_humidity`: higher values reduce how much lifting/cooling is needed before cloud water appears.
- Domain width and height: resize the 2-D slice while preserving the same schema.
- Grid columns and rows: adjust spatial resolution. Higher values cost more browser and backend work.
- Runtime, timestep, and frame cadence: control simulated duration, numerical step size, and streamed frame spacing. The browser control supports runs up to 3,600 simulated seconds; short frame cadence on long runs may accumulate many frames.
- Background wind, `u_m_per_s`: advects structures across the domain.
- Random seed: preserves reproducible perturbations and run-to-run comparisons.

The frontend clamps dependent values, including heating width/center against the domain, boundary-layer depth against the domain height, frame cadence against the timestep, and seed/grid values to integer-friendly ranges. It also shows guidance when a choice may be hard to resolve or slow on a laptop.

## Expected Effects

With the fair-weather cumulus preset, pressing Start should produce thermal
circulation first and non-zero cloud liquid water only after lifted source-layer
air reaches saturation. The scenario contract is delayed cloud onset by the
configured runtime, no immediate surface-attached cloud, and cloud water that is
not dominated by boundary artifacts. Moving the heating center should move the
plume source for single-patch scenarios. Lowering humidity may suppress visible
cloud water. Increasing background wind should tilt or displace the evolving
structure.

## Limitations

These controls drive prototype solvers. The public 2-D cloud workflow now uses
`boussinesq_2d`; `educational_2d` remains available only for explicit legacy
configs and regression tests. The model still uses simplified warm-cloud
condensation heuristics and Python-list numerics. It does not yet solve full
compressible or anelastic fluid dynamics, entrainment, precipitation fallout,
radiation, turbulence closure, or terrain forcing. The UI guardrails are
practical local-playback guidance rather than a formal stability proof.

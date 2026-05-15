# Boussinesq Validation

This document defines the current validation gate for the `boussinesq_2d` prototype.

It answers a narrow question:

> Is this physics core stable and qualitatively plausible enough to support selected labs, especially Lower Atmosphere Cloud Basics, without misleading the user?

It does not prove atmospheric realism. The solver still uses simple transport, fixed-iteration streamfunction inversion, warm-cloud saturation adjustment, damping, and safety caps.

For the broader test taxonomy, hard-failure policy, diagnostic-warning policy, and process for updating physics expectations, see the [testing and validation plan](testing-and-validation.md).

For the numerical-method contract that explains the actual `boussinesq_2d`
operator sequence, state-variable classifications, boundary behavior,
stabilizer/cap meanings, and Yellow trust implications, see
`docs/boussinesq-numerical-method.md`.

For the broader post-#174 lower-atmosphere modeling strategy, see
`docs/lower-atmosphere-modeling-strategy.md`. Current `boussinesq_2d` remains a
Yellow prototype scaffold, not the main science path for future polished
cloud-resolving labs.

For product direction, see `docs/lab-roadmap.md`.

## Role In The Lab Roadmap

`boussinesq_2d` is one physics core that can serve labs. It is not the product architecture and not the final hard-core atmospheric model.

Current best uses:

- Lower Atmosphere Cloud Basics Lab
- controlled shallow-cloud visual experiments
- reference-case validation
- scenario diagnostics
- UI/schema validation for gridded 2-D fields
- early terrain/orographic experiments if limitations are labeled

Current non-uses:

- quantitative atmospheric prediction
- hosting advanced PySDM microphysics as if dynamics are solved
- claiming true turbulence/entrainment closure
- claiming research-grade CFD

Improvements should be driven by lab needs. For example, if the fair-weather cumulus baseline inside Lower Atmosphere Cloud Basics produces cloud bases or cloud onset that are physically misleading, that is a good reason to improve Boussinesq thermodynamics or transport. Improving the solver in the abstract without a lab question is not the priority.

## How to Run

The fast PR backend job excludes slower science validation:

```bash
cd backend
.venv/bin/pytest -m "not slow and not science"
.venv/bin/pytest -m "boussinesq and not slow"
```

Run short Boussinesq sanity checks, including the thermal-bubble benchmark, when touching the Boussinesq solver or diagnostics:

```bash
cd backend
.venv/bin/pytest -m "boussinesq and not slow"
```

Run the slower reference validation suite manually or through the scheduled/manual GitHub Actions **Science validation** job:

```bash
cd backend
.venv/bin/pytest -m "science and validation"
```

The same cases may be available from the frontend as reference/debug cases. They should not be confused with polished user-facing labs unless wrapped with lab/scenario metadata.

## Reference Cases

All reference cases use `solver_type = "boussinesq_2d"` and the shared frame schema.

| Case | Purpose | Key defaults | Expected behavior |
| --- | --- | --- | --- |
| Quiet atmosphere / no forcing | Ensure the solver does not invent weather. | RH 0.65, heating 0, wind 0, 10 minute run. | Zero vertical motion, zero temperature perturbation, zero cloud water. |
| Dry thermal bubble | Check buoyant circulation without cloud physics. | RH 0.45, heating 0.016 K/s, no background wind, 15 minute run. | Warm perturbation and circulation develop; cloud water remains zero. |
| Humid lifted thermal | Check uplift, cooling, and saturation adjustment. | RH 0.98, heating 0.022 K/s, light wind, 20 minute run. | Updraft and bounded cloud water appear near or above the boundary-layer top; moisture stays non-negative. |
| Stable stratification suppression | Check environmental stability response. | RH 0.45, heating 0.016 K/s, lapse rate 0.0035 K/m. | Vertical development is weaker than the less-stable dry thermal case. |
| Lower-atmosphere lapse-rate suppression pair | Check stability as a controlled relationship. | Same warm-cloud setup, source humidity, heating, domain, resolution, runtime, and seed; only lapse rate changes from less-stable `0.0075 K m-1` to stable `0.0035 K m-1`. | Stable case has weaker max updraft, less total cloud water, and delayed or suppressed cloud onset. |
| Lower-atmosphere cap suppression pair | Check cap placement/strength as a controlled relationship. | Same warm-cloud setup, source humidity, heating, lapse rate, domain, resolution, runtime, and seed; only cap layer changes from high/weak to low/strong. | Low/strong cap reduces cloud amount and delays or suppresses onset relative to high/weak cap; any cloud remains below or near the cap. |
| Fair-weather Boussinesq baseline | Manual comparison baseline. | RH 1.0, heating 0.014 K/s, light wind. | Conservative plume and cloud-water response for visual inspection. |

## Model Sizes

The S/M/L presets are deliberately simple and laptop-oriented:

| Size | Domain | Grid | Runtime | Timestep | Frame cadence | Use |
| --- | --- | --- | --- | --- | --- | --- |
| Small / quick | 8 km x 3 km | 30 x 20 | 600 s | 2 s | 20 s | Fast interactive checks. |
| Medium / standard | 10 km x 3 km | 36 x 24 | 1200 s | 2 s | 30 s | Default manual validation. |
| Large / slow | 12 km x 4 km | 54 x 36 | 1800 s | 2 s | 30 s | Slower local inspection. |

Large runs are not required for CI because the streamfunction solve cost scales with grid size and emitted frame count.

## Current Decision

`boussinesq_2d` should remain an experimental dynamics core and validation scaffold.

The evidence supports continuing to use it for selected labs and controlled visual experiments:

- quiet no-forcing cases remain quiet
- the dry thermal-bubble benchmark rises, stays cloud-free, and develops symmetric circulation
- humid cases produce bounded condensate and preserve non-negative moisture
- active-flow reference cases pass whole-frame nondimensional divergence gates
- normal reference cases do not hit the public velocity, cloud-water, or vapor safety caps
- seeded runs are reproducible

The evidence does not support treating it as a quantitatively credible CFD core:

- the humid reference case still places peak cloud water below the boundary-layer top
- the model uses strong prototype stabilizers, simple saturation adjustment, and a diagnostic boundary extrapolation because emitted frames do not carry ghost cells
- the Lower Atmosphere baseline reaches the theta perturbation safety cap under default constants, and reduced damping/diffusion materially changes cloud amount, timing, and depth

Recommendation: use `boussinesq_2d` where it supports labs, especially Lower Atmosphere Cloud Basics and possibly early Orographic/Terrain Clouds. Do not integrate advanced microphysics on top of it as though the dynamics are solved. Thermodynamic placement of cloud water remains a science gate.

## Stabilizers And Guardrails

The solver currently uses these stabilizers:

| Mechanism | Role | Type |
| --- | --- | --- |
| Thermal diffusion | Smooths temperature perturbations and limits grid-scale noise. | Numerical model simplification |
| Moisture diffusion | Smooths vapor/cloud fields. | Numerical model simplification |
| Kinematic viscosity | Diffuses vorticity. | Numerical model simplification |
| Vorticity damping | Prevents persistent grid-scale circulation growth. | Prototype numerical stabilizer |
| Thermal relaxation | Slowly damps perturbation temperature. | Prototype numerical stabilizer |
| Velocity damping | Present as a named constant for guardrail visibility; emitted velocity is diagnosed from streamfunction rather than accumulated. | Prototype guardrail |
| Top sponge | Relaxes top rows toward quiet conditions to reduce lid artifacts. | Boundary-condition stabilizer |
| Velocity, theta, vorticity, vapor, and cloud-water caps | Prevent runaway fields and expose whether normal reference runs approach unsafe values. | Safety guardrail |

These mechanisms make the prototype usable, but they are not a substitute for validated boundary conditions, pressure coupling, turbulence closure, or physically complete warm-cloud thermodynamics.

## Diagnostics

`backend/app/sim/validation.py` computes:

- max absolute horizontal velocity
- max absolute vertical velocity
- max velocity magnitude
- mean velocity magnitude
- max and min temperature perturbation
- max water vapor
- max cloud liquid water
- integrated cloud liquid water
- approximate cloud-top height above a `1e-6 kg kg-1` threshold
- height of maximum cloud liquid water
- divergence field, `du/dx + dw/dz`, in `s^-1`
- max absolute divergence
- mean absolute divergence
- RMS divergence
- max dimensionless divergence
- RMS dimensionless divergence
- non-finite value count
- minimum moisture value across vapor, cloud water, and rain water

The divergence diagnostic uses finite differences on the emitted frame grid. Interior cells use centered differences. Boundary cells are filled from the nearest centered interior diagnostic value because emitted frames do not include the ghost cells needed for a physically consistent wall derivative.

The nondimensional divergence metrics are:

```text
D* = |du/dx + dw/dz| * L / U
L = min(dx, dz)
U = max(max velocity magnitude, 1e-3 m s-1)
```

Quiet no-forcing runs are gated dimensionally:

- max absolute divergence less than `1e-6 s^-1`
- max velocity magnitude less than `1e-3 m s^-1`

Active-flow whole-frame nondimensional gates are hard validation requirements.

## Fair-Weather Thermodynamic Structure

Fair-weather cumulus often has a visually flat cloud base because parcels rising from a well-mixed source layer tend to share a similar lifting condensation level (LCL). Tops vary more because plume strength, entrainment, wind shear, and local mixing vary after condensation begins.

Cloud Lab checks this structure diagnostically. These diagnostics do not clamp cloud water, hide cloud water below an LCL, or force flat bases in the renderer. They report whether simulated cloud water is thermodynamically plausible for the configured initial state.

The expected LCL is estimated numerically by dry-lifting the initial surface parcel until its conserved water vapor reaches the diagnostic saturation curve. The Boussinesq thermodynamic path now uses a height-dependent hydrostatic pressure profile anchored to the prototype's historical `900 hPa` reference pressure. Condensation and diagnostics share this pressure-aware saturation helper.

This is still an approximation. The dynamics remain Boussinesq and do not solve compressible pressure evolution. The pressure profile is used only to make warm-cloud saturation, relative humidity, and LCL diagnostics more coherent with height.

The thermodynamic validation suite reports:

- expected LCL height
- first cloud-water time and height above a `1e-8 kg kg-1` threshold
- first-cloud height relative to the expected LCL
- cloud-water fraction below, near, and above the LCL tolerance band
- cloud-water centroid and maximum-cloud-water height
- cloud-region count, base heights, top heights, base spread, and top spread
- source-layer potential-temperature spread, water-vapor spread, and RH spread
- initialized pressure, temperature, water-vapor, and pressure-aware RH profiles by height
- source-layer vapor conservation/non-conservation
- source-layer saturation-cap cell count and affected heights
- effective source-layer top and source-to-free-atmosphere transition layer
- initialized-profile saturation height when present
- whether the initialized profile is well mixed enough for simple shared cloud-base assumptions
- saturation sanity for a dry-adiabatically lifted diagnostic parcel
- boundary-cloud fraction and low-level return-flow cloud fraction
- explicit return-flow / boundary artifact-policy statuses for below-LCL cloud,
  low-level return-flow cloud, boundary cloud, top sponge cloud, and
  lateral-boundary cloud
- cloud-water persistence in locally subsaturated air, downdrafts, return flow,
  below the expected LCL, near the surface, and near model boundaries
- diagnostic condensation and evaporation tendency estimates for the emitted
  frame state

Run the thermodynamic structure report with:

```bash
cd backend
.venv/bin/python -m app.sim.validation --thermodynamics
```

Use `--json` for machine-readable output.

Run the Lower Atmosphere Cloud Basics resolution/domain/runtime sensitivity
matrix with:

```bash
cd backend
.venv/bin/python -m app.sim.validation --sensitivity --json
```

The #158 report is documented in
`docs/fair-weather-resolution-domain-sensitivity.md`. It keeps the current
default envelope but preserves Yellow status because cloud amount, updraft
strength, and artifact warnings remain sensitive in high-resolution,
smaller-domain, and long-runtime baseline runs.

Run the Boussinesq stabilizer, safety-cap, damping, and sponge audit with:

```bash
cd backend
.venv/bin/python -m app.sim.validation --stabilizers --json
```

The #159 report is documented in `docs/boussinesq-stabilizer-audit.md`. It
keeps `boussinesq_2d` Yellow because the default single-patch Lower Atmosphere
baseline reaches the theta perturbation cap and diagnostic reductions to
damping/diffusion materially change cloud outcomes. The top sponge did not
materially affect the audited normal-height Lower Atmosphere cases.

## Thermal Bubble Benchmark

The dedicated thermal bubble benchmark is a dry, quiescent Boussinesq sanity case. It directly initializes a Gaussian positive temperature perturbation rather than using surface heating.

The test tracks max vertical velocity, the positive-temperature centroid height, the height of the maximum temperature perturbation, cloud liquid water, and left/right horizontal-circulation symmetry. It asserts:

- positive early vertical velocity
- a bounded but measurable rise rate
- monotonic positive-temperature centroid rise within a one-cell-scale tolerance
- no cloud water in the dry case
- comparable left and right horizontal circulation strength

Failure usually means the solver has broken one of the core dry-buoyancy behaviors.

## Stable / Capped Suppression Validation

Lower Atmosphere Cloud Basics uses stability and cap controls to teach that heating and moisture are not enough by themselves. The validation contract is directional rather than a fixed morphology target:

- A more stable lapse-rate case should produce weaker vertical response than the less-stable paired case.
- The stable case should produce lower cloud potential: less total cloud water, lower cloud top, later cloud onset, or no cloud.
- A low/strong cap should reduce cloud amount or depth relative to a high/weak cap with the same low-level thermodynamics and heating.
- Cloud in the capped case should remain below or near the cap. The test does not require cloud to form in the capped member; complete suppression is an acceptable prototype outcome.

Current #156 paired validation status: the solver passes the dedicated lapse-rate and cap-suppression relationship tests without changing solver physics or public scenario defaults. This does not make `boussinesq_2d` Green; it narrows one Yellow trust gap by adding explicit relationship coverage.

## Subsaturated / Return-Flow Cloud-Water Persistence

Issue #166 added a long paired-thermal reproduction for Lower Atmosphere Cloud
Basics using the current multi-thermal backend preset shape:

```text
solver: boussinesq_2d
domain: 10 km x 3 km
grid: 36 x 24
runtime: 4800 s
timestep: 2 s
frame interval: 120 s
heating: two patches, 0.024 K s-1
source RH: 0.85
free-atmosphere RH: 0.55
source layer: 800 m
boundary-layer depth: 1500 m
seed: preset default
```

Before #166, this reproduction placed roughly two thirds of final cloud-water
mass in diagnostically subsaturated air and more than 10% in low-level return
flow. The main mechanism was a mismatch in the prototype saturation adjustment:
condensation used a lifted-parcel cooling signal, and evaporation used the same
cooled saturation target. That allowed transported cloud water to remain
defensible to the solver even when the emitted local cell was subsaturated.

The #166 remediation keeps lifted-parcel condensation available, but evaporates
pre-existing transported cloud water against the emitted cell's local
pressure-aware saturation state. Dedicated diagnostics now report:

- cloud-water mass and cell fractions in subsaturated air
- cloud-water fractions in downdrafts, low-level return flow, below the LCL,
  near the surface, and near model boundaries
- maximum cloud water in subsaturated air and its height range
- estimated condensation and evaporation tendencies
- approximate contiguous lifetime of subsaturated cloud-water presence in
  emitted frames

Post-remediation classification:

```text
inadequate local evaporation was a contributor; long-run return-flow cloud water
remains a prototype recirculation/no-removal warning
```

The long reproduction now keeps the final subsaturated cloud-water mass fraction
below the regression threshold, but still reports a return-flow warning. This is
not a Green trust result for `boussinesq_2d`. It narrows a specific persistence
artifact while preserving the documented Yellow status and leaving broader
return-flow/boundary warning policy to #157.

## Return-Flow / Boundary Cloud-Water Policy

Issue #157 defines how Lower Atmosphere Cloud Basics should classify cloud water
in regions that may be artifacts of the current 2-D prototype.

| Diagnostic signal | Current policy | Notes |
| --- | --- | --- |
| Below-LCL cloud-water fraction | Warning at small fractions; fail at large fractions. | Large below-LCL condensate contradicts the cloud-base teaching contract. |
| Low-level return-flow cloud fraction | Warning. | This often indicates recirculation or transport limitations in long runs. It is not a hard failure by itself while the solver is Yellow. |
| Boundary cloud fraction | Warning. | Boundary-attached cloud should be interpreted cautiously. |
| Top sponge cloud fraction | Warning. | Cloud in the top sponge/lid region may reflect lid interaction. |
| Lateral-boundary cloud fraction | Warning. | Cloud touching side boundaries may reflect side-boundary influence. |
| Cloud regions touching boundaries | Warning / scenario-specific context. | Region connectivity helps distinguish isolated interior cloud from boundary-connected cloud. |

The policy is diagnostic. It does not hide cloud water, change renderer
thresholds, tune scenarios, or claim that the artifact is solved. Deeper causes,
including stabilizer/damping influence or successor-core needs, remain in #159
and #160.

## Current Read

The prototype is credible enough for controlled visual experiments and for comparing simple parameter changes. It is not a benchmarked CFD model and should not be used to make quantitative cloud predictions.

The next Boussinesq work should be driven by labs:

- Lower Atmosphere Cloud Basics if cloud-base/onset behavior misleads the user
- Evolving Boundary Layer if the solver needs to consume time-evolving profiles
- Orographic / Terrain Clouds if terrain forcing reveals boundary or transport artifacts

Boussinesq work should not become an open-ended attempt to build the final hard-core cloud model inside this prototype.

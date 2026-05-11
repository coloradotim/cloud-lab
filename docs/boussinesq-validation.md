# Boussinesq Validation

This document defines the current validation gate for the `boussinesq_2d` prototype.

It answers a narrow question:

> Is this physics core stable and qualitatively plausible enough to support selected labs, especially Fair-Weather Cumulus, without misleading the user?

It does not prove atmospheric realism. The solver still uses simple transport, fixed-iteration streamfunction inversion, warm-cloud saturation adjustment, damping, and safety caps.

For the broader test taxonomy, hard-failure policy, diagnostic-warning policy, and process for updating physics expectations, see the [testing and validation plan](testing-and-validation.md).

For product direction, see `docs/lab-roadmap.md`.

## Role In The Lab Roadmap

`boussinesq_2d` is one physics core that can serve labs. It is not the product architecture and not the final hard-core atmospheric model.

Current best uses:

- Fair-Weather Cumulus Lab
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

Improvements should be driven by lab needs. For example, if Fair-Weather Cumulus produces cloud bases or cloud onset that are physically misleading, that is a good reason to improve Boussinesq thermodynamics or transport. Improving the solver in the abstract without a lab question is not the priority.

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
- normal reference cases do not hit the public velocity, temperature, cloud-water, or vapor safety caps
- seeded runs are reproducible

The evidence does not support treating it as a quantitatively credible CFD core:

- the humid reference case still places peak cloud water below the boundary-layer top
- the model uses strong prototype stabilizers, simple saturation adjustment, and a diagnostic boundary extrapolation because emitted frames do not carry ghost cells

Recommendation: use `boussinesq_2d` where it supports labs, especially Fair-Weather Cumulus and possibly early Orographic/Terrain Clouds. Do not integrate advanced microphysics on top of it as though the dynamics are solved. Thermodynamic placement of cloud water remains a science gate.

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

The expected LCL is estimated numerically by dry-lifting the initial surface parcel until its conserved water vapor reaches the diagnostic saturation curve. This keeps the LCL diagnostic consistent with the Boussinesq prototype's current saturation calculation. That saturation calculation still uses a fixed `900 hPa` reference pressure, so the validation should be read as a consistency check for this prototype, not a full hydrostatic parcel calculation.

The thermodynamic validation suite reports:

- expected LCL height
- first cloud-water time and height above a `1e-8 kg kg-1` threshold
- first-cloud height relative to the expected LCL
- cloud-water fraction below, near, and above the LCL tolerance band
- cloud-water centroid and maximum-cloud-water height
- cloud-region count, base heights, top heights, base spread, and top spread
- source-layer potential-temperature spread, water-vapor spread, and RH spread
- saturation sanity for a dry-adiabatically lifted diagnostic parcel
- boundary-cloud fraction and low-level return-flow cloud fraction

Run the thermodynamic structure report with:

```bash
cd backend
.venv/bin/python -m app.sim.validation --thermodynamics
```

Use `--json` for machine-readable output.

## Thermal Bubble Benchmark

The dedicated thermal bubble benchmark is a dry, quiescent Boussinesq sanity case. It directly initializes a Gaussian positive temperature perturbation rather than using surface heating.

The test tracks max vertical velocity, the positive-temperature centroid height, the height of the maximum temperature perturbation, cloud liquid water, and left/right horizontal-circulation symmetry. It asserts:

- positive early vertical velocity
- a bounded but measurable rise rate
- monotonic positive-temperature centroid rise within a one-cell-scale tolerance
- no cloud water in the dry case
- comparable left and right horizontal circulation strength

Failure usually means the solver has broken one of the core dry-buoyancy behaviors.

## Current Read

The prototype is credible enough for controlled visual experiments and for comparing simple parameter changes. It is not a benchmarked CFD model and should not be used to make quantitative cloud predictions.

The next Boussinesq work should be driven by labs:

- Fair-Weather Cumulus if cloud-base/onset behavior misleads the user
- Evolving Boundary Layer if the solver needs to consume time-evolving profiles
- Orographic / Terrain Clouds if terrain forcing reveals boundary or transport artifacts

Boussinesq work should not become an open-ended attempt to build the final hard-core cloud model inside this prototype.

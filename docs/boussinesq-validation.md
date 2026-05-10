# Boussinesq Validation

This document defines the current validation gate for the `boussinesq_2d` prototype.
It is meant to answer a narrow question: is the solver stable and qualitatively plausible
enough to keep building on?

It does not prove atmospheric realism. The solver still uses simple transport,
fixed-iteration streamfunction inversion, warm-cloud saturation adjustment, damping,
and safety caps.

For the broader test taxonomy, hard-failure policy, diagnostic-warning policy,
and process for updating physics expectations, see
the [testing and validation plan](testing-and-validation.md).

## How to Run

The fast PR backend job excludes slower science validation:

```bash
cd backend
.venv/bin/pytest -m "not slow and not science"
.venv/bin/pytest -m "boussinesq and not slow"
```

Run short Boussinesq sanity checks, including the thermal-bubble benchmark, when
touching the Boussinesq solver or diagnostics:

```bash
cd backend
.venv/bin/pytest -m "boussinesq and not slow"
```

Run the slower reference validation suite manually or through the scheduled/manual
GitHub Actions **Science validation** job:

```bash
cd backend
.venv/bin/pytest -m "science and validation"
```

The same cases are available from the frontend in the **Reference case** selector
when using the Boussinesq solver. The **Model size** selector independently applies
the S/M/L domain, grid, runtime, timestep, and frame-cadence settings.

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

Large runs are not required for CI because the streamfunction solve cost scales with
grid size and emitted frame count.

## Current Decision

`boussinesq_2d` should remain an experimental dynamics core and validation scaffold,
not the frozen foundation for advanced microphysics yet.

The evidence supports continuing to improve it in narrow steps:

- quiet no-forcing cases remain quiet
- the dry thermal-bubble benchmark rises, stays cloud-free, and develops symmetric
  circulation
- humid cases produce bounded condensate and preserve non-negative moisture
- active-flow reference cases pass whole-frame nondimensional divergence gates
- normal reference cases do not hit the public velocity, temperature, cloud-water,
  or vapor safety caps
- seeded runs are reproducible

The evidence does not yet support treating it as a quantitatively credible CFD core:

- the humid reference case still places peak cloud water below the boundary-layer top
- the model uses strong prototype stabilizers, simple saturation adjustment, and a
  diagnostic boundary extrapolation because emitted frames do not carry ghost cells

Recommendation: keep using `boussinesq_2d` for controlled visual experiments,
schema/UI validation, thermal-bubble and reference-case regression tests, and targeted
dynamics improvements. Do not integrate advanced microphysics on top of it as though
the dynamics are solved. Thermodynamic placement of cloud water remains the next
science gate.

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

These mechanisms make the prototype more usable, but they are not a substitute for
validated boundary conditions, pressure coupling, turbulence closure, or physically
complete warm-cloud thermodynamics.

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

The divergence diagnostic uses finite differences on the emitted frame grid. Interior
cells use centered differences. Boundary cells are filled from the nearest centered
interior diagnostic value because emitted frames do not include the ghost cells needed
for a physically consistent wall derivative. This changes the diagnostic derivative
stencil and emitted-frame handling only; it does not change the Boussinesq solver,
velocity diagnosis, or boundary conditions. Dimensional divergence remains useful for
quiet cases where the velocity scale should be exactly zero.

The nondimensional divergence metrics are:

```text
D* = |du/dx + dw/dz| * L / U
L = min(dx, dz)
U = max(max velocity magnitude, 1e-3 m s-1)
```

The initial whole-frame active-flow target bands are:

| Metric | Excellent | Acceptable | Concerning | Fail |
| --- | ---: | ---: | ---: | ---: |
| RMS dimensionless divergence | < 1e-3 | < 1e-2 | >= 1e-2 | >= 5e-2 |
| Max dimensionless divergence | < 1e-2 | < 5e-2 | >= 5e-2 | >= 1e-1 |

The older dimensional CI bounds remain as prototype guardrails:

- max absolute divergence less than `2e-3 s^-1`
- mean absolute divergence less than `2e-5 s^-1`

Those thresholds are empirical prototype guardrails. They are above the observed
medium-grid reference cases (`0` for quiet, about `1.6e-8 s^-1` for dry thermal, and
about `3.6e-8 s^-1` for humid thermal) and are intended to catch obvious mass-
consistency regressions without pretending the boundary treatment has been formally
validated.

Quiet no-forcing runs are gated dimensionally:

- max absolute divergence less than `1e-6 s^-1`
- max velocity magnitude less than `1e-3 m s^-1`

Active-flow whole-frame nondimensional gates are hard validation requirements. The
current medium-grid final-frame results are:

| Case | RMS D* | Max D* | RMS divergence | Max divergence |
| --- | ---: | ---: | ---: | ---: |
| Dry thermal bubble | `8.23e-7` | `4.83e-6` | `2.80e-9 s^-1` | `1.64e-8 s^-1` |
| Humid lifted thermal | `9.70e-7` | `6.33e-6` | `5.48e-9 s^-1` | `3.58e-8 s^-1` |
| Stable suppression | `3.83e-7` | `2.29e-6` | `1.39e-9 s^-1` | `8.32e-9 s^-1` |

The earlier boundary-localized failures came from applying one-sided finite
differences to frame-edge cells without solver ghost cells. The streamfunction-derived
interior velocity field was already close to divergence-free; the diagnostic now
reports the centered-stencil quantity consistently across the emitted frame.

## Fair-Weather Thermodynamic Structure

Fair-weather cumulus often has a visually flat cloud base because parcels rising
from a well-mixed source layer tend to share a similar lifting condensation level
(LCL). Tops vary more because plume strength, entrainment, wind shear, and local
mixing vary after condensation begins.

Cloud Lab now checks this structure diagnostically. These diagnostics do not clamp
cloud water, hide cloud water below an LCL, or force flat bases in the renderer.
They report whether the simulated cloud water is thermodynamically plausible for the
configured initial state.

The expected LCL is estimated numerically by dry-lifting the initial surface parcel
until its conserved water vapor reaches the diagnostic saturation curve. This keeps
the LCL diagnostic consistent with the Boussinesq prototype's current saturation
calculation. That saturation calculation still uses a fixed `900 hPa` reference
pressure, so the validation should be read as a consistency check for this prototype,
not a full hydrostatic parcel calculation.

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

The source-layer mixedness diagnostic uses dry potential-temperature proxy
`theta ~= T + Gamma_d z` plus specific humidity spread. Relative-humidity spread is
reported separately. This distinction matters because a physically mixed boundary
layer should conserve water vapor while RH changes with height as temperature
changes. The `uniform` and `moist_boundary_layer` initializers now use conserved
boundary-layer water vapor; explicitly layered and custom humidity profiles remain
non-mixed by design.

Run the thermodynamic structure report with:

```bash
cd backend
.venv/bin/python -m app.sim.validation --thermodynamics
```

Use `--json` for machine-readable output. The current medium-grid diagnostics pass
without hard failures, but every case reports at least one warning:

| Case | LCL | First cloud | Status | Main interpretation |
| --- | ---: | ---: | --- | --- |
| Humid well-mixed fair-weather | 34 m | 62 m | warn | Very low LCL; cloud forms near the lowest grid level, with low-level return-flow cloud water elevated. |
| Drier well-mixed fair-weather | 413 m | 312 m | warn | Higher LCL; cloud onset is within the grid-cell tolerance band but the sampled onset cell is not saturated after transport/diffusion. |
| Warmer/drier fair-weather | 610 m | 438 m | warn | Still higher LCL; small below-band condensate and an unsaturated sampled onset cell are reported as warnings. |
| Multi-patch fair-weather | 34 m | 62 m | warn | Very low LCL; cloud forms near the lowest grid level, with low-level return-flow cloud water elevated. |
| Layered-moisture fair-weather | 331 m | 938 m | warn | Layered humidity intentionally weakens the expectation of shared cloud bases. |

Current warning thresholds are:

- first cloud more than one grid cell below the LCL: warn
- first cloud more than two grid cells below the LCL: fail
- more than 5% of cloud water below the LCL tolerance band: warn
- more than 20% of cloud water below the LCL tolerance band: fail
- more than 10% of cloud water on emitted-frame boundaries: warn
- more than 10% of cloud water in low-level downward motion: warn
- multi-region cloud-base spread above two grid cells in a mixed source layer: warn
- multi-region cloud-base spread above four grid cells in a mixed source layer: fail

These diagnostics are a science gate, not a visual target. If future runs lack flat
bases, the next question is whether the source layer is actually well mixed in
potential temperature and water vapor, whether the LCL diagnostic is appropriate for
the configured moisture profile, and whether transport or boundary effects are
placing condensate in implausible regions.

## Thermal Bubble Benchmark

The dedicated thermal bubble benchmark is a dry, quiescent Boussinesq sanity case.
It directly initializes a Gaussian positive temperature perturbation rather than
using surface heating:

- domain: 8 km x 3 km
- grid: 40 x 24
- runtime: 300 s with a 2 s timestep
- initial atmosphere: dry, no background wind, no surface heating
- perturbation: 3 K Gaussian bubble centered horizontally near 700 m AGL with a
  500 m radius

The test tracks max vertical velocity, the positive-temperature centroid height,
the height of the maximum temperature perturbation, cloud liquid water, and left/right
horizontal-circulation symmetry. It asserts:

- positive early vertical velocity
- a bounded but measurable rise rate
- monotonic positive-temperature centroid rise within a one-cell-scale tolerance
- no cloud water in the dry case
- comparable left and right horizontal circulation strength

Failure usually means the solver has broken one of the core dry-buoyancy behaviors:
the bubble does not rise, rises only through a one-sided circulation artifact,
generates moisture in a dry atmosphere, or accelerates outside the current prototype
guardrails. This benchmark is intentionally qualitative and does not claim an exact
analytic solution.

The validation tests require finite fields, non-negative moisture, bounded velocities,
bounded cloud water, a quiet no-forcing case, no cloud water in the dry case, cloud
water in the humid case, reproducibility, weaker vertical growth in the stable case,
similar qualitative behavior across the small and medium model sizes, bounded
whole-frame and interior divergence in reference cases, exactly zero divergence growth
in the quiet case, and canonical dry thermal-bubble rise.

One science check is intentionally marked as an expected failure:

- the humid lifted case currently places its cloud-water maximum below the
  boundary-layer top

Earlier
attempts to force this maximum upward by gating condensation at the mixed-layer top
created an artificial cloud shelf and stronger cellular return flow. That behavior
should be fixed by improving the thermodynamics, boundary conditions, or vertical
transport, not by hard-clipping cloud placement.

## Current Read

The prototype is credible enough for controlled visual experiments and for comparing
simple parameter changes. It is not yet a benchmarked CFD model and should not be used
to make quantitative cloud predictions.

The next science step should be a decision point: either improve the dynamics and
boundary conditions around this Boussinesq core, or evaluate a warm-cloud microphysics
library such as PySDM against the current frame schema. Advanced microphysics should
not be added until the dynamics remain well behaved under these reference cases.

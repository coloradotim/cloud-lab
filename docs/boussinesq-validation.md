# Boussinesq Validation

This document defines the current validation gate for the `boussinesq_2d` prototype.
It is meant to answer a narrow question: is the solver stable and qualitatively plausible
enough to keep building on?

It does not prove atmospheric realism. The solver still uses simple transport,
fixed-iteration streamfunction inversion, warm-cloud saturation adjustment, damping,
and safety caps.

## How to Run

CI runs the short regression suite:

```bash
cd backend
.venv/bin/pytest tests/test_boussinesq_2d.py tests/test_boussinesq_validation.py tests/test_boussinesq_thermal_bubble.py
```

For the full backend check:

```bash
cd backend
.venv/bin/pytest
.venv/bin/ruff format --check .
.venv/bin/ruff check .
.venv/bin/mypy app tests
```

The same cases are available from the frontend in the **Reference case** selector
when using the Boussinesq solver. The **Model size** selector independently applies
the S/M/L domain, grid, runtime, timestep, and frame-cadence settings.

## Reference Cases

All reference cases use `solver_type = "boussinesq_2d"` and the shared frame schema.

| Case | Purpose | Key defaults | Expected behavior |
| --- | --- | --- | --- |
| Quiet atmosphere / no forcing | Ensure the solver does not invent weather. | RH 1.0, heating 0, wind 0, 10 minute run. | Zero vertical motion, zero temperature perturbation, zero cloud water. |
| Dry thermal bubble | Check buoyant circulation without cloud physics. | RH 0.45, heating 0.016 K/s, no background wind, 15 minute run. | Warm perturbation and circulation develop; cloud water remains zero. |
| Humid lifted thermal | Check uplift, cooling, and saturation adjustment. | RH 0.98, heating 0.022 K/s, light wind, 20 minute run. | Updraft and bounded cloud water appear near or above the boundary-layer top; moisture stays non-negative. |
| Stable stratification suppression | Check environmental stability response. | RH 0.95, heating 0.016 K/s, lapse rate 0.0035 K/m. | Vertical development is weaker than the less-stable dry thermal case. |
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

## Diagnostics

`backend/app/sim/validation.py` computes:

- max absolute horizontal velocity
- max absolute vertical velocity
- max and min temperature perturbation
- max water vapor
- max cloud liquid water
- integrated cloud liquid water
- approximate cloud-top height above a `1e-6 kg kg-1` threshold
- height of maximum cloud liquid water
- divergence field, `du/dx + dw/dz`, in `s^-1`
- max absolute divergence
- mean absolute divergence
- non-finite value count
- minimum moisture value across vapor, cloud water, and rain water

The divergence diagnostic uses finite differences on the emitted frame grid. Interior
cells use centered differences. Boundary cells use one-sided differences because the
frame does not include ghost cells. The current CI bound is:

- max absolute divergence less than `2e-3 s^-1`
- mean absolute divergence less than `2e-5 s^-1`

Those thresholds are empirical prototype guardrails. They are above the observed
medium-grid reference cases (`0` for quiet, about `7e-4 s^-1` for dry thermal, and
about `1.4e-3 s^-1` for humid thermal) and are intended to catch obvious mass-
consistency regressions without pretending the boundary treatment has been formally
validated.

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
divergence in reference cases, exactly zero divergence growth in the quiet case, and
canonical dry thermal-bubble rise.

One science check is intentionally marked as an expected failure: the humid lifted
case currently places its cloud-water maximum below the boundary-layer top. Earlier
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

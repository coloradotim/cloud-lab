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
.venv/bin/pytest tests/test_boussinesq_2d.py tests/test_boussinesq_validation.py
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
- non-finite value count
- minimum moisture value across vapor, cloud water, and rain water

The validation tests require finite fields, non-negative moisture, bounded velocities,
bounded cloud water, a quiet no-forcing case, no cloud water in the dry case, cloud
water in the humid case, reproducibility, weaker vertical growth in the stable case,
and similar qualitative behavior across the small and medium model sizes.

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

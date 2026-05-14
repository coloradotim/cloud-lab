# Boussinesq Stabilizer Audit

Issue: #159

This audit reviews whether current `boussinesq_2d` stabilizers, safety caps,
diffusion, damping, and the top sponge materially shape Lower Atmosphere Cloud
Basics outcomes.

It is an audit and diagnostic change only. It does not change solver physics,
scenario presets, validation thresholds, renderer behavior, or the Lower
Atmosphere Cloud Basics naming.

## Scope

Audited cases:

- `quiet-atmosphere`
- `dry-thermal-bubble`
- `fair-weather-moderate-base`
- `multi-thermal-cumulus-field`
- `dry-cap-suppressed-cumulus`

Audited diagnostic variants:

- `default` — current production constants
- `half-damping-diffusion` — thermal diffusion, moisture diffusion, viscosity,
  vorticity damping, thermal relaxation, and velocity damping reduced by half
- `no-top-sponge` — top sponge relaxation disabled

The diagnostic variants are not product presets and are not exposed to users.
They exist to reveal stabilizer influence while preserving the normal solver
contract.

## Commands Run

```bash
cd backend
.venv/bin/python -m app.sim.validation --stabilizers --json
```

Focused tests:

```bash
backend/.venv/bin/python -m pytest \
  backend/tests/test_boussinesq_validation.py::test_boussinesq_stabilizer_audit_definitions_cover_lab_scenarios \
  backend/tests/test_boussinesq_validation.py::test_boussinesq_stabilizer_audit_reports_cap_proximity_and_sensitivity \
  -q
```

## Audit Results

Cap fractions are reported as a fraction of each safety cap. A value near `1.0`
means the safety cap is actively clipping or very close to clipping that field.

| Case | Variant | Status | Velocity cap | Theta cap | Vorticity cap | Vapor cap | Cloud cap | Cloud ratio | Updraft ratio | Cloud-top delta | Onset delta |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `quiet-atmosphere` | `default` | pass | 0.000 | 0.000 | 0.000 | 0.361 | 0.000 | n/a | n/a | n/a | n/a |
| `quiet-atmosphere` | `half-damping-diffusion` | pass | 0.000 | 0.000 | 0.000 | 0.361 | 0.000 | n/a | n/a | n/a | n/a |
| `quiet-atmosphere` | `no-top-sponge` | pass | 0.000 | 0.000 | 0.000 | 0.361 | 0.000 | n/a | n/a | n/a | n/a |
| `dry-thermal-bubble` | `default` | warn | 0.045 | 0.521 | 0.124 | 0.250 | 0.000 | n/a | n/a | n/a | n/a |
| `dry-thermal-bubble` | `half-damping-diffusion` | fail | 0.394 | 1.000 | 0.806 | 0.257 | 0.000 | n/a | 11.657 | n/a | n/a |
| `dry-thermal-bubble` | `no-top-sponge` | warn | 0.045 | 0.521 | 0.124 | 0.250 | 0.000 | n/a | 1.000 | n/a | n/a |
| `fair-weather-moderate-base` | `default` | fail | 0.152 | 1.000 | 0.281 | 0.477 | 0.008 | n/a | n/a | n/a | n/a |
| `fair-weather-moderate-base` | `half-damping-diffusion` | fail | 0.894 | 1.000 | 1.000 | 1.000 | 1.000 | 126.273 | 5.289 | 1000 m | -300 s |
| `fair-weather-moderate-base` | `no-top-sponge` | fail | 0.152 | 1.000 | 0.281 | 0.477 | 0.008 | 1.000 | 1.000 | 0 m | 0 s |
| `multi-thermal-cumulus-field` | `default` | warn | 0.073 | 0.781 | 0.173 | 0.472 | 0.003 | n/a | n/a | n/a | n/a |
| `multi-thermal-cumulus-field` | `half-damping-diffusion` | fail | 0.487 | 1.000 | 1.000 | 0.959 | 0.915 | 283.849 | 8.158 | 625 m | -420 s |
| `multi-thermal-cumulus-field` | `no-top-sponge` | warn | 0.073 | 0.781 | 0.173 | 0.472 | 0.003 | 1.000 | 1.000 | 0 m | 0 s |
| `dry-cap-suppressed-cumulus` | `default` | warn | 0.048 | 0.617 | 0.142 | 0.486 | 0.000 | n/a | n/a | n/a | n/a |
| `dry-cap-suppressed-cumulus` | `half-damping-diffusion` | fail | 0.366 | 1.000 | 1.000 | 0.819 | 0.687 | n/a | 7.647 | n/a | n/a |
| `dry-cap-suppressed-cumulus` | `no-top-sponge` | warn | 0.048 | 0.617 | 0.142 | 0.486 | 0.000 | n/a | 1.000 | n/a | n/a |

## Findings

### Safety Caps

The quiet control remains clean and does not invent motion or cloud water.

The Lower Atmosphere baseline does reach the theta perturbation safety cap under
default constants. That means at least part of the default baseline thermal
amplitude is cap-shaped, not purely produced by unconstrained dynamics.

The dry thermal and capped/suppressed cases do not hit the theta cap, but they
use meaningful headroom. The multi-thermal case approaches the theta cap.

Velocity and cloud-water caps are not approached by default normal-height runs.
Vorticity remains below the cap under defaults.

### Damping And Diffusion

Reducing damping/diffusion by half is materially outcome-changing:

- dry thermal updraft strength increases by more than an order of magnitude
- the single-patch baseline produces far more cloud water, earlier onset, and a
  much higher cloud top
- the paired multi-thermal case also produces much more cloud water, earlier
  onset, and a higher cloud top
- the capped/suppressed case remains cloud-free in the default, but reduced
  damping/diffusion produces much stronger motion and approaches several caps

This means current damping/diffusion values are not passive cleanup terms. They
are part of the current prototype behavior envelope.

### Top Sponge

Disabling top sponge relaxation does not change coarse outcomes for the audited
Lower Atmosphere cases. Cloud tops in these cases stay well below the top sponge,
and the `no-top-sponge` variant reports unchanged cloud water, updraft strength,
cloud-top height, and first-cloud timing.

The top sponge should remain documented as a boundary guardrail, but this audit
does not identify it as the cause of current normal shallow-cloud placement.

### Boundary Influence

The stabilizer audit did not find top-sponge cloud-water fractions in these
normal-height audited cases. Boundary and return-flow interpretation should
continue to use the #157 diagnostic policy.

Longer-run return-flow warnings remain a Yellow-status issue. They are not fixed
or tuned by this audit.

## Recommendations

Keep the current safety caps as guardrails, but do not claim the default
single-patch baseline is independent of them while theta clipping is active.

Keep diffusion, damping, and viscosity as prototype stabilizers for now. They
are required for the current behavior envelope, but they materially shape cloud
amount, timing, and vertical development.

Do not tune scenario presets to hide this result in #159. Preset recalibration,
if desired, should be a follow-up with explicit product/science acceptance
criteria.

Do not remove stabilizers blindly. Reduced damping/diffusion produces stronger,
earlier, deeper, and cap-adjacent behavior rather than a clearly more trustworthy
solution.

Treat #160 successor-dynamics design as still necessary if Cloud Lab needs a
cloud-resolving dynamics core that can be trusted beyond the current Yellow
prototype envelope.

## What Was Intentionally Not Changed

- No solver physics.
- No scenario presets.
- No validation thresholds outside the new audit status policy.
- No renderer behavior.
- No frontend behavior.
- No Lower Atmosphere Cloud Basics naming.
- No #156-#158 behavior.
- No #160 successor-core design.

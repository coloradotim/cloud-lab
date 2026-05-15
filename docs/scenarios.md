# Cloud Lab Scenarios

Cloud Lab scenarios are lab-specific experiments.

A lab defines the physical question. A scenario defines one concrete setup inside that lab.

For the full lab-driven roadmap, see `docs/lab-roadmap.md`. For the clean-slate workbench product model, see `docs/workbench-v2-product-spec.md`.

## Scenario Role

Scenarios are user-facing experiments, not just validation fixtures and not just saved config blobs.

Each built-in scenario should answer:

- which lab it belongs to
- what physical setup is represented
- what behavior is expected
- what the user can vary
- what diagnostics explain the result
- what caveats apply

Reference cases remain separate. They are for regression tests and scientific guardrails. A built-in scenario may borrow from a reference case, but the UI should read like a lab experiment catalog rather than a test harness.

For current Lower Atmosphere Cloud Basics scenarios that use `boussinesq_2d`,
the scenario copy should identify the source as Yellow-status prototype dynamics
output. These scenarios are useful for qualitative exploration and comparison,
but they should not imply a trusted cloud-resolving atmospheric model.

## Relationship To Labs

Workbench V2 should present scenarios inside labs.

Example:

```text
Lower Atmosphere Cloud Basics Lab
  - fair-weather cumulus / baseline shallow cloud
  - dry failed cumulus
  - capped / suppressed cloud
  - multi-thermal cloud field
  - humid low-cloud contrast

Warm Rain / Droplet Growth Lab
  - lifted humid parcel
  - no-lift control
  - rain-threshold stress case
```

The scenario system should not be the top-level product architecture. It supports the lab architecture.

## Expected / Observed Diagnostics

The browser can show a compact scenario check for the selected built-in scenario. It compares scenario metadata against deterministic observations from the buffered frames:

- expected behavior from the scenario description and diagnostic expectations
- observed cloud onset, cloud base/top, cloud region count, boundary cloud fraction, vertical motion, rain onset, and microphysics water-budget signals
- status: `plausible`, `warning`, `failed_expectation`, or `not_evaluated`
- notes explaining which contract or diagnostic drove the status

This panel is not an AI summary and not a quality score. It is a deterministic run interpretation layer meant to make scenario contracts visible while keeping the solver and renderer unchanged.

## Scenario-Aware Controls

Scenario selection drives control relevance. Built-in scenarios declare the lab/solver they use, and the setup UI uses a central control metadata model to decide whether each control is basic, advanced, disabled, hidden, or legacy.

Workbench V2 should use lab definitions first, then scenario definitions, then control metadata. The UI should expose physical controls that matter for the selected lab and scenario.

The UI should not expose a generic pile of sliders for every solver. If a control would imply a capability that the selected solver/lab does not have, hide it. If a user may reasonably wonder why a meaningful setting is unavailable, disable it with an explanation.

## Built-In Scenario Catalog

The current built-in scenario catalog supports early Lower Atmosphere Cloud Basics and Warm Rain / Microphysics Lab behavior. These should eventually be organized under lab definitions.

### Fair-weather cumulus / baseline shallow cloud

- Lab: Lower Atmosphere Cloud Basics
- Solver: `boussinesq_2d`
- Purpose: classic shallow cumulus from localized surface heating.
- Thermodynamics: surface-moist source layer, moderate RH, finite LCL above the first model levels, drier free air aloft.
- Forcing: single heated patch.
- Expected behavior: thermal circulation develops first; cloud water appears later near a finite cloud base rather than immediately at the surface.
- Diagnostics: finite LCL, low below-LCL cloud fraction, cloud base more clustered than cloud top.
- Limitation: Yellow-status Boussinesq prototype; qualitative exploration only;
  simplified entrainment, turbulence, stabilizers, and safety caps shape some
  behavior.

The frontend `fair-weather-moderate-base` scenario is the single-patch baseline. The backend API preset keeps its legacy helper function name but now exposes the public slug `multi-thermal-cumulus-field` because it uses paired warm patches. A fair-weather cumulus baseline scenario that produces no cloud by its configured runtime is considered mislabeled or misconfigured, not an acceptable zero-cloud outcome.

### Multi-thermal cloud field

- Lab: Lower Atmosphere Cloud Basics
- Solver: `boussinesq_2d`
- Purpose: multiple thermals/clouds from structured surface heating.
- Thermodynamics: shared moderately humid source layer with drier air aloft.
- Forcing: two heated patches.
- Expected behavior: distinct thermal responses should remain visible for a useful part of the run before diffusion, wind, or merger changes the field.
- Diagnostics: delayed cloud onset, multiple cloud regions, low early cloud shield coverage.
- Limitation: Yellow-status Boussinesq prototype; not sufficient by itself to
  make a rich product; this is a controlled shallow-cumulus experiment, not the
  whole cloud-lab vision.

### Dry failed cumulus

- Lab: Lower Atmosphere Cloud Basics
- Solver: `boussinesq_2d`
- Purpose: show buoyant motion without cloud formation.
- Thermodynamics: lower RH and higher effective LCL.
- Forcing: localized heating weaker than the cloud-forming fair-weather case.
- Expected behavior: thermal/updraft structure appears while cloud liquid water stays negligible.
- Limitation: Yellow-status Boussinesq prototype; dry suppression is
  qualitative and not a validated turbulence/entrainment result.

### Humid low-cloud contrast

- Lab: Lower Atmosphere Cloud Basics as a contrast/debug scenario; future Fog / Stratus or Layered Atmosphere candidate
- Solver: `boussinesq_2d`
- Purpose: intentionally show very-low-LCL behavior.
- Thermodynamics: near-saturated mixed layer.
- Forcing: weak uneven heating.
- Expected behavior: low cloud or broad deck behavior may appear. This is not labeled as classic fair-weather cumulus.
- Limitation: Yellow-status Boussinesq prototype; low-cloud behavior is a
  contrast/debug scenario, not a polished fog/stratus model.

### Capped / suppressed cloud

- Lab: Lower Atmosphere Cloud Basics / future Evolving Boundary Layer
- Solver: `boussinesq_2d`
- Purpose: show inhibition from a dry/stable layer aloft.
- Thermodynamics: moist lower source layer with a drier cap near the boundary-layer top.
- Forcing: moderate localized heating.
- Expected behavior: thermals lift but cloud development is delayed, limited, or suppressed.
- Limitation: Yellow-status Boussinesq prototype; capped suppression is
  qualitative and should not be presented as validated cloud-resolving dynamics.

### Microphysics lab — lifted humid parcel

- Lab: Warm Rain / Droplet Growth
- Solver: `microphysics_lab`
- Purpose: controlled parcel/box condensation behavior independent of resolved Boussinesq dynamics.
- Thermodynamics: high but not saturated RH.
- Forcing: prescribed upward motion.
- Expected behavior: parcel cools during lift; vapor decreases once cloud water forms; rain indicator may appear if cloud water exceeds the bulk threshold.

### Microphysics lab — no-lift control

- Lab: Warm Rain / Droplet Growth
- Solver: `microphysics_lab`
- Purpose: sanity baseline for controlled microphysics.
- Thermodynamics: sub-saturated parcel/box.
- Forcing: zero prescribed vertical velocity and no heating.
- Expected behavior: no cloud or rain water should appear.

## Saved Experiments And Saved Runs

Saved experiments are reusable setup recipes. They answer:

> How do I run this setup again?

Saved run artifacts are observation records. They answer:

> What happened in this specific run?

Workbench V2 should expose saved scenarios and saved runs as part of the lab workbench, not as default panels competing with the visualization.

## Sounding/Profile View

The vertical profile panel shows the current displayed frame as either:

- the pinned probe column, when a probe is pinned in the 2-D field, or
- a domain-average profile when no probe is pinned.

It reports temperature, derived relative humidity, water vapor, cloud water, and vertical velocity where the frame emits those fields. The panel also marks the estimated LCL, boundary-layer top, and moist-source depth when config metadata is available.

For `microphysics_lab`, fields are spatially uniform parcel/box values broadcast over the shared 2-D frame grid. The profile view should call this out explicitly so users do not interpret the profile as resolved dynamics.

## Future Scenario Organization

Future scenarios should be added under labs, not as a flat catalog.

Before adding a new scenario, answer:

1. Which lab does it belong to?
2. What physical question does it help explore?
3. What controls should be visible by default?
4. What expected behavior should diagnostics protect?
5. What visualization mode best shows the result?
6. What limitation must be disclosed?

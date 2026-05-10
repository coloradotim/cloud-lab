# Cloud Lab Scenarios

Cloud Lab scenarios are user-facing experiments, not just validation fixtures.
Each built-in scenario should answer: what physical setup is being represented,
what behavior is expected, and what caveats should the user keep in mind?

Reference cases remain separate. They are for regression tests and scientific
guardrails. A built-in scenario may borrow from a reference case, but the UI
should read like an experiment catalog rather than a test harness.

Scenario contracts are tested according to the
[testing and validation plan](testing-and-validation.md). That plan defines
which scenario expectations are hard failures, which remain diagnostics, and how
to update tests when scenario assumptions change.

## Expected / Observed Diagnostics

The browser shows a compact scenario check for the selected built-in scenario.
It compares scenario metadata against deterministic observations from the
buffered frames:

- expected behavior from the scenario description and diagnostic expectations
- observed cloud onset, cloud base/top, cloud region count, boundary cloud
  fraction, vertical motion, rain onset, and microphysics water-budget signals
- status: `plausible`, `warning`, `failed_expectation`, or `not_evaluated`
- notes explaining which contract or diagnostic drove the status

This panel is not an AI summary and not a quality score. It is a deterministic
run interpretation layer meant to make scenario contracts visible while keeping
the solver and renderer unchanged.

## Scenario-Aware Controls

Scenario selection also drives control relevance. Built-in scenarios declare the
solver they use, and the setup UI uses a central control metadata model to decide
whether each control is basic, advanced, disabled, hidden, or legacy.

The setup drawer presents scenario meaning before raw controls. For a built-in
scenario, it shows the name, intended phenomenon, thermodynamic assumptions,
forcing setup, expected outcome, diagnostic expectations, and known
limitations. For a custom experiment, it states that no predefined scenario
contract exists and leaves interpretation to the current control values.

Examples:

- Fair-weather and dry-failed Boussinesq scenarios emphasize heating strength,
  heating pattern, source-layer RH, free-atmosphere RH, lapse rate, source-layer
  depth, boundary-layer depth, runtime, and model size.
- `microphysics_lab` scenarios emphasize parcel/source RH, prescribed lift, and
  runtime while hiding Boussinesq surface-heating geometry.
- Weak-random heating hides direct patch center/width controls because the seed
  and pattern own the placement.
- Direct grid, timestep, frame cadence, and seed controls live in Advanced
  model settings. Saved experiments have their own collapsible section.

The UI should not expose a generic pile of sliders for every solver. If a
control would imply a capability that the selected solver does not have, hide it.
If a user may reasonably wonder why a meaningful setting is unavailable, disable
it with an explanation.

## Built-In Scenario Catalog

### Fair-weather cumulus — moderate cloud base

- Solver: `boussinesq_2d`
- Purpose: classic shallow cumulus from localized surface heating.
- Thermodynamics: surface-moist source layer, moderate RH, finite LCL above
  the first model levels, drier free air aloft.
- Forcing: single heated patch.
- Expected behavior: thermal circulation develops first; cloud water appears
  later near a finite cloud base rather than immediately at the surface.
- Diagnostics: finite LCL, low below-LCL cloud fraction, cloud base more
  clustered than cloud top.
- Limitation: qualitative Boussinesq prototype, simplified entrainment and
  turbulence.

The backend `fair-weather-cumulus` preset follows the same science contract but
uses paired warm patches so automated tests can verify delayed cloud formation
and separated cloud regions by the configured runtime. A fair-weather cumulus
scenario that produces no cloud by its configured runtime is considered
mislabeled or misconfigured, not an acceptable zero-cloud outcome.

### Multi-thermal cumulus field

- Solver: `boussinesq_2d`
- Purpose: multiple thermals/clouds from structured surface heating.
- Thermodynamics: shared moderately humid source layer with drier air aloft.
- Forcing: two heated patches.
- Expected behavior: distinct thermal responses should remain visible for a
  useful part of the run before diffusion, wind, or merger changes the field.
- Diagnostics: delayed cloud onset, multiple cloud regions, low early cloud
  shield coverage.

### Dry failed cumulus

- Solver: `boussinesq_2d`
- Purpose: show buoyant motion without cloud formation.
- Thermodynamics: lower RH and higher effective LCL.
- Forcing: localized heating similar to the fair-weather case.
- Expected behavior: thermal/updraft structure appears while cloud liquid water
  stays negligible.

### Humid low-cloud boundary layer

- Solver: `boussinesq_2d`
- Purpose: intentionally show very-low-LCL behavior.
- Thermodynamics: near-saturated mixed layer.
- Forcing: weak uneven heating.
- Expected behavior: low cloud or broad deck behavior may appear. This is not
  labeled as classic fair-weather cumulus.

### Dry cap / suppressed cumulus

- Solver: `boussinesq_2d`
- Purpose: show inhibition from a dry/stable layer aloft.
- Thermodynamics: moist lower source layer with a drier cap near the
  boundary-layer top.
- Forcing: moderate localized heating.
- Expected behavior: thermals lift but cloud development is delayed, limited,
  or suppressed.

### Microphysics lab — lifted humid parcel

- Solver: `microphysics_lab`
- Purpose: controlled parcel/box condensation behavior independent of resolved
  Boussinesq dynamics.
- Thermodynamics: high but not saturated RH.
- Forcing: prescribed upward motion.
- Expected behavior: parcel cools during lift; vapor decreases once cloud water
  forms; rain indicator may appear if cloud water exceeds the bulk threshold.

### Microphysics lab — no-lift control

- Solver: `microphysics_lab`
- Purpose: sanity baseline for controlled microphysics.
- Thermodynamics: sub-saturated parcel/box.
- Forcing: zero prescribed vertical velocity and no heating.
- Expected behavior: no cloud or rain water should appear.

## Saved Experiments

Saved experiments are local browser records stored in `localStorage`. They
contain:

- a user-facing name
- created/updated timestamps
- the config schema version
- a normalized `SimulationConfig`

Built-in scenarios are read-only. Loading a built-in scenario and saving it
creates a user scenario copy that can be updated or deleted locally.

This storage is intentionally local only. Future work may add JSON export,
replay files, parameter sweeps, and side-by-side comparison, but no database or
auth is required for the initial scenario system.

## Sounding/Profile View

The vertical profile panel shows the current displayed frame as either:

- the pinned probe column, when a probe is pinned in the 2-D field, or
- a domain-average profile when no probe is pinned.

It reports temperature, derived relative humidity, water vapor, cloud water, and
vertical velocity where the frame emits those fields. The panel also marks the
estimated LCL, boundary-layer top, and moist-source depth when config metadata is
available.

For `microphysics_lab`, fields are spatially uniform parcel/box values broadcast
over the shared 2-D frame grid. The profile view calls this out explicitly so
users do not interpret the profile as resolved dynamics.

# Testing And Validation Plan

Cloud Lab testing has two jobs:

1. Keep the software contracts stable.
2. Keep the scientific and product behavior honest.

Tests should not merely make CI green. They should make sure Cloud Lab remains a
reliable exploratory cloud-physics sandbox as the solver, scenarios, and
visualizations evolve.

Core principle:

```text
Tests should protect the current scientific and product contract, not old toy-model behavior and not accidental new behavior.
```

When a physics-related test fails, do not assume the test is stale and do not
assume the code is wrong. Classify the test first, then decide whether to update
the expectation, fix the implementation, rename or reframe the scenario, or
convert the check to a diagnostic warning.

Related docs:

- [Development](development.md)
- [Scenario catalog](scenarios.md)
- [Boussinesq validation](boussinesq-validation.md)
- [Microphysics lab](microphysics-lab.md)
- [Microphysics comparison](microphysics-comparison.md)
- [Simulation data model](simulation-data-model.md)
- [Scientific visualization dashboard](visualization-dashboard.md)

## Purpose

Cloud Lab is both software and a scientific/visual model. The test suite must
therefore protect:

- application contracts: API shapes, schema versions, solver dispatch, frontend
  assumptions, and saved configuration compatibility
- model behavior: physically meaningful directionality, named scenario promises,
  numerical sanity, and transparent diagnostic caveats

The test suite must prevent two opposite failure modes:

```text
1. Tests preserve old wrong physics.
2. Tests are changed to bless new wrong physics.
```

Passing tests should mean the current model still honors the documented product
and science contract. Passing tests should not mean the model is meteorologically
complete or quantitatively validated.

## Test Categories

### A. Contract / API / Schema Tests

Purpose:

```text
Confirm that the application and solvers communicate through stable contracts.
```

These are not science tests. They protect interfaces.

Examples:

- `SimulationConfig` validates.
- `SimulationFrame` validates.
- fields match grid shape.
- fields include unit metadata.
- solver catalog exposes only public solvers.
- explicit legacy configs still run.
- scenario configs validate.
- saved configs round-trip.
- frontend type assumptions match backend schema.

Current expectations:

- public/default 2-D solver is `boussinesq_2d`
- `microphysics_lab` is public for controlled parcel/box microphysics
- `educational_2d` remains backend-supported only for explicit legacy configs
  and regression use
- scenario and saved-config behavior should preserve schema compatibility

Hard failure policy:

- These should usually fail CI.
- Intentional contract changes must update schemas, docs, tests, and PR notes in
  the same change.

### B. Numerical Sanity Tests

Purpose:

```text
Confirm that the model does not produce numerical garbage.
```

Examples:

- no NaNs/Infs
- finite fields
- non-negative vapor/cloud/rain
- quiet/no-forcing case remains quiet
- no spontaneous cloud in unforced dry/subsaturated cases
- seeded runs are reproducible
- normal runs do not hit safety caps
- Boussinesq divergence remains bounded
- time/frame cadence behaves correctly
- grid shape remains consistent

Hard failure policy:

- These should usually be hard failures.
- Do not relax them to make a scenario pass unless there is a clearly documented
  numerical reason.
- If a numerical sanity test fails after a physics change, first investigate the
  new physics and boundary behavior before changing the threshold.

### C. Physics Relationship Tests

Purpose:

```text
Confirm that the model responds in the correct physical direction.
```

These are preferred over brittle magic thresholds.

Examples:

- increasing relative humidity lowers expected LCL.
- decreasing relative humidity raises LCL or suppresses cloud.
- stronger heating gives stronger vertical response than weaker heating, all
  else equal.
- dry failed cumulus produces motion but little/no cloud.
- no-lift microphysics case stays cloud-free.
- lifted humid parcel condenses.
- heating offsets lift and delays or reduces condensation.
- dry cap/stable layer suppresses cloud depth or cloud amount compared with a
  comparable uncapped case.
- multi-thermal forcing creates multiple thermal/cloud regions for at least part
  of the run, when that is the scenario's stated purpose.

Hard failure policy:

- Use hard failures when the relationship is robust and controlled.
- Use warnings or diagnostics when the relationship depends on prototype behavior
  or not-yet-calibrated thresholds.

Bad examples to avoid:

- `cloud water must exceed old threshold X by exactly 900 seconds`
- `boundary-layer depth must always be 500 m`
- `fair-weather cloud must appear by 15 minutes regardless of scenario runtime`

### D. Scenario Contract Tests

Purpose:

```text
Confirm that named user-facing scenarios do what they claim.
```

A scenario is a user-facing experiment. It has an intent. Tests must protect
that intent.

A built-in scenario should include metadata:

- name
- slug
- category
- solver
- intended phenomenon
- thermodynamic setup
- forcing setup
- expected qualitative behavior
- expected diagnostics
- limitations/caveats

#### Fair-weather Cumulus — Moderate Cloud Base

Hard expectations:

- uses `boussinesq_2d`
- uses a physically described source-layer / surface-moist initialization
- has finite expected LCL above the surface, not basically fog
- does not produce immediate surface-attached cloud
- produces cloud liquid water by configured runtime
- cloud is not primarily boundary/sponge artifact
- cloud onset is not wildly inconsistent with LCL/saturation diagnostics

Diagnostics / warnings:

- below-LCL cloud fraction
- cloud-base spread
- cloud-top spread
- cloud-water centroid
- cloud region count

Non-negotiable:

```text
If a scenario is named fair-weather cumulus and produces zero cloud by its configured runtime, do not update the test to accept zero cloud. Fix the scenario, extend runtime, adjust physically defensible initialization/forcing, or rename the scenario.
```

#### Multi-Thermal Cumulus Field

Expectations:

- multiple thermal responses occur
- if clouds form, multiple cloud regions should exist for at least part of the
  run
- region merger later is acceptable if documented
- cloud bases should be more clustered than tops in well-mixed cases, at least
  as a diagnostic

#### Dry Failed Cumulus

Hard expectations:

- produces motion/updraft response
- produces negligible or no cloud
- useful negative control against fair-weather cumulus

#### Humid Low-Cloud / Foggy Boundary Layer

Hard expectations:

- very low LCL is expected
- low cloud is allowed
- must not be labeled classic fair-weather cumulus
- should clearly say near-saturated/low-cloud behavior

#### Dry Cap / Suppressed Cumulus

Relationship expectations:

- cloud depth, integrated cloud water, or cloud top is reduced compared with a
  comparable no-cap/moist case
- exact no-cloud outcome may be a diagnostic first

#### Microphysics Lab — Lifted Humid Parcel

Hard expectations:

- prescribed lift cools parcel
- condensation occurs after saturation
- vapor decreases after condensation
- total water budget remains sane
- rain appears only after bulk threshold if applicable

#### Microphysics Lab — No-Lift Control

Hard expectations:

- no cloud
- no rain
- water budget stable

### E. Reference / Validation Tests

Purpose:

```text
Provide developer-facing validation cases that catch regressions.
```

Reference cases are not the same as scenarios.

Examples:

- quiet atmosphere
- dry thermal bubble
- Boussinesq divergence checks
- Boussinesq thermodynamic structure diagnostics
- microphysics validation cases
- surface/moisture initialization sanity checks

Reference cases may be exposed in the UI for debugging, but they should not be
presented as polished user scenarios unless wrapped with user-facing metadata.

### F. Diagnostic / Warning Checks

Purpose:

```text
Compute important physical indicators before the model is mature enough to hard-fail on them.
```

Examples:

- below-LCL cloud-water fraction
- cloud-water in return-flow regions
- boundary cloud fraction
- cloud-base spread
- cloud-top spread
- cloud-water centroid
- RH/saturation mismatch at cloud onset
- cloud deck vs isolated cumulus classification
- rain timing
- region merger timing
- source-layer mixedness

Rules:

- warnings must be surfaced in validation summaries/docs
- warnings must not be silently ignored
- warnings can become hard failures after thresholds are calibrated

## Hard Failures Vs Warnings

### Hard Failures

Use hard failures for:

- schema/API contract breaks
- NaNs/Infs
- negative moisture
- no-forcing creates motion/cloud
- reproducibility breaks
- public scenario violates its core promise
- fair-weather cumulus produces no cloud by configured runtime
- dry failed cumulus produces significant cloud
- microphysics no-lift control produces cloud/rain
- public solver catalog exposes retired/legacy solver unintentionally

### Warnings / Diagnostics

Use warnings for:

- below-LCL cloud fraction near threshold
- cloud-base spread
- cloud water in weak return flow
- cloud deck tendency
- onset somewhat below expected LCL
- exact cloud amount
- exact cloud timing, unless scenario contract depends on it
- prototype Boussinesq morphology issues

Warnings are not a junk drawer. They are tracked indicators that are not yet
calibrated enough to fail CI. If a warning becomes central to user trust or a
scenario contract, promote it to a hard failure.

## How To Update Tests When Physics Assumptions Change

Use this process for PRs that touch solver physics, initialization, scenarios,
or validation expectations.

1. Identify what changed:
   - solver physics
   - initialization
   - default config
   - scenario definition
   - public solver visibility
   - visualization only
   - API/schema only

2. Classify failing tests:
   - contract
   - numerical sanity
   - scientific behavior
   - scenario contract
   - diagnostic/warning
   - obsolete legacy

3. For each failing test, choose one action:
   - keep test, fix code
   - update assertion
   - rewrite around better scientific expectation
   - convert to warning diagnostic
   - move to validation suite
   - delete only if truly obsolete

4. Document why.

5. Update docs if the product/science contract changed.

6. Run the appropriate test tier.

Explicit rules:

```text
Do not update tests to accept accidental new behavior.
```

```text
Do not keep tests that only preserve obsolete toy-model expectations.
```

## Current Solver-Specific Expectations

### `boussinesq_2d`

Role:

- public/default 2-D cloud solver
- qualitative shallow-cloud dynamics scaffold
- not quantitative CFD

Tests should protect:

- bounded divergence
- quiet/no-forcing stillness
- dry thermal motion without cloud
- fair-weather cumulus scenario clouds by configured runtime
- dry failed cumulus remains mostly cloud-free
- source-layer/humidity initialization coherence
- LCL/thermodynamic diagnostics are available
- no significant boundary-dominated cloud in normal scenarios

Tests should not claim:

- quantitative cloud prediction
- real turbulence/entrainment closure
- resolved precipitation
- full atmospheric realism

### `microphysics_lab`

Role:

- controlled parcel/box microphysics lab
- prescribed forcing, not resolved dynamics

Tests should protect:

- no-lift control stays dry/cloud-free
- lifted humid parcel condenses
- vapor decreases after condensation
- bulk rain appears only after threshold conditions
- total water budget is sane
- fields remain finite/non-negative

Tests should not claim:

- 2-D flow realism
- droplet-resolved precipitation unless PySDM/droplet outputs are actually
  present
- physical rain shafts

### `educational_2d`

Role:

- legacy/internal compatibility model
- not public user-facing solver

Tests should protect:

- explicit legacy configs still run
- output frames validate
- hiding from public solver catalog is intentional

Tests should not require:

- public UI exposure
- scientific behavior consistency with current scenarios

## CI / Test Tier Policy

### Fast PR CI

Should include:

- contract tests
- schema tests
- API tests
- public solver catalog tests
- scenario metadata validation
- frontend tests/build
- fast numerical sanity
- microphysics basic checks
- Boussinesq short smoke checks

### Targeted Validation

Run when relevant files change:

- Boussinesq solver changed: Boussinesq validation and thermodynamic diagnostics
- scenario presets changed: scenario contract tests
- microphysics changed: microphysics validation
- visualization changed: scaling/truth-label tests
- public solver/default config changed: full contract/API/schema suite

### Science / Manual Validation

Run for:

- major physics PRs
- scenario regime changes
- before release/checkpoint
- when diagnostics thresholds change

Includes:

- longer Boussinesq cases
- fair-weather thermodynamic structure
- multi-thermal morphology
- S/M/L runs
- PySDM optional tests if installed

### Full Backend Suite

Required when a PR changes:

- default solver
- public solver catalog
- default humidity profile
- scenario/preset behavior
- solver physics
- `SimulationConfig`
- frame schema
- scientific expectations

PR #75 is the reference example of a PR that required the full backend suite.

## Required PR Checklist For Solver/Scenario Changes

For any PR changing solver/scenario behavior, the PR body must include:

```text
Test expectation changes:
- Which old expectations changed?
- Why are they obsolete or still valid?
- Which tests were rewritten?
- Which diagnostics became warnings?
- Which scenario contracts are now protected?
```

And:

```text
Scientific/product behavior changes:
- default solver changed? yes/no
- public solver list changed? yes/no
- scenario behavior changed? yes/no
- physics assumptions changed? yes/no
- docs updated? yes/no
```

Also include:

- validation tier(s) run
- any known warnings or xfails
- whether scenario metadata changed
- whether user-facing labels still match model behavior

## Maintenance Notes

This document is itself part of the model contract. Update it when Cloud Lab adds
new solvers, new public scenarios, new diagnostics, new validation tiers, or new
rules for hard failures versus warnings.

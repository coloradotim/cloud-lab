# Testing And Validation Plan

Cloud Lab testing has two jobs:

1. Keep the software contracts stable.
2. Keep the scientific, visual, and product behavior honest.

Tests should not merely make CI green. They should make sure Cloud Lab remains a reliable lab-driven cloud-physics product as solvers, scenarios, diagnostics, and visualizations evolve.

Core principle:

```text
Tests should protect the current lab/science/product contract, not old toy-model behavior and not accidental new behavior.
```

When a physics-related test fails, do not assume the test is stale and do not assume the code is wrong. Classify the test first, then decide whether to update the expectation, fix the implementation, rename or reframe the lab/scenario, or convert the check to a diagnostic warning.

Related docs:

- [Product vision](product-vision.md)
- [Lab roadmap](lab-roadmap.md)
- [Workbench V2 product spec](workbench-v2-product-spec.md)
- [Development](development.md)
- [Scenario catalog](scenarios.md)
- [Boussinesq validation](boussinesq-validation.md)
- [Microphysics lab](microphysics-lab.md)
- [Microphysics comparison](microphysics-comparison.md)
- [Simulation data model](simulation-data-model.md)
- [Visualization and workbench views](visualization-and-workbench-views.md)

## Purpose

Cloud Lab is both software and a scientific/visual learning product. The test suite must protect:

- application contracts: API shapes, schema versions, solver dispatch, frontend assumptions, and saved artifact compatibility
- lab contracts: the physical question, expected behavior, controls, diagnostics, and limitations for each lab
- scenario contracts: named user-facing experiments inside labs
- model behavior: physically meaningful directionality, numerical sanity, and transparent diagnostic caveats
- visualization honesty: direct fields, derived diagnostics, bulk approximations, visual approximations, and experimental outputs remain distinguishable

The test suite must prevent two opposite failure modes:

```text
1. Tests preserve old wrong physics.
2. Tests are changed to bless new wrong physics.
```

Passing tests should mean the current model still honors the documented product and science contract. Passing tests should not mean the model is meteorologically complete or quantitatively validated.

## Test Hierarchy

Use this hierarchy when deciding what a test protects:

```text
Software contract
  ↓
Lab contract
  ↓
Scenario contract
  ↓
Physics relationship
  ↓
Diagnostic / warning
  ↓
Visualization / rendering interpretation
```

A lab contract is broader than a scenario. For example, the Lower Atmosphere Cloud Basics Lab includes the expectation that moisture, heating, stability, and LCL/cloud-base diagnostics help users understand shallow cloud formation. Individual scenarios such as fair-weather cumulus / baseline shallow cloud, dry failed cumulus, or multi-thermal cloud field are specific experiments inside that lab.

## Test Categories

Backend pytest markers should describe what a test protects as well as when it
should run. The current marker vocabulary is:

- `contract`: stable software, API, schema, and run lifecycle contracts.
- `lab`: lab, scenario, preset, and public catalog contracts.
- `diagnostic`: diagnostic or warning checks that interpret solver outputs.
- `science`: science-sensitive checks that belong outside generic backend
  plumbing.
- `boussinesq`: Boussinesq 2-D solver, diagnostic, or validation checks.
- `microphysics`: microphysics lab solver and comparison checks.
- `validation`: reference-case or benchmark validation checks.
- `slow`: long-running checks reserved for slow/manual validation tiers.
- `pysdm`: optional PySDM evaluation checks.

Markers are not a substitute for reading the test. When a test is both fast and
science-sensitive, prefer explicit domain markers over leaving it as generic
backend quick plumbing.

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
- solver catalog exposes expected public physics cores.
- explicit legacy configs still run.
- lab/scenario configs validate.
- saved scenarios and saved runs round-trip.
- frontend type assumptions match backend schema.

Hard failure policy:

- These should usually fail CI.
- Intentional contract changes must update schemas, docs, tests, and PR notes in the same change.

### B. Lab Contract Tests

Purpose:

```text
Confirm that a lab still supports the physical question it claims to explore.
```

Examples:

- Lower Atmosphere Cloud Basics Lab supports cloud formation, failed-cloud controls, LCL/cloud-base diagnostics, and source-layer moisture/stability controls.
- Warm Rain / Droplet Growth Lab separates cloud water from rain and does not imply droplet-resolved precipitation when only bulk behavior exists.
- Cloud Optics / Beauty Lab labels optical appearance and 2.5-D views as visual approximations unless richer physics exists.
- Orographic / Terrain Cloud Lab includes flat/dry/moist controls before terrain results are treated as meaningful.

Lab contract tests may be code tests, scenario metadata tests, or docs/metadata checks depending on maturity.

### C. Scenario Contract Tests

Purpose:

```text
Confirm that named user-facing scenarios do what they claim.
```

A scenario is a user-facing experiment inside a lab. It has an intent. Tests must protect that intent.

A built-in scenario should include metadata:

- lab
- name
- slug
- solver / physics core
- intended phenomenon
- thermodynamic setup
- forcing setup
- expected qualitative behavior
- expected diagnostics
- limitations/caveats

Lower Atmosphere Cloud Basics v2 scenario-contract metadata is covered by
focused backend and frontend tests:

```bash
cd backend
pytest backend/tests/test_lower_atmosphere_v2_scenarios.py

cd frontend
npm run test -- lowerAtmosphereV2Scenarios
npm run test -- lowerAtmosphereV2ReferenceComparison
```

These are metadata/contract checks. They ensure the required v2 scenario ids,
flow-mode compatibility, expected profile/cloud-column/precipitation statuses,
honesty labels, comparison pairs, and no-Boussinesq-default rule remain intact.
They also protect scenario interpretation details such as the default
`Dry failed cumulus` combined flow remaining cloud-free and deterministic
expected-vs-observed handling for split profile/column outcomes. They do not run
Boussinesq validation.

The reference-comparison tests protect the qualitative mapping from Lower
Atmosphere v2 scenarios to CM1 reference case ids, missing-reference fallback,
source/provenance labels, comparison diagnostics, and the rule that exact CM1
cloud morphology is not treated as a pass/fail target. They do not run CM1 or
require real CM1 output in CI.

CM1 local-ingestion tests protect the repo-side path from ignored local output
to Cloud Lab reference artifacts:

```bash
cd backend
.venv/bin/python -m pytest tests/test_cm1_adapter.py tests/test_cm1_ingest.py -q
```

These checks use tiny adapter-input fixtures only. They verify
`reference-run-v1` / `reference-frame-v1` artifact generation, manifests,
provenance, diagnostics, missing-field warnings, invalid-grid failures, and
script help/syntax. They do not run CM1, read large local output, or require
NetCDF/xarray in CI.

Hard failure policy:

- A scenario that violates its core promise should fail or be renamed/reframed.
- Do not update expectations to accept behavior that contradicts the scenario name or lab question.

### D. Numerical Sanity Tests

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
- Do not relax them to make a scenario pass unless there is a clearly documented numerical reason.

### E. Physics Relationship Tests

Purpose:

```text
Confirm that the model responds in the correct physical direction.
```

These are preferred over brittle magic thresholds.

Examples:

- increasing relative humidity lowers expected LCL.
- decreasing relative humidity raises LCL or suppresses cloud.
- higher humidity in a controlled cloud column forms cloud earlier than a drier
  comparable column.
- stronger prescribed lift in a controlled cloud column forms cloud earlier than
  weaker prescribed lift, all else equal.
- stronger heating gives stronger vertical response than weaker heating, all else equal.
- dry failed cumulus produces motion but little/no cloud.
- no-lift microphysics case stays cloud-free.
- no-lift controlled cloud-column cases stay cloud-free.
- lifted humid parcel condenses.
- heating offsets lift and delays or reduces condensation.
- cap suppression in a controlled cloud column delays or prevents cloud relative
  to an uncapped comparable column.
- evaporation in subsaturated controlled-column layers reduces cloud liquid water.
- dry cap/stable layer suppresses cloud depth or cloud amount compared with a comparable uncapped case.
- paired stable/capped validation changes only the stability or cap structure being tested; humidity, heating, domain, resolution, runtime, and seed remain fixed.
- multi-thermal forcing creates multiple thermal/cloud regions for at least part of the run, when that is the scenario's stated purpose.

Hard failure policy:

- Use hard failures when the relationship is robust and controlled.
- Use warnings or diagnostics when the relationship depends on prototype behavior or not-yet-calibrated thresholds.

### F. Reference / Validation Tests

Purpose:

```text
Provide developer-facing validation cases that catch regressions.
```

Reference cases are not the same as labs or scenarios.

Examples:

- quiet atmosphere
- dry thermal bubble
- Boussinesq divergence checks
- Boussinesq thermodynamic structure diagnostics
- Lower Atmosphere Cloud Basics resolution/domain/runtime sensitivity matrix
- microphysics validation cases
- surface/moisture initialization sanity checks

Reference cases may be exposed in the UI for debugging, but they should not be presented as polished user scenarios unless wrapped with lab/scenario metadata.

### G. Diagnostic / Warning Checks

Purpose:

```text
Compute important physical indicators before the model is mature enough to hard-fail on them.
```

Examples:

- below-LCL cloud-water fraction
- cloud-water in return-flow regions
- boundary cloud fraction
- cloud-water in the top sponge / lid region
- cloud-water touching lateral boundaries
- cloud regions touching model boundaries
- cloud-water in locally subsaturated cells
- cloud-water in downdraft, near-surface, and near-boundary regions
- estimated condensation and evaporation tendencies for emitted frames
- cloud-base spread
- cloud-top spread
- cloud-water centroid
- RH/saturation mismatch at cloud onset
- cloud deck vs isolated cumulus classification
- rain timing
- region merger timing
- source-layer mixedness

For long Lower Atmosphere Cloud Basics / multi-thermal Boussinesq runs, tests
may use diagnostic warning thresholds rather than hard Green/Red claims. A
regression should fail when meaningful cloud-water mass again persists in
locally subsaturated air, while return-flow and boundary artifact policy remains
warning-oriented unless a scenario contract explicitly makes it a hard failure.

Rules:

- warnings must be surfaced in validation summaries/docs
- warnings must not be silently ignored
- warnings can become hard failures after thresholds are calibrated
- Lower Atmosphere Cloud Basics currently treats low-level return-flow, top
  sponge, lateral-boundary, and boundary-connected cloud as warnings. A large
  below-LCL cloud-water fraction is a hard failure because it conflicts with the
  lab's cloud-base contract.

### H. Visualization Honesty Tests

Purpose:

```text
Ensure visualizations do not misrepresent what is modeled.
```

Examples:

- cloud appearance mode is labeled as a visual/bulk optical approximation
- 2.5-D view is labeled as a visual extrusion from 2-D fields
- comparison views use shared scales by default where appropriate
- zero/near-zero cloud water is not rendered as meaningful cloud
- visual controls do not mutate solver fields
- raw scientific field views remain available when pretty views exist

## Hard Failures Vs Warnings

### Hard Failures

Use hard failures for:

- schema/API contract breaks
- NaNs/Infs
- negative moisture
- no-forcing creates motion/cloud
- reproducibility breaks
- public lab/scenario violates its core promise
- fair-weather cumulus produces no cloud by configured runtime
- dry failed cumulus produces significant cloud
- microphysics no-lift control produces cloud/rain
- public solver catalog exposes retired/legacy solver unintentionally
- visual approximation is presented as direct physical output

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

Warnings are not a junk drawer. They are tracked indicators that are not yet calibrated enough to fail CI. If a warning becomes central to user trust or a lab/scenario contract, promote it to a hard failure.

## How To Update Tests When Assumptions Change

Use this process for PRs that touch solver physics, initialization, lab/scenario definitions, visualization assumptions, or validation expectations.

1. Identify what changed:
   - solver physics
   - initialization
   - default config
   - lab definition
   - scenario definition
   - public solver visibility
   - visualization only
   - API/schema only

2. Classify failing tests:
   - contract
   - lab contract
   - scenario contract
   - numerical sanity
   - physics relationship
   - diagnostic/warning
   - visualization honesty
   - obsolete legacy

3. For each failing test, choose one action:
   - keep test, fix code
   - update assertion
   - rewrite around better scientific/product expectation
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

- public/default 2-D cloud dynamics scaffold
- supports selected labs such as Lower Atmosphere Cloud Basics
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
- supports Warm Rain / Droplet Growth concepts until richer microphysics exists

Tests should protect:

- no-lift control stays dry/cloud-free
- lifted humid parcel condenses
- vapor decreases after condensation
- bulk rain appears only after threshold conditions
- total water budget is sane
- fields remain finite/non-negative

Tests should not claim:

- 2-D flow realism
- droplet-resolved precipitation unless PySDM/droplet outputs are actually present
- physical rain shafts unless sedimentation/evaporation is implemented and validated

### `boundary_layer_1d`

Role:

- standalone 1-D lower-atmosphere profile evolution model
- reduced model for Evolving Boundary Layer v1
- diagnoses cloud formation potential without emitting cloud water in v1

Tests should protect:

- finite temperature, vapor, RH, and diagnostic values
- strictly increasing height coordinates
- bounded RH and nonnegative water vapor
- mixed-layer depth inside the profile domain
- deterministic output for fixed configs
- no cloud liquid water field in v1 profile frames
- no-flux control remains mostly unchanged
- stronger heating deepens the mixed layer relative to weak heating
- stronger moisture flux lowers LCL or increases RH relative to dry surface
- higher initial humidity lowers initial LCL
- stronger cap suppresses mixed-layer growth
- dry entrainment worsens potential when air aloft is dry
- cloud-potential status and reason strings remain deterministic

Tests should not claim:

- cloud water production
- 2-D cloud dynamics
- turbulence closure, LES, mesoscale, terrain, precipitation, or optics fidelity
- live coupling to `boussinesq_2d`

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
- scientific behavior consistency with current labs/scenarios

## CI / Test Tier Policy

CI is path-aware. The workflow keeps a stable `CI required` summary job for branch protection, while purpose-specific jobs run or skip based on changed files.

Expected PR paths:

- UI-only: `Frontend quick` only, plus `CI required`.
- Backend/API/schema: `Backend quick` only, plus `CI required`.
- Lab/scenario metadata: backend or frontend quick checks for the touched
  contract surface; targeted solver/science only when solver behavior,
  science-sensitive diagnostics, or validation expectations changed.
- Solver/science/validation: `Backend quick`, `Targeted solver/science`, plus `CI required`.
- Docs-only: `CI required` only unless workflow/code paths changed.
- Scheduled/manual: quick jobs plus `Science validation`.

### Fast PR CI

Should include:

- contract tests
- schema tests
- API tests
- public solver catalog tests
- lab/scenario metadata validation
- frontend tests/build
- fast non-science numerical sanity

Boussinesq thermodynamic diagnostics are explicitly marked as science-sensitive
diagnostic checks. They run with targeted solver/science, not generic backend
quick, even though they are individually fast.

### Targeted Validation

Run when relevant files change:

- Boussinesq solver or diagnostics changed: Boussinesq short checks and
  thermodynamic diagnostics
- lab/scenario definitions changed: lab/scenario contract tests such as
  `pytest -m "lab and not slow and not science and not validation and not pysdm"`
  for backend lab/preset contracts, plus focused frontend lab catalog/workbench
  tests when the frontend catalog changed
- microphysics changed: microphysics validation
- visualization changed: scaling/truth-label/visual honesty tests
- public solver/default config changed: full contract/API/schema suite

### Science / Manual Validation

Run for:

- major physics PRs
- lab/scenario regime changes
- before release/checkpoint
- when diagnostics thresholds change

Includes:

- longer Boussinesq cases
- fair-weather thermodynamic structure
- multi-thermal morphology
- S/M/L runs
- PySDM optional tests if installed

## Required PR Checklist For Product/Science Changes

For any PR changing product, lab, solver, scenario, visualization, or validation behavior, include:

```text
Lab/product impact:
- Lab served:
- Physical question supported:
- User control / diagnostic / visual payoff:
- Approximation or limitation disclosed:
```

For solver/scenario changes, also include:

```text
Test expectation changes:
- Which old expectations changed?
- Why are they obsolete or still valid?
- Which tests were rewritten?
- Which diagnostics became warnings?
- Which lab/scenario contracts are now protected?
```

And:

```text
Scientific/product behavior changes:
- default solver changed? yes/no
- public solver list changed? yes/no
- lab/scenario behavior changed? yes/no
- physics assumptions changed? yes/no
- docs updated? yes/no
```

## Maintenance Notes

This document is part of the model/product contract. Update it when Cloud Lab adds new labs, new solvers, new public scenarios, new diagnostics, new validation tiers, or new rules for hard failures versus warnings.

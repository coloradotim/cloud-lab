# AI Handoff

This file is the fast-start handoff for a new ChatGPT or Codex session working on Cloud Lab.

Use it to avoid relying on long chat history. Update this file at the end of meaningful work sessions when the current phase, priorities, risks, or next steps change.

## Project

Cloud Lab

## Repo

`coloradotim/cloud-lab`

## Product Summary

Cloud Lab helps users explore atmospheric physics through beautiful, interactive cloud experiments grounded in real physical principles.

Short phrase:

> Beautiful cloud experiments. Real atmospheric physics.

Cloud Lab is not a solver demo, dashboard, or generic toy model. It is a lab-driven cloud physics platform. Users choose a phenomenon lab, adjust meaningful atmospheric controls, run or explore a local experiment, watch/inspect what happened, save/compare where appropriate, and learn real atmospheric physics.

## Durable Rule

> Solver outputs physical fields. Renderer turns fields into views. UI controls experiments. Diagnostics explain behavior. Documentation explains assumptions. Tests protect the science.

## Current Product Mode

Cloud Lab is currently in two overlapping modes:

1. **Workbench V2 / reference-lab implementation**
   - Build the lab-driven app shell.
   - Make Lower Atmosphere Cloud Basics the first usable reference lab.
   - Retire the old dashboard as the default product model.

2. **Solver-trust remediation planning for Boussinesq-dependent work**
   - `boussinesq_2d` is Yellow: useful as a constrained experimental dynamics scaffold, but not broadly trusted as a foundation for polished cloud-resolving labs.
   - Lower Atmosphere Cloud Basics can continue only with honest experimental labels and tighter validation. Fair-weather cumulus is a scenario family inside it, not the lab name.
   - Future Boussinesq-dependent labs should remain prototype-only or pause until trust gaps are resolved or explicitly accepted.

3. **Lower-atmosphere reduced-model implementation**
   - `boundary_layer_1d` v1 now exists as a standalone backend profile model
     and Workbench V2 profile lab.
   - It evolves 1-D temperature, vapor/RH, mixed-layer depth, LCL, cap, heating,
     moisture, and entrainment-drying diagnostics.
   - It diagnoses cloud formation potential and intentionally emits no cloud
     water in v1.
   - `controlled_cloud_column` v1 now exists as a separate backend prescribed-lift
     cloud-formation model. It consumes a profile, emits cloud liquid water and
     deterministic formation diagnostics, and labels lift as prescribed rather
     than predicted.

## Read First

Before doing repo work, read:

1. `AGENTS.md`
2. `docs/ai-handoff.md`
3. `docs/current-phase-plan.md`
4. `docs/doc-index.md`
5. `docs/product-vision.md`

For Workbench V2 / Lower Atmosphere Cloud Basics work, also read:

6. `docs/workbench-v2-product-spec.md`
7. `docs/workbench-v2-architecture.md`
8. `docs/labs/lower-atmosphere-cloud-basics.md`
9. the issue being implemented

For Boussinesq / Lower Atmosphere Cloud Basics trust remediation, also read:

6. `docs/test-suite-review-and-solver-trust.md`
7. `docs/test-suite-audit.md`
8. `docs/boussinesq-validation.md`
9. `docs/testing-and-validation.md`
10. `docs/scientific-roadmap.md`
11. `docs/next-physics-core.md`
12. the issue being implemented

## Current Workbench / Lab Direction

Use `docs/current-phase-plan.md` for the current executable product phase. Use
`docs/lower-atmosphere-modeling-strategy.md` for lower-atmosphere science
architecture.

The active product direction remains Workbench V2 and lab-driven UI, but the
lower-atmosphere science implementation path has pivoted away from treating
`boussinesq_2d` as the main future science engine.

Lower Atmosphere Cloud Basics v1 can continue to use Yellow-labeled
`boussinesq_2d` for controlled qualitative experiments. Lower Atmosphere Cloud
Basics v2 and Evolving Boundary Layer work should be re-cut from the
lower-atmosphere model hierarchy rather than from old implementation issue
ladders.

Lab design/spec work is product/science architecture work. Do not hand Codex a
new lab design issue cold and ask it to decide the lab's product/science
direction.

Use this split:

- ChatGPT / human review: lab question, user promise, controls, physics scope, diagnostics, honesty labels, lab spec, issue decomposition.
- Codex: scoped implementation issues created from approved lab specs.

## Test / CI Direction

Use `docs/testing-and-validation.md` and `docs/development.md` for current test
tier guidance. Keep docs-only PRs lightweight unless code, schemas, workflows,
imports, package files, or frontend metadata change.

## Boussinesq / Lower Atmosphere Trust Status

Current trust decision:

```text
Yellow — restrict current boussinesq_2d use
```

Why Yellow:

- useful as constrained experimental dynamics scaffold
- not broadly trusted as atmospheric dynamics
- Lower Atmosphere Cloud Basics can continue only with honest experimental labels and tighter validation
- future Boussinesq-dependent labs should pause or remain prototype-only until trust gaps are resolved
- do not live-couple Evolving Boundary Layer into Boussinesq yet

Continue non-Boussinesq paths:

- Evolving Boundary Layer profile model
- Clouds, Light, and Shadow / Cloud Optics static or field-driven optics work
- controlled microphysics paths

## Boussinesq Trust Evidence

Boussinesq-dependent work gate:

- Continue Lower Atmosphere Cloud Basics only with honest experimental labels.
- Do not treat `boussinesq_2d` as a broadly trusted dynamics foundation.
- Do not build polished future Boussinesq-dependent labs until trust gaps are resolved or explicitly accepted.
- Do not live-couple Evolving Boundary Layer into Boussinesq yet.
- Continue non-Boussinesq paths.

Stable/capped suppression status:

- Dedicated paired stable/capped suppression validation exists for Lower Atmosphere Cloud Basics.
- Current solver behavior passes the controlled lapse-rate pair and low/strong-cap versus high/weak-cap pair without solver physics changes.
- This narrows the stability-suppression trust gap but does not make `boussinesq_2d` broadly trusted.

Cloud-water persistence status:

- A 4800 s Lower Atmosphere Cloud Basics paired-thermal reproduction exists for cloud-water persistence in subsaturated descending/return-flow regions.
- Backend diagnostics now report subsaturated, downdraft, return-flow, below-LCL, near-surface, and near-boundary cloud-water fractions, plus estimated condensation/evaporation tendencies and approximate subsaturated-cloud lifetime.
- The solver now evaporates pre-existing transported cloud water against the emitted cell's local pressure-aware saturation state while preserving lifted-parcel condensation.
- The reproduction no longer shows the old majority-subsaturated-cloud-water failure, but it still reports return-flow cloud-water warnings. `boussinesq_2d` remains Yellow.

Return-flow / boundary policy status:

- Lower Atmosphere Cloud Basics now has an explicit return-flow / boundary cloud-water diagnostic policy.
- Large below-LCL cloud-water fractions are hard failures; smaller below-LCL fractions are warnings.
- Low-level return-flow, boundary, top-sponge, lateral-boundary, and boundary-connected cloud water are warnings or scenario-specific interpretation signals, not renderer masks.
- Backend diagnostics expose artifact-policy check statuses and boundary-region fractions; frontend inspector diagnostics surface the same warning categories.
- This policy does not tune scenarios, hide cloud water, or resolve the
  remaining return-flow/stabilizer trust gap. `boussinesq_2d` remains Yellow;
  deeper causes remain with stabilizer audits and successor-core decisions.

Resolution/domain/runtime sensitivity status:

- Lower Atmosphere Cloud Basics now has an explicit resolution/domain/runtime sensitivity validation matrix.
- Baseline shallow cloud remains cloud-forming across supported resolution/domain/runtime variants; dry failed remains cloud-free; capped/suppressed remains suppressed.
- Short `600 s` runtime is diagnostic-only for cloud-forming scenarios because it can end before delayed cloud onset.
- The default `36 x 24`, `10 km x 3 km`, `1200 s` envelope remains recommended.
- `boussinesq_2d` remains Yellow because high-resolution, smaller-domain, and long-runtime baseline runs show material sensitivity and artifact warnings.

Stabilizer audit status:

- A dedicated stabilizer audit exists in `docs/boussinesq-stabilizer-audit.md`.
- Backend validation can run the audit with `cd backend && .venv/bin/python -m app.sim.validation --stabilizers --json`.
- The audit covers quiet, dry thermal, single-patch baseline, paired multi-thermal, and capped/suppressed cases under default, half damping/diffusion, and no-top-sponge variants.
- The default single-patch Lower Atmosphere baseline reaches the theta perturbation safety cap, so the current baseline thermal amplitude is partly cap-shaped.
- Reducing damping/diffusion by half materially changes cloud amount, updraft strength, onset timing, and cloud-top height, and can push several fields to their caps.
- Disabling top sponge relaxation did not materially change the audited normal-height Lower Atmosphere cases.
- `boussinesq_2d` remains Yellow; successor-dynamics design is still relevant
  if Cloud Lab needs a more trusted cloud-resolving core.

Numerical-method contract status:

- `docs/boussinesq-numerical-method.md` is the authoritative numerical-method contract for the current `boussinesq_2d` solver.
- It classifies solver state variables, the actual timestep/operator sequence, spatial discretization, boundary behavior, thermodynamics/moisture handling, stabilizers/caps, supported operating envelope, invariants, and validation claims.
- Current trust assessment is B: `boussinesq_2d` can remain a Yellow-labeled prototype engine for controlled Lower Atmosphere Cloud Basics experiments, but it should not support polished future Boussinesq-dependent labs as a trusted foundation right now.
- Successor-dynamics decisions should use the contract and the model
  hierarchy rather than assuming the current Boussinesq prototype is the future
  science path.

## Lower-Atmosphere Modeling Strategy

Cloud Lab is moving from a solver-centered Boussinesq path to a lower-atmosphere
model hierarchy.

Current decision:

```text
boussinesq_2d = Yellow prototype visual dynamics scaffold
```

The scientifically valid lower-atmosphere path should use:

1. CM1 offline reference cases for credible cloud-resolving behavior.
2. `boundary_layer_1d` profile evolution for interactive environmental evolution.
3. `controlled_cloud_column` for cloud formation under prescribed lift.
4. controlled microphysics / optional PySDM for precipitation and droplet-growth paths.
5. normalized field, diagnostic, provenance, and optics contracts.

Do not tune Boussinesq constants or presets to hide the stabilizer-audit or
numerical-method findings.

Near-term science implementation should prioritize:

```text
CM1 adapter/reference cases → microphysics precipitation diagnostics → optics field contract
```

The reduced-model stack explains cloud formation and supports fast interaction,
but the credible 2-D cloud visualization path is CM1 reference output first.

`boundary_layer_1d` v1 has landed as the first reduced-model step. Evolving
Boundary Layer v1 now exposes it in Workbench V2 with scenario selection,
profile controls, a profile/sounding view, timeline replay, and deterministic
cloud formation potential diagnostics. Continue from `docs/boundary-layer-1d.md`
for the backend contract and from `docs/labs/evolving-boundary-layer.md` for the
lab contract.

`controlled_cloud_column` v1 has also landed as the second reduced-model step.
Continue from `docs/controlled-cloud-column.md` for the backend contract,
prescribed-lift assumptions, scenarios, diagnostics, and validation expectations.

Cloud optics now has a physical-field contract in
`docs/optics-field-contract.md`. The contract states that optics consumes
physical fields and renderer controls; it does not create weather, mutate
solver/reference fields, or hide scientific warnings. It defines provenance
categories, required/optional optics inputs, assumed-versus-modeled droplet
labels, reference/microphysics relationships, and validation expectations for
future appearance work.

Lower Atmosphere Cloud Basics v2 design lives in
`docs/labs/lower-atmosphere-cloud-basics-v2.md`. It defines v2 as the
reduced-model replacement for the current Boussinesq-based Lower Atmosphere path,
with three flows: atmosphere evolution only, lifted cloud only, and combined
evolution + lifted cloud.

Lower Atmosphere Cloud Basics v2 scenario contracts and comparison-pair metadata
live in `backend/app/sim/lower_atmosphere_v2_scenarios.py` and
`frontend/src/labs/lowerAtmosphereV2Scenarios.ts`. They define the eight v2
scenario contracts, reduced-model defaults, expected profile/cloud-column and
precipitation statuses, honesty labels, and comparison pairs without
implementing profile-to-cloud orchestration.

Lower Atmosphere Cloud Basics now opens as a guided cloud experiment by
default. The app still uses the legacy internal route id `fair-weather-cumulus`,
but the user-facing path is no longer the Boussinesq 2-D run screen or a
setup/stage/inspector dashboard. It exposes experiment cards, a primary cloud
replay/appearance view, atmospheric explanation, scenario-specific try-next
guidance, and collapsed Model details / Why trust this for provenance and
validation.

As of #197, the old Boussinesq-centered Lower Atmosphere v1 scenarios are
quarantined as developer/prototype metadata in the frontend scenario catalog.
They are not presented by the normal Lab Picker or the Lower Atmosphere v2
scenario selector. Backend `boussinesq_2d` code, validation docs, and technical
scenario helpers remain available for diagnostics/regression work only; solver
physics was not changed.

CM1 reference-output adapter v1 now exists under `backend/app/reference/`.
It maps tiny CM1-like fixture payloads into `reference-run-v1` /
`reference-frame-v1` records with source provenance, field units, missing-field
warnings, cloud base/top, first cloud time, max cloud water, max updraft, and
rain diagnostics when rain fields exist. It deliberately does not run CM1, add
NetCDF/xarray dependencies, commit real model output, build a frontend viewer,
or compare reduced-model output. Continue real case-library/setup/viewer work
through the follow-up CM1 issues.

The first CM1 lower-atmosphere visual reference case library now lives in
`docs/reference-models/cm1-lower-atmosphere-cases.md`. It defines the immediate
dry-failed cumulus and shallow-cumulus baseline pair, plus early/later capped,
humid low-cloud, warm-rain, and terrain cases. It is docs/design only: no CM1
was run, no output files were added, and no Boussinesq behavior changed.

Local macOS CM1 setup guidance now lives in
`docs/reference-models/cm1-local-setup-macos.md`, with helper scripts under
`scripts/reference/cm1/`. These scripts check prerequisites and run prepared
local cases only when explicitly requested; they do not install CM1, download
large files, commit output, or make CM1 a Cloud Lab runtime dependency.

The first CM1 dry-failed-cumulus and shallow-cumulus-baseline case assets now
live under `reference/cm1/cases/`, with pair-run guidance in
`docs/reference-models/cm1-first-reference-pair.md` and
`scripts/reference/cm1/run_reference_pair.sh`. Generated CM1 output still
belongs under ignored local paths such as `data/reference/cm1/`; no large model
output should be committed.

The local reference-pair runner now handles the repeatability issues found
during the first real run attempt. The committed namelists request NetCDF output
(`output_format = 2`), so local CM1 must be rebuilt with NetCDF support. The run
script validates that `input_sounding` extends above the grid top, copies
`LANDUSE.TBL` from the provided CM1 run directory into each generated run
directory, and returns nonzero if CM1 exits without the expected `.nc` output.
Use the workflow: check environment, run reference pair, inspect `.nc` output,
ingest reference pair, then open the app for acceptance or polish work.

Manual real-output acceptance for #221 is documented in
`docs/reference-models/cm1-real-output-acceptance.md`. The first real local CM1
reference pair is scientifically usable for the current milestone: dry failed
shows motion without meaningful cloud, and shallow cumulus forms meaningful
cloud. Do not calibrate the first cases before #222; proceed to view/layout/
visual polish.

The first CM1/reference scientific replay view now lives under
`frontend/src/reference/` and is mounted in the Lower Atmosphere v2 stage as an
offline reference panel. It uses a tiny synthetic CM1-like fixture for UI/test
coverage only, labels the source as CM1 reference output / offline reference
case / not live interactive simulation, and does not run CM1. Real local CM1
output should replace the fixture only
through the reference adapter and a separately scoped ingestion path.

That reference panel now includes the first CM1/reference cloud appearance mode.
It consumes reference cloud liquid water, maps it to opacity/brightness as a
visual interpretation, preserves the timeline and provenance labels, labels
assumed droplet radius / not direct radiative transfer / not live CM1
simulation, and keeps the scientific field view available. It still uses the
tiny synthetic fixture until real local CM1 output is ingested.

Lower Atmosphere v2 now also includes the first CM1/reference comparison panel.
It maps reduced-model scenario ids to CM1 reference case ids and compares
teaching diagnostics such as cloud/no-cloud status, first cloud time, cloud
base/top, max cloud water, max updraft, and rain onset when a reference run is
loaded. The only currently loaded reference run is the tiny shallow-cumulus
fixture; other mapped scenarios show the explicit missing-reference fallback.
The panel labels reduced output, CM1 reference output, offline reference case,
derived diagnostics, and not-live-CM1 status. Exact cloud morphology is not a
pass/fail condition.

Lower Atmosphere Cloud Basics v2 now runs the three reduced-model flows:

- atmosphere evolution only calls `boundary_layer_1d`
- lifted cloud only calls `controlled_cloud_column` from a selected/default
  profile
- combined evolution + lifted cloud runs profile evolution, selects the final
  evolved profile by default, then runs prescribed cloud-column lift

The v2 handoff preserves selected-profile provenance (`source_model`,
`source_frame_time_seconds`, `source_time_hours_from_sunrise`,
`source_scenario_id`, and `source_profile_status`) and does not use
`boussinesq_2d`.

Lower Atmosphere Cloud Basics v2 also has a precipitation/microphysics handoff
contract in `backend/app/sim/cloud_column_schemas.py`. The
`cloud-column-microphysics-handoff-v1` payload preserves controlled-column cloud
water, time series, water-budget metadata, prescribed-lift metadata, and
selected-profile provenance for future warm-rain diagnostics. It can report
`precipitation_not_enabled` when cloud water is available but rain physics is
deferred, or `not_evaluated` when no cloud water formed. It does not implement
rain, PySDM, droplet distributions, optics, or Boussinesq coupling.

Controlled `microphysics_lab` warm-rain diagnostics are implemented as
`microphysics-diagnostics-v1` in `backend/app/sim/microphysics_diagnostics.py`.
They report first cloud/rain timing, cloud/rain maxima and integrals, vapor
depletion, total-water budget initial/final/drift, subcloud evaporation proxy,
bulk autoconversion threshold, precipitation status/reason, and current droplet
payload availability. This remains a bulk parcel/box diagnostic path, not PySDM,
CM1, or Boussinesq coupling.

Lower Atmosphere Cloud Basics v2 scenario interpretation now treats `Dry failed
cumulus` as a cloud-free default combined-flow contract. Split outcomes remain
valid in other setups, but `profile moisture_limited + column cloud_formed`
should be labeled as cloud formed under prescribed lift and explained as
controlled forcing, not free convection.

The current CM1 reference priority is:

```text
real-output acceptance → #222 visual/replay/appearance polish
```

Issue #220 added the local ingestion path from ignored CM1 output directories
to `reference-run-v1` artifacts and the ignored frontend local index at
`frontend/public/reference/cm1/local/index.json`. Lower Atmosphere v2 prefers
real local ingested artifacts when the index exists. If no real artifact is
available, the tiny fixture remains a demo/test fallback only and must be
labeled as `Synthetic fixture data`, `Not scientific truth`, and `For
UI/testing only`.

Issue #221 accepted the real local dry-failed and shallow-cumulus CM1 reference
path for the current milestone. Remaining work belongs in #222 polish: improve
scientific field readability, appearance visual payoff, comparison layout,
source/provenance labels, pre-run reference explanation, and the confusing
missing-temperature warning when potential temperature is available.

## Do Not Do Without Explicit User Direction

- Do not preserve or rebuild old dashboard patterns.
- Do not add optics/2.5-D/terrain/rain/boundary-layer/PySDM/ice to the current Workbench V2 implementation issues unless the issue explicitly asks.
- Do not change solver physics in frontend/product shell issues.
- Do not weaken scientific validation to make tests pass.
- Do not hide warnings or visual artifacts by masking the renderer.
- Do not treat `boussinesq_2d` as trusted beyond its documented Yellow status.
- Do not create broad vague issues such as `fix solver` or `improve physics`.

## Before Doing Repo Work

First check available GitHub tools and explicitly confirm whether you can:

- create/update GitHub issues
- add comments to issues
- create/update repo files
- open PRs, if needed

If mutation tools are unavailable, stop and say so.

## Session Wrap-Up Requirement

At the end of a meaningful session, update this file if any of the following changed:

- current phase
- execution order
- major issue status
- current blockers
- new risks
- GitHub/tooling status
- next recommended action

Also update `docs/current-phase-plan.md` if the executable phase changed.

## Next Recommended Action

Use the current open issue state to decide, but as of this handoff:

- If Workbench V2 is the active product track, use `docs/current-phase-plan.md`
  and the open issue state rather than old closed issue ladders.
- If CI/test runtime is blocking product iteration, use
  `docs/testing-and-validation.md` and the current open issue state.
- If Boussinesq / Lower Atmosphere Cloud Basics trust remediation is active,
  treat `boussinesq_2d` as Yellow and do not broaden into solver behavior unless
  the issue explicitly asks for it.
- If lower-atmosphere science architecture is active, work from
  `docs/lower-atmosphere-modeling-strategy.md`.
- Lower Atmosphere Cloud Basics now has guided-experiment routing on top of the
  existing profile-to-cloud-column orchestration and deterministic diagnostics.
  The main page covers result, why, try-next guidance, and 4-5 key numbers;
  detailed expected-vs-observed status, provenance, and validation live under
  collapsed Model details / Why trust this.
- The active lower-atmosphere visual credibility path is:

  ```text
  #179 → #180 → #207 → #208 → #209 → #181 → #210 → #198
  ```

  This means CM1 reference output anchors credible 2-D cloud visualization
  before reduced-model comparison or cloud-appearance work. Do not broaden any
  one issue into the full sequence unless explicitly scoped.

  After #221, the immediate CM1 reference path has adapter, case library, local
  setup/run assets, real local output ingestion, scientific replay, optics
  contract, appearance view, qualitative reduced/reference comparison, and a
  manual real-output acceptance report. Issue #222 polish should stay focused
  on readability, labels, layout, and view payoff, not case calibration or new
  science.

  #222 keeps the accepted CM1 science fixed while polishing the experience:
  clearer cloud/no-signal field readouts, stronger cloud-water appearance
  response, structured comparison rows for narrow/export-like layouts, grouped
  source/view/assumption labels, pre-run copy explaining that the CM1 reference
  is offline/precomputed, and softer temperature/theta field notes when
  potential temperature is available.

  #233 is the greenfield user-facing Lower Atmosphere rebuild on top of the
  accepted CM1/reduced-model plumbing. The desired experience is: choose an
  experiment, watch credible cloud evolution, understand why it happened, try a
  scenario-specific atmospheric contrast, and open Model details / Why trust
  this only when validation or provenance is needed. Keep the main page out of
  reduced-model-versus-CM1 comparison language. Do not add CM1 cases, tune
  science, change Boussinesq, or start warm-rain work.

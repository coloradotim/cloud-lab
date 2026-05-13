# Test Suite Review And Solver Trust Decision

This document is the Phase 2 review artifact for issue #148.

It reviews `docs/test-suite-audit.md`, classifies the major test groups, and makes an explicit Lower Atmosphere Cloud Basics / `boussinesq_2d` trust decision. It does not change tests, solver physics, scenario presets, diagnostics, visualization, or CI behavior.

## Review Summary

The test suite has meaningful coverage. It is not a hollow suite. It includes backend schema/API tests, Boussinesq solver checks, Boussinesq thermodynamic diagnostics, reference validation, microphysics tests, frontend Workbench tests, visualization tests, and Cloud Optics tests.

However, the current suite does not yet provide a clean, trusted answer to the central product question:

> Is `boussinesq_2d` reliable enough for Lower Atmosphere Cloud Basics to remain the reference cloud-formation lab, and reliable enough to support future Boussinesq-dependent labs?

The answer from this review is **Yellow**.

## Fair-Weather / Boussinesq Trust Decision

### Decision: Yellow — restrict current `boussinesq_2d` use

Meaning:

- `boussinesq_2d` remains useful as an experimental dynamics scaffold.
- It can continue supporting controlled Lower Atmosphere Cloud Basics work, provided the UI and docs keep honest limitations visible.
- It should not be treated as broadly trusted atmospheric dynamics.
- Boussinesq-dependent future labs should pause or proceed only as explicitly labeled prototypes until trust gaps are resolved.
- Near-term product work should prefer non-Boussinesq paths where possible: Evolving Boundary Layer profile evolution, Clouds/Light/Shadow static optics, and controlled microphysics labs.

### Why not Green

The audit shows several unresolved concerns:

- The humid reference case includes a current `xfail`: `test_humid_boussinesq_reference_cloud_maximum_is_aloft`, with the reason that the prototype places peak cloud water below the boundary-layer top.
- Stable stratification suppression appears underrepresented as a named trust check.
- Return-flow and boundary-attached cloud-water behavior needs a policy decision.
- Some thermodynamic checks are fast and valuable but unmarked, making their role ambiguous.
- Legacy educational-solver tests and current Fair-Weather/Boussinesq contracts are mixed enough that trust signals are harder to interpret.
- The validation docs already state that `boussinesq_2d` is experimental and not a quantitatively credible CFD core.

### Why not Red

The audit also shows meaningful positive coverage:

- quiet/no-forcing behavior has multiple tests/validation checks
- dry thermal bubble behavior is covered
- reproducibility is broadly tested
- moisture non-negativity is broadly tested
- divergence/velocity sanity is covered in Boussinesq validation
- LCL/cloud-base diagnostics have meaningful tests
- dry/no-cloud behavior is covered across Boussinesq and frontend diagnostics

This is enough evidence to keep `boussinesq_2d` alive as a constrained prototype, not enough to use it as a trusted general foundation.

## Specific Trust Area Decisions

| Area | Status | Review decision |
| --- | --- | --- |
| quiet/no-forcing behavior | trusted | Coverage exists through Boussinesq no-forcing, quiet divergence, velocity ceilings, and quiet reference cases. Keep as hard numerical sanity coverage. |
| dry thermal behavior | trusted | Dry thermal bubble benchmark is conceptually strong. Keep as targeted solver/science validation. |
| humid lifted thermal | warning | Coverage exists, but humid cloud placement remains partly suspect because one reference test is xfailed. Keep checks, but do not treat as fully trusted. |
| LCL/cloud-base structure | warning | LCL diagnostics are useful and covered, but cloud placement relative to LCL/top remains a trust gap. Keep as diagnostic/warning area until calibrated. |
| dry failed cumulus | warning | Current coverage exists across dry/no-cloud and frontend diagnostics, but a dedicated backend Fair-Weather scenario contract should be added or clarified. |
| stability suppression | unknown / partial | Audit says this appears underrepresented as a named dedicated trust check. Add explicit relationship test. |
| humidity response | trusted for diagnostic direction | RH/LCL relationship coverage exists. Keep as physics relationship test. Solver cloud response to humidity still belongs under Fair-Weather scenario validation. |
| heating response | warning | Heating/plume behavior is covered, but exact Fair-Weather response should be scenario-specific and not over-trusted. |
| boundary artifacts | warning | Boundary cloud fraction and related diagnostics exist, but policy is not yet clear. Treat as warning/diagnostic until targeted review calibrates thresholds. |
| return-flow cloud water | warning | Needs explicit backend coverage/policy. Do not hard-fail all cases until thresholds are understood. |
| divergence / velocity sanity | trusted | Strong validation coverage exists. Keep as numerical sanity / targeted solver-science. |
| reproducibility | trusted | Broad coverage exists. Preserve as hard invariant. |
| safety caps / stabilizers | warning | Coverage exists, but the model relies on prototype stabilizers. Tests should ensure caps are not hit in normal cases, but this does not prove physical realism. |
| moisture non-negativity | trusted | Broad coverage exists. Preserve as hard invariant. |
| resolution/domain sensitivity | unknown / missing | Not clearly covered as a named trust check. Add targeted validation before expanding solver use. |
| diagnostics vs visualization | partial | Frontend visualization/diagnostic tests exist, but Fair-Weather trust still needs explicit audit of whether UI agrees with backend diagnostics in suspicious cases. |
| scenario preset credibility | warning | Scenario presets need review separate from solver physics. Bad presets should not be treated as solver failure without evidence. |

## Approved Test Classification Table

This table approves the high-level classification of the current suite. Implementation belongs in #149.

| Test group | Approved category | Approved target tier | Action |
| --- | --- | --- | --- |
| `backend/tests/test_health.py` | software/API contract | backend quick | keep |
| `backend/tests/test_sim_schemas.py` | schema/API contract | backend quick | keep |
| `backend/tests/test_streaming.py` | software contract / run lifecycle | backend quick | keep |
| `backend/tests/test_presets.py` API/catalog parts | software/lab catalog contract | backend quick | keep |
| `backend/tests/test_presets.py` solver start/reference parts | lab/scenario smoke + targeted science where marked | backend quick or targeted solver/science | split/clarify only if needed |
| `backend/tests/test_solver.py` legacy educational solver tests | legacy compatibility / schema / prototype behavior mixed | backend quick or remove/rewrite after item review | needs item-level review before deletion |
| `backend/tests/test_boussinesq_2d.py` | Boussinesq fast science sanity / numerical sanity / physics relationships | targeted solver/science | keep; consider marker clarity only |
| `backend/tests/test_boussinesq_thermal_bubble.py` | reference validation / dry buoyancy benchmark | targeted solver/science or validation | keep |
| `backend/tests/test_boussinesq_thermodynamics.py` | Boussinesq thermodynamic diagnostics / lab diagnostics | targeted solver/science or backend quick with explicit marker | keep; add explicit marker/tier policy |
| `backend/tests/test_boussinesq_validation.py` | slow/reference Boussinesq validation | slow science validation/manual-release | keep; do not run for UI-only PRs |
| `backend/tests/test_microphysics_lab.py` | microphysics lab contract / numerical sanity | targeted solver/science | keep |
| `backend/tests/test_microphysics_validation.py` | microphysics validation | targeted solver/science + science validation if desired | keep; review overlap later |
| `backend/tests/test_microphysics_comparison.py` | microphysics relationship/comparison | targeted solver/science | keep |
| `backend/tests/test_pysdm_evaluation.py` | optional PySDM smoke | optional/manual | keep isolated |
| `frontend/src/workbenchV2.test.tsx` | Workbench V2 product flow | frontend quick | keep |
| `frontend/src/workbench/workbenchRunLoop.test.tsx` | Workbench run loop / Fair-Weather UI contract | frontend quick | keep; update only when approved UX changes land |
| `frontend/src/labs/labCatalog.test.ts` | lab catalog metadata contract | frontend quick | keep |
| `frontend/src/simulationControls.test.ts` | scenario/control config behavior | frontend quick | keep; align after approved model-control changes |
| `frontend/src/scenarioDiagnostics.test.ts` | scenario diagnostic classification | frontend quick; science-sensitive | keep; review expectations alongside backend diagnostics |
| `frontend/src/visualization.test.ts` | visualization honesty / field display contracts | frontend quick | keep |
| `frontend/src/probe.test.ts` | probe/derived diagnostics UI | frontend quick | keep |
| `frontend/src/sounding.test.ts` | profile/sounding display helpers | frontend quick | keep |
| `frontend/src/replay.test.ts` | replay/timeline behavior | frontend quick | keep but ensure static labs do not inherit simulation replay incorrectly |
| `frontend/src/comparison.test.ts` | comparison behavior | frontend quick | keep as secondary workflow |
| `frontend/src/ScenarioComparisonPanel.test.tsx` | comparison panel UI | frontend quick | keep as secondary workflow |
| `frontend/src/savedRuns.test.ts` | saved run persistence | frontend quick | keep as secondary workflow |
| `frontend/src/savedScenarios.test.ts` | saved scenario persistence | frontend quick | keep |
| `frontend/src/microphysicsDiagnostics.test.ts` | microphysics diagnostics UI | frontend quick | keep |
| `frontend/src/labs/cloudOpticsScenes.test.ts` | Cloud Optics scene source fields | frontend quick | keep; not Fair-Weather solver evidence |
| `frontend/src/labs/cloudOpticsDiagnostics.test.ts` | Cloud Optics diagnostics | frontend quick | keep; not Fair-Weather solver evidence |
| `frontend/src/labs/cloudOpticsRenderer.test.ts` | Cloud Optics renderer behavior | frontend quick | keep; not Fair-Weather solver evidence |

## Tests Approved To Keep

Keep these as critical guardrails:

- schema/API contract tests
- frame/config validation
- run lifecycle/streaming contracts
- public solver catalog behavior
- lab catalog behavior
- non-negative moisture
- finite fields / no NaNs or Infs
- reproducibility
- no-forcing quiet behavior
- dry thermal bubble behavior
- Boussinesq divergence/velocity sanity
- LCL/cloud-base diagnostics
- dry/no-cloud checks
- microphysics water-budget and condensation checks
- visualization truth/approximation labels
- cloud optics static-scene and renderer tests, but only as Cloud Optics evidence

## Tests Approved To Move Or Re-Tier

Implementation should happen under #149.

1. Add explicit tier/marker policy for `backend/tests/test_boussinesq_thermodynamics.py`.
   - It is fast and valuable, but science-sensitive.
   - It should be clearly categorized as Boussinesq thermodynamic diagnostics or lab diagnostics.
   - Whether it remains in backend quick or targeted solver/science can be finalized in #149, but it must not be treated as generic app plumbing.

2. Keep `backend/tests/test_boussinesq_validation.py` in slow/reference validation.
   - Do not move it into ordinary quick checks.
   - Preserve the xfail until solver remediation or expectation reframing is approved.

3. Separate legacy educational solver tests from current lab-driven trust conclusions.
   - Do not delete them blindly.
   - Move/relabel/rewrite only after item-level review identifies whether each protects schema compatibility, legacy runnability, or obsolete behavior.

4. Keep optional PySDM isolated.
   - It should remain optional/manual until dependency/performance expectations are deliberate.

## Tests Approved To Rewrite Later

Only after specific follow-on issue approval:

- brittle old-dashboard/default-layout tests, if any are still present after Workbench V2 updates
- tests that assert every raw control appears in default UI, if they conflict with current lab-driven UX
- exact numerical or morphology expectations that do not map to a written physical relationship
- legacy educational-solver tests that only preserve prototype behavior and do not protect shared contracts

## Tests Approved To Delete

No tests are approved for immediate deletion from this review alone.

The audit identifies suspected obsolete/prototype tests, but deletion requires item-level review under #149 or a dedicated cleanup issue.

## Tests Requiring More Information

- `test_humid_boussinesq_reference_cloud_maximum_is_aloft` xfail: decide after targeted solver/thermodynamic remediation review.
- Stable stratification suppression: add/locate dedicated relationship coverage before deciding if current coverage is enough.
- Return-flow cloud water: decide warning vs hard-fail policy after targeted diagnostics review.
- Boundary cloud fraction: decide warning thresholds after targeted diagnostics review.
- Resolution/domain sensitivity: missing/unclear coverage; create targeted validation issue.
- Legacy educational solver compatibility: review item-level purpose before deletion or re-tiering.

## Problem Breakdown

| Problem | Primary category | Severity | Review decision |
| --- | --- | --- | --- |
| Humid Boussinesq reference peak cloud water below boundary-layer top | solver physics / thermodynamic structure | important | keep xfail; create targeted remediation/design issue |
| Stable suppression not clearly named as a trust check | missing physics relationship coverage | important | create test/validation issue |
| Return-flow cloud-water policy unclear | diagnostic policy / solver artifact risk | important | create diagnostics policy/remediation issue |
| Boundary cloud fraction policy unclear | diagnostic policy / visualization trust | important | create diagnostics policy/remediation issue, possibly combined with return-flow |
| Resolution/domain sensitivity unclear | validation gap | important | create targeted validation issue |
| Fair-Weather scenario presets may mask solver vs preset problems | scenario preset / lab contract | important | create scenario preset audit issue |
| Boussinesq thermodynamics test tier ambiguous | test tiering | important | implement under #149 |
| Legacy educational solver tests mixed with current trust story | test organization / obsolete prototype risk | later/important | item-level review under #149 |
| Cloud Optics tests could be misread as Fair-Weather trust evidence | documentation/test interpretation | later | clarify in docs/test tiering |

## Approved Follow-On Implementation Plan

These are approved for backlog creation under #150.

### 1. Fair-Weather scenario preset audit

Purpose: determine whether observed suspicious behavior is caused by presets rather than solver.

Required scope:

- review all Lower Atmosphere Cloud Basics built-in scenarios
- document intended physical regime, solver config, and expected qualitative outcome
- identify presets that are physically incoherent, over-tuned, or too close to solver edge cases
- separate preset problems from solver problems

### 2. Boussinesq thermodynamic structure remediation plan

Purpose: address the xfailed humid-reference test and cloud placement trust gap.

Required scope:

- analyze why peak cloud water appears below the expected boundary-layer-top / thermodynamic target
- determine whether the issue is saturation calculation, vertical transport, mixing, initialization, thresholding, or validation expectation
- propose targeted solver or diagnostic remediation
- do not simply remove the xfail

### 3. Stable suppression relationship validation

Purpose: add/clarify explicit relationship tests proving stable/capped profiles suppress vertical development relative to less-stable comparable cases.

Required scope:

- controlled paired configs
- same heating/moisture except stability/cap
- compare vertical response, cloud top/amount if applicable, and diagnostics

### 4. Return-flow and boundary cloud-water diagnostic policy

Purpose: decide and implement how return-flow/boundary cloud artifacts are classified.

Required scope:

- define warning vs hard failure thresholds
- ensure backend diagnostics expose issue
- ensure frontend inspector surfaces it clearly
- avoid hiding cloud water in renderer

### 5. Resolution/domain sensitivity validation

Purpose: test whether moderate changes in resolution/domain preserve qualitative Fair-Weather outcomes.

Required scope:

- compare small/medium/large or separated resolution/domain controls
- document acceptable variation
- flag qualitative instability

### 6. Approved test tier cleanup

Purpose: implement #149 based on this review.

Required scope:

- clarify Boussinesq thermodynamics marker/tier
- keep slow reference validation separate
- review legacy educational solver tests item-by-item
- preserve critical guardrails

## Boussinesq-Dependent Work Gate

Until the above items are resolved or explicitly accepted as warnings:

- continue Lower Atmosphere Cloud Basics work only with honest experimental labels
- do not treat `boussinesq_2d` as a broadly trusted dynamics foundation
- do not build future Boussinesq-dependent labs as polished products
- pause or label early Orographic/Terrain work as prototype-only if it depends on Boussinesq
- do not couple Evolving Boundary Layer live into Boussinesq yet
- continue non-Boussinesq paths: Evolving Boundary Layer profile model, Clouds/Light/Shadow static optics, and controlled microphysics

## What Success Looks Like

The project can move from Yellow to Green for current Fair-Weather scope when:

- dry/no-forcing and dry thermal behavior remain trusted
- stable suppression has explicit relationship validation
- humidity/heating relationships are protected as lab contracts
- cloud placement relative to LCL is either improved or honestly bounded with calibrated warnings
- return-flow/boundary cloud behavior is consistently diagnosed and surfaced
- resolution/domain sensitivity is understood for supported presets
- Fair-Weather presets have written contracts and are not relying on accidental solver behavior

The project should move toward Red if review/remediation shows:

- cloud placement is repeatedly thermodynamically implausible
- stability/humidity/heating relationships fail directionally
- results are qualitatively unstable across modest resolution/domain changes
- safety caps/stabilizers routinely mask normal scenario behavior
- diagnostics and visualization disagree in ways that mislead users

## Issue Completion Summary Template

When #148 is closed, comment:

```text
Phase 2 review complete.

Decision: Yellow — restrict current boussinesq_2d use.

Review doc:
- docs/test-suite-review-and-solver-trust.md

Main decisions:
- keep boussinesq_2d as constrained experimental scaffold
- keep Lower Atmosphere Cloud Basics work, but do not treat solver as broadly trusted
- pause polished Boussinesq-dependent future labs until trust gaps are resolved
- create remediation backlog under #150
- implement approved test cleanup under #149

No tests, solver physics, scenarios, diagnostics, visualization, or CI behavior were changed in this issue.
```

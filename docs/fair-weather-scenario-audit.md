# Fair-Weather Scenario Audit

Issue: #153

This audit reviews the current Fair-Weather Cumulus scenarios and adjacent Boussinesq presets against their physical intent. It is documentation only: it does not change solver physics, scenario defaults, validation thresholds, diagnostics, or visualization behavior.

## Scope And Sources

Audited user-facing or Workbench V2 scenarios:

- `fair-weather-moderate-base`
- `dry-failed-cumulus`
- `dry-cap-suppressed-cumulus`
- `multi-thermal-cumulus-field`
- `humid-low-cloud-boundary-layer`, because it is currently a built-in Boussinesq scenario and an explicit non-classic contrast case

Audited backend preset and validation/reference cases:

- `fair-weather-cumulus` backend API preset
- `isolated-fair-weather-cumulus`
- `dry-thermal-bubble`
- `humid-cloud-deck`
- thermodynamic validation cases: `humid-well-mixed-fair-weather`, `drier-well-mixed-fair-weather`, `warmer-drier-fair-weather`, `multi-patch-fair-weather`, `layered-moisture-fair-weather`

Main source files:

- `frontend/src/simulationControls.ts`
- `frontend/src/labs/labCatalog.ts`
- `frontend/src/workbench/workbenchRunLoop.ts`
- `backend/app/sim/presets.py`
- `backend/app/sim/validation.py`
- `docs/labs/fair-weather-cumulus.md`
- `docs/scenarios.md`
- `docs/boussinesq-validation.md`
- `docs/test-suite-review-and-solver-trust.md`
- `docs/testing-and-validation.md`

Validation evidence used:

- `cd backend && .venv/bin/python -m app.sim.validation --scenarios --json`
- `cd backend && .venv/bin/python -m app.sim.validation --thermodynamics --json`

## Current Trust Context

The current `boussinesq_2d` trust decision is Yellow. It is useful as a constrained experimental dynamics scaffold for Fair-Weather Cumulus and controlled visual experiments, but it is not broadly trusted as quantitative atmospheric dynamics or research-grade CFD.

For this audit, that means scenario contracts should be qualitative, diagnostic-rich, and honest about limitations. A suspicious scenario result should first be classified as one of:

- preset/config issue
- scenario naming or user-promise issue
- diagnostic or threshold issue
- visualization interpretation issue
- likely solver issue

## Scenario-By-Scenario Audit Table

| Scenario or preset | Current role | Physical intent | Current config summary | Expected LCL range | Expected cloud behavior | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| `fair-weather-moderate-base` | Workbench V2 Fair-Weather default scenario | Classic shallow fair-weather cumulus over localized heating | 10 km x 3 km, 36 x 24 grid, 20 min, RH 0.85 source layer, free RH 0.55, source layer 800 m, BL top 1500 m, 0.024 K/s single patch, 0.15 m/s wind, seed 17 | Roughly 250-350 m by current diagnostic LCL method | Delayed cloud onset, finite cloud base above surface, modest cloud water, no boundary-dominated cloud | Keep, but adjust/review in follow-on because current heating is strong enough to trigger generic "very strong heating" warnings and LCL is low for a scenario called "moderate cloud base" |
| `fair-weather-cumulus` backend preset | API preset, currently user-facing scenario category | Same contract as baseline, with paired warm patches for separated cloud-region tests | 10 km x 3 km, 36 x 24 grid, 20 min, RH 0.85, free RH 0.55, source layer 800 m, BL top 1500 m, 0.024 K/s two patches, 0.25 m/s wind, seed 3 | Roughly 250-350 m | No initial cloud; delayed shallow cloud over heated regions by runtime | Keep as backend/reference-facing preset, but align naming with frontend multi-thermal/baseline split in a follow-on metadata issue |
| `multi-thermal-cumulus-field` | Workbench Fair-Weather scenario, visualization-oriented | Multiple thermals/cloud cells from structured heating | Same thermodynamics as baseline; 0.024 K/s two-patch heating, 0.15 m/s wind, seed 17 | Roughly 250-350 m | Multiple plume/cloud regions after delayed onset; cells may merge with diffusion/wind | Keep, but move or label as controlled multi-thermal / visualization stress scenario rather than core default; requires region-count diagnostics to avoid becoming just a renderer stress test |
| `dry-failed-cumulus` | Workbench negative-control scenario | Buoyant motion without condensation | 10 km x 3 km, 36 x 24 grid, 20 min inherited, RH 0.35, free RH 0.25, source layer 500 m, BL top 1000 m, 0.012 K/s single patch, no wind, seed 13 | Roughly 1200-1400 m by current diagnostic LCL method | Nonzero vertical motion; cloud liquid water zero or negligible | Keep. It is physically coherent and matches the existing dry thermal reference pattern; add a backend Fair-Weather scenario contract test in a follow-on if not already explicit enough |
| `dry-cap-suppressed-cumulus` | Workbench inhibition scenario | Moist lower layer with dry/stable cap limiting cloud | 10 km x 3 km, 36 x 24 grid, 20 min inherited, RH 0.82, free RH 0.35, dry-cap profile, source layer 700 m, BL/cap 1200 m, lapse 0.0045 K/m, 0.018 K/s single patch, 0.1 m/s wind, seed 31 | Roughly 300-450 m, but dry-cap profile makes a single surface-parcel LCL incomplete | Delayed, shallow, limited, or suppressed cloud relative to comparable no-cap setup | Keep as concept, but needs paired no-cap comparison and explicit stable/capped suppression validation under #156 before thresholds are hard-failed |
| `humid-low-cloud-boundary-layer` | Built-in Boussinesq contrast, not classic Fair-Weather | Near-saturated low-LCL / low-cloud boundary-layer behavior | 10 km x 3 km, 36 x 24 grid, 20 min inherited, uniform RH 0.98, free RH 0.98, source layer 1000 m, BL top 1000 m, 0.05 K/s weak-random heating, 0.25 m/s wind, seed 23 | Near surface, roughly 0-75 m by current diagnostic LCL method | Low cloud or broad deck may appear; not evaluated as classic fair-weather failure | Rename or move out of Fair-Weather user-facing flow once Fog/Stratus or Layered Atmosphere owns it; keep as diagnostic contrast until then |
| `isolated-fair-weather-cumulus` | Backend Boussinesq scenario validation case | Paired thermals should form separated shallow clouds | 20 min, RH 0.85, free RH 0.55, source layer 800 m, BL top 1500 m, 0.024 K/s two patches, 0.15 m/s wind, seed 17 | Reported 272 m | Current validation reports two cloud regions, cloud top 688 m, max cloud water about `1.05e-4 kg kg-1`, status `warn` because thermodynamic diagnostics warn | Keep as validation/reference case, but do not present it as fully trusted polished behavior while thermodynamic warnings remain |
| `dry-thermal-bubble` | Backend dry reference case | Dry buoyant circulation without cloud | 15 min, RH 0.45, 0.016 K/s heating, lapse 0.0075 K/m, no wind, seed 13 | Reported 1289 m | Cloud-free dry thermal with resolved circulation | Keep as reference, not a polished user scenario. It supports the dry-failed control but should remain named as a benchmark/reference |
| `humid-cloud-deck` | Backend validation contrast | Broad deck-prone humid case | 20 min, RH 0.98 uniform, 0.05 K/s weak-random heating, 0.25 m/s wind, seed 23 | Reported 34 m | Expected broad deck-prone behavior, but scenario validation reported only 0.015 cloud coverage and warned it did not produce a broad cloud field | Needs review: likely preset/expectation mismatch or diagnostic-threshold mismatch before using as a deck/stratus scenario |
| Thermodynamic validation fair-weather cases | Validation/reporting cases | Exercise LCL/cloud-base diagnostics across humidity and layering variants | Humid, drier, warmer/drier, multi-patch, and layered moisture variants | Reported 34 m, 413 m, 610 m, 34 m, and 331 m respectively | Current thermodynamic report warns for every case; several no-cloud cases report "source layer is not well mixed" and "no cloud water formed" | Keep as diagnostic evidence, not user-facing scenarios. They point to solver/diagnostic follow-ons rather than preset tuning in this issue |

## Recommended Scenario Contracts

### `fair-weather-moderate-base`

- User-facing promise: show classic shallow cumulus from a localized thermal in moderately humid air.
- Physical regime: heated source-layer air rises toward a finite LCL above the first model levels.
- Required controls: heating strength, source-layer humidity, stability/lapse rate, runtime, model size.
- Expected diagnostics: delayed first cloud time, finite expected LCL, cloud water not surface-attached at initialization, small below-LCL cloud fraction, modest cloud top.
- Hard scenario failure: no cloud by configured runtime, immediate surface-attached cloud dominated by first levels, non-finite fields, negative moisture.
- Warning: LCL lower than the scenario name implies, broad cloud shield, return-flow or boundary cloud water.
- Recommended action: keep, with follow-on review of whether "moderate cloud base" should be renamed or adjusted after #154/#155 clarify LCL thermodynamics.

### `fair-weather-cumulus` backend preset

- User-facing promise: a reproducible Fair-Weather Cumulus starting point through the API preset endpoint.
- Physical regime: paired thermals in the same source-layer setup as the baseline.
- Required diagnostics: no initial cloud, delayed positive cloud water, separated regions not dominated by boundary artifacts.
- Red flag as preset issue: frontend default says single-patch baseline while backend preset uses paired patches under a broad fair-weather name.
- Red flag as solver issue: paired thermals fail to rise, moisture goes negative, or cloud appears in thermodynamically impossible regions.
- Recommended action: keep, but clarify in a follow-on whether the API preset should be named as paired/multi-thermal or whether the frontend baseline and backend preset should share the same forcing pattern.

### `dry-failed-cumulus`

- User-facing promise: motion can happen without cloud formation.
- Physical regime: a dry source layer with high effective LCL and weaker heating.
- Required diagnostics: nonzero updraft or thermal circulation, negligible cloud liquid water, expected LCL above resolved cloud-forming reach.
- Hard scenario failure: meaningful cloud water appears, or no thermal/updraft response appears.
- Red flag as preset issue: runtime/domain too short to see any motion; heating too weak to produce a detectable updraft.
- Red flag as solver issue: dry/subsaturated air condenses anyway, or no-forcing-like dynamics appear despite heating.
- Recommended action: keep.

### `dry-cap-suppressed-cumulus`

- User-facing promise: a dry/stable layer can limit cloud growth even when low-level moisture and heating exist.
- Physical regime: moist source layer below a dry cap near the boundary-layer top.
- Required diagnostics: RH/profile shows cap, cloud depth/amount reduced relative to no-cap control, vertical growth capped or delayed.
- Hard scenario failure: not yet calibrated enough for hard morphology thresholds.
- Warning: cloud penetrates well above cap, or suppression is indistinguishable from low humidity/short runtime.
- Red flag as preset issue: cap and low source humidity are confounded; suppression depends mostly on shortened runtime.
- Red flag as solver issue: comparable capped/uncapped runs show no directional stability or dry-cap response.
- Recommended action: keep as exploratory, but defer hard validation to #156.

### `multi-thermal-cumulus-field`

- User-facing promise: show how structured heating creates more than one thermal/cloud response.
- Physical regime: same moderate source layer as baseline, two heating patches.
- Required diagnostics: multiple buoyant responses and, when cloud forms, more than one region for a useful part of the run.
- Warning: field quickly merges into one feature, fragments into many artifacts, or produces a broad cloud shield.
- Red flag as preset issue: this teaches rendering/region count more than the lab's core heating-moisture-stability question.
- Red flag as solver issue: two-patch forcing cannot produce two resolved vertical responses under stable numerical conditions.
- Recommended action: keep but label as controlled multi-thermal / visualization-support scenario, not the first default.

### `humid-low-cloud-boundary-layer`

- User-facing promise: near-saturated boundary layers can produce very low cloud or deck-like behavior.
- Physical regime: uniform very high RH with low diagnostic LCL.
- Required diagnostics: low expected LCL, low cloud is not classified as a Fair-Weather failure, cloud coverage/deck tendency is reported honestly.
- Red flag as preset issue: currently uses very strong heating (`0.05 K/s`) and may be conflating fog/stratus, deck, and strong thermal forcing.
- Red flag as solver issue: low-cloud behavior appears in dry or moderate Fair-Weather setups without a low LCL or appropriate diagnostics.
- Recommended action: rename/move under a future Fog/Stratus or Layered Atmosphere lab; keep only as a diagnostic contrast until that lab exists.

## Recommended Preset / Metadata Changes

These are recommendations only. They should be implemented in follow-on issues, not in #153.

1. Clarify baseline versus paired-thermal naming.
   - The frontend `fair-weather-moderate-base` scenario uses a single patch.
   - The backend `fair-weather-cumulus` preset uses paired patches.
   - Recommendation: either rename the backend preset to make the paired forcing explicit, or align its forcing with the frontend baseline and create a separate paired-thermal preset.

2. Revisit "moderate cloud base" wording.
   - Current diagnostic LCL estimates for RH 0.85 at 25 C are around 270 m, which is finite and above the surface but arguably low for "moderate cloud base."
   - Recommendation: after #154/#155, decide whether to rename to "baseline shallow cumulus" or adjust humidity/temperature only through a dedicated preset-change issue.

3. Keep `dry-failed-cumulus` as the cleanest scenario contract.
   - It has a clear user lesson, a dry-thermal reference analog, and hard expectations that do not require new physics.
   - Recommendation: add or clarify backend scenario-contract coverage in a follow-on if current frontend-only dry-failed checks are not considered enough.

4. Treat `dry-cap-suppressed-cumulus` as exploratory until #156.
   - Its physical lesson is important, but the current audit cannot prove suppression is caused by cap/stability rather than other config differences.
   - Recommendation: #156 should use paired capped/uncapped configs with only stability/cap changed.

5. Move `humid-low-cloud-boundary-layer` out of Fair-Weather defaults when a better lab exists.
   - It is explicitly not classic Fair-Weather Cumulus.
   - Recommendation: future Fog/Stratus or Layered Atmosphere work should own this scenario or replace it.

## Scenario Issues That Are Actually Solver Issues

These should not be solved by silently tuning scenario values in #153.

- Humid cloud-water placement and cloud-base trust remain Yellow because the humid reference has known thermodynamic structure concerns.
- Pressure-aware saturation and LCL thermodynamics belong to #155.
- If comparable capped/uncapped runs do not show directional suppression, that belongs to #156 and possibly solver remediation.
- If moderate domain/resolution changes alter qualitative Fair-Weather outcomes, that belongs to #158.
- If stabilizers or safety caps materially determine normal scenario outcomes, that belongs to #159.
- If the Yellow status persists after remediation, successor dynamics design belongs to #160.

## Scenario Issues That Are Diagnostic / Visualization Issues

- Return-flow and boundary cloud-water classification is a diagnostic policy problem until thresholds are calibrated; this belongs to #157.
- Humid deck / low-cloud coverage expectations may be threshold or classification issues as much as scenario issues.
- Multi-thermal usefulness depends on region-count and broad-shield diagnostics, not renderer appearance alone.
- The renderer must not hide below-LCL, boundary-attached, or return-flow cloud water to make scenarios look better.

## Proposed Follow-On Implementation Issues

These are issue drafts for future work. They are not implemented here.

### Align Fair-Weather baseline and backend preset naming

Goal: clarify whether the backend `fair-weather-cumulus` preset is the single-patch baseline or a paired/multi-thermal preset.

Scope:

- review `backend/app/sim/presets.py`
- review `frontend/src/simulationControls.ts`
- choose either config alignment or naming/category alignment
- update docs/tests for whichever contract is chosen
- do not change solver physics

### Rename or recalibrate "Moderate cloud base" after pressure-aware LCL work

Goal: decide whether the baseline scenario name and humidity imply the intended cloud-base height.

Scope:

- wait for #154/#155 findings
- compare current diagnostic LCL against pressure-aware LCL
- either rename scenario copy or create a preset-change issue
- preserve the baseline's delayed-cloud contract

### Add backend Fair-Weather scenario contract coverage for dry failed cumulus

Goal: make the dry-failed scenario contract explicit outside frontend diagnostics.

Scope:

- add a backend scenario/reference case or metadata contract
- assert motion/updraft develops while cloud water remains negligible
- keep the case separate from generic dry thermal bubble naming if it is user-facing

### Decide final home for humid low-cloud boundary-layer scenario

Goal: move or rename the contrast scenario so it does not read as classic Fair-Weather Cumulus.

Scope:

- choose Fog/Stratus, Layered Atmosphere, or diagnostic/debug placement
- update catalog/docs once the owning lab exists
- avoid presenting low cloud/deck behavior as fair-weather cumulus success

## What Was Intentionally Not Changed

- No solver physics.
- No scenario defaults or preset configs.
- No validation thresholds.
- No test markers.
- No frontend behavior.
- No visualization behavior.
- No follow-on GitHub issues created from this audit.

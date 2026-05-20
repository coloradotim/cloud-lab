# Lower Atmosphere Execution Roadmap

This roadmap captures the current execution sequence for Lower Atmosphere Cloud Basics after the guided-experiment UX rebuild, CM1 validation-matrix planning, and real-output acceptance work.

The goal is still:

```text
Choose an experiment → watch credible cloud evolution → understand why it happened → tweak meaningful controls → run again
```

CM1 is the reference/validation backbone and source of credible reference fields. It should not become the main user-facing workflow. The main product should feel like a guided cloud experiment, with CM1/reference details available under Model details / Why trust this.

## Current State

Completed foundations:

- First real local CM1 pair accepted as workflow/provisional evidence:
  - `cm1-dry-failed-cumulus-v1`
  - `cm1-shallow-cumulus-baseline-v1`
- Lower Atmosphere guided experiment UI exists after #233.
- CM1/reference field and appearance rendering was improved in #231.
- CM1 lower-atmosphere validation matrix exists from #234.
- #223 has been reopened/rescoped as Phase B validation-anchor implementation.
- #254 replaces the old 120 km / 2 km-grid Phase A/B configs with a
  cloud-scale 16 km x 16 km, 200 m-grid policy.

Still needed before adding many new reference cases:

- Finish the current guided-experiment interaction so the product loop is usable.
- Automate CM1 batch run/ingest/QC so future validation cases do not require manual babysitting.
- Rerun and inspect Phase A/B with the cloud-scale configs before treating them
  as final visual validation or starting Phase C sensitivity sweeps.

## Execution Order

### 1. #240 — Finish Lower Atmosphere guided experiment interaction

Work #240 next.

Purpose:

- make the experiment chooser compact/collapsible
- make Appearance mode use a cloud-top-following viewport
- keep Scientific Fields full-domain by default
- add clear x/z axis labels and major tick marks
- consolidate run mode, run/reset, view toggle, field selector, and replay controls near the visual field
- replace placeholder Understand Why content with atmospheric clue cards
- make Try Next support both current-setup tweaks and scenario switching
- make timeline event chips jump to their frames
- clean up the top breadcrumb/header

Do not add new CM1 cases, tune model science, change Boussinesq, or start warm-rain work in #240.

Manual acceptance after #240 should check at least:

```text
Baseline shallow cloud
Dry failed cumulus
Appearance mode
Scientific Fields mode
Experiment chooser collapse/expand
Run/replay/reset controls
Try Next actions
Model details collapsed/expanded
```

Proceed only when the loop feels usable:

```text
choose → watch → understand → tweak/switch → run again
```

### 2. #235 — Automate CM1 validation batch runs, ingestion, QC, and reporting

Work #235 after #240 passes manual UX review.

Purpose:

- create a documented local batch workflow
- run multiple CM1 validation cases without per-case babysitting
- ingest successful runs into Cloud Lab reference artifacts
- record diagnostics and statuses per case
- produce a validation/QC report
- fail clearly for missing NetCDF support, missing runtime files, missing outputs, or ingestion failures

This should come before #223 because Phase B introduces multiple new cases. The batch workflow should prevent a return to manual one-off CM1 execution.

### 3. #223 — Implement Phase B CM1 validation anchors for Lower Atmosphere controls

Work #223 after #235, or coordinate carefully if #235 is already in progress.

Purpose:

Implement the first missing CM1 validation anchors from the #234 matrix:

```text
cm1-capped-suppressed-cumulus-v1
cm1-humid-low-cloud-contrast-v1
cm1-low-stratus-develops-v1 or cm1-fog-develops-v1
```

These are validation anchors, not just more visual presets.

Acceptance should use honest statuses:

```text
planned
generated
ingested
accepted
accepted_with_notes
needs_calibration
failed
```

Do not implement Phase C sweeps, Phase D thresholds, or Phase E rain cases in #223.

### 4. Run and QC Phase B outputs with #235 workflow

After #223 adds the case assets/manifests/run hooks, use the #235 workflow to run, ingest, and QC the Phase B cases.

For each case, answer:

```text
Did CM1 produce the expected regime?
Are cloud base/top/timing broadly plausible and directionally useful?
Is the case accepted, accepted with notes, needs calibration, or failed?
```

Do not mark a case accepted just because it ran successfully.

### 5. #241 — Implement Phase C CM1 one-factor sensitivity sweeps around baseline

Work #241 only after #235 and #223 are complete, Phase A/B have been rerun with
the cloud-scale #254 configs, and Phase B results are known.

Purpose:

Validate user-facing control trends around the accepted shallow-cumulus baseline:

```text
low/high moisture
weak/strong heating
weak/strong cap
less/more dry air aloft
```

Phase C should remain a curated one-factor sweep, not a full factorial.

If Phase B results change the expected control behavior, update the validation
matrix before implementing Phase C. Do not run Phase C against the superseded
120 km / 2 km-grid setup.

## Issues To Create Later

Do not create these until earlier evidence exists.

### Validated-range UI

Create after Phase B and at least some Phase C outputs are accepted.

Purpose:

Show user-control confidence labels such as:

```text
Validated range
Exploratory range
Outside validated range
```

This should not be implemented before real CM1 coverage exists behind the labels.

### Phase D threshold cases

Create after Phase C.

Purpose:

Validate transition boundaries:

```text
barely cloud-free
barely cloud-forming
cloud forms then evaporates quickly
shallow cloud capped near threshold
```

These cases support warnings and explain where small control changes flip outcomes.

### Phase E warm-rain cases

Create after the warm-cloud regime and non-rain shallow-cloud behavior are validated.

Purpose:

Move toward:

```text
cloud but no rain
warm-rain shallow cloud
rain evaporates below cloud base
```

This should connect to the Warm Rain / Droplet Growth lab, but should not jump ahead of the Lower Atmosphere validation foundation.

## Future Lab Specs

Leave these open but idle unless a current issue depends on them:

```text
#115 — Layered Atmosphere
#116 — Orographic / Terrain Clouds
#117 — Warm Rain / Droplet Growth
#118 — Fog / Stratus
#119 — Mixed-Phase / Ice
```

The only near-term exception is #118 Fog / Stratus. If #223 cannot honestly decide whether the low-cloud anchor is fog or low stratus, work enough of #118 to clarify product/science language. Otherwise defer future lab specs.

## Current Non-Goals

Do not use the current sequence to:

- add many visual presets without validation purpose
- expose CM1 comparison as the main user workflow
- run CM1 inside the web app
- change Boussinesq behavior
- tune science to make a visual look better
- add PySDM or warm-rain physics early
- build terrain, ice, or other future labs before Lower Atmosphere is solid

## Decision Rule

Before working the next issue, ask:

```text
Does this improve the guided experiment loop or the CM1 validation backbone?
```

If not, defer it.

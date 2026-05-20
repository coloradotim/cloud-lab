# Current Phase Plan

This document defines the current executable phase for Cloud Lab.

The product direction is lab-driven:

> Cloud Lab helps users explore atmospheric physics through beautiful, interactive cloud experiments grounded in real physical principles.

The current phase is not about adding more feature panels. It is about making the lab-driven product real in the application.

Workbench V2 remains the product shell path.

For lower-atmosphere science implementation, use
`docs/lower-atmosphere-modeling-strategy.md`.

The current reduced-model path is:

```text
boundary_layer_1d → controlled_cloud_column → Lower Atmosphere v2 design → CM1 adapter/reference cases
```

The current visual credibility path is:

```text
CM1 adapter → CM1 visual case library → local CM1 setup → first real CM1 reference pair assets → 2-D scientific reference replay → optics field contract → appearance view → reduced/reference diagnostic comparison
```

The reduced-model path remains useful for explanation and fast interaction, but
credible 2-D lower-atmosphere cloud visualization should be anchored by CM1
reference output first.

The first 2-D scientific reference replay is now represented in the Lower
Atmosphere v2 stage by a CM1/reference panel backed by a tiny synthetic
reference-frame fixture. Real CM1 output should replace that fixture only
through a separately scoped ingestion path.

The optics field contract now lives in `docs/optics-field-contract.md`. It
defines how appearance and optical-depth views consume physical fields,
provenance, renderer controls, assumed versus modeled droplet properties, and
validation labels without changing solver or reference output.

The first CM1/reference cloud appearance mode is now represented in the Lower
Atmosphere v2 reference panel. It consumes reference cloud liquid water,
preserves replay/source labels, uses an assumed-radius visual interpretation,
and keeps the scientific field view available. It does not run CM1.

The first reduced-model/reference comparison panel is now represented in Lower
Atmosphere v2 as a qualitative diagnostic comparison. It maps v2 scenarios to
CM1 reference case ids, compares teaching-relevant diagnostics when a reference
run exists, and shows a clear missing-reference fallback for mapped scenarios
without loaded reference data. It does not score exact CM1 morphology, run CM1,
or make Boussinesq part of the credibility path.

The current Lower Atmosphere product priority is now:

```text
real-output acceptance → #222 visual/replay/appearance polish → #230 structure polish → #233 guided experiment rebuild → #240 guided interaction finish
```

Generated local reference artifacts and frontend local indexes remain ignored
by git. The app should prefer real local ingested artifacts when
`frontend/public/reference/cm1/local/index.json` exists, and should otherwise
label the tiny fixture/demo path as synthetic and not scientific truth.

The committed first-pair CM1 namelists request NetCDF output
(`output_format = 2`). Local execution therefore requires a NetCDF-capable
`cm1.exe`, `LANDUSE.TBL` copied into generated run directories, and soundings
that extend above the grid top. The reference-pair scripts now preflight these
conditions and fail when expected `.nc` output is missing.

Manual acceptance of the first real local CM1 reference pair is documented in
`docs/reference-models/cm1-real-output-acceptance.md`. The dry-failed case is
usable as motion without meaningful cloud, and the shallow-cumulus baseline is
usable as meaningful cloud formation. Do not calibrate the first CM1 cases
before or inside #222.

Issue #222 polish kept the science fixed and improved the app experience
around the accepted real-output path:

- scientific replay uses clearer field readouts, cloud/no-signal states,
  display-scale notes, and less alarming temperature/theta field messaging
- cloud appearance remains a visual interpretation of CM1/reference cloud
  water while increasing cloud visibility and preserving zero-cloud dry cases
- comparison layout uses compact structured rows so narrow/export-like views do
  not collapse into vertical text
- source, view, and assumption labels are grouped to reduce repetition while
  preserving `Real local ingested output`, `Synthetic fixture data`, `Not
  scientific truth`, `Not direct radiative transfer`, and `Not live CM1
  simulation`
- the pre-run Model details state explains that offline CM1 reference output is
  already available and the experiment run computes the simplified explanatory
  side

Issue #233 is the guided user-facing rebuild for the same accepted science
path. It should not add cases, tune CM1, change Boussinesq, or start warm-rain
work. Lower Atmosphere Cloud Basics should now be organized as:

```text
choose an experiment
→ watch cloud evolution
→ understand why it happened
→ try the next atmospheric contrast
→ open Model details / Why trust this when validation is needed
```

The main Lower Atmosphere page should not feel like a reduced-model versus CM1
comparison dashboard. CM1 remains the reference/validation backbone and source
of credible replay fields, but the default user mental model is a guided cloud
experiment. Detailed source/provenance, reference checks, and exact-morphology
limitations belong under collapsed Model details / Why trust this.

Issue #231 is a focused rendering-quality pass on the CM1/reference views. It
should improve scientific field palettes and cloud appearance payoff using the
accepted dry-failed and shallow-cumulus reference outputs. It should not add
cases, tune CM1, change reduced-model science, change Boussinesq, or start
warm-rain work.

Issue #240 finishes the guided Lower Atmosphere interaction without changing
science. The selected experiment chooser should collapse into a compact summary
with a clear Change experiment action. Primary run mode, run/reset, view mode,
field selection, and replay controls should live near the cloud field. Cloud
Appearance is the default post-run view and uses a display-only viewport that
starts in the lower atmosphere and follows cloud-top growth; Scientific Fields
shows the full x-z domain by default. Both views should show clear x/z axes and
major tick marks. Understand Why should use atmospheric clue cards, Try Next
should separate planned setup tweaks from scenario-switch buttons, event chips
should jump to their frames, and Model details / Why trust this should stay
collapsed as the provenance/validation home.

Issue #243 is a focused usability refinement on that replay area. The visual
field should be bounded to a stable viewport-relative display height, Appearance
mode should follow cloud-top growth by changing the display window rather than
expanding the DOM height, and Scientific Fields should fit the full x-z domain
inside the same bounded plot frame. Run mode, Run experiment / Run again, Reset,
view mode, field selection, and replay controls should remain visually grouped
with the cloud field.

Issue #234 defines the CM1 lower-atmosphere validation matrix before more cases
are added ad hoc. The matrix should guide Phase B validation anchors
(capped/suppressed, humid low-cloud, and fog/low-stratus), later one-factor
sweeps, threshold cases, and warm-rain cases. It should keep #223 untouched
unless the user explicitly asks to retitle/rescope that issue.

Issue #235 adds the local automation layer for that matrix. Use
`scripts/reference/cm1/run_validation_batch.sh` to dry-run, execute, ingest, QC,
and report on committed runnable CM1 validation cases. Issue #223 adds the
Phase B validation-anchor assets for capped/suppressed cumulus, humid
low-cloud contrast, and low stratus. These are planned runnable anchors, not
accepted reference outputs, until real local CM1 output is generated, ingested,
and manually inspected. The batch report remains ignored local output under
`data/reference/cm1/validation-runs/<timestamp>/validation-report.json`.

## Current Phase Goal

Build Workbench V2 and the first usable lower-atmosphere labs:

```text
Lab Picker → Lower Atmosphere Cloud Basics / Evolving Boundary Layer → Run / Watch / Inspect
```

The phase is successful when Cloud Lab opens into a clear lab-driven experience,
Lower Atmosphere Cloud Basics opens into a guided experiment flow by default,
Evolving Boundary Layer exposes the standalone `boundary_layer_1d` profile path,
and the old dashboard/Boussinesq-centered Lower Atmosphere screen is no longer
the default product model. As of #197, Boussinesq-centered Lower Atmosphere v1
frontend scenarios are quarantined as developer/prototype metadata and are not
presented by the normal Lab Picker or Lower Atmosphere scenario chooser.

## Authoritative Product Docs

Before working this phase, read:

- `AGENTS.md`
- `docs/doc-index.md`
- `docs/product-vision.md`
- `docs/lab-roadmap.md`
- `docs/workbench-v2-product-spec.md`
- `docs/workbench-v2-architecture.md`
- `docs/architecture-decisions/ADR-001-lab-driven-product.md`

For visualization work, also read:

- `docs/visualization-and-workbench-views.md`

For Lower Atmosphere Cloud Basics science and diagnostics, also read:

- `docs/scenarios.md`
- `docs/boussinesq-solver.md`
- `docs/boussinesq-validation.md`
- `docs/labs/lower-atmosphere-cloud-basics.md`
- `docs/labs/lower-atmosphere-cloud-basics-v2.md`

## Open Issues In This Phase

### Engineering hygiene

- `#100` — Make fast pre-merge tests actually fast

This remains open because iteration speed matters. It may be worked whenever test/runtime friction starts slowing PRs. It does not block Workbench V2 unless the current test flow becomes a practical blocker.

### Workbench V2 / reference lab implementation

Historical completed sequence:

1. `#107` — Build Workbench V2 shell and lab picker
2. `#108` — Implement lab catalog and Lower Atmosphere Cloud Basics lab definition
3. `#109` — Wire Lower Atmosphere Cloud Basics Lab to run, replay, inspect, and save flow
4. `#110` — Build Workbench V2 scientific visualization stage and inspector
5. `#111` — Retire old dashboard as default and complete Workbench V2 reference flow

### Next-direction design issues

Historical design sequence:

6. `#112` — Design Cloud Optics / Beauty Lab v1
7. `#113` — Design Evolving Boundary Layer Lab and profile-evolution model

These design issues produced the next implementation track. Current follow-on
work should use the open issue state and `docs/lower-atmosphere-modeling-strategy.md`
rather than reopening old closed issue ladders.

## Execution Rules

### Rule 1 — Do not rebuild the old dashboard

The current frontend is a capability prototype. Reuse useful code only when it fits Workbench V2.

Do not preserve:

- old stacked dashboard layout
- giant workbench hero
- saved runs as a default stage panel
- comparison as a default stage panel
- duplicated run controls
- every raw solver/config control as a primary UI control

### Rule 2 — Build one complete reference lab first

The first complete lab is Lower Atmosphere Cloud Basics.

It should answer:

> How do heating, moisture, and stability shape basic warm-cloud formation near the ground?

The first reference lab should establish the reusable pattern for:

- lab metadata
- scenario metadata
- primary controls
- run lifecycle
- replay/timeline
- visualization stage
- inspector/diagnostics
- approximation labels
- saved-run hook or clean placeholder

### Rule 3 — No new physics in Workbench V2 implementation

Issues `#107` through `#111` are product/frontend/integration issues.

Do not add:

- terrain
- rain physics
- new microphysics
- 2.5-D rendering
- optical controls
- boundary-layer model physics
- PySDM integration

Those belong to later lab-specific work.

### Rule 4 — Use lab language, not solver language

User-facing UI should say things like:

- Lower Atmosphere Cloud Basics
- source-layer humidity
- surface heating
- cloud base
- expected LCL
- dry failed cloud
- stability

It should not make the user think primarily in terms of:

- solver type
- raw config schema
- implementation files
- internal dashboard panels

Solver and schema details may exist in advanced/system/developer contexts.

### Rule 5 — Do not overbuild future labs yet

Other labs may appear in the Lab Picker as planned/prototype/later, but they should not pretend to be implemented. Evolving Boundary Layer is now implemented only as a v1 standalone profile lab, not as a cloud-water or cloud-resolving lab.

Do not build partial terrain/rain/ice/optics controls into the main workflow before their lab contracts exist.

## Expected Phase Outcome

At the end of issues `#107` through `#111`, the app should provide:

- Lab Picker as the default product entry point.
- Lower Atmosphere Cloud Basics as the first usable lab, now defaulting to the
  v2 reduced-model shell.
- Lab-specific scenario selection.
- A small set of meaningful lower-atmosphere controls.
- Run/Stop/Reset through existing backend streaming.
- Focused scientific visualization or explicit placeholders in the center stage.
- Timeline/replay or explicit timeline placeholders tied to the active lab flow.
- Inspector with available lower-atmosphere v2 diagnostics/placeholders.
- Honest labels for reduced-model output, prescribed lift, derived diagnostics,
  and any experimental Boussinesq behavior still exposed outside the default path.
- Old dashboard no longer serving as the default user experience.

## Non-Goals For This Phase

Do not attempt to complete:

- Cloud Optics / Beauty implementation
- 2.5-D visualization
- terrain/orographic lab
- warm-rain lab
- fog/stratus lab
- live-coupled evolving boundary-layer / Boussinesq model
- parameter sweeps
- true 3-D modeling
- PySDM integration

Design issues `#112` and `#113` prepare the next stages but should not expand the current implementation scope.

## Suggested PR Strategy

Prefer one PR per issue unless two issues are inseparable in the code.

Expected PR sequence:

1. Workbench V2 shell and Lab Picker.
2. Lab catalog and Lower Atmosphere Cloud Basics lab definition.
3. Run/replay/control integration for Lower Atmosphere Cloud Basics.
4. Scientific visualization stage and inspector.
5. Old dashboard retirement/default routing cleanup.

Each PR should include:

- issue number closed
- lab/product impact
- what changed
- what was intentionally not included
- tests/checks run
- any docs changed

## When To Work `#100`

Work `#100` before or during this phase if:

- UI-only PRs are still triggering slow backend/science validation unnecessarily
- Codex or local iteration is slowed enough that PR cycle time becomes painful
- CI path filtering or test tiers are clearly blocking Workbench V2 progress

Otherwise keep it open and work the product issues first.

## Definition Of Done For The Phase

This phase is done when:

- `#107` through `#111` are complete.
- Workbench V2 is the default product UI.
- Lower Atmosphere Cloud Basics is usable end-to-end.
- The old dashboard is removed, quarantined, or clearly secondary.
- Docs and tests describe the new product structure.
- The next implementation stage can be planned from `#112` and `#113` without reopening old feature-first issues.

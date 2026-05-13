# Current Phase Plan

This document defines the current executable phase for Cloud Lab.

The product direction is lab-driven:

> Cloud Lab helps users explore atmospheric physics through beautiful, interactive cloud experiments grounded in real physical principles.

The current phase is not about adding more feature panels. It is about making the lab-driven product real in the application.

## Current Phase Goal

Build Workbench V2 and the first complete reference lab:

```text
Lab Picker → Lower Atmosphere Cloud Basics Lab → Run / Watch / Inspect
```

The phase is successful when Cloud Lab opens into a clear lab-driven experience, Lower Atmosphere Cloud Basics works as the first usable lab, and the old dashboard is no longer the default product model.

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

## Open Issues In This Phase

### Engineering hygiene

- `#100` — Make fast pre-merge tests actually fast

This remains open because iteration speed matters. It may be worked whenever test/runtime friction starts slowing PRs. It does not block Workbench V2 unless the current test flow becomes a practical blocker.

### Workbench V2 / reference lab implementation

Work in this order:

1. `#107` — Build Workbench V2 shell and lab picker
2. `#108` — Implement lab catalog and Lower Atmosphere Cloud Basics lab definition
3. `#109` — Wire Lower Atmosphere Cloud Basics Lab to run, replay, inspect, and save flow
4. `#110` — Build Workbench V2 scientific visualization stage and inspector
5. `#111` — Retire old dashboard as default and complete Workbench V2 reference flow

### Next-direction design issues

Work after, or in parallel only if implementation is not being disrupted:

6. `#112` — Design Cloud Optics / Beauty Lab v1
7. `#113` — Design Evolving Boundary Layer Lab and profile-evolution model

These are design issues, not implementation issues. They should produce docs and next-step implementation issues only after Workbench V2 and the Lower Atmosphere Cloud Basics reference lab direction are clear.

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

Other labs may appear in the Lab Picker as planned/prototype/later, but they should not pretend to be implemented.

Do not build partial terrain/rain/ice/optics controls into the main workflow before their lab contracts exist.

## Expected Phase Outcome

At the end of issues `#107` through `#111`, the app should provide:

- Lab Picker as the default product entry point.
- Lower Atmosphere Cloud Basics as the first usable lab.
- Lab-specific scenario selection.
- A small set of meaningful lower-atmosphere controls.
- Run/Stop/Reset through existing backend streaming.
- Scientific 2-D visualization in the center stage.
- Timeline/replay tied to displayed frames.
- Inspector with available lower-atmosphere / fair-weather scenario diagnostics.
- Honest labels for solver output, derived diagnostics, and experimental Boussinesq behavior.
- Old dashboard no longer serving as the default user experience.

## Non-Goals For This Phase

Do not attempt to complete:

- Cloud Optics / Beauty implementation
- 2.5-D visualization
- terrain/orographic lab
- warm-rain lab
- fog/stratus lab
- evolving boundary-layer model
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

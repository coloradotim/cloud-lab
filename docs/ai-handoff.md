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

## Current Workbench V2 Execution Order

The main Workbench V2 implementation sequence is:

```text
#107 → #108 → #109 → #110 → #111
```

- `#107` — Build Workbench V2 shell and lab picker
- `#108` — Implement lab catalog and Lower Atmosphere Cloud Basics lab definition
- `#109` — Wire Lower Atmosphere Cloud Basics Lab to run, replay, inspect, and save flow
- `#110` — Build Workbench V2 scientific visualization stage and inspector
- `#111` — Retire old dashboard as default and complete Workbench V2 reference flow

Important current UX note from review of #107:

- The individual lab/workbench page was directionally acceptable for the shell.
- The Lab Picker/home page needed revision because it looked like a card dump.
- Lower Atmosphere Cloud Basics should be a featured `Start here` card.
- Planned labs should be quieter and grouped into `Coming next` / `Future labs`.
- The Lower Atmosphere Cloud Basics card must not be clipped.

## Current Design / Future Lab Issues

Dedicated lab design/spec issues exist for future labs:

- `#112` — Design Cloud Optics / Beauty Lab v1 → `docs/labs/cloud-optics-beauty.md`
- `#113` — Design Evolving Boundary Layer Lab and profile-evolution model → `docs/labs/evolving-boundary-layer.md`
- `#115` — Design Layered Atmosphere Lab v1 → `docs/labs/layered-atmosphere.md`
- `#116` — Design Orographic / Terrain Clouds Lab v1 → `docs/labs/orographic-terrain-clouds.md`
- `#117` — Design Warm Rain / Droplet Growth Lab v1 → `docs/labs/warm-rain-droplet-growth.md`
- `#118` — Design Fog / Stratus Lab v1 → `docs/labs/fog-stratus.md`
- `#119` — Design Mixed-Phase / Ice Lab v1 → `docs/labs/mixed-phase-ice.md`

Lab design issues are product/science architecture work. Do not hand Codex a new lab design issue cold and ask it to decide the lab's product/science direction.

Use this split:

- ChatGPT / human review: lab question, user promise, controls, physics scope, diagnostics, honesty labels, lab spec, issue decomposition.
- Codex: scoped implementation issues created from approved lab specs.

## Test / CI Issues

- `#100` — Make fast pre-merge tests actually fast
- `#120` — Rationalize test suite around lab contracts and validation tiers

Important distinction:

- `#100` is about CI/test-path speed and separating frontend quick, backend quick, targeted science, and full validation paths.
- `#120` is the broader test-suite rationalization effort.

Do not turn `#100` into `#120`.

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

## Boussinesq Remediation Issues Created From #150

`#150` is closed. It created the approved remediation backlog:

1. `#153` — Audit Fair-Weather Cumulus scenario presets against physical intent
2. `#154` — Diagnose Boussinesq humid-cloud thermodynamic structure failure
3. `#155` — Implement pressure-aware saturation and LCL thermodynamics for `boussinesq_2d`
4. `#156` — Add stable/capped suppression validation and remediate failures
5. `#157` — Define and implement return-flow / boundary cloud-water diagnostic policy
6. `#158` — Add Fair-Weather resolution/domain sensitivity validation
7. `#159` — Audit Boussinesq stabilizers, safety caps, and damping influence
8. `#160` — Design successor dynamics path for cloud-resolving labs if Boussinesq remains Yellow

Recommended remediation order:

```text
#153 → #154 → #155 → #156 → #157 → #158 → #159 → #160
```

Boussinesq-dependent work gate:

- Continue Lower Atmosphere Cloud Basics only with honest experimental labels.
- Do not treat `boussinesq_2d` as a broadly trusted dynamics foundation.
- Do not build polished future Boussinesq-dependent labs until trust gaps are resolved or explicitly accepted.
- Do not live-couple Evolving Boundary Layer into Boussinesq yet.
- Continue non-Boussinesq paths.

Post-#156 status:

- Dedicated paired stable/capped suppression validation exists for Lower Atmosphere Cloud Basics.
- Current solver behavior passes the controlled lapse-rate pair and low/strong-cap versus high/weak-cap pair without solver physics changes.
- This narrows the stability-suppression trust gap but does not make `boussinesq_2d` broadly trusted.

Post-#166 status:

- A 4800 s Lower Atmosphere Cloud Basics paired-thermal reproduction exists for cloud-water persistence in subsaturated descending/return-flow regions.
- Backend diagnostics now report subsaturated, downdraft, return-flow, below-LCL, near-surface, and near-boundary cloud-water fractions, plus estimated condensation/evaporation tendencies and approximate subsaturated-cloud lifetime.
- The solver now evaporates pre-existing transported cloud water against the emitted cell's local pressure-aware saturation state while preserving lifted-parcel condensation.
- The reproduction no longer shows the old majority-subsaturated-cloud-water failure, but it still reports return-flow cloud-water warnings. `boussinesq_2d` remains Yellow.

Post-#157 status:

- Lower Atmosphere Cloud Basics now has an explicit return-flow / boundary cloud-water diagnostic policy.
- Large below-LCL cloud-water fractions are hard failures; smaller below-LCL fractions are warnings.
- Low-level return-flow, boundary, top-sponge, lateral-boundary, and boundary-connected cloud water are warnings or scenario-specific interpretation signals, not renderer masks.
- Backend diagnostics expose artifact-policy check statuses and boundary-region fractions; frontend inspector diagnostics surface the same warning categories.
- This policy does not tune scenarios, hide cloud water, or resolve the remaining return-flow/stabilizer trust gap. `boussinesq_2d` remains Yellow; deeper causes remain with #159 and successor-core decisions remain with #160.

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

- If Workbench V2 is the active product track, continue `#107 → #108 → #109 → #110 → #111`.
- If CI/test runtime is blocking product iteration, work `#100` without broadening into `#120`.
- If Boussinesq / Lower Atmosphere Cloud Basics trust remediation is the active track, begin with `#153` and work the remediation backlog in order.

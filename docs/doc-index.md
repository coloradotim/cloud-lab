# Documentation Index

This index explains which Cloud Lab docs are authoritative for different types of work.

If documents appear to conflict, prefer the lab-driven product direction in:

1. `docs/product-vision.md`
2. `docs/lab-roadmap.md`
3. `docs/workbench-v2-product-spec.md`
4. `docs/workbench-v2-architecture.md`
5. `docs/architecture-decisions/ADR-001-lab-driven-product.md`
6. `AGENTS.md`

Older implementation docs remain useful as technical references, but they should not override the lab-driven product direction.

## Start Here

- `README.md` — project overview, setup, current status, and doc map.
- `docs/ai-handoff.md` — fast-start handoff for new ChatGPT/Codex sessions.
- `docs/current-phase-plan.md` — current executable phase, open issue order, and phase guardrails.
- `docs/product-vision.md` — product identity, tagline, north star, and durable principles.
- `docs/lab-roadmap.md` — lab-driven roadmap and core phenomenon labs.
- `docs/workbench-v2-product-spec.md` — clean-slate lab/workbench user experience.
- `docs/workbench-v2-architecture.md` — frontend/product architecture for Workbench V2.
- `docs/architecture-decisions/ADR-001-lab-driven-product.md` — accepted decision to organize around labs.

## Product And UX

- `docs/ai-handoff.md` — source of truth for quickly bootstrapping a new AI session.
- `docs/current-phase-plan.md` — source of truth for the current execution order.
- `docs/workbench-v2-product-spec.md` — source of truth for the future product shell.
- `docs/workbench-v2-architecture.md` — source of truth for future frontend structure.
- `docs/visualization-and-workbench-views.md` — visualization and workbench view guidance; includes current prototype context and future view model.
- `docs/scenarios.md` — scenario contracts and current scenario catalog; scenarios are lab-specific experiments.
- `docs/labs/lower-atmosphere-cloud-basics-v2.md` — design for the reduced-model replacement of the current Boussinesq-based Lower Atmosphere lab, using `boundary_layer_1d`, `controlled_cloud_column`, diagnostics, precipitation-ready architecture, and future reference/optics handoffs.
- `docs/simulation-controls.md` — current/prototype control system and control meanings; Workbench V2 should reorganize controls around labs.

## Science And Modeling

- `docs/scientific-roadmap.md` — physics maturity path in service of the lab roadmap.
- `docs/lower-atmosphere-modeling-strategy.md` — authoritative lower-atmosphere model hierarchy: CM1 reference cases, `boundary_layer_1d`, `controlled_cloud_column`, controlled microphysics, field/diagnostic contracts, and optics inputs.
- `docs/reference-models/cm1.md` — CM1 offline reference-output adapter contract, reference-frame schema, field mapping, diagnostics, provenance, and data/dependency policy.
- `docs/reference-models/cm1-lower-atmosphere-cases.md` — CM1 lower-atmosphere visual reference case library, including the immediate dry-failed/shallow-cumulus pair, early/later cases, required fields, storage policy, and optics relationship.
- `docs/reference-models/cm1-local-setup-macos.md` — local macOS CM1 setup, build, run, output storage, and helper-script workflow for offline Cloud Lab reference runs.
- `docs/boundary-layer-1d.md` — implemented `boundary_layer_1d` profile-model contract, tendencies, diagnostics, presets, validation expectations, and v1 no-cloud-water boundary.
- `docs/controlled-cloud-column.md` — implemented `controlled_cloud_column` prescribed-lift cloud-formation model, schemas, diagnostics, scenarios, and validation expectations.
- `docs/next-physics-core.md` — physics-core strategy; not the product roadmap.
- `docs/boussinesq-solver.md` — Boussinesq 2-D physics core implementation notes.
- `docs/boussinesq-numerical-method.md` — authoritative numerical-method contract for the current `boussinesq_2d` solver and its Yellow trust boundaries.
- `docs/boussinesq-validation.md` — current Boussinesq validation gate and diagnostics.
- `docs/fair-weather-resolution-domain-sensitivity.md` — Lower Atmosphere Cloud Basics fair-weather scenario-family sensitivity report for resolution, domain size, and runtime.
- `docs/boussinesq-stabilizer-audit.md` — audit of Boussinesq stabilizers, safety caps, damping/diffusion influence, and top-sponge sensitivity for Lower Atmosphere Cloud Basics.
- `docs/minimal-solver.md` — legacy/internal educational 2-D solver.
- `docs/microphysics-lab.md` — controlled warm-cloud microphysics lab mode.
- `docs/microphysics-comparison.md` — comparison of simple saturation adjustment and current bulk microphysics lab behavior.
- `docs/microphysics-schema.md` — proposed optional droplet-size distribution and microphysics payload schema.
- `docs/pysdm-evaluation.md` — optional PySDM evaluation for Warm Rain / Droplet Growth and droplet-aware optics.

## Data, API, And Engineering

- `docs/architecture.md` — system architecture and boundaries.
- `docs/simulation-data-model.md` — config, frame, saved-run, and future payload schemas.
- `docs/live-streaming.md` — run lifecycle and WebSocket frame streaming.
- `docs/development.md` — development workflow, test tiers, and PR expectations.
- `docs/testing-and-validation.md` — testing taxonomy, lab/scenario contracts, validation tiers, and expectation-update policy.
- `AGENTS.md` — durable instructions for coding agents.

## How To Use This Index

### New AI session bootstrap

Read:

1. `AGENTS.md`
2. `docs/ai-handoff.md`
3. `docs/current-phase-plan.md`
4. `docs/doc-index.md`
5. the issue or task being implemented

### Product / UI work

Read:

1. `AGENTS.md`
2. `docs/ai-handoff.md`
3. `docs/current-phase-plan.md`
4. `docs/product-vision.md`
5. `docs/lab-roadmap.md`
6. `docs/workbench-v2-product-spec.md`
7. `docs/workbench-v2-architecture.md`
8. the issue being implemented

### New lab work

Read:

1. `docs/lab-roadmap.md`
2. `docs/lab-contract-template.md`
3. `docs/workbench-v2-product-spec.md`
4. `docs/scientific-roadmap.md`
5. relevant solver/science docs

### Solver or physics work

Read:

1. `AGENTS.md`
2. `docs/ai-handoff.md`
3. `docs/scientific-roadmap.md`
4. `docs/testing-and-validation.md`
5. `docs/next-physics-core.md`
6. relevant solver docs
7. relevant lab docs/sections

### Visualization work

Read:

1. `docs/product-vision.md`
2. `docs/lab-roadmap.md`
3. `docs/visualization-and-workbench-views.md`
4. `docs/workbench-v2-product-spec.md`
5. relevant lab sections

### Schema/API work

Read:

1. `docs/architecture.md`
2. `docs/simulation-data-model.md`
3. `docs/live-streaming.md`
4. `docs/testing-and-validation.md`
5. impacted lab/scenario docs

## Lab Ordering Note

The lab list is conceptual. It is not always the build sequence.

Current product priority is:

1. Workbench V2 and lab-driven UI.
2. Lower Atmosphere Cloud Basics as the first complete reference lab.
3. Cloud Optics / Beauty capabilities.
4. Evolving Boundary Layer capabilities.
5. Layered Atmosphere.
6. Orographic / Terrain Clouds.
7. Warm Rain / Droplet Growth.
8. Fog / Stratus.
9. Mixed-Phase / Ice later.

For executable current-phase order, use `docs/current-phase-plan.md` and `docs/ai-handoff.md`.

## Current Authoritative Direction

Cloud Lab is a lab-driven platform for beautiful, interactive cloud experiments grounded in real physical principles.

The current frontend is a capability prototype. Workbench V2 is the clean-slate product direction.

Future work should build labs, not feature piles.

For lower-atmosphere science architecture, use
`docs/lower-atmosphere-modeling-strategy.md`. It supersedes treating
`boussinesq_2d` as the main science path for future cloud-resolving labs.

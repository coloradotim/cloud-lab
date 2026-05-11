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
- `docs/product-vision.md` — product identity, tagline, north star, and durable principles.
- `docs/lab-roadmap.md` — lab-driven roadmap and core phenomenon labs.
- `docs/workbench-v2-product-spec.md` — clean-slate lab/workbench user experience.
- `docs/workbench-v2-architecture.md` — frontend/product architecture for Workbench V2.
- `docs/architecture-decisions/ADR-001-lab-driven-product.md` — accepted decision to organize around labs.

## Product And UX

- `docs/workbench-v2-product-spec.md` — source of truth for the future product shell.
- `docs/workbench-v2-architecture.md` — source of truth for future frontend structure.
- `docs/visualization-dashboard.md` — visualization and workbench view guidance; includes current prototype context and future view model.
- `docs/scenarios.md` — scenario contracts and current scenario catalog; scenarios are lab-specific experiments.
- `docs/simulation-controls.md` — current/prototype control system and control meanings; Workbench V2 should reorganize controls around labs.

## Science And Modeling

- `docs/scientific-roadmap.md` — physics maturity path in service of the lab roadmap.
- `docs/next-physics-core.md` — physics-core strategy; not the product roadmap.
- `docs/boussinesq-solver.md` — Boussinesq 2-D physics core implementation notes.
- `docs/boussinesq-validation.md` — current Boussinesq validation gate and diagnostics.
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

### Product / UI work

Read:

1. `AGENTS.md`
2. `docs/product-vision.md`
3. `docs/lab-roadmap.md`
4. `docs/workbench-v2-product-spec.md`
5. `docs/workbench-v2-architecture.md`
6. the issue being implemented

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
2. `docs/scientific-roadmap.md`
3. `docs/testing-and-validation.md`
4. `docs/next-physics-core.md`
5. relevant solver docs
6. relevant lab docs/sections

### Visualization work

Read:

1. `docs/product-vision.md`
2. `docs/lab-roadmap.md`
3. `docs/visualization-dashboard.md`
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
2. Fair-Weather Cumulus as the first complete reference lab.
3. Cloud Optics / Beauty capabilities.
4. Evolving Boundary Layer capabilities.
5. Layered Atmosphere.
6. Orographic / Terrain Clouds.
7. Warm Rain / Droplet Growth.
8. Fog / Stratus.
9. Mixed-Phase / Ice later.

## Current Authoritative Direction

Cloud Lab is a lab-driven platform for beautiful, interactive cloud experiments grounded in real physical principles.

The current frontend is a capability prototype. Workbench V2 is the clean-slate product direction.

Future work should build labs, not feature piles.

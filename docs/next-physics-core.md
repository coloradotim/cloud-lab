# Next Physics Core

This document defines Cloud Lab's current physics-core strategy. It is not the product roadmap.

The product roadmap is lab-driven. Physics cores exist to serve labs.

Primary product direction:

- `docs/product-vision.md`
- `docs/lab-roadmap.md`
- `docs/workbench-v2-product-spec.md`
- `docs/workbench-v2-architecture.md`
- `docs/architecture-decisions/ADR-001-lab-driven-product.md`

## Decision Summary

Cloud Lab should use a hybrid physics-core strategy:

1. Preserve the existing physics cores where they remain useful.
2. Use `boussinesq_2d` as an experimental 2-D dynamics scaffold for selected labs, especially Lower Atmosphere Cloud Basics.
3. Use `microphysics_lab` as the controlled warm-cloud experiment path for Warm Rain / Droplet Growth concepts.
4. Evaluate PySDM in isolated parcel, box, column, and prescribed-flow cases before any production coupling.
5. Do not integrate PySDM directly into `boussinesq_2d` yet.
6. Delay full dynamics/microphysics coupling until both sides are individually credible and a lab requires the coupling.

This keeps Cloud Lab moving toward more serious modeling while still supporting beautiful, interactive labs now.

After #174, the lower-atmosphere strategy is a model hierarchy rather than a
patched-Boussinesq path:

1. CM1 offline reference cases for credible cloud-resolving behavior.
2. `boundary_layer_1d` for interactive profile/environment evolution.
3. `controlled_cloud_column` for cloud formation under prescribed lift.
4. controlled microphysics / optional PySDM for warm-rain and droplet paths.
5. optics consuming physical fields and provenance metadata.

`boussinesq_2d` remains available as a Yellow prototype scaffold for controlled
Lower Atmosphere Cloud Basics experiments. It is not the main science path for
polished future cloud-resolving labs. See
`docs/lower-atmosphere-modeling-strategy.md` for the authoritative
lower-atmosphere science architecture.

## How This Serves The Lab Roadmap

Each physics core should be judged by the labs it enables.

| Lab | Near-term physics path | Notes |
| --- | --- | --- |
| Lower Atmosphere Cloud Basics | `boundary_layer_1d` + `controlled_cloud_column` + CM1 references; current `boussinesq_2d` only as Yellow prototype/comparison | Do not build future cloud-resolving claims on current Boussinesq. |
| Evolving Boundary Layer | future profile/column + 2-D coupling | Major missing science/product layer. |
| Layered Atmosphere | future profile/layer model | Needs editable and evolving profiles. |
| Orographic / Terrain Clouds | idealized terrain forcing + validation | May start with Boussinesq, but must stay labeled. |
| Warm Rain / Droplet Growth | `microphysics_lab`, PySDM evaluation later | Microphysics-first lab, not Boussinesq-first. |
| Cloud Optics / Beauty | renderer consumes fields/diagnostics | Physics core should not contain rendering logic. |
| Fog / Stratus | future surface cooling + profile/mixing model | Likely depends on boundary-layer/profile evolution. |
| Mixed-Phase / Ice | future physics core | Not near-term. |

Physics work that cannot identify the lab it serves should usually wait.

## Current State

Cloud Lab currently has three solver backends behind one shared frame contract:

| Solver | Role | Current status |
| --- | --- | --- |
| `educational_2d` | Legacy/internal teaching, UI, debugging, and regression model. | Useful for compatibility and regression, not public product direction. |
| `boussinesq_2d` | Experimental streamfunction-vorticity dynamics scaffold. | Useful and validated as a prototype, but not a final CFD core. |
| `microphysics_lab` | Controlled parcel/box warm-cloud microphysics experiments. | Initial bulk saturation-adjustment mode available; PySDM remains optional evaluation work. |

The shared `sim-frame-v1` frame schema emits row-major 2-D scalar fields with units, field metadata, and display hints. Every frame currently carries:

- grid coordinates in meters
- absolute temperature
- temperature perturbation
- water vapor
- cloud liquid water
- rain water
- horizontal velocity
- vertical velocity

This schema boundary is important. The frontend and renderer should consume physical fields without knowing whether those fields came from a teaching model, Boussinesq dynamics, microphysics evaluation, or a future higher-fidelity core.

## Validation State

The Boussinesq validation suite checks quiet, dry, humid, stable, reproducibility, divergence, thermal-bubble behavior, and fair-weather thermodynamic structure diagnostics.

The current evidence supports using `boussinesq_2d` for controlled visual
experiments, Lower Atmosphere Cloud Basics v1 learning, schema/UI validation,
reference-case regression tests, and targeted dynamics work. The broader
post-#174 lower-atmosphere strategy is defined in
`docs/lower-atmosphere-modeling-strategy.md`; it should guide future
cloud-resolving claims instead of treating the current Boussinesq prototype as
the main science path.

It does not support treating it as a quantitatively credible CFD foundation for advanced microphysics.

The numerical-method contract in `docs/boussinesq-numerical-method.md` sharpens
that boundary after #159: the default single-patch Lower Atmosphere baseline
reaches the theta perturbation cap, and damping/diffusion materially shape cloud
amount, onset timing, updraft strength, and cloud-top height. #160 should treat
that contract as the starting point for deciding whether to keep, refactor, or
replace the current dynamics path.

Known Boussinesq limitations include:

- simple warm-cloud saturation adjustment
- prototype stabilizers and safety caps
- no turbulence closure
- no terrain-following dynamics
- no Coriolis force
- no rain sedimentation
- no ice physics
- no validated pressure-coupled atmospheric dynamics
- remaining cloud-water placement and thermodynamic limitations in some cases

The solver has useful validation scaffolding, but scientific honesty requires keeping that separate from a claim that the dynamics are solved.

## Option Evaluation

### Option A: Improve In-House Boussinesq / Anelastic Dynamics

Improving the current in-house dynamics remains useful when a lab exposes a concrete need: cloud-base behavior, boundary artifacts, terrain forcing, entrainment-like behavior, or cleaner transport.

Pros:

- full control over equations, output fields, and validation cases
- tight integration with current solver API and frontend assumptions
- useful for building intuition and preserving a local-first workflow

Cons:

- significant engineering effort to reach credible atmospheric dynamics
- high risk of reinventing known CFD and numerical-analysis problems
- not sufficient by itself for credible droplet microphysics

Role in the strategy: continue validation-driven dynamics improvements only where they serve labs.

### Option B: Prescribed-Flow + PySDM / Microphysics Lab Mode

A prescribed-flow or parcel/box/column PySDM path lets Cloud Lab evaluate warm-cloud microphysics under controlled conditions before coupling it to live dynamics.

Pros:

- faster path to credible droplet physics
- easier validation against known parcel or box cases
- avoids blaming microphysics for bad velocity fields
- naturally supports droplet-size distribution and rain-initiation visualization

Cons:

- not a complete cloud-evolution model
- prescribed flow can feel less satisfying than a fully coupled cloud simulation
- requires clear UI labeling so users understand what is controlled versus predicted

Role in the strategy: primary path for Warm Rain / Droplet Growth, droplet-size distributions, and later droplet-aware optics.

### Option C: Library-Backed PDE Framework / Dedalus-Style Spike

A PDE framework could eventually provide a more scientifically grounded dynamics path than extending the current prototype by hand. It may be appropriate for an isolated spike once Cloud Lab has clearer lab requirements and local performance budgets.

Pros:

- avoids some custom solver infrastructure
- supports clearer equation-driven experimentation
- could improve scientific credibility for future dynamics cores

Cons:

- integration complexity
- uncertain local Mac performance and packaging experience
- likely heavier than the immediate lab needs
- may force schema, dependency, or workflow churn too early

Role in the strategy: evaluate later, not as the immediate product path.

### Option D: Hybrid Lab-Driven Approach

The hybrid approach keeps existing solvers useful while adding separate physics paths as labs require them. Dynamics, profiles, microphysics, terrain, and rendering can mature independently before coupling.

Pros:

- preserves working API/schema/validation infrastructure
- supports beautiful labs now
- gives PySDM a fair isolated evaluation
- avoids coupling good microphysics to unresolved dynamics
- allows future Boussinesq, anelastic, PDE-framework, or 3-D work without blocking current labs

Cons:

- requires careful naming and UI separation between labs and physics cores
- creates more than one validation track
- delays the emotionally satisfying “full cloud model” milestone

Role in the strategy: recommended path.

## Why PySDM Should Not Be Integrated Into Boussinesq Yet

PySDM can improve droplet physics. It does not fix:

- velocity fields
- boundary conditions
- pressure coupling
- entrainment
- vertical transport
- thermodynamic lifting behavior
- cloud-water placement caused by dynamics or environmental coupling

Directly coupling PySDM to `boussinesq_2d` now would make failures harder to interpret. A bad cloud outcome could come from the velocity field, thermodynamics, microphysics configuration, numerical coupling, visualization, or all of them.

An isolated microphysics path keeps the first question crisp: can Cloud Lab run and explain credible warm-cloud microphysics under controlled motion and thermodynamic histories?

## Proposed Physics-Core Maturation

Physics-core work should mature in this order unless a lab need changes the priority:

1. Keep existing cores stable behind the shared frame contract.
2. Build Workbench V2 around labs rather than solver modes.
3. Use Boussinesq for Lower Atmosphere Cloud Basics while validating lab-specific behavior.
4. Add boundary-layer/profile evolution as the next major bridge toward realistic cloud variety.
5. Use `microphysics_lab` for controlled Warm Rain / Droplet Growth experiments.
6. Evaluate PySDM in isolation and map outputs into `docs/microphysics-schema.md`.
7. Add terrain/orographic physics only with companion validation.
8. Couple dynamics and microphysics only when a lab requires it and each side is separately credible.
9. Consider PDE-framework or true 3-D spikes only after the lab framework, schemas, validation, and performance needs are clear.

## Success Criteria For Future Physics Cores

A future higher-fidelity physics core should support:

- a named lab and physical question
- local Mac execution or a clearly justified compute model
- deterministic or reproducible runs
- stable `SimulationFrame` outputs or a versioned schema extension
- documented units and assumptions
- diagnostics that explain behavior
- visualizations that remain separate from solver logic
- validation cases that fail for meaningful scientific reasons
- clear UI labels for limitations and approximation level

## Risks

| Risk | Why it matters | Guardrail |
| --- | --- | --- |
| Coupling bad dynamics to good microphysics | PySDM results would become hard to interpret. | Isolate PySDM first. |
| Over-investing in custom CFD | Building credible dynamics alone could consume the project. | Keep dynamics work lab-driven and validation-driven. |
| Dependency complexity | PySDM or PDE frameworks may complicate local setup. | Evaluate packaging and Mac performance explicitly. |
| Schema churn | Droplet distributions do not fit the current scalar-field-only contract cleanly. | Extend schema deliberately and preserve old consumers. |
| UI overfitting | Controls could become tied to one solver's internals. | Keep lab/scenario controls separate from solver implementation details. |
| Scientific overclaiming | Visual output may look more authoritative than the model deserves. | Document assumptions and label solver modes, diagnostics, and renderers clearly. |

## Durable Rule

Add physics because it enables a lab, answers a physical question, improves a diagnostic, or prevents misleading output.

Do not add physics merely because it is interesting in isolation.

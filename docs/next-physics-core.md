# Next Physics Core

Cloud Lab should proceed with a hybrid next-core strategy: preserve the existing
solvers, evaluate PySDM in isolation, use a microphysics-lab solver mode for
controlled experiments, and delay full dynamics/microphysics coupling until both
sides are individually credible.

This is the architecture decision that frames the current solver split and the
initial `microphysics_lab` implementation.

## Current State

Cloud Lab currently has three available solver backends behind one shared frame
contract:

| Solver | Role | Current status |
| --- | --- | --- |
| `educational_2d` | Fast teaching, UI, debugging, and regression model. | Complete enough for V1 interaction and schema validation. |
| `boussinesq_2d` | Experimental streamfunction-vorticity dynamics scaffold. | Useful and validated as a prototype, but not a final CFD core. |
| `microphysics_lab` | Controlled parcel/box warm-cloud microphysics experiments. | Initial bulk saturation-adjustment mode available; PySDM remains optional evaluation work. |

The shared `sim-frame-v1` frame schema emits row-major 2-D scalar fields with units,
field metadata, and display hints. Every frame carries:

- grid coordinates in meters
- absolute temperature
- temperature perturbation
- water vapor
- cloud liquid water
- rain water placeholder
- horizontal velocity
- vertical velocity

This schema boundary is important. The frontend and renderer should keep consuming
physical fields without knowing whether those fields came from a teaching model,
Boussinesq dynamics, PySDM evaluation, or a future PDE framework.

## Validation State

The Boussinesq validation suite currently checks quiet, dry, humid, stable,
reproducibility, divergence, and thermal-bubble behavior. The science validation
suite passes with one expected failure: the humid lifted thermal places peak cloud
liquid water below the boundary-layer top.

The current evidence supports using `boussinesq_2d` for controlled visual
experiments, schema/UI validation, reference-case regression tests, and targeted
dynamics work. It does not support treating it as a quantitatively credible CFD
foundation for advanced microphysics.

Known Boussinesq limitations include:

- simple warm-cloud saturation adjustment
- prototype stabilizers and safety caps
- no turbulence closure
- no terrain
- no Coriolis force
- no rain sedimentation
- no ice physics
- no validated pressure-coupled atmospheric dynamics
- a remaining cloud-water placement issue in the humid reference case

The solver has useful validation scaffolding, but scientific honesty requires keeping
that separate from a claim that the dynamics are solved.

## Decision

Cloud Lab should use a hybrid next-core strategy:

1. Keep `educational_2d` as the fast teaching, UI, and debug model.
2. Keep `boussinesq_2d` as an experimental dynamics scaffold and validation
   environment.
3. Evaluate PySDM in isolated parcel, box, column, and prescribed-flow cases first.
4. Do not integrate PySDM directly into `boussinesq_2d` yet.
5. Use `microphysics_lab` as the controlled warm-cloud experiment mode.
6. Revisit Boussinesq/PySDM coupling only after the dynamics and microphysics paths
   are separately credible.

This keeps Cloud Lab moving toward better science without coupling a stronger
microphysics package to unresolved flow and thermodynamic-placement behavior.

## Option Evaluation

### Option A: Improve In-House Boussinesq / Anelastic Dynamics

Improving the current in-house dynamics remains useful for targeted questions:
boundary behavior, pressure/projection handling, thermal-bubble benchmarks,
entrainment-like behavior, and cleaner transport. It also preserves tight integration
with the current architecture and validation suite.

Pros:

- full control over equations, output fields, and validation cases
- tight integration with current solver API and frontend assumptions
- useful for building intuition and preserving a local-first workflow

Cons:

- significant engineering effort to reach credible atmospheric dynamics
- high risk of reinventing known CFD and numerical-analysis problems
- not sufficient by itself for credible droplet microphysics

Role in the strategy: continue validation-driven dynamics improvements, but do not
make `boussinesq_2d` the immediate host for advanced microphysics.

### Option B: Prescribed-Flow + PySDM Lab Mode

A prescribed-flow or parcel/box/column PySDM mode lets Cloud Lab evaluate warm-cloud
microphysics under controlled conditions before coupling it to a live dynamics core.
This is the best next implementation direction because it isolates the question:
can Cloud Lab produce scientifically interpretable droplet, condensation, and
rain-initiation behavior within the local-first architecture?

Pros:

- faster path to credible droplet physics
- easier validation against known parcel or box cases
- avoids blaming microphysics for bad velocity fields
- naturally supports droplet-size distribution and rain-initiation visualization

Cons:

- not a complete cloud-evolution model
- prescribed flow can feel less satisfying than a fully coupled cloud simulation
- requires clear UI labeling so users understand what is controlled versus predicted

Role in the strategy: make this the next microphysics implementation target.

### Option C: Library-Backed PDE Framework / Dedalus-Style Spike

A PDE framework could eventually provide a more scientifically grounded dynamics path
than extending the current prototype by hand. It may be appropriate for an isolated
spike after Cloud Lab has clearer microphysics-lab requirements and a stronger sense
of local performance budgets.

Pros:

- avoids some custom solver infrastructure
- supports clearer equation-driven experimentation
- could improve scientific credibility for future dynamics cores

Cons:

- integration complexity
- uncertain local Mac performance and packaging experience
- likely heavier than the immediate PySDM evaluation need
- may force schema, dependency, or workflow churn too early

Role in the strategy: evaluate later, not as the immediate next core.

### Option D: Hybrid Approach

The hybrid approach keeps the existing solvers useful while adding a separate
microphysics path. Dynamics and microphysics can mature independently before coupling.

Pros:

- preserves working UI, schema, and validation infrastructure
- gives PySDM a fair isolated evaluation
- avoids coupling good microphysics to unresolved dynamics
- allows future Boussinesq, anelastic, or PDE-framework work without blocking
  microphysics exploration

Cons:

- requires careful naming and UI separation between solver modes
- creates more than one validation track
- delays the emotionally satisfying "full cloud model" milestone

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

Directly coupling PySDM to `boussinesq_2d` now would make failures harder to
interpret. A bad cloud outcome could come from the velocity field, thermodynamics,
microphysics configuration, numerical coupling, visualization, or all of them.

An isolated PySDM path keeps the first question crisp: can Cloud Lab run and explain
credible warm-cloud microphysics under controlled motion and thermodynamic histories?

## Proposed Implementation Sequence

1. Keep this design document as the current architecture decision.
2. Use `docs/pysdm-evaluation.md` as the current isolated PySDM evaluation record.
3. Expand `microphysics_lab` from its initial parcel/box bulk mode toward column and
   prescribed-flow experiments.
4. Implement the optional microphysics payload proposed in
   `docs/microphysics-schema.md` without breaking existing scalar-field consumers.
5. Compare Cloud Lab's simple saturation adjustment against PySDM under controlled
   conditions.
6. Add validation cases for parcel ascent, condensation onset, droplet growth, and
   rain-initiation thresholds as the PySDM path matures.
7. Decide later whether PySDM should couple to `boussinesq_2d`, an improved in-house
   dynamics core, or a library-backed PDE dynamics path.
8. Consider a later Dedalus/PDE-framework spike once local performance, packaging,
   and schema needs are better understood.

## Success Criteria For The Next Core

The next credible physics core should support:

- local Mac execution without paid cloud compute
- deterministic or reproducible runs
- stable `SimulationFrame` outputs
- documented units and assumptions
- scientific views that remain separate from rendering choices
- microphysics outputs that are interpretable without hidden visualization tricks
- validation cases that fail for meaningful scientific reasons
- frontend controls that describe scenarios rather than solver internals

For `microphysics_lab`, success means a user can run controlled warm-cloud experiments
and inspect vapor, liquid water, rain-relevant quantities, and droplet-size behavior
without implying that Cloud Lab has solved full cloud dynamics.

## Risks

| Risk | Why it matters | Guardrail |
| --- | --- | --- |
| Coupling bad dynamics to good microphysics | PySDM results would become hard to interpret. | Isolate PySDM first. |
| Over-investing in custom CFD | Building credible dynamics alone could consume the project. | Keep Boussinesq work validation-driven. |
| Dependency complexity | PySDM or PDE frameworks may complicate local setup. | Evaluate packaging and Mac performance explicitly. |
| Schema churn | Droplet distributions do not fit the current scalar-field-only contract cleanly. | Extend schema deliberately and preserve old consumers. |
| UI overfitting | Controls could become tied to one solver's internals. | Keep scenario controls separate from solver implementation details. |
| Scientific overclaiming | Visual output may look more authoritative than the model deserves. | Document assumptions and label solver modes clearly. |

## Follow-On Issues

Create or update implementation issues for:

- PySDM isolated parcel/box evaluation.
- Continued `microphysics_lab` parcel/box/column validation and PySDM comparison work.
- Frame/schema implementation for the droplet-size distribution proposal in
  `docs/microphysics-schema.md`.
- Microphysics validation cases for parcel ascent and condensation onset.
- Comparison of simple saturation adjustment versus PySDM in controlled conditions.
- UI labels and controls that distinguish educational, Boussinesq, and microphysics
  lab modes.
- Later PDE-framework spike, including local performance and packaging audit.

## Impact Audit

Solver architecture: keep the backend registry pattern and add solver modes without
collapsing them into one "real" solver prematurely.

Frontend assumptions: preserve the existing scalar frame fields while preparing for
optional richer microphysics outputs.

Performance: require local Mac performance checks before adopting heavy PDE or
microphysics dependencies as default workflows.

Microphysics integration: evaluate PySDM independently before coupling it to live
dynamics.

Visualization pipeline: continue rendering physical fields and avoid solver-specific
visual shortcuts.

Validation strategy: maintain separate validation tracks for educational behavior,
Boussinesq dynamics, and microphysics-lab physics.

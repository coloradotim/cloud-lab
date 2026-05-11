# Cloud Lab — Agent Context

## Product Direction

Cloud Lab helps users explore atmospheric physics through beautiful, interactive cloud experiments grounded in real physical principles.

Short phrase:

> Beautiful cloud experiments. Real atmospheric physics.

Cloud Lab is not primarily a solver demo, diagnostics dashboard, or rendering toy. It is a lab-driven cloud physics platform. The product should help users create physically meaningful cloud experiments, watch beautiful cloud behavior evolve, inspect why it happened, save or compare runs, and learn real atmospheric physics.

The current backend, solvers, validation tools, and frontend components are useful project assets. The current frontend layout should be treated as a prototype that proved capabilities, not as the final product architecture.

## Current North Star

Build Cloud Lab as a collection of guided phenomenon labs:

1. Fair-Weather Cumulus
2. Evolving Boundary Layer
3. Layered Atmosphere
4. Orographic / Terrain Clouds
5. Warm Rain / Droplet Growth
6. Cloud Optics / Beauty
7. Fog / Stratus
8. Mixed-Phase / Ice later

Each lab should define:

- the physical question being explored
- user controls that matter
- expected behavior
- diagnostics that explain the result
- visualization modes
- limitations and approximation labels
- future upgrade path

Do not organize new product work around solver modes or accumulated panels. Solvers support labs; they do not define the product.

## Required Reading For Agents

Before substantial product, UI, simulation, or roadmap work, read:

- `docs/product-vision.md`
- `docs/lab-roadmap.md`
- `docs/workbench-v2-product-spec.md`
- `docs/workbench-v2-architecture.md`
- `docs/architecture-decisions/ADR-001-lab-driven-product.md`
- the issue being implemented

For physics, validation, or scenario work, also read:

- `docs/scientific-roadmap.md`
- `docs/testing-and-validation.md`
- the relevant solver/lab docs

## Product Architecture Rule

The durable architecture is:

```text
Lab definition
  ↓
Scenario definition
  ↓
Initial state + forcing definition
  ↓
Physics core selection
  ↓
Frame/output schema
  ↓
Diagnostics
  ↓
Visualization/rendering
```

The durable implementation rule is:

> Solver outputs physical fields. Renderer turns fields into views. UI controls experiments. Diagnostics explain behavior. Documentation explains assumptions. Tests protect the science.

## Build Philosophy

Build a beautiful and usable product without making the science disposable.

- Prefer lab-driven clarity over maximum code reuse.
- Reuse existing code only when it fits the lab-driven architecture cleanly.
- Do not let current frontend structure dictate future product direction.
- Keep simulation code separated from rendering, UI, and API code.
- Keep physics and numerics documented as they are added.
- Prefer small, reviewable pull requests when possible.
- Add tests or validation notes with every meaningful simulation change.
- Keep the local Mac developer workflow simple.
- Avoid premature complexity, but do not skip foundations like tests, CI, docs, reproducibility, and versioned contracts.
- Favor clear, inspectable implementation over cleverness.

## Current Product Priority

The top product priority is Workbench V2: a clean, lab-driven UI that supports:

```text
Choose lab → choose scenario → adjust physical controls → run → watch → inspect → save/compare → vary → learn
```

Workbench V2 should feel like a focused cloud experiment workbench, not a long dashboard of panels.

Do not add major new product features to the old dashboard structure unless the user explicitly asks for that. New UI work should move toward the Workbench V2 product spec.

## Lab-Driven Development Rule

Every new product/science feature should answer these questions in the issue or PR:

1. What lab does this serve?
2. What physical question does it help answer?
3. What user control, diagnostic, or visual payoff does it enable?
4. What fields or frame-schema concepts does it consume or emit?
5. What validation or diagnostic protects it?
6. What assumptions or limitations must the UI disclose?

If those questions cannot be answered, the feature is probably premature or belongs in the roadmap rather than implementation.

## Architecture Rules

- The simulation core must not depend on frontend code.
- The simulation core should be usable independently from the browser UI.
- API/backend code should wrap the simulation core; it should not contain core physics logic.
- Visualization code should consume simulation outputs; it should not change simulation state except through explicit controls/configuration.
- Diagnostics should explain solver outputs; they should not be buried inside renderers.
- Prefer plain, versioned data structures for simulation configuration, frame output, labs, scenarios, diagnostics, and saved artifacts.
- Keep output schemas stable and documented.
- Scientific views and pretty views must be decoupled.
- Avoid burying solver state in UI components or API route handlers.
- Future serious physics cores should plug into the lab/scenario/frame/diagnostic pipeline rather than becoming the UI architecture.

## Scientific Modeling Rules

- Every modeled field must have documented units.
- Do not introduce magic constants without naming and documenting them.
- Document numerical assumptions, simplifications, and known limitations.
- Start with simplified dynamics and warm-cloud processes where useful, but keep extension points clean for better dynamics, microphysics, terrain, ice, optics, and future higher-fidelity models.
- Make simulation runs reproducible when seeded.
- Save and version simulation configuration formats when they become user-facing.
- Distinguish clearly between physically meaningful outputs, derived diagnostics, prescribed forcing, bulk approximations, visual approximations, and experimental results.
- Cloud appearance views should identify when they are illustrative or approximate rather than physically rendered radiative transfer.

## Testing And Validation Rules

- New backend/simulation code should include automated tests when practical.
- New physics behavior should include unit tests, numerical sanity checks, validation notes, or a deliberately scoped explanation of why automated validation is deferred.
- Tests should cover invariants such as shape consistency, units expectations, deterministic seeded output, non-negative moisture fields, and stable frame schemas.
- Physics and scenario test failures must be classified before assertions are changed. Decide whether the failing check is a contract test, numerical sanity test, physics relationship test, lab/scenario contract test, diagnostic/warning, or obsolete legacy expectation.
- Run targeted checks appropriate to the files changed. Full local validation is not required for every PR and should be reserved for solver-wide, release/checkpoint, high-risk, or user-requested validation work.
- Do not merge work that breaks CI.
- Do not bypass failing tests or builds.

## Documentation Rules

Keep documentation current as the project evolves.

Required strategic docs:

- `README.md` for setup and project overview.
- `docs/product-vision.md` for product identity and north star.
- `docs/lab-roadmap.md` for the lab-driven product roadmap.
- `docs/workbench-v2-product-spec.md` for the clean-slate product shell.
- `docs/workbench-v2-architecture.md` for frontend/product architecture.
- `docs/architecture-decisions/ADR-001-lab-driven-product.md` for the lab-driven architecture decision.
- `docs/scientific-roadmap.md` for physics maturity and validation direction.
- `docs/testing-and-validation.md` for test categories, validation tiers, and physics/scenario expectation policy.
- `AGENTS.md` for durable instructions to coding agents.

When adding a meaningful feature, update the relevant docs in the same PR. If docs or tests are not updated, explain why in the PR.

## Standard Issue Workflow

When the user asks to work an issue, treat that as instruction to implement the GitHub issue using the standard workflow:

1. Read `AGENTS.md` and the issue.
2. Check whether the issue is consistent with the lab-driven product direction. If not, stop and report the conflict.
3. Check out `main`.
4. Pull latest `origin/main`.
5. Create a feature branch named for the issue, using the `codex/` prefix unless the user requests a different name.
6. Make the requested changes.
7. Consider whether documentation needs to be updated.
8. Consider whether tests need to be updated.
9. Run the documented Tier 1 quick checks plus any Tier 2 targeted checks relevant to the changed files.
10. Run frontend test/lint/build commands when frontend code changed, or when the PR affects shared contracts consumed by the frontend.
11. Commit changes to the feature branch.
12. Push the branch.
13. Open a PR that links the issue.
14. If the repository allows auto-merge, enable auto-merge on the PR.
15. If all required checks pass and branch protection allows it, allow the PR to merge through the protected-branch/auto-merge path.
16. If auto-merge or merge is blocked, report the exact blocker.

Before finishing any change:

- Run the documented quick and targeted checks for the change.
- Reserve full local validation for solver-wide, release/checkpoint, high-risk, or user-requested work.
- Do not change app behavior unless requested or clearly required by the issue.
- Prefer small PRs unless the issue explicitly calls for a coordinated refactor.
- Preserve existing tests unless they are explicitly obsolete under the documented product/science contract.
- Add or update tests for simulation logic and regression-prone behavior.
- If the PR cannot be merged or auto-merged, clearly report the blocker.

## Issue And PR Completeness Standard

For every product, UX, feature, simulation, data, or workflow change, consider downstream impact across:

- lab roadmap
- scenario/lab definitions
- local setup
- backend API
- simulation core
- output schemas and units
- frontend visualization
- saved run/config formats
- documentation
- tests and validation notes
- CI/build behavior
- dependencies
- performance on a local Mac
- accessibility and basic usability
- future 2.5-D/3-D extensibility

If an area is affected, update it in the same PR unless the issue explicitly says otherwise. If an area is not affected, note that briefly in the PR summary. Do not leave obvious rollout items as implicit follow-ups.

## CI And Workflow Rules

- CI should run on pushes and pull requests to `main`.
- PR CI should run fast backend tests, backend lint/formatting/type checks, frontend tests, frontend build, and frontend lint where configured.
- Slower science validation should be grouped separately and run manually or on a schedule unless a PR explicitly needs it.
- Prefer small branches with descriptive names.
- PR descriptions should include what changed, which validation tier was run, and any scientific/numerical assumptions introduced.

## Visualization Rules

- Visualization is a core product pillar, not decoration.
- Scientific views should show fields and diagnostics truthfully.
- Cloud appearance and 2.5-D views should be beautiful but must label approximations.
- Fancy rendering must not corrupt simulation correctness.
- Rendering layers should be composable and independent of solver internals.
- Use scientific overlays to explain what is happening: velocity, vapor, cloud water, rain water, buoyancy, condensation/evaporation, droplet-size distribution, LCL, mixed-layer depth, and terrain/lift markers as relevant.

## Guardrails

- Do not commit directly to `main`.
- Do not commit secrets.
- Do not bypass failing tests or builds.
- Do not bypass branch protection or required checks.
- Do not force-merge blocked PRs.
- Do not add heavy dependencies without explaining why they are needed.
- Do not bury core physics inside React components or API route handlers.
- Do not hardcode visualization assumptions into the solver.
- Do not add unexplained constants or undocumented unit conversions.
- Do not optimize prematurely before correctness and structure are clear.
- Do not let notebooks become the only source of truth for production simulation behavior.
- Do not preserve old frontend/dashboard patterns merely for code reuse if they conflict with Workbench V2.

## Important Files

Strategic direction:

- `docs/product-vision.md`
- `docs/lab-roadmap.md`
- `docs/workbench-v2-product-spec.md`
- `docs/workbench-v2-architecture.md`
- `docs/architecture-decisions/ADR-001-lab-driven-product.md`
- `docs/scientific-roadmap.md`
- `docs/testing-and-validation.md`

Backend and simulation:

- `backend/app/main.py`
- `backend/app/sim/`
- `backend/app/sim/schemas.py`
- `backend/app/sim/solver.py`
- `backend/app/sim/solver_interface.py`
- `backend/app/api/`
- `backend/app/sim/runs.py`
- `backend/app/sim/streaming.py`
- `backend/tests/`

Frontend prototype/current implementation:

- `frontend/src/`
- `frontend/src/App.tsx`
- `frontend/src/ScientificDashboard.tsx`
- `frontend/src/simulationControls.ts`
- `frontend/src/visualization.ts`

Workbench V2 should introduce clearer lab/workbench/frontend boundaries as described in `docs/workbench-v2-architecture.md`.

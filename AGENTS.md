# Cloud Lab — Agent Context

## Product

Cloud Lab is a local browser-based cloud physics sandbox for exploring cloud formation, warm-cloud microphysics, surface heating, terrain forcing, and real-time scientific visualization.

The app should be fun and visually engaging, but the engineering and scientific modeling should be disciplined. Do not treat this as a throwaway toy app.

The first milestone is a local browser app where a user can select a fair-weather cumulus preset, adjust simple heating/humidity/lapse-rate parameters, run a 2-D vertical slice simulation, and watch cloud-relevant fields evolve in real time.

## Build philosophy

Build right from the start:

- Keep simulation code separated from rendering, UI, and API code.
- Keep physics and numerics documented as they are added.
- Prefer small, reviewable pull requests.
- Add tests or validation notes with every meaningful simulation change.
- Keep the local Mac developer workflow simple.
- Avoid premature complexity, but do not skip foundations like tests, CI, docs, and reproducibility.
- Favor clear, inspectable implementation over cleverness.

## Near-term scope

Initial priority order:

1. Repo scaffold, docs, tests, and CI.
2. Minimal 2-D vertical-slice simulation core.
3. Fair-weather cumulus preset.
4. Live frame streaming to browser.
5. Basic visualizations for velocity, vapor, cloud water, rain water, and droplet-size distribution.
6. Field probe mode.
7. Painted surface heating.
8. Orographic lift prototype.
9. PySDM evaluation for warm-cloud microphysics.
10. 2.5-D and later 3-D expansion.

## Architecture rules

- The simulation core must not depend on frontend code.
- The simulation core should be usable independently from the browser UI.
- API/backend code should wrap the simulation core; it should not contain core physics logic.
- Visualization code should consume simulation outputs; it should not change simulation state except through explicit controls/configuration.
- Prefer plain data structures for simulation configuration and frame output.
- Keep output schemas stable and documented.
- Scientific views and pretty views should be decoupled.
- Avoid burying solver state in UI components or API route handlers.

## Scientific modeling rules

- Every modeled field must have documented units.
- Do not introduce magic constants without naming and documenting them.
- Document numerical assumptions, simplifications, and known limitations.
- Start with simple dynamics and warm-cloud processes, but leave clean extension points for more advanced fluid dynamics and microphysics.
- Make simulation runs reproducible when seeded.
- Save and version simulation configuration formats when they become user-facing.
- Distinguish clearly between physically meaningful outputs and visual/educational approximations.
- Cloud appearance views should identify when they are illustrative rather than physically rendered radiative transfer.

## Testing and validation rules

- New backend/simulation code should include automated tests when practical.
- New physics behavior should include either:
  - unit tests,
  - numerical sanity checks,
  - validation notes in docs, or
  - a deliberately scoped explanation of why automated validation is deferred.
- Tests should cover invariants such as shape consistency, units expectations, deterministic seeded output, non-negative moisture fields, and stable frame schemas.
- Physics and scenario test failures must be classified before assertions are changed. Decide whether the failing check is a contract test, numerical sanity test, physics relationship test, scenario contract test, diagnostic/warning, or obsolete legacy expectation, then either fix the implementation, update the expectation, reframe the scenario, convert the check to a warning, move it to validation, or delete it only if truly obsolete.
- Run targeted checks appropriate to the files changed. Full local validation is not required for every PR and should be reserved for solver-wide, release/checkpoint, high-risk, or user-requested validation work.
- Do not merge work that breaks CI.
- Do not bypass failing tests or builds.

## Documentation rules

Keep documentation current as the project evolves.

Required docs should include:

- `README.md` for setup and project overview.
- `docs/architecture.md` for system structure and boundaries.
- `docs/scientific-roadmap.md` for physics scope and level-up path.
- `docs/development.md` for workflow, testing, validation, and contribution norms.
- `docs/testing-and-validation.md` for test categories, validation tiers, and physics/scenario expectation policy.
- `AGENTS.md` for durable instructions to coding agents.

When adding a meaningful feature, update the relevant docs in the same PR.

Every PR should explicitly consider docs and tests. Update docs when a change affects setup, workflow, app behavior, simulation configuration, output schemas, validation expectations, CI, dependencies, or major user flows. Update tests when a change affects simulation logic, data flow, API behavior, visualization state transitions, saved config handling, or regression-prone bugs. If docs or tests are not updated, explain why in the PR.

## Standard issue workflow

When the user asks to work an issue, treat that as instruction to implement the GitHub issue using the standard workflow:

1. Read `AGENTS.md`.
2. Check out `main`.
3. Pull latest `origin/main`.
4. Create a feature branch named for the issue, using the `codex/` prefix unless the user requests a different name.
5. Make the requested changes.
6. Consider whether documentation needs to be updated.
7. Consider whether tests need to be updated.
8. Run the documented Tier 1 quick checks plus any Tier 2 targeted checks relevant to the changed files.
9. Run frontend test/lint/build commands when frontend code changed, or when the PR affects shared contracts consumed by the frontend.
10. Commit changes to the feature branch.
11. Push the branch.
12. Open a PR that links the issue.
13. If the repository allows auto-merge, enable auto-merge on the PR.
14. If all required checks pass and branch protection allows it, allow the PR to merge through the protected-branch/auto-merge path.
15. If auto-merge or merge is blocked, report the exact blocker, such as a failing check, pending required check, branch protection rule, merge conflict, review requirement, or permissions issue.

Before finishing any change:

- Run the documented quick and targeted checks for the change.
- Reserve full local validation for solver-wide, release/checkpoint, high-risk, or user-requested work.
- Do not change app behavior unless requested or clearly required by the issue.
- Prefer small PRs.
- Preserve existing tests.
- Add or update tests for simulation logic and regression-prone behavior.
- If the PR cannot be merged or auto-merged, clearly report the blocker.

## Issue and PR completeness standard

For every product, UX, feature, simulation, data, or workflow change, consider downstream impact across:

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

When creating or refining issues, include an impact audit section when the change is more than a tiny bug fix. The issue should tell the implementer what needs to be inspected across docs, tests, simulation assumptions, output schemas, visualization, CI/build behavior, dependencies, and local developer workflow.

## CI and workflow rules

- CI should run on pushes and pull requests to `main`.
- PR CI should run fast backend tests, backend lint/formatting/type checks, frontend tests, frontend build, and frontend lint where configured.
- Slower science validation should be grouped separately and run manually or on a schedule unless a PR explicitly needs it.
- Prefer small branches with descriptive names.
- PR descriptions should include what changed, which validation tier was run, and any scientific/numerical assumptions introduced.

## Visualization rules

- The first visualization priority is real-time interpretability, not cinematic rendering.
- Fancy rendering should be added later without compromising simulation correctness.
- Visualization layers should be composable, not hardcoded directly into the solver.
- Use scientific overlays to explain what is happening: velocity, vapor, cloud water, rain water, buoyancy, condensation/evaporation, and droplet-size distribution.

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

## Important files

This list should be updated as the repo grows.

Expected early files:

- `backend/app/main.py`: FastAPI app entry point.
- `backend/app/sim/`: simulation core package.
- `backend/app/sim/schemas.py`: simulation configuration, frame, field, and units schemas.
- `backend/app/sim/sample.py`: deterministic sample frame generation for schema and frontend checks.
- `backend/app/sim/presets.py`: named reproducible simulation presets.
- `backend/app/sim/solver.py`: minimal 2-D vertical-slice atmosphere solver.
- `backend/app/api/`: API routes and WebSocket handlers.
- `backend/app/sim/runs.py`: local simulation run lifecycle and cancellation state.
- `backend/app/sim/streaming.py`: WebSocket-neutral frame streaming generator.
- `backend/tests/`: backend and simulation tests.
- `scripts/dev.sh`: local helper for starting, stopping, checking, and tailing backend/frontend dev servers.
- `frontend/src/`: browser UI and visualization code.
- `frontend/src/ScientificDashboard.tsx`: canvas-based scientific field dashboard.
- `frontend/src/simulationControls.ts`: frontend config normalization and control guidance helpers.
- `frontend/src/visualization.ts`: pure visualization helper functions and field metadata mapping.
- `docs/architecture.md`: app architecture and boundaries.
- `docs/simulation-data-model.md`: config, frame, field, units, and serialization contract.
- `docs/minimal-solver.md`: governing assumptions, numerical approach, validation notes, and limitations for the first solver.
- `docs/simulation-controls.md`: preset philosophy, user-facing parameters, expected effects, and limitations.
- `docs/live-streaming.md`: run lifecycle, WebSocket message contract, cancellation behavior, and scaling notes.
- `docs/visualization-dashboard.md`: rendering architecture, field display approach, limitations, and level-up path.
- `docs/testing-and-validation.md`: testing taxonomy, validation tiers, scenario contracts, and expectation-update policy.
- `docs/scientific-roadmap.md`: physics scope and level-up path.
- `docs/development.md`: development workflow, tests, and validation expectations.

# Development

Cloud Lab should stay easy to run locally while keeping product, simulation, visualization, and validation work reviewable, tested, and documented.

## Product Direction For Development

Cloud Lab is a lab-driven cloud physics product.

Tagline:

> Cloud Lab helps users explore atmospheric physics through beautiful, interactive cloud experiments grounded in real physical principles.

Short phrase:

> Beautiful cloud experiments. Real atmospheric physics.

Developers and agents should treat the current frontend as a working prototype that proved capabilities. Future product work should move toward Workbench V2 and the lab-driven architecture described in:

- `docs/product-vision.md`
- `docs/lab-roadmap.md`
- `docs/workbench-v2-product-spec.md`
- `docs/workbench-v2-architecture.md`
- `docs/architecture-decisions/ADR-001-lab-driven-product.md`

## Lab-Driven Development Rule

Before implementing a product or science feature, identify:

1. What lab does this serve?
2. What physical question does it help answer?
3. What user control, diagnostic, or visual payoff does it enable?
4. What fields or frame-schema concepts does it consume or emit?
5. What validation or diagnostic protects it?
6. What limitations or approximations must be disclosed?

If the answer is unclear, update the lab roadmap or product docs before writing code.

## Branch And PR Workflow

- Start new work from the latest `main`.
- Use a short feature branch, preferably with a `codex/` prefix for agent-authored work.
- Keep pull requests focused and reviewable.
- Link the issue in the PR description.
- Include what changed, how it was tested, and any product/scientific/numerical assumptions introduced.
- Explain which lab or Workbench V2 workflow the change supports.

Do not commit directly to `main`.

## Backend Workflow

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e ".[dev]"
ruff format --check .
ruff check .
mypy app tests
```

Run the API locally:

```bash
uvicorn app.main:app --reload
```

## Frontend Workflow

```bash
cd frontend
npm install
npm run dev
npm run lint
npm run build
```

Frontend work should avoid preserving old dashboard structure merely for code reuse. Reuse components when they fit the lab-driven Workbench V2 architecture. Replace or bypass them when they keep the product organized around accumulated panels instead of labs.

## Testing Expectations

Backend tests should cover API contracts, simulation schemas, deterministic behavior, numerical invariants, and lab/scenario expectations as physics code is added.

Frontend checks should cover linting, builds, component behavior, and product-flow state transitions. Workbench V2 tests should focus on lab selection, scenario setup, run lifecycle, visualization mode selection, inspector behavior, saved-run workflow, and comparison workflow.

CI should pass before a PR is merged. Do not bypass failing tests, lint checks, type checks, or builds.

Use the [testing and validation plan](testing-and-validation.md) as the governing plan for model-development tests. It defines contract tests, numerical sanity tests, physics relationship tests, lab/scenario contract tests, reference validation, diagnostic warnings, and the rules for updating expectations when model assumptions change.

CI uses path-aware quick jobs so every PR does not pay for every subsystem:

- Frontend-only PRs run `Frontend quick` plus the lightweight `CI required` summary.
- Backend/API/schema PRs run `Backend quick` plus `CI required`.
- Lab/scenario metadata PRs run the quick checks for the touched frontend or
  backend contract surface; targeted solver/science runs only when solver
  behavior, diagnostics, or validation expectations changed.
- Solver/science/validation PRs run `Backend quick`, `Targeted solver/science`, and `CI required`.
- Docs-only PRs may run only `CI required` unless they touch workflow files or code.
- Pushes to `main`, scheduled runs, and manual workflow dispatches run the full quick set; scheduled/manual runs also run science validation.

The stable check for branch protection should be `CI required`. The purpose-specific jobs are still visible so reviewers can see which path actually ran.

## Validation Tiers

Use the lightest tier that honestly covers the change. Every PR description should say which tier ran and why.

### Tier 1: Quick Local Checks

Default before most PRs. Target runtime is roughly under 1-2 minutes locally.

For UI-only changes:

```bash
cd frontend
npm run lint
npm run test
npm run build
```

For backend/API/schema changes:

```bash
cd backend
pytest -m "not slow and not science and not validation and not pysdm"
ruff format --check .
ruff check .
mypy app tests
```

Do not run backend checks for UI-only changes unless the PR also touches backend code, API/schema/shared contracts, CI workflow behavior, or scripts that affect backend execution.

Boussinesq thermodynamic diagnostics are fast but science-sensitive. They are
marked for targeted solver/science, not generic backend quick.

### Tier 2: Targeted Validation

Run when the PR touches a specific subsystem.

```bash
# Backend lab/preset contract checks
cd backend
pytest -m "lab and not slow and not science and not validation and not pysdm"

# Boussinesq smoke and short checks
cd backend
pytest -m "boussinesq and not slow"

# Boussinesq diagnostics without slow reference validation
cd backend
pytest -m "diagnostic and boussinesq and not slow"

# Microphysics smoke and validation checks
cd backend
pytest -m "microphysics and not slow"

# Boussinesq reference validation checks
cd backend
pytest -m "science and validation"

# Frontend visualization/probe helpers
cd frontend
npm run test -- visualization.test.ts probe.test.ts
```

Use focused file or marker selections for API, streaming, preset, or schema changes.

### Tier 3: Full Local Validation

Run full local validation for solver-wide changes, release/checkpoint work, CI outages, broad multi-subsystem changes, suspicious targeted failures, or explicit user requests.

```bash
cd backend
pytest
ruff format --check .
ruff check .
mypy app tests

cd ../frontend
npm run lint
npm run test
npm run build
```

### Tier 4: Heavy Science Validation

Longer Boussinesq reference cases, future CFD benchmarks, future PySDM-heavy checks, and larger model-size sweeps should run manually, on a schedule, or before science checkpoints. They should not block routine UI/docs/config PRs unless the PR directly changes the solver behavior under validation.

Optional PySDM evaluation checks require the heavy optional dependency group:

```bash
cd backend
python -m pip install -e ".[pysdm-eval]"
pytest -m pysdm
python -m app.sim.pysdm_evaluation --json
```

## PR Verification Summaries

Every PR should say which path ran and why. Examples:

```text
Verification:
- Frontend quick checks: passed (`npm run lint`, `npm run test`, `npm run build`)
- Backend checks: not run; PR changes are UI-only and do not touch API/schema/shared contracts
- Full validation: not run; not required for scoped UI change
```

```text
Verification:
- Backend quick checks: passed (`pytest -m "not slow and not science and not validation and not pysdm"`, ruff, mypy)
- Targeted Boussinesq checks: passed (`pytest -m "boussinesq and not slow"`)
- Frontend checks: not run; no frontend or shared contract changes
- Full validation: not run; scheduled/manual validation unchanged
```

## Adding Simulation Features Responsibly

New simulation features should keep physics code inside `backend/app/sim` or a clearly separated simulation package. API route handlers can validate inputs and orchestrate runs, but they should not contain core physics rules.

When adding a modeled field:

- Document units.
- Document shape and coordinate assumptions.
- Name constants and explain their meaning.
- Keep output schemas stable or document intentional schema changes.
- Update tests for invariants and expected behavior.
- Add or update sample frame serialization when frontend visualization needs the field.
- Explain which lab the field enables.

## Physics Validation Rule

New physics code must include automated tests or validation notes. Tests are preferred for deterministic behavior, field shapes, units expectations, non-negative moisture fields, stable frame schemas, and lab/scenario expectations.

When physics or scenario tests fail, classify the failure before changing assertions. Decide whether the test is a contract check, numerical sanity check, physics relationship, lab/scenario contract, diagnostic warning, or obsolete legacy expectation. Then choose whether to fix the implementation, update the expectation, reframe the scenario/lab, convert to a warning, or move the check into a validation suite.

For solver changes, update the relevant solver or validation docs when assumptions, equations, stability behavior, constants, validation checks, or known limitations change.

For streaming changes, update `docs/live-streaming.md` when run lifecycle, message types, cancellation behavior, frame cadence, or scaling assumptions change.

For visualization changes, update `docs/visualization-and-workbench-views.md` when field rendering, frame buffering, workbench visualization behavior, accessibility, approximation labels, or performance assumptions change.

For lab/product changes, update `docs/lab-roadmap.md`, `docs/workbench-v2-product-spec.md`, or `docs/product-vision.md` as appropriate.

## Required PR Checklist For Product/Science Changes

For product, UX, solver, scenario, visualization, or validation changes, include:

```text
Lab/product impact:
- Lab served:
- Physical question supported:
- User control / diagnostic / visual payoff:
- Approximation or limitation disclosed:
```

For solver/science changes, also include:

```text
Scientific/product behavior changes:
- default solver changed? yes/no
- public solver list changed? yes/no
- scenario/lab behavior changed? yes/no
- physics assumptions changed? yes/no
- docs updated? yes/no
```

And:

```text
Test expectation changes:
- Which old expectations changed?
- Why are they obsolete or still valid?
- Which tests were rewritten?
- Which diagnostics became warnings?
- Which lab/scenario contracts are now protected?
```

## Maintenance Notes

This document is part of the product/science contract. Update it when Cloud Lab adds new labs, new physics cores, new public scenarios, new diagnostics, new validation tiers, new Workbench V2 structures, or new rules for hard failures versus warnings.

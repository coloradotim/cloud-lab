# Development

Cloud Lab should stay easy to run locally while keeping simulation work reviewable, tested, and documented.

## Branch And PR Workflow

- Start new work from the latest `main`.
- Use a short feature branch, preferably with a `codex/` prefix for agent-authored work.
- Keep pull requests focused and reviewable.
- Link the issue in the PR description.
- Include what changed, how it was tested, and any scientific or numerical assumptions introduced.

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

## Testing Expectations

Backend tests should cover API contracts, simulation schemas, deterministic behavior, and numerical invariants as physics code is added. Frontend checks should cover linting and production builds from the start; browser-level or component tests can be added when UI behavior becomes more complex.

CI should pass before a PR is merged. Do not bypass failing tests, lint checks, type checks, or builds.

## Validation Tiers

Use the lightest tier that honestly covers the change. Every PR description should
say which tier ran and why.

### Tier 1: Quick Local Checks

Default before most PRs. Target runtime is roughly under 1-2 minutes locally.

```bash
cd backend
pytest -m "not slow and not science"
ruff format --check .
ruff check .
mypy app tests
```

For frontend changes, also run:

```bash
cd frontend
npm run lint
npm run test
npm run build
```

### Tier 2: Targeted Validation

Run when the PR touches a specific subsystem.

```bash
# Boussinesq smoke and short benchmark checks
cd backend
pytest -m "boussinesq and not slow"

# Boussinesq reference validation checks
cd backend
pytest -m "science and validation"

# Frontend visualization/probe helpers
cd frontend
npm run test -- visualization.test.ts probe.test.ts
```

Use focused file or marker selections for API, streaming, preset, or schema changes.

### Tier 3: Full Local Validation

Run full local validation for solver-wide changes, release/checkpoint work, CI
outages, broad multi-subsystem changes, suspicious targeted failures, or explicit
user requests.

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

Longer Boussinesq reference cases, future CFD benchmarks, future PySDM-heavy checks,
and larger model-size sweeps should run manually, on a schedule, or before science
checkpoints. They should not block routine UI/docs/config PRs unless the PR directly
changes the solver behavior under validation.

GitHub Actions runs the fast backend/frontend jobs on pushes and PRs. The backend
PR job runs both the default fast subset and the short Boussinesq sanity subset. The
`Science validation` job is manual/scheduled and runs the slower Boussinesq validation
markers.

Optional PySDM evaluation checks require the heavy optional dependency group:

```bash
cd backend
python -m pip install -e ".[pysdm-eval]"
pytest -m pysdm
python -m app.sim.pysdm_evaluation --json
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

## Physics Validation Rule

New physics code must include automated tests or validation notes. Tests are preferred for deterministic behavior, field shapes, units expectations, non-negative moisture fields, and stable frame schemas. If automated validation is deferred, the PR must explain why and include enough notes for the next implementation step.

For solver changes, update `docs/minimal-solver.md` when assumptions, equations, stability behavior, constants, validation checks, or known limitations change.

For streaming changes, update `docs/live-streaming.md` when run lifecycle, message types, cancellation behavior, frame cadence, or scaling assumptions change.

For visualization changes, update `docs/visualization-dashboard.md` when field rendering, frame buffering, canvas behavior, accessibility, or performance assumptions change.

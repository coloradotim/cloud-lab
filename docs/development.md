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
pytest
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

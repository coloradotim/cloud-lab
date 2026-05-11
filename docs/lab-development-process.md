# Lab Development Process

Cloud Lab is built lab by lab.

A lab is a guided experiment space that helps users explore one atmospheric physics question through meaningful controls, visible behavior, diagnostics, and honest limitations.

This process is mandatory for new labs and major lab upgrades.

## Why This Process Exists

Cloud Lab should not grow by adding isolated features, panels, or solver modes.

It should grow by adding coherent labs:

```text
Lab question → lab spec → review → implementation issues → Codex implementation
```

This keeps the product understandable and prevents the backlog from becoming a feature pile.

## Human / ChatGPT / Codex Split

Lab design is product/science architecture work. Implementation is coding work.

Use this split:

### ChatGPT / human design work

Use ChatGPT and human review for:

- defining the lab's physical question
- deciding what the lab should teach
- deciding which controls belong in the lab
- deciding what is honest to claim
- deciding what physics is needed now vs later
- drafting the dedicated lab spec
- decomposing the lab into implementation issues
- setting acceptance criteria and validation expectations

### Codex implementation work

Use Codex for:

- implementing scoped issues created from approved lab specs
- frontend/backend code changes
- tests
- refactors
- wiring UI to APIs
- updating docs that are directly affected by implementation
- opening PRs and running the documented checks

### Rule

Do not hand a new lab design issue to Codex cold and ask it to decide the lab's product/science direction.

Codex may help edit or implement a lab spec after the direction is clear, but the first real lab spec should be drafted and reviewed through ChatGPT/human product-science discussion.

## Lab Sequence

The current planned lab sequence is:

1. Fair-Weather Cumulus
2. Cloud Optics / Beauty
3. Evolving Boundary Layer
4. Layered Atmosphere
5. Orographic / Terrain Clouds
6. Warm Rain / Droplet Growth
7. Fog / Stratus
8. Mixed-Phase / Ice
9. Future higher-fidelity / hard-core modeling path, once earlier labs define requirements

The sequence may change, but changes should be deliberate and reflected in `docs/lab-roadmap.md`, `docs/current-phase-plan.md`, and this process if needed.

## Required Lab Files

Each lab must have a dedicated spec in `docs/labs/`.

Use these expected filenames unless there is a strong reason not to:

| Lab | Required spec path |
| --- | --- |
| Fair-Weather Cumulus | `docs/labs/fair-weather-cumulus.md` |
| Cloud Optics / Beauty | `docs/labs/cloud-optics-beauty.md` |
| Evolving Boundary Layer | `docs/labs/evolving-boundary-layer.md` |
| Layered Atmosphere | `docs/labs/layered-atmosphere.md` |
| Orographic / Terrain Clouds | `docs/labs/orographic-terrain-clouds.md` |
| Warm Rain / Droplet Growth | `docs/labs/warm-rain-droplet-growth.md` |
| Fog / Stratus | `docs/labs/fog-stratus.md` |
| Mixed-Phase / Ice | `docs/labs/mixed-phase-ice.md` |

## Required Lab Spec Structure

Every lab spec must follow `docs/lab-contract-template.md`.

At minimum, each spec must define:

1. Lab name
2. Physical question
3. User promise
4. Primary concepts
5. Current maturity
6. Primary, secondary, and advanced controls
7. Initial conditions and forcing
8. Expected behavior
9. Failure / no-cloud cases
10. Diagnostics
11. Visualization modes
12. Physics-core requirements
13. Frame / schema requirements
14. Approximation and honesty labels
15. Built-in scenarios
16. Comparison ideas
17. Validation expectations
18. Known limitations
19. Future upgrades
20. Documentation checklist

Do not skip sections because implementation is not ready. If the answer is unknown, mark it as `TBD` and explain what decision is needed.

## Step-by-Step Process

### Step 1 — Draft the lab spec in ChatGPT / human review

Create or update the dedicated lab spec under `docs/labs/`.

This is a docs/design task. Do not implement code yet unless the issue explicitly combines spec creation with a tiny metadata addition.

The spec should answer:

- What physical question does this lab answer?
- What should the user be able to control?
- What should the user see?
- What diagnostics explain the behavior?
- What physics is required now?
- What physics is deferred?
- What approximations must be labeled?
- What scenarios make the lab useful?

The first draft of a lab spec should be reviewed by the user before implementation issues are created.

### Step 2 — Approve or revise the lab spec

After the first draft, review the lab spec for:

- product fit
- scientific honesty
- physical plausibility
- scope control
- implementation feasibility
- whether it advances the current roadmap sequence

Do not create detailed implementation issues until the lab spec is directionally approved.

### Step 3 — Identify implementation slices

After the lab spec exists and is approved, split implementation into small issues.

Typical issue slices:

1. Lab metadata and scenario definitions
2. Setup controls / input editors
3. Physics-core or schema support
4. Diagnostics / validation
5. Visualization modes
6. Saved run / comparison behavior
7. Documentation and UX polish

Not every lab needs every slice immediately.

### Step 4 — Codex implements scoped issues

Codex should work the implementation issues created from the approved lab spec.

Each issue should be specific enough that Codex does not need to invent the lab's product or science direction.

### Step 5 — Implement the smallest coherent lab version

The first implementation should make the lab usable, not complete.

A v1 lab should have:

- at least one meaningful scenario
- a small set of primary controls
- one or more meaningful diagnostics
- one useful scientific or visual view
- clear limitations
- tests for the core contract

### Step 6 — Validate before expanding

Before adding more controls or visual polish, verify that the lab's core behavior is not misleading.

Ask:

- Does the result match the lab's physical question?
- Are failure/no-cloud controls meaningful?
- Are approximations labeled?
- Do diagnostics explain what happened?
- Are we adding features because they serve the lab, or because they are interesting?

### Step 7 — Add richer views or physics

Only after the v1 lab is coherent should additional physics, rendering, or workflow features be added.

Examples:

- Cloud Optics / Beauty may add 2.5-D after bulk appearance controls are defined.
- Warm Rain may add PySDM after the warm-rain lab contract and bulk comparison path exist.
- Orographic Clouds may add terrain validation before richer terrain editing.

## Issue Creation Rules

### Good issue title patterns

Use lab-specific names:

```text
Design Cloud Optics / Beauty Lab v1
Implement Fair-Weather Cumulus lab controls
Add Evolving Boundary Layer mixed-layer diagnostics
Add Warm Rain droplet distribution visualization
```

Avoid feature-only names:

```text
Add sliders
Add terrain
Add 3-D
Add rain
Add PySDM
```

Those names hide the lab and physical question.

### Every implementation issue must include

- Lab served
- Physical question supported
- User control / diagnostic / visual payoff
- Approximation or limitation disclosed
- Tests required
- Docs affected

This mirrors the PR checklist in `docs/development.md` and `AGENTS.md`.

## Documentation Update Rules

When a lab changes, update:

- the dedicated lab spec in `docs/labs/`
- `docs/lab-roadmap.md` if priority, scope, or sequence changes
- `docs/current-phase-plan.md` if the current executable phase changes
- `docs/scenarios.md` if scenario catalog changes
- `docs/testing-and-validation.md` if validation policy changes
- `docs/simulation-data-model.md` if schema/config changes
- `docs/visualization-and-workbench-views.md` if visualization behavior changes

## Current Phase

The current phase is Workbench V2 plus Fair-Weather Cumulus reference lab.

See `docs/current-phase-plan.md`.

Do not begin implementation of Cloud Optics / Beauty, Evolving Boundary Layer, Terrain, Warm Rain, Fog/Stratus, Ice, or hard-core modeling until the current phase is sufficiently stable or the user explicitly changes priorities.

Design issues for upcoming labs may proceed if they do not disrupt current implementation.

## Durable Rule

Build labs, not feature piles.

A feature belongs in Cloud Lab when it helps a lab answer a physical question in a way the user can see, inspect, and understand.

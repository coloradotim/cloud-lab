# Test Suite Audit

Issue #120 is a Phase 1 inventory before any validation-tier rationalization. This
document records the current test commands, markers, test groups, runtime notes,
coverage shape, and follow-on recommendations. It does not move, rewrite, delete,
skip, xfail, weaken, or reclassify any tests.

## Current Test Command Inventory

### CI jobs

The main workflow is `.github/workflows/ci.yml`.

| Job | When it runs | Current command surface |
| --- | --- | --- |
| `changes` / Detect changed paths | Every PR/push/manual/scheduled workflow | Computes path filters for backend, frontend, and targeted solver/science work. |
| `fast-backend` / Backend quick | Backend-path PRs, pushes to `main`, manual/scheduled workflows | `pytest -m "not slow and not science and not validation and not pysdm"`, `ruff format --check .`, `ruff check .`, `mypy app tests`. |
| `targeted-science` / Targeted solver/science | Solver/science path PRs, pushes to `main`, manual/scheduled workflows | `pytest -m "(boussinesq or microphysics) and not slow and not pysdm"`. |
| `science-validation` / Science validation | Manual dispatch or schedule only | `pytest -m "science and not slow"` and `pytest -m "science and validation"`. |
| `frontend` / Frontend quick | Frontend-path PRs, pushes to `main`, manual/scheduled workflows | `npm run lint`, `npm run test`, `npm run build`. |
| `ci-required` / CI required | Always | Lightweight aggregate status job over changes, backend quick, targeted solver/science, and frontend quick. |

Path filters currently route:

- Backend work: `.github/workflows/ci.yml`, `backend/**`, `scripts/**`.
- Frontend work: `.github/workflows/ci.yml`, `frontend/**`.
- Targeted solver/science work: selected Boussinesq, microphysics, PySDM,
  validation, solver, preset, structured-field tests and related science docs.
- Pushes to `main` run all quick jobs.

### Local documented commands

`docs/development.md`, `docs/testing-and-validation.md`, and science-specific docs
currently document these local command families:

| Purpose | Command |
| --- | --- |
| Frontend quick checks | `npm run lint`, `npm run test`, `npm run build` from `frontend/`. |
| Backend quick checks | `pytest -m "not slow and not science and not validation and not pysdm"`, `ruff format --check .`, `ruff check .`, `mypy app tests` from `backend/`. |
| Boussinesq targeted checks | `pytest -m "boussinesq and not slow"` from `backend/`. |
| Microphysics targeted checks | `pytest -m "microphysics and not slow"` from `backend/`. |
| Reference science validation | `pytest -m "science and validation"` from `backend/`. |
| Full backend test suite | `pytest` from `backend/`. |
| Full frontend checks | `npm run lint`, `npm run test`, `npm run build` from `frontend/`. |
| Optional PySDM checks | `python -m pip install -e ".[pysdm-eval]"`, `pytest -m pysdm`, `python -m app.sim.pysdm_evaluation --json`. |
| Boussinesq thermodynamic report | `python -m app.sim.validation --thermodynamics` or `--json`. |
| Microphysics validation report | `python -m app.sim.microphysics_validation` or `--json`. |
| Microphysics comparison report | `python -m app.sim.microphysics_comparison --json`. |

## Current Test Marker and Category Inventory

`backend/pyproject.toml` registers these pytest markers:

| Marker | Registered meaning | Current usage shape |
| --- | --- | --- |
| `smoke` | Fast smoke coverage for API, schema, and basic solver contracts. | Registered but not currently observed in test files. |
| `science` | Scientific validation checks valuable but slower than default PR path. | Used on Boussinesq solver/validation tests, microphysics validation, PySDM, and a few solver/preset checks. |
| `slow` | Long-running checks for full/heavy validation tiers. | Used on long Boussinesq and legacy educational-solver checks. |
| `boussinesq` | Boussinesq 2-D solver and diagnostics checks. | File-level on Boussinesq solver, thermal-bubble, and validation tests. |
| `microphysics` | Microphysics lab solver and warm-cloud comparison checks. | File-level on microphysics lab, comparison, and validation tests. |
| `pysdm` | Optional PySDM evaluation smoke checks. | File-level on PySDM evaluation test. |
| `validation` | Reference-case or benchmark validation checks. | File-level on Boussinesq validation, thermal-bubble, and microphysics validation; individual solver/preset tests. |

Observed special marker state:

- `backend/tests/test_boussinesq_validation.py::test_humid_boussinesq_reference_cloud_maximum_is_aloft`
  is currently `xfail` with the reason: current prototype places peak cloud water
  below the boundary-layer top.
- Some backend science tests are selected by marker expressions through file-level
  pytest marks, while several legacy educational-solver validation tests are
  marked at the individual test level.
- Frontend tests do not use an equivalent marker/tier mechanism; they are grouped
  by file and run as one Vitest suite.

## Backend Test Inventory

Current backend collection: 13 files, 116 collected pytest cases including
parameterized cases.

| File | Count | Current markers/tier signal | Main coverage |
| --- | ---: | --- | --- |
| `backend/tests/test_health.py` | 5 | Unmarked quick | API health, CORS/preflight, sample frame and sample run endpoints. |
| `backend/tests/test_sim_schemas.py` | 20 | Unmarked quick | Simulation config validation, structured heating/humidity fields, solver type acceptance, sample-frame shape/determinism, field units. |
| `backend/tests/test_streaming.py` | 4 | Unmarked quick | Run lifecycle, streaming metadata/frames/completion, stop behavior and unknown-run errors. |
| `backend/tests/test_presets.py` | 7 | Mostly quick; one `science slow validation` test | Preset endpoint, Fair-Weather config, custom frontend configs, solver catalog, educational legacy, Boussinesq and microphysics run starts. |
| `backend/tests/test_solver.py` | 17 | Mostly quick; several `science slow validation` and `slow validation` tests | Legacy educational solver shapes, initial profiles, heating/plume behavior, advection, structured forcing, Fair-Weather preset, condensation, sponge/stability, reproducibility, frame cadence. |
| `backend/tests/test_boussinesq_2d.py` | 10 | File-level `boussinesq science`; two `slow` tests | Boussinesq frame stability, reproducibility, non-negative moisture, vapor profile, evaporation, lifted-parcel condensation, buoyant motion/cloud water, safety clamps, no-forcing/no-cloud behavior. |
| `backend/tests/test_boussinesq_thermal_bubble.py` | 1 | File-level `boussinesq science validation` | Dry thermal bubble rises and stays cloud-free. |
| `backend/tests/test_boussinesq_thermodynamics.py` | 9 | Unmarked quick | LCL diagnostic plausibility, RH/LCL relationship, mixed-layer consistency, saturation path, cloud onset/distribution, below-LCL and multi-region cloud diagnostics. |
| `backend/tests/test_boussinesq_validation.py` | 26 | File-level `boussinesq science slow validation`; one `xfail` | Reference-case validity, divergence gates, quiet atmosphere, dry/humid reference behavior, model-size comparison, reproducibility, thermodynamic/scenario validation reports, LCL/distribution metadata. |
| `backend/tests/test_microphysics_lab.py` | 7 | File-level `microphysics` | Microphysics lab schema frames, condensation without negative moisture, reproducibility, prescribed lift separation from Boussinesq flow, lifted/dry parcel cooling, run-manager streaming. |
| `backend/tests/test_microphysics_validation.py` | 6 | File-level `microphysics science validation` | Validation summary, no-lift dry control, humid lift condensation/vapor depletion, strong lift/rain threshold, stronger-lift timing, heating offset. |
| `backend/tests/test_microphysics_comparison.py` | 3 | File-level `microphysics` | Comparison structure, stronger cooling timing, rain stress produces more rain. |
| `backend/tests/test_pysdm_evaluation.py` | 1 | File-level `pysdm science` | Optional PySDM box-coalescence reproducibility smoke. |

## Frontend Test Inventory

Current frontend suite: 17 files, 132 Vitest tests.

| File | Count | Main coverage |
| --- | ---: | --- |
| `frontend/src/workbenchV2.test.tsx` | 12 | Lab Picker, Fair-Weather start flow, planned lab states, Cloud Optics shell, Workbench V2 regions, reference flow, default route without old hero/default saved-run panels. |
| `frontend/src/workbench/workbenchRunLoop.test.tsx` | 16 | Scenario/config updates, primary controls, run/start flow, frame buffering, timeline/displayed frame, scientific stage, inspector diagnostics, empty states, truth labels, no duplicate Run/Stop/Reset group. |
| `frontend/src/labs/labCatalog.test.ts` | 11 | Lab catalog metadata, Fair-Weather scenarios and controls, diagnostic/visualization metadata, planned lab status, Cloud Optics concept shell. |
| `frontend/src/simulationControls.test.ts` | 18 | Config update helpers, structured defaults, spatial normalization, warnings, model sizes, scenario intent metadata, control visibility/grouping. |
| `frontend/src/scenarioDiagnostics.test.ts` | 8 | Fair-Weather scenario outcome classifications, dry failed cumulus, humid low-cloud behavior, microphysics no-lift control, missing metadata/empty frame behavior. |
| `frontend/src/visualization.test.ts` | 19 | Field options, display ranges, temperature conversion, adaptive normalization, truth metadata, optical helper grids, color maps, coordinate mapping, velocity vectors. |
| `frontend/src/probe.test.ts` | 4 | Point/neighborhood probe values, derived diagnostics, microphysics velocity labels, missing-field degradation. |
| `frontend/src/sounding.test.ts` | 3 | Column/domain-average profiles, derived RH, microphysics broadcast note. |
| `frontend/src/replay.test.ts` | 4 | Frame index stepping/clamping, live/buffered replay state, diagnostic event jump targets. |
| `frontend/src/comparison.test.ts` | 4 | Comparison domain/grid/runtime alignment, synchronized frame selection, shared display ranges, diagnostic differences. |
| `frontend/src/ScenarioComparisonPanel.test.tsx` | 1 | Scenario A/B controls and diagnostic comparison columns. |
| `frontend/src/savedRuns.test.ts` | 3 | Run artifact creation, persistence/delete, malformed/older artifact fallback. |
| `frontend/src/savedScenarios.test.ts` | 3 | Saved scenario persistence, update/delete, corrupt storage fallback. |
| `frontend/src/microphysicsDiagnostics.test.ts` | 5 | Condensation timing, water-budget drift, dry-run reporting, missing droplet payload, droplet histogram mapping. |
| `frontend/src/labs/cloudOpticsScenes.test.ts` | 5 | Cloud optics scene presets, deterministic source fields, non-negative/nonzero fields, renderer defaults, empty no-cloud field. |
| `frontend/src/labs/cloudOpticsDiagnostics.test.ts` | 7 | Optical diagnostics, light geometry, density/thickness checks, sun-angle separation, edge behavior, approximation labels. |
| `frontend/src/labs/cloudOpticsRenderer.test.ts` | 9 | Cloud optics rendering modes, opacity/depth/shadows, front/side/backlit states, camera/depth controls, empty rendering, bounded renderer controls. |

## Known Validation and Science Commands

| Command | Current role | Notes |
| --- | --- | --- |
| `pytest -m "boussinesq and not slow"` | Targeted Boussinesq quick science | Selects fast Boussinesq tests only; excludes the slow reference validation file. |
| `pytest -m "microphysics and not slow"` | Targeted microphysics quick science | Selects fast microphysics lab/comparison/validation checks. |
| `pytest -m "(boussinesq or microphysics) and not slow and not pysdm"` | CI targeted solver/science | Current CI combined targeted science expression. |
| `pytest -m "science and not slow"` | Manual/scheduled science quick validation | Includes science-marked non-slow checks; may overlap with targeted solver/science. |
| `pytest -m "science and validation"` | Manual/scheduled reference validation | Includes slow validation suites and should remain outside routine UI/docs PR paths. |
| `pytest -m pysdm` | Optional PySDM smoke | Requires optional dependency installation. |
| `python -m app.sim.validation --thermodynamics` | Boussinesq thermodynamic report | Produces human-readable report; `--json` available. |
| `python -m app.sim.microphysics_validation` | Microphysics validation report | Human-readable report; `--json` available. |
| `python -m app.sim.microphysics_comparison --json` | Microphysics comparison report | JSON comparison against current bulk-lab behavior. |

## Runtime Notes

Observed locally on a MacBook Air in this audit branch. These are practical
orientation notes, not contractual performance guarantees.

| Command | Result | Observed wall time |
| --- | --- | ---: |
| `cd backend && .venv/bin/pytest --collect-only -q` | 116 tests collected | 1.08 s |
| `cd backend && .venv/bin/pytest -m "not slow and not science and not validation and not pysdm" --collect-only -q` | 67 selected, 49 deselected | 1.09 s |
| `cd backend && .venv/bin/pytest -m "(boussinesq or microphysics) and not slow and not pysdm" --collect-only -q` | 25 selected, 91 deselected | 0.95 s |
| `cd backend && .venv/bin/pytest -m "not slow and not science and not validation and not pysdm"` | 67 passed, 49 deselected | 14.82 s |
| `cd backend && .venv/bin/pytest -m "(boussinesq or microphysics) and not slow and not pysdm"` | 25 passed, 91 deselected | 8.08 s |
| `cd frontend && npm run test -- --run` | 17 files passed, 132 tests passed | 1.78 s |
| `cd frontend && npm run lint` | Passed | 1.70 s |
| `cd frontend && npm run build` | Passed | 2.02 s |

Full backend pytest, full science validation, and optional PySDM were not run for
this audit because the issue is documentation-only and explicitly avoids changing
solver/scenario/diagnostic behavior.

## Test Classification Table

This table is an initial audit classification, not a final tier assignment.

| Category | Candidate tests/files | Likely current tier | Notes |
| --- | --- | --- | --- |
| API/schema contracts | `test_health.py`, `test_sim_schemas.py`, `test_streaming.py`, parts of `test_presets.py` | Backend quick | Good fit for ordinary backend PRs. |
| Legacy educational solver contracts | Most unmarked tests in `test_solver.py` | Backend quick | Still useful for old solver runnable compatibility and shared frame/schema expectations. Human review should decide long-term importance now Workbench V2 is lab-driven. |
| Boussinesq fast science sanity | `test_boussinesq_2d.py` non-slow tests, `test_boussinesq_thermal_bubble.py` | Targeted solver/science | These are central to current Fair-Weather trust but not default UI/docs PR cost. |
| Boussinesq thermodynamic diagnostics | `test_boussinesq_thermodynamics.py` | Backend quick today | Fast and important for UI diagnostics, but scientifically sensitive. It may deserve a more explicit marker in a later issue. |
| Boussinesq reference validation | `test_boussinesq_validation.py`, slow validation tests in `test_solver.py` and `test_presets.py` | Science validation/manual/scheduled | Strong candidate to keep as non-routine validation. |
| Microphysics lab fast checks | `test_microphysics_lab.py`, `test_microphysics_comparison.py` | Targeted solver/science | Should remain separate from Boussinesq dynamics. |
| Microphysics validation | `test_microphysics_validation.py` | Targeted and science validation | Useful, compact validation; overlap with targeted and validation expressions should be reviewed. |
| Optional PySDM | `test_pysdm_evaluation.py` | Optional/manual | Requires optional dependency and should remain outside ordinary quick checks. |
| Workbench V2 product flow | `workbenchV2.test.tsx`, `workbench/workbenchRunLoop.test.tsx`, `labCatalog.test.ts` | Frontend quick | Core product behavior. |
| Scientific frontend visualization | `visualization.test.ts`, `probe.test.ts`, `sounding.test.ts`, `replay.test.ts`, `scenarioDiagnostics.test.ts` | Frontend quick | Frontend-side scientific interpretation and graceful degradation. |
| Saved/comparison secondary workflows | `savedRuns.test.ts`, `savedScenarios.test.ts`, `comparison.test.ts`, `ScenarioComparisonPanel.test.tsx` | Frontend quick | Useful but no longer default-visible primary Workbench panels. |
| Cloud Optics concept shell | `cloudOptics*.test.ts` | Frontend quick | Product shell/renderer-only tests. Should not be confused with Fair-Weather solver validation. |

## Fair-Weather and Boussinesq Trust Audit

This section maps the requested trust topics to current tests. It records coverage
shape only; it does not assert that the coverage is sufficient.

| Trust topic | Current coverage | Human/science review note |
| --- | --- | --- |
| Quiet/no-forcing | `test_boussinesq_solver_does_not_create_clouds_without_forcing`, `test_quiet_boussinesq_divergence_does_not_grow`, `test_quiet_boussinesq_divergence_and_velocity_stay_below_dimensional_ceilings`, `test_quiet_boussinesq_reference_case_remains_quiet` | Coverage exists, but some is slow/reference validation. Review whether quiet-case gates should be promoted, split, or kept as validation-only. |
| Dry thermal bubble | `test_dry_thermal_bubble_rises_and_stays_cloud_free`, dry reference-case validation, frontend dry-failed scenario diagnostics | Strong conceptual coverage. Review scenario naming and expectation boundaries between dry thermal bubble and dry failed cumulus. |
| Humid lifted thermal | `test_lifted_parcel_cooling_can_trigger_condensation`, `test_boussinesq_solver_produces_buoyant_motion_and_cloud_water`, humid reference validation, legacy lifted humid plume tests | Coverage exists across both Boussinesq and legacy solver. Review which checks are authoritative for current Fair-Weather. |
| Stable stratification suppression | Covered indirectly through stability/profile and reference cases; no obvious named dedicated test in the audit. | Candidate human/science review item. |
| Fair-weather baseline | `test_fair_weather_preset_keeps_heated_lower_patch_warm_and_upward`, `test_fair_weather_cumulus_preset_produces_reproducible_cloud_water`, lab catalog and Workbench tests | Baseline exists across backend/frontend, but physical acceptance criteria need human review before tier changes. |
| Dry failed cumulus | Frontend `scenarioDiagnostics.test.ts` and `simulationControls.test.ts`; backend dry/no-cloud and dry thermal tests | Current coverage catches classification and conservative config intent. Review whether a backend dry-failed lab scenario contract should be explicit. |
| LCL/cloud-base diagnostics | `test_lcl_diagnostic_returns_plausible_common_values`, RH/LCL relationship tests, synthetic onset/distribution tests, Boussinesq thermodynamic validation report tests, frontend inspector/diagnostics tests | Good diagnostic coverage; verify which tests should be hard contracts versus validation/reporting. |
| Below-LCL cloud-water warnings | Synthetic thermodynamic diagnostics tests, Boussinesq validation distribution metadata, frontend scenario diagnostics | Good warning-oriented coverage. Review thresholds and whether failures should warn or fail. |
| Boundary cloud fraction | Boussinesq thermodynamic/cloud-region diagnostics and frontend scenario diagnostics | Covered through diagnostics, but not isolated as a named backend contract everywhere. |
| Return-flow cloud water | Frontend and diagnostics behavior was recently important; direct backend coverage should be reviewed. | Candidate human/science review item because return-flow cloud water can be warning-worthy rather than always failing. |
| Divergence/velocity sanity | Boussinesq diagnostics include dimensionless divergence, field shape, active reference gates, quiet dimensional ceilings, velocity bounds in reference cases | Strong coverage. Review fast/slow split and whether whole-frame versus interior gates are both needed long-term. |
| Reproducibility | Boussinesq solver, reference cases, microphysics lab, legacy solver, sample frames, and PySDM smoke cover seeded reproducibility | Broad coverage; likely worth preserving. |
| Safety caps/stabilizers | `test_boussinesq_solver_does_not_hit_safety_clamps_in_normal_long_run`, `test_long_interactive_educational_run_stays_bounded`, sponge tests | Coverage exists, but some belongs to legacy solver. Review long-run cost and whether stabilizer gates should be validation-only. |
| Moisture non-negativity | Boussinesq solver, Boussinesq reference cases, microphysics lab, structured fields, cloud optics source fields | Broad coverage. Keep as hard invariant where possible. |

## Tests Needing Human or Science Review

These are candidates for later decisions. No action was taken in this audit.

- `backend/tests/test_boussinesq_validation.py::test_humid_boussinesq_reference_cloud_maximum_is_aloft`
  is already `xfail`. It needs a deliberate science decision: update model,
  reframe expected behavior, convert to diagnostic, or keep as known limitation.
- `backend/tests/test_boussinesq_validation.py` as a whole is valuable but slow
  and broad. Review which checks are release/reference gates versus compact PR
  regressions.
- `backend/tests/test_boussinesq_thermodynamics.py` is unmarked despite being
  science-sensitive. It is fast and useful, but later tier work should decide
  whether it gets an explicit marker without moving it out of quick checks.
- `backend/tests/test_solver.py` mixes legacy educational-solver contracts with
  Fair-Weather-ish expectations. Review which tests still protect shared schema
  and which only protect the older prototype model.
- `backend/tests/test_presets.py::test_explicit_educational_solver_config_remains_legacy_runnable`
  and related educational-solver checks should be reviewed once Workbench V2 no
  longer presents the old dashboard as the primary product.
- Return-flow and boundary-attached cloud-water diagnostics need a science
  policy decision: hard fail, warning, or scenario-specific outcome.
- Stable stratification suppression appears underrepresented as a named
  Fair-Weather/Boussinesq trust check.
- Microphysics validation currently appears in targeted solver/science and
  science validation expressions. Review overlap before changing tiers.
- Optional PySDM smoke coverage is correctly isolated by marker, but future
  dependency/performance expectations should be documented before adding more
  PySDM tests.

## Suspected Obsolete or Prototype Tests

Suspected only; no tests were changed.

- Legacy educational solver tests in `backend/tests/test_solver.py` may be
  prototype-era coverage. Some still protect useful schema, initialization,
  reproducibility, and boundedness contracts, so they should not be deleted
  without a targeted review.
- `backend/tests/test_presets.py::test_explicit_educational_solver_config_remains_legacy_runnable`
  intentionally preserves old solver runnability. Review whether that remains a
  product requirement or a temporary compatibility contract.
- Frontend saved-run/comparison tests remain useful for secondary workflows, but
  they no longer represent default Workbench V2 panels.
- Cloud Optics frontend tests protect a concept-shell/renderer path, not the
  Fair-Weather Cumulus physics lab. They should stay out of Fair-Weather science
  conclusions.

## Suspected Duplicate or Redundant Tests

Suspected only; no tests were changed.

- Reproducibility is tested in sample frames, legacy solver, Boussinesq solver,
  Boussinesq reference cases, microphysics lab, and PySDM smoke. This is mostly
  intentional but could be clarified by tier.
- Moisture non-negativity appears in Boussinesq, microphysics, and structured
  source-field contexts. Keep the invariant, but later work can name which tests
  cover which solver/output layer.
- Divergence gates appear as both whole-frame and interior checks in Boussinesq
  validation. This may be deliberate, but it is a good candidate for science
  review before tier rationalization.
- Frontend Workbench tests and lab catalog tests both cover Fair-Weather lab
  identity/control metadata. This is useful product coverage, though later work
  could separate catalog contract tests from full Workbench flow tests.
- Microphysics validation and microphysics comparison both test monotonic or
  expected condensation/rain relationships. They appear to target different
  surfaces, but later naming could reduce confusion.

## Initial Recommended Follow-on Work

These are recommendations for later issues, not actions taken in #120.

1. Decide authoritative Fair-Weather/Boussinesq science gates with a human review
   of the trust audit table, especially dry failed cumulus, below-LCL cloud
   water, return-flow warnings, and stable suppression.
2. Add or clarify marker policy for fast science-sensitive diagnostics that are
   cheap enough for quick checks, especially Boussinesq thermodynamic diagnostics.
3. Split legacy educational-solver compatibility from current lab-driven
   Boussinesq/Fair-Weather contracts in documentation before moving tests.
4. Decide whether `smoke` should be used or removed from marker vocabulary in a
   later cleanup.
5. Document intended overlap between targeted solver/science and manual
   science-validation commands.
6. Create a small follow-on issue for any missing named trust checks after human
   science review, rather than broad rewrites.
7. Keep optional PySDM isolated until dependency, performance, and coupling
   expectations are explicit.

## Audit Boundary Confirmation

- No tests were moved, rewritten, deleted, skipped, xfailed, weakened, or
  reclassified in this issue.
- No solver physics, scenario presets, diagnostics, or CI behavior were changed.
- This audit intentionally records candidates and recommendations only.

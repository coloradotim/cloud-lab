# CM1 Validation Batch Workflow

Issue: #235

This document describes the local batch workflow for running committed CM1
validation cases, ingesting successful output, applying lightweight QC, and
writing a local validation report.

The workflow is developer/user tooling only. Cloud Lab does not run CM1 inside
the web app.

## Purpose

The validation batch connects the validation matrix to repeatable local runs:

```text
CM1 validation matrix
  ->
committed case assets
  ->
local CM1 run directories
  ->
reference-run-v1 artifacts
  ->
validation/QC report
```

The batch is meant to remove per-case babysitting. It runs each selected case,
detects missing output or known failures, ingests successful cases, records
diagnostics, and continues to the next case unless a fatal preflight problem
prevents the whole batch.

## Dry Run

Use dry-run mode first:

```bash
scripts/reference/cm1/run_validation_batch.sh \
  --cm1-run-dir /Users/timpeterson/cm1r21.1/run \
  --matrix docs/reference-models/cm1-lower-atmosphere-validation-matrix.md \
  --output-root data/reference/cm1/validation-runs
```

Dry-run mode writes a local report with `planned` case statuses and does not
run CM1 or ingest output.

## Execute

Run the committed runnable validation cases with:

```bash
scripts/reference/cm1/run_validation_batch.sh \
  --cm1-run-dir /Users/timpeterson/cm1r21.1/run \
  --matrix docs/reference-models/cm1-lower-atmosphere-validation-matrix.md \
  --output-root data/reference/cm1/validation-runs \
  --ingested-output data/reference/cm1/ingested \
  --public-output frontend/public/reference/cm1/local \
  --execute
```

The current committed runnable batch includes the Phase A anchors:

```text
cm1-dry-failed-cumulus-v1
cm1-shallow-cumulus-baseline-v1
```

Future Phase B/C/D cases should become runnable only after their case assets
are committed. Do not add new case configs from this batch script alone.

## Preflight

Before executing, the batch checks:

- CM1 run directory exists.
- `cm1.exe` exists and is executable.
- cases requiring surface support can find `LANDUSE.TBL` in the CM1 run dir.
- `input_sounding` extends above the configured grid top.
- cases with `output_format = 2` have `nf-config` available.
- Python NetCDF ingestion packages are available when NetCDF output is needed:
  `xarray` and `netCDF4`.

If preflight fails in execute mode, the batch stops before creating per-case
runs and prints actionable instructions.

## Per-Case Flow

For each case, the batch delegates the model run to:

```text
scripts/reference/cm1/run_cm1_case.sh
```

That script copies `cm1.exe`, the case namelist, `input_sounding`, manifest,
and required runtime files such as `LANDUSE.TBL` into the generated local run
directory.

Successful runs are then ingested through:

```text
scripts/reference/cm1/ingest_cm1_output.py
```

The ingester writes:

```text
data/reference/cm1/ingested/<case-id>/reference-run.json
data/reference/cm1/ingested/<case-id>/ingested-manifest.json
frontend/public/reference/cm1/local/index.json
```

All of these paths are ignored local output paths.

## Report

Each batch writes:

```text
data/reference/cm1/validation-runs/<timestamp>/validation-report.json
```

The report includes:

- `batch_id`
- `created_at`
- `cm1_version`
- `matrix_version_or_commit`
- `case_count`
- `preflight`
- `case_results`
- `summary`

Each case result records:

- `case_id`
- `status`
- `run_output_path`
- `ingested_artifact_path`
- `frontend_index_status`
- `first_cloud_time`
- `cloud_base`
- `cloud_top`
- `max_cloud_water`
- `max_updraft`
- `rain_onset`
- `expected_regime`
- `observed_regime`
- `agreement_status`
- `warnings`
- `next_action`

## Status Meanings

| Status | Meaning |
| --- | --- |
| `planned` | Dry-run entry; CM1 was not executed. |
| `running` | Transient internal state while a case is executing. |
| `cm1_failed` | CM1 exited nonzero or did not produce expected output. |
| `ingest_failed` | CM1 output existed but could not be converted into reference artifacts. |
| `qc_failed` | Ingest succeeded but diagnostics could not be evaluated. |
| `accepted` | Case passed the current qualitative validation policy. |
| `needs_calibration` | Case ran, but output disagrees with the expected regime or required diagnostics. |

QC agreement uses:

| Agreement status | Meaning |
| --- | --- |
| `accepted` | Regime and required diagnostics match the current policy. |
| `accepted_with_notes` | Regime passes, but warnings should be reviewed. |
| `needs_calibration` | Output needs case or interpretation review before acceptance. |
| `failed` | Run, ingest, or QC failed. |

The batch does not score exact cloud morphology. It checks regime and core
diagnostics such as cloud timing, cloud base/top, max cloud water, max updraft,
and rain onset where available.

## Known Failure Messages

The report and console output surface common local-repeatability problems:

- CM1 was not compiled with NetCDF support.
- `LANDUSE.TBL` is missing.
- `input_sounding` ends below the grid top.
- `.nc` output is missing for `output_format = 2`.
- `xarray` or `netCDF4` is missing for NetCDF ingestion.
- the ingester cannot map required fields.

## Data Policy

Do not commit:

- generated CM1 output
- NetCDF files
- CM1 binaries
- CM1 source
- `LANDUSE.TBL`
- generated validation run directories
- generated validation reports
- generated local frontend reference indexes

Do commit:

- scripts
- docs
- case manifests/configs
- tiny fixtures/tests

## Relationship To The Matrix

The batch reads the validation matrix to attach expected regimes and existing
validation status to runnable committed cases. It does not create missing Phase
B/C/D/E cases. Those cases need their own scoped implementation issues before
they can enter the batch.


# CM1 Reference Scripts

These scripts support local CM1 reference-run setup for Cloud Lab.

They are intentionally lightweight:

- no package installation
- no CM1 download
- no system modification
- no committed model output
- no Cloud Lab app runtime dependency on CM1

## Scripts

```text
check_cm1_environment.sh
run_cm1_case.sh
run_reference_pair.sh
ingest_cm1_output.py
ingest_reference_pair.sh
```

### Check Environment

```bash
scripts/reference/cm1/check_cm1_environment.sh
```

Use `--strict` to return a non-zero exit code when required tools are missing.

### Run A Prepared Case

```bash
scripts/reference/cm1/run_cm1_case.sh \
  --case-dir reference/cm1/cases/example-case \
  --cm1-run-dir ~/src/cm1/CM1/run
```

The default mode is a dry run. Add `--execute` to actually copy the prepared
case into an ignored local run directory and run CM1.

See `docs/reference-models/cm1-local-setup-macos.md` for the complete workflow.

### Run The First Reference Pair

```bash
scripts/reference/cm1/run_reference_pair.sh \
  --cm1-run-dir ~/src/cm1/CM1/run
```

The default mode is a dry run. Add `--execute` to run the dry-failed-cumulus
and shallow-cumulus-baseline cases into ignored local output directories.

See `docs/reference-models/cm1-first-reference-pair.md` for case details,
required fields, diagnostics, and data policy.

### Ingest Local CM1 Output

```bash
scripts/reference/cm1/ingest_reference_pair.sh \
  --dry-input data/reference/cm1/runs/<local-dry-run> \
  --shallow-input data/reference/cm1/runs/<local-shallow-run> \
  --output data/reference/cm1/ingested \
  --public-output frontend/public/reference/cm1/local
```

For one case:

```bash
scripts/reference/cm1/ingest_cm1_output.py \
  --case-id cm1-shallow-cumulus-baseline-v1 \
  --input-dir data/reference/cm1/runs/<local-shallow-run> \
  --output-dir data/reference/cm1/ingested \
  --public-output-dir frontend/public/reference/cm1/local
```

The ingester expects either `cloud_lab_cm1_adapter_input.json` in the input
directory or NetCDF output readable through optional local `xarray`. It writes
`reference-run-v1` artifacts and an ignored frontend local index. It does not
run CM1 or commit generated output.

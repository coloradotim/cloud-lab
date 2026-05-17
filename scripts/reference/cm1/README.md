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

# CM1 Reference Case Assets

Issue: #208

This directory contains Cloud Lab-side assets for the first local CM1 reference
pair:

- `dry-failed-cumulus`
- `shallow-cumulus-baseline`

These assets are intended to make local CM1 reference runs reproducible enough
to generate the first credible 2-D lower-atmosphere contrast pair. They are not
Cloud Lab app runtime dependencies, and they do not include generated CM1
output.

## Run The Pair

From the Cloud Lab repo root:

```bash
scripts/reference/cm1/run_reference_pair.sh \
  --cm1-run-dir ~/src/cm1/CM1/run
```

The default mode is a dry run. Add `--execute` to copy each case into ignored
local output directories and run CM1:

```bash
scripts/reference/cm1/run_reference_pair.sh \
  --cm1-run-dir ~/src/cm1/CM1/run \
  --execute
```

Output should remain under:

```text
data/reference/cm1/runs/
```

Do not commit generated CM1 output, CM1 binaries, or local build products.

## Case Status

The committed namelists are first-pass local reference-case configurations.
They are designed to be runnable and to produce a dry/cloud-free versus
shallow-cumulus contrast, but the generated outputs still need scientific
inspection after the local runs complete.

If the dry case produces meaningful cloud water, reduce low-level moisture or
surface latent heat in the dry case. If the shallow case stays cloud-free,
increase low-level moisture or forcing in the shallow case. Capture those
calibrations in the committed case manifests, not in ignored output files.

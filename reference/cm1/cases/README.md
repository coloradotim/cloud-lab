# CM1 Reference Case Assets

Issue: #208

This directory contains Cloud Lab-side assets for local CM1 reference and
validation-anchor runs.

The first accepted Phase A reference pair is:

- `dry-failed-cumulus`
- `shallow-cumulus-baseline`

The planned Phase B validation-anchor assets are:

- `capped-suppressed-cumulus`
- `humid-low-cloud-contrast`
- `low-stratus-develops`

These assets are intended to make local CM1 reference runs reproducible enough
to generate credible lower-atmosphere validation anchors. They are not Cloud Lab
app runtime dependencies, and they do not include generated CM1 output.

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

## Cloud-Scale Domain Policy

The committed Phase A/B assets now use the first Lower Atmosphere CM1
cloud-scale policy:

```text
horizontal domain: 16 km x 16 km
horizontal grid spacing: 200 m
vertical domain: 6 km
nominal vertical spacing: 125 m
runtime: 7200 s
output cadence: 300 s
```

The old 120 km / 2 km-grid outputs proved the run/ingest/replay workflow and
broad regimes, but they are workflow/provisional evidence rather than final
cloud-scale visual validation. Rerun the Phase A/B cases with the committed
cloud-scale configs before promoting them as final visual anchors or before
using them as the basis for Phase C sensitivity sweeps.

## Case Status

The old Phase A dry-failed and shallow-cumulus outputs were manually accepted
as the first real local pair and remain useful workflow/provisional evidence.
The current committed cloud-scale configs still need fresh generated output,
ingestion, and scientific inspection before they can be treated as final
cloud-scale visual validation. The Phase B case assets are first-pass planned
validation anchors. They are designed to be runnable, but generated outputs
still need scientific inspection before they can be marked accepted.

If the dry case produces meaningful cloud water, reduce low-level moisture or
surface latent heat in the dry case. If the shallow case stays cloud-free,
increase low-level moisture or forcing in the shallow case. Capture those
calibrations in the committed case manifests, not in ignored output files.

For Phase B, use the validation matrix policy: mark a generated case
`needs_calibration` if its observed regime does not match the expected cap,
humid low-cloud, or low-stratus anchor. Do not use this directory to start
Phase C sweeps, rain, terrain, or warm-rain work.

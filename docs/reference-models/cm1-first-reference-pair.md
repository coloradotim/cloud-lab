# CM1 First Reference Pair

Issue: #208

This document describes the first Cloud Lab-side CM1 reference pair:

```text
dry failed cumulus
shallow cumulus baseline
```

The pair is the first credibility milestone for realistic 2-D
lower-atmosphere cloud visualization. It does not make CM1 part of the Cloud
Lab web app, does not commit generated model output, and does not implement the
viewer or adapter ingestion work.

## Product Role

Cloud Lab's target loop is:

```text
Choose lab -> choose scenario -> adjust physical controls -> run -> watch -> inspect -> save/compare -> vary -> learn
```

The reduced-model stack explains cloud formation and supports fast interaction,
but credible 2-D cloud visualization should be anchored by CM1 reference output
first.

This reference pair supports:

- visible contrast between a dry failed setup and a shallow cumulus setup
- future 2-D scientific field replay
- future diagnostics and reduced-model comparison
- future cloud appearance rendering from credible reference fields

## Case Assets

Committed assets live under:

```text
reference/cm1/cases/dry-failed-cumulus/
reference/cm1/cases/shallow-cumulus-baseline/
```

Each case contains:

- `README.md`
- `manifest.json`
- `namelist.input`
- `input_sounding`

The `input_sounding` files follow the CM1 external sounding format documented
by CM1: a one-line surface header followed by height, theta, water vapor, and
wind columns. The namelists use `isnd = 7` so CM1 reads the external
`input_sounding` file.

References:

- <https://cm1.readthedocs.io/en/latest/soundings/>
- <https://cm1.readthedocs.io/en/latest/README.namelist/>

The namelists request NetCDF output with `output_format = 2`, because NetCDF is
the preferred path for later Cloud Lab ingestion. If a local CM1 build or case
requires GrADS output instead, keep the generated output local and update the
manifest/docs in a follow-up calibration PR.

Because `output_format = 2` is committed for both cases, the local `cm1.exe`
used for this pair must be built with NetCDF support. The run scripts now warn
when `nf-config` is unavailable and report the known CM1 NetCDF build error
with the rebuild instruction instead of treating the run as successful.

The committed `input_sounding` files must extend above the configured grid top.
Both first-pair soundings include a 20000 m final level so they cover the
60 x 60 x 40 grid with 500 m vertical spacing. Keep that invariant when
adjusting the soundings.

## Case 1: Dry Failed Cumulus

| Required detail | Definition |
| --- | --- |
| Case id | `cm1-dry-failed-cumulus-v1` |
| Description | First-pass local CM1 dry-failed-cumulus reference case. |
| Physical question | How can heating and thermal motion occur while shallow cumulus fails because the lower atmosphere is too dry? |
| Expected outcome | Rising motion / thermal activity but no meaningful cloud liquid water. |
| Namelist/input concept | 60 x 60 x 40 grid, 2 km horizontal spacing, 500 m vertical spacing, 2 hour runtime, 5 minute output cadence, external dry sounding, weak moisture supply. |
| Sounding/profile concept | Near-surface water vapor starts around 5 g/kg and decreases quickly with height, keeping saturation unfavorable. |
| Output fields required | time, x/z grid, temperature or potential temperature, water vapor, cloud liquid water, vertical velocity, horizontal velocity if available, pressure metadata if available. |
| Diagnostics expected | max updraft, no / negligible cloud water, no first cloud time, high LCL or unfavorable saturation state. |
| Runtime/domain/grid target | 7200 s, 60 x 60 x 40, 2 km x/y grid, 500 m z grid, no terrain. |
| Storage location | `data/reference/cm1/runs/<timestamp>-dry-failed-cumulus/` |
| How to run | `scripts/reference/cm1/run_cm1_case.sh --case-dir reference/cm1/cases/dry-failed-cumulus --cm1-run-dir ~/src/cm1/CM1/run` |
| How to ingest | Use the #179 CM1 reference adapter path after local output exists and fields are inspected. |
| Known limitations | First-pass configuration may need moisture/forcing tuning if the output forms meaningful cloud or has too little motion. |

## Case 2: Shallow Cumulus Baseline

| Required detail | Definition |
| --- | --- |
| Case id | `cm1-shallow-cumulus-baseline-v1` |
| Description | First-pass local CM1 shallow-cumulus baseline reference case. |
| Physical question | How do lower-atmosphere heating and moisture produce visible shallow cumulus? |
| Expected outcome | Shallow cumulus cloud formation with visible cloud liquid water field. |
| Namelist/input concept | Same grid, runtime, and output cadence as dry failed cumulus, but with a moister lower layer and stronger moisture supply. |
| Sounding/profile concept | Near-surface water vapor starts around 13.5 g/kg, decreases above the lower layer, and keeps the expected cloud shallow. |
| Output fields required | time, x/z grid, temperature or potential temperature, water vapor, cloud liquid water, vertical velocity, horizontal velocity if available, pressure metadata if available. |
| Diagnostics expected | first cloud time, cloud base, cloud top, max cloud liquid water, max updraft, integrated cloud water, LCL comparison. |
| Runtime/domain/grid target | 7200 s, 60 x 60 x 40, 2 km x/y grid, 500 m z grid, no terrain. |
| Storage location | `data/reference/cm1/runs/<timestamp>-shallow-cumulus-baseline/` |
| How to run | `scripts/reference/cm1/run_cm1_case.sh --case-dir reference/cm1/cases/shallow-cumulus-baseline --cm1-run-dir ~/src/cm1/CM1/run` |
| How to ingest | Use the #179 CM1 reference adapter path after local output exists and fields are inspected. |
| Known limitations | First-pass configuration may need moisture/forcing/stability tuning if it stays cloud-free or grows too deep. |

## Run The Pair

Dry-run the pair plan:

```bash
scripts/reference/cm1/run_reference_pair.sh \
  --cm1-run-dir ~/src/cm1/CM1/run
```

Run the pair locally:

```bash
scripts/reference/cm1/run_reference_pair.sh \
  --cm1-run-dir ~/src/cm1/CM1/run \
  --execute
```

To use a specific ignored output root:

```bash
scripts/reference/cm1/run_reference_pair.sh \
  --cm1-run-dir ~/src/cm1/CM1/run \
  --output-root data/reference/cm1/runs \
  --execute
```

During execution, `run_reference_pair.sh` delegates each case to
`run_cm1_case.sh`. The case runner copies required runtime support files from
`--cm1-run-dir`, including `LANDUSE.TBL` when present. These first-pair
namelists enable surface-flux setup, so `LANDUSE.TBL` is required beside
`cm1.exe` in each generated run directory. If it is missing from the source
CM1 run directory, the script fails before launching CM1.

For NetCDF-output cases, the script expects at least one `.nc` file after CM1
exits. If no expected output exists, it returns nonzero and prints the stdout /
stderr log paths plus hints for known local failures:

- CM1 was not compiled with NetCDF support.
- `LANDUSE.TBL` is missing.
- `input_sounding` ends below the grid top.

For MPI:

```bash
scripts/reference/cm1/run_reference_pair.sh \
  --cm1-run-dir ~/src/cm1/CM1/run \
  --mpi-procs 4 \
  --execute
```

## Manifest Format

Each case manifest uses:

```text
schema_version
case_id
case_name
lab_served
source_model
cm1_version
created_at
status
description
physical_question
expected_outcome
namelist_input_concept
sounding_profile_concept
local_output_path
expected_output_files
required_fields
diagnostics_to_compute
storage_policy
how_to_run
how_to_ingest
known_limitations
notes
```

The committed manifests do not include machine-specific absolute paths,
secrets, generated outputs, or local binaries.

## Repeatable Local Workflow

Use this order when regenerating the first pair:

1. Check the local environment:

   ```bash
   scripts/reference/cm1/check_cm1_environment.sh
   ```

2. Build CM1 with NetCDF enabled in the external CM1 checkout. The committed
   namelists require NetCDF output.
3. Run the pair:

   ```bash
   scripts/reference/cm1/run_reference_pair.sh \
     --cm1-run-dir /path/to/cm1/run \
     --output-root data/reference/cm1/runs \
     --execute
   ```

4. Confirm each generated run directory contains `.nc` output.
5. Ingest the pair:

   ```bash
   scripts/reference/cm1/ingest_reference_pair.sh \
     --dry-input data/reference/cm1/runs/<local-dry-run> \
     --shallow-input data/reference/cm1/runs/<local-shallow-run> \
     --output data/reference/cm1/ingested \
     --public-output frontend/public/reference/cm1/local
   ```

6. Open the app and use the Lower Atmosphere v2 reference panel for the #221
   acceptance path.

## Data Management

Do not commit large CM1 outputs to git.

Generated data should live under:

```text
data/reference/cm1/
```

Commit:

- case configs
- scripts
- manifests
- docs
- tiny fixtures if needed

Do not commit:

- large NetCDF outputs
- compiled CM1 binaries
- CM1 source code
- local machine build products

## Inspection And Calibration

After local runs finish, inspect the outputs before promoting them as reference
datasets:

- confirm the dry case has finite vertical velocity but no meaningful cloud
  liquid water
- confirm the shallow case has visible cloud liquid water
- compute max updraft for both cases
- compute first cloud time, cloud base, cloud top, max cloud water, and
  integrated cloud water for the shallow case
- record CM1 version, creation time, output path, and any calibration notes in
  a local manifest or a follow-up PR

If the output does not match the expected contrast, tune the case assets in a
small follow-up PR. Do not tune Boussinesq or reduced-model behavior to force
this pair.

## Ingestion Path

After local output exists, ingest the pair with:

```bash
scripts/reference/cm1/ingest_reference_pair.sh \
  --dry-input data/reference/cm1/runs/<local-dry-run> \
  --shallow-input data/reference/cm1/runs/<local-shallow-run> \
  --output data/reference/cm1/ingested \
  --public-output frontend/public/reference/cm1/local
```

For one case at a time:

```bash
scripts/reference/cm1/ingest_cm1_output.py \
  --case-id cm1-shallow-cumulus-baseline-v1 \
  --input-dir data/reference/cm1/runs/<local-shallow-run> \
  --output-dir data/reference/cm1/ingested \
  --public-output-dir frontend/public/reference/cm1/local
```

Each input directory should contain either a small
`cloud_lab_cm1_adapter_input.json` mapping file or NetCDF CM1 output (`*.nc`)
readable through optional local `xarray`.

The implemented path is:

```text
CM1 output
  ->
Cloud Lab reference adapter
  ->
Cloud Lab reference frames
  ->
diagnostics
  ->
2-D scientific visualization
  ->
future appearance / comparison
```

Do not point the frontend directly at raw CM1 output. Do not run CM1 in normal
Cloud Lab app sessions.

Generated artifacts and frontend local indexes are ignored by git:

```text
data/reference/cm1/ingested/
frontend/public/reference/cm1/local/
```

When the frontend local index exists, Lower Atmosphere v2 prefers real local
ingested output for matching case ids. Otherwise the tiny fixture remains
available only as clearly labeled `Synthetic fixture data`, `Not scientific
truth`, and `For UI/testing only`.

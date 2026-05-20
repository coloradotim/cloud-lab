# CM1 Local Setup On macOS

Issue: #207

This document describes a local macOS setup path for running CM1 reference
simulations that Cloud Lab can ingest later.

It does not make CM1 part of the Cloud Lab web app, add CM1 as a default app
dependency, run CM1 in normal app sessions, or commit CM1 output files.

## Purpose

Cloud Lab needs credible 2-D cloud fields for the visual reference path:

```text
CM1 reference cases
  ->
Cloud Lab reference adapter
  ->
2-D scientific cloud visualization
  ->
diagnostics and comparison
  ->
later cloud appearance / 2.5-D rendering
```

The reduced-model stack remains useful for explanation and fast interaction.
Realistic 2-D cloud evolution should be anchored by offline CM1 reference
output first.

## What CM1 Is

The NSF NCAR/Mesoscale & Microscale Meteorology CM1 page describes CM1 as a
numerical model for idealized and theoretical atmospheric studies. The current
official version listed there is `cm1r21.1`, and the page links to the official
GitHub download and CM1 homepage:

- <https://www.mmm.ucar.edu/models/cm1>
- <https://www2.mmm.ucar.edu/people/bryan/cm1/>
- <https://github.com/NCAR/CM1>

The CM1 homepage and documentation identify CM1 as a three-dimensional,
non-hydrostatic, non-linear, time-dependent model for idealized atmospheric
phenomena. The docs also note that CM1 requires UNIX and Fortran knowledge; it
is a research model, not a packaged Cloud Lab runtime dependency.

## What Cloud Lab Does And Does Not Use CM1 For

Cloud Lab uses CM1 output as offline reference data.

Cloud Lab should:

- run CM1 outside normal app sessions
- store generated output locally under an ignored data path
- ingest selected output through the Cloud Lab reference adapter
- preserve source-model provenance and units
- label CM1 data as offline reference output

Cloud Lab should not:

- run CM1 inside the web app
- require CM1 to start the backend or frontend
- commit CM1 source, binaries, build products, or large output files
- treat CM1 fixture data as scientific truth
- route the 2-D visual credibility path through Boussinesq

## macOS Prerequisites

Recommended local tools:

| Tool | Why |
| --- | --- |
| Xcode Command Line Tools | Provides macOS developer utilities such as `make` and system headers. |
| Homebrew | Convenient way to install compilers and scientific libraries on a Mac. |
| Fortran compiler | CM1 is primarily Fortran. `gfortran`, Intel `ifort`/`ifx`, or NVHPC `nvfortran` may be usable depending on the CM1 release and local setup. |
| `make` | CM1 uses a Makefile-based compile path. |
| MPI compiler/runtime | Needed for distributed-memory MPI builds; optional for small serial/OpenMP experiments. |
| NetCDF C/Fortran libraries | Needed if building CM1 with NetCDF output. NetCDF output is strongly preferred for Cloud Lab ingestion later. |
| `git`, `curl`, `tar` | Useful for downloading source, scripts, and release archives. |

Suggested Homebrew packages for a first local attempt:

```bash
brew install gcc make open-mpi netcdf netcdf-fortran
```

This is guidance, not a Cloud Lab dependency declaration. Do not add these tools
to Cloud Lab backend/frontend installs.

## Check The Local Environment

Run:

```bash
scripts/reference/cm1/check_cm1_environment.sh
```

The script checks for common macOS prerequisites and prints next steps. It does
not install packages, download CM1, modify system state, or create model output.

Use strict mode when you want missing required tools to fail the command:

```bash
scripts/reference/cm1/check_cm1_environment.sh --strict
```

## Where To Download CM1

Use the official CM1 pages:

- CM1 overview and current release link:
  <https://www.mmm.ucar.edu/models/cm1>
- CM1 homepage:
  <https://www2.mmm.ucar.edu/people/bryan/cm1/>
- NCAR GitHub mirror:
  <https://github.com/NCAR/CM1>

Before using the source, read the CM1 license and documentation from the
official source you download.

Recommended local checkout/archive location:

```text
~/src/cm1/
```

or another directory outside this repo. Do not vendor CM1 source into Cloud Lab.

## How To Build CM1

The official CM1 compilation docs say to build from the CM1 `src` directory with
`make` and optional flags such as `USE_OPENMP`, `USE_MPI`, and `USE_NETCDF`.

Typical local shape:

```bash
cd ~/src/cm1/CM1/src
make USE_OPENMP=true USE_NETCDF=true
```

The committed Cloud Lab reference-pair namelists request:

```text
output_format = 2
```

That means the local `cm1.exe` must be compiled with NetCDF support. On a
Homebrew/gfortran macOS setup, verify `nf-config` is available and points at the
NetCDF Fortran install:

```bash
nf-config --version
nf-config --flibs
```

If CM1 exits with `You have requested netcdf output, but you have not compiled
the code with netcdf capability`, enable the NetCDF section in the CM1
`src/Makefile`, clean, and rebuild. For CM1 r21.1 with Homebrew gfortran, this
local shape is a useful starting point:

```bash
cd ~/src/cm1/CM1/src
make clean
make USE_OPENMP=true USE_NETCDF=true \
  FC=gfortran \
  CPP="gfortran -E -x f95-cpp-input" \
  NETCDFBASE="$(nf-config --prefix)"
```

Do not let Cloud Lab scripts edit the external CM1 Makefile automatically; keep
that build decision local to the CM1 checkout.

For MPI:

```bash
cd ~/src/cm1/CM1/src
make USE_OPENMP=true USE_MPI=true USE_NETCDF=true
```

If compilation succeeds, the CM1 docs say `cm1.exe` and `onefile.F` are created
in the CM1 `run` directory.

Notes:

- Prefer NetCDF output for future Cloud Lab ingestion.
- Use MPI only if the case size needs it and the local MPI toolchain is healthy.
- Keep build products in the local CM1 source/build tree, not in this repo.
- CM1 Makefile options and compiler behavior can change by release; prefer the
  official docs for final build details.

## How To Run A Small Case

The official CM1 brief user guide describes running CM1 from the directory that
contains `cm1.exe`, with `namelist.input` and any needed `input_sounding` in
the same run directory. It also notes that CM1 output is placed in the `run`
directory by default and can overwrite previous output if it is not moved.

For Cloud Lab, prefer a separate local run directory under:

```text
data/reference/cm1/runs/
```

This path is ignored by git.

For a prepared case directory containing at least `namelist.input`, use:

```bash
scripts/reference/cm1/run_cm1_case.sh \
  --case-dir reference/cm1/cases/example-case \
  --cm1-run-dir ~/src/cm1/CM1/run
```

By default, the script prints the run plan and exits. To actually copy the
prepared case into an ignored local output directory and run CM1:

```bash
scripts/reference/cm1/run_cm1_case.sh \
  --case-dir reference/cm1/cases/example-case \
  --cm1-run-dir ~/src/cm1/CM1/run \
  --execute
```

When `--execute` is used, the script copies `cm1.exe`, the case namelist,
`input_sounding`, case docs/manifests, and required CM1 runtime support files
from `--cm1-run-dir` into the generated ignored run directory. The first
reference pair uses surface-flux settings that require `LANDUSE.TBL`, so the
script copies `$CM1_RUN_DIR/LANDUSE.TBL` when available and fails early with a
clear message if it is missing.

The script also performs preflight and post-run checks:

- validates that `input_sounding` extends above the configured grid top
- warns when `output_format = 2` but `nf-config` is unavailable
- expects at least one `.nc` file for NetCDF-output cases
- reports known CM1 failures such as missing NetCDF support, missing
  `LANDUSE.TBL`, or a sounding top below the grid top

For MPI:

```bash
scripts/reference/cm1/run_cm1_case.sh \
  --case-dir reference/cm1/cases/example-case \
  --cm1-run-dir ~/src/cm1/CM1/run \
  --mpi-procs 4 \
  --execute
```

The example case directory above is illustrative. Issue #208 adds the first
dry-failed and shallow-cumulus case assets.

After #208, the first pair can be dry-run or executed with:

```bash
scripts/reference/cm1/run_reference_pair.sh \
  --cm1-run-dir ~/src/cm1/CM1/run
```

Add `--execute` only when you want to copy the case assets into ignored local
output directories and run CM1.

Expected local workflow for the reference pair:

1. Run `scripts/reference/cm1/check_cm1_environment.sh`.
2. Build/rebuild CM1 with NetCDF support.
3. Run `scripts/reference/cm1/run_reference_pair.sh --cm1-run-dir <CM1 run dir> --execute`.
4. Confirm each generated run directory contains `.nc` output.
5. Ingest the pair with `scripts/reference/cm1/ingest_reference_pair.sh`.
6. Open Cloud Lab for the #221 acceptance path.

For validation batches, use the scripted batch workflow instead of running each
case by hand:

```bash
scripts/reference/cm1/run_validation_batch.sh \
  --cm1-run-dir /Users/timpeterson/cm1r21.1/run \
  --matrix docs/reference-models/cm1-lower-atmosphere-validation-matrix.md \
  --output-root data/reference/cm1/validation-runs \
  --ingested-output data/reference/cm1/ingested \
  --public-output frontend/public/reference/cm1/local
```

This is a dry run unless `--execute` is added. In execute mode, the batch
preflights NetCDF tooling and required runtime files, runs each committed
runnable case, ingests successful outputs, and writes a local
`validation-report.json` under `data/reference/cm1/validation-runs/<timestamp>/`.

As of #254, the batch discovers the Phase A pair plus the planned Phase B
validation anchors using the committed cloud-scale configs:

```text
cm1-dry-failed-cumulus-v1
cm1-shallow-cumulus-baseline-v1
cm1-capped-suppressed-cumulus-v1
cm1-humid-low-cloud-contrast-v1
cm1-low-stratus-develops-v1
```

Run a single Phase B case with `--case-id` when you want to iterate locally
without running the whole batch, for example:

```bash
scripts/reference/cm1/run_validation_batch.sh \
  --cm1-run-dir /Users/timpeterson/cm1r21.1/run \
  --case-id cm1-capped-suppressed-cumulus-v1
```

The Phase B cases are validation anchors with committed assets only. Do not
mark them accepted until real output has been generated, ingested, and manually
inspected.

The previous 120 km / 2 km-grid Phase A outputs remain workflow/provisional
evidence only. Rerun Phase A/B with the cloud-scale configs before treating
those outputs as final visual validation or before using them as the basis for
Phase C sensitivity sweeps. The batch preflight now rejects committed Lower
Atmosphere cases wider than 20 km or outside the documented 50-250 m horizontal
grid-spacing envelope.

## Output Storage

Do not commit large CM1 output files to git.

Use:

```text
data/reference/cm1/
```

Several GB of local data is acceptable for user-generated reference datasets,
but large outputs should remain local unless a separate artifact/storage plan is
approved.

Commit:

- docs
- scripts
- manifests
- case configs
- tiny fixtures

Do not commit:

- large NetCDF outputs
- compiled CM1 binaries
- CM1 source code unless licensing/repo policy explicitly allows it
- local machine build products

## How Output Should Be Ingested Later

After a real case is generated, use the local ingestion commands to create
Cloud Lab reference artifacts from the ignored output directory:

```bash
scripts/reference/cm1/ingest_cm1_output.py \
  --case-id cm1-shallow-cumulus-baseline-v1 \
  --input-dir data/reference/cm1/runs/<local-shallow-run> \
  --output-dir data/reference/cm1/ingested \
  --public-output-dir frontend/public/reference/cm1/local
```

For the first pair:

```bash
scripts/reference/cm1/ingest_reference_pair.sh \
  --dry-input data/reference/cm1/runs/<local-dry-run> \
  --shallow-input data/reference/cm1/runs/<local-shallow-run> \
  --output data/reference/cm1/ingested \
  --public-output frontend/public/reference/cm1/local
```

Each input directory should contain either `cloud_lab_cm1_adapter_input.json`
or NetCDF CM1 output files (`*.nc`) readable through an optional local `xarray`
install. The default Cloud Lab backend/frontend installs still do not require
CM1, xarray, or NetCDF libraries.

The ingestion command maps selected CM1-like output into:

```text
reference-run-v1
reference-frame-v1
reference-diagnostics-v1
```

Do not point the frontend directly at raw CM1 output. The Cloud Lab reference
adapter should preserve units, field provenance, source case id, assumptions,
and missing-field warnings first.

The command also writes an ignored local frontend index under:

```text
frontend/public/reference/cm1/local/index.json
```

When that index exists, the Vite app prefers real local ingested CM1 artifacts
over the tiny synthetic fixture. When it is absent, the app keeps the fixture
available only as a clearly labeled synthetic/demo view.

## Troubleshooting

| Symptom | Likely cause | Next step |
| --- | --- | --- |
| `gfortran: command not found` | Fortran compiler is missing or not on `PATH`. | Install a compiler, for example through Homebrew `gcc`, then rerun the environment check. |
| `mpifort: command not found` | MPI compiler wrappers are missing. | Install/configure MPI or build without `USE_MPI=true`. |
| NetCDF symbols or modules are missing | NetCDF C/Fortran libraries are missing or not discoverable by the CM1 Makefile. | Install `netcdf` and `netcdf-fortran`; inspect `nf-config` / `nc-config` paths. |
| `You have requested netcdf output, but you have not compiled the code with netcdf capability` | The case requests `output_format = 2`, but `cm1.exe` was not built with NetCDF. | Enable the NetCDF section in CM1 `src/Makefile`, run `make clean`, rebuild with `USE_NETCDF=true`, and rerun. |
| `There was an error opening the LANDUSE.TBL file` | `LANDUSE.TBL` is not beside `cm1.exe` in the run directory. | Point `--cm1-run-dir` at a CM1 `run` directory containing `LANDUSE.TBL`; the script copies it into generated run directories. |
| `zmax of sounding < zmax of grid` | The case `input_sounding` does not extend high enough for the configured grid. | Add a final sounding level at or above the grid top; the committed reference pair now validates this. |
| CM1 exits but no `.nc` files are produced | NetCDF output was requested but CM1 failed early or wrote a different output type. | Inspect `cm1.stdout.log` and `cm1.stderr.log`; rerun after fixing NetCDF build/runtime support. |
| CM1 runs but output is hard to find | Output remained in the CM1 `run` directory or local case run directory. | Use `scripts/reference/cm1/run_cm1_case.sh --execute` with an explicit ignored `--output-dir`. |
| A later run overwrites output | The same run directory was reused. | Use timestamped output directories or pass a new `--output-dir`. |
| Output files are too large | Domain, output fields, or output cadence are too large for a local reference attempt. | Reduce domain/resolution/output frequency before generating committed manifests. |

## Related Docs

- `docs/reference-models/cm1.md`
- `docs/reference-models/cm1-lower-atmosphere-cases.md`
- `docs/lower-atmosphere-modeling-strategy.md`
- `docs/simulation-data-model.md`

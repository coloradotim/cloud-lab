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

For MPI:

```bash
scripts/reference/cm1/run_cm1_case.sh \
  --case-dir reference/cm1/cases/example-case \
  --cm1-run-dir ~/src/cm1/CM1/run \
  --mpi-procs 4 \
  --execute
```

The example case directory above is illustrative. Issue #208 should add the
first real dry-failed and shallow-cumulus case assets.

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

After a real case is generated, later work should create or update a manifest
with:

```text
case_id
case_name
cm1_version
created_at
local_output_path
expected_output_files
required_fields
diagnostics_to_compute
notes
```

Then the #179 adapter should map selected CM1-like output into:

```text
reference-run-v1
reference-frame-v1
reference-diagnostics-v1
```

Do not point the frontend directly at raw CM1 output. The Cloud Lab reference
adapter should preserve units, field provenance, source case id, assumptions,
and missing-field warnings first.

## Troubleshooting

| Symptom | Likely cause | Next step |
| --- | --- | --- |
| `gfortran: command not found` | Fortran compiler is missing or not on `PATH`. | Install a compiler, for example through Homebrew `gcc`, then rerun the environment check. |
| `mpifort: command not found` | MPI compiler wrappers are missing. | Install/configure MPI or build without `USE_MPI=true`. |
| NetCDF symbols or modules are missing | NetCDF C/Fortran libraries are missing or not discoverable by the CM1 Makefile. | Install `netcdf` and `netcdf-fortran`; inspect `nf-config` / `nc-config` paths. |
| CM1 runs but output is hard to find | Output remained in the CM1 `run` directory or local case run directory. | Use `scripts/reference/cm1/run_cm1_case.sh --execute` with an explicit ignored `--output-dir`. |
| A later run overwrites output | The same run directory was reused. | Use timestamped output directories or pass a new `--output-dir`. |
| Output files are too large | Domain, output fields, or output cadence are too large for a local reference attempt. | Reduce domain/resolution/output frequency before generating committed manifests. |

## Related Docs

- `docs/reference-models/cm1.md`
- `docs/reference-models/cm1-lower-atmosphere-cases.md`
- `docs/lower-atmosphere-modeling-strategy.md`
- `docs/simulation-data-model.md`

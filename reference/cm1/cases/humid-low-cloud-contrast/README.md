# Humid Low-Cloud Contrast

Case id: `cm1-humid-low-cloud-contrast-v1`

## Purpose

Prepare the Phase B CM1 validation anchor for a humid lower atmosphere that
should produce a lower cloud base and easier cloud formation than the baseline.

## Physical Question

How does high near-surface humidity lower the LCL and make low cloud easier to
form?

## Expected Outcome

- Cloud forms readily under moderate heating.
- Cloud base is lower than the accepted shallow-cumulus baseline.
- Cloud liquid water is visible and diagnosable.
- The case remains labeled as a humid contrast, not the default fair-weather
  baseline.

## Configuration Concept

This case starts from the shallow-cumulus baseline grid, runtime, output cadence,
and open-domain setup, then increases lower-layer moisture and keeps forcing
moderate. It is a validation anchor for the high-moisture / low-LCL end of the
user-facing control range.

## Required Output Fields

- time
- x/z grid coordinates
- temperature or potential temperature
- water vapor / mixing ratio
- cloud liquid water
- vertical velocity
- horizontal velocity if available
- pressure or pressure-derived metadata if available

## Required Diagnostics

- first cloud time
- cloud base
- cloud top
- max cloud liquid water
- max updraft
- low-LCL / humid contrast label
- integrated cloud water

## Run

```bash
scripts/reference/cm1/run_cm1_case.sh \
  --case-dir reference/cm1/cases/humid-low-cloud-contrast \
  --cm1-run-dir ~/src/cm1/CM1/run
```

Add `--execute` to run locally.

## Ingest Later

After local output exists, ingest selected fields through the #179 CM1 reference
adapter. Do not point the frontend directly at raw CM1 output.

## Known Limitations

This is a first-pass Phase B validation-anchor configuration. Real CM1 output
must be generated and inspected before the case is marked accepted. If the case
drifts into widespread stratus/fog-like cloud, keep that as calibration evidence
and do not silently relabel it as the baseline.

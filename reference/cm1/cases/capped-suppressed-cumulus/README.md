# Capped / Suppressed Cumulus

Case id: `cm1-capped-suppressed-cumulus-v1`

## Purpose

Prepare the Phase B CM1 validation anchor for a capped or suppressed shallow
cloud experiment.

## Physical Question

How does a stable layer above a moist lower atmosphere delay, flatten, or
suppress shallow-cloud growth?

## Expected Outcome

- Rising motion encounters a stronger cap/stable layer.
- Cloud is delayed, shallow/capped, or suppressed.
- Cloud top, if present, remains below or near the cap.
- First cloud time, cloud base/top, max updraft, max cloud water, and cap
  relationship can be inspected.

## Configuration Concept

This case starts from the shallow-cumulus baseline grid, runtime, output cadence,
and general surface-forcing shape, then adds a stronger stable layer/inversion
near the expected shallow-cloud growth region. It is a validation anchor for the
cap-strength control, not a tuned accepted reference case.

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

- first cloud time, if any
- cloud base/top, if any
- cloud top relative to cap/inversion
- max cloud liquid water
- max updraft
- cap/suppression status
- integrated cloud water

## Run

```bash
scripts/reference/cm1/run_cm1_case.sh \
  --case-dir reference/cm1/cases/capped-suppressed-cumulus \
  --cm1-run-dir ~/src/cm1/CM1/run
```

Add `--execute` to run locally.

## Ingest Later

After local output exists, ingest selected fields through the #179 CM1 reference
adapter. Do not point the frontend directly at raw CM1 output.

## Known Limitations

This is a first-pass Phase B validation-anchor configuration. Real CM1 output
must be generated and inspected before the case is marked accepted. If the case
forms a deep uncapped cloud or remains dynamically inert, mark it `needs
calibration` rather than changing reduced-model science in this issue.

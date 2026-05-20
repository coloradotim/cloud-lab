# Shallow Cumulus Baseline

Case id: `cm1-shallow-cumulus-baseline-v1`

## Purpose

Generate the first Cloud Lab CM1 shallow-cumulus baseline reference case for
scientific 2-D cloud visualization.

## Physical Question

How do lower-atmosphere heating and moisture produce visible shallow cumulus?

## Expected Outcome

- Shallow cumulus forms from lower-atmosphere heating and moisture.
- Cloud liquid water is visible in the 2-D field.
- Cloud base and cloud top are diagnosable.
- First cloud time, max updraft, max cloud water, and integrated cloud water
  can be computed.

## Configuration Concept

This case uses the same cloud-scale grid, runtime, and output cadence as the dry-failed
case, but with a moister lower layer and stronger moisture supply. The intended
teaching contrast is cloud/no-cloud outcome, not exact cell placement.

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
- integrated cloud water

## Run

```bash
scripts/reference/cm1/run_cm1_case.sh \
  --case-dir reference/cm1/cases/shallow-cumulus-baseline \
  --cm1-run-dir ~/src/cm1/CM1/run
```

Add `--execute` to run locally.

## Ingest Later

After local output exists, ingest selected fields through the #179 CM1 reference
adapter. Do not point the frontend directly at raw CM1 output.

## Known Limitations

This is a first-pass local reference configuration. It may require tuning after
the first output inspection to keep the case shallow, visually clear, and
diagnostically useful.

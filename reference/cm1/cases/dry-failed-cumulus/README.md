# Dry Failed Cumulus

Case id: `cm1-dry-failed-cumulus-v1`

## Purpose

Show rising lower-atmosphere motion without enough moisture to produce
meaningful cloud liquid water.

## Physical Question

How can heating and thermal activity occur while shallow cumulus fails because
the lower atmosphere remains too dry or the LCL stays too high?

## Expected Outcome

- Rising motion / thermal activity is present.
- Cloud liquid water remains absent or negligible.
- No first cloud time is diagnosed.
- LCL or saturation state remains unfavorable.

## Configuration Concept

This case uses the same cloud-scale grid, output cadence, and basic forcing shape as the
shallow-cumulus baseline, but with a drier moisture profile and weaker latent
moisture supply. The contrast should be interpreted through diagnostics rather
than exact turbulent morphology.

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

- max updraft
- no / negligible cloud water
- no first cloud time
- high LCL or unfavorable saturation state

## Run

```bash
scripts/reference/cm1/run_cm1_case.sh \
  --case-dir reference/cm1/cases/dry-failed-cumulus \
  --cm1-run-dir ~/src/cm1/CM1/run
```

Add `--execute` to run locally.

## Ingest Later

After local output exists, ingest selected fields through the #179 CM1 reference
adapter. Do not point the frontend directly at raw CM1 output.

## Known Limitations

This is a first-pass local reference configuration. Tiny numerical or transient
cloud liquid water should be evaluated against an explicit threshold before
declaring the case failed.

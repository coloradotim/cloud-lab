# Low Stratus Develops

Case id: `cm1-low-stratus-develops-v1`

## Purpose

Prepare the Phase B CM1 validation anchor for low-cloud behavior beyond
fair-weather cumulus.

## Physical Question

How can a very moist, shallow stable lower atmosphere produce low stratus-like
cloud rather than isolated fair-weather cumulus?

## Expected Outcome

- Low cloud or stratus-like cloud develops near the lower atmosphere.
- Cloud depth remains shallow compared with the baseline cumulus case.
- Vertical motion is weak to moderate rather than a strong thermal plume.
- The honest user-facing label is low stratus unless generated output clearly
  supports a surface-fog interpretation.

## Configuration Concept

This case uses the same cloud-scale CM1 framework as the Phase A pair but chooses a
very moist shallow layer, weak heating, and a stable lower-atmosphere profile.
Because this is not a radiative-cooling fog setup, the committed case is named
low stratus rather than fog.

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

- first low-cloud time, if available
- low cloud base/top or near-surface cloud depth
- max cloud liquid water
- max updraft
- low-cloud/stratus status label
- integrated cloud water

## Run

```bash
scripts/reference/cm1/run_cm1_case.sh \
  --case-dir reference/cm1/cases/low-stratus-develops \
  --cm1-run-dir ~/src/cm1/CM1/run
```

Add `--execute` to run locally.

## Ingest Later

After local output exists, ingest selected fields through the #179 CM1 reference
adapter. Do not point the frontend directly at raw CM1 output.

## Known Limitations

This is a first-pass Phase B validation-anchor configuration. Real CM1 output
must be generated and inspected before the case is marked accepted. If generated
output does not produce a low-cloud regime, mark it `needs calibration`. Do not
claim fog unless cloud is truly surface-attached and the setup supports that
label.

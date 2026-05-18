# Microphysics Comparison

Cloud Lab now has a repeatable comparison command for controlled warm-cloud bulk
microphysics cases:

```bash
cd backend
python -m app.sim.microphysics_comparison --json
```

The comparison is intentionally narrow. It compares:

- `simple_saturation_adjustment`: instant saturation adjustment with latent heating
  and no rain conversion.
- `microphysics_lab`: the production controlled parcel/box mode with instant
  saturation adjustment, latent heating, and simple bulk rain autoconversion.

No PySDM result is included yet. The comparison therefore does not validate
droplet-resolved growth, collision/coalescence, or size distributions. It quantifies
what the current bulk placeholder can and cannot tell us.

Use the [testing and validation plan](testing-and-validation.md) for the broader
policy on when microphysics checks are hard failures, diagnostics, or
manual/science validation.

## Thermodynamic Forcing Fix

Earlier `microphysics_lab` treated `surface_heating.max_warming_rate_k_per_s` as a
uniform heat source attached to the parcel for the entire ascent. That could produce
unphysical behavior, for example a parcel lifted to `3600 m` with `0.025 K s-1`
heating could finish near `79 deg C` because the heating added about `90 K` over one
hour.

The lab now treats that field as a lower-boundary heating tendency that tapers to
zero by the configured boundary-layer top. A lifted parcel can still be warmed while
near the surface, but heating no longer follows it indefinitely through the column.

Regression coverage checks that a parcel lifted to `3600 m` cools even when the
heating slider is at its current maximum.

## Comparison Cases

| Case | RH | w | Duration | Purpose |
| --- | ---: | ---: | ---: | --- |
| Gentle cooling / low supersaturation | `0.90` | `0.20 m s-1` | `1200 s` | Condensation onset without rain. |
| Stronger cooling / high supersaturation | `0.99` | `1.00 m s-1` | `1800 s` | Faster condensation and larger cloud water. |
| Prescribed updraft history | `0.98` | `0.75 m s-1` | `2400 s` | Repeatable constant-lift path until time-varying forcing exists. |
| Rain-initiation stress | `1.00` | `1.40 m s-1` | `2400 s` | Exercises the current bulk autoconversion placeholder. |

All cases use `microphysics_lab` configuration and remain decoupled from
`boussinesq_2d`.

## Metrics

Each model/case emits:

- time of first cloud water
- maximum cloud liquid water
- integrated cloud liquid water over time
- water vapor depletion
- time of first rain water
- maximum rain water
- integrated rain water over time
- total-water initial/final budget and final drift
- subcloud evaporation proxy
- bulk autoconversion threshold
- precipitation status and reason for the `microphysics_lab` path
- final temperature
- final parcel height

The `microphysics_lab` metrics use the shared `microphysics-diagnostics-v1`
contract from `backend/app/sim/microphysics_diagnostics.py`. The simple
saturation-adjustment baseline reports matching scalar budget fields where
possible, but it does not assign a precipitation status because it has no rain
conversion path.

## Current Results

Representative local results:

| Case | Model | First cloud | Max cloud | Integrated cloud | Vapor depletion | Max rain | Final temp |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Gentle cooling / low supersaturation | simple | `900 s` | `6.574e-4` | `1.043e-1` | `6.574e-4` | `0.000e+0` | `23.44 deg C` |
| Gentle cooling / low supersaturation | lab | `900 s` | `6.574e-4` | `1.043e-1` | `6.574e-4` | `0.000e+0` | `23.44 deg C` |
| Stronger cooling / high supersaturation | simple | `60 s` | `1.111e-2` | `1.235e+1` | `7.845e-3` | `0.000e+0` | `16.77 deg C` |
| Stronger cooling / high supersaturation | lab | `60 s` | `6.698e-3` | `8.614e+0` | `7.822e-3` | `4.707e-3` | `16.75 deg C` |
| Prescribed updraft history | simple | `60 s` | `1.076e-2` | `1.575e+1` | `7.671e-3` | `0.000e+0` | `16.57 deg C` |
| Prescribed updraft history | lab | `60 s` | `5.858e-3` | `9.839e+0` | `7.667e-3` | `5.341e-3` | `16.56 deg C` |
| Rain-initiation stress | simple | `1020 s` | `1.315e-2` | `1.298e+1` | `1.315e-2` | `0.000e+0` | `7.85 deg C` |
| Rain-initiation stress | lab | `1080 s` | `3.890e-3` | `4.512e+0` | `1.315e-2` | `9.963e-3` | `7.85 deg C` |

Mixing ratios are `kg kg-1`; integrated cloud is `kg kg-1 s`.

The representative table remains a compact narrative summary. The machine-readable
JSON includes the broader diagnostics contract, including rain integral, water
budget, status/reason, and autoconversion threshold fields.

## What The Simple Model Gets Right

- Condensation timing is tied to prescribed lift, cooling, and initial humidity.
- Vapor depletion and cloud water are reproducible for fixed configurations.
- In non-raining cases, the simple and lab paths agree because both are bulk
  saturation-adjustment models.

## What The Simple Model Gets Wrong Or Cannot Show

- Condensation appears instantly as bulk cloud water once saturation is exceeded.
- There is no droplet activation, size distribution, mean radius, or effective radius.
- There is no collision/coalescence physics.
- The simple comparison path has no rain conversion at all.
- `microphysics_lab` rain is still a bulk autoconversion placeholder, not a
  droplet-resolved rain-initiation result.

## Implications

The comparison supports keeping `microphysics_lab` separate from `boussinesq_2d` and
using it for controlled science diagnostics first. The next meaningful physics step
is not tuning the current bulk model harder; it is adding or evaluating a
droplet-aware path, then exposing optional distribution outputs through the schema in
`docs/microphysics-schema.md`.

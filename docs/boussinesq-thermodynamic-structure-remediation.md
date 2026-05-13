# Boussinesq Thermodynamic Structure Remediation

Issue: #154

This report diagnoses the current humid Boussinesq cloud-placement failure without changing solver physics, scenario presets, validation thresholds, or the existing `xfail`.

## Summary

The xfailed reference check is:

```text
backend/tests/test_boussinesq_validation.py::test_humid_boussinesq_reference_cloud_maximum_is_aloft
```

Its current expectation is that the `isolated-fair-weather-cumulus` reference case places maximum cloud liquid water at or above the configured boundary-layer top of `1500 m`.

Current evidence does not support that expectation for the existing prototype/configuration. The run produces a shallow, bounded, two-region cloud field, but the cloud remains at `687.5 m`. That height is above the current fixed-pressure diagnostic LCL, not below it, but it is far below the configured boundary-layer top. The primary issue is therefore not "cloud below LCL" in the current diagnostic frame. It is a mismatch between the reference-case expectation and the current solver/configuration's shallow cloud response.

Likely contributing mechanisms:

- the reference expectation uses boundary-layer-top height as a cloud-placement target, while the current solver only produces shallow cloud in the strongest lower-level updrafts
- source-layer vapor initialization for `surface_moisture` is capped against local saturation, making the source layer intentionally subsaturated above the diagnostic LCL
- the diagnostic LCL uses a fixed `900 hPa` saturation curve and a surface parcel; it does not represent the initialized vertical vapor cap or pressure variation with height
- condensation is gated by local updraft and happens after advection/diffusion/velocity update, so cloud appears only where the resolved updraft has made a grid cell just supersaturated
- the current vertical transport in this reference case is too weak to carry condensate or saturation to the boundary-layer top by the configured runtime

Pressure-aware saturation/LCL work is required, but it is probably not sufficient by itself. The case also needs a revised cloud-placement contract, or later solver/transport remediation, before this `xfail` can honestly be removed.

## Commands Run

Required thermodynamic report:

```bash
cd backend
.venv/bin/python -m app.sim.validation --thermodynamics --json
```

Focused read-only diagnostic for the exact xfailed reference case:

```bash
cd backend
.venv/bin/python - <<'PY'
from app.sim import boussinesq_reference_cases, run_simulation

case = next(c for c in boussinesq_reference_cases() if c.slug == "isolated-fair-weather-cumulus")
frames = run_simulation(case.config)
print(case.config)
print(len(frames))
PY
```

The actual focused diagnostic included local sampling of the first-cloud cell, final max-cloud cell, onset profile, and current fixed-pressure RH. It did not modify code or persisted artifacts.

## Reference Case Tested

```text
slug: isolated-fair-weather-cumulus
name: Isolated fair-weather cumulus
expected regime: isolated_cumulus
description: Moderately humid paired thermals; should form separated shallow clouds.
```

This is the humid reference case used by the `xfail`.

## Config Used

```text
schema_version: sim-config-v1
solver_type: boussinesq_2d

domain:
  width_m: 10000
  height_m: 3000

grid:
  columns: 36
  rows: 24
  dz: 125 m

time:
  time_step_seconds: 2
  duration_seconds: 1200
  frame_interval_seconds: 30

initial_atmosphere:
  surface_temperature_k: 298.15
  lapse_rate_k_per_m: 0.0065
  relative_humidity: 0.85
  boundary_layer_depth_m: 1500
  moist_source_layer_depth_m: 800
  free_atmosphere_relative_humidity: 0.55
  humidity_profile: surface_moisture

surface_heating:
  max_warming_rate_k_per_s: 0.024
  patch_center_x_m: 5000
  patch_width_m: 2000
  pattern: two_patches

background_wind:
  u_m_per_s: 0.15
  w_m_per_s: 0

seed: 17
```

## Current Diagnostic Values

| Metric | Value |
| --- | ---: |
| Expected LCL, current fixed `900 hPa` diagnostic | `271.7 m` |
| Approximate pressure-aware LCL sensitivity, simple scale-height pressure | `339.4 m` |
| First cloud time | `960 s` |
| First cloud height | `687.5 m` |
| First cloud minus fixed-pressure LCL | `+415.8 m` |
| Cloud-water centroid height | `687.5 m` |
| Height of max cloud water | `687.5 m` |
| Cloud base heights | `687.5 m`, `687.5 m` |
| Cloud top heights | `687.5 m`, `687.5 m` |
| Cloud region count | `2` |
| Max cloud liquid water | `1.048769e-4 kg kg-1` |
| Total cloud liquid water | `2.696581e-4 kg kg-1` |
| Cloud water below LCL | `0.0` |
| Cloud water near LCL | `0.0` |
| Cloud water above LCL | `1.0` |
| Boundary cloud fraction | `0.0` |
| Return-flow cloud fraction | `0.0` |
| Max vertical velocity, final frame | `0.404 m s-1` |
| Final max-cloud-cell vertical velocity | `0.196 m s-1` |

## Temperature / RH Profile At Onset

The first cloud appears at `960 s`. Values below use the current fixed-`900 hPa` saturation diagnostic.

| Height | Mean temperature | Mean RH | Max RH | Max cloud water | Max w |
| ---: | ---: | ---: | ---: | ---: | ---: |
| `62.5 m` | `300.78 K` | `0.735` | `0.877` | `0.0` | `0.000 m s-1` |
| `187.5 m` | `298.59 K` | `0.822` | `0.931` | `0.0` | `0.238 m s-1` |
| `312.5 m` | `296.14 K` | `0.917` | `0.964` | `0.0` | `0.292 m s-1` |
| `437.5 m` | `294.33 K` | `0.964` | `0.977` | `0.0` | `0.244 m s-1` |
| `562.5 m` | `292.84 K` | `0.980` | `0.995` | `0.0` | `0.170 m s-1` |
| `687.5 m` | `291.51 K` | `0.981` | `1.000` | `5.21e-6` | `0.108 m s-1` |
| `812.5 m` | `290.24 K` | `0.960` | `0.976` | `0.0` | `0.066 m s-1` |
| `937.5 m` | `289.00 K` | `0.877` | `0.890` | `0.0` | `0.041 m s-1` |
| `1062.5 m` | `287.76 K` | `0.698` | `0.713` | `0.0` | `0.025 m s-1` |
| `1187.5 m` | `286.53 K` | `0.594` | `0.602` | `0.0` | `0.016 m s-1` |
| `1312.5 m` | `285.30 K` | `0.561` | `0.565` | `0.0` | `0.011 m s-1` |
| `1437.5 m` | `284.07 K` | `0.557` | `0.558` | `0.0` | `0.007 m s-1` |
| `1562.5 m` | `283.05 K` | `0.555` | `0.556` | `0.0` | `0.004 m s-1` |
| `1687.5 m` | `282.23 K` | `0.552` | `0.553` | `0.0` | `0.003 m s-1` |

The onset profile shows a shallow saturated layer near `687.5 m` and much drier air around the configured boundary-layer top. At and above roughly `1062.5 m`, RH is near the free-atmosphere value rather than a moist mixed-layer value.

## Onset And Max-Cloud Cell Samples

### First Cloud Cell

```text
time: 960 s
x: 2916.7 m
z: 687.5 m
temperature: 291.46 K / 18.31 C
theta perturbation: 0.049 K
water vapor: 0.014667 kg kg-1
fixed-pressure saturation: 0.014666 kg kg-1
fixed-pressure RH: 1.000052
cloud liquid water: 5.21e-6 kg kg-1
vertical velocity: 0.090 m s-1
horizontal velocity: 0.032 m s-1
flow-region classification: updraft
boundary cell: false
below boundary-layer top: true
```

### Final Max-Cloud Cell

```text
time: 1200 s
x: 7361.1 m
z: 687.5 m
temperature: 291.70 K / 18.55 C
theta perturbation: 0.291 K
water vapor: 0.014895 kg kg-1
fixed-pressure saturation: 0.014892 kg kg-1
fixed-pressure RH: 1.000164
cloud liquid water: 1.05e-4 kg kg-1
vertical velocity: 0.196 m s-1
horizontal velocity: 0.086 m s-1
flow-region classification: updraft
boundary cell: false
below boundary-layer top: true
```

## What The `xfail` Is Actually Showing

The xfailed assertion expects:

```text
max_cloud_liquid_water_height_m >= boundary_layer_depth_m
```

For this case:

```text
max_cloud_liquid_water_height_m = 687.5 m
boundary_layer_depth_m = 1500 m
```

The failure is not caused by cloud forming below the current expected LCL. In fact:

```text
expected_lcl_m = 271.7 m
first_cloud_height_m = 687.5 m
first_cloud_lcl_delta_m = +415.8 m
below_lcl_cloud_fraction = 0.0
above_lcl_cloud_fraction = 1.0
```

The failure is that the prototype produces a shallow cumulus layer well below the boundary-layer top, while the validation test currently treats boundary-layer-top placement as the target for peak cloud water.

## Mechanism Assessment

| Candidate mechanism | Current assessment |
| --- | --- |
| Fixed-pressure saturation calculation | Contributing. Current solver and diagnostics use fixed `900 hPa`; simple pressure-aware sensitivity raises the LCL estimate from `271.7 m` to about `339.4 m`, but this alone does not explain the gap to `1500 m`. |
| LCL diagnostic mismatch | Contributing. The diagnostic LCL is a surface-parcel calculation, while `surface_moisture` initialization caps vapor by local saturation aloft. That makes the initialized source layer not equivalent to a conserved well-mixed parcel. |
| Vertical temperature profile | Contributing context. The mixed/source layer is dry adiabatic in temperature, but vapor is not conserved through the full boundary-layer depth because it transitions from source-layer vapor to drier free-atmosphere vapor above `800 m`. |
| Vapor initialization | Major contributor. For `surface_moisture`, source vapor is capped at `0.98 * local_saturation`, preventing initial supersaturation above the low diagnostic LCL. Above the source layer, vapor transitions to the drier free atmosphere. |
| Condensation threshold | Minor to moderate contributor. Condensation requires local supersaturation and either resolved updraft above `0.002 m s-1` or existing cloud. At onset the updraft condition is met, so the threshold is not blocking cloud at `687.5 m`, but it localizes condensation to resolved updraft cells. |
| Order of advection/diffusion/saturation adjustment | Contributing. Vapor and cloud are advected and diffused before condensation. Saturation adjustment occurs after velocity and parcel-temperature updates, so cloud forms only after local transport/cooling reaches supersaturation. |
| Vertical transport weakness | Major contributor. Vertical velocity is strongest below roughly `300-700 m` and weakens toward the boundary-layer top; at onset, max `w` near `1437.5 m` is only `0.007 m s-1`. The model does not carry enough moisture/cooling to produce cloud near `1500 m`. |
| Excessive thermal/moisture diffusion | Plausible contributor, not isolated by this issue. Diffusion and damping help keep the prototype stable but may smooth moisture/thermal anomalies before deeper cloud growth. This belongs with stabilizer review in #159 if it remains important. |
| Boundary or return-flow artifacts | Not the primary cause here. Boundary cloud fraction and return-flow cloud fraction are both `0.0`; onset and final max-cloud cells are interior updraft cells. |
| Validation expectation wrong | Likely contributor. Requiring peak cloud water at or above the boundary-layer top is too strong for the current reference case and may not be the best Fair-Weather contract. Cloud should be evaluated against LCL, source-layer structure, cloud depth, and scenario intent rather than BL top alone. |
| Scenario config too close to edge case | Contributing. The source layer is `800 m`, the boundary-layer top is `1500 m`, and free atmosphere RH is `0.55`; the profile is explicitly drier above the source layer. That config does not strongly support peak cloud water near the boundary-layer top. |

## Diagnostic Conclusion

Primary classification:

```text
validation expectation + profile/initialization mismatch + vertical transport limitation
```

Secondary classification:

```text
fixed-pressure saturation/LCL approximation
```

Not primary for this case:

```text
boundary artifact
return-flow artifact
cloud below current diagnostic LCL
negative moisture
non-finite fields
```

The current run is physically bounded and numerically sane, but it is not satisfying the old "peak cloud water at boundary-layer top" validation idea. That expectation should remain xfailed until the project decides whether Lower Atmosphere Cloud Basics wants cloud placement relative to LCL, cloud depth, boundary-layer top, or a more nuanced scenario contract.

## Recommended Remediation

### 1. Keep the `xfail` until a real fix or contract change lands

Do not remove or weaken:

```text
test_humid_boussinesq_reference_cloud_maximum_is_aloft
```

The current failure documents a real trust gap. Removing it without a replacement would hide the Yellow status.

### 2. Implement pressure-aware saturation and LCL consistently in #155

Pressure-aware saturation/LCL work is required because the current fixed `900 hPa` curve is only a prototype consistency check. #155 should update solver and diagnostics together, or clearly document any transitional mismatch.

However, pressure-aware LCL is not expected to solve the whole issue alone. The simple sensitivity check moved LCL from `271.7 m` to about `339.4 m`, still far below the `1500 m` boundary-layer top.

### 3. Add an initialized-profile diagnostic before changing expectations

Before replacing the xfailed expectation, add diagnostics that report:

- initialized RH by height
- source-layer vapor conservation or non-conservation
- saturation cap effects by row
- effective source-layer top and transition layer
- LCL estimated from the actual initialized vapor profile, not only the surface parcel

This would make it clear when a case is not well mixed enough for shared cloud-base assumptions.

### 4. Reframe the humid reference contract

Consider replacing the boundary-layer-top peak-cloud expectation with a staged contract:

- cloud forms above expected LCL, within calibrated tolerance
- cloud does not form at the surface initially
- cloud remains interior, not boundary/return-flow dominated
- cloud top and max-cloud height are plausible for the configured source layer and free-atmosphere humidity
- stronger/deeper/moister variants produce deeper clouds than the baseline

This reframing should be a deliberate validation change, not part of #154.

### 5. Investigate vertical transport and stabilizer influence after thermodynamics

If #155 does not substantially improve interpretability, investigate:

- whether parcel-lift cooling is too weak or decays too quickly
- whether moisture/thermal diffusion suppresses deeper cloud growth
- whether vorticity damping, thermal relaxation, or top sponge indirectly limit vertical development
- whether source-layer depth and free-atmosphere humidity should be tested through paired controlled cases

These likely belong to #156, #158, or #159 depending on the specific hypothesis.

## Follow-Up Ownership

- #155: pressure-aware saturation and LCL thermodynamics
- #156: stable/capped suppression validation and paired profile relationships
- #157: return-flow and boundary cloud-water policy
- #158: resolution/domain sensitivity
- #159: stabilizer, safety-cap, and damping influence
- #160: successor dynamics path if Boussinesq remains Yellow

## Explicit Non-Changes

- Solver physics was not changed.
- Scenario presets were not changed.
- Validation thresholds were not changed.
- The existing `xfail` was not removed.
- No new follow-on GitHub issues were created.

## Post-#155 Update

Issue #155 implemented the first pressure-aware thermodynamic remediation:

- Boussinesq warm-cloud saturation now uses a shared helper with a height-dependent hydrostatic pressure profile anchored to the prototype's historical `900 hPa` reference pressure.
- Condensation and validation diagnostics now share that pressure-aware saturation path.
- LCL diagnostics now dry-lift the surface parcel through the same pressure profile.
- The thermodynamic validation report now exposes initialized pressure, temperature, vapor, RH, source-layer vapor-conservation, saturation-cap, effective-source-layer-top, transition-layer, and initialized-profile saturation diagnostics.
- Condensation uses local pressure plus a bounded parcel-lift saturation-temperature signal; the actual cell temperature is changed only by latent heating/evaporation, not by replacing it with the diagnostic lifted temperature.

After #155, pressure-aware LCL for the `isolated-fair-weather-cumulus` reference case is about `336 m`. The reference still forms bounded shallow cloud and still preserves the existing boundary-layer-top `xfail`; the maximum cloud water remains below the configured `1500 m` boundary-layer top.

The remaining humid-reference trust gap is therefore narrower:

- not primarily a fixed-pressure thermodynamics issue
- still partly an initialized-profile/source-layer issue, because source-layer vapor is capped and not conserved with height
- still partly a vertical-transport/scenario-contract issue, because the strongest condensate remains shallow
- still partly a return-flow/diagnostic-policy issue, because the thermodynamic report can warn about low-level return-flow cloud water

Do not remove the old boundary-layer-top `xfail` until a replacement Fair-Weather scenario contract is approved.

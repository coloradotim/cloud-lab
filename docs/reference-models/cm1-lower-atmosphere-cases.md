# CM1 Lower-Atmosphere Visual Reference Case Library

Issue: #180

This document defines the first CM1 lower-atmosphere visual reference case
library for Cloud Lab.

It is a design and documentation contract. It does not run CM1, add model
output files, implement adapter code, or claim that Cloud Lab already has these
reference datasets.

## Purpose

Cloud Lab's product loop is:

```text
Choose lab -> choose scenario -> adjust physical controls -> run -> watch -> inspect -> save/compare -> vary -> learn
```

For realistic lower-atmosphere cloud visualization, Cloud Lab needs credible
2-D cloud fields. The reduced-model stack explains why clouds form or fail, and
it supports fast interaction, but CM1 reference output should anchor realistic
2-D cloud evolution.

The reference case library should support:

```text
credible visual cloud evolution
clear scenario contrast
diagnostics that teach
future comparison against reduced models
future cloud appearance rendering
```

Reduced models do not need to match exact CM1 morphology. They should match the
teaching-relevant relationships and diagnostics: cloud or no-cloud outcome,
cloud-base tendency, cloud-top tendency, timing, moisture/stability sensitivity,
updraft strength, and precipitation onset where relevant.

## Consumption Path

Cloud Lab should consume these cases through the reference stack:

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
future cloud appearance / 2.5-D rendering
  ->
comparison against interactive reduced models
```

Reference cases are offline datasets. They are not live interactive simulations,
and normal Cloud Lab sessions should not require CM1. Reference cases are used
to anchor validation, visual understanding, and later comparison. Interactive
reduced models should remain fast and explanatory.

## Case Priorities

| Priority | Meaning |
| --- | --- |
| Immediate | Needed for the first credible visual CM1 path and first reference pair. |
| Early | Useful soon after the immediate pair to cover common teaching contrasts. |
| Later | Valuable after ingestion, replay, and comparison paths are stable. |

The first priority is the immediate pair:

```text
dry failed cumulus
shallow cumulus baseline
```

This pair should show why similar-looking lower-atmosphere setups can produce
different outcomes: one produces thermal motion without cloud, while the other
forms shallow cumulus.

## Case Summary

| Case id | User-facing name | Lab served | Priority | Expected visual behavior |
| --- | --- | --- | --- | --- |
| `cm1-dry-failed-cumulus-v1` | Dry Failed Cumulus | Lower Atmosphere Cloud Basics | Immediate | Rising motion without meaningful cloud liquid water. |
| `cm1-shallow-cumulus-baseline-v1` | Shallow Cumulus Baseline | Lower Atmosphere Cloud Basics | Immediate | Shallow cumulus forms, grows, and decays in a 2-D field. |
| `cm1-dry-thermal-clear-motion-v1` | Dry Thermal / Clear Motion | Lower Atmosphere Cloud Basics; Evolving Boundary Layer | Immediate or early | Buoyant motion remains cloud-free. |
| `cm1-capped-suppressed-cumulus-v1` | Capped / Suppressed Cumulus | Lower Atmosphere Cloud Basics | Early | Cloud is delayed, shallow, or suppressed below a stable layer. |
| `cm1-humid-low-cloud-contrast-v1` | Humid Low-Cloud Contrast | Lower Atmosphere Cloud Basics | Early | Lower cloud base and easier shallow-cloud formation than baseline. |
| `cm1-warm-rain-shallow-cloud-v1` | Warm-Rain Shallow Cloud | Warm Rain / Droplet Growth; Lower Atmosphere Cloud Basics | Later | Cloud water transitions toward rain water if the case supports warm-rain microphysics. |
| `cm1-orographic-terrain-lift-v1` | Orographic / Terrain Cloud | Orographic / Terrain Clouds | Later | Terrain-relative lift produces terrain-locked cloud where moisture and stability allow it. |

## Required Model Output Fields

| Field | Required for | Unit expectation | Notes |
| --- | --- | --- | --- |
| temperature or potential temperature | All cases | K | Preserve whether the source field is temperature, potential temperature, or perturbation plus base-state metadata. |
| water vapor / mixing ratio | All cases | kg kg-1 | Needed for moisture context and future RH derivation. |
| cloud liquid water | Cloud, no-cloud, optics, and comparison cases | kg kg-1 | Primary scientific cloud field and later appearance/optical-depth input. |
| rain water | Warm-rain cases; optional otherwise | kg kg-1 | Needed for rain onset and later rain-shaft visuals. |
| vertical velocity | All visual dynamics cases | m s-1 | Needed for max updraft and motion/updraft overlays. |
| horizontal velocity | Preferred for all 2-D cases | m s-1 | Useful for advection and flow interpretation; optional in earliest cases if unavailable. |
| pressure or pressure-derived metadata | Preferred for all cases | Pa or documented derived metadata | Useful for derived diagnostics and honest thermodynamic provenance. |
| grid coordinates | All cases | m | Need x and z coordinates, grid dimensions, and orientation. |
| time | All cases | s | Needed for replay, first cloud time, and first rain time. |
| terrain height | Terrain case | m | Required for orographic overlays and terrain-relative diagnostics. |
| droplet/effective radius | Microphysics/optics cases | m or micrometers, explicitly documented | Optional future field; if absent, optics must label assumed droplet properties. |

## Immediate Case 1: Dry Failed Cumulus

| Required detail | Definition |
| --- | --- |
| Case id | `cm1-dry-failed-cumulus-v1` |
| User-facing name | Dry Failed Cumulus |
| Lab served | Lower Atmosphere Cloud Basics |
| Physical question | How can heating and motion occur without enough moisture to form shallow cloud? |
| Intended phenomenon | Thermals or buoyant motion in a dry/subsaturated lower atmosphere with no meaningful cloud water. |
| Initial profile concept | Similar lower-atmosphere structure to the shallow-cumulus baseline, but with lower source-layer humidity, higher LCL, and a drier free atmosphere. |
| Forcing concept | Surface heating or thermal initiation strong enough to produce motion, but not enough to overcome the dry saturation deficit. |
| Expected qualitative behavior | Rising motion occurs, but saturation is not reached in a sustained way. |
| Expected visual behavior | Vertical velocity or thermal structure is visible; cloud liquid water remains absent or negligible. |
| Fields required from model output | time, x/z grid, temperature or theta, water vapor, cloud liquid water, vertical velocity, horizontal velocity if available, pressure metadata if available. |
| Diagnostics required | thermal rise indicator, max updraft, max cloud liquid water near zero, integrated cloud liquid water near zero, high LCL or unfavorable saturation state, no first cloud time. |
| Visualization modes supported | vertical velocity field, water vapor/RH field if derived, temperature/theta field, cloud liquid water field showing no meaningful cloud. |
| Optics relevance | Provides a zero-cloud or near-zero-cloud appearance baseline; cloud appearance view should remain clear when cloud water is negligible. |
| Comparison against reduced models | Compare dry-failed outcome, high LCL/unfavorable moisture, no first cloud time, and max updraft relationship. Do not require exact thermal morphology. |
| Validation use | Confirms the reference adapter/viewer can represent motion without inventing cloud. |
| Known limitations | A real CM1 dry-failed setup may still produce tiny numerical or transient condensate; Cloud Lab should document the threshold used for "meaningful" cloud. |
| Priority | Immediate |

## Immediate Case 2: Shallow Cumulus Baseline

| Required detail | Definition |
| --- | --- |
| Case id | `cm1-shallow-cumulus-baseline-v1` |
| User-facing name | Shallow Cumulus Baseline |
| Lab served | Lower Atmosphere Cloud Basics |
| Physical question | How do lower-atmosphere heating and moisture produce shallow cumulus? |
| Intended phenomenon | Shallow cumulus formation from a moist lower layer, drier air above, and surface or thermal forcing. |
| Initial profile concept | Moist lower layer with LCL reachable by thermals, drier free atmosphere above, and stability that permits shallow but limited growth. |
| Forcing concept | Surface heating or thermal initiation comparable to the dry-failed case so moisture is the main teaching contrast. |
| Expected qualitative behavior | Thermals reach saturation, cloud liquid water appears, cloud base is coherent enough to diagnose, and cloud tops remain shallow. |
| Expected visual behavior | Cloud liquid water forms in localized shallow cumulus structures, with visible growth/decay, cloud base, and cloud top. |
| Fields required from model output | time, x/z grid, temperature or theta, water vapor, cloud liquid water, vertical velocity, horizontal velocity if available, pressure metadata if available. |
| Diagnostics required | first cloud time, cloud base, cloud top, max updraft, max cloud liquid water, integrated cloud liquid water, LCL comparison. |
| Visualization modes supported | cloud liquid water, water vapor/RH, temperature/theta, vertical velocity, cloud base/top overlays, time replay. |
| Optics relevance | Primary first input for cloud appearance rendering from reference cloud-water fields. |
| Comparison against reduced models | Compare cloud/no-cloud status, first cloud time, cloud base, cloud top, max cloud water, and LCL relationship. Do not score exact cell-by-cell morphology. |
| Validation use | Confirms the full CM1-to-reference-to-view path can show a credible shallow-cloud evolution. |
| Known limitations | Idealized CM1 morphology depends on domain, grid, subgrid/turbulence choices, and forcing details; the baseline is a reference, not universal truth. |
| Priority | Immediate |

## Additional Case: Dry Thermal / Clear Motion

| Required detail | Definition |
| --- | --- |
| Case id | `cm1-dry-thermal-clear-motion-v1` |
| User-facing name | Dry Thermal / Clear Motion |
| Lab served | Lower Atmosphere Cloud Basics; Evolving Boundary Layer |
| Physical question | What does buoyant lower-atmosphere motion look like before clouds form? |
| Intended phenomenon | Dry or subsaturated thermal motion with finite fields and no cloud formation. |
| Initial profile concept | Dry/subsaturated lower atmosphere with enough instability or thermal perturbation to create motion. |
| Forcing concept | Initial warm bubble, prescribed thermal perturbation, or surface forcing that produces buoyant motion without saturation. |
| Expected qualitative behavior | Updrafts and thermal structures develop, but cloud liquid water stays absent. |
| Expected visual behavior | Clear vertical velocity and temperature/theta structure with an empty cloud-water field. |
| Fields required from model output | time, x/z grid, temperature or theta, water vapor, cloud liquid water, vertical velocity, horizontal velocity if available. |
| Diagnostics required | thermal rise, max updraft, no cloud water, finite fields, no first cloud time. |
| Visualization modes supported | vertical velocity, temperature/theta, water vapor/RH if derivable, cloud-water absence view. |
| Optics relevance | Clear-sky reference for appearance fallback and opacity response tests. |
| Comparison against reduced models | Compare motion/no-cloud teaching outcome and no-cloud diagnostics, not exact thermal shape. |
| Validation use | Tests viewer and adapter fallbacks for cloud-free but dynamically active data. |
| Known limitations | It may overlap with dry failed cumulus; keep this case as a cleaner dynamics/control reference if both are retained. |
| Priority | Immediate or early |

## Additional Case: Capped / Suppressed Cumulus

| Required detail | Definition |
| --- | --- |
| Case id | `cm1-capped-suppressed-cumulus-v1` |
| User-facing name | Capped / Suppressed Cumulus |
| Lab served | Lower Atmosphere Cloud Basics |
| Physical question | How does a stable layer or cap limit shallow-cloud development? |
| Intended phenomenon | Moist lower-layer thermals are delayed, flattened, or suppressed by a cap/inversion. |
| Initial profile concept | Moist lower layer beneath a stable layer or inversion, with baseline-comparable lower-level moisture and forcing. |
| Forcing concept | Same or comparable forcing to the shallow-cumulus baseline, so the cap is the main contrast. |
| Expected qualitative behavior | Updrafts encounter the cap; cloud formation is delayed, reduced, or capped below the inversion. |
| Expected visual behavior | Smaller, flatter, delayed, or absent cloud-water regions compared with the baseline. |
| Fields required from model output | time, x/z grid, temperature or theta, water vapor, cloud liquid water, vertical velocity, horizontal velocity if available, pressure metadata if available. |
| Diagnostics required | cap height, cloud top relative to cap, delayed or suppressed first cloud, reduced cloud water compared with baseline, max updraft. |
| Visualization modes supported | cloud water, theta/temperature, vertical velocity, cap overlay, cloud top overlay, time replay. |
| Optics relevance | Tests appearance response for shallow/limited cloud depth and cap-constrained cloud tops. |
| Comparison against reduced models | Compare cap-suppression outcome, cloud-top/cap relationship, and reduced cloud-water diagnostics. |
| Validation use | Anchors reduced-model cap-suppressed scenario interpretation. |
| Known limitations | CM1 cap strength and forcing choices can move the case from fully suppressed to delayed cloud; the manifest must document expected outcome. |
| Priority | Early |

## Additional Case: Humid Low-Cloud Contrast

| Required detail | Definition |
| --- | --- |
| Case id | `cm1-humid-low-cloud-contrast-v1` |
| User-facing name | Humid Low-Cloud Contrast |
| Lab served | Lower Atmosphere Cloud Basics |
| Physical question | How does high near-surface humidity lower cloud base and make clouds easier to form? |
| Intended phenomenon | Low-LCL shallow cloud forms more readily than the baseline under weak or moderate lift/heating. |
| Initial profile concept | Higher near-surface RH than the baseline, low LCL, and enough stability to keep the case shallow. |
| Forcing concept | Weak to moderate surface heating or thermal initiation. |
| Expected qualitative behavior | Cloud forms earlier or with less forcing than baseline; cloud base is lower. |
| Expected visual behavior | Low cloud base with visible cloud liquid water; may look more widespread or easier to trigger than baseline. |
| Fields required from model output | time, x/z grid, temperature or theta, water vapor, cloud liquid water, vertical velocity, horizontal velocity if available, pressure metadata if available. |
| Diagnostics required | low LCL, low cloud base, first cloud time, max cloud water, warning that this is a contrast case rather than the default baseline. |
| Visualization modes supported | cloud water, water vapor/RH, cloud base overlay, time replay, appearance view later. |
| Optics relevance | Useful for low-cloud appearance and optical-depth contrast against baseline. |
| Comparison against reduced models | Compare lower LCL/cloud-base relationship and easier-cloud outcome, not exact horizontal coverage. |
| Validation use | Anchors humid/lower-cloud scenario expectations and appearance response to lower cloud base. |
| Known limitations | A humid case can drift toward stratus-like behavior; keep it scoped as a contrast case unless a fog/stratus lab takes ownership. |
| Priority | Early |

## Additional Case: Warm-Rain Shallow Cloud

| Required detail | Definition |
| --- | --- |
| Case id | `cm1-warm-rain-shallow-cloud-v1` |
| User-facing name | Warm-Rain Shallow Cloud |
| Lab served | Warm Rain / Droplet Growth; Lower Atmosphere Cloud Basics |
| Physical question | When does cloud liquid water begin transitioning to precipitation? |
| Intended phenomenon | Shallow warm cloud produces rain water or a rain-onset signal when microphysics supports it. |
| Initial profile concept | Moist warm-cloud setup deep or sustained enough for precipitation processes, while remaining interpretable as a lower-atmosphere case. |
| Forcing concept | Surface or thermal forcing that sustains cloud long enough for warm-rain onset if feasible. |
| Expected qualitative behavior | Cloud liquid water appears first; rain water appears later or remains absent if the chosen CM1 configuration cannot support rain. |
| Expected visual behavior | Cloud-water field evolves before rain-water field appears; later views may show rain-water structure or rain shaft proxies. |
| Fields required from model output | time, x/z grid, temperature or theta, water vapor, cloud liquid water, rain water, vertical velocity, horizontal velocity, pressure metadata if available, droplet/effective-radius fields if available. |
| Diagnostics required | cloud water, rain water, first rain time, water budget, cloud-to-rain transition, first cloud time, cloud base/top. |
| Visualization modes supported | cloud water, rain water, vertical velocity, time replay, rain onset marker, appearance/rain interpretation later. |
| Optics relevance | Rain water may feed later rain-shaft visuals; effective radius or droplet fields can improve optical assumptions if available. |
| Comparison against reduced models | Compare rain/no-rain outcome and first rain timing qualitatively after controlled warm-rain diagnostics exist. |
| Validation use | Future anchor for warm-rain diagnostics and bulk microphysics interpretation. |
| Known limitations | Later priority because it depends on microphysics choices and careful labeling; do not block the first shallow-cumulus visual path on rain. |
| Priority | Later |

## Additional Case: Orographic / Terrain Cloud

| Required detail | Definition |
| --- | --- |
| Case id | `cm1-orographic-terrain-lift-v1` |
| User-facing name | Orographic / Terrain Cloud |
| Lab served | Orographic / Terrain Clouds |
| Physical question | How does terrain-induced lift create or suppress cloud? |
| Intended phenomenon | Moist upstream flow forms terrain-relative cloud over or downwind of an idealized ridge or slope. |
| Initial profile concept | Upstream moisture and stability suitable for lift-driven cloud formation, plus documented wind profile. |
| Forcing concept | Idealized terrain, upstream flow, and terrain-induced ascent rather than surface thermal initiation. |
| Expected qualitative behavior | Cloud forms where air is lifted by terrain if moisture/stability permit. |
| Expected visual behavior | Cloud field is tied to terrain geometry, with terrain overlays and terrain-relative diagnostics. |
| Fields required from model output | time, x/z grid, terrain height, temperature or theta, water vapor, cloud liquid water, vertical velocity, horizontal velocity, pressure metadata if available, rain water if relevant. |
| Diagnostics required | terrain height, cloud base/top relative to terrain, upstream RH, wind/lift context, max updraft, cloud-water amount. |
| Visualization modes supported | cloud water with terrain overlay, vertical velocity, vapor/RH, time replay, terrain-relative probes. |
| Optics relevance | Later appearance views can show terrain-anchored cloud structure, but must label terrain/reference assumptions. |
| Comparison against reduced models | Compare qualitative terrain-lift relationships only after an orographic lab contract exists. |
| Validation use | Future anchor for terrain-lift lab design and WRF/CM1 reference strategy. |
| Known limitations | Later priority; do not use current Boussinesq terrain-like visuals as the polished credibility path. |
| Priority | Later |

## Adapter Expectations

The #179 adapter should consume real cases through stable case ids and source
metadata. Each local dataset or manifest should identify:

- case id
- source model and version
- creation time
- local output path
- expected output files
- required fields
- diagnostics to compute
- notes about forcing, grid, limitations, and missing fields

The adapter should preserve field provenance and units. It should report missing
optional fields as warnings rather than silently inventing values. If a case
lacks a required field for its stated purpose, the dataset should be considered
incomplete for that purpose.

## Relationship To Reduced Models

Reduced models serve a different job than CM1 reference cases.

| Layer | Job | Matching expectation |
| --- | --- | --- |
| CM1 reference cases | Anchor credible 2-D cloud-resolving behavior and visual evolution. | Provide visual and diagnostic reference behavior. |
| `boundary_layer_1d` | Explain how profiles become cloud-favorable or not. | Match teaching relationships such as LCL, mixed-layer depth, cap, RH, and favorability. |
| `controlled_cloud_column` | Explain cloud formation/failure under prescribed lift. | Match cloud/no-cloud outcome, first cloud time direction, cloud base/top proxies, and limiting reasons. |
| Comparison UI (#198) | Show reduced-model result beside reference behavior. | Compare teaching-relevant diagnostics, not exact morphology. |

Exact CM1 cloud shape, turbulent texture, and cell placement should not become
pass/fail requirements for reduced models. The comparison should explain where a
reduced model is intentionally simpler.

The first comparison implementation maps these Lower Atmosphere v2 scenarios to
reference case ids:

| Lower Atmosphere v2 scenario | CM1 reference case id | First app status |
| --- | --- | --- |
| `lower-atmosphere-v2-baseline-shallow-cloud` | `cm1-shallow-cumulus-baseline-v1` | Available through the tiny reference-frame fixture until real output is ingested. |
| `lower-atmosphere-v2-dry-failed-cumulus` | `cm1-dry-failed-cumulus-v1` | Mapped, but shows missing-reference fallback until a run is loaded. |
| `lower-atmosphere-v2-capped-suppressed-cloud` | `cm1-capped-suppressed-cumulus-v1` | Mapped, but shows missing-reference fallback until a run is loaded. |
| `lower-atmosphere-v2-humid-low-cloud-contrast` | `cm1-humid-low-cloud-contrast-v1` | Mapped, but shows missing-reference fallback until a run is loaded. |
| `lower-atmosphere-v2-rain-capable-warm-cloud-later` | `cm1-warm-rain-shallow-cloud-v1` | Mapped for later warm-rain comparison; rain diagnostics remain deferred. |

The first comparison diagnostics are cloud/no-cloud status, first cloud time,
cloud base, cloud top, max cloud water, max updraft, rain onset, and reduced
profile context. These are diagnostic teaching comparisons, not validation that
the reduced model reproduces CM1 morphology.

## Storage And Data Policy

Do not commit large CM1 output files to git.

Use a local ignored path for generated reference data, such as:

```text
data/reference/cm1/
```

Several GB of local CM1 data is acceptable for user-generated reference
datasets, but large outputs should remain local unless a separate
artifact/storage policy is approved.

Commit:

- docs
- scripts
- manifests
- case configs
- tiny fixtures

Do not commit:

- large NetCDF outputs
- compiled CM1 binaries
- CM1 source code unless licensing and repo policy explicitly allow it
- local machine build products

## Optics Relationship

Reference cases support both scientific views and later cloud appearance views.

- Cloud liquid water can feed optical-depth estimates.
- Rain water may feed rain-shaft visuals later.
- Effective radius, droplet number, or droplet distribution fields are optional
  future inputs.
- If droplet properties are absent, optics must label whether effective radius
  or droplet properties are assumed.
- Reference fields can be rendered through scientific field views first, then
  interpreted through cloud appearance or 2.5-D views later.
- Appearance views must preserve source provenance and avoid claiming direct
  radiative transfer unless that work is explicitly implemented.

## Non-Goals

- Do not run CM1.
- Do not add CM1 output files.
- Do not implement adapter code.
- Do not change frontend behavior.
- Do not modify Boussinesq.
- Do not define every possible future reference case.
- Do not claim the current app has these reference datasets yet.

## First Implementation Sequence

The case-library sequence should remain:

```text
#179 CM1 adapter
  ->
#180 visual reference case library
  ->
#207 local CM1 setup
  ->
#208 first real dry-failed / shallow-cumulus reference pair
  ->
#209 2-D scientific reference replay
  ->
#181 optics physical-field contract
  ->
#210 cloud appearance view
  ->
#198 reduced-model/reference comparison
```

After #198, the immediate CM1 reference path has adapter, case-library,
setup/script, first-pair assets, scientific replay, optics contract, appearance
view, and qualitative reduced/reference comparison coverage. Further work should
replace tiny fixtures with real ingested local reference outputs or broaden case
coverage through separately scoped issues.

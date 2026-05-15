# Lower Atmosphere Cloud Basics Lab

## Lab Name

Lower Atmosphere Cloud Basics

> Legacy/internal id note: the current implementation still uses the internal lab id
> `fair-weather-cumulus` to avoid route and saved-config churn. That id is not the
> user-facing lab name. Fair-weather cumulus is now a scenario/scenario family inside
> Lower Atmosphere Cloud Basics.

## Physical Question

How do heating, moisture, and stability shape basic warm-cloud formation near the ground?

## User Promise

Users can vary surface heating, moisture, stability, boundary-layer structure, and runtime to see whether basic lower-atmosphere warm cloud forms, when it forms, where cloud base and top appear, and why a similar-looking setup may fail to produce cloud.

This lab should help users build physically correct intuition around:

- warm ground producing buoyant thermals
- moist source-layer air rising toward saturation
- lifted condensation level / expected cloud base
- cloud tops responding to thermal strength, stability, and dry air aloft
- dry, capped, multi-thermal, or low-cloud contrast cases that clarify what the current model can and cannot claim

The lab should be visually engaging, but the first version should stay
scientifically honest: it is a qualitative shallow-cloud experiment using the
Yellow-status `boussinesq_2d` prototype visual dynamics scaffold, not a
quantitative cloud forecast, trusted cloud-resolving atmospheric model, or
research-grade CFD model.

## Primary Concepts

- surface sensible heating
- buoyant thermals
- source-layer moisture
- lifted condensation level / cloud base
- atmospheric stability and lapse rate
- boundary-layer depth / capping structure
- dry free-atmosphere entrainment effects, approximate in v1
- cloud onset time
- cloud-top height
- dry failed cumulus
- expected vs observed diagnostics

## Current Maturity

`prototype`

Lower Atmosphere Cloud Basics is the first reference lab for Workbench V2. V1 is
partly supported by the current Yellow-status `boussinesq_2d` prototype,
scenario diagnostics, streamed frames, profile/probe tooling, and scientific
2-D visualization.

Fair-weather cumulus is one scenario family inside this lab, not the lab identity.

The lab is not yet a polished product experience. Workbench V2 should make it the first complete end-to-end lab: choose scenario, adjust key controls, run, watch, inspect, and compare/save later.

## User Controls

### Primary Controls

These should be visible by default in the Lower Atmosphere Cloud Basics setup panel.

| Control | Meaning | Expected effect | Units / type |
| --- | --- | --- | --- |
| Surface heating strength | Lower-boundary warming that drives buoyant thermals. | Stronger heating should generally increase vertical response and can deepen cloud, all else equal. | K s-1 or user-friendly weak/moderate/strong scale |
| Surface heating pattern | Spatial distribution of heating along the surface. | Changes where thermals initiate and whether one or multiple plume regions appear. | single patch / broad patch / weak uneven / multi-patch |
| Source-layer humidity | Moisture available near the surface or lower mixed layer. | Higher humidity should lower expected LCL and favor earlier/lower cloud formation. | RH fraction / percent |
| Free-atmosphere humidity | Moisture above the source layer or mixed layer. | Drier air aloft should limit cloud depth or promote evaporation/suppression. | RH fraction / percent |
| Stability / lapse rate | Environmental temperature decrease with height. | More stable profiles should suppress vertical development; less stable profiles should allow deeper growth. | K m-1 or stable/neutral/unstable preset |
| Boundary-layer depth / cap height | Approximate top of the mixed/source layer or capping structure. | A lower/stronger cap can suppress or limit cloud growth; source-layer depth affects moisture supply. | m |
| Model resolution | Numerical sampling density for the 2-D slice. | Higher resolution can reveal more structure but costs more local runtime. | Low / Medium / High |
| Domain width | Horizontal size of the modeled atmospheric slice. | A wider box gives thermals more horizontal room to organize. | m |
| Domain height | Vertical size of the modeled atmospheric slice. | A taller box can show deeper growth when runtime and physics allow it. | m |
| Run length | How long the model evolves before the run completes. | Longer runs can show delayed cloud onset and more mature evolution but cost more time. | s / minutes |

### Secondary Controls

These may be visible in collapsed sections or scenario-specific panels.

| Control | Meaning | Expected effect | Units / type |
| --- | --- | --- | --- |
| Background horizontal wind | Uniform background flow through the 2-D slice. | Tilts or displaces thermals/clouds and can separate cloud from heating source. | m s-1 |
| Moist source-layer depth | Depth of conserved near-surface moisture. | A deeper moist layer can support more cloud water; shallow moisture may be consumed/mixed out faster. | m |
| Heating patch width/location | Geometry of the surface heat source. | Changes plume width and source location. | m |
| Seed | Reproducibility for stochastic or structured perturbations. | Keeps comparable experiments repeatable. | integer |

### Advanced Controls

These should not be default-visible.

| Control | Meaning | Why advanced |
| --- | --- | --- |
| Grid columns/rows | Raw spatial resolution. | The default lab should expose Low / Medium / High instead of raw grid dimensions. |
| Timestep | Numerical integration timestep. | Stability/performance detail. |
| Frame cadence | Streamed/replayed output cadence. | Visualization/performance detail. |
| Raw solver type | Selects backend physics core. | Solver choice should be implicit in the lab unless advanced/system mode is active. |

## Initial Conditions And Forcing

The v1 lab should use a 2-D vertical slice with:

- a lower moist source layer
- a drier free atmosphere above the source layer or boundary-layer top
- a configurable lapse rate / stability profile
- localized, broad, or uneven surface heating applied near the lower boundary
- optional light background horizontal wind
- deterministic seed support

The v1 lab should not initialize cloud liquid water directly. Cloud water should form only through the solver's condensation/saturation behavior.

Painted heating and moisture maps are future improvements. They should eventually become inputs inside this lab, but the first Workbench V2 version should use structured scenario controls and simple presets.

## Expected Behavior

A plausible fair-weather cumulus baseline scenario inside this lab should generally show:

- thermal circulation or vertical motion developing before cloud water appears
- cloud water appearing after lifted source-layer air approaches saturation
- cloud base near the expected LCL in well-mixed/source-layer cases, within grid/prototype tolerance
- cloud tops varying more than cloud bases in multi-thermal or multi-cloud cases
- stronger heating generally producing stronger updrafts and potentially deeper clouds, all else equal
- higher source-layer humidity generally producing lower/earlier cloud, all else equal
- lower humidity, stronger stability, or dry cap conditions suppressing or limiting cloud formation

The lab should not force a flat cloud base visually. If the model produces cloud below expected LCL or in implausible return-flow regions, diagnostics should expose that rather than hiding it.

## Failure / No-Cloud Cases

Failure cases are important to the lab because they teach the physical limits of cloud formation.

The v1 lab should include no-cloud or weak-cloud scenarios such as:

- fair-weather cumulus / baseline shallow cloud: single-patch shallow cloud formation
- dry failed cumulus: buoyant motion develops, but cloud water remains negligible
- capped / suppressed cloud: thermals lift but cloud is delayed, shallow, or limited
- multi-thermal cloud field: paired or structured heating creates multiple thermal responses
- humid low-cloud contrast: very low LCL or broad low-cloud behavior, not classic fair-weather cumulus
- overly stable profile: heating produces weak or shallow response
- low source-layer humidity: LCL is too high or cloud onset occurs too late for the configured runtime

These should not be presented as app failures. They are physically meaningful outcomes.

## Diagnostics

| Diagnostic | Purpose | Hard failure, warning, or display-only? |
| --- | --- | --- |
| Expected LCL / cloud base | Shows where source-layer air should first saturate under the current diagnostic assumptions. | Display + scenario contract/warning |
| First cloud time | Shows when cloud water first appeared. | Scenario contract for cloud-forming cases |
| First cloud height | Compares onset location to expected LCL. | Warning / scenario contract |
| Actual cloud-base height | Helps users see where modeled cloud begins. | Display + warning if inconsistent |
| Cloud-top height | Shows depth of cloud development. | Display / comparison metric |
| Max updraft | Shows thermal strength. | Display / relationship test |
| Integrated/max cloud water | Shows amount of modeled cloud condensate. | Display / comparison metric |
| Below-LCL cloud-water fraction | Flags physically questionable condensate placement. | Warning, possible future hard failure |
| Boundary cloud fraction | Flags boundary/sponge artifacts. | Warning |
| Low-level return-flow cloud water | Flags cloud in implausible circulation regions. | Warning |
| Top sponge cloud fraction | Flags cloud water reaching the top sponge/lid region. | Warning |
| Lateral-boundary cloud fraction | Flags cloud water touching side boundaries. | Warning |
| Cloud regions touching boundaries | Flags cloud regions connected to model boundaries. | Warning / scenario-specific interpretation |
| Subsaturated cloud-water fraction | Flags cloud liquid water in cells whose local pressure-aware RH is below saturation. | Warning; regression check for long runs |
| Diagnostic evaporation tendency | Shows whether existing cloud water should be evaporating in subsaturated cells. | Display / validation diagnostic |
| Expected vs observed status | Summarizes whether the run matched the scenario contract. | Display + scenario contract |
| Dry failed cloud check | Confirms dry-failed scenario produced motion but little/no cloud. | Hard failure for scenario tests |

Diagnostics should be deterministic and not AI-generated. Explanatory text may be generated from deterministic diagnostic states.

### Return-Flow / Boundary Artifact Policy

Lower Atmosphere Cloud Basics should surface suspicious cloud-water placement
instead of hiding it in the renderer.

| Signal | Policy |
| --- | --- |
| Below-LCL cloud-water fraction | Warning for small fractions; hard failure when a large fraction of cloud water is below the expected LCL because that contradicts the lab's cloud-base promise. |
| Low-level return-flow cloud fraction | Warning. It may indicate closed-cell recirculation or transport artifacts, especially in long multi-thermal runs. It is not a hard failure by itself while `boussinesq_2d` remains Yellow. |
| Boundary cloud fraction | Warning. Boundary-attached cloud may be a boundary-condition or sponge artifact and should be interpreted cautiously. |
| Top sponge cloud fraction | Warning. Cloud reaching the top sponge/lid region should be treated as possible lid interaction, not as trustworthy cloud-top structure. |
| Lateral-boundary cloud fraction | Warning. Cloud touching side boundaries should be interpreted as possible side-boundary influence. |
| Humid low-cloud contrast near the lower boundary | Scenario-specific interpretation. Low cloud is physically expected in this contrast case, but boundary/lateral/top artifacts should still be disclosed. |

Renderer rule: scientific and appearance views must not erase, clip, or mask
cloud water to make these warnings disappear.

## Visualization Modes

### V1 / required

- Scientific 2-D field view
  - cloud liquid water
  - water vapor or relative humidity where available
  - temperature perturbation
  - vertical velocity
  - horizontal velocity if useful
- Profile / sounding view
  - temperature
  - RH / water vapor
  - cloud water
  - vertical velocity
  - LCL marker if available
  - boundary-layer/source-layer markers if available
- Timeline / replay view
  - current simulation time
  - frame count
  - first cloud / max cloud markers later if practical
- Inspector
  - overview / expected vs observed
  - diagnostics
  - profile
  - probe if available

### Later / not required for first reference implementation

- Cloud appearance view
- 2.5-D visual extrusion
- pathline/parcel-style overlays
- time-history probe plots
- parameter-sweep summary views

## Physics-Core Requirements

### V1 physics core

`boussinesq_2d`

The v1 lab should use the current experimental 2-D Boussinesq-style physics core. It provides:

- 2-D vertical-slice dynamics
- temperature perturbation / buoyancy response
- streamfunction/vorticity flow scaffold
- simple warm-cloud saturation adjustment
- vapor/cloud fields
- deterministic frame output

### Required honesty

The UI and docs should disclose:

- `boussinesq_2d` is a Yellow-status experimental 2-D prototype
- dynamics are qualitative
- some behavior is shaped by prototype stabilizers and safety caps
- warm-cloud microphysics is simplified
- turbulence/entrainment are not fully modeled
- no droplet-size distribution or resolved rain in this lab version
- results are useful for physical intuition, not quantitative prediction

### Future physics upgrades

- evolving boundary-layer/profile coupling
- better entrainment/dry-air mixing representation
- improved cloud-base thermodynamics
- better turbulence parameterization
- possible future higher-fidelity dynamics core
- optional droplet-aware microphysics only when needed and justified

### V2 modeling direction

Lower Atmosphere Cloud Basics v1 may continue to use `boussinesq_2d` as a
Yellow-labeled prototype for controlled qualitative experiments.

Lower Atmosphere Cloud Basics v2 should be designed around:

```text
boundary_layer_1d
→ controlled_cloud_column
→ CM1 reference comparison
→ diagnostics
→ optics consuming physical fields
```

Current Boussinesq should not be treated as the main scientifically valid
lower-atmosphere engine or as the foundation for polished future cloud-resolving
labs. See `docs/lower-atmosphere-modeling-strategy.md`.

`controlled_cloud_column` now exists as the backend prescribed-lift formation
model for the second step in this path. It can diagnose first cloud time, cloud
base, dry failed/capped outcomes, and evaporation cases from a supplied profile,
while clearly labeling lift as prescribed rather than predicted.

## Frame / Schema Requirements

V1 requires existing `sim-frame-v1` fields:

- `temperature_k`
- `temperature_perturbation_k`
- `water_vapor_kg_per_kg`
- `cloud_liquid_water_kg_per_kg`
- `rain_water_kg_per_kg` may remain zero/placeholder
- `horizontal_velocity_m_per_s`
- `vertical_velocity_m_per_s`
- grid metadata and coordinates

No new frame schema is required for the first Lower Atmosphere Cloud Basics Workbench V2 implementation.

Future enhancements may need:

- explicit relative humidity field or derived diagnostic payload
- boundary-layer depth / LCL diagnostic metadata
- profile-evolution metadata
- terrain metadata, not part of this lab v1
- microphysics payload, not part of this lab v1

## Approximation And Honesty Labels

The UI should use labels such as:

- Experimental 2-D prototype
- Yellow prototype scaffold
- Solver output
- Derived diagnostic
- Simplified warm-cloud condensation
- Qualitative cloud experiment

Avoid labels that imply:

- operational weather prediction
- quantitative cloud forecast
- research-grade CFD
- resolved turbulence
- droplet-resolved microphysics
- true precipitation physics

Suggested plain-language limitation:

> This lab currently uses Cloud Lab's Yellow-status Boussinesq prototype to show
> qualitative relationships between heating, moisture, stability, and shallow
> cumulus formation. It is designed for learning and exploration, not weather
> prediction or trusted cloud-resolving atmospheric modeling.

## Built-In Scenarios

| Scenario | Purpose | Expected result | Key controls |
| --- | --- | --- | --- |
| Fair-weather cumulus / baseline shallow cloud | Single-patch baseline shallow cumulus case. | Thermal develops first; cloud forms later near expected LCL; cloud top grows with heating/stability. | heating, source-layer RH, lapse rate, runtime |
| Dry failed cumulus | Negative control. | Motion/updraft develops, but cloud water remains negligible. | low source-layer RH, heating |
| Capped / suppressed cloud | Shows inhibition from dry/stable layer aloft. | Thermals lift but cloud is delayed, shallow, limited, or suppressed. | free-atmosphere RH, cap/inversion, lapse rate |
| Multi-thermal cloud field | Shows multiple thermal responses from paired or structured heating. | Multiple plume/cloud regions may appear before merger/diffusion. | heating pattern, heating strength, humidity |
| Humid low-cloud contrast | Shows very-low-LCL or broad low-cloud behavior. | Low cloud or deck-like behavior may appear; this is not classic fair-weather cumulus. | source-layer RH, humidity profile, weak uneven heating |

The multi-thermal scenario is useful, but it should not define the product vision. Lower Atmosphere Cloud Basics is about the physical relationship between heating, moisture, stability, and cloud formation, not merely drawing multiple hot patches.

## Comparison Ideas

Useful comparisons:

- moist vs dry source layer
- weak vs strong heating
- less stable vs more stable lapse rate
- moist free atmosphere vs dry free atmosphere
- uncapped vs dry cap / suppressed cloud
- single heating patch vs broad or weak uneven heating
- shorter runtime vs longer runtime to show delayed cloud onset

These comparisons should eventually support saved runs, side-by-side views, and small parameter sweeps.

## Validation Expectations

### Hard expectations

- named cloud-forming scenario produces cloud by configured runtime
- dry failed cumulus produces motion but negligible cloud
- quiet/no-forcing controls do not invent cloud or motion
- moisture fields remain non-negative
- fields remain finite
- seeded runs are reproducible
- frame schema remains valid

### Warnings / diagnostics

- cloud water appears more than one grid cell below expected LCL
- cloud-base spread is too large in a well-mixed/source-layer case
- significant cloud appears on emitted-frame boundaries
- significant cloud appears in low-level return-flow regions
- sampled onset cell appears inconsistent with saturation diagnostics
- cloud deck behavior appears in a scenario labeled classic fair-weather cumulus

### Relationship checks

- higher source-layer humidity should generally lower expected LCL
- stronger heating should generally increase vertical response
- drier free atmosphere should generally reduce/limit cloud depth or amount
- more stable profile should generally suppress vertical growth compared with less-stable case
- lower/stronger cap should delay, limit, or suppress cloud development compared with a higher/weaker cap under the same low-level heating and moisture

## Known Limitations

- 2-D vertical slice, no y dimension
- experimental Boussinesq-style dynamics
- simple saturation adjustment
- no resolved turbulence closure
- no true entrainment model
- no terrain
- no radiation
- no droplet-size distribution
- no ice physics
- no physically meaningful precipitation in v1
- no quantitative forecast value

## Future Upgrades

- painted surface heating and moisture controls
- richer profile editor
- evolving boundary-layer/profile coupling
- dry-air entrainment diagnostics
- cloud appearance view
- 2.5-D visualization
- saved comparison workflows
- small parameter sweeps
- better dynamics core if lab behavior exposes misleading physics
- droplet-aware microphysics only if needed to support future rain/optics labs

## Documentation Checklist

When implementing or changing this lab, update:

- `docs/labs/lower-atmosphere-cloud-basics.md`
- `docs/scenarios.md`
- `docs/lab-roadmap.md` if priority/scope changes
- `docs/current-phase-plan.md` if execution order changes
- `docs/testing-and-validation.md` if validation policy changes
- `docs/simulation-data-model.md` if schema/config changes
- `docs/visualization-and-workbench-views.md` if visualization behavior changes
- `docs/boussinesq-validation.md` if solver expectations or diagnostics change

## First Implementation Relationship

This lab spec should guide issues:

- `#107` — Workbench V2 shell and Lab Picker
- `#108` — lab catalog and Lower Atmosphere Cloud Basics lab definition
- `#109` — Lower Atmosphere Cloud Basics run/replay/inspect flow
- `#110` — scientific visualization stage and inspector
- `#111` — retire old dashboard as default UI

If those issues conflict with this spec, update the issues before Codex implements them.

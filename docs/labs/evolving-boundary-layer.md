# Evolving Boundary Layer Lab

## Lab Name

Evolving Boundary Layer

## Physical Question

How does the daytime boundary layer evolve into — or fail to become — a cloud-producing environment?

This lab helps users understand how a morning atmosphere changes after sunrise as surface heating, surface moisture flux, turbulent mixing, entrainment, and capping inversions reshape temperature, moisture, mixed-layer depth, relative humidity, and lifting condensation level.

## User Promise

Users can start from a scenario preset, adjust a small set of meaningful controls, and watch a 1-D atmospheric profile evolve from sunrise through the daytime period. The lab diagnoses **cloud formation potential** for shallow cumulus without producing cloud water in v1.

Users should learn why similar-looking mornings can diverge:

- one day becomes favorable for shallow cumulus
- another remains too dry
- another is suppressed by a strong cap
- another loses potential because dry air entrains from above
- another lacks enough heating or moisture flux

V1 is about whether the environment becomes favorable for clouds, not about rendering or predicting actual clouds.

## Primary Concepts

- daytime boundary-layer growth
- surface sensible heating
- surface moisture flux / evaporation
- turbulent mixed-layer homogenization
- entrainment from air above the mixed layer
- dry-air entrainment and suppression
- inversion height and strength
- mixed-layer depth
- lifting condensation level / expected cloud base
- relative humidity profile evolution
- cloud formation potential
- morning-to-afternoon profile change
- difference between environment favorability and actual cloud production

## Current Maturity

`concept`

This lab is currently a design/spec lab. It should become the first profile-evolution lab in Cloud Lab. It is not yet implemented, and it should not be implemented as a fully coupled 2-D dynamics model in v1.

The first version should be a standalone 1-D profile-evolution lab that produces time-evolving profiles and diagnostics. Later versions may export evolved profiles into Lower Atmosphere Cloud Basics or loosely couple to `boussinesq_2d`, but that should wait until the 1-D profile model is understandable and validated.

This is the first natural implementation target for the lower-atmosphere model
hierarchy in `docs/lower-atmosphere-modeling-strategy.md`: Evolving Boundary
Layer v1 should use `boundary_layer_1d` as a standalone 1-D profile-evolution
model. It should not live-couple to `boussinesq_2d` in v1 and should not emit
cloud water in v1.

## User Controls

### Primary Controls

These controls should be visible by default, using scenario presets plus sliders/selectors similar in spirit to the Lower Atmosphere Cloud Basics lab.

| Control | Meaning | Expected effect | Units / type |
| --- | --- | --- | --- |
| Scenario | Starting atmospheric setup and teaching case. | Selects a coherent preset for the profile, cap, surface forcing, and expected outcome. | preset |
| Hours from sunrise | Duration of daytime evolution from sunrise. | Longer evolution allows more heating, mixing, entrainment, and possible cloud formation potential. | hours |
| Surface heating strength | Intuitive control for sensible heat input from the surface. | Stronger heating warms/deepens the mixed layer faster and can help mixed-layer depth approach or exceed LCL. | weak / moderate / strong; W m-2 internally or advanced |
| Surface moisture flux | Intuitive control for moisture supplied by evaporation/transpiration. | More moisture can lower LCL, increase low-level RH, and improve cloud formation potential. | dry / moderate / moist; kg m-2 s-1 or latent heat flux internally/advanced |
| Initial mixed-layer humidity | Moisture in the lower atmosphere near sunrise. | Higher initial humidity lowers LCL and makes cloud formation potential easier to reach. | RH percent or mixing-ratio-derived preset |
| Initial stability / lapse rate | Morning thermal structure below/near the cap. | More unstable/less stable profiles mix more readily; more stable profiles resist growth. | preset or K m-1 |
| Inversion height | Height of the capping inversion or stable layer. | Lower caps limit mixed-layer growth sooner; higher caps allow more growth before suppression. | m |
| Inversion strength | Strength of the cap resisting mixed-layer growth. | Stronger caps suppress growth and cloud formation potential. | weak / moderate / strong or K |
| Dry air above mixed layer | Dryness of air entrained from above. | Drier air aloft can raise LCL, lower mixed-layer RH, and suppress cloud formation potential despite growth. | RH percent or preset |
| Entrainment strength | Simplified rate of mixing from air above the boundary layer into the mixed layer. | Stronger entrainment can deepen the mixed layer but also dry/warm it when air aloft is dry. | weak / moderate / strong |

### Secondary Controls

Useful, but not always visible.

| Control | Meaning | Expected effect | Units / type |
| --- | --- | --- | --- |
| Initial mixed-layer depth | Starting depth of the morning mixed layer. | A deeper initial layer changes how quickly the boundary layer reaches cap/LCL conditions. | m |
| Surface heating curve | Shape of heating over hours from sunrise. | Morning ramp feels more realistic than constant forcing; steady forcing is useful for tests. | ramp / steady |
| Profile resolution | Number of vertical levels used by the profile model. | Higher resolution gives smoother diagnostics at higher cost. | low / medium / high |
| Time step / output interval | Numerical and output cadence. | Affects performance and smoothness, not core lab meaning. | seconds/minutes |
| Initial lapse-rate preset | Structured morning profile choices. | Supports stable morning, neutral, or weakly unstable cases. | preset |

### Advanced Controls

These should not be default-visible.

| Control | Meaning | Why advanced |
| --- | --- | --- |
| Raw sensible heat flux | Physical surface sensible heat flux. | Useful for science/debugging, but less intuitive than weak/moderate/strong. |
| Raw moisture flux / latent heat flux | Physical moisture source at the lower boundary. | Important scientifically, but too unit-heavy for default use. |
| Entrainment coefficient | Parameter controlling mixed-layer-top entrainment. | Easy to misuse; v1 should expose simple entrainment levels first. |
| Minimum inversion jump threshold | Threshold for diagnosing cap suppression. | Diagnostic/model tuning detail. |
| Cloud formation potential thresholds | Thresholds for LCL vs mixed-layer depth, RH near top, and cap strength. | Needed for validation/debugging, but should not be user-facing by default. |
| Vertical grid extent and spacing | Model-domain details. | Advanced numerical setup, not the first learning control. |

## Initial Conditions And Forcing

V1 should use scenario presets with sliders, not a full profile editor.

Each scenario should define:

- height grid
- initial temperature profile or potential temperature profile
- initial relative humidity or water-vapor profile
- initial mixed-layer depth
- inversion/cap height
- inversion/cap strength
- dry-air-above profile
- surface sensible heating preset
- surface moisture flux preset
- entrainment strength preset
- hours-from-sunrise duration

Time should be represented as **hours from sunrise**, not clock time. This avoids implying date, latitude, solar angle, or geographic specificity that v1 does not model.

The model should include intuitive surface-heating presets even though time is measured from sunrise. For example:

- weak heating
- moderate heating
- strong heating

V1 should not require a calendar date, latitude, longitude, or real solar-geometry model.

## Expected Behavior

A plausible Evolving Boundary Layer run should generally show:

- surface heating warming the lower atmosphere
- mixed-layer depth increasing with time under sufficient heating
- moisture supplied by surface flux increasing or sustaining low-level moisture
- mixing tending to homogenize temperature/potential temperature and moisture inside the mixed layer
- entrainment incorporating air from above the mixed layer
- dry air aloft reducing RH or raising LCL when entrainment is strong
- stronger caps slowing or stopping mixed-layer growth
- LCL changing over time as temperature and moisture evolve
- cloud formation potential changing as mixed-layer depth, LCL, RH, and cap strength evolve

V1 should not produce cloud liquid water. It should diagnose whether the evolving profile becomes favorable for shallow cumulus.

## Failure / No-Cloud Cases

V1 failure cases are cloud-formation-potential outcomes, not rendered cloud failures.

Meaningful outcomes include:

- **Not favorable yet**: conditions are evolving but do not cross shallow-cumulus thresholds within the run duration.
- **Moisture-limited**: mixed layer grows, but LCL remains above mixed-layer depth because humidity is too low.
- **Heating-limited**: surface heating is too weak to grow the mixed layer enough.
- **Cap suppressed**: a strong inversion prevents mixed-layer growth from reaching favorable depth.
- **Dry entrainment suppressed**: mixed layer grows but entrains dry air, reducing RH or raising LCL enough to prevent favorable conditions.
- **No-flux control**: little/no meaningful evolution occurs when heating and moisture flux are absent or near zero.

These should be presented as scientifically meaningful outcomes, not app failures.

## Diagnostics

| Diagnostic | Purpose | Hard failure, warning, or display-only? |
| --- | --- | --- |
| Cloud formation potential | Primary outcome: whether the profile has become favorable for shallow cumulus. | Display + scenario contract |
| Potential explanation | Plain-language reason for success/failure. | Display |
| Mixed-layer depth over time | Shows daytime boundary-layer growth. | Display + relationship test |
| LCL over time | Shows expected cloud-base/favorability evolution. | Display + relationship test |
| Mixed-layer depth minus LCL | Key diagnostic for whether the mixed layer can reach saturation. | Display + relationship test |
| RH profile over time | Shows moisture evolution and dry entrainment effects. | Display + relationship test |
| RH near mixed-layer top | Indicates whether the top of the mixed layer is becoming cloud-favorable. | Display + relationship test |
| Inversion/cap strength over time | Explains cap suppression. | Display + scenario contract |
| Entrainment drying proxy | Shows dry-air impact from above the mixed layer. | Display + relationship test |
| Surface moisture budget | Explains moisture supplied from the surface. | Display + relationship test |
| Surface heating accumulation | Explains growth/thermal forcing over hours from sunrise. | Display |
| No-cloud/no-potential reason | Explains which limiting factor dominated. | Display + scenario contract |
| No-flux stability check | Confirms control case remains mostly unchanged. | Hard failure for tests |

Diagnostics should be deterministic. Explanatory text should be generated from deterministic diagnostic states, not freeform AI output.

## Visualization Modes

### Time-evolving profile / sounding view

This is the hero view for v1.

Default user-facing display:

- temperature in degrees C
- relative humidity in percent
- height on vertical axis
- mixed-layer depth marker
- LCL marker
- inversion/cap marker
- current hours from sunrise
- cloud formation potential status

Advanced/science toggle:

- potential temperature in K
- water-vapor mixing ratio in g/kg or kg/kg

### Morning vs current profile comparison

Shows initial profile and current/evolved profile together.

Purpose:

- makes morning-to-afternoon change visible
- shows warming, mixing, drying/moistening, and cap behavior

### Time-series diagnostic view

Shows key variables over hours from sunrise:

- mixed-layer depth
- LCL
- RH near mixed-layer top
- cloud formation potential status or threshold crossing

### Cloud formation potential summary

A compact diagnostic card or inspector summary explaining:

- current status
- main limiting factor
- whether the potential appeared during the run
- when it first appeared, if applicable

### Future 2-D coupling view

Future versions may show an evolved profile feeding Lower Atmosphere Cloud Basics or another 2-D lab. This is not required for v1.

## Physics Core Requirements

### Recommended first model architecture

Use a standalone **1-D profile-evolution model** first.

This is the recommended path because it keeps failures interpretable. If v1 coupled immediately to `boussinesq_2d`, wrong or confusing cloud outcomes could be caused by profile evolution, dynamics, condensation, boundary artifacts, visualization, or coupling. A standalone profile model lets Cloud Lab validate the boundary-layer logic first.

### Staged architecture

1. **Stage 1: standalone 1-D profile lab**
   - evolves profiles and diagnostics
   - no cloud water
   - no 2-D cloud field
   - no live Boussinesq coupling

2. **Stage 2: export evolved profile to Lower Atmosphere Cloud Basics**
   - use an evolved profile as an initial condition or scenario input
   - preserve source metadata and limitations

3. **Stage 3: loose profile/2-D coupling**
   - update environmental background before or between 2-D runs
   - only after Stage 1 behavior is validated

4. **Stage 4: tighter coupling**
   - only if a lab requires it and failures remain explainable

### V1 state variables

Minimum state:

- height coordinate `z_m`
- temperature profile `temperature_k` or potential temperature `potential_temperature_k`
- water vapor mixing ratio `water_vapor_kg_per_kg` or equivalent
- relative humidity as derived diagnostic
- mixed-layer depth `mixed_layer_depth_m`
- inversion/cap height `inversion_height_m`
- inversion/cap strength
- LCL `lcl_m`
- surface sensible heating forcing
- surface moisture flux forcing
- entrainment strength/state

V1 should not include wind, large-scale dry/moist advection, broad ascent, terrain forcing, rain, ice, or cloud liquid water.

### V1 tendencies / processes

The first model should include simplified tendencies for:

- surface sensible heating
- surface moisture flux / evaporation
- mixed-layer homogenization
- mixed-layer deepening with heating
- entrainment from above the mixed layer
- cap/inversion resistance to growth
- entrainment drying/warming when air aloft is dry/warm
- LCL recalculation over time
- cloud formation potential diagnosis

The model should be simple, transparent, deterministic, and documented. It should not claim LES, mesoscale, or research-grade turbulence closure.

## Frame / Schema Requirements

V1 may need a profile-frame or lab-specific profile-output schema rather than the existing 2-D `sim-frame-v1` output.

Suggested profile frame fields:

- `time_hours_from_sunrise`
- `z_m`
- `temperature_k`
- optional `potential_temperature_k`
- `relative_humidity_percent`
- optional `water_vapor_kg_per_kg`
- `mixed_layer_depth_m`
- `lcl_m`
- `inversion_height_m`
- `inversion_strength`
- `cloud_formation_potential_status`
- `cloud_formation_potential_reason`
- `surface_heating_accumulated`
- `surface_moisture_added`
- `entrainment_drying_proxy`

If later exporting into `sim-frame-v1`, the export step should be explicit and should preserve metadata identifying the profile model source and assumptions.

## Approximation And Honesty Labels

Required UI/docs labels:

- Simplified 1-D profile evolution
- Cloud formation potential only
- No cloud water in v1
- Not a cloud-resolving model
- Not LES
- Not a mesoscale weather model
- No wind or advection in v1
- Simplified entrainment and mixed-layer growth
- Scenario-based profile presets, not observed soundings

Suggested plain-language label:

> This lab evolves a simplified 1-D boundary-layer profile to estimate cloud formation potential. It does not produce cloud water or predict actual clouds in v1.

Avoid labels that imply:

- cloud forecast
- cloud water production
- true turbulence closure
- LES/CFD fidelity
- weather prediction
- geographic/solar realism from actual date/latitude

## Built-In Scenarios

| Scenario | Purpose | Expected result | Key controls |
| --- | --- | --- | --- |
| Morning stable layer breaks down | Baseline daytime boundary-layer growth. | Surface heating warms and deepens the mixed layer; potential may remain not favorable unless moisture is sufficient. | heating, initial stability, inversion height |
| Moist surface, cumulus favorable | Shows how moisture flux plus heating can create favorable shallow-cumulus conditions. | Mixed-layer depth approaches/exceeds LCL and RH near top supports favorable status. | heating, moisture flux, initial humidity |
| Dry entrainment suppresses potential | Shows growth with suppression from dry air aloft. | Mixed layer deepens but dry entrainment raises LCL or lowers RH enough to prevent favorable status. | dry air above, entrainment strength |
| Surface moisture flux enables potential | Shows the difference between dry and moist surfaces. | With similar heating, added moisture flux lowers LCL / increases RH enough to change outcome. | moisture flux, heating |
| Strong cap suppresses growth | Shows capping inversion limiting daytime growth. | Mixed-layer growth stalls below cap/LCL; status becomes cap suppressed or not favorable. | inversion strength, inversion height, heating |
| No-flux control | Validation/control case. | Profile remains mostly unchanged within tolerance; no cloud formation potential appears. | near-zero heating and moisture flux |

## Comparison Ideas

Useful comparisons:

- weak vs strong surface heating
- dry surface vs moist surface
- weak vs strong inversion
- moist initial mixed layer vs dry initial mixed layer
- weak vs strong dry entrainment
- short vs long hours from sunrise
- no-flux control vs normal daytime forcing
- evolved afternoon profile vs initial morning profile

Future comparison:

- send morning profile vs evolved profile into Lower Atmosphere Cloud Basics and compare outcomes

## Validation Expectations

### Hard expectations

- no-flux control remains mostly unchanged within tolerance
- surface heating increases mixed-layer temperature and tends to increase mixed-layer depth
- surface moisture flux increases or sustains low-level water vapor/RH relative to dry-surface case
- dry entrainment reduces RH or raises LCL relative to weaker/drier-control expectations when air aloft is dry
- stronger cap suppresses mixed-layer growth relative to weak-cap case
- higher initial humidity lowers initial LCL
- longer hours from sunrise should not reduce accumulated heating in comparable cases
- V1 does not emit cloud liquid water
- cloud formation potential status is deterministic for a given scenario/seed/config
- all profile fields remain finite and physically bounded

### Relationship checks

- stronger heating generally deepens the mixed layer more than weak heating
- stronger moisture flux generally lowers LCL or raises RH relative to dry surface
- stronger dry entrainment generally worsens cloud formation potential when air aloft is dry
- stronger cap generally delays or prevents favorable status
- higher initial humidity generally improves potential, all else equal

### UI / diagnostic checks

- cloud formation potential status is visible
- limiting reason is visible
- profile view shows height axis and units
- mixed-layer depth marker is visible
- LCL marker is visible
- no UI copy claims cloud water is produced in v1

## Known Limitations

- 1-D profile evolution only
- no cloud liquid water in v1
- no 2-D cloud field in v1
- no live coupling to `boussinesq_2d` in v1
- no wind or wind shear in v1
- no large-scale advection in v1
- no broad ascent/subsidence in v1
- no terrain
- no radiation model beyond intuitive heating presets/curves
- no true turbulence closure
- no LES or mesoscale modeling
- no observed sounding import in v1
- no weather forecast value

## Future Upgrades

- full profile editor
- observed sounding import
- wind and shear profile
- dry/moist advection tendencies
- broad ascent/cooling
- subsidence
- diurnal heating tied to latitude/date if ever justified
- export evolved profile to Lower Atmosphere Cloud Basics
- loose coupling to 2-D runs
- better entrainment parameterization
- cloud fraction or shallow-cumulus parameterization
- terrain/upslope coupling later
- fog/stratus surface-cooling mode later
- comparison of morning vs afternoon 2-D cloud outcomes

## Documentation Checklist

When implementing or changing this lab, update:

- `docs/labs/evolving-boundary-layer.md`
- `docs/labs/README.md`
- `docs/lab-roadmap.md` if priority/scope changes
- `docs/current-phase-plan.md` if execution order changes
- `docs/scientific-roadmap.md` if science direction changes
- `docs/next-physics-core.md` if physics-core strategy changes
- `docs/testing-and-validation.md` if validation policy changes
- `docs/simulation-data-model.md` if profile schema/config changes
- `docs/visualization-and-workbench-views.md` if visualization behavior changes
- `AGENTS.md`, only if durable agent guidance changes

## First Implementation Issues To Create After This Spec

Do not implement all of this in one issue. Recommended follow-on splits:

1. **Add Evolving Boundary Layer lab catalog entry and static profile workbench shell**
   - Add lab entry and scenario metadata.
   - Add setup control groups matching this spec.
   - Add static placeholder profile visualization if the model is not ready.

2. **Implement deterministic 1-D boundary-layer profile model v1**
   - Implement profile state, scenario presets, tendencies, and time evolution.
   - Do not couple to Boussinesq.
   - Do not emit cloud water.

3. **Build Evolving Boundary Layer profile visualization and timeline diagnostics**
   - Hero profile/sounding view.
   - Morning vs current profile comparison.
   - Mixed-layer depth/LCL/RH time series.

4. **Add cloud formation potential diagnostics and explanations**
   - Deterministic statuses and reasons.
   - Inspector summary.
   - Scenario expected/observed checks.

5. **Add validation tests for profile evolution and cloud formation potential**
   - No-flux control.
   - Heating, moisture flux, cap, humidity, and entrainment relationship tests.
   - Explicit test that v1 emits no cloud liquid water.

Create these only after this design has been reviewed and the implementation order is agreed.

## Non-Goals For V1

- Do not produce cloud water.
- Do not implement cloud rendering.
- Do not live-couple to `boussinesq_2d`.
- Do not add wind.
- Do not add large-scale advection.
- Do not add terrain.
- Do not add PySDM.
- Do not build LES, mesoscale modeling, or full atmospheric boundary-layer research physics.
- Do not use clock time/date/latitude solar geometry in v1.

## Durable Design Rule

This lab should make the boundary layer feel like it evolves through the day without pretending to be a cloud-resolving model.

The core v1 user takeaway should be:

> Clouds do not form just because the ground is warm. The daytime profile has to evolve so the mixed layer, moisture, cap, entrainment, and LCL line up to create cloud formation potential.

# Scientific Roadmap

Cloud Lab helps users explore atmospheric physics through beautiful, interactive cloud experiments grounded in real physical principles.

The scientific roadmap serves the lab roadmap. It should not become a separate solver-first roadmap that pulls the product away from guided cloud experiments.

Primary product roadmap:

- `docs/lab-roadmap.md`
- `docs/workbench-v2-product-spec.md`
- `docs/workbench-v2-architecture.md`
- `docs/product-vision.md`

This document explains how the physics should mature in support of those labs.

## Science Strategy

Cloud Lab should grow from clear, testable vertical-slice and parcel experiments into richer cloud dynamics and microphysics without pretending early models are more complete than they are.

The lower-atmosphere science strategy is now defined in
`docs/lower-atmosphere-modeling-strategy.md`. It uses a model hierarchy rather
than treating current `boussinesq_2d` as the main path to scientific validity.

The strategy is:

```text
beautiful labs now + honest simplified physics + clean contracts → progressively higher-fidelity models later
```

The project should not choose between a toy and a hard-core model. It should build approachable labs on top of a science framework that can become serious over time.

## Current Physics Scope

The current foundation is a local 2-D vertical-slice and controlled parcel/box framework. It supports:

- rectangular horizontal-by-vertical domains
- surface heating / lower-boundary forcing
- moisture and temperature state variables with documented units
- buoyancy and vertical motion approximations
- cloud liquid water and rain-water placeholders / bulk behavior
- deterministic seeded runs
- validation and scenario diagnostics
- scientific and approximate cloud appearance visualization

The current public physics paths are:

- `boussinesq_2d`: experimental 2-D dynamics scaffold for qualitative cloud experiments.
- `microphysics_lab`: controlled parcel/box warm-cloud microphysics mode.

The current public `boussinesq_2d` path remains a Yellow prototype scaffold. It
is useful for controlled qualitative experiments and validation scaffolding, but
the scientifically valid lower-atmosphere path should move through
`boundary_layer_1d`, `controlled_cloud_column`, CM1 reference cases, controlled
microphysics, and optics field contracts.

`educational_2d` remains an internal/legacy learning backend for explicit compatibility and regression use.

## Lab-Driven Physics Roadmap

### Lower Atmosphere Cloud Basics

Physical question:

> How do heating, moisture, and stability shape basic warm-cloud formation near the ground?

Science needs:

- surface heating
- source-layer humidity
- lapse rate and stability
- boundary-layer depth / inversion
- LCL and cloud-base diagnostics
- cloud-top and max-updraft diagnostics
- dry failed-cumulus controls

Current status:

- partly supported by `boussinesq_2d`
- thermodynamic cloud-base diagnostics exist
- still simplified and qualitative

Next science improvements should follow the post-#174 lower-atmosphere model
hierarchy:

- profile evolution through `boundary_layer_1d`
- controlled cloud formation through `controlled_cloud_column`
- CM1 reference cases for credible cloud-resolving comparison
- current `boussinesq_2d` only as Yellow prototype/comparison

### Evolving Boundary Layer

Physical question:

> How does the daytime atmosphere evolve into a cloud-producing environment?

Science needs:

- evolving temperature and moisture profiles
- surface sensible heat flux
- surface moisture flux / evaporation
- mixed-layer growth
- entrainment of dry air from above
- time-evolving LCL and RH profiles
- dry/moist advection tendencies

Current status:

- not yet a full model capability
- should become a major next science/product direction after the workbench and fair-weather lab are coherent

This is the bridge between static surface-heating scenarios and more realistic cloud evolution. It should begin as a simplified standalone 1-D profile/boundary-layer model before any later export or coupling path is considered.

### Layered Atmosphere

Physical question:

> Why do clouds form in separate layers at different altitudes?

Science needs:

- editable temperature and moisture profiles
- moist layers aloft
- dry layers
- inversions
- broad ascent / cooling
- cloud-layer detection diagnostics

Current status:

- profile and layer concepts exist in early form
- needs explicit lab/scenario structure and diagnostics

This should grow naturally from the evolving boundary-layer/profile system.

### Orographic / Terrain Clouds

Physical question:

> How does terrain lift create clouds?

Science needs:

- idealized terrain profiles
- terrain-induced lift approximation
- upstream moisture and stability profiles
- wind controls
- terrain-relative cloud diagnostics
- flat/dry/moist controls

Current status:

- planned as idealized terrain forcing, not full terrain-following CFD

Terrain must be paired with validation and comparison. The goal is qualitative orographic learning, not mesoscale mountain weather prediction.

### Warm Rain / Droplet Growth

Physical question:

> Why does some cloud water become rain while some clouds never rain?

Science needs:

- droplet-size distributions
- cloud liquid water
- rain water
- autoconversion / collision-coalescence approximation
- eventual PySDM or droplet-aware path
- rain-onset diagnostics
- water-budget diagnostics
- sub-cloud evaporation

Current status:

- `microphysics_lab` provides controlled bulk parcel/box behavior
- PySDM remains an isolated evaluation path
- current rain behavior is bulk/placeholder, not droplet-resolved precipitation

This should be a focused lab, not something prematurely bolted onto every dynamics scenario.

### Cloud Optics / Beauty

Physical question:

> Why do clouds look bright, dark, soft, sharp, glowing, or dramatic?

Science/visualization needs:

- cloud liquid water
- optical-depth approximation
- assumed or diagnosed effective radius
- sun angle
- view angle / camera
- shadowing and edge brightening
- 2.5-D visual extrusion
- later droplet-aware optics

Current status:

- bulk cloud appearance is appropriate before PySDM
- 2.5-D can provide spatial payoff before true 3-D

Optics is not merely polish. It is a product pillar, provided approximations are labeled clearly.

### Fog / Stratus

Physical question:

> Why does fog or low stratus form near the surface, and why does it dissipate?

Science needs:

- surface cooling
- near-surface humidity
- inversion strength
- mixing/wind controls
- morning warming / dissipation
- fog-depth diagnostics

Current status:

- not yet a separate lab
- should become easier after profile and boundary-layer capabilities exist

### Mixed-Phase / Ice

Physical question:

> How do cold clouds differ from warm clouds?

Science needs:

- freezing level
- liquid vs ice water
- supercooled liquid
- ice nuclei proxy
- snow/ice precipitation categories later
- ice-aware optics later

Current status:

- later lab
- should not be near-term until warm-cloud, profile, rendering, and validation foundations are stronger

## Warm-Cloud Microphysics Direction

Early microphysics should remain deliberately simple: vapor, cloud water, and rain water fields with non-negative invariants and documented approximations.

Evaluate PySDM or a similar library for more credible warm-cloud microphysics only in isolated parcel/box/column/prescribed-flow contexts first. PySDM should not be coupled directly to `boussinesq_2d` until both the dynamics and microphysics paths are separately credible.

Droplet-size distributions and effective radius are important for the Warm Rain / Droplet Growth Lab and later droplet-aware optics. They do not need to block bulk optical rendering or early 2.5-D visualization.

## Boussinesq Direction

`boussinesq_2d` remains experimental. It is useful for controlled visual experiments, UI/schema validation, fair-weather cumulus work, and targeted dynamics diagnostics. It should not be treated as a final CFD core.

Improvements to Boussinesq should be driven by lab needs, not abstract solver perfection.

Good reasons to improve Boussinesq:

- fair-weather cloud bases or cloud onset are physically misleading
- boundary artifacts corrupt user-facing labs
- terrain/orographic labs require better vertical transport or boundary behavior
- diagnostics show physically wrong relationships in controlled scenarios

Bad reasons:

- making it generally “more realistic” without a lab question
- preparing it to host advanced microphysics before dynamics are credible
- optimizing current prototype behavior that will later be replaced

## Bulk Rain Direction

Near-term rain can proceed in two stages:

1. Visual/diagnostic bulk rain indicator: show whether a run produced `rain_water_kg_per_kg`, when rain first appeared, and where rain-like shafts appear.
2. Simple bulk rain behavior: add documented sedimentation and evaporation so rain water moves/falls and can evaporate in dry air.

Neither stage should be described as droplet-resolved precipitation formation. PySDM/collision-coalescence remains the later path for more credible rain initiation.

## Terrain/Orographic Direction

Terrain should be introduced as idealized orographic forcing, not a full terrain-following atmospheric model.

Terrain labs should include:

- flat terrain control
- dry ridge no-cloud control
- moist ridge cloud case
- Boulder foothills / upslope-inspired idealized case
- terrain height / slope / lift diagnostics
- cloud location relative to terrain
- below-terrain masking checks

Terrain should not be allowed to create plausible-looking clouds without comparison cases that explain what the approximation does and does not prove.

## 2.5-D And 3-D Direction

2.5-D is a visualization path, not a physics path.

A 2.5-D view may render existing 2-D fields as a shallow visual extrusion with camera controls. It should be labeled as a visual approximation and should not imply out-of-plane dynamics.

True 3-D simulation is a later hard-core modeling path. It should wait until:

- the lab-driven workbench is coherent
- 2-D labs and schemas are stable
- visualization and diagnostics are mature
- the project has a specific lab need that cannot be served by 2-D / 2.5-D
- compute/performance and validation costs are accepted deliberately

## Validation Philosophy

Validation should protect lab behavior and scientific honesty.

Tests and diagnostics should answer:

- Did the lab do what it claims?
- Did the model respond in the correct physical direction?
- Did numerical behavior remain sane?
- Are approximations labeled?
- Did a change break a user-facing physical explanation?

Validation should not preserve old toy-model behavior just because it existed, and it should not bless new behavior simply because it looks appealing.

## Build Sequence Guidance

The product roadmap is lab-driven, not a rigid feature checklist. A reasonable science/product maturation path is:

1. Workbench V2 and lab-driven UI.
2. Lower Atmosphere Cloud Basics as the first complete reference lab.
3. Cloud Optics / Beauty capabilities, including optical controls and 2.5-D visualization.
4. Evolving Boundary Layer capabilities.
5. Layered Atmosphere controls and diagnostics.
6. Orographic / Terrain Clouds with validation.
7. Warm Rain / Droplet Growth, including droplet distributions and bulk-to-droplet-aware comparison.
8. Fog / Stratus.
9. Mixed-Phase / Ice later.
10. True 3-D only when a lab need and science framework justify it.

## Durable Rule

Add physics because it enables a lab, answers a physical question, improves a diagnostic, or prevents misleading output.

Do not add physics merely because it is interesting in isolation.

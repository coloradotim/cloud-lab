# Cloud Lab Lab Roadmap

## North Star

Cloud Lab helps users explore atmospheric physics through beautiful, interactive cloud experiments grounded in real physical principles.

The product should be organized around phenomenon labs: guided experiment spaces that help users ask and answer physical questions about clouds.

Cloud Lab should not be organized primarily around solver modes, implementation details, or accumulated UI panels. Solvers support labs; they do not define the product.

## Lab Principles

Each lab should define:

- the physical question being explored
- the user controls that matter
- expected behaviors
- model capabilities required
- diagnostics that explain the result
- visual payoff
- limits and approximations
- future upgrade path

Labs should be beautiful and enjoyable, but not misleading. If a view or behavior is approximate, the UI and docs should say so plainly.

## Shared Platform Capabilities

The labs need a shared science and product framework.

### Atmospheric profiles

Most cloud variety depends on vertical structure. Cloud Lab needs editable and evolvable profiles for:

- temperature
- potential temperature where appropriate
- water vapor / relative humidity
- wind
- stability and inversions
- cloud water / ice later

### Surface forcing

Surface-driven clouds require controls for:

- sensible heating
- moisture flux / evaporation
- surface cooling for fog/stratus
- patchy vs uniform forcing
- diurnal heating curves later

### Mixing and boundary-layer evolution

Many realistic shallow-cloud behaviors require:

- mixed-layer growth
- entrainment of dry air from above
- vertical redistribution of moisture
- cloud-base evolution over time
- dissipation through mixing and evaporation

### Layer forcing and advection

Layered clouds and evolving atmospheres need simplified ways to represent:

- broad ascent / cooling
- dry or moist air advection
- moist layers aloft
- dry layers
- shear or wind profile effects later

### Terrain forcing

Orographic labs need:

- idealized ridge/slope/foothills terrain
- terrain-induced lift approximations
- terrain-relative diagnostics
- honest labels explaining that this is not terrain-following mesoscale modeling

### Warm-rain microphysics

Warm-rain labs need:

- cloud water
- rain water
- droplet-size distribution later
- collision/coalescence or PySDM-style paths later
- water-budget diagnostics
- rain-onset diagnostics

### Rendering and optics

All labs benefit from:

- scientific 2-D views
- cloud appearance views
- sun and camera controls
- bulk optical-depth approximation
- 2.5-D visual extrusion
- later droplet-aware optics

## Lab 1 — Lower Atmosphere Cloud Basics

### Question

How do heating, moisture, and stability shape basic warm-cloud formation near the ground?

Fair-weather cumulus is a baseline scenario/scenario family inside this lab, not the lab name.

### User controls

- surface heating strength
- surface heating pattern
- source-layer / boundary-layer humidity
- lapse rate / stability
- inversion height and strength
- boundary-layer depth
- background wind or shear later

### Expected behavior

- thermals rise from heated ground
- boundary layer deepens or mixes
- cloud forms near lifted condensation level if moisture and lift are sufficient
- fair-weather cumulus can appear as a baseline shallow-cloud outcome
- cloud bases are relatively coherent in well-mixed cases
- cloud tops vary with thermal strength, stability, entrainment, and cloud age
- dry air aloft can erode or suppress clouds

### Diagnostics

- lifted condensation level / expected cloud base
- first cloud time
- actual cloud-base height
- cloud-top height
- max updraft
- cloud water below / near / above LCL
- mixed-layer depth where available
- scenario expected / observed / status summary

### Visual payoff

- rising thermals
- shallow cumulus forming and dissipating
- cloud-base and cloud-top evolution
- scientific and cloud appearance views
- 2.5-D view later

### Current / near-term model needs

- Boussinesq 2-D vertical slice
- structured or painted surface heating
- structured moisture profiles
- LCL / cloud-base diagnostics
- honest labels for model limitations

### Future upgrades

- better boundary-layer mixing
- evolving surface moisture flux
- entrainment diagnostics
- better turbulence approximation
- droplet-aware microphysics if needed

## Lab 2 — Evolving Boundary Layer

### Question

How does the daytime atmosphere evolve into a cloud-producing environment?

### User controls

- initial morning temperature profile
- initial moisture profile
- surface sensible heat flux
- surface moisture flux / evaporation
- dry air above boundary layer
- inversion strength
- entrainment strength
- background dry/moist advection
- time-of-day / solar heating curve later

### Expected behavior

- morning stable layer breaks down
- mixed layer grows upward
- moisture mixes vertically
- cloud base changes over time
- dry entrainment may suppress or dissipate cloud
- cumulus may form, deepen, or fail depending on moisture and stability

### Diagnostics

- mixed-layer depth over time
- LCL over time
- RH profile over time
- inversion strength
- entrainment drying proxy
- surface moisture budget
- cloud onset vs boundary-layer growth

### Visual payoff

- atmosphere visibly evolves during the day
- cloud base rises or lowers
- clouds form, fail, or dissipate for explainable reasons

### Current / near-term model needs

This is a major missing conceptual piece. It may start as a simplified 1-D profile evolution model coupled into the 2-D slice environment.

### Future upgrades

- more physically grounded boundary-layer parameterization
- advection of temperature/moisture profiles
- evolving surface fluxes
- coupling to terrain and layered clouds

## Lab 3 — Layered Atmosphere / Cloud Layers

### Question

Why do clouds form in separate layers at different altitudes?

### User controls

- moist layers aloft
- dry layers
- temperature inversions
- stability profile
- broad ascent / cooling
- vertical wind/advection profile later

### Expected behavior

- clouds form where layers reach saturation
- dry layers separate cloud decks
- inversions trap moisture or suppress growth
- low stratus/fog-like layers can coexist with mid-level cloud-like layers

### Diagnostics

- RH profile
- saturated layers
- inversion height / strength
- cloud layer base and top
- layer thickness
- cloud water by altitude
- explanation of why each layer formed or failed

### Visual payoff

- multiple cloud decks
- dry gaps between layers
- different cloud textures or appearances by altitude

### Current / near-term model needs

- profile editor
- layered humidity and stability definitions
- cloud layer detection diagnostics
- visualization that distinguishes layers

### Future upgrades

- large-scale ascent control
- advective changes in layers
- ice/mixed-phase behavior for high cold layers

## Lab 4 — Orographic / Terrain Clouds

### Question

How does terrain lift create clouds?

### User controls

- terrain shape: slope, ridge, foothills
- terrain height, width, and location
- upstream moisture profile
- wind speed
- stability
- initial cloud-base height
- dry layer aloft

### Expected behavior

- moist air forced upward cools
- cloud forms near, above, or downstream of terrain depending on approximation
- dry cases remain mostly cloud-free
- stronger flow or steeper terrain produces stronger lift
- stable air may produce cap-like or wave-like behavior later

### Diagnostics

- terrain-induced lift region
- cloud location relative to slope or ridge
- upstream LCL
- max vertical velocity near terrain
- cloud base/top relative to terrain
- flat vs ridge comparison

### Visual payoff

- terrain, slope, and cloud relationship is visually clear
- Colorado-style foothills/upslope inspired scenarios

### Current / near-term model needs

- idealized terrain profiles
- terrain-induced lift approximation
- terrain visualization and masking
- terrain validation cases

### Future upgrades

- better terrain-following dynamics
- mountain wave approximations
- real topography import later, if ever justified

## Lab 5 — Warm Rain / Droplet Growth

### Question

Why does some cloud water become rain, while some clouds never rain?

### User controls

- droplet concentration / CCN proxy
- initial droplet size distribution
- updraft strength
- cloud water amount
- time in cloud
- collision/coalescence strength or model choice
- dry sub-cloud air for evaporation

### Expected behavior

- condensation grows droplets gradually
- high droplet concentrations can keep droplets smaller
- collision/coalescence broadens the distribution
- rain appears only after sufficient droplet growth or bulk threshold conditions
- falling rain can evaporate in dry air below cloud

### Diagnostics

- droplet-size distribution
- mean/effective radius
- cloud liquid water
- rain water
- first rain time
- rain-sized mass fraction
- water budget
- sub-cloud evaporation

### Visual payoff

- cloud-to-rain transition
- rain shafts
- droplet-distribution histograms
- comparison of bulk rain vs droplet-aware rain

### Current / near-term model needs

- microphysics_lab validation
- bulk rain indicator
- simple rain sedimentation/evaporation
- optional PySDM evaluation in isolation

### Future upgrades

- PySDM-backed parcel/column/prescribed-flow mode
- collision/coalescence
- aerosol/CCN controls
- droplet-aware optics

## Lab 6 — Cloud Optics / Beauty

### Question

Why do clouds look bright, dark, soft, sharp, glowing, or dramatic?

### User controls

- sun angle
- view angle / camera
- cloud thickness
- cloud water
- assumed effective droplet radius
- optical-depth multiplier
- shadow strength
- edge brightening
- haze/background

### Expected behavior

- thick cloud becomes more opaque
- cloud bases or dense interiors darken
- thin cloud edges remain translucent
- sun-facing edges brighten
- different assumed droplet properties can change appearance
- later droplet outputs can drive visual differences more directly

### Diagnostics and labels

- optical-depth estimate
- assumed effective radius
- bulk optical approximation label
- droplet-aware vs assumed-droplet mode later
- camera / view metadata

### Visual payoff

This lab directly serves the product’s beauty goal. It should make clouds feel spatial, luminous, and compelling without overclaiming.

### Current / near-term model needs

- bulk cloud appearance renderer
- optical controls
- 2.5-D visual extrusion
- camera and perspective controls

### Future upgrades

- droplet-aware optics
- rain attenuation
- volumetric rendering
- cinematic export

## Lab 7 — Fog / Stratus

### Question

Why does fog or low stratus form near the surface, and why does it dissipate?

### User controls

- surface cooling
- near-surface humidity
- wind / mixing
- inversion strength
- surface moisture flux
- morning warming

### Expected behavior

- saturation occurs near the ground
- fog or stratus forms as a shallow layer
- mixing or warming dissipates it
- strong wind can mix out fog
- inversion traps moisture near the surface

### Diagnostics

- near-surface RH
- surface temperature / dewpoint spread
- saturation height
- fog depth
- dissipation time
- mixed-layer growth after sunrise

### Visual payoff

- shallow low cloud or fog layers
- dissipation as heating/mixing grows
- distinct visual regime from cumulus

### Current / near-term model needs

- surface cooling / morning warming controls
- layered humidity and inversion setup
- low-cloud/fog detection

### Future upgrades

- radiation cooling approximation
- surface-energy balance approximation
- fog/stratus-specific visual rendering

## Lab 8 — Mixed-Phase / Ice Clouds

### Question

How do cold clouds differ from warm clouds?

### User controls

- freezing level
- cloud temperature
- ice nuclei proxy
- supercooled liquid water
- simple ice/snow conversion
- vertical temperature profile

### Expected behavior

- cloud phase depends on temperature and nuclei availability
- supercooled liquid may exist below freezing
- ice processes change cloud and precipitation behavior
- snow/ice precipitation differs from warm rain

### Diagnostics

- freezing level
- liquid vs ice cloud water
- supercooled liquid amount
- ice mass
- snow/graupel proxy later

### Visual payoff

- high cold clouds
- mixed-phase layers
- ice/snow appearance later

### Current / near-term model needs

This is not near-term. It should remain a later lab until warm-cloud, profile, terrain, and visualization foundations are stronger.

### Future upgrades

- ice microphysics
- mixed-phase validation
- snow/graupel categories
- ice-aware optics

## Recommended Build Sequence

The exact implementation order can change, but the product should mature in this direction:

1. Workbench v2 and lab-driven UI
2. Lower Atmosphere Cloud Basics as the first complete end-to-end lab
3. Cloud optics / beauty capabilities
4. Evolving boundary-layer model and diagnostics
5. Layered atmosphere controls and diagnostics
6. Orographic terrain clouds
7. Warm rain / droplet growth
8. Fog / stratus
9. Mixed-phase / ice later

## What To Avoid

Avoid building features that are not clearly attached to a lab.

Avoid adding physics just because it is interesting. Add physics because it enables a lab, answers a question, or improves a diagnostic that users can understand.

Avoid letting the current frontend dictate product structure. The current frontend is a working prototype, not the final product architecture.

Avoid claiming realism that the model does not support.

## Durable Test For New Work

Before adding any feature, ask:

1. What lab does this serve?
2. What physical question does it help answer?
3. What user control or visual payoff does it enable?
4. What diagnostics validate it?
5. What approximation or limitation must be disclosed?

If those questions cannot be answered, the feature should wait.

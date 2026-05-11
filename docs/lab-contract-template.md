# Lab Contract Template

Use this template when adding or substantially revising a Cloud Lab lab.

A lab is a guided experiment space. It is broader than a scenario and broader than a solver. A lab should help users explore one physical question through meaningful controls, visible behavior, diagnostics, and honest limitations.

## Lab Name

`<Name>`

## Physical Question

What question does this lab help the user explore?

Example:

> Why do puffy cumulus clouds form on some warm afternoons and not others?

## User Promise

What should the user be able to do and learn?

Example:

> Users can vary surface heating, humidity, and stability, then see whether clouds form, when they form, how high they grow, and why they fail or succeed.

## Primary Concepts

List the atmospheric physics concepts this lab teaches.

Examples:

- surface heating
- buoyant thermals
- LCL / cloud base
- boundary-layer depth
- entrainment/drying
- droplet growth
- terrain lift
- optical depth

## Current Maturity

Choose one:

- `concept`
- `prototype`
- `usable`
- `advanced`

Explain the maturity in one paragraph.

## User Controls

### Primary Controls

These should be visible by default. Keep this list short.

| Control | Meaning | Expected effect | Units / type |
| --- | --- | --- | --- |
|  |  |  |  |

### Secondary Controls

Useful, but not always visible.

| Control | Meaning | Expected effect | Units / type |
| --- | --- | --- | --- |
|  |  |  |  |

### Advanced Controls

For expert tuning, reproducibility, or debugging.

| Control | Meaning | Why advanced |
| --- | --- | --- |
|  |  |  |

## Initial Conditions And Forcing

Describe the state and forcing this lab needs.

Include:

- temperature profile
- moisture profile
- wind/advection
- surface heat/moisture flux
- terrain/lift forcing
- droplet/CCN assumptions if relevant
- seed/reproducibility behavior

## Expected Behavior

Describe what should happen when the lab behaves plausibly.

Examples:

- thermals rise from heated ground
- cloud forms near expected LCL
- cloud tops vary more than bases
- dry air aloft limits growth
- terrain lift creates cloud near ridge
- rain appears only after cloud water/droplet growth supports it

## Failure / No-Cloud Cases

Describe physically meaningful failure cases.

Examples:

- dry source layer prevents cloud formation
- stable cap suppresses vertical growth
- no-lift microphysics control remains cloud-free
- dry ridge case should remain mostly cloud-free

## Diagnostics

List diagnostics the lab needs.

| Diagnostic | Purpose | Hard failure, warning, or display-only? |
| --- | --- | --- |
|  |  |  |

Possible diagnostics:

- expected LCL
- first cloud time
- cloud-base height
- cloud-top height
- max updraft
- RH profile
- mixed-layer depth
- inversion strength
- terrain-relative cloud position
- first rain time
- droplet-size distribution
- optical-depth estimate

## Visualization Modes

List the views that best support this lab.

- Scientific 2-D field view
- Cloud appearance view
- 2.5-D visual extrusion
- Profile/sounding view
- Droplet histogram
- Rain-shaft view
- Terrain-relative view
- Comparison view

## Physics Core Requirements

Which physics core or future physics capability supports this lab?

Examples:

- `boussinesq_2d`
- `microphysics_lab`
- future evolving boundary-layer model
- future terrain forcing model
- future PySDM-backed microphysics
- future true 3-D core

Explain what the core must emit or support.

## Frame / Schema Requirements

List required frame fields or schema extensions.

Examples:

- `cloud_liquid_water_kg_per_kg`
- `water_vapor_kg_per_kg`
- `rain_water_kg_per_kg`
- `vertical_velocity_m_per_s`
- optional `microphysics` payload
- terrain metadata
- profile metadata

## Approximation And Honesty Labels

List approximations the UI must disclose.

Examples:

- Boussinesq prototype, not quantitative CFD
- bulk rain indicator, not droplet-resolved precipitation
- 2.5-D visual extrusion from 2-D fields
- assumed effective radius for optics
- prescribed parcel lift, not predicted updraft

## Built-In Scenarios

List initial scenarios inside this lab.

| Scenario | Purpose | Expected result | Key controls |
| --- | --- | --- | --- |
|  |  |  |  |

## Comparison Ideas

What comparisons should users be able to run?

Examples:

- moist vs dry boundary layer
- weak vs strong heating
- flat terrain vs ridge
- no-lift vs lifted parcel
- low vs high droplet concentration

## Validation Expectations

What should tests or validation protect?

Include:

- hard failures
- warnings/diagnostics
- relationship tests
- no-cloud controls
- numerical sanity checks

## Known Limitations

List what this lab does not yet prove or model.

## Future Upgrades

List likely future upgrades.

Examples:

- better boundary-layer mixing
- PySDM-backed droplet distributions
- terrain-following dynamics
- ice microphysics
- droplet-aware optics
- true 3-D simulation

## Documentation Checklist

When implementing this lab, update:

- `docs/lab-roadmap.md`
- this lab's own documentation, if separate
- `docs/scenarios.md`
- `docs/scientific-roadmap.md`, if physics direction changes
- `docs/testing-and-validation.md`, if validation policy changes
- `docs/simulation-data-model.md`, if schema/config changes
- `docs/visualization-dashboard.md`, if visualization behavior changes
- `AGENTS.md`, only if durable agent guidance changes

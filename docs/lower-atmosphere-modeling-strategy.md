# Lower-Atmosphere Modeling Strategy

Issue: #174

This document defines Cloud Lab's lower-atmosphere modeling strategy and science
stack. It moves Cloud Lab away from treating the current `boussinesq_2d`
prototype as the main science path, and toward a model hierarchy that can
support scientifically valid exploration of cloud formation, evolution,
precipitation, and optics.

This is a science-architecture document. It does not implement model code,
change solver constants, change scenario presets, alter renderer behavior, or
claim that the current Boussinesq prototype is Green.

## Decision Summary

Cloud Lab should not pursue a patched in-house Boussinesq core as the main path
to scientifically valid lower-atmosphere modeling.

Cloud Lab should use a model hierarchy:

```text
Reference model layer
  ↓
Interactive reduced-model layer
  ↓
Cloud Lab field / diagnostic / provenance contracts
  ↓
Visualization and optics layer
```

The recommended science stack is:

1. **CM1-based offline reference simulations** for credible cloud-resolving
   lower-atmosphere behavior.
2. **A 1-D boundary-layer / profile model** for interactive environmental
   evolution.
3. **Controlled parcel, column, or prescribed-lift cloud-formation models** for
   interpretable cloud onset, cloud-base, evaporation, and failure cases.
4. **Controlled microphysics and optional PySDM paths** for droplet growth,
   precipitation, and future droplet-aware optics.
5. **Normalized field, diagnostic, and provenance contracts** that let Cloud Lab
   compare reference-model outputs, reduced-model outputs, diagnostics, and
   saved runs without leaking solver internals into the UI.
6. **Optics and rendering layers** that consume physical fields, preserve source
   provenance, and disclose visual approximations.

The shared optics boundary is documented in `docs/optics-field-contract.md`.
That contract defines required optics inputs, provenance categories,
assumed-versus-modeled droplet labels, and validation expectations for future
appearance views.

In plain terms:

```text
Use real atmospheric models to establish reference behavior.
Use simple interactive models to teach cause and effect.
Use renderers to make physical fields visible and beautiful.
Do not ask one prototype solver to do all of that.
```

## Current Boussinesq Role

Current `boussinesq_2d` status:

```text
Yellow — prototype visual dynamics scaffold
```

`boussinesq_2d` remains useful, but it should be demoted from "main science
engine" to "contained prototype scaffold."

It may remain available for:

- controlled qualitative Lower Atmosphere Cloud Basics experiments
- regression tests
- reference-case diagnostics
- exploratory visualization
- comparison against future reduced and reference-model paths
- historical continuity while the new science stack is implemented

It should not be used as the trusted foundation for:

- polished future cloud-resolving labs
- terrain/orographic cloud claims
- precipitation / warm-rain coupling
- advanced microphysics
- optics truth claims
- quantitative cloud timing, cloud depth, or cloud amount
- live-coupled Evolving Boundary Layer work
- successor-model validation

The reason is not that `boussinesq_2d` is useless. The reason is that the
trust-remediation work shows it is still a Yellow prototype. In particular, the
stabilizer audit showed that the default Lower Atmosphere baseline reaches the
theta perturbation safety cap, and that damping/diffusion materially shape cloud
amount, cloud timing, updraft strength, and cloud-top height. The numerical-method
contract therefore classifies the current solver as acceptable only for
prototype-scoped, honestly labeled Lower Atmosphere experiments.

Do not tune scenario presets, constants, or rendering thresholds to hide those
findings.

## Strategy Principle

Every model path should answer one question clearly.

```text
How does the lower atmosphere become cloud-favorable?
  → boundary_layer_1d

Given this profile and lift history, does cloud form?
  → controlled_cloud_column

What does credible cloud-resolving behavior look like?
  → CM1 reference runs

Why does cloud water become rain?
  → microphysics_lab / optional PySDM

Why does this cloud look bright, dark, soft, glowing, or dramatic?
  → optics consuming physical cloud and droplet fields
```

Do not add physics just because it is interesting. Add a model or process because
it serves a lab, answers a physical question, supports a diagnostic, or prevents
misleading output.

## Model Hierarchy

### 1. Reference Model Layer

Purpose:

- Provide scientifically credible cloud-resolving reference behavior.
- Generate offline datasets for comparison, validation, visualization, and
  learning.
- Anchor interactive reduced models to trustworthy examples.
- Support future reference case libraries for cloud formation, suppression,
  precipitation, terrain, and optics.

Initial reference engine:

```text
CM1 offline idealized simulations
```

CM1 is the right first reference candidate because it is designed for idealized
and theoretical atmospheric studies, and it supports small-scale atmospheric
processes such as thunderstorms and turbulent flow. Cloud Lab should not embed
CM1 in the browser app or require it for normal local use. Instead, Cloud Lab
should ingest offline CM1 outputs through an adapter.

For realistic 2-D cloud evolution, CM1 reference output is the credibility
anchor. `boundary_layer_1d` and `controlled_cloud_column` are explanatory and
interactive reduced models; they should not be treated as the primary source of
realistic spatial cloud evolution.

Target flow:

```text
CM1 idealized run
  ↓
NetCDF / reference output
  ↓
Cloud Lab reference adapter
  ↓
Reference frame / normalized field contract
  ↓
Diagnostics
  ↓
Scientific visualization / optics / comparison
```

Later reference engine:

```text
WRF for mesoscale / terrain / realistic-context cases
```

WRF should be treated as a later model for terrain, mesoscale context, real-data
initialization, or Colorado-style cases where that complexity is justified. WRF
should not be the first Cloud Lab science dependency because it is broader,
heavier, and more operational/mesoscale than the immediate lower-atmosphere
learning problem.

Reference-layer non-goals:

- Do not run CM1 or WRF inside routine Cloud Lab sessions.
- Do not make reference-model dependencies required for normal local use.
- Do not present reference datasets as interactive solver output.
- Do not treat synthetic adapter fixtures as scientific truth.
- Do not use reference runs to bypass lab/scenario explanation.

### 2. Interactive Reduced-Model Layer

Purpose:

- Provide fast local interaction.
- Teach cause and effect.
- Keep failures interpretable.
- Let users explore relationships among heating, moisture, stability, lift, and
  cloud potential without pretending to resolve turbulence.

Initial interactive engines:

```text
boundary_layer_1d
controlled_cloud_column
microphysics_lab
```

These engines should be transparent and deterministic. They should be validated
against physical relationships and compared to reference runs where possible.

#### `boundary_layer_1d`

Question:

```text
How does the lower atmosphere become favorable, or fail to become favorable, for cloud formation?
```

Scope:

- 1-D vertical profile evolution
- surface sensible heating
- surface moisture flux
- mixed-layer growth
- entrainment drying
- cap/inversion suppression
- LCL evolution
- RH profile evolution
- cloud formation potential

V1 should not emit cloud water. That is intentional. It should diagnose whether
the evolving environment becomes favorable for shallow cloud.

Primary outputs:

- temperature profile
- water vapor / RH profile
- mixed-layer depth
- LCL
- inversion/cap diagnostics
- entrainment drying proxy
- cloud formation potential status
- deterministic limiting reason

#### `controlled_cloud_column`

Question:

```text
Given this environment and lift history, does cloud form?
```

Scope:

- profile-driven cloud formation
- prescribed lift / thermal history
- parcel or column condensation
- evaporation in subsaturated air
- cloud-base and first-cloud diagnostics
- dry failed and capped/suppressed cases

The lift is prescribed forcing, not predicted dynamics. That must be labeled.

Primary outputs:

- first saturation time
- first cloud time
- cloud base
- cloud water
- evaporation tendency / proxy
- dry failed status
- capped/suppressed status
- deterministic explanation

#### `microphysics_lab`

Question:

```text
Why does some cloud water become rain while some does not?
```

Scope:

- controlled parcel / box / column microphysics
- cloud water
- rain water
- droplet distributions later
- first rain time
- water-budget diagnostics
- sub-cloud evaporation
- optional PySDM evaluation

Microphysics should remain isolated from live `boussinesq_2d` dynamics until both
the dynamics and microphysics paths are independently credible and a specific lab
requires coupling.

### 3. Cloud Lab Contract Layer

Purpose:

- Normalize outputs from reference models and interactive models.
- Preserve units, provenance, assumptions, and trust labels.
- Keep the frontend and renderer from depending on solver internals.
- Allow diagnostics, saved runs, comparison, and optics to consume fields from
  different model tiers.

Contract families should include:

```text
profile-frame-v1
reference-frame-v1
sim-frame-v1
cloud-column-output-v1
microphysics payloads
diagnostic summaries
provenance metadata
approximation labels
validation classifications
```

Key contract principles:

- Every physical field must have documented units.
- Every output should identify its source:
  - solver output
  - reference model output
  - reduced model output
  - prescribed forcing
  - generated preset field
  - derived diagnostic
  - visual approximation
  - assumed parameter
- Diagnostics should explain behavior without hiding uncertainty.
- Rendering should consume fields; it should not mutate model state or invent
  physical truth.
- Reference outputs should carry source model and case metadata.
- Reduced models should disclose that they are simplified and interactive.

### 4. Visualization And Optics Layer

Purpose:

- Make physical fields visible, beautiful, and understandable.
- Keep scientific views and appearance views separate.
- Support the product's beauty goal without loosening scientific honesty.

Inputs may include:

- cloud liquid water
- rain water
- vapor / RH
- temperature
- velocity or prescribed lift
- mixed-layer depth
- LCL
- cloud base / cloud top
- droplet effective radius
- droplet distribution
- optical depth
- cloud thickness/depth metadata
- sun angle
- view angle
- provenance labels

Optics may consume fields from:

- reference model outputs
- reduced model outputs
- controlled microphysics outputs
- generated preset fields
- future saved runs

Optics must not:

- create weather
- mutate solver fields
- hide below-LCL, return-flow, or boundary warnings
- imply droplet-aware rendering when droplet fields are assumed
- imply radiative-transfer fidelity unless that capability exists

## Scenario Classes

### Boundary-Layer Evolution

Physical question:

```text
How does the lower atmosphere become favorable, or fail to become favorable, for cloud formation?
```

Engine:

```text
boundary_layer_1d
```

Initial scenarios:

- morning stable layer breaks down
- moist surface, cumulus favorable
- dry entrainment suppresses potential
- surface moisture flux enables potential
- strong cap suppresses growth
- no-flux control

Outputs:

- temperature profile
- water vapor / RH profile
- mixed-layer depth
- LCL
- cap / inversion state
- entrainment drying proxy
- cloud formation potential
- limiting reason

V1 non-goal:

```text
No cloud water in v1.
```

### Controlled Cloud Formation

Physical question:

```text
Given this environment and lift history, does cloud form?
```

Engine:

```text
controlled_cloud_column
```

Initial scenarios:

- humid lifted column
- dry failed column
- weak lift / no cloud
- stronger lift / earlier cloud
- capped / suppressed column
- evaporation in subsaturated layer
- no-lift control

Outputs:

- first saturation time
- first cloud time
- cloud base
- cloud water
- evaporation
- dry failed status
- capped/suppressed status
- prescribed lift metadata

### Reference Cloud Evolution

Physical question:

```text
What does credible cloud-resolving behavior look like for this scenario family?
```

Engine:

```text
CM1 reference dataset
```

Initial reference cases:

- dry thermal
- shallow cumulus baseline
- dry failed cumulus
- capped/suppressed cumulus
- warm-rain shallow cloud later
- terrain/orographic case later

Outputs:

- cloud water
- vapor
- temperature
- velocity
- rain water when configured
- grid/time metadata
- diagnostics
- provenance

Purpose:

- show credible behavior
- validate reduced-model relationships
- provide source fields for scientific visualization and optics
- support comparison workflows

### Warm Rain / Precipitation

Physical question:

```text
Why does some cloud water become rain while some does not?
```

Engine:

```text
microphysics_lab / optional PySDM
```

Initial scenarios:

- no-lift dry control
- humid lifted parcel
- strong lift / rain threshold
- heating offsets lift
- prescribed-column warm-rain case later
- droplet-aware case later

Outputs:

- cloud water
- rain water
- first cloud time
- first rain time
- water budget
- droplet distribution later
- effective radius later
- sub-cloud evaporation later

### Optics

Physical question:

```text
Why does this cloud look bright, dark, soft, glowing, or dramatic?
```

Engine:

```text
optics renderer consuming physical fields
```

Inputs:

- cloud liquid water
- optical depth
- cloud depth/thickness
- effective radius or assumed radius
- rain water later
- phase later
- sun angle
- view angle
- source provenance

Outputs:

- scientific cloud-water view
- optical-depth view
- rendered appearance view
- light-path / shadow view
- droplet-aware optics later

## Lab Mapping

| Lab | Recommended science path |
| --- | --- |
| Lower Atmosphere Cloud Basics | `boundary_layer_1d` + `controlled_cloud_column` + CM1 references; current `boussinesq_2d` only as Yellow prototype/comparison |
| Evolving Boundary Layer | `boundary_layer_1d` |
| Layered Atmosphere | profile/layer model first; reference data later |
| Orographic / Terrain Clouds | CM1/WRF/reference first; do not use current Boussinesq as polished terrain engine |
| Warm Rain / Droplet Growth | controlled microphysics / optional PySDM |
| Fog / Stratus | profile/surface-cooling model first |
| Cloud Optics / Beauty | optics consuming generated, reduced-model, reference-model, or microphysics fields |
| Mixed-Phase / Ice | later only |

## Implementation Sequence

Recommended order:

```text
1. Define lower-atmosphere modeling strategy.
2. Demote current boussinesq_2d to Yellow prototype in docs/UI language.
3. Implement boundary_layer_1d profile model v1.
4. Build Evolving Boundary Layer Workbench v1 around boundary_layer_1d.
5. Implement controlled_cloud_column v1.
6. Design Lower Atmosphere Cloud Basics v2 around profile + controlled-column flow.
7. Add CM1 reference-run adapter spike.
8. Define CM1 lower-atmosphere reference case library.
9. Extend controlled microphysics / precipitation diagnostics.
10. Define and implement optics physical-field contract.
11. Add comparison workflows between reduced models and reference cases.
12. Consider successor free-dynamics core only after a lab proves it needs one.
```

The first code implementation should not touch current `boussinesq_2d`. It should
add `boundary_layer_1d`.

As of #178, `controlled_cloud_column` v1 also exists as a standalone backend
prescribed-lift model. The next lower-atmosphere science work should build on
those reduced-model contracts rather than re-centering future work on the
Yellow-status Boussinesq prototype.

## Validation Philosophy

Validation should protect the model hierarchy.

### Reference Models

Reference models anchor realism.

Validation should ensure:

- source files are identified
- units are preserved
- field mappings are correct
- reference diagnostics are deterministic
- missing fields are surfaced clearly
- reference outputs are not confused with interactive solver output

### Reduced Models

Reduced models protect physical relationships.

Validation should ensure:

- no-flux controls remain nearly unchanged
- higher humidity lowers LCL
- stronger heating deepens mixed layer
- stronger cap suppresses mixed-layer growth
- prescribed lift condenses humid parcels
- dry or no-lift controls remain cloud-free
- evaporation occurs in subsaturated air
- deterministic output for fixed configs

Reduced models do not need to reproduce every morphology detail of a CM1 run.
They should reproduce the teaching-relevant relationships and diagnostics.

### Boussinesq Prototype

Boussinesq validation should continue to protect:

- finite fields
- nonnegative moisture
- quiet/no-forcing behavior
- dry thermal sanity
- stable/capped relationship tests
- return-flow/boundary artifact warnings
- cap/stabilizer diagnostics

It should not be used to claim broad cloud-resolving realism.

### Optics

Optics validation should ensure:

- visual controls do not mutate source fields
- zero cloud water renders no meaningful cloud
- higher cloud water increases optical response, all else equal
- assumed droplet radius is labeled as assumed
- droplet-aware rendering is labeled only when actual droplet fields exist
- reference/reduced/generated source provenance is preserved
- visual approximations are visible to the user

## What Not To Do

Do not keep patching `boussinesq_2d` as the main science path.

Do not tune Boussinesq constants or scenario presets to hide cap/stabilizer
findings.

Do not couple PySDM directly to current `boussinesq_2d`.

Do not build polished terrain/orographic labs on current Boussinesq.

Do not let rendering create implied physics.

Do not hide scientific warnings in the renderer.

Do not block non-Boussinesq labs while successor dynamics is unresolved.

Do not treat CM1 or WRF as live interactive app dependencies.

Do not implement a heavy successor dynamics core until the lab need and validation
contract are explicit.

## Relationship To #160

Issue #160 should use this strategy as its decision framework.

The answer to #160 should not be "keep improving Boussinesq until it becomes
realistic."

The answer should be:

```text
Keep boussinesq_2d as a Yellow prototype scaffold.
Build scientifically valid lower-atmosphere learning through a hierarchy of
reference models, interactive reduced models, diagnostics, and optics.
Use successor free-dynamics work only when a specific lab requires it and the
validation contract is clear.
```

## Relationship To Workbench V2

Workbench V2 remains valuable. The product still needs:

```text
Choose lab → choose scenario → adjust physical controls → run/watch/inspect →
save/compare → vary → learn
```

The main change is which model path serves each lab:

- Lower Atmosphere v1 can keep Yellow-labeled Boussinesq while v2 is designed.
- Evolving Boundary Layer should use `boundary_layer_1d`.
- Warm Rain should use controlled microphysics.
- Cloud Optics should consume fields.
- CM1 reference cases should become comparison and visualization sources.

The UI should present labs and scenarios, not solver modes.

## Documentation Update Guidance

After this document lands, update:

- `docs/ai-handoff.md`
- `docs/doc-index.md`
- `docs/next-physics-core.md`
- `docs/scientific-roadmap.md`
- `docs/lab-roadmap.md`
- `docs/labs/lower-atmosphere-cloud-basics.md`
- `docs/labs/evolving-boundary-layer.md`

Suggested `docs/ai-handoff.md` update:

```text
Current modeling strategy:

Cloud Lab is moving from a solver-centered Boussinesq path to a lower-atmosphere
model hierarchy. `boussinesq_2d` remains a Yellow prototype scaffold for
controlled Lower Atmosphere Cloud Basics experiments, but it is not the main
scientific path for future cloud formation, terrain, precipitation, or optics
claims.

Near-term science implementation should prioritize:
1. `boundary_layer_1d` profile evolution.
2. `controlled_cloud_column` cloud formation under prescribed lift.
3. CM1 reference-run adapter and reference case library.
4. controlled microphysics / precipitation diagnostics.
5. optics field contract.

Do not tune Boussinesq constants or presets to hide #159/#172 findings.
```

Suggested `docs/next-physics-core.md` update:

```text
After #174, the recommended lower-atmosphere strategy is a model hierarchy:
CM1 offline reference cases, `boundary_layer_1d`, `controlled_cloud_column`,
controlled microphysics / optional PySDM, and optics consuming physical fields.
`boussinesq_2d` remains available as a Yellow prototype scaffold, not the main
science path for polished future cloud-resolving labs.
```

## Final Decision

Cloud Lab should move forward with this modeling strategy:

```text
CM1 reference cases
+ boundary_layer_1d profile evolution
+ controlled_cloud_column cloud formation
+ controlled microphysics / optional PySDM
+ normalized field and diagnostic contracts
+ optics consuming physical fields
```

Current `boussinesq_2d` remains:

```text
Yellow prototype visual dynamics scaffold
```

It is useful, but it is no longer the main path to scientific validity.

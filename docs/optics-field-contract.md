# Cloud Optics Physical-Field Contract

Issue: #181

This document defines the physical-field contract that connects Cloud Lab's
cloud formation, microphysics, offline reference models, visualization, and
optics layers.

It is a documentation and architecture contract. It does not implement renderer
behavior, add radiative transfer, change solver physics, run CM1, add PySDM, or
change Boussinesq behavior.

## Principle

```text
Optics consumes physical fields and renderer controls.
Optics does not create weather, mutate solver state, or hide scientific warnings.
```

Optics can turn cloud fields into beautiful, understandable visual
interpretations. It cannot decide whether cloud forms, change emitted cloud
water, invent missing rain, remove warning labels, or silently convert display
controls into model truth.

The durable boundary is:

```text
physical source fields + provenance + renderer controls
  ->
scientific fields, derived optical diagnostics, and appearance views
```

## Field Provenance Categories

Every optics input should carry, or be paired with, a provenance category. The
category tells the renderer and UI how honestly the value can be described.

| Category | Meaning | Example |
| --- | --- | --- |
| `solver_output` | Field emitted directly by the selected solver. | `cloud_liquid_water_kg_per_kg` from a live `sim-frame-v1` run. |
| `reference_model_output` | Offline reference-model field with source metadata. | CM1 `reference-frame-v1` cloud liquid water. |
| `reduced_model_output` | Output from an interactive simplified model. | `controlled_cloud_column` cloud liquid water or `boundary_layer_1d` profile fields. |
| `microphysics_output` | Bulk or droplet-aware microphysics product. | effective radius, number concentration, or rain indicator from a future microphysics payload. |
| `generated_preset_field` | Deterministic preset source field used for an optics lab. | `cloud_density` in `cloud-optics-scene-v1`. |
| `derived_diagnostic` | Computed from fields or metadata, not emitted as a source field. | optical-depth estimate or light-path proxy. |
| `visual_approximation` | Rendering interpretation, not a physical source field. | cloud appearance opacity, 2.5-D extrusion, shadow proxy. |
| `assumed_parameter` | Parameter supplied because the physical field is unavailable. | assumed effective radius when no droplet field exists. |

These categories are compatible with the current frontend truth labels in
`frontend/src/visualization.ts`, but this contract is broader because optics
also needs `microphysics_output`, `generated_preset_field`, and
`assumed_parameter` categories.

## Required Optics Inputs

An optics renderer or appearance view should not run from an untyped cloud
image. It should receive an explicit input bundle.

Required source fields and metadata:

| Input | Unit / type | Required meaning |
| --- | --- | --- |
| `cloud_liquid_water` or `cloud_density` | kg kg-1, kg m-3, or normalized with label | Source cloud amount field. The unit must be explicit. |
| `cloud_water_unit` | string | Unit for the cloud source field. |
| grid coordinates | m or normalized with label | x/z coordinates, grid shape, and orientation. |
| cloud thickness / depth metadata | m or normalized with label | Physical depth, proxy path length, or 2.5-D extrusion metadata. |
| sun elevation | degrees or named preset mapped to degrees | Renderer control, not solver state. |
| sun azimuth | degrees or named preset mapped to degrees | Renderer control, not solver state. |
| view angle / camera | degrees, camera preset, or camera metadata | Renderer control, not solver state. |
| optical_depth_multiplier | dimensionless | Renderer control for sensitivity, labeled as an approximation. |
| assumed_effective_radius, if no droplet field exists | micrometers | Assumed droplet-size parameter with an `Assumed droplet radius` label. |
| source provenance | provenance category plus source id | Tells the UI whether the input is solver, reference, reduced, preset, or assumed. |
| approximation labels | string labels | Visible labels for bulk optics, 2.5-D, assumed droplets, and lack of full radiative transfer. |

Renderer controls such as sun angle, exposure, haze, edge softness, and
optical-depth multiplier may change display products. They must not mutate the
source field or write back into solver/reference frames.

## Optional Advanced Optics Inputs

Optional fields improve scientific honesty or future visual quality when they
exist, but their absence must be handled with fallbacks and labels.

| Input | Unit / type | Use |
| --- | --- | --- |
| `effective_radius_um` | micrometers | Droplet-aware optical-depth response when source is modeled or referenced. |
| `droplet_size_distribution` | documented bins and units | Future droplet-aware charts and optical assumptions. |
| `number_concentration` | m-3 | Droplet-aware cloud optical response and microphysics explanations. |
| `liquid_water_content` | kg m-3 | Direct optical-depth input when available. |
| `rain_water` | kg kg-1 or kg m-3 | Scientific rain view, rain-shaft approximation, and later attenuation/visibility. |
| `phase` | `liquid`, `ice`, or `mixed` | Future phase-aware optics labels. |
| terrain / surface reflectance | m plus reflectance metadata | Later terrain cloud lighting context. |
| aerosol / haze proxy | explicit unit or normalized label | Later haze and background-scattering interpretation. |

Optional inputs must preserve source provenance. If a field is missing, the
renderer should either hide that mode or label the assumption it uses instead.

## Required Outputs And Views

The optics contract supports several view types. They should remain separable so
users can distinguish source fields from visual interpretation.

### Scientific Cloud-Water View

Shows the source cloud liquid water or cloud-density field directly. This view
should be available for any appearance mode that uses a physical cloud source.

Label examples:

```text
Reference model output
Solver output
Generated preset field
```

### Optical-Depth View

Shows a derived optical-depth estimate or proxy.

Required labels:

```text
Derived diagnostic
Visual approximation
```

If the estimate uses assumed droplet properties, also show:

```text
Assumed droplet radius
```

### Cloud Appearance View

Renders a visually satisfying interpretation of a cloud field using source
fields plus renderer controls.

Required labels:

```text
Cloud appearance view
Visual approximation
Not full radiative transfer
```

If input fields come from CM1/reference output, preserve:

```text
Reference model output
Offline reference case
Not live interactive simulation
```

### Light-Path / Shadow View

Shows simplified light-path, attenuation, or shadow proxies. This is an
explanatory renderer diagnostic, not a solver field.

Required labels:

```text
Derived diagnostic
Visual approximation
```

### Droplet-Aware Optics View Later

Future views may use effective radius, droplet distributions, or number
concentration. They should show:

```text
Droplet-aware input
```

only when droplet fields are actually present.

### Rain-Shaft / Precipitation Visibility Later

Future views may interpret rain water as rain shafts, attenuation, or
visibility reduction. They must distinguish a scientific rain field view from a
rain-shaft visual approximation.

## Labeling Rules

Use short labels in UI surfaces and longer helper text in inspectors or docs.

Required labels:

| Label | Use when |
| --- | --- |
| `Solver output` | Displaying direct fields from a solver frame. |
| `Reference model output` | Displaying CM1 or other offline reference-model fields. |
| `Reduced model output` | Displaying fields or summaries from interactive reduced models. |
| `Generated preset field` | Displaying deterministic optics lab preset fields. |
| `Derived diagnostic` | Showing optical depth, light path, LCL, cloud base, or similar computed quantities. |
| `Visual approximation` | Showing rendered appearance, 2.5-D extrusion, shadows, opacity, or rain-shaft interpretation. |
| `Assumed droplet radius` | Using an effective radius because no droplet field exists. |
| `Droplet-aware input` | Using modeled or reference-provided droplet fields. |

Never use `Droplet-aware input` for an assumed radius. Never imply full
radiative transfer unless that method exists and is documented.

## Assumed Versus Modeled Droplet Properties

Cloud Lab may use an assumed effective radius before droplet-aware fields exist.
That is acceptable only when labeled clearly.

Rules:

- When `effective_radius_um` is absent, optics may use an assumed effective
  radius for bulk optical-depth estimates.
- The UI must label the assumption with `Assumed droplet radius`.
- The assumed value and unit should be visible in an inspector, legend, or
  metadata panel.
- When microphysics or reference data provides `effective_radius_um`,
  `number_concentration`, or `droplet_size_distribution`, optics may use it and
  label the source as `Droplet-aware input`.
- Do not imply droplet-resolved optics, Mie scattering, or calibrated radiance
  unless those capabilities are explicitly implemented and validated.

Current Clouds, Light, and Shadow v1 is not droplet-aware. It uses deterministic
preset cloud-density fields and lightweight bulk optical relationships.

## Relationship To Precipitation

Rain water may support three different views, each with different honesty
labels:

| Use | Field / product | Labeling |
| --- | --- | --- |
| Scientific rain field view | `rain_water` source field | `Solver output`, `Reference model output`, or `Reduced model output` as appropriate. |
| Rain onset diagnostic | first rain time, max rain water, rain indicator | `Derived diagnostic` or `Bulk approximation` depending on source. |
| Rain-shaft visual interpretation | opacity / streak / attenuation proxy | `Visual approximation`. |

Do not claim full precipitation optics, attenuation, or visibility physics
unless that work is implemented and documented. If rain water is absent, do not
invent rain shafts.

## Relationship To Reference Models

CM1/reference fields feed optics through the reference stack:

```text
reference frame
  ->
cloud liquid water / rain water / velocity
  ->
diagnostics
  ->
optics renderer
```

Reference model output is physical source data with provenance. The optics
interpretation remains approximate unless a radiative-transfer implementation is
explicitly added.

Rules for reference fields:

- Preserve `source_model`, `source_case_id`, source-file metadata, units, and
  missing-field warnings.
- Do not mutate `reference-frame-v1` fields.
- Show scientific 2-D views before or alongside appearance views.
- Keep synthetic CM1-like fixtures labeled as fixtures, not scientific truth.
- Do not run CM1 in normal app sessions.

The current CM1 path is:

```text
CM1 reference cases
  ->
Cloud Lab reference adapter
  ->
2-D scientific cloud visualization
  ->
diagnostics and comparison
  ->
later cloud appearance / 2.5-D rendering
```

## Relationship To Reduced Models

Reduced models explain cause and effect and support fast interaction. They can
feed optics only when their output is honest about scope.

Examples:

- `boundary_layer_1d` emits profile fields and diagnostics, not 2-D cloud water
  in v1, so it should not feed a cloud appearance renderer directly.
- `controlled_cloud_column` emits prescribed-lift cloud liquid water and
  column diagnostics. If rendered later, it should be labeled as reduced-model
  output and prescribed forcing, not cloud-resolving spatial evolution.
- Lower Atmosphere v2 handoff payloads may support future warm-rain diagnostics,
  but they do not currently provide droplet-aware optics or rain rendering.

Do not treat reduced-model fields as the primary source of realistic 2-D cloud
evolution. CM1 reference output is the credibility anchor for that path.

## Relationship To Microphysics

Microphysics outputs can improve optics only when the fields are explicit.

Useful future inputs from `docs/microphysics-schema.md` include:

- `effective_radius_um`
- `mean_radius_um`
- `number_concentration_m3`
- `liquid_water_content`
- `droplet_size_distribution`
- `rain_indicator_fraction`

The optics layer should consume those products through a Cloud Lab schema, not
through PySDM internals. If microphysics payloads are absent, droplet-aware
views should be hidden or replaced with assumed-radius labels.

## Validation Expectations

Future implementation tests should protect these invariants:

- Visual controls do not mutate source fields.
- Zero cloud water renders no meaningful cloud.
- Higher cloud water increases optical response, all else equal.
- Higher effective radius changes optical response only if that relationship is
  implemented and documented.
- `Assumed droplet radius` appears when effective radius is assumed.
- `Droplet-aware input` appears only when real droplet fields are used.
- Reference-model provenance is preserved through appearance views.
- Visual approximation labels appear in appearance and 2.5-D modes.
- Missing fields show fallbacks, not blank views or invented data.
- Scientific field views remain available when appearance views interpret the
  same source fields.

Docs-only changes do not require frontend or backend tests. When code or
metadata changes implement this contract, use the targeted frontend/backend
checks for the touched files.

## Non-Goals

- Do not implement new renderer behavior here.
- Do not add full radiative transfer.
- Do not add 3-D dynamics.
- Do not add PySDM.
- Do not change solver physics.
- Do not hide cloud artifacts.
- Do not make optics determine cloud formation.
- Do not change Boussinesq.

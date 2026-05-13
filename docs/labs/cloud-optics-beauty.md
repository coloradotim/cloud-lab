# Clouds, Light, and Shadow Lab

## Lab Name

Clouds, Light, and Shadow

Internal / file name: `cloud-optics-beauty`

## Physical Question

Why do clouds look soft, dark, glowing, layered, silver-lined, or dramatic under different lighting and viewing conditions?

This lab teaches that cloud appearance is shaped by cloud water, density structure, optical depth, sunlight direction, scattering, and viewing geometry.

## User Promise

Users can choose a preset 2.5-D cloud scene, adjust meaningful light and optical controls, and see how the same cloud field changes appearance as sunlight, view angle, cloud thickness, density, and optical depth change.

Users can toggle between a beautiful rendered view and science views that reveal the underlying cloud water, optical-depth behavior, and simplified light path / shadow structure.

The lab should be beautiful and intuitive, but scientifically honest.

## Primary Concepts

- cloud water density
- optical depth
- attenuation through cloud volume
- approximate single scattering
- sun elevation and azimuth
- view angle / camera geometry
- soft cloud edges from density falloff
- dark cloud bases from optical thickness
- glowing tops and shaded interiors
- bright-edge / silver-lining behavior
- layered depth and parallax-like visual structure
- distinction between source fields and rendering interpretation

## Current Maturity

`concept`

This is a design/spec lab. It is not yet implemented as a Workbench V2 lab. The first implementation should be qualitative and educational. It should not become a full radiative-transfer model, a shader playground, or a general cloud-rendering toy.

## User Controls

### Primary Controls

| Control | Meaning | Expected effect | Units / type |
| --- | --- | --- | --- |
| Cloud scene | Selects the generated cloud field. | Changes the visual/physical behavior being studied. | preset |
| Sun elevation | Height of the sun above the horizon. | Higher sun brightens tops and flattens lighting; lower sun increases side lighting, long paths, and contrast. | degrees or low/medium/high |
| Sun direction / azimuth | Horizontal direction of incoming sunlight. | Moves lit sides, shaded sides, and bright-edge behavior. | degrees or compass-like control |
| View angle | Observer/camera angle relative to the cloud and sun. | Changes front-lit, side-lit, and backlit appearance; changes apparent depth. | degrees or presets |
| Cloud water density | Bulk cloud water amount in the preset field. | Higher density increases optical response, bright lit regions, and darker interiors/bases. | normalized multiplier |
| Cloud thickness / depth | Effective 2.5-D depth of the cloud volume. | Greater depth increases attenuation, interior shadowing, and dark-base behavior. | normalized multiplier |
| Optical depth / scattering strength | Simplified control for how strongly the cloud interacts with light. | Low values look faint/translucent; high values increase contrast, bright edges, and shaded interiors. | normalized multiplier |
| Time of day / light color | Simple lighting preset for color temperature and mood. | Midday is cooler/flatter; late afternoon/golden hour is warmer and more directional. | preset |

### Secondary Controls

| Control | Meaning | Expected effect | Units / type |
| --- | --- | --- | --- |
| Edge softness | Density falloff at cloud boundaries. | Softer edges produce gradual fade; sharper edges look more abrupt. | normalized |
| Background sky brightness | Contrast between cloud and sky. | Changes perceived contrast and edge visibility. | normalized or preset |
| Haze / background scattering | Simple non-cloud atmospheric background effect. | Adds depth cue and can soften contrast. | normalized |
| Exposure / tone mapping | Display brightness mapping. | Prevents bright tops/edges from clipping or shaded bases from disappearing. | preset or normalized |
| Scene seed | Reproducibility for generated scenes. | Repeats the same generated cloud field. | integer |

### Advanced Controls

| Control | Meaning | Why advanced |
| --- | --- | --- |
| Assumed effective droplet radius | Simplified droplet-size assumption used by bulk optical approximation. | V1 does not model droplet-size distributions, so this must not look more precise than it is. |
| Phase-function parameter | Approximate directional scattering behavior. | Important for renderer behavior, but too technical for default users. |
| Ray-march step count | Samples through the 2.5-D volume. | Performance/quality implementation detail. |
| Multiple-scattering approximation strength | Optional cheap approximation if implemented. | Must be clearly labeled as approximate. |
| Density noise scale | Procedural cloud texture control. | Scene-generation/debugging control, not a core physical control. |
| 2.5-D extrusion depth scale | Mapping from field to visual volume. | Visual/debugging control, not true atmosphere depth. |

## Initial Conditions And Forcing

V1 should use preset generated cloud fields. It should not simulate new cloud formation.

The v1 scene model is a **2.5-D volumetric scene**. It may be built from layered fields, stacked density slices, procedural volume approximations, or visual extrusion from a 2-D cloud water field. The goal is enough apparent volume, depth, and light-path behavior to make optics meaningful without claiming true 3-D atmospheric dynamics.

Required scene properties:

- cloud water / density field
- gradual edge-density falloff
- effective cloud thickness
- deterministic seed behavior
- scene metadata describing teaching purpose
- default sun and camera geometry

The first source-scene implementation uses `cloud-optics-scene-v1` records with normalized
`x`/`z` coordinates, a normalized non-negative `cloud_density` field, deterministic 2.5-D
depth metadata, and default renderer-control values. These records are generated source
fields for this lab, not backend solver output or weather forecasts.

Optical forcing:

- directional sunlight
- view/camera direction
- light color / time-of-day preset
- bulk optical-depth/scattering assumptions

Preset fields are acceptable because this lab studies appearance, not formation.

## Expected Behavior

A plausible run should show:

- soft edges when density falls off gradually
- stronger opacity and contrast as cloud water density or optical depth increases
- darker bases/interiors as cloud thickness and optical depth increase
- bright tops and sun-facing sides when sun geometry supports them
- bright-edge / silver-lining behavior in backlit edge geometry
- more spatial depth in broken or layered scenes as view angle changes
- thin veil scenes staying translucent unless optical depth is increased substantially
- cause-and-effect explanations in the inspector as controls change

The same cloud field should look meaningfully different under high sun, low sun, front lighting, side lighting, and backlighting.

## Failure / No-Cloud Cases

Useful v1 cases:

- zero cloud water: rendered view shows no cloud
- very low density / low optical depth: cloud remains faint or translucent
- very high optical depth: lit regions saturate and interiors/bases darken
- front-lit geometry: bright-edge behavior is weak or absent
- thin veil with low optical depth: dark-base behavior is weak or absent
- exposure-only changes: UI should not imply the physical cloud changed

These are meaningful outcomes, not app failures.

## Diagnostics

| Diagnostic | Purpose | Hard failure, warning, or display-only? |
| --- | --- | --- |
| Optical-depth estimate | Shows whether the current path is optically thin, moderate, thick, or very thick. | Display + relationship test |
| Cloud water / density summary | Explains how much cloud material exists. | Display + relationship test |
| Light geometry state | Labels front-lit, side-lit, backlit, high-sun, or low-sun setup. | Display |
| Light-path length proxy | Explains short/moderate/long paths through cloud. | Display + relationship test |
| Edge softness state | Explains visible edge behavior from density falloff and optical depth. | Display |
| Base/interior darkness state | Explains why base/interior darkens or stays bright. | Display |
| Bright-edge likelihood | Indicates weak, moderate, or strong silver-lining-like behavior. | Display + relationship test |
| Layered depth explanation | Explains overlap and view-angle-driven depth in broken scenes. | Display |
| Approximation labels present | Confirms bulk optical and 2.5-D approximations are disclosed. | Hard failure for tests |
| Frame immutability check | Ensures visual controls do not mutate source fields. | Hard failure for tests |

Diagnostics should be deterministic. Explanatory text may be generated from deterministic states.

## Visualization Modes

### Rendered cloud appearance view

Primary visual scene. It should be beautiful, responsive, and central. It should show a 2.5-D volumetric cloud interpretation with directional lighting, opacity/optical-depth behavior, soft edges, and shaded interiors.

This is a rendering interpretation and must be labeled accordingly.

### Cloud water field view

Shows where cloud water/density exists. It reveals source structure, density gradients, and soft edges, and separates cloud shape from lighting effects.

### Optical depth view

Shows where the scene is optically thin, moderate, thick, or very thick. It explains dark bases, shaded interiors, and bright but thin edges.

### Light path / shadow view

Shows simplified directional light behavior through the cloud field. It explains which regions are directly lit, attenuated, or shadowed.

### Scientific 2-D field view

If this lab later imports fields from another lab, scientific 2-D source views must remain available so users can distinguish solver fields from visual approximation layers.

### Future droplet-aware optics view

Future versions may show how droplet effective radius, droplet-size distribution, or phase affect appearance. This is out of scope for v1.

## Physics Core Requirements

V1 does not require a new dynamics solver.

The first implementation should use generated/preset cloud-density fields and a lightweight physically based rendering layer.

Required capabilities:

- deterministic preset cloud field generation
- 2.5-D cloud-density representation
- directional sunlight
- view/camera geometry
- optical-depth estimate
- attenuation through cloud volume
- approximate single scattering
- optional phase-function-inspired directional behavior
- renderer state separate from physical field data

Recommended first implementation path:

1. Inspect existing visualization helpers first.
2. Prefer canvas/WebGL-friendly 2.5-D rendering if it fits the current frontend cleanly.
3. Use WebGL or three.js only if it does not turn the work into a dependency/architecture project.
4. Keep renderer state in the Workbench/lab visualization layer, not inside solver output.
5. Treat visual controls as renderer inputs derived from physical fields.
6. Do not mutate original cloud fields when changing sun, camera, optical depth, or display controls.

## Frame / Schema Requirements

For preset scenes, the lab needs a cloud-density payload equivalent to:

- cloud water / density field
- x/z coordinates or normalized scene coordinates
- optional y/depth or extrusion metadata
- scene seed
- scene preset id
- scene metadata describing teaching purpose

If using existing `sim-frame-v1` frames, the relevant source field is:

- `cloud_liquid_water_kg_per_kg`

Optional supporting fields from simulation frames:

- `water_vapor_kg_per_kg`
- `temperature_k`
- `temperature_perturbation_k`
- `vertical_velocity_m_per_s`
- `horizontal_velocity_m_per_s`
- grid metadata and coordinates

Renderer state should be separate from source fields and may include sun elevation, sun azimuth, view angle, light color, optical-depth multiplier, scattering strength, exposure, selected visualization mode, and 2.5-D depth scale.

Derived diagnostics may include optical-depth estimate, light-path proxy, bright-edge likelihood, base-darkening likelihood, edge-softness state, and lighting classification.

## Approximation And Honesty Labels

The UI and docs should disclose:

- visual approximation
- bulk optical approximation
- 2.5-D visual scene, not true 3-D dynamics
- preset/generated cloud field, not new cloud formation
- lightweight volumetric rendering
- approximate single scattering
- multiple scattering simplified or omitted
- assumed droplet properties where used
- not full radiative transfer
- not droplet-resolved Mie scattering
- not a calibrated radiance product
- not weather prediction

Suggested label:

> This lab uses simplified cloud fields and lightweight physically based rendering to make cloud optics intuitive. It shows how light, optical depth, and viewing geometry shape cloud appearance. Treat it as a qualitative learning tool, not a full radiative-transfer model.

## Built-In Scenarios

| Scenario | Purpose | Expected result | Key controls |
| --- | --- | --- | --- |
| Small Puffy Cumulus | Baseline scene for soft edges, bright tops, and shaded interiors. | Rounded cloud with gradual edges; high sun brightens top; lower/side sun creates stronger contrast. | sun elevation, sun direction, density, optical depth |
| Thick Cumulus With Dark Base | Teaches optical thickness and dark cloud bases. | Increasing density/thickness/optical depth darkens base and interior while lit regions stay bright. | cloud thickness, density, optical depth |
| Broken Cloud Field | Teaches layered depth, overlap, and view-angle behavior. | Multiple cloud elements create depth; oblique views reveal stronger layered structure. | view angle, sun direction, optical depth, haze |
| Towering / Developing Cumulus | Teaches vertical structure, glowing tops, and shaded interiors. | Taller volume shows bright top/sun-facing side with shaded interior; low sun increases drama. | sun elevation, thickness, optical depth |
| Thin Veil / Low Optical Depth Cloud | Teaches translucent clouds and faint optical response. | Cloud remains soft and semi-transparent unless optical depth is raised. | optical depth, sky brightness, density, thickness |

Keep the preset set small. Add scenes only when they teach a distinct physical idea.

## Comparison Ideas

Side-by-side comparison is not required for v1.

Future comparisons:

- same cloud under high sun vs low sun
- same cloud front-lit vs backlit
- thin cloud vs thick cloud
- low optical depth vs high optical depth
- soft edge vs sharp edge
- small cumulus vs towering cumulus
- preset field vs imported Fair-Weather Cumulus field
- assumed-droplet optics vs future droplet-aware optics

## Validation Expectations

### Hard expectations

- zero cloud water renders no cloud
- visual controls do not mutate physical frame/preset fields
- changing sun angle changes rendered lighting without changing cloud-water data
- increasing cloud water density increases opacity/optical response, all else equal
- increasing cloud thickness increases optical-depth/light-path response, all else equal
- front-lit geometry weakens bright-edge behavior compared with backlit edge geometry
- low-optical-depth thin veil remains more translucent than thick cumulus under comparable settings
- approximation labels are visible or accessible in rendered/2.5-D modes
- 2.5-D mode is labeled as visual approximation, not true 3-D physics
- scientific/source field views remain available

### Relationship checks

- higher cloud density generally increases optical depth
- greater cloud thickness generally increases attenuation
- lower sun generally increases side-lighting contrast
- backlit edges generally increase bright-edge likelihood
- softer density falloff generally produces softer visible cloud edges

## Known Limitations

- simplified generated/preset cloud fields
- no new cloud-formation simulation
- 2.5-D visual scene, not full 3-D atmospheric dynamics
- qualitative and educational, not quantitative
- no full radiative transfer
- no calibrated radiance output
- no droplet-size distribution in v1
- no droplet-resolved Mie scattering
- no ice-cloud optics
- no rainbow, halo, glory, or iridescence effects
- no precipitation-shaft optics
- no terrain or ground-shadow model in v1
- multiple scattering simplified or omitted

## Future Upgrades

- droplet effective radius and droplet-size distribution
- aerosol/haze controls
- richer sky model
- multiple-scattering approximation
- camera exposure, tone mapping, and focal length controls
- background terrain or surface reflectance
- cloud shadows on ground
- precipitation shaft visibility
- water vs ice phase controls
- imported cloud fields from Fair-Weather Cumulus
- side-by-side comparison mode
- animation through a daily sun path
- true 3-D scene mode when justified
- crepuscular rays
- fog/stratus lighting
- rainbow, glory, halo, and iridescence modes only when scientifically supportable
- satellite-view radiance products later

## Relationship To Other Labs

Fair-Weather Cumulus explains why shallow cumulus clouds form or fail. Clouds, Light, and Shadow explains why a cloud field looks the way it does under changing light and viewing geometry.

A future workflow may send a Fair-Weather Cumulus frame/run into this lab, but v1 should not depend on that workflow.

Layered Atmosphere, Orographic / Terrain Clouds, Warm Rain / Droplet Growth, Fog / Stratus, and Mixed-Phase / Ice may eventually provide richer source fields or optical assumptions. V1 should remain preset-scene-driven.

## Integration With Workbench V2

Clouds, Light, and Shadow should eventually appear in two ways:

1. As its own lab using preset generated scenes.
2. As a view mode available from other labs that pass physical cloud fields into the renderer.

The first implementation target is the standalone lab. It should prove:

- lab catalog entry
- preset 2.5-D cloud scenes
- rendered appearance view
- cloud-water / optical-depth / light-path view toggles
- light, view, density, thickness, and optical controls
- deterministic diagnostics
- honesty labels

## First Implementation Issues To Create After This Spec

Recommended follow-on issues:

1. Add Clouds, Light, and Shadow lab catalog entry and v1 workbench shell.
2. Build deterministic 2.5-D preset cloud scenes.
3. Implement lightweight cloud-optics rendered view and science toggles.
4. Add Clouds, Light, and Shadow diagnostics and validation tests.

Do not combine all of these into one large implementation issue unless the codebase is still small enough that the first slice is genuinely trivial.

## Non-Goals For V1

V1 should not include:

- new cloud-formation solver work
- terrain
- precipitation
- ice physics
- full 3-D dynamics
- full radiative transfer
- calibrated radiance outputs
- satellite products
- rainbows/halos/glories/iridescence
- side-by-side comparison as a required feature
- import from Fair-Weather Cumulus as a required feature
- saved run comparison as a required feature

## Documentation Checklist

When implementing or changing this lab, update:

- `docs/labs/cloud-optics-beauty.md`
- `docs/labs/README.md`
- `docs/lab-roadmap.md` if priority/scope changes
- `docs/current-phase-plan.md` if execution order changes
- `docs/testing-and-validation.md` if validation policy changes
- `docs/simulation-data-model.md` if schema/config changes
- `docs/visualization-and-workbench-views.md` if visualization behavior changes
- `docs/scientific-roadmap.md` if optics/physics direction changes
- `AGENTS.md`, only if durable agent guidance changes

## Durable Design Rule

> Solver outputs physical fields. Renderer turns fields into views. UI controls experiments. Diagnostics explain behavior. Documentation explains assumptions. Tests protect the science.

This lab is where Cloud Lab's beauty goal becomes most visible, so it needs stricter honesty labels, not looser ones.

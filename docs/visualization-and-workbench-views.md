# Visualization And Workbench Views

Cloud Lab visualization exists to help users see and understand atmospheric physics.

The current frontend includes a prototype scientific dashboard, replay controls, inspector panels, saved runs, and comparison. Workbench V2 should reorganize those capabilities into a lab-driven product experience rather than preserving the current dashboard layout.

See:

- `docs/product-vision.md`
- `docs/lab-roadmap.md`
- `docs/workbench-v2-product-spec.md`
- `docs/workbench-v2-architecture.md`
- `docs/architecture-decisions/ADR-001-lab-driven-product.md`

## Visualization Principles

1. Scientific views should show what the model emitted or what diagnostics derived.
2. Cloud appearance views should make clouds beautiful and interpretable while clearly labeling approximations.
3. Rendering must not alter solver state.
4. The visualization stage should be the dominant workbench region.
5. Saved runs, comparison, and developer details are workflows/modes, not default panels competing with the canvas.
6. New visualization work should identify which lab it supports.

## Workbench V2 View Model

Workbench V2 should organize visualization around the selected lab and scenario.

Default lab workbench structure:

```text
Top bar: lab/scenario/run/status/actions
Center: visualization stage
Side: setup and inspector as secondary panels
Bottom: timeline/replay
```

The visualization stage should support:

- scientific 2-D field view
- cloud appearance view
- 2.5-D visual extrusion view
- comparison mode view when explicitly selected

The normal single-run workbench should not show saved run artifacts or comparison as large default panels beneath the canvas. Those belong behind explicit `Saved Runs` and `Compare` workflows.

Lower Atmosphere Cloud Basics v2 now uses a reduced-model shell as its default
stage. The stage can run profile evolution, prescribed cloud-column lift, or the
combined profile-to-cloud-column flow. Its scientific visualization surfaces are
still intentionally modest: profile view, cloud-column view, combined result,
timeline/scrubber, and status cards.

The v2 inspector is part of the scientific view contract. It should present
deterministic result, why, try-next, key-number, profile-diagnostic,
cloud-column-diagnostic, combined-diagnostic, expected-vs-observed, assumptions,
and precipitation-placeholder sections. These views should stay labeled as
reduced-model and prescribed-lift views, and should not imply Boussinesq,
cloud-resolving dynamics, implemented precipitation, optics, or weather
prediction.

## Truth / Confidence Labels

Cloud Lab labels displayed values and views by what they represent:

- `Solver output`: emitted directly by the selected solver.
- `Experimental solver output`: emitted directly by a Yellow-status prototype
  solver such as the current `boussinesq_2d` scaffold.
- `Derived diagnostic`: computed from solver fields or configuration assumptions, such as relative humidity, estimated LCL, cloud-base markers, or approximate buoyancy.
- `Bulk approximation`: physically motivated simplified bulk-model output, such as controlled parcel/box microphysics or bulk rain indicators.
- `Visual approximation`: rendering interpretation of fields rather than a solver-emitted field, such as bulk optical-depth cloud appearance or 2.5-D visual extrusion.
- `Prescribed forcing`: imposed input rather than predicted dynamics, such as `microphysics_lab` vertical lift.
- `Experimental`: available for exploration but not quantitatively validated, including the current Boussinesq dynamics scaffold.
- `Reference model output`: future offline reference-model output, such as CM1
  case data, with source/provenance metadata.
- `Reduced model output`: future interactive simplified-model output, such as
  `boundary_layer_1d` or `controlled_cloud_column`, with approximation labels.

Labels should be short in the UI and paired with tooltips or helper text that explain limitations.

For current `boussinesq_2d` runs, labels should make the Yellow prototype status
visible. A concise user-facing label is `Experimental 2-D prototype`; helper
text should say that results are useful for qualitative exploration but some
behavior is shaped by prototype stabilizers and safety caps.

## Visualization Modes

### Scientific 2-D Field View

The scientific view renders fields from `SimulationFrame` directly:

- cloud liquid water
- water vapor
- rain water
- temperature / temperature perturbation
- velocity
- other future fields

This is the most literal view of the solver output.

Scientific 2-D views should label both physical axes and show rational major tick marks/gridlines derived from the displayed domain scale, such as horizontal distance `x` in meters and height `z` in meters. The ticks are interpretive display aids; they must not change solver fields or frame data.

### Cloud Appearance View

The cloud appearance view uses cloud liquid water and documented assumptions to produce a more cloud-like image.

It may use:

- bulk optical-depth approximation
- assumed effective radius
- opacity response
- edge brightening
- cloud-base darkening
- sun/light direction

This is a visual approximation. It should never be presented as true radiative transfer or droplet-resolved Mie scattering unless those capabilities are actually implemented.

Clouds, Light, and Shadow now has a first lightweight rendered appearance view backed by deterministic preset source scenes. It derives opacity, attenuation, approximate single-scattering brightness, optical-depth, and light-path/shadow displays from the source `cloud_density` field and renderer controls. Sun angle, view angle, density, depth, optical strength, and light color change the renderer state only; they must not mutate the source scene field.

The same lab exposes deterministic diagnostic states for optical depth, cloud-water density, light geometry, light-path length, edge softness, base/interior darkness, bright-edge likelihood, layered depth, approximation-label availability, and source-field immutability. These are explanatory display diagnostics for the renderer/source scene, not solver-emitted physics fields.

Clouds, Light, and Shadow is a static optics lab in v1. It should not show run, stop, timeline, replay, or `No frames buffered yet` language by default. Its primary controls are semantic presets for sun direction, sun elevation, and camera angle, with a visible orientation guide and a 2.5-D explanation near the visualization.

### 2.5-D Cloud Scene

A 2.5-D view renders the 2-D vertical slice as a shallow visual extrusion with camera/perspective controls.

This is useful for beauty and spatial intuition, but it does not imply out-of-plane atmospheric motion or true 3-D dynamics.

### Comparison View

Comparison should be an explicit mode. It may display two scenarios or saved runs side by side with synchronized replay time and shared display scales where appropriate.

Comparison should not be mounted as a normal single-run panel by default.

## Rendering Architecture

Renderer code should consume frames, diagnostics, and visualization settings.

It should not:

- reach into backend solver internals
- mutate simulation frames
- encode solver-specific physics rules
- silently convert visual assumptions into modeled fields

Existing prototype helpers may be reused if they fit this contract, but Workbench V2 should prefer clean visualization modules over preserving old dashboard structure.

## Field Scaling

Field scaling should prevent misleading interpretation.

| Field or view | Scale | Range | Sign handling | Noise threshold | Comparison behavior |
| --- | --- | --- | --- | --- | --- |
| Cloud liquid water | Log | Adaptive | Non-negative | `1e-8 kg kg-1` | Shared scale by default |
| Rain water | Log | Adaptive | Non-negative | `1e-8 kg kg-1` | Shared scale by default |
| Water vapor | Linear | Metadata/default when available | Non-negative | none | Shared scale by default |
| Absolute temperature | Linear | Padded adaptive, displayed in `deg C` | Non-negative | none | Shared scale by default |
| Temperature perturbation | Linear | Symmetric around zero | Signed | none | Shared scale by default |
| Horizontal velocity | Linear | Symmetric around zero | Signed | none | Shared scale by default |
| Vertical velocity | Linear | Symmetric around zero | Signed | none | Shared scale by default |
| Bulk cloud appearance | Log/optical response | Adaptive/default | Non-negative | `1e-4 optical depth` | Shared scale by default |

Condensate fields should suppress tiny numerical-noise values so values like `1e-73 kg kg-1` are not presented as meaningful cloud or rain. Signed fields should use zero-centered ranges where appropriate.

## Inspector And Diagnostics

The inspector should explain the current run in context of the selected lab.

Possible inspector views:

- Overview / expected vs observed
- Profile / sounding
- Probe
- Diagnostics
- Microphysics when relevant

Pinning a probe should open the inspector to Probe. Diagnostics warnings may badge the inspector, but should not force it open by default.

## Replay And Timeline

Timeline and replay controls operate on buffered frames. They do not start or stop the solver.

The timeline should support:

- displayed simulation time
- frame index / total frames
- scrubber
- play/pause replay
- jump to first/final
- event jumps where available, such as first cloud, max cloud water, first rain, or max rain

Simulation lifecycle controls belong in the top bar. Replay controls belong near the timeline.

## Saved Runs And Comparison

Saved run artifacts and comparison are important workflows, but they should not compete with the default visualization stage.

- Saved runs answer: what happened in this specific run?
- Saved scenarios answer: how do I run this setup again?
- Comparison answers: what changed between two scenarios or runs?

Workbench V2 should expose these as explicit actions/modes.

## Microphysics Views

Microphysics views are relevant primarily to Warm Rain / Droplet Growth and controlled microphysics scenarios.

The current `microphysics_lab` emits a 0-D parcel/box state through the shared 2-D frame schema. Spatial plots may be uniform by design. The meaningful information is in diagnostics and optional droplet distribution payloads.

## Known Prototype Limitations

The current dashboard/prototype has capabilities worth preserving, but its layout should not define the future product.

Known limitations of the current/prototype approach:

- too many panels compete with the canvas
- saved runs and comparison can appear as main-stage panels
- App-level state and rendering responsibilities are too concentrated
- cloud appearance is still an approximation
- 2.5-D visualization is not yet implemented
- current views are not a full accessibility solution for canvas data

## Future Level-Up Path

Visualization work should follow the labs:

- Lower Atmosphere Cloud Basics: cloud water, velocity, LCL/cloud-base/profile diagnostics
- Cloud Optics / Beauty: sun angle, optical controls, 2.5-D view
- Evolving Boundary Layer: Workbench V2 v1 profile/sounding view with time-evolving
  temperature/RH profiles, mixed-layer depth, LCL, cap marker, timeline replay,
  and cloud formation potential diagnostics
- Layered Atmosphere: cloud-layer detection and profile overlays
- Orographic Clouds: terrain-relative views and terrain masks
- Warm Rain: droplet distributions and rain shafts
- Fog / Stratus: shallow layer / surface visibility views

The renderer should remain independent of solver internals as these capabilities grow.

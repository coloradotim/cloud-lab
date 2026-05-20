# Visualization And Workbench Views

Cloud Lab visualization exists to help users see and understand atmospheric physics.

The current frontend includes a prototype scientific dashboard, replay controls, inspector panels, saved runs, and comparison. Workbench V2 should reorganize those capabilities into a lab-driven product experience rather than preserving the current dashboard layout.

See:

- `docs/product-vision.md`
- `docs/lab-roadmap.md`
- `docs/optics-field-contract.md`
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

Lower Atmosphere Cloud Basics v2 now uses a guided cloud-formation experiment
as its default stage. The stage can run profile evolution, prescribed
cloud-column lift, or the combined profile-to-cloud-column flow. Technical
model labels such as `boundary_layer_1d` and `controlled_cloud_column` belong
in details/provenance, not in the primary title.

The v2 inspector is part of the scientific view contract. It should present
deterministic result, why, try-next, key-number, profile-diagnostic,
cloud-column-diagnostic, combined-diagnostic, expected-vs-observed, assumptions,
and precipitation-placeholder sections. These views should stay labeled as
reduced-model and prescribed-lift views, and should not imply Boussinesq,
cloud-resolving dynamics, implemented precipitation, optics, or weather
prediction.

The former Boussinesq-centered Lower Atmosphere v1 2-D field screen is no
longer a normal Lower Atmosphere visualization path. If it is used for
technical diagnostics later, it should be treated as a developer/prototype view
with Yellow-status labels, not as the default or trusted v2 science view.

Lower Atmosphere Cloud Basics v2 also includes the first CM1/reference replay
panel. It renders `reference-frame-v1` data as an offline scientific x-z field
with a field selector, timeline scrubber, source labels, diagnostics summary,
and simple cloud-base/cloud-top/max-updraft overlays. The first mounted data is
a tiny synthetic CM1-like fixture for UI/test coverage only; it is labeled as a
synthetic fixture and not scientific truth. Real local CM1 outputs should be
ingested through the reference adapter before they replace the fixture.

When a generated local frontend index exists at
`frontend/public/reference/cm1/local/index.json`, the replay panel prefers real
local ingested `reference-run-v1` artifacts for matching case ids. If the local
index is absent, the panel keeps the tiny fixture visible only with explicit
`Synthetic fixture data`, `Not scientific truth`, and `For UI/testing only`
labels plus an actionable prompt to run and ingest the local CM1 reference
pair.

The same replay panel now includes the first CM1/reference cloud appearance
mode. It consumes the reference cloud liquid water field, maps it to opacity and
brightness as a visual interpretation, preserves the replay timeline and source
labels, and keeps the scientific field view available. It labels assumed droplet
radius, lack of direct radiative transfer, and the fact that CM1 is not running
live. It does not implement full radiative transfer, true volumetric 3-D,
precipitation rendering, or reduced-model/reference comparison.

When profile and column outcomes split, the inspector should make the split
visible rather than collapsing it into a single vague result. For example,
`profile moisture_limited + column cloud_formed` should be labeled as cloud
formed under prescribed lift and should explain that the column result came from
controlled forcing, not free convection.

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
- `Generated preset field`: deterministic source field created for a lab, such
  as `cloud_density` in `cloud-optics-scene-v1`.
- `Assumed parameter`: renderer or diagnostic parameter used because a modeled
  field is absent, such as assumed effective radius.
- `Droplet-aware input`: modeled or reference-provided droplet property used by
  optics, such as effective radius or droplet distribution.

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

### CM1 Reference Replay View

The CM1/reference replay view renders offline `reference-frame-v1` data, not
live interactive solver output.

It should support:

- cloud liquid water
- water vapor / RH when available
- temperature or potential temperature
- vertical velocity
- rain water when available
- time replay / scrubber
- cloud base and cloud top overlays when diagnostics provide them
- first cloud time and max-updraft indicators when diagnostics provide them

The view must show source labels:

```text
CM1 reference output
Offline reference case
Scientific field view
Not live CM1 simulation
```

If a field, frame, grid coordinate, or diagnostic is missing, the view should
show an explicit fallback rather than a blank panel. Cloud and rain fields with
zero or below-threshold signal should show a clear no-cloud/no-signal state
instead of inventing clouds. If `temperature_k` is unavailable but
`potential_temperature_k` exists, the UI should present that as a field note
rather than a scary broken-output warning.

The #222 replay polish adds selected-frame min/max readouts, display-scale
notes, clearer cloud-water contrast, grouped source/view/assumption labels, and
timeline/frame context while preserving the source reference fields. The
reference replay view should not run CM1, commit large model output, or mutate
reference data.

#231 adds explicit field-specific display policies for CM1/reference replay.
Cloud liquid water and rain water use display-only log/adaptive palettes that
keep zero or below-threshold cells visually quiet while making nonzero
structure readable. Vertical velocity uses a signed zero-centered palette.
Water vapor uses a sequential moisture palette, and temperature/potential
temperature use an adaptive temperature/theta palette. These policies are
legend/display choices only; they do not modify `reference-frame-v1` values or
make morphology claims.

After #233, Lower Atmosphere Cloud Basics should no longer present the old
setup/sidebar/stage/inspector structure as the main user experience. It should
open as a guided experiment: choose an experiment card, watch cloud evolution,
read a short atmospheric explanation, inspect 4-5 key numbers, and try the next
scenario-specific contrast. Cloud Appearance should be the default after a run,
Scientific Fields should remain one clear toggle away with variable
explanations, and replay should start from the first frame and stop at the
final frame. CM1/reference provenance, diagnostic comparison, and validation
details should remain available under collapsed Model details / Why trust this
rather than dominating the first screen.

After #240, the guided Lower Atmosphere replay is the primary working area.
The experiment chooser collapses after selection, while Change experiment and
scenario-switch buttons reopen or switch the setup. Run mode, Run/Reset, view
mode, Scientific field selection, and replay actions are grouped around the
cloud field. Cloud Appearance uses a display-only focused viewport that keeps
the lower atmosphere anchored and expands upward as cloud top rises; the UI
states the visible z-range and offers Show full domain / Focus on cloud layer.
Scientific Fields shows the full x-z reference domain by default. Both modes
show x and z axis labels with major tick marks. Timeline event chips such as
first cloud, rain onset, and final frame are buttons that jump to the nearest
frame when the event is available; unavailable events are disabled or hidden.

### Cloud Appearance View

The cloud appearance view uses cloud liquid water and documented assumptions to produce a more cloud-like image.

The physical-field contract for cloud appearance and optical-depth views lives
in `docs/optics-field-contract.md`. Appearance renderers should consume source
fields plus renderer controls, preserve source provenance, show scientific field
views where practical, and avoid mutating solver or reference payloads.

It may use:

- bulk optical-depth approximation
- assumed effective radius
- opacity response
- edge brightening
- cloud-base darkening
- sun/light direction

This is a visual approximation. It should never be presented as true radiative transfer or droplet-resolved Mie scattering unless those capabilities are actually implemented.

If effective radius or droplet-size fields are absent, appearance views may use
an assumed effective radius only when they label `Assumed droplet radius`. They
should use `Droplet-aware input` only when actual droplet fields are present.

The first CM1/reference appearance mode uses an assumed effective radius and a
cloud-depth proxy from the reference grid to derive opacity/brightness from
`cloud_liquid_water_kg_per_kg`. It is a visual interpretation of reference
fields, not direct radiative transfer or a new cloud model.

#222 polish strengthens the display transfer function so shallow-cumulus cloud
water is more visible, while zero-cloud dry cases remain visually cloud-free.
The view must keep labeling assumed droplet radius, lack of direct radiative
transfer, visual interpretation status, and the fact that CM1 is not running
live in the app. The display mapping must not mutate source reference fields or
hide scientific warnings.

#231 further improves the CM1/reference appearance view by mapping the same
cloud-water field to stronger display opacity, soft display edges, highlights,
and cloud-base shadowing. This remains a visual approximation from
CM1/reference cloud water. Zero-cloud dry cases must remain cloud-free.

Clouds, Light, and Shadow now has a first lightweight rendered appearance view backed by deterministic preset source scenes. It derives opacity, attenuation, approximate single-scattering brightness, optical-depth, and light-path/shadow displays from the source `cloud_density` field and renderer controls. Sun angle, view angle, density, depth, optical strength, and light color change the renderer state only; they must not mutate the source scene field.

The same lab exposes deterministic diagnostic states for optical depth, cloud-water density, light geometry, light-path length, edge softness, base/interior darkness, bright-edge likelihood, layered depth, approximation-label availability, and source-field immutability. These are explanatory display diagnostics for the renderer/source scene, not solver-emitted physics fields.

Clouds, Light, and Shadow is a static optics lab in v1. It should not show run, stop, timeline, replay, or `No frames buffered yet` language by default. Its primary controls are semantic presets for sun direction, sun elevation, and camera angle, with a visible orientation guide and a 2.5-D explanation near the visualization.

### 2.5-D Cloud Scene

A 2.5-D view renders the 2-D vertical slice as a shallow visual extrusion with camera/perspective controls.

This is useful for beauty and spatial intuition, but it does not imply out-of-plane atmospheric motion or true 3-D dynamics.

### Comparison View

Comparison should be an explicit mode. It may display two scenarios or saved runs side by side with synchronized replay time and shared display scales where appropriate.

Comparison should not be mounted as a normal single-run panel by default.

Lower Atmosphere v2 now includes a scoped reference diagnostic comparison panel
inside the CM1/reference path. This is not the old generic saved-run comparison
mode: it maps the selected reduced-model scenario to a CM1 reference case id and
shows teaching diagnostics when an offline `ReferenceRun` exists. The first
available mapping is baseline shallow cloud to
`cm1-shallow-cumulus-baseline-v1`; other mapped cases show:

```text
No CM1 reference case is available for this scenario yet.
```

The panel labels `Reduced model output`, `CM1 reference output`, `Offline
reference case`, `Derived diagnostic`, and `Not live CM1 simulation`. It also
distinguishes `Real local ingested output` from `Synthetic fixture data`. It
compares cloud/no-cloud status, first cloud time, cloud base, cloud top, max
cloud water, max updraft, rain onset, and profile context. Exact cloud
morphology is not displayed as a pass/fail condition.

The comparison should explain the pre-run state when the user opens Model
details: offline CM1 reference output can be visible before the interactive
experiment runs because the reference is precomputed/ingested, while the run
button computes the simplified explanatory side. The diagnostic comparison
should use responsive cards or an equivalent robust layout so
narrow/export-like views do not wrap labels into vertical letter fragments.

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

# Scientific Roadmap

Cloud Lab should grow from a clear, testable vertical slice into richer cloud dynamics without pretending the first model is more complete than it is.

## V1 Physics Scope

The first physics target is a minimal 2-D vertical slice that can support a fair-weather cumulus experiment. V1 should focus on:

- A rectangular horizontal-by-vertical domain.
- Surface heating as a lower-boundary forcing.
- Moisture and temperature state variables with documented units.
- Simple buoyancy and vertical motion approximations.
- Condensation indicators for cloud-relevant regions.
- Deterministic seeded runs for reproducible tests and visual comparisons.

## Fair-Weather Cumulus First

Fair-weather cumulus is the first target because it is visually understandable and scientifically rich without immediately requiring severe storm dynamics, ice microphysics, or complex terrain.

The first preset should make it easy to explore how surface heating, boundary-layer humidity, and lapse rate affect shallow cloud formation in a vertical slice.

## Product And Physics Tracks

Cloud Lab is not only a solver exercise. The near-term product should become a hands-on cloud laboratory where users can manipulate initial states and forcing, then inspect meaningful and beautiful results.

That means interactive scenario work can proceed in parallel with physics validation. Structured and painted surface heating, structured and painted moisture profiles, lift controls, scenario presets, replay/scrubbing, saved run artifacts, comparison tools, and bulk physically informed rendering are valid near-term product work as long as they preserve solver/renderer/UI separation and document their approximations.

After the canvas-first workbench UI lands, the main product/science loop should be:

```text
Create condition → run → inspect → save → compare → vary → learn
```

This loop should guide the next science-adjacent features:

- saved run artifacts with diagnostics and replay metadata
- painted surface-heating and moisture initial conditions
- small parameter sweeps over key scenario controls
- terrain/orographic experiments with validation companions
- bulk rain visualization and later bulk rain behavior
- optical appearance controls that remain renderer-only and approximation-labeled

## Warm-Cloud Microphysics Direction

Early microphysics should remain deliberately simple: vapor, cloud water, and rain water fields with non-negative invariants and documented approximations. The project should avoid unexplained constants and should separate physically meaningful quantities from visualization shortcuts.

As the model matures, evaluate PySDM or a similar library for more credible warm-cloud microphysics. That evaluation should compare integration complexity, reproducibility, performance on a Mac, and how well the library fits Cloud Lab's frame schemas.

The v1 frame schema already reserves `water_vapor_kg_per_kg`, `cloud_liquid_water_kg_per_kg`, and `rain_water_kg_per_kg` fields with units metadata so later warm-cloud work can evolve without inventing new transport names in the frontend.

The current next-core decision is documented in `docs/next-physics-core.md`: keep the existing solvers, use `microphysics_lab` for isolated warm-cloud experiments, evaluate PySDM there first, and delay full dynamics/microphysics coupling until both paths are separately credible.

Do not add advanced microphysics until the current Boussinesq reference cases in `docs/boussinesq-validation.md` remain stable and understandable. Those cases are the current science gate for deciding whether the dynamics are trustworthy enough to build on.

Current gate decision: `boussinesq_2d` remains experimental. It is useful for controlled visual experiments, UI/schema validation, and targeted dynamics work, but it should not be treated as the final dynamics core for advanced microphysics until cloud-water placement and the remaining dynamics limitations are resolved.

The current fair-weather gate includes thermodynamic structure diagnostics for cloud-base plausibility: expected LCL, source-layer theta and water-vapor mixedness, actual condensate onset height, cloud-water distribution relative to LCL, and multi-region base spread. These diagnostics intentionally report behavior rather than forcing cloud-water placement or renderer shape.

Bulk cloud and rain visualization can improve before PySDM. The renderer may use bulk cloud liquid water plus assumed effective radius for labeled optical-depth, opacity, and lighting approximations. Bulk rain water and simple autoconversion or sedimentation indicators are useful for visual feedback, but they are not droplet-resolved precipitation formation. Droplet-aware optics and more credible collision/coalescence remain later PySDM-adjacent work.

## Bulk Rain Direction

Near-term rain can proceed in two stages:

1. Visual/diagnostic bulk rain indicator: show whether a run produced `rain_water_kg_per_kg`, when rain first appeared, and where rain-like shafts appear.
2. Simple bulk rain behavior: add documented sedimentation and evaporation so rain water moves/falls and can evaporate in dry air.

Neither stage should be described as droplet-resolved precipitation formation. PySDM/collision-coalescence remains the later path for more credible rain initiation.

## Terrain/Orographic Direction

Terrain should be introduced as idealized orographic forcing, not a full terrain-following atmospheric model.

The terrain path should be paired with validation from the start:

- flat terrain control
- dry ridge no-cloud control
- moist ridge cloud case
- Boulder foothills / upslope-inspired idealized case
- diagnostics for terrain height, slope/lift region, cloud location relative to terrain, and below-terrain masking

Terrain should not be allowed to create plausible-looking clouds without comparison cases that explain what the approximation does and does not prove.

## Fluid Dynamics Assumptions To Start

The starting dynamics can be simplified and educational, but the assumptions must be explicit. Initial work may use coarse approximations for advection, buoyancy, and diffusion while tests cover shape consistency, non-negative moisture fields, deterministic output, and stable schemas.

Known early limitations should be documented near the implementation and in validation notes when new physics behavior is added.

The initial solver uses localized surface heating, first-order advection, simple diffusion, buoyancy from temperature perturbation, saturation adjustment, and latent heating. It deliberately does not include a pressure solve, turbulence closure, terrain, rain sedimentation, ice physics, or a conservation guarantee.

## Level-Up Path

1. Implement a minimal 2-D vertical-slice core with deterministic frame generation.
2. Add fair-weather cumulus presets and validation notes.
3. Stream live frames to the browser over WebSockets.
4. Add visualization layers for velocity, vapor, cloud water, rain water, buoyancy, and condensation.
5. Validate the Boussinesq solver against quiet, dry, humid, stable, and resolution/runtime reference cases.
6. Continue improving or replace the experimental Boussinesq dynamics before treating it as a microphysics host.
7. Add structured surface-heating and moisture scenario controls for interactive experiments while keeping solver assumptions explicit.
8. Add the canvas-first workbench, scenario diagnostics, and control relevance metadata so users can inspect experiments coherently.
9. Add saved run artifacts, side-by-side comparison, and small parameter sweeps so users can preserve and compare experiments.
10. Add painted surface-heating and moisture editors so users can create custom initial conditions.
11. Expand `microphysics_lab` validation cases, then evaluate PySDM there for droplet-size distribution and rain formation.
12. Add terrain forcing for orographic lift experiments, paired with validation/comparison cases.
13. Add bulk rain sedimentation and evaporation only with documented water-budget and non-negative-moisture checks.
14. Extend toward 2.5-D where selected 3-D effects can be approximated.
15. Move toward true 3-D only after the 2-D model, tests, schemas, and visualization pipeline are stable.

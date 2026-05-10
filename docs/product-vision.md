# Cloud Lab Product Vision

## What Cloud Lab is

Cloud Lab is a local browser-based cloud physics sandbox for exploring cloud formation, warm-cloud microphysics, atmospheric motion, surface heating, terrain forcing, and real-time scientific visualization.

The goal is not to build a full mesoscale weather model. The goal is to build a focused, visually compelling, scientifically honest cloud laboratory that helps users experiment with the physical processes that make clouds form, grow, rain, dissipate, and look beautiful.

Cloud Lab should feel like a cloud chamber for the atmosphere: interactive, inspectable, playful, and grounded in real physics.

## Product principles

### 1. Scientific enough to be meaningful

Cloud Lab should avoid fake physics when real simplified physics is practical. The simulation can start simple, but assumptions should be documented and the architecture should leave room for better dynamics and microphysics.

### 2. Beautiful enough to invite exploration

Clouds are fun partly because they are beautiful. Visualization is not decoration; it is part of the product. The app should eventually help users see scattering, lighting, cloud edges, shadowing, rain shafts, and the visual consequences of droplet and liquid-water changes.

### 3. Local-first and approachable

The first version should run locally on a Mac through a browser UI. Do not require paid cloud compute. Do not require complicated infrastructure before the core experience works.

### 4. Solver, renderer, and UI stay separate

The solver should produce physical fields. The renderer should consume those fields and turn them into scientific and visual views. The UI should control scenarios and display results. Keep those boundaries clean.

### 5. Capture ideas aggressively, implement selectively

This project will generate many good ideas. Capture them in docs and roadmap issues, but keep V1 focused. Avoid idea sprawl by turning future ideas into focused implementation issues only when the foundation is ready.

## Target experience

A user opens a local browser app, selects a meteorologically grounded scenario, adjusts relevant initial conditions, runs a 2-D vertical slice simulation, watches cloud-relevant fields evolve, inspects why the cloud behaved as it did, saves the run, compares it with another run, and deliberately varies key controls.

The near-term target experience should include:

- Fair-weather cumulus over localized surface heating
- Adjustable heating, humidity, lapse rate, wind, runtime, resolution, and seed
- Scenario-aware controls that show only relevant settings by default
- Real-time visualization of vapor, cloud liquid water, temperature perturbation, and velocity
- Bulk cloud appearance rendering that is clearly labeled as an optical approximation
- A field probe for inspecting local atmospheric values
- A vertical sounding/profile view for inspecting cloud-base, LCL, humidity, and cap structure
- Expected / observed / status diagnostics for built-in scenarios
- Meteorologically grounded built-in scenarios plus local saved experiment configurations
- Saved run artifacts with config, diagnostics, replay metadata, and notes
- Side-by-side scenario or run comparison
- Reproducible runs through seeded configurations
- Documented units and assumptions
- Tests, CI, and a sustainable development workflow

## Near-Term Dual Track

Cloud Lab should now move on two parallel tracks.

The interactive cloud-experiment track should make the sandbox more playful and useful now: structured and eventually painted surface-heating maps, structured moisture fields, lifting controls, simple terrain/orographic forcing, scenario presets, replay and scrubbing, saved run artifacts, scenario comparison, and physically informed bulk visualization.

The physics-credibility track should keep the science honest: automated sanity checks, scenario expected/observed/status diagnostics, `microphysics_lab` validation, PySDM evaluation in isolation, and clear labels for every approximation. These tracks support each other, but PySDM or a final computational fluid dynamics core is not required before building better scenario controls and bulk field rendering.

## Post-workbench product loop

After the canvas-first workbench UI lands, the next milestone is the full experiment loop:

```text
Create condition → run → inspect → save → compare → vary → learn
```

This requires more than isolated features. The product needs:

- saved run artifacts, not just saved configs
- painted surface-heating and moisture initial-condition editors
- optical appearance controls for bulk cloud rendering
- lightweight parameter sweeps for key controls
- rain visualization and later bulk rain behavior
- terrain/orographic validation cases alongside terrain experiments

This loop is the practical path to the original product goal: letting users mess with initial states and forcing, see the clouds that form, and understand what happened.

## First scientific scope

Start with a 2-D vertical slice. The early model should be simple but extensible:

- Buoyancy-driven motion
- Temperature advection
- Water vapor advection
- Simple saturation and condensation
- Latent heating from condensation
- Cloud liquid water field
- Rain water placeholder and later bulk rain behavior
- No ice phase initially
- No full mesoscale dynamics
- No advanced turbulence model initially

The model should support future upgrades toward better fluid dynamics, PySDM-based microphysics, terrain forcing, 2.5-D visualization, and eventual 3-D experiments.

## Why fair-weather cumulus first

Fair-weather cumulus is the right starting target because it is visually satisfying, physically intuitive, and driven by processes Cloud Lab wants to expose:

- localized surface heating
- buoyant thermals
- lifting and cooling
- saturation and condensation
- cloud growth and dissipation
- entrainment of dry environmental air
- visual cloud boundaries and cloud-base structure

It is also a good bridge toward Colorado-relevant terrain and orographic scenarios.

## Visualization philosophy

Cloud Lab should support two visual modes over time:

### Scientific views

Scientific views explain what is happening. They should show fields and diagnostics clearly:

- water vapor
- relative humidity
- cloud liquid water
- rain water
- temperature perturbation
- buoyancy
- horizontal and vertical velocity
- condensation and evaporation regions
- droplet-size distribution
- parcel/pathline behavior

### Pretty views

Pretty views make the cloud look like a cloud. They should be visually satisfying but honest about what is physically modeled versus approximated.

Future pretty rendering should include:

- cloud opacity from liquid water and droplet properties
- sun angle and camera controls
- optical depth approximation
- single scattering approximation
- forward scattering and bright cloud edges
- silver lining near the sun angle
- self-shadowing and darker cloud bases
- rain shaft visibility
- haze/background atmosphere interaction

The product should clearly distinguish physically meaningful outputs from cinematic or illustrative enhancement.

## Cloud optics direction

Cloud optics should eventually become a major feature track.

The renderer should estimate visual appearance from solver outputs such as cloud liquid water, rain water, droplet size distribution, and geometry. The solver should not include rendering logic. The renderer should not alter physical simulation state.

A reasonable staged path:

### Phase 1 — Cheap but effective

- opacity as a function of cloud liquid water
- directional light shading
- simple shadowing
- camera controls
- sun angle controls
- optical appearance controls such as assumed effective radius, extinction strength, edge brightening, and cloud-base darkening

This phase may use bulk cloud liquid water plus an assumed effective radius as a bulk optical approximation. It should be labeled that way. Droplet-aware optics wait for droplet-size or effective-radius outputs, but PySDM is not a prerequisite for first cloud opacity, lighting, or shadow improvements.

### Phase 2 — Physically informed

- optical depth approximation
- forward scattering bias
- edge brightening
- cloud-base darkening
- visual distinction between thin and dense cloud regions

### Phase 3 — Microphysics-aware

- droplet size influences brightness, opacity, and scattering behavior
- rain shafts become visible through attenuation and fall streaks
- aerosol/haze interactions become possible

Near-term rain visualization may use bulk rain-water fields and simple autoconversion or sedimentation indicators. That is useful for scenario feedback and rain-shaft visualization, but it must not be described as droplet-resolved precipitation formation. PySDM collision/coalescence remains the later path for more credible rain initiation.

### Phase 4 — Advanced rendering

- volumetric rendering
- approximate multiple scattering
- cinematic export mode
- scientific versus cinematic rendering toggle

## Diagnostics that make the app special

Cloud Lab should eventually help users understand why a cloud behaved the way it did.

Useful diagnostics include:

- local field probe
- expected / observed / status summaries for built-in scenarios
- time-history plots
- parcel/pathline visualization
- entrainment indicators
- condensation and evaporation overlays
- rain initiation indicators
- droplet-size distribution histograms
- simple sounding/profile extraction
- post-run experiment summary

A future post-run summary might say something like:

> Cloud initiated over the heated patch, but dry-air entrainment near 1.7 km evaporated cloud water before collision/coalescence could produce precipitation.

This kind of explanation would make Cloud Lab feel like a scientific assistant, not just an animation. Deterministic diagnostics should come before AI-generated summaries.

## Roadmap buckets

### V1 foundation

- Repo scaffold, docs, tests, and CI
- Simulation data model, units, and frame schema
- Minimal 2-D vertical-slice solver
- Live simulation streaming
- First scientific visualization dashboard
- Interactive controls and fair-weather cumulus preset
- Field probe diagnostics
- Next physics-core decision document
- Isolated PySDM evaluation prototype

### V1.5 / near-future

- Canvas-first workbench UI
- Scenario expected / observed / status diagnostics
- Scenario-aware setup controls with tooltips and relevance rules
- Saved scenarios and replay
- Saved run artifacts
- Time scrubbing
- Painted surface heating maps
- Painted moisture fields
- Initial pretty cloud rendering mode and optical controls
- Side-by-side scenario/run comparison
- Microphysics lab solver mode
- Droplet-size distribution visualization
- Condensation/evaporation overlays
- Bulk rain indicator and rain-shaft visualization
- Terrain/orographic lift prototype
- Terrain/orographic validation cases
- Boulder foothills upslope preset

### Later science upgrades

- PySDM integration if evaluation supports it
- Collision/coalescence
- Bulk rain sedimentation and evaporation
- Aerosol/CCN controls
- Better fluid dynamics options
- Turbulence parameterization exploration
- Numerical validation suite
- Benchmark/reference-case library

### Later visualization upgrades

- 2.5-D visualization
- Volumetric rendering
- physically informed cloud optics
- camera and lighting controls
- cinematic export
- side-by-side scenario comparison

### Research workflow upgrades

- NetCDF export/import
- Jupyter integration
- run metadata and reproducibility records
- saved simulation artifacts
- parameter sweeps

## Key architecture warning

This project can become messy quickly if physics, rendering, UI state, and scenario configuration are allowed to blend together.

The durable rule:

> Solver outputs physical fields. Renderer turns fields into views. UI controls scenarios. Documentation explains assumptions. Tests protect behavior.

That is the core architecture discipline for Cloud Lab.

# Cloud Lab Product Vision

## Tagline

Cloud Lab helps users explore atmospheric physics through beautiful, interactive cloud experiments grounded in real physical principles.

Short phrase:

> Beautiful cloud experiments. Real atmospheric physics.

## What Cloud Lab Is

Cloud Lab is a local browser-based cloud physics laboratory for creating, running, visualizing, and comparing cloud experiments.

The goal is not merely to build a cloud model, a rendering toy, or a diagnostics dashboard. The goal is to help users learn cloud physics by making beautiful, physically meaningful atmospheric experiments.

Cloud Lab starts with simplified, transparent models, but its architecture should support progressively higher-fidelity atmospheric simulation over time. The project should be approachable and visually rewarding now, while remaining disciplined enough to grow toward serious cloud modeling later.

## North Star

Cloud Lab should make atmospheric physics visible.

A user should be able to choose a cloud lab, adjust a small set of meaningful physical controls, run an experiment, watch beautiful cloud behavior evolve, inspect why it happened, save the run, compare it with another run, and learn something real about the atmosphere.

The product should optimize for this loop:

```text
Choose lab → choose scenario → adjust physical controls → run → watch → inspect → save/compare → vary → learn
```

## Product Identity

Cloud Lab is best understood as a collection of guided phenomenon labs, not as a pile of solver modes or UI panels.

Each lab should answer a physical question:

- Why do fair-weather cumulus clouds form on some warm afternoons and not others?
- How does the daytime boundary layer evolve toward cloud formation?
- Why do cloud layers form at different altitudes?
- How does terrain lift create clouds?
- Why does some cloud water become rain while some does not?
- Why do clouds look bright, dark, soft, sharp, glowing, or dramatic?
- Why do fog and low stratus form and dissipate?
- How do ice and mixed-phase processes change cold clouds?

The interface should expose those questions and the controls needed to explore them. Solvers, numerical methods, and approximation details should remain visible when needed, but they should not define the user experience.

## Product Principles

### 1. Beautiful, interactive experiments first

Clouds are visually compelling. Beauty is not decoration here; it is a core part of the learning experience. Cloud Lab should make cloud fields visible, spatial, and satisfying to explore.

### 2. Real physical grounding, honest limits

Cloud Lab should not fake physics when real simplified physics is practical. When the app uses approximation, it should say so plainly. A view may be beautiful and useful even if it is approximate, as long as the user is not misled.

### 3. Lab-driven, not solver-driven

A lab defines the physical question, controls, expected behavior, diagnostics, visualization needs, and limitations. Solvers are implementation details that support labs.

### 4. Simple enough to use, extensible enough to grow

The first implementation of a lab may use simplified dynamics, bulk microphysics, or approximate rendering. The architecture should allow improved physics to replace or augment those pieces without rewriting the product.

### 5. Solver, renderer, UI, and diagnostics stay separate

The durable rule:

> Solver outputs physical fields. Renderer turns fields into views. UI controls experiments. Diagnostics explain behavior. Documentation explains assumptions. Tests protect the science.

### 6. Local-first

The first product should run locally on a Mac through a browser UI. Avoid requiring paid cloud compute or complicated infrastructure before the core experience works.

### 7. Capture broadly, build selectively

Many good ideas belong in the roadmap. Focused implementation should be driven by labs, not by novelty or feature accumulation.

## The Two Product Layers

Cloud Lab has two layers that must grow together.

### User-facing cloud lab

This is what the user experiences:

- guided labs
- scenario presets
- meaningful controls
- beautiful scientific and cloud-like visualizations
- probes and diagnostics
- saved runs
- comparison
- parameter exploration

### Science framework underneath

This is the architecture that lets Cloud Lab become more serious over time:

- lab/scenario contracts
- physics-core interfaces
- frame/output schemas
- diagnostic contracts
- validation suites
- renderer contracts
- documented assumptions

The project should not become a toy. But it also should not let hard-core modeling ambitions prevent the app from becoming useful and enjoyable now.

## Core Labs

The product should be organized around labs. See `docs/lab-roadmap.md` for the detailed lab roadmap.

Near-term core labs:

1. Lower Atmosphere Cloud Basics Lab
2. Cloud Optics / Beauty Lab
3. Evolving Boundary Layer Lab
4. Layered Atmosphere Lab
5. Orographic / Terrain Cloud Lab
6. Warm Rain / Droplet Growth Lab
7. Fog / Stratus Lab
8. Mixed-Phase / Ice Cloud Lab later

## Target Experience

A good early version of Cloud Lab should let the user:

1. Open the app and choose a lab.
2. Pick a scenario such as fair-weather cumulus, dry failed cumulus, ridge lift, fog/stratus, or warm-rain parcel.
3. Adjust a small set of physical controls relevant to that lab.
4. Run the simulation locally.
5. Watch the cloud evolve in a scientific 2-D view.
6. Switch to a beautiful cloud appearance or 2.5-D view.
7. Inspect diagnostics such as LCL, cloud base, cloud top, RH profile, max updraft, first cloud time, rain indicator, or droplet distribution depending on the lab.
8. Save the run.
9. Compare it with another run.
10. Vary one control and learn what changed.

## Visualization Philosophy

Cloud Lab should support several kinds of views.

### Scientific views

Scientific views show the actual model fields and diagnostics:

- water vapor
- relative humidity
- cloud liquid water
- rain water
- temperature perturbation
- buoyancy
- velocity
- LCL / cloud base
- cloud top
- mixed-layer depth
- droplet-size distribution when available

### Cloud appearance views

Cloud appearance views make the fields look more like clouds. They may use bulk optical approximations, assumed droplet radius, sun angle, shadowing, edge brightening, and cloud-base darkening.

These views should be beautiful, but clearly labeled as rendering interpretations when they are not direct solver fields.

### 2.5-D views

A 2.5-D view can render the existing 2-D vertical slice as a shallow visual extrusion with camera and perspective controls. This gives spatial payoff without claiming true 3-D atmospheric motion.

### Future advanced rendering

Later versions may add volumetric rendering, droplet-aware optics, approximate multiple scattering, cinematic export, and more sophisticated camera/light controls.

## Science Roadmap Relationship

The scientific roadmap should serve the labs. Physics additions should answer:

- What lab does this enable?
- What physical question does it help answer?
- What controls does it support?
- What fields does it output?
- What diagnostics validate it?
- What assumptions must the UI disclose?

If a physics addition cannot answer those questions, it is probably premature.

## Clean-Slate Frontend Direction

The current frontend should be treated as a working prototype that proved capabilities, not as the final product architecture.

Workbench v2 should be lab-driven:

```text
Lab Picker → Lab Workbench → Run/Inspect/Save/Compare
```

The product should not open into a wall of controls or a development dashboard. It should open into a focused lab experience.

See:

- `docs/workbench-v2-product-spec.md`
- `docs/workbench-v2-architecture.md`
- `docs/architecture-decisions/ADR-001-lab-driven-product.md`

## What Cloud Lab Should Not Become

Cloud Lab should not become:

- a pile of unrelated simulation features
- a solver-mode selector with a UI wrapped around it
- a dashboard full of panels with equal visual weight
- a cloud rendering toy with hidden fake physics
- a full mesoscale weather model
- a research codebase that never becomes usable

The product should remain clear:

> beautiful, interactive cloud experiments grounded in real atmospheric physics, with a science framework that can grow toward more serious modeling over time.

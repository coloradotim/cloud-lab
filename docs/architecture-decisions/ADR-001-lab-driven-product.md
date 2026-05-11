# ADR-001: Lab-Driven Product Architecture

## Status

Accepted

## Context

Cloud Lab began as a local browser-based cloud physics sandbox. Early implementation work added solver backends, simulation frames, visualization, diagnostics, saved scenarios, saved runs, comparison, and a workbench-style frontend.

That work proved technical capability, but it also exposed a product risk: Cloud Lab can easily become a pile of solver modes, UI panels, controls, diagnostics, and visualizations without a coherent user experience.

The clarified product goal is:

> Cloud Lab helps users explore atmospheric physics through beautiful, interactive cloud experiments grounded in real physical principles.

The project also has a long-term ambition to grow toward serious atmospheric modeling. That means the product must not be a throwaway toy. The architecture should support progressively higher-fidelity dynamics, microphysics, terrain, optics, and eventually more advanced 2.5-D / 3-D modeling paths.

## Decision

Cloud Lab will be organized around phenomenon labs, not around solver modes or accumulated UI panels.

A lab is a guided experiment space that defines:

- the physical question being explored
- user-controllable initial conditions and forcings
- expected physical behavior
- required model capabilities
- diagnostics
- visualization modes
- assumptions and limitations
- future upgrade path

Solvers are implementation details that serve labs.

The user-facing product will follow this structure:

```text
Lab Picker → Lab Workbench → Run / Inspect / Save / Compare
```

The science framework will follow this structure:

```text
Lab definition
  ↓
Scenario definition
  ↓
Initial state + forcing definition
  ↓
Physics core selection
  ↓
Frame/output schema
  ↓
Diagnostics
  ↓
Visualization/rendering
```

## Consequences

### Positive

- The product has a clearer north star.
- Labs can be added one at a time without exposing every solver detail.
- Simplified physics can coexist with future high-fidelity models.
- Diagnostics become part of learning, not just developer validation.
- Visualization can be beautiful while still labeled honestly.
- Future serious physics cores can plug into the lab/scenario/frame/diagnostic pipeline.

### Negative / tradeoffs

- The current frontend may need substantial replacement or reorganization.
- Maximum code reuse is not the priority.
- Some existing UI panels may be demoted or removed from default workflows.
- Product design decisions must happen before feature accumulation.
- Each new physics feature must justify which lab and physical question it serves.

## Durable Rules

1. Build labs, not feature piles.
2. Expose physical questions, not solver internals.
3. Keep solver, renderer, UI, and diagnostics separate.
4. Label approximations plainly.
5. Reuse code only when it supports the lab-driven architecture cleanly.
6. Add physics because it enables a lab or diagnostic, not because it is interesting in isolation.
7. Do not let current frontend structure dictate the future product.
8. Do not let hard-core modeling ambitions prevent the app from becoming beautiful and usable now.
9. Do not let beautiful rendering hide weak or approximate physics.

## Relationship To Existing Code

The backend solver registry, frame schema, validation tools, and model work remain valuable.

The current frontend should be treated as a working prototype that proved capabilities. Workbench V2 may reuse pieces of it, but it should not be constrained by its layout, component boundaries, or accumulated panel structure.

## First Reference Lab

Fair-Weather Cumulus should be the first complete reference lab because it is visually intuitive, physically rich, and already partly supported by the current Boussinesq workflow.

The reference lab should establish patterns for:

- lab selection
- scenario selection
- key controls
- run lifecycle
- scientific and cloud-like visualization
- diagnostics
- save/compare workflow
- approximation labels

## Future Labs

The lab roadmap currently includes:

1. Fair-Weather Cumulus
2. Evolving Boundary Layer
3. Layered Atmosphere
4. Orographic / Terrain Clouds
5. Warm Rain / Droplet Growth
6. Cloud Optics / Beauty
7. Fog / Stratus
8. Mixed-Phase / Ice later

## Review Triggers

Revisit this ADR if:

- Cloud Lab shifts from local-first to cloud-hosted compute.
- The project decides to become a research model first and a product second.
- A true 3-D model becomes the primary near-term focus.
- A UI framework or app architecture change makes a different product structure preferable.

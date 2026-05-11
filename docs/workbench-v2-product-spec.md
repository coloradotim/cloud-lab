# Workbench V2 Product Spec

## Purpose

Workbench V2 is the clean-slate product shell for Cloud Lab.

The current frontend proved that the system can run simulations, stream frames, show diagnostics, save runs, and compare outputs. It should now be treated as a capability prototype, not the final product architecture.

Workbench V2 should organize the app around labs and the experiment loop:

```text
Choose lab → choose scenario → adjust physical controls → run → watch → inspect → save/compare → vary → learn
```

## Product Positioning

Tagline:

> Cloud Lab helps users explore atmospheric physics through beautiful, interactive cloud experiments grounded in real physical principles.

Short phrase:

> Beautiful cloud experiments. Real atmospheric physics.

## Core UX Model

Cloud Lab should have two primary product surfaces:

1. **Lab Picker**
2. **Lab Workbench**

### Lab Picker

The Lab Picker is where users choose what physical phenomenon they want to explore.

Initial lab list:

- Fair-Weather Cumulus
- Cloud Optics / Beauty
- Evolving Boundary Layer
- Layered Atmosphere
- Orographic / Terrain Clouds
- Warm Rain / Droplet Growth
- Fog / Stratus
- Mixed-Phase / Ice later

Each lab card should show:

- lab name
- physical question
- short description
- visual preview or icon later
- current maturity status
- primary concepts taught

### Lab Workbench

The Lab Workbench is where a single lab/scenario is configured, run, watched, inspected, saved, and compared.

Default structure:

```text
Top bar:    Cloud Lab | Lab | Scenario | Run/Stop/Reset | Status | Save | Compare | System
Main:       Setup panel | Visualization stage | Inspector panel
Bottom:     Timeline / replay controls
```

The visualization stage is the center of the product. Setup and inspector are secondary.

## Default Workbench State

Default workbench view should show:

- compact top bar
- selected lab and scenario
- one visible run-control group
- central visualization stage
- compact timeline/replay controls
- compact setup summary or key controls
- inspector closed or minimally visible unless relevant

Default workbench view should not show:

- giant hero / landing-page title block
- developer/schema/sample-run panels
- saved run manager as a large default panel
- comparison view as a default panel
- all setup controls expanded
- all diagnostics expanded
- duplicate run controls

## Information Hierarchy

The UI should read visually in this order:

1. What lab/scenario am I in?
2. How do I run it?
3. What cloud result am I seeing?
4. What changed over time?
5. What does the result mean?
6. How do I save, compare, or vary it?
7. What system/debug information is available if needed?

## Lab Workbench Components

### Top Bar

The top bar should be compact and always visible within the workbench layout.

Required content:

- Cloud Lab identity
- lab/scenario selector or breadcrumb
- Setup toggle if setup can collapse
- Run/Stop/Reset
- compact run status
- Inspector toggle
- Save Run action
- Compare action
- System/developer action

The top bar must occupy layout space and must not overlay content.

### Setup Panel

The setup panel should be lab-specific and scenario-first.

Visible content should include:

1. Lab/scenario summary
   - question
   - intended phenomenon
   - expected behavior
   - known limitations

2. Key controls
   - only the most meaningful controls for the selected lab/scenario
   - usually 3–7 controls, not every available model parameter

3. Collapsed advanced sections
   - atmosphere / profile details
   - forcing details
   - solver/model details
   - saved scenario configuration

Setup should expose physical concepts, not raw implementation internals.

### Visualization Stage

The visualization stage should be the dominant region.

Supported view families:

- scientific 2-D field view
- cloud appearance view
- 2.5-D visual extrusion view
- comparison view when in comparison mode

The user should be able to switch between science and beauty views without changing solver state.

### Timeline / Replay

Timeline and replay controls should be compact and tied to the current run.

They should support:

- displayed simulation time
- frame index / frame count
- scrubber
- play/pause replay
- jump to first/final
- event jump targets where available, such as first cloud or max cloud water

Timeline controls are not simulation Run/Stop controls. They operate on buffered frames.

### Inspector Panel

The inspector should explain what happened.

Tabs or sections may include:

- Overview / expected vs observed
- Profile / sounding
- Probe
- Diagnostics
- Microphysics, only when relevant

Inspector should open contextually when useful, such as after a probe click. It should not compete with the visualization by default.

### Saved Runs

Saved runs should be an explicit workflow.

A saved scenario answers:

> How do I run this setup again?

A saved run answers:

> What happened in this specific run?

Saved run view should include:

- run name
- lab/scenario
- config snapshot
- key diagnostics
- replay metadata / sampled frames if available
- notes
- load / compare / delete actions

Saved run artifacts should not be a large default panel in the normal single-run workbench.

### Comparison Mode

Comparison should be a mode, not a stacked default panel.

Comparison mode should support:

- scenario A / scenario B
- run A / run B
- synchronized replay time where possible
- shared visual scales where appropriate
- diagnostic deltas
- config differences

The normal single-run workbench should hide comparison UI unless the user enters comparison mode.

### System / Developer Drawer

System information should be secondary.

It may include:

- backend status
- API URL
- solver catalog
- schema/sample diagnostics
- developer/debug details

Normal users should be able to ignore it.

## Lab Contract

Each lab should define:

- lab id
- display name
- physical question
- short description
- maturity level
- supported scenarios
- primary controls
- secondary controls
- diagnostics
- visualization modes
- limitations
- related solver/core capabilities

Example:

```ts
type CloudLabDefinition = {
  id: string;
  name: string;
  question: string;
  description: string;
  maturity: "prototype" | "usable" | "advanced";
  scenarios: ScenarioDefinition[];
  controls: LabControlDefinition[];
  diagnostics: DiagnosticDefinition[];
  visualizationModes: VisualizationModeDefinition[];
  limitations: string[];
};
```

Exact types may differ, but the concept should remain.

## Scenario Contract

Each scenario should define:

- scenario id
- lab id
- name
- intended phenomenon
- initial condition / forcing defaults
- expected behavior
- diagnostic expectations
- limitations
- recommended visual modes
- suggested comparison variants

Scenarios should be understandable as experiments, not just saved configuration blobs.

## Mode Model

Workbench V2 may use simple app modes such as:

```ts
type WorkbenchMode = "single" | "saved-runs" | "compare";
```

A mode should change the workspace intentionally. Do not keep every workflow visible at once.

## Clean-Slate Rule

Workbench V2 may reuse current components, but reuse is not the goal.

Prefer clean product architecture over maximum code reuse. Existing frontend code should be reused only when it fits the lab-driven model cleanly.

The backend API, solver registry, frame schema, and validation work are valuable and should be preserved. The current frontend layout should not dictate the future product.

## First Complete Workbench V2 Target

The first complete implementation should support one lab end-to-end:

### Fair-Weather Cumulus Lab

Minimum user flow:

1. choose Fair-Weather Cumulus Lab
2. choose a scenario
3. adjust a small number of key controls
4. run locally
5. watch cloud field evolve
6. inspect LCL / cloud base / cloud top / max updraft / scenario status
7. save the run
8. compare against a second run or saved run if comparison is ready

This first lab becomes the reference implementation for future labs.

## Design Quality Bar

Workbench V2 is successful when:

- the first screen is understandable without explanation
- the visualization is clearly dominant
- the user knows what to do next
- controls are meaningful, not overwhelming
- diagnostics explain behavior without drowning the user
- saved runs and comparison are accessible but not intrusive
- approximations are clearly labeled
- the UI feels like an experiment workbench, not a pile of panels

## Non-Goals

Workbench V2 should not:

- change solver physics by itself
- require true 3-D simulation
- require PySDM
- force all old panels into the new default view
- expose every model parameter by default
- prioritize code reuse over clarity
- hide approximation limits

## Relationship To Future Hard-Core Modeling

Workbench V2 should support future higher-fidelity physics by keeping contracts clean.

Future physics cores should be able to plug into the same lab/scenario/frame/diagnostic/visualization pipeline.

The UI should not be hardwired to current Boussinesq or microphysics-lab implementation details. A future anelastic, 3-D, PySDM-backed, or library-backed solver should be able to serve a lab if it emits compatible fields and diagnostics.

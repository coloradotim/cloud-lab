# Workbench V2 Architecture

## Purpose

Workbench V2 is a clean-slate frontend product architecture for Cloud Lab.

The current frontend proved many capabilities: simulation runs, frame streaming, replay, diagnostics, saved runs, comparison, and multiple solver modes. It should now be treated as a prototype, not the final product architecture.

Workbench V2 should organize the app around labs, scenarios, diagnostics, and visualization modes rather than around accumulated panels and solver internals.

## Architecture Goals

- Make labs the primary product unit.
- Keep solvers as implementation details behind a physics-core interface.
- Keep rendering separate from solver state.
- Keep diagnostics separate from rendering.
- Keep scenario/config state explicit and testable.
- Make the frontend understandable enough to support future labs and more serious physics cores.
- Reuse old components only when they fit cleanly.

## High-Level Frontend Structure

Suggested structure:

```text
frontend/src/app/
  App.tsx
  AppShell.tsx

frontend/src/labs/
  labCatalog.ts
  labTypes.ts
  fairWeatherCumulus/
    lab.ts
    scenarios.ts
    controls.ts
    diagnostics.ts
  evolvingBoundaryLayer/
    lab.ts
    scenarios.ts
  layeredAtmosphere/
    lab.ts
  orographicClouds/
    lab.ts
  warmRain/
    lab.ts
  opticsBeauty/
    lab.ts
  fogStratus/
    lab.ts

frontend/src/workbench/
  LabPicker.tsx
  LabWorkbench.tsx
  WorkbenchTopBar.tsx
  LabSetupPanel.tsx
  VisualizationStage.tsx
  TimelinePanel.tsx
  InspectorPanel.tsx
  SavedRunsView.tsx
  ComparisonMode.tsx
  SystemDrawer.tsx

frontend/src/simulation/
  apiClient.ts
  frameTypes.ts
  runTypes.ts
  useSimulationRun.ts
  useReplayState.ts

frontend/src/scenarios/
  scenarioTypes.ts
  scenarioConfig.ts
  savedScenarios.ts
  savedRuns.ts

frontend/src/diagnostics/
  diagnosticTypes.ts
  scenarioDiagnostics.ts
  profileDiagnostics.ts
  microphysicsDiagnostics.ts

frontend/src/visualization/
  VisualizationMode.tsx
  ScientificSliceView.tsx
  CloudAppearanceView.tsx
  CloudScene25DView.tsx
  fieldScaling.ts
  truthLabels.ts

frontend/src/styles/
  tokens.css
  base.css
  workbench.css
  controls.css
  panels.css
  visualization.css
```

Exact file names may change, but the boundaries should remain.

## Core Data Flow

Workbench V2 should follow this flow:

```text
Lab definition
  ↓
Scenario definition
  ↓
SimulationConfig + lab metadata
  ↓
Physics core / backend run
  ↓
SimulationFrame stream
  ↓
Diagnostics
  ↓
Visualization modes
  ↓
Saved run / comparison / sweep
```

The UI should not reach into solver internals. It should consume lab/scenario definitions, config, frames, diagnostics, and renderer metadata.

## Lab Definitions

A lab definition should be the primary product object.

It should describe:

- id
- name
- question
- description
- maturity
- scenarios
- primary controls
- diagnostics
- visualization modes
- limitations
- related physics capabilities

Example shape:

```ts
type LabDefinition = {
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

The exact typing can evolve, but this concept should drive the UI.

## Scenario Definitions

Scenarios should be lab-specific experiments, not just raw saved configs.

A scenario should describe:

- id
- lab id
- name
- intended phenomenon
- expected behavior
- default config
- primary controls
- diagnostic expectations
- recommended visual modes
- limitations
- comparison suggestions

Scenario definitions should make it possible for the setup panel and inspector to explain what the user is doing.

## Physics Cores

The backend already has multiple solver backends behind a shared frame contract. Workbench V2 should keep that idea, but the frontend should treat physics cores as capabilities that serve labs.

A future physics core may be:

- educational 2-D
- Boussinesq 2-D
- microphysics lab
- evolving boundary-layer column
- prescribed-flow microphysics
- terrain 2-D
- anelastic 2-D
- PySDM-backed column
- true 3-D research core later

The UI should not be hardcoded around any one of these.

## Frame Contract

The shared `SimulationFrame` remains the primary data contract for visualization and diagnostics.

Durable expectations:

- fields include units
- fields include display metadata where practical
- optional microphysics payloads can be added without breaking old solvers
- future terrain/profile metadata should be versioned deliberately
- renderer assumptions should not be stored as solver truth

## Diagnostics Contract

Diagnostics should be separate from renderers.

Examples:

- LCL / expected cloud base
- first cloud time
- cloud-top height
- max updraft
- RH profile
- mixed-layer depth
- inversion strength
- cloud layer detection
- first rain time
- water budget
- droplet distribution summaries
- scenario expected / observed / status

Diagnostics should classify behavior as pass/warn/fail where appropriate, but the UI should present this as learning feedback, not just test output.

## Visualization Contract

Visualization modes should consume frames and diagnostics.

Initial modes:

- Scientific 2-D field view
- Cloud appearance view
- 2.5-D cloud scene
- Comparison view

Renderers must not change solver fields or simulation state.

Every renderer should declare:

- what fields it consumes
- whether it shows direct solver output or a visual approximation
- what assumptions it uses
- whether it is suitable for comparison

## Hooks And State Ownership

Large stateful logic should move out of `App.tsx`.

Suggested hooks:

### `useSimulationRun`

Owns:

- starting/stopping runs
- WebSocket lifecycle
- frames
- playback status
- run errors
- run metadata

### `useReplayState`

Owns:

- displayed frame index
- play/pause replay
- scrubber state
- event jumps
- timeline metadata

### `useLabScenarioState`

Owns:

- selected lab
- selected scenario
- config edits
- saved scenario loading/saving
- relevance of controls

### `useSavedRuns`

Owns:

- saved run artifacts
- loading/deleting artifacts
- saving current run

### `useWorkbenchMode`

Owns:

- single mode
- saved-runs mode
- comparison mode
- optional future sweep mode

## Workbench Modes

Workbench V2 should avoid showing every workflow at once.

Use explicit modes:

```ts
type WorkbenchMode = "single" | "saved-runs" | "compare" | "sweep";
```

### Single mode

Default mode for running one lab scenario.

### Saved-runs mode

Shows saved run artifacts and lets users inspect/load/delete/compare them.

### Compare mode

Shows two scenarios or saved runs side-by-side with synchronized replay where possible.

### Sweep mode later

Runs small parameter sweeps over selected controls and summarizes outcomes.

## Styling Architecture

Replace accumulated global styling with responsibility-based styles.

Suggested files:

```text
styles/tokens.css       colors, spacing, typography, radii, shadows
styles/base.css         reset/base element styles
styles/workbench.css    shell, layout, drawers, modes
styles/forms.css        controls, sliders, selects, labels
styles/panels.css       cards, summaries, inspector, saved runs
styles/visualization.css canvas, view controls, legends, overlays
```

If the project later adopts CSS modules or a UI library, the same responsibility boundaries should remain.

## Migration Strategy

This is not a mandate to throw away working code blindly.

Use this rule:

> Reuse existing frontend code when it cleanly fits Workbench V2. Replace it when it preserves old dashboard structure or makes the lab model harder to express.

Recommended migration:

1. Add lab catalog and lab/scenario types.
2. Create Lab Picker and Lab Workbench shell.
3. Implement Fair-Weather Cumulus Lab end-to-end using existing backend and frame schema.
4. Move or rewrite visualization stage around the new lab structure.
5. Move diagnostics into the new inspector model.
6. Move saved runs and comparison into explicit modes.
7. Retire old stacked dashboard layout once parity is sufficient.

## First Reference Implementation

The first Workbench V2 reference lab should be Fair-Weather Cumulus.

Minimum reference experience:

- choose Fair-Weather Cumulus Lab
- choose a scenario
- adjust a few controls
- run
- see cloud evolution
- inspect expected vs observed diagnostics
- inspect profile/LCL/cloud base
- save run
- compare with another run if comparison mode is ready

This reference implementation should establish patterns for future labs.

## Testing Strategy

Tests should verify product flow, not just component rendering.

Important tests:

- lab picker lists labs
- selecting a lab opens correct workbench
- scenario selection updates config
- key controls render for selected lab
- advanced controls are not default-dominant
- run lifecycle still works
- replay updates visualization
- inspector displays diagnostics for selected lab
- saved run mode is separate from single-run mode
- comparison mode is separate from single-run mode
- visual approximation labels appear where needed

## Relationship To Hard-Core Modeling

Workbench V2 should support future higher-fidelity modeling by keeping contracts clean.

A future serious physics core should be able to plug into the same architecture if it provides:

- compatible frames or a versioned schema extension
- declared supported fields
- diagnostics
- limitations
- validation status

The UI should present it through labs and scenarios, not as a raw solver mode.

## What This Architecture Prevents

Workbench V2 should prevent:

- UI panels accumulating endlessly
- solver modes defining product structure
- every control being shown equally
- rendering approximations being mistaken for physics
- old prototype layout constraining the product
- hard-core model ambitions blocking approachable labs

## Success Criteria

Workbench V2 succeeds when:

- the UI feels lab-driven
- the visualization is dominant
- users understand what to do next
- controls are meaningful and limited by context
- diagnostics explain physical behavior
- saved runs and comparison support learning
- new labs can be added without rewriting the whole app
- future physics cores can plug in without becoming the UI architecture

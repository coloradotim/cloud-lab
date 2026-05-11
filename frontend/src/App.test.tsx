import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DeveloperDrawer, SavedRunArtifactsPanel, SimulationControls, TopActionBar } from "./App";
import { BUILT_IN_SCENARIOS, normalizeConfig } from "./simulationControls";
import type { SavedScenario } from "./savedScenarios";
import type { SavedRunArtifact } from "./savedRuns";
import type { SimulationConfig, SolverDescriptor } from "./simulationTypes";

const baseConfig: SimulationConfig = normalizeConfig({
  schema_version: "sim-config-v1",
  solver_type: "boussinesq_2d",
  domain: { width_m: 10_000, height_m: 3_000 },
  grid: { columns: 36, rows: 24 },
  time: { time_step_seconds: 2, duration_seconds: 1_200, frame_interval_seconds: 30 },
  initial_atmosphere: {
    surface_temperature_k: 298.15,
    lapse_rate_k_per_m: 0.0065,
    relative_humidity: 0.85,
    boundary_layer_depth_m: 1_500,
    moist_source_layer_depth_m: 800,
    free_atmosphere_relative_humidity: 0.55,
    humidity_profile: "surface_moisture",
  },
  surface_heating: {
    max_warming_rate_k_per_s: 0.02,
    patch_center_x_m: 5_000,
    patch_width_m: 2_000,
    pattern: "single_patch",
  },
  background_wind: { u_m_per_s: 0.15, w_m_per_s: 0 },
  seed: 17,
});

const solvers: SolverDescriptor[] = [
  {
    solver_type: "boussinesq_2d",
    name: "Boussinesq 2-D",
    description: "Resolved prototype dynamics.",
    status: "available",
    limitations: ["Prototype dynamics."],
  },
  {
    solver_type: "microphysics_lab",
    name: "Microphysics lab",
    description: "Controlled parcel microphysics.",
    status: "available",
    limitations: ["Parcel/box mode."],
  },
];

const savedScenario: SavedScenario = {
  id: "saved-1",
  kind: "user",
  name: "Saved two-patch case",
  created_at: "2026-05-10T12:00:00.000Z",
  updated_at: "2026-05-10T12:00:00.000Z",
  config_schema_version: "sim-config-v1",
  config: baseConfig,
};

const savedRunArtifact: SavedRunArtifact = {
  schema_version: "saved-run-artifact-v1",
  id: "run-1",
  kind: "run_artifact",
  name: "Saved cumulus run",
  notes: "Clouds formed near the expected level.",
  created_at: "2026-05-10T12:00:00.000Z",
  scenario: { slug: "fair-weather-moderate-base", name: "Fair-weather cumulus" },
  config_schema_version: "sim-config-v1",
  frame_schema_version: "sim-frame-v1",
  solver_type: "boussinesq_2d",
  app_version: "local-browser",
  backend_version: "0.1.0",
  config: baseConfig,
  run: {
    duration_seconds: 1_200,
    frame_count: 80,
    final_time_seconds: 1_200,
    displayed_time_seconds: 1_200,
  },
  diagnostics: {
    scenario_status: "plausible",
    scenario_status_label: "Plausible",
    expected: "Delayed fair-weather cloud.",
    observed: "Cloud formed after lifting.",
    notes: [],
    first_cloud_time_seconds: 660,
    first_cloud_height_m: 1_100,
    max_cloud_liquid_water_kg_per_kg: 0.0002,
    max_cloud_time_seconds: 900,
    cloud_top_height_m: 1_800,
    max_updraft_m_per_s: 1.1,
    first_rain_time_seconds: null,
    max_rain_water_kg_per_kg: 0,
    estimated_lcl_m: 1_050,
    microphysics_total_water_drift_concerning: null,
  },
  replay: {
    storage: "sampled_frames",
    total_frame_count: 80,
    stored_frame_count: 40,
    sample_stride: 2,
    frames_truncated: true,
  },
  sampled_frames: [],
};

describe("SimulationControls", () => {
  it("renders a scenario-first setup drawer with scenario meaning before raw controls", () => {
    const scenario = BUILT_IN_SCENARIOS.find(
      (candidate) => candidate.slug === "fair-weather-moderate-base",
    );
    if (!scenario) {
      throw new Error("Missing fair-weather scenario");
    }

    const html = renderControls({
      config: scenario.apply(baseConfig),
      selectedReferenceCase: scenario.slug,
    });

    expect(html).toContain("Scenario setup");
    expect(html).toContain("Selected experiment");
    expect(html).toContain("Fair-weather cumulus");
    expect(html).toContain("Intended phenomenon");
    expect(html).toContain("Expected outcome");
    expect(html).toContain("Key diagnostics");
    expect(html).toContain("Changes reset playback and apply to the next run.");
    expect(html.indexOf("Selected experiment")).toBeLessThan(html.indexOf("Basic controls"));
  });

  it("hides Boussinesq surface heating controls for microphysics scenarios", () => {
    const scenario = BUILT_IN_SCENARIOS.find(
      (candidate) => candidate.slug === "microphysics-lifted-humid-parcel",
    );
    if (!scenario) {
      throw new Error("Missing microphysics scenario");
    }

    const html = renderControls({
      config: scenario.apply(baseConfig),
      selectedReferenceCase: scenario.slug,
    });

    expect(html).toContain("Prescribed lift");
    expect(html).not.toContain("Heating pattern");
    expect(html).not.toContain("Heating rate");
    expect(html).not.toContain("Patch width");
  });

  it("keeps advanced model settings collapsed separately from saved experiments", () => {
    const html = renderControls({
      config: baseConfig,
      selectedReferenceCase: "fair-weather-moderate-base",
    });

    expect(html).toContain("Advanced model settings");
    expect(html).toContain("Saved experiments");
    expect(html).not.toContain('<details class="advanced-controls" open="">');
    expect(html).not.toContain('<details class="saved-experiments" open="">');
  });

  it("preserves saved scenario controls in the setup drawer", () => {
    const html = renderControls({
      config: baseConfig,
      savedScenarios: [savedScenario],
      selectedReferenceCase: "fair-weather-moderate-base",
    });

    expect(html).toContain("Saved two-patch case");
    expect(html).toContain("Experiment name");
    expect(html).toContain("Save copy");
    expect(html).toContain("Update");
    expect(html).toContain("Delete");
  });
});

describe("workbench system controls", () => {
  const idlePlayback = {
    status: "idle" as const,
    message: null,
    runId: null,
    currentTimeSeconds: 0,
    durationSeconds: 1_200,
    framesReceived: 0,
    frameRate: 0,
    maxCloudWater: 0,
    maxUpdraft: 0,
  };

  it("shows compact backend status in the top bar", () => {
    const html = renderToStaticMarkup(
      <TopActionBar
        selectedScenarioSlug="fair-weather-moderate-base"
        playback={idlePlayback}
        canStart
        health={{ status: "online", service: "cloud-lab-api", version: "0.1.0" }}
        isSetupOpen
        isInspectorOpen
        isDeveloperDrawerOpen={false}
        hasPinnedInspectorContext={false}
        onScenarioChange={vi.fn()}
        onSetupToggle={vi.fn()}
        onInspectorToggle={vi.fn()}
        onDeveloperDrawerToggle={vi.fn()}
        onStart={vi.fn()}
        onStop={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    expect(html).toContain("Backend online v0.1.0");
    expect(html).toContain("System");
  });

  it("keeps offline backend state visible in the top bar", () => {
    const html = renderToStaticMarkup(
      <TopActionBar
        selectedScenarioSlug="fair-weather-moderate-base"
        playback={idlePlayback}
        canStart
        health={{ status: "offline", message: "Connection refused" }}
        isSetupOpen
        isInspectorOpen
        isDeveloperDrawerOpen={false}
        hasPinnedInspectorContext={false}
        onScenarioChange={vi.fn()}
        onSetupToggle={vi.fn()}
        onInspectorToggle={vi.fn()}
        onDeveloperDrawerToggle={vi.fn()}
        onStart={vi.fn()}
        onStop={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    expect(html).toContain("Backend offline");
  });

  it("renders schema and sample-run details inside the developer drawer", () => {
    const html = renderToStaticMarkup(
      <DeveloperDrawer
        health={{ status: "online", service: "cloud-lab-api", version: "0.1.0" }}
        sampleFrame={{
          status: "ready",
          schemaVersion: "sim-frame-v1",
          columns: 4,
          rows: 3,
          fieldCount: 6,
          units: ["K", "m/s"],
        }}
        sampleRun={{
          status: "ready",
          frameCount: 5,
          finalTimeSeconds: 120,
          maxCloudWater: 0.001,
          maxUpdraft: 1.25,
        }}
        solvers={solvers}
        apiBaseUrl="http://localhost:8000"
      />,
    );

    expect(html).toContain("Developer details");
    expect(html).toContain("Sample output");
    expect(html).toContain("Sample run");
    expect(html).toContain("sim-frame-v1");
    expect(html).toContain("Public solvers");
    expect(html).toContain("http://localhost:8000");
  });
});

describe("SavedRunArtifactsPanel", () => {
  it("distinguishes saved runs from saved scenarios and disables saving without buffered frames", () => {
    const html = renderToStaticMarkup(
      <SavedRunArtifactsPanel
        savedRuns={[]}
        selectedSavedRunId=""
        saveRunName=""
        saveRunNotes=""
        canSaveRun={false}
        onSaveRunNameChange={vi.fn()}
        onSaveRunNotesChange={vi.fn()}
        onSaveCurrentRun={vi.fn()}
        onLoadRunArtifact={vi.fn()}
        onDeleteRunArtifact={vi.fn()}
      />,
    );

    expect(html).toContain("Saved run artifacts");
    expect(html).toContain(
      "Saved runs preserve the config, diagnostics, and sampled replay frames",
    );
    expect(html).toContain("Saved scenarios remain reusable setup recipes");
    expect(html).toContain("disabled");
  });

  it("renders selected artifact replay metadata and diagnostics", () => {
    const html = renderToStaticMarkup(
      <SavedRunArtifactsPanel
        savedRuns={[savedRunArtifact]}
        selectedSavedRunId="run-1"
        saveRunName=""
        saveRunNotes=""
        canSaveRun
        onSaveRunNameChange={vi.fn()}
        onSaveRunNotesChange={vi.fn()}
        onSaveCurrentRun={vi.fn()}
        onLoadRunArtifact={vi.fn()}
        onDeleteRunArtifact={vi.fn()}
      />,
    );

    expect(html).toContain("Saved cumulus run");
    expect(html).toContain("40 sampled frames of 80");
    expect(html).toContain("Delayed fair-weather cloud.");
    expect(html).toContain("Cloud formed after lifting.");
    expect(html).toContain("1.100 m/s");
  });
});

function renderControls({
  config,
  selectedReferenceCase,
  savedScenarios = [],
}: {
  config: SimulationConfig;
  selectedReferenceCase: string;
  savedScenarios?: SavedScenario[];
}) {
  return renderToStaticMarkup(
    <SimulationControls
      config={config}
      solvers={solvers}
      savedScenarios={savedScenarios}
      selectedReferenceCase={selectedReferenceCase}
      message={null}
      onConfigChange={vi.fn()}
      onSelectedReferenceCaseChange={vi.fn()}
      onSaveScenario={vi.fn()}
      onUpdateScenario={vi.fn()}
      onLoadScenario={vi.fn()}
      onDeleteScenario={vi.fn()}
    />,
  );
}

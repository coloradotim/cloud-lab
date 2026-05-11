import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ScenarioComparisonPanel } from "./ScenarioComparisonPanel";
import { normalizeConfig } from "./simulationControls";
import type { SavedRunArtifact } from "./savedRuns";
import type { SimulationConfig } from "./simulationTypes";

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
  },
  surface_heating: {
    max_warming_rate_k_per_s: 0.02,
    patch_center_x_m: 5_000,
    patch_width_m: 2_000,
  },
  background_wind: { u_m_per_s: 0.15, w_m_per_s: 0 },
  seed: 17,
});

const savedRun: SavedRunArtifact = {
  schema_version: "saved-run-artifact-v1",
  id: "run-a",
  kind: "run_artifact",
  name: "Saved comparison run",
  notes: "",
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
    frame_count: 2,
    final_time_seconds: 1_200,
    displayed_time_seconds: 1_200,
  },
  diagnostics: {
    scenario_status: "plausible",
    scenario_status_label: "Plausible",
    expected: "Cloud by configured runtime.",
    observed: "Cloud by 600 s.",
    notes: [],
    first_cloud_time_seconds: 600,
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
    total_frame_count: 2,
    stored_frame_count: 0,
    sample_stride: 1,
    frames_truncated: true,
  },
  sampled_frames: [],
};

describe("ScenarioComparisonPanel", () => {
  it("renders scenario A/B controls and diagnostic comparison columns", () => {
    const html = renderToStaticMarkup(
      <ScenarioComparisonPanel
        baseConfig={baseConfig}
        savedRuns={[savedRun]}
        apiBaseUrl="http://localhost:8000"
        websocketBaseUrl="ws://localhost:8000"
      />,
    );

    expect(html).toContain("Scenario comparison");
    expect(html).toContain("Scenario A");
    expect(html).toContain("Scenario B");
    expect(html).toContain("Run comparison");
    expect(html).toContain("Load artifact comparison");
    expect(html).toContain("Diagnostic");
    expect(html).toContain("B - A");
  });
});

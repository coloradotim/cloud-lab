import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { SimulationControls } from "./App";
import { BUILT_IN_SCENARIOS, normalizeConfig } from "./simulationControls";
import type { SavedScenario } from "./savedScenarios";
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

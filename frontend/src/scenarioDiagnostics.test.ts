import { describe, expect, it } from "vitest";

import { BUILT_IN_SCENARIOS } from "./simulationControls";
import { evaluateScenarioRun } from "./scenarioDiagnostics";
import type { BuiltInScenario } from "./simulationControls";
import type { SimulationConfig, SimulationFrame } from "./simulationTypes";

const baseConfig: SimulationConfig = {
  schema_version: "sim-config-v1",
  solver_type: "boussinesq_2d",
  domain: { width_m: 4_000, height_m: 2_000 },
  grid: { columns: 4, rows: 4 },
  time: { time_step_seconds: 2, duration_seconds: 1_200, frame_interval_seconds: 60 },
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
    patch_center_x_m: 2_000,
    patch_width_m: 1_000,
    pattern: "single_patch",
  },
  background_wind: { u_m_per_s: 0, w_m_per_s: 0 },
  seed: 3,
};

describe("scenario diagnostics", () => {
  it("marks a delayed interior fair-weather cloud as plausible", () => {
    const diagnostics = evaluateScenarioRun({
      scenario: scenario("fair-weather-moderate-base"),
      config: baseConfig,
      frames: [
        frameAt(0, { cloudCells: [], updraftCells: [[1, 1, 0.08]] }),
        frameAt(600, {
          cloudCells: [
            [1, 1, 2e-6],
            [1, 2, 3e-6],
          ],
          updraftCells: [[1, 1, 0.5]],
        }),
      ],
    });

    expect(diagnostics.status).toBe("plausible");
    expect(diagnostics.observations?.firstCloudTimeSeconds).toBe(600);
  });

  it("fails fair-weather cumulus when no cloud appears by the configured runtime", () => {
    const diagnostics = evaluateScenarioRun({
      scenario: scenario("fair-weather-moderate-base"),
      config: baseConfig,
      frames: [
        frameAt(0, { cloudCells: [], updraftCells: [[1, 1, 0.1]] }),
        frameAt(1_200, { cloudCells: [], updraftCells: [[1, 1, 0.3]] }),
      ],
    });

    expect(diagnostics.status).toBe("failed_expectation");
    expect(diagnostics.notes.join(" ")).toContain("should produce cloud");
  });

  it("warns on immediate surface-attached fair-weather cloud", () => {
    const diagnostics = evaluateScenarioRun({
      scenario: scenario("fair-weather-moderate-base"),
      config: baseConfig,
      frames: [
        frameAt(0, {
          cloudCells: [[0, 1, 2e-6]],
          updraftCells: [[0, 1, 0.2]],
        }),
        frameAt(300, {
          cloudCells: [[1, 1, 2e-6]],
          updraftCells: [[1, 1, 0.3]],
        }),
      ],
    });

    expect(diagnostics.status).toBe("failed_expectation");
    expect(diagnostics.notes.join(" ")).toContain("immediately");
  });

  it("marks dry failed cumulus plausible when motion occurs without cloud", () => {
    const diagnostics = evaluateScenarioRun({
      scenario: scenario("dry-failed-cumulus"),
      config: { ...baseConfig, initial_atmosphere: { ...baseConfig.initial_atmosphere, relative_humidity: 0.45 } },
      frames: [
        frameAt(0, { cloudCells: [], updraftCells: [] }),
        frameAt(600, { cloudCells: [], updraftCells: [[1, 2, 0.22]] }),
      ],
    });

    expect(diagnostics.status).toBe("plausible");
    expect(diagnostics.notes.join(" ")).toContain("cloud water stays negligible");
  });

  it("does not treat humid low-cloud behavior as a fair-weather failure", () => {
    const lowCloudConfig: SimulationConfig = {
      ...baseConfig,
      initial_atmosphere: {
        ...baseConfig.initial_atmosphere,
        relative_humidity: 0.98,
        free_atmosphere_relative_humidity: 0.98,
        humidity_profile: "uniform",
      },
    };

    const diagnostics = evaluateScenarioRun({
      scenario: scenario("humid-low-cloud-boundary-layer"),
      config: lowCloudConfig,
      frames: [
        frameAt(0, { cloudCells: [[0, 1, 2e-6]], updraftCells: [] }),
        frameAt(60, { cloudCells: [[0, 2, 3e-6]], updraftCells: [[0, 2, 0.05]] }),
      ],
    });

    expect(diagnostics.status).toBe("warning");
    expect(diagnostics.notes.join(" ")).toContain("not evaluated as classic fair-weather");
    expect(diagnostics.notes.join(" ")).toContain("model boundaries");
  });

  it("warns when cloud water appears in low-level return flow", () => {
    const diagnostics = evaluateScenarioRun({
      scenario: scenario("multi-thermal-cumulus-field"),
      config: baseConfig,
      frames: [
        frameAt(600, {
          cloudCells: [
            [1, 1, 2e-6],
            [1, 2, 3e-6],
          ],
          updraftCells: [
            [1, 1, -0.2],
            [1, 2, -0.1],
            [0, 1, 0.2],
          ],
        }),
      ],
    });

    expect(diagnostics.status).toBe("warning");
    expect(diagnostics.observations?.returnFlowCloudFraction).toBe(1);
    expect(diagnostics.notes.join(" ")).toContain("return-flow regions");
  });

  it("warns when cloud water touches top or lateral boundaries", () => {
    const diagnostics = evaluateScenarioRun({
      scenario: scenario("fair-weather-moderate-base"),
      config: baseConfig,
      frames: [
        frameAt(600, {
          cloudCells: [
            [1, 0, 2e-6],
            [2, 2, 3e-6],
          ],
          updraftCells: [[2, 2, 0.3]],
        }),
      ],
    });

    expect(diagnostics.status).toBe("warning");
    expect(diagnostics.observations?.lateralBoundaryCloudFraction).toBeCloseTo(0.4);
    expect(diagnostics.observations?.topBoundaryCloudFraction).toBeCloseTo(0.6);
    expect(diagnostics.notes.join(" ")).toContain("lateral boundaries");
    expect(diagnostics.notes.join(" ")).toContain("top sponge");
  });

  it("fails when the below-LCL cloud fraction crosses the hard policy threshold", () => {
    const diagnostics = evaluateScenarioRun({
      scenario: scenario("fair-weather-moderate-base"),
      config: { ...baseConfig, initial_atmosphere: { ...baseConfig.initial_atmosphere, relative_humidity: 0.3 } },
      frames: [
        frameAt(600, {
          cloudCells: [
            [0, 1, 3e-6],
            [1, 1, 1e-6],
          ],
          updraftCells: [[1, 1, 0.3]],
        }),
      ],
    });

    expect(diagnostics.status).toBe("failed_expectation");
    expect(diagnostics.notes.join(" ")).toContain("below the estimated LCL");
  });

  it("marks microphysics no-lift control plausible when it stays cloud-free and rain-free", () => {
    const config: SimulationConfig = {
      ...baseConfig,
      solver_type: "microphysics_lab",
      background_wind: { u_m_per_s: 0, w_m_per_s: 0 },
    };
    const diagnostics = evaluateScenarioRun({
      scenario: scenario("microphysics-no-lift-control"),
      config,
      frames: [
        microphysicsFrameAt(0, { vapor: 0.01, cloud: 0, rain: 0, temperature: 297 }),
        microphysicsFrameAt(600, { vapor: 0.01, cloud: 0, rain: 0, temperature: 297 }),
      ],
    });

    expect(diagnostics.status).toBe("plausible");
    expect(diagnostics.notes.join(" ")).toContain("No cloud, no rain");
  });

  it("does not evaluate missing scenario metadata or unknown scenario contracts", () => {
    const unknownScenario: BuiltInScenario = {
      ...scenario("fair-weather-moderate-base"),
      slug: "unknown-contract",
    };

    const diagnostics = evaluateScenarioRun({
      scenario: unknownScenario,
      config: baseConfig,
      frames: [frameAt(60, { cloudCells: [], updraftCells: [] })],
    });

    expect(diagnostics.status).toBe("not_evaluated");
  });

  it("does not evaluate empty frame sets", () => {
    const diagnostics = evaluateScenarioRun({
      scenario: scenario("fair-weather-moderate-base"),
      config: baseConfig,
      frames: [],
    });

    expect(diagnostics.status).toBe("not_evaluated");
    expect(diagnostics.notes.join(" ")).toContain("No frames");
  });
});

function scenario(slug: string): BuiltInScenario {
  const found = BUILT_IN_SCENARIOS.find((candidate) => candidate.slug === slug);
  if (!found) {
    throw new Error(`Missing scenario ${slug}`);
  }
  return found;
}

function frameAt(
  timeSeconds: number,
  values: {
    cloudCells: Array<[number, number, number]>;
    updraftCells: Array<[number, number, number]>;
  },
): SimulationFrame {
  const cloud = grid(0);
  const updraft = grid(0);
  for (const [row, column, value] of values.cloudCells) {
    cloud[row][column] = value;
  }
  for (const [row, column, value] of values.updraftCells) {
    updraft[row][column] = value;
  }

  return {
    schema_version: "sim-frame-v1",
    step: timeSeconds / 60,
    time_seconds: timeSeconds,
    config: baseConfig,
    grid: {
      columns: 4,
      rows: 4,
      x_coordinates_m: [500, 1_500, 2_500, 3_500],
      z_coordinates_m: [250, 750, 1_250, 1_750],
    },
    fields: {
      cloud_liquid_water_kg_per_kg: field(cloud, "kg kg-1", "Cloud liquid water"),
      rain_water_kg_per_kg: field(grid(0), "kg kg-1", "Rain water"),
      vertical_velocity_m_per_s: field(updraft, "m s-1", "Vertical velocity"),
      water_vapor_kg_per_kg: field(grid(0.012), "kg kg-1", "Water vapor"),
      temperature_k: field(grid(295), "K", "Temperature"),
    },
  };
}

function microphysicsFrameAt(
  timeSeconds: number,
  values: {
    vapor: number;
    cloud: number;
    rain: number;
    temperature: number;
  },
): SimulationFrame {
  return {
    ...frameAt(timeSeconds, { cloudCells: [], updraftCells: [] }),
    fields: {
      cloud_liquid_water_kg_per_kg: field(grid(values.cloud), "kg kg-1", "Cloud liquid water"),
      rain_water_kg_per_kg: field(grid(values.rain), "kg kg-1", "Rain water"),
      water_vapor_kg_per_kg: field(grid(values.vapor), "kg kg-1", "Water vapor"),
      temperature_k: field(grid(values.temperature), "K", "Temperature"),
      vertical_velocity_m_per_s: field(grid(0), "m s-1", "Vertical velocity"),
    },
  };
}

function grid(value: number): number[][] {
  return Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => value));
}

function field(values: number[][], unit: string, displayName: string) {
  return {
    values,
    metadata: {
      unit,
      display_name: displayName,
      description: displayName,
    },
  };
}

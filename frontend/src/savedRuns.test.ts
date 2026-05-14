import { describe, expect, it } from "vitest";

import type { ScenarioDiagnostics } from "./scenarioDiagnostics";
import { BUILT_IN_SCENARIOS, normalizeConfig } from "./simulationControls";
import {
  createSavedRunArtifact,
  deleteSavedRun,
  loadSavedRuns,
  persistSavedRuns,
  saveRunArtifact,
} from "./savedRuns";
import type { SimulationConfig, SimulationFrame } from "./simulationTypes";

const config: SimulationConfig = normalizeConfig({
  schema_version: "sim-config-v1",
  solver_type: "boussinesq_2d",
  domain: { width_m: 10_000, height_m: 3_000 },
  grid: { columns: 2, rows: 2 },
  time: { time_step_seconds: 2, duration_seconds: 120, frame_interval_seconds: 10 },
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

const diagnostics: ScenarioDiagnostics = {
  expected: "Delayed cloud.",
  observed: "first cloud at 60 s near 900 m.",
  status: "plausible",
  statusLabel: "Plausible",
  notes: ["Saved diagnostic note."],
  observations: {
    frameCount: 3,
    finalTimeSeconds: 120,
    maxCloudLiquidWaterKgPerKg: 0.001,
    maxCloudWaterTimeSeconds: 90,
    firstCloudTimeSeconds: 60,
    firstCloudBaseM: 900,
    maxCloudTopM: 1_500,
    maxCloudRegionCount: 2,
    maxRainWaterKgPerKg: 0,
    firstRainTimeSeconds: null,
    maxUpdraftMPerS: 1.2,
    immediateSurfaceCloud: false,
    boundaryCloudFraction: 0,
    returnFlowCloudFraction: 0,
    topBoundaryCloudFraction: 0,
    lateralBoundaryCloudFraction: 0,
    boundaryConnectedCloudRegionFraction: 0,
    belowLclCloudFraction: 0.1,
    estimatedLclM: 850,
    microphysicsTotalWaterDriftConcerning: false,
    microphysicsVaporDecreaseKgPerKg: null,
  },
};

describe("saved run artifacts", () => {
  it("creates a run artifact with config, schema, diagnostics, and sampled replay metadata", () => {
    const scenario = BUILT_IN_SCENARIOS.find(
      (candidate) => candidate.slug === "fair-weather-moderate-base",
    );
    const frames = Array.from({ length: 75 }, (_, index) => frame(index * 10));

    const artifact = createSavedRunArtifact({
      name: "  Interesting thermal  ",
      notes: "  cloud split into two cells  ",
      scenario,
      config,
      frames,
      displayedFrameIndex: 5,
      diagnostics,
      backendVersion: "0.1.0",
      now: new Date("2026-05-10T12:00:00Z"),
    });

    expect(artifact.name).toBe("Interesting thermal");
    expect(artifact.notes).toBe("cloud split into two cells");
    expect(artifact.config_schema_version).toBe("sim-config-v1");
    expect(artifact.frame_schema_version).toBe("sim-frame-v1");
    expect(artifact.solver_type).toBe("boussinesq_2d");
    expect(artifact.backend_version).toBe("0.1.0");
    expect(artifact.diagnostics.first_cloud_time_seconds).toBe(60);
    expect(artifact.diagnostics.max_cloud_liquid_water_kg_per_kg).toBe(0.001);
    expect(artifact.replay.total_frame_count).toBe(75);
    expect(artifact.replay.stored_frame_count).toBeLessThan(75);
    expect(artifact.sampled_frames[artifact.sampled_frames.length - 1].time_seconds).toBe(740);
  });

  it("persists, loads, and deletes saved runs separately from saved scenarios", () => {
    const storage = memoryStorage();
    storage.setItem("cloud-lab.saved-scenarios.v1", "not touched");
    const artifact = createSavedRunArtifact({
      name: "Saved run",
      notes: "",
      scenario: null,
      config,
      frames: [frame(0), frame(10)],
      displayedFrameIndex: 1,
      diagnostics,
      backendVersion: null,
      now: new Date("2026-05-10T12:00:00Z"),
    });

    const saved = saveRunArtifact([], artifact);
    persistSavedRuns(saved, storage);
    const loaded = loadSavedRuns(storage);

    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe("Saved run");
    expect(storage.getItem("cloud-lab.saved-scenarios.v1")).toBe("not touched");
    expect(deleteSavedRun(loaded, loaded[0].id)).toEqual([]);
  });

  it("degrades gracefully for malformed or older stored artifacts", () => {
    const storage = memoryStorage();
    storage.setItem(
      "cloud-lab.saved-runs.v1",
      JSON.stringify([
        { bad: "record" },
        {
          schema_version: "saved-run-artifact-v1",
          id: "run-old",
          name: "Old run",
          config,
        },
      ]),
    );

    const loaded = loadSavedRuns(storage);

    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe("run-old");
    expect(loaded[0].sampled_frames).toEqual([]);
    expect(loaded[0].diagnostics.scenario_status).toBe("not_evaluated");
  });
});

function frame(timeSeconds: number): SimulationFrame {
  return {
    schema_version: "sim-frame-v1",
    step: timeSeconds / 10,
    time_seconds: timeSeconds,
    config,
    grid: {
      columns: 2,
      rows: 2,
      x_coordinates_m: [0, 1_000],
      z_coordinates_m: [0, 500],
    },
    fields: {
      cloud_liquid_water_kg_per_kg: field(timeSeconds >= 60 ? 0.001 : 0, "kg kg-1", "Cloud"),
      rain_water_kg_per_kg: field(0, "kg kg-1", "Rain"),
      vertical_velocity_m_per_s: field(1.2, "m s-1", "Vertical velocity"),
    },
  };
}

function field(value: number, unit: string, displayName: string) {
  return {
    values: [
      [value, value],
      [value, value],
    ],
    metadata: {
      unit,
      display_name: displayName,
      description: displayName,
    },
  };
}

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}

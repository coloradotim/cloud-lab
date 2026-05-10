import { describe, expect, it } from "vitest";

import type { SimulationConfig } from "./simulationTypes";
import {
  deleteSavedScenario,
  loadSavedScenarios,
  persistSavedScenarios,
  saveNewScenario,
  updateSavedScenario,
} from "./savedScenarios";

const config: SimulationConfig = {
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
  background_wind: { u_m_per_s: 0.2, w_m_per_s: 0 },
  seed: 9,
};

describe("saved scenarios", () => {
  it("saves, persists, and reloads normalized user scenarios", () => {
    const storage = memoryStorage();
    const scenarios = saveNewScenario([], "  My thermal  ", config, new Date("2026-05-09T12:00:00Z"));

    persistSavedScenarios(scenarios, storage);
    const loaded = loadSavedScenarios(storage);

    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toMatchObject({
      kind: "user",
      name: "My thermal",
      config_schema_version: "sim-config-v1",
    });
    expect(loaded[0].config.initial_atmosphere.moist_source_layer_depth_m).toBeDefined();
  });

  it("updates and deletes saved scenarios without mutating built-in configs", () => {
    const scenarios = saveNewScenario([], "Original", config, new Date("2026-05-09T12:00:00Z"));
    const updated = updateSavedScenario(
      scenarios,
      scenarios[0].id,
      { ...config, seed: 99 },
      new Date("2026-05-09T13:00:00Z"),
    );

    expect(updated[0].config.seed).toBe(99);
    expect(updated[0].updated_at).not.toBe(updated[0].created_at);
    expect(deleteSavedScenario(updated, updated[0].id)).toHaveLength(0);
  });

  it("ignores corrupt local storage payloads", () => {
    const storage = memoryStorage();
    storage.setItem("cloud-lab.saved-scenarios.v1", "{not-json");

    expect(loadSavedScenarios(storage)).toEqual([]);
  });
});

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

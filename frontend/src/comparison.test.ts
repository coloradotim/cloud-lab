import { describe, expect, it } from "vitest";

import {
  alignConfigForComparison,
  diagnosticComparisonRows,
  frameAtOrBeforeTime,
  normalizedValueForSharedRange,
  sharedRangeForComparisonFrames,
} from "./comparison";
import { normalizeConfig } from "./simulationControls";
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

describe("comparison helpers", () => {
  it("aligns comparison domain, grid, and runtime to the reference config", () => {
    const candidate = normalizeConfig({
      ...config,
      domain: { width_m: 20_000, height_m: 6_000 },
      grid: { columns: 72, rows: 48 },
      time: { time_step_seconds: 1, duration_seconds: 3_600, frame_interval_seconds: 5 },
    });

    const aligned = alignConfigForComparison(candidate, config);

    expect(aligned.domain).toEqual(config.domain);
    expect(aligned.grid).toEqual(config.grid);
    expect(aligned.time).toEqual(config.time);
    expect(aligned.initial_atmosphere).toEqual(candidate.initial_atmosphere);
  });

  it("selects the latest frame at or before synchronized time", () => {
    const frames = [frame(0, 0), frame(30, 1), frame(60, 2)];

    expect(frameAtOrBeforeTime(frames, 45)?.time_seconds).toBe(30);
    expect(frameAtOrBeforeTime(frames, 90)?.time_seconds).toBe(60);
    expect(frameAtOrBeforeTime([], 90)).toBeNull();
  });

  it("uses a shared display range for side-by-side scalar fields", () => {
    const left = frame(0, 0.001);
    const right = frame(0, 0.01);

    const range = sharedRangeForComparisonFrames("cloud_liquid_water_kg_per_kg", [
      left,
      right,
    ]);
    const leftNormalized = normalizedValueForSharedRange(
      "cloud_liquid_water_kg_per_kg",
      left.fields.cloud_liquid_water_kg_per_kg,
      0.001,
      range,
    );
    const rightNormalized = normalizedValueForSharedRange(
      "cloud_liquid_water_kg_per_kg",
      right.fields.cloud_liquid_water_kg_per_kg,
      0.01,
      range,
    );

    expect(range.max).toBeGreaterThanOrEqual(0.01);
    expect(rightNormalized).toBeGreaterThan(leftNormalized);
  });

  it("calculates diagnostic differences while preserving missing values", () => {
    const rows = diagnosticComparisonRows(
      {
        firstCloudTimeSeconds: 600,
        maxCloudLiquidWaterKgPerKg: 0.001,
        cloudTopHeightM: 1_400,
        firstRainTimeSeconds: null,
        maxRainWaterKgPerKg: 0,
        maxUpdraftMPerS: 1,
        estimatedLclM: 900,
      },
      {
        firstCloudTimeSeconds: 480,
        maxCloudLiquidWaterKgPerKg: 0.002,
        cloudTopHeightM: 1_800,
        firstRainTimeSeconds: null,
        maxRainWaterKgPerKg: 0,
        maxUpdraftMPerS: 1.4,
        estimatedLclM: 850,
      },
    );

    expect(rows.find((row) => row.key === "firstCloudTimeSeconds")?.delta).toBe(-120);
    expect(rows.find((row) => row.key === "cloudTopHeightM")?.delta).toBe(400);
    expect(rows.find((row) => row.key === "firstRainTimeSeconds")?.delta).toBeNull();
  });
});

function frame(timeSeconds: number, cloudWater: number): SimulationFrame {
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
      cloud_liquid_water_kg_per_kg: field(cloudWater, "kg kg-1", "Cloud"),
      vertical_velocity_m_per_s: field(1, "m s-1", "Vertical velocity"),
      horizontal_velocity_m_per_s: field(0.1, "m s-1", "Horizontal velocity"),
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

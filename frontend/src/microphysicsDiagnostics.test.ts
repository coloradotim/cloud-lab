import { describe, expect, it } from "vitest";

import {
  dropletHistogramFromPayload,
  summarizeMicrophysicsFrames,
} from "./microphysicsDiagnostics";
import type { MicrophysicsPayload, SimulationConfig, SimulationFrame } from "./simulationTypes";

const config: SimulationConfig = {
  schema_version: "sim-config-v1",
  solver_type: "microphysics_lab",
  domain: { width_m: 10_000, height_m: 3_000 },
  grid: { columns: 2, rows: 2 },
  time: { time_step_seconds: 10, duration_seconds: 120, frame_interval_seconds: 30 },
  initial_atmosphere: {
    surface_temperature_k: 298.15,
    lapse_rate_k_per_m: 0.0065,
    relative_humidity: 0.99,
    boundary_layer_depth_m: 1_000,
  },
  surface_heating: {
    max_warming_rate_k_per_s: 0,
    patch_center_x_m: 5_000,
    patch_width_m: 2_000,
  },
  background_wind: { u_m_per_s: 0, w_m_per_s: 2 },
  seed: 7,
};

describe("microphysics diagnostics", () => {
  it("computes condensation timing and water-budget drift from buffered frames", () => {
    const frames = [
      frameAt(0, { temperatureK: 298.15, vapor: 0.019, cloud: 0, rain: 0 }),
      frameAt(30, { temperatureK: 297.5, vapor: 0.0188, cloud: 0.0002, rain: 0 }),
      frameAt(60, { temperatureK: 297.0, vapor: 0.01878, cloud: 0.00018, rain: 0.00004 }),
    ];

    const summary = summarizeMicrophysicsFrames(frames, config);

    expect(summary).toMatchObject({
      firstCloudWaterTimeSeconds: 30,
      firstRainWaterTimeSeconds: 60,
      maxCloudLiquidWaterKgPerKg: 0.0002,
      maxCloudLiquidWaterTimeSeconds: 30,
      finalParcelHeightM: 120,
      prescribedVerticalVelocityMPerS: 2,
      totalWaterDriftIsConcerning: false,
    });
    expect(summary?.maxAbsoluteTotalWaterDriftKgPerKg).toBeCloseTo(0);
  });

  it("reports no condensation clearly for dry runs", () => {
    const frames = [
      frameAt(0, { temperatureK: 298.15, vapor: 0.01, cloud: 0, rain: 0 }),
      frameAt(30, { temperatureK: 297.8, vapor: 0.01, cloud: 0, rain: 0 }),
    ];

    const summary = summarizeMicrophysicsFrames(frames, config);

    expect(summary?.firstCloudWaterTimeSeconds).toBeNull();
    expect(summary?.firstRainWaterTimeSeconds).toBeNull();
    expect(summary?.interpretations[0]).toBe(
      "No condensation occurred because the parcel did not reach saturation.",
    );
  });

  it("flags concerning total-water drift", () => {
    const frames = [
      frameAt(0, { temperatureK: 298.15, vapor: 0.01, cloud: 0, rain: 0 }),
      frameAt(30, { temperatureK: 297.8, vapor: 0.011, cloud: 0, rain: 0 }),
    ];

    const summary = summarizeMicrophysicsFrames(frames, config);

    expect(summary?.totalWaterDriftIsConcerning).toBe(true);
    expect(summary?.maxAbsoluteTotalWaterDriftKgPerKg).toBeCloseTo(0.001);
  });

  it("degrades gracefully when droplet distributions are absent", () => {
    expect(dropletHistogramFromPayload(undefined)).toBeNull();
    expect(dropletHistogramFromPayload(null)).toBeNull();
    expect(dropletHistogramFromPayload({ schema_version: "microphysics-v1" })).toBeNull();
  });

  it("maps optional droplet payloads to histogram bars and bin labels", () => {
    const payload: MicrophysicsPayload = {
      schema_version: "microphysics-v1",
      bin_axis: {
        name: "particle_radius",
        edge_values: [1, 2, 4, 8],
        unit: "um",
        scale: "log",
      },
      global_distribution: {
        products: [
          {
            product: "number_concentration",
            unit: "m-3",
            normalization: "per_bin",
            values: [10, 20, 5],
          },
        ],
      },
    };

    expect(dropletHistogramFromPayload(payload)).toEqual({
      axisName: "particle_radius",
      unit: "um",
      product: "number_concentration",
      productUnit: "m-3",
      normalization: "per_bin",
      bars: [
        { label: "1-2 um", value: 10 },
        { label: "2-4 um", value: 20 },
        { label: "4-8 um", value: 5 },
      ],
    });
  });
});

function frameAt(
  timeSeconds: number,
  values: {
    temperatureK: number;
    vapor: number;
    cloud: number;
    rain: number;
  },
): SimulationFrame {
  return {
    schema_version: "sim-frame-v1",
    step: timeSeconds / 30,
    time_seconds: timeSeconds,
    grid: {
      columns: 2,
      rows: 2,
      x_coordinates_m: [2_500, 7_500],
      z_coordinates_m: [750, 2_250],
    },
    fields: {
      temperature_k: field(values.temperatureK, "K", "Temperature"),
      water_vapor_kg_per_kg: field(values.vapor, "kg kg-1", "Water vapor"),
      cloud_liquid_water_kg_per_kg: field(values.cloud, "kg kg-1", "Cloud liquid water"),
      rain_water_kg_per_kg: field(values.rain, "kg kg-1", "Rain water"),
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

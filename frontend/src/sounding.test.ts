import { describe, expect, it } from "vitest";

import type { SimulationConfig, SimulationFrame } from "./simulationTypes";
import { buildVerticalProfile } from "./sounding";

const config: SimulationConfig = {
  schema_version: "sim-config-v1",
  solver_type: "boussinesq_2d",
  domain: { width_m: 2_000, height_m: 1_500 },
  grid: { columns: 2, rows: 3 },
  time: { time_step_seconds: 2, duration_seconds: 120, frame_interval_seconds: 30 },
  initial_atmosphere: {
    surface_temperature_k: 298.15,
    lapse_rate_k_per_m: 0.0065,
    relative_humidity: 0.8,
    boundary_layer_depth_m: 1_000,
    moist_source_layer_depth_m: 500,
    free_atmosphere_relative_humidity: 0.55,
    humidity_profile: "surface_moisture",
  },
  surface_heating: {
    max_warming_rate_k_per_s: 0.02,
    patch_center_x_m: 1_000,
    patch_width_m: 500,
  },
  background_wind: { u_m_per_s: 0, w_m_per_s: 0 },
  seed: 1,
};

const frame: SimulationFrame = {
  schema_version: "sim-frame-v1",
  step: 1,
  time_seconds: 30,
  config,
  grid: {
    columns: 2,
    rows: 3,
    x_coordinates_m: [500, 1_500],
    z_coordinates_m: [250, 750, 1_250],
  },
  fields: {
    temperature_k: field(
      [
        [298.15, 299.15],
        [294.15, 295.15],
        [290.15, 291.15],
      ],
      "K",
      "Temperature",
    ),
    water_vapor_kg_per_kg: field(
      [
        [0.012, 0.013],
        [0.011, 0.012],
        [0.008, 0.009],
      ],
      "kg kg-1",
      "Water vapor",
    ),
    cloud_liquid_water_kg_per_kg: field(
      [
        [0, 0],
        [0.0001, 0],
        [0, 0],
      ],
      "kg kg-1",
      "Cloud liquid water",
    ),
    vertical_velocity_m_per_s: field(
      [
        [0.1, 0.2],
        [0.3, 0.4],
        [0, 0],
      ],
      "m s-1",
      "Vertical velocity",
    ),
  },
};

describe("vertical sounding profiles", () => {
  it("extracts a selected x-column and derived relative humidity", () => {
    const profile = buildVerticalProfile(frame, config, 1);

    expect(profile?.mode).toBe("column");
    expect(profile?.xMeters).toBe(1_500);
    expect(profile?.points[0].values.temperature_k).toBeCloseTo(26);
    expect(profile?.points[0].values.relative_humidity).toBeGreaterThan(0);
    expect(profile?.markers.map((marker) => marker.key)).toEqual(
      expect.arrayContaining(["estimated_lcl", "boundary_layer_top", "moist_source_top"]),
    );
  });

  it("builds a domain-average profile when no column is selected", () => {
    const profile = buildVerticalProfile(frame, config, null);

    expect(profile?.mode).toBe("domain_average");
    expect(profile?.xMeters).toBeNull();
    expect(profile?.points[0].values.vertical_velocity_m_per_s).toBeCloseTo(0.15);
  });

  it("adds a broadcast-mode note for microphysics lab frames", () => {
    const profile = buildVerticalProfile(frame, { ...config, solver_type: "microphysics_lab" }, null);

    expect(profile?.note).toContain("0-D parcel/box");
  });
});

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

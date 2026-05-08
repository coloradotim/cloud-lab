import { describe, expect, it } from "vitest";

import type { SimulationConfig } from "./simulationTypes";
import {
  BOUSSINESQ_MODEL_SIZES,
  BOUSSINESQ_REFERENCE_CASES,
  celsiusToKelvin,
  configWarnings,
  kelvinToCelsius,
  normalizeConfig,
  updateConfigNumber,
  updateConfigValue,
} from "./simulationControls";

const config: SimulationConfig = {
  schema_version: "sim-config-v1",
  solver_type: "educational_2d",
  domain: { width_m: 10_000, height_m: 3_000 },
  grid: { columns: 36, rows: 24 },
  time: { time_step_seconds: 2, duration_seconds: 120, frame_interval_seconds: 6 },
  initial_atmosphere: {
    surface_temperature_k: 298.15,
    lapse_rate_k_per_m: 0.0065,
    relative_humidity: 1.0,
    boundary_layer_depth_m: 1_000,
  },
  surface_heating: {
    max_warming_rate_k_per_s: 0.012,
    patch_center_x_m: 5_000,
    patch_width_m: 2_000,
  },
  background_wind: { u_m_per_s: 0.25, w_m_per_s: 0 },
  seed: 3,
};

describe("simulation controls", () => {
  it("updates nested numeric config values immutably", () => {
    const updated = updateConfigNumber(config, "initial_atmosphere.relative_humidity", 0.8);

    expect(updated.initial_atmosphere.relative_humidity).toBe(0.8);
    expect(config.initial_atmosphere.relative_humidity).toBe(1.0);
  });

  it("updates structured pattern config values immutably", () => {
    const updated = updateConfigValue(config, "surface_heating.pattern", "two_patches");

    expect(updated.surface_heating.pattern).toBe("two_patches");
    expect(config.surface_heating.pattern).toBeUndefined();
  });

  it("backfills structured scenario defaults for older configs", () => {
    const normalized = normalizeConfig(config);

    expect(normalized.surface_heating.pattern).toBe("single_patch");
    expect(normalized.surface_heating.patches).toEqual([]);
    expect(normalized.initial_atmosphere.humidity_profile).toBe("uniform");
    expect(normalized.initial_atmosphere.humidity_layers).toEqual([]);
    expect(normalized.initial_atmosphere.humidity_patch).toBeNull();
  });

  it("normalizes dependent spatial settings", () => {
    const normalized = normalizeConfig({
      ...config,
      domain: { width_m: 6_000, height_m: 2_000 },
      surface_heating: { ...config.surface_heating, patch_center_x_m: 8_000, patch_width_m: 8_000 },
      initial_atmosphere: { ...config.initial_atmosphere, boundary_layer_depth_m: 4_000 },
    });

    expect(normalized.surface_heating.patch_center_x_m).toBe(6_000);
    expect(normalized.surface_heating.patch_width_m).toBe(6_000);
    expect(normalized.initial_atmosphere.boundary_layer_depth_m).toBe(2_000);
  });

  it("converts and normalizes surface temperature display values", () => {
    expect(kelvinToCelsius(293.15)).toBeCloseTo(20);
    expect(celsiusToKelvin(20)).toBeCloseTo(293.15);

    const normalized = normalizeConfig({
      ...config,
      initial_atmosphere: { ...config.initial_atmosphere, surface_temperature_k: 400 },
    });

    expect(kelvinToCelsius(normalized.initial_atmosphere.surface_temperature_k)).toBe(40);
  });

  it("warns for low humidity and high heating", () => {
    expect(
      configWarnings({
        ...config,
        time: { ...config.time, duration_seconds: 3_600, frame_interval_seconds: 6 },
        initial_atmosphere: { ...config.initial_atmosphere, relative_humidity: 0.5 },
        surface_heating: { ...config.surface_heating, max_warming_rate_k_per_s: 0.02 },
      }),
    ).toEqual(
      expect.arrayContaining([
        "Low humidity may produce little or no cloud liquid water.",
        "Very strong heating can create abrupt thermals in the selected solver.",
        "Long runs with short frame cadence may accumulate many browser frames.",
      ]),
    );
  });

  it("warns when boussinesq runs use larger grids", () => {
    expect(
      configWarnings({
        ...config,
        solver_type: "boussinesq_2d",
        grid: { columns: 72, rows: 48 },
      }),
    ).toContain(
      "Boussinesq runs use an iterative streamfunction solve and may slow down on larger grids.",
    );
  });

  it("maps boussinesq reference cases to editable valid configs", () => {
    const quiet = BOUSSINESQ_REFERENCE_CASES.find(
      (referenceCase) => referenceCase.slug === "quiet-atmosphere",
    );
    const humid = BOUSSINESQ_REFERENCE_CASES.find(
      (referenceCase) => referenceCase.slug === "humid-lifted-thermal",
    );

    expect(BOUSSINESQ_REFERENCE_CASES).toHaveLength(5);
    expect(quiet?.apply(config)).toMatchObject({
      solver_type: "boussinesq_2d",
      surface_heating: { max_warming_rate_k_per_s: 0 },
      background_wind: { u_m_per_s: 0, w_m_per_s: 0 },
    });
    expect(humid?.apply(config).surface_heating.max_warming_rate_k_per_s).toBeGreaterThan(0);
    expect(humid?.apply(config).initial_atmosphere.relative_humidity).toBe(0.98);
  });

  it("maps boussinesq model sizes to consistent domain grid and runtime configs", () => {
    const small = BOUSSINESQ_MODEL_SIZES.find((modelSize) => modelSize.slug === "small");
    const medium = BOUSSINESQ_MODEL_SIZES.find((modelSize) => modelSize.slug === "medium");
    const large = BOUSSINESQ_MODEL_SIZES.find((modelSize) => modelSize.slug === "large");

    expect(BOUSSINESQ_MODEL_SIZES).toHaveLength(3);
    expect(small?.apply(config).grid.columns).toBeLessThan(medium?.apply(config).grid.columns ?? 0);
    expect(large?.apply(config).grid.columns).toBeGreaterThan(
      medium?.apply(config).grid.columns ?? 0,
    );
    expect(large?.apply(config).time.duration_seconds).toBeGreaterThan(
      medium?.apply(config).time.duration_seconds ?? 0,
    );
  });
});

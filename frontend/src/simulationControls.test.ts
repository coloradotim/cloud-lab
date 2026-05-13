import { describe, expect, it } from "vitest";

import type { SimulationConfig } from "./simulationTypes";
import {
  BOUSSINESQ_MODEL_SIZES,
  BUILT_IN_SCENARIOS,
  CONTROL_METADATA,
  celsiusToKelvin,
  controlPresentationFor,
  controlPresentationsFor,
  configWarnings,
  kelvinToCelsius,
  normalizeConfig,
  updateConfigNumber,
  updateConfigValue,
} from "./simulationControls";

const config: SimulationConfig = {
  schema_version: "sim-config-v1",
  solver_type: "boussinesq_2d",
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
    expect(normalized.initial_atmosphere.humidity_profile).toBe("surface_moisture");
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

  it("warns when a mixed boussinesq boundary layer starts above LCL", () => {
    expect(
      configWarnings({
        ...config,
        solver_type: "boussinesq_2d",
        initial_atmosphere: {
          ...config.initial_atmosphere,
          relative_humidity: 0.98,
          boundary_layer_depth_m: 1_000,
          humidity_profile: "uniform",
        },
      }),
    ).toContain("Boundary-layer top is above the estimated LCL; broad cloud decks are likely.");
  });

  it("maps boussinesq reference cases to editable valid configs", () => {
    const fairWeather = BUILT_IN_SCENARIOS.find(
      (referenceCase) => referenceCase.slug === "fair-weather-moderate-base",
    );
    const multiThermal = BUILT_IN_SCENARIOS.find(
      (referenceCase) => referenceCase.slug === "multi-thermal-cumulus-field",
    );

    expect(BUILT_IN_SCENARIOS).toHaveLength(7);
    expect(fairWeather?.name).toBe("Fair-weather cumulus / baseline shallow cloud");
    expect(fairWeather?.apply(config)).toMatchObject({
      solver_type: "boussinesq_2d",
      surface_heating: { max_warming_rate_k_per_s: 0.024, pattern: "single_patch" },
    });
    expect(multiThermal?.name).toBe("Multi-thermal cloud field");
    expect(multiThermal?.apply(config).surface_heating.pattern).toBe("two_patches");
    expect(multiThermal?.apply(config).initial_atmosphere.relative_humidity).toBe(0.85);
  });

  it("keeps dry failed cumulus conservative enough for long default workbench runs", () => {
    const dryFailed = BUILT_IN_SCENARIOS.find(
      (referenceCase) => referenceCase.slug === "dry-failed-cumulus",
    );
    const longRunConfig = normalizeConfig({
      ...config,
      time: { ...config.time, duration_seconds: 3_600 },
    });
    const dryFailedConfig = dryFailed?.apply(longRunConfig);

    expect(dryFailedConfig).toMatchObject({
      solver_type: "boussinesq_2d",
      initial_atmosphere: {
        relative_humidity: 0.35,
        free_atmosphere_relative_humidity: 0.25,
        humidity_profile: "surface_moisture",
      },
      surface_heating: {
        max_warming_rate_k_per_s: 0.012,
        pattern: "single_patch",
      },
      time: { duration_seconds: 3_600 },
    });
  });

  it("requires built-in scenarios to carry physical intent metadata", () => {
    const names = new Set(BUILT_IN_SCENARIOS.map((scenario) => scenario.name));

    expect(names.size).toBe(BUILT_IN_SCENARIOS.length);
    for (const scenario of BUILT_IN_SCENARIOS) {
      expect(scenario.intendedPhenomenon).not.toHaveLength(0);
      expect(scenario.thermodynamicAssumptions).not.toHaveLength(0);
      expect(scenario.expectedOutcome).not.toHaveLength(0);
      expect(scenario.diagnosticExpectations.length).toBeGreaterThan(0);
      expect(scenario.knownLimitations.length).toBeGreaterThan(0);
      expect(["boussinesq_2d", "microphysics_lab"]).toContain(scenario.solverMode);
    }
    expect(BUILT_IN_SCENARIOS.map((scenario) => scenario.slug)).toEqual(
      expect.arrayContaining([
        "fair-weather-moderate-base",
        "multi-thermal-cumulus-field",
        "dry-failed-cumulus",
        "humid-low-cloud-boundary-layer",
        "dry-cap-suppressed-cumulus",
        "microphysics-lifted-humid-parcel",
        "microphysics-no-lift-control",
      ]),
    );
  });

  it("keeps humid low-cloud as a contrast case rather than classic fair-weather cumulus", () => {
    const lowCloud = BUILT_IN_SCENARIOS.find(
      (referenceCase) => referenceCase.slug === "humid-low-cloud-boundary-layer",
    );

    expect(lowCloud?.name).toBe("Humid low-cloud contrast");
    expect(lowCloud?.description).toContain("not classic fair-weather cumulus");
    expect(lowCloud?.knownLimitations.join(" ")).toContain("low-cloud contrast case");
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

  it("defines help metadata for every public control", () => {
    const presentations = controlPresentationsFor(config);

    expect(presentations).toHaveLength(Object.keys(CONTROL_METADATA).length);
    for (const presentation of presentations) {
      expect(presentation.label).not.toHaveLength(0);
      expect(presentation.shortHelp).not.toHaveLength(0);
      expect(["basic", "advanced", "developer"]).toContain(presentation.importance);
      expect(["active", "advanced", "disabled", "hidden", "legacy"]).toContain(
        presentation.state,
      );
      expect(presentation.appliesToSolvers.length).toBeGreaterThan(0);
    }
  });

  it("hides Boussinesq surface-heating controls for microphysics lab", () => {
    const microphysicsConfig: SimulationConfig = {
      ...config,
      solver_type: "microphysics_lab",
      background_wind: { u_m_per_s: 0, w_m_per_s: 2 },
    };

    expect(controlPresentationFor("heating_pattern", microphysicsConfig).state).toBe("hidden");
    expect(controlPresentationFor("surface_heating_rate", microphysicsConfig).state).toBe("hidden");
    expect(controlPresentationFor("heating_patch_width", microphysicsConfig).state).toBe("hidden");
    expect(controlPresentationFor("prescribed_lift", microphysicsConfig).state).toBe("active");
  });

  it("does not expose Boussinesq prescribed lift as a primary active control", () => {
    const presentation = controlPresentationFor("prescribed_lift", config);

    expect(presentation.state).toBe("disabled");
    expect(presentation.disabledReason).toContain("Boussinesq vertical motion is predicted");
  });

  it("hides heating patch center and width when weak random heating controls placement", () => {
    const weakRandomConfig = normalizeConfig({
      ...config,
      surface_heating: { ...config.surface_heating, pattern: "weak_random" },
    });

    expect(controlPresentationFor("heating_patch_center", weakRandomConfig).state).toBe("hidden");
    expect(controlPresentationFor("heating_patch_width", weakRandomConfig).state).toBe("hidden");
  });

  it("keeps patch width but hides patch center for paired thermal forcing", () => {
    const twoPatchConfig = normalizeConfig({
      ...config,
      surface_heating: { ...config.surface_heating, pattern: "two_patches" },
    });

    expect(controlPresentationFor("heating_patch_width", twoPatchConfig).state).toBe("active");
    expect(controlPresentationFor("heating_patch_center", twoPatchConfig).state).toBe("hidden");
  });

  it("groups grid cadence and seed controls as advanced or developer settings", () => {
    expect(controlPresentationFor("domain_width", config).state).toBe("advanced");
    expect(controlPresentationFor("grid_columns", config).state).toBe("advanced");
    expect(controlPresentationFor("time_step", config).state).toBe("advanced");
    expect(controlPresentationFor("frame_cadence", config).state).toBe("advanced");
    expect(controlPresentationFor("seed", config).state).toBe("advanced");
  });
});

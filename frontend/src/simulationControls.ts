import type { SimulationConfig } from "./simulationTypes";

export const KELVIN_OFFSET = 273.15;

export const CONTROL_LIMITS = {
  surfaceTemperatureC: { min: 0, max: 40, step: 0.5 },
  surfaceHeatingRate: { min: 0, max: 0.025, step: 0.001 },
  heatingWidth: { min: 500, max: 8_000, step: 100 },
  heatingCenter: { min: 0, max: 10_000, step: 100 },
  lapseRate: { min: 0.003, max: 0.01, step: 0.0001 },
  boundaryLayerDepth: { min: 250, max: 3_000, step: 50 },
  relativeHumidity: { min: 0.3, max: 1, step: 0.01 },
  domainWidth: { min: 4_000, max: 20_000, step: 500 },
  domainHeight: { min: 1_500, max: 6_000, step: 250 },
  gridColumns: { min: 18, max: 72, step: 6 },
  gridRows: { min: 12, max: 48, step: 4 },
  duration: { min: 60, max: 3_600, step: 60 },
  timeStep: { min: 1, max: 6, step: 0.5 },
  frameInterval: { min: 2, max: 30, step: 1 },
  wind: { min: -5, max: 5, step: 0.25 },
  seed: { min: 1, max: 9999, step: 1 },
};

export type BoussinesqReferenceCase = {
  slug: string;
  name: string;
  description: string;
  apply: (config: SimulationConfig) => SimulationConfig;
};

export type BoussinesqModelSize = {
  slug: string;
  name: string;
  description: string;
  apply: (config: SimulationConfig) => SimulationConfig;
};

export const BOUSSINESQ_REFERENCE_CASES: BoussinesqReferenceCase[] = [
  {
    slug: "quiet-atmosphere",
    name: "Quiet atmosphere / no forcing",
    description: "Saturated, unforced slice for checking that motion and cloud water stay zero.",
    apply: (config) =>
      normalizeConfig({
        ...config,
        solver_type: "boussinesq_2d",
        initial_atmosphere: {
          surface_temperature_k: celsiusToKelvin(25),
          lapse_rate_k_per_m: 0.0065,
          relative_humidity: 1,
          boundary_layer_depth_m: 1_000,
        },
        surface_heating: {
          max_warming_rate_k_per_s: 0,
          patch_center_x_m: config.domain.width_m / 2,
          patch_width_m: 2_000,
        },
        background_wind: { u_m_per_s: 0, w_m_per_s: 0 },
        seed: 11,
      }),
  },
  {
    slug: "dry-thermal-bubble",
    name: "Dry thermal bubble",
    description: "Dry heated patch for buoyant circulation without cloud formation.",
    apply: (config) =>
      normalizeConfig({
        ...config,
        solver_type: "boussinesq_2d",
        initial_atmosphere: {
          surface_temperature_k: celsiusToKelvin(25),
          lapse_rate_k_per_m: 0.0075,
          relative_humidity: 0.45,
          boundary_layer_depth_m: 1_000,
        },
        surface_heating: {
          max_warming_rate_k_per_s: 0.016,
          patch_center_x_m: config.domain.width_m / 2,
          patch_width_m: 2_000,
        },
        background_wind: { u_m_per_s: 0, w_m_per_s: 0 },
        seed: 13,
      }),
  },
  {
    slug: "humid-lifted-thermal",
    name: "Humid lifted thermal",
    description: "Humid heated patch for checking uplift, cooling, and cloud water coupling.",
    apply: (config) =>
      normalizeConfig({
        ...config,
        solver_type: "boussinesq_2d",
        initial_atmosphere: {
          surface_temperature_k: celsiusToKelvin(25),
          lapse_rate_k_per_m: 0.0065,
          relative_humidity: 1,
          boundary_layer_depth_m: 1_000,
        },
        surface_heating: {
          max_warming_rate_k_per_s: 0.018,
          patch_center_x_m: config.domain.width_m / 2,
          patch_width_m: 2_000,
        },
        background_wind: { u_m_per_s: 0.15, w_m_per_s: 0 },
        seed: 17,
      }),
  },
  {
    slug: "stable-suppression",
    name: "Stable stratification suppression",
    description: "Stable profile for checking weaker vertical growth under stronger stability.",
    apply: (config) =>
      normalizeConfig({
        ...config,
        solver_type: "boussinesq_2d",
        initial_atmosphere: {
          surface_temperature_k: celsiusToKelvin(25),
          lapse_rate_k_per_m: 0.0035,
          relative_humidity: 0.95,
          boundary_layer_depth_m: 1_000,
        },
        surface_heating: {
          max_warming_rate_k_per_s: 0.016,
          patch_center_x_m: config.domain.width_m / 2,
          patch_width_m: 2_000,
        },
        background_wind: { u_m_per_s: 0.15, w_m_per_s: 0 },
        seed: 19,
      }),
  },
  {
    slug: "fair-weather-boussinesq",
    name: "Fair-weather Boussinesq baseline",
    description: "Baseline humid heated Boussinesq run for manual comparison.",
    apply: (config) =>
      normalizeConfig({
        ...config,
        solver_type: "boussinesq_2d",
        initial_atmosphere: {
          surface_temperature_k: celsiusToKelvin(25),
          lapse_rate_k_per_m: 0.0065,
          relative_humidity: 1,
          boundary_layer_depth_m: 1_000,
        },
        surface_heating: {
          max_warming_rate_k_per_s: 0.014,
          patch_center_x_m: config.domain.width_m / 2,
          patch_width_m: 2_000,
        },
        background_wind: { u_m_per_s: 0.25, w_m_per_s: 0 },
        seed: 23,
      }),
  },
];

export const BOUSSINESQ_MODEL_SIZES: BoussinesqModelSize[] = [
  {
    slug: "small",
    name: "Small / quick",
    description: "Fast interactive sanity checks on a lower-resolution grid.",
    apply: (config) =>
      normalizeConfig({
        ...config,
        domain: { width_m: 8_000, height_m: 3_000 },
        grid: { columns: 30, rows: 20 },
        time: { time_step_seconds: 2, duration_seconds: 600, frame_interval_seconds: 20 },
        surface_heating: {
          ...config.surface_heating,
          patch_center_x_m: 4_000,
          patch_width_m: Math.min(config.surface_heating.patch_width_m, 2_000),
        },
      }),
  },
  {
    slug: "medium",
    name: "Medium / standard",
    description: "Default manual validation scale for about 20 simulated minutes.",
    apply: (config) =>
      normalizeConfig({
        ...config,
        domain: { width_m: 10_000, height_m: 3_000 },
        grid: { columns: 36, rows: 24 },
        time: { time_step_seconds: 2, duration_seconds: 1_200, frame_interval_seconds: 30 },
        surface_heating: {
          ...config.surface_heating,
          patch_center_x_m: 5_000,
          patch_width_m: Math.min(config.surface_heating.patch_width_m, 2_000),
        },
      }),
  },
  {
    slug: "large",
    name: "Large / slow",
    description: "More detailed local inspection with a slower streamfunction solve.",
    apply: (config) =>
      normalizeConfig({
        ...config,
        domain: { width_m: 12_000, height_m: 4_000 },
        grid: { columns: 54, rows: 36 },
        time: { time_step_seconds: 2, duration_seconds: 1_800, frame_interval_seconds: 30 },
        surface_heating: {
          ...config.surface_heating,
          patch_center_x_m: 6_000,
          patch_width_m: Math.min(config.surface_heating.patch_width_m, 2_500),
        },
      }),
  },
];

export function cloneConfig(config: SimulationConfig): SimulationConfig {
  return structuredClone(config);
}

export function updateConfigNumber(
  config: SimulationConfig,
  path: string,
  value: number,
): SimulationConfig {
  const nextConfig = cloneConfig(config);
  const parts = path.split(".");
  let target: Record<string, unknown> = nextConfig as unknown as Record<string, unknown>;

  for (const part of parts.slice(0, -1)) {
    target = target[part] as Record<string, unknown>;
  }
  target[parts[parts.length - 1]] = value;

  return normalizeConfig(nextConfig);
}

export function normalizeConfig(config: SimulationConfig): SimulationConfig {
  const nextConfig = cloneConfig(config);
  nextConfig.initial_atmosphere.surface_temperature_k = clamp(
    nextConfig.initial_atmosphere.surface_temperature_k,
    celsiusToKelvin(CONTROL_LIMITS.surfaceTemperatureC.min),
    celsiusToKelvin(CONTROL_LIMITS.surfaceTemperatureC.max),
  );
  nextConfig.surface_heating.patch_center_x_m = clamp(
    nextConfig.surface_heating.patch_center_x_m,
    0,
    nextConfig.domain.width_m,
  );
  nextConfig.surface_heating.patch_width_m = clamp(
    nextConfig.surface_heating.patch_width_m,
    CONTROL_LIMITS.heatingWidth.min,
    nextConfig.domain.width_m,
  );
  nextConfig.initial_atmosphere.boundary_layer_depth_m = clamp(
    nextConfig.initial_atmosphere.boundary_layer_depth_m,
    CONTROL_LIMITS.boundaryLayerDepth.min,
    nextConfig.domain.height_m,
  );
  nextConfig.time.frame_interval_seconds = Math.max(
    nextConfig.time.time_step_seconds,
    nextConfig.time.frame_interval_seconds,
  );
  nextConfig.time.duration_seconds = Math.max(
    nextConfig.time.time_step_seconds,
    nextConfig.time.duration_seconds,
  );
  nextConfig.grid.columns = roundToStep(nextConfig.grid.columns, CONTROL_LIMITS.gridColumns.step);
  nextConfig.grid.rows = roundToStep(nextConfig.grid.rows, CONTROL_LIMITS.gridRows.step);
  nextConfig.seed = Math.max(1, Math.round(nextConfig.seed));
  return nextConfig;
}

export function configWarnings(config: SimulationConfig): string[] {
  const warnings: string[] = [];
  const cellDx = config.domain.width_m / config.grid.columns;
  const cellDz = config.domain.height_m / config.grid.rows;
  const maxWind = Math.max(
    Math.abs(config.background_wind.u_m_per_s),
    Math.abs(config.background_wind.w_m_per_s),
    1,
  );
  const courant = (maxWind * config.time.time_step_seconds) / Math.min(cellDx, cellDz);

  if (courant > 0.35) {
    warnings.push("Large timestep relative to grid spacing and wind may reduce stability.");
  }
  if (config.surface_heating.max_warming_rate_k_per_s > 0.018) {
    warnings.push("Very strong heating can create abrupt thermals in the selected solver.");
  }
  if (config.solver_type === "boussinesq_2d" && config.grid.columns * config.grid.rows > 1_800) {
    warnings.push("Boussinesq runs use an iterative streamfunction solve and may slow down on larger grids.");
  }
  if (config.initial_atmosphere.relative_humidity < 0.65) {
    warnings.push("Low humidity may produce little or no cloud liquid water.");
  }
  if (kelvinToCelsius(config.initial_atmosphere.surface_temperature_k) < 10) {
    warnings.push("Cool initial surface temperatures may delay or suppress cloud formation.");
  }
  if (config.grid.columns * config.grid.rows > 2_500) {
    warnings.push("High grid resolution may make local streaming and canvas rendering slower.");
  }
  if (config.time.duration_seconds / config.time.frame_interval_seconds > 500) {
    warnings.push("Long runs with short frame cadence may accumulate many browser frames.");
  }
  if (config.surface_heating.patch_width_m < cellDx * 2) {
    warnings.push("Heating patch is narrower than two grid cells and may be hard to resolve.");
  }

  return warnings;
}

export function kelvinToCelsius(valueKelvin: number): number {
  return valueKelvin - KELVIN_OFFSET;
}

export function celsiusToKelvin(valueCelsius: number): number {
  return valueCelsius + KELVIN_OFFSET;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundToStep(value: number, step: number): number {
  return Math.max(step, Math.round(value / step) * step);
}

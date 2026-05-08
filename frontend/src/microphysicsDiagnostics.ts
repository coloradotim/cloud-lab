import type { MicrophysicsPayload, SimulationConfig, SimulationFrame } from "./simulationTypes";

export type MicrophysicsSummary = {
  initialTemperatureK: number;
  finalTemperatureK: number;
  initialWaterVaporKgPerKg: number;
  finalWaterVaporKgPerKg: number;
  finalCloudLiquidWaterKgPerKg: number;
  finalRainWaterKgPerKg: number;
  finalParcelHeightM: number;
  prescribedVerticalVelocityMPerS: number;
  firstCloudWaterTimeSeconds: number | null;
  maxCloudLiquidWaterKgPerKg: number;
  maxCloudLiquidWaterTimeSeconds: number | null;
  firstRainWaterTimeSeconds: number | null;
  maxRainWaterKgPerKg: number;
  maxRainWaterTimeSeconds: number | null;
  maxRelativeHumidityPercent: number;
  initialTotalWaterKgPerKg: number;
  finalTotalWaterKgPerKg: number;
  maxAbsoluteTotalWaterDriftKgPerKg: number;
  totalWaterDriftIsConcerning: boolean;
  interpretations: string[];
};

export type DropletHistogram = {
  axisName: string;
  unit: string;
  product: string;
  productUnit: string;
  normalization: string;
  bars: Array<{
    label: string;
    value: number;
  }>;
};

const WATER_FIELD_KEYS = {
  vapor: "water_vapor_kg_per_kg",
  cloud: "cloud_liquid_water_kg_per_kg",
  rain: "rain_water_kg_per_kg",
} as const;

const CLOUD_THRESHOLD_KG_PER_KG = 1e-10;
const RAIN_THRESHOLD_KG_PER_KG = 1e-10;

export function summarizeMicrophysicsFrames(
  frames: SimulationFrame[],
  config: SimulationConfig,
): MicrophysicsSummary | null {
  if (frames.length === 0) {
    return null;
  }

  const initialFrame = frames[0];
  const finalFrame = frames[frames.length - 1];
  const initialTotalWater = totalWaterForFrame(initialFrame);
  const finalTotalWater = totalWaterForFrame(finalFrame);
  let maxAbsoluteTotalWaterDrift = 0;
  let firstCloudWaterTimeSeconds: number | null = null;
  let maxCloudLiquidWater = 0;
  let maxCloudLiquidWaterTimeSeconds: number | null = null;
  let firstRainWaterTimeSeconds: number | null = null;
  let maxRainWater = 0;
  let maxRainWaterTimeSeconds: number | null = null;
  let maxRelativeHumidityPercent = 0;

  for (const frame of frames) {
    const cloud = representativeFieldValue(frame, WATER_FIELD_KEYS.cloud);
    const rain = representativeFieldValue(frame, WATER_FIELD_KEYS.rain);
    const totalWaterDrift = Math.abs(totalWaterForFrame(frame) - initialTotalWater);
    maxAbsoluteTotalWaterDrift = Math.max(maxAbsoluteTotalWaterDrift, totalWaterDrift);

    if (firstCloudWaterTimeSeconds === null && cloud > CLOUD_THRESHOLD_KG_PER_KG) {
      firstCloudWaterTimeSeconds = frame.time_seconds;
    }
    if (cloud > maxCloudLiquidWater) {
      maxCloudLiquidWater = cloud;
      maxCloudLiquidWaterTimeSeconds = frame.time_seconds;
    }

    if (firstRainWaterTimeSeconds === null && rain > RAIN_THRESHOLD_KG_PER_KG) {
      firstRainWaterTimeSeconds = frame.time_seconds;
    }
    if (rain > maxRainWater) {
      maxRainWater = rain;
      maxRainWaterTimeSeconds = frame.time_seconds;
    }

    maxRelativeHumidityPercent = Math.max(maxRelativeHumidityPercent, relativeHumidityPercent(frame));
  }

  const driftTolerance = Math.max(1e-9, Math.abs(initialTotalWater) * 1e-3);
  const totalWaterDriftIsConcerning = maxAbsoluteTotalWaterDrift > driftTolerance;

  return {
    initialTemperatureK: representativeFieldValue(initialFrame, "temperature_k"),
    finalTemperatureK: representativeFieldValue(finalFrame, "temperature_k"),
    initialWaterVaporKgPerKg: representativeFieldValue(initialFrame, WATER_FIELD_KEYS.vapor),
    finalWaterVaporKgPerKg: representativeFieldValue(finalFrame, WATER_FIELD_KEYS.vapor),
    finalCloudLiquidWaterKgPerKg: representativeFieldValue(finalFrame, WATER_FIELD_KEYS.cloud),
    finalRainWaterKgPerKg: representativeFieldValue(finalFrame, WATER_FIELD_KEYS.rain),
    finalParcelHeightM: Math.max(
      0,
      finalFrame.time_seconds * config.background_wind.w_m_per_s,
    ),
    prescribedVerticalVelocityMPerS: config.background_wind.w_m_per_s,
    firstCloudWaterTimeSeconds,
    maxCloudLiquidWaterKgPerKg: maxCloudLiquidWater,
    maxCloudLiquidWaterTimeSeconds,
    firstRainWaterTimeSeconds,
    maxRainWaterKgPerKg: maxRainWater,
    maxRainWaterTimeSeconds,
    maxRelativeHumidityPercent,
    initialTotalWaterKgPerKg: initialTotalWater,
    finalTotalWaterKgPerKg: finalTotalWater,
    maxAbsoluteTotalWaterDriftKgPerKg: maxAbsoluteTotalWaterDrift,
    totalWaterDriftIsConcerning,
    interpretations: interpretationsForRun(
      firstCloudWaterTimeSeconds,
      firstRainWaterTimeSeconds,
      totalWaterDriftIsConcerning,
    ),
  };
}

export function dropletHistogramFromPayload(
  payload: MicrophysicsPayload | null | undefined,
): DropletHistogram | null {
  const edgeValues = payload?.bin_axis?.edge_values;
  const product = chooseDistributionProduct(payload);
  if (!edgeValues || edgeValues.length < 2 || !product?.values?.length) {
    return null;
  }

  const binCount = Math.min(edgeValues.length - 1, product.values.length);
  const unit = payload?.bin_axis?.unit ?? "um";

  return {
    axisName: payload?.bin_axis?.name ?? "particle_radius",
    unit,
    product: product.product ?? "distribution",
    productUnit: product.unit ?? "unitless",
    normalization: product.normalization ?? "per_bin",
    bars: Array.from({ length: binCount }, (_item, index) => ({
      label: `${formatNumber(edgeValues[index])}-${formatNumber(edgeValues[index + 1])} ${unit}`,
      value: product.values?.[index] ?? 0,
    })),
  };
}

function chooseDistributionProduct(payload: MicrophysicsPayload | null | undefined) {
  const products = payload?.global_distribution?.products ?? [];
  return (
    products.find((product) => product.product === "liquid_water_mixing_ratio") ??
    products.find((product) => product.product === "number_concentration") ??
    products[0]
  );
}

function interpretationsForRun(
  firstCloudWaterTimeSeconds: number | null,
  firstRainWaterTimeSeconds: number | null,
  totalWaterDriftIsConcerning: boolean,
): string[] {
  const interpretations = [
    "This is a bulk saturation-adjustment lab, not droplet-resolved microphysics.",
    "The current parcel/box state is broadcast across the grid, so probe values are spatially uniform.",
  ];

  if (firstCloudWaterTimeSeconds === null) {
    interpretations.unshift("No condensation occurred because the parcel did not reach saturation.");
  } else {
    interpretations.unshift(
      "Parcel lifted and cooled until saturation; excess vapor converted to cloud liquid water.",
    );
  }

  if (firstRainWaterTimeSeconds !== null) {
    interpretations.push(
      "Cloud water exceeded the simple autoconversion threshold and produced rain water.",
    );
  }

  if (totalWaterDriftIsConcerning) {
    interpretations.push("Total water changed enough to inspect the budget before trusting the run.");
  }

  return interpretations;
}

function totalWaterForFrame(frame: SimulationFrame): number {
  return (
    representativeFieldValue(frame, WATER_FIELD_KEYS.vapor) +
    representativeFieldValue(frame, WATER_FIELD_KEYS.cloud) +
    representativeFieldValue(frame, WATER_FIELD_KEYS.rain)
  );
}

function relativeHumidityPercent(frame: SimulationFrame): number {
  const temperatureK = representativeFieldValue(frame, "temperature_k");
  const vapor = representativeFieldValue(frame, WATER_FIELD_KEYS.vapor);
  const saturation = saturationSpecificHumidityKgPerKg(temperatureK);

  if (saturation <= 0) {
    return 0;
  }

  return (vapor / saturation) * 100;
}

function representativeFieldValue(frame: SimulationFrame, fieldKey: string): number {
  const field = frame.fields[fieldKey];
  if (!field) {
    return 0;
  }

  let sum = 0;
  let count = 0;
  for (const row of field.values) {
    for (const value of row) {
      sum += value;
      count += 1;
    }
  }

  return count > 0 ? sum / count : 0;
}

function saturationSpecificHumidityKgPerKg(temperatureK: number): number {
  const temperatureC = temperatureK - 273.15;
  const saturationVaporPressureHpa = 6.112 * Math.exp(
    (17.67 * temperatureC) / (temperatureC + 243.5),
  );
  const saturationVaporPressurePa = saturationVaporPressureHpa * 100;
  const pressurePa = 101_325;
  return (
    (0.622 * saturationVaporPressurePa) / (pressurePa - 0.378 * saturationVaporPressurePa)
  );
}

function formatNumber(value: number): string {
  if (Math.abs(value) >= 100 || Math.abs(value) < 0.01) {
    return value.toExponential(1);
  }

  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2);
}

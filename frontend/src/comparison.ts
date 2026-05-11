import type { ScenarioObservation } from "./scenarioDiagnostics";
import type { SavedRunArtifact } from "./savedRuns";
import type { ScalarField, SimulationConfig, SimulationFrame } from "./simulationTypes";
import {
  displayValueForField,
  scalingMetadataForField,
  sharedDisplayRangeForField,
} from "./visualization";
import type { FieldStats } from "./visualization";

export type ComparisonDiagnostics = {
  firstCloudTimeSeconds: number | null;
  maxCloudLiquidWaterKgPerKg: number | null;
  cloudTopHeightM: number | null;
  firstRainTimeSeconds: number | null;
  maxRainWaterKgPerKg: number | null;
  maxUpdraftMPerS: number | null;
  estimatedLclM: number | null;
};

export type DiagnosticComparisonRow = {
  key: keyof ComparisonDiagnostics;
  label: string;
  unit: string;
  left: number | null;
  right: number | null;
  delta: number | null;
};

export function alignConfigForComparison(
  config: SimulationConfig,
  reference: SimulationConfig,
): SimulationConfig {
  return {
    ...config,
    domain: { ...reference.domain },
    grid: { ...reference.grid },
    time: { ...reference.time },
  };
}

export function frameAtOrBeforeTime(
  frames: SimulationFrame[],
  timeSeconds: number,
): SimulationFrame | null {
  if (frames.length === 0) {
    return null;
  }

  let selected = frames[0];
  for (const frame of frames) {
    if (frame.time_seconds > timeSeconds) {
      break;
    }
    selected = frame;
  }
  return selected;
}

export function comparisonTimeLimit(leftFrames: SimulationFrame[], rightFrames: SimulationFrame[]) {
  const leftFinal = leftFrames[leftFrames.length - 1]?.time_seconds ?? 0;
  const rightFinal = rightFrames[rightFrames.length - 1]?.time_seconds ?? 0;
  if (leftFinal === 0) {
    return rightFinal;
  }
  if (rightFinal === 0) {
    return leftFinal;
  }
  return Math.min(leftFinal, rightFinal);
}

export function sharedRangeForComparisonFrames(
  fieldKey: string,
  frames: Array<SimulationFrame | null>,
): FieldStats {
  const fields = frames
    .map((frame) => frame?.fields[fieldKey])
    .filter((field): field is ScalarField => field !== undefined);
  return sharedDisplayRangeForField(fieldKey, fields);
}

export function normalizedValueForSharedRange(
  fieldKey: string,
  field: ScalarField,
  value: number,
  range: FieldStats,
): number {
  const scaling = scalingMetadataForField(fieldKey, field);
  if (scaling.scale === "log") {
    const threshold = scaling.noiseThreshold ?? 1e-12;
    const max = Math.max(range.max, threshold * 10);
    if (value <= threshold) {
      return 0;
    }
    return clamp01(Math.log10(value / threshold) / Math.log10(max / threshold));
  }

  const displayValue = displayValueForField(field, value);
  if (Math.abs(range.max - range.min) < Number.EPSILON) {
    return 0.5;
  }
  return clamp01((displayValue - range.min) / (range.max - range.min));
}

export function observationsToComparisonDiagnostics(
  observations: ScenarioObservation | null,
): ComparisonDiagnostics {
  return {
    firstCloudTimeSeconds: observations?.firstCloudTimeSeconds ?? null,
    maxCloudLiquidWaterKgPerKg: observations?.maxCloudLiquidWaterKgPerKg ?? null,
    cloudTopHeightM: observations?.maxCloudTopM ?? null,
    firstRainTimeSeconds: observations?.firstRainTimeSeconds ?? null,
    maxRainWaterKgPerKg: observations?.maxRainWaterKgPerKg ?? null,
    maxUpdraftMPerS: observations?.maxUpdraftMPerS ?? null,
    estimatedLclM: observations?.estimatedLclM ?? null,
  };
}

export function savedRunToComparisonDiagnostics(
  artifact: SavedRunArtifact,
): ComparisonDiagnostics {
  return {
    firstCloudTimeSeconds: artifact.diagnostics.first_cloud_time_seconds,
    maxCloudLiquidWaterKgPerKg: artifact.diagnostics.max_cloud_liquid_water_kg_per_kg,
    cloudTopHeightM: artifact.diagnostics.cloud_top_height_m,
    firstRainTimeSeconds: artifact.diagnostics.first_rain_time_seconds,
    maxRainWaterKgPerKg: artifact.diagnostics.max_rain_water_kg_per_kg,
    maxUpdraftMPerS: artifact.diagnostics.max_updraft_m_per_s,
    estimatedLclM: artifact.diagnostics.estimated_lcl_m,
  };
}

export function diagnosticComparisonRows(
  left: ComparisonDiagnostics,
  right: ComparisonDiagnostics,
): DiagnosticComparisonRow[] {
  return [
    row("firstCloudTimeSeconds", "First cloud", "s", left, right),
    row("maxCloudLiquidWaterKgPerKg", "Max cloud water", "kg kg-1", left, right),
    row("cloudTopHeightM", "Cloud top", "m", left, right),
    row("firstRainTimeSeconds", "First rain", "s", left, right),
    row("maxRainWaterKgPerKg", "Max rain water", "kg kg-1", left, right),
    row("maxUpdraftMPerS", "Max updraft", "m/s", left, right),
    row("estimatedLclM", "Estimated LCL", "m", left, right),
  ];
}

function row(
  key: keyof ComparisonDiagnostics,
  label: string,
  unit: string,
  left: ComparisonDiagnostics,
  right: ComparisonDiagnostics,
): DiagnosticComparisonRow {
  const leftValue = left[key];
  const rightValue = right[key];
  return {
    key,
    label,
    unit,
    left: leftValue,
    right: rightValue,
    delta: leftValue === null || rightValue === null ? null : rightValue - leftValue,
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

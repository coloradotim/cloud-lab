import { summarizeMicrophysicsFrames } from "./microphysicsDiagnostics";
import type { BuiltInScenario } from "./simulationControls";
import type { SimulationConfig, SimulationFrame } from "./simulationTypes";

export type ScenarioStatus =
  | "plausible"
  | "warning"
  | "failed_expectation"
  | "not_evaluated";

export type ScenarioObservation = {
  frameCount: number;
  finalTimeSeconds: number;
  maxCloudLiquidWaterKgPerKg: number;
  maxCloudWaterTimeSeconds: number | null;
  firstCloudTimeSeconds: number | null;
  firstCloudBaseM: number | null;
  maxCloudTopM: number | null;
  maxCloudRegionCount: number;
  maxRainWaterKgPerKg: number;
  firstRainTimeSeconds: number | null;
  maxUpdraftMPerS: number;
  immediateSurfaceCloud: boolean;
  boundaryCloudFraction: number;
  returnFlowCloudFraction: number;
  topBoundaryCloudFraction: number;
  lateralBoundaryCloudFraction: number;
  boundaryConnectedCloudRegionFraction: number;
  belowLclCloudFraction: number | null;
  estimatedLclM: number | null;
  microphysicsTotalWaterDriftConcerning: boolean;
  microphysicsVaporDecreaseKgPerKg: number | null;
};

export type ScenarioDiagnostics = {
  expected: string;
  observed: string;
  status: ScenarioStatus;
  statusLabel: string;
  notes: string[];
  observations: ScenarioObservation | null;
};

const CLOUD_THRESHOLD_KG_PER_KG = 1e-8;
const MEANINGFUL_CLOUD_THRESHOLD_KG_PER_KG = 1e-7;
const SIGNIFICANT_CLOUD_THRESHOLD_KG_PER_KG = 1e-6;
const RAIN_THRESHOLD_KG_PER_KG = 1e-8;
const MOTION_THRESHOLD_M_PER_S = 0.03;
const BOUNDARY_DOMINATED_FRACTION = 0.45;
const BOUNDARY_WARNING_FRACTION = 0.1;
const RETURN_FLOW_WARNING_FRACTION = 0.1;
const TOP_BOUNDARY_WARNING_FRACTION = 0.02;
const LATERAL_BOUNDARY_WARNING_FRACTION = 0.05;
const BELOW_LCL_WARNING_FRACTION = 0.05;
const BELOW_LCL_FAILURE_FRACTION = 0.2;

export function evaluateScenarioRun({
  scenario,
  config,
  frames,
}: {
  scenario: BuiltInScenario | null | undefined;
  config: SimulationConfig | null;
  frames: SimulationFrame[];
}): ScenarioDiagnostics {
  if (!scenario) {
    return notEvaluated("No built-in scenario is selected.");
  }
  if (!config) {
    return notEvaluated("No simulation configuration is loaded.", scenario);
  }
  if (frames.length === 0) {
    return notEvaluated("No frames have been received for this run.", scenario);
  }

  const observations = observeRun(frames, config);
  const expected = expectedText(scenario);
  const observed = observedText(observations);
  const result = evaluateScenarioStatus(scenario, config, observations);

  return {
    expected,
    observed,
    status: result.status,
    statusLabel: statusLabel(result.status),
    notes: result.notes,
    observations,
  };
}

function evaluateScenarioStatus(
  scenario: BuiltInScenario,
  config: SimulationConfig,
  observations: ScenarioObservation,
): { status: ScenarioStatus; notes: string[] } {
  const base = evaluateScenarioContract(scenario, config, observations);
  const artifactNotes = artifactPolicyNotes(observations);
  if (artifactNotes.length === 0) {
    return base;
  }
  if (
    observations.belowLclCloudFraction !== null &&
    observations.belowLclCloudFraction >= BELOW_LCL_FAILURE_FRACTION
  ) {
    return {
      status: "failed_expectation",
      notes: [...base.notes, ...artifactNotes],
    };
  }
  return {
    status: base.status === "plausible" ? "warning" : base.status,
    notes: [...base.notes, ...artifactNotes],
  };
}

function evaluateScenarioContract(
  scenario: BuiltInScenario,
  config: SimulationConfig,
  observations: ScenarioObservation,
): { status: ScenarioStatus; notes: string[] } {
  switch (scenario.slug) {
    case "fair-weather-moderate-base":
      return evaluateFairWeather(config, observations);
    case "multi-thermal-cumulus-field":
      return evaluateMultiThermal(observations);
    case "dry-failed-cumulus":
      return evaluateDryFailed(observations);
    case "humid-low-cloud-boundary-layer":
      return evaluateHumidLowCloud(observations);
    case "dry-cap-suppressed-cumulus":
      return evaluateDryCap(config, observations);
    case "microphysics-lifted-humid-parcel":
      return evaluateLiftedMicrophysics(observations);
    case "microphysics-no-lift-control":
      return evaluateNoLiftMicrophysics(observations);
    default:
      return {
        status: "not_evaluated",
        notes: ["This scenario has no deterministic diagnostic rule yet."],
      };
  }
}

export function artifactPolicyNotes(observations: ScenarioObservation): string[] {
  const notes: string[] = [];
  if (
    observations.belowLclCloudFraction !== null &&
    observations.belowLclCloudFraction >= BELOW_LCL_FAILURE_FRACTION
  ) {
    notes.push("A large fraction of cloud water is below the estimated LCL.");
  } else if (
    observations.belowLclCloudFraction !== null &&
    observations.belowLclCloudFraction >= BELOW_LCL_WARNING_FRACTION
  ) {
    notes.push("Some cloud water is below the estimated LCL.");
  }
  if (observations.returnFlowCloudFraction >= RETURN_FLOW_WARNING_FRACTION) {
    notes.push(
      "Some cloud water appears in low-level return-flow regions; treat this as a prototype circulation-artifact warning.",
    );
  }
  if (observations.boundaryCloudFraction >= BOUNDARY_WARNING_FRACTION) {
    notes.push(
      "A significant fraction of cloud water touches model boundaries; interpret cloud shape and timing cautiously.",
    );
  }
  if (observations.topBoundaryCloudFraction >= TOP_BOUNDARY_WARNING_FRACTION) {
    notes.push("Cloud water reaches the top sponge region; inspect lid effects.");
  }
  if (observations.lateralBoundaryCloudFraction >= LATERAL_BOUNDARY_WARNING_FRACTION) {
    notes.push("Cloud water touches lateral boundaries; inspect side-boundary effects.");
  }
  if (observations.boundaryConnectedCloudRegionFraction > 0) {
    notes.push(
      "One or more cloud regions touch model boundaries; interpret this as scenario-specific artifact context.",
    );
  }
  return [...new Set(notes)];
}

function evaluateFairWeather(
  config: SimulationConfig,
  observations: ScenarioObservation,
): { status: ScenarioStatus; notes: string[] } {
  const notes: string[] = [];
  if (observations.maxCloudLiquidWaterKgPerKg <= CLOUD_THRESHOLD_KG_PER_KG) {
    return {
      status: "failed_expectation",
      notes: ["Fair-weather cumulus should produce cloud by its configured runtime."],
    };
  }
  if (observations.immediateSurfaceCloud || observations.firstCloudTimeSeconds === 0) {
    notes.push("Cloud appeared immediately at or near the surface, which is not classic fair-weather cumulus.");
  }
  if (observations.boundaryCloudFraction > BOUNDARY_DOMINATED_FRACTION) {
    notes.push("Cloud water is dominated by boundary cells; inspect sponge/boundary effects.");
  }
  if (observations.maxCloudLiquidWaterKgPerKg < MEANINGFUL_CLOUD_THRESHOLD_KG_PER_KG) {
    notes.push("Cloud water is present but remains near the display/noise threshold.");
  }
  if (
    observations.belowLclCloudFraction !== null &&
    observations.belowLclCloudFraction > 0.35
  ) {
    notes.push("A large fraction of condensate is below the estimated LCL.");
  }
  if (
    observations.firstCloudTimeSeconds !== null &&
    observations.firstCloudTimeSeconds < Math.min(120, config.time.duration_seconds * 0.1)
  ) {
    notes.push("Cloud onset is very early for the configured fair-weather runtime.");
  }

  return {
    status: notes.length > 0 ? "warning" : "plausible",
    notes: notes.length > 0 ? notes : ["Delayed, non-surface cloud appears within the configured run."],
  };
}

function evaluateMultiThermal(
  observations: ScenarioObservation,
): { status: ScenarioStatus; notes: string[] } {
  if (observations.maxUpdraftMPerS <= MOTION_THRESHOLD_M_PER_S) {
    return {
      status: "failed_expectation",
      notes: ["The multi-thermal setup should create multiple buoyant responses."],
    };
  }
  if (observations.maxCloudLiquidWaterKgPerKg <= CLOUD_THRESHOLD_KG_PER_KG) {
    return {
      status: "warning",
      notes: ["Thermal motion occurred, but no cloud formed during the observed frames."],
    };
  }
  if (observations.maxCloudRegionCount < 2) {
    return {
      status: "warning",
      notes: ["Cloud formed, but distinct cloud regions were not detected in the observed frames."],
    };
  }

  return {
    status: "plausible",
    notes: ["Multiple cloud regions were detected for at least part of the run."],
  };
}

function evaluateDryFailed(
  observations: ScenarioObservation,
): { status: ScenarioStatus; notes: string[] } {
  const notes: string[] = [];
  if (observations.maxUpdraftMPerS <= MOTION_THRESHOLD_M_PER_S) {
    notes.push("Dry failed cumulus should still produce a detectable updraft response.");
  }
  if (observations.maxCloudLiquidWaterKgPerKg > SIGNIFICANT_CLOUD_THRESHOLD_KG_PER_KG) {
    return {
      status: "failed_expectation",
      notes: ["The dry failed-cumulus case produced significant cloud water."],
    };
  }
  if (observations.maxCloudLiquidWaterKgPerKg > CLOUD_THRESHOLD_KG_PER_KG) {
    notes.push("Only trace cloud water should appear in the dry failed-cumulus control.");
  }

  return {
    status: notes.length > 0 ? "warning" : "plausible",
    notes: notes.length > 0 ? notes : ["Motion occurs while cloud water stays negligible."],
  };
}

function evaluateHumidLowCloud(
  observations: ScenarioObservation,
): { status: ScenarioStatus; notes: string[] } {
  if (observations.estimatedLclM !== null && observations.estimatedLclM > 500) {
    return {
      status: "warning",
      notes: ["The configured LCL is not especially low for the low-cloud scenario label."],
    };
  }
  if (observations.maxCloudLiquidWaterKgPerKg <= CLOUD_THRESHOLD_KG_PER_KG) {
    return {
      status: "warning",
      notes: ["Near-saturated low-cloud setup has not produced cloud in the observed frames yet."],
    };
  }

  return {
    status: "plausible",
    notes: ["Low cloud is expected here and is not evaluated as classic fair-weather cumulus."],
  };
}

function evaluateDryCap(
  config: SimulationConfig,
  observations: ScenarioObservation,
): { status: ScenarioStatus; notes: string[] } {
  if (observations.maxCloudLiquidWaterKgPerKg <= CLOUD_THRESHOLD_KG_PER_KG) {
    return {
      status: "plausible",
      notes: ["Cloud is suppressed in the observed frames."],
    };
  }
  const cloudTop = observations.maxCloudTopM ?? 0;
  if (cloudTop > config.initial_atmosphere.boundary_layer_depth_m * 1.8) {
    return {
      status: "warning",
      notes: ["Cloud penetrated well above the nominal cap; compare against a no-cap control."],
    };
  }

  return {
    status: "plausible",
    notes: ["Cloud growth appears limited relative to the configured cap depth."],
  };
}

function evaluateLiftedMicrophysics(
  observations: ScenarioObservation,
): { status: ScenarioStatus; notes: string[] } {
  const notes: string[] = [];
  if (observations.maxCloudLiquidWaterKgPerKg <= CLOUD_THRESHOLD_KG_PER_KG) {
    return {
      status: "failed_expectation",
      notes: ["The lifted humid parcel should cool to saturation and condense."],
    };
  }
  if ((observations.microphysicsVaporDecreaseKgPerKg ?? 0) <= 0) {
    notes.push("Water vapor did not decrease after cloud formation.");
  }
  if (observations.microphysicsTotalWaterDriftConcerning) {
    notes.push("Total water drift is large enough to inspect the budget.");
  }

  return {
    status: notes.length > 0 ? "warning" : "plausible",
    notes: notes.length > 0 ? notes : ["Lifted parcel condensed with a sane water budget."],
  };
}

function evaluateNoLiftMicrophysics(
  observations: ScenarioObservation,
): { status: ScenarioStatus; notes: string[] } {
  const notes: string[] = [];
  if (observations.maxCloudLiquidWaterKgPerKg > CLOUD_THRESHOLD_KG_PER_KG) {
    notes.push("No-lift microphysics control produced cloud water.");
  }
  if (observations.maxRainWaterKgPerKg > RAIN_THRESHOLD_KG_PER_KG) {
    notes.push("No-lift microphysics control produced rain water.");
  }
  if (observations.microphysicsTotalWaterDriftConcerning) {
    notes.push("Total water drift is large enough to inspect the budget.");
  }

  return {
    status: notes.length > 0 ? "failed_expectation" : "plausible",
    notes: notes.length > 0 ? notes : ["No cloud, no rain, and water budget remains stable."],
  };
}

function observeRun(frames: SimulationFrame[], config: SimulationConfig): ScenarioObservation {
  const lcl = approximateLclHeightM(
    config.initial_atmosphere.surface_temperature_k,
    config.initial_atmosphere.relative_humidity,
  );
  let maxCloud = 0;
  let maxCloudTime: number | null = null;
  let firstCloudTime: number | null = null;
  let firstCloudBase: number | null = null;
  let maxCloudTop: number | null = null;
  let maxRegionCount = 0;
  let maxRain = 0;
  let firstRainTime: number | null = null;
  let maxUpdraft = 0;
  let totalCloudMass = 0;
  let boundaryCloudMass = 0;
  let returnFlowCloudMass = 0;
  let topBoundaryCloudMass = 0;
  let lateralBoundaryCloudMass = 0;
  let belowLclCloudMass = 0;
  let maxBoundaryConnectedRegionFraction = 0;

  for (const frame of frames) {
    const cloud = frame.fields.cloud_liquid_water_kg_per_kg?.values ?? [];
    const rain = frame.fields.rain_water_kg_per_kg?.values ?? [];
    const verticalVelocity = frame.fields.vertical_velocity_m_per_s?.values ?? [];
    const cloudStats = cloudFrameStats(
      cloud,
      verticalVelocity,
      frame.grid.z_coordinates_m,
      lcl,
      config.initial_atmosphere.boundary_layer_depth_m,
    );

    if (cloudStats.maxValue > maxCloud) {
      maxCloud = cloudStats.maxValue;
      maxCloudTime = frame.time_seconds;
    }
    if (firstCloudTime === null && cloudStats.maxValue > CLOUD_THRESHOLD_KG_PER_KG) {
      firstCloudTime = frame.time_seconds;
      firstCloudBase = cloudStats.cloudBaseM;
    }
    if (cloudStats.cloudTopM !== null) {
      maxCloudTop = Math.max(maxCloudTop ?? cloudStats.cloudTopM, cloudStats.cloudTopM);
    }
    maxRegionCount = Math.max(maxRegionCount, cloudRegionCount(cloud));
    maxBoundaryConnectedRegionFraction = Math.max(
      maxBoundaryConnectedRegionFraction,
      cloudRegionBoundaryTouchFraction(cloud),
    );
    totalCloudMass += cloudStats.totalMass;
    boundaryCloudMass += cloudStats.boundaryMass;
    returnFlowCloudMass += cloudStats.returnFlowMass;
    topBoundaryCloudMass += cloudStats.topBoundaryMass;
    lateralBoundaryCloudMass += cloudStats.lateralBoundaryMass;
    belowLclCloudMass += cloudStats.belowLclMass;

    const rainMax = maxFieldValue(rain);
    if (firstRainTime === null && rainMax > RAIN_THRESHOLD_KG_PER_KG) {
      firstRainTime = frame.time_seconds;
    }
    maxRain = Math.max(maxRain, rainMax);
    maxUpdraft = Math.max(maxUpdraft, maxFieldValue(verticalVelocity));
  }

  const microphysics = config.solver_type === "microphysics_lab"
    ? summarizeMicrophysicsFrames(frames, config)
    : null;

  return {
    frameCount: frames.length,
    finalTimeSeconds: frames[frames.length - 1]?.time_seconds ?? 0,
    maxCloudLiquidWaterKgPerKg: microphysics?.maxCloudLiquidWaterKgPerKg ?? maxCloud,
    maxCloudWaterTimeSeconds: microphysics?.maxCloudLiquidWaterTimeSeconds ?? maxCloudTime,
    firstCloudTimeSeconds: microphysics?.firstCloudWaterTimeSeconds ?? firstCloudTime,
    firstCloudBaseM: firstCloudBase,
    maxCloudTopM: maxCloudTop,
    maxCloudRegionCount: maxRegionCount,
    maxRainWaterKgPerKg: microphysics?.maxRainWaterKgPerKg ?? maxRain,
    firstRainTimeSeconds: microphysics?.firstRainWaterTimeSeconds ?? firstRainTime,
    maxUpdraftMPerS: maxUpdraft,
    immediateSurfaceCloud: hasImmediateSurfaceCloud(frames[0]),
    boundaryCloudFraction: totalCloudMass > 0 ? boundaryCloudMass / totalCloudMass : 0,
    returnFlowCloudFraction: totalCloudMass > 0 ? returnFlowCloudMass / totalCloudMass : 0,
    topBoundaryCloudFraction: totalCloudMass > 0 ? topBoundaryCloudMass / totalCloudMass : 0,
    lateralBoundaryCloudFraction:
      totalCloudMass > 0 ? lateralBoundaryCloudMass / totalCloudMass : 0,
    boundaryConnectedCloudRegionFraction: maxBoundaryConnectedRegionFraction,
    belowLclCloudFraction:
      lcl === null || totalCloudMass <= 0 ? null : belowLclCloudMass / totalCloudMass,
    estimatedLclM: lcl,
    microphysicsTotalWaterDriftConcerning:
      microphysics?.totalWaterDriftIsConcerning ?? false,
    microphysicsVaporDecreaseKgPerKg: microphysics
      ? microphysics.initialWaterVaporKgPerKg - microphysics.finalWaterVaporKgPerKg
      : null,
  };
}

function cloudFrameStats(
  values: number[][],
  verticalVelocity: number[][],
  heights: number[],
  lcl: number | null,
  boundaryLayerDepthM: number,
) {
  let maxValue = 0;
  let totalMass = 0;
  let boundaryMass = 0;
  let returnFlowMass = 0;
  let topBoundaryMass = 0;
  let lateralBoundaryMass = 0;
  let belowLclMass = 0;
  let cloudBaseM: number | null = null;
  let cloudTopM: number | null = null;
  const topStartRow = Math.max(0, values.length - 2);

  for (let rowIndex = 0; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex];
    const lastColumn = row.length - 1;
    const height = heights[rowIndex] ?? rowIndex;
    for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
      const value = Math.max(0, row[columnIndex] ?? 0);
      maxValue = Math.max(maxValue, value);
      if (value <= CLOUD_THRESHOLD_KG_PER_KG) {
        continue;
      }
      totalMass += value;
      const touchesTop = rowIndex >= topStartRow;
      const touchesLower = rowIndex === 0;
      const touchesLateral = columnIndex === 0 || columnIndex === lastColumn;
      if (touchesTop || touchesLower || touchesLateral) {
        boundaryMass += value;
      }
      if (touchesTop) {
        topBoundaryMass += value;
      }
      if (touchesLateral) {
        lateralBoundaryMass += value;
      }
      if (height <= boundaryLayerDepthM && (verticalVelocity[rowIndex]?.[columnIndex] ?? 0) < 0) {
        returnFlowMass += value;
      }
      if (lcl !== null && height < lcl) {
        belowLclMass += value;
      }
      cloudBaseM = cloudBaseM === null ? height : Math.min(cloudBaseM, height);
      cloudTopM = cloudTopM === null ? height : Math.max(cloudTopM, height);
    }
  }

  return {
    maxValue,
    totalMass,
    boundaryMass,
    returnFlowMass,
    topBoundaryMass,
    lateralBoundaryMass,
    belowLclMass,
    cloudBaseM,
    cloudTopM,
  };
}

function cloudRegionCount(values: number[][]): number {
  const rows = values.length;
  const columns = values[0]?.length ?? 0;
  const visited = Array.from({ length: rows }, () => Array.from({ length: columns }, () => false));
  let regions = 0;

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
      if (
        visited[rowIndex][columnIndex] ||
        (values[rowIndex][columnIndex] ?? 0) <= CLOUD_THRESHOLD_KG_PER_KG
      ) {
        continue;
      }
      regions += 1;
      floodCloudRegion(values, visited, rowIndex, columnIndex);
    }
  }

  return regions;
}

function cloudRegionBoundaryTouchFraction(values: number[][]): number {
  const rows = values.length;
  const columns = values[0]?.length ?? 0;
  const visited = Array.from({ length: rows }, () => Array.from({ length: columns }, () => false));
  const topStartRow = Math.max(0, rows - 2);
  let regions = 0;
  let touchingRegions = 0;

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
      if (
        visited[rowIndex][columnIndex] ||
        (values[rowIndex][columnIndex] ?? 0) <= CLOUD_THRESHOLD_KG_PER_KG
      ) {
        continue;
      }
      regions += 1;
      if (floodCloudRegion(values, visited, rowIndex, columnIndex, topStartRow)) {
        touchingRegions += 1;
      }
    }
  }

  return regions > 0 ? touchingRegions / regions : 0;
}

function floodCloudRegion(
  values: number[][],
  visited: boolean[][],
  startRow: number,
  startColumn: number,
  topStartRow = Number.POSITIVE_INFINITY,
): boolean {
  const stack: Array<[number, number]> = [[startRow, startColumn]];
  let touchesBoundary = false;
  while (stack.length > 0) {
    const [row, column] = stack.pop() ?? [0, 0];
    if (
      row < 0 ||
      column < 0 ||
      row >= values.length ||
      column >= (values[row]?.length ?? 0) ||
      visited[row][column] ||
      (values[row][column] ?? 0) <= CLOUD_THRESHOLD_KG_PER_KG
    ) {
      continue;
    }
    visited[row][column] = true;
    if (
      row === 0 ||
      row >= topStartRow ||
      column === 0 ||
      column === (values[row]?.length ?? 0) - 1
    ) {
      touchesBoundary = true;
    }
    stack.push([row + 1, column], [row - 1, column], [row, column + 1], [row, column - 1]);
  }
  return touchesBoundary;
}

function hasImmediateSurfaceCloud(frame: SimulationFrame | undefined): boolean {
  const cloud = frame?.fields.cloud_liquid_water_kg_per_kg?.values;
  if (!cloud || cloud.length === 0) {
    return false;
  }

  return maxFieldValue([cloud[0]]) > CLOUD_THRESHOLD_KG_PER_KG;
}

function maxFieldValue(values: number[][]): number {
  let maxValue = 0;
  for (const row of values) {
    for (const value of row) {
      maxValue = Math.max(maxValue, value);
    }
  }
  return maxValue;
}

function approximateLclHeightM(surfaceTemperatureK: number, relativeHumidity: number): number | null {
  if (!Number.isFinite(surfaceTemperatureK) || !Number.isFinite(relativeHumidity)) {
    return null;
  }

  const surfaceTemperatureC = surfaceTemperatureK - 273.15;
  const rh = Math.min(1, Math.max(0.01, relativeHumidity));
  const dewpointC =
    (243.5 * (Math.log(rh) + (17.67 * surfaceTemperatureC) / (243.5 + surfaceTemperatureC))) /
    (17.67 - Math.log(rh) - (17.67 * surfaceTemperatureC) / (243.5 + surfaceTemperatureC));
  return Math.max(0, 125 * (surfaceTemperatureC - dewpointC));
}

function expectedText(scenario: BuiltInScenario): string {
  return `${scenario.expectedOutcome} Diagnostics: ${scenario.diagnosticExpectations.join(" ")}`;
}

function observedText(observation: ScenarioObservation): string {
  const cloud =
    observation.firstCloudTimeSeconds === null
      ? "no cloud detected"
      : `first cloud at ${formatSeconds(observation.firstCloudTimeSeconds)} near ${formatMeters(
          observation.firstCloudBaseM,
        )}`;
  const cloudTop =
    observation.maxCloudTopM === null ? "no cloud top" : `top ${formatMeters(observation.maxCloudTopM)}`;
  const rain =
    observation.firstRainTimeSeconds === null
      ? "no rain"
      : `rain starts ${formatSeconds(observation.firstRainTimeSeconds)}`;

  return `${cloud}; ${cloudTop}; max cloud ${formatScientific(
    observation.maxCloudLiquidWaterKgPerKg,
  )}; max updraft ${observation.maxUpdraftMPerS.toFixed(2)} m/s; ${rain}.`;
}

function notEvaluated(
  note: string,
  scenario?: BuiltInScenario,
): ScenarioDiagnostics {
  return {
    expected: scenario ? expectedText(scenario) : "Select a built-in scenario to compare expected and observed behavior.",
    observed: "No deterministic observation is available yet.",
    status: "not_evaluated",
    statusLabel: statusLabel("not_evaluated"),
    notes: [note],
    observations: null,
  };
}

function statusLabel(status: ScenarioStatus): string {
  switch (status) {
    case "plausible":
      return "Plausible";
    case "warning":
      return "Warning";
    case "failed_expectation":
      return "Failed expectation";
    case "not_evaluated":
      return "Not evaluated";
  }
}

function formatSeconds(value: number | null): string {
  return value === null ? "n/a" : `${value.toFixed(0)} s`;
}

function formatMeters(value: number | null): string {
  return value === null ? "n/a" : `${value.toFixed(0)} m`;
}

function formatScientific(value: number): string {
  return value === 0 ? "0" : value.toExponential(2);
}

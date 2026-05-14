import type { LabDefinition, LabScenarioDefinition } from "../labs/labTypes";
import { clampFrameIndex, replayEventTargets, replayStatus } from "../replay";
import {
  artifactPolicyNotes,
  evaluateScenarioRun,
  type ScenarioDiagnostics,
} from "../scenarioDiagnostics";
import {
  BUILT_IN_SCENARIOS,
  type BuiltInScenario,
  celsiusToKelvin,
  cloneConfig,
  normalizeConfig,
} from "../simulationControls";
import type { WorkbenchRunClient, RunStatus, SimulationStreamMessage } from "../simulation/runClient";
import type { SimulationConfig, SimulationFrame } from "../simulationTypes";

export type WorkbenchControlId =
  | "surface-heating-strength"
  | "surface-heating-pattern"
  | "source-layer-humidity"
  | "free-atmosphere-humidity"
  | "stability-lapse-rate"
  | "boundary-layer-depth-cap-height"
  | "model-resolution"
  | "domain-width"
  | "domain-height"
  | "run-length";

export type WorkbenchControlValue = number | string;

export type WorkbenchRunSummary = {
  status: RunStatus;
  runId: string | null;
  message: string | null;
  durationSeconds: number;
  framesReceived: number;
  currentTimeSeconds: number;
  maxCloudWater: number;
  maxUpdraft: number;
};

export type WorkbenchState = {
  selectedScenarioId: string;
  modelResolutionSlug: WorkbenchResolutionSlug;
  nextRunConfig: SimulationConfig;
  frames: SimulationFrame[];
  displayedFrameIndex: number;
  isReplayPaused: boolean;
  run: WorkbenchRunSummary;
  saveMessage: string | null;
};

export type WorkbenchInspectorSummary = {
  diagnostics: ScenarioDiagnostics;
  profileAvailable: boolean;
  profileSummary: string;
  profileRows: WorkbenchProfileRow[];
  expectedLclM: number | null;
  firstCloudTimeSeconds: number | null;
  firstCloudHeightM: number | null;
  actualCloudBaseM: number | null;
  cloudTopM: number | null;
  maxUpdraftMPerS: number | null;
  integratedCloudWaterKgPerKg: number | null;
  maxCloudWaterKgPerKg: number | null;
  belowLclCloudFraction: number | null;
  nearLclCloudFraction: number | null;
  aboveLclCloudFraction: number | null;
  boundaryCloudFraction: number | null;
  topBoundaryCloudFraction: number | null;
  lateralBoundaryCloudFraction: number | null;
  boundaryConnectedCloudRegionFraction: number | null;
  returnFlowCloudFraction: number | null;
  artifactWarnings: string[];
  returnFlowWarning: string;
  dryFailedOutcome: string;
};

export type WorkbenchProfileRow = {
  heightM: number;
  temperatureC: number | null;
  waterVaporKgPerKg: number | null;
  cloudWaterKgPerKg: number | null;
  verticalVelocityMPerS: number | null;
};

export type WorkbenchResolutionSlug = "low" | "medium" | "high";

export type WorkbenchResolutionPreset = {
  slug: WorkbenchResolutionSlug;
  name: string;
  description: string;
  grid: SimulationConfig["grid"];
};

export const WORKBENCH_RESOLUTION_PRESETS: WorkbenchResolutionPreset[] = [
  {
    slug: "low",
    name: "Low",
    description: "Fastest interactive grid for quick checks.",
    grid: { columns: 30, rows: 20 },
  },
  {
    slug: "medium",
    name: "Medium",
    description: "Balanced default grid for Fair-Weather exploration.",
    grid: { columns: 36, rows: 24 },
  },
  {
    slug: "high",
    name: "High",
    description: "Finer local inspection; slower on a laptop.",
    grid: { columns: 54, rows: 36 },
  },
];

const DEFAULT_MODEL_RESOLUTION_SLUG: WorkbenchResolutionSlug = "medium";
const DEFAULT_BASE_CONFIG: SimulationConfig = normalizeConfig({
  schema_version: "sim-config-v1",
  solver_type: "boussinesq_2d",
  domain: { width_m: 10_000, height_m: 3_000 },
  grid: { columns: 36, rows: 24 },
  time: { time_step_seconds: 2, duration_seconds: 1_200, frame_interval_seconds: 30 },
  initial_atmosphere: {
    surface_temperature_k: celsiusToKelvin(25),
    lapse_rate_k_per_m: 0.0065,
    relative_humidity: 0.85,
    boundary_layer_depth_m: 1_500,
    moist_source_layer_depth_m: 800,
    free_atmosphere_relative_humidity: 0.55,
    humidity_profile: "surface_moisture",
  },
  surface_heating: {
    max_warming_rate_k_per_s: 0.024,
    patch_center_x_m: 5_000,
    patch_width_m: 2_000,
    pattern: "single_patch",
  },
  background_wind: { u_m_per_s: 0.15, w_m_per_s: 0 },
  seed: 17,
});

export function createInitialWorkbenchState(lab: LabDefinition): WorkbenchState {
  const scenario = lab.scenarios[0];
  const scenarioId = scenario?.id ?? "";
  const config = scenarioId ? configForScenario(scenarioId, DEFAULT_BASE_CONFIG) : DEFAULT_BASE_CONFIG;

  return {
    selectedScenarioId: scenarioId,
    modelResolutionSlug: DEFAULT_MODEL_RESOLUTION_SLUG,
    nextRunConfig: applyResolution(config, DEFAULT_MODEL_RESOLUTION_SLUG),
    frames: [],
    displayedFrameIndex: 0,
    isReplayPaused: false,
    run: idleRunSummary(),
    saveMessage: null,
  };
}

export function selectedLabScenario(
  lab: LabDefinition,
  state: Pick<WorkbenchState, "selectedScenarioId">,
): LabScenarioDefinition | null {
  return lab.scenarios.find((scenario) => scenario.id === state.selectedScenarioId) ?? null;
}

export function builtInScenarioForId(scenarioId: string): BuiltInScenario | null {
  return BUILT_IN_SCENARIOS.find((scenario) => scenario.slug === scenarioId) ?? null;
}

export function resolutionPresetForSlug(
  resolutionSlug: string,
): WorkbenchResolutionPreset | null {
  return (
    WORKBENCH_RESOLUTION_PRESETS.find((preset) => preset.slug === resolutionSlug) ?? null
  );
}

export function selectWorkbenchScenario(
  state: WorkbenchState,
  lab: LabDefinition,
  scenarioId: string,
): WorkbenchState {
  const scenario = lab.scenarios.find((candidate) => candidate.id === scenarioId);
  if (!scenario) {
    return state;
  }

  return resetBufferedRun({
    ...state,
    selectedScenarioId: scenario.id,
    nextRunConfig: applyResolution(
      configForScenario(scenario.id, state.nextRunConfig),
      state.modelResolutionSlug,
    ),
    saveMessage: null,
  });
}

export function updateWorkbenchControl(
  state: WorkbenchState,
  controlId: WorkbenchControlId,
  value: WorkbenchControlValue,
): WorkbenchState {
  const config = cloneConfig(state.nextRunConfig);
  let modelResolutionSlug = state.modelResolutionSlug;

  switch (controlId) {
    case "surface-heating-strength":
      config.surface_heating.max_warming_rate_k_per_s = Number(value);
      break;
    case "surface-heating-pattern":
      config.surface_heating.pattern = String(value) as SimulationConfig["surface_heating"]["pattern"];
      break;
    case "source-layer-humidity":
      config.initial_atmosphere.relative_humidity = Number(value);
      break;
    case "free-atmosphere-humidity":
      config.initial_atmosphere.free_atmosphere_relative_humidity = Number(value);
      break;
    case "stability-lapse-rate":
      config.initial_atmosphere.lapse_rate_k_per_m = Number(value);
      break;
    case "boundary-layer-depth-cap-height":
      config.initial_atmosphere.boundary_layer_depth_m = Number(value);
      break;
    case "model-resolution":
      modelResolutionSlug = String(value) as WorkbenchResolutionSlug;
      break;
    case "domain-width":
      config.domain.width_m = Number(value);
      config.surface_heating.patch_center_x_m = Number(value) / 2;
      break;
    case "domain-height":
      config.domain.height_m = Number(value);
      break;
    case "run-length":
      config.time.duration_seconds = Number(value);
      break;
  }

  return resetBufferedRun({
    ...state,
    modelResolutionSlug,
    nextRunConfig: applyResolution(normalizeConfig(config), modelResolutionSlug),
    saveMessage: null,
  });
}

export async function startWorkbenchRun(
  state: WorkbenchState,
  client: Pick<WorkbenchRunClient, "startRun">,
): Promise<WorkbenchState> {
  const run = await client.startRun(state.nextRunConfig);

  return {
    ...state,
    frames: [],
    displayedFrameIndex: 0,
    isReplayPaused: false,
    saveMessage: null,
    run: {
      ...idleRunSummary(),
      status: "running",
      runId: run.run_id,
      durationSeconds: run.duration_seconds ?? state.nextRunConfig.time.duration_seconds,
      message: "Run started.",
    },
  };
}

export function markWorkbenchRunStarting(state: WorkbenchState): WorkbenchState {
  return {
    ...state,
    frames: [],
    displayedFrameIndex: 0,
    isReplayPaused: false,
    saveMessage: null,
    run: {
      ...idleRunSummary(),
      status: "starting",
      durationSeconds: state.nextRunConfig.time.duration_seconds,
      message: null,
    },
  };
}

export function markWorkbenchRunError(state: WorkbenchState, message: string): WorkbenchState {
  return {
    ...state,
    run: {
      ...state.run,
      status: "error",
      message,
    },
  };
}

export function resetWorkbenchRun(state: WorkbenchState): WorkbenchState {
  return {
    ...resetBufferedRun(state),
    saveMessage: null,
  };
}

export function applyWorkbenchStreamMessage(
  state: WorkbenchState,
  message: SimulationStreamMessage,
): WorkbenchState {
  if (message.type === "metadata") {
    return {
      ...state,
      run: {
        ...state.run,
        status: message.run.status === "running" ? "running" : state.run.status,
        runId: message.run.run_id,
      },
    };
  }

  if (message.type === "frame") {
    const frames = [...state.frames, message.frame];
    const displayedFrameIndex = state.isReplayPaused
      ? state.displayedFrameIndex
      : frames.length - 1;

    return {
      ...state,
      frames,
      displayedFrameIndex,
      run: {
        ...state.run,
        status: "running",
        framesReceived: frames.length,
        currentTimeSeconds: message.frame.time_seconds,
        maxCloudWater: Math.max(
          state.run.maxCloudWater,
          maxFrameField(message.frame, "cloud_liquid_water_kg_per_kg"),
        ),
        maxUpdraft: Math.max(
          state.run.maxUpdraft,
          maxFrameField(message.frame, "vertical_velocity_m_per_s"),
        ),
      },
    };
  }

  if (message.type === "complete" || message.type === "stopped") {
    const status = message.type === "complete" ? "complete" : "stopped";
    return {
      ...state,
      run: {
        ...state.run,
        status,
        currentTimeSeconds: message.run.last_frame_time_seconds ?? state.run.currentTimeSeconds,
        message: status === "complete" ? "Run complete." : "Run stopped cleanly.",
      },
    };
  }

  return markWorkbenchRunError(state, message.message ?? "Simulation stream failed.");
}

export function setWorkbenchDisplayedFrame(state: WorkbenchState, frameIndex: number): WorkbenchState {
  return {
    ...state,
    displayedFrameIndex: clampFrameIndex(frameIndex, state.frames.length),
    isReplayPaused: true,
  };
}

export function setWorkbenchReplayPaused(state: WorkbenchState, isReplayPaused: boolean): WorkbenchState {
  return {
    ...state,
    isReplayPaused,
  };
}

export function saveRunPlaceholder(state: WorkbenchState): WorkbenchState {
  if (state.frames.length === 0) {
    return {
      ...state,
      saveMessage: "Run something first; there are no frames to preserve yet.",
    };
  }

  return {
    ...state,
    saveMessage:
      "Run metadata and buffered frames are ready for the saved-run workflow. Full saved-run management stays outside the default workbench.",
  };
}

export function displayedFrame(state: WorkbenchState): SimulationFrame | null {
  return state.frames[clampFrameIndex(state.displayedFrameIndex, state.frames.length)] ?? null;
}

export function workbenchReplayLabel(state: WorkbenchState): string {
  const currentFrame = displayedFrame(state);
  const status = replayStatus(state.run.status, state.frames.length, state.displayedFrameIndex);
  if (!currentFrame) {
    return "No frames buffered yet";
  }

  return `${status} - frame ${state.displayedFrameIndex + 1} of ${state.frames.length} - ${formatSeconds(
    currentFrame.time_seconds,
  )}`;
}

export function workbenchReplayEvents(state: WorkbenchState) {
  return replayEventTargets(state.frames);
}

export function buildWorkbenchInspectorSummary(
  state: WorkbenchState,
): WorkbenchInspectorSummary {
  const scenario = builtInScenarioForId(state.selectedScenarioId);
  const diagnostics = evaluateScenarioRun({
    scenario,
    config: state.nextRunConfig,
    frames: state.frames,
  });
  const observations = diagnostics.observations;
  const expectedLclM = observations?.estimatedLclM ?? approximateLclHeightM(state.nextRunConfig);
  const frame = displayedFrame(state);
  const lclBands = frame && expectedLclM !== null
    ? cloudWaterFractionsByLclBand(frame, expectedLclM)
    : { below: null, near: null, above: null };
  const frameCloudStats = frame ? cloudWaterStats(frame) : null;

  return {
    diagnostics,
    profileAvailable: frame !== null,
    profileSummary: frame
      ? `Profile available at ${formatSeconds(frame.time_seconds)} from ${frame.grid.rows} vertical levels.`
      : "Profile unavailable until at least one frame is streamed.",
    profileRows: frame ? profileRowsForFrame(frame) : [],
    expectedLclM,
    firstCloudTimeSeconds: observations?.firstCloudTimeSeconds ?? null,
    firstCloudHeightM: observations?.firstCloudBaseM ?? null,
    actualCloudBaseM: frameCloudStats?.cloudBaseM ?? null,
    cloudTopM: observations?.maxCloudTopM ?? null,
    maxUpdraftMPerS: observations?.maxUpdraftMPerS ?? null,
    integratedCloudWaterKgPerKg: frameCloudStats?.integratedCloudWaterKgPerKg ?? null,
    maxCloudWaterKgPerKg: observations?.maxCloudLiquidWaterKgPerKg ?? frameCloudStats?.maxCloudWaterKgPerKg ?? null,
    belowLclCloudFraction: lclBands.below ?? observations?.belowLclCloudFraction ?? null,
    nearLclCloudFraction: lclBands.near,
    aboveLclCloudFraction: lclBands.above,
    boundaryCloudFraction: observations?.boundaryCloudFraction ?? null,
    topBoundaryCloudFraction: observations?.topBoundaryCloudFraction ?? null,
    lateralBoundaryCloudFraction: observations?.lateralBoundaryCloudFraction ?? null,
    boundaryConnectedCloudRegionFraction: observations?.boundaryConnectedCloudRegionFraction ?? null,
    returnFlowCloudFraction: observations?.returnFlowCloudFraction ?? null,
    artifactWarnings: observations ? artifactPolicyNotes(observations) : [],
    returnFlowWarning: returnFlowWarningText(frame),
    dryFailedOutcome: dryFailedOutcomeText(state.selectedScenarioId, diagnostics),
  };
}

export function formatSeconds(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "unavailable";
  }

  return `${Math.round(value)} s`;
}

export function formatMeters(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "unavailable";
  }

  return `${Math.round(value)} m`;
}

function configForScenario(scenarioId: string, baseConfig: SimulationConfig): SimulationConfig {
  const scenario = builtInScenarioForId(scenarioId);
  return scenario ? scenario.apply(baseConfig) : baseConfig;
}

function applyResolution(
  config: SimulationConfig,
  resolutionSlug: WorkbenchResolutionSlug,
): SimulationConfig {
  const preset = resolutionPresetForSlug(resolutionSlug);
  return preset ? normalizeConfig({ ...config, grid: preset.grid }) : config;
}

function resetBufferedRun(state: WorkbenchState): WorkbenchState {
  return {
    ...state,
    frames: [],
    displayedFrameIndex: 0,
    isReplayPaused: false,
    run: idleRunSummary(),
  };
}

function idleRunSummary(): WorkbenchRunSummary {
  return {
    status: "idle",
    runId: null,
    message: null,
    durationSeconds: 0,
    framesReceived: 0,
    currentTimeSeconds: 0,
    maxCloudWater: 0,
    maxUpdraft: 0,
  };
}

function maxFrameField(frame: SimulationFrame, fieldKey: string): number {
  const field = frame.fields[fieldKey];
  if (!field) {
    return 0;
  }

  if (field.values.length === 0) {
    return 0;
  }

  return field.values.reduce(
    (currentMax, row) => Math.max(currentMax, ...row),
    Number.NEGATIVE_INFINITY,
  );
}

function cloudWaterFractionsByLclBand(
  frame: SimulationFrame,
  expectedLclM: number | null,
): { below: number | null; near: number | null; above: number | null } {
  if (expectedLclM === null) {
    return { below: null, near: null, above: null };
  }

  const cloud = frame.fields.cloud_liquid_water_kg_per_kg?.values;
  if (!cloud) {
    return { below: null, near: null, above: null };
  }

  let total = 0;
  let below = 0;
  let near = 0;
  let above = 0;
  const gridStepM = frame.grid.z_coordinates_m[1] - frame.grid.z_coordinates_m[0] || 125;
  const nearHalfDepthM = Math.max(gridStepM * 1.5, 150);

  cloud.forEach((row, rowIndex) => {
    const heightM = frame.grid.z_coordinates_m[rowIndex] ?? 0;
    row.forEach((value) => {
      total += value;
      if (heightM < expectedLclM - nearHalfDepthM) {
        below += value;
      } else if (heightM <= expectedLclM + nearHalfDepthM) {
        near += value;
      } else {
        above += value;
      }
    });
  });

  if (total <= 0) {
    return { below: 0, near: 0, above: 0 };
  }

  return { below: below / total, near: near / total, above: above / total };
}

function cloudWaterStats(frame: SimulationFrame): {
  cloudBaseM: number | null;
  integratedCloudWaterKgPerKg: number;
  maxCloudWaterKgPerKg: number;
} {
  const cloud = frame.fields.cloud_liquid_water_kg_per_kg?.values;
  if (!cloud) {
    return {
      cloudBaseM: null,
      integratedCloudWaterKgPerKg: 0,
      maxCloudWaterKgPerKg: 0,
    };
  }

  let cloudBaseM: number | null = null;
  let integratedCloudWaterKgPerKg = 0;
  let maxCloudWaterKgPerKg = 0;

  cloud.forEach((row, rowIndex) => {
    const rowHasCloud = row.some((value) => value > 1e-8);
    if (rowHasCloud && cloudBaseM === null) {
      cloudBaseM = frame.grid.z_coordinates_m[rowIndex] ?? null;
    }

    row.forEach((value) => {
      integratedCloudWaterKgPerKg += Math.max(0, value);
      maxCloudWaterKgPerKg = Math.max(maxCloudWaterKgPerKg, value);
    });
  });

  return { cloudBaseM, integratedCloudWaterKgPerKg, maxCloudWaterKgPerKg };
}

function profileRowsForFrame(frame: SimulationFrame): WorkbenchProfileRow[] {
  const rows = frame.grid.rows;
  const sampleRows = rows <= 6
    ? Array.from({ length: rows }, (_, index) => index)
    : [0, Math.floor(rows * 0.25), Math.floor(rows * 0.5), Math.floor(rows * 0.75), rows - 1];

  return sampleRows.map((rowIndex) => ({
    heightM: frame.grid.z_coordinates_m[rowIndex] ?? rowIndex,
    temperatureC: rowMean(frame.fields.temperature_k?.values[rowIndex]),
    waterVaporKgPerKg: rowMean(frame.fields.water_vapor_kg_per_kg?.values[rowIndex]),
    cloudWaterKgPerKg: rowMean(frame.fields.cloud_liquid_water_kg_per_kg?.values[rowIndex]),
    verticalVelocityMPerS: rowMean(frame.fields.vertical_velocity_m_per_s?.values[rowIndex]),
  })).map((row) => ({
    ...row,
    temperatureC: row.temperatureC === null ? null : row.temperatureC - 273.15,
  }));
}

function rowMean(row: number[] | undefined): number | null {
  if (!row || row.length === 0) {
    return null;
  }

  return row.reduce((sum, value) => sum + value, 0) / row.length;
}

function returnFlowWarningText(frame: SimulationFrame | null): string {
  if (!frame) {
    return "Unavailable until frames are streamed.";
  }

  const cloud = frame.fields.cloud_liquid_water_kg_per_kg?.values;
  const verticalVelocity = frame.fields.vertical_velocity_m_per_s?.values;
  if (!cloud || !verticalVelocity) {
    return "Unavailable: cloud water and vertical velocity fields are both required.";
  }

  let lowLevelCloudMass = 0;
  let sinkingLowLevelCloudMass = 0;
  const lowLevelRows = Math.max(1, Math.floor(frame.grid.rows / 3));
  for (let rowIndex = 0; rowIndex < lowLevelRows; rowIndex += 1) {
    cloud[rowIndex].forEach((value, columnIndex) => {
      if (value <= 1e-8) {
        return;
      }

      lowLevelCloudMass += value;
      if ((verticalVelocity[rowIndex]?.[columnIndex] ?? 0) < 0) {
        sinkingLowLevelCloudMass += value;
      }
    });
  }

  if (lowLevelCloudMass <= 0) {
    return "No low-level return-flow cloud water detected in the displayed frame.";
  }

  const sinkingFraction = sinkingLowLevelCloudMass / lowLevelCloudMass;
  return sinkingFraction > 0.25
    ? "Low-level cloud water appears in sinking return flow; inspect as a prototype dynamics warning."
    : "Low-level cloud water is not dominated by sinking return flow in the displayed frame.";
}

function dryFailedOutcomeText(scenarioId: string, diagnostics: ScenarioDiagnostics): string {
  if (scenarioId !== "dry-failed-cumulus") {
    return "Only evaluated for the dry failed cumulus scenario.";
  }

  if (diagnostics.status === "not_evaluated") {
    return "Unavailable until frames are streamed.";
  }

  return diagnostics.status === "failed_expectation"
    ? "Dry failed check failed: significant cloud appeared."
    : "Dry failed check is acceptable for the observed frames.";
}

function approximateLclHeightM(config: SimulationConfig): number | null {
  const surfaceTemperatureK = config.initial_atmosphere.surface_temperature_k;
  const relativeHumidity = config.initial_atmosphere.relative_humidity;
  if (!Number.isFinite(surfaceTemperatureK) || !Number.isFinite(relativeHumidity)) {
    return null;
  }

  const surfaceTemperatureC = surfaceTemperatureK - 273.15;
  const rh = Math.min(1, Math.max(0.000001, relativeHumidity));
  const dewpointC =
    (243.5 * (Math.log(rh) + (17.67 * surfaceTemperatureC) / (243.5 + surfaceTemperatureC))) /
    (17.67 - Math.log(rh) - (17.67 * surfaceTemperatureC) / (243.5 + surfaceTemperatureC));

  return Math.max(0, 125 * (surfaceTemperatureC - dewpointC));
}

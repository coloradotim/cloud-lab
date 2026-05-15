export type CloudFormationPotentialStatus =
  | "not_favorable_yet"
  | "cloud_favorable"
  | "moisture_limited"
  | "heating_limited"
  | "cap_suppressed"
  | "dry_entrainment_suppressed"
  | "no_flux_control"
  | "not_evaluated";

export type BoundaryLayer1DConfig = {
  schema_version: "profile-config-v1";
  model_type: "boundary_layer_1d";
  height_m: number;
  levels: number;
  time_step_seconds: number;
  duration_seconds: number;
  frame_interval_seconds: number;
  initial_surface_temperature_k: number;
  initial_mixed_layer_depth_m: number;
  initial_relative_humidity: number;
  initial_lapse_rate_k_per_m: number;
  inversion_height_m: number;
  inversion_strength_k: number;
  free_atmosphere_relative_humidity: number;
  surface_heating_strength: number;
  surface_moisture_flux_strength: number;
  entrainment_strength: number;
  heating_curve: "steady" | "morning_ramp";
  seed: number;
};

export type BoundaryLayer1DDiagnostics = {
  cloud_formation_potential_status: CloudFormationPotentialStatus;
  cloud_formation_potential_reason: string;
  mixed_layer_lcl_difference_m: number;
  rh_near_mixed_layer_top_percent: number;
  max_relative_humidity_percent: number;
  cap_suppression_index: number;
  heating_limited: boolean;
  moisture_limited: boolean;
  cap_limited: boolean;
  dry_entrainment_limited: boolean;
};

export type BoundaryLayer1DFrame = {
  schema_version: "profile-frame-v1";
  step: number;
  time_seconds: number;
  time_hours_from_sunrise: number;
  model_type: "boundary_layer_1d";
  z_m: number[];
  temperature_k: number[];
  water_vapor_kg_per_kg: number[];
  relative_humidity_percent: number[];
  mixed_layer_depth_m: number;
  lcl_m: number;
  inversion_height_m: number;
  inversion_strength_k: number;
  surface_heating_accumulated_k: number;
  surface_moisture_added_kg_per_kg: number;
  entrainment_drying_proxy: number;
  diagnostics: BoundaryLayer1DDiagnostics;
};

export type BoundaryLayer1DRun = {
  schema_version: "profile-run-v1";
  config: BoundaryLayer1DConfig;
  frames: BoundaryLayer1DFrame[];
};

export type BoundaryLayer1DScenarioPreset = {
  slug: string;
  name: string;
  purpose: string;
  expected_status: CloudFormationPotentialStatus | null;
  config: BoundaryLayer1DConfig;
};

export type BoundaryLayer1DClient = {
  runProfile: (config: BoundaryLayer1DConfig) => Promise<BoundaryLayer1DRun>;
};

export type BoundaryLayer1DControlId =
  | "duration_seconds"
  | "surface_heating_strength"
  | "surface_moisture_flux_strength"
  | "initial_relative_humidity"
  | "initial_lapse_rate_k_per_m"
  | "inversion_height_m"
  | "inversion_strength_k"
  | "free_atmosphere_relative_humidity"
  | "entrainment_strength"
  | "levels"
  | "time_step_seconds"
  | "frame_interval_seconds"
  | "seed";

export type BoundaryLayer1DState = {
  selectedScenarioId: string;
  config: BoundaryLayer1DConfig;
  run: BoundaryLayer1DRun | null;
  displayedFrameIndex: number;
  status: "ready" | "computing" | "replaying" | "paused" | "complete" | "error";
  message: string | null;
  saveMessage: string | null;
};

export type ScenarioCheckStatus = "not_evaluated" | "matches" | "different";

export type BoundaryLayerDiagnosticViewModel = {
  status: CloudFormationPotentialStatus;
  statusLabel: string;
  reason: string;
  explanation: string;
  tryNext: string[];
  expectedStatus: CloudFormationPotentialStatus | null;
  expectedLabel: string;
  observedLabel: string;
  scenarioCheckStatus: ScenarioCheckStatus;
  scenarioCheckLabel: string;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export const defaultBoundaryLayer1DClient: BoundaryLayer1DClient = {
  async runProfile(config) {
    const response = await fetch(`${apiBaseUrl}/simulations/boundary-layer-1d/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      throw new Error(`Profile run returned HTTP ${response.status}`);
    }

    return (await response.json()) as BoundaryLayer1DRun;
  },
};

const DEFAULT_PROFILE_CONFIG: BoundaryLayer1DConfig = {
  schema_version: "profile-config-v1",
  model_type: "boundary_layer_1d",
  height_m: 3_000,
  levels: 61,
  time_step_seconds: 60,
  duration_seconds: 14_400,
  frame_interval_seconds: 900,
  initial_surface_temperature_k: 291.15,
  initial_mixed_layer_depth_m: 180,
  initial_relative_humidity: 0.58,
  initial_lapse_rate_k_per_m: 0.0065,
  inversion_height_m: 1_600,
  inversion_strength_k: 2,
  free_atmosphere_relative_humidity: 0.35,
  surface_heating_strength: 0.58,
  surface_moisture_flux_strength: 0.28,
  entrainment_strength: 0.28,
  heating_curve: "morning_ramp",
  seed: 1,
};

export const boundaryLayer1DScenarioPresets: BoundaryLayer1DScenarioPreset[] = [
  {
    slug: "morning-stable-layer-breaks-down",
    name: "Morning stable layer breaks down",
    purpose: "Baseline daytime warming and mixed-layer growth from a cool morning profile.",
    expected_status: "moisture_limited",
    config: DEFAULT_PROFILE_CONFIG,
  },
  {
    slug: "moist-surface-cumulus-favorable",
    name: "Moist surface, cumulus favorable",
    purpose: "Moist surface flux plus heating lowers LCL enough for shallow-cumulus potential.",
    expected_status: "cloud_favorable",
    config: {
      ...DEFAULT_PROFILE_CONFIG,
      initial_surface_temperature_k: 293.15,
      initial_mixed_layer_depth_m: 250,
      initial_relative_humidity: 0.85,
      free_atmosphere_relative_humidity: 0.7,
      inversion_height_m: 1_900,
      inversion_strength_k: 1.5,
      surface_heating_strength: 0.72,
      surface_moisture_flux_strength: 1,
      entrainment_strength: 0.22,
    },
  },
  {
    slug: "dry-entrainment-suppresses-potential",
    name: "Dry entrainment suppresses potential",
    purpose: "Shows how dry air above the mixed layer can suppress potential despite growth.",
    expected_status: "dry_entrainment_suppressed",
    config: {
      ...DEFAULT_PROFILE_CONFIG,
      initial_mixed_layer_depth_m: 250,
      initial_relative_humidity: 0.72,
      free_atmosphere_relative_humidity: 0.12,
      inversion_height_m: 2_100,
      inversion_strength_k: 1.2,
      surface_heating_strength: 0.72,
      surface_moisture_flux_strength: 0.22,
      entrainment_strength: 0.82,
    },
  },
  {
    slug: "surface-moisture-flux-enables-potential",
    name: "Surface moisture flux enables potential",
    purpose: "Shows moisture flux changing a dry surface case into a cloud-favorable profile.",
    expected_status: "cloud_favorable",
    config: {
      ...DEFAULT_PROFILE_CONFIG,
      initial_mixed_layer_depth_m: 250,
      initial_relative_humidity: 0.78,
      free_atmosphere_relative_humidity: 0.66,
      inversion_height_m: 1_850,
      inversion_strength_k: 1.6,
      surface_heating_strength: 0.75,
      surface_moisture_flux_strength: 1,
      entrainment_strength: 0.18,
    },
  },
  {
    slug: "strong-cap-suppresses-growth",
    name: "Strong cap suppresses growth",
    purpose: "A nearby strong inversion stalls mixed-layer growth before cloud-favorable depth.",
    expected_status: "cap_suppressed",
    config: {
      ...DEFAULT_PROFILE_CONFIG,
      initial_mixed_layer_depth_m: 250,
      initial_relative_humidity: 0.7,
      inversion_height_m: 850,
      inversion_strength_k: 6,
      surface_heating_strength: 0.72,
      surface_moisture_flux_strength: 0.5,
      entrainment_strength: 0.25,
    },
  },
  {
    slug: "no-flux-control",
    name: "No-flux control",
    purpose: "Validation control with negligible heating, moisture flux, and entrainment.",
    expected_status: "no_flux_control",
    config: {
      ...DEFAULT_PROFILE_CONFIG,
      initial_mixed_layer_depth_m: 250,
      surface_heating_strength: 0,
      surface_moisture_flux_strength: 0,
      entrainment_strength: 0,
      heating_curve: "steady",
    },
  },
];

export function createInitialBoundaryLayer1DState(
  scenarioId = boundaryLayer1DScenarioPresets[0]?.slug ?? "",
): BoundaryLayer1DState {
  const scenario = boundaryLayer1DScenarioForId(scenarioId) ?? boundaryLayer1DScenarioPresets[0];

  return {
    selectedScenarioId: scenario?.slug ?? "",
    config: cloneProfileConfig(scenario?.config ?? DEFAULT_PROFILE_CONFIG),
    run: null,
    displayedFrameIndex: 0,
    status: "ready",
    message:
      "Ready to evolve the profile. Choose a scenario and run the profile from sunrise through the selected duration.",
    saveMessage: null,
  };
}

export function boundaryLayer1DScenarioForId(
  scenarioId: string | undefined,
): BoundaryLayer1DScenarioPreset | null {
  return boundaryLayer1DScenarioPresets.find((scenario) => scenario.slug === scenarioId) ?? null;
}

export function selectBoundaryLayer1DScenario(
  state: BoundaryLayer1DState,
  scenarioId: string,
): BoundaryLayer1DState {
  const scenario = boundaryLayer1DScenarioForId(scenarioId);
  if (!scenario) {
    return state;
  }

  return {
    ...state,
    selectedScenarioId: scenario.slug,
    config: cloneProfileConfig(scenario.config),
    run: null,
    displayedFrameIndex: 0,
    status: "ready",
    message:
      "Ready to evolve the profile. Choose a scenario and run the profile from sunrise through the selected duration.",
    saveMessage: null,
  };
}

export function updateBoundaryLayer1DControl(
  state: BoundaryLayer1DState,
  controlId: BoundaryLayer1DControlId,
  value: number,
): BoundaryLayer1DState {
  const config = {
    ...state.config,
    [controlId]: Number.isFinite(value) ? value : state.config[controlId],
  };
  const validatedConfig = validateProfileConfig(config);

  return {
    ...state,
    config: validatedConfig,
    run: null,
    displayedFrameIndex: 0,
    status: "ready",
    message:
      "Ready to evolve the profile. Choose a scenario and run the profile from sunrise through the selected duration.",
    saveMessage: null,
  };
}

export function boundaryLayerDisplayedFrame(
  state: BoundaryLayer1DState,
): BoundaryLayer1DFrame | null {
  const frames = usableBoundaryLayerFrames(state.run);
  if (frames.length === 0) {
    return null;
  }

  return frames[clampBoundaryLayerFrameIndex(state.displayedFrameIndex, frames.length)] ?? null;
}

export function usableBoundaryLayerFrames(run: BoundaryLayer1DRun | null): BoundaryLayer1DFrame[] {
  return run?.frames.filter(isBoundaryLayerFrameUsable) ?? [];
}

export function isBoundaryLayerFrameUsable(frame: BoundaryLayer1DFrame | null | undefined): frame is BoundaryLayer1DFrame {
  if (!frame?.diagnostics) {
    return false;
  }

  const profileLength = frame.z_m?.length ?? 0;
  if (profileLength < 2) {
    return false;
  }

  return (
    frame.temperature_k?.length === profileLength &&
    frame.relative_humidity_percent?.length === profileLength &&
    frame.z_m.every(Number.isFinite) &&
    frame.temperature_k.every(Number.isFinite) &&
    frame.relative_humidity_percent.every(Number.isFinite) &&
    Number.isFinite(frame.time_hours_from_sunrise) &&
    Number.isFinite(frame.mixed_layer_depth_m) &&
    Number.isFinite(frame.lcl_m) &&
    Number.isFinite(frame.inversion_height_m)
  );
}

export function clampBoundaryLayerFrameIndex(index: number, frameCount: number): number {
  if (!Number.isFinite(index) || frameCount <= 0) {
    return 0;
  }

  return Math.min(Math.max(0, Math.round(index)), frameCount - 1);
}

export function markBoundaryLayerComputing(state: BoundaryLayer1DState): BoundaryLayer1DState {
  return {
    ...state,
    status: "computing",
    displayedFrameIndex: 0,
    message: "Computing profile evolution...",
    saveMessage: null,
  };
}

export function markBoundaryLayerRunReady(
  state: BoundaryLayer1DState,
  run: BoundaryLayer1DRun,
): BoundaryLayer1DState {
  const frames = usableBoundaryLayerFrames(run);
  if (frames.length === 0) {
    return {
      ...state,
      run,
      displayedFrameIndex: 0,
      status: "error",
      message:
        "Profile evolution could not be displayed. The run returned no usable profile frames.",
    };
  }

  return {
    ...state,
    run: { ...run, frames },
    displayedFrameIndex: 0,
    status: "replaying",
    message: `Replaying profile evolution: ${formatHoursAfterSunrise(frames[0]?.time_hours_from_sunrise ?? 0)}.`,
    saveMessage: null,
  };
}

export function advanceBoundaryLayerReplay(state: BoundaryLayer1DState): BoundaryLayer1DState {
  const frames = usableBoundaryLayerFrames(state.run);
  if (frames.length === 0) {
    return state;
  }

  const currentIndex = clampBoundaryLayerFrameIndex(state.displayedFrameIndex, frames.length);
  if (currentIndex >= frames.length - 1) {
    const finalFrame = frames[frames.length - 1];
    return {
      ...state,
      displayedFrameIndex: frames.length - 1,
      status: "complete",
      message: `Profile evolution complete. Result: ${statusLabel(
        finalFrame.diagnostics.cloud_formation_potential_status,
      )}. Replay evolution or change the setup and run again.`,
    };
  }

  const nextIndex = currentIndex + 1;
  const nextFrame = frames[nextIndex];
  return {
    ...state,
    displayedFrameIndex: nextIndex,
    status: "replaying",
    message: `Replaying profile evolution: ${formatHoursAfterSunrise(nextFrame.time_hours_from_sunrise)}.`,
  };
}

export function pauseBoundaryLayerReplay(state: BoundaryLayer1DState): BoundaryLayer1DState {
  const frames = usableBoundaryLayerFrames(state.run);
  if (frames.length === 0) {
    return state;
  }

  return {
    ...state,
    displayedFrameIndex: clampBoundaryLayerFrameIndex(state.displayedFrameIndex, frames.length),
    status: "paused",
    message: "Profile replay paused.",
  };
}

export function playBoundaryLayerReplay(state: BoundaryLayer1DState): BoundaryLayer1DState {
  const frames = usableBoundaryLayerFrames(state.run);
  if (frames.length === 0) {
    return state;
  }

  const index = clampBoundaryLayerFrameIndex(state.displayedFrameIndex, frames.length);
  return {
    ...state,
    displayedFrameIndex: index,
    status: index >= frames.length - 1 ? "complete" : "replaying",
    message:
      index >= frames.length - 1
        ? "Profile evolution complete. Replay evolution or change the setup and run again."
        : `Replaying profile evolution: ${formatHoursAfterSunrise(frames[index]?.time_hours_from_sunrise ?? 0)}.`,
  };
}

export function replayBoundaryLayerEvolution(state: BoundaryLayer1DState): BoundaryLayer1DState {
  const frames = usableBoundaryLayerFrames(state.run);
  if (frames.length === 0) {
    return state;
  }

  return {
    ...state,
    displayedFrameIndex: 0,
    status: "replaying",
    message: `Replaying profile evolution: ${formatHoursAfterSunrise(frames[0]?.time_hours_from_sunrise ?? 0)}.`,
  };
}

export function selectBoundaryLayerFrame(
  state: BoundaryLayer1DState,
  frameIndex: number,
  nextStatus: BoundaryLayer1DState["status"] = "paused",
): BoundaryLayer1DState {
  const frames = usableBoundaryLayerFrames(state.run);
  if (frames.length === 0) {
    return state;
  }

  const displayedFrameIndex = clampBoundaryLayerFrameIndex(frameIndex, frames.length);
  return {
    ...state,
    displayedFrameIndex,
    status: nextStatus,
    message:
      nextStatus === "complete"
        ? "Profile evolution complete. Replay evolution or change the setup and run again."
        : `Profile replay paused at ${formatHoursAfterSunrise(frames[displayedFrameIndex]?.time_hours_from_sunrise ?? 0)}.`,
  };
}

export function selectFinalBoundaryLayerFrame(state: BoundaryLayer1DState): BoundaryLayer1DState {
  const frames = usableBoundaryLayerFrames(state.run);
  return selectBoundaryLayerFrame(state, Math.max(0, frames.length - 1), "complete");
}

export function boundaryLayerDiagnosticViewModel(
  frame: BoundaryLayer1DFrame | null,
  scenario: BoundaryLayer1DScenarioPreset | null,
): BoundaryLayerDiagnosticViewModel {
  const diagnostics = frame?.diagnostics ?? null;
  const status = diagnostics?.cloud_formation_potential_status ?? "not_evaluated";
  const expectedStatus = scenario?.expected_status ?? null;
  const scenarioCheckStatus = !expectedStatus || status === "not_evaluated"
    ? "not_evaluated"
    : expectedStatus === status
      ? "matches"
      : "different";

  return {
    status,
    statusLabel: statusLabel(status),
    reason:
      diagnostics?.cloud_formation_potential_reason ??
      "Diagnostics failed to render. The profile run data may be incomplete or inconsistent.",
    explanation: diagnosticExplanation(status, frame),
    tryNext: diagnosticSuggestions(status),
    expectedStatus,
    expectedLabel: expectedStatus ? statusLabel(expectedStatus) : "Not specified",
    observedLabel: statusLabel(status),
    scenarioCheckStatus,
    scenarioCheckLabel:
      scenarioCheckStatus === "matches"
        ? "Matches scenario"
        : scenarioCheckStatus === "different"
          ? "Different from expected"
          : "Run profile to compare",
  };
}

export function boundaryLayerPreviewFrame(state: BoundaryLayer1DState): BoundaryLayer1DFrame {
  const z_m = Array.from({ length: 7 }, (_, index) => (state.config.height_m / 6) * index);
  const temperature_k = z_m.map(
    (heightM) => state.config.initial_surface_temperature_k - heightM * state.config.initial_lapse_rate_k_per_m,
  );
  const relative_humidity_percent = z_m.map((heightM) =>
    heightM <= state.config.initial_mixed_layer_depth_m
      ? state.config.initial_relative_humidity * 100
      : state.config.free_atmosphere_relative_humidity * 100,
  );

  return {
    schema_version: "profile-frame-v1",
    step: 0,
    time_seconds: 0,
    time_hours_from_sunrise: 0,
    model_type: "boundary_layer_1d",
    z_m,
    temperature_k,
    water_vapor_kg_per_kg: z_m.map(() => 0),
    relative_humidity_percent,
    mixed_layer_depth_m: state.config.initial_mixed_layer_depth_m,
    lcl_m: estimatePreviewLclM(state.config),
    inversion_height_m: state.config.inversion_height_m,
    inversion_strength_k: state.config.inversion_strength_k,
    surface_heating_accumulated_k: 0,
    surface_moisture_added_kg_per_kg: 0,
    entrainment_drying_proxy: 0,
    diagnostics: {
      cloud_formation_potential_status: "not_evaluated",
      cloud_formation_potential_reason:
        "Run the 1-D profile model to compute the deterministic cloud formation potential diagnostic.",
      mixed_layer_lcl_difference_m:
        state.config.initial_mixed_layer_depth_m - estimatePreviewLclM(state.config),
      rh_near_mixed_layer_top_percent: state.config.initial_relative_humidity * 100,
      max_relative_humidity_percent: state.config.initial_relative_humidity * 100,
      cap_suppression_index: state.config.inversion_strength_k,
      heating_limited: false,
      moisture_limited: false,
      cap_limited: false,
      dry_entrainment_limited: false,
    },
  };
}

export function cloneProfileConfig(config: BoundaryLayer1DConfig): BoundaryLayer1DConfig {
  return { ...config };
}

export function formatHoursAfterSunrise(hours: number): string {
  return `${Number.isFinite(hours) ? hours.toFixed(1) : "0.0"} h after sunrise`;
}

export function durationSecondsToHours(seconds: number): number {
  return Number.isFinite(seconds) ? seconds / 3_600 : 0;
}

export function durationHoursToSeconds(hours: number): number {
  return Math.max(1_800, Math.min(28_800, Number.isFinite(hours) ? hours * 3_600 : 14_400));
}

export function statusLabel(status: CloudFormationPotentialStatus): string {
  switch (status) {
    case "cloud_favorable":
      return "Cloud favorable";
    case "moisture_limited":
      return "Moisture limited";
    case "heating_limited":
      return "Heating limited";
    case "cap_suppressed":
      return "Cap suppressed";
    case "dry_entrainment_suppressed":
      return "Dry entrainment suppressed";
    case "no_flux_control":
      return "No-flux control";
    case "not_favorable_yet":
      return "Not favorable yet";
    case "not_evaluated":
      return "Not evaluated";
  }
}

function estimatePreviewLclM(config: BoundaryLayer1DConfig): number {
  const rh = Math.max(0.05, Math.min(1, config.initial_relative_humidity));
  return Math.max(80, Math.min(config.height_m, 125 * (100 - rh * 100)));
}

function validateProfileConfig(config: BoundaryLayer1DConfig): BoundaryLayer1DConfig {
  const heightM = Math.max(500, finiteOrDefault(config.height_m, DEFAULT_PROFILE_CONFIG.height_m));
  const durationSeconds = durationHoursToSeconds(durationSecondsToHours(config.duration_seconds));
  const timeStepSeconds = Math.max(30, finiteOrDefault(config.time_step_seconds, DEFAULT_PROFILE_CONFIG.time_step_seconds));
  const frameIntervalSeconds = Math.max(
    timeStepSeconds,
    finiteOrDefault(config.frame_interval_seconds, DEFAULT_PROFILE_CONFIG.frame_interval_seconds),
  );
  const inversionHeightM = Math.min(
    heightM - 1,
    Math.max(100, finiteOrDefault(config.inversion_height_m, DEFAULT_PROFILE_CONFIG.inversion_height_m)),
  );
  const initialMixedLayerDepthM = Math.min(
    inversionHeightM,
    Math.max(50, finiteOrDefault(config.initial_mixed_layer_depth_m, DEFAULT_PROFILE_CONFIG.initial_mixed_layer_depth_m)),
  );

  return {
    ...config,
    height_m: heightM,
    levels: Math.max(4, Math.round(finiteOrDefault(config.levels, DEFAULT_PROFILE_CONFIG.levels))),
    duration_seconds: Math.max(timeStepSeconds, durationSeconds),
    time_step_seconds: timeStepSeconds,
    frame_interval_seconds: frameIntervalSeconds,
    initial_mixed_layer_depth_m: initialMixedLayerDepthM,
    initial_relative_humidity: clamp01(config.initial_relative_humidity),
    free_atmosphere_relative_humidity: clamp01(config.free_atmosphere_relative_humidity),
    initial_lapse_rate_k_per_m: Math.max(0, finiteOrDefault(config.initial_lapse_rate_k_per_m, DEFAULT_PROFILE_CONFIG.initial_lapse_rate_k_per_m)),
    inversion_height_m: inversionHeightM,
    inversion_strength_k: Math.max(0, finiteOrDefault(config.inversion_strength_k, DEFAULT_PROFILE_CONFIG.inversion_strength_k)),
    surface_heating_strength: clamp01(config.surface_heating_strength),
    surface_moisture_flux_strength: clamp01(config.surface_moisture_flux_strength),
    entrainment_strength: clamp01(config.entrainment_strength),
    seed: Math.round(finiteOrDefault(config.seed, DEFAULT_PROFILE_CONFIG.seed)),
  };
}

function diagnosticExplanation(
  status: CloudFormationPotentialStatus,
  frame: BoundaryLayer1DFrame | null,
): string {
  if (!frame) {
    return "Run the profile model to compute cloud formation potential.";
  }

  const mixedLayer = Math.round(frame.mixed_layer_depth_m);
  const lcl = Math.round(frame.lcl_m);
  const gap = Math.round(Math.abs(frame.diagnostics.mixed_layer_lcl_difference_m));

  switch (status) {
    case "moisture_limited":
      return `The mixed layer reached ${mixedLayer} m, but the LCL stayed higher at ${lcl} m. That leaves a ${gap} m gap, so rising air does not reach saturation.`;
    case "heating_limited":
      return `The mixed layer reached ${mixedLayer} m after the selected duration, still short of the ${lcl} m LCL. More heating or more time is needed for this profile.`;
    case "cap_suppressed":
      return `The mixed layer reached ${mixedLayer} m, but the cap near ${Math.round(frame.inversion_height_m)} m limited additional growth before the profile could become cloud favorable.`;
    case "dry_entrainment_suppressed":
      return `The mixed layer reached ${mixedLayer} m, but dry entrainment kept RH near the mixed-layer top near ${frame.diagnostics.rh_near_mixed_layer_top_percent.toFixed(0)}%.`;
    case "cloud_favorable":
      return `The mixed layer reached ${mixedLayer} m with an LCL near ${lcl} m, so this profile became favorable for shallow cloud formation potential.`;
    case "no_flux_control":
      return "Heating, moisture flux, and entrainment are near zero, so the profile remains a no-flux control rather than evolving toward cloud formation.";
    case "not_favorable_yet":
      return `The profile evolved, but the mixed layer at ${mixedLayer} m has not yet reached the ${lcl} m LCL or sufficient RH near the mixed-layer top.`;
    case "not_evaluated":
      return "Run the 1-D profile model to compute the deterministic cloud formation potential diagnostic.";
  }
}

function diagnosticSuggestions(status: CloudFormationPotentialStatus): string[] {
  switch (status) {
    case "moisture_limited":
      return [
        "increase surface moisture flux",
        "start with higher mixed-layer humidity",
        "reduce dry entrainment if available",
      ];
    case "heating_limited":
      return ["increase surface heating", "run longer after sunrise"];
    case "cap_suppressed":
      return [
        "raise the inversion height",
        "weaken the inversion",
        "compare against a weak-cap scenario",
      ];
    case "dry_entrainment_suppressed":
      return [
        "reduce entrainment strength",
        "use less dry air above the mixed layer",
      ];
    case "cloud_favorable":
      return [
        "compare with a drier or capped scenario",
        "inspect when favorable potential first appeared",
      ];
    default:
      return ["change one physical control and run again"];
  }
}

function finiteOrDefault(value: number, defaultValue: number): number {
  return Number.isFinite(value) ? value : defaultValue;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, finiteOrDefault(value, 0)));
}

import {
  boundaryLayer1DScenarioPresets,
  boundaryLayerPreviewFrame,
  cloneProfileConfig,
  formatHoursAfterSunrise,
  statusLabel,
  usableBoundaryLayerFrames,
  type BoundaryLayer1DClient,
  type BoundaryLayer1DConfig,
  type BoundaryLayer1DFrame,
  type BoundaryLayer1DRun,
  type CloudFormationPotentialStatus,
} from "./evolvingBoundaryLayer";
import {
  lowerAtmosphereV2ScenarioContracts,
  type LowerAtmosphereV2CloudColumnStatus,
  type LowerAtmosphereV2FlowMode,
  type LowerAtmosphereV2PrecipitationStatus,
  type LowerAtmosphereV2ScenarioContract,
} from "./lowerAtmosphereV2Scenarios";

export type CloudColumnProfile = {
  z_m: number[];
  temperature_k: number[];
  water_vapor_kg_per_kg?: number[];
  relative_humidity_percent?: number[];
  surface_pressure_pa: number;
  mixed_layer_depth_m?: number;
  lcl_m?: number;
  inversion_height_m?: number;
  inversion_strength_k?: number;
};

export type CloudColumnForcing = {
  updraft_strength_m_per_s: number;
  lift_duration_seconds: number;
  entrainment_drying_factor: number;
  heating_tendency_k_per_s: number;
  runtime_seconds: number;
  time_step_seconds: number;
  frame_interval_seconds: number;
  cap_suppression_strength: number;
  initial_cloud_liquid_water_kg_per_kg: number;
};

export type CloudColumnConfig = {
  schema_version: "cloud-column-config-v1";
  model_type: "controlled_cloud_column";
  profile: CloudColumnProfile;
  forcing: CloudColumnForcing;
  seed: number;
};

export type CloudColumnFrame = {
  schema_version: "cloud-column-frame-v1";
  step: number;
  time_seconds: number;
  model_type: "controlled_cloud_column";
  parcel_height_m: number;
  temperature_k: number;
  water_vapor_kg_per_kg: number;
  relative_humidity_percent: number;
  cloud_liquid_water_kg_per_kg: number;
  condensation_rate_proxy_kg_per_kg_s: number;
  evaporation_rate_proxy_kg_per_kg_s: number;
  prescribed_lift_m_per_s: number;
};

export type CloudColumnWaterBudgetSummary = {
  initial_total_water_kg_per_kg: number;
  final_total_water_kg_per_kg: number;
  max_absolute_drift_kg_per_kg: number;
  total_condensed_kg_per_kg: number;
  total_evaporated_kg_per_kg: number;
};

export type CloudColumnDiagnostics = {
  cloud_formation_status: LowerAtmosphereV2CloudColumnStatus;
  cloud_formation_reason: string;
  first_saturation_time_seconds: number | null;
  first_cloud_time_seconds: number | null;
  cloud_base_m: number | null;
  cloud_top_proxy_m: number | null;
  max_relative_humidity_percent: number;
  max_cloud_liquid_water_kg_per_kg: number;
  water_budget: CloudColumnWaterBudgetSummary;
  forcing: {
    forcing_type: "prescribed_lift";
    dynamics_label: "prescribed, not predicted";
    updraft_strength_m_per_s: number;
    lift_duration_seconds: number;
    entrainment_drying_factor: number;
    heating_tendency_k_per_s: number;
  };
};

export type CloudColumnRun = {
  schema_version: "cloud-column-run-v1";
  config: CloudColumnConfig;
  frames: CloudColumnFrame[];
  diagnostics: CloudColumnDiagnostics;
};

export type LowerAtmosphereV2Client = BoundaryLayer1DClient & {
  runCloudColumn: (config: CloudColumnConfig) => Promise<CloudColumnRun>;
};

export type LowerAtmosphereV2RunStatus = "ready" | "computing" | "complete" | "error";

export type LowerAtmosphereV2ProfileProvenance = {
  source_model: "boundary_layer_1d";
  source_frame_time_seconds: number;
  source_time_hours_from_sunrise: number;
  source_scenario_id: string;
  source_profile_status: CloudFormationPotentialStatus;
  source_profile_kind: "evolved_profile" | "default_profile";
};

export type LowerAtmosphereV2State = {
  selectedScenarioId: string;
  profileConfig: BoundaryLayer1DConfig;
  profileRun: BoundaryLayer1DRun | null;
  selectedProfileFrameIndex: number;
  profileStatus: LowerAtmosphereV2RunStatus;
  cloudColumnRun: CloudColumnRun | null;
  cloudColumnStatus: LowerAtmosphereV2RunStatus;
  profileProvenance: LowerAtmosphereV2ProfileProvenance | null;
  cloudColumnProvenance: LowerAtmosphereV2ProfileProvenance | null;
  message: string | null;
};

export type LowerAtmosphereV2DiagnosticViewModel = {
  resultStatus:
    | CloudFormationPotentialStatus
    | LowerAtmosphereV2CloudColumnStatus
    | LowerAtmosphereV2PrecipitationStatus;
  resultLabel: string;
  why: string;
  tryNext: string[];
  keyNumbers: Array<{ label: string; value: string }>;
  assumptions: string[];
  profile: {
    available: boolean;
    statusLabel: string;
    reason: string;
    firstFavorableTimeLabel: string;
    rows: Array<{ label: string; value: string }>;
  };
  cloudColumn: {
    available: boolean;
    statusLabel: string;
    reason: string;
    prescribedForcingLabel: string;
    rows: Array<{ label: string; value: string }>;
  };
  combined: {
    selectedProfileTimeLabel: string;
    profileStatusLabel: string;
    cloudColumnStatusLabel: string;
    mainLimitingFactor: string;
    suggestedNextExperiment: string;
  };
  scenarioCheck: {
    expectedLabel: string;
    observedLabel: string;
    statusLabel: string;
  };
  precipitation: {
    status: LowerAtmosphereV2PrecipitationStatus;
    statusLabel: string;
    explanation: string;
    tryNext: string[];
  };
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const DEFAULT_SURFACE_PRESSURE_PA = 101_325;

export const defaultLowerAtmosphereV2Client: LowerAtmosphereV2Client = {
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

  async runCloudColumn(config) {
    const response = await fetch(`${apiBaseUrl}/simulations/controlled-cloud-column/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      throw new Error(`Cloud-column run returned HTTP ${response.status}`);
    }

    return (await response.json()) as CloudColumnRun;
  },
};

export function createInitialLowerAtmosphereV2State(
  scenarioId: string | undefined,
): LowerAtmosphereV2State {
  const contract = lowerAtmosphereV2ScenarioForId(scenarioId) ?? lowerAtmosphereV2ScenarioContracts[0];

  return {
    selectedScenarioId: contract.id,
    profileConfig: profileConfigForScenario(contract),
    profileRun: null,
    selectedProfileFrameIndex: 0,
    profileStatus: "ready",
    cloudColumnRun: null,
    cloudColumnStatus: "ready",
    profileProvenance: null,
    cloudColumnProvenance: null,
    message:
      "Ready to run Lower Atmosphere v2. Choose a flow, then run profile evolution, prescribed lift, or both.",
  };
}

export function selectLowerAtmosphereV2Scenario(
  state: LowerAtmosphereV2State,
  scenarioId: string,
): LowerAtmosphereV2State {
  const next = createInitialLowerAtmosphereV2State(scenarioId);
  return {
    ...next,
    message:
      state.selectedScenarioId === next.selectedScenarioId
        ? state.message
        : "Scenario changed. Previous profile and cloud-column run data were cleared.",
  };
}

export function lowerAtmosphereV2ScenarioForId(
  scenarioId: string | undefined,
): LowerAtmosphereV2ScenarioContract | null {
  if (!scenarioId) {
    return null;
  }

  return lowerAtmosphereV2ScenarioContracts.find((scenario) => scenario.id === scenarioId) ?? null;
}

export function lowerAtmosphereV2ProfileFrames(
  state: LowerAtmosphereV2State,
): BoundaryLayer1DFrame[] {
  return usableBoundaryLayerFrames(state.profileRun);
}

export function selectedLowerAtmosphereV2ProfileFrame(
  state: LowerAtmosphereV2State,
): BoundaryLayer1DFrame {
  const frames = lowerAtmosphereV2ProfileFrames(state);
  if (frames.length > 0) {
    return frames[clampIndex(state.selectedProfileFrameIndex, frames.length)] ?? frames[frames.length - 1];
  }

  return boundaryLayerPreviewFrame({
    selectedScenarioId: state.selectedScenarioId,
    config: state.profileConfig,
    run: null,
    displayedFrameIndex: 0,
    status: "ready",
    message: null,
    saveMessage: null,
  });
}

export function selectLowerAtmosphereV2ProfileFrame(
  state: LowerAtmosphereV2State,
  frameIndex: number,
): LowerAtmosphereV2State {
  const frames = lowerAtmosphereV2ProfileFrames(state);
  if (frames.length === 0) {
    return {
      ...state,
      selectedProfileFrameIndex: 0,
      message: "Run profile evolution before selecting an evolved profile time.",
    };
  }

  const selectedProfileFrameIndex = clampIndex(frameIndex, frames.length);
  const frame = frames[selectedProfileFrameIndex];
  return {
    ...state,
    selectedProfileFrameIndex,
    cloudColumnRun: null,
    cloudColumnStatus: "ready",
    cloudColumnProvenance: null,
    message: `Selected profile time: ${formatHoursAfterSunrise(frame.time_hours_from_sunrise)}.`,
  };
}

export async function runLowerAtmosphereV2Flow(
  state: LowerAtmosphereV2State,
  flowMode: LowerAtmosphereV2FlowMode,
  client: LowerAtmosphereV2Client,
): Promise<LowerAtmosphereV2State> {
  const contract = lowerAtmosphereV2ScenarioForId(state.selectedScenarioId);
  if (!contract) {
    return {
      ...state,
      profileStatus: "error",
      cloudColumnStatus: "error",
      message: "Scenario metadata is missing. Reset the lab or choose another scenario.",
    };
  }

  if (flowMode === "atmosphere_evolution") {
    return runProfileOnly(state, client);
  }

  if (flowMode === "lifted_cloud") {
    return runCloudColumnOnly(state, contract, client);
  }

  const profileState = await runProfileOnly(state, client);
  if (profileState.profileStatus === "error") {
    return profileState;
  }

  return runCloudColumnOnly(profileState, contract, client);
}

export function profileToCloudColumnConfig(
  frame: BoundaryLayer1DFrame,
  contract: LowerAtmosphereV2ScenarioContract,
): { config: CloudColumnConfig; provenance: LowerAtmosphereV2ProfileProvenance } {
  validateProfileFrameForCloudColumn(frame);
  const cloudDefaults = contract.configDefaults.cloudColumnControls;
  const liftDurationSeconds = numberFromDefaults(cloudDefaults.lift_duration_seconds, 1_200);
  const runtimeSeconds = Math.max(
    liftDurationSeconds,
    numberFromDefaults(cloudDefaults.runtime_seconds, 1_800),
  );
  const waterVapor = frame.water_vapor_kg_per_kg.some((value) => value > 0)
    ? [...frame.water_vapor_kg_per_kg]
    : undefined;

  return {
    config: {
      schema_version: "cloud-column-config-v1",
      model_type: "controlled_cloud_column",
      seed: stateSeedFromContract(contract),
      profile: {
        z_m: [...frame.z_m],
        temperature_k: [...frame.temperature_k],
        ...(waterVapor ? { water_vapor_kg_per_kg: waterVapor } : {}),
        relative_humidity_percent: [...frame.relative_humidity_percent],
        surface_pressure_pa: DEFAULT_SURFACE_PRESSURE_PA,
        mixed_layer_depth_m: frame.mixed_layer_depth_m,
        lcl_m: frame.lcl_m,
        inversion_height_m: frame.inversion_height_m,
        inversion_strength_k: frame.inversion_strength_k,
      },
      forcing: {
        updraft_strength_m_per_s: numberFromDefaults(cloudDefaults.updraft_strength_m_per_s, 1),
        lift_duration_seconds: liftDurationSeconds,
        entrainment_drying_factor: numberFromDefaults(cloudDefaults.entrainment_drying_factor, 0),
        heating_tendency_k_per_s: numberFromDefaults(cloudDefaults.heating_tendency_k_per_s, 0),
        runtime_seconds: runtimeSeconds,
        time_step_seconds: numberFromDefaults(cloudDefaults.time_step_seconds, 10),
        frame_interval_seconds: numberFromDefaults(cloudDefaults.frame_interval_seconds, 60),
        cap_suppression_strength: numberFromDefaults(cloudDefaults.cap_suppression_strength, 0),
        initial_cloud_liquid_water_kg_per_kg: numberFromDefaults(
          cloudDefaults.initial_cloud_liquid_water_kg_per_kg,
          0,
        ),
      },
    },
    provenance: {
      source_model: "boundary_layer_1d",
      source_frame_time_seconds: frame.time_seconds,
      source_time_hours_from_sunrise: frame.time_hours_from_sunrise,
      source_scenario_id: contract.id,
      source_profile_status: frame.diagnostics.cloud_formation_potential_status,
      source_profile_kind: frame.step === 0 && frame.diagnostics.cloud_formation_potential_status === "not_evaluated"
        ? "default_profile"
        : "evolved_profile",
    },
  };
}

export function lowerAtmosphereV2RunStatus(state: LowerAtmosphereV2State): LowerAtmosphereV2RunStatus {
  if (state.profileStatus === "error" || state.cloudColumnStatus === "error") {
    return "error";
  }
  if (state.profileStatus === "computing" || state.cloudColumnStatus === "computing") {
    return "computing";
  }
  if (state.profileStatus === "complete" || state.cloudColumnStatus === "complete") {
    return "complete";
  }
  return "ready";
}

export function lowerAtmosphereV2ObservedProfileStatus(
  state: LowerAtmosphereV2State,
): CloudFormationPotentialStatus | null {
  const frames = lowerAtmosphereV2ProfileFrames(state);
  const frame = frames.length > 0 ? selectedLowerAtmosphereV2ProfileFrame(state) : null;
  return frame?.diagnostics.cloud_formation_potential_status ?? null;
}

export function lowerAtmosphereV2ObservedCloudStatus(
  state: LowerAtmosphereV2State,
): LowerAtmosphereV2CloudColumnStatus | null {
  return state.cloudColumnRun?.diagnostics.cloud_formation_status ?? null;
}

export function lowerAtmosphereV2ScenarioCheckLabel(
  expectedProfileStatus: CloudFormationPotentialStatus,
  expectedCloudStatus: LowerAtmosphereV2CloudColumnStatus,
  observedProfileStatus: CloudFormationPotentialStatus | null,
  observedCloudStatus: LowerAtmosphereV2CloudColumnStatus | null,
): string {
  if (!observedProfileStatus && !observedCloudStatus) {
    return "Waiting for run data";
  }
  if (
    (!observedProfileStatus || observedProfileStatus === expectedProfileStatus) &&
    (!observedCloudStatus || observedCloudStatus === expectedCloudStatus)
  ) {
    return "Matches scenario";
  }
  return "Different from expected";
}

export function lowerAtmosphereV2StatusLabel(
  status:
    | CloudFormationPotentialStatus
    | LowerAtmosphereV2CloudColumnStatus
    | LowerAtmosphereV2PrecipitationStatus,
): string {
  switch (status) {
    case "cloud_formed":
      return "Cloud formed";
    case "dry_failed":
      return "Dry failed";
    case "lift_too_weak":
      return "Lift too weak";
    case "evaporated":
      return "Evaporated";
    case "precipitation_not_enabled":
      return "Precipitation not enabled";
    case "cloud_no_rain_path_enabled_later":
      return "Cloud formed; rain path later";
    case "not_evaluated":
      return "Not evaluated";
    default:
      return statusLabel(status);
  }
}

export function buildLowerAtmosphereV2DiagnosticViewModel(
  state: LowerAtmosphereV2State,
  flowMode: LowerAtmosphereV2FlowMode,
  contract: LowerAtmosphereV2ScenarioContract,
): LowerAtmosphereV2DiagnosticViewModel {
  const profileFrames = lowerAtmosphereV2ProfileFrames(state);
  const hasProfileRun = profileFrames.length > 0;
  const selectedFrame = selectedLowerAtmosphereV2ProfileFrame(state);
  const profileStatus = hasProfileRun
    ? selectedFrame.diagnostics.cloud_formation_potential_status
    : null;
  const cloudDiagnostics = state.cloudColumnRun?.diagnostics ?? null;
  const cloudStatus = cloudDiagnostics?.cloud_formation_status ?? null;
  const resultStatus = cloudStatus ?? profileStatus ?? contract.expectedPrecipitationStatus;
  const profileStatusLabel = profileStatus ? statusLabel(profileStatus) : "Profile not run";
  const cloudColumnStatusLabel = cloudStatus
    ? lowerAtmosphereV2CloudStatusLabel(cloudStatus, profileStatus)
    : "Cloud column not run";
  const precipitationStatus = precipitationStatusForState(state, contract.expectedPrecipitationStatus);
  const selectedProfileTimeLabel = formatHoursAfterSunrise(selectedFrame.time_hours_from_sunrise);
  const firstFavorableFrame = profileFrames.find(
    (frame) => frame.diagnostics.cloud_formation_potential_status === "cloud_favorable",
  );
  const scenarioCheckStatus = lowerAtmosphereV2ScenarioCheckLabel(
    contract.expectedProfileStatus,
    contract.expectedCloudColumnStatus,
    profileStatus,
    cloudStatus,
  );
  const mainLimitingFactor = mainLowerAtmosphereV2LimitingFactor(profileStatus, cloudStatus);
  const why = lowerAtmosphereV2Why(resultStatus, selectedFrame, cloudDiagnostics, profileStatus, cloudStatus);

  return {
    resultStatus,
    resultLabel: lowerAtmosphereV2ResultLabel(profileStatus, cloudStatus, resultStatus),
    why,
    tryNext: lowerAtmosphereV2Suggestions(resultStatus),
    keyNumbers: lowerAtmosphereV2KeyNumbers(selectedFrame, cloudDiagnostics),
    assumptions: [
      "Reduced model",
      "1-D profile evolution",
      "Prescribed lift",
      "Controlled cloud formation",
      "Not cloud-resolving dynamics",
      "No Boussinesq default",
      "Not weather prediction",
    ],
    profile: {
      available: hasProfileRun,
      statusLabel: profileStatusLabel,
      reason: hasProfileRun
        ? selectedFrame.diagnostics.cloud_formation_potential_reason
        : "Run profile evolution to compute deterministic profile diagnostics.",
      firstFavorableTimeLabel: firstFavorableFrame
        ? formatHoursAfterSunrise(firstFavorableFrame.time_hours_from_sunrise)
        : "Not reached",
      rows: [
        { label: "Mixed-layer depth", value: formatDiagnosticMeters(selectedFrame.mixed_layer_depth_m) },
        { label: "LCL", value: formatDiagnosticMeters(selectedFrame.lcl_m) },
        {
          label: "Mixed-layer depth minus LCL",
          value: formatDiagnosticMeters(selectedFrame.diagnostics.mixed_layer_lcl_difference_m),
        },
        {
          label: "RH near mixed-layer top",
          value: formatDiagnosticPercent(selectedFrame.diagnostics.rh_near_mixed_layer_top_percent),
        },
        {
          label: "Max RH",
          value: formatDiagnosticPercent(selectedFrame.diagnostics.max_relative_humidity_percent),
        },
        { label: "Inversion height", value: formatDiagnosticMeters(selectedFrame.inversion_height_m) },
        { label: "Inversion strength", value: `${selectedFrame.inversion_strength_k.toFixed(1)} K` },
        {
          label: "Cap suppression index",
          value: selectedFrame.diagnostics.cap_suppression_index.toFixed(2),
        },
        {
          label: "Entrainment drying proxy",
          value: selectedFrame.entrainment_drying_proxy.toExponential(2),
        },
        {
          label: "Surface heating accumulated",
          value: `${selectedFrame.surface_heating_accumulated_k.toFixed(2)} K`,
        },
        {
          label: "Surface moisture added",
          value: selectedFrame.surface_moisture_added_kg_per_kg.toExponential(2),
        },
        { label: "First favorable time", value: firstFavorableFrame ? formatHoursAfterSunrise(firstFavorableFrame.time_hours_from_sunrise) : "Not reached" },
      ],
    },
    cloudColumn: {
      available: cloudDiagnostics !== null,
      statusLabel: cloudColumnStatusLabel,
      reason:
        cloudDiagnostics?.cloud_formation_reason ??
        "Run prescribed lift to compute deterministic cloud-column diagnostics.",
      prescribedForcingLabel: "Prescribed lift, not predicted dynamics",
      rows: [
        {
          label: "First saturation time",
          value: formatDiagnosticSeconds(cloudDiagnostics?.first_saturation_time_seconds ?? null),
        },
        {
          label: "First cloud time",
          value: formatDiagnosticSeconds(cloudDiagnostics?.first_cloud_time_seconds ?? null),
        },
        {
          label: "Cloud base",
          value: formatDiagnosticMeters(cloudDiagnostics?.cloud_base_m ?? null),
        },
        {
          label: "Cloud-top proxy",
          value: formatDiagnosticMeters(cloudDiagnostics?.cloud_top_proxy_m ?? null),
        },
        {
          label: "Max RH",
          value: formatDiagnosticPercent(cloudDiagnostics?.max_relative_humidity_percent ?? null),
        },
        {
          label: "Max cloud liquid water",
          value: formatDiagnosticKgPerKg(cloudDiagnostics?.max_cloud_liquid_water_kg_per_kg ?? null),
        },
        {
          label: "Total condensed",
          value: formatDiagnosticKgPerKg(cloudDiagnostics?.water_budget.total_condensed_kg_per_kg ?? null),
        },
        {
          label: "Total evaporated",
          value: formatDiagnosticKgPerKg(cloudDiagnostics?.water_budget.total_evaporated_kg_per_kg ?? null),
        },
        {
          label: "Water-budget drift",
          value: formatDiagnosticKgPerKg(cloudDiagnostics?.water_budget.max_absolute_drift_kg_per_kg ?? null),
        },
        {
          label: "Cap restriction flag",
          value: cloudStatus === "cap_suppressed" ? "Restricted by cap" : cloudDiagnostics ? "Not flagged" : "Not evaluated",
        },
      ],
    },
    combined: {
      selectedProfileTimeLabel,
      profileStatusLabel,
      cloudColumnStatusLabel,
      mainLimitingFactor,
      suggestedNextExperiment: lowerAtmosphereV2Suggestions(resultStatus)[0] ?? "change one physical control and run again",
    },
    scenarioCheck: {
      expectedLabel: `${statusLabel(contract.expectedProfileStatus)} / ${lowerAtmosphereV2CloudStatusLabel(contract.expectedCloudColumnStatus, contract.expectedProfileStatus)}`,
      observedLabel: `${profileStatusLabel} / ${cloudColumnStatusLabel}`,
      statusLabel: scenarioCheckStatus,
    },
    precipitation: {
      status: precipitationStatus,
      statusLabel: lowerAtmosphereV2StatusLabel(precipitationStatus),
      explanation: precipitationExplanation(precipitationStatus),
      tryNext: lowerAtmosphereV2Suggestions(precipitationStatus),
    },
  };
}

async function runProfileOnly(
  state: LowerAtmosphereV2State,
  client: LowerAtmosphereV2Client,
): Promise<LowerAtmosphereV2State> {
  try {
    const run = await client.runProfile(state.profileConfig);
    const frames = usableBoundaryLayerFrames(run);
    if (frames.length === 0) {
      return {
        ...state,
        profileRun: run,
        selectedProfileFrameIndex: 0,
        profileStatus: "error",
        cloudColumnStatus: "ready",
        profileProvenance: null,
        message: "Profile evolution returned no usable frames. Choose another scenario or reset the lab.",
      };
    }

    const finalFrameIndex = frames.length - 1;
    const finalFrame = frames[finalFrameIndex];
    return {
      ...state,
      profileRun: { ...run, frames },
      selectedProfileFrameIndex: finalFrameIndex,
      profileStatus: "complete",
      cloudColumnRun: null,
      cloudColumnStatus: "ready",
      profileProvenance: provenanceForFrame(finalFrame, state.selectedScenarioId, "evolved_profile"),
      cloudColumnProvenance: null,
      message: `Run complete. Generated ${frames.length} profile samples. Use the timeline to inspect the selected profile.`,
    };
  } catch (error) {
    return {
      ...state,
      profileStatus: "error",
      message: error instanceof Error ? error.message : "Unable to run profile evolution.",
    };
  }
}

async function runCloudColumnOnly(
  state: LowerAtmosphereV2State,
  contract: LowerAtmosphereV2ScenarioContract,
  client: LowerAtmosphereV2Client,
): Promise<LowerAtmosphereV2State> {
  try {
    const frame = selectedLowerAtmosphereV2ProfileFrame(state);
    const { config, provenance } = profileToCloudColumnConfig(frame, contract);
    const run = await client.runCloudColumn(config);
    if (!Array.isArray(run.frames) || run.frames.length === 0) {
      return {
        ...state,
        cloudColumnRun: run,
        cloudColumnStatus: "error",
        cloudColumnProvenance: provenance,
        message: "Cloud-column run returned no frames. The prescribed-lift result cannot be displayed.",
      };
    }

    return {
      ...state,
      cloudColumnRun: run,
      cloudColumnStatus: "complete",
      cloudColumnProvenance: provenance,
      message: lowerAtmosphereV2RunCompleteMessage(state, run.frames.length, provenance),
    };
  } catch (error) {
    return {
      ...state,
      cloudColumnStatus: "error",
      message: error instanceof Error ? error.message : "Unable to run prescribed cloud column.",
    };
  }
}

function profileConfigForScenario(contract: LowerAtmosphereV2ScenarioContract): BoundaryLayer1DConfig {
  const preset =
    boundaryLayer1DScenarioPresets.find(
      (candidate) => candidate.slug === contract.configDefaults.profilePresetId,
    ) ?? boundaryLayer1DScenarioPresets[0];
  const nextConfig = cloneProfileConfig(preset.config);

  for (const [key, value] of Object.entries(contract.configDefaults.profileControls)) {
    if (typeof value === "number" && key in nextConfig) {
      (nextConfig as Record<string, unknown>)[key] = value;
    }
  }

  return nextConfig;
}

function lowerAtmosphereV2Why(
  status:
    | CloudFormationPotentialStatus
    | LowerAtmosphereV2CloudColumnStatus
    | LowerAtmosphereV2PrecipitationStatus,
  frame: BoundaryLayer1DFrame,
  cloudDiagnostics: CloudColumnDiagnostics | null,
  profileStatus: CloudFormationPotentialStatus | null,
  cloudStatus: LowerAtmosphereV2CloudColumnStatus | null,
): string {
  const mixedLayer = Math.round(frame.mixed_layer_depth_m);
  const lcl = Math.round(frame.lcl_m);
  const gap = Math.round(Math.abs(frame.diagnostics.mixed_layer_lcl_difference_m));

  switch (status) {
    case "moisture_limited":
      return `The mixed layer reached ${mixedLayer} m, but the LCL stayed near ${lcl} m. That leaves a ${gap} m gap, so rising air does not reach saturation.`;
    case "heating_limited":
      return `Surface heating has not deepened the mixed layer enough: it reached ${mixedLayer} m while the LCL stayed near ${lcl} m.`;
    case "cap_suppressed":
      return `The cap near ${Math.round(frame.inversion_height_m)} m limited growth or prescribed lift before the setup could produce the expected cloud outcome.`;
    case "dry_entrainment_suppressed":
      return `Dry entrainment kept RH near the mixed-layer top near ${frame.diagnostics.rh_near_mixed_layer_top_percent.toFixed(0)}%, reducing cloud formation potential.`;
    case "cloud_favorable":
      return `The mixed layer reached ${mixedLayer} m with the LCL near ${lcl} m, so the environment became favorable for shallow cloud formation potential.`;
    case "cloud_formed":
      if (profileStatus && profileStatus !== "cloud_favorable" && cloudStatus === "cloud_formed") {
        return "The atmosphere did not become cloud-favorable on its own, but prescribed lift cooled the selected profile enough to reach saturation and form cloud. This is controlled lift, not predicted free convection.";
      }
      if (profileStatus === "cloud_favorable") {
        return `The environment was cloud-favorable, and prescribed lift formed cloud liquid water at ${formatDiagnosticSeconds(cloudDiagnostics?.first_cloud_time_seconds ?? null)}.`;
      }
      return `Prescribed lift cooled the selected profile enough to form cloud liquid water at ${formatDiagnosticSeconds(cloudDiagnostics?.first_cloud_time_seconds ?? null)}.`;
    case "dry_failed":
      if (profileStatus === "moisture_limited") {
        return "Both the atmosphere evolution and the lifted column remained too dry to form meaningful cloud water.";
      }
      return "The parcel was lifted, but the selected profile was too dry to approach saturation and form cloud liquid water.";
    case "lift_too_weak":
      if (profileStatus === "cap_suppressed") {
        return "The profile was cap-suppressed, and the prescribed lift was absent or too weak to overcome that limitation in the controlled column.";
      }
      return "Prescribed lift was absent or too weak to cool the parcel enough for cloud formation.";
    case "evaporated":
      return "Cloud formed during prescribed lift, then evaporated as the parcel encountered subsaturated air.";
    case "precipitation_not_enabled":
      return "Rain physics is not enabled in Lower Atmosphere v2 yet; cloud water is preserved as a future warm-rain handoff signal.";
    case "cloud_no_rain_path_enabled_later":
      return "Cloud water is available, but the warm-rain microphysics path is intentionally deferred.";
    case "no_flux_control":
      return "No meaningful heating or moisture forcing was applied, so the profile remains a control case.";
    case "not_favorable_yet":
      return "The profile evolved, but mixed-layer depth, LCL, RH, and cap state have not aligned for shallow-cumulus potential yet.";
    case "not_evaluated":
      return "Run the selected Lower Atmosphere v2 flow to compute deterministic diagnostics.";
  }
}

function lowerAtmosphereV2ResultLabel(
  profileStatus: CloudFormationPotentialStatus | null,
  cloudStatus: LowerAtmosphereV2CloudColumnStatus | null,
  resultStatus:
    | CloudFormationPotentialStatus
    | LowerAtmosphereV2CloudColumnStatus
    | LowerAtmosphereV2PrecipitationStatus,
): string {
  if (cloudStatus) {
    return lowerAtmosphereV2CloudStatusLabel(cloudStatus, profileStatus);
  }
  return lowerAtmosphereV2StatusLabel(resultStatus);
}

function lowerAtmosphereV2CloudStatusLabel(
  cloudStatus: LowerAtmosphereV2CloudColumnStatus,
  profileStatus: CloudFormationPotentialStatus | null,
): string {
  if (cloudStatus === "cloud_formed" && profileStatus && profileStatus !== "cloud_favorable") {
    return "Cloud formed under prescribed lift";
  }
  if (cloudStatus === "dry_failed") {
    return "Dry failed / no cloud";
  }
  if (cloudStatus === "lift_too_weak") {
    return "Lift too weak / no cloud";
  }
  return lowerAtmosphereV2StatusLabel(cloudStatus);
}

function lowerAtmosphereV2RunCompleteMessage(
  state: LowerAtmosphereV2State,
  cloudColumnSampleCount: number,
  provenance: LowerAtmosphereV2ProfileProvenance,
): string {
  const profileSampleCount = lowerAtmosphereV2ProfileFrames(state).length;
  if (profileSampleCount > 0) {
    return `Run complete. Generated ${profileSampleCount} profile samples and ${cloudColumnSampleCount} cloud-column samples. Use the timeline to inspect the selected profile and lifted-column result. Lift is prescribed, not predicted dynamics.`;
  }
  return `Run complete. Generated ${cloudColumnSampleCount} cloud-column samples from ${formatHoursAfterSunrise(provenance.source_time_hours_from_sunrise)}. Use the timeline to inspect the lifted-column result. Lift is prescribed, not predicted dynamics.`;
}

function lowerAtmosphereV2Suggestions(
  status:
    | CloudFormationPotentialStatus
    | LowerAtmosphereV2CloudColumnStatus
    | LowerAtmosphereV2PrecipitationStatus,
): string[] {
  switch (status) {
    case "moisture_limited":
      return ["increase surface moisture flux", "start with higher mixed-layer humidity", "reduce dry entrainment"];
    case "heating_limited":
      return ["increase surface heating", "run longer after sunrise"];
    case "cap_suppressed":
      return ["raise the inversion height", "weaken the inversion", "compare against weak-cap scenario"];
    case "dry_entrainment_suppressed":
      return ["reduce entrainment strength", "use less dry air above the mixed layer"];
    case "cloud_formed":
      return ["compare with a drier profile", "reduce lift strength to find the threshold", "inspect cloud base and first cloud time"];
    case "dry_failed":
      return ["increase humidity", "use a later evolved profile", "increase lift duration"];
    case "lift_too_weak":
      return ["increase lift strength", "extend lift duration"];
    case "precipitation_not_enabled":
    case "cloud_no_rain_path_enabled_later":
      return ["run or design a warm-rain microphysics path later", "inspect cloud water amount and duration as rain-readiness signals"];
    case "cloud_favorable":
      return ["run prescribed lift from this profile", "compare with a drier or capped scenario"];
    default:
      return ["change one physical control and run again"];
  }
}

function lowerAtmosphereV2KeyNumbers(
  frame: BoundaryLayer1DFrame,
  cloudDiagnostics: CloudColumnDiagnostics | null,
): Array<{ label: string; value: string }> {
  return [
    { label: "mixed-layer depth", value: formatDiagnosticMeters(frame.mixed_layer_depth_m) },
    { label: "LCL", value: formatDiagnosticMeters(frame.lcl_m) },
    {
      label: "RH near mixed-layer top",
      value: formatDiagnosticPercent(frame.diagnostics.rh_near_mixed_layer_top_percent),
    },
    {
      label: "first cloud time",
      value: formatDiagnosticSeconds(cloudDiagnostics?.first_cloud_time_seconds ?? null),
    },
    {
      label: "max cloud liquid water",
      value: formatDiagnosticKgPerKg(cloudDiagnostics?.max_cloud_liquid_water_kg_per_kg ?? null),
    },
  ];
}

function mainLowerAtmosphereV2LimitingFactor(
  profileStatus: CloudFormationPotentialStatus | null,
  cloudStatus: LowerAtmosphereV2CloudColumnStatus | null,
): string {
  const status = cloudStatus ?? profileStatus;
  switch (status) {
    case "moisture_limited":
    case "dry_failed":
      return "Moisture availability";
    case "heating_limited":
      return "Surface heating / profile evolution time";
    case "cap_suppressed":
      return "Cap / inversion";
    case "dry_entrainment_suppressed":
      return "Dry entrainment";
    case "lift_too_weak":
      return "Prescribed lift strength or duration";
    case "cloud_formed":
    case "cloud_favorable":
      return "No active limiter for the observed reduced-model outcome";
    default:
      return "Not evaluated";
  }
}

function precipitationStatusForState(
  state: LowerAtmosphereV2State,
  expectedStatus: LowerAtmosphereV2PrecipitationStatus,
): LowerAtmosphereV2PrecipitationStatus {
  if (!state.cloudColumnRun) {
    return "not_evaluated";
  }
  if (state.cloudColumnRun.diagnostics.max_cloud_liquid_water_kg_per_kg <= 0) {
    return "not_evaluated";
  }
  return expectedStatus === "cloud_no_rain_path_enabled_later"
    ? "cloud_no_rain_path_enabled_later"
    : "precipitation_not_enabled";
}

function precipitationExplanation(status: LowerAtmosphereV2PrecipitationStatus): string {
  switch (status) {
    case "precipitation_not_enabled":
      return "Precipitation is not enabled in this version. Cloud water is available for future warm-rain diagnostics.";
    case "cloud_no_rain_path_enabled_later":
      return "Cloud water formed, but the rain path is reserved for a later warm-rain microphysics issue.";
    case "not_evaluated":
      return "Precipitation is not evaluated. Run a cloud-column flow and form cloud water before rain-readiness can be inspected.";
  }
}

function formatDiagnosticMeters(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "Not available" : `${Math.round(value).toLocaleString()} m`;
}

function formatDiagnosticSeconds(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "Not available";
  }
  if (value >= 3_600) {
    return `${(value / 3_600).toFixed(1)} h`;
  }
  return `${Math.round(value).toLocaleString()} s`;
}

function formatDiagnosticPercent(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "Not available" : `${value.toFixed(0)}%`;
}

function formatDiagnosticKgPerKg(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "Not available" : `${value.toExponential(2)} kg/kg`;
}

function validateProfileFrameForCloudColumn(frame: BoundaryLayer1DFrame): void {
  const expectedLength = frame.z_m.length;
  if (expectedLength < 2) {
    throw new Error("Selected profile must contain at least two height levels.");
  }
  if (!sameFiniteLength(frame.temperature_k, expectedLength)) {
    throw new Error("Selected profile is missing a valid temperature profile.");
  }
  if (
    !sameFiniteLength(frame.water_vapor_kg_per_kg, expectedLength) &&
    !sameFiniteLength(frame.relative_humidity_percent, expectedLength)
  ) {
    throw new Error("Selected profile needs water vapor or relative humidity for cloud-column input.");
  }
  if (!isStrictlyIncreasing(frame.z_m)) {
    throw new Error("Selected profile heights must be strictly increasing.");
  }
}

function provenanceForFrame(
  frame: BoundaryLayer1DFrame,
  scenarioId: string,
  sourceProfileKind: LowerAtmosphereV2ProfileProvenance["source_profile_kind"],
): LowerAtmosphereV2ProfileProvenance {
  return {
    source_model: "boundary_layer_1d",
    source_frame_time_seconds: frame.time_seconds,
    source_time_hours_from_sunrise: frame.time_hours_from_sunrise,
    source_scenario_id: scenarioId,
    source_profile_status: frame.diagnostics.cloud_formation_potential_status,
    source_profile_kind: sourceProfileKind,
  };
}

function numberFromDefaults(value: string | number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stateSeedFromContract(contract: LowerAtmosphereV2ScenarioContract): number {
  const preset = boundaryLayer1DScenarioPresets.find(
    (candidate) => candidate.slug === contract.configDefaults.profilePresetId,
  );
  return preset?.config.seed ?? 1;
}

function sameFiniteLength(values: number[] | undefined, expectedLength: number): values is number[] {
  return Array.isArray(values) && values.length === expectedLength && values.every(Number.isFinite);
}

function isStrictlyIncreasing(values: number[]): boolean {
  return values.every((value, index) => index === 0 || value > values[index - 1]);
}

function clampIndex(index: number, frameCount: number): number {
  if (!Number.isFinite(index) || frameCount <= 0) {
    return 0;
  }

  return Math.min(Math.max(0, Math.round(index)), frameCount - 1);
}

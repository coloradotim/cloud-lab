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
      message: `Profile evolution complete. Selected ${formatHoursAfterSunrise(finalFrame.time_hours_from_sunrise)} for possible prescribed lift.`,
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
      message: `Cloud-column run complete from ${formatHoursAfterSunrise(provenance.source_time_hours_from_sunrise)}. Lift is prescribed, not predicted dynamics.`,
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

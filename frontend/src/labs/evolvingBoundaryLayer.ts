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
  status: "idle" | "starting" | "complete" | "error";
  message: string | null;
  saveMessage: string | null;
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
    status: "idle",
    message: null,
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
    status: "idle",
    message: null,
    saveMessage: null,
  };
}

export function updateBoundaryLayer1DControl(
  state: BoundaryLayer1DState,
  controlId: BoundaryLayer1DControlId,
  value: number,
): BoundaryLayer1DState {
  return {
    ...state,
    config: {
      ...state.config,
      [controlId]: value,
    },
    run: null,
    displayedFrameIndex: 0,
    status: "idle",
    message: null,
    saveMessage: null,
  };
}

export function boundaryLayerDisplayedFrame(
  state: BoundaryLayer1DState,
): BoundaryLayer1DFrame | null {
  if (!state.run?.frames.length) {
    return null;
  }

  const index = Math.min(
    Math.max(0, state.displayedFrameIndex),
    state.run.frames.length - 1,
  );
  return state.run.frames[index] ?? null;
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

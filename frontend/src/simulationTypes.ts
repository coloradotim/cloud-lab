export type ScalarField = {
  values: number[][];
  metadata: {
    unit: string;
    display_name: string;
    description: string;
    display_scale?: {
      min_value?: number | null;
      max_value?: number | null;
      color_map?: string;
    };
  };
};

export type SimulationConfig = {
  schema_version: "sim-config-v1";
  solver_type: "educational_2d" | "boussinesq_2d" | "microphysics_lab";
  domain: {
    width_m: number;
    height_m: number;
  };
  grid: {
    columns: number;
    rows: number;
  };
  time: {
    time_step_seconds: number;
    duration_seconds: number;
    frame_interval_seconds: number;
  };
  initial_atmosphere: {
    surface_temperature_k: number;
    lapse_rate_k_per_m: number;
    relative_humidity: number;
    boundary_layer_depth_m: number;
  };
  surface_heating: {
    max_warming_rate_k_per_s: number;
    patch_center_x_m: number;
    patch_width_m: number;
  };
  background_wind: {
    u_m_per_s: number;
    w_m_per_s: number;
  };
  seed: number;
};

export type MicrophysicsPayload = {
  schema_version?: string;
  bin_axis?: {
    name?: string;
    edge_values?: number[];
    unit?: string;
    scale?: string;
    closed?: string;
  };
  global_distribution?: {
    scope?: string;
    products?: Array<{
      product?: string;
      unit?: string;
      normalization?: string;
      values?: number[];
    }>;
    summary?: Record<string, number | string | null | undefined>;
  };
};

export type SimulationFrame = {
  schema_version: "sim-frame-v1";
  step: number;
  time_seconds: number;
  config?: SimulationConfig;
  grid: {
    columns: number;
    rows: number;
    x_coordinates_m: number[];
    z_coordinates_m: number[];
  };
  fields: Record<string, ScalarField>;
  microphysics?: MicrophysicsPayload | null;
};

export type SolverDescriptor = {
  solver_type: SimulationConfig["solver_type"];
  name: string;
  description: string;
  status: "available" | "planned" | string;
  limitations: string[];
};

export type SimulationPreset = {
  slug: string;
  name: string;
  description: string;
  config: SimulationConfig;
};

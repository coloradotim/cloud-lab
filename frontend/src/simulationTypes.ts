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

export type SimulationFrame = {
  schema_version: "sim-frame-v1";
  step: number;
  time_seconds: number;
  grid: {
    columns: number;
    rows: number;
    x_coordinates_m: number[];
    z_coordinates_m: number[];
  };
  fields: Record<string, ScalarField>;
};

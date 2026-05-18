export type ReferenceMetadataValue = string | number | boolean | null;

export type ReferenceGridMetadata = {
  columns: number;
  rows: number;
  x_coordinates_m: number[];
  z_coordinates_m: number[];
};

export type ReferenceProvenance = {
  source_model: "CM1";
  source_case_id: string;
  source_file_metadata: Record<string, ReferenceMetadataValue>;
  adapter_name: string;
  adapter_version: string;
  source_is_synthetic_fixture: boolean;
};

export type ReferenceFieldMetadata = {
  unit: string;
  display_name: string;
  description: string;
  source_variable: string;
  standard_name: string;
  provenance: string;
};

export type ReferenceScalarField2D = {
  values: number[][];
  metadata: ReferenceFieldMetadata;
};

export type ReferenceFrame = {
  schema_version: "reference-frame-v1";
  source_model: "CM1";
  source_case_id: string;
  source_file_metadata: Record<string, ReferenceMetadataValue>;
  time_seconds: number;
  grid: ReferenceGridMetadata;
  fields: Record<string, ReferenceScalarField2D>;
  provenance: ReferenceProvenance;
  assumptions: string[];
  warnings: string[];
};

export type ReferenceDiagnostics = {
  schema_version: "reference-diagnostics-v1";
  source_model: "CM1";
  source_case_id: string;
  available_fields: string[];
  missing_field_warnings: string[];
  max_cloud_liquid_water_kg_per_kg: number | null;
  integrated_cloud_liquid_water_kg_per_kg: number | null;
  cloud_base_m: number | null;
  cloud_top_m: number | null;
  first_cloud_time_seconds: number | null;
  max_updraft_m_per_s: number | null;
  first_rain_time_seconds: number | null;
  max_rain_water_kg_per_kg: number | null;
  source_provenance: ReferenceProvenance;
  visualization_ready: boolean;
};

export type ReferenceRun = {
  schema_version: "reference-run-v1";
  source_model: "CM1";
  source_case_id: string;
  frames: ReferenceFrame[];
  diagnostics: ReferenceDiagnostics | null;
  warnings: string[];
};

import type { ReferenceFrame, ReferenceRun, ReferenceScalarField2D } from "./referenceTypes";

export function createTinyCm1ReferenceRunFixture(): ReferenceRun {
  const sourceCaseId = "cm1-shallow-cumulus-baseline-v1";
  const provenance = {
    source_model: "CM1" as const,
    source_case_id: sourceCaseId,
    source_file_metadata: {
      fixture: true,
      purpose: "frontend reference replay tests",
    },
    adapter_name: "cm1_reference_adapter",
    adapter_version: "cm1-reference-adapter-v1",
    source_is_synthetic_fixture: true,
  };
  const grid = {
    columns: 4,
    rows: 3,
    x_coordinates_m: [0, 500, 1000, 1500],
    z_coordinates_m: [0, 500, 1000],
  };
  const common = {
    schema_version: "reference-frame-v1" as const,
    source_model: "CM1" as const,
    source_case_id: sourceCaseId,
    source_file_metadata: provenance.source_file_metadata,
    grid,
    provenance,
    assumptions: [
      "CM1 output is offline reference-model output.",
      "Cloud Lab does not run CM1 in normal app sessions.",
      "Synthetic fixture data is not scientific truth.",
    ],
    warnings: ["Missing CM1 field for rain_water_kg_per_kg."],
  };

  const frames: ReferenceFrame[] = [
    {
      ...common,
      time_seconds: 0,
      fields: frameFields({
        cloud: [
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
        w: [
          [0.01, 0.04, 0.02, 0],
          [0.02, 0.08, 0.03, 0.01],
          [0, 0.02, 0.01, 0],
        ],
      }),
    },
    {
      ...common,
      time_seconds: 300,
      fields: frameFields({
        cloud: [
          [0, 0, 0, 0],
          [0, 2e-7, 5e-7, 0],
          [0, 1e-7, 2e-7, 0],
        ],
        w: [
          [0.02, 0.09, 0.04, 0],
          [0.03, 0.28, 0.12, 0.01],
          [0.01, 0.18, 0.08, 0],
        ],
      }),
    },
  ];

  return {
    schema_version: "reference-run-v1",
    source_model: "CM1",
    source_case_id: sourceCaseId,
    frames,
    diagnostics: {
      schema_version: "reference-diagnostics-v1",
      source_model: "CM1",
      source_case_id: sourceCaseId,
      available_fields: [
        "cloud_liquid_water_kg_per_kg",
        "potential_temperature_k",
        "vertical_velocity_m_per_s",
        "water_vapor_kg_per_kg",
      ],
      missing_field_warnings: ["Missing CM1 field for rain_water_kg_per_kg."],
      max_cloud_liquid_water_kg_per_kg: 5e-7,
      integrated_cloud_liquid_water_kg_per_kg: 1e-6,
      cloud_base_m: 500,
      cloud_top_m: 1000,
      first_cloud_time_seconds: 300,
      max_updraft_m_per_s: 0.28,
      first_rain_time_seconds: null,
      max_rain_water_kg_per_kg: null,
      source_provenance: provenance,
      visualization_ready: true,
    },
    warnings: ["Missing CM1 field for rain_water_kg_per_kg."],
  };
}

export function createTinyCm1DryFailedReferenceRunFixture(): ReferenceRun {
  const run = createTinyCm1ReferenceRunFixture();
  const sourceCaseId = "cm1-dry-failed-cumulus-v1";
  return {
    ...run,
    source_case_id: sourceCaseId,
    frames: run.frames.map((frame) => ({
      ...frame,
      source_case_id: sourceCaseId,
      provenance: {
        ...frame.provenance,
        source_case_id: sourceCaseId,
      },
      fields: frameFields({
        cloud: frame.fields.cloud_liquid_water_kg_per_kg.values.map((row) => row.map(() => 0)),
        w: frame.fields.vertical_velocity_m_per_s.values,
      }),
    })),
    diagnostics: run.diagnostics
      ? {
          ...run.diagnostics,
          source_case_id: sourceCaseId,
          max_cloud_liquid_water_kg_per_kg: 0,
          integrated_cloud_liquid_water_kg_per_kg: 0,
          cloud_base_m: null,
          cloud_top_m: null,
          first_cloud_time_seconds: null,
          max_updraft_m_per_s: 0.28,
          first_rain_time_seconds: null,
          max_rain_water_kg_per_kg: null,
          source_provenance: {
            ...run.diagnostics.source_provenance,
            source_case_id: sourceCaseId,
          },
        }
      : null,
  };
}

function frameFields({ cloud, w }: { cloud: number[][]; w: number[][] }): Record<string, ReferenceScalarField2D> {
  return {
    cloud_liquid_water_kg_per_kg: field("Cloud liquid water", "kg kg-1", "qc", cloud),
    water_vapor_kg_per_kg: field("Water vapor", "kg kg-1", "qv", [
      [0.013, 0.013, 0.013, 0.013],
      [0.011, 0.011, 0.011, 0.011],
      [0.008, 0.008, 0.008, 0.008],
    ]),
    potential_temperature_k: field("Potential temperature", "K", "theta", [
      [299.0, 299.1, 299.1, 299.0],
      [301.0, 301.2, 301.2, 301.0],
      [304.0, 304.3, 304.2, 304.0],
    ]),
    vertical_velocity_m_per_s: field("Vertical velocity", "m s-1", "w", w),
  };
}

function field(displayName: string, unit: string, sourceVariable: string, values: number[][]): ReferenceScalarField2D {
  return {
    values,
    metadata: {
      unit,
      display_name: displayName,
      description: `${displayName} from offline CM1/reference output.`,
      source_variable: sourceVariable,
      standard_name: sourceVariable,
      provenance: "Mapped from offline CM1/reference output.",
    },
  };
}

import { describe, expect, it } from "vitest";

import {
  createTinyCm1DryFailedReferenceRunFixture,
  createTinyCm1ReferenceRunFixture,
} from "../reference/referenceFixtures";
import { lowerAtmosphereV2ScenarioContracts } from "./lowerAtmosphereV2Scenarios";
import {
  buildLowerAtmosphereV2ReferenceComparisonViewModel,
  lowerAtmosphereV2ReferenceMappingForScenario,
} from "./lowerAtmosphereV2ReferenceComparison";
import { createInitialLowerAtmosphereV2State } from "./lowerAtmosphereV2Orchestration";

const baselineContract = lowerAtmosphereV2ScenarioContracts.find(
  (scenario) => scenario.id === "lower-atmosphere-v2-baseline-shallow-cloud",
);
const dryFailedContract = lowerAtmosphereV2ScenarioContracts.find(
  (scenario) => scenario.id === "lower-atmosphere-v2-dry-failed-cumulus",
);

describe("Lower Atmosphere v2 CM1 reference comparison", () => {
  it("maps reduced scenarios to expected reference case ids where available", () => {
    expect(
      lowerAtmosphereV2ReferenceMappingForScenario("lower-atmosphere-v2-baseline-shallow-cloud")
        ?.referenceCaseId,
    ).toBe("cm1-shallow-cumulus-baseline-v1");
    expect(
      lowerAtmosphereV2ReferenceMappingForScenario("lower-atmosphere-v2-dry-failed-cumulus")
        ?.referenceCaseId,
    ).toBe("cm1-dry-failed-cumulus-v1");
  });

  it("renders comparison diagnostics with provenance labels when reference data exists", () => {
    if (!baselineContract) {
      throw new Error("Missing baseline Lower Atmosphere v2 contract");
    }

    const viewModel = buildLowerAtmosphereV2ReferenceComparisonViewModel({
      contract: baselineContract,
      state: createInitialLowerAtmosphereV2State(baselineContract.id),
      referenceRuns: [createTinyCm1ReferenceRunFixture()],
    });

    expect(viewModel.fallbackMessage).toBeNull();
    expect(viewModel.mapping?.referenceCaseId).toBe("cm1-shallow-cumulus-baseline-v1");
    expect(viewModel.sourceLabels).toEqual(
      expect.arrayContaining([
        "Reduced model output",
        "CM1 reference output",
        "Offline reference case",
        "Derived diagnostic",
        "Not live CM1 simulation",
      ]),
    );
    expect(viewModel.preRunExplanation).toContain("Reference case is available before you run");
    expect(viewModel.story.title).toBe("CM1 reference is ready");
    expect(viewModel.story.outcome).toContain("offline CM1 reference case is available");
    expect(viewModel.rows.map((row) => row.diagnostic)).toEqual(
      expect.arrayContaining([
        "Outcome",
        "Timing",
        "Cloud depth",
        "Cloud amount",
        "Updraft",
        "Rain",
      ]),
    );
  });

  it("shows missing reference fallback for mapped scenarios without loaded reference data", () => {
    if (!dryFailedContract) {
      throw new Error("Missing dry-failed Lower Atmosphere v2 contract");
    }

    const viewModel = buildLowerAtmosphereV2ReferenceComparisonViewModel({
      contract: dryFailedContract,
      state: createInitialLowerAtmosphereV2State(dryFailedContract.id),
      referenceRuns: [createTinyCm1ReferenceRunFixture()],
    });

    expect(viewModel.mapping?.referenceCaseId).toBe("cm1-dry-failed-cumulus-v1");
    expect(viewModel.referenceRun).toBeNull();
    expect(viewModel.fallbackMessage).toContain("No real local CM1 reference output is available");
    expect(viewModel.fallbackMessage).toContain("cm1-dry-failed-cumulus-v1");
  });

  it("does not present exact morphology as pass/fail", () => {
    if (!baselineContract) {
      throw new Error("Missing baseline Lower Atmosphere v2 contract");
    }

    const viewModel = buildLowerAtmosphereV2ReferenceComparisonViewModel({
      contract: baselineContract,
      state: createInitialLowerAtmosphereV2State(baselineContract.id),
      referenceRuns: [createTinyCm1ReferenceRunFixture()],
    });

    expect(viewModel.morphologyNote).toContain("Exact cloud morphology is not presented as pass/fail");
    expect(JSON.stringify(viewModel)).not.toMatch(/morphology pass/i);
    expect(viewModel.sourceLabels).toContain("Not live CM1 simulation");
    expect(viewModel.sourceLabels).toContain("Synthetic fixture data");
    expect(viewModel.sourceLabels).toContain("Not scientific truth");
    expect(viewModel.rows.every((row) => row.category.length > 0)).toBe(true);
  });

  it("builds deterministic dry-failed story and cards when dry reference data exists", () => {
    if (!dryFailedContract) {
      throw new Error("Missing dry-failed Lower Atmosphere v2 contract");
    }

    const state = {
      ...createInitialLowerAtmosphereV2State(dryFailedContract.id),
      cloudColumnRun: {
        schema_version: "cloud-column-run-v1" as const,
        config: {} as never,
        frames: [],
        diagnostics: {
          cloud_formation_status: "dry_failed" as const,
          cloud_formation_reason: "Moisture limited.",
          first_saturation_time_seconds: null,
          first_cloud_time_seconds: null,
          cloud_base_m: null,
          cloud_top_proxy_m: null,
          max_relative_humidity_percent: 82,
          max_cloud_liquid_water_kg_per_kg: 0,
          water_budget: {
            initial_total_water_kg_per_kg: 0,
            final_total_water_kg_per_kg: 0,
            max_absolute_drift_kg_per_kg: 0,
            total_condensed_kg_per_kg: 0,
            total_evaporated_kg_per_kg: 0,
          },
          forcing: {
            forcing_type: "prescribed_lift" as const,
            dynamics_label: "prescribed, not predicted" as const,
            updraft_strength_m_per_s: 1.2,
            lift_duration_seconds: 1200,
            entrainment_drying_factor: 0,
            heating_tendency_k_per_s: 0,
          },
        },
      },
      cloudColumnStatus: "complete" as const,
    };

    const viewModel = buildLowerAtmosphereV2ReferenceComparisonViewModel({
      contract: dryFailedContract,
      state,
      referenceRuns: [createTinyCm1DryFailedReferenceRunFixture()],
    });

    expect(viewModel.story.outcome).toBe("Both the reduced model and CM1 reference stayed cloud-free.");
    expect(viewModel.story.keyPoint).toContain("moisture-limited");
    expect(viewModel.rows.find((row) => row.diagnostic === "Outcome")?.referenceValue).toBe("Dry failed");
    expect(viewModel.rows.find((row) => row.diagnostic === "Cloud amount")?.reducedValue).toBe("0 kg/kg");
  });
});

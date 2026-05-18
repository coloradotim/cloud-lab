import { describe, expect, it } from "vitest";

import { createTinyCm1ReferenceRunFixture } from "../reference/referenceFixtures";
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
    expect(viewModel.rows.map((row) => row.diagnostic)).toEqual(
      expect.arrayContaining([
        "Cloud/no-cloud status",
        "First cloud time",
        "Cloud base",
        "Cloud top",
        "Max cloud water",
        "Max updraft",
        "Rain onset",
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
});

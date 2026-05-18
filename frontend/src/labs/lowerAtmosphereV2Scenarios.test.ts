import { describe, expect, it } from "vitest";

import {
  lowerAtmosphereV2ComparisonPairs,
  lowerAtmosphereV2HonestyLabels,
  lowerAtmosphereV2ReferenceCaseMappings,
  lowerAtmosphereV2ScenarioContracts,
} from "./lowerAtmosphereV2Scenarios";

const requiredScenarioIds = [
  "lower-atmosphere-v2-baseline-shallow-cloud",
  "lower-atmosphere-v2-dry-failed-cumulus",
  "lower-atmosphere-v2-capped-suppressed-cloud",
  "lower-atmosphere-v2-moist-surface-enables-cloud",
  "lower-atmosphere-v2-dry-entrainment-suppresses-cloud",
  "lower-atmosphere-v2-heating-lift-comparison",
  "lower-atmosphere-v2-humid-low-cloud-contrast",
  "lower-atmosphere-v2-rain-capable-warm-cloud-later",
];

const allFlowModes = ["atmosphere_evolution", "lifted_cloud", "evolution_lifted_cloud"];

describe("Lower Atmosphere v2 scenario contracts", () => {
  it("defines all required v2 scenario ids", () => {
    expect(lowerAtmosphereV2ScenarioContracts.map((scenario) => scenario.id)).toEqual(
      requiredScenarioIds,
    );
  });

  it("includes required scenario contract metadata", () => {
    for (const scenario of lowerAtmosphereV2ScenarioContracts) {
      expect(scenario.name).toBeTruthy();
      expect(scenario.shortDescription).toBeTruthy();
      expect(scenario.physicalQuestion).toContain("?");
      expect(scenario.flowModes).toEqual(expect.arrayContaining(allFlowModes));
      expect(scenario.configDefaults.profilePresetId).toBeTruthy();
      expect(scenario.configDefaults.cloudColumnPresetId).toBeTruthy();
      expect(scenario.expectedProfileStatus).toBeTruthy();
      expect(scenario.expectedCloudColumnStatus).toBeTruthy();
      expect(scenario.keyDiagnostics.length).toBeGreaterThan(0);
      expect(scenario.teachingPurpose).toBeTruthy();
      expect(scenario.comparisonSuggestions.length).toBeGreaterThan(0);
      expect(scenario.knownLimitations.length).toBeGreaterThan(0);
      expect(scenario.honestyLabels).toEqual(expect.arrayContaining([...lowerAtmosphereV2HonestyLabels]));
    }
  });

  it("keeps Boussinesq out of the default v2 scenario engine metadata", () => {
    for (const scenario of lowerAtmosphereV2ScenarioContracts) {
      expect(scenario.defaultModelStack).toEqual(["boundary_layer_1d", "controlled_cloud_column"]);
      expect(scenario.defaultModelStack).not.toContain("boussinesq_2d");
      expect(scenario.knownLimitations.join(" ")).not.toMatch(/trusted Boussinesq/i);
    }
  });

  it("marks the rain-capable scenario as precipitation-ready later, not implemented rain", () => {
    const rainLater = lowerAtmosphereV2ScenarioContracts.find(
      (scenario) => scenario.id === "lower-atmosphere-v2-rain-capable-warm-cloud-later",
    );

    expect(rainLater?.expectedPrecipitationStatus).toBe("precipitation_not_enabled");
    expect(rainLater?.knownLimitations).toEqual(
      expect.arrayContaining([
        "Precipitation diagnostics are not enabled in early v2.",
        "No PySDM, droplet distributions, or rain sedimentation are implied.",
      ]),
    );
  });

  it("defines comparison pairs that reference valid scenarios", () => {
    const scenarioIds = new Set(lowerAtmosphereV2ScenarioContracts.map((scenario) => scenario.id));

    expect(lowerAtmosphereV2ComparisonPairs.map((pair) => pair.id)).toEqual([
      "baseline-vs-dry-failed",
      "baseline-vs-capped-suppressed",
      "dry-surface-vs-moist-surface",
      "weak-heating-vs-strong-heating",
      "weak-lift-vs-strong-lift",
      "weak-entrainment-vs-dry-entrainment",
      "baseline-vs-humid-low-cloud-contrast",
      "cloud-formed-vs-rain-capable-later",
    ]);

    for (const pair of lowerAtmosphereV2ComparisonPairs) {
      expect(scenarioIds.has(pair.leftScenarioId)).toBe(true);
      expect(scenarioIds.has(pair.rightScenarioId)).toBe(true);
      expect(pair.questionAnswered).toContain("?");
      expect(pair.expectedDifference).toBeTruthy();
      expect(pair.diagnosticsToCompare.length).toBeGreaterThan(0);
    }
  });

  it("maps selected v2 scenarios to CM1 reference cases for qualitative comparison", () => {
    const scenarioIds = new Set(lowerAtmosphereV2ScenarioContracts.map((scenario) => scenario.id));

    expect(lowerAtmosphereV2ReferenceCaseMappings.map((mapping) => mapping.referenceCaseId)).toEqual([
      "cm1-shallow-cumulus-baseline-v1",
      "cm1-dry-failed-cumulus-v1",
      "cm1-capped-suppressed-cumulus-v1",
      "cm1-humid-low-cloud-contrast-v1",
      "cm1-warm-rain-shallow-cloud-v1",
    ]);

    for (const mapping of lowerAtmosphereV2ReferenceCaseMappings) {
      expect(scenarioIds.has(mapping.scenarioId)).toBe(true);
      expect(mapping.referenceCaseName).toContain("CM1");
      expect(mapping.expectedReferenceOutcome).toBeTruthy();
      expect(mapping.diagnosticsToCompare).toContain("cloud/no-cloud status");
      expect(mapping.comparisonNote).toMatch(/do not score exact cloud morphology|once .* available|after .* exist|after .* lands/i);
    }
  });
});

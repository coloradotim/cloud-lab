import { describe, expect, it } from "vitest";

import { FAIR_WEATHER_CUMULUS_LAB_ID, labById, labCatalog } from "./labCatalog";

const fairWeatherLab = labById(FAIR_WEATHER_CUMULUS_LAB_ID);

if (!fairWeatherLab) {
  throw new Error("Missing Fair-Weather Cumulus lab");
}

describe("lab catalog", () => {
  it("includes Fair-Weather Cumulus as the first functional lab", () => {
    expect(labCatalog[0]).toBe(fairWeatherLab);
    expect(fairWeatherLab.id).toBe("fair-weather-cumulus");
    expect(fairWeatherLab.name).toBe("Fair-Weather Cumulus");
    expect(fairWeatherLab.isSelectable).toBe(true);
  });

  it("matches the Fair-Weather Cumulus lab spec metadata", () => {
    expect(fairWeatherLab.question).toBe(
      "Why do puffy cumulus clouds form on some warm afternoons and not others?",
    );
    expect(fairWeatherLab.status).toBe("prototype");
    expect(fairWeatherLab.statusLabel).toBe("Prototype / first reference lab");
    expect(fairWeatherLab.supportedPhysicsCore).toBe("boussinesq_2d");
    expect(fairWeatherLab.concepts).toEqual(
      expect.arrayContaining([
        "surface sensible heating",
        "buoyant thermals",
        "source-layer moisture",
        "lifted condensation level / cloud base",
        "atmospheric stability and lapse rate",
        "dry failed cumulus",
      ]),
    );
    expect(fairWeatherLab.limitations).toEqual(
      expect.arrayContaining([
        "Qualitative 2-D Boussinesq prototype",
        "Simplified warm-cloud condensation",
        "No droplet-size distribution or resolved rain in this lab version",
      ]),
    );
  });

  it("attaches lab-specific Fair-Weather scenarios to the lab id", () => {
    expect(fairWeatherLab.scenarios.map((scenario) => scenario.name)).toEqual([
      "Moderate cloud base",
      "Dry failed cumulus",
      "Dry cap / suppressed cumulus",
      "Multi-thermal field",
    ]);
    expect(fairWeatherLab.scenarios.every((scenario) => scenario.labId === fairWeatherLab.id)).toBe(
      true,
    );
    expect(fairWeatherLab.scenarios.map((scenario) => scenario.id)).toEqual(
      expect.arrayContaining([
        "fair-weather-moderate-base",
        "dry-failed-cumulus",
        "dry-cap-suppressed-cumulus",
        "multi-thermal-cumulus-field",
      ]),
    );
  });

  it("limits primary controls to meaningful Fair-Weather controls", () => {
    const primaryControls = fairWeatherLab.controls.filter((control) => control.tier === "primary");

    expect(primaryControls.map((control) => control.label)).toEqual([
      "Surface heating strength",
      "Surface heating pattern",
      "Source-layer humidity",
      "Free-atmosphere humidity",
      "Stability / lapse rate",
      "Boundary-layer depth / cap height",
      "Model resolution",
      "Domain width",
      "Domain height",
      "Run length",
    ]);
    expect(primaryControls).toHaveLength(10);
    expect(primaryControls.map((control) => control.id)).not.toEqual(
      expect.arrayContaining(["raw-solver-type", "domain-grid", "time-step-frame-cadence"]),
    );
  });

  it("keeps raw config and solver details out of primary controls", () => {
    const advancedControls = fairWeatherLab.controls.filter((control) => control.tier === "advanced");
    const primaryControlIds = fairWeatherLab.controls
      .filter((control) => control.tier === "primary")
      .map((control) => control.id);

    expect(advancedControls.map((control) => control.id)).toEqual(
      expect.arrayContaining(["domain-grid", "time-step-frame-cadence", "raw-solver-type"]),
    );
    expect(primaryControlIds).not.toContain("raw-solver-type");
  });

  it("includes required Fair-Weather diagnostics metadata", () => {
    const diagnosticIds = fairWeatherLab.diagnostics.map((diagnostic) => diagnostic.id);

    expect(diagnosticIds).toEqual(
      expect.arrayContaining([
        "expected-lcl-cloud-base",
        "first-cloud-time",
        "cloud-top-height",
        "max-updraft",
        "dry-failed-cloud-outcome",
      ]),
    );
    expect(
      fairWeatherLab.diagnostics.find((diagnostic) => diagnostic.id === "dry-failed-cloud-outcome")
        ?.kind,
    ).toBe("hard-check");
  });

  it("includes required visualization-mode metadata without adding future renderers", () => {
    expect(fairWeatherLab.visualizationModes.map((mode) => mode.id)).toEqual([
      "scientific-2d-field-view",
      "profile-sounding-view",
      "timeline-replay-view",
      "inspector-diagnostics",
    ]);
    expect(fairWeatherLab.visualizationModes.map((mode) => mode.truthLabel)).toEqual(
      expect.arrayContaining(["solver-output", "derived-diagnostic"]),
    );
    expect(fairWeatherLab.visualizationModes.map((mode) => mode.id)).not.toContain(
      "cloud-scene-25d",
    );
  });

  it("keeps planned labs present but not falsely functional", () => {
    const plannedLabs = labCatalog.filter((lab) => lab.id !== fairWeatherLab.id);

    expect(plannedLabs.length).toBeGreaterThan(0);
    expect(plannedLabs.every((lab) => lab.isSelectable === false)).toBe(true);
    expect(plannedLabs.every((lab) => lab.supportedPhysicsCore === null)).toBe(true);
    expect(plannedLabs.every((lab) => lab.scenarios.length === 0)).toBe(true);
    expect(plannedLabs.every((lab) => lab.controls.length === 0)).toBe(true);
    expect(plannedLabs.every((lab) => lab.diagnostics.length === 0)).toBe(true);
  });
});

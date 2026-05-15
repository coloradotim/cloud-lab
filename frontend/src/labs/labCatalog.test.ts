import { describe, expect, it } from "vitest";

import {
  CLOUD_OPTICS_BEAUTY_LAB_ID,
  FAIR_WEATHER_CUMULUS_LAB_ID,
  labById,
  labCatalog,
} from "./labCatalog";
import { cloudOpticsScenePresetIds } from "./cloudOpticsScenes";

const fairWeatherLab = labById(FAIR_WEATHER_CUMULUS_LAB_ID);
const cloudOpticsLab = labById(CLOUD_OPTICS_BEAUTY_LAB_ID);

if (!fairWeatherLab || !cloudOpticsLab) {
  throw new Error("Missing expected lab definitions");
}

describe("lab catalog", () => {
  it("includes Lower Atmosphere Cloud Basics as the first functional lab", () => {
    expect(labCatalog[0]).toBe(fairWeatherLab);
    expect(fairWeatherLab.id).toBe("fair-weather-cumulus");
    expect(fairWeatherLab.name).toBe("Lower Atmosphere Cloud Basics");
    expect(fairWeatherLab.isSelectable).toBe(true);
    expect(fairWeatherLab.capabilities).toMatchObject({
      supportsRun: true,
      supportsTimeline: true,
      supportsReplay: true,
      supportsStaticControls: false,
    });
  });

  it("matches the Lower Atmosphere Cloud Basics lab spec metadata", () => {
    expect(fairWeatherLab.question).toBe(
      "How do heating, moisture, and stability shape basic warm-cloud formation near the ground?",
    );
    expect(fairWeatherLab.status).toBe("prototype");
    expect(fairWeatherLab.statusLabel).toBe("Experimental 2-D prototype");
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
        "Yellow prototype visual dynamics scaffold",
        "Simplified warm-cloud condensation",
        "Some behavior is shaped by prototype stabilizers and safety caps",
        "No droplet-size distribution or resolved rain in this lab version",
      ]),
    );
  });

  it("attaches lower-atmosphere scenarios to the legacy internal lab id", () => {
    expect(fairWeatherLab.scenarios.map((scenario) => scenario.name)).toEqual([
      "Fair-weather cumulus / baseline shallow cloud",
      "Dry failed cumulus",
      "Capped / suppressed cloud",
      "Multi-thermal cloud field",
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
        "below-lcl-cloud-water-fraction",
        "boundary-cloud-fraction",
        "top-sponge-cloud-fraction",
        "lateral-boundary-cloud-fraction",
        "boundary-connected-cloud-regions",
        "low-level-return-flow-cloud-water",
        "cloud-artifact-policy-status",
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
    const plannedLabs = labCatalog.filter(
      (lab) => lab.id !== fairWeatherLab.id && lab.id !== cloudOpticsLab.id,
    );

    expect(plannedLabs.length).toBeGreaterThan(0);
    expect(plannedLabs.every((lab) => lab.isSelectable === false)).toBe(true);
    expect(plannedLabs.every((lab) => lab.supportedPhysicsCore === null)).toBe(true);
    expect(plannedLabs.every((lab) => lab.scenarios.length === 0)).toBe(true);
    expect(plannedLabs.every((lab) => lab.controls.length === 0)).toBe(true);
    expect(plannedLabs.every((lab) => lab.diagnostics.length === 0)).toBe(true);
    expect(plannedLabs.every((lab) => lab.capabilities.supportsRun === false)).toBe(true);
  });

  it("includes Clouds, Light, and Shadow as a concept shell lab", () => {
    expect(cloudOpticsLab.id).toBe("cloud-optics-beauty");
    expect(cloudOpticsLab.name).toBe("Clouds, Light, and Shadow");
    expect(cloudOpticsLab.status).toBe("concept");
    expect(cloudOpticsLab.statusLabel).toBe("Prototype optics renderer");
    expect(cloudOpticsLab.supportedPhysicsCore).toBeNull();
    expect(cloudOpticsLab.isSelectable).toBe(true);
    expect(cloudOpticsLab.capabilities).toMatchObject({
      supportsRun: false,
      supportsTimeline: false,
      supportsReplay: false,
      supportsStaticControls: true,
    });
    expect(cloudOpticsLab.question).toContain(
      "Why do clouds look soft, dark, glowing, layered, silver-lined, or dramatic",
    );
    expect(cloudOpticsLab.limitations).toEqual(
      expect.arrayContaining([
        "Lightweight renderer is qualitative and approximate",
        "Preset scene fields are deterministic generated source fields",
        "2.5-D visual scene, not true 3-D atmospheric dynamics",
        "Qualitative learning tool, not full radiative transfer",
      ]),
    );
  });

  it("defines the Clouds, Light, and Shadow initial scenario and control metadata", () => {
    expect(cloudOpticsLab.scenarios.map((scenario) => scenario.name)).toEqual([
      "Small Puffy Cumulus",
      "Thick Cumulus With Dark Base",
      "Broken Cloud Field",
      "Towering / Developing Cumulus",
      "Thin Veil / Low Optical Depth Cloud",
    ]);
    expect(cloudOpticsLab.scenarios.map((scenario) => scenario.id)).toEqual(
      cloudOpticsScenePresetIds(),
    );
    expect(cloudOpticsLab.scenarios.every((scenario) => scenario.labId === cloudOpticsLab.id)).toBe(
      true,
    );

    const primaryControls = cloudOpticsLab.controls.filter((control) => control.tier === "primary");

    expect(primaryControls.map((control) => control.label)).toEqual([
      "Cloud scene",
      "Sun elevation",
      "Sun direction / azimuth",
      "View angle",
      "Cloud water density",
      "Cloud thickness / depth",
      "Optical depth / scattering strength",
      "Time of day / light color",
    ]);
  });

  it("keeps Clouds, Light, and Shadow honest about deferred rendering", () => {
    expect(cloudOpticsLab.diagnostics.map((diagnostic) => diagnostic.id)).toEqual(
      expect.arrayContaining([
        "optical-depth-estimate",
        "cloud-water-density-summary",
        "light-geometry-state",
        "light-path-length-proxy",
        "bright-edge-likelihood",
        "approximation-labels-present",
      ]),
    );
    expect(cloudOpticsLab.visualizationModes.map((mode) => mode.id)).toEqual([
      "rendered-cloud-appearance-view",
      "cloud-water-field-view",
      "optical-depth-view",
      "light-path-shadow-view",
    ]);
    expect(cloudOpticsLab.visualizationModes.every((mode) => mode.truthLabel === "visual-approximation")).toBe(
      true,
    );
  });
});

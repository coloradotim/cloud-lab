import { describe, expect, it } from "vitest";

import {
  CLOUD_OPTICS_BEAUTY_LAB_ID,
  EVOLVING_BOUNDARY_LAYER_LAB_ID,
  FAIR_WEATHER_CUMULUS_LAB_ID,
  labById,
  labCatalog,
} from "./labCatalog";
import { cloudOpticsScenePresetIds } from "./cloudOpticsScenes";

const fairWeatherLab = labById(FAIR_WEATHER_CUMULUS_LAB_ID);
const cloudOpticsLab = labById(CLOUD_OPTICS_BEAUTY_LAB_ID);
const evolvingBoundaryLayerLab = labById(EVOLVING_BOUNDARY_LAYER_LAB_ID);

if (!fairWeatherLab || !cloudOpticsLab || !evolvingBoundaryLayerLab) {
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
    expect(fairWeatherLab.statusLabel).toBe("Reduced-model v2 shell");
    expect(fairWeatherLab.supportedPhysicsCore).toBe("boundary_layer_1d");
    expect(fairWeatherLab.concepts).toEqual(
      expect.arrayContaining([
        "surface sensible heating",
        "1-D profile evolution",
        "prescribed lift",
        "controlled cloud formation",
        "lifted condensation level / cloud base",
        "cap / inversion suppression",
        "dry failed cumulus",
      ]),
    );
    expect(fairWeatherLab.limitations).toEqual(
      expect.arrayContaining([
        "Reduced model",
        "1-D profile evolution",
        "Prescribed lift",
        "Controlled cloud formation",
        "Not cloud-resolving dynamics",
        "No Boussinesq default",
        "Not weather prediction",
      ]),
    );
  });

  it("attaches lower-atmosphere scenarios to the legacy internal lab id", () => {
    expect(fairWeatherLab.scenarios.map((scenario) => scenario.name)).toEqual([
      "Baseline shallow cloud",
      "Dry failed cumulus",
      "Capped / suppressed cloud",
      "Moist surface enables cloud",
      "Dry entrainment suppresses cloud",
      "Stronger heating / stronger lift comparison",
      "Humid low-cloud contrast",
      "Rain-capable warm cloud later",
    ]);
    expect(fairWeatherLab.scenarios.every((scenario) => scenario.labId === fairWeatherLab.id)).toBe(
      true,
    );
    expect(fairWeatherLab.scenarios.map((scenario) => scenario.id)).toEqual(
      expect.arrayContaining([
        "lower-atmosphere-v2-baseline-shallow-cloud",
        "lower-atmosphere-v2-dry-failed-cumulus",
        "lower-atmosphere-v2-capped-suppressed-cloud",
        "lower-atmosphere-v2-rain-capable-warm-cloud-later",
      ]),
    );
  });

  it("limits primary controls to meaningful Lower Atmosphere v2 controls", () => {
    const primaryControls = fairWeatherLab.controls.filter((control) => control.tier === "primary");

    expect(primaryControls.map((control) => control.label)).toEqual([
      "Flow mode",
      "Duration after sunrise",
      "Surface heating strength",
      "Surface moisture flux",
      "Initial mixed-layer humidity",
      "Dry air above mixed layer",
      "Inversion height",
      "Inversion strength",
      "Entrainment strength",
      "Lift strength",
      "Lift duration",
    ]);
    expect(primaryControls).toHaveLength(11);
    expect(primaryControls.map((control) => control.id)).not.toEqual(
      expect.arrayContaining(["raw-schema-debug", "profile-resolution", "cloud-column-runtime"]),
    );
  });

  it("keeps raw config and solver details out of primary controls", () => {
    const advancedControls = fairWeatherLab.controls.filter((control) => control.tier === "advanced");
    const primaryControlIds = fairWeatherLab.controls
      .filter((control) => control.tier === "primary")
      .map((control) => control.id);

    expect(advancedControls.map((control) => control.id)).toEqual(
      expect.arrayContaining(["profile-resolution", "cloud-column-runtime", "raw-schema-debug"]),
    );
    expect(primaryControlIds).not.toContain("raw-schema-debug");
  });

  it("includes required Lower Atmosphere v2 diagnostics metadata", () => {
    const diagnosticIds = fairWeatherLab.diagnostics.map((diagnostic) => diagnostic.id);

    expect(diagnosticIds).toEqual(
      expect.arrayContaining([
        "profile-cloud-potential-status",
        "profile-limiting-reason",
        "mixed-layer-depth-lcl-gap",
        "cloud-column-status",
        "prescribed-forcing-label",
        "first-cloud-time-cloud-base",
        "cloud-water-summary",
        "expected-vs-observed-status",
        "precipitation-placeholder-status",
      ]),
    );
    expect(
      fairWeatherLab.diagnostics.find((diagnostic) => diagnostic.id === "expected-vs-observed-status")
        ?.kind,
    ).toBe("scenario-contract");
  });

  it("includes required visualization-mode metadata without adding future renderers", () => {
    expect(fairWeatherLab.visualizationModes.map((mode) => mode.id)).toEqual([
      "v2-profile-evolution-view",
      "v2-cloud-column-view",
      "v2-combined-summary-view",
      "v2-timeline-scrubber",
      "v2-status-cards",
    ]);
    expect(fairWeatherLab.visualizationModes.map((mode) => mode.truthLabel)).toEqual(
      expect.arrayContaining(["reduced-model-output", "derived-diagnostic"]),
    );
    expect(fairWeatherLab.visualizationModes.map((mode) => mode.id)).not.toContain(
      "cloud-scene-25d",
    );
  });

  it("keeps planned labs present but not falsely functional", () => {
    const plannedLabs = labCatalog.filter(
      (lab) =>
        lab.id !== fairWeatherLab.id &&
        lab.id !== cloudOpticsLab.id &&
        lab.id !== evolvingBoundaryLayerLab.id,
    );

    expect(plannedLabs.length).toBeGreaterThan(0);
    expect(plannedLabs.every((lab) => lab.isSelectable === false)).toBe(true);
    expect(plannedLabs.every((lab) => lab.supportedPhysicsCore === null)).toBe(true);
    expect(plannedLabs.every((lab) => lab.scenarios.length === 0)).toBe(true);
    expect(plannedLabs.every((lab) => lab.controls.length === 0)).toBe(true);
    expect(plannedLabs.every((lab) => lab.diagnostics.length === 0)).toBe(true);
    expect(plannedLabs.every((lab) => lab.capabilities.supportsRun === false)).toBe(true);
  });

  it("defines Evolving Boundary Layer as a selectable boundary_layer_1d workbench lab", () => {
    expect(evolvingBoundaryLayerLab.id).toBe("evolving-boundary-layer");
    expect(evolvingBoundaryLayerLab.name).toBe("Evolving Boundary Layer");
    expect(evolvingBoundaryLayerLab.statusLabel).toBe("Simplified 1-D profile evolution");
    expect(evolvingBoundaryLayerLab.supportedPhysicsCore).toBe("boundary_layer_1d");
    expect(evolvingBoundaryLayerLab.isSelectable).toBe(true);
    expect(evolvingBoundaryLayerLab.capabilities).toMatchObject({
      supportsRun: true,
      supportsTimeline: true,
      supportsReplay: true,
      supportsStaticControls: false,
    });
    expect(evolvingBoundaryLayerLab.scenarios.map((scenario) => scenario.name)).toEqual([
      "Morning stable layer breaks down",
      "Moist surface, cumulus favorable",
      "Dry entrainment suppresses potential",
      "Surface moisture flux enables potential",
      "Strong cap suppresses growth",
      "No-flux control",
    ]);
    expect(evolvingBoundaryLayerLab.controls.map((control) => control.label)).toEqual(
      expect.arrayContaining([
        "Hours from sunrise / duration",
        "Surface heating strength",
        "Surface moisture flux",
        "Initial mixed-layer humidity",
        "Initial stability / lapse rate",
        "Inversion height",
        "Inversion strength",
        "Dry air above mixed layer",
        "Entrainment strength",
        "Vertical levels / profile resolution",
      ]),
    );
    expect(evolvingBoundaryLayerLab.diagnostics.map((diagnostic) => diagnostic.label)).toEqual(
      expect.arrayContaining([
        "Cloud formation potential status",
        "Deterministic limiting reason",
        "Mixed-layer depth",
        "LCL",
        "Mixed-layer depth minus LCL",
        "RH near mixed-layer top",
      ]),
    );
    expect(evolvingBoundaryLayerLab.visualizationModes.map((mode) => mode.id)).toEqual([
      "profile-sounding-hero-view",
      "profile-timeline-replay",
      "profile-inspector-diagnostics",
    ]);
    expect(evolvingBoundaryLayerLab.limitations).toEqual(
      expect.arrayContaining([
        "V1 diagnoses cloud formation potential. It does not produce cloud water.",
        "Not cloud-resolving",
        "No live Boussinesq coupling",
      ]),
    );
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

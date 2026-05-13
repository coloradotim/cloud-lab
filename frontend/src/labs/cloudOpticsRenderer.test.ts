import { describe, expect, it } from "vitest";

import {
  generateCloudOpticsScene,
  generateEmptyCloudOpticsScene,
} from "./cloudOpticsScenes";
import {
  renderCloudOpticsScene,
  updateCloudOpticsControls,
} from "./cloudOpticsRenderer";

describe("cloud optics renderer", () => {
  it("renders all science modes without mutating the source scene", () => {
    const scene = generateCloudOpticsScene("small-puffy-cumulus");
    const before = scene.sourceField.values.map((row) => [...row]);

    for (const mode of [
      "rendered-cloud-appearance",
      "cloud-water-field",
      "optical-depth",
      "light-path-shadow",
    ] as const) {
      const model = renderCloudOpticsScene(scene, scene.defaultControls, mode);
      expect(model.cells).toHaveLength(scene.grid.columns * scene.grid.rows);
      expect(model.summary.viewMode).toBe(mode);
      expect(model.cells.every((cell) => Number.isFinite(cell.opticalDepth))).toBe(true);
      expect(model.cells.every((cell) => Number.isFinite(cell.brightness))).toBe(true);
    }

    expect(scene.sourceField.values).toEqual(before);
  });

  it("increases opacity and optical depth when density and optical controls increase", () => {
    const scene = generateCloudOpticsScene("small-puffy-cumulus");
    const baseline = renderCloudOpticsScene(scene, scene.defaultControls, "rendered-cloud-appearance");
    const denserControls = {
      ...scene.defaultControls,
      cloudWaterDensityMultiplier: scene.defaultControls.cloudWaterDensityMultiplier * 1.8,
      opticalDepthMultiplier: scene.defaultControls.opticalDepthMultiplier * 1.8,
    };
    const denser = renderCloudOpticsScene(scene, denserControls, "rendered-cloud-appearance");

    expect(denser.summary.maxOpticalDepth).toBeGreaterThan(baseline.summary.maxOpticalDepth);
    expect(denser.summary.meanOpacity).toBeGreaterThan(baseline.summary.meanOpacity);
    expect(denser.summary.meanShadow).toBeGreaterThan(baseline.summary.meanShadow);
  });

  it("shows low sun and thicker clouds as more shadowed than high sun or thin clouds", () => {
    const scene = generateCloudOpticsScene("thick-cumulus-dark-base");
    const highSun = renderCloudOpticsScene(
      scene,
      { ...scene.defaultControls, sunElevationDegrees: 70 },
      "rendered-cloud-appearance",
    );
    const lowSun = renderCloudOpticsScene(
      scene,
      { ...scene.defaultControls, sunElevationDegrees: 16 },
      "rendered-cloud-appearance",
    );
    const thinVeil = generateCloudOpticsScene("thin-veil-low-optical-depth");
    const veil = renderCloudOpticsScene(
      thinVeil,
      {
        ...thinVeil.defaultControls,
        cloudWaterDensityMultiplier: scene.defaultControls.cloudWaterDensityMultiplier,
        opticalDepthMultiplier: scene.defaultControls.opticalDepthMultiplier,
        cloudDepthMultiplier: scene.defaultControls.cloudDepthMultiplier,
      },
      "rendered-cloud-appearance",
    );

    expect(lowSun.summary.meanShadow).toBeGreaterThan(highSun.summary.meanShadow);
    expect(lowSun.summary.lightGeometry).toBe("low sun");
    expect(highSun.summary.lightGeometry).toBe("high sun");
    expect(highSun.summary.maxOpticalDepth).toBeGreaterThan(veil.summary.maxOpticalDepth);
  });

  it("supports empty no-cloud rendering", () => {
    const scene = generateEmptyCloudOpticsScene();
    const model = renderCloudOpticsScene(scene, scene.defaultControls, "rendered-cloud-appearance");

    expect(model.summary.maxDensity).toBe(0);
    expect(model.summary.maxOpticalDepth).toBe(0);
    expect(model.summary.meanOpacity).toBe(0);
  });

  it("updates renderer controls separately from source fields", () => {
    const scene = generateCloudOpticsScene("broken-cloud-field");
    const before = scene.sourceField.values.map((row) => [...row]);
    const controls = updateCloudOpticsControls(scene.defaultControls, "viewAngleDegrees", 55);

    expect(controls.viewAngleDegrees).toBe(55);
    expect(scene.defaultControls.viewAngleDegrees).not.toBe(55);
    expect(scene.sourceField.values).toEqual(before);
  });
});

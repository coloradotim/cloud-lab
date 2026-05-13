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
    expect(lowSun.summary.sunElevation).toBe("low");
    expect(highSun.summary.sunElevation).toBe("high");
    expect(highSun.summary.maxOpticalDepth).toBeGreaterThan(veil.summary.maxOpticalDepth);
  });

  it("creates distinct front, side, and backlit sun-direction states", () => {
    const scene = generateCloudOpticsScene("small-puffy-cumulus");
    const front = renderCloudOpticsScene(
      scene,
      { ...scene.defaultControls, sunAzimuthDegrees: 180 },
      "rendered-cloud-appearance",
    );
    const left = renderCloudOpticsScene(
      scene,
      { ...scene.defaultControls, sunAzimuthDegrees: 270 },
      "rendered-cloud-appearance",
    );
    const behind = renderCloudOpticsScene(
      scene,
      { ...scene.defaultControls, sunAzimuthDegrees: 0 },
      "rendered-cloud-appearance",
    );

    expect(front.summary.lightGeometry).toBe("front lit");
    expect(left.summary.lightGeometry).toBe("side lit");
    expect(behind.summary.lightGeometry).toBe("backlit");
    expect(behind.summary.meanBrightness).not.toBe(front.summary.meanBrightness);
  });

  it("moves highlight and shadow sides when sun direction changes left versus right", () => {
    const scene = generateCloudOpticsScene("small-puffy-cumulus");
    const left = renderCloudOpticsScene(
      scene,
      { ...scene.defaultControls, sunAzimuthDegrees: 270 },
      "rendered-cloud-appearance",
    );
    const right = renderCloudOpticsScene(
      scene,
      { ...scene.defaultControls, sunAzimuthDegrees: 90 },
      "rendered-cloud-appearance",
    );

    expect(meanBrightness(left, "left")).toBeGreaterThan(meanBrightness(left, "right"));
    expect(meanBrightness(right, "right")).toBeGreaterThan(meanBrightness(right, "left"));
  });

  it("changes apparent depth offset when the camera moves off center", () => {
    const scene = generateCloudOpticsScene("broken-cloud-field");
    const center = renderCloudOpticsScene(
      scene,
      { ...scene.defaultControls, viewAngleDegrees: 0 },
      "rendered-cloud-appearance",
    );
    const oblique = renderCloudOpticsScene(
      scene,
      { ...scene.defaultControls, viewAngleDegrees: 45 },
      "rendered-cloud-appearance",
    );

    expect(maxDepthOffset(center)).toBe(0);
    expect(maxDepthOffset(oblique)).toBeGreaterThan(0);
    expect(oblique.summary.cameraAngle).toBe("right");
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

  it("keeps numeric renderer controls finite and bounded", () => {
    const scene = generateCloudOpticsScene("small-puffy-cumulus");

    expect(updateCloudOpticsControls(scene.defaultControls, "sunAzimuthDegrees", 235).sunAzimuthDegrees).toBe(235);
    expect(updateCloudOpticsControls(scene.defaultControls, "sunAzimuthDegrees", "not-a-number").sunAzimuthDegrees).toBe(
      scene.defaultControls.sunAzimuthDegrees,
    );
    expect(updateCloudOpticsControls(scene.defaultControls, "sunAzimuthDegrees", 720).sunAzimuthDegrees).toBe(360);
    expect(updateCloudOpticsControls(scene.defaultControls, "viewAngleDegrees", -120).viewAngleDegrees).toBe(-60);
    expect(updateCloudOpticsControls(scene.defaultControls, "viewAngleDegrees", 120).viewAngleDegrees).toBe(60);
  });
});

function meanBrightness(
  model: ReturnType<typeof renderCloudOpticsScene>,
  half: "left" | "right",
): number {
  const cells = model.cells.filter((cell) =>
    half === "left" ? cell.column < model.columns / 2 : cell.column >= model.columns / 2,
  );
  return cells.reduce((sum, cell) => sum + cell.brightness, 0) / cells.length;
}

function maxDepthOffset(model: ReturnType<typeof renderCloudOpticsScene>): number {
  return Math.max(...model.cells.map((cell) => Math.abs(cell.depthOffset)));
}

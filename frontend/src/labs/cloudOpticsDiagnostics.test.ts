import { describe, expect, it } from "vitest";

import {
  buildCloudOpticsDiagnostics,
  CLOUD_OPTICS_HONESTY_LABELS,
  snapshotCloudOpticsSourceField,
  sourceFieldMatchesSnapshot,
} from "./cloudOpticsDiagnostics";
import {
  generateCloudOpticsScene,
  generateEmptyCloudOpticsScene,
} from "./cloudOpticsScenes";
import { renderCloudOpticsScene } from "./cloudOpticsRenderer";

describe("cloud optics diagnostics", () => {
  it("classifies zero cloud water as no cloud and zero optical response", () => {
    const scene = generateEmptyCloudOpticsScene();
    const model = renderCloudOpticsScene(scene, scene.defaultControls, "rendered-cloud-appearance");
    const diagnostics = buildCloudOpticsDiagnostics(scene, model);

    expect(diagnostics.opticalDepthEstimate.state).toBe("thin");
    expect(diagnostics.opticalDepthEstimate.explanation).toContain("stays at zero");
    expect(diagnostics.densitySummary.state).toBe("no cloud water");
    expect(diagnostics.baseInteriorDarknessState.state).toBe("no cloud base");
  });

  it("reports deterministic light geometry states", () => {
    const scene = generateCloudOpticsScene("small-puffy-cumulus");
    const highFront = renderCloudOpticsScene(
      scene,
      { ...scene.defaultControls, sunElevationDegrees: 70, sunAzimuthDegrees: 180, viewAngleDegrees: 0 },
      "rendered-cloud-appearance",
    );
    const lowBack = renderCloudOpticsScene(
      scene,
      { ...scene.defaultControls, sunElevationDegrees: 14, sunAzimuthDegrees: 0, viewAngleDegrees: 48 },
      "rendered-cloud-appearance",
    );

    expect(buildCloudOpticsDiagnostics(scene, highFront).lightGeometryState.state).toBe(
      "high sun, front lit",
    );
    expect(buildCloudOpticsDiagnostics(scene, lowBack).lightGeometryState.state).toBe(
      "low sun, backlit",
    );
  });

  it("tracks density and thickness relationship checks without mutating the source field", () => {
    const scene = generateCloudOpticsScene("thick-cumulus-dark-base");
    const before = snapshotCloudOpticsSourceField(scene);
    const baseline = renderCloudOpticsScene(scene, scene.defaultControls, "rendered-cloud-appearance");
    const thicker = renderCloudOpticsScene(
      scene,
      {
        ...scene.defaultControls,
        cloudWaterDensityMultiplier: scene.defaultControls.cloudWaterDensityMultiplier * 1.4,
        cloudDepthMultiplier: scene.defaultControls.cloudDepthMultiplier * 1.4,
      },
      "rendered-cloud-appearance",
    );

    const baselineDiagnostics = buildCloudOpticsDiagnostics(scene, baseline);
    const thickerDiagnostics = buildCloudOpticsDiagnostics(scene, thicker);

    expect(thicker.summary.maxOpticalDepth).toBeGreaterThan(baseline.summary.maxOpticalDepth);
    expect(thicker.summary.meanOpacity).toBeGreaterThan(baseline.summary.meanOpacity);
    expect(thickerDiagnostics.baseInteriorDarknessState.state).not.toBe("base/interior stays bright");
    expect(baselineDiagnostics.sourceFieldImmutability.state).toBe("physical-source-field");
    expect(sourceFieldMatchesSnapshot(scene, before)).toBe(true);
  });

  it("keeps sun-angle lighting changes separate from cloud-water source data", () => {
    const scene = generateCloudOpticsScene("broken-cloud-field");
    const before = snapshotCloudOpticsSourceField(scene);
    const highSun = renderCloudOpticsScene(
      scene,
      { ...scene.defaultControls, sunElevationDegrees: 70 },
      "rendered-cloud-appearance",
    );
    const lowSun = renderCloudOpticsScene(
      scene,
      { ...scene.defaultControls, sunElevationDegrees: 12 },
      "rendered-cloud-appearance",
    );

    expect(lowSun.summary.meanShadow).toBeGreaterThan(highSun.summary.meanShadow);
    expect(lowSun.summary.maxDensity).toBe(highSun.summary.maxDensity);
    expect(sourceFieldMatchesSnapshot(scene, before)).toBe(true);
  });

  it("classifies backlit edge behavior as stronger than front-lit behavior", () => {
    const scene = generateCloudOpticsScene("small-puffy-cumulus");
    const frontLit = renderCloudOpticsScene(
      scene,
      { ...scene.defaultControls, sunAzimuthDegrees: 180, viewAngleDegrees: 0 },
      "rendered-cloud-appearance",
    );
    const sideLit = renderCloudOpticsScene(
      scene,
      { ...scene.defaultControls, sunAzimuthDegrees: 90, viewAngleDegrees: 0 },
      "rendered-cloud-appearance",
    );
    const backlit = renderCloudOpticsScene(
      scene,
      { ...scene.defaultControls, sunAzimuthDegrees: 0, viewAngleDegrees: 50 },
      "rendered-cloud-appearance",
    );

    const frontDiagnostics = buildCloudOpticsDiagnostics(scene, frontLit);
    const sideDiagnostics = buildCloudOpticsDiagnostics(scene, sideLit);
    const backDiagnostics = buildCloudOpticsDiagnostics(scene, backlit);

    expect(frontDiagnostics.brightEdgeLikelihood.state).toBe("weak");
    expect(frontDiagnostics.brightEdgeLikelihood.explanation).toContain("Front-lit geometry");
    expect(sideDiagnostics.brightEdgeLikelihood.explanation).toContain("Side-lit geometry");
    expect(backDiagnostics.brightEdgeLikelihood.explanation).toContain("Backlit geometry");
    expect(["moderate", "strong"]).toContain(
      backDiagnostics.brightEdgeLikelihood.state,
    );
  });

  it("keeps thin veil diagnostics more translucent than thick cumulus under comparable settings", () => {
    const thickScene = generateCloudOpticsScene("thick-cumulus-dark-base");
    const thinScene = generateCloudOpticsScene("thin-veil-low-optical-depth");
    const controls = {
      ...thickScene.defaultControls,
      cloudWaterDensityMultiplier: 1,
      cloudDepthMultiplier: 1,
      opticalDepthMultiplier: 1,
    };
    const thick = renderCloudOpticsScene(thickScene, controls, "rendered-cloud-appearance");
    const thin = renderCloudOpticsScene(
      thinScene,
      { ...thinScene.defaultControls, ...controls, sceneId: thinScene.defaultControls.sceneId },
      "rendered-cloud-appearance",
    );

    expect(thick.summary.meanOpacity).toBeGreaterThan(thin.summary.meanOpacity);
    expect(thick.summary.maxOpticalDepth).toBeGreaterThan(thin.summary.maxOpticalDepth);
  });

  it("protects required approximation and 2.5-D honesty labels", () => {
    const scene = generateCloudOpticsScene("small-puffy-cumulus");
    const model = renderCloudOpticsScene(scene, scene.defaultControls, "rendered-cloud-appearance");
    const diagnostics = buildCloudOpticsDiagnostics(scene, model, CLOUD_OPTICS_HONESTY_LABELS);

    expect(diagnostics.approximationLabelAvailability.state).toBe("complete");
    expect(diagnostics.approximationLabelAvailability.missingLabels).toHaveLength(0);
    expect(diagnostics.approximationLabelAvailability.availableLabels).toContain(
      "2.5-D visual scene, not true 3-D dynamics",
    );
    expect(diagnostics.approximationLabelAvailability.availableLabels).toContain(
      "Not full radiative transfer",
    );
  });
});

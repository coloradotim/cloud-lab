import { cloudOpticsSceneStats, type CloudOpticsScene } from "./cloudOpticsScenes";
import type { CloudOpticsRenderModel } from "./cloudOpticsRenderer";

export const CLOUD_OPTICS_HONESTY_LABELS = [
  "Visual approximation",
  "Bulk optical approximation",
  "2.5-D visual scene, not true 3-D dynamics",
  "Preset cloud field, not new cloud formation",
  "Lightweight volumetric rendering",
  "Approximate single scattering",
  "Multiple scattering simplified or omitted",
  "Not full radiative transfer",
  "Not droplet-resolved Mie scattering",
  "Not a calibrated radiance product",
  "Not weather prediction",
] as const;

export type CloudOpticsDiagnosticEntry = {
  label: string;
  state: string;
  explanation: string;
};

export type CloudOpticsDiagnostics = {
  opticalDepthEstimate: CloudOpticsDiagnosticEntry;
  densitySummary: CloudOpticsDiagnosticEntry;
  lightGeometryState: CloudOpticsDiagnosticEntry;
  lightPathLengthProxy: CloudOpticsDiagnosticEntry;
  edgeSoftnessState: CloudOpticsDiagnosticEntry;
  baseInteriorDarknessState: CloudOpticsDiagnosticEntry;
  brightEdgeLikelihood: CloudOpticsDiagnosticEntry;
  layeredDepthExplanation: CloudOpticsDiagnosticEntry;
  approximationLabelAvailability: CloudOpticsDiagnosticEntry & {
    availableLabels: readonly string[];
    missingLabels: readonly string[];
  };
  sourceFieldImmutability: CloudOpticsDiagnosticEntry;
  entries: readonly CloudOpticsDiagnosticEntry[];
};

export function buildCloudOpticsDiagnostics(
  scene: CloudOpticsScene,
  renderModel: CloudOpticsRenderModel,
  visibleLabels: readonly string[] = CLOUD_OPTICS_HONESTY_LABELS,
): CloudOpticsDiagnostics {
  const cloudyCells = renderModel.cells.filter((cell) => cell.sourceDensity > 0);
  const meanLightPath = mean(cloudyCells.map((cell) => cell.lightPath));
  const baseCells = cloudyCells.filter((cell) => cell.row < scene.grid.rows * 0.42);
  const meanBaseShadow = mean(baseCells.map((cell) => cell.shadow));
  const edgeCells = cloudyCells.filter((cell) => cell.sourceDensity > 0.04 && cell.sourceDensity < 0.42);
  const meanEdgeBrightness = mean(edgeCells.map((cell) => cell.brightness));
  const sunState = `${renderModel.summary.sunElevation} sun`;
  const lightingState = renderModel.summary.lightGeometry;
  const missingLabels = CLOUD_OPTICS_HONESTY_LABELS.filter((label) => !visibleLabels.includes(label));
  const availableLabels = CLOUD_OPTICS_HONESTY_LABELS.filter((label) => visibleLabels.includes(label));

  const opticalDepthEstimate = {
    label: "Optical-depth estimate",
    state: renderModel.summary.opticalState,
    explanation: opticalDepthExplanation(renderModel.summary.maxOpticalDepth),
  };
  const densitySummary = {
    label: "Cloud water / density summary",
    state: classifyDensity(renderModel.summary.maxDensity),
    explanation: densityExplanation(scene, renderModel.summary.maxDensity),
  };
  const lightGeometryState = {
    label: "Light geometry state",
    state: `${sunState}, ${lightingState}`,
    explanation: `Sun direction is ${renderModel.summary.sunDirection}, sun elevation is ${renderModel.summary.sunElevation}, and camera angle is ${renderModel.summary.cameraAngle}, so the scene is treated as ${lightingState}.`,
  };
  const lightPathLengthProxy = {
    label: "Light-path length proxy",
    state: classifyLightPath(meanLightPath),
    explanation: `Mean cloudy-cell light path is ${meanLightPath.toFixed(2)}, a deterministic proxy for how far light travels through the 2.5-D volume.`,
  };
  const edgeSoftnessState = {
    label: "Edge softness state",
    state: classifyEdgeSoftness(renderModel.controls.edgeSoftness),
    explanation: `Edge softness is ${renderModel.controls.edgeSoftness.toFixed(2)}; density falloff stays a renderer interpretation of the preset source field.`,
  };
  const baseInteriorDarknessState = {
    label: "Base/interior darkness state",
    state: classifyDarkness(meanBaseShadow, renderModel.summary.maxOpticalDepth),
    explanation: `Mean lower-cloud shadow is ${meanBaseShadow.toFixed(2)} with maximum optical depth ${renderModel.summary.maxOpticalDepth.toFixed(2)}.`,
  };
  const brightEdgeLikelihood = {
    label: "Bright-edge likelihood",
    state: classifyBrightEdge(lightingState, renderModel.summary.maxOpticalDepth, meanEdgeBrightness),
    explanation: brightEdgeExplanation(lightingState, renderModel.summary.maxOpticalDepth),
  };
  const layeredDepthExplanation = {
    label: "Layered depth explanation",
    state: classifyLayeredDepth(scene, renderModel.controls.viewAngleDegrees),
    explanation: `The source scene has ${scene.depth.layerCount} deterministic 2.5-D layers and a ${Math.abs(renderModel.controls.viewAngleDegrees)} degree view angle.`,
  };
  const approximationLabelAvailability = {
    label: "Approximation/honesty label availability",
    state: missingLabels.length === 0 ? "complete" : "missing labels",
    explanation:
      missingLabels.length === 0
        ? "All required Clouds, Light, and Shadow approximation labels are visible or available."
        : `Missing labels: ${missingLabels.join(", ")}.`,
    availableLabels,
    missingLabels,
  };
  const sourceFieldImmutability = {
    label: "Source-field immutability",
    state: scene.sourceMetadata.fieldRole,
    explanation:
      "Renderer diagnostics consume the generated source field and cloned controls; visual controls must not mutate sourceField.values.",
  };

  return {
    opticalDepthEstimate,
    densitySummary,
    lightGeometryState,
    lightPathLengthProxy,
    edgeSoftnessState,
    baseInteriorDarknessState,
    brightEdgeLikelihood,
    layeredDepthExplanation,
    approximationLabelAvailability,
    sourceFieldImmutability,
    entries: [
      opticalDepthEstimate,
      densitySummary,
      lightGeometryState,
      lightPathLengthProxy,
      edgeSoftnessState,
      baseInteriorDarknessState,
      brightEdgeLikelihood,
      layeredDepthExplanation,
      approximationLabelAvailability,
      sourceFieldImmutability,
    ],
  };
}

export function snapshotCloudOpticsSourceField(scene: CloudOpticsScene): readonly (readonly number[])[] {
  return scene.sourceField.values.map((row) => [...row]);
}

export function sourceFieldMatchesSnapshot(
  scene: CloudOpticsScene,
  snapshot: readonly (readonly number[])[],
): boolean {
  return scene.sourceField.values.every((row, rowIndex) =>
    row.every((value, columnIndex) => value === snapshot[rowIndex]?.[columnIndex]),
  );
}

function opticalDepthExplanation(maxOpticalDepth: number): string {
  if (maxOpticalDepth === 0) {
    return "No cloud water is present, so the optical-depth proxy stays at zero.";
  }
  if (maxOpticalDepth < 0.55) {
    return "The scene is optically thin and should remain translucent.";
  }
  if (maxOpticalDepth < 1.8) {
    return "The scene has moderate optical response with visible but limited shadowing.";
  }
  if (maxOpticalDepth < 4) {
    return "The scene is optically thick enough for shaded interiors and dark-base behavior.";
  }
  return "The scene is very optically thick, so the renderer should show strong attenuation.";
}

function classifyDensity(maxDensity: number): string {
  if (maxDensity === 0) {
    return "no cloud water";
  }
  if (maxDensity < 0.45) {
    return "low density";
  }
  if (maxDensity < 1.15) {
    return "moderate density";
  }
  return "high density";
}

function densityExplanation(scene: CloudOpticsScene, maxDensity: number): string {
  const stats = cloudOpticsSceneStats(scene);
  if (stats.nonzeroCellCount === 0) {
    return "The preset source field has no nonzero cloud-density cells.";
  }
  return `${stats.nonzeroCellCount} source cells contain cloud density; the current renderer multiplier gives max effective density ${maxDensity.toFixed(2)}.`;
}

function classifyLightPath(meanLightPath: number): string {
  if (meanLightPath === 0) {
    return "no cloud path";
  }
  if (meanLightPath < 0.9) {
    return "short path";
  }
  if (meanLightPath < 1.8) {
    return "moderate path";
  }
  return "long path";
}

function classifyEdgeSoftness(edgeSoftness: number): string {
  if (edgeSoftness >= 0.78) {
    return "soft edges";
  }
  if (edgeSoftness >= 0.55) {
    return "moderate edges";
  }
  return "sharper edges";
}

function classifyDarkness(meanBaseShadow: number, maxOpticalDepth: number): string {
  if (maxOpticalDepth === 0) {
    return "no cloud base";
  }
  if (meanBaseShadow > 0.55 || maxOpticalDepth >= 3) {
    return "dark base/interior likely";
  }
  if (meanBaseShadow > 0.22 || maxOpticalDepth >= 1.2) {
    return "some base/interior shading";
  }
  return "base/interior stays bright";
}

function classifyBrightEdge(
  viewState: "front lit" | "side lit" | "backlit",
  maxOpticalDepth: number,
  meanEdgeBrightness: number,
): string {
  if (viewState === "front lit" || maxOpticalDepth < 0.45) {
    return "weak";
  }
  if (viewState === "backlit" && maxOpticalDepth >= 1.2 && meanEdgeBrightness >= 0.3) {
    return "strong";
  }
  return "moderate";
}

function brightEdgeExplanation(
  viewState: "front lit" | "side lit" | "backlit",
  maxOpticalDepth: number,
): string {
  const opticalResponse =
    maxOpticalDepth >= 1.2 ? "moderate-to-thick optical response" : "thin optical response";
  if (viewState === "front lit") {
    return `Front-lit geometry and ${opticalResponse} keep bright-edge likelihood weak.`;
  }
  if (viewState === "backlit") {
    return `Backlit geometry and ${opticalResponse} increase bright-edge likelihood.`;
  }
  return `Side-lit geometry and ${opticalResponse} create an asymmetric bright edge.`;
}

function classifyLayeredDepth(scene: CloudOpticsScene, viewAngleDegrees: number): string {
  if (scene.depth.layerCount < 4) {
    return "minimal layered depth";
  }
  if (scene.id === "broken-cloud-field" && Math.abs(viewAngleDegrees) >= 30) {
    return "layered broken-field depth visible";
  }
  if (Math.abs(viewAngleDegrees) >= 30) {
    return "oblique layered depth visible";
  }
  return "layered depth subtle";
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

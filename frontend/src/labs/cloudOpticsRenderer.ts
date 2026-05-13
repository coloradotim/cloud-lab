import type {
  CloudOpticsScene,
  CloudOpticsSceneControls,
} from "./cloudOpticsScenes";

export type CloudOpticsViewMode =
  | "rendered-cloud-appearance"
  | "cloud-water-field"
  | "optical-depth"
  | "light-path-shadow";

export type CloudOpticsRenderCell = {
  row: number;
  column: number;
  sourceDensity: number;
  effectiveDensity: number;
  opticalDepth: number;
  transmittance: number;
  lightPath: number;
  shadow: number;
  brightness: number;
  opacity: number;
  depthOffset: number;
  fill: string;
};

export type CloudOpticsRenderSummary = {
  viewMode: CloudOpticsViewMode;
  maxDensity: number;
  maxOpticalDepth: number;
  meanBrightness: number;
  meanOpacity: number;
  meanShadow: number;
  lightGeometry: "front lit" | "side lit" | "backlit";
  sunDirection: "front" | "left" | "right" | "behind";
  sunElevation: "low" | "medium" | "high";
  cameraAngle: "left" | "center" | "right";
  opticalState: "thin" | "moderate" | "thick" | "very thick";
};

export type CloudOpticsRenderModel = {
  scene: CloudOpticsScene;
  controls: CloudOpticsSceneControls;
  viewMode: CloudOpticsViewMode;
  cells: CloudOpticsRenderCell[];
  summary: CloudOpticsRenderSummary;
  rows: number;
  columns: number;
};

const LIGHT_COLORS: Record<CloudOpticsSceneControls["lightColorPreset"], [number, number, number]> = {
  midday: [255, 255, 246],
  "golden-hour": [255, 202, 135],
  "cool-haze": [214, 232, 255],
};

export function renderCloudOpticsScene(
  scene: CloudOpticsScene,
  controls: CloudOpticsSceneControls,
  viewMode: CloudOpticsViewMode,
): CloudOpticsRenderModel {
  const sourceValues = scene.sourceField.values;
  const maxRawDensity = Math.max(...sourceValues.flat(), 0);
  const light = lightVector(controls);
  const sunDirection = sunDirectionState(controls);
  const lighting = lightGeometry(controls);
  const camera = cameraAngleState(controls);
  const cells: CloudOpticsRenderCell[] = [];
  let maxDensity = 0;
  let maxOpticalDepth = 0;
  let opacitySum = 0;
  let brightnessSum = 0;
  let shadowSum = 0;

  sourceValues.forEach((row, rowIndex) => {
    row.forEach((sourceDensity, columnIndex) => {
      const normalizedDensity = maxRawDensity > 0 ? sourceDensity / maxRawDensity : 0;
      const effectiveDensity = normalizedDensity * controls.cloudWaterDensityMultiplier;
      const columnPosition = columnIndex / Math.max(1, scene.grid.columns - 1);
      const verticalPosition = rowIndex / Math.max(1, scene.grid.rows - 1);
      const pathLength = lightPathLength(scene, controls, rowIndex, columnIndex);
      const opticalDepth =
        effectiveDensity *
        controls.opticalDepthMultiplier *
        controls.cloudDepthMultiplier *
        scene.depth.effectiveDepth *
        pathLength *
        4.5;
      const transmittance = Math.exp(-opticalDepth);
      const shadow = 1 - transmittance;
      const topLighting = clamp01(0.4 + 0.6 * light.z);
      const sideLighting = sideLightingForCell(sunDirection, columnPosition);
      const rimLighting =
        lighting === "backlit"
          ? edgeGlow(normalizedDensity) * 0.95
          : edgeGlow(normalizedDensity) * sideLighting * 0.7;
      const sideContrast = sunDirection === "front" ? 0.2 : 1.25;
      const depthOffset =
        Math.sin((controls.viewAngleDegrees * Math.PI) / 180) *
        controls.cloudDepthMultiplier *
        scene.depth.effectiveDepth *
        normalizedDensity *
        6;
      const brightness = clamp01(
        (0.14 +
          topLighting * (0.08 + sideLighting * sideContrast) * (0.45 + 0.55 * transmittance) +
          rimLighting +
          0.22 * verticalPosition) *
          controls.exposure,
      );
      const opacity = clamp01(1 - Math.exp(-opticalDepth * 0.9));

      maxDensity = Math.max(maxDensity, effectiveDensity);
      maxOpticalDepth = Math.max(maxOpticalDepth, opticalDepth);
      opacitySum += opacity;
      brightnessSum += brightness;
      shadowSum += shadow;

      cells.push({
        row: rowIndex,
        column: columnIndex,
        sourceDensity,
        effectiveDensity,
        opticalDepth,
        transmittance,
        lightPath: pathLength,
        shadow,
        brightness,
        opacity,
        depthOffset,
        fill: colorForMode(viewMode, {
          effectiveDensity,
          opticalDepth,
          transmittance,
          lightPath: pathLength,
          shadow,
          brightness,
          opacity,
          lightColor: LIGHT_COLORS[controls.lightColorPreset],
          skyBrightness: controls.skyBrightness,
          haze: controls.haze,
        }),
      });
    });
  });

  return {
    scene,
    controls: { ...controls },
    viewMode,
    cells,
    rows: scene.grid.rows,
    columns: scene.grid.columns,
    summary: {
      viewMode,
      maxDensity,
      maxOpticalDepth,
      meanBrightness: cells.length ? brightnessSum / cells.length : 0,
      meanOpacity: cells.length ? opacitySum / cells.length : 0,
      meanShadow: cells.length ? shadowSum / cells.length : 0,
      lightGeometry: lightGeometry(controls),
      sunDirection,
      sunElevation: sunElevationState(controls),
      cameraAngle: camera,
      opticalState: opticalState(maxOpticalDepth),
    },
  };
}

export function updateCloudOpticsControls(
  controls: CloudOpticsSceneControls,
  key: keyof CloudOpticsSceneControls,
  value: number | string,
): CloudOpticsSceneControls {
  if (typeof controls[key] === "number") {
    const nextValue = typeof value === "number" ? value : Number(value);
    return {
      ...controls,
      [key]: Number.isFinite(nextValue)
        ? clamp(nextValue, ...numericControlBounds(key))
        : controls[key],
    } as CloudOpticsSceneControls;
  }

  return {
    ...controls,
    [key]: value,
  } as CloudOpticsSceneControls;
}

function numericControlBounds(key: keyof CloudOpticsSceneControls): [number, number] {
  switch (key) {
    case "sunElevationDegrees":
      return [5, 85];
    case "sunAzimuthDegrees":
      return [0, 360];
    case "viewAngleDegrees":
      return [-60, 60];
    case "cloudWaterDensityMultiplier":
    case "cloudDepthMultiplier":
    case "opticalDepthMultiplier":
      return [0, 2.5];
    case "edgeSoftness":
    case "skyBrightness":
    case "haze":
      return [0, 1];
    case "exposure":
      return [0.2, 2];
    default:
      return [-Infinity, Infinity];
  }
}

function lightPathLength(
  scene: CloudOpticsScene,
  controls: CloudOpticsSceneControls,
  row: number,
  column: number,
): number {
  const elevationRad = (Math.max(5, controls.sunElevationDegrees) * Math.PI) / 180;
  const lowSunFactor = 1 / Math.sin(elevationRad);
  const viewFactor = 1 + Math.abs(controls.viewAngleDegrees) / 120;
  const directionalPosition = column / Math.max(1, scene.grid.columns - 1);
  const verticalPosition = row / Math.max(1, scene.grid.rows - 1);
  const sunDirection = sunDirectionState(controls);
  const downSunDistance =
    sunDirection === "left"
      ? directionalPosition
      : sunDirection === "right"
        ? 1 - directionalPosition
        : 0.5;
  const behindFactor = sunDirection === "behind" ? 0.45 : sunDirection === "front" ? -0.12 : 0;
  const interiorDistance = clamp01(0.3 + 0.42 * downSunDistance + 0.25 * (1 - verticalPosition) + behindFactor);

  return lowSunFactor * viewFactor * interiorDistance;
}

function lightVector(controls: CloudOpticsSceneControls) {
  const elevation = (controls.sunElevationDegrees * Math.PI) / 180;
  const azimuth = (controls.sunAzimuthDegrees * Math.PI) / 180;
  return {
    x: Math.cos(elevation) * Math.sin(azimuth),
    z: Math.sin(elevation),
  };
}

function colorForMode(
  viewMode: CloudOpticsViewMode,
  values: {
    effectiveDensity: number;
    opticalDepth: number;
    transmittance: number;
    lightPath: number;
    shadow: number;
    brightness: number;
    opacity: number;
    lightColor: [number, number, number];
    skyBrightness: number;
    haze: number;
  },
): string {
  if (viewMode === "cloud-water-field") {
    const density = clamp01(values.effectiveDensity);
    return rgba(45 + density * 80, 112 + density * 90, 145 + density * 95, density);
  }

  if (viewMode === "optical-depth") {
    const tau = clamp01(values.opticalDepth / 4);
    return rgba(245 * (1 - tau) + 62 * tau, 238 * (1 - tau) + 83 * tau, 190 * (1 - tau) + 115 * tau, 0.22 + tau * 0.78);
  }

  if (viewMode === "light-path-shadow") {
    const shade = clamp01(values.shadow);
    return rgba(246 * (1 - shade) + 32 * shade, 224 * (1 - shade) + 57 * shade, 162 * (1 - shade) + 76 * shade, 0.2 + shade * 0.8);
  }

  const sky = 210 + values.skyBrightness * 35;
  const hazeLift = values.haze * 35;
  const cloudAlpha = values.opacity;
  const red = mix(sky, values.lightColor[0] * values.brightness + hazeLift, cloudAlpha);
  const green = mix(sky + 10, values.lightColor[1] * values.brightness + hazeLift, cloudAlpha);
  const blue = mix(235, values.lightColor[2] * values.brightness + hazeLift, cloudAlpha);
  return rgba(red, green, blue, Math.max(0.08, cloudAlpha));
}

function lightGeometry(controls: CloudOpticsSceneControls): CloudOpticsRenderSummary["lightGeometry"] {
  const sunDirection = sunDirectionState(controls);
  if (sunDirection === "front") {
    return "front lit";
  }
  if (sunDirection === "behind") {
    return "backlit";
  }
  return "side lit";
}

function sunDirectionState(controls: CloudOpticsSceneControls): CloudOpticsRenderSummary["sunDirection"] {
  const azimuth = ((controls.sunAzimuthDegrees % 360) + 360) % 360;
  if (azimuth >= 315 || azimuth < 45) {
    return "behind";
  }
  if (azimuth >= 45 && azimuth < 135) {
    return "right";
  }
  if (azimuth >= 135 && azimuth < 225) {
    return "front";
  }
  return "left";
}

function sunElevationState(controls: CloudOpticsSceneControls): CloudOpticsRenderSummary["sunElevation"] {
  if (controls.sunElevationDegrees <= 24) {
    return "low";
  }
  if (controls.sunElevationDegrees >= 60) {
    return "high";
  }
  return "medium";
}

function cameraAngleState(controls: CloudOpticsSceneControls): CloudOpticsRenderSummary["cameraAngle"] {
  if (controls.viewAngleDegrees <= -20) {
    return "left";
  }
  if (controls.viewAngleDegrees >= 20) {
    return "right";
  }
  return "center";
}

function sideLightingForCell(
  sunDirection: CloudOpticsRenderSummary["sunDirection"],
  columnPosition: number,
): number {
  if (sunDirection === "left") {
    return 1 - columnPosition;
  }
  if (sunDirection === "right") {
    return columnPosition;
  }
  if (sunDirection === "behind") {
    return 0.45 + edgeGlow(columnPosition) * 0.6;
  }
  return 0.72;
}

function opticalState(maxOpticalDepth: number): CloudOpticsRenderSummary["opticalState"] {
  if (maxOpticalDepth < 0.55) {
    return "thin";
  }
  if (maxOpticalDepth < 1.8) {
    return "moderate";
  }
  if (maxOpticalDepth < 4) {
    return "thick";
  }
  return "very thick";
}

function edgeGlow(density: number): number {
  return density > 0.08 && density < 0.45 ? 1 - Math.abs(density - 0.26) / 0.26 : 0;
}

function mix(a: number, b: number, fraction: number): number {
  return a * (1 - fraction) + b * fraction;
}

function rgba(red: number, green: number, blue: number, alpha: number): string {
  return `rgb(${Math.round(clamp(red, 0, 255))} ${Math.round(clamp(green, 0, 255))} ${Math.round(
    clamp(blue, 0, 255),
  )} / ${clamp01(alpha).toFixed(3)})`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

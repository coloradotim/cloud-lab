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
  fill: string;
};

export type CloudOpticsRenderSummary = {
  viewMode: CloudOpticsViewMode;
  maxDensity: number;
  maxOpticalDepth: number;
  meanBrightness: number;
  meanOpacity: number;
  meanShadow: number;
  lightGeometry: "high sun" | "low sun" | "front lit" | "side lit" | "backlit";
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
      const sideLighting = clamp01(0.55 + 0.25 * Math.abs(light.x));
      const brightness = clamp01(
        (0.2 + topLighting * sideLighting * transmittance + 0.25 * edgeGlow(normalizedDensity)) *
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
  const sunFromLeft = Math.sin((controls.sunAzimuthDegrees * Math.PI) / 180) < 0;
  const downSunDistance = sunFromLeft ? directionalPosition : 1 - directionalPosition;
  const interiorDistance = clamp01(0.35 + 0.4 * downSunDistance + 0.25 * (1 - verticalPosition));

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
  if (controls.sunElevationDegrees >= 55) {
    return "high sun";
  }
  if (controls.sunElevationDegrees <= 24) {
    return "low sun";
  }
  if (Math.abs(controls.viewAngleDegrees) <= 15) {
    return "front lit";
  }
  if (Math.abs(controls.viewAngleDegrees) >= 38) {
    return "backlit";
  }
  return "side lit";
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

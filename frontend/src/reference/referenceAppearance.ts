import {
  DEFAULT_CLOUD_OPTICAL_ASSUMPTIONS,
  DEFAULT_EFFECTIVE_RADIUS_UM,
  cloudOpticalCell,
} from "../visualization";
import type { ReferenceFrame, ReferenceRun, ReferenceScalarField2D } from "./referenceTypes";

export type ReferenceAppearanceMode = "scientific-field" | "cloud-appearance";

export type ReferenceAppearanceCell = {
  row: number;
  column: number;
  sourceCloudWater: number;
  opticalDepth: number;
  opacity: number;
  brightness: number;
  fill: string;
};

export type ReferenceAppearanceViewModel = {
  run: ReferenceRun;
  frame: ReferenceFrame;
  frameIndex: number;
  cloudWaterField: ReferenceScalarField2D;
  cells: ReferenceAppearanceCell[];
  rows: number;
  columns: number;
  maxCloudWater: number;
  maxOpticalDepth: number;
  meanOpacity: number;
  assumedEffectiveRadiusUm: number;
  pathLengthM: number;
  fallbackMessage: string | null;
};

const CLOUD_WATER_FIELD_KEY = "cloud_liquid_water_kg_per_kg";
const MIN_VISIBLE_OPACITY = 0.04;

export function buildReferenceAppearanceViewModel(
  run: ReferenceRun | null,
  frameIndex: number,
): ReferenceAppearanceViewModel | null {
  if (!run?.frames.length) {
    return null;
  }

  const resolvedFrameIndex = clampFrameIndex(run, frameIndex);
  const frame = run.frames[resolvedFrameIndex];
  if (!hasUsableGrid(frame)) {
    return null;
  }

  const cloudWaterField = frame.fields[CLOUD_WATER_FIELD_KEY];
  if (!cloudWaterField || fieldShapeWarning(frame, cloudWaterField)) {
    return null;
  }

  const sourceValues = cloudWaterField.values;
  const finiteValues = sourceValues.map((row) => row.map((value) => (Number.isFinite(value) ? value : 0)));
  const maxCloudWater = Math.max(...finiteValues.flat(), 0);
  const pathLengthM = cloudDepthProxyM(frame);
  let maxOpticalDepth = 0;
  let opacitySum = 0;

  const cells = finiteValues.flatMap((row, rowIndex) =>
    row.map((value, columnIndex) => {
      const edgeLighting = referenceEdgeLighting(finiteValues, rowIndex, columnIndex);
      const optical = cloudOpticalCell(value, {
        ...DEFAULT_CLOUD_OPTICAL_ASSUMPTIONS,
        pathLengthM,
        effectiveRadiusUm: DEFAULT_EFFECTIVE_RADIUS_UM,
      }, edgeLighting);
      const densityResponse = maxCloudWater > 0
        ? Math.pow(Math.max(0, value) / maxCloudWater, 0.38)
        : 0;
      const opacity = maxCloudWater <= 0 ? 0 : Math.min(0.94, densityResponse * 0.76 + optical.opacity * 4.2);
      const brightness = maxCloudWater <= 0
        ? 0
        : Math.min(1, Math.max(0.18, optical.brightness * 0.9 + edgeLighting * 0.24));

      maxOpticalDepth = Math.max(maxOpticalDepth, optical.opticalDepth);
      opacitySum += opacity;

      return {
        row: rowIndex,
        column: columnIndex,
        sourceCloudWater: value,
        opticalDepth: optical.opticalDepth,
        opacity,
        brightness,
        fill: cloudAppearanceFill(opacity, brightness),
      };
    }),
  );

  return {
    run,
    frame,
    frameIndex: resolvedFrameIndex,
    cloudWaterField: {
      ...cloudWaterField,
      values: finiteValues,
    },
    cells,
    rows: frame.grid.rows,
    columns: frame.grid.columns,
    maxCloudWater,
    maxOpticalDepth,
    meanOpacity: cells.length ? opacitySum / cells.length : 0,
    assumedEffectiveRadiusUm: DEFAULT_EFFECTIVE_RADIUS_UM,
    pathLengthM,
    fallbackMessage: nonFiniteWarning(cloudWaterField),
  };
}

export function referenceAppearanceFallback(run: ReferenceRun | null, frameIndex: number): string | null {
  if (!run) {
    return "No reference run is loaded yet.";
  }
  if (!run.frames.length) {
    return "No reference frames are available for this case.";
  }

  const frame = run.frames[clampFrameIndex(run, frameIndex)];
  if (!hasUsableGrid(frame)) {
    return "Reference grid coordinates are missing or inconsistent.";
  }

  const cloudWaterField = frame.fields[CLOUD_WATER_FIELD_KEY];
  if (!cloudWaterField) {
    return "Cloud liquid water is missing, so the CM1 appearance view cannot render.";
  }

  return fieldShapeWarning(frame, cloudWaterField);
}

export function referenceAppearanceHasMeaningfulCloud(model: ReferenceAppearanceViewModel | null): boolean {
  return (model?.cells.some((cell) => cell.opacity > MIN_VISIBLE_OPACITY) ?? false);
}

export function cloneReferenceCloudWaterValues(run: ReferenceRun): number[][][] {
  return run.frames.map((frame) =>
    (frame.fields[CLOUD_WATER_FIELD_KEY]?.values ?? []).map((row) => [...row]),
  );
}

function cloudDepthProxyM(frame: ReferenceFrame): number {
  const z = frame.grid.z_coordinates_m;
  const depth = Math.max(...z) - Math.min(...z);
  const rows = Math.max(1, frame.grid.rows);
  return Math.max(120, depth / rows);
}

function hasUsableGrid(frame: ReferenceFrame): boolean {
  return (
    frame.grid.rows > 1 &&
    frame.grid.columns > 1 &&
    frame.grid.z_coordinates_m.length === frame.grid.rows &&
    frame.grid.x_coordinates_m.length === frame.grid.columns
  );
}

function fieldShapeWarning(frame: ReferenceFrame, field: ReferenceScalarField2D): string | null {
  if (field.values.length !== frame.grid.rows) {
    return `${field.metadata.display_name} has ${field.values.length} rows, but the grid expects ${frame.grid.rows}.`;
  }
  if (field.values.some((row) => row.length !== frame.grid.columns)) {
    return `${field.metadata.display_name} has a mismatched column count for this grid.`;
  }
  return null;
}

function nonFiniteWarning(field: ReferenceScalarField2D): string | null {
  return field.values.some((row) => row.some((value) => !Number.isFinite(value)))
    ? `${field.metadata.display_name} contained NaN or Infinity values; they were hidden in the appearance view.`
    : null;
}

function referenceEdgeLighting(values: number[][], rowIndex: number, columnIndex: number): number {
  const center = values[rowIndex][columnIndex];
  if (center <= 0) {
    return 0;
  }

  const left = values[rowIndex][Math.max(0, columnIndex - 1)] ?? center;
  const right = values[rowIndex][Math.min(values[rowIndex].length - 1, columnIndex + 1)] ?? center;
  const down = values[Math.max(0, rowIndex - 1)]?.[columnIndex] ?? center;
  const up = values[Math.min(values.length - 1, rowIndex + 1)]?.[columnIndex] ?? center;
  const gradient = Math.hypot(right - left, up - down);
  return Math.min(1, gradient / Math.max(center, 1e-8));
}

function cloudAppearanceFill(opacity: number, brightness: number): string {
  if (opacity <= 0) {
    return "rgb(218 235 241 / 0)";
  }

  const red = Math.round(214 + brightness * 38);
  const green = Math.round(224 + brightness * 30);
  const blue = Math.round(230 + brightness * 24);
  return `rgb(${red} ${green} ${blue} / ${Math.min(0.94, opacity).toFixed(3)})`;
}

function clampFrameIndex(run: ReferenceRun, frameIndex: number): number {
  return Math.min(run.frames.length - 1, Math.max(0, Math.trunc(Number.isFinite(frameIndex) ? frameIndex : 0)));
}

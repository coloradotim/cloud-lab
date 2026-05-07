import type { ScalarField, SimulationFrame } from "./simulationTypes";

export const DEFAULT_FIELD_ORDER = [
  "cloud_liquid_water_kg_per_kg",
  "water_vapor_kg_per_kg",
  "temperature_k",
  "temperature_perturbation_k",
  "vertical_velocity_m_per_s",
  "horizontal_velocity_m_per_s",
];

export type FieldOption = {
  key: string;
  label: string;
  unit: string;
  description: string;
};

export type FieldStats = {
  min: number;
  max: number;
};

export type GridPoint = {
  row: number;
  column: number;
};

export type VectorScale = {
  stride: number;
  pixelsPerMeterPerSecond: number;
};

export function fieldOptionsFromFrame(frame: SimulationFrame | null): FieldOption[] {
  if (!frame) {
    return [];
  }

  const keys = Object.keys(frame.fields).sort((left, right) => {
    const leftIndex = DEFAULT_FIELD_ORDER.indexOf(left);
    const rightIndex = DEFAULT_FIELD_ORDER.indexOf(right);

    if (leftIndex === -1 && rightIndex === -1) {
      return left.localeCompare(right);
    }
    if (leftIndex === -1) {
      return 1;
    }
    if (rightIndex === -1) {
      return -1;
    }
    return leftIndex - rightIndex;
  });

  return keys.map((key) => {
    const field = frame.fields[key];
    return {
      key,
      label: field.metadata.display_name,
      unit: displayUnitForField(field),
      description: field.metadata.description,
    };
  });
}

export function getFieldStats(field: ScalarField): FieldStats {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const row of field.values) {
    for (const value of row) {
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: 1 };
  }

  return { min, max };
}

export function valueRangeForField(field: ScalarField): FieldStats {
  const stats = getFieldStats(field);
  const configuredMin = field.metadata.display_scale?.min_value;
  const configuredMax = field.metadata.display_scale?.max_value;
  const min = typeof configuredMin === "number" ? configuredMin : stats.min;
  const max = typeof configuredMax === "number" ? configuredMax : stats.max;

  if (Math.abs(max - min) < Number.EPSILON) {
    return { min: min - 0.5, max: max + 0.5 };
  }

  return { min, max };
}

export function displayUnit(unit: string): string {
  return unit === "K" ? "deg C" : unit;
}

export function displayUnitForField(field: ScalarField): string {
  if (isTemperaturePerturbationField(field)) {
    return "K";
  }

  return displayUnit(field.metadata.unit);
}

export function displayValueForField(field: ScalarField, value: number): number {
  return isAbsoluteTemperatureField(field) ? value - 273.15 : value;
}

export function displayStatsForField(field: ScalarField): FieldStats {
  const stats = getFieldStats(field);
  return {
    min: displayValueForField(field, stats.min),
    max: displayValueForField(field, stats.max),
  };
}

export function displayRangeForField(field: ScalarField): FieldStats {
  if (isVelocityField(field)) {
    const stats = displayStatsForField(field);
    const maxAbs = Math.max(Math.abs(stats.min), Math.abs(stats.max), 0.01);
    return { min: -maxAbs, max: maxAbs };
  }

  if (isAbsoluteTemperatureField(field)) {
    const stats = displayStatsForField(field);
    const padding = Math.max(0.5, (stats.max - stats.min) * 0.08);
    return expandFlatRange({ min: stats.min - padding, max: stats.max + padding });
  }

  const range = isCondensateField(field) ? getFieldStats(field) : valueRangeForField(field);
  return {
    min: displayValueForField(field, range.min),
    max: displayValueForField(field, range.max),
  };
}

export function formatDisplayValue(field: ScalarField, value: number): string {
  const displayValue = displayValueForField(field, value);
  return field.metadata.unit === "K" ? displayValue.toFixed(2) : displayValue.toExponential(2);
}

export function normalizedDisplayValueForField(field: ScalarField, value: number): number {
  if (isCondensateField(field)) {
    return normalizedLogValue(value, displayRangeForField(field).max);
  }

  const displayValue = displayValueForField(field, value);
  const range = displayRangeForField(field);
  return normalizedLinearValue(displayValue, range);
}

export function gridPointFromCanvas(
  offsetX: number,
  offsetY: number,
  width: number,
  height: number,
  rows: number,
  columns: number,
): GridPoint | null {
  if (width <= 0 || height <= 0 || rows <= 0 || columns <= 0) {
    return null;
  }

  const column = Math.min(columns - 1, Math.max(0, Math.floor((offsetX / width) * columns)));
  const visualRow = Math.min(rows - 1, Math.max(0, Math.floor((offsetY / height) * rows)));
  const row = rows - 1 - visualRow;

  return { row, column };
}

export function vectorScaleForFrame(
  frame: SimulationFrame,
  width: number,
  height: number,
): VectorScale {
  const rows = frame.grid.rows;
  const columns = frame.grid.columns;
  const cellWidth = width / columns;
  const cellHeight = height / rows;
  const maxSpeed = maxVectorSpeed(frame);
  const maxArrowLength = Math.min(cellWidth, cellHeight) * 0.72;
  const stride = rows <= 32 && columns <= 48 ? 1 : Math.max(2, Math.floor(Math.min(rows, columns) / 10));

  return {
    stride,
    pixelsPerMeterPerSecond: maxArrowLength / Math.max(maxSpeed, 0.05),
  };
}

export function colorForNormalizedValue(normalizedValue: number, colorMap: string): [number, number, number] {
  const value = Math.min(1, Math.max(0, normalizedValue));

  if (colorMap === "magma") {
    return [
      Math.round(34 + value * 221),
      Math.round(20 + value * 142),
      Math.round(62 + value * 67),
    ];
  }

  if (colorMap === "Blues" || colorMap === "PuBu") {
    return [
      Math.round(82 + value * 173),
      Math.round(148 + value * 107),
      Math.round(214 + value * 41),
    ];
  }

  if (colorMap === "coolwarm") {
    if (value < 0.5) {
      const weight = value / 0.5;
      return [
        Math.round(70 + (245 - 70) * weight),
        Math.round(120 + (245 - 120) * weight),
        Math.round(210 + (245 - 210) * weight),
      ];
    }

    const weight = (value - 0.5) / 0.5;
    return [
      Math.round(245 + (210 - 245) * weight),
      Math.round(245 + (80 - 245) * weight),
      Math.round(245 + (60 - 245) * weight),
    ];
  }

  return [
    Math.round(28 + value * 210),
    Math.round(82 + value * 128),
    Math.round(90 + value * 70),
  ];
}

function normalizedLinearValue(value: number, range: FieldStats): number {
  return (value - range.min) / (range.max - range.min);
}

function normalizedLogValue(value: number, maxValue: number): number {
  if (value <= 0 || maxValue <= 0) {
    return 0;
  }

  const floor = Math.min(1e-8, maxValue * 0.01);
  const logMin = Math.log10(floor);
  const logMax = Math.log10(Math.max(maxValue, floor * 10));
  return (Math.log10(Math.max(value, floor)) - logMin) / (logMax - logMin);
}

function expandFlatRange(range: FieldStats): FieldStats {
  if (Math.abs(range.max - range.min) >= Number.EPSILON) {
    return range;
  }

  return { min: range.min - 0.5, max: range.max + 0.5 };
}

function isAbsoluteTemperatureField(field: ScalarField): boolean {
  return field.metadata.unit === "K" && !isTemperaturePerturbationField(field);
}

function isTemperaturePerturbationField(field: ScalarField): boolean {
  return field.metadata.display_name.toLowerCase().includes("perturbation");
}

function isVelocityField(field: ScalarField): boolean {
  return field.metadata.unit === "m s-1";
}

function isCondensateField(field: ScalarField): boolean {
  const displayName = field.metadata.display_name.toLowerCase();
  return field.metadata.unit === "kg kg-1" && /cloud|rain/.test(displayName);
}

function maxVectorSpeed(frame: SimulationFrame): number {
  const u = frame.fields.horizontal_velocity_m_per_s.values;
  const w = frame.fields.vertical_velocity_m_per_s.values;
  let maxSpeed = 0;

  for (let rowIndex = 0; rowIndex < frame.grid.rows; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < frame.grid.columns; columnIndex += 1) {
      maxSpeed = Math.max(maxSpeed, Math.hypot(u[rowIndex][columnIndex], w[rowIndex][columnIndex]));
    }
  }

  return maxSpeed;
}

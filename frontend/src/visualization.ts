import type { ScalarField, SimulationFrame } from "./simulationTypes";

export const DEFAULT_FIELD_ORDER = [
  "cloud_liquid_water_kg_per_kg",
  "water_vapor_kg_per_kg",
  "temperature_k",
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
  return displayUnit(field.metadata.unit);
}

export function displayValueForField(field: ScalarField, value: number): number {
  return field.metadata.unit === "K" ? value - 273.15 : value;
}

export function displayStatsForField(field: ScalarField): FieldStats {
  const stats = getFieldStats(field);
  return {
    min: displayValueForField(field, stats.min),
    max: displayValueForField(field, stats.max),
  };
}

export function displayRangeForField(field: ScalarField): FieldStats {
  const range = valueRangeForField(field);
  return {
    min: displayValueForField(field, range.min),
    max: displayValueForField(field, range.max),
  };
}

export function formatDisplayValue(field: ScalarField, value: number): string {
  const displayValue = displayValueForField(field, value);
  return field.metadata.unit === "K" ? displayValue.toFixed(2) : displayValue.toExponential(2);
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
      Math.round(238 - value * 166),
      Math.round(246 - value * 103),
      Math.round(255 - value * 41),
    ];
  }

  if (colorMap === "coolwarm") {
    return value < 0.5
      ? [Math.round(70 + value * 260), Math.round(120 + value * 160), 210]
      : [210, Math.round(220 - (value - 0.5) * 240), Math.round(160 - (value - 0.5) * 220)];
  }

  return [
    Math.round(28 + value * 210),
    Math.round(82 + value * 128),
    Math.round(90 + value * 70),
  ];
}

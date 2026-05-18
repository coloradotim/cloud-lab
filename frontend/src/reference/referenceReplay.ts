import type { ScalarField } from "../simulationTypes";
import {
  colorForNormalizedValue,
  displayRangeForFieldKey,
  fieldSummaryForField,
  formatDisplayValue,
  normalizedDisplayValueForFieldKey,
  scalingMetadataForField,
  type FieldOption,
  type FieldStats,
  type FieldSummary,
  type ScalingMetadata,
} from "../visualization";
import type { ReferenceFrame, ReferenceRun, ReferenceScalarField2D } from "./referenceTypes";

export const REFERENCE_FIELD_KEYS = [
  "cloud_liquid_water_kg_per_kg",
  "water_vapor_kg_per_kg",
  "temperature_k",
  "potential_temperature_k",
  "vertical_velocity_m_per_s",
  "rain_water_kg_per_kg",
] as const;

export type ReferenceFieldKey = (typeof REFERENCE_FIELD_KEYS)[number];

export type ReferenceReplayCell = {
  row: number;
  column: number;
  value: number;
  displayValue: string;
  color: string;
};

export type ReferenceReplayOverlay = {
  cloudBaseY: number | null;
  cloudTopY: number | null;
  maxUpdraftPoint: { row: number; column: number; value: number } | null;
};

export type ReferenceReplayViewModel = {
  run: ReferenceRun;
  frame: ReferenceFrame;
  requestedFrameIndex: number;
  frameIndex: number;
  fieldKey: string;
  field: ReferenceScalarField2D;
  scalarField: ScalarField;
  fieldOptions: FieldOption[];
  summary: FieldSummary;
  range: FieldStats;
  scaling: ScalingMetadata;
  signal: ReferenceFieldSignal;
  cells: ReferenceReplayCell[];
  rows: number;
  columns: number;
  fallbackMessage: string | null;
  overlay: ReferenceReplayOverlay;
};

export type ReferenceFieldSignal = {
  minValue: number;
  maxValue: number;
  hasSignal: boolean;
  statusLabel: string;
  helper: string;
};

const REFERENCE_FIELD_LABELS: Record<ReferenceFieldKey, { label: string; unit: string; description: string }> = {
  cloud_liquid_water_kg_per_kg: {
    label: "Cloud liquid water",
    unit: "kg kg-1",
    description: "Reference cloud-water field.",
  },
  water_vapor_kg_per_kg: {
    label: "Water vapor",
    unit: "kg kg-1",
    description: "Reference water-vapor field.",
  },
  temperature_k: {
    label: "Temperature",
    unit: "K",
    description: "Reference temperature field.",
  },
  potential_temperature_k: {
    label: "Potential temperature",
    unit: "K",
    description: "Reference potential-temperature field.",
  },
  vertical_velocity_m_per_s: {
    label: "Vertical velocity",
    unit: "m s-1",
    description: "Reference vertical-velocity field.",
  },
  rain_water_kg_per_kg: {
    label: "Rain water",
    unit: "kg kg-1",
    description: "Reference rain-water field, when available.",
  },
};

const REFERENCE_COLOR_MAPS: Record<string, string> = {
  cloud_liquid_water_kg_per_kg: "Blues",
  water_vapor_kg_per_kg: "PuBu",
  temperature_k: "coolwarm",
  potential_temperature_k: "coolwarm",
  vertical_velocity_m_per_s: "coolwarm",
  rain_water_kg_per_kg: "Blues",
};

export function referenceFieldOptions(run: ReferenceRun | null): FieldOption[] {
  const available = new Set(run?.frames.flatMap((frame) => Object.keys(frame.fields)) ?? []);
  const preferred = REFERENCE_FIELD_KEYS.map((fieldKey) => {
    const metadata = firstFieldMetadata(run, fieldKey);
    const fallback = REFERENCE_FIELD_LABELS[fieldKey];
    return {
      key: fieldKey,
      label: metadata?.display_name ?? fallback.label,
      unit: metadata?.unit ?? fallback.unit,
      description: metadata?.description ?? fallback.description,
      categoryLabel: available.has(fieldKey) ? "Reference model output" : "Missing field",
    };
  });

  const extraKeys = [...available]
    .filter((fieldKey) => !REFERENCE_FIELD_KEYS.includes(fieldKey as ReferenceFieldKey))
    .sort();
  const extras = extraKeys.map((fieldKey) => {
    const metadata = firstFieldMetadata(run, fieldKey);
    return {
      key: fieldKey,
      label: metadata?.display_name ?? fieldKey,
      unit: metadata?.unit ?? "",
      description: metadata?.description ?? "Additional reference field.",
      categoryLabel: "Reference model output",
    };
  });

  return [...preferred, ...extras];
}

export function defaultReferenceFieldKey(run: ReferenceRun | null): string {
  if (!run?.frames.length) {
    return REFERENCE_FIELD_KEYS[0];
  }

  const available = new Set(run.frames.flatMap((frame) => Object.keys(frame.fields)));
  return REFERENCE_FIELD_KEYS.find((fieldKey) => available.has(fieldKey)) ?? Object.keys(run.frames[0].fields)[0] ?? REFERENCE_FIELD_KEYS[0];
}

export function normalizeReferenceFieldSelection(run: ReferenceRun | null, selectedFieldKey: string): string {
  const options = referenceFieldOptions(run);
  return options.some((option) => option.key === selectedFieldKey)
    ? selectedFieldKey
    : defaultReferenceFieldKey(run);
}

export function buildReferenceReplayViewModel(
  run: ReferenceRun | null,
  selectedFieldKey: string,
  frameIndex: number,
): ReferenceReplayViewModel | null {
  if (!run?.frames.length) {
    return null;
  }

  const resolvedFrameIndex = clampFrameIndex(run, frameIndex);
  const frame = run.frames[resolvedFrameIndex];
  if (!hasUsableGrid(frame)) {
    return null;
  }

  const fieldKey = normalizeReferenceFieldSelection(run, selectedFieldKey);
  const field = frame.fields[fieldKey];
  if (!field) {
    return null;
  }

  const fieldShapeError = fieldShapeWarning(frame, field);
  if (fieldShapeError) {
    return null;
  }

  const finiteField = finiteReferenceField(field);
  const scalarField = toScalarField(finiteField);
  const scaling = scalingMetadataForField(fieldKey, scalarField);
  const colorMap = REFERENCE_COLOR_MAPS[fieldKey] ?? "PuBu";

  return {
    run,
    frame,
    requestedFrameIndex: frameIndex,
    frameIndex: resolvedFrameIndex,
    fieldKey,
    field: finiteField,
    scalarField,
    fieldOptions: referenceFieldOptions(run),
    summary: referenceFieldSummary(fieldKey, scalarField),
    range: displayRangeForFieldKey(fieldKey, scalarField),
    scaling,
    signal: referenceFieldSignal(fieldKey, scalarField),
    cells: finiteField.values.flatMap((row, rowIndex) =>
      row.map((value, columnIndex) => ({
        row: rowIndex,
        column: columnIndex,
        value,
        displayValue: formatDisplayValue(scalarField, value),
        color: rgbColor(colorForNormalizedValue(
          referenceColorIntensity(fieldKey, normalizedDisplayValueForFieldKey(fieldKey, scalarField, value)),
          colorMap,
        )),
      })),
    ),
    rows: frame.grid.rows,
    columns: frame.grid.columns,
    fallbackMessage: nonFiniteWarning(field),
    overlay: referenceReplayOverlay(frame, run),
  };
}

export function referenceMissingFieldNotes(run: ReferenceRun | null): string[] {
  const warnings = run?.diagnostics?.missing_field_warnings ?? [];
  if (!warnings.length) {
    return [];
  }

  const availableFields = new Set(run?.diagnostics?.available_fields ?? []);
  for (const frame of run?.frames ?? []) {
    Object.keys(frame.fields).forEach((fieldKey) => availableFields.add(fieldKey));
  }

  return warnings.map((warning) => {
    if (
      /temperature_k/.test(warning) &&
      availableFields.has("potential_temperature_k") &&
      !availableFields.has("temperature_k")
    ) {
      return "Temperature field unavailable; potential temperature is available for the temperature/theta view.";
    }
    return warning;
  });
}

export function referenceReplayFallback(
  run: ReferenceRun | null,
  selectedFieldKey: string,
  frameIndex: number,
): string | null {
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

  const fieldKey = normalizeReferenceFieldSelection(run, selectedFieldKey);
  const field = frame.fields[fieldKey];
  if (!field) {
    return `${fieldLabel(fieldKey)} is missing from this CM1 reference frame.`;
  }

  return fieldShapeWarning(frame, field);
}

export function frameCountLabel(run: ReferenceRun | null): string {
  return `${run?.frames.length ?? 0} frame${run?.frames.length === 1 ? "" : "s"}`;
}

function referenceFieldSummary(fieldKey: string, field: ScalarField): FieldSummary {
  const summary = fieldSummaryForField(fieldKey, field);
  return {
    ...summary,
    truth: {
      category: "reference_model_output",
      label: "Reference model output",
      explanation: "Offline CM1 reference output mapped into Cloud Lab reference frames.",
    },
  };
}

function referenceFieldSignal(fieldKey: string, field: ScalarField): ReferenceFieldSignal {
  const values = field.values.flat().filter((value) => Number.isFinite(value));
  const minValue = values.length ? Math.min(...values) : 0;
  const maxValue = values.length ? Math.max(...values) : 0;
  const scaling = scalingMetadataForField(fieldKey, field);
  const threshold = scaling.noiseThreshold ?? (isCloudOrRainField(fieldKey) ? 1e-8 : 0);
  const hasSignal = isCloudOrRainField(fieldKey)
    ? maxValue > threshold
    : maxValue > minValue || Math.abs(maxValue) > threshold || Math.abs(minValue) > threshold;

  if (isCloudOrRainField(fieldKey) && !hasSignal) {
    return {
      minValue,
      maxValue,
      hasSignal,
      statusLabel: fieldKey === "rain_water_kg_per_kg" ? "No rain signal" : "No cloud formed",
      helper:
        fieldKey === "rain_water_kg_per_kg"
          ? "Rain water is zero or below the display threshold in this frame."
          : "Cloud liquid water is zero or below the display threshold in this frame.",
    };
  }

  return {
    minValue,
    maxValue,
    hasSignal,
    statusLabel: "Field signal",
    helper: `${field.metadata.display_name} min/max are shown from the selected CM1 reference frame.`,
  };
}

function toScalarField(field: ReferenceScalarField2D): ScalarField {
  return {
    values: field.values,
    metadata: {
      unit: field.metadata.unit,
      display_name: field.metadata.display_name,
      description: field.metadata.description,
    },
  };
}

function firstFieldMetadata(run: ReferenceRun | null, fieldKey: string) {
  for (const frame of run?.frames ?? []) {
    const field = frame.fields[fieldKey];
    if (field) {
      return field.metadata;
    }
  }
  return null;
}

function clampFrameIndex(run: ReferenceRun, frameIndex: number): number {
  return Math.min(run.frames.length - 1, Math.max(0, Math.trunc(Number.isFinite(frameIndex) ? frameIndex : 0)));
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

function finiteReferenceField(field: ReferenceScalarField2D): ReferenceScalarField2D {
  return {
    ...field,
    values: field.values.map((row) => row.map((value) => (Number.isFinite(value) ? value : 0))),
  };
}

function nonFiniteWarning(field: ReferenceScalarField2D): string | null {
  return field.values.some((row) => row.some((value) => !Number.isFinite(value)))
    ? `${field.metadata.display_name} contained NaN or Infinity values; they were hidden in the display.`
    : null;
}

function referenceReplayOverlay(frame: ReferenceFrame, run: ReferenceRun): ReferenceReplayOverlay {
  return {
    cloudBaseY: heightToSvgY(frame, run.diagnostics?.cloud_base_m ?? null),
    cloudTopY: heightToSvgY(frame, run.diagnostics?.cloud_top_m ?? null),
    maxUpdraftPoint: maxFieldPoint(frame.fields.vertical_velocity_m_per_s),
  };
}

function heightToSvgY(frame: ReferenceFrame, heightM: number | null): number | null {
  if (heightM === null || !Number.isFinite(heightM)) {
    return null;
  }
  const z = frame.grid.z_coordinates_m;
  const minZ = Math.min(...z);
  const maxZ = Math.max(...z);
  if (maxZ <= minZ) {
    return null;
  }
  const normalized = Math.min(1, Math.max(0, (heightM - minZ) / (maxZ - minZ)));
  return frame.grid.rows - normalized * frame.grid.rows;
}

function maxFieldPoint(field: ReferenceScalarField2D | undefined): ReferenceReplayOverlay["maxUpdraftPoint"] {
  if (!field) {
    return null;
  }

  let best: ReferenceReplayOverlay["maxUpdraftPoint"] = null;
  field.values.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      if (Number.isFinite(value) && (!best || value > best.value)) {
        best = { row: rowIndex, column: columnIndex, value };
      }
    });
  });
  return best;
}

function fieldLabel(fieldKey: string): string {
  return REFERENCE_FIELD_LABELS[fieldKey as ReferenceFieldKey]?.label ?? fieldKey;
}

function isCloudOrRainField(fieldKey: string): boolean {
  return fieldKey === "cloud_liquid_water_kg_per_kg" || fieldKey === "rain_water_kg_per_kg";
}

function referenceColorIntensity(fieldKey: string, normalizedValue: number): number {
  if (!isCloudOrRainField(fieldKey) || normalizedValue <= 0) {
    return normalizedValue;
  }
  return Math.min(1, 0.16 + Math.pow(normalizedValue, 0.62) * 0.84);
}

function rgbColor([red, green, blue]: [number, number, number]): string {
  return `rgb(${red} ${green} ${blue})`;
}

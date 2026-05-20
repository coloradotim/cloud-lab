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

export type ReferenceFieldDisplayPolicy = {
  fieldKey: string;
  paletteLabel: string;
  legendGradient: string;
  zeroLabel: string;
  highLabel: string;
  displayNote: string;
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
  displayPolicy: ReferenceFieldDisplayPolicy;
  signal: ReferenceFieldSignal;
  cells: ReferenceReplayCell[];
  rows: number;
  columns: number;
  fallbackMessage: string | null;
  overlay: ReferenceReplayOverlay;
};

export type ReferenceDomainSummary = {
  xMinM: number;
  xMaxM: number;
  xWidthM: number;
  zMinM: number;
  zMaxM: number;
  zHeightM: number;
  xOrigin: "centered" | "zero_based" | "other";
  warnings: string[];
  label: string;
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
  const displayPolicy = referenceFieldDisplayPolicy(fieldKey);

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
    displayPolicy,
    signal: referenceFieldSignal(fieldKey, scalarField),
    cells: finiteField.values.flatMap((row, rowIndex) =>
      row.map((value, columnIndex) => ({
        row: rowIndex,
        column: columnIndex,
        value,
        displayValue: formatDisplayValue(scalarField, value),
        color: referenceColorForField(fieldKey, scalarField, value),
      })),
    ),
    rows: frame.grid.rows,
    columns: frame.grid.columns,
    fallbackMessage: nonFiniteWarning(field),
    overlay: referenceReplayOverlay(frame, run),
  };
}

export function buildReferenceDomainSummary(
  run: ReferenceRun | null,
  frameIndex = 0,
): ReferenceDomainSummary | null {
  if (!run?.frames.length) {
    return null;
  }
  const frame = run.frames[clampFrameIndex(run, frameIndex)];
  if (!hasUsableGrid(frame)) {
    return null;
  }

  const x = frame.grid.x_coordinates_m;
  const z = frame.grid.z_coordinates_m;
  const xMinM = Math.min(...x);
  const xMaxM = Math.max(...x);
  const zMinM = Math.min(...z);
  const zMaxM = Math.max(...z);
  const xWidthM = xMaxM - xMinM;
  const zHeightM = zMaxM - zMinM;
  const xOrigin = Math.abs(xMinM + xMaxM) <= Math.max(1, xWidthM * 0.02)
    ? "centered"
    : xMinM >= 0
      ? "zero_based"
      : "other";
  const warnings = referenceDomainWarnings(run, xWidthM);

  return {
    xMinM,
    xMaxM,
    xWidthM,
    zMinM,
    zMaxM,
    zHeightM,
    xOrigin,
    warnings,
    label: `Full CM1 x-domain is ${formatDomainKm(xWidthM)} km wide${
      xOrigin === "centered" ? " with centered x coordinates" : ""
    }.`,
  };
}

export function referenceDomainWarnings(run: ReferenceRun, xWidthM: number): string[] {
  const warnings: string[] = [];
  const sourceCaseId = run.source_case_id;
  const shallowCase = sourceCaseId.includes("cumulus") || sourceCaseId.includes("low-cloud") || sourceCaseId.includes("stratus");

  if (xWidthM > 40_000 && shallowCase) {
    warnings.push(
      `Wide CM1 domain detected for this shallow-cloud case (${formatDomainKm(xWidthM)} km). The guided Appearance view should focus on a smaller cloud-relevant window by default.`,
    );
  }
  if (xWidthM > 300_000) {
    warnings.push(
      `Reference x-coordinate range is unusually large (${formatDomainKm(xWidthM)} km); check for a meter/kilometer unit mismatch.`,
    );
  }
  if (xWidthM <= 0) {
    warnings.push("Reference x-coordinate range is invalid.");
  }

  return warnings;
}

export function referenceFieldDisplayPolicy(fieldKey: string): ReferenceFieldDisplayPolicy {
  switch (fieldKey) {
    case "cloud_liquid_water_kg_per_kg":
      return {
        fieldKey,
        paletteLabel: "Cloud water log scale",
        legendGradient: "linear-gradient(90deg, #f8fcfb 0%, #b9e1ec 38%, #4b9ed0 72%, #07588e 100%)",
        zeroLabel: "zero cloud water",
        highLabel: "more cloud water",
        displayNote:
          "Display-only log/adaptive scale keeps zero cloud water white and makes nonzero cloud structure readable.",
      };
    case "rain_water_kg_per_kg":
      return {
        fieldKey,
        paletteLabel: "Rain water log scale",
        legendGradient: "linear-gradient(90deg, #f9fbff 0%, #bdd7f1 42%, #6c8fd6 76%, #34439b 100%)",
        zeroLabel: "no rain",
        highLabel: "more rain water",
        displayNote:
          "Display-only log/adaptive scale keeps no-rain frames quiet and emphasizes real rain-water signal.",
      };
    case "vertical_velocity_m_per_s":
      return {
        fieldKey,
        paletteLabel: "Signed velocity scale",
        legendGradient: "linear-gradient(90deg, #4578bf 0%, #f7f5ef 50%, #cf5038 100%)",
        zeroLabel: "sinking / weak motion",
        highLabel: "strong rising motion",
        displayNote:
          "Signed zero-centered scale separates downward and upward motion without changing CM1 values.",
      };
    case "water_vapor_kg_per_kg":
      return {
        fieldKey,
        paletteLabel: "Water vapor scale",
        legendGradient: "linear-gradient(90deg, #f6fbf7 0%, #b8e0d7 44%, #4da995 72%, #1f6658 100%)",
        zeroLabel: "drier air",
        highLabel: "moister air",
        displayNote: "Sequential moisture scale shows relative water-vapor supply in the selected frame.",
      };
    case "temperature_k":
    case "potential_temperature_k":
      return {
        fieldKey,
        paletteLabel: "Temperature/theta scale",
        legendGradient: "linear-gradient(90deg, #4778bf 0%, #f7f4e8 50%, #cf513b 100%)",
        zeroLabel: "cooler / lower theta",
        highLabel: "warmer / higher theta",
        displayNote:
          "Adaptive temperature/theta scale shows spatial structure; values remain labeled in source units.",
      };
    default:
      return {
        fieldKey,
        paletteLabel: "Adaptive field scale",
        legendGradient: "linear-gradient(90deg, #f6fbf7 0%, #7fc7c8 55%, #24515a 100%)",
        zeroLabel: "low",
        highLabel: "high",
        displayNote: "Adaptive display scale for this CM1 reference field.",
      };
  }
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

export function referenceFieldHelper(fieldKey: string): string {
  switch (fieldKey) {
    case "cloud_liquid_water_kg_per_kg":
      return "Cloud liquid water shows where cloud exists in the CM1 reference field.";
    case "vertical_velocity_m_per_s":
      return "Vertical velocity shows where air is rising or sinking.";
    case "water_vapor_kg_per_kg":
      return "Water vapor shows the moisture supply for cloud formation.";
    case "potential_temperature_k":
      return "Potential temperature shows stability and heating structure.";
    case "temperature_k":
      return "Temperature shows the thermal structure when CM1 provides direct temperature.";
    case "rain_water_kg_per_kg":
      return "Rain water shows where precipitation appears, if the field is available.";
    default:
      return "This CM1 reference field is shown with source units and provenance.";
  }
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

function formatDomainKm(valueM: number): string {
  return (valueM / 1_000).toLocaleString("en-US", {
    maximumFractionDigits: valueM % 1_000 === 0 ? 0 : 1,
  });
}

function isCloudOrRainField(fieldKey: string): boolean {
  return fieldKey === "cloud_liquid_water_kg_per_kg" || fieldKey === "rain_water_kg_per_kg";
}

function referenceColorForField(fieldKey: string, field: ScalarField, value: number): string {
  const normalized = Math.min(1, Math.max(0, normalizedDisplayValueForFieldKey(fieldKey, field, value)));
  if (fieldKey === "cloud_liquid_water_kg_per_kg") {
    if (value <= (scalingMetadataForField(fieldKey, field).noiseThreshold ?? 0)) {
      return "rgb(248 252 251)";
    }
    return rgbColor(multiStopColor(Math.pow(normalized, 0.58), [
      [248, 252, 251],
      [185, 225, 236],
      [75, 158, 208],
      [7, 88, 142],
    ]));
  }

  if (fieldKey === "rain_water_kg_per_kg") {
    if (value <= (scalingMetadataForField(fieldKey, field).noiseThreshold ?? 0)) {
      return "rgb(249 251 255)";
    }
    return rgbColor(multiStopColor(Math.pow(normalized, 0.56), [
      [249, 251, 255],
      [189, 215, 241],
      [108, 143, 214],
      [52, 67, 155],
    ]));
  }

  if (fieldKey === "water_vapor_kg_per_kg") {
    return rgbColor(multiStopColor(normalized, [
      [246, 251, 247],
      [184, 224, 215],
      [77, 169, 149],
      [31, 102, 88],
    ]));
  }

  if (fieldKey === "vertical_velocity_m_per_s") {
    return rgbColor(colorForNormalizedValue(normalized, "coolwarm"));
  }

  if (fieldKey === "temperature_k" || fieldKey === "potential_temperature_k") {
    return rgbColor(colorForNormalizedValue(normalized, "coolwarm"));
  }

  const colorMap = REFERENCE_COLOR_MAPS[fieldKey] ?? "PuBu";
  return rgbColor(colorForNormalizedValue(normalized, colorMap));
}

function multiStopColor(value: number, stops: Array<[number, number, number]>): [number, number, number] {
  const clamped = Math.min(1, Math.max(0, value));
  const scaled = clamped * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.floor(scaled));
  const local = scaled - index;
  return interpolateColor(stops[index], stops[index + 1], local);
}

function interpolateColor(
  start: [number, number, number],
  end: [number, number, number],
  weight: number,
): [number, number, number] {
  return [
    Math.round(start[0] + (end[0] - start[0]) * weight),
    Math.round(start[1] + (end[1] - start[1]) * weight),
    Math.round(start[2] + (end[2] - start[2]) * weight),
  ];
}

function rgbColor([red, green, blue]: [number, number, number]): string {
  return `rgb(${red} ${green} ${blue})`;
}

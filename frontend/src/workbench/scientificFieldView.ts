import type { ScalarField, SimulationFrame } from "../simulationTypes";
import {
  colorForNormalizedValue,
  displayRangeForFieldKey,
  fieldOptionsFromFrame,
  fieldSummaryForField,
  formatDisplayValue,
  normalizedDisplayValueForFieldKey,
  scalingMetadataForField,
  truthMetadataForField,
  truthMetadataForSolver,
  type FieldOption,
  type FieldSummary,
  type FieldStats,
  type ScalingMetadata,
  type TruthMetadata,
} from "../visualization";

export const FAIR_WEATHER_FIELD_KEYS = [
  "cloud_liquid_water_kg_per_kg",
  "water_vapor_kg_per_kg",
  "temperature_perturbation_k",
  "vertical_velocity_m_per_s",
  "horizontal_velocity_m_per_s",
] as const;

export type FairWeatherFieldKey = (typeof FAIR_WEATHER_FIELD_KEYS)[number];

export type ScientificFieldCell = {
  row: number;
  column: number;
  value: number;
  displayValue: string;
  normalizedValue: number;
  color: string;
};

export type ScientificFieldViewModel = {
  frame: SimulationFrame;
  fieldKey: string;
  field: ScalarField;
  fieldOptions: FieldOption[];
  summary: FieldSummary;
  range: FieldStats;
  scaling: ScalingMetadata;
  truth: TruthMetadata;
  solverTruth: TruthMetadata;
  cells: ScientificFieldCell[];
  rows: number;
  columns: number;
};

const FIELD_COLOR_MAPS: Record<string, string> = {
  cloud_liquid_water_kg_per_kg: "Blues",
  water_vapor_kg_per_kg: "PuBu",
  temperature_perturbation_k: "coolwarm",
  vertical_velocity_m_per_s: "coolwarm",
  horizontal_velocity_m_per_s: "coolwarm",
};

export function defaultScientificFieldKey(frame: SimulationFrame | null): string {
  if (!frame) {
    return FAIR_WEATHER_FIELD_KEYS[0];
  }

  return (
    FAIR_WEATHER_FIELD_KEYS.find((fieldKey) => frame.fields[fieldKey]) ??
    Object.keys(frame.fields)[0] ??
    FAIR_WEATHER_FIELD_KEYS[0]
  );
}

export function availableScientificFields(frame: SimulationFrame | null): FieldOption[] {
  if (!frame) {
    return FAIR_WEATHER_FIELD_KEYS.map((fieldKey) => ({
      key: fieldKey,
      label: fallbackFieldLabel(fieldKey),
      unit: fallbackFieldUnit(fieldKey),
      description: "Available after the solver streams this field.",
      categoryLabel: "Solver output",
    }));
  }

  const options = fieldOptionsFromFrame(frame).filter((option) =>
    FAIR_WEATHER_FIELD_KEYS.includes(option.key as FairWeatherFieldKey),
  );

  return options.length > 0 ? options : fieldOptionsFromFrame(frame);
}

export function normalizeScientificFieldSelection(
  frame: SimulationFrame | null,
  selectedFieldKey: string,
): string {
  if (!frame) {
    return FAIR_WEATHER_FIELD_KEYS.includes(selectedFieldKey as FairWeatherFieldKey)
      ? selectedFieldKey
      : FAIR_WEATHER_FIELD_KEYS[0];
  }

  return frame.fields[selectedFieldKey] ? selectedFieldKey : defaultScientificFieldKey(frame);
}

export function buildScientificFieldViewModel(
  frame: SimulationFrame | null,
  selectedFieldKey: string,
): ScientificFieldViewModel | null {
  if (!frame) {
    return null;
  }

  const fieldKey = normalizeScientificFieldSelection(frame, selectedFieldKey);
  const field = frame.fields[fieldKey];
  if (!field) {
    return null;
  }

  const scaling = scalingMetadataForField(fieldKey, field);
  const colorMap = FIELD_COLOR_MAPS[fieldKey] ?? field.metadata.display_scale?.color_map ?? "PuBu";

  return {
    frame,
    fieldKey,
    field,
    fieldOptions: availableScientificFields(frame),
    summary: fieldSummaryForField(fieldKey, field, frame.config?.solver_type),
    range: displayRangeForFieldKey(fieldKey, field),
    scaling,
    truth: truthMetadataForField(fieldKey, field, frame.config?.solver_type),
    solverTruth: truthMetadataForSolver(frame.config?.solver_type ?? "boussinesq_2d"),
    cells: field.values.flatMap((row, rowIndex) =>
      row.map((value, columnIndex) => ({
        row: rowIndex,
        column: columnIndex,
        value,
        displayValue: formatDisplayValue(field, value),
        normalizedValue: normalizedDisplayValueForFieldKey(fieldKey, field, value),
        color: rgbColor(colorForNormalizedValue(
          normalizedDisplayValueForFieldKey(fieldKey, field, value),
          colorMap,
        )),
      })),
    ),
    rows: frame.grid.rows,
    columns: frame.grid.columns,
  };
}

function rgbColor([red, green, blue]: [number, number, number]): string {
  return `rgb(${red} ${green} ${blue})`;
}

function fallbackFieldLabel(fieldKey: string): string {
  switch (fieldKey) {
    case "cloud_liquid_water_kg_per_kg":
      return "Cloud liquid water";
    case "water_vapor_kg_per_kg":
      return "Water vapor";
    case "temperature_perturbation_k":
      return "Temperature perturbation";
    case "vertical_velocity_m_per_s":
      return "Vertical velocity";
    case "horizontal_velocity_m_per_s":
      return "Horizontal velocity";
    default:
      return fieldKey;
  }
}

function fallbackFieldUnit(fieldKey: string): string {
  if (fieldKey.endsWith("_m_per_s")) {
    return "m/s";
  }
  if (fieldKey === "temperature_perturbation_k") {
    return "K";
  }
  return "kg/kg";
}

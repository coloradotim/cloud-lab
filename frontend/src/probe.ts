import type { ScalarField, SimulationFrame } from "./simulationTypes";
import {
  displayUnitForField,
  formatDisplayValue,
  truthMetadataForField,
} from "./visualization";
import type { TruthMetadata } from "./visualization";

const GRAVITY_M_PER_S2 = 9.81;
const REFERENCE_TEMPERATURE_K = 300.0;

export type ProbeRegionMode = "point" | "neighborhood";

export type ProbeSelection = {
  row: number;
  column: number;
  mode: ProbeRegionMode;
};

export type ProbeDiagnostic = {
  key: string;
  label: string;
  unit: string;
  formattedValue: string;
  value: number | null;
  source: "field" | "derived" | "missing";
  truth: TruthMetadata;
  note?: string;
};

export type ProbeResult = {
  row: number;
  column: number;
  xMeters: number;
  zMeters: number;
  mode: ProbeRegionMode;
  diagnostics: ProbeDiagnostic[];
};

type FieldSpec = {
  key: string;
  label: string;
};

const REQUIRED_FIELD_SPECS: FieldSpec[] = [
  { key: "temperature_k", label: "Temperature" },
  { key: "water_vapor_kg_per_kg", label: "Water vapor" },
  { key: "cloud_liquid_water_kg_per_kg", label: "Cloud liquid water" },
  { key: "horizontal_velocity_m_per_s", label: "Horizontal velocity" },
  { key: "vertical_velocity_m_per_s", label: "Vertical velocity" },
];

export function buildProbeResult(
  frame: SimulationFrame,
  selection: ProbeSelection,
): ProbeResult | null {
  if (!isValidGridPoint(frame, selection.row, selection.column)) {
    return null;
  }

  return {
    row: selection.row,
    column: selection.column,
    xMeters: frame.grid.x_coordinates_m[selection.column],
    zMeters: frame.grid.z_coordinates_m[selection.row],
    mode: selection.mode,
    diagnostics: buildProbeDiagnostics(frame, selection),
  };
}

export function buildProbeDiagnostics(
  frame: SimulationFrame,
  selection: ProbeSelection,
): ProbeDiagnostic[] {
  const diagnostics = REQUIRED_FIELD_SPECS.map((spec) =>
    diagnosticForField(frame, selection, spec.key, spec.label),
  );

  diagnostics.splice(1, 0, relativeHumidityDiagnostic(frame, selection));
  diagnostics.push(buoyancyDiagnostic(frame, selection));

  return diagnostics;
}

function diagnosticForField(
  frame: SimulationFrame,
  selection: ProbeSelection,
  fieldKey: string,
  fallbackLabel: string,
): ProbeDiagnostic {
  const field = frame.fields[fieldKey];
  if (!field) {
    return missingDiagnostic(fieldKey, fallbackLabel);
  }

  const value = sampleField(field, selection, frame.grid.rows, frame.grid.columns);
  const unit = displayUnitForField(field);

  return {
    key: fieldKey,
    label: field.metadata.display_name || fallbackLabel,
    unit,
    formattedValue: formatDisplayValue(field, value),
    value,
    source: "field",
    truth: truthMetadataForField(fieldKey, field, frame.config?.solver_type),
  };
}

function relativeHumidityDiagnostic(
  frame: SimulationFrame,
  selection: ProbeSelection,
): ProbeDiagnostic {
  const temperature = frame.fields.temperature_k;
  const vapor = frame.fields.water_vapor_kg_per_kg;
  if (!temperature || !vapor) {
    return missingDiagnostic("relative_humidity", "Relative humidity");
  }

  const temperatureK = sampleField(temperature, selection, frame.grid.rows, frame.grid.columns);
  const waterVapor = sampleField(vapor, selection, frame.grid.rows, frame.grid.columns);
  const saturation = saturationSpecificHumidityKgPerKg(temperatureK);
  const relativeHumidity = saturation > 0 ? Math.min(1.5, Math.max(0, waterVapor / saturation)) : 0;

  return {
    key: "relative_humidity",
    label: "Relative humidity",
    unit: "%",
    formattedValue: (relativeHumidity * 100).toFixed(1),
    value: relativeHumidity,
    source: "derived",
    truth: truthMetadataForField("relative_humidity"),
    note: "Derived from temperature and water vapor with the V1 saturation approximation.",
  };
}

function buoyancyDiagnostic(frame: SimulationFrame, selection: ProbeSelection): ProbeDiagnostic {
  const perturbation = frame.fields.temperature_perturbation_k;
  if (!perturbation) {
    return missingDiagnostic("buoyancy_m_per_s2", "Approx. buoyancy");
  }

  const temperaturePerturbationK = sampleField(
    perturbation,
    selection,
    frame.grid.rows,
    frame.grid.columns,
  );
  const buoyancy = (GRAVITY_M_PER_S2 * temperaturePerturbationK) / REFERENCE_TEMPERATURE_K;

  return {
    key: "buoyancy_m_per_s2",
    label: "Approx. buoyancy",
    unit: "m s-2",
    formattedValue: buoyancy.toExponential(2),
    value: buoyancy,
    source: "derived",
    truth: truthMetadataForField("buoyancy_m_per_s2"),
    note: "Educational diagnostic from temperature perturbation, not a full pressure-coupled acceleration.",
  };
}

function sampleField(
  field: ScalarField,
  selection: ProbeSelection,
  rows: number,
  columns: number,
): number {
  if (selection.mode === "point") {
    return field.values[selection.row][selection.column];
  }

  let sum = 0;
  let count = 0;
  for (let row = Math.max(0, selection.row - 1); row <= Math.min(rows - 1, selection.row + 1); row += 1) {
    for (
      let column = Math.max(0, selection.column - 1);
      column <= Math.min(columns - 1, selection.column + 1);
      column += 1
    ) {
      sum += field.values[row][column];
      count += 1;
    }
  }

  return count > 0 ? sum / count : field.values[selection.row][selection.column];
}

function missingDiagnostic(key: string, label: string): ProbeDiagnostic {
  return {
    key,
    label,
    unit: "",
    formattedValue: "Not emitted",
    value: null,
    source: "missing",
    truth: truthMetadataForField(key),
  };
}

function isValidGridPoint(frame: SimulationFrame, row: number, column: number): boolean {
  return row >= 0 && row < frame.grid.rows && column >= 0 && column < frame.grid.columns;
}

function saturationSpecificHumidityKgPerKg(temperatureK: number): number {
  const temperatureC = temperatureK - 273.15;
  const saturationVaporPressureHpa = 6.112 * Math.exp((17.67 * temperatureC) / (temperatureC + 243.5));
  const pressureHpa = 900.0;
  const mixingRatio = (0.622 * saturationVaporPressureHpa) / (pressureHpa - saturationVaporPressureHpa);
  return Math.max(0, mixingRatio / (1.0 + mixingRatio));
}

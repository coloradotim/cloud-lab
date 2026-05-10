import type { ScalarField, SimulationConfig, SimulationFrame } from "./simulationTypes";
import { displayUnitForField, displayValueForField } from "./visualization";

export type ProfileMode = "domain_average" | "column";

export type ProfilePoint = {
  height_m: number;
  values: Record<string, number | null>;
};

export type ProfileMarker = {
  key: string;
  label: string;
  height_m: number;
};

export type VerticalProfile = {
  mode: ProfileMode;
  columnIndex: number | null;
  xMeters: number | null;
  points: ProfilePoint[];
  fields: Array<{ key: string; label: string; unit: string; source: "field" | "derived" }>;
  markers: ProfileMarker[];
  note: string | null;
};

const PROFILE_FIELDS = [
  "temperature_k",
  "temperature_perturbation_k",
  "relative_humidity",
  "water_vapor_kg_per_kg",
  "cloud_liquid_water_kg_per_kg",
  "rain_water_kg_per_kg",
  "vertical_velocity_m_per_s",
  "horizontal_velocity_m_per_s",
] as const;

export function buildVerticalProfile(
  frame: SimulationFrame | null,
  config: SimulationConfig | null,
  columnIndex: number | null,
): VerticalProfile | null {
  if (!frame) {
    return null;
  }

  const resolvedColumn =
    columnIndex === null ? null : Math.min(frame.grid.columns - 1, Math.max(0, columnIndex));
  const fields = PROFILE_FIELDS.map((key) => profileFieldDescriptor(frame, key)).filter(
    (field): field is VerticalProfile["fields"][number] => field !== null,
  );
  const points = frame.grid.z_coordinates_m.map((height_m, rowIndex) => ({
    height_m,
    values: Object.fromEntries(
      fields.map((field) => [field.key, profileValue(frame, field.key, rowIndex, resolvedColumn)]),
    ),
  }));

  return {
    mode: resolvedColumn === null ? "domain_average" : "column",
    columnIndex: resolvedColumn,
    xMeters: resolvedColumn === null ? null : frame.grid.x_coordinates_m[resolvedColumn],
    points,
    fields,
    markers: profileMarkers(frame, config),
    note:
      config?.solver_type === "microphysics_lab"
        ? "Microphysics lab is a 0-D parcel/box mode broadcast over the 2-D frame grid."
        : null,
  };
}

function profileFieldDescriptor(
  frame: SimulationFrame,
  key: (typeof PROFILE_FIELDS)[number],
): VerticalProfile["fields"][number] | null {
  if (key === "relative_humidity") {
    if (!frame.fields.temperature_k || !frame.fields.water_vapor_kg_per_kg) {
      return null;
    }

    return {
      key,
      label: "Relative humidity",
      unit: "%",
      source: "derived",
    };
  }

  const field = frame.fields[key];
  if (!field) {
    return null;
  }

  return {
    key,
    label: field.metadata.display_name,
    unit: displayUnitForField(field),
    source: "field",
  };
}

function profileValue(
  frame: SimulationFrame,
  fieldKey: string,
  rowIndex: number,
  columnIndex: number | null,
): number | null {
  if (fieldKey === "relative_humidity") {
    const temperatureK = rawProfileValue(frame.fields.temperature_k, rowIndex, columnIndex);
    const vapor = rawProfileValue(frame.fields.water_vapor_kg_per_kg, rowIndex, columnIndex);
    if (temperatureK === null || vapor === null) {
      return null;
    }

    const saturation = saturationSpecificHumidityKgPerKg(temperatureK);
    return saturation > 0 ? Math.min(150, Math.max(0, (vapor / saturation) * 100)) : null;
  }

  const field = frame.fields[fieldKey];
  if (!field) {
    return null;
  }

  const rawValue = rawProfileValue(field, rowIndex, columnIndex);
  return rawValue === null ? null : displayValueForField(field, rawValue);
}

function rawProfileValue(
  field: ScalarField | undefined,
  rowIndex: number,
  columnIndex: number | null,
): number | null {
  if (!field) {
    return null;
  }

  if (columnIndex !== null) {
    return field.values[rowIndex][columnIndex];
  }

  const row = field.values[rowIndex];
  return row.reduce((sum, value) => sum + value, 0) / row.length;
}

function profileMarkers(
  frame: SimulationFrame,
  config: SimulationConfig | null,
): ProfileMarker[] {
  const markers: ProfileMarker[] = [];
  const sourceConfig = config ?? frame.config ?? null;
  if (!sourceConfig) {
    return markers;
  }

  markers.push({
    key: "boundary_layer_top",
    label: "BL top",
    height_m: sourceConfig.initial_atmosphere.boundary_layer_depth_m,
  });

  const lcl = approximateLclHeightM(
    sourceConfig.initial_atmosphere.surface_temperature_k,
    sourceConfig.initial_atmosphere.relative_humidity,
  );
  if (Number.isFinite(lcl)) {
    markers.push({ key: "estimated_lcl", label: "Est. LCL", height_m: lcl });
  }

  const moistSource = sourceConfig.initial_atmosphere.moist_source_layer_depth_m;
  if (moistSource !== undefined) {
    markers.push({ key: "moist_source_top", label: "Moist source", height_m: moistSource });
  }

  return markers;
}

function approximateLclHeightM(surfaceTemperatureK: number, relativeHumidity: number): number {
  const surfaceTemperatureC = surfaceTemperatureK - 273.15;
  const rh = Math.min(1, Math.max(0.01, relativeHumidity));
  const dewpointC =
    (243.5 * (Math.log(rh) + (17.67 * surfaceTemperatureC) / (243.5 + surfaceTemperatureC))) /
    (17.67 - Math.log(rh) - (17.67 * surfaceTemperatureC) / (243.5 + surfaceTemperatureC));
  return Math.max(0, 125 * (surfaceTemperatureC - dewpointC));
}

function saturationSpecificHumidityKgPerKg(temperatureK: number): number {
  const temperatureC = temperatureK - 273.15;
  const saturationVaporPressureHpa = 6.112 * Math.exp((17.67 * temperatureC) / (temperatureC + 243.5));
  const pressureHpa = 900.0;
  const mixingRatio = (0.622 * saturationVaporPressureHpa) / (pressureHpa - saturationVaporPressureHpa);
  return Math.max(0, mixingRatio / (1.0 + mixingRatio));
}

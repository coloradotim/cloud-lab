import type { ScalarField, SimulationFrame } from "./simulationTypes";

export const DEFAULT_FIELD_ORDER = [
  "cloud_liquid_water_kg_per_kg",
  "water_vapor_kg_per_kg",
  "temperature_k",
  "temperature_perturbation_k",
  "vertical_velocity_m_per_s",
  "horizontal_velocity_m_per_s",
];

export const CLOUD_APPEARANCE_MODE = "bulk_cloud_appearance";
export const DEFAULT_EFFECTIVE_RADIUS_UM = 12;

export type FieldOption = {
  key: string;
  label: string;
  unit: string;
  description: string;
  categoryLabel: string;
};

export type FieldStats = {
  min: number;
  max: number;
};

export type FieldSummary = {
  label: "Field max" | "Field min / max";
  value: string;
  unit: string;
  helper?: string;
  truth: TruthMetadata;
  scaling: ScalingMetadata;
};

export type GridPoint = {
  row: number;
  column: number;
};

export type TruthCategory =
  | "solver_output"
  | "derived_diagnostic"
  | "bulk_approximation"
  | "visual_approximation"
  | "prescribed_forcing"
  | "reference_model_output"
  | "reduced_model_output"
  | "experimental";

export type TruthMetadata = {
  category: TruthCategory;
  label: string;
  explanation: string;
  limitations?: string;
};

export type ScalingMode = "linear" | "log";
export type ScalingRangeMode = "adaptive" | "fixed" | "metadata" | "symmetric";

export type ScalingMetadata = {
  scale: ScalingMode;
  range: ScalingRangeMode;
  signed: boolean;
  noiseThreshold?: number;
  defaultMin?: number;
  defaultMax?: number;
  comparison: "shared_by_default" | "independent_ok";
  explanation: string;
};

const TRUTH_CATEGORY_DETAILS: Record<TruthCategory, Omit<TruthMetadata, "category">> = {
  solver_output: {
    label: "Solver output",
    explanation: "Emitted directly by the selected solver.",
  },
  derived_diagnostic: {
    label: "Derived diagnostic",
    explanation: "Computed from emitted fields and configuration assumptions.",
  },
  bulk_approximation: {
    label: "Bulk approximation",
    explanation: "Physically motivated bulk-model value, not droplet-resolved physics.",
  },
  visual_approximation: {
    label: "Visual approximation",
    explanation: "Rendering interpretation of fields, not a solver-emitted physical field.",
  },
  prescribed_forcing: {
    label: "Prescribed forcing",
    explanation: "Imposed input or forcing, not predicted dynamics.",
  },
  reference_model_output: {
    label: "Reference model output",
    explanation: "Offline reference-model field with source/provenance metadata.",
  },
  reduced_model_output: {
    label: "Reduced model output",
    explanation: "Interactive simplified-model output with documented approximations.",
  },
  experimental: {
    label: "Experimental",
    explanation: "Available for exploration but not quantitatively validated.",
  },
};

const FIELD_TRUTH_CATEGORIES: Record<string, TruthCategory> = {
  temperature_k: "solver_output",
  temperature_perturbation_k: "solver_output",
  water_vapor_kg_per_kg: "solver_output",
  cloud_liquid_water_kg_per_kg: "solver_output",
  rain_water_kg_per_kg: "solver_output",
  horizontal_velocity_m_per_s: "solver_output",
  vertical_velocity_m_per_s: "solver_output",
  relative_humidity: "derived_diagnostic",
  buoyancy_m_per_s2: "derived_diagnostic",
  optical_depth: "visual_approximation",
  rain_indicator: "bulk_approximation",
  [CLOUD_APPEARANCE_MODE]: "visual_approximation",
};

const FIELD_TRUTH_LIMITATIONS: Record<string, string> = {
  relative_humidity: "Uses the V1 saturation approximation and local pressure assumption.",
  buoyancy_m_per_s2: "Approximate thermal buoyancy diagnostic, not full pressure-coupled acceleration.",
  optical_depth: "Future bulk optics view will depend on assumed droplet properties.",
  [CLOUD_APPEARANCE_MODE]:
    "Estimated from bulk cloud liquid water and assumed effective radius; not droplet-resolved Mie scattering.",
  rain_indicator: "Bulk rain indicator, not droplet-resolved precipitation.",
};

const MICROPHYSICS_LAB_FIELD_OVERRIDES: Record<string, TruthCategory> = {
  horizontal_velocity_m_per_s: "prescribed_forcing",
  vertical_velocity_m_per_s: "prescribed_forcing",
};

const FIELD_SCALING_POLICIES: Record<string, ScalingMetadata> = {
  cloud_liquid_water_kg_per_kg: {
    scale: "log",
    range: "adaptive",
    signed: false,
    noiseThreshold: 1e-8,
    defaultMin: 0,
    defaultMax: 1e-3,
    comparison: "shared_by_default",
    explanation: "Suppresses numerical condensate noise and uses log scaling for visible cloud structure.",
  },
  rain_water_kg_per_kg: {
    scale: "log",
    range: "adaptive",
    signed: false,
    noiseThreshold: 1e-8,
    defaultMin: 0,
    defaultMax: 1e-4,
    comparison: "shared_by_default",
    explanation: "Suppresses tiny rain-water noise and uses log scaling when rain is present.",
  },
  water_vapor_kg_per_kg: {
    scale: "linear",
    range: "metadata",
    signed: false,
    defaultMin: 0,
    defaultMax: 0.03,
    comparison: "shared_by_default",
    explanation: "Linear moisture scale; metadata bounds are used when the solver provides them.",
  },
  temperature_k: {
    scale: "linear",
    range: "adaptive",
    signed: false,
    comparison: "shared_by_default",
    explanation: "Absolute temperature is displayed in Celsius with padded adaptive range.",
  },
  temperature_perturbation_k: {
    scale: "linear",
    range: "symmetric",
    signed: true,
    defaultMin: -5,
    defaultMax: 5,
    comparison: "shared_by_default",
    explanation: "Signed perturbations use a zero-centered symmetric range.",
  },
  horizontal_velocity_m_per_s: {
    scale: "linear",
    range: "symmetric",
    signed: true,
    defaultMin: -1,
    defaultMax: 1,
    comparison: "shared_by_default",
    explanation: "Signed velocity uses a zero-centered symmetric range.",
  },
  vertical_velocity_m_per_s: {
    scale: "linear",
    range: "symmetric",
    signed: true,
    defaultMin: -1,
    defaultMax: 1,
    comparison: "shared_by_default",
    explanation: "Signed velocity uses a zero-centered symmetric range.",
  },
  optical_depth: {
    scale: "log",
    range: "adaptive",
    signed: false,
    noiseThreshold: 1e-4,
    defaultMin: 0,
    defaultMax: 10,
    comparison: "shared_by_default",
    explanation: "Future bulk optical-depth rendering should share a log scale for comparisons.",
  },
};

const DEFAULT_SCALING_POLICY: ScalingMetadata = {
  scale: "linear",
  range: "adaptive",
  signed: false,
  comparison: "shared_by_default",
  explanation: "Fallback linear adaptive scale because this field has no specific display policy yet.",
};

export type VectorScale = {
  stride: number;
  pixelsPerMeterPerSecond: number;
};

export type CloudOpticalAssumptions = {
  effectiveRadiusUm: number;
  airDensityKgPerM3: number;
  liquidWaterDensityKgPerM3: number;
  pathLengthM: number;
  sunDirection: { x: number; z: number };
};

export type CloudOpticalCell = {
  opticalDepth: number;
  opacity: number;
  brightness: number;
};

export const DEFAULT_CLOUD_OPTICAL_ASSUMPTIONS: CloudOpticalAssumptions = {
  effectiveRadiusUm: DEFAULT_EFFECTIVE_RADIUS_UM,
  airDensityKgPerM3: 1.1,
  liquidWaterDensityKgPerM3: 1000,
  pathLengthM: 120,
  sunDirection: { x: -0.7, z: 0.7 },
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
      categoryLabel: truthMetadataForField(key, field, frame.config?.solver_type).label,
    };
  });
}

export function visualizationOptionsFromFrame(frame: SimulationFrame | null): FieldOption[] {
  const fieldOptions = fieldOptionsFromFrame(frame);
  if (!frame?.fields.cloud_liquid_water_kg_per_kg) {
    return fieldOptions;
  }

  return [
    {
      key: CLOUD_APPEARANCE_MODE,
      label: "Cloud appearance",
      unit: "optical",
      description: "Bulk optical-depth approximation from cloud liquid water.",
      categoryLabel: TRUTH_CATEGORY_DETAILS.visual_approximation.label,
    },
    ...fieldOptions,
  ];
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

export function fieldSummaryForField(
  fieldKey: string,
  field: ScalarField,
  solverType?: string,
): FieldSummary {
  const stats = displayStatsForField(field);
  const unit = displayUnitForField(field);
  const truth = truthMetadataForField(fieldKey, field, solverType);
  const scaling = scalingMetadataForField(fieldKey, field);
  const displayNoiseThreshold = scaling.noiseThreshold;

  if (
    isKnownNonNegativeField(fieldKey, field) &&
    typeof displayNoiseThreshold === "number" &&
    stats.min < displayNoiseThreshold
  ) {
    return {
      label: "Field max",
      value: formatDisplayValue(field, getFieldStats(field).max),
      unit,
      helper: `Values below ${displayNoiseThreshold.toExponential(1)} ${unit} are display noise.`,
      truth,
      scaling,
    };
  }

  return {
    label: "Field min / max",
    value: `${formatDisplayNumberForField(field, stats.min)} to ${formatDisplayNumberForField(field, stats.max)}`,
    unit,
    truth,
    scaling,
  };
}

export function displayRangeForField(field: ScalarField): FieldStats {
  return displayRangeForFieldKey("", field);
}

export function displayRangeForFieldKey(fieldKey: string, field: ScalarField): FieldStats {
  const policy = scalingMetadataForField(fieldKey, field);

  if (policy.range === "symmetric" || isVelocityField(field)) {
    const stats = displayStatsForField(field);
    const maxAbs = Math.max(Math.abs(stats.min), Math.abs(stats.max), 0.01);
    return { min: -maxAbs, max: maxAbs };
  }

  if (isAbsoluteTemperatureField(field)) {
    const stats = displayStatsForField(field);
    const padding = Math.max(0.5, (stats.max - stats.min) * 0.08);
    return expandFlatRange({ min: stats.min - padding, max: stats.max + padding });
  }

  const range =
    policy.scale === "log" || isCondensateField(field)
      ? getFieldStats(field)
      : valueRangeForField(field);
  return {
    min: displayValueForField(field, range.min),
    max: displayValueForField(field, range.max),
  };
}

export function formatDisplayValue(field: ScalarField, value: number): string {
  const displayValue = displayValueForField(field, value);
  return formatDisplayNumberForField(field, displayValue);
}

export function normalizedDisplayValueForField(field: ScalarField, value: number): number {
  return normalizedDisplayValueForFieldKey("", field, value);
}

export function normalizedDisplayValueForFieldKey(
  fieldKey: string,
  field: ScalarField,
  value: number,
): number {
  const scaling = scalingMetadataForField(fieldKey, field);
  if (scaling.scale === "log" || isCondensateField(field)) {
    return normalizedLogValue(
      value,
      displayRangeForFieldKey(fieldKey, field).max,
      scaling.noiseThreshold,
    );
  }

  const displayValue = displayValueForField(field, value);
  const range = displayRangeForFieldKey(fieldKey, field);
  return normalizedLinearValue(displayValue, range);
}

export function sharedDisplayRangeForField(fieldKey: string, fields: ScalarField[]): FieldStats {
  if (fields.length === 0) {
    return { min: 0, max: 1 };
  }

  const firstField = fields[0];
  const scaling = scalingMetadataForField(fieldKey, firstField);
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const field of fields) {
    const range = displayRangeForFieldKey(fieldKey, field);
    min = Math.min(min, range.min);
    max = Math.max(max, range.max);
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return {
      min: scaling.defaultMin ?? 0,
      max: scaling.defaultMax ?? 1,
    };
  }

  if (scaling.signed) {
    const maxAbs = Math.max(Math.abs(min), Math.abs(max), 0.01);
    return { min: -maxAbs, max: maxAbs };
  }

  return expandFlatRange({ min, max });
}

export function truthMetadataForField(
  fieldKey: string,
  field?: ScalarField,
  solverType?: string,
): TruthMetadata {
  const category =
    solverType === "microphysics_lab" && MICROPHYSICS_LAB_FIELD_OVERRIDES[fieldKey]
      ? MICROPHYSICS_LAB_FIELD_OVERRIDES[fieldKey]
      : FIELD_TRUTH_CATEGORIES[fieldKey] ?? inferTruthCategory(fieldKey, field);

  if (solverType === "boussinesq_2d" && category === "solver_output") {
    return {
      category,
      label: "Experimental solver output",
      explanation: "Emitted directly by Cloud Lab's Yellow-status Boussinesq prototype.",
      limitations:
        FIELD_TRUTH_LIMITATIONS[fieldKey] ??
        "Useful for qualitative exploration, but shaped by prototype stabilizers and safety caps.",
    };
  }

  return {
    category,
    ...TRUTH_CATEGORY_DETAILS[category],
    limitations: FIELD_TRUTH_LIMITATIONS[fieldKey],
  };
}

export function cloudOpticalCell(
  cloudWaterKgPerKg: number,
  assumptions: CloudOpticalAssumptions = DEFAULT_CLOUD_OPTICAL_ASSUMPTIONS,
  edgeLighting = 0,
): CloudOpticalCell {
  const effectiveRadiusM = Math.max(1e-6, assumptions.effectiveRadiusUm * 1e-6);
  const liquidWaterContentKgPerM3 = Math.max(0, cloudWaterKgPerKg) * assumptions.airDensityKgPerM3;
  const opticalDepth =
    (3 * liquidWaterContentKgPerM3 * assumptions.pathLengthM) /
    (2 * assumptions.liquidWaterDensityKgPerM3 * effectiveRadiusM);
  const opacity = opticalDepth <= 0 ? 0 : 1 - Math.exp(-Math.min(12, opticalDepth));
  const brightness = Math.min(1, Math.max(0, 0.72 + edgeLighting * 0.22 - opacity * 0.18));

  return { opticalDepth, opacity, brightness };
}

export function cloudOpticalGrid(
  cloudWater: ScalarField,
  assumptions: CloudOpticalAssumptions = DEFAULT_CLOUD_OPTICAL_ASSUMPTIONS,
): CloudOpticalCell[][] {
  return cloudWater.values.map((row, rowIndex) =>
    row.map((value, columnIndex) =>
      cloudOpticalCell(value, assumptions, cloudEdgeLighting(cloudWater, rowIndex, columnIndex)),
    ),
  );
}

export function truthMetadataForSolver(solverType: string): TruthMetadata {
  if (solverType === "microphysics_lab") {
    return {
      category: "bulk_approximation",
      ...TRUTH_CATEGORY_DETAILS.bulk_approximation,
      limitations: "Controlled parcel/box lab with prescribed forcing, not resolved 2-D dynamics.",
    };
  }

  if (solverType === "educational_2d") {
    return {
      category: "experimental",
      ...TRUTH_CATEGORY_DETAILS.experimental,
      limitations: "Teaching/debugging model retained for legacy compatibility, not public cloud physics.",
    };
  }

  if (solverType === "boussinesq_2d") {
    return {
      category: "experimental",
      label: "Experimental 2-D prototype",
      explanation: "Yellow-status Boussinesq visual dynamics scaffold.",
      limitations:
        "Qualitative exploration only; some behavior is shaped by prototype stabilizers and safety caps.",
    };
  }

  return {
    category: "experimental",
    ...TRUTH_CATEGORY_DETAILS.experimental,
    limitations: "Solver limitations are not yet categorized.",
  };
}

export function scalingMetadataForField(fieldKey: string, field?: ScalarField): ScalingMetadata {
  const policy =
    FIELD_SCALING_POLICIES[fieldKey] ??
    FIELD_SCALING_POLICIES[inferFieldKeyFromMetadata(field)] ??
    (field && isVelocityField(field)
      ? FIELD_SCALING_POLICIES.vertical_velocity_m_per_s
      : field && isCondensateField(field)
        ? FIELD_SCALING_POLICIES.cloud_liquid_water_kg_per_kg
        : DEFAULT_SCALING_POLICY);

  return policy;
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

function normalizedLogValue(value: number, maxValue: number, noiseThreshold = 1e-8): number {
  if (value <= noiseThreshold || maxValue <= noiseThreshold) {
    return 0;
  }

  const floor = noiseThreshold;
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

function isKnownNonNegativeField(fieldKey: string, field: ScalarField): boolean {
  return (
    ["water_vapor_kg_per_kg", "cloud_liquid_water_kg_per_kg", "rain_water_kg_per_kg"].includes(
      fieldKey,
    ) || isCondensateField(field)
  );
}

function inferTruthCategory(fieldKey: string, field?: ScalarField): TruthCategory {
  if (fieldKey === CLOUD_APPEARANCE_MODE || /optical|render/.test(fieldKey)) {
    return "visual_approximation";
  }

  if (/rain/.test(fieldKey) && !field) {
    return "bulk_approximation";
  }

  if (field && isCondensateField(field)) {
    return "solver_output";
  }

  return "solver_output";
}

function cloudEdgeLighting(field: ScalarField, rowIndex: number, columnIndex: number): number {
  const center = field.values[rowIndex][columnIndex];
  if (center <= 0) {
    return 0;
  }

  const left = field.values[rowIndex][Math.max(0, columnIndex - 1)] ?? center;
  const right = field.values[rowIndex][Math.min(field.values[rowIndex].length - 1, columnIndex + 1)] ?? center;
  const down = field.values[Math.max(0, rowIndex - 1)]?.[columnIndex] ?? center;
  const up = field.values[Math.min(field.values.length - 1, rowIndex + 1)]?.[columnIndex] ?? center;
  const gradient = Math.hypot(right - left, up - down);
  return Math.min(1, gradient / Math.max(center, 1e-8));
}

function inferFieldKeyFromMetadata(field?: ScalarField): string {
  if (!field) {
    return "";
  }

  const displayName = field.metadata.display_name.toLowerCase();
  if (displayName.includes("cloud")) {
    return "cloud_liquid_water_kg_per_kg";
  }
  if (displayName.includes("rain")) {
    return "rain_water_kg_per_kg";
  }
  if (displayName.includes("perturbation")) {
    return "temperature_perturbation_k";
  }
  if (displayName.includes("temperature")) {
    return "temperature_k";
  }
  if (displayName.includes("vapor")) {
    return "water_vapor_kg_per_kg";
  }
  return "";
}

function formatDisplayNumberForField(field: ScalarField, displayValue: number): string {
  return field.metadata.unit === "K" ? displayValue.toFixed(2) : displayValue.toExponential(2);
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

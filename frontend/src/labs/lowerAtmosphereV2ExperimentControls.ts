import {
  boundaryLayer1DScenarioPresets,
  cloneProfileConfig,
  type BoundaryLayer1DConfig,
} from "./evolvingBoundaryLayer";
import type { LowerAtmosphereV2ScenarioContract } from "./lowerAtmosphereV2Scenarios";

export type LowerAtmosphereV2IngredientGroup =
  | "Moisture"
  | "Heating"
  | "Cap / stability"
  | "Dry air and mixing";

export type LowerAtmosphereV2IngredientControlId =
  | "lowerAtmosphereHumidity"
  | "surfaceMoisture"
  | "surfaceHeating"
  | "capStrength"
  | "capHeight"
  | "dryAirAbove"
  | "dryAirMixing";

export type LowerAtmosphereV2IngredientOptionId =
  | "drier"
  | "baseline"
  | "more_humid"
  | "low"
  | "moderate"
  | "baseline_high"
  | "weaker"
  | "stronger"
  | "weak"
  | "strong"
  | "lower"
  | "higher"
  | "less_dry";

export type LowerAtmosphereV2ProfileIngredientKey =
  | "initial_relative_humidity"
  | "surface_moisture_flux_strength"
  | "surface_heating_strength"
  | "inversion_strength_k"
  | "inversion_height_m"
  | "free_atmosphere_relative_humidity"
  | "entrainment_strength";

export type LowerAtmosphereV2IngredientOption = {
  id: LowerAtmosphereV2IngredientOptionId;
  label: string;
  value: number;
  valueLabel: string;
  description: string;
  warning?: string;
};

export type LowerAtmosphereV2IngredientControl = {
  id: LowerAtmosphereV2IngredientControlId;
  group: LowerAtmosphereV2IngredientGroup;
  label: string;
  explanation: string;
  profileControlKey: LowerAtmosphereV2ProfileIngredientKey;
  baselineOptionId: LowerAtmosphereV2IngredientOptionId;
  options: LowerAtmosphereV2IngredientOption[];
};

export type LowerAtmosphereV2IngredientSelections = Record<
  LowerAtmosphereV2IngredientControlId,
  LowerAtmosphereV2IngredientOptionId
>;

const ANCHORS = {
  humidityDryFailed: 0.58,
  humidityBaseline: 0.85,
  humidityHumidLowCloud: 0.92,
  surfaceMoistureDryEntrainment: 0.22,
  surfaceMoistureHumidLowCloud: 0.65,
  surfaceMoistureBaselineHigh: 1,
  surfaceHeatingDryFailed: 0.58,
  surfaceHeatingBaseline: 0.72,
  surfaceHeatingMoistSurface: 0.75,
  capStrengthWeak: 1.2,
  capStrengthBaseline: 1.5,
  capStrengthStrong: 6,
  capHeightLower: 850,
  capHeightBaseline: 1_900,
  capHeightHigher: 2_100,
  freeAtmosphereLessDry: 0.82,
  freeAtmosphereBaseline: 0.7,
  freeAtmosphereDrier: 0.12,
  entrainmentWeaker: 0.18,
  entrainmentBaseline: 0.22,
  entrainmentStronger: 0.82,
} as const;

export const lowerAtmosphereV2IngredientControls: LowerAtmosphereV2IngredientControl[] = [
  {
    id: "lowerAtmosphereHumidity",
    group: "Moisture",
    label: "Lower-atmosphere humidity",
    explanation: "Controls how close the source layer starts to saturation.",
    profileControlKey: "initial_relative_humidity",
    baselineOptionId: "baseline",
    options: [
      option("drier", "Drier", ANCHORS.humidityDryFailed, "RH 58%", "Dry-failed contrast value."),
      option("baseline", "Baseline", ANCHORS.humidityBaseline, "RH 85%", "Reference-backed shallow-cloud baseline."),
      option("more_humid", "More humid", ANCHORS.humidityHumidLowCloud, "RH 92%", "Humid low-cloud contrast value."),
    ],
  },
  {
    id: "surfaceMoisture",
    group: "Moisture",
    label: "Surface moisture",
    explanation: "Controls how strongly the surface adds water vapor during the day.",
    profileControlKey: "surface_moisture_flux_strength",
    baselineOptionId: "baseline_high",
    options: [
      option("low", "Low", ANCHORS.surfaceMoistureDryEntrainment, "Low", "Dry-entrainment contrast value."),
      option("moderate", "Moderate", ANCHORS.surfaceMoistureHumidLowCloud, "Moderate", "Humid low-cloud contrast value."),
      option(
        "baseline_high",
        "Baseline high",
        ANCHORS.surfaceMoistureBaselineHigh,
        "High",
        "Baseline is already the documented high end for this control.",
      ),
    ],
  },
  {
    id: "surfaceHeating",
    group: "Heating",
    label: "Surface heating",
    explanation: "Controls how quickly the mixed layer deepens after sunrise.",
    profileControlKey: "surface_heating_strength",
    baselineOptionId: "baseline",
    options: [
      option("weaker", "Weaker", ANCHORS.surfaceHeatingDryFailed, "Weaker", "Dry-failed contrast value."),
      option("baseline", "Baseline", ANCHORS.surfaceHeatingBaseline, "Baseline", "Reference-backed shallow-cloud baseline."),
      option("stronger", "Stronger", ANCHORS.surfaceHeatingMoistSurface, "Stronger", "Moist-surface contrast value."),
    ],
  },
  {
    id: "capStrength",
    group: "Cap / stability",
    label: "Cap strength",
    explanation: "Controls how strongly the stable layer resists vertical growth.",
    profileControlKey: "inversion_strength_k",
    baselineOptionId: "baseline",
    options: [
      option("weak", "Weak", ANCHORS.capStrengthWeak, "Weak", "Dry-entrainment contrast value."),
      option("baseline", "Baseline", ANCHORS.capStrengthBaseline, "1.5 K", "Reference-backed shallow-cloud baseline."),
      option("strong", "Strong", ANCHORS.capStrengthStrong, "6 K", "Capped/suppressed contrast value."),
    ],
  },
  {
    id: "capHeight",
    group: "Cap / stability",
    label: "Cap height",
    explanation: "Controls whether the stable layer sits low enough to limit shallow cloud growth.",
    profileControlKey: "inversion_height_m",
    baselineOptionId: "baseline",
    options: [
      option("lower", "Lower", ANCHORS.capHeightLower, "850 m", "Capped/suppressed contrast value."),
      option("baseline", "Baseline", ANCHORS.capHeightBaseline, "1900 m", "Reference-backed shallow-cloud baseline."),
      option("higher", "Higher", ANCHORS.capHeightHigher, "2100 m", "Dry-entrainment contrast value."),
    ],
  },
  {
    id: "dryAirAbove",
    group: "Dry air and mixing",
    label: "Dry air above cloud layer",
    explanation: "Controls how dry the air is above the boundary layer; lower RH means drier air aloft.",
    profileControlKey: "free_atmosphere_relative_humidity",
    baselineOptionId: "baseline",
    options: [
      option("less_dry", "Less dry", ANCHORS.freeAtmosphereLessDry, "RH 82%", "Humid low-cloud contrast value."),
      option("baseline", "Baseline", ANCHORS.freeAtmosphereBaseline, "RH 70%", "Baseline profile-preset value."),
      option("drier", "Drier", ANCHORS.freeAtmosphereDrier, "RH 12%", "Dry-entrainment contrast value."),
    ],
  },
  {
    id: "dryAirMixing",
    group: "Dry air and mixing",
    label: "Mixing with dry air",
    explanation: "Controls how strongly growing boundary-layer air mixes with drier air aloft.",
    profileControlKey: "entrainment_strength",
    baselineOptionId: "baseline",
    options: [
      option("weaker", "Weaker", ANCHORS.entrainmentWeaker, "Weaker", "Moist-surface contrast value."),
      option("baseline", "Baseline", ANCHORS.entrainmentBaseline, "Baseline", "Reference-backed shallow-cloud baseline."),
      option("stronger", "Stronger", ANCHORS.entrainmentStronger, "Stronger", "Dry-entrainment contrast value."),
    ],
  },
];

export function defaultLowerAtmosphereV2IngredientSelections(
  contract: LowerAtmosphereV2ScenarioContract,
): LowerAtmosphereV2IngredientSelections {
  const config = buildLowerAtmosphereV2ProfileConfig(contract);
  return Object.fromEntries(
    lowerAtmosphereV2IngredientControls.map((control) => [
      control.id,
      nearestOption(control, config[control.profileControlKey]).id,
    ]),
  ) as LowerAtmosphereV2IngredientSelections;
}

export function buildLowerAtmosphereV2ProfileConfig(
  contract: LowerAtmosphereV2ScenarioContract,
  selections?: LowerAtmosphereV2IngredientSelections,
): BoundaryLayer1DConfig {
  const preset =
    boundaryLayer1DScenarioPresets.find(
      (candidate) => candidate.slug === contract.configDefaults.profilePresetId,
    ) ?? boundaryLayer1DScenarioPresets[0];
  const nextConfig = cloneProfileConfig(preset.config);

  for (const [key, value] of Object.entries(contract.configDefaults.profileControls)) {
    if (typeof value === "number" && key in nextConfig) {
      (nextConfig as Record<string, unknown>)[key] = value;
    }
  }

  if (selections) {
    for (const control of lowerAtmosphereV2IngredientControls) {
      const selectedOption = optionForSelection(control, selections[control.id]);
      (nextConfig as Record<LowerAtmosphereV2ProfileIngredientKey, number>)[control.profileControlKey] =
        selectedOption.value;
    }
  }

  return nextConfig;
}

export function lowerAtmosphereV2IngredientSetupModified(
  contract: LowerAtmosphereV2ScenarioContract,
  selections: LowerAtmosphereV2IngredientSelections,
): boolean {
  const defaults = defaultLowerAtmosphereV2IngredientSelections(contract);
  return lowerAtmosphereV2IngredientControls.some(
    (control) => selections[control.id] !== defaults[control.id],
  );
}

export function lowerAtmosphereV2SelectedIngredientRows(
  contract: LowerAtmosphereV2ScenarioContract,
  selections: LowerAtmosphereV2IngredientSelections,
): Array<{
  label: string;
  current: string;
  defaultValue: string;
  group: LowerAtmosphereV2IngredientGroup;
}> {
  const defaults = defaultLowerAtmosphereV2IngredientSelections(contract);
  return lowerAtmosphereV2IngredientControls.map((control) => ({
    label: control.label,
    current: optionForSelection(control, selections[control.id]).label,
    defaultValue: optionForSelection(control, defaults[control.id]).label,
    group: control.group,
  }));
}

export function optionForSelection(
  control: LowerAtmosphereV2IngredientControl,
  optionId: LowerAtmosphereV2IngredientOptionId | undefined,
): LowerAtmosphereV2IngredientOption {
  return control.options.find((candidate) => candidate.id === optionId) ?? control.options[0];
}

function nearestOption(
  control: LowerAtmosphereV2IngredientControl,
  value: number,
): LowerAtmosphereV2IngredientOption {
  return control.options.reduce((nearest, candidate) =>
    Math.abs(candidate.value - value) < Math.abs(nearest.value - value) ? candidate : nearest,
  );
}

function option(
  id: LowerAtmosphereV2IngredientOptionId,
  label: string,
  value: number,
  valueLabel: string,
  description: string,
  warning?: string,
): LowerAtmosphereV2IngredientOption {
  return { id, label, value, valueLabel, description, warning };
}

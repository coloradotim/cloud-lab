import type { CloudFormationPotentialStatus } from "./evolvingBoundaryLayer";

export type LowerAtmosphereV2FlowMode =
  | "atmosphere_evolution"
  | "lifted_cloud"
  | "evolution_lifted_cloud";

export type LowerAtmosphereV2ModelId = "boundary_layer_1d" | "controlled_cloud_column";

export type LowerAtmosphereV2CloudColumnStatus =
  | "cloud_formed"
  | "dry_failed"
  | "cap_suppressed"
  | "lift_too_weak"
  | "moisture_limited"
  | "evaporated"
  | "not_evaluated";

export type LowerAtmosphereV2PrecipitationStatus =
  | "precipitation_not_enabled"
  | "not_evaluated"
  | "cloud_no_rain_path_enabled_later";

export type LowerAtmosphereV2ConfigDefaults = {
  profilePresetId: string;
  cloudColumnPresetId: string;
  profileControls: Record<string, string | number>;
  cloudColumnControls: Record<string, string | number>;
};

export type LowerAtmosphereV2ScenarioContract = {
  id: string;
  name: string;
  shortDescription: string;
  physicalQuestion: string;
  flowModes: LowerAtmosphereV2FlowMode[];
  defaultModelStack: LowerAtmosphereV2ModelId[];
  configDefaults: LowerAtmosphereV2ConfigDefaults;
  expectedProfileStatus: CloudFormationPotentialStatus;
  expectedCloudColumnStatus: LowerAtmosphereV2CloudColumnStatus;
  expectedPrecipitationStatus: LowerAtmosphereV2PrecipitationStatus;
  keyDiagnostics: string[];
  teachingPurpose: string;
  comparisonSuggestions: string[];
  knownLimitations: string[];
  honestyLabels: string[];
};

export type LowerAtmosphereV2ComparisonPair = {
  id: string;
  leftScenarioId: string;
  rightScenarioId: string;
  questionAnswered: string;
  expectedDifference: string;
  diagnosticsToCompare: string[];
};

export const lowerAtmosphereV2HonestyLabels = [
  "Reduced model",
  "1-D profile evolution",
  "Prescribed lift",
  "Controlled cloud formation",
  "Not cloud-resolving dynamics",
  "Not LES/CFD",
  "Not weather prediction",
] as const;

const allFlowModes: LowerAtmosphereV2FlowMode[] = [
  "atmosphere_evolution",
  "lifted_cloud",
  "evolution_lifted_cloud",
];

const reducedModelStack: LowerAtmosphereV2ModelId[] = [
  "boundary_layer_1d",
  "controlled_cloud_column",
];

const baselineDefaults: LowerAtmosphereV2ConfigDefaults = {
  profilePresetId: "moist-surface-cumulus-favorable",
  cloudColumnPresetId: "humid-lifted-column",
  profileControls: {
    surface_heating_strength: 0.72,
    surface_moisture_flux_strength: 1,
    initial_relative_humidity: 0.85,
    inversion_height_m: 1900,
    inversion_strength_k: 1.5,
    entrainment_strength: 0.22,
  },
  cloudColumnControls: {
    updraft_strength_m_per_s: 1.4,
    lift_duration_seconds: 1200,
    forcing_type: "prescribed_lift",
  },
};

export const lowerAtmosphereV2ScenarioContracts: LowerAtmosphereV2ScenarioContract[] = [
  {
    id: "lower-atmosphere-v2-baseline-shallow-cloud",
    name: "Baseline shallow cloud",
    shortDescription:
      "Moderate heating, moisture, cap, and prescribed lift combine to form a shallow warm cloud.",
    physicalQuestion: "When do heating, moisture, and lift combine to form shallow warm cloud?",
    flowModes: allFlowModes,
    defaultModelStack: reducedModelStack,
    configDefaults: baselineDefaults,
    expectedProfileStatus: "cloud_favorable",
    expectedCloudColumnStatus: "cloud_formed",
    expectedPrecipitationStatus: "precipitation_not_enabled",
    keyDiagnostics: [
      "mixed-layer depth vs LCL",
      "first favorable profile time",
      "first cloud time",
      "cloud base",
      "max cloud water",
      "water-budget summary",
    ],
    teachingPurpose: "Establishes the main v2 positive case for environment-to-cloud causality.",
    comparisonSuggestions: [
      "lower-atmosphere-v2-dry-failed-cumulus",
      "lower-atmosphere-v2-capped-suppressed-cloud",
      "lower-atmosphere-v2-humid-low-cloud-contrast",
    ],
    knownLimitations: [
      "Reduced model, not cloud-resolving dynamics.",
      "Lift is prescribed rather than predicted.",
      "Precipitation is architecturally deferred.",
    ],
    honestyLabels: [...lowerAtmosphereV2HonestyLabels],
  },
  {
    id: "lower-atmosphere-v2-dry-failed-cumulus",
    name: "Dry failed cumulus",
    shortDescription: "Air is lifted, but low humidity keeps the column cloud-free.",
    physicalQuestion: "Why can air rise but fail to form cloud?",
    flowModes: allFlowModes,
    defaultModelStack: reducedModelStack,
    configDefaults: {
      profilePresetId: "morning-stable-layer-breaks-down",
      cloudColumnPresetId: "dry-failed-column",
      profileControls: {
        initial_relative_humidity: 0.58,
        surface_moisture_flux_strength: 0.28,
        surface_heating_strength: 0.58,
      },
      cloudColumnControls: {
        updraft_strength_m_per_s: 1,
        lift_duration_seconds: 1200,
        forcing_type: "prescribed_lift",
      },
    },
    expectedProfileStatus: "moisture_limited",
    expectedCloudColumnStatus: "dry_failed",
    expectedPrecipitationStatus: "not_evaluated",
    keyDiagnostics: [
      "LCL too high",
      "RH near mixed-layer top too low",
      "first cloud time absent",
      "cloud liquid water near zero",
    ],
    teachingPurpose: "Shows that lift alone does not guarantee saturation or cloud water.",
    comparisonSuggestions: ["lower-atmosphere-v2-baseline-shallow-cloud"],
    knownLimitations: [
      "Dry-failed status is a deterministic reduced-model diagnosis.",
      "No Boussinesq thermal motion is used to justify the result.",
    ],
    honestyLabels: [...lowerAtmosphereV2HonestyLabels],
  },
  {
    id: "lower-atmosphere-v2-capped-suppressed-cloud",
    name: "Capped / suppressed cloud",
    shortDescription: "A low, strong inversion suppresses profile growth and limits lifted cloud.",
    physicalQuestion: "How does an inversion or cap prevent cloud formation?",
    flowModes: allFlowModes,
    defaultModelStack: reducedModelStack,
    configDefaults: {
      profilePresetId: "strong-cap-suppresses-growth",
      cloudColumnPresetId: "capped-suppressed-column",
      profileControls: {
        inversion_height_m: 850,
        inversion_strength_k: 6,
        surface_heating_strength: 0.72,
      },
      cloudColumnControls: {
        updraft_strength_m_per_s: 1.4,
        lift_duration_seconds: 1200,
        cap_suppression_strength: 1,
        forcing_type: "prescribed_lift",
      },
    },
    expectedProfileStatus: "cap_suppressed",
    expectedCloudColumnStatus: "cap_suppressed",
    expectedPrecipitationStatus: "not_evaluated",
    keyDiagnostics: [
      "inversion height",
      "inversion strength",
      "mixed-layer depth near cap",
      "cloud top/proxy relative to cap",
      "expected vs observed suppression",
    ],
    teachingPurpose: "Makes the cap/inversion an explicit cloud-limiting mechanism.",
    comparisonSuggestions: ["lower-atmosphere-v2-baseline-shallow-cloud"],
    knownLimitations: [
      "Cap suppression is a controlled reduced-model proxy.",
      "The column lift is restricted by metadata, not predicted dynamics.",
    ],
    honestyLabels: [...lowerAtmosphereV2HonestyLabels],
  },
  {
    id: "lower-atmosphere-v2-moist-surface-enables-cloud",
    name: "Moist surface enables cloud",
    shortDescription: "Surface moisture changes a marginal profile into a favorable one.",
    physicalQuestion: "How does surface moisture change cloud potential?",
    flowModes: allFlowModes,
    defaultModelStack: reducedModelStack,
    configDefaults: {
      profilePresetId: "surface-moisture-flux-enables-potential",
      cloudColumnPresetId: "humid-lifted-column",
      profileControls: {
        surface_moisture_flux_strength: 1,
        surface_heating_strength: 0.75,
        initial_relative_humidity: 0.78,
      },
      cloudColumnControls: baselineDefaults.cloudColumnControls,
    },
    expectedProfileStatus: "cloud_favorable",
    expectedCloudColumnStatus: "cloud_formed",
    expectedPrecipitationStatus: "precipitation_not_enabled",
    keyDiagnostics: [
      "surface moisture added",
      "LCL change",
      "cloud/no-cloud comparison",
      "first favorable time",
    ],
    teachingPurpose:
      "Supports dry-surface versus moist-surface comparison without changing the dynamics engine.",
    comparisonSuggestions: ["lower-atmosphere-v2-dry-failed-cumulus"],
    knownLimitations: [
      "Surface flux is a reduced-model preset scalar.",
      "Rain is not evaluated even when cloud forms.",
    ],
    honestyLabels: [...lowerAtmosphereV2HonestyLabels],
  },
  {
    id: "lower-atmosphere-v2-dry-entrainment-suppresses-cloud",
    name: "Dry entrainment suppresses cloud",
    shortDescription: "Growth entrains dry air, worsening cloud potential and reducing cloud outcome.",
    physicalQuestion: "How can a growing boundary layer become less cloud-favorable?",
    flowModes: allFlowModes,
    defaultModelStack: reducedModelStack,
    configDefaults: {
      profilePresetId: "dry-entrainment-suppresses-potential",
      cloudColumnPresetId: "dry-failed-column",
      profileControls: {
        free_atmosphere_relative_humidity: 0.12,
        entrainment_strength: 0.82,
        surface_moisture_flux_strength: 0.22,
      },
      cloudColumnControls: {
        updraft_strength_m_per_s: 1.4,
        lift_duration_seconds: 1200,
        forcing_type: "prescribed_lift",
      },
    },
    expectedProfileStatus: "dry_entrainment_suppressed",
    expectedCloudColumnStatus: "dry_failed",
    expectedPrecipitationStatus: "not_evaluated",
    keyDiagnostics: [
      "entrainment drying proxy",
      "RH near mixed-layer top",
      "LCL trend",
      "cloud amount reduction",
    ],
    teachingPurpose: "Separates boundary-layer growth from cloud favorability when air aloft is dry.",
    comparisonSuggestions: ["lower-atmosphere-v2-baseline-shallow-cloud"],
    knownLimitations: [
      "Entrainment is simplified and deterministic.",
      "Column cloud reduction is interpreted through prescribed-profile inputs.",
    ],
    honestyLabels: [...lowerAtmosphereV2HonestyLabels],
  },
  {
    id: "lower-atmosphere-v2-heating-lift-comparison",
    name: "Stronger heating / stronger lift comparison",
    shortDescription: "Compares environment-deepening controls with prescribed-lift controls.",
    physicalQuestion:
      "What is the difference between making the environment favorable and lifting air strongly?",
    flowModes: allFlowModes,
    defaultModelStack: reducedModelStack,
    configDefaults: {
      profilePresetId: "moist-surface-cumulus-favorable",
      cloudColumnPresetId: "stronger-lift-earlier-cloud",
      profileControls: {
        surface_heating_strength: 0.72,
        surface_moisture_flux_strength: 1,
      },
      cloudColumnControls: {
        updraft_strength_m_per_s: 2.2,
        lift_duration_seconds: 1200,
        forcing_type: "prescribed_lift",
      },
    },
    expectedProfileStatus: "cloud_favorable",
    expectedCloudColumnStatus: "cloud_formed",
    expectedPrecipitationStatus: "precipitation_not_enabled",
    keyDiagnostics: [
      "heating accumulation",
      "mixed-layer depth",
      "lift strength",
      "first cloud time",
      "cloud amount",
    ],
    teachingPurpose:
      "Shows that surface heating and prescribed lift affect different parts of the v2 workflow.",
    comparisonSuggestions: ["lower-atmosphere-v2-baseline-shallow-cloud"],
    knownLimitations: [
      "Stronger lift is prescribed forcing, not predicted circulation.",
      "The scenario is a comparison contract, not a tuned forecast.",
    ],
    honestyLabels: [...lowerAtmosphereV2HonestyLabels],
  },
  {
    id: "lower-atmosphere-v2-humid-low-cloud-contrast",
    name: "Humid low-cloud contrast",
    shortDescription: "Very humid low-level air forms low cloud easily under lift.",
    physicalQuestion: "What happens when the LCL is very low?",
    flowModes: allFlowModes,
    defaultModelStack: reducedModelStack,
    configDefaults: {
      profilePresetId: "humid-low-cloud-contrast",
      cloudColumnPresetId: "humid-lifted-column",
      profileControls: {
        initial_relative_humidity: 0.92,
        free_atmosphere_relative_humidity: 0.82,
        surface_moisture_flux_strength: 0.65,
      },
      cloudColumnControls: baselineDefaults.cloudColumnControls,
    },
    expectedProfileStatus: "cloud_favorable",
    expectedCloudColumnStatus: "cloud_formed",
    expectedPrecipitationStatus: "precipitation_not_enabled",
    keyDiagnostics: ["low LCL", "low cloud base", "contrast-case warning"],
    teachingPurpose:
      "Provides a useful low-LCL contrast without presenting it as classic fair-weather cumulus.",
    comparisonSuggestions: ["lower-atmosphere-v2-baseline-shallow-cloud"],
    knownLimitations: [
      "Contrast case, not the default Lower Atmosphere baseline.",
      "Low-cloud ease should not be described as cloud-resolving truth.",
    ],
    honestyLabels: [...lowerAtmosphereV2HonestyLabels],
  },
  {
    id: "lower-atmosphere-v2-rain-capable-warm-cloud-later",
    name: "Rain-capable warm cloud later",
    shortDescription: "Sustained cloud water is reserved for future warm-rain diagnostics.",
    physicalQuestion: "When does cloud water become rain?",
    flowModes: allFlowModes,
    defaultModelStack: reducedModelStack,
    configDefaults: {
      profilePresetId: "moist-surface-cumulus-favorable",
      cloudColumnPresetId: "humid-lifted-column",
      profileControls: baselineDefaults.profileControls,
      cloudColumnControls: {
        updraft_strength_m_per_s: 1.4,
        lift_duration_seconds: 1500,
        runtime_seconds: 2400,
        forcing_type: "prescribed_lift",
      },
    },
    expectedProfileStatus: "cloud_favorable",
    expectedCloudColumnStatus: "cloud_formed",
    expectedPrecipitationStatus: "precipitation_not_enabled",
    keyDiagnostics: [
      "cloud water duration",
      "cloud water amount",
      "future rain status",
      "future first rain time",
      "future water-budget drift",
      "future effective radius/droplet fields",
    ],
    teachingPurpose:
      "Keeps precipitation architecture visible while being honest that rain is not implemented.",
    comparisonSuggestions: ["lower-atmosphere-v2-baseline-shallow-cloud"],
    knownLimitations: [
      "Precipitation diagnostics are not enabled in early v2.",
      "No PySDM, droplet distributions, or rain sedimentation are implied.",
    ],
    honestyLabels: [...lowerAtmosphereV2HonestyLabels],
  },
];

export const lowerAtmosphereV2ComparisonPairs: LowerAtmosphereV2ComparisonPair[] = [
  {
    id: "baseline-vs-dry-failed",
    leftScenarioId: "lower-atmosphere-v2-baseline-shallow-cloud",
    rightScenarioId: "lower-atmosphere-v2-dry-failed-cumulus",
    questionAnswered: "How does moisture availability change cloud formation?",
    expectedDifference: "The baseline forms cloud; the dry case remains cloud-free or moisture-limited.",
    diagnosticsToCompare: ["LCL", "RH near mixed-layer top", "first cloud time", "max cloud water"],
  },
  {
    id: "baseline-vs-capped-suppressed",
    leftScenarioId: "lower-atmosphere-v2-baseline-shallow-cloud",
    rightScenarioId: "lower-atmosphere-v2-capped-suppressed-cloud",
    questionAnswered: "How does a cap limit profile growth and cloud depth?",
    expectedDifference: "The capped case is suppressed or shallower than the baseline.",
    diagnosticsToCompare: ["inversion height", "cap suppression index", "cloud top proxy"],
  },
  {
    id: "dry-surface-vs-moist-surface",
    leftScenarioId: "lower-atmosphere-v2-dry-failed-cumulus",
    rightScenarioId: "lower-atmosphere-v2-moist-surface-enables-cloud",
    questionAnswered: "How does surface moisture flux change the outcome?",
    expectedDifference: "The moist surface lowers LCL or sustains RH enough to become favorable.",
    diagnosticsToCompare: ["surface moisture added", "LCL", "first favorable time"],
  },
  {
    id: "weak-heating-vs-strong-heating",
    leftScenarioId: "lower-atmosphere-v2-dry-failed-cumulus",
    rightScenarioId: "lower-atmosphere-v2-heating-lift-comparison",
    questionAnswered: "What changes when the environment receives stronger heating?",
    expectedDifference:
      "Stronger heating deepens the mixed layer but still depends on moisture and cap state.",
    diagnosticsToCompare: ["surface heating accumulated", "mixed-layer depth", "profile status"],
  },
  {
    id: "weak-lift-vs-strong-lift",
    leftScenarioId: "lower-atmosphere-v2-baseline-shallow-cloud",
    rightScenarioId: "lower-atmosphere-v2-heating-lift-comparison",
    questionAnswered: "How does prescribed lift strength affect cloud timing?",
    expectedDifference: "Stronger prescribed lift forms cloud earlier when the profile is moist enough.",
    diagnosticsToCompare: ["lift strength", "first cloud time", "max cloud water"],
  },
  {
    id: "weak-entrainment-vs-dry-entrainment",
    leftScenarioId: "lower-atmosphere-v2-baseline-shallow-cloud",
    rightScenarioId: "lower-atmosphere-v2-dry-entrainment-suppresses-cloud",
    questionAnswered: "How does dry air aloft reduce cloud potential?",
    expectedDifference: "Dry entrainment raises LCL or lowers RH enough to delay or prevent cloud.",
    diagnosticsToCompare: ["entrainment drying proxy", "RH near mixed-layer top", "LCL trend"],
  },
  {
    id: "baseline-vs-humid-low-cloud-contrast",
    leftScenarioId: "lower-atmosphere-v2-baseline-shallow-cloud",
    rightScenarioId: "lower-atmosphere-v2-humid-low-cloud-contrast",
    questionAnswered: "What changes when the LCL is very low?",
    expectedDifference: "The humid contrast forms lower cloud and should be labeled as a contrast case.",
    diagnosticsToCompare: ["LCL", "cloud base", "contrast-case warning"],
  },
  {
    id: "cloud-formed-vs-rain-capable-later",
    leftScenarioId: "lower-atmosphere-v2-baseline-shallow-cloud",
    rightScenarioId: "lower-atmosphere-v2-rain-capable-warm-cloud-later",
    questionAnswered: "What would future rain diagnostics need beyond cloud formation?",
    expectedDifference:
      "Both can form cloud, but rain-capable later stays precipitation_not_enabled in early v2.",
    diagnosticsToCompare: ["max cloud water", "cloud water duration", "precipitation status"],
  },
];

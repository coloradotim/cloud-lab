import type {
  LabControlDefinition,
  LabDefinition,
  LabDiagnosticDefinition,
  LabScenarioDefinition,
  LabVisualizationModeDefinition,
} from "./labTypes";

export const FAIR_WEATHER_CUMULUS_LAB_ID = "fair-weather-cumulus";

const fairWeatherControls: LabControlDefinition[] = [
  {
    id: "surface-heating-strength",
    label: "Surface heating strength",
    tier: "primary",
    meaning: "Lower-boundary warming that drives buoyant thermals.",
    expectedEffect:
      "Stronger heating generally increases vertical response and can deepen cloud, all else equal.",
    unitsOrType: "K s-1 or weak / moderate / strong",
    configPaths: ["surface_heating.max_warming_rate_k_per_s"],
  },
  {
    id: "surface-heating-pattern",
    label: "Surface heating pattern",
    tier: "primary",
    meaning: "Spatial distribution of heating along the surface.",
    expectedEffect:
      "Changes where thermals initiate and whether one or multiple plume regions appear.",
    unitsOrType: "single patch / broad patch / weak uneven / multi-patch",
    configPaths: ["surface_heating.pattern"],
  },
  {
    id: "source-layer-humidity",
    label: "Source-layer humidity",
    tier: "primary",
    meaning: "Moisture available near the surface or lower mixed layer.",
    expectedEffect: "Higher humidity lowers expected LCL and favors earlier or lower cloud formation.",
    unitsOrType: "RH fraction / percent",
    configPaths: ["initial_atmosphere.relative_humidity"],
  },
  {
    id: "free-atmosphere-humidity",
    label: "Free-atmosphere humidity",
    tier: "primary",
    meaning: "Moisture above the source layer or mixed layer.",
    expectedEffect: "Drier air aloft limits cloud depth or promotes evaporation and suppression.",
    unitsOrType: "RH fraction / percent",
    configPaths: ["initial_atmosphere.free_atmosphere_relative_humidity"],
  },
  {
    id: "stability-lapse-rate",
    label: "Stability / lapse rate",
    tier: "primary",
    meaning: "Environmental temperature decrease with height.",
    expectedEffect:
      "More stable profiles suppress vertical development; less stable profiles allow deeper growth.",
    unitsOrType: "K m-1 or stable / neutral / unstable",
    configPaths: ["initial_atmosphere.lapse_rate_k_per_m"],
  },
  {
    id: "boundary-layer-depth-cap-height",
    label: "Boundary-layer depth / cap height",
    tier: "primary",
    meaning: "Approximate top of the mixed/source layer or capping structure.",
    expectedEffect:
      "A lower or stronger cap can suppress cloud growth; source-layer depth affects moisture supply.",
    unitsOrType: "m",
    configPaths: ["initial_atmosphere.boundary_layer_depth_m"],
  },
  {
    id: "model-resolution",
    label: "Model resolution",
    tier: "primary",
    meaning: "Numerical sampling density for the 2-D slice.",
    expectedEffect: "Higher resolution can reveal more structure but costs more local runtime.",
    unitsOrType: "Low / Medium / High",
    configPaths: ["grid"],
  },
  {
    id: "domain-width",
    label: "Domain width",
    tier: "primary",
    meaning: "Horizontal size of the modeled atmospheric slice.",
    expectedEffect: "A wider box gives thermals more horizontal room to organize.",
    unitsOrType: "m",
    configPaths: ["domain.width_m"],
  },
  {
    id: "domain-height",
    label: "Domain height",
    tier: "primary",
    meaning: "Vertical height of the modeled atmospheric slice.",
    expectedEffect: "A taller box can show deeper growth when runtime and physics allow it.",
    unitsOrType: "m",
    configPaths: ["domain.height_m"],
  },
  {
    id: "run-length",
    label: "Run length",
    tier: "primary",
    meaning: "How long the model evolves before the run completes.",
    expectedEffect: "Longer runs can show delayed cloud onset and more mature evolution.",
    unitsOrType: "s",
    configPaths: ["time.duration_seconds"],
  },
  {
    id: "background-horizontal-wind",
    label: "Background horizontal wind",
    tier: "secondary",
    meaning: "Uniform background flow through the 2-D slice.",
    expectedEffect: "Tilts or displaces thermals and can separate cloud from the heating source.",
    unitsOrType: "m s-1",
    configPaths: ["background_wind.u_m_per_s"],
  },
  {
    id: "moist-source-layer-depth",
    label: "Moist source-layer depth",
    tier: "secondary",
    meaning: "Depth of conserved near-surface moisture.",
    expectedEffect: "A deeper moist layer can support more cloud water.",
    unitsOrType: "m",
    configPaths: ["initial_atmosphere.moist_source_layer_depth_m"],
  },
  {
    id: "heating-patch-geometry",
    label: "Heating patch width / location",
    tier: "secondary",
    meaning: "Geometry of the surface heat source.",
    expectedEffect: "Changes plume width and source location.",
    unitsOrType: "m",
    configPaths: ["surface_heating.patch_width_m", "surface_heating.patch_center_x_m"],
  },
  {
    id: "seed",
    label: "Seed",
    tier: "secondary",
    meaning: "Reproducibility for stochastic or structured perturbations.",
    expectedEffect: "Keeps comparable experiments repeatable.",
    unitsOrType: "integer",
    configPaths: ["seed"],
  },
  {
    id: "domain-grid",
    label: "Domain and grid",
    tier: "advanced",
    meaning: "Physical domain size and spatial resolution.",
    expectedEffect: "Affects numerical behavior, spatial detail, and runtime.",
    unitsOrType: "m and grid cells",
    configPaths: ["domain.width_m", "domain.height_m", "grid.columns", "grid.rows"],
  },
  {
    id: "time-step-frame-cadence",
    label: "Timestep and frame cadence",
    tier: "advanced",
    meaning: "Numerical integration timestep and emitted-frame interval.",
    expectedEffect: "Affects stability, replay smoothness, and runtime.",
    unitsOrType: "s",
    configPaths: ["time.time_step_seconds", "time.frame_interval_seconds"],
  },
  {
    id: "raw-solver-type",
    label: "Raw solver type",
    tier: "advanced",
    meaning: "Backend physics core selection.",
    expectedEffect: "Should remain implicit for the lab unless advanced/system mode is active.",
    unitsOrType: "solver id",
    configPaths: ["solver_type"],
  },
];

const fairWeatherDiagnostics: LabDiagnosticDefinition[] = [
  {
    id: "expected-lcl-cloud-base",
    label: "Expected LCL / cloud base",
    purpose: "Shows where source-layer air should first saturate under diagnostic assumptions.",
    kind: "scenario-contract",
  },
  {
    id: "first-cloud-time",
    label: "First cloud time",
    purpose: "Shows when cloud water first appeared.",
    kind: "scenario-contract",
  },
  {
    id: "first-cloud-height",
    label: "First cloud height",
    purpose: "Compares onset location to the expected LCL.",
    kind: "warning",
  },
  {
    id: "actual-cloud-base-height",
    label: "Actual cloud-base height",
    purpose: "Shows where modeled cloud begins.",
    kind: "warning",
  },
  {
    id: "cloud-top-height",
    label: "Cloud-top height",
    purpose: "Shows depth of cloud development.",
    kind: "display",
  },
  {
    id: "max-updraft",
    label: "Max updraft",
    purpose: "Shows thermal strength.",
    kind: "display",
  },
  {
    id: "integrated-max-cloud-water",
    label: "Integrated / max cloud water",
    purpose: "Shows amount of modeled cloud condensate.",
    kind: "display",
  },
  {
    id: "below-lcl-cloud-water-fraction",
    label: "Below-LCL cloud-water fraction",
    purpose: "Flags physically questionable condensate placement.",
    kind: "warning",
  },
  {
    id: "boundary-cloud-fraction",
    label: "Boundary cloud fraction",
    purpose: "Flags boundary or sponge artifacts.",
    kind: "warning",
  },
  {
    id: "low-level-return-flow-cloud-water",
    label: "Low-level return-flow cloud water",
    purpose: "Flags cloud in implausible circulation regions.",
    kind: "warning",
  },
  {
    id: "expected-vs-observed-status",
    label: "Expected vs observed status",
    purpose: "Summarizes whether the run matched the scenario contract.",
    kind: "scenario-contract",
  },
  {
    id: "dry-failed-cloud-outcome",
    label: "Dry failed cloud check",
    purpose: "Confirms dry-failed scenarios produce motion but little or no cloud.",
    kind: "hard-check",
  },
];

const fairWeatherVisualizationModes: LabVisualizationModeDefinition[] = [
  {
    id: "scientific-2d-field-view",
    name: "Scientific 2-D field view",
    description:
      "Shows solver fields including cloud liquid water, water vapor, temperature perturbation, and velocity.",
    consumesFields: [
      "cloud_liquid_water_kg_per_kg",
      "water_vapor_kg_per_kg",
      "temperature_perturbation_k",
      "vertical_velocity_m_per_s",
      "horizontal_velocity_m_per_s",
    ],
    truthLabel: "solver-output",
  },
  {
    id: "profile-sounding-view",
    name: "Profile / sounding view",
    description:
      "Shows vertical profiles with LCL and boundary/source-layer markers when diagnostics are available.",
    consumesFields: [
      "temperature_k",
      "water_vapor_kg_per_kg",
      "cloud_liquid_water_kg_per_kg",
      "vertical_velocity_m_per_s",
    ],
    truthLabel: "derived-diagnostic",
  },
  {
    id: "timeline-replay-view",
    name: "Timeline / replay view",
    description: "Shows simulation time, frame count, and later first-cloud or max-cloud markers.",
    consumesFields: [],
    truthLabel: "derived-diagnostic",
  },
  {
    id: "inspector-diagnostics",
    name: "Inspector",
    description: "Shows overview, expected-vs-observed diagnostics, profile, and probe context.",
    consumesFields: [
      "cloud_liquid_water_kg_per_kg",
      "water_vapor_kg_per_kg",
      "vertical_velocity_m_per_s",
    ],
    truthLabel: "derived-diagnostic",
  },
];

const fairWeatherScenarios: LabScenarioDefinition[] = [
  {
    id: "fair-weather-moderate-base",
    labId: FAIR_WEATHER_CUMULUS_LAB_ID,
    name: "Moderate cloud base",
    intendedPhenomenon: "Baseline shallow cumulus case.",
    expectedBehavior:
      "Thermal circulation develops first; cloud forms later near expected LCL; cloud top grows with heating and stability.",
    keyControls: [
      "surface-heating-strength",
      "source-layer-humidity",
      "stability-lapse-rate",
      "model-resolution",
      "domain-width",
      "domain-height",
      "run-length",
    ],
    diagnosticExpectations: [
      "Expected LCL is finite and above the first model levels.",
      "Cloud onset occurs after thermal motion develops.",
      "Cloud water forms near expected LCL within prototype tolerance.",
    ],
    limitations: ["Qualitative Boussinesq prototype with simplified entrainment and turbulence."],
  },
  {
    id: "dry-failed-cumulus",
    labId: FAIR_WEATHER_CUMULUS_LAB_ID,
    name: "Dry failed cumulus",
    intendedPhenomenon: "Negative control: buoyant motion without condensation.",
    expectedBehavior: "Motion and updrafts develop while cloud liquid water remains negligible.",
    keyControls: ["source-layer-humidity", "surface-heating-strength", "run-length"],
    diagnosticExpectations: [
      "Maximum vertical velocity is nonzero.",
      "Cloud liquid water remains negligible.",
      "Dry failed cloud check reports motion without meaningful cloud.",
    ],
    limitations: ["Dry suppression is qualitative; entrainment and turbulence are simplified."],
  },
  {
    id: "dry-cap-suppressed-cumulus",
    labId: FAIR_WEATHER_CUMULUS_LAB_ID,
    name: "Dry cap / suppressed cumulus",
    intendedPhenomenon: "Inhibition from a dry or stable layer aloft.",
    expectedBehavior: "Thermals lift, but cloud development is delayed, shallow, limited, or suppressed.",
    keyControls: [
      "free-atmosphere-humidity",
      "boundary-layer-depth-cap-height",
      "stability-lapse-rate",
      "surface-heating-strength",
    ],
    diagnosticExpectations: [
      "Dry cap appears in the RH sounding.",
      "Cloud water is reduced relative to similar no-cap setups.",
      "Vertical development is capped or delayed.",
    ],
    limitations: ["Dry-cap structure is idealized and grid-smoothed."],
  },
  {
    id: "multi-thermal-cumulus-field",
    labId: FAIR_WEATHER_CUMULUS_LAB_ID,
    name: "Multi-thermal field",
    intendedPhenomenon: "Multiple thermal responses from structured surface heating.",
    expectedBehavior: "Multiple plume or cloud regions may appear before merger or diffusion.",
    keyControls: ["surface-heating-pattern", "surface-heating-strength", "source-layer-humidity"],
    diagnosticExpectations: [
      "Heating pattern produces more than one buoyant response.",
      "Cloud regions may remain distinct for a useful part of the run.",
      "The scenario remains a controlled shallow-cumulus experiment, not the whole product vision.",
    ],
    limitations: ["Cell merger depends on grid resolution, wind, diffusion, and seed."],
  },
];

const fairWeatherLab: LabDefinition = {
  id: FAIR_WEATHER_CUMULUS_LAB_ID,
  name: "Fair-Weather Cumulus",
  question: "Why do puffy cumulus clouds form on some warm afternoons and not others?",
  description:
    "Vary surface heating, moisture, stability, boundary-layer structure, and runtime to see whether shallow cumulus forms, when it forms, and why similar setups can fail.",
  status: "prototype",
  statusLabel: "Prototype / first reference lab",
  supportedPhysicsCore: "boussinesq_2d",
  concepts: [
    "surface sensible heating",
    "buoyant thermals",
    "source-layer moisture",
    "lifted condensation level / cloud base",
    "atmospheric stability and lapse rate",
    "boundary-layer depth / capping structure",
    "dry free-atmosphere entrainment effects",
    "cloud onset time",
    "cloud-top height",
    "dry failed cumulus",
    "expected vs observed diagnostics",
  ],
  limitations: [
    "Qualitative 2-D Boussinesq prototype",
    "Simplified warm-cloud condensation",
    "No droplet-size distribution or resolved rain in this lab version",
    "Designed for learning and exploration, not weather prediction",
  ],
  scenarios: fairWeatherScenarios,
  controls: fairWeatherControls,
  diagnostics: fairWeatherDiagnostics,
  visualizationModes: fairWeatherVisualizationModes,
  isSelectable: true,
};

function plannedLab(lab: Omit<LabDefinition, "supportedPhysicsCore" | "scenarios" | "controls" | "diagnostics" | "visualizationModes" | "isSelectable">): LabDefinition {
  return {
    ...lab,
    supportedPhysicsCore: null,
    scenarios: [],
    controls: [],
    diagnostics: [],
    visualizationModes: [],
    isSelectable: false,
  };
}

export const labCatalog: LabDefinition[] = [
  fairWeatherLab,
  plannedLab({
    id: "cloud-optics-beauty",
    name: "Cloud Optics / Beauty",
    question: "Why do clouds look bright, dark, soft, sharp, glowing, or dramatic?",
    description:
      "Future lab for bulk cloud appearance, sun/view controls, optical-depth labels, and later droplet-aware rendering.",
    status: "planned",
    statusLabel: "Planned",
    concepts: ["sun angle", "cloud thickness", "optical depth", "edge brightening"],
    limitations: ["Not implemented in Workbench V2 yet"],
  }),
  plannedLab({
    id: "evolving-boundary-layer",
    name: "Evolving Boundary Layer",
    question: "How does the daytime atmosphere evolve into a cloud-producing environment?",
    description:
      "Future lab for mixed-layer growth, moisture redistribution, changing cloud base, and entrainment effects.",
    status: "planned",
    statusLabel: "Planned",
    concepts: ["mixed-layer depth", "surface fluxes", "entrainment", "cloud onset"],
    limitations: ["Dedicated lab spec and model work are planned later"],
  }),
  plannedLab({
    id: "layered-atmosphere",
    name: "Layered Atmosphere",
    question: "Why do clouds form in separate layers at different altitudes?",
    description:
      "Future lab for moist layers, dry gaps, inversions, broad ascent, and cloud-layer diagnostics.",
    status: "planned",
    statusLabel: "Planned",
    concepts: ["moist layers", "dry layers", "inversions", "cloud layer detection"],
    limitations: ["Not implemented in Workbench V2 yet"],
  }),
  plannedLab({
    id: "orographic-terrain-clouds",
    name: "Orographic / Terrain Clouds",
    question: "How does terrain lift create clouds?",
    description:
      "Future lab for idealized ridges, upstream moisture, terrain-induced lift, and terrain-relative diagnostics.",
    status: "planned",
    statusLabel: "Planned",
    concepts: ["terrain lift", "upstream LCL", "wind speed", "ridge clouds"],
    limitations: ["No terrain physics or terrain visualization in this issue"],
  }),
  plannedLab({
    id: "warm-rain-droplet-growth",
    name: "Warm Rain / Droplet Growth",
    question: "Why does some cloud water become rain, while some clouds never rain?",
    description:
      "Future lab for bulk rain indicators, droplet-size distributions, collision/coalescence, and water-budget diagnostics.",
    status: "planned",
    statusLabel: "Planned",
    concepts: ["cloud water", "rain water", "droplet growth", "water budget"],
    limitations: ["No new rain or PySDM work is included here"],
  }),
  plannedLab({
    id: "fog-stratus",
    name: "Fog / Stratus",
    question: "Why does fog or low stratus form near the surface, and why does it dissipate?",
    description:
      "Future lab for near-surface saturation, cooling/warming, shallow low cloud, and dissipation diagnostics.",
    status: "planned",
    statusLabel: "Planned",
    concepts: ["surface cooling", "near-surface RH", "fog depth", "dissipation time"],
    limitations: ["Not implemented in Workbench V2 yet"],
  }),
  plannedLab({
    id: "mixed-phase-ice",
    name: "Mixed-Phase / Ice",
    question: "How do cold clouds differ from warm clouds?",
    description:
      "Later lab for freezing level, supercooled liquid, ice mass, and cold-cloud precipitation paths.",
    status: "later",
    statusLabel: "Later",
    concepts: ["freezing level", "supercooled liquid", "ice mass", "cold clouds"],
    limitations: ["Later-stage lab after warm-cloud foundations mature"],
  }),
];

export function labById(labId: string): LabDefinition | undefined {
  return labCatalog.find((lab) => lab.id === labId);
}

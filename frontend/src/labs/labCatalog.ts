import type {
  LabControlDefinition,
  LabDefinition,
  LabDiagnosticDefinition,
  LabScenarioDefinition,
  LabVisualizationModeDefinition,
} from "./labTypes";
import { boundaryLayer1DScenarioPresets } from "./evolvingBoundaryLayer";

// Legacy internal id retained to avoid route/config churn. The user-facing lab name is
// "Lower Atmosphere Cloud Basics"; fair-weather cumulus is a scenario family inside it.
export const FAIR_WEATHER_CUMULUS_LAB_ID = "fair-weather-cumulus";
export const CLOUD_OPTICS_BEAUTY_LAB_ID = "cloud-optics-beauty";
export const EVOLVING_BOUNDARY_LAYER_LAB_ID = "evolving-boundary-layer";

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
    id: "top-sponge-cloud-fraction",
    label: "Top sponge cloud fraction",
    purpose: "Flags cloud water reaching the lid/sponge region.",
    kind: "warning",
  },
  {
    id: "lateral-boundary-cloud-fraction",
    label: "Lateral-boundary cloud fraction",
    purpose: "Flags cloud water touching side boundaries.",
    kind: "warning",
  },
  {
    id: "boundary-connected-cloud-regions",
    label: "Boundary-connected cloud regions",
    purpose: "Flags cloud regions connected to model boundaries.",
    kind: "warning",
  },
  {
    id: "low-level-return-flow-cloud-water",
    label: "Low-level return-flow cloud water",
    purpose: "Flags cloud in implausible circulation regions.",
    kind: "warning",
  },
  {
    id: "cloud-artifact-policy-status",
    label: "Cloud artifact policy status",
    purpose: "Summarizes below-LCL, return-flow, top-sponge, and boundary warnings.",
    kind: "scenario-contract",
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
    name: "Fair-weather cumulus / baseline shallow cloud",
    intendedPhenomenon: "Single-patch baseline shallow fair-weather cumulus case.",
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
    limitations: [
      "Uses the Yellow-status Boussinesq prototype; qualitative exploration only.",
      "Simplified entrainment, turbulence, stabilizers, and safety caps shape some behavior.",
    ],
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
    limitations: [
      "Uses the Yellow-status Boussinesq prototype; dry suppression is qualitative.",
      "Entrainment and turbulence are simplified.",
    ],
  },
  {
    id: "dry-cap-suppressed-cumulus",
    labId: FAIR_WEATHER_CUMULUS_LAB_ID,
    name: "Capped / suppressed cloud",
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
    limitations: [
      "Uses the Yellow-status Boussinesq prototype; dry-cap structure is idealized and grid-smoothed.",
    ],
  },
  {
    id: "multi-thermal-cumulus-field",
    labId: FAIR_WEATHER_CUMULUS_LAB_ID,
    name: "Multi-thermal cloud field",
    intendedPhenomenon: "Multiple thermal responses from structured surface heating.",
    expectedBehavior: "Multiple plume or cloud regions may appear before merger or diffusion.",
    keyControls: ["surface-heating-pattern", "surface-heating-strength", "source-layer-humidity"],
    diagnosticExpectations: [
      "Heating pattern produces more than one buoyant response.",
      "Cloud regions may remain distinct for a useful part of the run.",
      "The scenario remains a controlled shallow-cumulus experiment, not the whole product vision.",
    ],
    limitations: [
      "Uses the Yellow-status Boussinesq prototype; cell merger depends on grid resolution, wind, diffusion, and seed.",
    ],
  },
];

const fairWeatherLab: LabDefinition = {
  id: FAIR_WEATHER_CUMULUS_LAB_ID,
  name: "Lower Atmosphere Cloud Basics",
  question: "How do heating, moisture, and stability shape basic warm-cloud formation near the ground?",
  description:
    "Explore how heating, moisture, and stability shape basic warm-cloud formation near the ground.",
  status: "prototype",
  statusLabel: "Experimental 2-D prototype",
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
    "Yellow prototype visual dynamics scaffold",
    "Simplified warm-cloud condensation",
    "Some behavior is shaped by prototype stabilizers and safety caps",
    "No droplet-size distribution or resolved rain in this lab version",
    "Designed for learning and exploration, not weather prediction",
  ],
  scenarios: fairWeatherScenarios,
  controls: fairWeatherControls,
  diagnostics: fairWeatherDiagnostics,
  visualizationModes: fairWeatherVisualizationModes,
  capabilities: {
    supportsRun: true,
    supportsTimeline: true,
    supportsReplay: true,
    supportsStaticControls: false,
  },
  isSelectable: true,
};

const cloudOpticsControls: LabControlDefinition[] = [
  {
    id: "cloud-scene",
    label: "Cloud scene",
    tier: "primary",
    meaning: "Selects the generated cloud field.",
    expectedEffect: "Changes the optical behavior and teaching purpose of the scene.",
    unitsOrType: "preset",
    configPaths: ["renderer.scene_preset_id"],
  },
  {
    id: "sun-elevation",
    label: "Sun elevation",
    tier: "primary",
    meaning: "Height of the sun above the horizon.",
    expectedEffect:
      "Higher sun brightens tops and flattens shadows; lower sun increases path length and contrast.",
    unitsOrType: "degrees or low / medium / high",
    configPaths: ["renderer.sun_elevation_degrees"],
  },
  {
    id: "sun-direction-azimuth",
    label: "Sun direction / azimuth",
    tier: "primary",
    meaning: "Horizontal direction of incoming sunlight.",
    expectedEffect: "Moves lit sides, shaded sides, and bright-edge behavior.",
    unitsOrType: "degrees or compass preset",
    configPaths: ["renderer.sun_azimuth_degrees"],
  },
  {
    id: "view-angle",
    label: "View angle",
    tier: "primary",
    meaning: "Observer or camera angle relative to cloud and sun.",
    expectedEffect: "Changes front-lit, side-lit, backlit, and apparent-depth behavior.",
    unitsOrType: "degrees or preset",
    configPaths: ["renderer.view_angle_degrees"],
  },
  {
    id: "cloud-water-density",
    label: "Cloud water density",
    tier: "primary",
    meaning: "Bulk cloud water amount in the preset field.",
    expectedEffect:
      "Higher density increases optical response, bright lit regions, and darker interiors or bases.",
    unitsOrType: "normalized multiplier",
    configPaths: ["renderer.cloud_water_density_multiplier"],
  },
  {
    id: "cloud-thickness-depth",
    label: "Cloud thickness / depth",
    tier: "primary",
    meaning: "Effective 2.5-D depth of the cloud volume.",
    expectedEffect: "Greater depth increases attenuation, interior shadowing, and dark-base behavior.",
    unitsOrType: "normalized multiplier",
    configPaths: ["renderer.cloud_depth_multiplier"],
  },
  {
    id: "optical-depth-scattering",
    label: "Optical depth / scattering strength",
    tier: "primary",
    meaning: "Simplified control for how strongly the cloud interacts with light.",
    expectedEffect:
      "Low values look faint or translucent; high values increase contrast, bright edges, and shaded interiors.",
    unitsOrType: "normalized multiplier",
    configPaths: ["renderer.optical_depth_multiplier"],
  },
  {
    id: "time-of-day-light-color",
    label: "Time of day / light color",
    tier: "primary",
    meaning: "Simple lighting preset for color temperature and mood.",
    expectedEffect: "Midday is cooler and flatter; golden hour is warmer and more directional.",
    unitsOrType: "preset",
    configPaths: ["renderer.light_color_preset"],
  },
  {
    id: "edge-softness",
    label: "Edge softness",
    tier: "secondary",
    meaning: "Density falloff at cloud boundaries.",
    expectedEffect: "Softer edges produce gradual fade; sharper edges look more abrupt.",
    unitsOrType: "normalized",
    configPaths: ["renderer.edge_softness"],
  },
  {
    id: "background-sky-brightness",
    label: "Background sky brightness",
    tier: "secondary",
    meaning: "Contrast between cloud and sky.",
    expectedEffect: "Changes perceived contrast and edge visibility.",
    unitsOrType: "normalized or preset",
    configPaths: ["renderer.sky_brightness"],
  },
  {
    id: "haze-background-scattering",
    label: "Haze / background scattering",
    tier: "secondary",
    meaning: "Simple non-cloud atmospheric background effect.",
    expectedEffect: "Adds a depth cue and can soften contrast.",
    unitsOrType: "normalized",
    configPaths: ["renderer.haze"],
  },
  {
    id: "exposure-tone-mapping",
    label: "Exposure / tone mapping",
    tier: "secondary",
    meaning: "Display brightness mapping.",
    expectedEffect: "Prevents bright tops from clipping or shaded bases from disappearing.",
    unitsOrType: "preset or normalized",
    configPaths: ["renderer.exposure_preset"],
  },
  {
    id: "scene-seed",
    label: "Scene seed",
    tier: "secondary",
    meaning: "Reproducibility for generated scenes.",
    expectedEffect: "Repeats the same generated cloud field.",
    unitsOrType: "integer",
    configPaths: ["scene.seed"],
  },
];

const cloudOpticsDiagnostics: LabDiagnosticDefinition[] = [
  {
    id: "optical-depth-estimate",
    label: "Optical-depth estimate",
    purpose: "Shows whether the current path is optically thin, moderate, thick, or very thick.",
    kind: "display",
  },
  {
    id: "cloud-water-density-summary",
    label: "Cloud water / density summary",
    purpose: "Explains how much cloud material exists.",
    kind: "display",
  },
  {
    id: "light-geometry-state",
    label: "Light geometry state",
    purpose: "Labels front-lit, side-lit, backlit, high-sun, or low-sun setup.",
    kind: "display",
  },
  {
    id: "light-path-length-proxy",
    label: "Light-path length proxy",
    purpose: "Explains short, moderate, or long paths through cloud.",
    kind: "display",
  },
  {
    id: "bright-edge-likelihood",
    label: "Bright-edge likelihood",
    purpose: "Indicates weak, moderate, or strong silver-lining-like behavior.",
    kind: "display",
  },
  {
    id: "approximation-labels-present",
    label: "Approximation labels present",
    purpose: "Confirms bulk optical and 2.5-D approximations are disclosed.",
    kind: "hard-check",
  },
];

const cloudOpticsVisualizationModes: LabVisualizationModeDefinition[] = [
  {
    id: "rendered-cloud-appearance-view",
    name: "Rendered cloud appearance view",
    description:
      "Shows a lightweight 2.5-D volumetric cloud interpretation with directional light and attenuation.",
    consumesFields: ["cloud_density"],
    truthLabel: "visual-approximation",
  },
  {
    id: "cloud-water-field-view",
    name: "Cloud water field view",
    description: "Shows the source density structure separately from lighting effects.",
    consumesFields: ["cloud_density"],
    truthLabel: "visual-approximation",
  },
  {
    id: "optical-depth-view",
    name: "Optical depth view",
    description: "Shows thin, moderate, thick, and very thick regions derived from the source scene.",
    consumesFields: ["cloud_density", "optical_depth"],
    truthLabel: "visual-approximation",
  },
  {
    id: "light-path-shadow-view",
    name: "Light path / shadow view",
    description: "Shows simplified directional light behavior through the cloud field.",
    consumesFields: ["cloud_density", "light_path_proxy"],
    truthLabel: "visual-approximation",
  },
];

const cloudOpticsScenarios: LabScenarioDefinition[] = [
  {
    id: "small-puffy-cumulus",
    labId: CLOUD_OPTICS_BEAUTY_LAB_ID,
    name: "Small Puffy Cumulus",
    intendedPhenomenon: "Baseline scene for soft edges, bright tops, and shaded interiors.",
    expectedBehavior:
      "Rounded cloud with gradual edges; high sun brightens top; lower or side sun creates stronger contrast.",
    keyControls: ["sun-elevation", "sun-direction-azimuth", "cloud-water-density", "optical-depth-scattering"],
    diagnosticExpectations: ["Optical-depth estimate and light-geometry labels explain the rendered result."],
    limitations: ["Renderer is deferred; generated source fields are deterministic presets."],
  },
  {
    id: "thick-cumulus-dark-base",
    labId: CLOUD_OPTICS_BEAUTY_LAB_ID,
    name: "Thick Cumulus With Dark Base",
    intendedPhenomenon: "Optical thickness and dark cloud bases.",
    expectedBehavior:
      "Increasing density, thickness, and optical depth darkens base and interior while lit regions stay bright.",
    keyControls: ["cloud-thickness-depth", "cloud-water-density", "optical-depth-scattering"],
    diagnosticExpectations: ["Base/interior darkness and optical-depth estimates explain the dark base."],
    limitations: ["No full radiative transfer or calibrated radiance output."],
  },
  {
    id: "broken-cloud-field",
    labId: CLOUD_OPTICS_BEAUTY_LAB_ID,
    name: "Broken Cloud Field",
    intendedPhenomenon: "Layered depth, overlap, and view-angle behavior.",
    expectedBehavior:
      "Multiple cloud elements create depth; oblique views reveal stronger layered structure.",
    keyControls: ["view-angle", "sun-direction-azimuth", "optical-depth-scattering", "haze-background-scattering"],
    diagnosticExpectations: ["Layered depth explanation responds to view angle and overlap."],
    limitations: ["Preset 2.5-D scene only; no true out-of-plane atmospheric motion."],
  },
  {
    id: "towering-developing-cumulus",
    labId: CLOUD_OPTICS_BEAUTY_LAB_ID,
    name: "Towering / Developing Cumulus",
    intendedPhenomenon: "Vertical structure, glowing tops, and shaded interiors.",
    expectedBehavior:
      "Taller volume shows bright top or sun-facing side with shaded interior; low sun increases drama.",
    keyControls: ["sun-elevation", "cloud-thickness-depth", "optical-depth-scattering"],
    diagnosticExpectations: ["Light geometry and path-length proxy explain top/interior contrast."],
    limitations: ["Preset cloud shape; this lab does not simulate cloud formation."],
  },
  {
    id: "thin-veil-low-optical-depth",
    labId: CLOUD_OPTICS_BEAUTY_LAB_ID,
    name: "Thin Veil / Low Optical Depth Cloud",
    intendedPhenomenon: "Translucent clouds and faint optical response.",
    expectedBehavior: "Cloud remains soft and semi-transparent unless optical depth is raised.",
    keyControls: ["optical-depth-scattering", "background-sky-brightness", "cloud-water-density", "cloud-thickness-depth"],
    diagnosticExpectations: ["Thin optical-depth state explains weak dark-base behavior."],
    limitations: ["Qualitative bulk optical approximation; not a calibrated radiance product."],
  },
];

const cloudOpticsLab: LabDefinition = {
  id: CLOUD_OPTICS_BEAUTY_LAB_ID,
  name: "Clouds, Light, and Shadow",
  question:
    "Why do clouds look soft, dark, glowing, layered, silver-lined, or dramatic under different lighting and viewing conditions?",
  description:
    "Choose a preset cloud-optics scene, review the initial light and optical controls, and see where the upcoming renderer will explain appearance through density, optical depth, sun geometry, and view angle.",
  status: "concept",
  statusLabel: "Prototype optics renderer",
  supportedPhysicsCore: null,
  concepts: [
    "cloud water density",
    "optical depth",
    "attenuation through cloud volume",
    "approximate single scattering",
    "sun elevation and azimuth",
    "view angle / camera geometry",
    "soft cloud edges",
    "dark cloud bases",
    "bright-edge behavior",
  ],
  limitations: [
    "Lightweight renderer is qualitative and approximate",
    "Preset scene fields are deterministic generated source fields",
    "2.5-D visual scene, not true 3-D atmospheric dynamics",
    "Qualitative learning tool, not full radiative transfer",
    "No droplet-resolved Mie scattering or calibrated radiance output",
  ],
  scenarios: cloudOpticsScenarios,
  controls: cloudOpticsControls,
  diagnostics: cloudOpticsDiagnostics,
  visualizationModes: cloudOpticsVisualizationModes,
  capabilities: {
    supportsRun: false,
    supportsTimeline: false,
    supportsReplay: false,
    supportsStaticControls: true,
  },
  isSelectable: true,
};

const evolvingBoundaryLayerControls: LabControlDefinition[] = [
  {
    id: "hours-from-sunrise-duration",
    label: "Hours from sunrise / duration",
    tier: "primary",
    meaning: "Total profile-evolution time after sunrise.",
    expectedEffect: "Longer runs show more accumulated heating, moisture flux, and mixed-layer growth.",
    unitsOrType: "hours",
    configPaths: ["duration_seconds"],
  },
  {
    id: "surface-heating-strength",
    label: "Surface heating strength",
    tier: "primary",
    meaning: "Dimensionless sensible-heating forcing at the surface.",
    expectedEffect: "Stronger heating generally deepens the mixed layer faster.",
    unitsOrType: "0 to 1",
    configPaths: ["surface_heating_strength"],
  },
  {
    id: "surface-moisture-flux",
    label: "Surface moisture flux",
    tier: "primary",
    meaning: "Dimensionless moisture addition from the surface.",
    expectedEffect: "Higher moisture flux can lower LCL and improve cloud formation potential.",
    unitsOrType: "0 to 1",
    configPaths: ["surface_moisture_flux_strength"],
  },
  {
    id: "initial-mixed-layer-humidity",
    label: "Initial mixed-layer humidity",
    tier: "primary",
    meaning: "Initial mixed-layer relative humidity.",
    expectedEffect: "More humid profiles start with a lower LCL and less moisture limitation.",
    unitsOrType: "RH fraction",
    configPaths: ["initial_relative_humidity"],
  },
  {
    id: "initial-stability-lapse-rate",
    label: "Initial stability / lapse rate",
    tier: "primary",
    meaning: "Initial environmental temperature decrease with height.",
    expectedEffect: "More stable profiles resist vertical growth.",
    unitsOrType: "K m-1",
    configPaths: ["initial_lapse_rate_k_per_m"],
  },
  {
    id: "inversion-height",
    label: "Inversion height",
    tier: "primary",
    meaning: "Height of the capping inversion.",
    expectedEffect: "Lower caps can stop the mixed layer before it reaches the LCL.",
    unitsOrType: "m",
    configPaths: ["inversion_height_m"],
  },
  {
    id: "inversion-strength",
    label: "Inversion strength",
    tier: "primary",
    meaning: "Resistance proxy for the capping inversion.",
    expectedEffect: "Stronger caps suppress mixed-layer growth and cloud potential.",
    unitsOrType: "K",
    configPaths: ["inversion_strength_k"],
  },
  {
    id: "dry-air-above-mixed-layer",
    label: "Dry air above mixed layer",
    tier: "primary",
    meaning: "Free-atmosphere relative humidity above the mixed layer.",
    expectedEffect: "Drier air aloft increases entrainment drying and can suppress potential.",
    unitsOrType: "RH fraction",
    configPaths: ["free_atmosphere_relative_humidity"],
  },
  {
    id: "entrainment-strength",
    label: "Entrainment strength",
    tier: "primary",
    meaning: "Dimensionless mixing between mixed-layer air and air above.",
    expectedEffect: "Stronger entrainment deepens the layer but can dry it if air aloft is dry.",
    unitsOrType: "0 to 1",
    configPaths: ["entrainment_strength"],
  },
  {
    id: "vertical-levels-profile-resolution",
    label: "Vertical levels / profile resolution",
    tier: "advanced",
    meaning: "Number of vertical levels in the 1-D profile.",
    expectedEffect: "Higher resolution samples the profile more finely and costs a little more runtime.",
    unitsOrType: "levels",
    configPaths: ["levels"],
  },
  {
    id: "timestep-output-cadence",
    label: "Timestep / output cadence",
    tier: "advanced",
    meaning: "Profile-model integration step and emitted-frame interval.",
    expectedEffect: "Controls numerical cadence and replay smoothness.",
    unitsOrType: "seconds",
    configPaths: ["time_step_seconds", "frame_interval_seconds"],
  },
  {
    id: "seed",
    label: "Seed",
    tier: "advanced",
    meaning: "Reserved deterministic seed for compatible profile configs.",
    expectedEffect: "Keeps profile configurations reproducible as future variants are added.",
    unitsOrType: "integer",
    configPaths: ["seed"],
  },
];

const evolvingBoundaryLayerDiagnostics: LabDiagnosticDefinition[] = [
  {
    id: "cloud-formation-potential-status",
    label: "Cloud formation potential status",
    purpose: "Classifies whether the evolving profile becomes cloud favorable.",
    kind: "scenario-contract",
  },
  {
    id: "deterministic-limiting-reason",
    label: "Deterministic limiting reason",
    purpose: "Explains the physical reason behind cloud-favorable or limited outcomes.",
    kind: "display",
  },
  {
    id: "mixed-layer-depth",
    label: "Mixed-layer depth",
    purpose: "Shows how surface heating and entrainment grow the mixed layer.",
    kind: "display",
  },
  {
    id: "lcl",
    label: "LCL",
    purpose: "Shows the derived lifting condensation level for mixed-layer air.",
    kind: "display",
  },
  {
    id: "mixed-layer-depth-minus-lcl",
    label: "Mixed-layer depth minus LCL",
    purpose: "Indicates whether the mixed layer has reached the diagnosed cloud-base threshold.",
    kind: "display",
  },
  {
    id: "rh-near-mixed-layer-top",
    label: "RH near mixed-layer top",
    purpose: "Shows whether the mixed-layer top is nearing saturation.",
    kind: "display",
  },
  {
    id: "inversion-cap-state",
    label: "Inversion / cap state",
    purpose: "Explains whether the capping inversion is suppressing profile growth.",
    kind: "display",
  },
  {
    id: "entrainment-drying-proxy",
    label: "Entrainment drying proxy",
    purpose: "Shows how dry-air mixing aloft limits potential.",
    kind: "display",
  },
  {
    id: "surface-heating-accumulation",
    label: "Surface heating accumulation",
    purpose: "Shows accumulated sensible heating in the simplified profile model.",
    kind: "display",
  },
  {
    id: "surface-moisture-addition",
    label: "Surface moisture addition",
    purpose: "Shows accumulated surface moisture addition in the simplified profile model.",
    kind: "display",
  },
];

const evolvingBoundaryLayerVisualizationModes: LabVisualizationModeDefinition[] = [
  {
    id: "profile-sounding-hero-view",
    name: "Profile / sounding hero view",
    description:
      "Shows vertical temperature and RH profiles with mixed-layer depth, LCL, and inversion/cap markers.",
    consumesFields: [
      "temperature_k",
      "relative_humidity_percent",
      "mixed_layer_depth_m",
      "lcl_m",
      "inversion_height_m",
    ],
    truthLabel: "reduced-model-output",
  },
  {
    id: "profile-timeline-replay",
    name: "Profile timeline / replay",
    description: "Scrubs through emitted profile frames from the 1-D model.",
    consumesFields: ["profile-frame-v1"],
    truthLabel: "reduced-model-output",
  },
  {
    id: "profile-inspector-diagnostics",
    name: "Profile inspector",
    description:
      "Explains cloud formation potential, limiting reason, LCL, mixed-layer depth, cap state, and entrainment drying.",
    consumesFields: ["profile diagnostics"],
    truthLabel: "derived-diagnostic",
  },
];

const evolvingBoundaryLayerScenarios: LabScenarioDefinition[] =
  boundaryLayer1DScenarioPresets.map((scenario) => ({
    id: scenario.slug,
    labId: EVOLVING_BOUNDARY_LAYER_LAB_ID,
    name: scenario.name,
    intendedPhenomenon: scenario.purpose,
    expectedBehavior:
      scenario.expected_status === "cloud_favorable"
        ? "Profile evolution should become cloud favorable under the prescribed 1-D forcing."
        : "Profile evolution should reveal the limiting process without producing cloud water.",
    keyControls: [
      "surface-heating-strength",
      "surface-moisture-flux",
      "initial-mixed-layer-humidity",
      "inversion-height",
      "inversion-strength",
      "entrainment-strength",
    ],
    diagnosticExpectations: [
      "Cloud formation potential status is deterministic.",
      "Inspector reports the limiting reason.",
      "No cloud liquid water field is emitted in v1.",
    ],
    limitations: [
      "Simplified 1-D profile evolution.",
      "V1 diagnoses cloud formation potential. It does not produce cloud water.",
      "Not cloud-resolving and not live-coupled to Boussinesq.",
    ],
  }));

const evolvingBoundaryLayerLab: LabDefinition = {
  id: EVOLVING_BOUNDARY_LAYER_LAB_ID,
  name: "Evolving Boundary Layer",
  question: "How does the daytime lower atmosphere become favorable, or fail to become favorable, for cloud formation?",
  description:
    "Run a standalone 1-D profile evolution model to inspect mixed-layer growth, LCL, RH, cap suppression, entrainment drying, and cloud formation potential.",
  status: "prototype",
  statusLabel: "Simplified 1-D profile evolution",
  supportedPhysicsCore: "boundary_layer_1d",
  concepts: [
    "mixed-layer depth",
    "surface sensible heating",
    "surface moisture flux",
    "entrainment drying",
    "LCL",
    "cap / inversion suppression",
    "cloud formation potential",
  ],
  limitations: [
    "V1 diagnoses cloud formation potential. It does not produce cloud water.",
    "Simplified 1-D profile model",
    "Not cloud-resolving",
    "No 2-D or 3-D cloud dynamics",
    "No live Boussinesq coupling",
    "Designed for learning and exploration, not weather prediction",
  ],
  scenarios: evolvingBoundaryLayerScenarios,
  controls: evolvingBoundaryLayerControls,
  diagnostics: evolvingBoundaryLayerDiagnostics,
  visualizationModes: evolvingBoundaryLayerVisualizationModes,
  capabilities: {
    supportsRun: true,
    supportsTimeline: true,
    supportsReplay: true,
    supportsStaticControls: false,
  },
  isSelectable: true,
};

function plannedLab(lab: Omit<LabDefinition, "supportedPhysicsCore" | "scenarios" | "controls" | "diagnostics" | "visualizationModes" | "capabilities" | "isSelectable">): LabDefinition {
  return {
    ...lab,
    supportedPhysicsCore: null,
    scenarios: [],
    controls: [],
    diagnostics: [],
    visualizationModes: [],
    capabilities: {
      supportsRun: false,
      supportsTimeline: false,
      supportsReplay: false,
      supportsStaticControls: false,
    },
    isSelectable: false,
  };
}

export const labCatalog: LabDefinition[] = [
  fairWeatherLab,
  cloudOpticsLab,
  evolvingBoundaryLayerLab,
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

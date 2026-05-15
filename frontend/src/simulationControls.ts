import type { SimulationConfig } from "./simulationTypes";

export const KELVIN_OFFSET = 273.15;

export const CONTROL_LIMITS = {
  surfaceTemperatureC: { min: 0, max: 40, step: 0.5 },
  surfaceHeatingRate: { min: 0, max: 0.025, step: 0.001 },
  heatingWidth: { min: 500, max: 8_000, step: 100 },
  heatingCenter: { min: 0, max: 10_000, step: 100 },
  lapseRate: { min: 0.003, max: 0.01, step: 0.0001 },
  boundaryLayerDepth: { min: 250, max: 3_000, step: 50 },
  moistSourceLayerDepth: { min: 100, max: 2_000, step: 50 },
  relativeHumidity: { min: 0.3, max: 1, step: 0.01 },
  domainWidth: { min: 4_000, max: 20_000, step: 500 },
  domainHeight: { min: 1_500, max: 6_000, step: 250 },
  gridColumns: { min: 18, max: 72, step: 6 },
  gridRows: { min: 12, max: 48, step: 4 },
  duration: { min: 60, max: 3_600, step: 60 },
  timeStep: { min: 1, max: 6, step: 0.5 },
  frameInterval: { min: 2, max: 30, step: 1 },
  wind: { min: -5, max: 5, step: 0.25 },
  seed: { min: 1, max: 9999, step: 1 },
};

export type BuiltInScenario = {
  slug: string;
  name: string;
  description: string;
  intendedPhenomenon: string;
  solverMode: SimulationConfig["solver_type"];
  thermodynamicAssumptions: string;
  forcingSetup: string;
  expectedOutcome: string;
  diagnosticExpectations: string[];
  knownLimitations: string[];
  category: "exploratory" | "diagnostic" | "visualization";
  apply: (config: SimulationConfig) => SimulationConfig;
};

export type BoussinesqModelSize = {
  slug: string;
  name: string;
  description: string;
  apply: (config: SimulationConfig) => SimulationConfig;
};

export type ControlKey =
  | "scenario"
  | "model_size"
  | "surface_temperature"
  | "lapse_rate"
  | "boundary_layer_depth"
  | "source_layer_relative_humidity"
  | "humidity_profile"
  | "moist_source_layer_depth"
  | "free_atmosphere_relative_humidity"
  | "heating_pattern"
  | "surface_heating_rate"
  | "heating_patch_width"
  | "heating_patch_center"
  | "runtime"
  | "domain_width"
  | "domain_height"
  | "grid_columns"
  | "grid_rows"
  | "time_step"
  | "frame_cadence"
  | "background_wind"
  | "prescribed_lift"
  | "seed"
  | "saved_scenarios";

export type ControlImportance = "basic" | "advanced" | "developer";
export type ControlState = "active" | "advanced" | "disabled" | "hidden" | "legacy";

export type ControlMetadata = {
  key: ControlKey;
  label: string;
  shortHelp: string;
  units?: string;
  category: string;
  importance: ControlImportance;
  appliesToSolvers: SimulationConfig["solver_type"][];
  unavailableBehavior: "hide" | "disable";
  unavailableReason: string;
  truthCategory?: "solver_output" | "derived_diagnostic" | "prescribed_forcing" | "experimental";
};

export type ControlPresentation = ControlMetadata & {
  state: ControlState;
  disabledReason: string | null;
};

export const CONTROL_METADATA: Record<ControlKey, ControlMetadata> = {
  scenario: {
    key: "scenario",
    label: "Scenario",
    shortHelp: "Loads a documented experiment setup. Scenario choice drives the solver mode.",
    category: "Setup",
    importance: "basic",
    appliesToSolvers: ["boussinesq_2d", "microphysics_lab"],
    unavailableBehavior: "disable",
    unavailableReason: "Scenario selection is always available for public solvers.",
  },
  model_size: {
    key: "model_size",
    label: "Model size",
    shortHelp: "Safe presets for Boussinesq domain, grid, runtime, and output cadence.",
    category: "Setup",
    importance: "basic",
    appliesToSolvers: ["boussinesq_2d"],
    unavailableBehavior: "disable",
    unavailableReason: "Microphysics lab scenarios use fixed parcel/box resolution presets.",
  },
  surface_temperature: {
    key: "surface_temperature",
    label: "Surface temperature",
    shortHelp: "Initial near-surface air temperature used by thermodynamics and saturation estimates.",
    units: "deg C",
    category: "Thermodynamics",
    importance: "basic",
    appliesToSolvers: ["boussinesq_2d", "microphysics_lab"],
    unavailableBehavior: "hide",
    unavailableReason: "Temperature is not used by this solver.",
  },
  lapse_rate: {
    key: "lapse_rate",
    label: "Lapse rate",
    shortHelp: "Environmental cooling rate with height. Larger values are less stable and support deeper vertical growth.",
    units: "K/m",
    category: "Thermodynamics",
    importance: "basic",
    appliesToSolvers: ["boussinesq_2d"],
    unavailableBehavior: "hide",
    unavailableReason: "Parcel microphysics uses prescribed lift rather than a resolved environmental stability profile.",
  },
  boundary_layer_depth: {
    key: "boundary_layer_depth",
    label: "BL / inversion top",
    shortHelp: "Approximate top of the mixed layer or inversion. This is a scenario structure marker, not a hard cloud-base rule.",
    units: "m",
    category: "Thermodynamics",
    importance: "basic",
    appliesToSolvers: ["boussinesq_2d"],
    unavailableBehavior: "hide",
    unavailableReason: "Microphysics lab is a parcel/box mode without resolved boundary-layer depth.",
  },
  source_layer_relative_humidity: {
    key: "source_layer_relative_humidity",
    label: "Source-layer RH",
    shortHelp: "Near-surface/source-layer humidity. Higher values lower the expected cloud base. Near-saturated values can create low cloud or fog-like behavior.",
    units: "fraction",
    category: "Moisture",
    importance: "basic",
    appliesToSolvers: ["boussinesq_2d", "microphysics_lab"],
    unavailableBehavior: "hide",
    unavailableReason: "Humidity is not used by this solver.",
  },
  humidity_profile: {
    key: "humidity_profile",
    label: "Humidity pattern",
    shortHelp: "Vertical moisture structure used to initialize the Boussinesq atmosphere.",
    category: "Moisture",
    importance: "advanced",
    appliesToSolvers: ["boussinesq_2d"],
    unavailableBehavior: "hide",
    unavailableReason: "Microphysics lab uses a single parcel/box humidity value.",
  },
  moist_source_layer_depth: {
    key: "moist_source_layer_depth",
    label: "Moist source depth",
    shortHelp: "Depth of the near-surface moist air feeding thermals. Deeper source layers can support longer-lived cloud growth.",
    units: "m",
    category: "Moisture",
    importance: "basic",
    appliesToSolvers: ["boussinesq_2d"],
    unavailableBehavior: "hide",
    unavailableReason: "Microphysics lab has no resolved source layer.",
  },
  free_atmosphere_relative_humidity: {
    key: "free_atmosphere_relative_humidity",
    label: "Free-air RH",
    shortHelp: "Humidity above the moist source layer. Lower values can limit cloud growth and promote evaporation-like drying.",
    units: "fraction",
    category: "Moisture",
    importance: "basic",
    appliesToSolvers: ["boussinesq_2d"],
    unavailableBehavior: "hide",
    unavailableReason: "Microphysics lab has no resolved free-atmosphere layer.",
  },
  heating_pattern: {
    key: "heating_pattern",
    label: "Heating pattern",
    shortHelp: "Spatial pattern of lower-boundary warming that organizes Boussinesq thermals.",
    category: "Surface forcing",
    importance: "basic",
    appliesToSolvers: ["boussinesq_2d"],
    unavailableBehavior: "hide",
    unavailableReason: "Parcel microphysics does not use horizontal surface heating patterns.",
  },
  surface_heating_rate: {
    key: "surface_heating_rate",
    label: "Heating rate",
    shortHelp: "Strength of lower-boundary warming. Stronger heating produces stronger thermals, but cloud formation still depends on moisture and stability.",
    units: "K/s",
    category: "Surface forcing",
    importance: "basic",
    appliesToSolvers: ["boussinesq_2d"],
    unavailableBehavior: "hide",
    unavailableReason: "Microphysics lab uses prescribed parcel forcing instead of surface heating.",
  },
  heating_patch_width: {
    key: "heating_patch_width",
    label: "Patch width",
    shortHelp: "Horizontal width of the heated patch or paired thermal sources.",
    units: "m",
    category: "Surface forcing",
    importance: "basic",
    appliesToSolvers: ["boussinesq_2d"],
    unavailableBehavior: "hide",
    unavailableReason: "The selected heating pattern does not use patch width.",
  },
  heating_patch_center: {
    key: "heating_patch_center",
    label: "Patch center",
    shortHelp: "Horizontal center of a single or custom heating patch.",
    units: "m",
    category: "Surface forcing",
    importance: "advanced",
    appliesToSolvers: ["boussinesq_2d"],
    unavailableBehavior: "hide",
    unavailableReason: "The selected heating pattern places its own heating centers.",
  },
  runtime: {
    key: "runtime",
    label: "Runtime",
    shortHelp: "Simulated duration. Longer runs can reveal delayed cloud onset and later evolution.",
    units: "s",
    category: "Time and output",
    importance: "basic",
    appliesToSolvers: ["boussinesq_2d", "microphysics_lab"],
    unavailableBehavior: "disable",
    unavailableReason: "Runtime is always relevant to public solvers.",
  },
  domain_width: {
    key: "domain_width",
    label: "Domain width",
    shortHelp: "Horizontal domain size. Usually prefer model-size presets unless testing resolution/domain effects.",
    units: "m",
    category: "Domain and grid",
    importance: "advanced",
    appliesToSolvers: ["boussinesq_2d"],
    unavailableBehavior: "hide",
    unavailableReason: "Microphysics lab broadcasts a parcel/box state over a fixed compatibility grid.",
  },
  domain_height: {
    key: "domain_height",
    label: "Domain height",
    shortHelp: "Vertical domain size. Usually prefer model-size presets unless testing cloud-top or boundary effects.",
    units: "m",
    category: "Domain and grid",
    importance: "advanced",
    appliesToSolvers: ["boussinesq_2d"],
    unavailableBehavior: "hide",
    unavailableReason: "Microphysics lab broadcasts a parcel/box state over a fixed compatibility grid.",
  },
  grid_columns: {
    key: "grid_columns",
    label: "Grid columns",
    shortHelp: "Horizontal resolution. Larger values are slower and should be used for targeted inspection.",
    units: "cells",
    category: "Domain and grid",
    importance: "developer",
    appliesToSolvers: ["boussinesq_2d"],
    unavailableBehavior: "hide",
    unavailableReason: "Microphysics lab does not use resolved horizontal grid dynamics.",
  },
  grid_rows: {
    key: "grid_rows",
    label: "Grid rows",
    shortHelp: "Vertical resolution. Larger values are slower and should be used for targeted inspection.",
    units: "cells",
    category: "Domain and grid",
    importance: "developer",
    appliesToSolvers: ["boussinesq_2d"],
    unavailableBehavior: "hide",
    unavailableReason: "Microphysics lab does not use resolved vertical grid dynamics.",
  },
  time_step: {
    key: "time_step",
    label: "Timestep",
    shortHelp: "Numerical integration step. Smaller values can improve stability at higher cost.",
    units: "s",
    category: "Time and output",
    importance: "developer",
    appliesToSolvers: ["boussinesq_2d", "microphysics_lab"],
    unavailableBehavior: "disable",
    unavailableReason: "Timestep is controlled by the selected scenario preset.",
  },
  frame_cadence: {
    key: "frame_cadence",
    label: "Frame cadence",
    shortHelp: "Simulated seconds between streamed frames. Short cadence increases browser frame count.",
    units: "s",
    category: "Time and output",
    importance: "advanced",
    appliesToSolvers: ["boussinesq_2d", "microphysics_lab"],
    unavailableBehavior: "disable",
    unavailableReason: "Frame cadence is controlled by the selected scenario preset.",
  },
  background_wind: {
    key: "background_wind",
    label: "Background wind",
    shortHelp: "Horizontal wind through the domain. Stronger wind can tilt or advect cloud features.",
    units: "m/s",
    category: "Wind and reproducibility",
    importance: "advanced",
    appliesToSolvers: ["boussinesq_2d"],
    unavailableBehavior: "hide",
    unavailableReason: "Microphysics lab has no resolved horizontal advection.",
    truthCategory: "prescribed_forcing",
  },
  prescribed_lift: {
    key: "prescribed_lift",
    label: "Prescribed lift",
    shortHelp: "For microphysics_lab, imposed parcel lift. In Boussinesq runs, thermals are generated by surface heating instead.",
    units: "m/s",
    category: "Wind and reproducibility",
    importance: "basic",
    appliesToSolvers: ["microphysics_lab"],
    unavailableBehavior: "disable",
    unavailableReason: "Boussinesq vertical motion is predicted from heating/dynamics; leave background vertical motion near zero.",
    truthCategory: "prescribed_forcing",
  },
  seed: {
    key: "seed",
    label: "Random seed",
    shortHelp: "Reproducibility seed for generated patterns and deterministic scenario variation.",
    units: "seed",
    category: "Wind and reproducibility",
    importance: "advanced",
    appliesToSolvers: ["boussinesq_2d", "microphysics_lab"],
    unavailableBehavior: "disable",
    unavailableReason: "Seed is only meaningful for deterministic generated patterns.",
  },
  saved_scenarios: {
    key: "saved_scenarios",
    label: "Saved experiments",
    shortHelp: "Save or reload local browser copies of experiment configs.",
    category: "Setup",
    importance: "advanced",
    appliesToSolvers: ["boussinesq_2d", "microphysics_lab"],
    unavailableBehavior: "disable",
    unavailableReason: "Saved experiments are available after a config is loaded.",
  },
};

const PUBLIC_CONTROL_KEYS = Object.keys(CONTROL_METADATA) as ControlKey[];

export const SURFACE_HEATING_PATTERNS = [
  {
    value: "single_patch",
    label: "Single hot patch",
    description: "Uses center, width, and heating-rate sliders.",
  },
  {
    value: "two_patches",
    label: "Two hot patches",
    description: "Uses the width slider for paired thermals.",
  },
  {
    value: "broad_plateau",
    label: "Broad heated plateau",
    description: "Wide, smoother heating across the center of the domain.",
  },
  {
    value: "weak_random",
    label: "Weak uneven heating",
    description: "Seeded low-amplitude bumps for less symmetrical initiation.",
  },
] as const;

export const HUMIDITY_PROFILES = [
  {
    value: "surface_moisture",
    label: "Surface-moist profile",
    description: "Moist source air near the ground with drier air aloft.",
  },
  {
    value: "uniform",
    label: "Uniform RH",
    description: "Uses the base relative-humidity slider everywhere.",
  },
  {
    value: "moist_boundary_layer",
    label: "Moist boundary layer",
    description: "Adds moisture below the boundary-layer top and dries the air above.",
  },
  {
    value: "dry_cap",
    label: "Dry cap",
    description: "Places a dry layer near the boundary-layer top.",
  },
  {
    value: "moist_layer",
    label: "Elevated moist layer",
    description: "Adds a moist layer around and above the boundary-layer top.",
  },
] as const;

type ConfigPathValue = string | number | null | Record<string, unknown> | Array<unknown>;

export const BUILT_IN_SCENARIOS: BuiltInScenario[] = [
  {
    slug: "fair-weather-moderate-base",
    name: "Fair-weather cumulus / baseline shallow cloud",
    description:
      "Single-patch surface heating in moderately humid air; cloud should start above the surface.",
    intendedPhenomenon:
      "Baseline shallow fair-weather cumulus from a single heated patch near the ground.",
    solverMode: "boussinesq_2d",
    thermodynamicAssumptions:
      "Surface-moist source layer, finite LCL hundreds of meters above ground, drier free air aloft.",
    forcingSetup: "Single warm patch centered in the domain.",
    expectedOutcome:
      "A thermal plume develops first; cloud water appears later near a finite cloud base instead of immediately at the ground.",
    diagnosticExpectations: [
      "Estimated LCL is finite and above the first model levels.",
      "Below-LCL cloud fraction remains small.",
      "Cloud top is less horizontally uniform than cloud base.",
    ],
    knownLimitations: [
      "This scenario uses Cloud Lab's Yellow-status Boussinesq prototype, not quantitative LES.",
      "Some behavior is shaped by prototype stabilizers and safety caps.",
      "Entrainment and turbulence are simplified.",
    ],
    category: "exploratory",
    apply: (config) =>
      normalizeConfig({
        ...config,
        solver_type: "boussinesq_2d",
        initial_atmosphere: {
          surface_temperature_k: celsiusToKelvin(25),
          lapse_rate_k_per_m: 0.0065,
          relative_humidity: 0.85,
          boundary_layer_depth_m: 1_500,
          moist_source_layer_depth_m: 800,
          free_atmosphere_relative_humidity: 0.55,
          humidity_profile: "surface_moisture",
        },
        surface_heating: {
          max_warming_rate_k_per_s: 0.024,
          patch_center_x_m: config.domain.width_m / 2,
          patch_width_m: 2_000,
          pattern: "single_patch",
        },
        background_wind: { u_m_per_s: 0.15, w_m_per_s: 0 },
        seed: 17,
      }),
  },
  {
    slug: "multi-thermal-cumulus-field",
    name: "Multi-thermal cloud field",
    description: "Two heated regions in a shared source layer for separated shallow cloud cells.",
    intendedPhenomenon: "Multiple thermals and cloud cells from structured surface heating.",
    solverMode: "boussinesq_2d",
    thermodynamicAssumptions:
      "Moderately humid source layer with drier free air; source-layer vapor is intended to feed multiple thermals.",
    forcingSetup: "Two hot patches of similar width and strength.",
    expectedOutcome:
      "Two thermal responses develop and should remain distinguishable for a useful part of the run.",
    diagnosticExpectations: [
      "No broad cloud sheet during early development.",
      "Cloud-region count is greater than one after delayed onset.",
      "Cloud bases are more clustered than cloud tops when the source layer is well mixed.",
    ],
    knownLimitations: [
      "This scenario uses Cloud Lab's Yellow-status Boussinesq prototype.",
      "Cell merger depends on grid resolution, wind, diffusion, and stabilizer settings.",
      "Not every random seed should be interpreted as a meteorological forecast.",
    ],
    category: "visualization",
    apply: (config) =>
      normalizeConfig({
        ...config,
        solver_type: "boussinesq_2d",
        initial_atmosphere: {
          surface_temperature_k: celsiusToKelvin(25),
          lapse_rate_k_per_m: 0.0065,
          relative_humidity: 0.85,
          boundary_layer_depth_m: 1_500,
          moist_source_layer_depth_m: 800,
          free_atmosphere_relative_humidity: 0.55,
          humidity_profile: "surface_moisture",
        },
        surface_heating: {
          max_warming_rate_k_per_s: 0.024,
          patch_center_x_m: config.domain.width_m / 2,
          patch_width_m: 2_000,
          pattern: "two_patches",
        },
        background_wind: { u_m_per_s: 0.15, w_m_per_s: 0 },
        seed: 17,
      }),
  },
  {
    slug: "dry-failed-cumulus",
    name: "Dry failed cumulus",
    description: "A weakly heated dry boundary layer that lifts but should not make appreciable cloud water.",
    intendedPhenomenon: "Buoyant motion without condensation.",
    solverMode: "boussinesq_2d",
    thermodynamicAssumptions: "Lower RH keeps the LCL above the modeled thermal reach.",
    forcingSetup: "Single heated patch, weaker than the cloud-forming fair-weather case.",
    expectedOutcome: "A thermal/updraft pattern appears while cloud liquid water stays zero or negligible.",
    diagnosticExpectations: [
      "Maximum vertical velocity is nonzero.",
      "Cloud liquid water remains negligible.",
      "Estimated LCL is higher than the cloud-forming layer.",
    ],
    knownLimitations: [
      "This scenario uses Cloud Lab's Yellow-status Boussinesq prototype.",
      "Dry suppression is qualitative; entrainment and turbulence are simplified.",
    ],
    category: "diagnostic",
    apply: (config) =>
      normalizeConfig({
        ...config,
        solver_type: "boussinesq_2d",
        initial_atmosphere: {
          surface_temperature_k: celsiusToKelvin(25),
          lapse_rate_k_per_m: 0.0075,
          relative_humidity: 0.35,
          boundary_layer_depth_m: 1_000,
          moist_source_layer_depth_m: 500,
          free_atmosphere_relative_humidity: 0.25,
          humidity_profile: "surface_moisture",
        },
        surface_heating: {
          max_warming_rate_k_per_s: 0.012,
          patch_center_x_m: config.domain.width_m / 2,
          patch_width_m: 2_000,
          pattern: "single_patch",
        },
        background_wind: { u_m_per_s: 0, w_m_per_s: 0 },
        seed: 13,
      }),
  },
  {
    slug: "humid-low-cloud-boundary-layer",
    name: "Humid low-cloud contrast",
    description:
      "Near-saturated air with a very low LCL; this contrast case is intentionally not classic fair-weather cumulus.",
    intendedPhenomenon: "Low-cloud or foggy boundary-layer behavior.",
    solverMode: "boussinesq_2d",
    thermodynamicAssumptions: "Very high RH places the expected LCL near the surface.",
    forcingSetup: "Weak uneven heating in an almost saturated mixed layer.",
    expectedOutcome:
      "Cloud may form very low and can look broad; that is the purpose of this non-classic scenario.",
    diagnosticExpectations: [
      "Estimated LCL is very low.",
      "Low cloud is expected rather than treated as a fair-weather failure.",
      "Cloud coverage may exceed isolated cumulus coverage.",
    ],
    knownLimitations: [
      "This scenario uses Cloud Lab's Yellow-status Boussinesq prototype.",
      "Fog/stratus microphysics is parameterized crudely.",
      "This scenario is a low-cloud contrast case, not the default fair-weather cumulus setup.",
    ],
    category: "diagnostic",
    apply: (config) =>
      normalizeConfig({
        ...config,
        solver_type: "boussinesq_2d",
        initial_atmosphere: {
          surface_temperature_k: celsiusToKelvin(25),
          lapse_rate_k_per_m: 0.0065,
          relative_humidity: 0.98,
          boundary_layer_depth_m: 1_000,
          moist_source_layer_depth_m: 1_000,
          free_atmosphere_relative_humidity: 0.98,
          humidity_profile: "uniform",
        },
        surface_heating: {
          max_warming_rate_k_per_s: 0.05,
          patch_center_x_m: config.domain.width_m / 2,
          patch_width_m: 2_000,
          pattern: "weak_random",
        },
        background_wind: { u_m_per_s: 0.25, w_m_per_s: 0 },
        seed: 23,
      }),
  },
  {
    slug: "dry-cap-suppressed-cumulus",
    name: "Capped / suppressed cloud",
    description: "Moisture below with a drier cap aloft to show why heating does not always make clouds.",
    intendedPhenomenon: "Environmental inhibition of cumulus growth.",
    solverMode: "boussinesq_2d",
    thermodynamicAssumptions: "Moist lower layer and dry cap near the boundary-layer top.",
    forcingSetup: "Moderate localized heating below the cap.",
    expectedOutcome: "Thermals lift, but cloud growth is limited, delayed, or suppressed.",
    diagnosticExpectations: [
      "Dry cap appears in the RH sounding.",
      "Cloud water is reduced relative to similar no-cap setups.",
      "Vertical development is capped or delayed.",
    ],
    knownLimitations: [
      "This scenario uses Cloud Lab's Yellow-status Boussinesq prototype.",
      "Dry-cap structure is idealized and grid-smoothed.",
    ],
    category: "exploratory",
    apply: (config) =>
      normalizeConfig({
        ...config,
        solver_type: "boussinesq_2d",
        initial_atmosphere: {
          surface_temperature_k: celsiusToKelvin(27),
          lapse_rate_k_per_m: 0.0045,
          relative_humidity: 0.82,
          boundary_layer_depth_m: 1_200,
          moist_source_layer_depth_m: 700,
          free_atmosphere_relative_humidity: 0.35,
          humidity_profile: "dry_cap",
        },
        surface_heating: {
          max_warming_rate_k_per_s: 0.018,
          patch_center_x_m: config.domain.width_m / 2,
          patch_width_m: 2_000,
          pattern: "single_patch",
        },
        background_wind: { u_m_per_s: 0.1, w_m_per_s: 0 },
        seed: 31,
      }),
  },
  {
    slug: "microphysics-lifted-humid-parcel",
    name: "Microphysics lab — lifted humid parcel",
    description: "Controlled parcel lift for condensation, vapor depletion, and possible rain indicators.",
    intendedPhenomenon: "Warm-cloud bulk microphysics under prescribed lift.",
    solverMode: "microphysics_lab",
    thermodynamicAssumptions: "Spatially uniform parcel state broadcast through the frame grid.",
    forcingSetup: "Positive prescribed vertical velocity with no Boussinesq coupling.",
    expectedOutcome: "Parcel cools as it rises; vapor decreases once cloud water forms.",
    diagnosticExpectations: [
      "First cloud time is finite.",
      "Water vapor decreases after condensation.",
      "Total water budget remains sane.",
    ],
    knownLimitations: ["No resolved 2-D dynamics; fields are broadcast for visualization compatibility."],
    category: "diagnostic",
    apply: (config) =>
      normalizeConfig({
        ...config,
        solver_type: "microphysics_lab",
        domain: { width_m: 4_000, height_m: 3_000 },
        grid: { columns: 18, rows: 12 },
        time: { time_step_seconds: 5, duration_seconds: 1_200, frame_interval_seconds: 30 },
        initial_atmosphere: {
          surface_temperature_k: celsiusToKelvin(24),
          lapse_rate_k_per_m: 0.0065,
          relative_humidity: 0.88,
          boundary_layer_depth_m: 1_500,
          moist_source_layer_depth_m: 500,
          free_atmosphere_relative_humidity: 0.55,
          humidity_profile: "uniform",
        },
        surface_heating: {
          max_warming_rate_k_per_s: 0,
          patch_center_x_m: 2_000,
          patch_width_m: 1_000,
          pattern: "single_patch",
        },
        background_wind: { u_m_per_s: 0, w_m_per_s: 2.0 },
        seed: 41,
      }),
  },
  {
    slug: "microphysics-no-lift-control",
    name: "Microphysics lab — no-lift control",
    description: "Sub-saturated parcel baseline with no lift, cloud, or rain expected.",
    intendedPhenomenon: "Microphysics sanity control.",
    solverMode: "microphysics_lab",
    thermodynamicAssumptions: "Uniform sub-saturated parcel/box state.",
    forcingSetup: "Zero prescribed vertical velocity and no heating.",
    expectedOutcome: "Air remains cloud-free and water budget stays stable.",
    diagnosticExpectations: [
      "Cloud liquid water remains zero.",
      "Rain water remains zero.",
      "Temperature changes little without lift or heating.",
    ],
    knownLimitations: ["This is intentionally uninteresting visually; it is a control experiment."],
    category: "diagnostic",
    apply: (config) =>
      normalizeConfig({
        ...config,
        solver_type: "microphysics_lab",
        domain: { width_m: 4_000, height_m: 3_000 },
        grid: { columns: 18, rows: 12 },
        time: { time_step_seconds: 5, duration_seconds: 600, frame_interval_seconds: 30 },
        initial_atmosphere: {
          surface_temperature_k: celsiusToKelvin(24),
          lapse_rate_k_per_m: 0.0065,
          relative_humidity: 0.65,
          boundary_layer_depth_m: 1_500,
          moist_source_layer_depth_m: 500,
          free_atmosphere_relative_humidity: 0.55,
          humidity_profile: "uniform",
        },
        surface_heating: {
          max_warming_rate_k_per_s: 0,
          patch_center_x_m: 2_000,
          patch_width_m: 1_000,
          pattern: "single_patch",
        },
        background_wind: { u_m_per_s: 0, w_m_per_s: 0 },
        seed: 43,
      }),
  },
];

export const BOUSSINESQ_REFERENCE_CASES = BUILT_IN_SCENARIOS;

export const BOUSSINESQ_MODEL_SIZES: BoussinesqModelSize[] = [
  {
    slug: "small",
    name: "Small / quick",
    description: "Fast interactive sanity checks on a lower-resolution grid.",
    apply: (config) =>
      normalizeConfig({
        ...config,
        domain: { width_m: 8_000, height_m: 3_000 },
        grid: { columns: 30, rows: 20 },
        time: { time_step_seconds: 2, duration_seconds: 600, frame_interval_seconds: 20 },
        surface_heating: {
          ...config.surface_heating,
          patch_center_x_m: 4_000,
          patch_width_m: Math.min(config.surface_heating.patch_width_m, 2_000),
        },
      }),
  },
  {
    slug: "medium",
    name: "Medium / standard",
    description: "Default manual validation scale for about 20 simulated minutes.",
    apply: (config) =>
      normalizeConfig({
        ...config,
        domain: { width_m: 10_000, height_m: 3_000 },
        grid: { columns: 36, rows: 24 },
        time: { time_step_seconds: 2, duration_seconds: 1_200, frame_interval_seconds: 30 },
        surface_heating: {
          ...config.surface_heating,
          patch_center_x_m: 5_000,
          patch_width_m: Math.min(config.surface_heating.patch_width_m, 2_000),
        },
      }),
  },
  {
    slug: "large",
    name: "Large / slow",
    description: "More detailed local inspection with a slower streamfunction solve.",
    apply: (config) =>
      normalizeConfig({
        ...config,
        domain: { width_m: 12_000, height_m: 4_000 },
        grid: { columns: 54, rows: 36 },
        time: { time_step_seconds: 2, duration_seconds: 1_800, frame_interval_seconds: 30 },
        surface_heating: {
          ...config.surface_heating,
          patch_center_x_m: 6_000,
          patch_width_m: Math.min(config.surface_heating.patch_width_m, 2_500),
        },
      }),
  },
];

export function cloneConfig(config: SimulationConfig): SimulationConfig {
  return structuredClone(config);
}

export function updateConfigNumber(
  config: SimulationConfig,
  path: string,
  value: number,
): SimulationConfig {
  return updateConfigValue(config, path, value);
}

export function updateConfigValue(
  config: SimulationConfig,
  path: string,
  value: ConfigPathValue,
): SimulationConfig {
  const nextConfig = cloneConfig(config);
  const parts = path.split(".");
  let target: Record<string, unknown> = nextConfig as unknown as Record<string, unknown>;

  for (const part of parts.slice(0, -1)) {
    target = target[part] as Record<string, unknown>;
  }
  target[parts[parts.length - 1]] = value;

  return normalizeConfig(nextConfig);
}

export function controlPresentationFor(
  key: ControlKey,
  config: SimulationConfig,
  scenario?: BuiltInScenario | null,
): ControlPresentation {
  const metadata = CONTROL_METADATA[key];
  const solver = scenario?.solverMode ?? config.solver_type;
  const solverApplies = metadata.appliesToSolvers.includes(solver);
  if (!solverApplies) {
    return unavailablePresentation(metadata, metadata.unavailableReason);
  }

  const contextualReason = contextualUnavailableReason(key, config);
  if (contextualReason) {
    return unavailablePresentation(metadata, contextualReason);
  }

  const state = metadata.importance === "basic" ? "active" : "advanced";
  return { ...metadata, state, disabledReason: null };
}

export function controlPresentationsFor(
  config: SimulationConfig,
  scenario?: BuiltInScenario | null,
): ControlPresentation[] {
  return PUBLIC_CONTROL_KEYS.map((key) => controlPresentationFor(key, config, scenario));
}

function unavailablePresentation(
  metadata: ControlMetadata,
  reason: string,
): ControlPresentation {
  const state = metadata.unavailableBehavior === "hide" ? "hidden" : "disabled";
  return { ...metadata, state, disabledReason: reason };
}

function contextualUnavailableReason(
  key: ControlKey,
  config: SimulationConfig,
): string | null {
  const heatingPattern = config.surface_heating.pattern ?? "single_patch";
  if (key === "heating_patch_width" && heatingPattern === "weak_random") {
    return "Weak uneven heating uses seeded bumps rather than an editable patch width.";
  }
  if (
    key === "heating_patch_center" &&
    heatingPattern !== "single_patch" &&
    heatingPattern !== "custom_patches"
  ) {
    return "The selected heating pattern places its own centers.";
  }
  if (key === "prescribed_lift" && config.solver_type === "boussinesq_2d") {
    return CONTROL_METADATA.prescribed_lift.unavailableReason;
  }
  return null;
}

export function normalizeConfig(config: SimulationConfig): SimulationConfig {
  const nextConfig = cloneConfig(config);
  nextConfig.surface_heating.pattern ??= "single_patch";
  nextConfig.surface_heating.patches ??= [];
  nextConfig.initial_atmosphere.humidity_profile ??= "surface_moisture";
  nextConfig.initial_atmosphere.humidity_layers ??= [];
  nextConfig.initial_atmosphere.humidity_patch ??= null;
  nextConfig.initial_atmosphere.moist_source_layer_depth_m ??= Math.min(
    500,
    nextConfig.initial_atmosphere.boundary_layer_depth_m,
  );
  nextConfig.initial_atmosphere.free_atmosphere_relative_humidity ??= Math.min(
    nextConfig.initial_atmosphere.relative_humidity,
    0.55,
  );
  nextConfig.initial_atmosphere.surface_temperature_k = clamp(
    nextConfig.initial_atmosphere.surface_temperature_k,
    celsiusToKelvin(CONTROL_LIMITS.surfaceTemperatureC.min),
    celsiusToKelvin(CONTROL_LIMITS.surfaceTemperatureC.max),
  );
  nextConfig.surface_heating.patch_center_x_m = clamp(
    nextConfig.surface_heating.patch_center_x_m,
    0,
    nextConfig.domain.width_m,
  );
  nextConfig.surface_heating.patch_width_m = clamp(
    nextConfig.surface_heating.patch_width_m,
    CONTROL_LIMITS.heatingWidth.min,
    nextConfig.domain.width_m,
  );
  nextConfig.initial_atmosphere.boundary_layer_depth_m = clamp(
    nextConfig.initial_atmosphere.boundary_layer_depth_m,
    CONTROL_LIMITS.boundaryLayerDepth.min,
    nextConfig.domain.height_m,
  );
  nextConfig.initial_atmosphere.moist_source_layer_depth_m = clamp(
    nextConfig.initial_atmosphere.moist_source_layer_depth_m,
    CONTROL_LIMITS.moistSourceLayerDepth.min,
    Math.min(nextConfig.initial_atmosphere.boundary_layer_depth_m, nextConfig.domain.height_m),
  );
  nextConfig.time.frame_interval_seconds = Math.max(
    nextConfig.time.time_step_seconds,
    nextConfig.time.frame_interval_seconds,
  );
  nextConfig.time.duration_seconds = Math.max(
    nextConfig.time.time_step_seconds,
    nextConfig.time.duration_seconds,
  );
  nextConfig.grid.columns = roundToStep(nextConfig.grid.columns, CONTROL_LIMITS.gridColumns.step);
  nextConfig.grid.rows = roundToStep(nextConfig.grid.rows, CONTROL_LIMITS.gridRows.step);
  nextConfig.seed = Math.max(1, Math.round(nextConfig.seed));
  return nextConfig;
}

export function configWarnings(config: SimulationConfig): string[] {
  const warnings: string[] = [];
  const cellDx = config.domain.width_m / config.grid.columns;
  const cellDz = config.domain.height_m / config.grid.rows;
  const maxWind = Math.max(
    Math.abs(config.background_wind.u_m_per_s),
    Math.abs(config.background_wind.w_m_per_s),
    1,
  );
  const courant = (maxWind * config.time.time_step_seconds) / Math.min(cellDx, cellDz);

  if (courant > 0.35) {
    warnings.push("Large timestep relative to grid spacing and wind may reduce stability.");
  }
  if (config.surface_heating.max_warming_rate_k_per_s > 0.018) {
    warnings.push("Very strong heating can create abrupt thermals in the selected solver.");
  }
  if (config.solver_type === "boussinesq_2d" && config.grid.columns * config.grid.rows > 1_800) {
    warnings.push("Boussinesq runs use an iterative streamfunction solve and may slow down on larger grids.");
  }
  if (config.initial_atmosphere.relative_humidity < 0.65) {
    warnings.push("Low humidity may produce little or no cloud liquid water.");
  }
  if (
    config.solver_type === "boussinesq_2d" &&
    ["uniform", "moist_boundary_layer"].includes(config.initial_atmosphere.humidity_profile ?? "uniform")
  ) {
    const lclHeight = approximateBoussinesqLclHeightM(
      config.initial_atmosphere.surface_temperature_k,
      config.initial_atmosphere.relative_humidity,
    );
    if (lclHeight < config.initial_atmosphere.boundary_layer_depth_m) {
      warnings.push(
        "Boundary-layer top is above the estimated LCL; broad cloud decks are likely.",
      );
    }
  }
  if (kelvinToCelsius(config.initial_atmosphere.surface_temperature_k) < 10) {
    warnings.push("Cool initial surface temperatures may delay or suppress cloud formation.");
  }
  if (config.grid.columns * config.grid.rows > 2_500) {
    warnings.push("High grid resolution may make local streaming and canvas rendering slower.");
  }
  if (config.time.duration_seconds / config.time.frame_interval_seconds > 500) {
    warnings.push("Long runs with short frame cadence may accumulate many browser frames.");
  }
  if (config.surface_heating.patch_width_m < cellDx * 2) {
    warnings.push("Heating patch is narrower than two grid cells and may be hard to resolve.");
  }

  return warnings;
}

export function kelvinToCelsius(valueKelvin: number): number {
  return valueKelvin - KELVIN_OFFSET;
}

export function celsiusToKelvin(valueCelsius: number): number {
  return valueCelsius + KELVIN_OFFSET;
}

function approximateBoussinesqLclHeightM(
  surfaceTemperatureK: number,
  relativeHumidity: number,
): number {
  const humidity = clamp(relativeHumidity, 0.000001, 1);
  const vapor = saturationSpecificHumidity(surfaceTemperatureK) * humidity;
  if (vapor >= saturationSpecificHumidity(surfaceTemperatureK)) {
    return 0;
  }

  let lowerM = 0;
  let upperM = 100;
  const maxHeightM = 15_000;
  while (upperM < maxHeightM) {
    const liftedTemperatureK = surfaceTemperatureK - 0.0098 * upperM;
    if (vapor >= saturationSpecificHumidity(liftedTemperatureK)) {
      break;
    }
    lowerM = upperM;
    upperM *= 2;
  }

  for (let iteration = 0; iteration < 32; iteration += 1) {
    const midpointM = (lowerM + upperM) / 2;
    const liftedTemperatureK = surfaceTemperatureK - 0.0098 * midpointM;
    if (vapor >= saturationSpecificHumidity(liftedTemperatureK)) {
      upperM = midpointM;
    } else {
      lowerM = midpointM;
    }
  }

  return Math.min(upperM, maxHeightM);
}

function saturationSpecificHumidity(temperatureK: number): number {
  const temperatureC = temperatureK - KELVIN_OFFSET;
  const saturationVaporPressureHpa =
    6.112 * Math.exp((17.67 * temperatureC) / (temperatureC + 243.5));
  const mixingRatio =
    (0.622 * saturationVaporPressureHpa) / (900.0 - saturationVaporPressureHpa);
  return Math.max(0, mixingRatio / (1 + mixingRatio));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundToStep(value: number, step: number): number {
  return Math.max(step, Math.round(value / step) * step);
}

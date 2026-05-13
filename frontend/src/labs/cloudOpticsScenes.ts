export const CLOUD_OPTICS_SCENE_IDS = [
  "small-puffy-cumulus",
  "thick-cumulus-dark-base",
  "broken-cloud-field",
  "towering-developing-cumulus",
  "thin-veil-low-optical-depth",
] as const;

export type CloudOpticsSceneId = (typeof CLOUD_OPTICS_SCENE_IDS)[number];

export type CloudOpticsLightColorPreset = "midday" | "golden-hour" | "cool-haze";

export type CloudOpticsSceneControls = {
  sceneId: CloudOpticsSceneId;
  sunElevationDegrees: number;
  sunAzimuthDegrees: number;
  viewAngleDegrees: number;
  cloudWaterDensityMultiplier: number;
  cloudDepthMultiplier: number;
  opticalDepthMultiplier: number;
  lightColorPreset: CloudOpticsLightColorPreset;
  edgeSoftness: number;
  skyBrightness: number;
  haze: number;
  exposure: number;
};

export type CloudOpticsSceneGrid = {
  columns: number;
  rows: number;
  xCoordinates: readonly number[];
  zCoordinates: readonly number[];
  coordinateUnit: "normalized";
};

export type CloudOpticsDepthMetadata = {
  mode: "2.5d-extrusion";
  effectiveDepth: number;
  depthUnit: "normalized";
  layerCount: number;
  layerOffsets: readonly number[];
  description: string;
};

export type CloudOpticsSourceField = {
  key: "cloud_density";
  displayName: "Cloud water density";
  unit: "normalized";
  description: string;
  values: readonly (readonly number[])[];
};

export type CloudOpticsScene = {
  schema_version: "cloud-optics-scene-v1";
  id: CloudOpticsSceneId | "empty-cloud-field";
  name: string;
  teachingPurpose: string;
  expectedResult: string;
  seed: number;
  grid: CloudOpticsSceneGrid;
  sourceField: CloudOpticsSourceField;
  depth: CloudOpticsDepthMetadata;
  defaultControls: CloudOpticsSceneControls;
  sourceMetadata: {
    fieldRole: "physical-source-field";
    generated: true;
    deterministic: true;
    formationPhysics: false;
    notes: readonly string[];
  };
};

type CloudComponent = {
  centerX: number;
  centerZ: number;
  radiusX: number;
  radiusZ: number;
  amplitude: number;
  flatBase?: number;
};

type SceneDefinition = {
  id: CloudOpticsSceneId;
  name: string;
  teachingPurpose: string;
  expectedResult: string;
  seed: number;
  controls: Omit<CloudOpticsSceneControls, "sceneId">;
  depth: Omit<CloudOpticsDepthMetadata, "mode" | "depthUnit" | "description">;
  components: readonly CloudComponent[];
  baseEdgeSoftness: number;
  wispyVeil?: boolean;
};

const DEFAULT_GRID = { columns: 72, rows: 48 };

const SCENE_DEFINITIONS: readonly SceneDefinition[] = [
  {
    id: "small-puffy-cumulus",
    name: "Small Puffy Cumulus",
    teachingPurpose: "Baseline scene for soft edges, bright tops, and shaded interiors.",
    expectedResult:
      "Rounded cloud with gradual edges; high sun brightens top; lower or side sun creates stronger contrast.",
    seed: 211,
    controls: {
      sunElevationDegrees: 48,
      sunAzimuthDegrees: 230,
      viewAngleDegrees: 18,
      cloudWaterDensityMultiplier: 1,
      cloudDepthMultiplier: 1,
      opticalDepthMultiplier: 1,
      lightColorPreset: "midday",
      edgeSoftness: 0.72,
      skyBrightness: 0.78,
      haze: 0.18,
      exposure: 1,
    },
    depth: { effectiveDepth: 0.42, layerCount: 5, layerOffsets: [-0.16, -0.08, 0, 0.08, 0.16] },
    baseEdgeSoftness: 0.72,
    components: [
      { centerX: 0.42, centerZ: 0.52, radiusX: 0.16, radiusZ: 0.13, amplitude: 0.92, flatBase: 0.36 },
      { centerX: 0.52, centerZ: 0.57, radiusX: 0.19, radiusZ: 0.17, amplitude: 1.0, flatBase: 0.36 },
      { centerX: 0.61, centerZ: 0.51, radiusX: 0.14, radiusZ: 0.12, amplitude: 0.78, flatBase: 0.36 },
    ],
  },
  {
    id: "thick-cumulus-dark-base",
    name: "Thick Cumulus With Dark Base",
    teachingPurpose: "Teaches optical thickness and dark cloud bases.",
    expectedResult:
      "Increasing density, thickness, and optical depth darkens base and interior while lit regions stay bright.",
    seed: 307,
    controls: {
      sunElevationDegrees: 34,
      sunAzimuthDegrees: 245,
      viewAngleDegrees: 22,
      cloudWaterDensityMultiplier: 1.35,
      cloudDepthMultiplier: 1.45,
      opticalDepthMultiplier: 1.55,
      lightColorPreset: "midday",
      edgeSoftness: 0.58,
      skyBrightness: 0.7,
      haze: 0.12,
      exposure: 0.92,
    },
    depth: { effectiveDepth: 0.68, layerCount: 7, layerOffsets: [-0.27, -0.18, -0.09, 0, 0.09, 0.18, 0.27] },
    baseEdgeSoftness: 0.52,
    components: [
      { centerX: 0.36, centerZ: 0.47, radiusX: 0.18, radiusZ: 0.14, amplitude: 1.0, flatBase: 0.27 },
      { centerX: 0.49, centerZ: 0.56, radiusX: 0.23, radiusZ: 0.23, amplitude: 1.2, flatBase: 0.27 },
      { centerX: 0.62, centerZ: 0.49, radiusX: 0.19, radiusZ: 0.16, amplitude: 1.05, flatBase: 0.27 },
      { centerX: 0.5, centerZ: 0.36, radiusX: 0.28, radiusZ: 0.09, amplitude: 0.95, flatBase: 0.27 },
    ],
  },
  {
    id: "broken-cloud-field",
    name: "Broken Cloud Field",
    teachingPurpose: "Teaches layered depth, overlap, and view-angle behavior.",
    expectedResult:
      "Multiple cloud elements create depth; oblique views reveal stronger layered structure.",
    seed: 419,
    controls: {
      sunElevationDegrees: 38,
      sunAzimuthDegrees: 215,
      viewAngleDegrees: 42,
      cloudWaterDensityMultiplier: 0.88,
      cloudDepthMultiplier: 1.15,
      opticalDepthMultiplier: 0.95,
      lightColorPreset: "cool-haze",
      edgeSoftness: 0.66,
      skyBrightness: 0.76,
      haze: 0.34,
      exposure: 1.05,
    },
    depth: { effectiveDepth: 0.58, layerCount: 6, layerOffsets: [-0.24, -0.14, -0.04, 0.07, 0.17, 0.25] },
    baseEdgeSoftness: 0.64,
    components: [
      { centerX: 0.2, centerZ: 0.5, radiusX: 0.12, radiusZ: 0.11, amplitude: 0.65, flatBase: 0.33 },
      { centerX: 0.38, centerZ: 0.57, radiusX: 0.15, radiusZ: 0.14, amplitude: 0.85, flatBase: 0.34 },
      { centerX: 0.58, centerZ: 0.5, radiusX: 0.11, radiusZ: 0.12, amplitude: 0.72, flatBase: 0.32 },
      { centerX: 0.76, centerZ: 0.61, radiusX: 0.16, radiusZ: 0.12, amplitude: 0.78, flatBase: 0.4 },
    ],
  },
  {
    id: "towering-developing-cumulus",
    name: "Towering / Developing Cumulus",
    teachingPurpose: "Teaches vertical structure, glowing tops, and shaded interiors.",
    expectedResult:
      "Taller volume shows bright top or sun-facing side with shaded interior; low sun increases drama.",
    seed: 503,
    controls: {
      sunElevationDegrees: 26,
      sunAzimuthDegrees: 240,
      viewAngleDegrees: 24,
      cloudWaterDensityMultiplier: 1.2,
      cloudDepthMultiplier: 1.35,
      opticalDepthMultiplier: 1.35,
      lightColorPreset: "golden-hour",
      edgeSoftness: 0.6,
      skyBrightness: 0.68,
      haze: 0.22,
      exposure: 0.96,
    },
    depth: { effectiveDepth: 0.62, layerCount: 7, layerOffsets: [-0.24, -0.16, -0.08, 0, 0.08, 0.16, 0.24] },
    baseEdgeSoftness: 0.58,
    components: [
      { centerX: 0.44, centerZ: 0.34, radiusX: 0.19, radiusZ: 0.1, amplitude: 0.75, flatBase: 0.2 },
      { centerX: 0.49, centerZ: 0.48, radiusX: 0.17, radiusZ: 0.17, amplitude: 0.98, flatBase: 0.23 },
      { centerX: 0.52, centerZ: 0.66, radiusX: 0.14, radiusZ: 0.2, amplitude: 1.05, flatBase: 0.28 },
      { centerX: 0.55, centerZ: 0.82, radiusX: 0.11, radiusZ: 0.12, amplitude: 0.76, flatBase: 0.4 },
    ],
  },
  {
    id: "thin-veil-low-optical-depth",
    name: "Thin Veil / Low Optical Depth Cloud",
    teachingPurpose: "Teaches translucent clouds and faint optical response.",
    expectedResult: "Cloud remains soft and semi-transparent unless optical depth is raised.",
    seed: 617,
    controls: {
      sunElevationDegrees: 58,
      sunAzimuthDegrees: 205,
      viewAngleDegrees: 12,
      cloudWaterDensityMultiplier: 0.32,
      cloudDepthMultiplier: 0.42,
      opticalDepthMultiplier: 0.35,
      lightColorPreset: "midday",
      edgeSoftness: 0.88,
      skyBrightness: 0.86,
      haze: 0.28,
      exposure: 1.12,
    },
    depth: { effectiveDepth: 0.22, layerCount: 3, layerOffsets: [-0.08, 0, 0.08] },
    baseEdgeSoftness: 0.86,
    wispyVeil: true,
    components: [
      { centerX: 0.34, centerZ: 0.68, radiusX: 0.31, radiusZ: 0.08, amplitude: 0.42 },
      { centerX: 0.66, centerZ: 0.7, radiusX: 0.27, radiusZ: 0.07, amplitude: 0.36 },
    ],
  },
];

export const CLOUD_OPTICS_SCENE_PRESETS = SCENE_DEFINITIONS.map((definition) => ({
  id: definition.id,
  name: definition.name,
  teachingPurpose: definition.teachingPurpose,
  expectedResult: definition.expectedResult,
  defaultSeed: definition.seed,
  defaultControls: freezeControlValues({
    sceneId: definition.id,
    ...definition.controls,
  }),
}));

export function cloudOpticsScenePresetIds(): CloudOpticsSceneId[] {
  return [...CLOUD_OPTICS_SCENE_IDS];
}

export function generateCloudOpticsScene(
  sceneId: CloudOpticsSceneId,
  seedOverride?: number,
): CloudOpticsScene {
  const definition = definitionForScene(sceneId);
  const seed = seedOverride ?? definition.seed;
  const grid = buildGrid(DEFAULT_GRID.columns, DEFAULT_GRID.rows);
  const values = grid.zCoordinates.map((z, rowIndex) =>
    grid.xCoordinates.map((x, columnIndex) =>
      normalizedCloudDensity(definition, seed, x, z, rowIndex, columnIndex),
    ),
  );

  return deepFreeze({
    schema_version: "cloud-optics-scene-v1",
    id: definition.id,
    name: definition.name,
    teachingPurpose: definition.teachingPurpose,
    expectedResult: definition.expectedResult,
    seed,
    grid,
    sourceField: {
      key: "cloud_density",
      displayName: "Cloud water density",
      unit: "normalized",
      description:
        "Deterministic generated source field for cloud optics experiments. It is a qualitative cloud-water-like density field, not weather prediction output.",
      values,
    },
    depth: {
      mode: "2.5d-extrusion",
      effectiveDepth: definition.depth.effectiveDepth,
      depthUnit: "normalized",
      layerCount: definition.depth.layerCount,
      layerOffsets: definition.depth.layerOffsets,
      description:
        "Effective shallow depth used by future 2.5-D renderers. It gives visual volume without claiming true 3-D dynamics.",
    },
    defaultControls: {
      sceneId: definition.id,
      ...definition.controls,
    },
    sourceMetadata: {
      fieldRole: "physical-source-field",
      generated: true,
      deterministic: true,
      formationPhysics: false,
      notes: [
        "Changing renderer controls must not mutate sourceField.values.",
        "Coordinates are normalized so renderer code can map the scene to its own display size.",
        "The field is generated from seeded analytic components and deterministic texture.",
      ],
    },
  });
}

export function generateEmptyCloudOpticsScene(
  seed = 0,
  columns = DEFAULT_GRID.columns,
  rows = DEFAULT_GRID.rows,
): CloudOpticsScene {
  const grid = buildGrid(columns, rows);
  const values = grid.zCoordinates.map(() => grid.xCoordinates.map(() => 0));

  return deepFreeze({
    schema_version: "cloud-optics-scene-v1",
    id: "empty-cloud-field",
    name: "Empty Cloud Field",
    teachingPurpose: "Negative control for no-cloud rendering.",
    expectedResult: "Renderer should show no cloud because the source field contains no density.",
    seed,
    grid,
    sourceField: {
      key: "cloud_density",
      displayName: "Cloud water density",
      unit: "normalized",
      description: "Zero-density source field for no-cloud checks.",
      values,
    },
    depth: {
      mode: "2.5d-extrusion",
      effectiveDepth: 0,
      depthUnit: "normalized",
      layerCount: 1,
      layerOffsets: [0],
      description: "No effective depth because no cloud density is present.",
    },
    defaultControls: {
      sceneId: "small-puffy-cumulus",
      sunElevationDegrees: 45,
      sunAzimuthDegrees: 225,
      viewAngleDegrees: 0,
      cloudWaterDensityMultiplier: 0,
      cloudDepthMultiplier: 0,
      opticalDepthMultiplier: 0,
      lightColorPreset: "midday",
      edgeSoftness: 1,
      skyBrightness: 0.8,
      haze: 0,
      exposure: 1,
    },
    sourceMetadata: {
      fieldRole: "physical-source-field",
      generated: true,
      deterministic: true,
      formationPhysics: false,
      notes: ["No-cloud negative control for future renderer tests."],
    },
  });
}

export function cloudOpticsSceneStats(scene: Pick<CloudOpticsScene, "sourceField">) {
  const values = scene.sourceField.values.flat();
  const maxDensity = values.reduce((max, value) => Math.max(max, value), 0);
  const nonzeroCellCount = values.filter((value) => value > 0).length;
  const totalDensity = values.reduce((sum, value) => sum + value, 0);

  return {
    maxDensity,
    nonzeroCellCount,
    totalDensity,
  };
}

function definitionForScene(sceneId: CloudOpticsSceneId): SceneDefinition {
  const definition = SCENE_DEFINITIONS.find((candidate) => candidate.id === sceneId);
  if (!definition) {
    throw new Error(`Unknown cloud optics scene id: ${sceneId}`);
  }
  return definition;
}

function buildGrid(columns: number, rows: number): CloudOpticsSceneGrid {
  return deepFreeze({
    columns,
    rows,
    xCoordinates: Array.from({ length: columns }, (_, column) =>
      columns === 1 ? 0 : column / (columns - 1),
    ),
    zCoordinates: Array.from({ length: rows }, (_, row) =>
      rows === 1 ? 0 : row / (rows - 1),
    ),
    coordinateUnit: "normalized",
  });
}

function normalizedCloudDensity(
  definition: SceneDefinition,
  seed: number,
  x: number,
  z: number,
  rowIndex: number,
  columnIndex: number,
): number {
  const baseDensity = definition.components.reduce((sum, component, componentIndex) => {
    const jitterX = (hashNoise(seed, componentIndex, 11) - 0.5) * 0.025;
    const jitterZ = (hashNoise(seed, componentIndex, 17) - 0.5) * 0.025;
    const centerX = component.centerX + jitterX;
    const centerZ = component.centerZ + jitterZ;
    const dx = (x - centerX) / component.radiusX;
    const dz = (z - centerZ) / component.radiusZ;
    const gaussian = Math.exp(-(dx * dx + dz * dz) * edgeFalloff(definition.baseEdgeSoftness));
    const baseMask =
      component.flatBase === undefined
        ? 1
        : smoothStep(component.flatBase - 0.03, component.flatBase + 0.06, z);
    return sum + component.amplitude * gaussian * baseMask;
  }, 0);
  const veilTexture = definition.wispyVeil ? 0.74 + 0.26 * Math.sin((x * 5.4 + z * 2.1) * Math.PI) : 1;
  const deterministicTexture =
    0.86 + 0.14 * hashNoise(seed, rowIndex + 101, columnIndex + 211);
  const density = baseDensity * veilTexture * deterministicTexture;

  return clamp01(Number(density.toFixed(6)));
}

function edgeFalloff(edgeSoftness: number): number {
  return 1.25 + (1 - clamp01(edgeSoftness)) * 2.1;
}

function smoothStep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function hashNoise(seed: number, a: number, b: number): number {
  const n = Math.sin(seed * 12.9898 + a * 78.233 + b * 37.719) * 43758.5453;
  return n - Math.floor(n);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function freezeControlValues<T extends CloudOpticsSceneControls>(controls: T): T {
  return Object.freeze({ ...controls });
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null) {
    return value;
  }

  Object.freeze(value);
  for (const nested of Object.values(value as Record<string, unknown>)) {
    if (typeof nested === "object" && nested !== null && !Object.isFrozen(nested)) {
      deepFreeze(nested);
    }
  }

  return value;
}

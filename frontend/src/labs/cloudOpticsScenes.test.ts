import { describe, expect, it } from "vitest";

import {
  CLOUD_OPTICS_SCENE_IDS,
  CLOUD_OPTICS_SCENE_PRESETS,
  cloudOpticsSceneStats,
  cloudOpticsScenePresetIds,
  generateCloudOpticsScene,
  generateEmptyCloudOpticsScene,
} from "./cloudOpticsScenes";

describe("cloud optics preset scenes", () => {
  it("defines all five Clouds, Light, and Shadow scene presets", () => {
    expect(cloudOpticsScenePresetIds()).toEqual([
      "small-puffy-cumulus",
      "thick-cumulus-dark-base",
      "broken-cloud-field",
      "towering-developing-cumulus",
      "thin-veil-low-optical-depth",
    ]);
    expect(CLOUD_OPTICS_SCENE_PRESETS.map((preset) => preset.name)).toEqual([
      "Small Puffy Cumulus",
      "Thick Cumulus With Dark Base",
      "Broken Cloud Field",
      "Towering / Developing Cumulus",
      "Thin Veil / Low Optical Depth Cloud",
    ]);
  });

  it("generates deterministic source fields for a given scene id and seed", () => {
    const first = generateCloudOpticsScene("broken-cloud-field", 123);
    const second = generateCloudOpticsScene("broken-cloud-field", 123);
    const differentSeed = generateCloudOpticsScene("broken-cloud-field", 124);

    expect(first.sourceField.values).toEqual(second.sourceField.values);
    expect(first.depth.layerOffsets).toEqual(second.depth.layerOffsets);
    expect(first.sourceField.values).not.toEqual(differentSeed.sourceField.values);
  });

  it("keeps scene fields finite, non-negative, and nonzero for cloud presets", () => {
    for (const sceneId of CLOUD_OPTICS_SCENE_IDS) {
      const scene = generateCloudOpticsScene(sceneId);
      const values = scene.sourceField.values.flat();

      expect(scene.schema_version).toBe("cloud-optics-scene-v1");
      expect(scene.id).toBe(sceneId);
      expect(scene.grid.coordinateUnit).toBe("normalized");
      expect(scene.sourceField.key).toBe("cloud_density");
      expect(scene.sourceMetadata.fieldRole).toBe("physical-source-field");
      expect(scene.sourceMetadata.formationPhysics).toBe(false);
      expect(values).toHaveLength(scene.grid.columns * scene.grid.rows);
      expect(values.every((value) => Number.isFinite(value))).toBe(true);
      expect(values.every((value) => value >= 0)).toBe(true);
      expect(cloudOpticsSceneStats(scene).nonzeroCellCount).toBeGreaterThan(0);
      expect(cloudOpticsSceneStats(scene).maxDensity).toBeGreaterThan(0);
      expect(scene.depth.mode).toBe("2.5d-extrusion");
      expect(scene.depth.effectiveDepth).toBeGreaterThan(0);
      expect(scene.depth.layerOffsets).toHaveLength(scene.depth.layerCount);
    }
  });

  it("includes default renderer-control values without mutating source data", () => {
    const scene = generateCloudOpticsScene("small-puffy-cumulus");
    const before = scene.sourceField.values.map((row) => [...row]);
    const adjustedControls = {
      ...scene.defaultControls,
      sunElevationDegrees: 12,
      opticalDepthMultiplier: scene.defaultControls.opticalDepthMultiplier * 2,
    };

    expect(adjustedControls.sunElevationDegrees).not.toBe(scene.defaultControls.sunElevationDegrees);
    expect(scene.sourceField.values).toEqual(before);
    expect(Object.isFrozen(scene.sourceField.values)).toBe(true);
  });

  it("supports an empty no-cloud source field for renderer negative controls", () => {
    const scene = generateEmptyCloudOpticsScene(99, 8, 4);
    const stats = cloudOpticsSceneStats(scene);

    expect(scene.id).toBe("empty-cloud-field");
    expect(scene.grid.columns).toBe(8);
    expect(scene.grid.rows).toBe(4);
    expect(stats.maxDensity).toBe(0);
    expect(stats.nonzeroCellCount).toBe(0);
    expect(scene.sourceField.values.flat().every((value) => value === 0)).toBe(true);
  });
});

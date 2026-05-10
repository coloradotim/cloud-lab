import { describe, expect, it } from "vitest";

import type { SimulationFrame } from "./simulationTypes";
import {
  clampFrameIndex,
  replayEventTargets,
  replayStatus,
  stepFrameIndex,
} from "./replay";

function frame(
  timeSeconds: number,
  cloudWater: number,
  rainWater = 0,
): SimulationFrame {
  return {
    schema_version: "sim-frame-v1",
    step: timeSeconds,
    time_seconds: timeSeconds,
    grid: {
      columns: 1,
      rows: 1,
      x_coordinates_m: [0],
      z_coordinates_m: [0],
    },
    fields: {
      cloud_liquid_water_kg_per_kg: {
        values: [[cloudWater]],
        metadata: {
          unit: "kg kg-1",
          display_name: "Cloud liquid water",
          description: "Cloud water.",
        },
      },
      rain_water_kg_per_kg: {
        values: [[rainWater]],
        metadata: {
          unit: "kg kg-1",
          display_name: "Rain water",
          description: "Rain water.",
        },
      },
    },
  };
}

describe("replay helpers", () => {
  it("clamps and steps frame indexes", () => {
    expect(clampFrameIndex(-4, 5)).toBe(0);
    expect(clampFrameIndex(99, 5)).toBe(4);
    expect(stepFrameIndex(2, 5, 1)).toBe(3);
    expect(stepFrameIndex(0, 5, -1)).toBe(0);
    expect(clampFrameIndex(4, 0)).toBe(0);
  });

  it("classifies live and buffered replay state", () => {
    expect(replayStatus("running", 4, 3)).toBe("live");
    expect(replayStatus("running", 4, 1)).toBe("replaying");
    expect(replayStatus("complete", 4, 1)).toBe("complete");
    expect(replayStatus("idle", 0, 0)).toBe("empty");
  });

  it("finds event jump targets when diagnostics are available", () => {
    const targets = replayEventTargets([
      frame(0, 0),
      frame(60, 2e-8),
      frame(120, 4e-6, 0),
      frame(180, 1e-6, 3e-8),
    ]);

    expect(targets.find((target) => target.key === "first_cloud")).toMatchObject({
      frameIndex: 1,
      timeSeconds: 60,
    });
    expect(targets.find((target) => target.key === "max_cloud")).toMatchObject({
      frameIndex: 2,
      timeSeconds: 120,
    });
    expect(targets.find((target) => target.key === "first_rain")).toMatchObject({
      frameIndex: 3,
      timeSeconds: 180,
    });
  });

  it("degrades event targets gracefully when fields are absent or zero", () => {
    const targets = replayEventTargets([frame(0, 0), frame(60, 0)]);

    expect(targets.find((target) => target.key === "first_cloud")).toMatchObject({
      frameIndex: null,
      timeSeconds: null,
    });
    expect(targets.find((target) => target.key === "max_rain")).toMatchObject({
      frameIndex: null,
      timeSeconds: null,
    });
  });
});

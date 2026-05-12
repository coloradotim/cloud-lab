import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { FAIR_WEATHER_CUMULUS_LAB_ID, labById } from "../labs/labCatalog";
import type { WorkbenchRunClient } from "../simulation/runClient";
import type { SimulationFrame } from "../simulationTypes";
import { LabWorkbench } from "./LabWorkbench";
import {
  applyWorkbenchStreamMessage,
  buildWorkbenchInspectorSummary,
  createInitialWorkbenchState,
  saveRunPlaceholder,
  selectWorkbenchScenario,
  setWorkbenchDisplayedFrame,
  startWorkbenchRun,
  updateWorkbenchControl,
} from "./workbenchRunLoop";

const fairWeatherLab = labById(FAIR_WEATHER_CUMULUS_LAB_ID);

if (!fairWeatherLab) {
  throw new Error("Missing Fair-Weather Cumulus lab");
}

describe("Workbench V2 Fair-Weather run loop", () => {
  it("updates active config when a scenario is selected", () => {
    const initial = createInitialWorkbenchState(fairWeatherLab);
    const dryFailed = selectWorkbenchScenario(initial, fairWeatherLab, "dry-failed-cumulus");

    expect(dryFailed.selectedScenarioId).toBe("dry-failed-cumulus");
    expect(dryFailed.nextRunConfig.initial_atmosphere.relative_humidity).toBe(0.45);
    expect(dryFailed.nextRunConfig.surface_heating.max_warming_rate_k_per_s).toBe(0.016);
    expect(dryFailed.frames).toHaveLength(0);
  });

  it("updates the next-run config from primary controls", () => {
    const initial = createInitialWorkbenchState(fairWeatherLab);
    const strongerHeating = updateWorkbenchControl(initial, "surface-heating-strength", 0.012);
    const drierFreeAir = updateWorkbenchControl(strongerHeating, "free-atmosphere-humidity", 0.4);
    const multiPatch = updateWorkbenchControl(drierFreeAir, "surface-heating-pattern", "two_patches");

    expect(multiPatch.nextRunConfig.surface_heating.max_warming_rate_k_per_s).toBe(0.012);
    expect(multiPatch.nextRunConfig.initial_atmosphere.free_atmosphere_relative_humidity).toBe(0.4);
    expect(multiPatch.nextRunConfig.surface_heating.pattern).toBe("two_patches");
  });

  it("run action calls the mocked backend start flow with the next-run config", async () => {
    const initial = updateWorkbenchControl(
      createInitialWorkbenchState(fairWeatherLab),
      "source-layer-humidity",
      0.72,
    );
    const startRun = vi.fn<WorkbenchRunClient["startRun"]>().mockResolvedValue({
      run_id: "run-123",
      duration_seconds: 600,
    });

    const running = await startWorkbenchRun(initial, { startRun });

    expect(startRun).toHaveBeenCalledWith(initial.nextRunConfig);
    expect(running.run.status).toBe("running");
    expect(running.run.runId).toBe("run-123");
    expect(running.frames).toHaveLength(0);
  });

  it("streamed frames are buffered and update displayed workbench state", () => {
    const initial = createInitialWorkbenchState(fairWeatherLab);
    const firstFrame = frameAt(0, { cloudRow: null, updraft: 0.08 });
    const cloudFrame = frameAt(600, { cloudRow: 2, updraft: 0.24 });

    const afterFirst = applyWorkbenchStreamMessage(initial, {
      type: "frame",
      run_id: "run-1",
      frame: firstFrame,
    });
    const afterSecond = applyWorkbenchStreamMessage(afterFirst, {
      type: "frame",
      run_id: "run-1",
      frame: cloudFrame,
    });

    expect(afterSecond.frames).toEqual([firstFrame, cloudFrame]);
    expect(afterSecond.displayedFrameIndex).toBe(1);
    expect(afterSecond.run.framesReceived).toBe(2);
    expect(afterSecond.run.maxCloudWater).toBeGreaterThan(0);
  });

  it("timeline changes the displayed frame without changing buffered frames", () => {
    const initial = createInitialWorkbenchState(fairWeatherLab);
    const withFrames = [frameAt(0, { cloudRow: null, updraft: 0.08 }), frameAt(600, { cloudRow: 2, updraft: 0.24 })]
      .reduce(
        (state, frame) =>
          applyWorkbenchStreamMessage(state, { type: "frame", run_id: "run-1", frame }),
        initial,
      );

    const displayedFirst = setWorkbenchDisplayedFrame(withFrames, 0);

    expect(displayedFirst.frames).toHaveLength(2);
    expect(displayedFirst.displayedFrameIndex).toBe(0);
    expect(displayedFirst.isReplayPaused).toBe(true);
  });

  it("inspector handles unavailable and available diagnostics", () => {
    const initial = createInitialWorkbenchState(fairWeatherLab);
    const unavailable = buildWorkbenchInspectorSummary(initial);

    expect(unavailable.profileAvailable).toBe(false);
    expect(unavailable.diagnostics.status).toBe("not_evaluated");
    expect(unavailable.expectedLclM).toBeGreaterThan(0);
    expect(unavailable.firstCloudTimeSeconds).toBeNull();

    const withFrame = applyWorkbenchStreamMessage(initial, {
      type: "frame",
      run_id: "run-1",
      frame: frameAt(600, { cloudRow: 2, updraft: 0.24 }),
    });
    const available = buildWorkbenchInspectorSummary(withFrame);

    expect(available.profileAvailable).toBe(true);
    expect(available.expectedLclM).toBeGreaterThan(0);
    expect(available.firstCloudTimeSeconds).toBe(600);
    expect(available.cloudTopM).toBeGreaterThan(0);
    expect(available.maxUpdraftMPerS).toBe(0.24);
  });

  it("save-run placeholder is clean and does not expose old saved-run manager panels", () => {
    const initial = createInitialWorkbenchState(fairWeatherLab);
    const emptySave = saveRunPlaceholder(initial);
    const withFrame = applyWorkbenchStreamMessage(initial, {
      type: "frame",
      run_id: "run-1",
      frame: frameAt(600, { cloudRow: 2, updraft: 0.24 }),
    });
    const readySave = saveRunPlaceholder(withFrame);

    expect(emptySave.saveMessage).toContain("Run something first");
    expect(readySave.saveMessage).toContain("ready for the saved-run workflow");
  });

  it("renders one Run/Stop/Reset group and no old default saved-run or comparison panels", () => {
    const html = renderToStaticMarkup(
      <LabWorkbench lab={fairWeatherLab} onBackToLabs={vi.fn()} />,
    );

    expect(matchCount(html, ">Run<")).toBe(1);
    expect(matchCount(html, ">Stop<")).toBe(1);
    expect(matchCount(html, ">Reset<")).toBe(1);
    expect(html).not.toContain("saved-runs-panel");
    expect(html).not.toContain("comparison-panel");
  });
});

function frameAt(
  timeSeconds: number,
  { cloudRow, updraft }: { cloudRow: number | null; updraft: number },
): SimulationFrame {
  const cloud = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  if (cloudRow !== null) {
    cloud[cloudRow][1] = 2e-6;
  }

  return {
    schema_version: "sim-frame-v1",
    step: timeSeconds / 60,
    time_seconds: timeSeconds,
    grid: {
      columns: 3,
      rows: 3,
      x_coordinates_m: [0, 500, 1_000],
      z_coordinates_m: [0, 500, 1_000],
    },
    fields: {
      temperature_k: field([
        [298, 298, 298],
        [294, 294, 294],
        [291, 291, 291],
      ]),
      temperature_perturbation_k: field([
        [0, 0.2, 0],
        [0, 0.1, 0],
        [0, 0, 0],
      ]),
      water_vapor_kg_per_kg: field([
        [0.014, 0.014, 0.014],
        [0.012, 0.012, 0.012],
        [0.01, 0.01, 0.01],
      ]),
      cloud_liquid_water_kg_per_kg: field(cloud),
      rain_water_kg_per_kg: field([
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ]),
      horizontal_velocity_m_per_s: field([
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ]),
      vertical_velocity_m_per_s: field([
        [0, updraft, 0],
        [0, updraft / 2, 0],
        [0, 0, 0],
      ]),
    },
  };
}

function field(values: number[][]): SimulationFrame["fields"][string] {
  return {
    values,
    metadata: {
      unit: "test",
      display_name: "Test field",
      description: "Test field",
    },
  };
}

function matchCount(value: string, needle: string): number {
  return value.split(needle).length - 1;
}

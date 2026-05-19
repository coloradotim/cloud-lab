import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { FAIR_WEATHER_CUMULUS_LAB_ID, labById } from "../labs/labCatalog";
import type { WorkbenchRunClient } from "../simulation/runClient";
import type { SimulationFrame } from "../simulationTypes";
import { LabWorkbench } from "./LabWorkbench";
import {
  availableScientificFields,
  buildScientificFieldViewModel,
  normalizeScientificFieldSelection,
} from "./scientificFieldView";
import {
  applyWorkbenchStreamMessage,
  buildWorkbenchInspectorSummary,
  createInitialWorkbenchState,
  displayedFrame,
  saveRunPlaceholder,
  selectWorkbenchScenario,
  setWorkbenchDisplayedFrame,
  startWorkbenchRun,
  updateWorkbenchControl,
} from "./workbenchRunLoop";

const fairWeatherLab = labById(FAIR_WEATHER_CUMULUS_LAB_ID);

if (!fairWeatherLab) {
  throw new Error("Missing Lower Atmosphere Cloud Basics lab");
}

describe("Workbench V2 lower-atmosphere run loop", () => {
  it("updates active config when a scenario is selected", () => {
    const initial = createInitialWorkbenchState(fairWeatherLab);
    const dryFailed = selectWorkbenchScenario(
      initial,
      fairWeatherLab,
      "lower-atmosphere-v2-dry-failed-cumulus",
    );

    expect(dryFailed.selectedScenarioId).toBe("lower-atmosphere-v2-dry-failed-cumulus");
    expect(dryFailed.frames).toHaveLength(0);
  });

  it("keeps the default lower-atmosphere model setup equivalent to the former medium run", () => {
    const initial = createInitialWorkbenchState(fairWeatherLab);

    expect(initial.modelResolutionSlug).toBe("medium");
    expect(initial.nextRunConfig.domain).toEqual({ width_m: 10_000, height_m: 3_000 });
    expect(initial.nextRunConfig.grid).toEqual({ columns: 36, rows: 24 });
    expect(initial.nextRunConfig.time.duration_seconds).toBe(1_200);
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

  it("separates resolution, domain size, and run length controls", () => {
    const initial = createInitialWorkbenchState(fairWeatherLab);
    const highResolution = updateWorkbenchControl(initial, "model-resolution", "high");
    const widerDomain = updateWorkbenchControl(highResolution, "domain-width", 12_000);
    const tallerDomain = updateWorkbenchControl(widerDomain, "domain-height", 4_000);
    const longerRun = updateWorkbenchControl(tallerDomain, "run-length", 1_800);

    expect(longerRun.modelResolutionSlug).toBe("high");
    expect(longerRun.nextRunConfig.grid).toEqual({ columns: 54, rows: 36 });
    expect(longerRun.nextRunConfig.domain).toEqual({ width_m: 12_000, height_m: 4_000 });
    expect(longerRun.nextRunConfig.surface_heating.patch_center_x_m).toBe(6_000);
    expect(longerRun.nextRunConfig.time.duration_seconds).toBe(1_800);
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

  it("Lower Atmosphere renders a guided experiment before model details", () => {
    const html = renderToStaticMarkup(
      <LabWorkbench lab={fairWeatherLab} onBackToLabs={vi.fn()} />,
    );

    expect(html).toContain("Guided cloud experiment");
    expect(html).toContain("Choose an experiment");
    expect(html).toContain('<details class="experiment-chooser"');
    expect(html).toContain("Move to a different experiment");
    expect(html).toContain("The reference cloud evolution is already available because it is offline");
    expect(html).toContain("Watch the cloud evolve");
    expect(html).toContain("Replay the experiment");
    expect(html).toContain("Understand why");
    expect(html).toContain("Atmospheric clues");
    expect(html).toContain("Try next");
    expect(html).toContain("Model details / Why trust this?");
    expect(html).toContain('<details class="guided-model-details">');
    expect(html).toContain("Scientific Fields");
    expect(html).toContain("Cloud Appearance");
    expect(html).toContain("Interactive</dt>");
    expect(html).toContain("Reference</dt>");
    expect(html).toContain("Read as:");
    expect(html).toContain("Reduced model output");
    expect(html).toContain("CM1 reference output");
    expect(html).toContain("Exact cloud morphology is not presented as pass/fail");
    expect(html).toContain("Not live CM1 simulation");
    expect(html).toContain("Reference cloud evolution is available before you run the interactive experiment");
    expect(html).toContain("Field status");
    expect(html).not.toContain("Lower Atmosphere v2 reduced-model shell");
    expect(html).not.toContain("Run v2 flow");
    expect(html).not.toContain("Experimental 2-D prototype");
  });

  it("scientific view model renders the selected field from a frame", () => {
    const frame = frameAt(600, { cloudRow: 2, updraft: 0.24 });
    const viewModel = buildScientificFieldViewModel(frame, "cloud_liquid_water_kg_per_kg");

    expect(viewModel?.fieldKey).toBe("cloud_liquid_water_kg_per_kg");
    expect(viewModel?.summary.truth.label).toBe("Solver output");
    expect(viewModel?.cells).toHaveLength(9);
    expect(viewModel?.cells.some((cell) => cell.value === 2e-6)).toBe(true);
  });

  it("field selector options and selection change the displayed field model", () => {
    const frame = frameAt(600, { cloudRow: 2, updraft: 0.24 });
    const options = availableScientificFields(frame).map((field) => field.key);
    const selected = normalizeScientificFieldSelection(frame, "vertical_velocity_m_per_s");
    const viewModel = buildScientificFieldViewModel(frame, selected);

    expect(options).toContain("cloud_liquid_water_kg_per_kg");
    expect(options).toContain("vertical_velocity_m_per_s");
    expect(viewModel?.fieldKey).toBe("vertical_velocity_m_per_s");
    expect(viewModel?.summary.truth.label).toBe("Solver output");
  });

  it("timeline/displayed frame changes the scientific visualization input", () => {
    const initial = createInitialWorkbenchState(fairWeatherLab);
    const withFrames = [
      frameAt(0, { cloudRow: null, updraft: 0.08 }),
      frameAt(600, { cloudRow: 2, updraft: 0.24 }),
    ].reduce(
      (state, frame) =>
        applyWorkbenchStreamMessage(state, { type: "frame", run_id: "run-1", frame }),
      initial,
    );

    const displayedFirst = setWorkbenchDisplayedFrame(withFrames, 0);
    const displayedFinal = setWorkbenchDisplayedFrame(withFrames, 1);

    expect(buildScientificFieldViewModel(displayedFrame(displayedFirst), "cloud_liquid_water_kg_per_kg")?.summary.value)
      .toBe("0.00e+0");
    expect(buildScientificFieldViewModel(displayedFrame(displayedFinal), "cloud_liquid_water_kg_per_kg")?.summary.value)
      .toBe("2.00e-6");
  });

  it("inspector handles unavailable and available diagnostics", () => {
    const initial = createInitialWorkbenchState(fairWeatherLab);
    const unavailable = buildWorkbenchInspectorSummary(initial);

    expect(unavailable.profileAvailable).toBe(false);
    expect(unavailable.diagnostics.status).toBe("not_evaluated");
    expect(unavailable.expectedLclM).toBeGreaterThan(0);
    expect(unavailable.firstCloudTimeSeconds).toBeNull();
    expect(unavailable.profileRows).toHaveLength(0);
    expect(unavailable.returnFlowWarning).toContain("Unavailable");

    const withFrame = applyWorkbenchStreamMessage(initial, {
      type: "frame",
      run_id: "run-1",
      frame: frameAt(600, { cloudRow: 2, updraft: 0.24 }),
    });
    const available = buildWorkbenchInspectorSummary(withFrame);

    expect(available.profileAvailable).toBe(true);
    expect(available.expectedLclM).toBeGreaterThan(0);
    expect(available.firstCloudTimeSeconds).toBeNull();
    expect(available.cloudTopM).toBeNull();
    expect(available.maxUpdraftMPerS).toBeNull();
    expect(available.actualCloudBaseM).toBe(1_000);
    expect(available.integratedCloudWaterKgPerKg).toBeGreaterThan(0);
    expect(available.maxCloudWaterKgPerKg).toBe(2e-6);
    expect(available.profileRows.length).toBeGreaterThan(0);
    expect(available.returnFlowWarning).toContain("No low-level return-flow");
    expect(available.artifactWarnings).toEqual([]);
  });

  it("guided Lower Atmosphere details keep deterministic diagnostics and honesty labels available", () => {
    const html = renderToStaticMarkup(
      <LabWorkbench lab={fairWeatherLab} onBackToLabs={vi.fn()} />,
    );

    expect(html).toContain("Model details / Why trust this?");
    expect(html).toContain("Reduced-model support diagnostics");
    expect(html).toContain("Selected profile time");
    expect(html).toContain("Profile status");
    expect(html).toContain("Cloud-column status");
    expect(html).toContain("Diagnostic comparison");
    expect(html).toContain("Reduced model");
    expect(html).toContain("Offline reference case");
    expect(html).toContain("Exact morphology is not pass/fail");
    expect(html).not.toContain("Experimental solver output");
    expect(html).not.toContain("Experimental 2-D prototype");
  });

  it("guided experience remains mounted when the old inspector is closed", () => {
    const html = renderToStaticMarkup(
      <LabWorkbench
        lab={fairWeatherLab}
        initialInspectorOpen={false}
        onBackToLabs={vi.fn()}
      />,
    );

    expect(html).toContain("Guided cloud experiment");
    expect(html).toContain("Watch the cloud evolve");
    expect(html).not.toContain("inspector-region");
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

  it("renders guided run controls at rest and no old default saved-run or comparison panels", () => {
    const html = renderToStaticMarkup(
      <LabWorkbench lab={fairWeatherLab} onBackToLabs={vi.fn()} />,
    );

    expect(matchCount(html, ">Run experiment<")).toBe(2);
    expect(matchCount(html, ">Stop<")).toBe(0);
    expect(matchCount(html, ">Reset<")).toBe(2);
    expect(html).not.toContain("saved-runs-panel");
    expect(html).not.toContain("comparison-panel");
    expect(html).not.toContain(">Compare<");
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

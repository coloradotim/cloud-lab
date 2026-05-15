import { describe, expect, it } from "vitest";

import {
  advanceBoundaryLayerReplay,
  boundaryLayerDiagnosticViewModel,
  boundaryLayerDisplayedFrame,
  boundaryLayerPreviewFrame,
  clampBoundaryLayerFrameIndex,
  createInitialBoundaryLayer1DState,
  durationHoursToSeconds,
  durationSecondsToHours,
  formatHoursAfterSunrise,
  markBoundaryLayerComputing,
  markBoundaryLayerRunReady,
  pauseBoundaryLayerReplay,
  replayBoundaryLayerEvolution,
  selectBoundaryLayerFrame,
  selectFinalBoundaryLayerFrame,
  usableBoundaryLayerFrames,
  type BoundaryLayer1DFrame,
  type BoundaryLayer1DRun,
} from "./evolvingBoundaryLayer";

describe("Evolving Boundary Layer replay state", () => {
  it("starts a completed profile run at the first frame and begins replay", () => {
    const state = createInitialBoundaryLayer1DState();
    const computing = markBoundaryLayerComputing(state);
    const ready = markBoundaryLayerRunReady(computing, sampleRun());

    expect(computing.status).toBe("computing");
    expect(ready.status).toBe("replaying");
    expect(ready.displayedFrameIndex).toBe(0);
    expect(boundaryLayerDisplayedFrame(ready)?.time_hours_from_sunrise).toBe(0);
    expect(ready.message).toContain("0.0 h after sunrise");
  });

  it("advances replay over time and marks complete only at the final frame", () => {
    const ready = markBoundaryLayerRunReady(createInitialBoundaryLayer1DState(), sampleRun());

    const second = advanceBoundaryLayerReplay(ready);
    const final = advanceBoundaryLayerReplay(second);
    const stillFinal = advanceBoundaryLayerReplay(final);

    expect(second.status).toBe("replaying");
    expect(second.displayedFrameIndex).toBe(1);
    expect(second.message).toContain("1.0 h after sunrise");
    expect(final.status).toBe("replaying");
    expect(final.displayedFrameIndex).toBe(2);
    expect(stillFinal.status).toBe("complete");
    expect(stillFinal.displayedFrameIndex).toBe(2);
  });

  it("can pause, replay from the first frame, select first, and select final", () => {
    const ready = markBoundaryLayerRunReady(createInitialBoundaryLayer1DState(), sampleRun());
    const advanced = advanceBoundaryLayerReplay(ready);
    const paused = pauseBoundaryLayerReplay(advanced);
    const replaying = replayBoundaryLayerEvolution(paused);
    const final = selectFinalBoundaryLayerFrame(replaying);
    const first = selectBoundaryLayerFrame(final, 0);

    expect(paused.status).toBe("paused");
    expect(replaying.status).toBe("replaying");
    expect(replaying.displayedFrameIndex).toBe(0);
    expect(final.status).toBe("complete");
    expect(final.displayedFrameIndex).toBe(2);
    expect(first.status).toBe("paused");
    expect(first.displayedFrameIndex).toBe(0);
  });

  it("clamps out-of-range frame indices and ignores empty or invalid frames", () => {
    const run = sampleRun();
    const brokenFrame = { ...sampleFrame(3), temperature_k: [] };
    const filtered = usableBoundaryLayerFrames({ ...run, frames: [run.frames[0], brokenFrame] });

    expect(clampBoundaryLayerFrameIndex(99, run.frames.length)).toBe(2);
    expect(clampBoundaryLayerFrameIndex(Number.NaN, run.frames.length)).toBe(0);
    expect(filtered).toHaveLength(1);
    expect(markBoundaryLayerRunReady(createInitialBoundaryLayer1DState(), { ...run, frames: [brokenFrame] }).status).toBe("error");
  });

  it("formats duration and diagnostic guidance without raw backend seconds", () => {
    const frame = sampleFrame(2, "moisture_limited");
    const viewModel = boundaryLayerDiagnosticViewModel(frame, {
      slug: "morning-stable-layer-breaks-down",
      name: "Morning stable layer breaks down",
      purpose: "Baseline",
      expected_status: "moisture_limited",
      config: createInitialBoundaryLayer1DState().config,
    });

    expect(durationSecondsToHours(14_400)).toBe(4);
    expect(durationHoursToSeconds(4)).toBe(14_400);
    expect(formatHoursAfterSunrise(1.5)).toBe("1.5 h after sunrise");
    expect(viewModel.scenarioCheckLabel).toBe("Matches scenario");
    expect(viewModel.explanation).toContain("mixed layer reached");
    expect(viewModel.tryNext).toEqual(
      expect.arrayContaining(["increase surface moisture flux", "start with higher mixed-layer humidity"]),
    );
  });

  it("builds a preview placeholder when no run frames exist", () => {
    const frame = boundaryLayerPreviewFrame(createInitialBoundaryLayer1DState());

    expect(frame.diagnostics.cloud_formation_potential_status).toBe("not_evaluated");
    expect(frame.z_m.length).toBeGreaterThan(1);
    expect(frame.temperature_k).toHaveLength(frame.z_m.length);
    expect(frame.relative_humidity_percent).toHaveLength(frame.z_m.length);
  });
});

function sampleRun(): BoundaryLayer1DRun {
  return {
    schema_version: "profile-run-v1",
    config: createInitialBoundaryLayer1DState().config,
    frames: [
      sampleFrame(0, "not_favorable_yet"),
      sampleFrame(1, "not_favorable_yet"),
      sampleFrame(2, "moisture_limited"),
    ],
  };
}

function sampleFrame(
  index: number,
  status: BoundaryLayer1DFrame["diagnostics"]["cloud_formation_potential_status"] = "not_favorable_yet",
): BoundaryLayer1DFrame {
  return {
    schema_version: "profile-frame-v1",
    step: index,
    time_seconds: index * 3_600,
    time_hours_from_sunrise: index,
    model_type: "boundary_layer_1d",
    z_m: [0, 500, 1_000, 1_500, 2_000],
    temperature_k: [291, 288, 285, 282, 279].map((value) => value + index),
    water_vapor_kg_per_kg: [0.008, 0.008, 0.006, 0.004, 0.003],
    relative_humidity_percent: [58, 60, 55, 40, 35].map((value) => value + index),
    mixed_layer_depth_m: 250 + index * 174,
    lcl_m: 1_524,
    inversion_height_m: 1_600,
    inversion_strength_k: 2,
    surface_heating_accumulated_k: index,
    surface_moisture_added_kg_per_kg: index * 0.0001,
    entrainment_drying_proxy: index * 0.00001,
    diagnostics: {
      cloud_formation_potential_status: status,
      cloud_formation_potential_reason:
        "The profile remains too dry: LCL stays well above the mixed layer or peak RH is too low.",
      mixed_layer_lcl_difference_m: 250 + index * 174 - 1_524,
      rh_near_mixed_layer_top_percent: 58 + index,
      max_relative_humidity_percent: 70 + index,
      cap_suppression_index: 0,
      heating_limited: false,
      moisture_limited: status === "moisture_limited",
      cap_limited: false,
      dry_entrainment_limited: false,
    },
  };
}

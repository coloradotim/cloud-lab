import type { SimulationFrame } from "./simulationTypes";

export type ReplayStatus = "empty" | "live" | "replaying" | "complete";

export type ReplayEventTarget = {
  key: string;
  label: string;
  frameIndex: number | null;
  timeSeconds: number | null;
};

export function clampFrameIndex(frameIndex: number, frameCount: number): number {
  if (frameCount <= 0) {
    return 0;
  }

  return Math.min(frameCount - 1, Math.max(0, Math.round(frameIndex)));
}

export function stepFrameIndex(
  currentFrameIndex: number,
  frameCount: number,
  step: -1 | 1,
): number {
  return clampFrameIndex(currentFrameIndex + step, frameCount);
}

export function replayStatus(
  playbackStatus: string,
  frameCount: number,
  displayedFrameIndex: number,
): ReplayStatus {
  if (frameCount === 0) {
    return "empty";
  }

  if (playbackStatus === "running" || playbackStatus === "starting") {
    return displayedFrameIndex >= frameCount - 1 ? "live" : "replaying";
  }

  return playbackStatus === "complete" || playbackStatus === "stopped"
    ? "complete"
    : "replaying";
}

export function replayEventTargets(frames: SimulationFrame[]): ReplayEventTarget[] {
  return [
    {
      key: "first_cloud",
      label: "First cloud",
      ...firstFrameWhere(frames, (frame) => maxFieldValue(frame, "cloud_liquid_water_kg_per_kg") > 1e-8),
    },
    {
      key: "max_cloud",
      label: "Max cloud",
      ...maxFrameForField(frames, "cloud_liquid_water_kg_per_kg"),
    },
    {
      key: "first_rain",
      label: "First rain",
      ...firstFrameWhere(frames, (frame) => maxFieldValue(frame, "rain_water_kg_per_kg") > 1e-8),
    },
    {
      key: "max_rain",
      label: "Max rain",
      ...maxFrameForField(frames, "rain_water_kg_per_kg"),
    },
  ];
}

function firstFrameWhere(
  frames: SimulationFrame[],
  predicate: (frame: SimulationFrame) => boolean,
): Pick<ReplayEventTarget, "frameIndex" | "timeSeconds"> {
  const frameIndex = frames.findIndex(predicate);
  if (frameIndex === -1) {
    return { frameIndex: null, timeSeconds: null };
  }

  return { frameIndex, timeSeconds: frames[frameIndex].time_seconds };
}

function maxFrameForField(
  frames: SimulationFrame[],
  fieldKey: string,
): Pick<ReplayEventTarget, "frameIndex" | "timeSeconds"> {
  let bestFrameIndex: number | null = null;
  let bestValue = 0;

  frames.forEach((frame, frameIndex) => {
    const value = maxFieldValue(frame, fieldKey);
    if (value > bestValue) {
      bestFrameIndex = frameIndex;
      bestValue = value;
    }
  });

  if (bestFrameIndex === null) {
    return { frameIndex: null, timeSeconds: null };
  }

  return {
    frameIndex: bestFrameIndex,
    timeSeconds: frames[bestFrameIndex].time_seconds,
  };
}

function maxFieldValue(frame: SimulationFrame, fieldKey: string): number {
  const field = frame.fields[fieldKey];
  if (!field) {
    return 0;
  }

  return field.values.reduce(
    (currentMax, row) => Math.max(currentMax, ...row),
    Number.NEGATIVE_INFINITY,
  );
}

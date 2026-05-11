import type { ScenarioDiagnostics } from "./scenarioDiagnostics";
import type { BuiltInScenario } from "./simulationControls";
import { normalizeConfig } from "./simulationControls";
import type { SimulationConfig, SimulationFrame } from "./simulationTypes";

export type SavedRunArtifact = {
  schema_version: "saved-run-artifact-v1";
  id: string;
  kind: "run_artifact";
  name: string;
  notes: string;
  created_at: string;
  scenario: {
    slug: string;
    name: string;
  } | null;
  config_schema_version: SimulationConfig["schema_version"];
  frame_schema_version: SimulationFrame["schema_version"] | null;
  solver_type: SimulationConfig["solver_type"];
  app_version: string;
  backend_version: string | null;
  config: SimulationConfig;
  run: {
    duration_seconds: number;
    frame_count: number;
    final_time_seconds: number;
    displayed_time_seconds: number;
  };
  diagnostics: {
    scenario_status: ScenarioDiagnostics["status"];
    scenario_status_label: string;
    expected: string;
    observed: string;
    notes: string[];
    first_cloud_time_seconds: number | null;
    first_cloud_height_m: number | null;
    max_cloud_liquid_water_kg_per_kg: number | null;
    max_cloud_time_seconds: number | null;
    cloud_top_height_m: number | null;
    max_updraft_m_per_s: number | null;
    first_rain_time_seconds: number | null;
    max_rain_water_kg_per_kg: number | null;
    estimated_lcl_m: number | null;
    microphysics_total_water_drift_concerning: boolean | null;
  };
  replay: {
    storage: "sampled_frames";
    total_frame_count: number;
    stored_frame_count: number;
    sample_stride: number;
    frames_truncated: boolean;
  };
  sampled_frames: SimulationFrame[];
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const STORAGE_KEY = "cloud-lab.saved-runs.v1";
const MAX_STORED_FRAMES = 60;
const LOCAL_STORAGE_WARNING_BYTES = 4_500_000;

export function loadSavedRuns(storage: StorageLike = window.localStorage): SavedRunArtifact[] {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item) => coerceSavedRun(item))
      .filter((artifact): artifact is SavedRunArtifact => artifact !== null)
      .sort((left, right) => right.created_at.localeCompare(left.created_at));
  } catch {
    return [];
  }
}

export function createSavedRunArtifact({
  name,
  notes,
  scenario,
  config,
  frames,
  displayedFrameIndex,
  diagnostics,
  backendVersion,
  now = new Date(),
}: {
  name: string;
  notes: string;
  scenario: BuiltInScenario | null | undefined;
  config: SimulationConfig;
  frames: SimulationFrame[];
  displayedFrameIndex: number;
  diagnostics: ScenarioDiagnostics;
  backendVersion: string | null;
  now?: Date;
}): SavedRunArtifact {
  const timestamp = now.toISOString();
  const finalFrame = frames[frames.length - 1] ?? null;
  const displayedFrame = frames[displayedFrameIndex] ?? finalFrame;
  const sampledFrames = sampleFrames(frames);
  const observations = diagnostics.observations;
  const trimmedName = name.trim() || defaultRunName(scenario, timestamp);

  return {
    schema_version: "saved-run-artifact-v1",
    id: runArtifactId(timestamp),
    kind: "run_artifact",
    name: trimmedName,
    notes: notes.trim(),
    created_at: timestamp,
    scenario: scenario ? { slug: scenario.slug, name: scenario.name } : null,
    config_schema_version: config.schema_version,
    frame_schema_version: finalFrame?.schema_version ?? null,
    solver_type: config.solver_type,
    app_version: "local-browser",
    backend_version: backendVersion,
    config: normalizeConfig(config),
    run: {
      duration_seconds: config.time.duration_seconds,
      frame_count: frames.length,
      final_time_seconds: finalFrame?.time_seconds ?? 0,
      displayed_time_seconds: displayedFrame?.time_seconds ?? 0,
    },
    diagnostics: {
      scenario_status: diagnostics.status,
      scenario_status_label: diagnostics.statusLabel,
      expected: diagnostics.expected,
      observed: diagnostics.observed,
      notes: diagnostics.notes,
      first_cloud_time_seconds: observations?.firstCloudTimeSeconds ?? null,
      first_cloud_height_m: observations?.firstCloudBaseM ?? null,
      max_cloud_liquid_water_kg_per_kg: observations?.maxCloudLiquidWaterKgPerKg ?? null,
      max_cloud_time_seconds: observations?.maxCloudWaterTimeSeconds ?? null,
      cloud_top_height_m: observations?.maxCloudTopM ?? null,
      max_updraft_m_per_s: observations?.maxUpdraftMPerS ?? null,
      first_rain_time_seconds: observations?.firstRainTimeSeconds ?? null,
      max_rain_water_kg_per_kg: observations?.maxRainWaterKgPerKg ?? null,
      estimated_lcl_m: observations?.estimatedLclM ?? null,
      microphysics_total_water_drift_concerning:
        observations?.microphysicsTotalWaterDriftConcerning ?? null,
    },
    replay: {
      storage: "sampled_frames",
      total_frame_count: frames.length,
      stored_frame_count: sampledFrames.length,
      sample_stride: sampleStride(frames.length),
      frames_truncated: sampledFrames.length < frames.length,
    },
    sampled_frames: sampledFrames,
  };
}

export function saveRunArtifact(
  artifacts: SavedRunArtifact[],
  artifact: SavedRunArtifact,
): SavedRunArtifact[] {
  return [artifact, ...artifacts];
}

export function deleteSavedRun(
  artifacts: SavedRunArtifact[],
  artifactId: string,
): SavedRunArtifact[] {
  return artifacts.filter((artifact) => artifact.id !== artifactId);
}

export function persistSavedRuns(
  artifacts: SavedRunArtifact[],
  storage: StorageLike = window.localStorage,
) {
  const serialized = JSON.stringify(artifacts);
  if (serialized.length > LOCAL_STORAGE_WARNING_BYTES) {
    const metadataOnly = artifacts.map((artifact) => ({
      ...artifact,
      replay: {
        ...artifact.replay,
        stored_frame_count: 0,
        frames_truncated: artifact.replay.total_frame_count > 0,
      },
      sampled_frames: [],
    }));
    storage.setItem(STORAGE_KEY, JSON.stringify(metadataOnly));
    return;
  }
  storage.setItem(STORAGE_KEY, serialized);
}

function sampleFrames(frames: SimulationFrame[]): SimulationFrame[] {
  if (frames.length <= MAX_STORED_FRAMES) {
    return frames;
  }
  const stride = sampleStride(frames.length);
  const sampled = frames.filter((_, index) => index % stride === 0);
  const finalFrame = frames[frames.length - 1];
  if (sampled[sampled.length - 1] !== finalFrame) {
    sampled.push(finalFrame);
  }
  return sampled;
}

function sampleStride(frameCount: number): number {
  return Math.max(1, Math.ceil(frameCount / MAX_STORED_FRAMES));
}

function coerceSavedRun(item: unknown): SavedRunArtifact | null {
  if (!item || typeof item !== "object") {
    return null;
  }
  const record = item as Partial<SavedRunArtifact>;
  if (
    record.schema_version !== "saved-run-artifact-v1" ||
    typeof record.id !== "string" ||
    typeof record.name !== "string" ||
    !record.config ||
    typeof record.config !== "object"
  ) {
    return null;
  }

  const config = normalizeConfig(record.config as SimulationConfig);
  const sampledFrames = Array.isArray(record.sampled_frames)
    ? (record.sampled_frames as SimulationFrame[])
    : [];
  const totalFrameCount =
    typeof record.replay?.total_frame_count === "number"
      ? record.replay.total_frame_count
      : sampledFrames.length;

  return {
    schema_version: "saved-run-artifact-v1",
    id: record.id,
    kind: "run_artifact",
    name: record.name,
    notes: typeof record.notes === "string" ? record.notes : "",
    created_at:
      typeof record.created_at === "string" ? record.created_at : new Date(0).toISOString(),
    scenario: record.scenario?.slug && record.scenario?.name ? record.scenario : null,
    config_schema_version: config.schema_version,
    frame_schema_version: record.frame_schema_version ?? sampledFrames[0]?.schema_version ?? null,
    solver_type: config.solver_type,
    app_version: typeof record.app_version === "string" ? record.app_version : "unknown",
    backend_version:
      typeof record.backend_version === "string" ? record.backend_version : null,
    config,
    run: {
      duration_seconds: record.run?.duration_seconds ?? config.time.duration_seconds,
      frame_count: record.run?.frame_count ?? totalFrameCount,
      final_time_seconds:
        record.run?.final_time_seconds ??
        sampledFrames[sampledFrames.length - 1]?.time_seconds ??
        0,
      displayed_time_seconds:
        record.run?.displayed_time_seconds ??
        sampledFrames[sampledFrames.length - 1]?.time_seconds ??
        0,
    },
    diagnostics: {
      scenario_status: record.diagnostics?.scenario_status ?? "not_evaluated",
      scenario_status_label: record.diagnostics?.scenario_status_label ?? "Not evaluated",
      expected: record.diagnostics?.expected ?? "No saved expected summary.",
      observed: record.diagnostics?.observed ?? "No saved observed summary.",
      notes: Array.isArray(record.diagnostics?.notes) ? record.diagnostics.notes : [],
      first_cloud_time_seconds: record.diagnostics?.first_cloud_time_seconds ?? null,
      first_cloud_height_m: record.diagnostics?.first_cloud_height_m ?? null,
      max_cloud_liquid_water_kg_per_kg:
        record.diagnostics?.max_cloud_liquid_water_kg_per_kg ?? null,
      max_cloud_time_seconds: record.diagnostics?.max_cloud_time_seconds ?? null,
      cloud_top_height_m: record.diagnostics?.cloud_top_height_m ?? null,
      max_updraft_m_per_s: record.diagnostics?.max_updraft_m_per_s ?? null,
      first_rain_time_seconds: record.diagnostics?.first_rain_time_seconds ?? null,
      max_rain_water_kg_per_kg: record.diagnostics?.max_rain_water_kg_per_kg ?? null,
      estimated_lcl_m: record.diagnostics?.estimated_lcl_m ?? null,
      microphysics_total_water_drift_concerning:
        record.diagnostics?.microphysics_total_water_drift_concerning ?? null,
    },
    replay: {
      storage: "sampled_frames",
      total_frame_count: totalFrameCount,
      stored_frame_count: sampledFrames.length,
      sample_stride: record.replay?.sample_stride ?? 1,
      frames_truncated: record.replay?.frames_truncated ?? sampledFrames.length < totalFrameCount,
    },
    sampled_frames: sampledFrames,
  };
}

function defaultRunName(scenario: BuiltInScenario | null | undefined, timestamp: string): string {
  const prefix = scenario?.name ?? "Custom run";
  return `${prefix} ${timestamp.slice(0, 16).replace("T", " ")}`;
}

function runArtifactId(timestamp: string): string {
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `run-${timestamp}-${randomPart}`;
}

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import "./App.css";
import { MicrophysicsDiagnosticsPanel } from "./MicrophysicsDiagnosticsPanel";
import { ScientificDashboard } from "./ScientificDashboard";
import {
  BUILT_IN_SCENARIOS,
  BOUSSINESQ_MODEL_SIZES,
  CONTROL_LIMITS,
  HUMIDITY_PROFILES,
  SURFACE_HEATING_PATTERNS,
  celsiusToKelvin,
  configWarnings,
  kelvinToCelsius,
  updateConfigNumber,
  updateConfigValue,
} from "./simulationControls";
import type {
  SimulationConfig,
  SimulationFrame,
  SimulationPreset,
  SolverDescriptor,
} from "./simulationTypes";
import {
  deleteSavedScenario,
  loadSavedScenarios,
  persistSavedScenarios,
  saveNewScenario,
  updateSavedScenario,
} from "./savedScenarios";
import type { SavedScenario } from "./savedScenarios";
import { buildVerticalProfile } from "./sounding";
import type { VerticalProfile } from "./sounding";
import { displayUnit } from "./visualization";

type HealthState =
  | { status: "checking" }
  | { status: "online"; service: string; version: string }
  | { status: "offline"; message: string };

type SampleFrameState =
  | { status: "checking" }
  | {
      status: "ready";
      schemaVersion: string;
      columns: number;
      rows: number;
      fieldCount: number;
      units: string[];
    }
  | { status: "unavailable"; message: string };

type SampleRunState =
  | { status: "checking" }
  | {
      status: "ready";
      frameCount: number;
      finalTimeSeconds: number;
      maxCloudWater: number;
      maxUpdraft: number;
    }
  | { status: "unavailable"; message: string };

type PlaybackState = {
  status: "idle" | "starting" | "running" | "stopped" | "complete" | "error";
  runId: string | null;
  framesReceived: number;
  durationSeconds: number;
  currentTimeSeconds: number;
  frameRate: number;
  maxCloudWater: number;
  maxUpdraft: number;
  message: string | null;
};

const DEFAULT_VISUAL_FIELD = "cloud_liquid_water_kg_per_kg";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const websocketBaseUrl = apiBaseUrl.replace(/^http/, "ws");

async function fetchPresets(signal: AbortSignal): Promise<SimulationPreset[]> {
  const response = await fetch(`${apiBaseUrl}/simulations/presets`, { signal });
  if (!response.ok) {
    throw new Error(`Preset request returned HTTP ${response.status}`);
  }

  const payload = (await response.json()) as { presets?: SimulationPreset[] };
  return payload.presets ?? [];
}

async function fetchSolvers(signal: AbortSignal): Promise<SolverDescriptor[]> {
  const response = await fetch(`${apiBaseUrl}/simulations/solvers`, { signal });
  if (!response.ok) {
    throw new Error(`Solver request returned HTTP ${response.status}`);
  }

  const payload = (await response.json()) as { solvers?: SolverDescriptor[] };
  return payload.solvers ?? [];
}

async function fetchHealth(signal: AbortSignal): Promise<HealthState> {
  const response = await fetch(`${apiBaseUrl}/health`, { signal });

  if (!response.ok) {
    return { status: "offline", message: `Backend returned HTTP ${response.status}` };
  }

  const payload = (await response.json()) as { service?: string; version?: string };

  return {
    status: "online",
    service: payload.service ?? "Cloud Lab API",
    version: payload.version ?? "unknown",
  };
}

async function fetchSampleFrame(signal: AbortSignal): Promise<SampleFrameState> {
  const response = await fetch(`${apiBaseUrl}/simulations/sample-frame`, { signal });

  if (!response.ok) {
    return { status: "unavailable", message: `Sample frame returned HTTP ${response.status}` };
  }

  const payload = (await response.json()) as {
    schema_version?: string;
    grid?: { columns?: number; rows?: number };
    fields?: Record<string, { metadata?: { unit?: string } }>;
  };
  const fields = payload.fields ?? {};

  return {
    status: "ready",
    schemaVersion: payload.schema_version ?? "unknown",
    columns: payload.grid?.columns ?? 0,
    rows: payload.grid?.rows ?? 0,
    fieldCount: Object.keys(fields).length,
    units: Array.from(
      new Set(Object.values(fields).map((field) => displayUnit(field.metadata?.unit ?? "unitless"))),
    ),
  };
}

async function fetchSampleRun(signal: AbortSignal): Promise<SampleRunState> {
  const response = await fetch(`${apiBaseUrl}/simulations/sample-run`, { signal });

  if (!response.ok) {
    return { status: "unavailable", message: `Sample run returned HTTP ${response.status}` };
  }

  const payload = (await response.json()) as {
    frame_count?: number;
    frames?: Array<{
      time_seconds?: number;
      fields?: {
        cloud_liquid_water_kg_per_kg?: { values?: number[][] };
        vertical_velocity_m_per_s?: { values?: number[][] };
      };
    }>;
  };
  const frames = payload.frames ?? [];
  const finalFrame = frames.length > 0 ? frames[frames.length - 1] : undefined;

  return {
    status: "ready",
    frameCount: payload.frame_count ?? frames.length,
    finalTimeSeconds: finalFrame?.time_seconds ?? 0,
    maxCloudWater: maxGridValue(finalFrame?.fields?.cloud_liquid_water_kg_per_kg?.values ?? []),
    maxUpdraft: maxGridValue(finalFrame?.fields?.vertical_velocity_m_per_s?.values ?? []),
  };
}

export function App() {
  const [health, setHealth] = useState<HealthState>({ status: "checking" });
  const [sampleFrame, setSampleFrame] = useState<SampleFrameState>({ status: "checking" });
  const [sampleRun, setSampleRun] = useState<SampleRunState>({ status: "checking" });
  const [frames, setFrames] = useState<SimulationFrame[]>([]);
  const [displayedFrameIndex, setDisplayedFrameIndex] = useState(0);
  const [selectedField, setSelectedField] = useState(DEFAULT_VISUAL_FIELD);
  const [profileColumnIndex, setProfileColumnIndex] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [solvers, setSolvers] = useState<SolverDescriptor[]>([]);
  const [simulationConfig, setSimulationConfig] = useState<SimulationConfig | null>(null);
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);
  const [configMessage, setConfigMessage] = useState<string | null>(null);
  const [playback, setPlayback] = useState<PlaybackState>({
    status: "idle",
    runId: null,
    framesReceived: 0,
    durationSeconds: 0,
    currentTimeSeconds: 0,
    frameRate: 0,
    maxCloudWater: 0,
    maxUpdraft: 0,
    message: null,
  });
  const websocketRef = useRef<WebSocket | null>(null);
  const firstFrameAtRef = useRef<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetchHealth(controller.signal)
      .then(setHealth)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setHealth({
          status: "offline",
          message: "Backend is not reachable at the configured API URL.",
        });
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetchSolvers(controller.signal)
      .then(setSolvers)
      .catch((error: unknown) => {
        setConfigMessage(error instanceof Error ? error.message : "Unable to load solver catalog.");
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetchSampleFrame(controller.signal)
      .then(setSampleFrame)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setSampleFrame({
          status: "unavailable",
          message: "Sample frame schema is not reachable at the configured API URL.",
        });
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetchSampleRun(controller.signal)
      .then(setSampleRun)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setSampleRun({
          status: "unavailable",
          message: "Sample solver run is not reachable at the configured API URL.",
        });
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    return () => {
      websocketRef.current?.close();
    };
  }, []);

  useEffect(() => {
    setSavedScenarios(loadSavedScenarios());
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetchPresets(controller.signal)
      .then((loadedPresets) => {
        const defaultPreset = loadedPresets[0];
        if (defaultPreset) {
          setSimulationConfig(defaultPreset.config);
          setConfigMessage(null);
        }
      })
      .catch((error: unknown) => {
        setConfigMessage(
          error instanceof Error ? error.message : "Unable to load scenario defaults.",
        );
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (frames.length === 0 || isPaused) {
      return;
    }

    const interval = window.setInterval(
      () => {
        setDisplayedFrameIndex((currentIndex) => Math.min(frames.length - 1, currentIndex + 1));
      },
      Math.max(45, 240 / playbackSpeed),
    );

    return () => window.clearInterval(interval);
  }, [frames.length, isPaused, playbackSpeed]);

  async function startPlayback() {
    if (!simulationConfig) {
      setPlayback((current) => ({
        ...current,
        status: "error",
        message: "No simulation configuration is loaded.",
      }));
      return;
    }

    websocketRef.current?.close();
    firstFrameAtRef.current = null;
    setFrames([]);
    setDisplayedFrameIndex(0);
    setIsPaused(false);
    setPlayback({
      status: "starting",
      runId: null,
      framesReceived: 0,
      durationSeconds: 0,
      currentTimeSeconds: 0,
      frameRate: 0,
      maxCloudWater: 0,
      maxUpdraft: 0,
      message: null,
    });

    try {
      const response = await fetch(`${apiBaseUrl}/simulations/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(simulationConfig),
      });
      if (!response.ok) {
        throw new Error(`Start returned HTTP ${response.status}`);
      }

      const run = (await response.json()) as {
        run_id: string;
        duration_seconds?: number;
      };
      const websocket = new WebSocket(`${websocketBaseUrl}/simulations/runs/${run.run_id}/stream`);
      websocketRef.current = websocket;

      websocket.onmessage = (event: MessageEvent<string>) => {
        const message = JSON.parse(event.data) as StreamMessage;
        handleStreamMessage(message);
      };
      websocket.onerror = () => {
        setPlayback((current) => ({
          ...current,
          status: "error",
          message: "WebSocket stream failed.",
        }));
      };

      setPlayback((current) => ({
        ...current,
        status: "running",
        runId: run.run_id,
        durationSeconds: run.duration_seconds ?? current.durationSeconds,
      }));
    } catch (error) {
      setPlayback((current) => ({
        ...current,
        status: "error",
        message: error instanceof Error ? error.message : "Unable to start simulation.",
      }));
    }
  }

  async function stopPlayback() {
    if (playback.runId) {
      await fetch(`${apiBaseUrl}/simulations/runs/${playback.runId}/stop`, { method: "POST" });
    }
  }

  function resetPlayback() {
    websocketRef.current?.close();
    firstFrameAtRef.current = null;
    setFrames([]);
    setDisplayedFrameIndex(0);
    setIsPaused(false);
    setPlayback({
      status: "idle",
      runId: null,
      framesReceived: 0,
      durationSeconds: 0,
      currentTimeSeconds: 0,
      frameRate: 0,
      maxCloudWater: 0,
      maxUpdraft: 0,
      message: null,
    });
  }

  function saveScenario(name: string) {
    if (!simulationConfig) {
      return;
    }

    const nextScenarios = saveNewScenario(savedScenarios, name, simulationConfig);
    setSavedScenarios(nextScenarios);
    persistSavedScenarios(nextScenarios);
  }

  function updateScenario(scenarioId: string) {
    if (!simulationConfig) {
      return;
    }

    const nextScenarios = updateSavedScenario(savedScenarios, scenarioId, simulationConfig);
    setSavedScenarios(nextScenarios);
    persistSavedScenarios(nextScenarios);
  }

  function loadScenario(scenarioId: string) {
    const scenario = savedScenarios.find((candidate) => candidate.id === scenarioId);
    if (!scenario) {
      return;
    }

    setSimulationConfig(scenario.config);
    setConfigMessage(`Loaded saved experiment: ${scenario.name}`);
  }

  function deleteScenario(scenarioId: string) {
    const nextScenarios = deleteSavedScenario(savedScenarios, scenarioId);
    setSavedScenarios(nextScenarios);
    persistSavedScenarios(nextScenarios);
  }

  function handleStreamMessage(message: StreamMessage) {
    if (message.type === "metadata") {
      setPlayback((current) => ({
        ...current,
        durationSeconds: message.run.duration_seconds,
      }));
      return;
    }

    if (message.type === "frame") {
      const receivedAt = performance.now();
      if (firstFrameAtRef.current === null) {
        firstFrameAtRef.current = receivedAt;
      }

      setPlayback((current) => {
        const framesReceived = current.framesReceived + 1;
        const elapsedSeconds = Math.max(
          0.001,
          (receivedAt - (firstFrameAtRef.current ?? receivedAt)) / 1000,
        );

        return {
          ...current,
          status: "running",
          framesReceived,
          currentTimeSeconds: message.frame.time_seconds,
          frameRate: framesReceived / elapsedSeconds,
          maxCloudWater: maxGridValue(
            message.frame.fields.cloud_liquid_water_kg_per_kg.values,
          ),
          maxUpdraft: maxGridValue(message.frame.fields.vertical_velocity_m_per_s.values),
        };
      });
      setFrames((currentFrames) => {
        const nextFrames = [...currentFrames, message.frame];
        if (currentFrames.length === 0) {
          setDisplayedFrameIndex(0);
        }
        return nextFrames;
      });
      return;
    }

    if (message.type === "complete" || message.type === "stopped") {
      setPlayback((current) => ({
        ...current,
        status: message.type === "complete" ? "complete" : "stopped",
        currentTimeSeconds: message.run.last_frame_time_seconds,
        message: message.type === "complete" ? "Run complete." : "Run stopped cleanly.",
      }));
      websocketRef.current?.close();
      return;
    }

    if (message.type === "error") {
      setPlayback((current) => ({
        ...current,
        status: "error",
        message: message.message ?? "Simulation stream failed.",
      }));
    }
  }

  return (
    <main className="app-shell">
      <section className="intro" aria-labelledby="page-title">
        <p className="eyebrow">Local cloud physics sandbox</p>
        <h1 id="page-title">Cloud Lab</h1>
        <p className="lede">
          A disciplined browser workspace for fair-weather cumulus experiments, warm-cloud
          microphysics, and live 2-D vertical slice visualization.
        </p>
      </section>

      <section className="status-panel" aria-labelledby="status-title">
        <div>
          <p className="eyebrow">Backend</p>
          <h2 id="status-title">Connection status</h2>
        </div>

        <StatusBadge health={health} />
      </section>

      <section className="schema-panel" aria-labelledby="schema-title">
        <div>
          <p className="eyebrow">Frame schema</p>
          <h2 id="schema-title">Sample output</h2>
        </div>

        <SampleFrameSummary sampleFrame={sampleFrame} />
      </section>

      <section className="schema-panel" aria-labelledby="run-title">
        <div>
          <p className="eyebrow">Solver</p>
          <h2 id="run-title">Sample run</h2>
        </div>

        <SampleRunSummary sampleRun={sampleRun} />
      </section>

      <SimulationControls
        config={simulationConfig}
        solvers={solvers}
        savedScenarios={savedScenarios}
        message={configMessage}
        onConfigChange={setSimulationConfig}
        onSaveScenario={saveScenario}
        onUpdateScenario={updateScenario}
        onLoadScenario={loadScenario}
        onDeleteScenario={deleteScenario}
      />

      <section className="playback-panel" aria-labelledby="playback-title">
        <div>
          <p className="eyebrow">Live playback</p>
          <h2 id="playback-title">Simulation stream</h2>
        </div>

        <PlaybackControls
          playback={playback}
          canStart={simulationConfig !== null}
          onStart={startPlayback}
          onStop={stopPlayback}
          onReset={resetPlayback}
        />
      </section>

      <ScientificDashboard
        frame={frames[displayedFrameIndex] ?? null}
        framesReceived={frames.length}
        selectedField={selectedField}
        onSelectedFieldChange={setSelectedField}
        isPaused={isPaused}
        onPausedChange={setIsPaused}
        playbackSpeed={playbackSpeed}
        onPlaybackSpeedChange={setPlaybackSpeed}
        displayedFrameIndex={displayedFrameIndex}
        frameCount={frames.length}
        onScrub={(frameIndex) => {
          setIsPaused(true);
          setDisplayedFrameIndex(frameIndex);
        }}
        onPinnedColumnChange={setProfileColumnIndex}
      />

      <VerticalProfilePanel
        profile={buildVerticalProfile(
          frames[displayedFrameIndex] ?? null,
          simulationConfig,
          profileColumnIndex,
        )}
      />

      <MicrophysicsDiagnosticsPanel
        frames={frames}
        displayedFrame={frames[displayedFrameIndex] ?? null}
        config={simulationConfig}
      />
    </main>
  );
}

function StatusBadge({ health }: { health: HealthState }) {
  if (health.status === "checking") {
    return <p className="status checking">Checking /health...</p>;
  }

  if (health.status === "offline") {
    return <p className="status offline">Offline: {health.message}</p>;
  }

  return (
    <p className="status online">
      Online: {health.service} v{health.version}
    </p>
  );
}

function SampleFrameSummary({ sampleFrame }: { sampleFrame: SampleFrameState }) {
  if (sampleFrame.status === "checking") {
    return <p className="status checking">Checking sample frame...</p>;
  }

  if (sampleFrame.status === "unavailable") {
    return <p className="status offline">Unavailable: {sampleFrame.message}</p>;
  }

  return (
    <dl className="schema-summary">
      <div>
        <dt>Schema</dt>
        <dd>{sampleFrame.schemaVersion}</dd>
      </div>
      <div>
        <dt>Grid</dt>
        <dd>
          {sampleFrame.columns} x {sampleFrame.rows}
        </dd>
      </div>
      <div>
        <dt>Fields</dt>
        <dd>{sampleFrame.fieldCount}</dd>
      </div>
      <div>
        <dt>Units</dt>
        <dd>{sampleFrame.units.join(", ")}</dd>
      </div>
    </dl>
  );
}

function SampleRunSummary({ sampleRun }: { sampleRun: SampleRunState }) {
  if (sampleRun.status === "checking") {
    return <p className="status checking">Checking solver output...</p>;
  }

  if (sampleRun.status === "unavailable") {
    return <p className="status offline">Unavailable: {sampleRun.message}</p>;
  }

  return (
    <dl className="schema-summary">
      <div>
        <dt>Frames</dt>
        <dd>{sampleRun.frameCount}</dd>
      </div>
      <div>
        <dt>Final time</dt>
        <dd>{sampleRun.finalTimeSeconds.toFixed(0)} s</dd>
      </div>
      <div>
        <dt>Max cloud water</dt>
        <dd>{sampleRun.maxCloudWater.toExponential(2)}</dd>
      </div>
      <div>
        <dt>Max updraft</dt>
        <dd>{sampleRun.maxUpdraft.toFixed(3)} m/s</dd>
      </div>
    </dl>
  );
}

function maxGridValue(values: number[][]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce(
    (currentMax, row) => Math.max(currentMax, ...row),
    Number.NEGATIVE_INFINITY,
  );
}

function VerticalProfilePanel({ profile }: { profile: VerticalProfile | null }) {
  const selectedFields = [
    "temperature_k",
    "relative_humidity",
    "water_vapor_kg_per_kg",
    "cloud_liquid_water_kg_per_kg",
    "vertical_velocity_m_per_s",
  ];

  return (
    <section className="profile-panel" aria-labelledby="profile-title">
      <div className="profile-header">
        <div>
          <p className="eyebrow">Vertical structure</p>
          <h2 id="profile-title">Sounding / profile</h2>
        </div>
        <p className="profile-location">
          {profile
            ? profile.mode === "column"
              ? `Pinned x=${profile.xMeters?.toFixed(0)} m`
              : "Domain average"
            : "No frame"}
        </p>
      </div>

      {!profile ? (
        <p className="empty-profile">Start a run to inspect temperature, humidity, condensate, and vertical motion by height.</p>
      ) : (
        <>
          {profile.note ? <p className="control-note">{profile.note}</p> : null}
          <div className="profile-markers">
            {profile.markers.map((marker) => (
              <span key={marker.key}>
                {marker.label}: {marker.height_m.toFixed(0)} m
              </span>
            ))}
          </div>
          <div className="profile-table-wrap">
            <table className="profile-table">
              <thead>
                <tr>
                  <th>Height</th>
                  {selectedFields.map((fieldKey) => {
                    const field = profile.fields.find((candidate) => candidate.key === fieldKey);
                    return field ? (
                      <th key={field.key}>
                        {field.label} ({field.unit})
                      </th>
                    ) : null;
                  })}
                </tr>
              </thead>
              <tbody>
                {profile.points
                  .slice()
                  .reverse()
                  .map((point) => (
                    <tr key={point.height_m}>
                      <td>{point.height_m.toFixed(0)} m</td>
                      {selectedFields.map((fieldKey) => {
                        const field = profile.fields.find((candidate) => candidate.key === fieldKey);
                        if (!field) {
                          return null;
                        }
                        return <td key={field.key}>{formatProfileValue(point.values[field.key])}</td>;
                      })}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function formatProfileValue(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "n/a";
  }
  if (Math.abs(value) >= 100) {
    return value.toFixed(0);
  }
  if (Math.abs(value) >= 1) {
    return value.toFixed(2);
  }
  return value.toExponential(2);
}

function SimulationControls({
  config,
  solvers,
  savedScenarios,
  message,
  onConfigChange,
  onSaveScenario,
  onUpdateScenario,
  onLoadScenario,
  onDeleteScenario,
}: {
  config: SimulationConfig | null;
  solvers: SolverDescriptor[];
  savedScenarios: SavedScenario[];
  message: string | null;
  onConfigChange: (config: SimulationConfig) => void;
  onSaveScenario: (name: string) => void;
  onUpdateScenario: (scenarioId: string) => void;
  onLoadScenario: (scenarioId: string) => void;
  onDeleteScenario: (scenarioId: string) => void;
}) {
  const [selectedReferenceCase, setSelectedReferenceCase] = useState(
    "fair-weather-moderate-base",
  );
  const [selectedModelSize, setSelectedModelSize] = useState("medium");
  const [selectedSavedScenario, setSelectedSavedScenario] = useState("");
  const [saveScenarioName, setSaveScenarioName] = useState("");

  if (!config) {
    return (
      <section className="controls-panel" aria-labelledby="controls-title">
        <div>
          <p className="eyebrow">Simulation setup</p>
          <h2 id="controls-title">Controls</h2>
        </div>
        <p className="status checking">Loading scenario defaults...</p>
      </section>
    );
  }

  const warnings = configWarnings(config);

  function update(path: string, value: number) {
    if (!config) {
      return;
    }
    onConfigChange(updateConfigNumber(config, path, value));
  }

  function updateValue(path: string, value: string) {
    if (!config) {
      return;
    }
    onConfigChange(updateConfigValue(config, path, value));
  }

  function applyReferenceCase(referenceSlug: string) {
    if (!config) {
      return;
    }

    setSelectedReferenceCase(referenceSlug);
    const referenceCase = BUILT_IN_SCENARIOS.find((candidate) => {
      return candidate.slug === referenceSlug;
    });
    if (referenceCase) {
      onConfigChange(referenceCase.apply(config));
    }
  }

  function loadSavedScenario(scenarioId: string) {
    setSelectedSavedScenario(scenarioId);
    setSelectedReferenceCase("");
    if (scenarioId) {
      onLoadScenario(scenarioId);
    }
  }

  function applyModelSize(sizeSlug: string) {
    if (!config) {
      return;
    }

    setSelectedModelSize(sizeSlug);
    const modelSize = BOUSSINESQ_MODEL_SIZES.find((candidate) => candidate.slug === sizeSlug);
    if (modelSize) {
      onConfigChange(modelSize.apply(config));
    }
  }

  const activeSolver = solvers.find((solver) => solver.solver_type === config.solver_type);
  const activeReferenceCase = BUILT_IN_SCENARIOS.find((candidate) => {
    return candidate.slug === selectedReferenceCase;
  });
  const activeModelSize = BOUSSINESQ_MODEL_SIZES.find((candidate) => {
    return candidate.slug === selectedModelSize;
  });
  const heatingPattern = config.surface_heating.pattern ?? "single_patch";
  const humidityProfile = config.initial_atmosphere.humidity_profile ?? "uniform";
  const showHeatingCenter = heatingPattern === "single_patch" || heatingPattern === "custom_patches";
  const showHeatingWidth = heatingPattern !== "weak_random";

  return (
    <section className="controls-panel" aria-labelledby="controls-title">
      <div className="controls-header">
        <div>
          <p className="eyebrow">Simulation setup</p>
          <h2 id="controls-title">Initial conditions</h2>
        </div>

        <div className="setup-selects">
          <label className="preset-select">
            Scenario
            <select
              value={selectedReferenceCase}
              onChange={(event) => applyReferenceCase(event.target.value)}
            >
              <option value="">Custom controls</option>
              {BUILT_IN_SCENARIOS.map((referenceCase) => (
                <option key={referenceCase.slug} value={referenceCase.slug}>
                  {referenceCase.name}
                </option>
              ))}
            </select>
          </label>

          <label className="preset-select">
            Model size
            <select value={selectedModelSize} onChange={(event) => applyModelSize(event.target.value)}>
              {BOUSSINESQ_MODEL_SIZES.map((modelSize) => (
                <option key={modelSize.slug} value={modelSize.slug}>
                  {modelSize.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="controls-grid">
        <ControlGroup title="Scenario">
          <p className="control-note">
            {activeReferenceCase?.description ?? "Custom editable Boussinesq scenario."}
          </p>
          {activeReferenceCase ? (
            <>
              <p className="control-note">{activeReferenceCase.intendedPhenomenon}</p>
              <dl className="scenario-metadata">
                <div>
                  <dt>Category</dt>
                  <dd>{activeReferenceCase.category}</dd>
                </div>
                <div>
                  <dt>Thermodynamics</dt>
                  <dd>{activeReferenceCase.thermodynamicAssumptions}</dd>
                </div>
                <div>
                  <dt>Forcing</dt>
                  <dd>{activeReferenceCase.forcingSetup}</dd>
                </div>
                <div>
                  <dt>Expected</dt>
                  <dd>{activeReferenceCase.expectedOutcome}</dd>
                </div>
              </dl>
            </>
          ) : null}
          {activeModelSize ? <p className="control-note">{activeModelSize.description}</p> : null}
          <p className="control-note">
            Solver: {activeSolver?.name ?? "Boussinesq 2-D"}
          </p>
          {activeSolver?.limitations.length ? (
            <ul className="control-note-list">
              {activeSolver.limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          ) : null}
        </ControlGroup>

        <ControlGroup title="Saved experiments">
          <label className="select-control">
            <span>Saved scenario</span>
            <select
              value={selectedSavedScenario}
              onChange={(event) => loadSavedScenario(event.target.value)}
            >
              <option value="">No saved experiment selected</option>
              {savedScenarios.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-control">
            <span>Experiment name</span>
            <input
              type="text"
              value={saveScenarioName}
              placeholder="e.g. two patches, higher cap"
              onChange={(event) => setSaveScenarioName(event.target.value)}
            />
          </label>
          <div className="button-row compact">
            <button
              type="button"
              onClick={() => {
                onSaveScenario(saveScenarioName);
                setSaveScenarioName("");
              }}
            >
              Save copy
            </button>
            <button
              type="button"
              disabled={!selectedSavedScenario}
              onClick={() => onUpdateScenario(selectedSavedScenario)}
            >
              Update
            </button>
            <button
              type="button"
              disabled={!selectedSavedScenario}
              onClick={() => {
                onDeleteScenario(selectedSavedScenario);
                setSelectedSavedScenario("");
              }}
            >
              Delete
            </button>
          </div>
          <p className="control-note">
            Built-in scenarios stay read-only; saved experiments live in this browser.
          </p>
        </ControlGroup>

        <ControlGroup title="Thermodynamics">
          <NumberControl
            label="Surface temperature"
            unit="deg C"
            value={kelvinToCelsius(config.initial_atmosphere.surface_temperature_k)}
            limits={CONTROL_LIMITS.surfaceTemperatureC}
            onChange={(value) =>
              update("initial_atmosphere.surface_temperature_k", celsiusToKelvin(value))
            }
          />
          <NumberControl
            label="Lapse rate"
            unit="K/m"
            value={config.initial_atmosphere.lapse_rate_k_per_m}
            limits={CONTROL_LIMITS.lapseRate}
            onChange={(value) => update("initial_atmosphere.lapse_rate_k_per_m", value)}
          />
          <NumberControl
            label="BL / inversion top"
            unit="m"
            value={config.initial_atmosphere.boundary_layer_depth_m}
            limits={{
              ...CONTROL_LIMITS.boundaryLayerDepth,
              max: config.domain.height_m,
            }}
            onChange={(value) => update("initial_atmosphere.boundary_layer_depth_m", value)}
          />
          <NumberControl
            label="Surface RH"
            unit="fraction"
            value={config.initial_atmosphere.relative_humidity}
            limits={CONTROL_LIMITS.relativeHumidity}
            onChange={(value) => update("initial_atmosphere.relative_humidity", value)}
          />
        </ControlGroup>

        <ControlGroup title="Moisture structure">
          <SelectControl
            label="Humidity pattern"
            value={humidityProfile}
            options={HUMIDITY_PROFILES}
            onChange={(value) => updateValue("initial_atmosphere.humidity_profile", value)}
          />
          <p className="control-note">
            {HUMIDITY_PROFILES.find((profile) => profile.value === humidityProfile)?.description}
          </p>
          <NumberControl
            label="Moist source depth"
            unit="m"
            value={config.initial_atmosphere.moist_source_layer_depth_m ?? 500}
            limits={{
              ...CONTROL_LIMITS.moistSourceLayerDepth,
              max: Math.min(
                config.initial_atmosphere.boundary_layer_depth_m,
                config.domain.height_m,
              ),
            }}
            onChange={(value) => update("initial_atmosphere.moist_source_layer_depth_m", value)}
          />
          <NumberControl
            label="Free-air RH"
            unit="fraction"
            value={config.initial_atmosphere.free_atmosphere_relative_humidity ?? 0.55}
            limits={CONTROL_LIMITS.relativeHumidity}
            onChange={(value) =>
              update("initial_atmosphere.free_atmosphere_relative_humidity", value)
            }
          />
        </ControlGroup>

        <ControlGroup title="Surface forcing">
          <SelectControl
            label="Heating pattern"
            value={heatingPattern}
            options={SURFACE_HEATING_PATTERNS}
            onChange={(value) => updateValue("surface_heating.pattern", value)}
          />
          <p className="control-note">
            {SURFACE_HEATING_PATTERNS.find((pattern) => pattern.value === heatingPattern)?.description}
          </p>
          <NumberControl
            label="Heating rate"
            unit="K/s"
            value={config.surface_heating.max_warming_rate_k_per_s}
            limits={CONTROL_LIMITS.surfaceHeatingRate}
            onChange={(value) => update("surface_heating.max_warming_rate_k_per_s", value)}
          />
          {showHeatingWidth ? (
            <NumberControl
              label="Patch width"
              unit="m"
              value={config.surface_heating.patch_width_m}
              limits={{
                ...CONTROL_LIMITS.heatingWidth,
                max: config.domain.width_m,
              }}
              onChange={(value) => update("surface_heating.patch_width_m", value)}
            />
          ) : null}
          {showHeatingCenter ? (
            <NumberControl
              label="Patch center"
              unit="m"
              value={config.surface_heating.patch_center_x_m}
              limits={{
                ...CONTROL_LIMITS.heatingCenter,
                max: config.domain.width_m,
              }}
              onChange={(value) => update("surface_heating.patch_center_x_m", value)}
            />
          ) : null}
        </ControlGroup>

        <ControlGroup title="Domain and grid">
          <NumberControl
            label="Domain width"
            unit="m"
            value={config.domain.width_m}
            limits={CONTROL_LIMITS.domainWidth}
            onChange={(value) => update("domain.width_m", value)}
          />
          <NumberControl
            label="Domain height"
            unit="m"
            value={config.domain.height_m}
            limits={CONTROL_LIMITS.domainHeight}
            onChange={(value) => update("domain.height_m", value)}
          />
          <NumberControl
            label="Grid columns"
            unit="cells"
            value={config.grid.columns}
            limits={CONTROL_LIMITS.gridColumns}
            onChange={(value) => update("grid.columns", value)}
          />
          <NumberControl
            label="Grid rows"
            unit="cells"
            value={config.grid.rows}
            limits={CONTROL_LIMITS.gridRows}
            onChange={(value) => update("grid.rows", value)}
          />
        </ControlGroup>

        <ControlGroup title="Time and output">
          <NumberControl
            label="Runtime"
            unit="s"
            value={config.time.duration_seconds}
            limits={CONTROL_LIMITS.duration}
            onChange={(value) => update("time.duration_seconds", value)}
          />
          <NumberControl
            label="Timestep"
            unit="s"
            value={config.time.time_step_seconds}
            limits={CONTROL_LIMITS.timeStep}
            onChange={(value) => update("time.time_step_seconds", value)}
          />
          <NumberControl
            label="Frame cadence"
            unit="s"
            value={config.time.frame_interval_seconds}
            limits={CONTROL_LIMITS.frameInterval}
            onChange={(value) => update("time.frame_interval_seconds", value)}
          />
        </ControlGroup>

        <ControlGroup title="Wind and reproducibility">
          <NumberControl
            label="Background wind"
            unit="m/s"
            value={config.background_wind.u_m_per_s}
            limits={CONTROL_LIMITS.wind}
            onChange={(value) => update("background_wind.u_m_per_s", value)}
          />
          <NumberControl
            label="Vertical wind / lift"
            unit="m/s"
            value={config.background_wind.w_m_per_s}
            limits={CONTROL_LIMITS.wind}
            onChange={(value) => update("background_wind.w_m_per_s", value)}
          />
          <NumberControl
            label="Random seed"
            unit="seed"
            value={config.seed}
            limits={CONTROL_LIMITS.seed}
            onChange={(value) => update("seed", value)}
          />
        </ControlGroup>
      </div>

      <div className="control-guidance" aria-live="polite">
        {message ? <p>{message}</p> : null}
        {warnings.length > 0 ? (
          <ul>
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : (
          <p>Configuration is within the current local playback guidance.</p>
        )}
      </div>
    </section>
  );
}

type ControlLimits = {
  min: number;
  max: number;
  step: number;
};

type SelectOption = {
  value: string;
  label: string;
  description?: string;
};

function ControlGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="control-group">
      <legend>{title}</legend>
      {children}
    </fieldset>
  );
}

function NumberControl({
  label,
  unit,
  value,
  limits,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  limits: ControlLimits;
  onChange: (value: number) => void;
}) {
  const displayValue = limits.step < 0.01 ? value.toFixed(4) : value.toString();

  return (
    <label className="number-control">
      <span>
        {label}
        <strong>{unit}</strong>
      </span>
      <input
        type="range"
        min={limits.min}
        max={limits.max}
        step={limits.step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <input
        type="number"
        min={limits.min}
        max={limits.max}
        step={limits.step}
        value={displayValue}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function SelectControl({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="select-control">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

type StreamMessage =
  | {
      type: "metadata" | "complete" | "stopped";
      run: {
        duration_seconds: number;
        last_frame_time_seconds: number;
      };
    }
  | {
      type: "frame";
      frame: SimulationFrame;
    }
  | { type: "error"; message?: string };

function PlaybackControls({
  playback,
  canStart,
  onStart,
  onStop,
  onReset,
}: {
  playback: PlaybackState;
  canStart: boolean;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
}) {
  const progress =
    playback.durationSeconds > 0
      ? Math.min(100, (playback.currentTimeSeconds / playback.durationSeconds) * 100)
      : 0;
  const isActive = playback.status === "starting" || playback.status === "running";

  return (
    <div className="playback-controls">
      <div className="button-row">
        <button type="button" onClick={onStart} disabled={isActive || !canStart}>
          Start
        </button>
        <button type="button" onClick={onStop} disabled={playback.status !== "running"}>
          Stop
        </button>
        <button type="button" onClick={onReset}>
          Reset
        </button>
      </div>

      <div className="timeline" aria-label="Simulation playback progress">
        <div style={{ width: `${progress}%` }} />
      </div>

      <dl className="playback-stats">
        <div>
          <dt>Status</dt>
          <dd>{playback.status}</dd>
        </div>
        <div>
          <dt>Frames</dt>
          <dd>{playback.framesReceived}</dd>
        </div>
        <div>
          <dt>Progress</dt>
          <dd>{progress.toFixed(0)}%</dd>
        </div>
        <div>
          <dt>Frame rate</dt>
          <dd>{playback.frameRate.toFixed(1)} fps</dd>
        </div>
        <div>
          <dt>Cloud water</dt>
          <dd>{playback.maxCloudWater.toExponential(2)}</dd>
        </div>
        <div>
          <dt>Updraft</dt>
          <dd>{playback.maxUpdraft.toFixed(3)} m/s</dd>
        </div>
      </dl>

      {playback.message ? <p className="playback-message">{playback.message}</p> : null}
    </div>
  );
}

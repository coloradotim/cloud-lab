import { useEffect, useMemo, useRef, useState } from "react";
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
  controlPresentationsFor,
  configWarnings,
  kelvinToCelsius,
  updateConfigNumber,
  updateConfigValue,
} from "./simulationControls";
import type { ControlKey, ControlPresentation } from "./simulationControls";
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
import { replayEventTargets, replayStatus } from "./replay";
import { evaluateScenarioRun } from "./scenarioDiagnostics";
import type { ScenarioDiagnostics } from "./scenarioDiagnostics";
import type { ProbeResult } from "./probe";
import { buildVerticalProfile } from "./sounding";
import type { VerticalProfile } from "./sounding";
import { displayUnit, truthMetadataForSolver } from "./visualization";

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

type InspectorTab = "profile" | "probe" | "diagnostics" | "microphysics";

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
  const [selectedScenarioSlug, setSelectedScenarioSlug] = useState(
    "fair-weather-moderate-base",
  );
  const [isSetupOpen, setIsSetupOpen] = useState(true);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("diagnostics");
  const [activeProbe, setActiveProbe] = useState<ProbeResult | null>(null);
  const [isProbePinned, setIsProbePinned] = useState(false);
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
  const replayEvents = useMemo(() => replayEventTargets(frames), [frames]);
  const currentReplayStatus = replayStatus(playback.status, frames.length, displayedFrameIndex);
  const activeScenario = useMemo(
    () =>
      BUILT_IN_SCENARIOS.find((candidate) => candidate.slug === selectedScenarioSlug) ?? null,
    [selectedScenarioSlug],
  );
  const scenarioDiagnostics = useMemo(
    () =>
      evaluateScenarioRun({
        scenario: activeScenario,
        config: simulationConfig,
        frames,
      }),
    [activeScenario, simulationConfig, frames],
  );

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

  useEffect(() => {
    if (isProbePinned) {
      setIsInspectorOpen(true);
      setInspectorTab("probe");
    }
  }, [isProbePinned]);

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
    setProfileColumnIndex(null);
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

  function applySimulationConfig(nextConfig: SimulationConfig) {
    resetPlayback();
    setSelectedField(DEFAULT_VISUAL_FIELD);
    setSimulationConfig(nextConfig);
  }

  function applyBuiltInScenario(referenceSlug: string) {
    setSelectedScenarioSlug(referenceSlug);
    const referenceCase = BUILT_IN_SCENARIOS.find((candidate) => {
      return candidate.slug === referenceSlug;
    });
    if (referenceCase && simulationConfig) {
      applySimulationConfig(referenceCase.apply(simulationConfig));
      setConfigMessage(null);
    }
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

    applySimulationConfig(scenario.config);
    setSelectedScenarioSlug("");
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

      <TopActionBar
        selectedScenarioSlug={selectedScenarioSlug}
        playback={playback}
        canStart={simulationConfig !== null}
        isSetupOpen={isSetupOpen}
        isInspectorOpen={isInspectorOpen}
        hasPinnedInspectorContext={profileColumnIndex !== null || isProbePinned}
        onScenarioChange={applyBuiltInScenario}
        onSetupToggle={() => setIsSetupOpen((current) => !current)}
        onInspectorToggle={() => setIsInspectorOpen((current) => !current)}
        onStart={startPlayback}
        onStop={stopPlayback}
        onReset={resetPlayback}
      />

      <section
        className={`workbench-shell${isSetupOpen ? " setup-open" : ""}${
          isInspectorOpen ? " inspector-open" : ""
        }`}
        aria-label="Cloud Lab workbench"
      >
        {isSetupOpen ? (
          <aside className="workbench-setup" aria-label="Simulation setup">
            <SimulationControls
              config={simulationConfig}
              solvers={solvers}
              savedScenarios={savedScenarios}
              selectedReferenceCase={selectedScenarioSlug}
              message={configMessage}
              onConfigChange={applySimulationConfig}
              onSelectedReferenceCaseChange={applyBuiltInScenario}
              onSaveScenario={saveScenario}
              onUpdateScenario={updateScenario}
              onLoadScenario={loadScenario}
              onDeleteScenario={deleteScenario}
            />
          </aside>
        ) : null}

        <section className="workbench-stage" aria-label="Visualization workbench">
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
            finalTimeSeconds={
              playback.durationSeconds || (frames.length > 0 ? frames[frames.length - 1].time_seconds : 0)
            }
            replayStatus={currentReplayStatus}
            eventTargets={replayEvents}
            onProbeChange={(probe, isPinned) => {
              setActiveProbe(probe);
              setIsProbePinned(isPinned);
            }}
            onScrub={(frameIndex) => {
              setIsPaused(true);
              setDisplayedFrameIndex(frameIndex);
            }}
            onPinnedColumnChange={setProfileColumnIndex}
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
        </section>

        {isInspectorOpen ? (
          <aside className="workbench-inspector" aria-label="Simulation inspector">
            <InspectorTabs
              activeTab={inspectorTab}
              onActiveTabChange={setInspectorTab}
              probe={activeProbe}
              isProbePinned={isProbePinned}
              diagnostics={scenarioDiagnostics}
              profile={buildVerticalProfile(
                frames[displayedFrameIndex] ?? null,
                simulationConfig,
                profileColumnIndex,
              )}
              frames={frames}
              displayedFrame={frames[displayedFrameIndex] ?? null}
              config={simulationConfig}
            />
          </aside>
        ) : null}
      </section>

      <section className="developer-strip" aria-label="Developer status">
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
      </section>
    </main>
  );
}

function InspectorTabs({
  activeTab,
  onActiveTabChange,
  probe,
  isProbePinned,
  diagnostics,
  profile,
  frames,
  displayedFrame,
  config,
}: {
  activeTab: InspectorTab;
  onActiveTabChange: (tab: InspectorTab) => void;
  probe: ProbeResult | null;
  isProbePinned: boolean;
  diagnostics: ScenarioDiagnostics;
  profile: VerticalProfile | null;
  frames: SimulationFrame[];
  displayedFrame: SimulationFrame | null;
  config: SimulationConfig | null;
}) {
  const tabs: Array<{ key: InspectorTab; label: string; attention?: boolean }> = [
    { key: "profile", label: "Profile" },
    { key: "probe", label: "Probe", attention: isProbePinned },
    { key: "diagnostics", label: "Diagnostics" },
    { key: "microphysics", label: "Microphysics" },
  ];

  return (
    <section className="inspector-panel" aria-labelledby="inspector-title">
      <div className="inspector-header">
        <div>
          <p className="eyebrow">Inspector</p>
          <h2 id="inspector-title">Analysis views</h2>
        </div>
      </div>
      <div className="inspector-tabs" role="tablist" aria-label="Inspector views">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className={tab.attention ? "tab-has-attention" : undefined}
            onClick={() => onActiveTabChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="inspector-tab-panel">
        {activeTab === "profile" ? <VerticalProfilePanel profile={profile} /> : null}
        {activeTab === "probe" ? (
          <ProbeInspectorPanel probe={probe} isPinned={isProbePinned} />
        ) : null}
        {activeTab === "diagnostics" ? (
          <ScenarioDiagnosticsPanel diagnostics={diagnostics} />
        ) : null}
        {activeTab === "microphysics" ? (
          <MicrophysicsDiagnosticsPanel
            frames={frames}
            displayedFrame={displayedFrame}
            config={config}
          />
        ) : null}
      </div>
    </section>
  );
}

function ProbeInspectorPanel({
  probe,
  isPinned,
}: {
  probe: ProbeResult | null;
  isPinned: boolean;
}) {
  return (
    <section className="probe-panel" aria-labelledby="probe-inspector-title">
      <div className="profile-header">
        <div>
          <p className="eyebrow">Probe</p>
          <h2 id="probe-inspector-title">{isPinned ? "Pinned probe" : "Hover probe"}</h2>
        </div>
        <p className="profile-location">
          {probe ? `x=${probe.xMeters.toFixed(0)} m, z=${probe.zMeters.toFixed(0)} m` : "No probe"}
        </p>
      </div>
      {!probe ? (
        <p className="empty-profile">Hover the canvas, or click a cell to pin probe diagnostics here.</p>
      ) : (
        <>
          <p className="control-note">
            {isPinned ? "Pinned cell" : "Hovered cell"} using{" "}
            {probe.mode === "point" ? "point sampling" : "3x3 neighborhood mean"}.
          </p>
          <div className="probe-diagnostics" aria-label="Probe diagnostics">
            {probe.diagnostics.map((diagnostic) => (
              <div key={diagnostic.key}>
                <span>
                  {diagnostic.label}
                  <em
                    className={`truth-badge truth-${diagnostic.truth.category}`}
                    title={`${diagnostic.truth.explanation}${diagnostic.truth.limitations ? ` ${diagnostic.truth.limitations}` : ""}`}
                  >
                    {diagnostic.truth.label}
                  </em>
                </span>
                <strong>
                  {diagnostic.formattedValue}
                  {diagnostic.unit ? ` ${diagnostic.unit}` : ""}
                </strong>
                {diagnostic.note ? <small>{diagnostic.note}</small> : null}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function TopActionBar({
  selectedScenarioSlug,
  playback,
  canStart,
  isSetupOpen,
  isInspectorOpen,
  hasPinnedInspectorContext,
  onScenarioChange,
  onSetupToggle,
  onInspectorToggle,
  onStart,
  onStop,
  onReset,
}: {
  selectedScenarioSlug: string;
  playback: PlaybackState;
  canStart: boolean;
  isSetupOpen: boolean;
  isInspectorOpen: boolean;
  hasPinnedInspectorContext: boolean;
  onScenarioChange: (scenarioSlug: string) => void;
  onSetupToggle: () => void;
  onInspectorToggle: () => void;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
}) {
  const isActive = playback.status === "starting" || playback.status === "running";
  const progress =
    playback.durationSeconds > 0
      ? Math.min(100, (playback.currentTimeSeconds / playback.durationSeconds) * 100)
      : 0;

  return (
    <section className="top-action-bar" aria-label="Primary simulation actions">
      <label className="top-scenario-select">
        <span>Scenario</span>
        <select
          value={selectedScenarioSlug}
          onChange={(event) => onScenarioChange(event.target.value)}
        >
          <option value="">Custom controls</option>
          {BUILT_IN_SCENARIOS.map((scenario) => (
            <option key={scenario.slug} value={scenario.slug}>
              {scenario.name}
            </option>
          ))}
        </select>
      </label>

      <div className="top-action-buttons">
        <button type="button" onClick={onSetupToggle} aria-pressed={isSetupOpen}>
          {isSetupOpen ? "Hide setup" : "Setup"}
        </button>
        <button type="button" onClick={onStart} disabled={isActive || !canStart}>
          Start
        </button>
        <button type="button" onClick={onStop} disabled={playback.status !== "running"}>
          Stop
        </button>
        <button type="button" onClick={onReset}>
          Reset
        </button>
        <button
          type="button"
          onClick={onInspectorToggle}
          aria-pressed={isInspectorOpen}
          className={hasPinnedInspectorContext ? "has-inspector-context" : undefined}
        >
          {isInspectorOpen ? "Hide inspector" : "Inspector"}
        </button>
      </div>

      <div className="top-run-status" aria-live="polite">
        <span className={`run-status-dot run-status-${playback.status}`} />
        <span>{playback.status}</span>
        <strong>{progress.toFixed(0)}%</strong>
      </div>
    </section>
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
              <span
                key={marker.key}
                title="Derived diagnostic from configuration and sounding assumptions."
              >
                {marker.label}: {marker.height_m.toFixed(0)} m
                <em>Derived diagnostic</em>
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
                        <span
                          className={`truth-badge truth-${field.truth.category}`}
                          title={`${field.truth.explanation}${field.truth.limitations ? ` ${field.truth.limitations}` : ""}`}
                        >
                          {field.truth.label}
                        </span>
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

function ScenarioDiagnosticsPanel({
  diagnostics,
}: {
  diagnostics: ScenarioDiagnostics;
}) {
  return (
    <section className="scenario-diagnostics-panel" aria-labelledby="scenario-diagnostics-title">
      <div className="scenario-diagnostics-header">
        <div>
          <p className="eyebrow">Scenario check</p>
          <h2 id="scenario-diagnostics-title">Expected vs observed</h2>
        </div>
        <span className={`scenario-status scenario-status-${diagnostics.status}`}>
          {diagnostics.statusLabel}
        </span>
      </div>
      <div className="scenario-diagnostics-grid">
        <div>
          <h3>Expected</h3>
          <p>{diagnostics.expected}</p>
        </div>
        <div>
          <h3>Observed</h3>
          <p>{diagnostics.observed}</p>
        </div>
        <div>
          <h3>Notes</h3>
          <ul>
            {diagnostics.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      </div>
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
  selectedReferenceCase,
  message,
  onConfigChange,
  onSelectedReferenceCaseChange,
  onSaveScenario,
  onUpdateScenario,
  onLoadScenario,
  onDeleteScenario,
}: {
  config: SimulationConfig | null;
  solvers: SolverDescriptor[];
  savedScenarios: SavedScenario[];
  selectedReferenceCase: string;
  message: string | null;
  onConfigChange: (config: SimulationConfig) => void;
  onSelectedReferenceCaseChange: (scenarioSlug: string) => void;
  onSaveScenario: (name: string) => void;
  onUpdateScenario: (scenarioId: string) => void;
  onLoadScenario: (scenarioId: string) => void;
  onDeleteScenario: (scenarioId: string) => void;
}) {
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

    onSelectedReferenceCaseChange(referenceSlug);
  }

  function loadSavedScenario(scenarioId: string) {
    setSelectedSavedScenario(scenarioId);
    onSelectedReferenceCaseChange("");
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
  const activeSolverTruth = truthMetadataForSolver(config.solver_type);
  const activeReferenceCase = BUILT_IN_SCENARIOS.find((candidate) => {
    return candidate.slug === selectedReferenceCase;
  });
  const activeModelSize = BOUSSINESQ_MODEL_SIZES.find((candidate) => {
    return candidate.slug === selectedModelSize;
  });
  const controlPresentations = controlPresentationsFor(config, activeReferenceCase);
  const controlFor = (key: ControlKey) => {
    return controlPresentations.find((control) => control.key === key);
  };
  const hasVisibleControls = (keys: ControlKey[]) => {
    return keys.some((key) => {
      const control = controlFor(key);
      return control && control.state !== "hidden" && control.state !== "legacy";
    });
  };
  const basicControl = (key: ControlKey) => controlFor(key);
  const advancedControl = (key: ControlKey) => controlFor(key);
  const heatingPattern = config.surface_heating.pattern ?? "single_patch";
  const humidityProfile = config.initial_atmosphere.humidity_profile ?? "surface_moisture";
  const hasAdvancedControls = controlPresentations.some((control) => {
    return control.state === "advanced" || control.state === "disabled";
  });

  return (
    <section className="controls-panel" aria-labelledby="controls-title">
      <div className="controls-header">
        <div>
          <p className="eyebrow">Simulation setup</p>
          <h2 id="controls-title">Initial conditions</h2>
        </div>

        <div className="setup-selects">
          <label className="preset-select">
            {basicControl("scenario")?.label ?? "Scenario"}
            <select
              value={selectedReferenceCase}
              onChange={(event) => applyReferenceCase(event.target.value)}
              title={basicControl("scenario")?.shortHelp}
            >
              <option value="">Custom controls</option>
              {BUILT_IN_SCENARIOS.map((referenceCase) => (
                <option key={referenceCase.slug} value={referenceCase.slug}>
                  {referenceCase.name}
                </option>
              ))}
            </select>
          </label>

          {basicControl("model_size")?.state !== "hidden" ? (
            <label className="preset-select">
              {basicControl("model_size")?.label ?? "Model size"}
              <select
                value={selectedModelSize}
                disabled={basicControl("model_size")?.state === "disabled"}
                onChange={(event) => applyModelSize(event.target.value)}
                title={
                  basicControl("model_size")?.disabledReason ??
                  basicControl("model_size")?.shortHelp
                }
              >
                {BOUSSINESQ_MODEL_SIZES.map((modelSize) => (
                  <option key={modelSize.slug} value={modelSize.slug}>
                    {modelSize.name}
                  </option>
                ))}
              </select>
              {basicControl("model_size")?.disabledReason ? (
                <small>{basicControl("model_size")?.disabledReason}</small>
              ) : null}
            </label>
          ) : null}
        </div>
      </div>

      <p className="control-note changes-note">Changes reset playback and apply to the next run.</p>

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
            <span
              className={`truth-badge truth-${activeSolverTruth.category}`}
              title={`${activeSolverTruth.explanation}${activeSolverTruth.limitations ? ` ${activeSolverTruth.limitations}` : ""}`}
            >
              {activeSolverTruth.label}
            </span>
          </p>
          {activeSolver?.limitations.length ? (
            <ul className="control-note-list">
              {activeSolver.limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          ) : null}
        </ControlGroup>

        <ControlGroup title="Thermodynamics">
          {renderNumberControl(basicControl("surface_temperature"), {
            value: kelvinToCelsius(config.initial_atmosphere.surface_temperature_k),
            limits: CONTROL_LIMITS.surfaceTemperatureC,
            onChange: (value) =>
              update("initial_atmosphere.surface_temperature_k", celsiusToKelvin(value)),
          })}
          {renderNumberControl(basicControl("lapse_rate"), {
            value: config.initial_atmosphere.lapse_rate_k_per_m,
            limits: CONTROL_LIMITS.lapseRate,
            onChange: (value) => update("initial_atmosphere.lapse_rate_k_per_m", value),
          })}
          {renderNumberControl(basicControl("boundary_layer_depth"), {
            value: config.initial_atmosphere.boundary_layer_depth_m,
            limits: {
              ...CONTROL_LIMITS.boundaryLayerDepth,
              max: config.domain.height_m,
            },
            onChange: (value) => update("initial_atmosphere.boundary_layer_depth_m", value),
          })}
          {renderNumberControl(basicControl("source_layer_relative_humidity"), {
            value: config.initial_atmosphere.relative_humidity,
            limits: CONTROL_LIMITS.relativeHumidity,
            onChange: (value) => update("initial_atmosphere.relative_humidity", value),
          })}
        </ControlGroup>

        {hasVisibleControls([
          "humidity_profile",
          "moist_source_layer_depth",
          "free_atmosphere_relative_humidity",
        ]) ? (
          <ControlGroup title="Moisture structure">
            {renderSelectControl(advancedControl("humidity_profile"), {
              value: humidityProfile,
              options: HUMIDITY_PROFILES,
              onChange: (value) => updateValue("initial_atmosphere.humidity_profile", value),
            })}
            {advancedControl("humidity_profile")?.state !== "hidden" ? (
              <p className="control-note">
                {HUMIDITY_PROFILES.find((profile) => profile.value === humidityProfile)?.description}
              </p>
            ) : null}
            {renderNumberControl(basicControl("moist_source_layer_depth"), {
              value: config.initial_atmosphere.moist_source_layer_depth_m ?? 500,
              limits: {
                ...CONTROL_LIMITS.moistSourceLayerDepth,
                max: Math.min(
                  config.initial_atmosphere.boundary_layer_depth_m,
                  config.domain.height_m,
                ),
              },
              onChange: (value) => update("initial_atmosphere.moist_source_layer_depth_m", value),
            })}
            {renderNumberControl(basicControl("free_atmosphere_relative_humidity"), {
              value: config.initial_atmosphere.free_atmosphere_relative_humidity ?? 0.55,
              limits: CONTROL_LIMITS.relativeHumidity,
              onChange: (value) =>
                update("initial_atmosphere.free_atmosphere_relative_humidity", value),
            })}
          </ControlGroup>
        ) : null}

        {hasVisibleControls([
          "heating_pattern",
          "surface_heating_rate",
          "heating_patch_width",
          "heating_patch_center",
        ]) ? (
          <ControlGroup title="Surface forcing">
            {renderSelectControl(basicControl("heating_pattern"), {
              value: heatingPattern,
              options: SURFACE_HEATING_PATTERNS,
              onChange: (value) => updateValue("surface_heating.pattern", value),
            })}
            {basicControl("heating_pattern")?.state !== "hidden" ? (
              <p className="control-note">
                {SURFACE_HEATING_PATTERNS.find((pattern) => pattern.value === heatingPattern)?.description}
              </p>
            ) : null}
            {renderNumberControl(basicControl("surface_heating_rate"), {
              value: config.surface_heating.max_warming_rate_k_per_s,
              limits: CONTROL_LIMITS.surfaceHeatingRate,
              onChange: (value) => update("surface_heating.max_warming_rate_k_per_s", value),
            })}
            {renderNumberControl(basicControl("heating_patch_width"), {
              value: config.surface_heating.patch_width_m,
              limits: {
                ...CONTROL_LIMITS.heatingWidth,
                max: config.domain.width_m,
              },
              onChange: (value) => update("surface_heating.patch_width_m", value),
            })}
            {renderNumberControl(advancedControl("heating_patch_center"), {
              value: config.surface_heating.patch_center_x_m,
              limits: {
                ...CONTROL_LIMITS.heatingCenter,
                max: config.domain.width_m,
              },
              onChange: (value) => update("surface_heating.patch_center_x_m", value),
            })}
          </ControlGroup>
        ) : null}

        <ControlGroup title="Time and output">
          {renderNumberControl(basicControl("runtime"), {
            value: config.time.duration_seconds,
            limits: CONTROL_LIMITS.duration,
            onChange: (value) => update("time.duration_seconds", value),
          })}
          {config.solver_type === "microphysics_lab"
            ? renderNumberControl(basicControl("prescribed_lift"), {
                value: config.background_wind.w_m_per_s,
                limits: CONTROL_LIMITS.wind,
                onChange: (value) => update("background_wind.w_m_per_s", value),
              })
            : null}
        </ControlGroup>
      </div>

      {hasAdvancedControls ? (
        <details className="advanced-controls">
          <summary>Advanced settings</summary>
          <div className="controls-grid">
            <ControlGroup title="Saved experiments">
              <p className="control-note">{advancedControl("saved_scenarios")?.shortHelp}</p>
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

            {hasVisibleControls(["domain_width", "domain_height", "grid_columns", "grid_rows"]) ? (
              <ControlGroup title="Domain and grid">
                {renderNumberControl(advancedControl("domain_width"), {
                  value: config.domain.width_m,
                  limits: CONTROL_LIMITS.domainWidth,
                  onChange: (value) => update("domain.width_m", value),
                })}
                {renderNumberControl(advancedControl("domain_height"), {
                  value: config.domain.height_m,
                  limits: CONTROL_LIMITS.domainHeight,
                  onChange: (value) => update("domain.height_m", value),
                })}
                {renderNumberControl(advancedControl("grid_columns"), {
                  value: config.grid.columns,
                  limits: CONTROL_LIMITS.gridColumns,
                  onChange: (value) => update("grid.columns", value),
                })}
                {renderNumberControl(advancedControl("grid_rows"), {
                  value: config.grid.rows,
                  limits: CONTROL_LIMITS.gridRows,
                  onChange: (value) => update("grid.rows", value),
                })}
              </ControlGroup>
            ) : null}

            <ControlGroup title="Time, wind, reproducibility">
              {renderNumberControl(advancedControl("time_step"), {
                value: config.time.time_step_seconds,
                limits: CONTROL_LIMITS.timeStep,
                onChange: (value) => update("time.time_step_seconds", value),
              })}
              {renderNumberControl(advancedControl("frame_cadence"), {
                value: config.time.frame_interval_seconds,
                limits: CONTROL_LIMITS.frameInterval,
                onChange: (value) => update("time.frame_interval_seconds", value),
              })}
              {renderNumberControl(advancedControl("background_wind"), {
                value: config.background_wind.u_m_per_s,
                limits: CONTROL_LIMITS.wind,
                onChange: (value) => update("background_wind.u_m_per_s", value),
              })}
              {renderNumberControl(advancedControl("prescribed_lift"), {
                value: config.background_wind.w_m_per_s,
                limits: CONTROL_LIMITS.wind,
                onChange: (value) => update("background_wind.w_m_per_s", value),
              })}
              {renderNumberControl(advancedControl("seed"), {
                value: config.seed,
                limits: CONTROL_LIMITS.seed,
                onChange: (value) => update("seed", value),
              })}
            </ControlGroup>
          </div>
        </details>
      ) : null}

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

function renderNumberControl(
  control: ControlPresentation | undefined,
  props: {
    value: number;
    limits: ControlLimits;
    onChange: (value: number) => void;
  },
) {
  if (!control || control.state === "hidden" || control.state === "legacy") {
    return null;
  }
  return (
    <NumberControl
      label={control.label}
      unit={control.units ?? ""}
      value={props.value}
      limits={props.limits}
      help={control.shortHelp}
      disabled={control.state === "disabled"}
      disabledReason={control.disabledReason}
      onChange={props.onChange}
    />
  );
}

function renderSelectControl(
  control: ControlPresentation | undefined,
  props: {
    value: string;
    options: readonly SelectOption[];
    onChange: (value: string) => void;
  },
) {
  if (!control || control.state === "hidden" || control.state === "legacy") {
    return null;
  }
  return (
    <SelectControl
      label={control.label}
      value={props.value}
      options={props.options}
      help={control.shortHelp}
      disabled={control.state === "disabled"}
      disabledReason={control.disabledReason}
      onChange={props.onChange}
    />
  );
}

function NumberControl({
  label,
  unit,
  value,
  limits,
  help,
  disabled,
  disabledReason,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  limits: ControlLimits;
  help: string;
  disabled?: boolean;
  disabledReason?: string | null;
  onChange: (value: number) => void;
}) {
  const displayValue = limits.step < 0.01 ? value.toFixed(4) : value.toString();

  return (
    <label className={`number-control${disabled ? " disabled-control" : ""}`}>
      <span>
        {label}
        <strong>{unit}</strong>
      </span>
      <small>{disabledReason ?? help}</small>
      <input
        type="range"
        min={limits.min}
        max={limits.max}
        step={limits.step}
        value={value}
        disabled={disabled}
        title={disabledReason ?? help}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <input
        type="number"
        min={limits.min}
        max={limits.max}
        step={limits.step}
        value={displayValue}
        disabled={disabled}
        title={disabledReason ?? help}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function SelectControl({
  label,
  value,
  options,
  help,
  disabled,
  disabledReason,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly SelectOption[];
  help: string;
  disabled?: boolean;
  disabledReason?: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <label className={`select-control${disabled ? " disabled-control" : ""}`}>
      <span>{label}</span>
      <small>{disabledReason ?? help}</small>
      <select
        value={value}
        disabled={disabled}
        title={disabledReason ?? help}
        onChange={(event) => onChange(event.target.value)}
      >
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

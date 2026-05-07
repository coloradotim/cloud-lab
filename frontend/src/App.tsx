import { useEffect, useRef, useState } from "react";

import "./App.css";
import { ScientificDashboard } from "./ScientificDashboard";
import type { SimulationFrame } from "./simulationTypes";

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
    units: Array.from(new Set(Object.values(fields).map((field) => field.metadata?.unit ?? "unitless"))),
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
  const [isPaused, setIsPaused] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
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
      const response = await fetch(`${apiBaseUrl}/simulations/runs`, { method: "POST" });
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

      <section className="playback-panel" aria-labelledby="playback-title">
        <div>
          <p className="eyebrow">Live playback</p>
          <h2 id="playback-title">Simulation stream</h2>
        </div>

        <PlaybackControls
          playback={playback}
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
  onStart,
  onStop,
  onReset,
}: {
  playback: PlaybackState;
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
        <button type="button" onClick={onStart} disabled={isActive}>
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

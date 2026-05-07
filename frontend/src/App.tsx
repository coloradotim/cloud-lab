import { useEffect, useState } from "react";

import "./App.css";

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

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

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

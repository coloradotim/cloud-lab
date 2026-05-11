import { useEffect, useMemo, useRef, useState } from "react";

import {
  alignConfigForComparison,
  comparisonTimeLimit,
  diagnosticComparisonRows,
  frameAtOrBeforeTime,
  normalizedValueForSharedRange,
  observationsToComparisonDiagnostics,
  savedRunToComparisonDiagnostics,
  sharedRangeForComparisonFrames,
} from "./comparison";
import type { ComparisonDiagnostics, DiagnosticComparisonRow } from "./comparison";
import { evaluateScenarioRun } from "./scenarioDiagnostics";
import type { SavedRunArtifact } from "./savedRuns";
import { BUILT_IN_SCENARIOS } from "./simulationControls";
import type { BuiltInScenario } from "./simulationControls";
import type { SimulationConfig, SimulationFrame } from "./simulationTypes";
import { colorForNormalizedValue, fieldOptionsFromFrame } from "./visualization";
import type { FieldStats } from "./visualization";

type ComparisonStatus = "idle" | "running" | "complete" | "error";

type ComparisonSide = {
  label: "A" | "B";
  name: string;
  config: SimulationConfig | null;
  frames: SimulationFrame[];
  diagnostics: ComparisonDiagnostics;
  status: ComparisonStatus;
  message: string | null;
};

type ScenarioComparisonPanelProps = {
  baseConfig: SimulationConfig | null;
  savedRuns: SavedRunArtifact[];
  apiBaseUrl: string;
  websocketBaseUrl: string;
};

const EMPTY_DIAGNOSTICS: ComparisonDiagnostics = {
  firstCloudTimeSeconds: null,
  maxCloudLiquidWaterKgPerKg: null,
  cloudTopHeightM: null,
  firstRainTimeSeconds: null,
  maxRainWaterKgPerKg: null,
  maxUpdraftMPerS: null,
  estimatedLclM: null,
};

export function ScenarioComparisonPanel({
  baseConfig,
  savedRuns,
  apiBaseUrl,
  websocketBaseUrl,
}: ScenarioComparisonPanelProps) {
  const [leftScenarioSlug, setLeftScenarioSlug] = useState(
    BUILT_IN_SCENARIOS[0]?.slug ?? "",
  );
  const [rightScenarioSlug, setRightScenarioSlug] = useState(
    BUILT_IN_SCENARIOS[1]?.slug ?? BUILT_IN_SCENARIOS[0]?.slug ?? "",
  );
  const [leftSavedRunId, setLeftSavedRunId] = useState("");
  const [rightSavedRunId, setRightSavedRunId] = useState("");
  const [selectedField, setSelectedField] = useState("cloud_liquid_water_kg_per_kg");
  const [displayTimeSeconds, setDisplayTimeSeconds] = useState(0);
  const [left, setLeft] = useState<ComparisonSide>(() => emptySide("A"));
  const [right, setRight] = useState<ComparisonSide>(() => emptySide("B"));

  const leftScenario = scenarioBySlug(leftScenarioSlug);
  const rightScenario = scenarioBySlug(rightScenarioSlug);
  const leftFrame = frameAtOrBeforeTime(left.frames, displayTimeSeconds);
  const rightFrame = frameAtOrBeforeTime(right.frames, displayTimeSeconds);
  const timeLimit = comparisonTimeLimit(left.frames, right.frames);
  const fieldOptions = useMemo(
    () => comparisonFieldOptions(leftFrame, rightFrame),
    [leftFrame, rightFrame],
  );
  const sharedRange = useMemo(
    () => sharedRangeForComparisonFrames(selectedField, [leftFrame, rightFrame]),
    [leftFrame, rightFrame, selectedField],
  );
  const diagnosticRows = diagnosticComparisonRows(left.diagnostics, right.diagnostics);
  const isRunning = left.status === "running" || right.status === "running";

  useEffect(() => {
    if (fieldOptions.length === 0) {
      return;
    }
    if (!fieldOptions.some((option) => option.key === selectedField)) {
      setSelectedField(fieldOptions[0].key);
    }
  }, [fieldOptions, selectedField]);

  useEffect(() => {
    if (timeLimit > 0 && displayTimeSeconds > timeLimit) {
      setDisplayTimeSeconds(timeLimit);
    }
  }, [displayTimeSeconds, timeLimit]);

  async function runScenarioComparison() {
    if (!baseConfig || !leftScenario || !rightScenario) {
      return;
    }

    const leftConfig = leftScenario.apply(baseConfig);
    const rightConfig = alignConfigForComparison(rightScenario.apply(baseConfig), leftConfig);
    setLeft(runningSide("A", leftScenario.name, leftConfig));
    setRight(runningSide("B", rightScenario.name, rightConfig));
    setDisplayTimeSeconds(0);

    try {
      const [leftFrames, rightFrames] = await Promise.all([
        runConfigToFrames(leftConfig, apiBaseUrl, websocketBaseUrl),
        runConfigToFrames(rightConfig, apiBaseUrl, websocketBaseUrl),
      ]);
      setLeft(completedScenarioSide("A", leftScenario, leftConfig, leftFrames));
      setRight(completedScenarioSide("B", rightScenario, rightConfig, rightFrames));
      setDisplayTimeSeconds(comparisonTimeLimit(leftFrames, rightFrames));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to run comparison.";
      setLeft((current) => ({ ...current, status: "error", message }));
      setRight((current) => ({ ...current, status: "error", message }));
    }
  }

  function loadSavedRunComparison() {
    const leftArtifact = savedRuns.find((artifact) => artifact.id === leftSavedRunId);
    const rightArtifact = savedRuns.find((artifact) => artifact.id === rightSavedRunId);
    if (!leftArtifact || !rightArtifact) {
      return;
    }

    setLeft(savedArtifactSide("A", leftArtifact));
    setRight(savedArtifactSide("B", rightArtifact));
    setDisplayTimeSeconds(
      comparisonTimeLimit(leftArtifact.sampled_frames, rightArtifact.sampled_frames),
    );
  }

  return (
    <details className="comparison-panel">
      <summary>Scenario comparison</summary>
      <div className="comparison-layout">
        <section className="comparison-setup" aria-labelledby="comparison-setup-title">
          <div>
            <p className="eyebrow">Compare scenarios</p>
            <h3 id="comparison-setup-title">Run A/B</h3>
            <p>
              Scenario runs share A's model size, runtime, and frame cadence so visual
              differences come from scenario setup rather than mismatched grids.
            </p>
          </div>
          <div className="comparison-select-grid">
            <ScenarioSelect
              label="Scenario A"
              value={leftScenarioSlug}
              onChange={setLeftScenarioSlug}
            />
            <ScenarioSelect
              label="Scenario B"
              value={rightScenarioSlug}
              onChange={setRightScenarioSlug}
            />
          </div>
          <button type="button" disabled={!baseConfig || isRunning} onClick={runScenarioComparison}>
            Run comparison
          </button>
        </section>

        <section className="comparison-setup" aria-labelledby="comparison-artifacts-title">
          <div>
            <p className="eyebrow">Compare saved runs</p>
            <h3 id="comparison-artifacts-title">Load artifacts</h3>
            <p>
              Saved run artifacts load sampled replay frames when available. Metadata-only
              artifacts still compare diagnostics.
            </p>
          </div>
          <div className="comparison-select-grid">
            <SavedRunSelect
              label="Artifact A"
              value={leftSavedRunId}
              savedRuns={savedRuns}
              onChange={setLeftSavedRunId}
            />
            <SavedRunSelect
              label="Artifact B"
              value={rightSavedRunId}
              savedRuns={savedRuns}
              onChange={setRightSavedRunId}
            />
          </div>
          <button
            type="button"
            disabled={!leftSavedRunId || !rightSavedRunId || isRunning}
            onClick={loadSavedRunComparison}
          >
            Load artifact comparison
          </button>
        </section>
      </div>

      <section className="comparison-display" aria-label="Side-by-side comparison">
        <div className="comparison-toolbar">
          <label>
            Field
            <select
              value={selectedField}
              disabled={fieldOptions.length === 0}
              onChange={(event) => setSelectedField(event.target.value)}
            >
              {fieldOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label} ({option.unit})
                </option>
              ))}
            </select>
          </label>
          <label className="comparison-timeline">
            Time {displayTimeSeconds.toFixed(0)} s
            <input
              type="range"
              min={0}
              max={Math.max(0, timeLimit)}
              step={1}
              value={Math.min(displayTimeSeconds, timeLimit)}
              disabled={timeLimit <= 0}
              onChange={(event) => setDisplayTimeSeconds(Number(event.target.value))}
            />
          </label>
          <span>
            Shared scale {formatRange(sharedRange)}
          </span>
        </div>

        <div className="comparison-canvas-grid">
          <ComparisonCanvas
            side={left}
            frame={leftFrame}
            selectedField={selectedField}
            sharedRange={sharedRange}
          />
          <ComparisonCanvas
            side={right}
            frame={rightFrame}
            selectedField={selectedField}
            sharedRange={sharedRange}
          />
        </div>

        <DiagnosticComparisonTable rows={diagnosticRows} />
      </section>
    </details>
  );
}

function ScenarioSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="select-control">
      <span>{label}</span>
      <small>Built-in scenario setup.</small>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {BUILT_IN_SCENARIOS.map((scenario) => (
          <option key={scenario.slug} value={scenario.slug}>
            {scenario.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function SavedRunSelect({
  label,
  value,
  savedRuns,
  onChange,
}: {
  label: string;
  value: string;
  savedRuns: SavedRunArtifact[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="select-control">
      <span>{label}</span>
      <small>Saved run artifact.</small>
      <select
        value={value}
        disabled={savedRuns.length === 0}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select artifact</option>
        {savedRuns.map((artifact) => (
          <option key={artifact.id} value={artifact.id}>
            {artifact.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function ComparisonCanvas({
  side,
  frame,
  selectedField,
  sharedRange,
}: {
  side: ComparisonSide;
  frame: SimulationFrame | null;
  selectedField: string;
  sharedRange: FieldStats;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !frame) {
      return;
    }
    renderComparisonFrame(canvas, frame, selectedField, sharedRange);
  }, [frame, selectedField, sharedRange]);

  return (
    <article className="comparison-canvas-card">
      <header>
        <p className="eyebrow">Run {side.label}</p>
        <h3>{side.name}</h3>
        <span className={`comparison-status comparison-status-${side.status}`}>
          {side.status}
        </span>
      </header>
      <div className="comparison-canvas-shell">
        {frame ? (
          <canvas ref={canvasRef} aria-label={`Run ${side.label} comparison visualization`} />
        ) : (
          <div className="empty-visualization">
            {side.message ?? "Run or load a comparison to show frames."}
          </div>
        )}
      </div>
      <dl className="comparison-frame-stats">
        <div>
          <dt>Frames</dt>
          <dd>{side.frames.length}</dd>
        </div>
        <div>
          <dt>Shown time</dt>
          <dd>{frame ? `${frame.time_seconds.toFixed(0)} s` : "none"}</dd>
        </div>
      </dl>
      {side.message ? <p className="comparison-message">{side.message}</p> : null}
    </article>
  );
}

function DiagnosticComparisonTable({ rows }: { rows: DiagnosticComparisonRow[] }) {
  return (
    <div className="comparison-table-wrap">
      <table className="comparison-table">
        <thead>
          <tr>
            <th>Diagnostic</th>
            <th>Run A</th>
            <th>Run B</th>
            <th>B - A</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">{row.label}</th>
              <td>{formatDiagnosticValue(row.left, row.unit)}</td>
              <td>{formatDiagnosticValue(row.right, row.unit)}</td>
              <td>{formatDiagnosticValue(row.delta, row.unit, true)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function runConfigToFrames(
  config: SimulationConfig,
  apiBaseUrl: string,
  websocketBaseUrl: string,
): Promise<SimulationFrame[]> {
  const response = await fetch(`${apiBaseUrl}/simulations/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!response.ok) {
    throw new Error(`Start returned HTTP ${response.status}`);
  }

  const run = (await response.json()) as { run_id: string };
  return collectRunFrames(`${websocketBaseUrl}/simulations/runs/${run.run_id}/stream`);
}

function collectRunFrames(url: string): Promise<SimulationFrame[]> {
  return new Promise((resolve, reject) => {
    const frames: SimulationFrame[] = [];
    const websocket = new WebSocket(url);

    websocket.onmessage = (event: MessageEvent<string>) => {
      const message = JSON.parse(event.data) as ComparisonStreamMessage;
      if (message.type === "frame") {
        frames.push(message.frame);
        return;
      }
      if (message.type === "complete" || message.type === "stopped") {
        websocket.close();
        resolve(frames);
        return;
      }
      if (message.type === "error") {
        websocket.close();
        reject(new Error(message.message ?? "Comparison stream failed."));
      }
    };

    websocket.onerror = () => {
      reject(new Error("Comparison WebSocket stream failed."));
    };
  });
}

function renderComparisonFrame(
  canvas: HTMLCanvasElement,
  frame: SimulationFrame,
  selectedField: string,
  sharedRange: FieldStats,
) {
  const field = frame.fields[selectedField];
  const context = canvas.getContext("2d");
  if (!field || !context) {
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;
  const width = Math.max(260, Math.floor(rect.width * pixelRatio));
  const height = Math.max(180, Math.floor(rect.height * pixelRatio));
  canvas.width = width;
  canvas.height = height;

  const rows = frame.grid.rows;
  const columns = frame.grid.columns;
  const cellWidth = width / columns;
  const cellHeight = height / rows;
  const colorMap = field.metadata.display_scale?.color_map ?? "viridis";

  context.clearRect(0, 0, width, height);
  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
      const value = field.values[rowIndex][columnIndex];
      const normalized = normalizedValueForSharedRange(
        selectedField,
        field,
        value,
        sharedRange,
      );
      const [red, green, blue] = colorForNormalizedValue(normalized, colorMap);
      context.fillStyle = `rgb(${red}, ${green}, ${blue})`;
      context.fillRect(
        columnIndex * cellWidth,
        (rows - 1 - rowIndex) * cellHeight,
        Math.ceil(cellWidth),
        Math.ceil(cellHeight),
      );
    }
  }
}

function emptySide(label: "A" | "B"): ComparisonSide {
  return {
    label,
    name: "No comparison loaded",
    config: null,
    frames: [],
    diagnostics: EMPTY_DIAGNOSTICS,
    status: "idle",
    message: null,
  };
}

function runningSide(
  label: "A" | "B",
  name: string,
  config: SimulationConfig,
): ComparisonSide {
  return {
    label,
    name,
    config,
    frames: [],
    diagnostics: EMPTY_DIAGNOSTICS,
    status: "running",
    message: "Running comparison stream.",
  };
}

function completedScenarioSide(
  label: "A" | "B",
  scenario: BuiltInScenario,
  config: SimulationConfig,
  frames: SimulationFrame[],
): ComparisonSide {
  const diagnostics = evaluateScenarioRun({ scenario, config, frames });
  return {
    label,
    name: scenario.name,
    config,
    frames,
    diagnostics: observationsToComparisonDiagnostics(diagnostics.observations),
    status: "complete",
    message: diagnostics.statusLabel,
  };
}

function savedArtifactSide(label: "A" | "B", artifact: SavedRunArtifact): ComparisonSide {
  return {
    label,
    name: artifact.name,
    config: artifact.config,
    frames: artifact.sampled_frames,
    diagnostics: savedRunToComparisonDiagnostics(artifact),
    status: artifact.sampled_frames.length > 0 ? "complete" : "idle",
    message:
      artifact.sampled_frames.length > 0
        ? "Loaded sampled saved-run frames."
        : "Metadata-only artifact; no sampled frames stored.",
  };
}

function comparisonFieldOptions(
  leftFrame: SimulationFrame | null,
  rightFrame: SimulationFrame | null,
) {
  const leftOptions = fieldOptionsFromFrame(leftFrame);
  const rightKeys = new Set(fieldOptionsFromFrame(rightFrame).map((option) => option.key));
  if (leftOptions.length === 0) {
    return fieldOptionsFromFrame(rightFrame);
  }
  if (rightKeys.size === 0) {
    return leftOptions;
  }
  return leftOptions.filter((option) => rightKeys.has(option.key));
}

function scenarioBySlug(slug: string) {
  return BUILT_IN_SCENARIOS.find((scenario) => scenario.slug === slug) ?? null;
}

function formatRange(range: FieldStats): string {
  return `${formatCompactNumber(range.min)} to ${formatCompactNumber(range.max)}`;
}

function formatDiagnosticValue(
  value: number | null,
  unit: string,
  signed = false,
): string {
  if (value === null) {
    return "not observed";
  }
  const prefix = signed && value > 0 ? "+" : "";
  return `${prefix}${formatCompactNumber(value)} ${unit}`;
}

function formatCompactNumber(value: number): string {
  if (Math.abs(value) > 0 && Math.abs(value) < 0.01) {
    return value.toExponential(2);
  }
  if (Math.abs(value) >= 100) {
    return value.toFixed(0);
  }
  return value.toFixed(3);
}

type ComparisonStreamMessage =
  | { type: "metadata" | "complete" | "stopped" }
  | { type: "frame"; frame: SimulationFrame }
  | { type: "error"; message?: string };

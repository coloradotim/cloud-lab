import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";

import type { LabDefinition } from "../labs/labTypes";
import { BOUSSINESQ_MODEL_SIZES, CONTROL_LIMITS, SURFACE_HEATING_PATTERNS } from "../simulationControls";
import { defaultWorkbenchRunClient, type RunStreamCleanup, type WorkbenchRunClient } from "../simulation/runClient";
import type { SimulationFrame } from "../simulationTypes";
import {
  applyWorkbenchStreamMessage,
  buildWorkbenchInspectorSummary,
  createInitialWorkbenchState,
  displayedFrame,
  formatMeters,
  formatSeconds,
  markWorkbenchRunError,
  markWorkbenchRunStarting,
  resetWorkbenchRun,
  saveRunPlaceholder,
  selectWorkbenchScenario,
  selectedLabScenario,
  setWorkbenchDisplayedFrame,
  setWorkbenchReplayPaused,
  startWorkbenchRun,
  updateWorkbenchControl,
  workbenchReplayEvents,
  workbenchReplayLabel,
  type WorkbenchControlId,
  type WorkbenchState,
} from "./workbenchRunLoop";

type WorkbenchMode = "single" | "saved-runs" | "compare" | "sweep";

type LabWorkbenchProps = {
  lab: LabDefinition;
  mode?: WorkbenchMode;
  onBackToLabs: () => void;
  runClient?: WorkbenchRunClient;
};

export function LabWorkbench({
  lab,
  mode = "single",
  onBackToLabs,
  runClient = defaultWorkbenchRunClient,
}: LabWorkbenchProps) {
  const [workbench, setWorkbench] = useState<WorkbenchState>(() =>
    createInitialWorkbenchState(lab),
  );
  const cleanupRef = useRef<RunStreamCleanup | null>(null);
  const scenario = selectedLabScenario(lab, workbench);
  const currentFrame = displayedFrame(workbench);
  const inspector = useMemo(() => buildWorkbenchInspectorSummary(workbench), [workbench]);
  const replayEvents = useMemo(() => workbenchReplayEvents(workbench), [workbench]);

  useEffect(() => {
    setWorkbench(createInitialWorkbenchState(lab));
    return () => cleanupRef.current?.();
  }, [lab]);

  async function handleStartRun() {
    cleanupRef.current?.();
    setWorkbench((current) => markWorkbenchRunStarting(current));

    try {
      const started = await startWorkbenchRun(workbench, runClient);
      setWorkbench(started);
      cleanupRef.current = runClient.streamRun(
        started.run.runId ?? "",
        (message) => setWorkbench((current) => applyWorkbenchStreamMessage(current, message)),
        (message) => setWorkbench((current) => markWorkbenchRunError(current, message)),
      );
    } catch (error) {
      setWorkbench((current) =>
        markWorkbenchRunError(
          current,
          error instanceof Error ? error.message : "Unable to start simulation.",
        ),
      );
    }
  }

  async function handleStopRun() {
    if (!workbench.run.runId) {
      return;
    }

    try {
      await runClient.stopRun(workbench.run.runId);
    } catch (error) {
      setWorkbench((current) =>
        markWorkbenchRunError(
          current,
          error instanceof Error ? error.message : "Unable to stop simulation.",
        ),
      );
    }
  }

  function handleResetRun() {
    cleanupRef.current?.();
    cleanupRef.current = null;
    setWorkbench((current) => resetWorkbenchRun(current));
  }

  const isRunning = workbench.run.status === "starting" || workbench.run.status === "running";

  return (
    <main className="workbench-v2" aria-label={`${lab.name} workbench`}>
      <WorkbenchTopBar
        lab={lab}
        scenarioName={scenario?.name ?? "Scenario coming later"}
        mode={mode}
        runStatus={workbench.run.status}
        isRunning={isRunning}
        onBackToLabs={onBackToLabs}
        onStartRun={handleStartRun}
        onStopRun={handleStopRun}
        onResetRun={handleResetRun}
        onSaveRun={() => setWorkbench((current) => saveRunPlaceholder(current))}
      />

      <section className="workbench-grid" aria-label="Workbench regions">
        <LabSetupPanel lab={lab} workbench={workbench} setWorkbench={setWorkbench} />
        <VisualizationStage lab={lab} frame={currentFrame} workbench={workbench} />
        <InspectorPanel lab={lab} summary={inspector} saveMessage={workbench.saveMessage} />
      </section>

      <TimelinePanel
        workbench={workbench}
        replayEvents={replayEvents}
        setWorkbench={setWorkbench}
      />
    </main>
  );
}

function WorkbenchTopBar({
  lab,
  scenarioName,
  mode,
  runStatus,
  isRunning,
  onBackToLabs,
  onStartRun,
  onStopRun,
  onResetRun,
  onSaveRun,
}: {
  lab: LabDefinition;
  scenarioName: string;
  mode: WorkbenchMode;
  runStatus: string;
  isRunning: boolean;
  onBackToLabs: () => void;
  onStartRun: () => void;
  onStopRun: () => void;
  onResetRun: () => void;
  onSaveRun: () => void;
}) {
  return (
    <header className="workbench-top-bar">
      <button type="button" className="ghost-button" onClick={onBackToLabs}>
        Labs
      </button>
      <div className="workbench-identity">
        <span>Cloud Lab</span>
        <strong>{lab.name}</strong>
        <span>{scenarioName}</span>
      </div>
      <div className="workbench-actions" aria-label="Run and workbench actions">
        <button type="button" onClick={onStartRun} disabled={isRunning}>
          Run
        </button>
        <button type="button" onClick={onStopRun} disabled={!isRunning}>
          Stop
        </button>
        <button type="button" onClick={onResetRun}>
          Reset
        </button>
        <span className={`run-state run-state-${runStatus}`}>{runStatusLabel(runStatus)}</span>
        <button type="button" onClick={onSaveRun}>
          Save
        </button>
        <button type="button" disabled title="Comparison mode is intentionally deferred.">
          Compare
        </button>
        <button type="button" disabled title="System drawer is deferred from the default flow.">
          System
        </button>
      </div>
      <span className="mode-pill">Mode: {mode}</span>
    </header>
  );
}

function LabSetupPanel({
  lab,
  workbench,
  setWorkbench,
}: {
  lab: LabDefinition;
  workbench: WorkbenchState;
  setWorkbench: Dispatch<SetStateAction<WorkbenchState>>;
}) {
  const scenario = selectedLabScenario(lab, workbench);

  return (
    <aside className="workbench-region setup-region" aria-labelledby="setup-region-title">
      <p className="region-label">Setup</p>
      <h2 id="setup-region-title">{scenario?.name ?? "Scenario"}</h2>
      <p>{scenario?.intendedPhenomenon ?? lab.question}</p>

      <label className="control-group">
        <span>Scenario</span>
        <select
          value={workbench.selectedScenarioId}
          onChange={(event) =>
            setWorkbench((current) =>
              selectWorkbenchScenario(current, lab, event.currentTarget.value),
            )
          }
        >
          {lab.scenarios.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name}
            </option>
          ))}
        </select>
      </label>

      <p className="setup-expectation">{scenario?.expectedBehavior}</p>

      <div className="workbench-control-grid" aria-label="Primary Fair-Weather controls">
        <NumberControl
          id="surface-heating-strength"
          label="Surface heating strength"
          value={workbench.nextRunConfig.surface_heating.max_warming_rate_k_per_s}
          min={CONTROL_LIMITS.surfaceHeatingRate.min}
          max={CONTROL_LIMITS.surfaceHeatingRate.max}
          step={CONTROL_LIMITS.surfaceHeatingRate.step}
          suffix="K/s"
          setWorkbench={setWorkbench}
        />
        <SelectControl
          id="surface-heating-pattern"
          label="Surface heating pattern"
          value={workbench.nextRunConfig.surface_heating.pattern ?? "single_patch"}
          options={SURFACE_HEATING_PATTERNS.map((pattern) => ({
            value: pattern.value,
            label: pattern.label,
          }))}
          setWorkbench={setWorkbench}
        />
        <NumberControl
          id="source-layer-humidity"
          label="Source-layer humidity"
          value={workbench.nextRunConfig.initial_atmosphere.relative_humidity}
          min={CONTROL_LIMITS.relativeHumidity.min}
          max={CONTROL_LIMITS.relativeHumidity.max}
          step={CONTROL_LIMITS.relativeHumidity.step}
          suffix="RH"
          setWorkbench={setWorkbench}
        />
        <NumberControl
          id="free-atmosphere-humidity"
          label="Free-atmosphere humidity"
          value={workbench.nextRunConfig.initial_atmosphere.free_atmosphere_relative_humidity ?? 0.55}
          min={CONTROL_LIMITS.relativeHumidity.min}
          max={CONTROL_LIMITS.relativeHumidity.max}
          step={CONTROL_LIMITS.relativeHumidity.step}
          suffix="RH"
          setWorkbench={setWorkbench}
        />
        <NumberControl
          id="stability-lapse-rate"
          label="Stability / lapse rate"
          value={workbench.nextRunConfig.initial_atmosphere.lapse_rate_k_per_m}
          min={CONTROL_LIMITS.lapseRate.min}
          max={CONTROL_LIMITS.lapseRate.max}
          step={CONTROL_LIMITS.lapseRate.step}
          suffix="K/m"
          setWorkbench={setWorkbench}
        />
        <NumberControl
          id="boundary-layer-depth-cap-height"
          label="Boundary-layer depth / cap height"
          value={workbench.nextRunConfig.initial_atmosphere.boundary_layer_depth_m}
          min={CONTROL_LIMITS.boundaryLayerDepth.min}
          max={CONTROL_LIMITS.boundaryLayerDepth.max}
          step={CONTROL_LIMITS.boundaryLayerDepth.step}
          suffix="m"
          setWorkbench={setWorkbench}
        />
        <SelectControl
          id="model-size-runtime"
          label="Model size / runtime"
          value={workbench.modelSizeSlug}
          options={BOUSSINESQ_MODEL_SIZES.map((size) => ({
            value: size.slug,
            label: size.name,
          }))}
          setWorkbench={setWorkbench}
        />
      </div>
    </aside>
  );
}

function NumberControl({
  id,
  label,
  value,
  min,
  max,
  step,
  suffix,
  setWorkbench,
}: {
  id: WorkbenchControlId;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  setWorkbench: Dispatch<SetStateAction<WorkbenchState>>;
}) {
  return (
    <label className="control-group">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) =>
          setWorkbench((current) => updateWorkbenchControl(current, id, Number(event.currentTarget.value)))
        }
      />
      <small>{suffix}</small>
    </label>
  );
}

function SelectControl({
  id,
  label,
  value,
  options,
  setWorkbench,
}: {
  id: WorkbenchControlId;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  setWorkbench: Dispatch<SetStateAction<WorkbenchState>>;
}) {
  return (
    <label className="control-group">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) =>
          setWorkbench((current) => updateWorkbenchControl(current, id, event.currentTarget.value))
        }
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

function VisualizationStage({
  lab,
  frame,
  workbench,
}: {
  lab: LabDefinition;
  frame: SimulationFrame | null;
  workbench: WorkbenchState;
}) {
  const cloudMax = frame
    ? maxFrameField(frame, "cloud_liquid_water_kg_per_kg")
    : workbench.run.maxCloudWater;
  const updraftMax = frame
    ? maxFrameField(frame, "vertical_velocity_m_per_s")
    : workbench.run.maxUpdraft;

  return (
    <section
      className="workbench-region visualization-stage"
      aria-labelledby="visualization-stage-title"
    >
      <div>
        <p className="region-label">Visualization stage</p>
        <h2 id="visualization-stage-title">Scientific 2-D field view</h2>
        <p>
          {frame
            ? `Displaying buffered frame ${workbench.displayedFrameIndex + 1} at ${formatSeconds(
                frame.time_seconds,
              )}.`
            : "Start a run to stream Fair-Weather fields into the stage."}
        </p>
      </div>
      <div className="stage-placeholder" aria-label={`${lab.name} visualization placeholder`}>
        <div className="thermal-column" style={{ opacity: Math.min(1, updraftMax * 4 + 0.2) }} />
        <div className="cloud-puff one" style={{ opacity: Math.min(0.95, cloudMax * 350_000 + 0.12) }} />
        <div className="cloud-puff two" style={{ opacity: Math.min(0.75, cloudMax * 220_000 + 0.08) }} />
        <div className="ground-heating" />
      </div>
      <dl className="stage-stats">
        <div>
          <dt>Frames</dt>
          <dd>{workbench.frames.length}</dd>
        </div>
        <div>
          <dt>Displayed time</dt>
          <dd>{formatSeconds(frame?.time_seconds)}</dd>
        </div>
        <div>
          <dt>Max cloud water</dt>
          <dd>{cloudMax.toExponential(2)} kg/kg</dd>
        </div>
        <div>
          <dt>Max updraft</dt>
          <dd>{updraftMax.toFixed(2)} m/s</dd>
        </div>
      </dl>
      <p className="truth-label">Experimental 2-D dynamics · qualitative cloud experiment</p>
      {workbench.run.message ? <p className="workbench-message">{workbench.run.message}</p> : null}
    </section>
  );
}

function InspectorPanel({
  lab,
  summary,
  saveMessage,
}: {
  lab: LabDefinition;
  summary: ReturnType<typeof buildWorkbenchInspectorSummary>;
  saveMessage: string | null;
}) {
  return (
    <aside className="workbench-region inspector-region" aria-labelledby="inspector-region-title">
      <p className="region-label">Inspector</p>
      <h2 id="inspector-region-title">Expected vs observed</h2>
      <p>{summary.diagnostics.observed}</p>
      <span className={`diagnostic-status diagnostic-status-${summary.diagnostics.status}`}>
        {summary.diagnostics.statusLabel}
      </span>
      <ul>
        {summary.diagnostics.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>

      <h3>Profile / sounding</h3>
      <p>{summary.profileSummary}</p>

      <dl className="diagnostic-list">
        <div>
          <dt>Expected LCL / cloud base</dt>
          <dd>{formatMeters(summary.expectedLclM)}</dd>
        </div>
        <div>
          <dt>First cloud time / height</dt>
          <dd>
            {formatSeconds(summary.firstCloudTimeSeconds)} / {formatMeters(summary.firstCloudHeightM)}
          </dd>
        </div>
        <div>
          <dt>Cloud top</dt>
          <dd>{formatMeters(summary.cloudTopM)}</dd>
        </div>
        <div>
          <dt>Max updraft</dt>
          <dd>
            {summary.maxUpdraftMPerS === null
              ? "unavailable"
              : `${summary.maxUpdraftMPerS.toFixed(2)} m/s`}
          </dd>
        </div>
        <div>
          <dt>Cloud water below / near / above LCL</dt>
          <dd>
            {formatFraction(summary.belowLclCloudFraction)} /{" "}
            {formatFraction(summary.nearLclCloudFraction)} /{" "}
            {formatFraction(summary.aboveLclCloudFraction)}
          </dd>
        </div>
        <div>
          <dt>Dry-failed-cloud outcome</dt>
          <dd>{summary.dryFailedOutcome}</dd>
        </div>
      </dl>

      <p className="truth-label">{lab.limitations[0]}</p>
      {saveMessage ? <p className="workbench-message">{saveMessage}</p> : null}
    </aside>
  );
}

function TimelinePanel({
  workbench,
  replayEvents,
  setWorkbench,
}: {
  workbench: WorkbenchState;
  replayEvents: ReturnType<typeof workbenchReplayEvents>;
  setWorkbench: Dispatch<SetStateAction<WorkbenchState>>;
}) {
  const max = Math.max(0, workbench.frames.length - 1);

  return (
    <section className="timeline-region" aria-labelledby="timeline-region-title">
      <div>
        <p className="region-label">Timeline / replay</p>
        <h2 id="timeline-region-title">{workbenchReplayLabel(workbench)}</h2>
      </div>
      <input
        type="range"
        min="0"
        max={max}
        value={workbench.displayedFrameIndex}
        readOnly={workbench.frames.length === 0}
        aria-label="Replay timeline"
        onChange={(event) =>
          setWorkbench((current) =>
            setWorkbenchDisplayedFrame(current, Number(event.currentTarget.value)),
          )
        }
      />
      <div className="timeline-actions" aria-label="Replay actions">
        <button
          type="button"
          onClick={() => setWorkbench((current) => setWorkbenchDisplayedFrame(current, 0))}
          disabled={workbench.frames.length === 0}
        >
          First
        </button>
        <button
          type="button"
          onClick={() =>
            setWorkbench((current) => setWorkbenchReplayPaused(current, !current.isReplayPaused))
          }
          disabled={workbench.frames.length === 0}
        >
          {workbench.isReplayPaused ? "Resume" : "Pause"}
        </button>
        <button
          type="button"
          onClick={() => setWorkbench((current) => setWorkbenchDisplayedFrame(current, max))}
          disabled={workbench.frames.length === 0}
        >
          Final
        </button>
        {replayEvents
          .filter((event) => event.frameIndex !== null)
          .slice(0, 2)
          .map((event) => (
            <button
              type="button"
              key={event.key}
              onClick={() =>
                setWorkbench((current) =>
                  setWorkbenchDisplayedFrame(current, event.frameIndex ?? 0),
                )
              }
            >
              {event.label}
            </button>
          ))}
      </div>
    </section>
  );
}

function maxFrameField(frame: SimulationFrame, fieldKey: string): number {
  const field = frame.fields[fieldKey];
  if (!field) {
    return 0;
  }

  if (field.values.length === 0) {
    return 0;
  }

  return field.values.reduce(
    (currentMax, row) => Math.max(currentMax, ...row),
    Number.NEGATIVE_INFINITY,
  );
}

function formatFraction(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "unavailable";
  }

  return `${Math.round(value * 100)}%`;
}

function runStatusLabel(status: string): string {
  switch (status) {
    case "idle":
      return "Ready";
    case "starting":
      return "Starting";
    case "running":
      return "Running";
    case "stopped":
      return "Stopped";
    case "complete":
      return "Complete";
    case "error":
      return "Error";
    default:
      return status;
  }
}

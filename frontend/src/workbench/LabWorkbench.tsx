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
import {
  availableScientificFields,
  buildScientificFieldViewModel,
  defaultScientificFieldKey,
  normalizeScientificFieldSelection,
} from "./scientificFieldView";

type WorkbenchMode = "single" | "saved-runs" | "compare" | "sweep";

type LabWorkbenchProps = {
  lab: LabDefinition;
  mode?: WorkbenchMode;
  initialInspectorOpen?: boolean;
  onBackToLabs: () => void;
  runClient?: WorkbenchRunClient;
};

export function LabWorkbench({
  lab,
  mode = "single",
  initialInspectorOpen = true,
  onBackToLabs,
  runClient = defaultWorkbenchRunClient,
}: LabWorkbenchProps) {
  const [workbench, setWorkbench] = useState<WorkbenchState>(() =>
    createInitialWorkbenchState(lab),
  );
  const [selectedFieldKey, setSelectedFieldKey] = useState(defaultScientificFieldKey(null));
  const [inspectorOpen, setInspectorOpen] = useState(initialInspectorOpen);
  const cleanupRef = useRef<RunStreamCleanup | null>(null);
  const scenario = selectedLabScenario(lab, workbench);
  const currentFrame = displayedFrame(workbench);
  const inspector = useMemo(() => buildWorkbenchInspectorSummary(workbench), [workbench]);
  const replayEvents = useMemo(() => workbenchReplayEvents(workbench), [workbench]);

  useEffect(() => {
    setWorkbench(createInitialWorkbenchState(lab));
    setSelectedFieldKey(defaultScientificFieldKey(null));
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
        inspectorOpen={inspectorOpen}
        onToggleInspector={() => setInspectorOpen((current) => !current)}
        onSaveRun={() => setWorkbench((current) => saveRunPlaceholder(current))}
      />

      <section
        className={`workbench-grid${inspectorOpen ? "" : " inspector-collapsed"}`}
        aria-label="Workbench regions"
      >
        <LabSetupPanel lab={lab} workbench={workbench} setWorkbench={setWorkbench} />
        <VisualizationStage
          lab={lab}
          frame={currentFrame}
          workbench={workbench}
          selectedFieldKey={selectedFieldKey}
          onSelectedFieldKeyChange={setSelectedFieldKey}
        />
        {inspectorOpen ? (
          <InspectorPanel lab={lab} summary={inspector} saveMessage={workbench.saveMessage} />
        ) : null}
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
  inspectorOpen,
  onBackToLabs,
  onStartRun,
  onStopRun,
  onResetRun,
  onToggleInspector,
  onSaveRun,
}: {
  lab: LabDefinition;
  scenarioName: string;
  mode: WorkbenchMode;
  runStatus: string;
  isRunning: boolean;
  inspectorOpen: boolean;
  onBackToLabs: () => void;
  onStartRun: () => void;
  onStopRun: () => void;
  onResetRun: () => void;
  onToggleInspector: () => void;
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
        <button type="button" onClick={onToggleInspector} aria-pressed={inspectorOpen}>
          Inspector
        </button>
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
  selectedFieldKey,
  onSelectedFieldKeyChange,
}: {
  lab: LabDefinition;
  frame: SimulationFrame | null;
  workbench: WorkbenchState;
  selectedFieldKey: string;
  onSelectedFieldKeyChange: (fieldKey: string) => void;
}) {
  const normalizedFieldKey = normalizeScientificFieldSelection(frame, selectedFieldKey);
  const fieldOptions = availableScientificFields(frame);
  const viewModel = buildScientificFieldViewModel(frame, normalizedFieldKey);

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
      <div className="stage-toolbar">
        <label className="field-selector">
          <span>Field</span>
          <select
            aria-label="Scientific field"
            value={normalizedFieldKey}
            onChange={(event) => onSelectedFieldKeyChange(event.currentTarget.value)}
          >
            {fieldOptions.map((field) => (
              <option key={field.key} value={field.key}>
                {field.label}
              </option>
            ))}
          </select>
        </label>
        <div className="frame-readout" aria-label="Displayed frame readout">
          <span>Frame {frame ? workbench.displayedFrameIndex + 1 : 0} / {workbench.frames.length}</span>
          <strong>{formatSeconds(frame?.time_seconds)}</strong>
        </div>
      </div>

      {viewModel ? (
        <div className="scientific-field-shell">
          <svg
            className="scientific-field-view"
            viewBox={`0 0 ${viewModel.columns} ${viewModel.rows}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={`${viewModel.summary.truth.label}: ${viewModel.field.metadata.display_name} at ${formatSeconds(
              viewModel.frame.time_seconds,
            )}`}
          >
            <title>{viewModel.field.metadata.display_name}</title>
            {viewModel.cells.map((cell) => (
              <rect
                key={`${cell.row}-${cell.column}`}
                x={cell.column}
                y={viewModel.rows - cell.row - 1}
                width="1"
                height="1"
                fill={cell.color}
                data-field-key={viewModel.fieldKey}
                data-value={cell.displayValue}
              />
            ))}
          </svg>
          <div className="field-legend" aria-label="Field legend">
            <span>{formatLegendValue(viewModel.range.min, viewModel.summary.unit)}</span>
            <span className="legend-ramp" />
            <span>{formatLegendValue(viewModel.range.max, viewModel.summary.unit)}</span>
          </div>
        </div>
      ) : (
        <div className="stage-empty-state" aria-label={`${lab.name} no-frame state`}>
          <strong>No frame displayed yet.</strong>
          <p>Run Fair-Weather Cumulus to stream solver fields into this scientific 2-D view.</p>
        </div>
      )}
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
          <dt>{viewModel?.summary.label ?? "Field max"}</dt>
          <dd>
            {viewModel ? `${viewModel.summary.value} ${viewModel.summary.unit}` : "unavailable"}
          </dd>
        </div>
        <div>
          <dt>Scaling</dt>
          <dd>{viewModel ? `${viewModel.scaling.scale} / ${viewModel.scaling.range}` : "unavailable"}</dd>
        </div>
      </dl>
      {viewModel?.summary.helper ? <p className="stage-helper">{viewModel.summary.helper}</p> : null}
      <div className="truth-label-row" aria-label="Truth and approximation labels">
        <span className="truth-label">{viewModel?.truth.label ?? "Solver output"}</span>
        <span className="truth-label">{viewModel?.solverTruth.label ?? "Experimental"} 2-D dynamics</span>
        <span className="truth-label">Simplified warm-cloud condensation</span>
      </div>
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
      <p className="truth-label">Derived diagnostic</p>
      <ul>
        {summary.diagnostics.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>

      <h3>Profile / sounding</h3>
      <p>{summary.profileSummary}</p>
      {summary.profileRows.length > 0 ? (
        <table className="profile-table">
          <thead>
            <tr>
              <th>Height</th>
              <th>Temp</th>
              <th>Vapor</th>
              <th>Cloud</th>
              <th>W</th>
            </tr>
          </thead>
          <tbody>
            {summary.profileRows.map((row) => (
              <tr key={row.heightM}>
                <td>{formatMeters(row.heightM)}</td>
                <td>{formatNullable(row.temperatureC, "deg C")}</td>
                <td>{formatNullable(row.waterVaporKgPerKg, "kg/kg")}</td>
                <td>{formatNullable(row.cloudWaterKgPerKg, "kg/kg")}</td>
                <td>{formatNullable(row.verticalVelocityMPerS, "m/s")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="empty-diagnostic">Profile / sounding unavailable until a frame is displayed.</p>
      )}

      <h3>Probe</h3>
      <p className="empty-diagnostic">
        Probe values are unavailable until Workbench V2 supports selecting a point in the field.
      </p>

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
          <dt>Actual cloud-base height</dt>
          <dd>{formatMeters(summary.actualCloudBaseM)}</dd>
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
          <dt>Integrated / max cloud water</dt>
          <dd>
            {formatNullable(summary.integratedCloudWaterKgPerKg, "kg/kg")} /{" "}
            {formatNullable(summary.maxCloudWaterKgPerKg, "kg/kg")}
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
          <dt>Boundary cloud fraction</dt>
          <dd>{formatFraction(summary.boundaryCloudFraction)}</dd>
        </div>
        <div>
          <dt>Return-flow warning</dt>
          <dd>{summary.returnFlowWarning}</dd>
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

function formatFraction(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "unavailable";
  }

  return `${Math.round(value * 100)}%`;
}

function formatNullable(value: number | null, unit: string): string {
  if (value === null || !Number.isFinite(value)) {
    return "unavailable";
  }

  const formatted = Math.abs(value) >= 0.01 && Math.abs(value) < 1_000
    ? value.toFixed(2)
    : value.toExponential(2);
  return `${formatted} ${unit}`;
}

function formatLegendValue(value: number, unit: string): string {
  if (!Number.isFinite(value)) {
    return `unavailable ${unit}`;
  }

  const formatted = Math.abs(value) >= 0.01 && Math.abs(value) < 1_000
    ? value.toFixed(2)
    : value.toExponential(2);
  return `${formatted} ${unit}`;
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

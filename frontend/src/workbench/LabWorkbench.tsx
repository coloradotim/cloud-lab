import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";

import { CLOUD_OPTICS_BEAUTY_LAB_ID } from "../labs/labCatalog";
import {
  buildCloudOpticsDiagnostics,
  CLOUD_OPTICS_HONESTY_LABELS,
} from "../labs/cloudOpticsDiagnostics";
import {
  cloudOpticsSceneStats,
  generateCloudOpticsScene,
  type CloudOpticsScene,
  type CloudOpticsSceneControls,
  type CloudOpticsSceneId,
} from "../labs/cloudOpticsScenes";
import {
  renderCloudOpticsScene,
  updateCloudOpticsControls,
  type CloudOpticsViewMode,
} from "../labs/cloudOpticsRenderer";
import type { LabDefinition } from "../labs/labTypes";
import { CONTROL_LIMITS, SURFACE_HEATING_PATTERNS } from "../simulationControls";
import { defaultWorkbenchRunClient, type RunStreamCleanup, type WorkbenchRunClient } from "../simulation/runClient";
import type { SimulationFrame } from "../simulationTypes";
import {
  WORKBENCH_RESOLUTION_PRESETS,
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
  const [cloudOpticsControls, setCloudOpticsControls] =
    useState<CloudOpticsSceneControls | null>(() => defaultCloudOpticsControls(lab.scenarios[0]?.id));
  const [cloudOpticsViewMode, setCloudOpticsViewMode] =
    useState<CloudOpticsViewMode>("rendered-cloud-appearance");
  const [selectedFieldKey, setSelectedFieldKey] = useState(defaultScientificFieldKey(null));
  const [inspectorOpen, setInspectorOpen] = useState(initialInspectorOpen);
  const cleanupRef = useRef<RunStreamCleanup | null>(null);
  const scenario = selectedLabScenario(lab, workbench);
  const currentFrame = displayedFrame(workbench);
  const inspector = useMemo(() => buildWorkbenchInspectorSummary(workbench), [workbench]);
  const replayEvents = useMemo(() => workbenchReplayEvents(workbench), [workbench]);
  const canRun = lab.supportedPhysicsCore !== null;

  useEffect(() => {
    setWorkbench(createInitialWorkbenchState(lab));
    setCloudOpticsControls(defaultCloudOpticsControls(lab.scenarios[0]?.id));
    setCloudOpticsViewMode("rendered-cloud-appearance");
    setSelectedFieldKey(defaultScientificFieldKey(null));
    return () => cleanupRef.current?.();
  }, [lab]);

  async function handleStartRun() {
    if (!canRun) {
      setWorkbench((current) =>
        markWorkbenchRunError(current, "This lab uses interactive preset scenes; backend run flow is not needed yet."),
      );
      return;
    }

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
        canRun={canRun}
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
        <LabSetupPanel
          lab={lab}
          workbench={workbench}
          setWorkbench={setWorkbench}
          cloudOpticsControls={cloudOpticsControls}
          setCloudOpticsControls={setCloudOpticsControls}
        />
        <VisualizationStage
          lab={lab}
          frame={currentFrame}
          workbench={workbench}
          cloudOpticsControls={cloudOpticsControls}
          cloudOpticsViewMode={cloudOpticsViewMode}
          onCloudOpticsViewModeChange={setCloudOpticsViewMode}
          selectedFieldKey={selectedFieldKey}
          onSelectedFieldKeyChange={setSelectedFieldKey}
        />
        {inspectorOpen ? (
          <InspectorPanel
            lab={lab}
            summary={inspector}
            workbench={workbench}
            cloudOpticsControls={cloudOpticsControls}
            cloudOpticsViewMode={cloudOpticsViewMode}
            saveMessage={workbench.saveMessage}
          />
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
  canRun,
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
  canRun: boolean;
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
        <button
          type="button"
          onClick={onStartRun}
          disabled={isRunning || !canRun}
          title={canRun ? undefined : "Renderer/run flow is intentionally deferred for this lab shell."}
        >
          Run
        </button>
        <button type="button" onClick={onStopRun} disabled={!isRunning || !canRun}>
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
  cloudOpticsControls,
  setCloudOpticsControls,
}: {
  lab: LabDefinition;
  workbench: WorkbenchState;
  setWorkbench: Dispatch<SetStateAction<WorkbenchState>>;
  cloudOpticsControls: CloudOpticsSceneControls | null;
  setCloudOpticsControls: Dispatch<SetStateAction<CloudOpticsSceneControls | null>>;
}) {
  const scenario = selectedLabScenario(lab, workbench);
  const config = workbench.nextRunConfig;

  if (lab.id === CLOUD_OPTICS_BEAUTY_LAB_ID) {
    return (
      <CloudOpticsSetupPanel
        lab={lab}
        workbench={workbench}
        setWorkbench={setWorkbench}
        controls={cloudOpticsControls}
        setControls={setCloudOpticsControls}
      />
    );
  }

  return (
    <aside className="workbench-region setup-region" aria-labelledby="setup-region-title">
      <p className="region-label">Setup</p>
      <h2 id="setup-region-title">{scenario?.name ?? "Scenario"}</h2>

      <section className="setup-control-section" aria-labelledby="setup-scenario-title">
        <h3 id="setup-scenario-title">Scenario</h3>
        <label className="control-group">
          <span>Scenario</span>
          <select
            value={workbench.selectedScenarioId}
            onChange={(event) => {
              const scenarioId = event.currentTarget.value;
              setWorkbench((current) =>
                selectWorkbenchScenario(current, lab, scenarioId),
              );
            }}
          >
            {lab.scenarios.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
        </label>
        <p>{scenario?.intendedPhenomenon ?? lab.question}</p>
        <p className="setup-expectation">{scenario?.expectedBehavior}</p>
      </section>

      <section className="setup-control-section" aria-labelledby="setup-forcing-title">
        <h3 id="setup-forcing-title">Surface forcing</h3>
        <div className="workbench-control-grid" aria-label="Surface forcing controls">
          <NumberControl
            id="surface-heating-strength"
            label="Surface heating strength"
            value={config.surface_heating.max_warming_rate_k_per_s}
            min={CONTROL_LIMITS.surfaceHeatingRate.min}
            max={CONTROL_LIMITS.surfaceHeatingRate.max}
            step={CONTROL_LIMITS.surfaceHeatingRate.step}
            suffix="K/s"
            setWorkbench={setWorkbench}
          />
          <SelectControl
            id="surface-heating-pattern"
            label="Surface heating pattern"
            value={config.surface_heating.pattern ?? "single_patch"}
            options={SURFACE_HEATING_PATTERNS.map((pattern) => ({
              value: pattern.value,
              label: pattern.label,
            }))}
            setWorkbench={setWorkbench}
          />
        </div>
      </section>

      <section className="setup-control-section" aria-labelledby="setup-atmosphere-title">
        <h3 id="setup-atmosphere-title">Atmosphere</h3>
        <div className="workbench-control-grid" aria-label="Atmosphere controls">
          <NumberControl
            id="source-layer-humidity"
            label="Source-layer humidity"
            value={config.initial_atmosphere.relative_humidity}
            min={CONTROL_LIMITS.relativeHumidity.min}
            max={CONTROL_LIMITS.relativeHumidity.max}
            step={CONTROL_LIMITS.relativeHumidity.step}
            suffix="RH"
            setWorkbench={setWorkbench}
          />
          <NumberControl
            id="free-atmosphere-humidity"
            label="Free-atmosphere humidity"
            value={config.initial_atmosphere.free_atmosphere_relative_humidity ?? 0.55}
            min={CONTROL_LIMITS.relativeHumidity.min}
            max={CONTROL_LIMITS.relativeHumidity.max}
            step={CONTROL_LIMITS.relativeHumidity.step}
            suffix="RH"
            setWorkbench={setWorkbench}
          />
          <NumberControl
            id="stability-lapse-rate"
            label="Stability / lapse rate"
            value={config.initial_atmosphere.lapse_rate_k_per_m}
            min={CONTROL_LIMITS.lapseRate.min}
            max={CONTROL_LIMITS.lapseRate.max}
            step={CONTROL_LIMITS.lapseRate.step}
            suffix="K/m"
            setWorkbench={setWorkbench}
          />
          <NumberControl
            id="boundary-layer-depth-cap-height"
            label="Boundary-layer depth / cap height"
            value={config.initial_atmosphere.boundary_layer_depth_m}
            min={CONTROL_LIMITS.boundaryLayerDepth.min}
            max={CONTROL_LIMITS.boundaryLayerDepth.max}
            step={CONTROL_LIMITS.boundaryLayerDepth.step}
            suffix="m"
            setWorkbench={setWorkbench}
          />
        </div>
      </section>

      <section className="setup-control-section" aria-labelledby="setup-model-title">
        <h3 id="setup-model-title">Model setup</h3>
        <p className="model-setup-summary">
          Modeling a {config.domain.width_m.toLocaleString()} m wide by{" "}
          {config.domain.height_m.toLocaleString()} m tall slice at{" "}
          {resolutionLabel(workbench.modelResolutionSlug).toLowerCase()} resolution.
        </p>
        <div className="workbench-control-grid" aria-label="Model setup controls">
          <SelectControl
            id="model-resolution"
            label="Model resolution"
            value={workbench.modelResolutionSlug}
            options={WORKBENCH_RESOLUTION_PRESETS.map((preset) => ({
              value: preset.slug,
              label: preset.name,
            }))}
            setWorkbench={setWorkbench}
          />
          <NumberControl
            id="domain-width"
            label="Domain width"
            value={config.domain.width_m}
            min={CONTROL_LIMITS.domainWidth.min}
            max={CONTROL_LIMITS.domainWidth.max}
            step={CONTROL_LIMITS.domainWidth.step}
            suffix="m"
            setWorkbench={setWorkbench}
          />
          <NumberControl
            id="domain-height"
            label="Domain height"
            value={config.domain.height_m}
            min={CONTROL_LIMITS.domainHeight.min}
            max={CONTROL_LIMITS.domainHeight.max}
            step={CONTROL_LIMITS.domainHeight.step}
            suffix="m"
            setWorkbench={setWorkbench}
          />
          <NumberControl
            id="run-length"
            label="Run length"
            value={config.time.duration_seconds}
            min={CONTROL_LIMITS.duration.min}
            max={CONTROL_LIMITS.duration.max}
            step={CONTROL_LIMITS.duration.step}
            suffix="s"
            setWorkbench={setWorkbench}
          />
        </div>
      </section>
    </aside>
  );
}

function CloudOpticsSetupPanel({
  lab,
  workbench,
  setWorkbench,
  controls,
  setControls,
}: {
  lab: LabDefinition;
  workbench: WorkbenchState;
  setWorkbench: Dispatch<SetStateAction<WorkbenchState>>;
  controls: CloudOpticsSceneControls | null;
  setControls: Dispatch<SetStateAction<CloudOpticsSceneControls | null>>;
}) {
  const scenario = selectedLabScenario(lab, workbench);
  const primaryControls = lab.controls.filter((control) => control.tier === "primary");
  const scene = cloudOpticsSceneForScenario(scenario?.id);
  const activeControls = controls ?? scene?.defaultControls ?? null;

  return (
    <aside className="workbench-region setup-region" aria-labelledby="setup-region-title">
      <p className="region-label">Setup</p>
      <h2 id="setup-region-title">{scenario?.name ?? "Cloud optics scene"}</h2>

      <section className="setup-control-section" aria-labelledby="setup-scenario-title">
        <h3 id="setup-scenario-title">Scenario</h3>
        <label className="control-group">
          <span>Scenario</span>
          <select
            value={workbench.selectedScenarioId}
            onChange={(event) => {
              const scenarioId = event.currentTarget.value;
              setWorkbench((current) =>
                selectWorkbenchScenario(current, lab, scenarioId),
              );
              setControls(defaultCloudOpticsControls(scenarioId));
            }}
          >
            {lab.scenarios.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
        </label>
        <p>{scenario?.intendedPhenomenon ?? lab.question}</p>
        <p className="setup-expectation">{scenario?.expectedBehavior}</p>
      </section>

      <section className="setup-control-section" aria-labelledby="setup-light-title">
        <h3 id="setup-light-title">Light and view</h3>
        <div className="workbench-control-grid" aria-label="Cloud optics light controls">
          {primaryControls.slice(1, 4).map((control) => (
            <CloudOpticsControl
              key={control.id}
              control={control}
              controls={activeControls}
              setControls={setControls}
            />
          ))}
        </div>
      </section>

      <section className="setup-control-section" aria-labelledby="setup-cloud-title">
        <h3 id="setup-cloud-title">Cloud and optics</h3>
        <div className="workbench-control-grid" aria-label="Cloud optics material controls">
          <CloudOpticsControl
            control={primaryControls[0]}
            controls={activeControls}
            setControls={setControls}
          />
          {primaryControls.slice(4).map((control) => (
            <CloudOpticsControl
              key={control.id}
              control={control}
              controls={activeControls}
              setControls={setControls}
            />
          ))}
        </div>
      </section>

      <p className="workbench-message">
        Renderer controls adjust the visual interpretation only; the deterministic source scene
        field stays unchanged.
      </p>
    </aside>
  );
}

function CloudOpticsControl({
  control,
  controls,
  setControls,
}: {
  control: LabDefinition["controls"][number] | undefined;
  controls: CloudOpticsSceneControls | null;
  setControls: Dispatch<SetStateAction<CloudOpticsSceneControls | null>>;
}) {
  if (!control || !controls) {
    return null;
  }

  const controlKey = cloudOpticsControlKey(control.id);
  if (!controlKey) {
    return null;
  }

  if (control.id === "cloud-scene") {
    return (
      <label className="control-group control-group-disabled">
        <span>{control.label}</span>
        <input value={cloudOpticsControlValue(control.id, controls)} readOnly disabled />
        <small>{control.unitsOrType}</small>
      </label>
    );
  }

  if (control.id === "time-of-day-light-color") {
    return (
      <label className="control-group">
        <span>{control.label}</span>
        <select
          value={controls.lightColorPreset}
          onChange={(event) => {
            const nextValue = event.currentTarget.value;
            setControls((current) =>
              current ? updateCloudOpticsControls(current, "lightColorPreset", nextValue) : current,
            );
          }}
        >
          <option value="midday">midday</option>
          <option value="golden-hour">golden-hour</option>
          <option value="cool-haze">cool-haze</option>
        </select>
        <small>{control.unitsOrType}</small>
      </label>
    );
  }

  return (
    <label className="control-group">
      <span>{control.label}</span>
      <input
        type="number"
        value={controls[controlKey] as number}
        min={cloudOpticsControlRange(control.id).min}
        max={cloudOpticsControlRange(control.id).max}
        step={cloudOpticsControlRange(control.id).step}
        onChange={(event) => {
          const nextValue = event.currentTarget.value;
          setControls((current) =>
            current
              ? updateCloudOpticsControls(current, controlKey, nextValue)
              : current,
          );
        }}
      />
      <small>{control.unitsOrType}</small>
    </label>
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
        onChange={(event) => {
          const nextValue = Number(event.currentTarget.value);
          setWorkbench((current) => updateWorkbenchControl(current, id, nextValue));
        }}
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
        onChange={(event) => {
          const nextValue = event.currentTarget.value;
          setWorkbench((current) => updateWorkbenchControl(current, id, nextValue));
        }}
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
  cloudOpticsControls,
  cloudOpticsViewMode,
  onCloudOpticsViewModeChange,
  selectedFieldKey,
  onSelectedFieldKeyChange,
}: {
  lab: LabDefinition;
  frame: SimulationFrame | null;
  workbench: WorkbenchState;
  cloudOpticsControls: CloudOpticsSceneControls | null;
  cloudOpticsViewMode: CloudOpticsViewMode;
  onCloudOpticsViewModeChange: (mode: CloudOpticsViewMode) => void;
  selectedFieldKey: string;
  onSelectedFieldKeyChange: (fieldKey: string) => void;
}) {
  if (lab.id === CLOUD_OPTICS_BEAUTY_LAB_ID) {
    return (
      <CloudOpticsVisualizationStage
        lab={lab}
        workbench={workbench}
        controls={cloudOpticsControls}
        viewMode={cloudOpticsViewMode}
        onViewModeChange={onCloudOpticsViewModeChange}
      />
    );
  }

  const normalizedFieldKey = normalizeScientificFieldSelection(frame, selectedFieldKey);
  const fieldOptions = availableScientificFields(frame);
  const viewModel = buildScientificFieldViewModel(frame, normalizedFieldKey);
  const domain = frame?.config?.domain ?? workbench.nextRunConfig.domain;
  const activeFieldLabel = viewModel
    ? `${viewModel.field.metadata.display_name} - ${viewModel.summary.unit}`
    : `${fieldOptions.find((field) => field.key === normalizedFieldKey)?.label ?? "Cloud liquid water"} - kg/kg`;

  return (
    <section
      className="workbench-region visualization-stage"
      aria-labelledby="visualization-stage-title"
    >
      <div className="stage-heading">
        <p className="region-label">Visualization stage</p>
        <div className="stage-title-row">
          <h2 id="visualization-stage-title">Scientific 2-D field view</h2>
          <div className="frame-readout" aria-label="Displayed frame readout">
            <span>Frame {frame ? workbench.displayedFrameIndex + 1 : 0} / {workbench.frames.length}</span>
            <strong>{formatSeconds(frame?.time_seconds)}</strong>
          </div>
        </div>
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
        <p className="field-scale-title">{activeFieldLabel}</p>
      </div>

      {viewModel ? (
        <div className="scientific-field-shell">
          <div className="scientific-plot-frame">
            <span className="axis-label axis-label-y">Height, z (m)</span>
            <AxisTicks orientation="y" maxValue={domain.height_m} />
            <div className="scientific-plot-area">
              <AxisGrid orientation="x" maxValue={domain.width_m} />
              <AxisGrid orientation="y" maxValue={domain.height_m} />
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
            </div>
            <AxisTicks orientation="x" maxValue={domain.width_m} />
            <span className="axis-label axis-label-x">Horizontal distance, x (m)</span>
          </div>
          <div className="field-legend" aria-label="Field legend">
            <strong>{activeFieldLabel}</strong>
            <span>{formatLegendValue(viewModel.range.min, viewModel.summary.unit)}</span>
            <span className="legend-ramp" />
            <span>{formatLegendValue(viewModel.range.max, viewModel.summary.unit)}</span>
          </div>
        </div>
      ) : (
        <div className="scientific-field-shell">
          <div className="scientific-plot-frame">
            <span className="axis-label axis-label-y">Height, z (m)</span>
            <AxisTicks orientation="y" maxValue={domain.height_m} />
            <div className="scientific-plot-area">
              <AxisGrid orientation="x" maxValue={domain.width_m} />
              <AxisGrid orientation="y" maxValue={domain.height_m} />
              <div className="stage-empty-state" aria-label={`${lab.name} no-frame state`}>
                <strong>No frame displayed yet.</strong>
                <p>Run Fair-Weather Cumulus to stream solver fields into this scientific 2-D view.</p>
              </div>
            </div>
            <AxisTicks orientation="x" maxValue={domain.width_m} />
            <span className="axis-label axis-label-x">Horizontal distance, x (m)</span>
          </div>
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
      <div className="assumption-labels" aria-label="Model assumptions">
        <span>Model assumptions</span>
        <p>
          {viewModel?.truth.label ?? "Solver output"} ·{" "}
          {viewModel?.solverTruth.label ?? "Experimental"} 2-D dynamics ·{" "}
          Simplified warm-cloud condensation
        </p>
      </div>
      {workbench.run.message ? <p className="workbench-message">{workbench.run.message}</p> : null}
    </section>
  );
}

function CloudOpticsVisualizationStage({
  lab,
  workbench,
  controls,
  viewMode,
  onViewModeChange,
}: {
  lab: LabDefinition;
  workbench: WorkbenchState;
  controls: CloudOpticsSceneControls | null;
  viewMode: CloudOpticsViewMode;
  onViewModeChange: (mode: CloudOpticsViewMode) => void;
}) {
  const scenario = selectedLabScenario(lab, workbench);
  const scene = cloudOpticsSceneForScenario(scenario?.id);
  const activeControls = controls ?? scene?.defaultControls ?? null;
  const renderModel = scene && activeControls
    ? renderCloudOpticsScene(scene, activeControls, viewMode)
    : null;
  const stats = scene ? cloudOpticsSceneStats(scene) : null;

  return (
    <section
      className="workbench-region visualization-stage cloud-optics-stage"
      aria-labelledby="visualization-stage-title"
    >
      <div className="stage-heading">
        <p className="region-label">Visualization stage</p>
        <div className="stage-title-row">
          <h2 id="visualization-stage-title">{cloudOpticsViewLabel(viewMode)}</h2>
          <div className="frame-readout" aria-label="Displayed frame readout">
            <span>{renderModel?.summary.lightGeometry ?? "Renderer"}</span>
            <strong>{renderModel?.summary.opticalState ?? "unavailable"}</strong>
          </div>
        </div>
      </div>
      <div className="stage-toolbar">
        <label className="field-selector">
          <span>View</span>
          <select
            aria-label="Cloud optics view"
            value={viewMode}
            onChange={(event) => onViewModeChange(event.currentTarget.value as CloudOpticsViewMode)}
          >
            <option value="rendered-cloud-appearance">Rendered cloud appearance view</option>
            <option value="cloud-water-field">Cloud water field view</option>
            <option value="optical-depth">Optical depth view</option>
            <option value="light-path-shadow">Light path / shadow view</option>
          </select>
        </label>
        <p className="field-scale-title">Visual approximation - bulk optical approximation</p>
      </div>

      <div
        className={`optics-renderer optics-renderer-${viewMode}`}
        aria-label={`${lab.name} ${cloudOpticsViewLabel(viewMode)}`}
      >
        {renderModel ? (
          <svg
            className="optics-renderer-svg"
            viewBox={`0 0 ${renderModel.columns} ${renderModel.rows}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={`${cloudOpticsViewLabel(viewMode)} for ${renderModel.scene.name}`}
          >
            <title>{cloudOpticsViewLabel(viewMode)}</title>
            {renderModel.cells.map((cell) => (
              <rect
                key={`${cell.row}-${cell.column}`}
                x={cell.column}
                y={renderModel.rows - cell.row - 1}
                width="1"
                height="1"
                fill={cell.fill}
                data-optical-depth={cell.opticalDepth.toFixed(3)}
                data-source-density={cell.sourceDensity.toFixed(3)}
              />
            ))}
          </svg>
        ) : (
          <div className="stage-empty-state">
            <strong>No scene available.</strong>
            <p>Select a Clouds, Light, and Shadow scenario to render its source field.</p>
          </div>
        )}
      </div>

      <dl className="stage-stats">
        <div>
          <dt>Cloud scene</dt>
          <dd>{scene?.name ?? "unavailable"}</dd>
        </div>
        <div>
          <dt>Source grid</dt>
          <dd>{scene ? `${scene.grid.columns} x ${scene.grid.rows}` : "unavailable"}</dd>
        </div>
        <div>
          <dt>Max optical depth</dt>
          <dd>{renderModel ? renderModel.summary.maxOpticalDepth.toFixed(2) : "unavailable"}</dd>
        </div>
        <div>
          <dt>Mean shadow</dt>
          <dd>{renderModel ? `${Math.round(renderModel.summary.meanShadow * 100)}%` : "unavailable"}</dd>
        </div>
      </dl>
      <p className="stage-helper">
        {stats
          ? `${scene?.name} source field: ${stats.nonzeroCellCount} nonzero cells, max density ${stats.maxDensity.toFixed(2)}.`
          : "Scene source field unavailable."}
      </p>

      <div className="assumption-labels" aria-label="Model assumptions">
        <span>Model assumptions</span>
        <p>{CLOUD_OPTICS_HONESTY_LABELS.join(" · ")}</p>
      </div>
      {workbench.run.message ? <p className="workbench-message">{workbench.run.message}</p> : null}
    </section>
  );
}

function AxisGrid({
  orientation,
  maxValue,
}: {
  orientation: "x" | "y";
  maxValue: number;
}) {
  return (
    <>
      {buildAxisTicks(maxValue).map((tick) => {
        const position = `${tick.percent}%`;
        const style =
          orientation === "x"
            ? { left: position }
            : { bottom: position };

        return (
          <span
            key={`${orientation}-grid-${tick.value}`}
            className={`plot-gridline plot-gridline-${orientation}`}
            style={style}
            aria-hidden="true"
          />
        );
      })}
    </>
  );
}

function AxisTicks({
  orientation,
  maxValue,
}: {
  orientation: "x" | "y";
  maxValue: number;
}) {
  const ticks = buildAxisTicks(maxValue);

  return (
    <div className={`axis-ticks axis-ticks-${orientation}`} aria-hidden="true">
      {ticks.map((tick) => {
        const position = `${tick.percent}%`;
        const style =
          orientation === "x"
            ? { left: position }
            : { bottom: position };

        return (
          <span key={`${orientation}-tick-${tick.value}`} className="axis-tick" style={style}>
            {formatAxisTick(tick.value)}
          </span>
        );
      })}
    </div>
  );
}

function InspectorPanel({
  lab,
  summary,
  workbench,
  cloudOpticsControls,
  cloudOpticsViewMode,
  saveMessage,
}: {
  lab: LabDefinition;
  summary: ReturnType<typeof buildWorkbenchInspectorSummary>;
  workbench: WorkbenchState;
  cloudOpticsControls: CloudOpticsSceneControls | null;
  cloudOpticsViewMode: CloudOpticsViewMode;
  saveMessage: string | null;
}) {
  if (lab.id === CLOUD_OPTICS_BEAUTY_LAB_ID) {
    return (
      <CloudOpticsInspectorPanel
        lab={lab}
        workbench={workbench}
        controls={cloudOpticsControls}
        viewMode={cloudOpticsViewMode}
        saveMessage={saveMessage}
      />
    );
  }

  return (
    <aside className="workbench-region inspector-region" aria-labelledby="inspector-region-title">
      <p className="region-label">Inspector</p>
      <section className="inspector-summary" aria-labelledby="inspector-region-title">
        <h2 id="inspector-region-title">Summary</h2>
        <span className={`diagnostic-status diagnostic-status-${summary.diagnostics.status}`}>
          Result: {summary.diagnostics.statusLabel}
        </span>
        <p>{summary.diagnostics.observed}</p>
        <dl className="result-metrics">
          <div>
            <dt>First cloud</dt>
            <dd>
              {formatSeconds(summary.firstCloudTimeSeconds)} near{" "}
              {formatMeters(summary.firstCloudHeightM)}
            </dd>
          </div>
          <div>
            <dt>Expected cloud base</dt>
            <dd>{formatMeters(summary.expectedLclM)}</dd>
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
        </dl>
        <h3>Why this happened</h3>
        <ul>
          {summary.diagnostics.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>

      <details className="inspector-details" open>
        <summary>Diagnostics</summary>
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
      </details>

      <details className="inspector-details">
        <summary>Profile / sounding</summary>
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
      </details>

      <details className="inspector-details">
        <summary>Probe</summary>
        <p className="empty-diagnostic">
          Probe values are unavailable until Workbench V2 supports selecting a point in the field.
        </p>
      </details>

      <details className="inspector-details">
        <summary>Assumptions & limitations</summary>
        <p className="assumption-copy">
          Derived diagnostic · Solver output · Experimental 2-D dynamics · Simplified warm-cloud
          condensation · {lab.limitations[0]}
        </p>
      </details>
      {saveMessage ? <p className="workbench-message">{saveMessage}</p> : null}
    </aside>
  );
}

function CloudOpticsInspectorPanel({
  lab,
  workbench,
  controls,
  viewMode,
  saveMessage,
}: {
  lab: LabDefinition;
  workbench: WorkbenchState;
  controls: CloudOpticsSceneControls | null;
  viewMode: CloudOpticsViewMode;
  saveMessage: string | null;
}) {
  const scenario = selectedLabScenario(lab, workbench);
  const scene = cloudOpticsSceneForScenario(scenario?.id);
  const activeControls = controls ?? scene?.defaultControls ?? null;
  const renderModel = scene && activeControls
    ? renderCloudOpticsScene(scene, activeControls, viewMode)
    : null;
  const diagnostics = scene && renderModel
    ? buildCloudOpticsDiagnostics(scene, renderModel, CLOUD_OPTICS_HONESTY_LABELS)
    : null;
  const stats = scene ? cloudOpticsSceneStats(scene) : null;

  return (
    <aside className="workbench-region inspector-region" aria-labelledby="inspector-region-title">
      <p className="region-label">Inspector</p>
      <section className="inspector-summary" aria-labelledby="inspector-region-title">
        <h2 id="inspector-region-title">Summary</h2>
        <span className="diagnostic-status diagnostic-status-warning">
          Result: visual approximation
        </span>
        <p>
          {diagnostics
            ? `${diagnostics.opticalDepthEstimate.explanation} ${diagnostics.brightEdgeLikelihood.explanation}`
            : "This lab uses deterministic preset source fields, renderer controls, and explicit approximation labels."}
        </p>
      </section>

      <details className="inspector-details" open>
        <summary>Source scene field</summary>
        <dl className="diagnostic-list">
          <div>
            <dt>Schema</dt>
            <dd>{scene?.schema_version ?? "unavailable"}</dd>
          </div>
          <div>
            <dt>Field</dt>
            <dd>{scene?.sourceField.displayName ?? "unavailable"}</dd>
          </div>
          <div>
            <dt>Grid</dt>
            <dd>
              {scene ? `${scene.grid.columns} columns x ${scene.grid.rows} rows` : "unavailable"}
            </dd>
          </div>
          <div>
            <dt>Nonzero cells</dt>
            <dd>{stats?.nonzeroCellCount ?? "unavailable"}</dd>
          </div>
        </dl>
      </details>

      <details className="inspector-details" open>
        <summary>Optics diagnostics</summary>
        <dl className="diagnostic-list">
          {diagnostics ? diagnostics.entries.map((diagnostic) => (
            <div key={diagnostic.label}>
              <dt>{diagnostic.label}</dt>
              <dd>
                <strong>{diagnostic.state}</strong> - {diagnostic.explanation}
              </dd>
            </div>
          )) : lab.diagnostics.map((diagnostic) => (
            <div key={diagnostic.id}>
              <dt>{diagnostic.label}</dt>
              <dd>{diagnostic.purpose}</dd>
            </div>
          ))}
        </dl>
      </details>

      <details className="inspector-details" open>
        <summary>Visualization modes</summary>
        <ul>
          {lab.visualizationModes.map((mode) => (
            <li key={mode.id}>
              <strong>{mode.name}:</strong> {mode.description}
            </li>
          ))}
        </ul>
      </details>

      <details className="inspector-details">
        <summary>Assumptions & limitations</summary>
        <p className="assumption-copy">{CLOUD_OPTICS_HONESTY_LABELS.join(" · ")} · {lab.limitations.join(" · ")}</p>
      </details>
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
        onChange={(event) => {
          const frameIndex = Number(event.currentTarget.value);
          setWorkbench((current) =>
            setWorkbenchDisplayedFrame(current, frameIndex),
          );
        }}
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

function buildAxisTicks(maxValue: number): Array<{ value: number; percent: number }> {
  if (!Number.isFinite(maxValue) || maxValue <= 0) {
    return [{ value: 0, percent: 0 }];
  }

  const targetIntervals = 5;
  const rawStep = maxValue / targetIntervals;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalizedStep = rawStep / magnitude;
  const niceMultiplier = normalizedStep <= 1 ? 1 : normalizedStep <= 2 ? 2 : normalizedStep <= 5 ? 5 : 10;
  const step = niceMultiplier * magnitude;
  const ticks: Array<{ value: number; percent: number }> = [];

  for (let value = 0; value < maxValue; value += step) {
    ticks.push({ value: Math.round(value), percent: (value / maxValue) * 100 });
  }

  if (ticks[ticks.length - 1]?.value !== maxValue) {
    ticks.push({ value: maxValue, percent: 100 });
  }

  return ticks;
}

function formatAxisTick(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `${Number((value / 1000).toFixed(1))}k`;
  }

  return `${Math.round(value)}`;
}

function cloudOpticsSceneForScenario(scenarioId: string | undefined): CloudOpticsScene | null {
  if (!scenarioId) {
    return null;
  }

  try {
    return generateCloudOpticsScene(scenarioId as CloudOpticsSceneId);
  } catch {
    return null;
  }
}

function defaultCloudOpticsControls(
  scenarioId: string | undefined,
): CloudOpticsSceneControls | null {
  const scene = cloudOpticsSceneForScenario(scenarioId);
  return scene ? { ...scene.defaultControls } : null;
}

function cloudOpticsControlKey(
  controlId: string,
): keyof CloudOpticsSceneControls | null {
  switch (controlId) {
    case "sun-elevation":
      return "sunElevationDegrees";
    case "sun-direction-azimuth":
      return "sunAzimuthDegrees";
    case "view-angle":
      return "viewAngleDegrees";
    case "cloud-water-density":
      return "cloudWaterDensityMultiplier";
    case "cloud-thickness-depth":
      return "cloudDepthMultiplier";
    case "optical-depth-scattering":
      return "opticalDepthMultiplier";
    case "time-of-day-light-color":
      return "lightColorPreset";
    case "cloud-scene":
      return "sceneId";
    default:
      return null;
  }
}

function cloudOpticsControlRange(controlId: string): { min: number; max: number; step: number } {
  switch (controlId) {
    case "sun-elevation":
      return { min: 5, max: 85, step: 1 };
    case "sun-direction-azimuth":
      return { min: 0, max: 360, step: 5 };
    case "view-angle":
      return { min: -60, max: 60, step: 2 };
    case "cloud-water-density":
    case "cloud-thickness-depth":
    case "optical-depth-scattering":
      return { min: 0, max: 2.5, step: 0.05 };
    default:
      return { min: 0, max: 1, step: 0.05 };
  }
}

function cloudOpticsControlValue(
  controlId: string | undefined,
  controls: CloudOpticsSceneControls | null,
): string {
  if (!controlId || !controls) {
    return "Deferred";
  }

  switch (controlId) {
    case "cloud-scene":
      return sceneNameForId(controls.sceneId);
    case "sun-elevation":
      return `${controls.sunElevationDegrees} deg`;
    case "sun-direction-azimuth":
      return `${controls.sunAzimuthDegrees} deg`;
    case "view-angle":
      return `${controls.viewAngleDegrees} deg`;
    case "cloud-water-density":
      return `${controls.cloudWaterDensityMultiplier}x`;
    case "cloud-thickness-depth":
      return `${controls.cloudDepthMultiplier}x`;
    case "optical-depth-scattering":
      return `${controls.opticalDepthMultiplier}x`;
    case "time-of-day-light-color":
      return controls.lightColorPreset;
    default:
      return "Deferred";
  }
}

function sceneNameForId(sceneId: CloudOpticsSceneId): string {
  return cloudOpticsSceneForScenario(sceneId)?.name ?? sceneId;
}

function cloudOpticsViewLabel(viewMode: CloudOpticsViewMode): string {
  switch (viewMode) {
    case "rendered-cloud-appearance":
      return "Rendered cloud appearance view";
    case "cloud-water-field":
      return "Cloud water field view";
    case "optical-depth":
      return "Optical depth view";
    case "light-path-shadow":
      return "Light path / shadow view";
  }
}

function resolutionLabel(value: string): string {
  return WORKBENCH_RESOLUTION_PRESETS.find((preset) => preset.slug === value)?.name ?? "Medium";
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

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";

import { CLOUD_OPTICS_BEAUTY_LAB_ID, EVOLVING_BOUNDARY_LAYER_LAB_ID } from "../labs/labCatalog";
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
import {
  boundaryLayer1DScenarioForId,
  boundaryLayerDisplayedFrame,
  boundaryLayerPreviewFrame,
  createInitialBoundaryLayer1DState,
  defaultBoundaryLayer1DClient,
  selectBoundaryLayer1DScenario,
  statusLabel,
  updateBoundaryLayer1DControl,
  type BoundaryLayer1DClient,
  type BoundaryLayer1DControlId,
  type BoundaryLayer1DFrame,
  type BoundaryLayer1DState,
} from "../labs/evolvingBoundaryLayer";
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
  boundaryLayerClient?: BoundaryLayer1DClient;
};

export function LabWorkbench({
  lab,
  mode = "single",
  initialInspectorOpen = true,
  onBackToLabs,
  runClient = defaultWorkbenchRunClient,
  boundaryLayerClient = defaultBoundaryLayer1DClient,
}: LabWorkbenchProps) {
  const [workbench, setWorkbench] = useState<WorkbenchState>(() =>
    createInitialWorkbenchState(lab),
  );
  const [cloudOpticsControls, setCloudOpticsControls] =
    useState<CloudOpticsSceneControls | null>(() => defaultCloudOpticsControls(lab.scenarios[0]?.id));
  const [cloudOpticsViewMode, setCloudOpticsViewMode] =
    useState<CloudOpticsViewMode>("rendered-cloud-appearance");
  const [boundaryLayerState, setBoundaryLayerState] = useState<BoundaryLayer1DState>(() =>
    createInitialBoundaryLayer1DState(lab.scenarios[0]?.id),
  );
  const [selectedFieldKey, setSelectedFieldKey] = useState(defaultScientificFieldKey(null));
  const [inspectorOpen, setInspectorOpen] = useState(initialInspectorOpen);
  const cleanupRef = useRef<RunStreamCleanup | null>(null);
  const isBoundaryLayerLab = lab.id === EVOLVING_BOUNDARY_LAYER_LAB_ID;
  const scenario = isBoundaryLayerLab
    ? lab.scenarios.find((candidate) => candidate.id === boundaryLayerState.selectedScenarioId) ?? null
    : selectedLabScenario(lab, workbench);
  const currentFrame = displayedFrame(workbench);
  const boundaryLayerFrame = isBoundaryLayerLab
    ? boundaryLayerDisplayedFrame(boundaryLayerState) ?? boundaryLayerPreviewFrame(boundaryLayerState)
    : null;
  const inspector = useMemo(() => buildWorkbenchInspectorSummary(workbench), [workbench]);
  const replayEvents = useMemo(() => workbenchReplayEvents(workbench), [workbench]);
  const capabilities = lab.capabilities;
  const canRun = capabilities.supportsRun && lab.supportedPhysicsCore !== null;

  useEffect(() => {
    setWorkbench(createInitialWorkbenchState(lab));
    setCloudOpticsControls(defaultCloudOpticsControls(lab.scenarios[0]?.id));
    setCloudOpticsViewMode("rendered-cloud-appearance");
    setBoundaryLayerState(createInitialBoundaryLayer1DState(lab.scenarios[0]?.id));
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

    if (isBoundaryLayerLab) {
      setBoundaryLayerState((current) => ({
        ...current,
        status: "starting",
        message: "Running boundary_layer_1d profile evolution.",
        saveMessage: null,
      }));
      try {
        const run = await boundaryLayerClient.runProfile(boundaryLayerState.config);
        setBoundaryLayerState((current) => ({
          ...current,
          run,
          displayedFrameIndex: Math.max(0, run.frames.length - 1),
          status: "complete",
          message: `Profile run complete with ${run.frames.length} emitted frames.`,
        }));
      } catch (error) {
        setBoundaryLayerState((current) => ({
          ...current,
          status: "error",
          message: error instanceof Error ? error.message : "Unable to run profile model.",
        }));
      }
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
    if (lab.capabilities.supportsStaticControls) {
      setCloudOpticsControls(defaultCloudOpticsControls(scenario?.id));
      setCloudOpticsViewMode("rendered-cloud-appearance");
    }
    if (isBoundaryLayerLab) {
      setBoundaryLayerState(createInitialBoundaryLayer1DState(scenario?.id));
    }
  }

  const runStatus = isBoundaryLayerLab ? boundaryLayerState.status : workbench.run.status;
  const isRunning = runStatus === "starting" || runStatus === "running";

  return (
    <main className="workbench-v2" aria-label={`${lab.name} workbench`}>
      <WorkbenchTopBar
        lab={lab}
        scenarioName={scenario?.name ?? "Scenario coming later"}
        mode={mode}
        runStatus={runStatus}
        isRunning={isRunning}
        canRun={canRun}
        supportsRun={capabilities.supportsRun}
        onBackToLabs={onBackToLabs}
        onStartRun={handleStartRun}
        onStopRun={handleStopRun}
        onResetRun={handleResetRun}
        inspectorOpen={inspectorOpen}
        onToggleInspector={() => setInspectorOpen((current) => !current)}
        onSaveRun={() => {
          if (isBoundaryLayerLab) {
            setBoundaryLayerState((current) => ({
              ...current,
              saveMessage:
                "Profile save/compare artifacts are intentionally deferred from Evolving Boundary Layer v1.",
            }));
            return;
          }
          setWorkbench((current) => saveRunPlaceholder(current));
        }}
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
          boundaryLayerState={boundaryLayerState}
          setBoundaryLayerState={setBoundaryLayerState}
        />
        <VisualizationStage
          lab={lab}
          frame={currentFrame}
          boundaryLayerFrame={boundaryLayerFrame}
          boundaryLayerState={boundaryLayerState}
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
            boundaryLayerState={boundaryLayerState}
            boundaryLayerFrame={boundaryLayerFrame}
            saveMessage={workbench.saveMessage}
          />
        ) : null}
      </section>

      {capabilities.supportsTimeline || capabilities.supportsReplay ? (
        isBoundaryLayerLab ? (
          <BoundaryLayerTimelinePanel
            state={boundaryLayerState}
            setState={setBoundaryLayerState}
          />
        ) : (
          <TimelinePanel
            workbench={workbench}
            replayEvents={replayEvents}
            setWorkbench={setWorkbench}
          />
        )
      ) : null}
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
  supportsRun,
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
  supportsRun: boolean;
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
      <div className="workbench-actions" aria-label="Workbench actions">
        {supportsRun ? (
          <>
            <button
              type="button"
              onClick={onStartRun}
              disabled={isRunning || !canRun}
              title={canRun ? undefined : "Run flow is unavailable for this lab."}
            >
              Run
            </button>
            <button type="button" onClick={onStopRun} disabled={!isRunning || !canRun}>
              Stop
            </button>
          </>
        ) : null}
        <button type="button" onClick={onResetRun}>
          {supportsRun ? "Reset" : "Reset controls"}
        </button>
        {supportsRun ? (
          <span className={`run-state run-state-${runStatus}`}>{runStatusLabel(runStatus)}</span>
        ) : (
          <span className="run-state run-state-idle">Static optics lab</span>
        )}
        <button type="button" onClick={onToggleInspector} aria-pressed={inspectorOpen}>
          Inspector
        </button>
        <button type="button" onClick={onSaveRun}>
          {supportsRun ? "Save" : "Save setup"}
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
  boundaryLayerState,
  setBoundaryLayerState,
}: {
  lab: LabDefinition;
  workbench: WorkbenchState;
  setWorkbench: Dispatch<SetStateAction<WorkbenchState>>;
  cloudOpticsControls: CloudOpticsSceneControls | null;
  setCloudOpticsControls: Dispatch<SetStateAction<CloudOpticsSceneControls | null>>;
  boundaryLayerState: BoundaryLayer1DState;
  setBoundaryLayerState: Dispatch<SetStateAction<BoundaryLayer1DState>>;
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

  if (lab.id === EVOLVING_BOUNDARY_LAYER_LAB_ID) {
    return (
      <BoundaryLayerSetupPanel
        lab={lab}
        state={boundaryLayerState}
        setState={setBoundaryLayerState}
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

function BoundaryLayerSetupPanel({
  lab,
  state,
  setState,
}: {
  lab: LabDefinition;
  state: BoundaryLayer1DState;
  setState: Dispatch<SetStateAction<BoundaryLayer1DState>>;
}) {
  const scenario = lab.scenarios.find((candidate) => candidate.id === state.selectedScenarioId);
  const preset = boundaryLayer1DScenarioForId(state.selectedScenarioId);

  return (
    <aside className="workbench-region setup-region" aria-labelledby="setup-region-title">
      <p className="region-label">Setup</p>
      <h2 id="setup-region-title">{scenario?.name ?? "Boundary-layer scenario"}</h2>

      <section className="setup-control-section" aria-labelledby="setup-scenario-title">
        <h3 id="setup-scenario-title">Scenario</h3>
        <label className="control-group">
          <span>Scenario</span>
          <select
            value={state.selectedScenarioId}
            onChange={(event) =>
              setState((current) =>
                selectBoundaryLayer1DScenario(current, event.currentTarget.value),
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
        <p>{scenario?.intendedPhenomenon ?? lab.question}</p>
        <p className="setup-expectation">{scenario?.expectedBehavior}</p>
        <p className="model-setup-summary">
          Simplified 1-D profile evolution. V1 diagnoses cloud formation potential. It does not produce cloud water.
        </p>
        {preset?.expected_status ? (
          <p className="control-helper">Expected diagnostic: {statusLabel(preset.expected_status)}.</p>
        ) : null}
      </section>

      <section className="setup-control-section" aria-labelledby="setup-profile-forcing-title">
        <h3 id="setup-profile-forcing-title">Surface forcing</h3>
        <div className="workbench-control-grid" aria-label="Boundary-layer surface forcing controls">
          <BoundaryLayerNumberControl
            id="duration_seconds"
            label="Hours from sunrise / duration"
            value={state.config.duration_seconds}
            min={1_800}
            max={28_800}
            step={900}
            formatValue={(value) => `${(value / 3_600).toFixed(1)} h`}
            setState={setState}
          />
          <BoundaryLayerNumberControl
            id="surface_heating_strength"
            label="Surface heating strength"
            value={state.config.surface_heating_strength}
            min={0}
            max={1}
            step={0.02}
            setState={setState}
          />
          <BoundaryLayerNumberControl
            id="surface_moisture_flux_strength"
            label="Surface moisture flux"
            value={state.config.surface_moisture_flux_strength}
            min={0}
            max={1}
            step={0.02}
            setState={setState}
          />
        </div>
      </section>

      <section className="setup-control-section" aria-labelledby="setup-profile-title">
        <h3 id="setup-profile-title">Initial profile</h3>
        <div className="workbench-control-grid" aria-label="Boundary-layer profile controls">
          <BoundaryLayerNumberControl
            id="initial_relative_humidity"
            label="Initial mixed-layer humidity"
            value={state.config.initial_relative_humidity}
            min={0.05}
            max={1}
            step={0.01}
            setState={setState}
          />
          <BoundaryLayerNumberControl
            id="initial_lapse_rate_k_per_m"
            label="Initial stability / lapse rate"
            value={state.config.initial_lapse_rate_k_per_m}
            min={0.003}
            max={0.01}
            step={0.0001}
            setState={setState}
          />
          <BoundaryLayerNumberControl
            id="free_atmosphere_relative_humidity"
            label="Dry air above mixed layer"
            value={state.config.free_atmosphere_relative_humidity}
            min={0.05}
            max={1}
            step={0.01}
            setState={setState}
          />
        </div>
      </section>

      <section className="setup-control-section" aria-labelledby="setup-cap-title">
        <h3 id="setup-cap-title">Cap and entrainment</h3>
        <div className="workbench-control-grid" aria-label="Boundary-layer cap and entrainment controls">
          <BoundaryLayerNumberControl
            id="inversion_height_m"
            label="Inversion height"
            value={state.config.inversion_height_m}
            min={400}
            max={2_800}
            step={50}
            suffix="m"
            setState={setState}
          />
          <BoundaryLayerNumberControl
            id="inversion_strength_k"
            label="Inversion strength"
            value={state.config.inversion_strength_k}
            min={0}
            max={8}
            step={0.1}
            suffix="K"
            setState={setState}
          />
          <BoundaryLayerNumberControl
            id="entrainment_strength"
            label="Entrainment strength"
            value={state.config.entrainment_strength}
            min={0}
            max={1}
            step={0.02}
            setState={setState}
          />
        </div>
      </section>

      <section className="setup-control-section" aria-labelledby="setup-profile-model-title">
        <h3 id="setup-profile-model-title">Advanced model setup</h3>
        <div className="workbench-control-grid" aria-label="Boundary-layer advanced controls">
          <BoundaryLayerNumberControl
            id="levels"
            label="Vertical levels / profile resolution"
            value={state.config.levels}
            min={12}
            max={121}
            step={1}
            suffix="levels"
            setState={setState}
          />
          <BoundaryLayerNumberControl
            id="time_step_seconds"
            label="Timestep"
            value={state.config.time_step_seconds}
            min={30}
            max={900}
            step={30}
            suffix="s"
            setState={setState}
          />
          <BoundaryLayerNumberControl
            id="frame_interval_seconds"
            label="Output cadence"
            value={state.config.frame_interval_seconds}
            min={300}
            max={3_600}
            step={300}
            suffix="s"
            setState={setState}
          />
          <BoundaryLayerNumberControl
            id="seed"
            label="Seed"
            value={state.config.seed}
            min={1}
            max={999}
            step={1}
            setState={setState}
          />
        </div>
      </section>
    </aside>
  );
}

function BoundaryLayerNumberControl({
  id,
  label,
  value,
  min,
  max,
  step,
  suffix,
  formatValue,
  setState,
}: {
  id: BoundaryLayer1DControlId;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  formatValue?: (value: number) => string;
  setState: Dispatch<SetStateAction<BoundaryLayer1DState>>;
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
          setState((current) => updateBoundaryLayer1DControl(current, id, nextValue));
        }}
      />
      <small>{formatValue ? formatValue(value) : suffix ?? "0 to 1"}</small>
    </label>
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
  const controlById = (id: string) => primaryControls.find((control) => control.id === id);

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
        <CloudOpticsControl
          control={controlById("cloud-scene")}
          controls={activeControls}
          setControls={setControls}
        />
      </section>

      <section className="setup-control-section" aria-labelledby="setup-light-title">
        <h3 id="setup-light-title">Light</h3>
        <p>Chooses where the sunlight comes from relative to the viewer and cloud.</p>
        <div className="workbench-control-grid" aria-label="Cloud optics light controls">
          <CloudOpticsSegmentedControl
            label="Sun direction"
            value={activeControls ? cloudOpticsSunDirection(activeControls) : "front"}
            options={[
              { value: "front", label: "Front" },
              { value: "left", label: "Left" },
              { value: "right", label: "Right" },
              { value: "behind", label: "Behind" },
            ]}
            onChange={(value) =>
              setControls((current) =>
                current ? updateCloudOpticsControls(current, "sunAzimuthDegrees", sunAzimuthForDirection(value)) : current,
              )
            }
          />
          <CloudOpticsSegmentedControl
            label="Sun elevation"
            value={activeControls ? cloudOpticsSunElevation(activeControls) : "medium"}
            options={[
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
            ]}
            onChange={(value) =>
              setControls((current) =>
                current ? updateCloudOpticsControls(current, "sunElevationDegrees", sunElevationForPreset(value)) : current,
              )
            }
          />
          <p className="control-helper">
            Low sun creates longer light paths and stronger shadows. High sun lights the top more directly.
          </p>
          <CloudOpticsControl
            control={controlById("time-of-day-light-color")}
            controls={activeControls}
            setControls={setControls}
          />
        </div>
      </section>

      <section className="setup-control-section" aria-labelledby="setup-camera-title">
        <h3 id="setup-camera-title">Camera</h3>
        <p>
          Changes how far the viewer looks through the simplified cloud volume. Oblique views create
          longer paths through the cloud.
        </p>
        <div className="workbench-control-grid" aria-label="Cloud optics camera controls">
          <CloudOpticsSegmentedControl
            label="Camera angle"
            value={activeControls ? cloudOpticsCameraAngle(activeControls) : "center"}
            options={[
              { value: "left", label: "Left" },
              { value: "center", label: "Center" },
              { value: "right", label: "Right" },
            ]}
            onChange={(value) =>
              setControls((current) =>
                current ? updateCloudOpticsControls(current, "viewAngleDegrees", cameraAngleForPreset(value)) : current,
              )
            }
          />
        </div>
      </section>

      <section className="setup-control-section" aria-labelledby="setup-cloud-title">
        <h3 id="setup-cloud-title">Cloud optical properties</h3>
        <div className="workbench-control-grid" aria-label="Cloud optics material controls">
          <CloudOpticsControl
            control={controlById("cloud-water-density")}
            controls={activeControls}
            setControls={setControls}
          />
          <CloudOpticsControl
            control={controlById("cloud-thickness-depth")}
            controls={activeControls}
            setControls={setControls}
          />
          <CloudOpticsControl
            control={controlById("optical-depth-scattering")}
            controls={activeControls}
            setControls={setControls}
          />
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
          <option value="midday">Midday</option>
          <option value="cool-haze">Late afternoon</option>
          <option value="golden-hour">Golden hour</option>
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

function CloudOpticsSegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="segmented-control">
      <legend>{label}</legend>
      <div role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
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
  boundaryLayerFrame,
  boundaryLayerState,
  workbench,
  cloudOpticsControls,
  cloudOpticsViewMode,
  onCloudOpticsViewModeChange,
  selectedFieldKey,
  onSelectedFieldKeyChange,
}: {
  lab: LabDefinition;
  frame: SimulationFrame | null;
  boundaryLayerFrame: BoundaryLayer1DFrame | null;
  boundaryLayerState: BoundaryLayer1DState;
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

  if (lab.id === EVOLVING_BOUNDARY_LAYER_LAB_ID) {
    return (
      <BoundaryLayerVisualizationStage
        lab={lab}
        frame={boundaryLayerFrame}
        state={boundaryLayerState}
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
                <p>Run {lab.name} to stream solver fields into this scientific 2-D view.</p>
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
          {viewModel?.solverTruth.label ?? "Experimental 2-D prototype"} ·{" "}
          Simplified warm-cloud condensation
        </p>
      </div>
      {workbench.run.message ? <p className="workbench-message">{workbench.run.message}</p> : null}
    </section>
  );
}

function BoundaryLayerVisualizationStage({
  lab,
  frame,
  state,
}: {
  lab: LabDefinition;
  frame: BoundaryLayer1DFrame | null;
  state: BoundaryLayer1DState;
}) {
  const activeFrame = frame ?? boundaryLayerPreviewFrame(state);
  const status = activeFrame.diagnostics.cloud_formation_potential_status;
  const hasRun = state.run !== null;
  const temperaturePoints = profileLinePoints(
    activeFrame,
    activeFrame.temperature_k.map((value) => value - 273.15),
    "temperature",
  );
  const rhPoints = profileLinePoints(activeFrame, activeFrame.relative_humidity_percent, "rh");
  const markers = [
    { label: "Mixed-layer depth marker", value: activeFrame.mixed_layer_depth_m, className: "mixed-layer" },
    { label: "LCL marker", value: activeFrame.lcl_m, className: "lcl" },
    { label: "Inversion / cap marker", value: activeFrame.inversion_height_m, className: "cap" },
  ];

  return (
    <section
      className="workbench-region visualization-stage boundary-layer-stage"
      aria-labelledby="visualization-stage-title"
    >
      <div className="stage-heading">
        <p className="region-label">Visualization stage</p>
        <div className="stage-title-row">
          <h2 id="visualization-stage-title">Profile / sounding hero view</h2>
          <div className="frame-readout" aria-label="Displayed frame readout">
            <span>Frame {hasRun ? state.displayedFrameIndex + 1 : 0} / {state.run?.frames.length ?? 0}</span>
            <strong>{activeFrame.time_hours_from_sunrise.toFixed(1)} h from sunrise</strong>
          </div>
        </div>
      </div>
      <div className="stage-toolbar">
        <p className="field-scale-title">
          Temperature profile, RH profile, mixed-layer depth, LCL, and inversion/cap markers
        </p>
        <span className={`diagnostic-status diagnostic-status-${status}`}>
          Cloud formation potential: {statusLabel(status)}
        </span>
      </div>
      <div className="profile-sounding-shell">
        <div className="profile-sounding-chart" role="img" aria-label={`${lab.name} 1-D profile visualization`}>
          <span className="axis-label axis-label-y">Height, z (m)</span>
          <AxisTicks orientation="y" maxValue={state.config.height_m} />
          <div className="profile-sounding-plot">
            <AxisGrid orientation="y" maxValue={state.config.height_m} />
            <svg className="profile-sounding-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
              <title>Temperature and RH profile</title>
              <polyline points={temperaturePoints} className="profile-line profile-line-temperature" />
              <polyline points={rhPoints} className="profile-line profile-line-rh" />
            </svg>
            {markers.map((marker) => (
              <span
                key={marker.label}
                className={`profile-marker profile-marker-${marker.className}`}
                style={{ bottom: `${profileHeightPercent(activeFrame, marker.value)}%` }}
              >
                {marker.label}: {formatMeters(marker.value)}
              </span>
            ))}
          </div>
          <div className="profile-sounding-legend">
            <span className="temperature-key">Temperature profile</span>
            <span className="rh-key">RH profile</span>
            <span className="marker-key">Profile markers</span>
          </div>
        </div>
      </div>
      <dl className="stage-stats">
        <div>
          <dt>Mixed-layer depth</dt>
          <dd>{formatMeters(activeFrame.mixed_layer_depth_m)}</dd>
        </div>
        <div>
          <dt>LCL</dt>
          <dd>{formatMeters(activeFrame.lcl_m)}</dd>
        </div>
        <div>
          <dt>MLD minus LCL</dt>
          <dd>{formatMeters(activeFrame.diagnostics.mixed_layer_lcl_difference_m)}</dd>
        </div>
        <div>
          <dt>RH near mixed-layer top</dt>
          <dd>{activeFrame.diagnostics.rh_near_mixed_layer_top_percent.toFixed(0)}%</dd>
        </div>
      </dl>
      <p className="stage-helper">{activeFrame.diagnostics.cloud_formation_potential_reason}</p>
      <div className="assumption-labels" aria-label="Model assumptions">
        <span>Model assumptions</span>
        <p>
          Simplified 1-D profile model · Cloud formation potential · No cloud water in v1 ·
          Not cloud-resolving · Derived diagnostic
        </p>
      </div>
      {state.message ? <p className="workbench-message">{state.message}</p> : null}
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
            <span>Sun: {renderModel?.summary.sunDirection ?? "front"}</span>
            <span>Elevation: {renderModel?.summary.sunElevation ?? "medium"}</span>
            <strong>{renderModel?.summary.lightGeometry ?? "front lit"}</strong>
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
            <option value="rendered-cloud-appearance">Rendered appearance</option>
            <option value="cloud-water-field">Cloud water field</option>
            <option value="optical-depth">Optical depth</option>
            <option value="light-path-shadow">Light path / shadow</option>
          </select>
        </label>
        <p className="field-scale-title">{cloudOpticsViewQuestion(viewMode)}</p>
      </div>
      {renderModel ? (
        <div className="optics-orientation-guide" aria-label="Light and camera orientation guide">
          <span className={`orientation-sun orientation-sun-${renderModel.summary.sunDirection}`}>
            Sun {orientationArrowForSun(renderModel.summary.sunDirection)}
          </span>
          <strong>cloud</strong>
          <span className={`orientation-camera orientation-camera-${renderModel.summary.cameraAngle}`}>
            {orientationArrowForCamera(renderModel.summary.cameraAngle)} camera
          </span>
          <em>Lighting: {renderModel.summary.lightGeometry}</em>
        </div>
      ) : null}
      <p className="optics-explanation">
        2.5-D visual scene: this lab turns a simplified cloud-water field into a shallow visual
        volume. It is not a true 3-D atmospheric simulation.
      </p>

      <div
        className={`optics-renderer optics-renderer-${viewMode} optics-renderer-sun-${renderModel?.summary.sunDirection ?? "front"}`}
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
                x={cell.column + cell.depthOffset}
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
        <div>
          <dt>Camera</dt>
          <dd>{renderModel?.summary.cameraAngle ?? "unavailable"}</dd>
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

function profileLinePoints(
  frame: BoundaryLayer1DFrame,
  values: number[],
  field: "temperature" | "rh",
): string {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  const min = field === "temperature" ? Math.min(...finiteValues, 0) : 0;
  const max = field === "temperature" ? Math.max(...finiteValues, 1) : 100;
  const range = Math.max(1e-9, max - min);
  const xOffset = field === "temperature" ? 4 : 52;
  const xWidth = field === "temperature" ? 40 : 42;

  return values.map((value, index) => {
    const normalizedX = (value - min) / range;
    const x = xOffset + normalizedX * xWidth;
    const y = 100 - profileHeightPercent(frame, frame.z_m[index] ?? 0);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

function profileHeightPercent(frame: BoundaryLayer1DFrame, heightM: number): number {
  const top = Math.max(1, frame.z_m[frame.z_m.length - 1] ?? 1);
  return Math.max(0, Math.min(100, (heightM / top) * 100));
}

function InspectorPanel({
  lab,
  summary,
  workbench,
  cloudOpticsControls,
  cloudOpticsViewMode,
  boundaryLayerState,
  boundaryLayerFrame,
  saveMessage,
}: {
  lab: LabDefinition;
  summary: ReturnType<typeof buildWorkbenchInspectorSummary>;
  workbench: WorkbenchState;
  cloudOpticsControls: CloudOpticsSceneControls | null;
  cloudOpticsViewMode: CloudOpticsViewMode;
  boundaryLayerState: BoundaryLayer1DState;
  boundaryLayerFrame: BoundaryLayer1DFrame | null;
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

  if (lab.id === EVOLVING_BOUNDARY_LAYER_LAB_ID) {
    return (
      <BoundaryLayerInspectorPanel
        lab={lab}
        state={boundaryLayerState}
        frame={boundaryLayerFrame}
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
            <dt>Top / lateral boundary cloud</dt>
            <dd>
              {formatFraction(summary.topBoundaryCloudFraction)} /{" "}
              {formatFraction(summary.lateralBoundaryCloudFraction)}
            </dd>
          </div>
          <div>
            <dt>Return-flow cloud fraction</dt>
            <dd>{formatFraction(summary.returnFlowCloudFraction)}</dd>
          </div>
          <div>
            <dt>Boundary-connected regions</dt>
            <dd>{formatFraction(summary.boundaryConnectedCloudRegionFraction)}</dd>
          </div>
          <div>
            <dt>Return-flow warning</dt>
            <dd>{summary.returnFlowWarning}</dd>
          </div>
          <div>
            <dt>Artifact policy warnings</dt>
            <dd>
              {summary.artifactWarnings.length > 0
                ? summary.artifactWarnings.join(" ")
                : "No boundary, return-flow, or below-LCL artifact warnings for the observed frames."}
            </dd>
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
          Derived diagnostic · Experimental solver output · Experimental 2-D prototype ·
          Simplified warm-cloud condensation · {lab.limitations[0]}
        </p>
      </details>
      {saveMessage ? <p className="workbench-message">{saveMessage}</p> : null}
    </aside>
  );
}

function BoundaryLayerInspectorPanel({
  lab,
  state,
  frame,
}: {
  lab: LabDefinition;
  state: BoundaryLayer1DState;
  frame: BoundaryLayer1DFrame | null;
}) {
  const activeFrame = frame ?? boundaryLayerPreviewFrame(state);
  const diagnostics = activeFrame.diagnostics;

  return (
    <aside className="workbench-region inspector-region" aria-labelledby="inspector-region-title">
      <p className="region-label">Inspector</p>
      <section className="inspector-summary" aria-labelledby="inspector-region-title">
        <h2 id="inspector-region-title">Cloud formation potential</h2>
        <span className={`diagnostic-status diagnostic-status-${diagnostics.cloud_formation_potential_status}`}>
          Result: {statusLabel(diagnostics.cloud_formation_potential_status)}
        </span>
        <p>{diagnostics.cloud_formation_potential_reason}</p>
      </section>

      <details className="inspector-details" open>
        <summary>Profile diagnostics</summary>
        <dl className="diagnostic-list">
          <div>
            <dt>Cloud formation potential status</dt>
            <dd>{statusLabel(diagnostics.cloud_formation_potential_status)}</dd>
          </div>
          <div>
            <dt>Deterministic limiting reason</dt>
            <dd>{diagnostics.cloud_formation_potential_reason}</dd>
          </div>
          <div>
            <dt>Mixed-layer depth</dt>
            <dd>{formatMeters(activeFrame.mixed_layer_depth_m)}</dd>
          </div>
          <div>
            <dt>LCL</dt>
            <dd>{formatMeters(activeFrame.lcl_m)}</dd>
          </div>
          <div>
            <dt>Mixed-layer depth minus LCL</dt>
            <dd>{formatMeters(diagnostics.mixed_layer_lcl_difference_m)}</dd>
          </div>
          <div>
            <dt>RH near mixed-layer top</dt>
            <dd>{diagnostics.rh_near_mixed_layer_top_percent.toFixed(1)}%</dd>
          </div>
          <div>
            <dt>Inversion / cap state</dt>
            <dd>
              {formatMeters(activeFrame.inversion_height_m)} / {activeFrame.inversion_strength_k.toFixed(1)} K
            </dd>
          </div>
          <div>
            <dt>Entrainment drying proxy</dt>
            <dd>{activeFrame.entrainment_drying_proxy.toExponential(2)}</dd>
          </div>
          <div>
            <dt>Surface heating accumulation</dt>
            <dd>{activeFrame.surface_heating_accumulated_k.toFixed(2)} K</dd>
          </div>
          <div>
            <dt>Surface moisture addition</dt>
            <dd>{activeFrame.surface_moisture_added_kg_per_kg.toExponential(2)} kg/kg</dd>
          </div>
        </dl>
      </details>

      <details className="inspector-details" open>
        <summary>Model contract</summary>
        <p className="assumption-copy">
          Simplified 1-D profile model · Cloud formation potential · No cloud water in v1 ·
          Not cloud-resolving · No live Boussinesq coupling · Derived diagnostic
        </p>
      </details>

      <details className="inspector-details">
        <summary>Scenario limitations</summary>
        <ul>
          {lab.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </details>
      {state.saveMessage ? <p className="workbench-message">{state.saveMessage}</p> : null}
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

function BoundaryLayerTimelinePanel({
  state,
  setState,
}: {
  state: BoundaryLayer1DState;
  setState: Dispatch<SetStateAction<BoundaryLayer1DState>>;
}) {
  const frames = state.run?.frames ?? [];
  const max = Math.max(0, frames.length - 1);
  const currentFrame = boundaryLayerDisplayedFrame(state);

  return (
    <section className="timeline-region" aria-labelledby="timeline-region-title">
      <div>
        <p className="region-label">Timeline / replay</p>
        <h2 id="timeline-region-title">
          {frames.length > 0
            ? `Profile frame ${state.displayedFrameIndex + 1} of ${frames.length}`
            : "Run profile evolution to replay frames"}
        </h2>
      </div>
      <input
        type="range"
        min="0"
        max={max}
        value={state.displayedFrameIndex}
        readOnly={frames.length === 0}
        aria-label="Profile replay timeline"
        onChange={(event) => {
          const frameIndex = Number(event.currentTarget.value);
          setState((current) => ({
            ...current,
            displayedFrameIndex: Math.min(Math.max(0, frameIndex), max),
          }));
        }}
      />
      <div className="timeline-actions" aria-label="Profile replay actions">
        <button
          type="button"
          onClick={() => setState((current) => ({ ...current, displayedFrameIndex: 0 }))}
          disabled={frames.length === 0}
        >
          First
        </button>
        <button
          type="button"
          onClick={() => setState((current) => ({ ...current, displayedFrameIndex: max }))}
          disabled={frames.length === 0}
        >
          Final
        </button>
        <span className="run-state run-state-idle">
          {currentFrame ? `${currentFrame.time_hours_from_sunrise.toFixed(1)} h from sunrise` : "No frames"}
        </span>
      </div>
    </section>
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

type CloudOpticsSunDirection = "front" | "left" | "right" | "behind";
type CloudOpticsSunElevationPreset = "low" | "medium" | "high";
type CloudOpticsCameraPreset = "left" | "center" | "right";

function cloudOpticsSunDirection(controls: CloudOpticsSceneControls): CloudOpticsSunDirection {
  const azimuth = ((controls.sunAzimuthDegrees % 360) + 360) % 360;
  if (azimuth >= 315 || azimuth < 45) {
    return "behind";
  }
  if (azimuth >= 45 && azimuth < 135) {
    return "right";
  }
  if (azimuth >= 135 && azimuth < 225) {
    return "front";
  }
  return "left";
}

function sunAzimuthForDirection(direction: string): number {
  switch (direction) {
    case "front":
      return 180;
    case "left":
      return 270;
    case "right":
      return 90;
    case "behind":
      return 0;
    default:
      return 180;
  }
}

function cloudOpticsSunElevation(controls: CloudOpticsSceneControls): CloudOpticsSunElevationPreset {
  if (controls.sunElevationDegrees <= 24) {
    return "low";
  }
  if (controls.sunElevationDegrees >= 60) {
    return "high";
  }
  return "medium";
}

function sunElevationForPreset(preset: string): number {
  switch (preset) {
    case "low":
      return 15;
    case "high":
      return 75;
    default:
      return 45;
  }
}

function cloudOpticsCameraAngle(controls: CloudOpticsSceneControls): CloudOpticsCameraPreset {
  if (controls.viewAngleDegrees <= -20) {
    return "left";
  }
  if (controls.viewAngleDegrees >= 20) {
    return "right";
  }
  return "center";
}

function cameraAngleForPreset(preset: string): number {
  switch (preset) {
    case "left":
      return -45;
    case "right":
      return 45;
    default:
      return 0;
  }
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
      return "Rendered appearance";
    case "cloud-water-field":
      return "Cloud water field";
    case "optical-depth":
      return "Optical depth";
    case "light-path-shadow":
      return "Light path / shadow";
  }
}

function cloudOpticsViewQuestion(viewMode: CloudOpticsViewMode): string {
  switch (viewMode) {
    case "rendered-cloud-appearance":
      return "What does the cloud look like under the current light and camera setup?";
    case "cloud-water-field":
      return "Where is the cloud material?";
    case "optical-depth":
      return "Where is the cloud optically thin or thick?";
    case "light-path-shadow":
      return "Where does light enter, weaken, and create shaded regions?";
  }
}

function orientationArrowForSun(direction: string): string {
  switch (direction) {
    case "left":
      return "->";
    case "right":
      return "<-";
    case "behind":
      return "behind / backlit ->";
    default:
      return "front ->";
  }
}

function orientationArrowForCamera(camera: string): string {
  switch (camera) {
    case "left":
      return "left view <-";
    case "right":
      return "right view ->";
    default:
      return "<-";
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

import { Component, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

import {
  CLOUD_OPTICS_BEAUTY_LAB_ID,
  EVOLVING_BOUNDARY_LAYER_LAB_ID,
  FAIR_WEATHER_CUMULUS_LAB_ID,
} from "../labs/labCatalog";
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
import type { LowerAtmosphereV2FlowMode } from "../labs/lowerAtmosphereV2Scenarios";
import {
  createInitialLowerAtmosphereV2State,
  defaultLowerAtmosphereV2Client,
  lowerAtmosphereV2ObservedCloudStatus,
  lowerAtmosphereV2ObservedProfileStatus,
  lowerAtmosphereV2ProfileFrames,
  lowerAtmosphereV2RunStatus,
  lowerAtmosphereV2ScenarioCheckLabel,
  lowerAtmosphereV2ScenarioForId,
  lowerAtmosphereV2StatusLabel as lowerAtmosphereV2FriendlyStatusLabel,
  runLowerAtmosphereV2Flow,
  selectLowerAtmosphereV2ProfileFrame,
  selectLowerAtmosphereV2Scenario,
  selectedLowerAtmosphereV2ProfileFrame,
  type LowerAtmosphereV2Client,
  type LowerAtmosphereV2State,
} from "../labs/lowerAtmosphereV2Orchestration";
import {
  boundaryLayer1DScenarioForId,
  boundaryLayerDiagnosticViewModel,
  boundaryLayerDisplayedFrame,
  boundaryLayerPreviewFrame,
  advanceBoundaryLayerReplay,
  createInitialBoundaryLayer1DState,
  defaultBoundaryLayer1DClient,
  durationHoursToSeconds,
  durationSecondsToHours,
  formatHoursAfterSunrise,
  markBoundaryLayerComputing,
  markBoundaryLayerRunReady,
  pauseBoundaryLayerReplay,
  playBoundaryLayerReplay,
  replayBoundaryLayerEvolution,
  selectBoundaryLayerFrame,
  selectBoundaryLayer1DScenario,
  selectFinalBoundaryLayerFrame,
  statusLabel,
  updateBoundaryLayer1DControl,
  usableBoundaryLayerFrames,
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
type LowerAtmosphereV2FlowOption = {
  id: LowerAtmosphereV2FlowMode;
  label: string;
  description: string;
};

const LOWER_ATMOSPHERE_V2_FLOW_OPTIONS: LowerAtmosphereV2FlowOption[] = [
  {
    id: "atmosphere_evolution",
    label: "Evolve atmosphere",
    description:
      "Watch the lower-atmosphere profile change after sunrise and diagnose cloud formation potential. No cloud water is produced.",
  },
  {
    id: "lifted_cloud",
    label: "Lift cloud column",
    description: "Apply prescribed lift to a selected profile and diagnose whether cloud water forms.",
  },
  {
    id: "evolution_lifted_cloud",
    label: "Evolve + lift",
    description: "Evolve the atmosphere first, then run prescribed lift from a selected profile time.",
  },
];

const LOWER_ATMOSPHERE_V2_DEFAULT_FLOW: LowerAtmosphereV2FlowMode = "evolution_lifted_cloud";

type LabWorkbenchProps = {
  lab: LabDefinition;
  mode?: WorkbenchMode;
  initialInspectorOpen?: boolean;
  onBackToLabs: () => void;
  runClient?: WorkbenchRunClient;
  boundaryLayerClient?: BoundaryLayer1DClient;
  lowerAtmosphereV2Client?: LowerAtmosphereV2Client;
};

export function LabWorkbench({
  lab,
  mode = "single",
  initialInspectorOpen = true,
  onBackToLabs,
  runClient = defaultWorkbenchRunClient,
  boundaryLayerClient = defaultBoundaryLayer1DClient,
  lowerAtmosphereV2Client = defaultLowerAtmosphereV2Client,
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
  const [lowerAtmosphereV2FlowMode, setLowerAtmosphereV2FlowMode] =
    useState<LowerAtmosphereV2FlowMode>(LOWER_ATMOSPHERE_V2_DEFAULT_FLOW);
  const [lowerAtmosphereV2State, setLowerAtmosphereV2State] = useState<LowerAtmosphereV2State>(() =>
    createInitialLowerAtmosphereV2State(lab.scenarios[0]?.id),
  );
  const [selectedFieldKey, setSelectedFieldKey] = useState(defaultScientificFieldKey(null));
  const [inspectorOpen, setInspectorOpen] = useState(initialInspectorOpen);
  const cleanupRef = useRef<RunStreamCleanup | null>(null);
  const lowerAtmosphereV2RequestRef = useRef(0);
  const isBoundaryLayerLab = lab.id === EVOLVING_BOUNDARY_LAYER_LAB_ID;
  const isLowerAtmosphereV2Lab = lab.id === FAIR_WEATHER_CUMULUS_LAB_ID;
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
    setLowerAtmosphereV2FlowMode(LOWER_ATMOSPHERE_V2_DEFAULT_FLOW);
    setLowerAtmosphereV2State(createInitialLowerAtmosphereV2State(lab.scenarios[0]?.id));
    setSelectedFieldKey(defaultScientificFieldKey(null));
    lowerAtmosphereV2RequestRef.current += 1;
    return () => cleanupRef.current?.();
  }, [lab]);

  useEffect(() => {
    if (!isBoundaryLayerLab || boundaryLayerState.status !== "replaying") {
      return undefined;
    }

    const replayTimer = window.setInterval(() => {
      setBoundaryLayerState((current) => advanceBoundaryLayerReplay(current));
    }, 350);

    return () => window.clearInterval(replayTimer);
  }, [isBoundaryLayerLab, boundaryLayerState.status]);

  async function handleStartRun() {
    if (isLowerAtmosphereV2Lab) {
      const requestId = lowerAtmosphereV2RequestRef.current + 1;
      lowerAtmosphereV2RequestRef.current = requestId;
      setLowerAtmosphereV2State((current) => ({
        ...current,
        profileStatus:
          lowerAtmosphereV2FlowMode === "lifted_cloud" ? current.profileStatus : "computing",
        cloudColumnStatus:
          lowerAtmosphereV2FlowMode === "atmosphere_evolution" ? "ready" : "computing",
        message:
          lowerAtmosphereV2FlowMode === "atmosphere_evolution"
            ? "Computing profile evolution..."
            : lowerAtmosphereV2FlowMode === "lifted_cloud"
              ? "Running prescribed cloud-column lift..."
              : "Computing profile evolution, then running prescribed cloud-column lift...",
      }));
      const nextState = await runLowerAtmosphereV2Flow(
        lowerAtmosphereV2State,
        lowerAtmosphereV2FlowMode,
        lowerAtmosphereV2Client,
      );
      if (lowerAtmosphereV2RequestRef.current === requestId) {
        setLowerAtmosphereV2State(nextState);
      }
      return;
    }

    if (!canRun) {
      setWorkbench((current) =>
        markWorkbenchRunError(current, "This lab uses interactive preset scenes; backend run flow is not needed yet."),
      );
      return;
    }

    if (isBoundaryLayerLab) {
      setBoundaryLayerState((current) => markBoundaryLayerComputing(current));
      try {
        const run = await boundaryLayerClient.runProfile(boundaryLayerState.config);
        setBoundaryLayerState((current) => markBoundaryLayerRunReady(current, run));
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
    lowerAtmosphereV2RequestRef.current += 1;
    setWorkbench((current) => resetWorkbenchRun(current));
    if (lab.capabilities.supportsStaticControls) {
      setCloudOpticsControls(defaultCloudOpticsControls(scenario?.id));
      setCloudOpticsViewMode("rendered-cloud-appearance");
    }
    if (isBoundaryLayerLab) {
      setBoundaryLayerState(createInitialBoundaryLayer1DState(scenario?.id));
    }
    if (isLowerAtmosphereV2Lab) {
      setLowerAtmosphereV2State(createInitialLowerAtmosphereV2State(scenario?.id));
    }
  }

  const runStatus = isLowerAtmosphereV2Lab
    ? lowerAtmosphereV2RunStatus(lowerAtmosphereV2State)
    : isBoundaryLayerLab
      ? boundaryLayerState.status
      : workbench.run.status;
  const isRunning = runStatus === "computing" || runStatus === "starting" || runStatus === "running";

  return (
    <WorkbenchErrorBoundary
      boundaryKey={`${lab.id}-workbench`}
      fallbackTitle={`${lab.name} encountered an unexpected UI error.`}
      fallbackBody="Reset this lab or return to the Lab Picker."
    >
    <main className="workbench-v2" aria-label={`${lab.name} workbench`}>
      <WorkbenchTopBar
        lab={lab}
        scenarioName={scenario?.name ?? "Scenario coming later"}
        mode={mode}
        runStatus={runStatus}
        isRunning={isRunning}
        canRun={canRun}
        supportsRun={capabilities.supportsRun}
        isProfileLab={isBoundaryLayerLab || isLowerAtmosphereV2Lab}
        runLabel={isLowerAtmosphereV2Lab ? "Run v2 flow" : undefined}
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
          lowerAtmosphereV2FlowMode={lowerAtmosphereV2FlowMode}
          setLowerAtmosphereV2FlowMode={setLowerAtmosphereV2FlowMode}
          lowerAtmosphereV2State={lowerAtmosphereV2State}
          setLowerAtmosphereV2State={setLowerAtmosphereV2State}
        />
        <VisualizationStage
          lab={lab}
          frame={currentFrame}
          boundaryLayerFrame={boundaryLayerFrame}
          boundaryLayerState={boundaryLayerState}
          setBoundaryLayerState={setBoundaryLayerState}
          workbench={workbench}
          cloudOpticsControls={cloudOpticsControls}
          cloudOpticsViewMode={cloudOpticsViewMode}
          onCloudOpticsViewModeChange={setCloudOpticsViewMode}
          selectedFieldKey={selectedFieldKey}
          onSelectedFieldKeyChange={setSelectedFieldKey}
          lowerAtmosphereV2FlowMode={lowerAtmosphereV2FlowMode}
          lowerAtmosphereV2State={lowerAtmosphereV2State}
          setLowerAtmosphereV2State={setLowerAtmosphereV2State}
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
            lowerAtmosphereV2FlowMode={lowerAtmosphereV2FlowMode}
            lowerAtmosphereV2State={lowerAtmosphereV2State}
            saveMessage={workbench.saveMessage}
          />
        ) : null}
      </section>

      {capabilities.supportsTimeline || capabilities.supportsReplay ? (
        isBoundaryLayerLab || isLowerAtmosphereV2Lab ? null : (
          <TimelinePanel
            workbench={workbench}
            replayEvents={replayEvents}
            setWorkbench={setWorkbench}
          />
        )
      ) : null}
    </main>
    </WorkbenchErrorBoundary>
  );
}

class WorkbenchErrorBoundary extends Component<
  {
    boundaryKey: string;
    fallbackTitle: string;
    fallbackBody: string;
    children: ReactNode;
  },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    if (import.meta.env.DEV) {
      console.error(error);
    }
  }

  componentDidUpdate(previousProps: { boundaryKey: string }): void {
    if (previousProps.boundaryKey !== this.props.boundaryKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <WorkbenchErrorFallback
          fallbackTitle={this.props.fallbackTitle}
          fallbackBody={this.props.fallbackBody}
        />
      );
    }

    return this.props.children;
  }
}

export function WorkbenchErrorFallback({
  fallbackTitle,
  fallbackBody,
}: {
  fallbackTitle: string;
  fallbackBody: string;
}) {
  return (
    <section className="workbench-region workbench-error-fallback" role="alert">
      <h2>{fallbackTitle}</h2>
      <p>{fallbackBody}</p>
    </section>
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
  isProfileLab,
  runLabel,
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
  isProfileLab: boolean;
  runLabel?: string;
  inspectorOpen: boolean;
  onBackToLabs: () => void;
  onStartRun: () => void;
  onStopRun: () => void;
  onResetRun: () => void;
  onToggleInspector: () => void;
  onSaveRun: () => void;
}) {
  const canStop = isRunning && !isProfileLab;

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
              {runLabel ?? (isProfileLab ? "Run profile" : "Run")}
            </button>
            {canStop ? (
              <button type="button" onClick={onStopRun} disabled={!canRun}>
                Stop
              </button>
            ) : null}
          </>
        ) : null}
        <button type="button" onClick={onResetRun}>
          {supportsRun ? "Reset" : "Reset controls"}
        </button>
        {supportsRun ? (
          <span className={`run-state run-state-${runStatus}`}>Status: {runStatusLabel(runStatus)}</span>
        ) : (
          <span className="run-state run-state-idle">Static optics lab</span>
        )}
        {!isProfileLab ? (
          <button type="button" onClick={onToggleInspector} aria-pressed={inspectorOpen}>
            Inspector
          </button>
        ) : null}
        <button type="button" onClick={onSaveRun}>
          {supportsRun ? "Save" : "Save setup"}
        </button>
        <button type="button" disabled title="Comparison mode is intentionally deferred.">
          Compare
        </button>
        {!isProfileLab ? (
          <button type="button" disabled title="System drawer is deferred from the default flow.">
            System
          </button>
        ) : null}
      </div>
      {!isProfileLab ? <span className="mode-pill">Mode: {mode}</span> : null}
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
  lowerAtmosphereV2FlowMode,
  setLowerAtmosphereV2FlowMode,
  lowerAtmosphereV2State,
  setLowerAtmosphereV2State,
}: {
  lab: LabDefinition;
  workbench: WorkbenchState;
  setWorkbench: Dispatch<SetStateAction<WorkbenchState>>;
  cloudOpticsControls: CloudOpticsSceneControls | null;
  setCloudOpticsControls: Dispatch<SetStateAction<CloudOpticsSceneControls | null>>;
  boundaryLayerState: BoundaryLayer1DState;
  setBoundaryLayerState: Dispatch<SetStateAction<BoundaryLayer1DState>>;
  lowerAtmosphereV2FlowMode: LowerAtmosphereV2FlowMode;
  setLowerAtmosphereV2FlowMode: Dispatch<SetStateAction<LowerAtmosphereV2FlowMode>>;
  lowerAtmosphereV2State: LowerAtmosphereV2State;
  setLowerAtmosphereV2State: Dispatch<SetStateAction<LowerAtmosphereV2State>>;
}) {
  const scenario = selectedLabScenario(lab, workbench);
  const config = workbench.nextRunConfig;

  if (lab.id === FAIR_WEATHER_CUMULUS_LAB_ID) {
    return (
      <LowerAtmosphereV2SetupPanel
        lab={lab}
        workbench={workbench}
        setWorkbench={setWorkbench}
        flowMode={lowerAtmosphereV2FlowMode}
        setFlowMode={setLowerAtmosphereV2FlowMode}
        state={lowerAtmosphereV2State}
        setState={setLowerAtmosphereV2State}
      />
    );
  }

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

function LowerAtmosphereV2SetupPanel({
  lab,
  workbench,
  setWorkbench,
  flowMode,
  setFlowMode,
  state,
  setState,
}: {
  lab: LabDefinition;
  workbench: WorkbenchState;
  setWorkbench: Dispatch<SetStateAction<WorkbenchState>>;
  flowMode: LowerAtmosphereV2FlowMode;
  setFlowMode: Dispatch<SetStateAction<LowerAtmosphereV2FlowMode>>;
  state: LowerAtmosphereV2State;
  setState: Dispatch<SetStateAction<LowerAtmosphereV2State>>;
}) {
  const scenario = selectedLabScenario(lab, workbench);
  const contract = lowerAtmosphereV2ScenarioForId(scenario?.id);
  const profileDefaults = contract?.configDefaults.profileControls ?? {};
  const cloudDefaults = contract?.configDefaults.cloudColumnControls ?? {};
  const profileFrames = lowerAtmosphereV2ProfileFrames(state);
  const selectedProfileFrame = selectedLowerAtmosphereV2ProfileFrame(state);

  if (!scenario || !contract) {
    return (
      <aside className="workbench-region setup-region" aria-labelledby="setup-region-title">
        <p className="region-label">Setup</p>
        <h2 id="setup-region-title">Lower Atmosphere v2 setup unavailable</h2>
        <p className="workbench-message">
          Scenario metadata is missing. Reset the lab or return to the Lab Picker.
        </p>
        <button type="button" onClick={() => setWorkbench(createInitialWorkbenchState(lab))}>
          Reset Lower Atmosphere v2 shell
        </button>
      </aside>
    );
  }

  return (
    <aside className="workbench-region setup-region lower-atmosphere-v2-setup" aria-labelledby="setup-region-title">
      <p className="region-label">Setup</p>
      <h2 id="setup-region-title">{scenario.name}</h2>

      <section className="setup-control-section" aria-labelledby="setup-scenario-title">
        <h3 id="setup-scenario-title">Scenario</h3>
        <label className="control-group">
          <span>Scenario</span>
          <select
            value={workbench.selectedScenarioId}
            onChange={(event) => {
              const scenarioId = event.currentTarget.value;
              setWorkbench((current) => selectWorkbenchScenario(current, lab, scenarioId));
              setState((current) => selectLowerAtmosphereV2Scenario(current, scenarioId));
            }}
            title={scenario.name}
          >
            {lab.scenarios.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
        </label>
        <strong className="selected-scenario-name">{scenario.name}</strong>
        <p>{contract.physicalQuestion}</p>
        <p className="setup-expectation">{scenario.expectedBehavior}</p>
      </section>

      <section className="setup-control-section" aria-labelledby="setup-flow-title">
        <h3 id="setup-flow-title">Flow mode</h3>
        <fieldset className="segmented-control lower-atmosphere-flow-selector">
          <legend>What do you want to explore?</legend>
          <div role="group" aria-label="Lower Atmosphere v2 flow mode">
            {LOWER_ATMOSPHERE_V2_FLOW_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={flowMode === option.id}
                onClick={() => setFlowMode(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>
        <p className="control-helper">{lowerAtmosphereV2FlowDescription(flowMode)}</p>
      </section>

      <section className="setup-control-section" aria-labelledby="setup-atmosphere-profile-title">
        <h3 id="setup-atmosphere-profile-title">Atmosphere profile</h3>
        <div className="workbench-control-grid" aria-label="Lower Atmosphere v2 atmosphere profile controls">
          <ReadOnlyShellControl label="Duration after sunrise" value="4.0 h" helper="User-facing hours, not raw backend seconds." />
          <ReadOnlyShellControl
            label="Initial mixed-layer humidity"
            value={formatShellValue(profileDefaults.initial_relative_humidity, "RH")}
            helper="Starting lower-atmosphere moisture."
          />
          <ReadOnlyShellControl
            label="Dry air above mixed layer"
            value={formatShellValue(profileDefaults.free_atmosphere_relative_humidity, "RH")}
            helper="Free-atmosphere RH used for entrainment contrast."
          />
        </div>
      </section>

      <section className="setup-control-section" aria-labelledby="setup-surface-forcing-title">
        <h3 id="setup-surface-forcing-title">Surface forcing</h3>
        <div className="workbench-control-grid" aria-label="Lower Atmosphere v2 surface forcing controls">
          <ReadOnlyShellControl
            label="Surface heating strength"
            value={formatShellValue(profileDefaults.surface_heating_strength)}
            helper="Sensible-heating strength for boundary_layer_1d."
          />
          <ReadOnlyShellControl
            label="Surface moisture flux"
            value={formatShellValue(profileDefaults.surface_moisture_flux_strength)}
            helper="Moisture source strength for boundary_layer_1d."
          />
        </div>
      </section>

      <section className="setup-control-section" aria-labelledby="setup-cap-inversion-title">
        <h3 id="setup-cap-inversion-title">Cap / inversion</h3>
        <div className="workbench-control-grid" aria-label="Lower Atmosphere v2 cap controls">
          <ReadOnlyShellControl
            label="Inversion height"
            value={formatShellValue(profileDefaults.inversion_height_m, "m")}
            helper="Cap height for profile evolution."
          />
          <ReadOnlyShellControl
            label="Inversion strength"
            value={formatShellValue(profileDefaults.inversion_strength_k, "K")}
            helper="Cap strength for profile evolution."
          />
        </div>
      </section>

      <section className="setup-control-section" aria-labelledby="setup-entrainment-title">
        <h3 id="setup-entrainment-title">Entrainment</h3>
        <div className="workbench-control-grid" aria-label="Lower Atmosphere v2 entrainment controls">
          <ReadOnlyShellControl
            label="Entrainment strength"
            value={formatShellValue(profileDefaults.entrainment_strength)}
            helper="Reduced-model mixed-layer-top exchange."
          />
        </div>
      </section>

      <section className="setup-control-section" aria-labelledby="setup-prescribed-lift-title">
        <h3 id="setup-prescribed-lift-title">Prescribed lift</h3>
        <div className="workbench-control-grid" aria-label="Lower Atmosphere v2 prescribed lift controls">
          <ReadOnlyShellControl
            label="Lift strength"
            value={formatShellValue(cloudDefaults.updraft_strength_m_per_s, "m/s")}
            helper="Prescribed lift, not predicted circulation."
          />
          <ReadOnlyShellControl
            label="Lift duration"
            value={formatShellValue(cloudDefaults.lift_duration_seconds, "s")}
            helper="How long controlled_cloud_column lift is applied."
          />
          <label className="control-group">
            <span>Selected profile time</span>
            {profileFrames.length > 0 ? (
              <select
                value={state.selectedProfileFrameIndex}
                onChange={(event) =>
                  setState((current) =>
                    selectLowerAtmosphereV2ProfileFrame(current, Number(event.currentTarget.value)),
                  )
                }
              >
                {profileFrames.map((frame, index) => (
                  <option key={`${frame.step}-${frame.time_seconds}`} value={index}>
                    {formatHoursAfterSunrise(frame.time_hours_from_sunrise)}
                  </option>
                ))}
              </select>
            ) : (
              <input value="Default initial profile" readOnly disabled />
            )}
            <small>
              {profileFrames.length > 0
                ? "Select which evolved profile feeds prescribed lift."
                : `Lifted-cloud only uses ${formatHoursAfterSunrise(selectedProfileFrame.time_hours_from_sunrise)} until profile evolution runs.`}
            </small>
          </label>
        </div>
      </section>

      <details className="setup-control-section">
        <summary>Advanced settings</summary>
        <p className="control-helper">
          Raw timestep, vertical resolution, output cadence, and schema/debug values stay behind advanced UI.
        </p>
      </details>
    </aside>
  );
}

function ReadOnlyShellControl({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <label className="control-group control-group-disabled">
      <span>{label}</span>
      <input value={value} readOnly disabled />
      <small>{helper}</small>
    </label>
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
          <span>Preset</span>
          <select
            className="boundary-layer-scenario-select"
            value={state.selectedScenarioId}
            onChange={(event) =>
              setState((current) =>
                selectBoundaryLayer1DScenario(current, event.currentTarget.value),
              )
            }
            title={scenario?.name}
          >
            {lab.scenarios.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
        </label>
        <strong className="selected-scenario-name">{scenario?.name ?? "Scenario unavailable"}</strong>
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
            label="Duration after sunrise"
            value={durationSecondsToHours(state.config.duration_seconds)}
            min={0.5}
            max={8}
            step={0.25}
            suffix="hours"
            valueToConfig={(value) => durationHoursToSeconds(value)}
            formatValue={(value) => `${value.toFixed(1)} h after sunrise`}
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
  valueToConfig,
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
  valueToConfig?: (value: number) => number;
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
          setState((current) =>
            updateBoundaryLayer1DControl(current, id, valueToConfig ? valueToConfig(nextValue) : nextValue),
          );
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
  setBoundaryLayerState,
  workbench,
  cloudOpticsControls,
  cloudOpticsViewMode,
  onCloudOpticsViewModeChange,
  selectedFieldKey,
  onSelectedFieldKeyChange,
  lowerAtmosphereV2FlowMode,
  lowerAtmosphereV2State,
  setLowerAtmosphereV2State,
}: {
  lab: LabDefinition;
  frame: SimulationFrame | null;
  boundaryLayerFrame: BoundaryLayer1DFrame | null;
  boundaryLayerState: BoundaryLayer1DState;
  setBoundaryLayerState: Dispatch<SetStateAction<BoundaryLayer1DState>>;
  workbench: WorkbenchState;
  cloudOpticsControls: CloudOpticsSceneControls | null;
  cloudOpticsViewMode: CloudOpticsViewMode;
  onCloudOpticsViewModeChange: (mode: CloudOpticsViewMode) => void;
  selectedFieldKey: string;
  onSelectedFieldKeyChange: (fieldKey: string) => void;
  lowerAtmosphereV2FlowMode: LowerAtmosphereV2FlowMode;
  lowerAtmosphereV2State: LowerAtmosphereV2State;
  setLowerAtmosphereV2State: Dispatch<SetStateAction<LowerAtmosphereV2State>>;
}) {
  if (lab.id === FAIR_WEATHER_CUMULUS_LAB_ID) {
    return (
      <WorkbenchErrorBoundary
        boundaryKey={`${lab.id}-${workbench.selectedScenarioId}-${lowerAtmosphereV2FlowMode}-visualization`}
        fallbackTitle="Lower Atmosphere v2 visualization failed to render."
        fallbackBody="Reset the lab or choose another scenario."
      >
        <LowerAtmosphereV2VisualizationStage
          lab={lab}
          workbench={workbench}
          flowMode={lowerAtmosphereV2FlowMode}
          state={lowerAtmosphereV2State}
          setState={setLowerAtmosphereV2State}
        />
      </WorkbenchErrorBoundary>
    );
  }

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
      <WorkbenchErrorBoundary
        boundaryKey={`${lab.id}-${boundaryLayerState.selectedScenarioId}-visualization`}
        fallbackTitle="Profile visualization failed to render."
        fallbackBody="Reset the lab or change scenario settings and run again."
      >
        <BoundaryLayerVisualizationStage
          lab={lab}
          frame={boundaryLayerFrame}
          state={boundaryLayerState}
          setState={setBoundaryLayerState}
        />
      </WorkbenchErrorBoundary>
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

function LowerAtmosphereV2VisualizationStage({
  lab,
  workbench,
  flowMode,
  state,
  setState,
}: {
  lab: LabDefinition;
  workbench: WorkbenchState;
  flowMode: LowerAtmosphereV2FlowMode;
  state: LowerAtmosphereV2State;
  setState: Dispatch<SetStateAction<LowerAtmosphereV2State>>;
}) {
  const scenario = selectedLabScenario(lab, workbench);
  const contract = lowerAtmosphereV2ScenarioForId(scenario?.id);
  const profileFrames = lowerAtmosphereV2ProfileFrames(state);
  const selectedProfileFrame = selectedLowerAtmosphereV2ProfileFrame(state);
  const profileStatus = selectedProfileFrame.diagnostics.cloud_formation_potential_status;
  const cloudRun = state.cloudColumnRun;
  const cloudDiagnostics = cloudRun?.diagnostics ?? null;
  const profileTimeLabel = formatHoursAfterSunrise(selectedProfileFrame.time_hours_from_sunrise);
  const cloudStatusLabel = cloudDiagnostics
    ? lowerAtmosphereV2FriendlyStatusLabel(cloudDiagnostics.cloud_formation_status)
    : "Not evaluated";

  if (!scenario || !contract) {
    return (
      <section className="workbench-region visualization-stage" aria-labelledby="visualization-stage-title">
        <p className="region-label">Visualization stage</p>
        <h2 id="visualization-stage-title">Lower Atmosphere v2 shell</h2>
        <div className="stage-empty-state" role="status">
          <strong>Scenario metadata is unavailable.</strong>
          <p>Reset the lab or return to the Lab Picker.</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="workbench-region visualization-stage lower-atmosphere-v2-stage"
      aria-labelledby="visualization-stage-title"
    >
      <div className="stage-heading">
        <p className="region-label">Visualization stage</p>
        <div className="stage-title-row">
          <h2 id="visualization-stage-title">Lower Atmosphere v2 reduced-model shell</h2>
          <div className="frame-readout" aria-label="Lower Atmosphere v2 shell state">
            <span>{lowerAtmosphereV2FlowLabel(flowMode)}</span>
            <strong>{lowerAtmosphereV2RunStatus(state) === "ready" ? "No run data yet" : runStatusLabel(lowerAtmosphereV2RunStatus(state))}</strong>
          </div>
        </div>
      </div>

      <div className="stage-toolbar">
        <p className="field-scale-title">{contract.physicalQuestion}</p>
        <span className="diagnostic-status diagnostic-status-not_evaluated">
          No Boussinesq default
        </span>
      </div>

      <div className="v2-shell-view-grid" aria-label="Lower Atmosphere v2 science views">
        <section className="v2-shell-view-card" aria-labelledby="v2-profile-view-title">
          <p className="region-label">Profile evolution</p>
          <h3 id="v2-profile-view-title">boundary_layer_1d profile view</h3>
          <p>{profileFrames.length > 0 ? `Profile run produced ${profileFrames.length} profile samples.` : "Ready for temperature/RH profile evolution, mixed-layer depth, LCL, and cap markers."}</p>
          <p className="control-helper">
            Atmosphere evolution produces no cloud water in v1. It diagnoses cloud formation potential.
          </p>
          <dl className="diagnostic-list">
            <div>
              <dt>Selected profile time</dt>
              <dd>{profileTimeLabel}</dd>
            </div>
            <div>
              <dt>Profile status</dt>
              <dd>{statusLabel(profileStatus)}</dd>
            </div>
            <div>
              <dt>Mixed-layer depth / LCL</dt>
              <dd>
                {formatMeters(selectedProfileFrame.mixed_layer_depth_m)} / {formatMeters(selectedProfileFrame.lcl_m)}
              </dd>
            </div>
          </dl>
        </section>
        <section className="v2-shell-view-card" aria-labelledby="v2-column-view-title">
          <p className="region-label">Cloud-column result</p>
          <h3 id="v2-column-view-title">controlled_cloud_column view</h3>
          <p>{cloudRun ? `Cloud-column run produced ${cloudRun.frames.length} controlled-column samples.` : "Ready for prescribed-lift height, RH, cloud liquid water, first cloud time, and cloud base."}</p>
          <p className="control-helper">Lift is prescribed forcing, not predicted circulation.</p>
          <dl className="diagnostic-list">
            <div>
              <dt>Cloud-column status</dt>
              <dd>{cloudStatusLabel}</dd>
            </div>
            <div>
              <dt>First cloud time</dt>
              <dd>{formatSeconds(cloudDiagnostics?.first_cloud_time_seconds ?? null)}</dd>
            </div>
            <div>
              <dt>Max cloud water</dt>
              <dd>{formatNullable(cloudDiagnostics?.max_cloud_liquid_water_kg_per_kg ?? null, "kg/kg")}</dd>
            </div>
          </dl>
        </section>
        <section className="v2-shell-view-card" aria-labelledby="v2-combined-view-title">
          <p className="region-label">Combined result</p>
          <h3 id="v2-combined-view-title">Evolution + lifted cloud summary</h3>
          <p>Selected profile time: {profileTimeLabel}</p>
          <p>Profile status: {statusLabel(profileStatus)}. Cloud-column status: {cloudStatusLabel}.</p>
          <p className="control-helper">
            Profile source/provenance: {state.cloudColumnProvenance?.source_model ?? "boundary_layer_1d"} at {profileTimeLabel}.
          </p>
        </section>
      </div>

      <section className="boundary-layer-replay-panel" aria-label="Lower Atmosphere v2 timeline scrubber">
        <div className="boundary-layer-replay-heading">
          <strong>Timeline / scrubber</strong>
          <span>{profileFrames.length > 0 ? profileTimeLabel : "Run profile evolution to select an evolved profile time."}</span>
        </div>
        <input
          type="range"
          min="0"
          max={Math.max(0, profileFrames.length - 1)}
          value={profileFrames.length > 0 ? state.selectedProfileFrameIndex : 0}
          disabled={profileFrames.length === 0}
          aria-label="Lower Atmosphere v2 timeline scrubber"
          onChange={(event) =>
            setState((current) =>
              selectLowerAtmosphereV2ProfileFrame(current, Number(event.currentTarget.value)),
            )
          }
        />
        <div className="timeline-actions" aria-label="Lower Atmosphere v2 placeholder replay actions">
          <button
            type="button"
            disabled={profileFrames.length === 0}
            onClick={() => setState((current) => selectLowerAtmosphereV2ProfileFrame(current, 0))}
          >
            First
          </button>
          <button type="button" disabled title="Profile replay is reserved for visualization work.">
            Play
          </button>
          <button
            type="button"
            disabled={profileFrames.length === 0}
            onClick={() =>
              setState((current) =>
                selectLowerAtmosphereV2ProfileFrame(current, lowerAtmosphereV2ProfileFrames(current).length - 1),
              )
            }
          >
            Final
          </button>
        </div>
      </section>

      <dl className="stage-stats">
        <div>
          <dt>Profile status</dt>
          <dd>{statusLabel(profileStatus)}</dd>
        </div>
        <div>
          <dt>Cloud status</dt>
          <dd>{cloudStatusLabel}</dd>
        </div>
        <div>
          <dt>Selected profile time</dt>
          <dd>{profileTimeLabel}</dd>
        </div>
        <div>
          <dt>Precipitation status</dt>
          <dd>{lowerAtmosphereV2FriendlyStatusLabel(contract.expectedPrecipitationStatus)}</dd>
        </div>
      </dl>

      <div className="assumption-labels" aria-label="Lower Atmosphere v2 honesty labels">
        <span>Model assumptions</span>
        <p>{["Reduced model", "1-D profile evolution", "Prescribed lift", "Controlled cloud formation", "Not cloud-resolving dynamics", "No Boussinesq default", "Not weather prediction"].join(" · ")}</p>
      </div>

      {state.message ? <p className="workbench-message">{state.message}</p> : null}
    </section>
  );
}

function BoundaryLayerVisualizationStage({
  lab,
  frame,
  state,
  setState,
}: {
  lab: LabDefinition;
  frame: BoundaryLayer1DFrame | null;
  state: BoundaryLayer1DState;
  setState: Dispatch<SetStateAction<BoundaryLayer1DState>>;
}) {
  const frames = usableBoundaryLayerFrames(state.run);
  const activeFrame = frame ?? boundaryLayerPreviewFrame(state);
  const initialFrame = frames[0] ?? null;
  const hasRun = frames.length > 0;
  const status = activeFrame.diagnostics.cloud_formation_potential_status;
  const temperaturePoints = profileLinePoints(
    activeFrame,
    activeFrame.temperature_k.map((value) => value - 273.15),
    "temperature",
  );
  const rhPoints = profileLinePoints(activeFrame, activeFrame.relative_humidity_percent, "rh");
  const initialTemperaturePoints = initialFrame
    ? profileLinePoints(
        initialFrame,
        initialFrame.temperature_k.map((value) => value - 273.15),
        "temperature",
      )
    : "";
  const initialRhPoints = initialFrame
    ? profileLinePoints(initialFrame, initialFrame.relative_humidity_percent, "rh")
    : "";
  const markers = [
    { label: "Mixed-layer depth", value: activeFrame.mixed_layer_depth_m, className: "mixed-layer" },
    { label: "LCL", value: activeFrame.lcl_m, className: "lcl" },
    { label: "Inversion / cap", value: activeFrame.inversion_height_m, className: "cap" },
  ];
  const diagnosticView = boundaryLayerDiagnosticViewModel(
    frame,
    boundaryLayer1DScenarioForId(state.selectedScenarioId),
  );

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
            <span>{hasRun ? `${frames.length} profile samples` : "No profile samples yet"}</span>
            <strong>{formatHoursAfterSunrise(activeFrame.time_hours_from_sunrise)}</strong>
          </div>
        </div>
      </div>
      <div className="stage-toolbar">
        <p className="field-scale-title">
          Profile at {formatHoursAfterSunrise(activeFrame.time_hours_from_sunrise)}
        </p>
        <span className={`diagnostic-status diagnostic-status-${status}`}>
          Cloud formation potential: {statusLabel(status)}
        </span>
      </div>
      {!hasRun ? (
        <p className="workbench-message">
          Ready to evolve the profile. Choose a scenario and run the profile from sunrise through the selected duration.
        </p>
      ) : null}
      <div className="profile-sounding-shell">
        <div className="profile-sounding-chart" role="img" aria-label={`${lab.name} 1-D profile visualization`}>
          <span className="axis-label axis-label-y">Height, z (m)</span>
          <AxisTicks orientation="y" maxValue={state.config.height_m} />
          <div className="profile-sounding-plot">
            <AxisGrid orientation="y" maxValue={state.config.height_m} />
            <svg className="profile-sounding-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
              <title>Temperature and RH profile</title>
              {initialFrame ? (
                <>
                  <polyline points={initialTemperaturePoints} className="profile-line profile-line-initial-temperature" />
                  <polyline points={initialRhPoints} className="profile-line profile-line-initial-rh" />
                </>
              ) : null}
              <polyline points={temperaturePoints} className="profile-line profile-line-temperature" />
              <polyline points={rhPoints} className="profile-line profile-line-rh" />
            </svg>
            {markers.map((marker) => (
              <span
                key={marker.label}
                className={`profile-marker profile-marker-${marker.className}`}
                style={{ bottom: `${profileHeightPercent(activeFrame, marker.value)}%` }}
                aria-hidden="true"
              />
            ))}
          </div>
          <div className="profile-sounding-legend">
            <span className="temperature-key">Temperature profile</span>
            <span className="rh-key">RH profile</span>
            <span className="initial-key">Initial profile</span>
            <span className="marker-key">Profile markers</span>
          </div>
        </div>
      </div>
      <BoundaryLayerInlineReplayControls state={state} setState={setState} />
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
      <dl className="boundary-layer-marker-list" aria-label="Profile markers">
        {markers.map((marker) => (
          <div key={marker.label}>
            <dt>{marker.label}</dt>
            <dd>{formatMeters(marker.value)}</dd>
          </div>
        ))}
      </dl>
      <p className="stage-helper">{diagnosticView.scenarioCheckLabel}</p>
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
  lowerAtmosphereV2FlowMode,
  lowerAtmosphereV2State,
  saveMessage,
}: {
  lab: LabDefinition;
  summary: ReturnType<typeof buildWorkbenchInspectorSummary>;
  workbench: WorkbenchState;
  cloudOpticsControls: CloudOpticsSceneControls | null;
  cloudOpticsViewMode: CloudOpticsViewMode;
  boundaryLayerState: BoundaryLayer1DState;
  boundaryLayerFrame: BoundaryLayer1DFrame | null;
  lowerAtmosphereV2FlowMode: LowerAtmosphereV2FlowMode;
  lowerAtmosphereV2State: LowerAtmosphereV2State;
  saveMessage: string | null;
}) {
  if (lab.id === FAIR_WEATHER_CUMULUS_LAB_ID) {
    return (
      <WorkbenchErrorBoundary
        boundaryKey={`${lab.id}-${workbench.selectedScenarioId}-${lowerAtmosphereV2FlowMode}-inspector`}
        fallbackTitle="Lower Atmosphere v2 diagnostics failed to render."
        fallbackBody="The reduced-model shell data may be incomplete or inconsistent."
      >
        <LowerAtmosphereV2InspectorPanel
          lab={lab}
          workbench={workbench}
          flowMode={lowerAtmosphereV2FlowMode}
          state={lowerAtmosphereV2State}
          saveMessage={saveMessage}
        />
      </WorkbenchErrorBoundary>
    );
  }

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
      <WorkbenchErrorBoundary
        boundaryKey={`${lab.id}-${boundaryLayerState.selectedScenarioId}-inspector`}
        fallbackTitle="Diagnostics failed to render."
        fallbackBody="The profile run data may be incomplete or inconsistent."
      >
        <BoundaryLayerInspectorPanel
          lab={lab}
          state={boundaryLayerState}
          frame={boundaryLayerFrame}
        />
      </WorkbenchErrorBoundary>
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

function LowerAtmosphereV2InspectorPanel({
  lab,
  workbench,
  flowMode,
  state,
  saveMessage,
}: {
  lab: LabDefinition;
  workbench: WorkbenchState;
  flowMode: LowerAtmosphereV2FlowMode;
  state: LowerAtmosphereV2State;
  saveMessage: string | null;
}) {
  const scenario = selectedLabScenario(lab, workbench);
  const contract = lowerAtmosphereV2ScenarioForId(scenario?.id);
  const selectedProfileFrame = selectedLowerAtmosphereV2ProfileFrame(state);
  const profileStatus = lowerAtmosphereV2ObservedProfileStatus(state);
  const cloudStatus = lowerAtmosphereV2ObservedCloudStatus(state);
  const cloudDiagnostics = state.cloudColumnRun?.diagnostics ?? null;

  if (!scenario || !contract) {
    return (
      <aside className="workbench-region inspector-region" aria-labelledby="inspector-region-title">
        <p className="region-label">Inspector</p>
        <h2 id="inspector-region-title">Lower Atmosphere v2 diagnostics unavailable</h2>
        <p className="empty-diagnostic">
          Scenario metadata is missing. Reset the lab or choose another scenario.
        </p>
      </aside>
    );
  }

  return (
    <aside className="workbench-region inspector-region" aria-labelledby="inspector-region-title">
      <p className="region-label">Inspector</p>
      <section className="inspector-summary" aria-labelledby="inspector-region-title">
        <h2 id="inspector-region-title">Lower Atmosphere v2 inspector shell</h2>
        <span className="diagnostic-status diagnostic-status-not_evaluated">
          Flow: {lowerAtmosphereV2FlowLabel(flowMode)}
        </span>
        <p>
          Deterministic diagnostics combine profile evolution, prescribed-lift cloud formation,
          expected-vs-observed scenario checks, and precipitation readiness.
        </p>
      </section>

      <details className="inspector-details" open>
        <summary>Profile diagnostics</summary>
        <dl className="diagnostic-list">
          <div>
            <dt>Observed profile status</dt>
            <dd>{profileStatus ? statusLabel(profileStatus) : "Run profile evolution to evaluate"}</dd>
          </div>
          <div>
            <dt>Selected profile time</dt>
            <dd>{formatHoursAfterSunrise(selectedProfileFrame.time_hours_from_sunrise)}</dd>
          </div>
          <div>
            <dt>Mixed-layer depth / LCL</dt>
            <dd>
              {formatMeters(selectedProfileFrame.mixed_layer_depth_m)} / {formatMeters(selectedProfileFrame.lcl_m)}
            </dd>
          </div>
          <div>
            <dt>Profile source</dt>
            <dd>{state.cloudColumnProvenance?.source_model ?? "boundary_layer_1d"}</dd>
          </div>
        </dl>
      </details>

      <details className="inspector-details" open>
        <summary>Cloud-column diagnostics</summary>
        <dl className="diagnostic-list">
          <div>
            <dt>Observed cloud-column status</dt>
            <dd>{cloudStatus ? lowerAtmosphereV2FriendlyStatusLabel(cloudStatus) : "Run prescribed lift to evaluate"}</dd>
          </div>
          <div>
            <dt>Cloud-column model</dt>
            <dd>controlled_cloud_column</dd>
          </div>
          <div>
            <dt>Forcing</dt>
            <dd>Prescribed lift, not predicted dynamics</dd>
          </div>
          <div>
            <dt>First cloud time / base</dt>
            <dd>
              {formatSeconds(cloudDiagnostics?.first_cloud_time_seconds ?? null)} /{" "}
              {formatMeters(cloudDiagnostics?.cloud_base_m ?? null)}
            </dd>
          </div>
          <div>
            <dt>Max cloud liquid water</dt>
            <dd>{formatNullable(cloudDiagnostics?.max_cloud_liquid_water_kg_per_kg ?? null, "kg/kg")}</dd>
          </div>
        </dl>
      </details>

      <details className="inspector-details" open>
        <summary>Expected vs observed</summary>
        <dl className="diagnostic-list">
          <div>
            <dt>Expected</dt>
            <dd>
              {statusLabel(contract.expectedProfileStatus)} /{" "}
              {lowerAtmosphereV2FriendlyStatusLabel(contract.expectedCloudColumnStatus)}
            </dd>
          </div>
          <div>
            <dt>Observed</dt>
            <dd>
              {profileStatus ? statusLabel(profileStatus) : "Profile not run"} /{" "}
              {cloudStatus ? lowerAtmosphereV2FriendlyStatusLabel(cloudStatus) : "Cloud column not run"}
            </dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              {lowerAtmosphereV2ScenarioCheckLabel(
                contract.expectedProfileStatus,
                contract.expectedCloudColumnStatus,
                profileStatus,
                cloudStatus,
              )}
            </dd>
          </div>
        </dl>
      </details>

      <details className="inspector-details" open>
        <summary>Precipitation status placeholder</summary>
        <p className="assumption-copy">
          Precipitation: {lowerAtmosphereV2FriendlyStatusLabel(contract.expectedPrecipitationStatus)}.
          Cloud water from controlled_cloud_column will be available for future warm-rain diagnostics,
          but this shell does not implement rain physics.
        </p>
      </details>

      <details className="inspector-details" open>
        <summary>Assumptions and limitations</summary>
        <p className="assumption-copy">
          {["Reduced model", "1-D profile evolution", "Prescribed lift", "Controlled cloud formation", "Not cloud-resolving dynamics", "No Boussinesq default", "Not weather prediction"].join(" · ")}
        </p>
        <ul>
          {contract.knownLimitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </details>

      {saveMessage ? <p className="workbench-message">{saveMessage}</p> : null}
      {state.message ? <p className="workbench-message">{state.message}</p> : null}
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
  const diagnosticView = boundaryLayerDiagnosticViewModel(
    frame,
    boundaryLayer1DScenarioForId(state.selectedScenarioId),
  );
  const diagnostics = activeFrame.diagnostics;

  return (
    <aside className="workbench-region inspector-region" aria-labelledby="inspector-region-title">
      <p className="region-label">Inspector</p>
      <section className="inspector-summary" aria-labelledby="inspector-region-title">
        <h2 id="inspector-region-title">Cloud formation potential</h2>
        <span className={`diagnostic-status diagnostic-status-${diagnosticView.status}`}>
          Result: {diagnosticView.statusLabel}
        </span>
        <p>{diagnosticView.explanation}</p>
      </section>

      <details className="inspector-details" open>
        <summary>Scenario check</summary>
        <dl className="diagnostic-list">
          <div>
            <dt>Expected</dt>
            <dd>{diagnosticView.expectedLabel}</dd>
          </div>
          <div>
            <dt>Observed</dt>
            <dd>{diagnosticView.observedLabel}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{diagnosticView.scenarioCheckLabel}</dd>
          </div>
        </dl>
      </details>

      <details className="inspector-details" open>
        <summary>Try next</summary>
        <ul>
          {diagnosticView.tryNext.map((suggestion) => (
            <li key={suggestion}>{suggestion}</li>
          ))}
        </ul>
      </details>

      <details className="inspector-details" open>
        <summary>Profile diagnostics</summary>
        <dl className="diagnostic-list">
          <div>
            <dt>Cloud formation potential status</dt>
            <dd>{diagnosticView.statusLabel}</dd>
          </div>
          <div>
            <dt>Deterministic limiting reason</dt>
            <dd>{diagnosticView.reason}</dd>
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

function BoundaryLayerInlineReplayControls({
  state,
  setState,
}: {
  state: BoundaryLayer1DState;
  setState: Dispatch<SetStateAction<BoundaryLayer1DState>>;
}) {
  const frames = usableBoundaryLayerFrames(state.run);
  const max = Math.max(0, frames.length - 1);
  const currentFrame = boundaryLayerDisplayedFrame(state);
  const canReplay = frames.length > 0;
  const isReplaying = state.status === "replaying";

  return (
    <section className="boundary-layer-replay-panel" aria-label="Profile replay controls">
      <div className="boundary-layer-replay-heading">
        <strong>
          {currentFrame
            ? formatHoursAfterSunrise(currentFrame.time_hours_from_sunrise)
            : "Ready to evolve"}
        </strong>
        <span>{canReplay ? `${frames.length} profile samples` : "Run profile evolution to create replay frames"}</span>
      </div>
      <input
        type="range"
        min="0"
        max={max}
        value={canReplay ? state.displayedFrameIndex : 0}
        disabled={!canReplay}
        aria-label="Profile time scrubber"
        onChange={(event) => {
          const frameIndex = Number(event.currentTarget.value);
          setState((current) => selectBoundaryLayerFrame(current, frameIndex));
        }}
      />
      <div className="timeline-actions boundary-layer-replay-actions" aria-label="Profile replay actions">
        <button
          type="button"
          onClick={() => setState((current) => selectBoundaryLayerFrame(current, 0))}
          disabled={!canReplay}
        >
          First
        </button>
        <button
          type="button"
          onClick={() => setState((current) => isReplaying ? pauseBoundaryLayerReplay(current) : playBoundaryLayerReplay(current))}
          disabled={!canReplay || state.status === "complete"}
        >
          {isReplaying ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          onClick={() => setState((current) => replayBoundaryLayerEvolution(current))}
          disabled={!canReplay}
        >
          Replay evolution
        </button>
        <button
          type="button"
          onClick={() => setState((current) => selectFinalBoundaryLayerFrame(current))}
          disabled={!canReplay}
        >
          Final
        </button>
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

function lowerAtmosphereV2FlowLabel(flowMode: LowerAtmosphereV2FlowMode): string {
  return LOWER_ATMOSPHERE_V2_FLOW_OPTIONS.find((option) => option.id === flowMode)?.label ?? "Evolve + lift";
}

function lowerAtmosphereV2FlowDescription(flowMode: LowerAtmosphereV2FlowMode): string {
  return (
    LOWER_ATMOSPHERE_V2_FLOW_OPTIONS.find((option) => option.id === flowMode)?.description ??
    "Evolve the atmosphere first, then run prescribed lift from a selected profile time."
  );
}

function formatShellValue(value: string | number | undefined, suffix?: string): string {
  if (typeof value === "number") {
    return suffix ? `${value.toLocaleString()} ${suffix}` : value.toLocaleString();
  }
  if (typeof value === "string" && value.length > 0) {
    return suffix ? `${value} ${suffix}` : value;
  }
  return "Scenario default";
}

function resolutionLabel(value: string): string {
  return WORKBENCH_RESOLUTION_PRESETS.find((preset) => preset.slug === value)?.name ?? "Medium";
}

function runStatusLabel(status: string): string {
  switch (status) {
    case "ready":
      return "Ready";
    case "computing":
      return "Computing";
    case "replaying":
      return "Replaying";
    case "paused":
      return "Paused";
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

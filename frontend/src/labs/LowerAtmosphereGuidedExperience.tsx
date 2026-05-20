import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";

import {
  loadLocalReferenceRuns,
  preferredReferenceRuns,
  referenceRunForCase,
} from "../reference/localReferenceRuns";
import { createTinyCm1ReferenceRunFixture } from "../reference/referenceFixtures";
import { ReferenceReplayView } from "../reference/ReferenceReplayView";
import type { ReferenceRun } from "../reference/referenceTypes";
import {
  formatMeters,
  formatSeconds,
  selectWorkbenchScenario,
  selectedLabScenario,
  type WorkbenchState,
} from "../workbench/workbenchRunLoop";
import type { LabDefinition } from "./labTypes";
import {
  buildLowerAtmosphereV2DiagnosticViewModel,
  lowerAtmosphereV2RunStatus,
  lowerAtmosphereV2ScenarioForId,
  lowerAtmosphereV2StatusLabel,
  selectedLowerAtmosphereV2ProfileFrame,
  selectLowerAtmosphereV2Scenario,
  type LowerAtmosphereV2State,
} from "./lowerAtmosphereV2Orchestration";
import {
  buildLowerAtmosphereV2ReferenceComparisonViewModel,
  type LowerAtmosphereV2ReferenceComparisonViewModel,
} from "./lowerAtmosphereV2ReferenceComparison";
import {
  lowerAtmosphereV2ScenarioContracts,
  type LowerAtmosphereV2FlowMode,
  type LowerAtmosphereV2ScenarioContract,
} from "./lowerAtmosphereV2Scenarios";

type LowerAtmosphereGuidedExperienceProps = {
  lab: LabDefinition;
  workbench: WorkbenchState;
  setWorkbench: Dispatch<SetStateAction<WorkbenchState>>;
  flowMode: LowerAtmosphereV2FlowMode;
  setFlowMode: Dispatch<SetStateAction<LowerAtmosphereV2FlowMode>>;
  state: LowerAtmosphereV2State;
  setState: Dispatch<SetStateAction<LowerAtmosphereV2State>>;
  isRunning: boolean;
  onRun: () => void;
  onReset: () => void;
};

type TryNext = {
  title: string;
  description: string;
  tweaks: Array<{ label: string; description: string; enabled: boolean }>;
  scenarios: Array<{ scenarioId: string; reason: string }>;
};

export function LowerAtmosphereGuidedExperience({
  lab,
  workbench,
  setWorkbench,
  flowMode,
  setFlowMode,
  state,
  setState,
  isRunning,
  onRun,
  onReset,
}: LowerAtmosphereGuidedExperienceProps) {
  const referenceRunPreview = useMemo(() => createTinyCm1ReferenceRunFixture(), []);
  const [localReferenceRuns, setLocalReferenceRuns] = useState<ReferenceRun[]>([]);
  const [experimentChooserOpen, setExperimentChooserOpen] = useState(false);
  const scenario = selectedLabScenario(lab, workbench);
  const contract = lowerAtmosphereV2ScenarioForId(scenario?.id) ?? lowerAtmosphereV2ScenarioContracts[0];
  const runStatus = lowerAtmosphereV2RunStatus(state);
  const hasRun = runStatus === "complete";
  const diagnosticView = buildLowerAtmosphereV2DiagnosticViewModel(state, flowMode, contract);
  const selectedProfileFrame = selectedLowerAtmosphereV2ProfileFrame(state);
  const referenceRuns = preferredReferenceRuns(localReferenceRuns, [referenceRunPreview]);
  const referenceComparison = buildLowerAtmosphereV2ReferenceComparisonViewModel({
    contract,
    state,
    referenceRuns,
  });
  const displayedReferenceRun =
    (referenceComparison.mapping
      ? referenceRunForCase(referenceComparison.mapping.referenceCaseId, localReferenceRuns, [referenceRunPreview])
      : null) ?? referenceRunPreview;
  const mainStory = guidedStory(contract, state, displayedReferenceRun, hasRun);
  const keyNumbers = guidedKeyNumbers(displayedReferenceRun, diagnosticView);
  const tryNext = guidedTryNext(contract, diagnosticView.tryNext);
  const autoReplayKey = hasRun
    ? `${state.selectedScenarioId}-${state.profileRun?.frames.length ?? 0}-${state.cloudColumnRun?.frames.length ?? 0}`
    : null;

  useEffect(() => {
    let canceled = false;
    loadLocalReferenceRuns()
      .then((runs) => {
        if (!canceled) {
          setLocalReferenceRuns(runs);
        }
      })
      .catch(() => {
        if (!canceled) {
          setLocalReferenceRuns([]);
        }
      });
    return () => {
      canceled = true;
    };
  }, []);

  function chooseScenario(scenarioId: string) {
    setWorkbench((current) => selectWorkbenchScenario(current, lab, scenarioId));
    setState((current) => selectLowerAtmosphereV2Scenario(current, scenarioId));
    setExperimentChooserOpen(false);
  }

  return (
    <section className="lower-atmosphere-guided-experience" aria-labelledby="guided-lower-atmosphere-title">
      <div className="guided-hero">
        <p className="region-label">Guided cloud experiment</p>
        <div className="guided-hero-title-row">
          <div>
            <h2 id="guided-lower-atmosphere-title">Lower Atmosphere Cloud Basics</h2>
            <p>
              Choose an experiment, watch the cloud field evolve, then use the
              atmospheric clues to decide what to try next.
            </p>
          </div>
          <p className={`run-state run-state-${runStatus}`}>Status: {runStatusLabel(runStatus)}</p>
        </div>
      </div>

      <section className={`experiment-chooser${experimentChooserOpen ? " expanded" : " collapsed"}`} aria-labelledby="experiment-chooser-title">
        <div className="section-title-row">
          <div>
            <p className="region-label">{experimentChooserOpen ? "Choose an experiment" : "Selected experiment"}</p>
            <h3 id="experiment-chooser-title">{experimentChooserOpen ? "What cloud question do you want to test?" : contract.name}</h3>
            <p className="selected-experiment-question">
              <strong>Question:</strong> {contract.physicalQuestion}
            </p>
          </div>
          <button type="button" className="ghost-button change-experiment-button" onClick={() => setExperimentChooserOpen((current) => !current)}>
            {experimentChooserOpen ? "Keep selected experiment" : "Change experiment"}
          </button>
        </div>
        {!experimentChooserOpen ? (
          <div className="selected-experiment-summary">
            <span className="experiment-status-badge">{experimentSummary(contract.id).status}</span>
            <p>
              {contract.shortDescription} {experimentSummary(contract.id).visual}
            </p>
            <div className="compact-scenario-links" aria-label="Try another experiment">
              <strong>Try another:</strong>
              {relatedScenarioIds(contract).map((scenarioId) => {
                const related = lowerAtmosphereV2ScenarioForId(scenarioId);
                return related ? (
                  <button type="button" key={scenarioId} onClick={() => chooseScenario(scenarioId)}>
                    {related.name}
                  </button>
                ) : null;
              })}
            </div>
          </div>
        ) : (
          <div className="experiment-card-grid">
            {lowerAtmosphereV2ScenarioContracts.map((candidate) => (
              <ExperimentCard
                key={candidate.id}
                contract={candidate}
                selected={candidate.id === state.selectedScenarioId}
                onChoose={() => chooseScenario(candidate.id)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="guided-result-card" aria-labelledby="guided-result-title">
        <div>
          <p className="region-label">{contract.name}</p>
          <h3 id="guided-result-title">{mainStory.title}</h3>
          <p>{mainStory.body}</p>
          {!hasRun ? (
            <p className="pre-run-reference-note">
              The reference cloud evolution is already available because it is
              offline, precomputed, and ingested. Running the experiment computes
              the simplified interactive side so you can learn from the same
              atmospheric setup.
            </p>
          ) : null}
        </div>
        <dl className="guided-key-numbers" aria-label="Key cloud experiment numbers">
          {keyNumbers.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <ReferenceReplayView
        referenceRun={displayedReferenceRun}
        initialViewMode={hasRun ? "cloud-appearance" : "scientific-field"}
        preferredViewMode={hasRun ? "cloud-appearance" : undefined}
        autoReplayKey={autoReplayKey}
        workingControls={
          <GuidedExperimentControlBar
            flowMode={flowMode}
            setFlowMode={setFlowMode}
            runStatus={runStatus}
            hasRun={hasRun}
            isRunning={isRunning}
            onRun={onRun}
            onReset={onReset}
          />
        }
        title="Watch the cloud evolve"
        regionLabel="Cloud evolution"
        replayLabel="Replay the experiment"
        fieldSelectorLabel="Scientific field"
        showSourceDetails={false}
      />

      <section className="guided-science-notes" aria-labelledby="guided-science-title">
        <div>
          <p className="region-label">Understand why</p>
          <h3 id="guided-science-title">Atmospheric clues</h3>
          <p>{hasRun ? mainStory.body : "Run the experiment to connect the replay with moisture, LCL, stability, and lift clues."}</p>
        </div>
        <div className="atmospheric-clue-grid" aria-label="Scenario-specific atmospheric clues">
          {atmosphericClues(contract, displayedReferenceRun, diagnosticView, hasRun).map((clue) => (
            <article key={clue.label}>
              <strong>{clue.label}</strong>
              <p>{clue.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="try-next-panel" aria-labelledby="try-next-title">
        <p className="region-label">Try next</p>
        <h3 id="try-next-title">{tryNext.title}</h3>
        <p>{tryNext.description}</p>
        <div className="try-next-grid">
          <div>
            <h4>Tweak this setup</h4>
            <div className="try-next-actions">
              {tryNext.tweaks.map((tweak) => (
                <button type="button" key={tweak.label} disabled={!tweak.enabled} title={tweak.description}>
                  {tweak.label}
                  {!tweak.enabled ? " (planned)" : ""}
                </button>
              ))}
              <button type="button" onClick={onRun} disabled={isRunning}>
                Run current setup again
              </button>
            </div>
          </div>
          <div>
            <h4>Try another experiment</h4>
            <div className="try-next-actions">
              {tryNext.scenarios.map((option) => {
                const next = lowerAtmosphereV2ScenarioForId(option.scenarioId);
                return next ? (
                  <button type="button" key={option.scenarioId} onClick={() => chooseScenario(option.scenarioId)} title={option.reason}>
                    {next.name}
                  </button>
                ) : null;
              })}
              <button type="button" className="ghost-button" onClick={() => setExperimentChooserOpen(true)}>
                Open experiment picker
              </button>
            </div>
          </div>
        </div>
      </section>

      <details className="guided-model-details">
        <summary>Model details / Why trust this?</summary>
        <div className="model-details-grid">
          <section aria-labelledby="model-details-source-title">
            <p className="region-label">Source</p>
            <h3 id="model-details-source-title">Offline reference plus simplified explanation</h3>
            <p>
              The cloud replay comes from offline CM1 reference output when local
              ingested data is available. The interactive model explains the
              role of heating, moisture, stability, and prescribed lift; it is
              not a live CM1 simulation.
            </p>
            <div className="assumption-labels" aria-label="Guided Lower Atmosphere source labels">
              <span>Source</span>
              <p>{comparisonSourceLabels(referenceComparison.sourceLabels).join(" · ")}</p>
              <span>View</span>
              <p>Cloud appearance view · Scientific field view · Diagnostic explanation</p>
              <span>Assumptions</span>
              <p>Offline reference case · Not live CM1 simulation · Exact morphology is not pass/fail</p>
            </div>
          </section>

          <section aria-labelledby="model-details-profile-title">
            <p className="region-label">Interactive explanation</p>
            <h3 id="model-details-profile-title">Reduced-model support diagnostics</h3>
            <dl className="diagnostic-list">
              <div>
                <dt>Selected profile time</dt>
                <dd>{selectedProfileFrame.time_hours_from_sunrise.toFixed(1)} h after sunrise</dd>
              </div>
              <div>
                <dt>Profile status</dt>
                <dd>{diagnosticView.profile.statusLabel}</dd>
              </div>
              <div>
                <dt>Mixed layer / LCL</dt>
                <dd>
                  {formatMeters(selectedProfileFrame.mixed_layer_depth_m)} / {formatMeters(selectedProfileFrame.lcl_m)}
                </dd>
              </div>
              <div>
                <dt>Cloud-column status</dt>
                <dd>{diagnosticView.cloudColumn.statusLabel}</dd>
              </div>
            </dl>
          </section>
        </div>

        <ReferenceDiagnosticDetails viewModel={referenceComparison} />
      </details>

      {state.message && runStatus !== "ready" ? (
        <p className="workbench-message guided-workbench-message">{guidedStatusMessage(state.message)}</p>
      ) : null}
    </section>
  );
}

function ExperimentCard({
  contract,
  selected,
  onChoose,
}: {
  contract: LowerAtmosphereV2ScenarioContract;
  selected: boolean;
  onChoose: () => void;
}) {
  const summary = experimentSummary(contract.id);

  return (
    <article className={`experiment-card${selected ? " selected" : ""}`}>
      <div>
        <p className="region-label">{summary.status}</p>
        <h4>{contract.name}</h4>
        <p>{contract.physicalQuestion}</p>
      </div>
      <ul>
        <li>{summary.visual}</li>
        <li>{summary.controls}</li>
      </ul>
      <button type="button" onClick={onChoose} aria-pressed={selected}>
        {selected ? "Selected" : "Choose"}
      </button>
    </article>
  );
}

function GuidedExperimentControlBar({
  flowMode,
  setFlowMode,
  runStatus,
  hasRun,
  isRunning,
  onRun,
  onReset,
}: {
  flowMode: LowerAtmosphereV2FlowMode;
  setFlowMode: Dispatch<SetStateAction<LowerAtmosphereV2FlowMode>>;
  runStatus: string;
  hasRun: boolean;
  isRunning: boolean;
  onRun: () => void;
  onReset: () => void;
}) {
  return (
    <div className="guided-experiment-control-bar" aria-label="Experiment controls near cloud replay">
      <fieldset className="segmented-control guided-flow-selector">
        <legend>Run mode</legend>
        <div role="group" aria-label="Lower Atmosphere run mode">
          <button
            type="button"
            aria-pressed={flowMode === "evolution_lifted_cloud"}
            onClick={() => setFlowMode("evolution_lifted_cloud")}
          >
            Evolve + lift
          </button>
          <button
            type="button"
            aria-pressed={flowMode === "atmosphere_evolution"}
            onClick={() => setFlowMode("atmosphere_evolution")}
          >
            Atmosphere only
          </button>
          <button
            type="button"
            aria-pressed={flowMode === "lifted_cloud"}
            onClick={() => setFlowMode("lifted_cloud")}
          >
            Lift only
          </button>
        </div>
      </fieldset>
      <div className="guided-run-actions">
        <span className={`run-state run-state-${runStatus}`}>Status: {runStatusLabel(runStatus)}</span>
        <button type="button" onClick={onRun} disabled={isRunning}>
          {hasRun ? "Run again" : "Run experiment"}
        </button>
        <button type="button" className="ghost-button" onClick={onReset}>
          Reset
        </button>
      </div>
    </div>
  );
}

function ReferenceDiagnosticDetails({
  viewModel,
}: {
  viewModel: LowerAtmosphereV2ReferenceComparisonViewModel;
}) {
  return (
    <section className="reference-diagnostic-compare guided-reference-details" aria-labelledby="guided-reference-title">
      <div className="stage-heading">
        <p className="region-label">Reference check</p>
        <h3 id="guided-reference-title">Diagnostic comparison</h3>
      </div>
      {viewModel.preRunExplanation ? (
        <p className="reference-compare-prerun">
          Reference cloud evolution is available before you run the interactive experiment. Run the experiment to compute the simplified explanation side.
        </p>
      ) : null}
      {viewModel.fallbackMessage ? (
        <div className="stage-empty-state reference-compare-empty" role="status">
          <strong>{viewModel.fallbackMessage}</strong>
          <p>Cloud replay remains available through the loaded reference case or fixture.</p>
        </div>
      ) : (
        <div className="reference-compare-cards" aria-label="Model details diagnostic cards">
          {viewModel.rows.map((row) => (
            <article key={row.diagnostic} className="reference-compare-card">
              <p className="region-label">{row.category}</p>
              <h4>{row.diagnostic}</h4>
              <dl>
                <div>
                  <dt>Interactive</dt>
                  <dd>{row.reducedValue}</dd>
                </div>
                <div>
                  <dt>Reference</dt>
                  <dd>{row.referenceValue}</dd>
                </div>
              </dl>
              <p><strong>Read as:</strong> {row.interpretation}</p>
            </article>
          ))}
        </div>
      )}
      <p className="stage-helper">{viewModel.morphologyNote}</p>
    </section>
  );
}

function guidedStory(
  contract: LowerAtmosphereV2ScenarioContract,
  state: LowerAtmosphereV2State,
  referenceRun: ReferenceRun | null,
  hasRun: boolean,
): { title: string; body: string } {
  const referenceMaxCloud = referenceRun?.diagnostics?.max_cloud_liquid_water_kg_per_kg ?? null;
  const referenceCloudFormed = referenceMaxCloud !== null && referenceMaxCloud > 0;
  const cloudStatus = state.cloudColumnRun?.diagnostics.cloud_formation_status ?? null;

  if (!hasRun) {
    return {
      title: "Pick a setup, then run the cloud experiment",
      body:
        "Start with the reference cloud evolution, then run the interactive experiment to see how heating, moisture, stability, and lift explain the outcome.",
    };
  }

  if (cloudStatus === "dry_failed" || (!referenceCloudFormed && contract.id.includes("dry"))) {
    return {
      title: "Cloud did not form",
      body:
        "Air moved upward, but the lower atmosphere stayed too dry for meaningful condensation. Watch the motion fields without expecting cloud water to appear.",
    };
  }

  if (cloudStatus === "cap_suppressed") {
    return {
      title: "The cap limited cloud growth",
      body:
        "Heating and moisture were present, but a stable layer restricted how far lifted air could rise, keeping cloud shallow, delayed, or suppressed.",
    };
  }

  if (cloudStatus === "cloud_formed" || referenceCloudFormed) {
    return {
      title: "Cloud formed",
      body:
        "The lower atmosphere became moist and unstable enough for lifted air to cool to saturation. Cloud liquid water appears as shallow cumulus in the replay.",
    };
  }

  return {
    title: lowerAtmosphereV2StatusLabel(cloudStatus ?? contract.expectedCloudColumnStatus),
    body: "Use the replay, key numbers, and atmospheric clues below to identify what helped or limited cloud formation.",
  };
}

function guidedKeyNumbers(
  referenceRun: ReferenceRun | null,
  diagnosticView: ReturnType<typeof buildLowerAtmosphereV2DiagnosticViewModel>,
): Array<{ label: string; value: string }> {
  const diagnostics = referenceRun?.diagnostics ?? null;
  return [
    { label: "First cloud", value: formatSeconds(diagnostics?.first_cloud_time_seconds ?? null) },
    { label: "Cloud base", value: formatMeters(diagnostics?.cloud_base_m ?? null) },
    { label: "Cloud top", value: formatMeters(diagnostics?.cloud_top_m ?? null) },
    { label: "Max updraft", value: formatUnit(diagnostics?.max_updraft_m_per_s ?? null, "m/s") },
    {
      label: "Max cloud water",
      value: formatUnit(
        diagnostics?.max_cloud_liquid_water_kg_per_kg ??
          diagnosticView.cloudColumn.rows.find((row) => row.label === "Max cloud liquid water")?.value ??
          null,
        typeof diagnostics?.max_cloud_liquid_water_kg_per_kg === "number" ? "kg/kg" : "",
      ),
    },
  ];
}

function guidedTryNext(contract: LowerAtmosphereV2ScenarioContract, fallback: string[]): TryNext {
  const tweaks = tweakOptionsForScenario(contract.id, fallback);
  switch (contract.id) {
    case "lower-atmosphere-v2-dry-failed-cumulus":
      return {
        title: "Add moisture and compare with shallow cumulus",
        description:
          "Stay with the dry case to ask what would need to change, or switch to a wetter reference-backed contrast.",
        tweaks,
        scenarios: [
          { scenarioId: "lower-atmosphere-v2-baseline-shallow-cloud", reason: "Adds enough lower-layer moisture for shallow cloud." },
          { scenarioId: "lower-atmosphere-v2-humid-low-cloud-contrast", reason: "Shows the low-cloud contrast when the LCL is lower." },
        ],
      };
    case "lower-atmosphere-v2-baseline-shallow-cloud":
      return {
        title: "Change one cloud ingredient",
        description:
          "Compare the baseline against a drier, capped, or more humid setup to see which atmospheric ingredient controls the result.",
        tweaks,
        scenarios: [
          { scenarioId: "lower-atmosphere-v2-dry-failed-cumulus", reason: "Removes enough moisture to keep rising air cloud-free." },
          { scenarioId: "lower-atmosphere-v2-capped-suppressed-cloud", reason: "Adds a stronger cap that limits vertical growth." },
          { scenarioId: "lower-atmosphere-v2-humid-low-cloud-contrast", reason: "Lowers cloud base with a more humid lower layer." },
        ],
      };
    case "lower-atmosphere-v2-capped-suppressed-cloud":
      return {
        title: "Test what happens when the cap weakens",
        description:
          "Keep the cap in mind, then switch to a setup where cloud can grow deeper or where moisture becomes the limiting factor.",
        tweaks,
        scenarios: [
          { scenarioId: "lower-atmosphere-v2-baseline-shallow-cloud", reason: "Weakens the cap enough for shallow cumulus." },
          { scenarioId: "lower-atmosphere-v2-dry-failed-cumulus", reason: "Changes the limiting factor from stability to moisture." },
        ],
      };
    case "lower-atmosphere-v2-humid-low-cloud-contrast":
      return {
        title: "Raise the cloud base again",
        description:
          "Use a drier contrast or the baseline to see how lower-layer humidity controls LCL and cloud base.",
        tweaks,
        scenarios: [
          { scenarioId: "lower-atmosphere-v2-baseline-shallow-cloud", reason: "Returns to the reference-backed baseline." },
          { scenarioId: "lower-atmosphere-v2-dry-failed-cumulus", reason: "Raises the LCL until cloud fails." },
        ],
      };
    default:
      return {
        title: "Change one atmospheric ingredient",
        description:
          fallback.length > 0
            ? `Try to ${fallback[0]}. Keep the rest of the setup fixed so the cause is easier to see.`
            : "Choose one moisture, heating, stability, or lift contrast and run again.",
        tweaks,
        scenarios: relatedScenarioIds(contract).map((scenarioId) => ({
          scenarioId,
          reason: "Switch scenario while keeping the guided Lower Atmosphere lab context.",
        })),
      };
  }
}

function tweakOptionsForScenario(scenarioId: string, fallback: string[]): TryNext["tweaks"] {
  const planned = (label: string, description: string) => ({ label, description, enabled: false });
  switch (scenarioId) {
    case "lower-atmosphere-v2-dry-failed-cumulus":
      return [
        planned("Increase lower-layer humidity", "Planned control: lower the LCL by adding low-level moisture."),
        planned("Reduce dry air aloft", "Planned control: reduce entrainment drying above the mixed layer."),
      ];
    case "lower-atmosphere-v2-baseline-shallow-cloud":
      return [
        planned("Make this atmosphere drier", "Planned control: lower initial humidity while holding lift similar."),
        planned("Strengthen the cap", "Planned control: make the stable layer harder to penetrate."),
        planned("Reduce surface heating", "Planned control: weaken mixed-layer growth."),
      ];
    case "lower-atmosphere-v2-capped-suppressed-cloud":
      return [
        planned("Weaken the cap", "Planned control: reduce inversion strength."),
        planned("Raise the cap", "Planned control: move the stable layer upward."),
      ];
    case "lower-atmosphere-v2-humid-low-cloud-contrast":
      return [
        planned("Lower humidity", "Planned control: raise LCL and cloud base."),
        planned("Add dry air aloft", "Planned control: make cloud erosion easier."),
      ];
    default:
      return [
        planned("Change one physical ingredient", fallback[0] ?? "Planned control: vary moisture, heating, stability, or lift."),
      ];
  }
}

function atmosphericClues(
  contract: LowerAtmosphereV2ScenarioContract,
  referenceRun: ReferenceRun | null,
  diagnosticView: ReturnType<typeof buildLowerAtmosphereV2DiagnosticViewModel>,
  hasRun: boolean,
): Array<{ label: string; detail: string }> {
  const diagnostics = referenceRun?.diagnostics ?? null;
  const firstCloud = formatSeconds(diagnostics?.first_cloud_time_seconds ?? null);
  const cloudBase = formatMeters(diagnostics?.cloud_base_m ?? null);
  const cloudTop = formatMeters(diagnostics?.cloud_top_m ?? null);
  const rainOnset = formatSeconds(diagnostics?.first_rain_time_seconds ?? null);

  if (!hasRun) {
    return [
      { label: "Moisture", detail: "Look for whether the LCL is low enough for lifted air to saturate." },
      { label: "Lift", detail: "Rising air cools as it moves upward; cloud appears only if it reaches saturation." },
      { label: "Stability", detail: "A cap or inversion can stop growth even when low-level air is moist." },
      { label: "Scientific fields", detail: "Switch to Scientific Fields to inspect cloud water, vapor, theta, and vertical velocity." },
    ];
  }

  if (contract.id === "lower-atmosphere-v2-dry-failed-cumulus") {
    return [
      { label: "Moisture limit", detail: "The air did not reach enough saturation for meaningful cloud water." },
      { label: "Motion without cloud", detail: "Vertical motion can occur even when cloud water stays near zero." },
      { label: "What to change", detail: "Increase lower-layer humidity or reduce dry air aloft to lower the LCL." },
      { label: "Updraft clue", detail: `The reference max updraft is ${formatUnit(diagnostics?.max_updraft_m_per_s ?? null, "m/s")}.` },
    ];
  }

  if (contract.id === "lower-atmosphere-v2-capped-suppressed-cloud") {
    return [
      { label: "Cap strength", detail: "A stable layer limits how high lifted air can rise." },
      { label: "Cloud depth", detail: `Cloud depth should be read against the cap; current cloud layer is ${cloudBase} to ${cloudTop}.` },
      { label: "What to change", detail: "Weaken or raise the cap, then compare against the baseline shallow-cloud setup." },
      { label: "Run clue", detail: userFacingWhy(diagnosticView.why) },
    ];
  }

  if (contract.id === "lower-atmosphere-v2-humid-low-cloud-contrast") {
    return [
      { label: "Low LCL", detail: "More low-level humidity lowers the height where cloud can first appear." },
      { label: "Cloud base", detail: `Use cloud base (${cloudBase}) as the main clue for this contrast.` },
      { label: "What to change", detail: "Lower humidity to raise cloud base, or add dry air aloft to erode cloud." },
      { label: "Run clue", detail: userFacingWhy(diagnosticView.why) },
    ];
  }

  return [
    { label: "Moisture", detail: `Cloud formed because lower air was moist enough; first cloud appears around ${firstCloud}.` },
    { label: "Lift", detail: "Rising air cooled toward saturation and produced cloud liquid water." },
    { label: "Cloud depth", detail: `The reference cloud layer extends from about ${cloudBase} to ${cloudTop}.` },
    {
      label: "Rain signal",
      detail: rainOnset === "unavailable"
        ? "No rain onset is available for this reference frame set."
        : `Rain water appears around ${rainOnset} in the reference case.`,
    },
  ];
}

function relatedScenarioIds(contract: LowerAtmosphereV2ScenarioContract): string[] {
  const suggestions = contract.comparisonSuggestions.length
    ? contract.comparisonSuggestions
    : ["lower-atmosphere-v2-baseline-shallow-cloud", "lower-atmosphere-v2-dry-failed-cumulus"];
  return suggestions.filter((scenarioId) => scenarioId !== contract.id).slice(0, 3);
}

function experimentSummary(scenarioId: string): { status: string; visual: string; controls: string } {
  switch (scenarioId) {
    case "lower-atmosphere-v2-dry-failed-cumulus":
      return {
        status: "Reference-backed contrast",
        visual: "Motion without meaningful cloud water.",
        controls: "Try more lower-layer humidity or longer lift.",
      };
    case "lower-atmosphere-v2-baseline-shallow-cloud":
      return {
        status: "Reference-backed baseline",
        visual: "Shallow cloud appears, grows, and fades.",
        controls: "Try drier air, a stronger cap, or lower lift.",
      };
    case "lower-atmosphere-v2-capped-suppressed-cloud":
      return {
        status: "Reference planned",
        visual: "Stable air limits cloud depth.",
        controls: "Try weakening or raising the cap.",
      };
    case "lower-atmosphere-v2-humid-low-cloud-contrast":
      return {
        status: "Reference planned",
        visual: "Cloud base drops when the lower air is humid.",
        controls: "Try lowering humidity to raise the LCL.",
      };
    default:
      return {
        status: "Reduced-model experiment",
        visual: "Use the replay and diagnostics to inspect the outcome.",
        controls: "Change one physical ingredient and run again.",
      };
  }
}

function comparisonSourceLabels(labels: string[]): string[] {
  return labels.filter(
    (label) => !["Derived diagnostic", "Qualitative diagnostic comparison", "Not live CM1 simulation"].includes(label),
  );
}

function runStatusLabel(status: string): string {
  if (status === "ready") {
    return "Ready";
  }
  if (status === "computing") {
    return "Running";
  }
  if (status === "complete") {
    return "Complete";
  }
  if (status === "error") {
    return "Error";
  }
  return status;
}

function formatUnit(value: number | string | null, unit: string): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || !Number.isFinite(value)) {
    return "unavailable";
  }
  const formatted = Math.abs(value) > 0 && Math.abs(value) < 0.001 ? value.toExponential(2) : value.toPrecision(3);
  return unit ? `${formatted} ${unit}` : formatted;
}

function guidedStatusMessage(message: string): string {
  if (message.includes("Lower Atmosphere v2")) {
    return "Ready to run this cloud experiment.";
  }
  if (message.includes("v2 flow")) {
    return "Run complete. Use the replay and atmospheric clues to inspect what happened.";
  }
  if (message.includes("prescribed")) {
    return message.replace("prescribed cloud-column lift", "the lift step");
  }
  return message;
}

function userFacingWhy(message: string): string {
  return message
    .replace(/Lower Atmosphere v2/g, "this experiment")
    .replace(/prescribed cloud-column lift/g, "the lift step")
    .replace(/Run the selected this experiment flow/g, "Run the experiment");
}

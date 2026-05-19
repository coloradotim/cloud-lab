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
  targetScenarioId?: string;
  tweakOptions: Array<{ label: string; description: string; targetScenarioId: string }>;
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
        </div>
      </div>

      <details className="experiment-chooser" aria-labelledby="experiment-chooser-title">
        <summary>
          <span>
            <p className="region-label">Choose an experiment</p>
            <h3 id="experiment-chooser-title">What cloud question do you want to test?</h3>
          </span>
          <strong>{contract.name}</strong>
        </summary>
        <div className="experiment-chooser-current">
          <p>{contract.physicalQuestion}</p>
          <span>{experimentSummary(contract.id).status}</span>
        </div>
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
      </details>

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

      <section className="guided-replay-shell" aria-label="Cloud replay and run controls">
        <div className="guided-replay-controls">
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
          <div className="guided-action-card" aria-label="Experiment run controls">
            <span className={`run-state run-state-${runStatus}`}>Status: {runStatusLabel(runStatus)}</span>
            <button type="button" onClick={onRun} disabled={isRunning}>
              {hasRun ? "Run again" : "Run experiment"}
            </button>
            <button type="button" className="ghost-button" onClick={onReset}>
              Reset
            </button>
          </div>
        </div>
        <ReferenceReplayView
          referenceRun={displayedReferenceRun}
          initialViewMode={hasRun ? "cloud-appearance" : "scientific-field"}
          preferredViewMode={hasRun ? "cloud-appearance" : undefined}
          autoReplayKey={autoReplayKey}
          title="Watch the cloud evolve"
          regionLabel="Cloud evolution"
          replayLabel="Replay the experiment"
          fieldSelectorLabel="Scientific field"
          showSourceDetails={false}
        />
      </section>

      <section className="guided-science-notes" aria-labelledby="guided-science-title">
        <div>
          <p className="region-label">Understand why</p>
          <h3 id="guided-science-title">Atmospheric clues</h3>
          <p>{hasRun ? userFacingWhy(diagnosticView.why) : preRunWhy(contract)}</p>
        </div>
        <div className="variable-explainer-grid" aria-label="Scientific field explanations">
          <VariableExplainer label="Cloud liquid water" detail="Where condensed cloud exists in the vertical slice." />
          <VariableExplainer label="Water vapor / RH" detail="How close the air is to saturation before cloud appears." />
          <VariableExplainer label="Potential temperature" detail="A temperature-like field that helps reveal stability and lifted motion." />
          <VariableExplainer label="Vertical velocity" detail="Where air is rising or sinking; rising air can cool toward saturation." />
        </div>
      </section>

      <section className="try-next-panel" aria-labelledby="try-next-title">
        <p className="region-label">Try next</p>
        <h3 id="try-next-title">{tryNext.title}</h3>
        <p>{tryNext.description}</p>
        <div className="try-next-grid">
          <div className="try-next-tweaks" aria-label="Tweak this setup">
            {tryNext.tweakOptions.map((option) => (
              <button key={option.label} type="button" onClick={() => chooseScenario(option.targetScenarioId)}>
                <strong>{option.label}</strong>
                <span>{option.description}</span>
              </button>
            ))}
          </div>
          <label className="scenario-jump-control">
            <span>Move to a different experiment</span>
            <select
              value={state.selectedScenarioId}
              onChange={(event) => chooseScenario(event.currentTarget.value)}
            >
              {lowerAtmosphereV2ScenarioContracts.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="try-next-actions">
          <button type="button" onClick={onRun} disabled={isRunning}>
            Run current experiment
          </button>
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

function VariableExplainer({ label, detail }: { label: string; detail: string }) {
  return (
    <article>
      <strong>{label}</strong>
      <p>{detail}</p>
    </article>
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
  switch (contract.id) {
    case "lower-atmosphere-v2-dry-failed-cumulus":
      return {
        title: "Add moisture and compare with shallow cumulus",
        description:
          "Switch to the baseline shallow-cloud experiment to see how a moister lower layer changes rising motion into visible cloud.",
        targetScenarioId: "lower-atmosphere-v2-baseline-shallow-cloud",
        tweakOptions: [
          {
            label: "Add low-level moisture",
            description: "Move to the shallow-cloud baseline.",
            targetScenarioId: "lower-atmosphere-v2-baseline-shallow-cloud",
          },
          {
            label: "Try humid low cloud",
            description: "Lower the cloud base with a moister source layer.",
            targetScenarioId: "lower-atmosphere-v2-humid-low-cloud-contrast",
          },
        ],
      };
    case "lower-atmosphere-v2-baseline-shallow-cloud":
      return {
        title: "Make the same atmosphere drier",
        description:
          "Try the dry failed cumulus experiment next. The contrast shows why warm rising air still needs enough water vapor to condense.",
        targetScenarioId: "lower-atmosphere-v2-dry-failed-cumulus",
        tweakOptions: [
          {
            label: "Dry the lower air",
            description: "Watch cloud formation fail.",
            targetScenarioId: "lower-atmosphere-v2-dry-failed-cumulus",
          },
          {
            label: "Strengthen the cap",
            description: "Limit cloud depth with stable air.",
            targetScenarioId: "lower-atmosphere-v2-capped-suppressed-cloud",
          },
          {
            label: "Make cloud base lower",
            description: "Use the humid low-cloud contrast.",
            targetScenarioId: "lower-atmosphere-v2-humid-low-cloud-contrast",
          },
        ],
      };
    case "lower-atmosphere-v2-capped-suppressed-cloud":
      return {
        title: "Remove the cap contrast",
        description:
          "Compare against baseline shallow cloud to see how weakening the stable layer lets the cloud grow deeper.",
        targetScenarioId: "lower-atmosphere-v2-baseline-shallow-cloud",
        tweakOptions: [
          {
            label: "Weaken the cap",
            description: "Return to baseline shallow cloud.",
            targetScenarioId: "lower-atmosphere-v2-baseline-shallow-cloud",
          },
          {
            label: "Add moisture",
            description: "Test whether humidity helps despite stability.",
            targetScenarioId: "lower-atmosphere-v2-humid-low-cloud-contrast",
          },
        ],
      };
    case "lower-atmosphere-v2-humid-low-cloud-contrast":
      return {
        title: "Lower humidity and watch cloud base rise",
        description:
          "Compare against the dry failed or baseline experiment to see how near-surface humidity controls cloud base.",
        targetScenarioId: "lower-atmosphere-v2-dry-failed-cumulus",
        tweakOptions: [
          {
            label: "Dry the source layer",
            description: "Switch to dry failed cumulus.",
            targetScenarioId: "lower-atmosphere-v2-dry-failed-cumulus",
          },
          {
            label: "Return to baseline",
            description: "Compare against normal shallow cumulus.",
            targetScenarioId: "lower-atmosphere-v2-baseline-shallow-cloud",
          },
        ],
      };
    default:
      return {
        title: "Change one atmospheric ingredient",
        description:
          fallback.length > 0
            ? `Try to ${fallback[0]}. Keep the rest of the setup fixed so the cause is easier to see.`
            : "Choose one moisture, heating, stability, or lift contrast and run again.",
        tweakOptions: [
          {
            label: "Baseline shallow cloud",
            description: "Use the main cloud-forming reference.",
            targetScenarioId: "lower-atmosphere-v2-baseline-shallow-cloud",
          },
          {
            label: "Dry failed contrast",
            description: "Remove enough moisture for cloud to fail.",
            targetScenarioId: "lower-atmosphere-v2-dry-failed-cumulus",
          },
        ],
      };
  }
}

function preRunWhy(contract: LowerAtmosphereV2ScenarioContract): string {
  switch (contract.id) {
    case "lower-atmosphere-v2-dry-failed-cumulus":
      return "This experiment asks whether rising air can reach saturation when the lower atmosphere starts dry. Watch vertical velocity for motion, then cloud water to confirm that no meaningful cloud forms.";
    case "lower-atmosphere-v2-capped-suppressed-cloud":
      return "This experiment tests how a stable cap limits rising air. Watch potential temperature for the cap and cloud water for any shallow or delayed cloud response.";
    case "lower-atmosphere-v2-humid-low-cloud-contrast":
      return "This experiment raises near-surface humidity so lifted air reaches condensation sooner. Watch cloud base and the cloud-water field for a lower, easier cloud.";
    default:
      return "This experiment connects surface heating, lower-atmosphere moisture, stability, and lift. Watch cloud water for condensation, vertical velocity for rising air, and potential temperature for stability.";
  }
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

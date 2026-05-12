import type { LabDefinition } from "../labs/labTypes";

type WorkbenchMode = "single" | "saved-runs" | "compare" | "sweep";

type LabWorkbenchProps = {
  lab: LabDefinition;
  mode?: WorkbenchMode;
  onBackToLabs: () => void;
};

export function LabWorkbench({ lab, mode = "single", onBackToLabs }: LabWorkbenchProps) {
  const scenario = lab.scenarios[0];

  return (
    <main className="workbench-v2" aria-label={`${lab.name} workbench`}>
      <WorkbenchTopBar
        lab={lab}
        scenarioName={scenario?.name ?? "Scenario coming later"}
        mode={mode}
        onBackToLabs={onBackToLabs}
      />

      <section className="workbench-grid" aria-label="Workbench regions">
        <LabSetupPanel lab={lab} scenarioName={scenario?.name ?? "Moderate cloud base"} />
        <VisualizationStage lab={lab} />
        <InspectorPanel lab={lab} />
      </section>

      <TimelinePanel />
    </main>
  );
}

function WorkbenchTopBar({
  lab,
  scenarioName,
  mode,
  onBackToLabs,
}: {
  lab: LabDefinition;
  scenarioName: string;
  mode: WorkbenchMode;
  onBackToLabs: () => void;
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
        <button type="button">Run</button>
        <button type="button">Reset</button>
        <span className="run-state">Ready</span>
        <button type="button">Save</button>
        <button type="button">Compare</button>
        <button type="button">System</button>
      </div>
      <span className="mode-pill">Mode: {mode}</span>
    </header>
  );
}

function LabSetupPanel({ lab, scenarioName }: { lab: LabDefinition; scenarioName: string }) {
  return (
    <aside className="workbench-region setup-region" aria-labelledby="setup-region-title">
      <p className="region-label">Setup</p>
      <h2 id="setup-region-title">{scenarioName}</h2>
      <p>{lab.question}</p>
      <dl className="setup-list">
        <div>
          <dt>Primary controls</dt>
          <dd>Surface heating, source-layer humidity, free-atmosphere humidity, stability, cap height, runtime.</dd>
        </div>
        <div>
          <dt>Expected behavior</dt>
          <dd>Thermals develop first; cloud appears later if lift and moisture reach saturation.</dd>
        </div>
      </dl>
    </aside>
  );
}

function VisualizationStage({ lab }: { lab: LabDefinition }) {
  return (
    <section
      className="workbench-region visualization-stage"
      aria-labelledby="visualization-stage-title"
    >
      <div>
        <p className="region-label">Visualization stage</p>
        <h2 id="visualization-stage-title">Scientific 2-D field view</h2>
        <p>
          Placeholder for streamed solver fields: cloud liquid water, water vapor,
          temperature perturbation, and vertical velocity.
        </p>
      </div>
      <div className="stage-placeholder" aria-label={`${lab.name} visualization placeholder`}>
        <div className="thermal-column" />
        <div className="cloud-puff one" />
        <div className="cloud-puff two" />
        <div className="ground-heating" />
      </div>
      <p className="truth-label">Experimental 2-D dynamics · qualitative cloud experiment</p>
    </section>
  );
}

function InspectorPanel({ lab }: { lab: LabDefinition }) {
  return (
    <aside className="workbench-region inspector-region" aria-labelledby="inspector-region-title">
      <p className="region-label">Inspector</p>
      <h2 id="inspector-region-title">Expected vs observed</h2>
      <p>{lab.limitations.join(". ")}.</p>
      <ul>
        <li>Expected LCL / cloud base</li>
        <li>First cloud time</li>
        <li>Cloud-top height</li>
        <li>Max updraft</li>
      </ul>
    </aside>
  );
}

function TimelinePanel() {
  return (
    <section className="timeline-region" aria-labelledby="timeline-region-title">
      <div>
        <p className="region-label">Timeline / replay</p>
        <h2 id="timeline-region-title">No run buffered yet</h2>
      </div>
      <input type="range" min="0" max="100" value="0" readOnly aria-label="Replay timeline" />
      <div className="timeline-actions">
        <button type="button">First</button>
        <button type="button">Play</button>
        <button type="button">Final</button>
      </div>
    </section>
  );
}

import type { LabDefinition } from "../labs/labTypes";

type LabPickerProps = {
  labs: LabDefinition[];
  onSelectLab: (labId: string) => void;
};

export function LabPicker({ labs, onSelectLab }: LabPickerProps) {
  return (
    <main className="lab-picker" aria-labelledby="lab-picker-title">
      <section className="lab-picker-heading">
        <p className="app-kicker">Cloud Lab</p>
        <h1 id="lab-picker-title">Choose a cloud lab</h1>
        <p>
          Beautiful cloud experiments grounded in real atmospheric physics. Pick a
          phenomenon, run a focused experiment, then inspect what happened.
        </p>
      </section>

      <section className="lab-card-grid" aria-label="Available and planned labs">
        {labs.map((lab) => (
          <article className="lab-card" key={lab.id}>
            <div className="lab-card-header">
              <h2>{lab.name}</h2>
              <span className={`lab-status lab-status-${lab.status}`}>{lab.statusLabel}</span>
            </div>
            <p className="lab-question">{lab.question}</p>
            <p className="lab-description">{lab.description}</p>
            <ul className="concept-list" aria-label={`${lab.name} concepts`}>
              {lab.concepts.map((concept) => (
                <li key={concept}>{concept}</li>
              ))}
            </ul>
            <p className="lab-limitation">{lab.limitations[0]}</p>
            <button
              type="button"
              disabled={!lab.isSelectable}
              aria-disabled={!lab.isSelectable}
              onClick={() => onSelectLab(lab.id)}
            >
              {lab.isSelectable ? "Open lab" : "Planned for later"}
            </button>
          </article>
        ))}
      </section>
    </main>
  );
}

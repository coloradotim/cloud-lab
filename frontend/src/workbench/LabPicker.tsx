import type { LabDefinition } from "../labs/labTypes";

type LabPickerProps = {
  labs: LabDefinition[];
  onSelectLab: (labId: string) => void;
};

export function LabPicker({ labs, onSelectLab }: LabPickerProps) {
  const primaryLab = labs.find((lab) => lab.isSelectable);
  const comingNextLabs = labs.filter(
    (lab) => lab.id !== primaryLab?.id && lab.status !== "later",
  );
  const futureLabs = labs.filter((lab) => !lab.isSelectable && lab.status === "later");

  return (
    <main className="lab-picker" aria-labelledby="lab-picker-title">
      <section className="lab-picker-heading">
        <p className="app-kicker">Cloud Lab</p>
        <h1 id="lab-picker-title">Start with a focused cloud lab</h1>
        <p>
          Cloud Lab is organized around guided experiments. Open the first reference lab
          now, then follow the roadmap as new cloud processes become ready.
        </p>
      </section>

      {primaryLab ? (
        <section className="featured-lab-section" aria-label="Start here">
          <article className="lab-card featured-lab-card">
            <div className="lab-card-header">
              <div>
                <p className="section-kicker">Start here</p>
                <h2>{primaryLab.name}</h2>
              </div>
              <span className={`lab-status lab-status-${primaryLab.status}`}>
                {primaryLab.statusLabel}
              </span>
            </div>
            <p className="lab-question">{primaryLab.question}</p>
            <p className="lab-description">{primaryLab.description}</p>
            <ul className="concept-list" aria-label={`${primaryLab.name} concepts`}>
              {primaryLab.concepts.map((concept) => (
                <li key={concept}>{concept}</li>
              ))}
            </ul>
            <p className="lab-limitation">{primaryLab.limitations[0]}</p>
            <button
              className="primary-lab-cta"
              type="button"
              onClick={() => onSelectLab(primaryLab.id)}
            >
              Open {primaryLab.name}
            </button>
          </article>
        </section>
      ) : null}

      <section className="lab-roadmap" aria-label="Planned cloud labs">
        <LabRoadmapGroup title="Coming next" labs={comingNextLabs} onSelectLab={onSelectLab} />
        <LabRoadmapGroup title="Future labs" labs={futureLabs} onSelectLab={onSelectLab} />
      </section>
    </main>
  );
}

function LabRoadmapGroup({
  title,
  labs,
  onSelectLab,
}: {
  title: string;
  labs: LabDefinition[];
  onSelectLab: (labId: string) => void;
}) {
  if (labs.length === 0) {
    return null;
  }

  const headingId = `lab-roadmap-${title.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <section className="lab-roadmap-group" aria-labelledby={headingId}>
      <h2 id={headingId}>{title}</h2>
      <div className="roadmap-card-grid">
        {labs.map((lab) => (
          <article
            className={`lab-card roadmap-lab-card${lab.isSelectable ? " roadmap-lab-card-open" : ""}`}
            key={lab.id}
            aria-disabled={lab.isSelectable ? undefined : "true"}
          >
            <div className="lab-card-header">
              <h3>{lab.name}</h3>
              <span className={`lab-status lab-status-${lab.status}`}>{lab.statusLabel}</span>
            </div>
            <p className="lab-question">{lab.question}</p>
            {lab.isSelectable ? (
              <button type="button" className="secondary-lab-cta" onClick={() => onSelectLab(lab.id)}>
                Open {lab.name}
              </button>
            ) : (
              <p className="roadmap-unavailable">Not open yet</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

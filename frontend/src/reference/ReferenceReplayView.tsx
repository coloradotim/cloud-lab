import { useEffect, useState, type CSSProperties } from "react";

import { formatSeconds } from "../workbench/workbenchRunLoop";
import {
  isSyntheticReferenceRun,
  missingRealReferenceOutputMessage,
  referenceRunSourceLabels,
} from "./localReferenceRuns";
import {
  buildReferenceAppearanceViewModel,
  referenceAppearanceFallback,
  referenceAppearanceHasMeaningfulCloud,
  type ReferenceAppearanceMode,
} from "./referenceAppearance";
import {
  buildReferenceReplayViewModel,
  defaultReferenceFieldKey,
  frameCountLabel,
  referenceFieldHelper,
  referenceFieldOptions,
  referenceMissingFieldNotes,
  referenceReplayFallback,
} from "./referenceReplay";
import type { ReferenceRun } from "./referenceTypes";

type ReferenceReplayViewProps = {
  referenceRun: ReferenceRun | null;
  initialViewMode?: ReferenceAppearanceMode;
  preferredViewMode?: ReferenceAppearanceMode;
  autoReplayKey?: string | number | null;
  title?: string;
  regionLabel?: string;
  replayLabel?: string;
  fieldSelectorLabel?: string;
  showSourceDetails?: boolean;
};

export function ReferenceReplayView({
  referenceRun,
  initialViewMode = "scientific-field",
  preferredViewMode,
  autoReplayKey = null,
  title = "Watch cloud evolution",
  regionLabel = "Cloud replay",
  replayLabel = "Replay cloud evolution",
  fieldSelectorLabel = "Reference field",
  showSourceDetails = true,
}: ReferenceReplayViewProps) {
  const [selectedFieldKey, setSelectedFieldKey] = useState(defaultReferenceFieldKey(referenceRun));
  const [frameIndex, setFrameIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ReferenceAppearanceMode>(initialViewMode);
  const [playing, setPlaying] = useState(false);
  const fieldOptions = referenceFieldOptions(referenceRun);
  const viewModel = buildReferenceReplayViewModel(referenceRun, selectedFieldKey, frameIndex);
  const fallback = referenceReplayFallback(referenceRun, selectedFieldKey, frameIndex);
  const appearanceModel = buildReferenceAppearanceViewModel(referenceRun, frameIndex);
  const appearanceFallback = referenceAppearanceFallback(referenceRun, frameIndex);
  const activeFieldLabel = viewModel
    ? `${viewModel.field.metadata.display_name} - ${viewModel.field.metadata.unit}`
    : `${fieldOptions.find((field) => field.key === selectedFieldKey)?.label ?? "Reference field"} unavailable`;
  const frameCount = referenceRun?.frames.length ?? 0;
  const diagnostics = referenceRun?.diagnostics ?? null;
  const displayedFrameIndex = viewModel?.frameIndex ?? 0;
  const sourceLabels = referenceRunSourceLabels(referenceRun);
  const syntheticFixture = isSyntheticReferenceRun(referenceRun);
  const missingFieldNotes = referenceMissingFieldNotes(referenceRun);
  const viewLabels = viewMode === "cloud-appearance"
    ? ["Cloud appearance view", "Visual interpretation from cloud liquid water"]
    : ["Scientific field view"];
  const assumptionLabels = viewMode === "cloud-appearance"
    ? ["Assumed droplet radius", "Not direct radiative transfer", "Not live CM1 simulation"]
    : ["Not live CM1 simulation"];
  const timelineEvents = referenceTimelineEvents(referenceRun);
  const visualHeight = referenceVisualHeight(referenceRun, frameIndex);

  useEffect(() => {
    if (preferredViewMode) {
      setViewMode(preferredViewMode);
    }
  }, [preferredViewMode]);

  useEffect(() => {
    if (autoReplayKey === null || autoReplayKey === undefined || frameCount <= 0) {
      return;
    }

    setFrameIndex(0);
    setPlaying(frameCount > 1);
  }, [autoReplayKey, frameCount]);

  useEffect(() => {
    if (!playing || frameCount <= 1) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setFrameIndex((current) => {
        if (current >= frameCount - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 700);

    return () => window.clearInterval(timer);
  }, [playing, frameCount]);

  return (
    <section
      className="reference-replay-panel"
      aria-labelledby="cm1-reference-replay-title"
      style={{ "--reference-visual-height": `${visualHeight}px` } as CSSProperties}
    >
      <div className="stage-heading">
        <p className="region-label">{regionLabel}</p>
        <div className="stage-title-row">
          <h3 id="cm1-reference-replay-title">{title}</h3>
          <div className="frame-readout" aria-label="Reference frame readout">
            <span>
              Frame {frameCount > 0 ? displayedFrameIndex + 1 : 0} / {frameCount}
            </span>
            <strong>{formatSeconds(viewModel?.frame.time_seconds ?? null)}</strong>
          </div>
        </div>
      </div>

      <div className="stage-toolbar reference-replay-toolbar">
        <fieldset className="segmented-control reference-view-mode-control">
          <legend>Reference view</legend>
          <div>
            <button
              type="button"
              aria-pressed={viewMode === "scientific-field"}
              onClick={() => setViewMode("scientific-field")}
            >
              Scientific Fields
            </button>
            <button
              type="button"
              aria-pressed={viewMode === "cloud-appearance"}
              onClick={() => setViewMode("cloud-appearance")}
            >
              Cloud Appearance
            </button>
          </div>
        </fieldset>
        {viewMode === "scientific-field" ? (
          <label className="field-selector">
            <span>{fieldSelectorLabel}</span>
            <select
              aria-label="Reference field"
              value={selectedFieldKey}
              onChange={(event) => setSelectedFieldKey(event.currentTarget.value)}
            >
              {fieldOptions.map((field) => (
                <option key={field.key} value={field.key}>
                  {field.label} ({field.unit || "unit unavailable"})
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <p className="field-scale-title">
          {viewMode === "cloud-appearance"
            ? "Cloud appearance view - visual interpretation"
            : activeFieldLabel}
        </p>
        <p className="reference-field-helper">
          {viewMode === "cloud-appearance"
            ? "Cloud Appearance is a visual interpretation from CM1/reference cloud liquid water."
            : referenceFieldHelper(selectedFieldKey)}
        </p>
      </div>

      {viewMode === "cloud-appearance" ? (
        appearanceModel ? (
          <ReferenceAppearancePanel model={appearanceModel} />
        ) : (
          <div className="stage-empty-state" role="status" aria-label="Reference appearance fallback">
            <strong>{appearanceFallback ?? "Reference cloud appearance unavailable."}</strong>
            <p>Load CM1/reference cloud liquid water to view a visual interpretation.</p>
          </div>
        )
      ) : viewModel ? (
        <div className="scientific-field-shell reference-field-shell">
          <div className="scientific-plot-frame">
            <span className="axis-label axis-label-y">Height, z (m)</span>
            <div className="scientific-plot-area reference-plot-area">
              <svg
                className="scientific-field-view"
                viewBox={`0 0 ${viewModel.columns} ${viewModel.rows}`}
                preserveAspectRatio="none"
                role="img"
                aria-label={`Reference output: ${viewModel.field.metadata.display_name} at ${formatSeconds(
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
                {viewModel.overlay.cloudBaseY !== null ? (
                  <line
                    className="reference-overlay-line reference-cloud-base"
                    x1="0"
                    x2={viewModel.columns}
                    y1={viewModel.overlay.cloudBaseY}
                    y2={viewModel.overlay.cloudBaseY}
                    vectorEffect="non-scaling-stroke"
                  />
                ) : null}
                {viewModel.overlay.cloudTopY !== null ? (
                  <line
                    className="reference-overlay-line reference-cloud-top"
                    x1="0"
                    x2={viewModel.columns}
                    y1={viewModel.overlay.cloudTopY}
                    y2={viewModel.overlay.cloudTopY}
                    vectorEffect="non-scaling-stroke"
                  />
                ) : null}
                {viewModel.overlay.maxUpdraftPoint ? (
                  <circle
                    className="reference-updraft-marker"
                    cx={viewModel.overlay.maxUpdraftPoint.column + 0.5}
                    cy={viewModel.rows - viewModel.overlay.maxUpdraftPoint.row - 0.5}
                    r="0.25"
                    vectorEffect="non-scaling-stroke"
                  />
                ) : null}
              </svg>
              <ReferenceAxisTicks frame={viewModel.frame} />
            </div>
            <span className="axis-label axis-label-x">Horizontal distance, x (m)</span>
          </div>
          <div className="field-legend" aria-label="CM1 reference field legend">
            <strong>{activeFieldLabel}</strong>
            <span>{formatLegendValue(viewModel.range.min, viewModel.summary.unit)}</span>
            <span className="legend-ramp" />
            <span>{formatLegendValue(viewModel.range.max, viewModel.summary.unit)}</span>
          </div>
          <dl className="stage-stats reference-field-readout" aria-label="Selected CM1 reference field readout">
            <div>
              <dt>Field status</dt>
              <dd>{viewModel.signal.statusLabel}</dd>
            </div>
            <div>
              <dt>Selected frame min / max</dt>
              <dd>
                {formatNullable(viewModel.signal.minValue, viewModel.field.metadata.unit)} /{" "}
                {formatNullable(viewModel.signal.maxValue, viewModel.field.metadata.unit)}
              </dd>
            </div>
            <div>
              <dt>Display scale</dt>
              <dd>{viewModel.scaling.scale} / {viewModel.scaling.range}</dd>
            </div>
          </dl>
          {!viewModel.signal.hasSignal ? (
            <p className="stage-helper reference-no-signal">{viewModel.signal.helper}</p>
          ) : (
            <p className="stage-helper">{viewModel.signal.helper}</p>
          )}
          {viewModel.fallbackMessage ? <p className="stage-helper">{viewModel.fallbackMessage}</p> : null}
        </div>
      ) : (
          <div className="stage-empty-state" role="status" aria-label="Reference fallback">
          <strong>{fallback ?? "Reference frame unavailable."}</strong>
          <p>Load mapped CM1 reference frames to view a scientific 2-D x-z field.</p>
        </div>
      )}

      <section className="reference-replay-timeline" aria-label="Reference timeline scrubber">
        <div className="boundary-layer-replay-heading">
          <strong>{replayLabel}</strong>
          <span>{timelineEvents.summary}</span>
        </div>
        <p className="stage-helper">{timelineEvents.guidance}</p>
        <input
          type="range"
          min="0"
          max={Math.max(0, frameCount - 1)}
          value={frameCount > 0 ? displayedFrameIndex : 0}
          disabled={frameCount === 0}
          aria-label="Reference timeline scrubber"
          onChange={(event) => setFrameIndex(Number(event.currentTarget.value))}
        />
        <div className="timeline-actions" aria-label="Reference replay actions">
          <button type="button" disabled={frameCount === 0} onClick={() => setFrameIndex(0)}>
            First
          </button>
          <button
            type="button"
            disabled={frameCount <= 1}
            onClick={() => setFrameIndex((current) => Math.max(0, current - 1))}
          >
            Step back
          </button>
          <button
            type="button"
            disabled={frameCount <= 1}
            onClick={() => {
              if (!playing && frameIndex >= frameCount - 1) {
                setFrameIndex(0);
              }
              setPlaying((current) => !current);
            }}
          >
            {playing ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            disabled={frameCount <= 1}
            onClick={() => setFrameIndex((current) => Math.min(frameCount - 1, current + 1))}
          >
            Step forward
          </button>
          <button type="button" disabled={frameCount === 0} onClick={() => setFrameIndex(frameCount - 1)}>
            Final
          </button>
        </div>
        <div className="reference-timeline-events" aria-label="Reference timeline events">
          {timelineEvents.events.map((event) => (
            <span key={event}>{event}</span>
          ))}
        </div>
      </section>

      <dl className="stage-stats reference-diagnostics-summary">
        <div>
          <dt>First cloud time</dt>
          <dd>{formatSeconds(diagnostics?.first_cloud_time_seconds ?? null)}</dd>
        </div>
        <div>
          <dt>Cloud base / top</dt>
          <dd>
            {formatNullable(diagnostics?.cloud_base_m ?? null, "m")} /{" "}
            {formatNullable(diagnostics?.cloud_top_m ?? null, "m")}
          </dd>
        </div>
        <div>
          <dt>Max updraft</dt>
          <dd>{formatNullable(diagnostics?.max_updraft_m_per_s ?? null, "m/s")}</dd>
        </div>
        <div>
          <dt>Max cloud water</dt>
          <dd>{formatNullable(diagnostics?.max_cloud_liquid_water_kg_per_kg ?? null, "kg/kg")}</dd>
        </div>
      </dl>

      {showSourceDetails && missingFieldNotes.length ? (
        <p className="stage-helper">Field notes: {dedupe(missingFieldNotes).join(" ")}</p>
      ) : null}
      {showSourceDetails && syntheticFixture && referenceRun ? (
        <p className="stage-helper">{missingRealReferenceOutputMessage(referenceRun.source_case_id)}</p>
      ) : null}

      {showSourceDetails ? (
        <div className="assumption-labels" aria-label="CM1 reference source labels">
          <span>Source</span>
          <p>{sourceLabels.join(" · ")}</p>
          <span>View</span>
          <p>{viewLabels.join(" · ")}</p>
          <span>Assumptions</span>
          <p>{assumptionLabels.join(" · ")}</p>
        </div>
      ) : null}
    </section>
  );
}

type ReferenceAppearancePanelProps = {
  model: NonNullable<ReturnType<typeof buildReferenceAppearanceViewModel>>;
};

function ReferenceAppearancePanel({ model }: ReferenceAppearancePanelProps) {
  const hasCloud = referenceAppearanceHasMeaningfulCloud(model);

  return (
    <div className="reference-appearance-shell">
      <div className="reference-appearance-canvas" role="img" aria-label="Cloud appearance view from CM1 reference field">
        <svg
          className="reference-appearance-view"
          viewBox={`0 0 ${model.columns} ${model.rows}`}
          preserveAspectRatio="none"
        >
          <title>Visual interpretation of CM1 reference field</title>
          <defs>
            <linearGradient id="reference-appearance-sky" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#cfe6f4" />
              <stop offset="68%" stopColor="#eaf3f4" />
              <stop offset="100%" stopColor="#f4efe3" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width={model.columns} height={model.rows} fill="url(#reference-appearance-sky)" />
          {model.cells.map((cell) => (
            <rect
              key={`${cell.row}-${cell.column}`}
              x={cell.column}
              y={model.rows - cell.row - 1}
              width="1"
              height="1"
              fill={cell.fill}
              data-cloud-water={cell.sourceCloudWater}
              data-opacity={cell.opacity.toFixed(4)}
            />
          ))}
        </svg>
        <ReferenceAxisTicks frame={model.frame} />
      </div>
      <dl className="stage-stats reference-appearance-summary">
        <div>
          <dt>Appearance source</dt>
          <dd>CM1/reference cloud liquid water</dd>
        </div>
        <div>
          <dt>Max optical depth proxy</dt>
          <dd>{model.maxOpticalDepth.toPrecision(3)}</dd>
        </div>
        <div>
          <dt>Mean opacity</dt>
          <dd>{model.meanOpacity.toPrecision(3)}</dd>
        </div>
        <div>
          <dt>Assumed droplet radius</dt>
          <dd>{model.assumedEffectiveRadiusUm} um</dd>
        </div>
      </dl>
      <p className="stage-helper">
        {hasCloud
          ? "Cloud water is mapped to opacity and brightness for a visual interpretation; source fields are unchanged."
          : "Zero cloud water renders no meaningful cloud in the appearance view."}
      </p>
      {model.fallbackMessage ? <p className="stage-helper">{model.fallbackMessage}</p> : null}
    </div>
  );
}

function ReferenceAxisTicks({ frame }: { frame: ReferenceRun["frames"][number] }) {
  const xTicks = majorTicks(frame.grid.x_coordinates_m);
  const zTicks = majorTicks(frame.grid.z_coordinates_m);
  const xMin = Math.min(...frame.grid.x_coordinates_m);
  const xMax = Math.max(...frame.grid.x_coordinates_m);
  const zMin = Math.min(...frame.grid.z_coordinates_m);
  const zMax = Math.max(...frame.grid.z_coordinates_m);

  return (
    <div className="reference-axis-ticks" aria-label="Major x and z axis tickmarks">
      {xTicks.map((tick) => (
        <span
          key={`x-${tick}`}
          className="reference-axis-tick reference-axis-tick-x"
          style={{ left: `${axisPercent(tick, xMin, xMax)}%` }}
        >
          {formatDistanceTick(tick)}
        </span>
      ))}
      {zTicks.map((tick) => (
        <span
          key={`z-${tick}`}
          className="reference-axis-tick reference-axis-tick-z"
          style={{ bottom: `${axisPercent(tick, zMin, zMax)}%` }}
        >
          {formatDistanceTick(tick)}
        </span>
      ))}
    </div>
  );
}

function formatNullable(value: number | null, unit: string): string {
  if (value === null || !Number.isFinite(value)) {
    return "unavailable";
  }
  return `${value.toPrecision(3)} ${unit}`;
}

function formatLegendValue(value: number, unit: string): string {
  if (!Number.isFinite(value)) {
    return "n/a";
  }
  return `${Math.abs(value) >= 1_000 ? value.toExponential(1) : value.toPrecision(3)} ${unit}`;
}

function referenceVisualHeight(run: ReferenceRun | null, frameIndex: number): number {
  const frame = run?.frames[Math.max(0, Math.min(frameIndex, (run?.frames.length ?? 1) - 1))];
  const field = frame?.fields.cloud_liquid_water_kg_per_kg;
  if (!frame || !field) {
    return 280;
  }

  let highestCloudRow = -1;
  field.values.forEach((row, rowIndex) => {
    if (row.some((value) => Number.isFinite(value) && value > 0)) {
      highestCloudRow = Math.max(highestCloudRow, rowIndex);
    }
  });

  if (highestCloudRow < 0) {
    return 260;
  }

  const cloudTopFraction = (highestCloudRow + 1) / Math.max(1, frame.grid.rows);
  return Math.round(280 + cloudTopFraction * 260);
}

function majorTicks(values: number[]): number[] {
  if (!values.length) {
    return [];
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const mid = min + (max - min) / 2;
  return [min, mid, max];
}

function axisPercent(value: number, min: number, max: number): number {
  if (max <= min) {
    return 0;
  }
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

function formatDistanceTick(value: number): string {
  if (Math.abs(value) >= 1_000) {
    return `${Number((value / 1_000).toFixed(1))} km`;
  }
  return `${Math.round(value)} m`;
}

function dedupe(labels: string[]): string[] {
  return [...new Set(labels.filter(Boolean))];
}

function referenceTimelineEvents(run: ReferenceRun | null): {
  summary: string;
  guidance: string;
  events: string[];
} {
  const frameCount = frameCountLabel(run);
  const frames = run?.frames ?? [];
  const finalTime = frames.length ? frames[frames.length - 1].time_seconds : null;
  const firstCloud = run?.diagnostics?.first_cloud_time_seconds ?? null;
  const firstRain = run?.diagnostics?.first_rain_time_seconds ?? null;
  const maxCloud = run?.diagnostics?.max_cloud_liquid_water_kg_per_kg ?? null;
  const noCloud = maxCloud !== null && maxCloud <= 0;
  const timeRange =
    frames.length > 0
      ? `${formatSeconds(frames[0].time_seconds)}-${formatSeconds(finalTime)}`
      : "no time range";

  if (noCloud) {
    return {
      summary: `${frameCount}; ${timeRange}`,
      guidance: "No cloud formed during this replay. Inspect vertical velocity to see motion without cloud water.",
      events: [`No cloud formed during ${timeRange}`, finalTime !== null ? `${formatSeconds(finalTime)} - final frame` : "Final frame unavailable"],
    };
  }

  return {
    summary: `${frameCount}; ${timeRange}`,
    guidance: "Replay the cloud evolution to see when cloud water appears.",
    events: [
      firstCloud !== null ? `${formatSeconds(firstCloud)} - first cloud` : "First cloud unavailable",
      firstRain !== null ? `${formatSeconds(firstRain)} - rain onset` : "Rain onset unavailable",
      finalTime !== null ? `${formatSeconds(finalTime)} - final frame` : "Final frame unavailable",
    ],
  };
}

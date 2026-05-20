import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

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
  initialAppearanceFullDomain?: boolean;
  autoReplayKey?: string | number | null;
  workingControls?: ReactNode;
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
  initialAppearanceFullDomain = false,
  autoReplayKey = null,
  workingControls = null,
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
  const [appearanceFullDomain, setAppearanceFullDomain] = useState(initialAppearanceFullDomain);
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
    <section className="reference-replay-panel" aria-labelledby="cm1-reference-replay-title">
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

      <div className="stage-toolbar reference-replay-toolbar" aria-label="Cloud replay controls">
        {workingControls ? <div className="reference-working-controls">{workingControls}</div> : null}
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
          <ReferenceAppearancePanel
            model={appearanceModel}
            fullDomain={appearanceFullDomain}
            onToggleFullDomain={() => setAppearanceFullDomain((current) => !current)}
          />
        ) : (
          <div className="stage-empty-state" role="status" aria-label="Reference appearance fallback">
            <strong>{appearanceFallback ?? "Reference cloud appearance unavailable."}</strong>
            <p>Load CM1/reference cloud liquid water to view a visual interpretation.</p>
          </div>
        )
      ) : viewModel ? (
          <div className="scientific-field-shell reference-field-shell" data-display-domain="full">
            <div className="scientific-plot-frame">
              <span className="axis-label axis-label-y">Height, z (km)</span>
              <div
                className="scientific-plot-area reference-plot-area"
                data-display-frame="bounded"
              >
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
                  <>
                    <line
                      className="reference-overlay-line reference-cloud-base"
                      x1="0"
                      x2={viewModel.columns}
                      y1={viewModel.overlay.cloudBaseY}
                      y2={viewModel.overlay.cloudBaseY}
                      vectorEffect="non-scaling-stroke"
                    />
                    <text
                      className="reference-overlay-label reference-cloud-base-label"
                      x="0.25"
                      y={overlayLabelY(viewModel.overlay.cloudBaseY, viewModel.rows)}
                    >
                      cloud base
                    </text>
                  </>
                ) : null}
                {viewModel.overlay.cloudTopY !== null ? (
                  <>
                    <line
                      className="reference-overlay-line reference-cloud-top"
                      x1="0"
                      x2={viewModel.columns}
                      y1={viewModel.overlay.cloudTopY}
                      y2={viewModel.overlay.cloudTopY}
                      vectorEffect="non-scaling-stroke"
                    />
                    <text
                      className="reference-overlay-label reference-cloud-top-label"
                      x="0.25"
                      y={overlayLabelY(viewModel.overlay.cloudTopY, viewModel.rows)}
                    >
                      cloud top
                    </text>
                  </>
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
              <AxisTicks
                xMinM={Math.min(...viewModel.frame.grid.x_coordinates_m)}
                xMaxM={Math.max(...viewModel.frame.grid.x_coordinates_m)}
                zMinM={Math.min(...viewModel.frame.grid.z_coordinates_m)}
                zMaxM={Math.max(...viewModel.frame.grid.z_coordinates_m)}
              />
            </div>
            <span className="axis-label axis-label-x">Horizontal distance, x (km)</span>
          </div>
          <div className="field-legend" aria-label="CM1 reference field legend">
            <strong>{activeFieldLabel}</strong>
            <span>{viewModel.displayPolicy.zeroLabel}</span>
            <span
              className="legend-ramp reference-legend-ramp"
              style={{ "--reference-legend-gradient": viewModel.displayPolicy.legendGradient } as CSSProperties}
            />
            <span>{viewModel.displayPolicy.highLabel}</span>
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
              <dd>{viewModel.displayPolicy.paletteLabel}</dd>
            </div>
            <div>
              <dt>Displayed range</dt>
              <dd>
                {formatLegendValue(viewModel.range.min, viewModel.summary.unit)} /{" "}
                {formatLegendValue(viewModel.range.max, viewModel.summary.unit)}
              </dd>
            </div>
          </dl>
          {!viewModel.signal.hasSignal ? (
            <p className="stage-helper reference-no-signal">{viewModel.signal.helper}</p>
          ) : (
            <p className="stage-helper">{viewModel.signal.helper}</p>
          )}
          <p className="stage-helper">{viewModel.displayPolicy.displayNote}</p>
          {viewModel.fallbackMessage ? <p className="stage-helper">{viewModel.fallbackMessage}</p> : null}
        </div>
      ) : (
          <div className="stage-empty-state" role="status" aria-label="Reference fallback">
          <strong>{fallback ?? "Reference frame unavailable."}</strong>
          <p>Load mapped CM1 reference frames to view a scientific 2-D x-z field.</p>
        </div>
      )}

      <section className="reference-replay-timeline" aria-label="Reference replay controls">
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
            event.enabled ? (
              <button
                type="button"
                key={event.label}
                className="reference-event-chip"
                onClick={() => setFrameIndex(event.frameIndex)}
                aria-label={event.ariaLabel}
              >
                {event.label}
              </button>
            ) : (
              <span key={event.label} className="reference-event-chip disabled" aria-disabled="true">
                {event.label}
              </span>
            )
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
  fullDomain: boolean;
  onToggleFullDomain: () => void;
};

function ReferenceAppearancePanel({ model, fullDomain, onToggleFullDomain }: ReferenceAppearancePanelProps) {
  const hasCloud = referenceAppearanceHasMeaningfulCloud(model);
  const viewport = appearanceViewport(model, fullDomain);

  return (
    <div className="reference-appearance-shell">
      <div
        className={`reference-appearance-canvas${fullDomain ? " full-domain" : " focused-domain"}`}
        data-display-frame="bounded"
        data-display-domain={fullDomain ? "full" : "cloud-following"}
        role="img"
        aria-label="Cloud appearance view from CM1 reference field"
      >
        <span className="axis-label axis-label-y">Height, z (km)</span>
        <svg
          className="reference-appearance-view"
          viewBox={`0 ${viewport.viewBoxY} ${model.columns} ${viewport.visibleRows}`}
          preserveAspectRatio="none"
        >
          <title>Visual interpretation of CM1 reference field</title>
          <defs>
            <linearGradient id="reference-appearance-sky" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#c9e4f5" />
              <stop offset="58%" stopColor="#e9f4f5" />
              <stop offset="100%" stopColor="#f6eedf" />
            </linearGradient>
            <filter id="reference-cloud-soften" x="-8%" y="-8%" width="116%" height="116%">
              <feGaussianBlur stdDeviation="0.32" />
            </filter>
          </defs>
          <rect x="0" y="0" width={model.columns} height={model.rows} fill="url(#reference-appearance-sky)" />
          <g className="reference-appearance-shadow" filter="url(#reference-cloud-soften)">
            {model.cells.map((cell) => (
              <rect
                key={`shadow-${cell.row}-${cell.column}`}
                x={cell.column - 0.04}
                y={model.rows - cell.row - 0.68}
                width="1.08"
                height="1.08"
                fill={cell.shadowFill}
              />
            ))}
          </g>
          <g className="reference-appearance-cloud-core" filter="url(#reference-cloud-soften)">
            {model.cells.map((cell) => (
              <rect
                key={`${cell.row}-${cell.column}`}
                x={cell.column - 0.08}
                y={model.rows - cell.row - 1.08}
                width="1.16"
                height="1.16"
                fill={cell.fill}
                data-cloud-water={cell.sourceCloudWater}
                data-opacity={cell.opacity.toFixed(4)}
              />
            ))}
          </g>
          <g className="reference-appearance-highlight" filter="url(#reference-cloud-soften)">
            {model.cells.map((cell) => (
              <rect
                key={`highlight-${cell.row}-${cell.column}`}
                x={cell.column + 0.06}
                y={model.rows - cell.row - 1.12}
                width="0.72"
                height="0.48"
                fill={cell.highlightFill}
              />
            ))}
          </g>
        </svg>
        <AxisTicks
          xMinM={Math.min(...model.frame.grid.x_coordinates_m)}
          xMaxM={Math.max(...model.frame.grid.x_coordinates_m)}
          zMinM={viewport.zMinM}
          zMaxM={viewport.zMaxM}
        />
        <span className="axis-label axis-label-x">Horizontal distance, x (km)</span>
      </div>
      <div className="reference-viewport-summary">
        <p>{viewport.label}</p>
        <button type="button" className="ghost-button" onClick={onToggleFullDomain}>
          {fullDomain ? "Focus on cloud layer" : "Show full domain"}
        </button>
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
          ? "Cloud water is mapped to opacity, soft edges, shadow, and brightness for a display-only visual interpretation; source fields are unchanged."
          : "Zero cloud water renders no meaningful cloud in the appearance view."}
      </p>
      {model.fallbackMessage ? <p className="stage-helper">{model.fallbackMessage}</p> : null}
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

function overlayLabelY(y: number, rows: number): number {
  return Math.max(0.45, Math.min(rows - 0.2, y - 0.18));
}

function dedupe(labels: string[]): string[] {
  return [...new Set(labels.filter(Boolean))];
}

type ReferenceTimelineEvent = {
  label: string;
  frameIndex: number;
  enabled: boolean;
  ariaLabel: string;
};

function referenceTimelineEvents(run: ReferenceRun | null): {
  summary: string;
  guidance: string;
  events: ReferenceTimelineEvent[];
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
      events: [
        {
          label: `No cloud formed during ${timeRange}`,
          frameIndex: 0,
          enabled: false,
          ariaLabel: `No cloud formed during ${timeRange}`,
        },
        timelineEventForTime(frames, finalTime, "final frame"),
      ],
    };
  }

  return {
    summary: `${frameCount}; ${timeRange}`,
    guidance: "Replay the cloud evolution to see when cloud water appears.",
    events: [
      timelineEventForTime(frames, firstCloud, "first cloud"),
      timelineEventForTime(frames, firstRain, "rain onset"),
      timelineEventForTime(frames, finalTime, "final frame"),
    ],
  };
}

function timelineEventForTime(frames: ReferenceRun["frames"], timeSeconds: number | null, label: string): ReferenceTimelineEvent {
  if (timeSeconds === null || !frames.length) {
    const unavailable = `${sentenceCase(label)} unavailable`;
    return {
      label: unavailable,
      frameIndex: 0,
      enabled: false,
      ariaLabel: unavailable,
    };
  }
  const frameIndex = nearestFrameIndex(frames, timeSeconds);
  const formattedTime = formatSeconds(timeSeconds);
  return {
    label: `${formattedTime} - ${label}`,
    frameIndex,
    enabled: true,
    ariaLabel: `Jump to ${label} at ${formattedTime}`,
  };
}

function nearestFrameIndex(frames: ReferenceRun["frames"], timeSeconds: number): number {
  let bestIndex = 0;
  let bestDelta = Number.POSITIVE_INFINITY;
  frames.forEach((frame, index) => {
    const delta = Math.abs(frame.time_seconds - timeSeconds);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function appearanceViewport(
  model: NonNullable<ReturnType<typeof buildReferenceAppearanceViewModel>>,
  fullDomain: boolean,
): {
  viewBoxY: number;
  visibleRows: number;
  zMinM: number;
  zMaxM: number;
  label: string;
} {
  const zCoordinates = model.frame.grid.z_coordinates_m;
  const domainBottomM = Math.min(...zCoordinates);
  const domainTopM = Math.max(...zCoordinates);
  if (fullDomain) {
    return {
      viewBoxY: 0,
      visibleRows: model.rows,
      zMinM: domainBottomM,
      zMaxM: domainTopM,
      label: `Viewing ${formatKm(domainBottomM)}-${formatKm(domainTopM)} km; full CM1 domain fit into a bounded display frame.`,
    };
  }

  const cloudTopM = cloudTopForFrame(model) ?? model.run.diagnostics?.cloud_top_m ?? null;
  const targetTopM = Math.min(domainTopM, Math.max(5_500, (cloudTopM ?? 0) + 1_200));
  const topRow = Math.max(0, lastIndexAtOrBelow(zCoordinates, targetTopM));
  const visibleRows = Math.min(model.rows, Math.max(2, topRow + 1));
  const visibleTopM = zCoordinates[visibleRows - 1] ?? targetTopM;
  return {
    viewBoxY: model.rows - visibleRows,
    visibleRows,
    zMinM: domainBottomM,
    zMaxM: visibleTopM,
    label: `Viewing ${formatKm(domainBottomM)}-${formatKm(visibleTopM)} km; Appearance view follows cloud-top growth inside a bounded display frame.`,
  };
}

function cloudTopForFrame(model: NonNullable<ReturnType<typeof buildReferenceAppearanceViewModel>>): number | null {
  const cloudyRows = model.cells.filter((cell) => cell.sourceCloudWater > 0).map((cell) => cell.row);
  if (!cloudyRows.length) {
    return null;
  }
  const row = Math.max(...cloudyRows);
  return model.frame.grid.z_coordinates_m[row] ?? null;
}

function lastIndexAtOrBelow(values: number[], target: number): number {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (values[index] <= target) {
      return index;
    }
  }
  return 0;
}

function AxisTicks({
  xMinM,
  xMaxM,
  zMinM,
  zMaxM,
}: {
  xMinM: number;
  xMaxM: number;
  zMinM: number;
  zMaxM: number;
}) {
  const xTicks = majorTicks(xMinM, xMaxM, 5);
  const zTicks = majorTicks(zMinM, zMaxM, 5);
  return (
    <div className="reference-axis-ticks" aria-hidden="true">
      {xTicks.map((tick) => (
        <span
          key={`x-${tick}`}
          className="reference-axis-tick reference-axis-tick-x"
          style={{ left: `${percent(tick, xMinM, xMaxM)}%` }}
        >
          <i />
          <em>{formatKm(tick)}</em>
        </span>
      ))}
      {zTicks.map((tick) => (
        <span
          key={`z-${tick}`}
          className="reference-axis-tick reference-axis-tick-z"
          style={{ bottom: `${percent(tick, zMinM, zMaxM)}%` }}
        >
          <i />
          <em>{formatKm(tick)}</em>
        </span>
      ))}
    </div>
  );
}

function majorTicks(min: number, max: number, targetCount: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return [0];
  }
  const spanKm = (max - min) / 1_000;
  const rawStepKm = spanKm / Math.max(1, targetCount);
  const stepKm = rawStepKm <= 1 ? 1 : rawStepKm <= 2 ? 2 : rawStepKm <= 5 ? 5 : 10;
  const step = stepKm * 1_000;
  const first = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let tick = first; tick <= max + step * 0.1; tick += step) {
    ticks.push(Math.min(max, tick));
  }
  if (!ticks.includes(min)) {
    ticks.unshift(min);
  }
  if (!ticks.includes(max)) {
    ticks.push(max);
  }
  return [...new Set(ticks.map((tick) => Math.round(tick)))];
}

function percent(value: number, min: number, max: number): number {
  if (max <= min) {
    return 0;
  }
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

function formatKm(valueM: number): string {
  return (valueM / 1_000).toLocaleString("en-US", {
    maximumFractionDigits: valueM % 1_000 === 0 ? 0 : 1,
  });
}

function sentenceCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

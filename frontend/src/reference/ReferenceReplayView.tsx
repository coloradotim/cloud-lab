import { useState } from "react";

import { formatSeconds } from "../workbench/workbenchRunLoop";
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
  referenceFieldOptions,
  referenceReplayFallback,
} from "./referenceReplay";
import type { ReferenceRun } from "./referenceTypes";

type ReferenceReplayViewProps = {
  referenceRun: ReferenceRun | null;
  initialViewMode?: ReferenceAppearanceMode;
};

export function ReferenceReplayView({ referenceRun, initialViewMode = "scientific-field" }: ReferenceReplayViewProps) {
  const [selectedFieldKey, setSelectedFieldKey] = useState(defaultReferenceFieldKey(referenceRun));
  const [frameIndex, setFrameIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ReferenceAppearanceMode>(initialViewMode);
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
  const provenance = referenceRun?.frames[0]?.provenance ?? diagnostics?.source_provenance ?? null;
  const displayedFrameIndex = viewModel?.frameIndex ?? 0;

  return (
    <section className="reference-replay-panel" aria-labelledby="cm1-reference-replay-title">
      <div className="stage-heading">
        <p className="region-label">CM1 reference replay</p>
        <div className="stage-title-row">
          <h3 id="cm1-reference-replay-title">Scientific field view</h3>
          <div className="frame-readout" aria-label="CM1 reference frame readout">
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
              Field
            </button>
            <button
              type="button"
              aria-pressed={viewMode === "cloud-appearance"}
              onClick={() => setViewMode("cloud-appearance")}
            >
              Appearance
            </button>
          </div>
        </fieldset>
        <label className="field-selector">
          <span>Reference field</span>
          <select
            aria-label="CM1 reference field"
            value={selectedFieldKey}
            disabled={viewMode === "cloud-appearance"}
            onChange={(event) => setSelectedFieldKey(event.currentTarget.value)}
          >
            {fieldOptions.map((field) => (
              <option key={field.key} value={field.key}>
                {field.label} ({field.unit || "unit unavailable"})
              </option>
            ))}
          </select>
        </label>
        <p className="field-scale-title">
          {viewMode === "cloud-appearance"
            ? "Cloud appearance view - visual interpretation"
            : activeFieldLabel}
        </p>
      </div>

      {viewMode === "cloud-appearance" ? (
        appearanceModel ? (
          <ReferenceAppearancePanel model={appearanceModel} />
        ) : (
          <div className="stage-empty-state" role="status" aria-label="CM1 reference appearance fallback">
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
                aria-label={`CM1 reference output: ${viewModel.field.metadata.display_name} at ${formatSeconds(
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
            </div>
            <span className="axis-label axis-label-x">Horizontal distance, x (m)</span>
          </div>
          <div className="field-legend" aria-label="CM1 reference field legend">
            <strong>{activeFieldLabel}</strong>
            <span>{formatLegendValue(viewModel.range.min, viewModel.summary.unit)}</span>
            <span className="legend-ramp" />
            <span>{formatLegendValue(viewModel.range.max, viewModel.summary.unit)}</span>
          </div>
          {viewModel.fallbackMessage ? <p className="stage-helper">{viewModel.fallbackMessage}</p> : null}
        </div>
      ) : (
        <div className="stage-empty-state" role="status" aria-label="CM1 reference fallback">
          <strong>{fallback ?? "Reference frame unavailable."}</strong>
          <p>Load mapped CM1 reference frames to view a scientific 2-D x-z field.</p>
        </div>
      )}

      <section className="reference-replay-timeline" aria-label="CM1 reference timeline scrubber">
        <div className="boundary-layer-replay-heading">
          <strong>Time replay</strong>
          <span>{frameCountLabel(referenceRun)}</span>
        </div>
        <input
          type="range"
          min="0"
          max={Math.max(0, frameCount - 1)}
          value={frameCount > 0 ? displayedFrameIndex : 0}
          disabled={frameCount === 0}
          aria-label="CM1 reference timeline scrubber"
          onChange={(event) => setFrameIndex(Number(event.currentTarget.value))}
        />
        <div className="timeline-actions" aria-label="CM1 reference replay actions">
          <button type="button" disabled={frameCount === 0} onClick={() => setFrameIndex(0)}>
            First
          </button>
          <button type="button" disabled title="Automatic playback is reserved for the next replay polish pass.">
            Play
          </button>
          <button type="button" disabled={frameCount === 0} onClick={() => setFrameIndex(frameCount - 1)}>
            Final
          </button>
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

      {diagnostics?.missing_field_warnings.length ? (
        <p className="stage-helper">Missing fields: {diagnostics.missing_field_warnings.join(" ")}</p>
      ) : null}

      <div className="assumption-labels" aria-label="CM1 reference source labels">
        <span>Source labels</span>
        <p>
          CM1 reference output · Offline reference case ·{" "}
          {viewMode === "cloud-appearance"
            ? "Cloud appearance view · Visual interpretation of CM1 reference field · Assumed droplet radius · Not direct radiative transfer · Not live CM1 simulation"
            : "Scientific field view · Not live interactive simulation"}
          {provenance?.source_is_synthetic_fixture ? " · Synthetic fixture, not scientific truth" : ""}
        </p>
      </div>
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
          ? "Cloud water is mapped to opacity and brightness for a visual interpretation."
          : "Zero cloud water renders no meaningful cloud in the appearance view."}
      </p>
      {model.fallbackMessage ? <p className="stage-helper">{model.fallbackMessage}</p> : null}
      <div className="assumption-labels reference-appearance-labels" aria-label="CM1 reference appearance labels">
        <span>Appearance labels</span>
        <p>
          Cloud appearance view · Visual interpretation of CM1 reference field · Assumed droplet radius · Not direct radiative transfer · Not live CM1 simulation
        </p>
      </div>
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

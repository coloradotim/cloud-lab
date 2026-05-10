import { useEffect, useMemo, useRef, useState } from "react";

import { buildProbeResult } from "./probe";
import type { ProbeRegionMode, ProbeResult, ProbeSelection } from "./probe";
import type { SimulationFrame } from "./simulationTypes";
import type { ReplayEventTarget, ReplayStatus } from "./replay";
import { clampFrameIndex, stepFrameIndex } from "./replay";
import {
  CLOUD_APPEARANCE_MODE,
  DEFAULT_CLOUD_OPTICAL_ASSUMPTIONS,
  cloudOpticalGrid,
  colorForNormalizedValue,
  fieldSummaryForField,
  gridPointFromCanvas,
  normalizedDisplayValueForFieldKey,
  truthMetadataForField,
  vectorScaleForFrame,
  visualizationOptionsFromFrame,
} from "./visualization";

type ScientificDashboardProps = {
  frame: SimulationFrame | null;
  framesReceived: number;
  selectedField: string;
  onSelectedFieldChange: (fieldKey: string) => void;
  isPaused: boolean;
  onPausedChange: (isPaused: boolean) => void;
  playbackSpeed: number;
  onPlaybackSpeedChange: (speed: number) => void;
  displayedFrameIndex: number;
  frameCount: number;
  finalTimeSeconds: number;
  replayStatus: ReplayStatus;
  eventTargets: ReplayEventTarget[];
  onScrub: (frameIndex: number) => void;
  onPinnedColumnChange: (columnIndex: number | null) => void;
};

export function ScientificDashboard({
  frame,
  framesReceived,
  selectedField,
  onSelectedFieldChange,
  isPaused,
  onPausedChange,
  playbackSpeed,
  onPlaybackSpeedChange,
  displayedFrameIndex,
  frameCount,
  finalTimeSeconds,
  replayStatus,
  eventTargets,
  onScrub,
  onPinnedColumnChange,
}: ScientificDashboardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoveredProbe, setHoveredProbe] = useState<ProbeSelection | null>(null);
  const [pinnedProbe, setPinnedProbe] = useState<ProbeSelection | null>(null);
  const [probeMode, setProbeMode] = useState<ProbeRegionMode>("point");
  const fieldOptions = useMemo(() => visualizationOptionsFromFrame(frame), [frame]);
  const activeField =
    selectedField === CLOUD_APPEARANCE_MODE
      ? frame?.fields.cloud_liquid_water_kg_per_kg ?? null
      : frame?.fields[selectedField] ?? null;
  const fieldSummary = activeField
    ? fieldSummaryForField(selectedField, activeField, frame?.config?.solver_type)
    : null;
  const selectedTruth =
    selectedField === CLOUD_APPEARANCE_MODE
      ? truthMetadataForField(CLOUD_APPEARANCE_MODE, activeField ?? undefined)
      : fieldSummary?.truth;
  const activeProbeSelection = pinnedProbe ?? hoveredProbe;
  const probe = useMemo<ProbeResult | null>(() => {
    if (!frame || !activeProbeSelection) {
      return null;
    }

    return buildProbeResult(frame, { ...activeProbeSelection, mode: probeMode });
  }, [activeProbeSelection, frame, probeMode]);

  useEffect(() => {
    if (!frame || !activeField) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    renderFrame(canvas, frame, selectedField);
  }, [activeField, frame, selectedField]);

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!frame || !activeField) {
      setHoveredProbe(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const gridPoint = gridPointFromCanvas(
      event.clientX - rect.left,
      event.clientY - rect.top,
      rect.width,
      rect.height,
      frame.grid.rows,
      frame.grid.columns,
    );

    if (!gridPoint) {
      setHoveredProbe(null);
      return;
    }

    setHoveredProbe({
      row: gridPoint.row,
      column: gridPoint.column,
      mode: probeMode,
    });
  }

  function handleCanvasClick() {
    if (!hoveredProbe) {
      return;
    }

    setPinnedProbe({ ...hoveredProbe, mode: probeMode });
    onPinnedColumnChange(hoveredProbe.column);
  }

  return (
    <section className="dashboard-panel" aria-labelledby="dashboard-title">
      <div className="dashboard-header">
        <div>
          <p className="eyebrow">Scientific view</p>
          <h2 id="dashboard-title">Field dashboard</h2>
        </div>

        <div className="dashboard-controls">
          <label>
            Field
            <select
              value={selectedField}
              onChange={(event) => onSelectedFieldChange(event.target.value)}
              disabled={!frame}
            >
              {fieldOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label} ({option.unit}) - {option.categoryLabel}
                </option>
              ))}
            </select>
          </label>

          <label>
            Probe
            <select
              value={probeMode}
              onChange={(event) => setProbeMode(event.target.value as ProbeRegionMode)}
              disabled={!frame}
            >
              <option value="point">Point</option>
              <option value="neighborhood">3x3 mean</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => {
              setPinnedProbe(null);
              onPinnedColumnChange(null);
            }}
            disabled={!pinnedProbe}
          >
            Clear probe
          </button>

          <label>
            Speed
            <select
              value={playbackSpeed}
              onChange={(event) => onPlaybackSpeedChange(Number(event.target.value))}
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={4}>4x</option>
            </select>
          </label>

          <button type="button" onClick={() => onScrub(0)} disabled={frameCount === 0}>
            First
          </button>
          <button
            type="button"
            onClick={() => onScrub(stepFrameIndex(displayedFrameIndex, frameCount, -1))}
            disabled={frameCount === 0 || displayedFrameIndex <= 0}
          >
            Back
          </button>
          <button type="button" onClick={() => onPausedChange(!isPaused)} disabled={!frame}>
            {isPaused ? "Play" : "Pause"}
          </button>
          <button
            type="button"
            onClick={() => onScrub(stepFrameIndex(displayedFrameIndex, frameCount, 1))}
            disabled={frameCount === 0 || displayedFrameIndex >= frameCount - 1}
          >
            Forward
          </button>
          <button
            type="button"
            onClick={() => onScrub(Math.max(0, frameCount - 1))}
            disabled={frameCount === 0}
          >
            Final
          </button>
          <button
            type="button"
            onClick={() => {
              onScrub(0);
              onPausedChange(false);
            }}
            disabled={frameCount === 0}
          >
            Restart replay
          </button>
        </div>
      </div>

      <div className="visualization-grid">
        <div className="canvas-shell">
          {frame ? (
            <canvas
              ref={canvasRef}
              aria-label="2-D simulation field visualization"
              onPointerMove={handlePointerMove}
              onPointerLeave={() => setHoveredProbe(null)}
              onClick={handleCanvasClick}
            />
          ) : (
            <div className="empty-visualization">Start a run to stream frames into the dashboard.</div>
          )}
        </div>

        <aside className="field-readout" aria-label="Field readout">
          <section className="readout-group" aria-labelledby="run-frame-readout">
            <h3 id="run-frame-readout">Run / frame</h3>
            <dl>
              <div>
                <dt>Time</dt>
                <dd>
                  {frame
                    ? `${frame.time_seconds.toFixed(0)} / ${finalTimeSeconds.toFixed(0)} s`
                    : "No frame"}
                </dd>
              </div>
              <div>
                <dt>Buffered frames</dt>
                <dd>{framesReceived}</dd>
              </div>
              <div>
                <dt>Mode</dt>
                <dd>{replayStatusLabel(replayStatus)}</dd>
              </div>
              <div>
                <dt>Displayed frame</dt>
                <dd>
                  {frameCount > 0 ? `${displayedFrameIndex + 1} / ${frameCount}` : "0 / 0"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="readout-group" aria-labelledby="field-summary-readout">
            <h3 id="field-summary-readout">Field summary</h3>
            <dl>
              <div>
                <dt>Selected field</dt>
                <dd>
                  {selectedField === CLOUD_APPEARANCE_MODE
                    ? "Cloud appearance"
                    : activeField?.metadata.display_name ?? "No field"}
                  {selectedTruth ? (
                    <span
                      className={`truth-badge truth-${selectedTruth.category}`}
                      title={`${selectedTruth.explanation}${selectedTruth.limitations ? ` ${selectedTruth.limitations}` : ""}`}
                    >
                      {selectedTruth.label}
                    </span>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt>{fieldSummary?.label ?? "Field max"}</dt>
                <dd>
                  {fieldSummary
                    ? `${fieldSummary.value} ${fieldSummary.unit}`
                    : "No field"}
                </dd>
              </div>
              {fieldSummary?.helper ? (
                <div>
                  <dt>Display threshold</dt>
                  <dd>{fieldSummary.helper}</dd>
                </div>
              ) : null}
              {fieldSummary ? (
                <div>
                  <dt>Scaling</dt>
                  <dd>
                    <span
                      className="truth-badge truth-visual_approximation"
                      title={fieldSummary.scaling.explanation}
                    >
                      {fieldSummary.scaling.scale}, {fieldSummary.scaling.range}
                    </span>
                    {fieldSummary.scaling.comparison === "shared_by_default"
                      ? " Shared for comparisons."
                      : " Independent scale acceptable."}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="readout-group" aria-labelledby="probe-readout">
            <h3 id="probe-readout">{pinnedProbe ? "Pinned probe" : "Probe point"}</h3>
            <dl>
              <div>
                <dt>Probe point</dt>
                <dd>
                  {probe
                    ? `${pinnedProbe ? "Pinned" : "Hover"} ${probe.mode === "point" ? "point" : "3x3 mean"} at x=${probe.xMeters.toFixed(0)} m, z=${probe.zMeters.toFixed(0)} m`
                    : "Hover or click a cell"}
                </dd>
              </div>
            </dl>
          </section>

          <div className="probe-diagnostics" aria-label="Probe diagnostics">
            {probe ? (
              probe.diagnostics.map((diagnostic) => (
                <div key={diagnostic.key}>
                  <span>
                    {diagnostic.label}
                    <em
                      className={`truth-badge truth-${diagnostic.truth.category}`}
                      title={`${diagnostic.truth.explanation}${diagnostic.truth.limitations ? ` ${diagnostic.truth.limitations}` : ""}`}
                    >
                      {diagnostic.truth.label}
                    </em>
                  </span>
                  <strong>
                    {diagnostic.formattedValue}
                    {diagnostic.unit ? ` ${diagnostic.unit}` : ""}
                  </strong>
                  {diagnostic.note ? <small>{diagnostic.note}</small> : null}
                </div>
              ))
            ) : (
              <p>Hover the field, or click to pin a probe while playback continues.</p>
            )}
          </div>

          <label className="scrubber-label">
            Timeline
            <input
              type="range"
              min={0}
              max={Math.max(0, frameCount - 1)}
              value={clampFrameIndex(displayedFrameIndex, frameCount)}
              onChange={(event) => onScrub(clampFrameIndex(Number(event.target.value), frameCount))}
              disabled={frameCount === 0}
            />
          </label>

          <section className="readout-group" aria-labelledby="replay-jump-readout">
            <h3 id="replay-jump-readout">Jump targets</h3>
            <div className="jump-targets">
              {eventTargets.map((target) => (
                <button
                  key={target.key}
                  type="button"
                  disabled={target.frameIndex === null}
                  title={
                    target.timeSeconds === null
                      ? `${target.label} not available in buffered frames.`
                      : `${target.label} at ${target.timeSeconds.toFixed(0)} s.`
                  }
                  onClick={() => {
                    if (target.frameIndex !== null) {
                      onScrub(target.frameIndex);
                    }
                  }}
                >
                  {target.label}
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

function renderFrame(canvas: HTMLCanvasElement, frame: SimulationFrame, selectedField: string) {
  const field =
    selectedField === CLOUD_APPEARANCE_MODE
      ? frame.fields.cloud_liquid_water_kg_per_kg
      : frame.fields[selectedField];
  const context = canvas.getContext("2d");
  if (!field || !context) {
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;
  const width = Math.max(320, Math.floor(rect.width * pixelRatio));
  const height = Math.max(220, Math.floor(rect.height * pixelRatio));
  canvas.width = width;
  canvas.height = height;

  context.clearRect(0, 0, width, height);
  if (selectedField === CLOUD_APPEARANCE_MODE) {
    drawCloudAppearance(context, frame, width, height);
  } else {
    drawScalarField(context, frame, selectedField, width, height);
  }
  drawVelocityVectors(context, frame, width, height);
}

function drawScalarField(
  context: CanvasRenderingContext2D,
  frame: SimulationFrame,
  selectedField: string,
  width: number,
  height: number,
) {
  const field = frame.fields[selectedField];
  const rows = frame.grid.rows;
  const columns = frame.grid.columns;
  const cellWidth = width / columns;
  const cellHeight = height / rows;
  const colorMap = field.metadata.display_scale?.color_map ?? "viridis";

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
      const value = field.values[rowIndex][columnIndex];
      const normalized = normalizedDisplayValueForFieldKey(selectedField, field, value);
      const [red, green, blue] = colorForNormalizedValue(normalized, colorMap);
      context.fillStyle = `rgb(${red}, ${green}, ${blue})`;
      context.fillRect(
        columnIndex * cellWidth,
        (rows - 1 - rowIndex) * cellHeight,
        Math.ceil(cellWidth),
        Math.ceil(cellHeight),
      );
    }
  }
}

function drawCloudAppearance(
  context: CanvasRenderingContext2D,
  frame: SimulationFrame,
  width: number,
  height: number,
) {
  const cloudWater = frame.fields.cloud_liquid_water_kg_per_kg;
  if (!cloudWater) {
    drawSkyBackground(context, width, height);
    return;
  }

  const rows = frame.grid.rows;
  const columns = frame.grid.columns;
  const cellWidth = width / columns;
  const cellHeight = height / rows;
  const gridDx = meanSpacing(frame.grid.x_coordinates_m);
  const gridDz = meanSpacing(frame.grid.z_coordinates_m);
  const opticalGrid = cloudOpticalGrid(cloudWater, {
    ...DEFAULT_CLOUD_OPTICAL_ASSUMPTIONS,
    pathLengthM: Math.max(20, Math.min(250, Math.max(gridDx, gridDz))),
  });

  drawSkyBackground(context, width, height);

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
      const cell = opticalGrid[rowIndex][columnIndex];
      if (cell.opacity <= 0) {
        continue;
      }

      const shade = Math.round(225 + cell.brightness * 30);
      context.fillStyle = `rgba(${shade}, ${shade}, ${shade}, ${Math.min(0.96, cell.opacity)})`;
      context.fillRect(
        columnIndex * cellWidth,
        (rows - 1 - rowIndex) * cellHeight,
        Math.ceil(cellWidth),
        Math.ceil(cellHeight),
      );

      if (cell.opticalDepth > 1.2) {
        context.fillStyle = `rgba(70, 82, 92, ${Math.min(0.24, cell.opacity * 0.18)})`;
        context.fillRect(
          columnIndex * cellWidth,
          (rows - 1 - rowIndex) * cellHeight + cellHeight * 0.45,
          Math.ceil(cellWidth),
          Math.ceil(cellHeight * 0.55),
        );
      }
    }
  }
}

function drawSkyBackground(context: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#79b3e1");
  gradient.addColorStop(1, "#d9ecf7");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
}

function meanSpacing(coordinates: number[]): number {
  if (coordinates.length < 2) {
    return 100;
  }

  let total = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    total += Math.abs(coordinates[index] - coordinates[index - 1]);
  }
  return total / (coordinates.length - 1);
}

function replayStatusLabel(status: ReplayStatus): string {
  if (status === "live") {
    return "Live stream";
  }
  if (status === "complete") {
    return "Completed replay";
  }
  if (status === "replaying") {
    return "Buffered replay";
  }
  return "No frames";
}

function drawVelocityVectors(
  context: CanvasRenderingContext2D,
  frame: SimulationFrame,
  width: number,
  height: number,
) {
  const u = frame.fields.horizontal_velocity_m_per_s.values;
  const w = frame.fields.vertical_velocity_m_per_s.values;
  const rows = frame.grid.rows;
  const columns = frame.grid.columns;
  const vectorScale = vectorScaleForFrame(frame, width, height);
  const cellWidth = width / columns;
  const cellHeight = height / rows;

  context.save();
  context.strokeStyle = "rgba(255,255,255,0.82)";
  context.fillStyle = "rgba(255,255,255,0.9)";
  context.lineWidth = Math.max(1, width / 700);

  for (let rowIndex = 0; rowIndex < rows; rowIndex += vectorScale.stride) {
    for (let columnIndex = 0; columnIndex < columns; columnIndex += vectorScale.stride) {
      const x = (columnIndex + 0.5) * cellWidth;
      const y = (rows - rowIndex - 0.5) * cellHeight;
      const dx = u[rowIndex][columnIndex] * vectorScale.pixelsPerMeterPerSecond;
      const dy = -w[rowIndex][columnIndex] * vectorScale.pixelsPerMeterPerSecond;
      const length = Math.hypot(dx, dy);
      if (length < 0.01) {
        continue;
      }

      const endX = x + dx;
      const endY = y + dy;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(endX, endY);
      context.stroke();

      const angle = Math.atan2(dy, dx);
      const arrowSize = Math.min(7, Math.max(3, length * 0.35));
      context.beginPath();
      context.moveTo(endX, endY);
      context.lineTo(
        endX - arrowSize * Math.cos(angle - Math.PI / 6),
        endY - arrowSize * Math.sin(angle - Math.PI / 6),
      );
      context.lineTo(
        endX - arrowSize * Math.cos(angle + Math.PI / 6),
        endY - arrowSize * Math.sin(angle + Math.PI / 6),
      );
      context.closePath();
      context.fill();
    }
  }

  context.restore();
}

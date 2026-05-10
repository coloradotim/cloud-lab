import { useEffect, useMemo, useRef, useState } from "react";

import { buildProbeResult } from "./probe";
import type { ProbeRegionMode, ProbeResult, ProbeSelection } from "./probe";
import type { SimulationFrame } from "./simulationTypes";
import {
  colorForNormalizedValue,
  fieldSummaryForField,
  fieldOptionsFromFrame,
  gridPointFromCanvas,
  normalizedDisplayValueForField,
  vectorScaleForFrame,
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
  onScrub,
  onPinnedColumnChange,
}: ScientificDashboardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoveredProbe, setHoveredProbe] = useState<ProbeSelection | null>(null);
  const [pinnedProbe, setPinnedProbe] = useState<ProbeSelection | null>(null);
  const [probeMode, setProbeMode] = useState<ProbeRegionMode>("point");
  const fieldOptions = useMemo(() => fieldOptionsFromFrame(frame), [frame]);
  const activeField = frame?.fields[selectedField] ?? null;
  const fieldSummary = activeField ? fieldSummaryForField(selectedField, activeField) : null;
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
                  {option.label} ({option.unit})
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

          <button type="button" onClick={() => onPausedChange(!isPaused)} disabled={!frame}>
            {isPaused ? "Resume" : "Pause"}
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
                <dd>{frame ? `${frame.time_seconds.toFixed(0)} s` : "No frame"}</dd>
              </div>
              <div>
                <dt>Buffered frames</dt>
                <dd>{framesReceived}</dd>
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
                <dd>{activeField?.metadata.display_name ?? "No field"}</dd>
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
                    {diagnostic.source === "derived" ? <em>Derived</em> : null}
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
              value={Math.min(displayedFrameIndex, Math.max(0, frameCount - 1))}
              onChange={(event) => onScrub(Number(event.target.value))}
              disabled={frameCount === 0}
            />
          </label>
        </aside>
      </div>
    </section>
  );
}

function renderFrame(canvas: HTMLCanvasElement, frame: SimulationFrame, selectedField: string) {
  const field = frame.fields[selectedField];
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
  drawScalarField(context, frame, selectedField, width, height);
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
      const normalized = normalizedDisplayValueForField(field, value);
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

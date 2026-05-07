import { useEffect, useMemo, useRef, useState } from "react";

import type { SimulationFrame } from "./simulationTypes";
import {
  colorForNormalizedValue,
  fieldOptionsFromFrame,
  getFieldStats,
  gridPointFromCanvas,
  valueRangeForField,
} from "./visualization";

type Probe = {
  row: number;
  column: number;
  xMeters: number;
  zMeters: number;
  value: number;
  u: number;
  w: number;
};

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
}: ScientificDashboardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [probe, setProbe] = useState<Probe | null>(null);
  const fieldOptions = useMemo(() => fieldOptionsFromFrame(frame), [frame]);
  const activeField = frame?.fields[selectedField] ?? null;
  const fieldStats = activeField ? getFieldStats(activeField) : null;

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
      setProbe(null);
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
      setProbe(null);
      return;
    }

    setProbe({
      row: gridPoint.row,
      column: gridPoint.column,
      xMeters: frame.grid.x_coordinates_m[gridPoint.column],
      zMeters: frame.grid.z_coordinates_m[gridPoint.row],
      value: activeField.values[gridPoint.row][gridPoint.column],
      u: frame.fields.horizontal_velocity_m_per_s.values[gridPoint.row][gridPoint.column],
      w: frame.fields.vertical_velocity_m_per_s.values[gridPoint.row][gridPoint.column],
    });
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
              onPointerLeave={() => setProbe(null)}
            />
          ) : (
            <div className="empty-visualization">Start a run to stream frames into the dashboard.</div>
          )}
        </div>

        <aside className="field-readout" aria-label="Field readout">
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
            <div>
              <dt>Range</dt>
              <dd>
                {fieldStats && activeField
                  ? `${fieldStats.min.toExponential(2)} to ${fieldStats.max.toExponential(2)} ${
                      activeField.metadata.unit
                    }`
                  : "No field"}
              </dd>
            </div>
            <div>
              <dt>Probe</dt>
              <dd>
                {probe && activeField
                  ? `${probe.value.toExponential(2)} ${activeField.metadata.unit} at x=${probe.xMeters.toFixed(
                      0,
                    )} m, z=${probe.zMeters.toFixed(0)} m`
                  : "Hover a cell"}
              </dd>
            </div>
            <div>
              <dt>Velocity</dt>
              <dd>
                {probe ? `u=${probe.u.toFixed(2)} m/s, w=${probe.w.toFixed(2)} m/s` : "Hover a cell"}
              </dd>
            </div>
          </dl>

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
  const range = valueRangeForField(field);
  const rows = frame.grid.rows;
  const columns = frame.grid.columns;
  const cellWidth = width / columns;
  const cellHeight = height / rows;
  const colorMap = field.metadata.display_scale?.color_map ?? "viridis";

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
      const value = field.values[rowIndex][columnIndex];
      const normalized = (value - range.min) / (range.max - range.min);
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
  const stride = Math.max(2, Math.floor(Math.min(rows, columns) / 10));
  const cellWidth = width / columns;
  const cellHeight = height / rows;
  const vectorScale = Math.min(cellWidth, cellHeight) * 2.6;

  context.save();
  context.strokeStyle = "rgba(255,255,255,0.82)";
  context.fillStyle = "rgba(255,255,255,0.9)";
  context.lineWidth = Math.max(1, width / 700);

  for (let rowIndex = 0; rowIndex < rows; rowIndex += stride) {
    for (let columnIndex = 0; columnIndex < columns; columnIndex += stride) {
      const x = (columnIndex + 0.5) * cellWidth;
      const y = (rows - rowIndex - 0.5) * cellHeight;
      const dx = u[rowIndex][columnIndex] * vectorScale;
      const dy = -w[rowIndex][columnIndex] * vectorScale;
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

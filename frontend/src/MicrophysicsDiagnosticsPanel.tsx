import { useMemo } from "react";
import type { ReactNode } from "react";

import {
  dropletHistogramFromPayload,
  summarizeMicrophysicsFrames,
} from "./microphysicsDiagnostics";
import type { SimulationConfig, SimulationFrame } from "./simulationTypes";

type MicrophysicsDiagnosticsPanelProps = {
  frames: SimulationFrame[];
  displayedFrame: SimulationFrame | null;
  config: SimulationConfig | null;
};

export function MicrophysicsDiagnosticsPanel({
  frames,
  displayedFrame,
  config,
}: MicrophysicsDiagnosticsPanelProps) {
  const shouldShow =
    config?.solver_type === "microphysics_lab" ||
    frames.some((frame) => Boolean(frame.microphysics)) ||
    Boolean(displayedFrame?.microphysics);
  const summary = useMemo(
    () => (config ? summarizeMicrophysicsFrames(frames, config) : null),
    [config, frames],
  );
  const histogram = dropletHistogramFromPayload(displayedFrame?.microphysics);

  if (!shouldShow) {
    return null;
  }

  return (
    <section className="microphysics-panel" aria-labelledby="microphysics-title">
      <div className="microphysics-header">
        <div>
          <p className="eyebrow">Microphysics lab</p>
          <h2 id="microphysics-title">Parcel / box diagnostics</h2>
        </div>
        <p className="microphysics-note">
          Current lab output is a controlled bulk parcel broadcast over the grid; the useful signal
          is the time history and water budget.
        </p>
      </div>

      {summary ? (
        <>
          <div className="microphysics-summary-grid">
            <DiagnosticGroup title="Initial / final state">
              <Metric label="Initial temperature" value={formatCelsius(summary.initialTemperatureK)} />
              <Metric label="Final temperature" value={formatCelsius(summary.finalTemperatureK)} />
              <Metric
                label="Initial vapor"
                value={formatMixingRatio(summary.initialWaterVaporKgPerKg)}
              />
              <Metric label="Final vapor" value={formatMixingRatio(summary.finalWaterVaporKgPerKg)} />
              <Metric
                label="Final cloud water"
                value={formatMixingRatio(summary.finalCloudLiquidWaterKgPerKg)}
              />
              <Metric label="Final rain water" value={formatMixingRatio(summary.finalRainWaterKgPerKg)} />
              <Metric label="Parcel height" value={`${summary.finalParcelHeightM.toFixed(0)} m`} />
              <Metric
                label="Prescribed lift"
                value={`${summary.prescribedVerticalVelocityMPerS.toFixed(2)} m s-1`}
              />
            </DiagnosticGroup>

            <DiagnosticGroup title="Timing and extremes">
              <Metric label="First cloud water" value={formatTime(summary.firstCloudWaterTimeSeconds)} />
              <Metric
                label="Max cloud water"
                value={formatMixingRatio(summary.maxCloudLiquidWaterKgPerKg)}
              />
              <Metric
                label="Max cloud time"
                value={formatTime(summary.maxCloudLiquidWaterTimeSeconds)}
              />
              <Metric label="First rain water" value={formatTime(summary.firstRainWaterTimeSeconds)} />
              <Metric label="Max rain water" value={formatMixingRatio(summary.maxRainWaterKgPerKg)} />
              <Metric label="Max rain time" value={formatTime(summary.maxRainWaterTimeSeconds)} />
              <Metric
                label="Max RH proxy"
                value={`${summary.maxRelativeHumidityPercent.toFixed(1)} %`}
              />
            </DiagnosticGroup>

            <DiagnosticGroup title="Water budget">
              <Metric
                label="Initial total water"
                value={formatMixingRatio(summary.initialTotalWaterKgPerKg)}
              />
              <Metric
                label="Final total water"
                value={formatMixingRatio(summary.finalTotalWaterKgPerKg)}
              />
              <Metric
                label="Max water drift"
                value={formatMixingRatio(summary.maxAbsoluteTotalWaterDriftKgPerKg)}
              />
              <Metric
                label="Budget status"
                value={summary.totalWaterDriftIsConcerning ? "Concerning drift" : "Negligible drift"}
              />
            </DiagnosticGroup>
          </div>

          <section className="microphysics-interpretation" aria-labelledby="microphysics-reading">
            <h3 id="microphysics-reading">Interpretation</h3>
            <ul>
              {summary.interpretations.map((interpretation) => (
                <li key={interpretation}>{interpretation}</li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        <p className="empty-microphysics">
          Start a microphysics_lab run to inspect parcel temperature, vapor, condensate, rain, and
          water-budget timing.
        </p>
      )}

      <section className="droplet-panel" aria-labelledby="droplet-title">
        <div>
          <h3 id="droplet-title">Droplet distribution</h3>
          <p>
            {histogram
              ? `${histogram.product} (${histogram.productUnit}, ${histogram.normalization})`
              : "No droplet-size distribution is emitted by this run."}
          </p>
        </div>
        {histogram ? (
          <div className="droplet-histogram" aria-label="Droplet-size distribution histogram">
            {histogram.bars.map((bar) => (
              <div key={bar.label}>
                <span style={{ height: `${histogramHeightPercent(bar.value, histogram)}%` }} />
                <small>{bar.label}</small>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-microphysics">
            Bulk vapor/cloud/rain diagnostics are available now. Droplet-resolved histograms will
            appear here when frames include the optional microphysics payload.
          </p>
        )}
      </section>
    </section>
  );
}

function DiagnosticGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="microphysics-card">
      <h3>{title}</h3>
      <dl>{children}</dl>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function formatCelsius(valueKelvin: number): string {
  return `${(valueKelvin - 273.15).toFixed(2)} deg C`;
}

function formatMixingRatio(value: number): string {
  return `${value.toExponential(3)} kg kg-1`;
}

function formatTime(valueSeconds: number | null): string {
  return valueSeconds === null ? "Not reached" : `${valueSeconds.toFixed(0)} s`;
}

function histogramHeightPercent(
  value: number,
  histogram: NonNullable<ReturnType<typeof dropletHistogramFromPayload>>,
): number {
  const maxValue = Math.max(...histogram.bars.map((bar) => bar.value), 0);
  if (maxValue <= 0) {
    return 2;
  }

  return Math.max(2, (value / maxValue) * 100);
}

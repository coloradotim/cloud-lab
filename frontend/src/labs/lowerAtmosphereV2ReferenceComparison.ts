import type { ReferenceRun } from "../reference/referenceTypes";
import type { BoundaryLayer1DFrame } from "./evolvingBoundaryLayer";
import {
  lowerAtmosphereV2ReferenceCaseMappings,
  type LowerAtmosphereV2ReferenceCaseMapping,
  type LowerAtmosphereV2ScenarioContract,
} from "./lowerAtmosphereV2Scenarios";
import {
  lowerAtmosphereV2ProfileFrames,
  lowerAtmosphereV2StatusLabel,
  selectedLowerAtmosphereV2ProfileFrame,
  type CloudColumnDiagnostics,
  type LowerAtmosphereV2State,
} from "./lowerAtmosphereV2Orchestration";

export type LowerAtmosphereV2ReferenceComparisonRow = {
  diagnostic: string;
  reducedValue: string;
  referenceValue: string;
  interpretation: string;
};

export type LowerAtmosphereV2ReferenceComparisonViewModel = {
  mapping: LowerAtmosphereV2ReferenceCaseMapping | null;
  referenceRun: ReferenceRun | null;
  fallbackMessage: string | null;
  rows: LowerAtmosphereV2ReferenceComparisonRow[];
  sourceLabels: string[];
  morphologyNote: string;
};

const NO_REFERENCE_CASE_MESSAGE = "No CM1 reference case is available for this scenario yet.";

export function lowerAtmosphereV2ReferenceMappingForScenario(
  scenarioId: string,
): LowerAtmosphereV2ReferenceCaseMapping | null {
  return lowerAtmosphereV2ReferenceCaseMappings.find((mapping) => mapping.scenarioId === scenarioId) ?? null;
}

export function buildLowerAtmosphereV2ReferenceComparisonViewModel({
  contract,
  state,
  referenceRuns,
}: {
  contract: LowerAtmosphereV2ScenarioContract;
  state: LowerAtmosphereV2State;
  referenceRuns: ReferenceRun[];
}): LowerAtmosphereV2ReferenceComparisonViewModel {
  const mapping = lowerAtmosphereV2ReferenceMappingForScenario(contract.id);
  if (!mapping) {
    return emptyComparison(null, NO_REFERENCE_CASE_MESSAGE);
  }

  const referenceRun = referenceRuns.find((run) => run.source_case_id === mapping.referenceCaseId) ?? null;
  if (!referenceRun) {
    return emptyComparison(mapping, NO_REFERENCE_CASE_MESSAGE);
  }

  return {
    mapping,
    referenceRun,
    fallbackMessage: null,
    rows: comparisonRows(state, referenceRun),
    sourceLabels: [
      "Reduced model output",
      "CM1 reference output",
      "Offline reference case",
      "Derived diagnostic",
      "Not a live interactive CM1 simulation",
      "Qualitative diagnostic comparison",
    ],
    morphologyNote:
      "Exact cloud morphology is not presented as pass/fail; compare teaching-relevant diagnostics and outcomes instead.",
  };
}

function emptyComparison(
  mapping: LowerAtmosphereV2ReferenceCaseMapping | null,
  fallbackMessage: string,
): LowerAtmosphereV2ReferenceComparisonViewModel {
  return {
    mapping,
    referenceRun: null,
    fallbackMessage,
    rows: [],
    sourceLabels: [
      "Reduced model output",
      "CM1 reference output",
      "Offline reference case",
      "Not a live interactive CM1 simulation",
    ],
    morphologyNote:
      "Reference comparison is qualitative and diagnostic; exact CM1 cloud morphology is not a pass/fail target.",
  };
}

function comparisonRows(
  state: LowerAtmosphereV2State,
  referenceRun: ReferenceRun,
): LowerAtmosphereV2ReferenceComparisonRow[] {
  const profileFrame = selectedComparisonProfileFrame(state);
  const cloudDiagnostics = state.cloudColumnRun?.diagnostics ?? null;
  const referenceDiagnostics = referenceRun.diagnostics;
  const reducedCloudStatus = cloudDiagnostics?.cloud_formation_status ?? null;
  const referenceCloudStatus = referenceDiagnostics
    ? referenceDiagnostics.max_cloud_liquid_water_kg_per_kg !== null &&
      referenceDiagnostics.max_cloud_liquid_water_kg_per_kg > 0
      ? "cloud_formed"
      : "dry_failed"
    : null;

  return [
    {
      diagnostic: "Cloud/no-cloud status",
      reducedValue: reducedCloudStatus ? lowerAtmosphereV2StatusLabel(reducedCloudStatus) : "Cloud column not run",
      referenceValue: referenceCloudStatus ? lowerAtmosphereV2StatusLabel(referenceCloudStatus) : "unavailable",
      interpretation: "Outcome comparison, not morphology scoring.",
    },
    {
      diagnostic: "First cloud time",
      reducedValue: formatSeconds(cloudDiagnostics?.first_cloud_time_seconds ?? null),
      referenceValue: formatSeconds(referenceDiagnostics?.first_cloud_time_seconds ?? null),
      interpretation: "Timing should be read qualitatively across different model classes.",
    },
    {
      diagnostic: "Cloud base",
      reducedValue: formatMeters(cloudDiagnostics?.cloud_base_m ?? null),
      referenceValue: formatMeters(referenceDiagnostics?.cloud_base_m ?? null),
      interpretation: "Compare cloud-base relationship and order of magnitude.",
    },
    {
      diagnostic: "Cloud top",
      reducedValue: formatMeters(cloudDiagnostics?.cloud_top_proxy_m ?? null),
      referenceValue: formatMeters(referenceDiagnostics?.cloud_top_m ?? null),
      interpretation: "Reduced model uses a cloud-top proxy; CM1 provides a 2-D field diagnostic.",
    },
    {
      diagnostic: "Max cloud water",
      reducedValue: formatKgPerKg(cloudDiagnostics?.max_cloud_liquid_water_kg_per_kg ?? null),
      referenceValue: formatKgPerKg(referenceDiagnostics?.max_cloud_liquid_water_kg_per_kg ?? null),
      interpretation: "Compare cloud amount as a teaching diagnostic, not a calibrated forecast.",
    },
    {
      diagnostic: "Max updraft",
      reducedValue: reducedUpdraftLabel(cloudDiagnostics),
      referenceValue: formatMetersPerSecond(referenceDiagnostics?.max_updraft_m_per_s ?? null),
      interpretation: "Reduced lift is prescribed; CM1 updraft is reference-model output.",
    },
    {
      diagnostic: "Rain onset",
      reducedValue: "not evaluated",
      referenceValue: formatSeconds(referenceDiagnostics?.first_rain_time_seconds ?? null),
      interpretation: "Rain comparison remains deferred until reduced warm-rain diagnostics are enabled.",
    },
    {
      diagnostic: "Profile context",
      reducedValue: profileFrame
        ? `${formatMeters(profileFrame.mixed_layer_depth_m)} mixed layer / ${formatMeters(profileFrame.lcl_m)} LCL`
        : "Profile not run",
      referenceValue: referenceRun.source_case_id,
      interpretation: "Reference cases anchor interpretation; they are offline datasets.",
    },
  ];
}

function selectedComparisonProfileFrame(state: LowerAtmosphereV2State): BoundaryLayer1DFrame | null {
  return lowerAtmosphereV2ProfileFrames(state).length > 0 ? selectedLowerAtmosphereV2ProfileFrame(state) : null;
}

function reducedUpdraftLabel(diagnostics: CloudColumnDiagnostics | null): string {
  if (!diagnostics) {
    return "Cloud column not run";
  }
  return `${diagnostics.forcing.updraft_strength_m_per_s.toFixed(2)} m/s prescribed lift`;
}

function formatSeconds(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "unavailable";
  }
  return `${Math.round(value)} s`;
}

function formatMeters(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "unavailable";
  }
  return `${Math.round(value)} m`;
}

function formatMetersPerSecond(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "unavailable";
  }
  return `${value.toPrecision(3)} m/s`;
}

function formatKgPerKg(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "unavailable";
  }
  return value === 0 ? "0 kg/kg" : `${value.toExponential(2)} kg/kg`;
}

import type { ReferenceRun } from "../reference/referenceTypes";
import {
  isSyntheticReferenceRun,
  missingRealReferenceOutputMessage,
  referenceRunSourceLabels,
} from "../reference/localReferenceRuns";
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
  category: "Outcome" | "Cloud structure" | "Dynamics" | "Context";
  diagnostic: string;
  reducedValue: string;
  referenceValue: string;
  interpretation: string;
};

export type LowerAtmosphereV2StoryCard = {
  eyebrow: string;
  title: string;
  outcome: string;
  keyPointLabel: "Key difference" | "Key reason" | "Next step";
  keyPoint: string;
  lookAt: string;
};

export type LowerAtmosphereV2ReferenceComparisonViewModel = {
  mapping: LowerAtmosphereV2ReferenceCaseMapping | null;
  referenceRun: ReferenceRun | null;
  fallbackMessage: string | null;
  rows: LowerAtmosphereV2ReferenceComparisonRow[];
  story: LowerAtmosphereV2StoryCard;
  sourceLabels: string[];
  preRunExplanation: string | null;
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
    return emptyComparison(mapping, missingRealReferenceOutputMessage(mapping.referenceCaseId));
  }

  return {
    mapping,
    referenceRun,
    fallbackMessage: null,
    rows: comparisonRows(state, referenceRun),
    story: storyCard(contract, state, referenceRun),
    sourceLabels: [
      "Reduced model output",
      ...referenceRunSourceLabels(referenceRun),
      "Derived diagnostic",
      "Qualitative diagnostic comparison",
      "Not live CM1 simulation",
    ],
    preRunExplanation: cloudColumnHasRun(state)
      ? null
      : "Reference case is available before you run the reduced model. Run the v2 flow to compare your reduced-model result against this CM1 reference.",
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
    story: {
      eyebrow: "Reference case",
      title: "CM1 reference is ready",
      outcome:
        "This CM1 reference case is precomputed and already available before the reduced-model run.",
      keyPointLabel: "Next step",
      keyPoint: "Run the v2 flow to generate the reduced-model result.",
      lookAt:
        "Then compare the reduced-model outcome with the offline CM1 reference diagnostics.",
    },
    sourceLabels: [
      "Reduced model output",
      "CM1 reference output",
      "Offline reference case",
      "Not live CM1 simulation",
    ],
    preRunExplanation:
      "Reference case is available before you run the reduced model. Run the v2 flow to compute the reduced-model side of the comparison.",
    morphologyNote:
      "Reference comparison is qualitative and diagnostic; exact CM1 cloud morphology is not a pass/fail target.",
  };
}

function storyCard(
  contract: LowerAtmosphereV2ScenarioContract,
  state: LowerAtmosphereV2State,
  referenceRun: ReferenceRun,
): LowerAtmosphereV2StoryCard {
  const cloudDiagnostics = state.cloudColumnRun?.diagnostics ?? null;
  const referenceStatus = referenceCloudStatus(referenceRun);

  if (!cloudDiagnostics) {
    return {
      eyebrow: contract.name,
      title: "CM1 reference is ready",
      outcome:
        "This offline CM1 reference case is available before you run the reduced model.",
      keyPointLabel: "Next step",
      keyPoint: "Run the v2 flow to generate the reduced-model side of the comparison.",
      lookAt:
        referenceStatus === "cloud_formed"
          ? "Replay the CM1 cloud-water field now, then compare timing, cloud base/top, and cloud amount after the reduced-model run."
          : "Replay the CM1 reference now, then compare no-cloud diagnostics and max updraft after the reduced-model run.",
    };
  }

  const reducedStatus = cloudDiagnostics.cloud_formation_status;
  const bothFormed = reducedStatus === "cloud_formed" && referenceStatus === "cloud_formed";
  const bothDry = reducedStatus === "dry_failed" && referenceStatus === "dry_failed";

  if (bothFormed) {
    return {
      eyebrow: contract.name,
      title: "What happened",
      outcome: "Both the reduced model and CM1 reference formed cloud.",
      keyPointLabel: "Key difference",
      keyPoint:
        "The reduced model forms a simplified prescribed-lift cloud. The CM1 reference shows the deeper 2-D cloud field and reference-model updraft.",
      lookAt:
        "Replay the CM1 cloud-water field, then compare first cloud time, cloud base/top, max cloud water, and max updraft as teaching diagnostics.",
    };
  }

  if (bothDry) {
    return {
      eyebrow: contract.name,
      title: "What happened",
      outcome: "Both the reduced model and CM1 reference stayed cloud-free.",
      keyPointLabel: "Key reason",
      keyPoint:
        "The lower atmosphere remains moisture-limited. CM1 can still show motion, but cloud liquid water does not appear.",
      lookAt:
        "Replay vertical velocity or the no-cloud field signal, then compare max updraft with max cloud water.",
    };
  }

  return {
    eyebrow: contract.name,
    title: "What happened",
    outcome: `Reduced model: ${lowerAtmosphereV2StatusLabel(reducedStatus)}. CM1 reference: ${lowerAtmosphereV2StatusLabel(referenceStatus)}.`,
    keyPointLabel: "Key difference",
    keyPoint:
      "The models do not need exact morphology agreement; read this as a qualitative teaching comparison.",
    lookAt:
      "Use the replay and cards below to compare outcome, timing, cloud structure, and source assumptions.",
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
  const referenceStatus = referenceCloudStatus(referenceRun);

  return [
    {
      category: "Outcome",
      diagnostic: "Outcome",
      reducedValue: reducedCloudStatus ? lowerAtmosphereV2StatusLabel(reducedCloudStatus) : "Cloud column not run",
      referenceValue: lowerAtmosphereV2StatusLabel(referenceStatus),
      interpretation:
        reducedCloudStatus === referenceStatus
          ? "Same qualitative outcome."
          : "Different qualitative outcome; inspect the story and diagnostics before changing science.",
    },
    {
      category: "Outcome",
      diagnostic: "Timing",
      reducedValue: formatSeconds(cloudDiagnostics?.first_cloud_time_seconds ?? null),
      referenceValue: formatSeconds(referenceDiagnostics?.first_cloud_time_seconds ?? null),
      interpretation: "Timing should be read qualitatively across different model classes.",
    },
    {
      category: "Cloud structure",
      diagnostic: "Cloud depth",
      reducedValue: formatHeightRange(
        cloudDiagnostics?.cloud_base_m ?? null,
        cloudDiagnostics?.cloud_top_proxy_m ?? null,
      ),
      referenceValue: formatHeightRange(
        referenceDiagnostics?.cloud_base_m ?? null,
        referenceDiagnostics?.cloud_top_m ?? null,
      ),
      interpretation: "Compare order of magnitude; exact cloud morphology is not scored.",
    },
    {
      category: "Cloud structure",
      diagnostic: "Cloud amount",
      reducedValue: formatKgPerKg(cloudDiagnostics?.max_cloud_liquid_water_kg_per_kg ?? null),
      referenceValue: formatKgPerKg(referenceDiagnostics?.max_cloud_liquid_water_kg_per_kg ?? null),
      interpretation: "Compare cloud amount as a teaching diagnostic, not a calibrated forecast.",
    },
    {
      category: "Dynamics",
      diagnostic: "Updraft",
      reducedValue: reducedUpdraftLabel(cloudDiagnostics),
      referenceValue: formatMetersPerSecond(referenceDiagnostics?.max_updraft_m_per_s ?? null),
      interpretation: "Reduced lift is prescribed; CM1 updraft is reference-model output.",
    },
    {
      category: "Outcome",
      diagnostic: "Rain",
      reducedValue: "not evaluated",
      referenceValue: formatSeconds(referenceDiagnostics?.first_rain_time_seconds ?? null),
      interpretation: "Rain comparison remains deferred until reduced warm-rain diagnostics are enabled.",
    },
    {
      category: "Context",
      diagnostic: "Profile context",
      reducedValue: profileFrame
        ? `${formatMeters(profileFrame.mixed_layer_depth_m)} mixed layer / ${formatMeters(profileFrame.lcl_m)} LCL`
        : "Profile not run",
      referenceValue: `${referenceRun.source_case_id}${isSyntheticReferenceRun(referenceRun) ? " (synthetic fixture)" : " (real local ingested)"}`,
      interpretation: "Reference cases anchor interpretation; fixtures are not scientific truth.",
    },
  ];
}

function selectedComparisonProfileFrame(state: LowerAtmosphereV2State): BoundaryLayer1DFrame | null {
  return lowerAtmosphereV2ProfileFrames(state).length > 0 ? selectedLowerAtmosphereV2ProfileFrame(state) : null;
}

function referenceCloudStatus(referenceRun: ReferenceRun): "cloud_formed" | "dry_failed" {
  const maxCloud = referenceRun.diagnostics?.max_cloud_liquid_water_kg_per_kg ?? 0;
  return maxCloud > 0 ? "cloud_formed" : "dry_failed";
}

function reducedUpdraftLabel(diagnostics: CloudColumnDiagnostics | null): string {
  if (!diagnostics) {
    return "Cloud column not run";
  }
  return `${diagnostics.forcing.updraft_strength_m_per_s.toFixed(2)} m/s prescribed lift`;
}

function cloudColumnHasRun(state: LowerAtmosphereV2State): boolean {
  return state.cloudColumnRun !== null;
}

function formatSeconds(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "not available";
  }
  return `${Math.round(value)} s`;
}

function formatMeters(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "not available";
  }
  return `${Math.round(value)} m`;
}

function formatHeightRange(base: number | null, top: number | null): string {
  if (base === null && top === null) {
    return "not available";
  }
  return `${formatMeters(base)}-${formatMeters(top)}`;
}

function formatMetersPerSecond(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "not available";
  }
  return `${value.toPrecision(3)} m/s`;
}

function formatKgPerKg(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "not available";
  }
  return value === 0 ? "0 kg/kg" : `${value.toExponential(2)} kg/kg`;
}

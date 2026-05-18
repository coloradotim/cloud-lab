import type { ReferenceRun } from "./referenceTypes";

export const LOCAL_REFERENCE_INDEX_URL = "/reference/cm1/local/index.json";

export type LocalReferenceIndexEntry = {
  case_id: string;
  case_name: string;
  source_model: "CM1";
  artifact_url: string;
  manifest_url?: string;
  source_is_synthetic_fixture: boolean;
  frame_count: number;
  time_range_seconds: [number, number];
  grid_shape: {
    rows: number;
    columns: number;
  };
};

export type LocalReferenceIndex = {
  schema_version: "cloud-lab-cm1-local-reference-index-v1";
  created_at: string | null;
  runs: LocalReferenceIndexEntry[];
  notes?: string[];
};

export async function loadLocalReferenceRuns(
  fetcher: typeof fetch = fetch,
  indexUrl = LOCAL_REFERENCE_INDEX_URL,
): Promise<ReferenceRun[]> {
  const indexResponse = await fetcher(indexUrl, { cache: "no-store" });
  if (!indexResponse.ok) {
    return [];
  }

  const index = (await indexResponse.json()) as LocalReferenceIndex;
  if (index.schema_version !== "cloud-lab-cm1-local-reference-index-v1" || !Array.isArray(index.runs)) {
    return [];
  }

  const runs = await Promise.all(
    index.runs.map(async (entry) => {
      const response = await fetcher(resolveReferenceUrl(entry.artifact_url, indexUrl), {
        cache: "no-store",
      });
      if (!response.ok) {
        return null;
      }
      return (await response.json()) as ReferenceRun;
    }),
  );

  return runs.filter((run): run is ReferenceRun => isUsableReferenceRun(run));
}

export function preferredReferenceRuns(localRuns: ReferenceRun[], fixtureRuns: ReferenceRun[]): ReferenceRun[] {
  const byCaseId = new Map<string, ReferenceRun>();
  for (const run of fixtureRuns) {
    byCaseId.set(run.source_case_id, run);
  }
  for (const run of localRuns) {
    if (!isSyntheticReferenceRun(run)) {
      byCaseId.set(run.source_case_id, run);
    }
  }
  return [...byCaseId.values()];
}

export function referenceRunForCase(
  caseId: string,
  localRuns: ReferenceRun[],
  fixtureRuns: ReferenceRun[],
): ReferenceRun | null {
  return preferredReferenceRuns(localRuns, fixtureRuns).find((run) => run.source_case_id === caseId) ?? null;
}

export function isSyntheticReferenceRun(run: ReferenceRun | null): boolean {
  return run?.frames[0]?.provenance.source_is_synthetic_fixture ?? run?.diagnostics?.source_provenance.source_is_synthetic_fixture ?? false;
}

export function referenceRunSourceLabels(run: ReferenceRun | null): string[] {
  if (!run) {
    return ["CM1 reference output", "Offline reference case"];
  }
  return isSyntheticReferenceRun(run)
    ? [
        "CM1 reference output",
        "Offline reference case",
        "Synthetic fixture data",
        "Not scientific truth",
        "For UI/testing only",
      ]
    : [
        "CM1 reference output",
        "Offline local reference case",
        "Real local ingested output",
        "Reference model output",
      ];
}

export function missingRealReferenceOutputMessage(caseId: string): string {
  return `No real local CM1 reference output is available for ${caseId} yet. Run the local CM1 reference-pair workflow and ingest the output, or use the tiny fixture/demo view.`;
}

function resolveReferenceUrl(artifactUrl: string, indexUrl: string): string {
  if (artifactUrl.startsWith("/") || artifactUrl.startsWith("http://") || artifactUrl.startsWith("https://")) {
    return artifactUrl;
  }
  const basePath = indexUrl.slice(0, indexUrl.lastIndexOf("/") + 1);
  return `${basePath}${artifactUrl}`;
}

function isUsableReferenceRun(run: ReferenceRun | null): run is ReferenceRun {
  return (
    run?.schema_version === "reference-run-v1" &&
    run.source_model === "CM1" &&
    typeof run.source_case_id === "string" &&
    Array.isArray(run.frames) &&
    run.frames.length > 0
  );
}

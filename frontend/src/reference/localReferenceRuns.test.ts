import { describe, expect, it } from "vitest";

import { createTinyCm1ReferenceRunFixture } from "./referenceFixtures";
import {
  isSyntheticReferenceRun,
  loadLocalReferenceRuns,
  missingRealReferenceOutputMessage,
  preferredReferenceRuns,
  referenceRunSourceLabels,
} from "./localReferenceRuns";
import type { ReferenceRun } from "./referenceTypes";

describe("local CM1 reference runs", () => {
  it("loads local reference artifacts from an ignored public index", async () => {
    const realRun = createRealLocalReferenceRunFixture();
    const fetcher = async (url: string | URL | Request) => {
      const href = String(url);
      if (href.endsWith("/index.json")) {
        return jsonResponse({
          schema_version: "cloud-lab-cm1-local-reference-index-v1",
          created_at: "2026-05-18T00:00:00Z",
          runs: [
            {
              case_id: "cm1-shallow-cumulus-baseline-v1",
              case_name: "Shallow Cumulus Baseline",
              source_model: "CM1",
              artifact_url: "/reference/cm1/local/cm1-shallow-cumulus-baseline-v1/reference-run.json",
              source_is_synthetic_fixture: false,
              frame_count: 2,
              time_range_seconds: [0, 300],
              grid_shape: { rows: 3, columns: 4 },
            },
          ],
        });
      }
      return jsonResponse(realRun);
    };

    const runs = await loadLocalReferenceRuns(fetcher as typeof fetch);

    expect(runs).toHaveLength(1);
    expect(runs[0].source_case_id).toBe("cm1-shallow-cumulus-baseline-v1");
    expect(isSyntheticReferenceRun(runs[0])).toBe(false);
  });

  it("prefers real local ingested output over the tiny fixture for the same case", () => {
    const fixture = createTinyCm1ReferenceRunFixture();
    const real = createRealLocalReferenceRunFixture();

    const preferred = preferredReferenceRuns([real], [fixture]);

    expect(preferred).toHaveLength(1);
    expect(isSyntheticReferenceRun(preferred[0])).toBe(false);
    expect(referenceRunSourceLabels(preferred[0])).toContain("Real local ingested output");
  });

  it("keeps fixture labels and actionable missing-real-output copy", () => {
    const fixture = createTinyCm1ReferenceRunFixture();

    expect(referenceRunSourceLabels(fixture)).toEqual(
      expect.arrayContaining(["Synthetic fixture data", "Not scientific truth", "For UI/testing only"]),
    );
    expect(missingRealReferenceOutputMessage(fixture.source_case_id)).toContain(
      "Run the local CM1 reference-pair workflow and ingest the output",
    );
  });

  it("returns no local runs when the optional local index is absent", async () => {
    const fetcher = async () => jsonResponse({ notFound: true }, false);

    await expect(loadLocalReferenceRuns(fetcher as typeof fetch)).resolves.toEqual([]);
  });
});

function jsonResponse(payload: unknown, ok = true): Response {
  return {
    ok,
    json: async () => payload,
  } as Response;
}

function createRealLocalReferenceRunFixture(): ReferenceRun {
  const fixture = createTinyCm1ReferenceRunFixture();
  if (!fixture.diagnostics) {
    throw new Error("Expected fixture diagnostics");
  }
  return {
    ...fixture,
    frames: fixture.frames.map((frame) => ({
      ...frame,
      provenance: {
        ...frame.provenance,
        source_is_synthetic_fixture: false,
      },
    })),
    diagnostics: {
      ...fixture.diagnostics,
      source_provenance: {
        ...fixture.diagnostics.source_provenance,
        source_is_synthetic_fixture: false,
      },
    },
  };
}

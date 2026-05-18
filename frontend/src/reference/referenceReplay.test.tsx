import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ReferenceReplayView } from "./ReferenceReplayView";
import {
  createTinyCm1DryFailedReferenceRunFixture,
  createTinyCm1ReferenceRunFixture,
} from "./referenceFixtures";
import {
  buildReferenceAppearanceViewModel,
  cloneReferenceCloudWaterValues,
  referenceAppearanceFallback,
  referenceAppearanceHasMeaningfulCloud,
} from "./referenceAppearance";
import {
  buildReferenceReplayViewModel,
  defaultReferenceFieldKey,
  normalizeReferenceFieldSelection,
  referenceMissingFieldNotes,
  referenceReplayFallback,
} from "./referenceReplay";
import type { ReferenceRun } from "./referenceTypes";

describe("CM1 reference replay view model", () => {
  it("renders with tiny fixture reference frames", () => {
    const run = createTinyCm1ReferenceRunFixture();
    const viewModel = buildReferenceReplayViewModel(run, "cloud_liquid_water_kg_per_kg", 0);

    expect(viewModel?.run.source_model).toBe("CM1");
    expect(viewModel?.fieldKey).toBe("cloud_liquid_water_kg_per_kg");
    expect(viewModel?.cells).toHaveLength(12);
    expect(viewModel?.summary.truth.label).toBe("Reference model output");
  });

  it("renders cloud liquid water and switches selected fields", () => {
    const run = createTinyCm1ReferenceRunFixture();
    const cloud = buildReferenceReplayViewModel(run, "cloud_liquid_water_kg_per_kg", 1);
    const velocity = buildReferenceReplayViewModel(run, "vertical_velocity_m_per_s", 1);

    expect(cloud?.field.metadata.display_name).toBe("Cloud liquid water");
    expect(cloud?.cells.some((cell) => cell.value === 5e-7)).toBe(true);
    expect(velocity?.field.metadata.display_name).toBe("Vertical velocity");
    expect(velocity?.fieldKey).toBe("vertical_velocity_m_per_s");
  });

  it("timeline frame index changes the displayed frame", () => {
    const run = createTinyCm1ReferenceRunFixture();
    const first = buildReferenceReplayViewModel(run, "cloud_liquid_water_kg_per_kg", 0);
    const second = buildReferenceReplayViewModel(run, "cloud_liquid_water_kg_per_kg", 1);

    expect(first?.frame.time_seconds).toBe(0);
    expect(first?.summary.value).toBe("0.00e+0");
    expect(first?.signal.hasSignal).toBe(false);
    expect(first?.signal.statusLabel).toBe("No cloud formed");
    expect(second?.frame.time_seconds).toBe(300);
    expect(second?.summary.value).toBe("5.00e-7");
    expect(second?.signal.hasSignal).toBe(true);
  });

  it("shows missing field fallback instead of blanking the page", () => {
    const run = createTinyCm1ReferenceRunFixture();

    expect(buildReferenceReplayViewModel(run, "rain_water_kg_per_kg", 0)).toBeNull();
    expect(referenceReplayFallback(run, "rain_water_kg_per_kg", 0)).toContain("Rain water is missing");
  });

  it("softens missing temperature warnings when potential temperature is available", () => {
    const run = createTinyCm1ReferenceRunFixture();
    run.diagnostics!.missing_field_warnings = ["Missing CM1 field for temperature_k."];
    run.diagnostics!.available_fields = ["potential_temperature_k"];

    expect(referenceMissingFieldNotes(run)).toEqual([
      "Temperature field unavailable; potential temperature is available for the temperature/theta view.",
    ]);
  });

  it("shows missing frames fallback", () => {
    const emptyRun: ReferenceRun = {
      ...createTinyCm1ReferenceRunFixture(),
      frames: [],
    };

    expect(buildReferenceReplayViewModel(emptyRun, defaultReferenceFieldKey(emptyRun), 0)).toBeNull();
    expect(referenceReplayFallback(emptyRun, "cloud_liquid_water_kg_per_kg", 0)).toContain(
      "No reference frames",
    );
  });

  it("handles invalid grid, mismatched field shapes, and nonfinite values", () => {
    const badGrid: ReferenceRun = {
      ...createTinyCm1ReferenceRunFixture(),
      frames: [
        {
          ...createTinyCm1ReferenceRunFixture().frames[0],
          grid: {
            columns: 4,
            rows: 3,
            x_coordinates_m: [0],
            z_coordinates_m: [0, 500, 1000],
          },
        },
      ],
    };
    expect(referenceReplayFallback(badGrid, "cloud_liquid_water_kg_per_kg", 0)).toContain(
      "grid coordinates",
    );

    const badShape = createTinyCm1ReferenceRunFixture();
    badShape.frames[0].fields.cloud_liquid_water_kg_per_kg.values = [[0, 0]];
    expect(referenceReplayFallback(badShape, "cloud_liquid_water_kg_per_kg", 0)).toContain("rows");

    const nonFinite = createTinyCm1ReferenceRunFixture();
    nonFinite.frames[0].fields.cloud_liquid_water_kg_per_kg.values[0][0] = Number.NaN;
    const viewModel = buildReferenceReplayViewModel(nonFinite, "cloud_liquid_water_kg_per_kg", 0);
    expect(viewModel?.cells[0].value).toBe(0);
    expect(viewModel?.fallbackMessage).toContain("NaN or Infinity");
  });
});

describe("CM1 reference replay component", () => {
  it("renders provenance and offline-source labels", () => {
    const html = renderToStaticMarkup(
      <ReferenceReplayView referenceRun={createTinyCm1ReferenceRunFixture()} />,
    );

    expect(html).toContain("CM1 reference output");
    expect(html).toContain("Offline reference case");
    expect(html).toContain("Scientific field view");
    expect(html).toContain("Not live CM1 simulation");
    expect(html).toContain("Synthetic fixture data");
    expect(html).toContain("Not scientific truth");
    expect(html).toContain("For UI/testing only");
    expect(html).toContain("No real local CM1 reference output is available");
    expect(html).toContain("Run the local CM1 reference-pair workflow and ingest the output");
    expect(html).toContain("Field status");
    expect(html).toContain("No cloud formed");
    expect(html).toContain("Scientific Fields");
    expect(html).toContain("Cloud Appearance");
    expect(html).toContain("Cloud liquid water shows where cloud exists");
    expect(html).toContain("Replay the CM1 reference case to see when cloud water appears");
    expect(html).toContain("300 s - first cloud");
  });

  it("renders no-cloud timeline guidance for dry failed references", () => {
    const html = renderToStaticMarkup(
      <ReferenceReplayView referenceRun={createTinyCm1DryFailedReferenceRunFixture()} />,
    );

    expect(html).toContain("No cloud formed during");
    expect(html).toContain("Inspect vertical velocity to see motion without cloud water");
  });

  it("renders real local ingested labels separately from fixture labels", () => {
    const run = createRealLocalReferenceRunFixture();
    const html = renderToStaticMarkup(<ReferenceReplayView referenceRun={run} />);

    expect(html).toContain("Real local ingested output");
    expect(html).toContain("Offline local reference case");
    expect(html).not.toContain("Synthetic fixture data");
    expect(html).not.toContain("For UI/testing only");
  });

  it("does not run CM1 or mislabel reduced-model output as CM1", () => {
    const html = renderToStaticMarkup(
      <ReferenceReplayView referenceRun={createTinyCm1ReferenceRunFixture()} />,
    );

    expect(html).not.toContain("Run CM1");
    expect(html).not.toContain("Reduced model output");
    expect(html).not.toContain("boundary_layer_1d");
    expect(html).not.toContain("controlled_cloud_column");
  });

  it("normalizes unknown selected fields to a reference field", () => {
    const run = createTinyCm1ReferenceRunFixture();

    expect(normalizeReferenceFieldSelection(run, "not-a-field")).toBe(
      "cloud_liquid_water_kg_per_kg",
    );
  });
});

describe("CM1 reference appearance view", () => {
  it("renders appearance from reference cloud-water fields", () => {
    const run = createTinyCm1ReferenceRunFixture();
    const model = buildReferenceAppearanceViewModel(run, 1);

    expect(model?.run.source_model).toBe("CM1");
    expect(model?.cloudWaterField.metadata.display_name).toBe("Cloud liquid water");
    expect(model?.cells).toHaveLength(12);
    expect(model?.maxCloudWater).toBe(5e-7);
    expect(referenceAppearanceHasMeaningfulCloud(model)).toBe(true);
  });

  it("renders zero cloud water as no meaningful cloud", () => {
    const run = createTinyCm1ReferenceRunFixture();
    const model = buildReferenceAppearanceViewModel(run, 0);

    expect(model?.maxCloudWater).toBe(0);
    expect(model?.meanOpacity).toBe(0);
    expect(referenceAppearanceHasMeaningfulCloud(model)).toBe(false);
  });

  it("increases visual response when cloud water increases", () => {
    const run = createTinyCm1ReferenceRunFixture();
    const baseline = buildReferenceAppearanceViewModel(run, 1);
    const stronger = createTinyCm1ReferenceRunFixture();
    stronger.frames[1].fields.cloud_liquid_water_kg_per_kg.values =
      stronger.frames[1].fields.cloud_liquid_water_kg_per_kg.values.map((row) =>
        row.map((value) => value * 3),
      );
    const strongerModel = buildReferenceAppearanceViewModel(stronger, 1);

    expect(strongerModel?.maxOpticalDepth).toBeGreaterThan(baseline?.maxOpticalDepth ?? 0);
    expect(strongerModel?.meanOpacity).toBeGreaterThan(baseline?.meanOpacity ?? 0);
  });

  it("does not mutate reference cloud-water fields", () => {
    const run = createTinyCm1ReferenceRunFixture();
    const before = cloneReferenceCloudWaterValues(run);

    buildReferenceAppearanceViewModel(run, 1);

    expect(cloneReferenceCloudWaterValues(run)).toEqual(before);
  });

  it("shows missing cloud-water fallback", () => {
    const run = createTinyCm1ReferenceRunFixture();
    delete run.frames[1].fields.cloud_liquid_water_kg_per_kg;

    expect(buildReferenceAppearanceViewModel(run, 1)).toBeNull();
    expect(referenceAppearanceFallback(run, 1)).toContain("Cloud liquid water is missing");
  });

  it("renders provenance, assumption labels, and keeps scientific view available", () => {
    const appearanceHtml = renderToStaticMarkup(
      <ReferenceReplayView
        referenceRun={createTinyCm1ReferenceRunFixture()}
        initialViewMode="cloud-appearance"
      />,
    );
    const scientificHtml = renderToStaticMarkup(
      <ReferenceReplayView referenceRun={createTinyCm1ReferenceRunFixture()} />,
    );

    expect(appearanceHtml).toContain("Cloud appearance view");
    expect(appearanceHtml).toContain("Visual interpretation of CM1 reference field");
    expect(appearanceHtml).toContain("Assumed droplet radius");
    expect(appearanceHtml).toContain("Not direct radiative transfer");
    expect(appearanceHtml).toContain("Not live CM1 simulation");
    expect(appearanceHtml).toContain("CM1 reference output");
    expect(appearanceHtml).toContain("Zero cloud water renders no meaningful cloud");
    expect(scientificHtml).toContain("Scientific field view");
    expect(scientificHtml).toContain("Cloud Appearance");
  });
});

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
      assumptions: frame.assumptions.filter((assumption) => !assumption.includes("Synthetic fixture")),
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

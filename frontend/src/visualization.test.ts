import { describe, expect, it } from "vitest";

import type { SimulationFrame } from "./simulationTypes";
import {
  CLOUD_APPEARANCE_MODE,
  DEFAULT_CLOUD_OPTICAL_ASSUMPTIONS,
  cloudOpticalCell,
  cloudOpticalGrid,
  colorForNormalizedValue,
  displayRangeForField,
  displayStatsForField,
  displayUnitForField,
  displayValueForField,
  fieldSummaryForField,
  fieldOptionsFromFrame,
  formatDisplayValue,
  getFieldStats,
  gridPointFromCanvas,
  normalizedDisplayValueForField,
  normalizedDisplayValueForFieldKey,
  scalingMetadataForField,
  sharedDisplayRangeForField,
  truthMetadataForField,
  truthMetadataForSolver,
  valueRangeForField,
  vectorScaleForFrame,
  visualizationOptionsFromFrame,
} from "./visualization";

const frame: SimulationFrame = {
  schema_version: "sim-frame-v1",
  step: 0,
  time_seconds: 0,
  grid: {
    columns: 2,
    rows: 2,
    x_coordinates_m: [25, 75],
    z_coordinates_m: [10, 30],
  },
  fields: {
    temperature_k: {
      values: [
        [290, 291],
        [288, 289],
      ],
      metadata: {
        unit: "K",
        display_name: "Temperature",
        description: "Air temperature.",
        display_scale: { min_value: 280, max_value: 300, color_map: "magma" },
      },
    },
    cloud_liquid_water_kg_per_kg: {
      values: [
        [0, 0.001],
        [0.002, 0.003],
      ],
      metadata: {
        unit: "kg kg-1",
        display_name: "Cloud liquid water",
        description: "Condensed water.",
        display_scale: { min_value: 0, max_value: 0.004, color_map: "Blues" },
      },
    },
    temperature_perturbation_k: {
      values: [
        [0, 1],
        [-1, 2],
      ],
      metadata: {
        unit: "K",
        display_name: "Temperature perturbation",
        description: "Temperature departure.",
        display_scale: { min_value: -5, max_value: 5, color_map: "coolwarm" },
      },
    },
    horizontal_velocity_m_per_s: {
      values: [
        [1, 1],
        [1, 1],
      ],
      metadata: {
        unit: "m s-1",
        display_name: "Horizontal velocity",
        description: "Horizontal wind.",
      },
    },
    vertical_velocity_m_per_s: {
      values: [
        [0.1, 0.2],
        [0.3, 0.4],
      ],
      metadata: {
        unit: "m s-1",
        display_name: "Vertical velocity",
        description: "Vertical wind.",
      },
    },
  },
};

describe("visualization helpers", () => {
  it("maps frame field metadata into ordered UI options", () => {
    expect(fieldOptionsFromFrame(frame)).toMatchObject([
      { key: "cloud_liquid_water_kg_per_kg", label: "Cloud liquid water", unit: "kg kg-1" },
      { key: "temperature_k", label: "Temperature", unit: "deg C" },
      { key: "temperature_perturbation_k", label: "Temperature perturbation", unit: "K" },
      { key: "vertical_velocity_m_per_s", label: "Vertical velocity", unit: "m s-1" },
      { key: "horizontal_velocity_m_per_s", label: "Horizontal velocity", unit: "m s-1" },
    ]);
    expect(fieldOptionsFromFrame(frame)[0]).toMatchObject({
      categoryLabel: "Solver output",
    });
  });

  it("adds a bulk cloud appearance rendering option when cloud water is available", () => {
    expect(visualizationOptionsFromFrame(frame)[0]).toMatchObject({
      key: CLOUD_APPEARANCE_MODE,
      label: "Cloud appearance",
      categoryLabel: "Visual approximation",
    });
  });

  it("keeps raw ranges in transport units", () => {
    expect(valueRangeForField(frame.fields.temperature_k)).toEqual({ min: 280, max: 300 });
  });

  it("converts temperature field display values to Celsius", () => {
    const field = frame.fields.temperature_k;

    expect(displayUnitForField(field)).toBe("deg C");
    expect(displayValueForField(field, 293.15)).toBeCloseTo(20);
    expect(displayStatsForField(field).min).toBeCloseTo(14.85);
    expect(displayStatsForField(field).max).toBeCloseTo(17.85);
    expect(displayRangeForField(field).min).toBeCloseTo(14.35);
    expect(displayRangeForField(field).max).toBeCloseTo(18.35);
    expect(formatDisplayValue(field, 293.15)).toBe("20.00");
  });

  it("keeps temperature perturbations in kelvin differences", () => {
    const field = frame.fields.temperature_perturbation_k;

    expect(displayUnitForField(field)).toBe("K");
    expect(displayValueForField(field, 2)).toBe(2);
    expect(formatDisplayValue(field, 2)).toBe("2.00");
  });

  it("uses adaptive display normalization for condensate and velocity fields", () => {
    const cloud = frame.fields.cloud_liquid_water_kg_per_kg;
    const velocity = frame.fields.vertical_velocity_m_per_s;

    expect(displayRangeForField(cloud)).toEqual({ min: 0, max: 0.003 });
    expect(normalizedDisplayValueForField(cloud, 0)).toBe(0);
    expect(normalizedDisplayValueForField(cloud, 0.00003)).toBeGreaterThan(0.6);
    expect(normalizedDisplayValueForField(cloud, 0.003)).toBeCloseTo(1);
    expect(displayRangeForField(velocity)).toEqual({ min: -0.4, max: 0.4 });
    expect(normalizedDisplayValueForField(velocity, 0)).toBeCloseTo(0.5);
    expect(normalizedDisplayValueForField(velocity, 0.4)).toBeCloseTo(1);
  });

  it("summarizes cloud water without presenting numerical-noise minima as a range", () => {
    const cloudWithNoise = {
      ...frame.fields.cloud_liquid_water_kg_per_kg,
      values: [
        [5e-73, 6.8e-3],
        [0, 1e-10],
      ],
    };

    expect(fieldSummaryForField("cloud_liquid_water_kg_per_kg", cloudWithNoise)).toMatchObject({
      label: "Field max",
      value: "6.80e-3",
      unit: "kg kg-1",
      helper: "Values below 1.0e-8 kg kg-1 are display noise.",
      truth: { category: "solver_output", label: "Solver output" },
      scaling: { scale: "log", noiseThreshold: 1e-8 },
    });
  });

  it("defines truth metadata for fields, derived diagnostics, solvers, and visual renderings", () => {
    expect(truthMetadataForField("relative_humidity")).toMatchObject({
      category: "derived_diagnostic",
      label: "Derived diagnostic",
    });
    expect(truthMetadataForField("buoyancy_m_per_s2")).toMatchObject({
      category: "derived_diagnostic",
      limitations: expect.stringContaining("Approximate thermal buoyancy"),
    });
    expect(
      truthMetadataForField(
        "vertical_velocity_m_per_s",
        frame.fields.vertical_velocity_m_per_s,
        "microphysics_lab",
      ),
    ).toMatchObject({
      category: "prescribed_forcing",
      label: "Prescribed forcing",
    });
    expect(truthMetadataForField("optical_depth")).toMatchObject({
      category: "visual_approximation",
    });
    expect(truthMetadataForField(CLOUD_APPEARANCE_MODE)).toMatchObject({
      category: "visual_approximation",
      limitations: expect.stringContaining("not droplet-resolved Mie scattering"),
    });
    expect(visualizationOptionsFromFrame(null)).toEqual([]);
    expect(truthMetadataForSolver("boussinesq_2d")).toMatchObject({
      category: "experimental",
      label: "Experimental 2-D prototype",
      limitations: expect.stringContaining("prototype stabilizers and safety caps"),
    });
    expect(
      truthMetadataForField(
        "cloud_liquid_water_kg_per_kg",
        frame.fields.cloud_liquid_water_kg_per_kg,
        "boussinesq_2d",
      ),
    ).toMatchObject({
      category: "solver_output",
      label: "Experimental solver output",
      limitations: expect.stringContaining("prototype stabilizers and safety caps"),
    });
  });

  it("estimates optical response from bulk cloud water and effective radius", () => {
    expect(cloudOpticalCell(0)).toMatchObject({
      opticalDepth: 0,
      opacity: 0,
    });

    const thin = cloudOpticalCell(1e-5);
    const thick = cloudOpticalCell(1e-3);
    expect(thick.opticalDepth).toBeGreaterThan(thin.opticalDepth);
    expect(thick.opacity).toBeGreaterThan(thin.opacity);

    const smallDroplets = cloudOpticalCell(1e-4, {
      ...DEFAULT_CLOUD_OPTICAL_ASSUMPTIONS,
      effectiveRadiusUm: 6,
    });
    const largeDroplets = cloudOpticalCell(1e-4, {
      ...DEFAULT_CLOUD_OPTICAL_ASSUMPTIONS,
      effectiveRadiusUm: 24,
    });
    expect(smallDroplets.opticalDepth).toBeGreaterThan(largeDroplets.opticalDepth);
  });

  it("builds an optical grid with transparent no-cloud cells", () => {
    const opticalGrid = cloudOpticalGrid(frame.fields.cloud_liquid_water_kg_per_kg);

    expect(opticalGrid[0][0].opacity).toBe(0);
    expect(opticalGrid[1][1].opacity).toBeGreaterThan(opticalGrid[0][0].opacity);
  });

  it("uses field-specific scaling policies and suppresses condensate noise", () => {
    expect(scalingMetadataForField("cloud_liquid_water_kg_per_kg")).toMatchObject({
      scale: "log",
      range: "adaptive",
      noiseThreshold: 1e-8,
      comparison: "shared_by_default",
    });
    expect(scalingMetadataForField("temperature_perturbation_k")).toMatchObject({
      scale: "linear",
      range: "symmetric",
      signed: true,
    });
    expect(
      normalizedDisplayValueForFieldKey(
        "cloud_liquid_water_kg_per_kg",
        frame.fields.cloud_liquid_water_kg_per_kg,
        1e-10,
      ),
    ).toBe(0);
  });

  it("falls back gracefully when scale metadata is missing", () => {
    const unknownField = {
      values: [
        [3, 4],
        [5, 6],
      ],
      metadata: {
        unit: "arb",
        display_name: "Future diagnostic",
        description: "A future field without explicit frontend metadata.",
      },
    };

    expect(scalingMetadataForField("future_diagnostic", unknownField)).toMatchObject({
      scale: "linear",
      range: "adaptive",
      comparison: "shared_by_default",
    });
    expect(displayRangeForField(unknownField)).toEqual({ min: 3, max: 6 });
  });

  it("calculates shared comparison ranges with symmetric signed fields", () => {
    const strongerVerticalVelocity = {
      ...frame.fields.vertical_velocity_m_per_s,
      values: [
        [-2, 0],
        [0.5, 1],
      ],
    };

    expect(
      sharedDisplayRangeForField("vertical_velocity_m_per_s", [
        frame.fields.vertical_velocity_m_per_s,
        strongerVerticalVelocity,
      ]),
    ).toEqual({ min: -2, max: 2 });
  });

  it("keeps signed fields as min and max summaries", () => {
    expect(fieldSummaryForField("vertical_velocity_m_per_s", frame.fields.vertical_velocity_m_per_s))
      .toMatchObject({
        label: "Field min / max",
        value: "1.00e-1 to 4.00e-1",
        unit: "m s-1",
      });
    expect(
      fieldSummaryForField("temperature_perturbation_k", frame.fields.temperature_perturbation_k),
    ).toMatchObject({
      label: "Field min / max",
      value: "-1.00 to 2.00",
      unit: "K",
    });
  });

  it("maps blue condensate colors from clear sky toward white cloud", () => {
    const clearSky = colorForNormalizedValue(0, "Blues");
    const cloud = colorForNormalizedValue(1, "Blues");

    expect(clearSky[2]).toBeGreaterThan(clearSky[0]);
    expect(cloud).toEqual([255, 255, 255]);
  });

  it("maps diverging velocity colors with a neutral midpoint", () => {
    expect(colorForNormalizedValue(0, "coolwarm")).toEqual([70, 120, 210]);
    expect(colorForNormalizedValue(0.5, "coolwarm")).toEqual([245, 245, 245]);
    expect(colorForNormalizedValue(1, "coolwarm")).toEqual([210, 80, 60]);
  });

  it("computes data range when display scale is absent", () => {
    expect(getFieldStats(frame.fields.vertical_velocity_m_per_s)).toEqual({ min: 0.1, max: 0.4 });
    expect(valueRangeForField(frame.fields.vertical_velocity_m_per_s)).toEqual({
      min: 0.1,
      max: 0.4,
    });
  });

  it("maps canvas coordinates to grid cells with z increasing upward", () => {
    expect(gridPointFromCanvas(10, 10, 100, 100, 2, 2)).toEqual({ row: 1, column: 0 });
    expect(gridPointFromCanvas(90, 90, 100, 100, 2, 2)).toEqual({ row: 0, column: 1 });
  });

  it("scales velocity vectors adaptively and samples compact grids at every cell", () => {
    const vectorScale = vectorScaleForFrame(frame, 200, 100);

    expect(vectorScale.stride).toBe(1);
    expect(vectorScale.pixelsPerMeterPerSecond).toBeGreaterThan(10);
  });
});

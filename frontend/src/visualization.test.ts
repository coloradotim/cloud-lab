import { describe, expect, it } from "vitest";

import type { SimulationFrame } from "./simulationTypes";
import {
  displayRangeForField,
  displayStatsForField,
  displayUnitForField,
  displayValueForField,
  fieldOptionsFromFrame,
  formatDisplayValue,
  getFieldStats,
  gridPointFromCanvas,
  normalizedDisplayValueForField,
  valueRangeForField,
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
      { key: "vertical_velocity_m_per_s", label: "Vertical velocity", unit: "m s-1" },
      { key: "horizontal_velocity_m_per_s", label: "Horizontal velocity", unit: "m s-1" },
    ]);
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
});

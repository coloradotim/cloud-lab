import { describe, expect, it } from "vitest";

import type { SimulationFrame } from "./simulationTypes";
import { buildProbeDiagnostics, buildProbeResult } from "./probe";

const frame: SimulationFrame = {
  schema_version: "sim-frame-v1",
  step: 4,
  time_seconds: 20,
  grid: {
    columns: 3,
    rows: 3,
    x_coordinates_m: [50, 150, 250],
    z_coordinates_m: [25, 75, 125],
  },
  fields: {
    temperature_k: {
      values: [
        [300, 301, 302],
        [299, 300, 301],
        [298, 299, 300],
      ],
      metadata: {
        unit: "K",
        display_name: "Temperature",
        description: "Air temperature.",
      },
    },
    temperature_perturbation_k: {
      values: [
        [1, 2, 3],
        [0, 1, 2],
        [-1, 0, 1],
      ],
      metadata: {
        unit: "K",
        display_name: "Temperature perturbation",
        description: "Air temperature departure.",
      },
    },
    water_vapor_kg_per_kg: {
      values: [
        [0.012, 0.012, 0.012],
        [0.01, 0.01, 0.01],
        [0.008, 0.008, 0.008],
      ],
      metadata: {
        unit: "kg kg-1",
        display_name: "Water vapor",
        description: "Specific humidity.",
      },
    },
    cloud_liquid_water_kg_per_kg: {
      values: [
        [0, 0.001, 0.002],
        [0, 0.002, 0.004],
        [0, 0, 0.001],
      ],
      metadata: {
        unit: "kg kg-1",
        display_name: "Cloud liquid water",
        description: "Condensed cloud water.",
      },
    },
    horizontal_velocity_m_per_s: {
      values: [
        [1, 2, 3],
        [1, 2, 3],
        [1, 2, 3],
      ],
      metadata: {
        unit: "m s-1",
        display_name: "Horizontal velocity",
        description: "Horizontal wind.",
      },
    },
    vertical_velocity_m_per_s: {
      values: [
        [0, 0.5, 1],
        [0, 1, 2],
        [0, 0.5, 1],
      ],
      metadata: {
        unit: "m s-1",
        display_name: "Vertical velocity",
        description: "Vertical wind.",
      },
    },
  },
};

describe("probe diagnostics", () => {
  it("maps a point probe to labeled values and derived diagnostics", () => {
    const probe = buildProbeResult(frame, { row: 1, column: 1, mode: "point" });

    expect(probe).toMatchObject({
      row: 1,
      column: 1,
      xMeters: 150,
      zMeters: 75,
      mode: "point",
    });

    const diagnostics = probe?.diagnostics ?? [];
    expect(diagnostics.map((diagnostic) => diagnostic.label)).toEqual([
      "Temperature",
      "Relative humidity",
      "Water vapor",
      "Cloud liquid water",
      "Horizontal velocity",
      "Vertical velocity",
      "Approx. buoyancy",
    ]);
    expect(diagnostics.find((diagnostic) => diagnostic.key === "temperature_k")).toMatchObject({
      formattedValue: "26.85",
      unit: "deg C",
      source: "field",
    });
    expect(diagnostics.find((diagnostic) => diagnostic.key === "relative_humidity")).toMatchObject({
      unit: "%",
      source: "derived",
      truth: { category: "derived_diagnostic", label: "Derived diagnostic" },
    });
    expect(diagnostics.find((diagnostic) => diagnostic.key === "buoyancy_m_per_s2")).toMatchObject({
      unit: "m s-2",
      source: "derived",
      truth: { category: "derived_diagnostic", label: "Derived diagnostic" },
    });
  });

  it("labels microphysics lab vertical velocity as prescribed forcing", () => {
    const diagnostics = buildProbeDiagnostics(
      { ...frame, config: { solver_type: "microphysics_lab" } as SimulationFrame["config"] },
      { row: 1, column: 1, mode: "point" },
    );

    expect(diagnostics.find((diagnostic) => diagnostic.key === "vertical_velocity_m_per_s"))
      .toMatchObject({
        source: "field",
        truth: { category: "prescribed_forcing", label: "Prescribed forcing" },
      });
  });

  it("averages a 3x3 neighborhood probe", () => {
    const diagnostics = buildProbeDiagnostics(frame, { row: 1, column: 1, mode: "neighborhood" });

    expect(
      diagnostics.find((diagnostic) => diagnostic.key === "cloud_liquid_water_kg_per_kg")?.value,
    ).toBeCloseTo(0.0011111111111111111);
    expect(diagnostics.find((diagnostic) => diagnostic.key === "horizontal_velocity_m_per_s"))
      .toMatchObject({
        value: 2,
      });
  });

  it("degrades gracefully when optional fields are missing", () => {
    const frameWithoutDiagnostics: SimulationFrame = {
      ...frame,
      fields: {
        temperature_k: frame.fields.temperature_k,
        water_vapor_kg_per_kg: frame.fields.water_vapor_kg_per_kg,
      },
    };

    const diagnostics = buildProbeDiagnostics(frameWithoutDiagnostics, {
      row: 1,
      column: 1,
      mode: "point",
    });

    expect(diagnostics.find((diagnostic) => diagnostic.key === "cloud_liquid_water_kg_per_kg"))
      .toMatchObject({
        formattedValue: "Not emitted",
        source: "missing",
      });
    expect(diagnostics.find((diagnostic) => diagnostic.key === "buoyancy_m_per_s2")).toMatchObject({
      formattedValue: "Not emitted",
      source: "missing",
    });
  });
});

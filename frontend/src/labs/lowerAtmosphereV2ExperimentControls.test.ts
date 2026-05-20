import { describe, expect, it } from "vitest";

import {
  buildLowerAtmosphereV2ProfileConfig,
  defaultLowerAtmosphereV2IngredientSelections,
  lowerAtmosphereV2IngredientControls,
  lowerAtmosphereV2IngredientSetupModified,
  lowerAtmosphereV2SelectedIngredientRows,
  type LowerAtmosphereV2IngredientSelections,
} from "./lowerAtmosphereV2ExperimentControls";
import { lowerAtmosphereV2ScenarioContracts } from "./lowerAtmosphereV2Scenarios";

const baselineContract = lowerAtmosphereV2ScenarioContracts[0];

describe("Lower Atmosphere v2 experiment controls", () => {
  it("defines the seven required user-facing ingredient controls", () => {
    expect(lowerAtmosphereV2IngredientControls.map((control) => control.label)).toEqual([
      "Lower-atmosphere humidity",
      "Surface moisture",
      "Surface heating",
      "Cap strength",
      "Cap height",
      "Dry air above cloud layer",
      "Mixing with dry air",
    ]);
    expect(lowerAtmosphereV2IngredientControls.map((control) => control.profileControlKey)).toEqual([
      "initial_relative_humidity",
      "surface_moisture_flux_strength",
      "surface_heating_strength",
      "inversion_strength_k",
      "inversion_height_m",
      "free_atmosphere_relative_humidity",
      "entrainment_strength",
    ]);
  });

  it("maps baseline selections to the reference-backed shallow-cloud defaults", () => {
    const selections = defaultLowerAtmosphereV2IngredientSelections(baselineContract);
    const config = buildLowerAtmosphereV2ProfileConfig(baselineContract, selections);

    expect(config.initial_relative_humidity).toBe(0.85);
    expect(config.surface_moisture_flux_strength).toBe(1);
    expect(config.surface_heating_strength).toBe(0.72);
    expect(config.inversion_height_m).toBe(1_900);
    expect(config.inversion_strength_k).toBe(1.5);
    expect(config.free_atmosphere_relative_humidity).toBe(0.7);
    expect(config.entrainment_strength).toBe(0.22);
    expect(lowerAtmosphereV2IngredientSetupModified(baselineContract, selections)).toBe(false);
  });

  it("updates profile controls from relative presets without exposing lift controls", () => {
    const selections: LowerAtmosphereV2IngredientSelections = {
      ...defaultLowerAtmosphereV2IngredientSelections(baselineContract),
      lowerAtmosphereHumidity: "drier",
      surfaceMoisture: "low",
      surfaceHeating: "stronger",
      capStrength: "strong",
      capHeight: "lower",
      dryAirAbove: "drier",
      dryAirMixing: "stronger",
    };
    const config = buildLowerAtmosphereV2ProfileConfig(baselineContract, selections);

    expect(config.initial_relative_humidity).toBe(0.58);
    expect(config.surface_moisture_flux_strength).toBe(0.22);
    expect(config.surface_heating_strength).toBe(0.75);
    expect(config.inversion_strength_k).toBe(6);
    expect(config.inversion_height_m).toBe(850);
    expect(config.free_atmosphere_relative_humidity).toBe(0.12);
    expect(config.entrainment_strength).toBe(0.82);
    expect(JSON.stringify(lowerAtmosphereV2IngredientControls)).not.toContain("lift_duration_seconds");
    expect(JSON.stringify(lowerAtmosphereV2IngredientControls)).not.toContain("updraft_strength_m_per_s");
    expect(lowerAtmosphereV2IngredientSetupModified(baselineContract, selections)).toBe(true);
  });

  it("reports current and scenario-default labels for model details", () => {
    const selections: LowerAtmosphereV2IngredientSelections = {
      ...defaultLowerAtmosphereV2IngredientSelections(baselineContract),
      lowerAtmosphereHumidity: "drier",
    };
    const rows = lowerAtmosphereV2SelectedIngredientRows(baselineContract, selections);

    expect(rows).toContainEqual({
      label: "Lower-atmosphere humidity",
      current: "Drier",
      defaultValue: "Baseline",
      group: "Moisture",
    });
  });

  it("does not mutate scenario contract defaults while building tweaked configs", () => {
    const before = JSON.stringify(baselineContract.configDefaults.profileControls);
    const selections: LowerAtmosphereV2IngredientSelections = {
      ...defaultLowerAtmosphereV2IngredientSelections(baselineContract),
      capStrength: "strong",
    };

    buildLowerAtmosphereV2ProfileConfig(baselineContract, selections);

    expect(JSON.stringify(baselineContract.configDefaults.profileControls)).toBe(before);
  });
});

import { describe, expect, it, vi } from "vitest";

import type { BoundaryLayer1DFrame, BoundaryLayer1DRun } from "./evolvingBoundaryLayer";
import { lowerAtmosphereV2ScenarioContracts } from "./lowerAtmosphereV2Scenarios";
import {
  createInitialLowerAtmosphereV2State,
  lowerAtmosphereV2ObservedCloudStatus,
  lowerAtmosphereV2ProfileFrames,
  profileToCloudColumnConfig,
  runLowerAtmosphereV2Flow,
  selectLowerAtmosphereV2ProfileFrame,
  type CloudColumnRun,
  type LowerAtmosphereV2Client,
} from "./lowerAtmosphereV2Orchestration";

const baselineContract = lowerAtmosphereV2ScenarioContracts[0];

describe("Lower Atmosphere v2 orchestration", () => {
  it("runs atmosphere-only flow through boundary_layer_1d and does not call cloud-column", async () => {
    const client = mockClient(sampleProfileRun(), sampleCloudRun("cloud_formed"));

    const result = await runLowerAtmosphereV2Flow(
      createInitialLowerAtmosphereV2State(baselineContract.id),
      "atmosphere_evolution",
      client,
    );

    expect(client.runProfile).toHaveBeenCalledOnce();
    expect(client.runCloudColumn).not.toHaveBeenCalled();
    expect(result.profileStatus).toBe("complete");
    expect(result.cloudColumnStatus).toBe("ready");
    expect(lowerAtmosphereV2ProfileFrames(result)).toHaveLength(3);
    expect(result.selectedProfileFrameIndex).toBe(2);
  });

  it("runs lifted-cloud-only flow through controlled_cloud_column without a profile API call", async () => {
    const client = mockClient(sampleProfileRun(), sampleCloudRun("cloud_formed"));

    const result = await runLowerAtmosphereV2Flow(
      createInitialLowerAtmosphereV2State(baselineContract.id),
      "lifted_cloud",
      client,
    );

    expect(client.runProfile).not.toHaveBeenCalled();
    expect(client.runCloudColumn).toHaveBeenCalledOnce();
    expect(result.cloudColumnStatus).toBe("complete");
    expect(result.cloudColumnProvenance?.source_model).toBe("boundary_layer_1d");
    expect(result.cloudColumnProvenance?.source_profile_kind).toBe("default_profile");
    expect(lowerAtmosphereV2ObservedCloudStatus(result)).toBe("cloud_formed");
  });

  it("runs combined flow through profile evolution and then prescribed cloud-column lift", async () => {
    const client = mockClient(sampleProfileRun(), sampleCloudRun("cloud_formed"));

    const result = await runLowerAtmosphereV2Flow(
      createInitialLowerAtmosphereV2State(baselineContract.id),
      "evolution_lifted_cloud",
      client,
    );

    expect(client.runProfile).toHaveBeenCalledOnce();
    expect(client.runCloudColumn).toHaveBeenCalledOnce();
    expect(result.profileStatus).toBe("complete");
    expect(result.cloudColumnStatus).toBe("complete");
    expect(result.selectedProfileFrameIndex).toBe(2);
    expect(result.cloudColumnProvenance).toMatchObject({
      source_model: "boundary_layer_1d",
      source_frame_time_seconds: 7_200,
      source_time_hours_from_sunrise: 2,
      source_scenario_id: baselineContract.id,
    });
  });

  it("lets users select a different evolved profile time before prescribed lift", async () => {
    const stateWithProfile = await runLowerAtmosphereV2Flow(
      createInitialLowerAtmosphereV2State(baselineContract.id),
      "atmosphere_evolution",
      mockClient(sampleProfileRun(), sampleCloudRun("cloud_formed")),
    );
    const firstFrameSelected = selectLowerAtmosphereV2ProfileFrame(stateWithProfile, 0);
    const client = mockClient(sampleProfileRun(), sampleCloudRun("dry_failed"));

    const result = await runLowerAtmosphereV2Flow(firstFrameSelected, "lifted_cloud", client);

    expect(result.cloudColumnProvenance?.source_frame_time_seconds).toBe(0);
    expect(result.cloudColumnProvenance?.source_time_hours_from_sunrise).toBe(0);
    expect(client.runCloudColumn).toHaveBeenCalledWith(
      expect.objectContaining({
        model_type: "controlled_cloud_column",
        profile: expect.objectContaining({ z_m: sampleFrame(0).z_m }),
      }),
    );
  });

  it("fails clearly when profile evolution returns no usable frames", async () => {
    const client = mockClient({ ...sampleProfileRun(), frames: [] }, sampleCloudRun("cloud_formed"));

    const result = await runLowerAtmosphereV2Flow(
      createInitialLowerAtmosphereV2State(baselineContract.id),
      "evolution_lifted_cloud",
      client,
    );

    expect(result.profileStatus).toBe("error");
    expect(result.cloudColumnStatus).toBe("ready");
    expect(result.message).toContain("no usable frames");
    expect(client.runCloudColumn).not.toHaveBeenCalled();
  });

  it("converts profile frames to cloud-column config with provenance and no Boussinesq coupling", () => {
    const { config, provenance } = profileToCloudColumnConfig(sampleFrame(1), baselineContract);

    expect(config.model_type).toBe("controlled_cloud_column");
    expect(config.profile.z_m).toHaveLength(5);
    expect(config.profile.relative_humidity_percent).toHaveLength(5);
    expect(config.forcing.updraft_strength_m_per_s).toBe(1.4);
    expect(provenance).toMatchObject({
      source_model: "boundary_layer_1d",
      source_frame_time_seconds: 3_600,
      source_time_hours_from_sunrise: 1,
      source_scenario_id: baselineContract.id,
    });
    expect(JSON.stringify(config)).not.toContain("boussinesq");
  });

  it("rejects missing profile fields before calling cloud-column", async () => {
    const brokenRun = {
      ...sampleProfileRun(),
      frames: [{ ...sampleFrame(0), temperature_k: [] }],
    };
    const client = mockClient(brokenRun, sampleCloudRun("cloud_formed"));

    const result = await runLowerAtmosphereV2Flow(
      createInitialLowerAtmosphereV2State(baselineContract.id),
      "evolution_lifted_cloud",
      client,
    );

    expect(result.profileStatus).toBe("error");
    expect(result.message).toContain("no usable frames");
    expect(client.runCloudColumn).not.toHaveBeenCalled();
  });
});

function mockClient(profileRun: BoundaryLayer1DRun, cloudRun: CloudColumnRun): LowerAtmosphereV2Client {
  return {
    runProfile: vi.fn().mockResolvedValue(profileRun),
    runCloudColumn: vi.fn().mockResolvedValue(cloudRun),
  };
}

function sampleProfileRun(): BoundaryLayer1DRun {
  return {
    schema_version: "profile-run-v1",
    config: createInitialLowerAtmosphereV2State(baselineContract.id).profileConfig,
    frames: [sampleFrame(0), sampleFrame(1), sampleFrame(2, "cloud_favorable")],
  };
}

function sampleFrame(
  index: number,
  status: BoundaryLayer1DFrame["diagnostics"]["cloud_formation_potential_status"] = "moisture_limited",
): BoundaryLayer1DFrame {
  return {
    schema_version: "profile-frame-v1",
    step: index,
    time_seconds: index * 3_600,
    time_hours_from_sunrise: index,
    model_type: "boundary_layer_1d",
    z_m: [0, 500, 1_000, 1_500, 2_000],
    temperature_k: [293, 290, 287, 284, 281].map((value) => value + index),
    water_vapor_kg_per_kg: [0.012, 0.011, 0.009, 0.006, 0.004],
    relative_humidity_percent: [82, 80, 74, 58, 42],
    mixed_layer_depth_m: 450 + index * 100,
    lcl_m: 900,
    inversion_height_m: 1_800,
    inversion_strength_k: 1.5,
    surface_heating_accumulated_k: index,
    surface_moisture_added_kg_per_kg: index * 0.0002,
    entrainment_drying_proxy: index * 0.00001,
    diagnostics: {
      cloud_formation_potential_status: status,
      cloud_formation_potential_reason: "Deterministic profile diagnostic.",
      mixed_layer_lcl_difference_m: 450 + index * 100 - 900,
      rh_near_mixed_layer_top_percent: 70,
      max_relative_humidity_percent: 88,
      cap_suppression_index: 0,
      heating_limited: false,
      moisture_limited: status === "moisture_limited",
      cap_limited: false,
      dry_entrainment_limited: false,
    },
  };
}

function sampleCloudRun(status: CloudColumnRun["diagnostics"]["cloud_formation_status"]): CloudColumnRun {
  const { config } = profileToCloudColumnConfig(sampleFrame(2), baselineContract);
  return {
    schema_version: "cloud-column-run-v1",
    config,
    frames: [
      sampleCloudFrame(0, 0),
      sampleCloudFrame(60, status === "cloud_formed" ? 2e-6 : 0),
    ],
    diagnostics: {
      cloud_formation_status: status,
      cloud_formation_reason: "Deterministic cloud-column diagnostic.",
      first_saturation_time_seconds: status === "cloud_formed" ? 60 : null,
      first_cloud_time_seconds: status === "cloud_formed" ? 60 : null,
      cloud_base_m: status === "cloud_formed" ? 120 : null,
      cloud_top_proxy_m: status === "cloud_formed" ? 180 : null,
      max_relative_humidity_percent: 101,
      max_cloud_liquid_water_kg_per_kg: status === "cloud_formed" ? 2e-6 : 0,
      water_budget: {
        initial_total_water_kg_per_kg: 0.012,
        final_total_water_kg_per_kg: 0.012,
        max_absolute_drift_kg_per_kg: 0,
        total_condensed_kg_per_kg: status === "cloud_formed" ? 2e-6 : 0,
        total_evaporated_kg_per_kg: 0,
      },
      forcing: {
        forcing_type: "prescribed_lift",
        dynamics_label: "prescribed, not predicted",
        updraft_strength_m_per_s: 1.4,
        lift_duration_seconds: 1_200,
        entrainment_drying_factor: 0,
        heating_tendency_k_per_s: 0,
      },
    },
  };
}

function sampleCloudFrame(timeSeconds: number, cloudWater: number) {
  return {
    schema_version: "cloud-column-frame-v1" as const,
    step: timeSeconds / 60,
    time_seconds: timeSeconds,
    model_type: "controlled_cloud_column" as const,
    parcel_height_m: timeSeconds * 0.5,
    temperature_k: 292,
    water_vapor_kg_per_kg: 0.012,
    relative_humidity_percent: cloudWater > 0 ? 101 : 90,
    cloud_liquid_water_kg_per_kg: cloudWater,
    condensation_rate_proxy_kg_per_kg_s: cloudWater / Math.max(1, timeSeconds),
    evaporation_rate_proxy_kg_per_kg_s: 0,
    prescribed_lift_m_per_s: 1.4,
  };
}

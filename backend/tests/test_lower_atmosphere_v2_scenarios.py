from __future__ import annotations

from app.sim.cloud_column import run_cloud_column
from app.sim.cloud_column_schemas import CloudColumnConfig, CloudColumnProfile, CloudColumnRun
from app.sim.lower_atmosphere_v2_scenarios import (
    LOWER_ATMOSPHERE_V2_HONESTY_LABELS,
    LowerAtmosphereV2ScenarioContract,
    lower_atmosphere_v2_comparison_pairs,
    lower_atmosphere_v2_scenario_contracts,
)
from app.sim.profile_1d import run_profile
from app.sim.profile_schemas import BoundaryLayer1DRun

REQUIRED_SCENARIO_IDS = [
    "lower-atmosphere-v2-baseline-shallow-cloud",
    "lower-atmosphere-v2-dry-failed-cumulus",
    "lower-atmosphere-v2-capped-suppressed-cloud",
    "lower-atmosphere-v2-moist-surface-enables-cloud",
    "lower-atmosphere-v2-dry-entrainment-suppresses-cloud",
    "lower-atmosphere-v2-heating-lift-comparison",
    "lower-atmosphere-v2-humid-low-cloud-contrast",
    "lower-atmosphere-v2-rain-capable-warm-cloud-later",
]


def test_lower_atmosphere_v2_defines_required_scenario_contracts() -> None:
    scenarios = lower_atmosphere_v2_scenario_contracts()

    assert [scenario.id for scenario in scenarios] == REQUIRED_SCENARIO_IDS
    for scenario in scenarios:
        assert scenario.name
        assert scenario.short_description
        assert "?" in scenario.physical_question
        assert set(scenario.flow_modes) == {
            "atmosphere_evolution",
            "lifted_cloud",
            "evolution_lifted_cloud",
        }
        assert scenario.profile_config_defaults.model_type == "boundary_layer_1d"
        assert scenario.cloud_column_config_defaults.model_type == "controlled_cloud_column"
        assert scenario.expected_profile_status
        assert scenario.expected_cloud_column_status
        assert scenario.expected_precipitation_status
        assert scenario.key_diagnostics
        assert scenario.teaching_purpose
        assert scenario.comparison_suggestions
        assert scenario.known_limitations
        assert set(LOWER_ATMOSPHERE_V2_HONESTY_LABELS).issubset(scenario.honesty_labels)


def test_lower_atmosphere_v2_keeps_boussinesq_out_of_default_engine_contract() -> None:
    scenarios = lower_atmosphere_v2_scenario_contracts()

    for scenario in scenarios:
        assert str(scenario.profile_config_defaults.model_type) != "boussinesq_2d"
        assert str(scenario.cloud_column_config_defaults.model_type) != "boussinesq_2d"
        assert "Boussinesq" not in scenario.teaching_purpose


def test_lower_atmosphere_v2_rain_capable_scenario_is_later_not_implemented() -> None:
    scenario = next(
        scenario
        for scenario in lower_atmosphere_v2_scenario_contracts()
        if scenario.id == "lower-atmosphere-v2-rain-capable-warm-cloud-later"
    )

    assert scenario.expected_precipitation_status == "precipitation_not_enabled"
    assert any(
        "Precipitation diagnostics are not enabled" in item for item in scenario.known_limitations
    )
    assert any("No PySDM" in item for item in scenario.known_limitations)


def test_lower_atmosphere_v2_comparison_pairs_reference_valid_scenarios() -> None:
    scenarios = lower_atmosphere_v2_scenario_contracts()
    scenario_ids = {scenario.id for scenario in scenarios}
    pairs = lower_atmosphere_v2_comparison_pairs()

    assert [pair.id for pair in pairs] == [
        "baseline-vs-dry-failed",
        "baseline-vs-capped-suppressed",
        "dry-surface-vs-moist-surface",
        "weak-heating-vs-strong-heating",
        "weak-lift-vs-strong-lift",
        "weak-entrainment-vs-dry-entrainment",
        "baseline-vs-humid-low-cloud-contrast",
        "cloud-formed-vs-rain-capable-later",
    ]
    for pair in pairs:
        assert pair.left_scenario_id in scenario_ids
        assert pair.right_scenario_id in scenario_ids
        assert "?" in pair.question_answered
        assert pair.expected_difference
        assert pair.diagnostics_to_compare


def test_dry_failed_cumulus_default_combined_flow_stays_cloud_free() -> None:
    scenario = _scenario("lower-atmosphere-v2-dry-failed-cumulus")
    profile_run, cloud_run = _run_combined_contract(scenario)

    selected_frame = profile_run.frames[-1]
    assert selected_frame.diagnostics.cloud_formation_potential_status == "moisture_limited"
    assert cloud_run.diagnostics.cloud_formation_status in {"dry_failed", "lift_too_weak"}
    assert cloud_run.diagnostics.max_cloud_liquid_water_kg_per_kg <= 1.0e-12
    assert cloud_run.diagnostics.first_cloud_time_seconds is None


def _scenario(scenario_id: str) -> LowerAtmosphereV2ScenarioContract:
    return next(
        scenario
        for scenario in lower_atmosphere_v2_scenario_contracts()
        if scenario.id == scenario_id
    )


def _run_combined_contract(
    scenario: LowerAtmosphereV2ScenarioContract,
) -> tuple[BoundaryLayer1DRun, CloudColumnRun]:
    profile_run = run_profile(scenario.profile_config_defaults)
    selected_frame = profile_run.frames[-1]
    column_defaults = scenario.cloud_column_config_defaults
    cloud_config = CloudColumnConfig(
        profile=CloudColumnProfile(
            z_m=selected_frame.z_m,
            temperature_k=selected_frame.temperature_k,
            water_vapor_kg_per_kg=selected_frame.water_vapor_kg_per_kg,
            relative_humidity_percent=selected_frame.relative_humidity_percent,
            surface_pressure_pa=101_325.0,
            mixed_layer_depth_m=selected_frame.mixed_layer_depth_m,
            lcl_m=selected_frame.lcl_m,
            inversion_height_m=selected_frame.inversion_height_m,
            inversion_strength_k=selected_frame.inversion_strength_k,
        ),
        forcing=column_defaults.forcing,
        seed=scenario.profile_config_defaults.seed,
    )
    return profile_run, run_cloud_column(cloud_config)

from __future__ import annotations

from app.sim.lower_atmosphere_v2_scenarios import (
    LOWER_ATMOSPHERE_V2_HONESTY_LABELS,
    lower_atmosphere_v2_comparison_pairs,
    lower_atmosphere_v2_scenario_contracts,
)

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

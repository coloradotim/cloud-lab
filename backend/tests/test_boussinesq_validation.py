from dataclasses import dataclass
from typing import Literal

import pytest

from app.sim import (
    DIVERGENCE_VELOCITY_FLOOR_M_PER_S,
    BackgroundWindConfig,
    BoussinesqReferenceCase,
    DomainConfig,
    GridConfig,
    HumidityLayerConfig,
    InitialAtmosphereConfig,
    SurfaceHeatingConfig,
    TimeConfig,
    boussinesq_model_sizes,
    boussinesq_reference_cases,
    boussinesq_stabilizer_audit_cases,
    boussinesq_stabilizer_audit_variants,
    boussinesq_thermodynamic_validation_cases,
    compute_boussinesq_diagnostics,
    compute_boussinesq_thermodynamic_diagnostics,
    compute_cloud_region_diagnostics,
    compute_cloud_water_persistence_diagnostics,
    compute_divergence_field,
    fair_weather_cumulus_preset,
    lower_atmosphere_sensitivity_scenarios,
    lower_atmosphere_sensitivity_variants,
    run_boussinesq_scenario_validation,
    run_boussinesq_stabilizer_audit,
    run_boussinesq_thermodynamic_validation,
    run_lower_atmosphere_sensitivity_validation,
    run_simulation,
)
from app.sim.schemas import SimulationConfig, SimulationFrame

pytestmark = [
    pytest.mark.boussinesq,
    pytest.mark.science,
    pytest.mark.slow,
    pytest.mark.validation,
]

MAX_REFERENCE_DIVERGENCE_PER_SECOND = 2e-3
MEAN_REFERENCE_DIVERGENCE_PER_SECOND = 2e-5
MAX_ACTIVE_DIMENSIONLESS_DIVERGENCE = 5e-2
RMS_ACTIVE_DIMENSIONLESS_DIVERGENCE = 1e-2
QUIET_MAX_DIVERGENCE_PER_SECOND = 1e-6
QUIET_MAX_VELOCITY_M_PER_S = 1e-3
MAX_REFERENCE_CLOUD_WATER_KG_PER_KG = 0.008
MAX_DEEP_REFERENCE_VELOCITY_M_PER_S = 6.0
MAX_DEEP_REFERENCE_CLOUD_WATER_KG_PER_KG = 0.011
BEHAVIOR_CLOUD_THRESHOLD_KG_PER_KG = 1e-5


@dataclass(frozen=True)
class SuppressionMetrics:
    max_abs_vertical_velocity_m_per_s: float
    cloud_top_height_m: float | None
    max_cloud_liquid_water_kg_per_kg: float
    total_cloud_water_kg_per_kg: float
    first_cloud_time_seconds: float | None
    first_cloud_height_m: float | None


def test_boussinesq_reference_cases_map_to_valid_configs() -> None:
    cases = boussinesq_reference_cases()

    assert {case.slug for case in cases} == {
        "quiet-atmosphere",
        "dry-thermal-bubble",
        "isolated-fair-weather-cumulus",
        "humid-cloud-deck",
        "deep-convection-candidate",
    }
    for case in cases:
        assert isinstance(case.config, SimulationConfig)
        assert case.config.solver_type == "boussinesq_2d"


def test_boussinesq_model_sizes_map_to_valid_configs() -> None:
    base = boussinesq_reference_cases()[0].config

    assert {size.slug for size in boussinesq_model_sizes()} == {"small", "medium", "large"}
    for size in boussinesq_model_sizes():
        sized_config = base.model_copy(update=size.config_updates)
        assert sized_config.grid.columns > 1
        assert sized_config.grid.rows > 1
        assert sized_config.time.duration_seconds >= sized_config.time.time_step_seconds
        assert sized_config.time.frame_interval_seconds >= sized_config.time.time_step_seconds
        assert (
            sized_config.initial_atmosphere.boundary_layer_depth_m <= sized_config.domain.height_m
        )


def test_boussinesq_reference_cases_remain_finite_and_moisture_safe() -> None:
    for case in boussinesq_reference_cases():
        final = run_simulation(case.config)[-1]
        diagnostics = compute_boussinesq_diagnostics(final)

        assert diagnostics.non_finite_value_count == 0
        assert diagnostics.min_moisture_kg_per_kg >= 0.0
        if case.expected_regime == "deep_candidate":
            assert diagnostics.max_abs_horizontal_velocity_m_per_s < (
                MAX_DEEP_REFERENCE_VELOCITY_M_PER_S
            )
            assert (
                diagnostics.max_abs_vertical_velocity_m_per_s < MAX_DEEP_REFERENCE_VELOCITY_M_PER_S
            )
            assert diagnostics.max_cloud_liquid_water_kg_per_kg <= (
                MAX_DEEP_REFERENCE_CLOUD_WATER_KG_PER_KG
            )
        else:
            assert diagnostics.max_abs_horizontal_velocity_m_per_s < 1.0
            assert diagnostics.max_abs_vertical_velocity_m_per_s < 1.0
            assert diagnostics.max_cloud_liquid_water_kg_per_kg < (
                MAX_REFERENCE_CLOUD_WATER_KG_PER_KG
            )
        assert diagnostics.max_abs_divergence_per_second < MAX_REFERENCE_DIVERGENCE_PER_SECOND
        assert diagnostics.mean_abs_divergence_per_second < MEAN_REFERENCE_DIVERGENCE_PER_SECOND
        assert diagnostics.rms_divergence_per_second >= diagnostics.mean_abs_divergence_per_second
        assert diagnostics.max_velocity_m_per_s >= diagnostics.mean_velocity_m_per_s
        assert diagnostics.max_dimensionless_divergence >= diagnostics.rms_dimensionless_divergence


def test_boussinesq_diagnostics_include_dimensionless_divergence() -> None:
    dry = _case("dry-thermal-bubble")

    final = run_simulation(dry.config)[-1]
    diagnostics = compute_boussinesq_diagnostics(final)
    length_scale_m = min(
        final.config.domain.width_m / final.grid.columns,
        final.config.domain.height_m / final.grid.rows,
    )
    velocity_scale = max(diagnostics.max_velocity_m_per_s, DIVERGENCE_VELOCITY_FLOOR_M_PER_S)

    assert diagnostics.rms_divergence_per_second > 0.0
    assert diagnostics.max_dimensionless_divergence == pytest.approx(
        diagnostics.max_abs_divergence_per_second * length_scale_m / velocity_scale
    )
    assert diagnostics.rms_dimensionless_divergence == pytest.approx(
        diagnostics.rms_divergence_per_second * length_scale_m / velocity_scale
    )


def test_boussinesq_divergence_field_matches_frame_shape() -> None:
    dry = _case("dry-thermal-bubble")

    final = run_simulation(dry.config)[-1]
    divergence = compute_divergence_field(final)

    assert len(divergence) == final.grid.rows
    assert all(len(row) == final.grid.columns for row in divergence)


def test_quiet_boussinesq_divergence_does_not_grow() -> None:
    quiet = _case("quiet-atmosphere")

    frames = run_simulation(quiet.config)
    max_divergence_by_frame = [
        compute_boussinesq_diagnostics(frame).max_abs_divergence_per_second for frame in frames
    ]

    assert max(max_divergence_by_frame) == 0.0
    assert max_divergence_by_frame[-1] == max_divergence_by_frame[0]


def test_quiet_boussinesq_divergence_and_velocity_stay_below_dimensional_ceilings() -> None:
    quiet = _case("quiet-atmosphere")

    diagnostics = compute_boussinesq_diagnostics(run_simulation(quiet.config)[-1])

    assert diagnostics.max_abs_divergence_per_second < QUIET_MAX_DIVERGENCE_PER_SECOND
    assert diagnostics.max_velocity_m_per_s < QUIET_MAX_VELOCITY_M_PER_S


def test_quiet_boussinesq_reference_case_remains_quiet() -> None:
    quiet = _case("quiet-atmosphere")

    diagnostics = compute_boussinesq_diagnostics(run_simulation(quiet.config)[-1])

    assert diagnostics.max_abs_horizontal_velocity_m_per_s == 0.0
    assert diagnostics.max_abs_vertical_velocity_m_per_s == 0.0
    assert diagnostics.max_velocity_m_per_s == 0.0
    assert diagnostics.mean_velocity_m_per_s == 0.0
    assert diagnostics.max_temperature_perturbation_k == 0.0
    assert diagnostics.min_temperature_perturbation_k == 0.0
    assert diagnostics.max_cloud_liquid_water_kg_per_kg == 0.0


@pytest.mark.parametrize(
    "case_slug",
    ["dry-thermal-bubble", "isolated-fair-weather-cumulus", "humid-cloud-deck"],
)
def test_active_boussinesq_reference_cases_meet_dimensionless_divergence_gates(
    case_slug: str,
) -> None:
    case = _case(case_slug)

    diagnostics = compute_boussinesq_diagnostics(run_simulation(case.config)[-1])

    assert diagnostics.rms_dimensionless_divergence < RMS_ACTIVE_DIMENSIONLESS_DIVERGENCE
    assert diagnostics.max_dimensionless_divergence < MAX_ACTIVE_DIMENSIONLESS_DIVERGENCE


@pytest.mark.parametrize(
    "case_slug",
    ["dry-thermal-bubble", "isolated-fair-weather-cumulus", "humid-cloud-deck"],
)
def test_active_boussinesq_interior_divergence_still_meets_gates(case_slug: str) -> None:
    case = _case(case_slug)
    final = run_simulation(case.config)[-1]
    divergence = compute_divergence_field(final)
    diagnostics = compute_boussinesq_diagnostics(final)
    length_scale_m = min(
        final.config.domain.width_m / final.grid.columns,
        final.config.domain.height_m / final.grid.rows,
    )
    velocity_scale = max(diagnostics.max_velocity_m_per_s, DIVERGENCE_VELOCITY_FLOOR_M_PER_S)
    interior_divergence = [
        divergence[row_index][column_index]
        for row_index in range(1, final.grid.rows - 1)
        for column_index in range(1, final.grid.columns - 1)
    ]
    interior_rms = (
        sum(value * value for value in interior_divergence) / len(interior_divergence)
    ) ** 0.5
    interior_max = max(abs(value) for value in interior_divergence)

    assert interior_rms * length_scale_m / velocity_scale < RMS_ACTIVE_DIMENSIONLESS_DIVERGENCE
    assert interior_max * length_scale_m / velocity_scale < MAX_ACTIVE_DIMENSIONLESS_DIVERGENCE


def test_dry_boussinesq_reference_case_lifts_without_cloud_water() -> None:
    dry = _case("dry-thermal-bubble")

    diagnostics = compute_boussinesq_diagnostics(run_simulation(dry.config)[-1])

    assert diagnostics.max_abs_vertical_velocity_m_per_s > 0.05
    assert diagnostics.max_temperature_perturbation_k > 1.0
    assert diagnostics.max_cloud_liquid_water_kg_per_kg == 0.0


def test_isolated_boussinesq_reference_case_creates_bounded_cloud_water() -> None:
    humid = _case("isolated-fair-weather-cumulus")

    diagnostics = compute_boussinesq_diagnostics(run_simulation(humid.config)[-1])

    assert diagnostics.max_abs_vertical_velocity_m_per_s > 0.05
    assert diagnostics.max_cloud_liquid_water_kg_per_kg > 1e-5
    assert diagnostics.total_cloud_liquid_water_kg_per_kg > 0.0
    assert diagnostics.cloud_top_height_m is not None
    assert diagnostics.max_cloud_liquid_water_height_m is not None


def test_two_hot_patch_case_keeps_separate_cloud_cells_before_merger() -> None:
    case = _case("isolated-fair-weather-cumulus")
    frames = run_simulation(case.config)
    early = _frame_at(frames, 120.0)
    developing = _frame_at(frames, 480.0)
    two_cell_frame = _frame_at(frames, 1110.0)

    assert _cloud_coverage(early, BEHAVIOR_CLOUD_THRESHOLD_KG_PER_KG) == 0.0
    assert _cloud_coverage(developing, BEHAVIOR_CLOUD_THRESHOLD_KG_PER_KG) == 0.0
    regions = compute_cloud_region_diagnostics(
        two_cell_frame,
        threshold_kg_per_kg=BEHAVIOR_CLOUD_THRESHOLD_KG_PER_KG,
    )

    assert regions.region_count == 2
    assert _cloud_coverage(two_cell_frame, BEHAVIOR_CLOUD_THRESHOLD_KG_PER_KG) < 0.08


@pytest.mark.xfail(reason="Current prototype places peak cloud water below the BL top.")
def test_humid_boussinesq_reference_cloud_maximum_is_aloft() -> None:
    humid = _case("isolated-fair-weather-cumulus")

    diagnostics = compute_boussinesq_diagnostics(run_simulation(humid.config)[-1])

    assert diagnostics.max_cloud_liquid_water_height_m is not None
    assert diagnostics.max_cloud_liquid_water_height_m >= (
        humid.config.initial_atmosphere.boundary_layer_depth_m
    )
    assert diagnostics.cloud_top_height_m is not None
    assert diagnostics.cloud_top_height_m < humid.config.domain.height_m * 0.75


def test_humid_deck_has_more_cloud_coverage_than_isolated_cumulus() -> None:
    isolated = _case("isolated-fair-weather-cumulus")
    deck = _case("humid-cloud-deck")

    isolated_diagnostics = compute_boussinesq_thermodynamic_diagnostics(
        run_simulation(isolated.config)
    )
    deck_diagnostics = compute_boussinesq_thermodynamic_diagnostics(run_simulation(deck.config))

    assert deck_diagnostics.total_cloud_water_kg_per_kg > (
        isolated_diagnostics.total_cloud_water_kg_per_kg
    )
    assert deck_diagnostics.expected_lcl_m < isolated_diagnostics.expected_lcl_m


def test_small_and_medium_model_sizes_have_similar_qualitative_behavior() -> None:
    humid = _case("isolated-fair-weather-cumulus")
    sizes = {
        size.slug: size for size in boussinesq_model_sizes() if size.slug in {"small", "medium"}
    }

    small_config = humid.config.model_copy(update=sizes["small"].config_updates)
    medium_config = humid.config.model_copy(update=sizes["medium"].config_updates)
    small_diagnostics = compute_boussinesq_diagnostics(run_simulation(small_config)[-1])
    medium_diagnostics = compute_boussinesq_diagnostics(run_simulation(medium_config)[-1])

    for diagnostics in (small_diagnostics, medium_diagnostics):
        assert diagnostics.non_finite_value_count == 0
        assert diagnostics.min_moisture_kg_per_kg >= 0.0
        assert diagnostics.max_abs_vertical_velocity_m_per_s > 0.01
        assert diagnostics.max_cloud_liquid_water_kg_per_kg >= 0.0
        if diagnostics.max_cloud_liquid_water_height_m is not None:
            assert diagnostics.cloud_top_height_m is not None

    assert small_diagnostics.max_abs_vertical_velocity_m_per_s < 1.0
    assert medium_diagnostics.max_abs_vertical_velocity_m_per_s < 1.0


def test_reference_case_seeded_runs_are_reproducible() -> None:
    humid = _case("isolated-fair-weather-cumulus")

    first = [frame.to_transport_dict() for frame in run_simulation(humid.config)]
    second = [frame.to_transport_dict() for frame in run_simulation(humid.config)]

    assert first == second


def test_boussinesq_thermodynamic_validation_cases_report_statuses() -> None:
    report = run_boussinesq_thermodynamic_validation()

    assert report["schema_version"] == "boussinesq-thermodynamic-validation-v1"
    cases = {case["slug"]: case for case in report["cases"]}
    assert set(cases) == {
        "humid-well-mixed-fair-weather",
        "drier-well-mixed-fair-weather",
        "warmer-drier-fair-weather",
        "multi-patch-fair-weather",
        "layered-moisture-fair-weather",
    }
    assert all(case["status"] in {"pass", "warn", "fail"} for case in cases.values())


def test_boussinesq_scenario_validation_cases_report_expected_regimes() -> None:
    report = run_boussinesq_scenario_validation()

    statuses = {case["slug"]: case["status"] for case in report["cases"]}
    assert statuses["quiet-atmosphere"] == "pass"
    assert statuses["dry-thermal-bubble"] == "pass"
    assert statuses["isolated-fair-weather-cumulus"] in {"pass", "warn"}
    assert statuses["humid-cloud-deck"] in {"pass", "warn"}
    assert statuses["deep-convection-candidate"] in {"pass", "warn"}

    isolated = next(
        case for case in report["cases"] if case["slug"] == "isolated-fair-weather-cumulus"
    )["diagnostics"]
    deck = next(case for case in report["cases"] if case["slug"] == "humid-cloud-deck")[
        "diagnostics"
    ]
    deep = next(case for case in report["cases"] if case["slug"] == "deep-convection-candidate")[
        "diagnostics"
    ]

    assert 0.002 <= isolated["cloud_coverage_fraction"] <= 0.20
    assert deck["cloud_coverage_fraction"] > isolated["cloud_coverage_fraction"]
    assert (deep["cloud_top_height_m"] or 0.0) > (isolated["cloud_top_height_m"] or 0.0)


def test_lower_atmosphere_sensitivity_matrix_definitions_separate_controls() -> None:
    scenarios = lower_atmosphere_sensitivity_scenarios()

    assert [scenario.slug for scenario in scenarios] == [
        "fair-weather-moderate-base",
        "dry-failed-cumulus",
        "dry-cap-suppressed-cumulus",
    ]

    variants = lower_atmosphere_sensitivity_variants(scenarios[0].config)
    assert [(variant.axis, variant.slug) for variant in variants] == [
        ("resolution", "low"),
        ("resolution", "medium"),
        ("resolution", "high"),
        ("domain", "smaller-shallower"),
        ("domain", "default"),
        ("domain", "wider-taller"),
        ("runtime", "short"),
        ("runtime", "standard"),
        ("runtime", "long"),
    ]

    low_resolution = next(variant for variant in variants if variant.slug == "low")
    smaller_domain = next(variant for variant in variants if variant.slug == "smaller-shallower")
    short_runtime = next(variant for variant in variants if variant.slug == "short")

    assert low_resolution.config.domain == scenarios[0].config.domain
    assert low_resolution.config.time == scenarios[0].config.time
    assert low_resolution.config.grid.columns == 30
    assert smaller_domain.config.grid == scenarios[0].config.grid
    assert smaller_domain.config.time == scenarios[0].config.time
    assert smaller_domain.config.domain.width_m == 8_000
    assert short_runtime.config.domain == scenarios[0].config.domain
    assert short_runtime.config.grid == scenarios[0].config.grid
    assert short_runtime.config.time.duration_seconds == 600
    assert short_runtime.supported is False


def test_lower_atmosphere_sensitivity_validation_reports_required_matrix() -> None:
    report = run_lower_atmosphere_sensitivity_validation()

    assert report["schema_version"] == "lower-atmosphere-sensitivity-validation-v1"
    assert report["lab"] == "Lower Atmosphere Cloud Basics"
    assert report["axes"] == ["resolution", "domain", "runtime"]
    assert len(report["results"]) == 27

    results = report["results"]
    assert {
        (result["scenario_slug"], result["axis"], result["variant_slug"]) for result in results
    } == {
        (scenario.slug, variant.axis, variant.slug)
        for scenario in lower_atmosphere_sensitivity_scenarios()
        for variant in lower_atmosphere_sensitivity_variants(scenario.config)
    }

    baseline_supported = [
        result
        for result in results
        if result["scenario_slug"] == "fair-weather-moderate-base" and result["supported"]
    ]
    dry_supported = [
        result for result in results if result["scenario_slug"] == "dry-failed-cumulus"
    ]

    assert baseline_supported
    assert all(result["max_cloud_liquid_water_kg_per_kg"] > 1e-8 for result in baseline_supported)
    assert all(result["max_cloud_liquid_water_kg_per_kg"] <= 1e-8 for result in dry_supported)


def test_boussinesq_stabilizer_audit_definitions_cover_lab_scenarios() -> None:
    cases = boussinesq_stabilizer_audit_cases()
    variants = boussinesq_stabilizer_audit_variants()

    assert [case.slug for case in cases] == [
        "quiet-atmosphere",
        "dry-thermal-bubble",
        "fair-weather-moderate-base",
        "multi-thermal-cumulus-field",
        "dry-cap-suppressed-cumulus",
    ]
    assert [variant.slug for variant in variants] == [
        "default",
        "half-damping-diffusion",
        "no-top-sponge",
    ]
    assert variants[0].overrides == {}
    assert variants[1].overrides["THERMAL_DIFFUSIVITY_M2_PER_S"] > 0.0


def test_boussinesq_stabilizer_audit_reports_cap_proximity_and_sensitivity() -> None:
    report = run_boussinesq_stabilizer_audit()

    assert report["schema_version"] == "boussinesq-stabilizer-audit-v1"
    assert report["lab"] == "Lower Atmosphere Cloud Basics"
    results = report["results"]
    assert len(results) == (
        len(boussinesq_stabilizer_audit_cases()) * len(boussinesq_stabilizer_audit_variants())
    )

    default_results = [result for result in results if result["variant_slug"] == "default"]
    assert default_results
    assert all(result["max_velocity_cap_fraction"] < 0.2 for result in default_results)
    assert all(result["max_theta_cap_fraction"] <= 1.0 for result in default_results)
    assert any(result["max_theta_cap_fraction"] >= 0.5 for result in default_results)
    assert all(result["max_vorticity_cap_fraction"] < 1.0 for result in default_results)
    assert all(result["max_cloud_cap_fraction"] < 0.2 for result in default_results)
    assert any(
        "theta perturbation safety cap" in " ".join(result["notes"]) for result in default_results
    )

    baseline_variants = [
        result for result in results if result["case_slug"] == "fair-weather-moderate-base"
    ]
    assert {result["variant_slug"] for result in baseline_variants} == {
        "default",
        "half-damping-diffusion",
        "no-top-sponge",
    }
    assert all(result["status"] in {"pass", "warn", "fail"} for result in results)
    assert any(
        result["cloud_water_ratio_vs_default"] is not None
        for result in baseline_variants
        if result["variant_slug"] != "default"
    )


def test_boussinesq_thermodynamic_validation_cases_have_numeric_lcl_and_distribution() -> None:
    for case in boussinesq_thermodynamic_validation_cases():
        diagnostics = compute_boussinesq_thermodynamic_diagnostics(run_simulation(case.config))

        assert diagnostics.expected_lcl_m >= 0.0
        assert diagnostics.below_lcl_cloud_fraction >= 0.0
        assert diagnostics.near_lcl_cloud_fraction >= 0.0
        assert diagnostics.above_lcl_cloud_fraction >= 0.0
        assert diagnostics.mixed_layer.theta_spread_k >= 0.0
        assert diagnostics.cloud_regions.region_count >= 0
        assert diagnostics.status in {"pass", "warn", "fail"}


def test_drier_thermodynamic_case_has_higher_expected_lcl_than_humid_case() -> None:
    cases = {case.slug: case for case in boussinesq_thermodynamic_validation_cases()}

    humid = compute_boussinesq_thermodynamic_diagnostics(
        run_simulation(cases["humid-well-mixed-fair-weather"].config)
    )
    drier = compute_boussinesq_thermodynamic_diagnostics(
        run_simulation(cases["drier-well-mixed-fair-weather"].config)
    )
    warmer_drier = compute_boussinesq_thermodynamic_diagnostics(
        run_simulation(cases["warmer-drier-fair-weather"].config)
    )

    assert drier.expected_lcl_m > humid.expected_lcl_m
    assert warmer_drier.expected_lcl_m > humid.expected_lcl_m


def test_lapse_rate_pair_suppresses_vertical_response_and_cloud_potential() -> None:
    less_stable = _lower_atmosphere_suppression_config(lapse_rate_k_per_m=0.0075)
    stable = _lower_atmosphere_suppression_config(lapse_rate_k_per_m=0.0035)

    less_stable_metrics = _run_suppression_case(less_stable)
    stable_metrics = _run_suppression_case(stable)

    assert (
        stable_metrics.max_abs_vertical_velocity_m_per_s
        < less_stable_metrics.max_abs_vertical_velocity_m_per_s
    )
    assert stable_metrics.total_cloud_water_kg_per_kg < (
        less_stable_metrics.total_cloud_water_kg_per_kg
    )
    assert _cloud_onset_is_delayed_or_suppressed(stable_metrics, less_stable_metrics)


def test_low_strong_cap_suppresses_cloud_development_against_high_weak_cap() -> None:
    high_weak_cap = _lower_atmosphere_suppression_config(
        surface_temperature_k=300.15,
        lapse_rate_k_per_m=0.0065,
        relative_humidity=0.94,
        heating_rate_k_per_s=0.024,
        boundary_layer_depth_m=1_800.0,
        moist_source_layer_depth_m=700.0,
        humidity_layers=[
            HumidityLayerConfig(bottom_m=1_500.0, top_m=1_900.0, relative_humidity=0.70)
        ],
    )
    low_strong_cap = _lower_atmosphere_suppression_config(
        surface_temperature_k=300.15,
        lapse_rate_k_per_m=0.0065,
        relative_humidity=0.94,
        heating_rate_k_per_s=0.024,
        boundary_layer_depth_m=900.0,
        moist_source_layer_depth_m=700.0,
        humidity_layers=[
            HumidityLayerConfig(bottom_m=750.0, top_m=1_200.0, relative_humidity=0.35)
        ],
    )

    high_weak_metrics = _run_suppression_case(high_weak_cap)
    low_strong_metrics = _run_suppression_case(low_strong_cap)
    low_cap_tolerance_m = low_strong_cap.domain.height_m / low_strong_cap.grid.rows

    assert low_strong_metrics.total_cloud_water_kg_per_kg < (
        high_weak_metrics.total_cloud_water_kg_per_kg
    )
    assert low_strong_metrics.max_cloud_liquid_water_kg_per_kg < (
        high_weak_metrics.max_cloud_liquid_water_kg_per_kg
    )
    assert _cloud_onset_is_delayed_or_suppressed(low_strong_metrics, high_weak_metrics)
    assert (
        low_strong_metrics.cloud_top_height_m is None
        or low_strong_metrics.cloud_top_height_m
        <= (low_strong_cap.initial_atmosphere.boundary_layer_depth_m + low_cap_tolerance_m)
    )


def test_long_two_patch_run_reports_and_limits_subsaturated_cloud_persistence() -> None:
    config = fair_weather_cumulus_preset().config.model_copy(
        update={
            "time": TimeConfig(
                time_step_seconds=2.0,
                duration_seconds=4_800.0,
                frame_interval_seconds=120.0,
            )
        }
    )

    frames = run_simulation(config)
    dynamics = compute_boussinesq_diagnostics(frames[-1])
    thermodynamics = compute_boussinesq_thermodynamic_diagnostics(frames)
    persistence = compute_cloud_water_persistence_diagnostics(
        frames,
        expected_lcl_m=thermodynamics.expected_lcl_m,
    )

    assert dynamics.max_cloud_liquid_water_kg_per_kg > 0.0
    assert persistence.cloud_water_in_subsaturated_air_mass_fraction < 0.25
    assert persistence.cloud_water_in_subsaturated_air_cell_fraction < 0.15
    assert persistence.cloud_water_in_return_flow_fraction > 0.10
    assert persistence.cloud_water_lifetime_after_subsaturation_seconds is not None
    assert persistence.evaporation_tendency_total_kg_per_kg_per_s > 0.0
    assert persistence.subsaturated_cloud_min_height_m is not None
    assert persistence.subsaturated_cloud_max_height_m is not None
    assert any("return-flow regions" in note for note in thermodynamics.notes)
    assert any("subsaturated air" in note for note in thermodynamics.notes)


def test_layered_moisture_case_reports_non_mixed_source_layer_context() -> None:
    case = next(
        case
        for case in boussinesq_thermodynamic_validation_cases()
        if case.slug == "layered-moisture-fair-weather"
    )

    diagnostics = compute_boussinesq_thermodynamic_diagnostics(run_simulation(case.config))

    assert diagnostics.mixed_layer.well_mixed is False
    assert any("not well mixed" in note for note in diagnostics.notes)


def _case(slug: str) -> BoussinesqReferenceCase:
    return next(case for case in boussinesq_reference_cases() if case.slug == slug)


def _frame_at(frames: list[SimulationFrame], time_seconds: float) -> SimulationFrame:
    return next(frame for frame in frames if frame.time_seconds == time_seconds)


def _cloud_coverage(frame: SimulationFrame, threshold_kg_per_kg: float) -> float:
    cloud = frame.fields.cloud_liquid_water_kg_per_kg.values
    return sum(1 for row in cloud for value in row if value > threshold_kg_per_kg) / (
        frame.grid.rows * frame.grid.columns
    )


def _lower_atmosphere_suppression_config(
    *,
    surface_temperature_k: float = 298.15,
    lapse_rate_k_per_m: float,
    relative_humidity: float = 0.82,
    heating_rate_k_per_s: float = 0.018,
    boundary_layer_depth_m: float = 1_500.0,
    moist_source_layer_depth_m: float = 800.0,
    humidity_layers: list[HumidityLayerConfig] | None = None,
) -> SimulationConfig:
    preset = fair_weather_cumulus_preset().config
    humidity_profile: Literal["custom_layers", "surface_moisture"] = (
        "custom_layers" if humidity_layers else "surface_moisture"
    )
    return preset.model_copy(
        update={
            "domain": DomainConfig(width_m=10_000.0, height_m=3_000.0),
            "grid": GridConfig(columns=36, rows=24),
            "time": TimeConfig(
                time_step_seconds=2.0,
                duration_seconds=1_200.0,
                frame_interval_seconds=30.0,
            ),
            "initial_atmosphere": InitialAtmosphereConfig(
                surface_temperature_k=surface_temperature_k,
                lapse_rate_k_per_m=lapse_rate_k_per_m,
                relative_humidity=relative_humidity,
                boundary_layer_depth_m=boundary_layer_depth_m,
                moist_source_layer_depth_m=moist_source_layer_depth_m,
                free_atmosphere_relative_humidity=0.55,
                humidity_profile=humidity_profile,
                humidity_layers=humidity_layers or [],
            ),
            "surface_heating": SurfaceHeatingConfig(
                max_warming_rate_k_per_s=heating_rate_k_per_s,
                patch_center_x_m=5_000.0,
                patch_width_m=2_000.0,
                pattern="single_patch",
            ),
            "background_wind": BackgroundWindConfig(u_m_per_s=0.1, w_m_per_s=0.0),
            "seed": 31,
        }
    )


def _run_suppression_case(config: SimulationConfig) -> SuppressionMetrics:
    frames = run_simulation(config)
    dynamics = compute_boussinesq_diagnostics(frames[-1])
    thermodynamics = compute_boussinesq_thermodynamic_diagnostics(frames)
    return SuppressionMetrics(
        max_abs_vertical_velocity_m_per_s=dynamics.max_abs_vertical_velocity_m_per_s,
        cloud_top_height_m=dynamics.cloud_top_height_m,
        max_cloud_liquid_water_kg_per_kg=dynamics.max_cloud_liquid_water_kg_per_kg,
        total_cloud_water_kg_per_kg=dynamics.total_cloud_liquid_water_kg_per_kg,
        first_cloud_time_seconds=thermodynamics.first_cloud_time_seconds,
        first_cloud_height_m=thermodynamics.first_cloud_height_m,
    )


def _cloud_onset_is_delayed_or_suppressed(
    suppressed: SuppressionMetrics,
    control: SuppressionMetrics,
) -> bool:
    if control.first_cloud_time_seconds is None:
        return False
    return (
        suppressed.first_cloud_time_seconds is None
        or suppressed.first_cloud_time_seconds > control.first_cloud_time_seconds
    )

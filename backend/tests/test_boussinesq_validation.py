import pytest

from app.sim import (
    DIVERGENCE_VELOCITY_FLOOR_M_PER_S,
    BoussinesqReferenceCase,
    boussinesq_model_sizes,
    boussinesq_reference_cases,
    boussinesq_thermodynamic_validation_cases,
    compute_boussinesq_diagnostics,
    compute_boussinesq_thermodynamic_diagnostics,
    compute_divergence_field,
    run_boussinesq_thermodynamic_validation,
    run_simulation,
)
from app.sim.schemas import SimulationConfig

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


def test_boussinesq_reference_cases_map_to_valid_configs() -> None:
    cases = boussinesq_reference_cases()

    assert {case.slug for case in cases} == {
        "quiet-atmosphere",
        "dry-thermal-bubble",
        "humid-lifted-thermal",
        "stable-suppression",
        "fair-weather-boussinesq",
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
        assert diagnostics.max_abs_horizontal_velocity_m_per_s < 1.0
        assert diagnostics.max_abs_vertical_velocity_m_per_s < 1.0
        assert diagnostics.max_cloud_liquid_water_kg_per_kg < MAX_REFERENCE_CLOUD_WATER_KG_PER_KG
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
    ["dry-thermal-bubble", "humid-lifted-thermal", "stable-suppression"],
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
    ["dry-thermal-bubble", "humid-lifted-thermal", "stable-suppression"],
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


def test_humid_boussinesq_reference_case_creates_bounded_cloud_water() -> None:
    humid = _case("humid-lifted-thermal")

    diagnostics = compute_boussinesq_diagnostics(run_simulation(humid.config)[-1])

    assert diagnostics.max_abs_vertical_velocity_m_per_s > 0.05
    assert diagnostics.max_cloud_liquid_water_kg_per_kg > 1e-5
    assert diagnostics.total_cloud_liquid_water_kg_per_kg > 0.0
    assert diagnostics.cloud_top_height_m is not None
    assert diagnostics.max_cloud_liquid_water_height_m is not None


@pytest.mark.xfail(reason="Current prototype places peak cloud water below the BL top.")
def test_humid_boussinesq_reference_cloud_maximum_is_aloft() -> None:
    humid = _case("humid-lifted-thermal")

    diagnostics = compute_boussinesq_diagnostics(run_simulation(humid.config)[-1])

    assert diagnostics.max_cloud_liquid_water_height_m is not None
    assert diagnostics.max_cloud_liquid_water_height_m >= (
        humid.config.initial_atmosphere.boundary_layer_depth_m
    )
    assert diagnostics.cloud_top_height_m is not None
    assert diagnostics.cloud_top_height_m < humid.config.domain.height_m * 0.75


def test_stable_reference_case_suppresses_vertical_growth() -> None:
    dry = _case("dry-thermal-bubble")
    stable = _case("stable-suppression")

    dry_diagnostics = compute_boussinesq_diagnostics(run_simulation(dry.config)[-1])
    stable_diagnostics = compute_boussinesq_diagnostics(run_simulation(stable.config)[-1])

    assert stable_diagnostics.max_abs_vertical_velocity_m_per_s < (
        dry_diagnostics.max_abs_vertical_velocity_m_per_s
    )
    assert stable_diagnostics.total_cloud_liquid_water_kg_per_kg <= (
        dry_diagnostics.total_cloud_liquid_water_kg_per_kg
    )


def test_stable_reference_case_divergence_does_not_systematically_grow() -> None:
    stable = _case("stable-suppression")

    diagnostics_by_frame = [
        compute_boussinesq_diagnostics(frame) for frame in run_simulation(stable.config)
    ]
    rms_by_frame = [
        diagnostics.rms_dimensionless_divergence for diagnostics in diagnostics_by_frame
    ]

    assert max(rms_by_frame) < RMS_ACTIVE_DIMENSIONLESS_DIVERGENCE
    assert rms_by_frame[-1] <= max(rms_by_frame)


def test_small_and_medium_model_sizes_have_similar_qualitative_behavior() -> None:
    humid = _case("humid-lifted-thermal")
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
    humid = _case("humid-lifted-thermal")

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

from app.sim import (
    BoussinesqReferenceCase,
    boussinesq_model_sizes,
    boussinesq_reference_cases,
    compute_boussinesq_diagnostics,
    run_simulation,
)
from app.sim.schemas import SimulationConfig


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
        assert diagnostics.max_cloud_liquid_water_kg_per_kg < 0.005


def test_quiet_boussinesq_reference_case_remains_quiet() -> None:
    quiet = _case("quiet-atmosphere")

    diagnostics = compute_boussinesq_diagnostics(run_simulation(quiet.config)[-1])

    assert diagnostics.max_abs_horizontal_velocity_m_per_s == 0.0
    assert diagnostics.max_abs_vertical_velocity_m_per_s == 0.0
    assert diagnostics.max_temperature_perturbation_k == 0.0
    assert diagnostics.min_temperature_perturbation_k == 0.0
    assert diagnostics.max_cloud_liquid_water_kg_per_kg == 0.0


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

    assert small_diagnostics.max_abs_vertical_velocity_m_per_s < 1.0
    assert medium_diagnostics.max_abs_vertical_velocity_m_per_s < 1.0


def test_reference_case_seeded_runs_are_reproducible() -> None:
    humid = _case("humid-lifted-thermal")

    first = [frame.to_transport_dict() for frame in run_simulation(humid.config)]
    second = [frame.to_transport_dict() for frame in run_simulation(humid.config)]

    assert first == second


def _case(slug: str) -> BoussinesqReferenceCase:
    return next(case for case in boussinesq_reference_cases() if case.slug == slug)

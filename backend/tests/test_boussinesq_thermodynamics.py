import pytest

from app.sim import (
    SimulationConfig,
    SimulationFrame,
    build_grid_metadata,
    compute_boussinesq_thermodynamic_diagnostics,
    compute_cloud_region_diagnostics,
    compute_initialized_profile_diagnostics,
    compute_lcl_height_m,
    compute_mixed_layer_diagnostics,
    lifted_saturation_sanity_path,
    make_simulation_fields,
    pressure_at_height_pa,
    saturation_specific_humidity_kg_per_kg,
)
from app.sim.schemas import (
    DomainConfig,
    GridConfig,
    InitialAtmosphereConfig,
    SurfaceHeatingConfig,
    TimeConfig,
)

pytestmark = [pytest.mark.boussinesq, pytest.mark.science, pytest.mark.diagnostic]


def test_lcl_diagnostic_returns_plausible_common_values() -> None:
    assert compute_lcl_height_m(298.15, 0.80) == pytest.approx(460.0, abs=90.0)
    assert compute_lcl_height_m(298.15, 1.0) == 0.0


def test_pressure_profile_decreases_with_height() -> None:
    surface_pressure = pressure_at_height_pa(0.0)
    elevated_pressure = pressure_at_height_pa(2_000.0)

    assert surface_pressure == pytest.approx(101_325.0)
    assert elevated_pressure < surface_pressure
    assert elevated_pressure > 70_000.0


def test_saturation_uses_local_pressure() -> None:
    surface_saturation = saturation_specific_humidity_kg_per_kg(293.15, pressure_at_height_pa(0.0))
    elevated_saturation = saturation_specific_humidity_kg_per_kg(
        293.15,
        pressure_at_height_pa(2_000.0),
    )

    assert elevated_saturation > surface_saturation


def test_higher_rh_produces_lower_lcl_at_same_temperature() -> None:
    humid_lcl = compute_lcl_height_m(298.15, 0.95)
    dry_lcl = compute_lcl_height_m(298.15, 0.65)

    assert humid_lcl < dry_lcl


def test_warmer_drier_conditions_raise_lcl_relative_to_humid_baseline() -> None:
    humid_lcl = compute_lcl_height_m(298.15, 0.95)
    warmer_drier_lcl = compute_lcl_height_m(303.15, 0.70)

    assert warmer_drier_lcl > humid_lcl


def test_mixed_layer_consistency_metric_detects_synthetic_variation() -> None:
    mixed = compute_mixed_layer_diagnostics(
        _frame(
            temperature=[
                [298.15, 298.15, 298.15, 298.15],
                [288.35, 288.35, 288.35, 288.35],
                [281.85, 281.85, 281.85, 281.85],
                [275.35, 275.35, 275.35, 275.35],
            ],
            vapor=[
                [0.012, 0.012, 0.012, 0.012],
                [0.012, 0.012, 0.012, 0.012],
                [0.006, 0.006, 0.006, 0.006],
                [0.004, 0.004, 0.004, 0.004],
            ],
        )
    )
    varied = compute_mixed_layer_diagnostics(
        _frame(
            temperature=[
                [298.15, 300.15, 298.15, 300.15],
                [288.35, 290.35, 288.35, 290.35],
                [281.85, 281.85, 281.85, 281.85],
                [275.35, 275.35, 275.35, 275.35],
            ],
            vapor=[
                [0.012, 0.018, 0.012, 0.018],
                [0.010, 0.016, 0.010, 0.016],
                [0.006, 0.006, 0.006, 0.006],
                [0.004, 0.004, 0.004, 0.004],
            ],
        )
    )

    assert mixed.well_mixed is True
    assert varied.well_mixed is False
    assert varied.theta_spread_k > mixed.theta_spread_k
    assert varied.water_vapor_spread_kg_per_kg > mixed.water_vapor_spread_kg_per_kg


def test_saturation_sanity_path_cools_toward_saturation() -> None:
    path = lifted_saturation_sanity_path(298.15, 0.80)

    assert path.saturation_decreases is True
    assert path.relative_humidity_increases is True
    assert path.saturation_values_kg_per_kg[-1] < path.saturation_values_kg_per_kg[0]
    assert path.relative_humidity_values[-1] > path.relative_humidity_values[0]


def test_initialized_profile_reports_pressure_aware_rh_and_saturation_caps() -> None:
    config = SimulationConfig(
        solver_type="boussinesq_2d",
        domain=DomainConfig(width_m=4_000.0, height_m=4_000.0),
        grid=GridConfig(columns=4, rows=4),
        initial_atmosphere=InitialAtmosphereConfig(
            surface_temperature_k=298.15,
            relative_humidity=0.90,
            free_atmosphere_relative_humidity=0.45,
            boundary_layer_depth_m=2_000.0,
            moist_source_layer_depth_m=2_000.0,
            humidity_profile="surface_moisture",
        ),
        surface_heating=SurfaceHeatingConfig(
            patch_center_x_m=2_000.0,
            patch_width_m=1_000.0,
        ),
    )
    from app.sim.boussinesq_2d import initialize_state, state_to_frame

    frame = state_to_frame(config, initialize_state(config))
    profile = compute_initialized_profile_diagnostics(frame)

    assert len(profile.heights_m) == config.grid.rows
    assert profile.pressure_profile_pa[-1] < profile.pressure_profile_pa[0]
    assert profile.saturation_cap_cell_count > 0
    assert profile.source_layer_vapor_conserved is False
    assert profile.effective_source_layer_top_m == 2_000.0
    assert profile.transition_layer_bottom_m == 2_000.0
    assert profile.transition_layer_top_m == pytest.approx(2_320.0)


def test_cloud_onset_and_distribution_metrics_from_synthetic_frames() -> None:
    clear = _frame()
    cloudy = _frame(
        cloud=[
            [0.0, 0.0, 0.0, 0.0],
            [0.0, 2e-6, 4e-6, 0.0],
            [0.0, 1e-6, 3e-6, 0.0],
            [0.0, 0.0, 0.0, 0.0],
        ],
        time_seconds=30.0,
    )

    diagnostics = compute_boussinesq_thermodynamic_diagnostics([clear, cloudy])

    assert diagnostics.first_cloud_time_seconds == 30.0
    assert diagnostics.first_cloud_height_m == 1_500.0
    assert diagnostics.max_cloud_height_m == 1_500.0
    assert diagnostics.cloud_water_centroid_m == pytest.approx(1_900.0)


def test_below_lcl_cloud_fraction_and_centroid_from_synthetic_frame() -> None:
    frame = _frame(
        relative_humidity=0.30,
        cloud=[
            [0.0, 1e-6, 0.0, 0.0],
            [0.0, 0.0, 3e-6, 0.0],
            [0.0, 0.0, 6e-6, 0.0],
            [0.0, 0.0, 0.0, 0.0],
        ],
    )

    diagnostics = compute_boussinesq_thermodynamic_diagnostics([frame])

    assert diagnostics.below_lcl_cloud_fraction == pytest.approx(0.10)
    assert diagnostics.cloud_water_centroid_m == pytest.approx(2_000.0)


def test_multi_region_cloud_base_spread_from_synthetic_frame() -> None:
    frame = _frame(
        cloud=[
            [0.0, 0.0, 0.0, 0.0],
            [2e-6, 0.0, 0.0, 0.0],
            [2e-6, 0.0, 0.0, 3e-6],
            [0.0, 0.0, 0.0, 3e-6],
        ]
    )

    regions = compute_cloud_region_diagnostics(frame)

    assert regions.region_count == 2
    assert regions.cloud_base_heights_m == (1_500.0, 2_500.0)
    assert regions.cloud_top_heights_m == (2_500.0, 3_500.0)
    assert regions.cloud_base_spread_m == 1_000.0
    assert regions.cloud_top_spread_m == 1_000.0


def test_thermodynamic_diagnostics_classify_synthetic_cloud_below_lcl() -> None:
    frame = _frame(
        relative_humidity=0.30,
        cloud=[
            [3e-6, 3e-6, 3e-6, 3e-6],
            [0.0, 0.0, 0.0, 0.0],
            [0.0, 0.0, 0.0, 0.0],
            [0.0, 0.0, 0.0, 0.0],
        ],
    )

    diagnostics = compute_boussinesq_thermodynamic_diagnostics([frame])

    assert diagnostics.status == "fail"
    assert any("below expected LCL" in note for note in diagnostics.notes)


def _frame(
    *,
    temperature: list[list[float]] | None = None,
    vapor: list[list[float]] | None = None,
    cloud: list[list[float]] | None = None,
    vertical_velocity: list[list[float]] | None = None,
    relative_humidity: float = 0.80,
    time_seconds: float = 0.0,
) -> SimulationFrame:
    config = SimulationConfig(
        solver_type="boussinesq_2d",
        domain=DomainConfig(width_m=4_000.0, height_m=4_000.0),
        grid=GridConfig(columns=4, rows=4),
        time=TimeConfig(time_step_seconds=10.0, duration_seconds=60.0, frame_interval_seconds=30.0),
        initial_atmosphere=InitialAtmosphereConfig(
            surface_temperature_k=298.15,
            relative_humidity=relative_humidity,
            boundary_layer_depth_m=2_000.0,
        ),
        surface_heating=SurfaceHeatingConfig(
            patch_center_x_m=2_000.0,
            patch_width_m=1_000.0,
        ),
    )
    grid = build_grid_metadata(config)
    temperature_values = temperature or [
        [298.15, 298.15, 298.15, 298.15],
        [288.35, 288.35, 288.35, 288.35],
        [281.85, 281.85, 281.85, 281.85],
        [275.35, 275.35, 275.35, 275.35],
    ]
    vapor_values = vapor or [
        [0.014, 0.014, 0.014, 0.014],
        [0.010, 0.010, 0.010, 0.010],
        [0.006, 0.006, 0.006, 0.006],
        [0.004, 0.004, 0.004, 0.004],
    ]
    cloud_values = cloud or [[0.0 for _column in range(4)] for _row in range(4)]
    velocity_values = vertical_velocity or [[0.1 for _column in range(4)] for _row in range(4)]

    return SimulationFrame(
        step=int(time_seconds / config.time.time_step_seconds),
        time_seconds=time_seconds,
        config=config,
        grid=grid,
        fields=make_simulation_fields(
            temperature=temperature_values,
            temperature_perturbation=[[0.0 for _column in range(4)] for _row in range(4)],
            water_vapor=vapor_values,
            cloud_liquid_water=cloud_values,
            rain_water=[[0.0 for _column in range(4)] for _row in range(4)],
            horizontal_velocity=[[0.0 for _column in range(4)] for _row in range(4)],
            vertical_velocity=velocity_values,
            dynamic=True,
        ),
    )

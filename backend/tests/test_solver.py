from math import isfinite

import pytest

from app.sim import (
    BackgroundWindConfig,
    DomainConfig,
    GridConfig,
    InitialAtmosphereConfig,
    SimulationConfig,
    SurfaceHeatingConfig,
    TimeConfig,
    compute_boussinesq_diagnostics,
    compute_boussinesq_thermodynamic_diagnostics,
    fair_weather_cumulus_preset,
    initialize_state,
    run_simulation,
    step_state,
)
from app.sim.educational_2d import _advect, _apply_surface_heating, _constant_grid, _solver_grid


def test_solver_step_preserves_shapes_and_finite_values() -> None:
    config = _small_config()
    state = step_state(config, initialize_state(config))

    for grid in (
        state.temperature_k,
        state.water_vapor_kg_per_kg,
        state.cloud_liquid_water_kg_per_kg,
        state.horizontal_velocity_m_per_s,
        state.vertical_velocity_m_per_s,
    ):
        assert len(grid) == config.grid.rows
        assert all(len(row) == config.grid.columns for row in grid)
        assert all(isfinite(value) for row in grid for value in row)


def test_initial_temperature_is_smooth_and_well_mixed_in_boundary_layer() -> None:
    config = SimulationConfig(
        solver_type="educational_2d",
        domain=DomainConfig(height_m=3_000.0),
        grid=GridConfig(columns=4, rows=6),
        initial_atmosphere=InitialAtmosphereConfig(
            surface_temperature_k=300.0,
            lapse_rate_k_per_m=0.006,
            boundary_layer_depth_m=1_000.0,
        ),
    )
    state = initialize_state(config)
    solver_grid = _solver_grid(config)

    assert all(len(set(row)) == 1 for row in state.temperature_k)
    assert state.temperature_k == state.environmental_temperature_k

    lower_row_temperature = state.temperature_k[0][0]
    upper_mixed_layer_row_temperature = state.temperature_k[1][0]
    free_atmosphere_row_temperature = state.temperature_k[2][0]
    higher_free_atmosphere_row_temperature = state.temperature_k[3][0]
    lower_dz = solver_grid.z_coordinates_m[1] - solver_grid.z_coordinates_m[0]
    free_atmosphere_dz = solver_grid.z_coordinates_m[3] - solver_grid.z_coordinates_m[2]

    assert (lower_row_temperature - upper_mixed_layer_row_temperature) / lower_dz == pytest.approx(
        0.0098
    )
    assert (
        free_atmosphere_row_temperature - higher_free_atmosphere_row_temperature
    ) / free_atmosphere_dz == pytest.approx(0.006)


def test_educational_initial_vapor_follows_relative_humidity_profile() -> None:
    config = SimulationConfig(
        solver_type="educational_2d",
        domain=DomainConfig(height_m=3_000.0),
        grid=GridConfig(columns=4, rows=6),
        initial_atmosphere=InitialAtmosphereConfig(
            surface_temperature_k=300.0,
            relative_humidity=0.65,
            boundary_layer_depth_m=1_000.0,
        ),
    )
    state = initialize_state(config)
    solver_grid = _solver_grid(config)

    assert state.water_vapor_kg_per_kg[0][0] > state.water_vapor_kg_per_kg[1][0]
    assert solver_grid.z_coordinates_m[1] <= config.initial_atmosphere.boundary_layer_depth_m


def test_surface_heating_produces_buoyant_plume() -> None:
    config = _small_config()
    initial_state = initialize_state(config)
    final_state = initial_state

    for _step_index in range(40):
        final_state = step_state(config, final_state)

    initial_max_w = _max_value(initial_state.vertical_velocity_m_per_s)
    final_max_w = _max_value(final_state.vertical_velocity_m_per_s)

    assert final_max_w > initial_max_w + 0.001


def test_advection_preserves_uniform_scalar_field() -> None:
    config = _small_config()
    state = initialize_state(config)
    uniform_temperature = _constant_grid(config.grid.rows, config.grid.columns, 300.0)

    advected = _advect(
        uniform_temperature,
        state,
        _solver_grid(config),
        config.time.time_step_seconds,
    )

    assert advected == uniform_temperature


def test_surface_heating_width_is_uniform_across_configured_patch() -> None:
    config = _small_config()
    state = initialize_state(config)
    solver_grid = _solver_grid(config)

    heated = _apply_surface_heating(
        config,
        solver_grid,
        state.temperature_k,
        config.time.time_step_seconds,
    )

    lowest_row = 0
    patch_deltas = [
        heated[lowest_row][column_index] - state.temperature_k[lowest_row][column_index]
        for column_index, x_m in enumerate(solver_grid.x_coordinates_m)
        if abs(x_m - config.surface_heating.patch_center_x_m)
        <= config.surface_heating.patch_width_m / 2.0
    ]
    outside_deltas = [
        heated[lowest_row][column_index] - state.temperature_k[lowest_row][column_index]
        for column_index, x_m in enumerate(solver_grid.x_coordinates_m)
        if abs(x_m - config.surface_heating.patch_center_x_m) > config.surface_heating.patch_width_m
    ]

    assert len(patch_deltas) >= 2
    assert max(patch_deltas) - min(patch_deltas) < 1e-12
    assert max(outside_deltas) == 0.0


def test_structured_heating_patterns_produce_different_lower_boundary_forcing() -> None:
    config = _small_config()
    grid = _solver_grid(config)
    base_temperature = _constant_grid(config.grid.rows, config.grid.columns, 290.0)
    single_patch = _apply_surface_heating(config, grid, base_temperature, dt=2.0)
    two_patch_config = config.model_copy(
        update={
            "surface_heating": config.surface_heating.model_copy(update={"pattern": "two_patches"})
        }
    )
    two_patch = _apply_surface_heating(two_patch_config, grid, base_temperature, dt=2.0)

    assert single_patch[0] != two_patch[0]


def test_moist_boundary_layer_profile_changes_initial_vapor_with_height() -> None:
    base_config = _small_config(relative_humidity=0.7)
    config = base_config.model_copy(
        update={
            "initial_atmosphere": base_config.initial_atmosphere.model_copy(
                update={"humidity_profile": "moist_boundary_layer"}
            )
        }
    )

    state = initialize_state(config)

    assert state.water_vapor_kg_per_kg[0][0] > state.water_vapor_kg_per_kg[-1][0]


def test_fair_weather_preset_keeps_heated_lower_patch_warm_and_upward() -> None:
    config = _small_config(duration_seconds=120.0)
    state = initialize_state(config)

    for _step_index in range(int(60.0 / config.time.time_step_seconds)):
        state = step_state(config, state)

    grid = _solver_grid(config)
    heated_columns = [
        column_index
        for column_index, x_m in enumerate(grid.x_coordinates_m)
        if abs(x_m - config.surface_heating.patch_center_x_m)
        <= config.surface_heating.patch_width_m / 2.0
    ]
    heated_rows = [
        row_index
        for row_index, z_m in enumerate(grid.z_coordinates_m)
        if z_m <= config.domain.height_m * 0.12
    ]
    temperature_perturbations = [
        state.temperature_k[row_index][column_index]
        - state.environmental_temperature_k[row_index][column_index]
        for row_index in heated_rows
        for column_index in heated_columns
    ]
    vertical_velocities = [
        state.vertical_velocity_m_per_s[row_index][column_index]
        for row_index in heated_rows
        for column_index in heated_columns
    ]

    assert sum(temperature_perturbations) / len(temperature_perturbations) > 0.05
    assert min(vertical_velocities) >= 0.0
    assert max(vertical_velocities) > 0.01


def test_humid_seeded_run_condenses_cloud_water() -> None:
    config = _small_config(relative_humidity=1.0)

    frames = run_simulation(config)
    final_cloud = frames[-1].fields.cloud_liquid_water_kg_per_kg.values

    assert _max_value(final_cloud) > 0.0
    assert all(value >= 0.0 for row in final_cloud for value in row)


def test_stronger_fair_weather_heating_produces_stronger_response_and_cloud() -> None:
    preset = fair_weather_cumulus_preset()
    weak_config = preset.config.model_copy(
        update={
            "surface_heating": preset.config.surface_heating.model_copy(
                update={"max_warming_rate_k_per_s": 0.012}
            ),
        }
    )
    strong_config = preset.config.model_copy(
        update={
            "surface_heating": preset.config.surface_heating.model_copy(
                update={"max_warming_rate_k_per_s": 0.025}
            ),
        }
    )

    weak_frames = run_simulation(weak_config)
    strong_frames = run_simulation(strong_config)
    weak_dynamics = compute_boussinesq_diagnostics(weak_frames[-1])
    strong_dynamics = compute_boussinesq_diagnostics(strong_frames[-1])
    weak_thermo = compute_boussinesq_thermodynamic_diagnostics(weak_frames)
    strong_thermo = compute_boussinesq_thermodynamic_diagnostics(strong_frames)

    assert strong_dynamics.max_abs_vertical_velocity_m_per_s > (
        weak_dynamics.max_abs_vertical_velocity_m_per_s
    )
    assert strong_dynamics.max_cloud_liquid_water_kg_per_kg >= (
        weak_dynamics.max_cloud_liquid_water_kg_per_kg
    )
    assert strong_thermo.first_cloud_time_seconds is not None
    if weak_thermo.first_cloud_time_seconds is not None:
        assert strong_thermo.first_cloud_time_seconds <= weak_thermo.first_cloud_time_seconds


def test_lifted_humid_plume_condenses_in_interior_by_thirty_minutes() -> None:
    preset = fair_weather_cumulus_preset()
    config = preset.config.model_copy(
        update={
            "initial_atmosphere": preset.config.initial_atmosphere.model_copy(
                update={"relative_humidity": 0.98}
            ),
            "time": preset.config.time.model_copy(update={"duration_seconds": 1_800.0}),
            "surface_heating": preset.config.surface_heating.model_copy(
                update={"max_warming_rate_k_per_s": 0.02}
            ),
        }
    )

    frames = run_simulation(config)
    final_cloud = frames[-1].fields.cloud_liquid_water_kg_per_kg.values
    diagnostics = compute_boussinesq_thermodynamic_diagnostics(frames)
    interior_cloud_max = _max_value(final_cloud[1:-1])
    boundary_cloud_max = max(
        _max_value([final_cloud[0]]),
        _max_value([final_cloud[-1]]),
        max(row[0] for row in final_cloud),
        max(row[-1] for row in final_cloud),
    )

    assert interior_cloud_max > 1e-5
    assert interior_cloud_max > boundary_cloud_max * 100
    assert diagnostics.first_cloud_time_seconds is not None
    assert diagnostics.cloud_regions.region_count >= 1
    assert diagnostics.boundary_cloud_fraction < 0.10


def test_top_boundary_sponge_limits_lid_cloud_water_relative_to_main_plume() -> None:
    preset = fair_weather_cumulus_preset()
    config = preset.config.model_copy(
        update={
            "initial_atmosphere": preset.config.initial_atmosphere.model_copy(
                update={"relative_humidity": 0.98}
            ),
            "time": preset.config.time.model_copy(update={"duration_seconds": 1_800.0}),
            "surface_heating": preset.config.surface_heating.model_copy(
                update={"max_warming_rate_k_per_s": 0.02}
            ),
        }
    )

    final_cloud = run_simulation(config)[-1].fields.cloud_liquid_water_kg_per_kg.values
    top_cloud_max = _max_value([final_cloud[-1]])
    interior_cloud_max = _max_value(final_cloud[1:-1])

    assert top_cloud_max < 1e-6
    assert interior_cloud_max > top_cloud_max * 100


def test_long_interactive_educational_run_stays_bounded() -> None:
    config = _small_config().model_copy(
        update={
            "time": _small_config().time.model_copy(
                update={"duration_seconds": 3_600.0, "frame_interval_seconds": 9.0}
            ),
            "surface_heating": _small_config().surface_heating.model_copy(
                update={"max_warming_rate_k_per_s": 0.025}
            ),
        }
    )

    final = run_simulation(config)[-1]
    final_cloud = final.fields.cloud_liquid_water_kg_per_kg.values
    final_temperature = final.fields.temperature_k.values
    final_w = final.fields.vertical_velocity_m_per_s.values

    assert all(isfinite(value) for row in final_cloud for value in row)
    assert all(isfinite(value) for row in final_temperature for value in row)
    assert _max_value(final_cloud) < 0.02
    assert _max_value(final_w) < 12.0


def test_top_boundary_sponge_does_not_damp_surface_heating() -> None:
    config = _small_config()
    initial_state = initialize_state(config)

    final_state = step_state(config, initial_state)
    grid = _solver_grid(config)
    heated_columns = [
        column_index
        for column_index, x_m in enumerate(grid.x_coordinates_m)
        if abs(x_m - config.surface_heating.patch_center_x_m)
        <= config.surface_heating.patch_width_m / 2.0
    ]
    lowest_heated_delta = min(
        final_state.temperature_k[0][column_index] - initial_state.temperature_k[0][column_index]
        for column_index in heated_columns
    )

    assert lowest_heated_delta > 0.0


def test_seeded_runs_are_reproducible() -> None:
    config = _small_config(seed=9)

    first = [frame.to_transport_dict() for frame in run_simulation(config)]
    second = [frame.to_transport_dict() for frame in run_simulation(config)]

    assert first == second


def test_solver_emits_schema_frames_at_configured_cadence() -> None:
    config = _small_config(duration_seconds=60.0, frame_interval_seconds=20.0)

    frames = run_simulation(config)

    assert [frame.time_seconds for frame in frames] == [0.0, 20.0, 40.0, 60.0]
    assert all(frame.grid.columns == config.grid.columns for frame in frames)
    assert all(frame.fields.temperature_k.metadata.unit == "K" for frame in frames)


def _small_config(
    *,
    relative_humidity: float = 0.98,
    seed: int = 4,
    duration_seconds: float = 80.0,
    frame_interval_seconds: float = 20.0,
) -> SimulationConfig:
    return SimulationConfig(
        solver_type="educational_2d",
        grid=GridConfig(columns=18, rows=12),
        time=TimeConfig(
            time_step_seconds=2.0,
            duration_seconds=duration_seconds,
            frame_interval_seconds=frame_interval_seconds,
        ),
        initial_atmosphere=InitialAtmosphereConfig(relative_humidity=relative_humidity),
        surface_heating=SurfaceHeatingConfig(
            max_warming_rate_k_per_s=0.014,
            patch_center_x_m=5_000.0,
            patch_width_m=2_000.0,
        ),
        background_wind=BackgroundWindConfig(u_m_per_s=0.2),
        seed=seed,
    )


def _max_value(grid: list[list[float]]) -> float:
    return max(value for row in grid for value in row)

from math import isfinite

from app.sim import (
    BackgroundWindConfig,
    GridConfig,
    InitialAtmosphereConfig,
    SimulationConfig,
    SurfaceHeatingConfig,
    TimeConfig,
    fair_weather_cumulus_preset,
    initialize_state,
    run_simulation,
    step_state,
)
from app.sim.solver import _advect, _apply_surface_heating, _constant_grid, _solver_grid


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
    config = fair_weather_cumulus_preset().config
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


def test_fair_weather_preset_keeps_heated_lower_patch_warm_and_upward() -> None:
    config = fair_weather_cumulus_preset().config
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

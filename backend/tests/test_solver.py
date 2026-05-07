from math import isfinite

from app.sim import (
    BackgroundWindConfig,
    GridConfig,
    InitialAtmosphereConfig,
    SimulationConfig,
    SurfaceHeatingConfig,
    TimeConfig,
    initialize_state,
    run_simulation,
    step_state,
)


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

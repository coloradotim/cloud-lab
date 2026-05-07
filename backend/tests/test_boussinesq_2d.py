from math import isfinite

from app.sim import (
    SimulationConfig,
    TimeConfig,
    fair_weather_cumulus_preset,
    run_simulation,
)


def test_boussinesq_solver_emits_valid_stable_frames() -> None:
    config = _boussinesq_config(duration_seconds=120.0)

    frames = run_simulation(config)
    final = frames[-1]

    assert len(frames) == 5
    assert final.config.solver_type == "boussinesq_2d"
    for field in final.fields:
        values = field[1].values
        assert len(values) == config.grid.rows
        assert all(len(row) == config.grid.columns for row in values)
        assert all(isfinite(value) for row in values for value in row)


def test_boussinesq_solver_is_reproducible() -> None:
    config = _boussinesq_config(seed=17)

    first = [frame.to_transport_dict() for frame in run_simulation(config)]
    second = [frame.to_transport_dict() for frame in run_simulation(config)]

    assert first == second


def test_boussinesq_solver_keeps_moisture_non_negative() -> None:
    config = _boussinesq_config(relative_humidity=0.98, duration_seconds=180.0)

    final = run_simulation(config)[-1]

    for field in (
        final.fields.water_vapor_kg_per_kg,
        final.fields.cloud_liquid_water_kg_per_kg,
        final.fields.rain_water_kg_per_kg,
    ):
        assert min(value for row in field.values for value in row) >= 0.0


def test_boussinesq_solver_produces_buoyant_motion_and_cloud_water() -> None:
    config = _boussinesq_config(
        relative_humidity=1.0,
        duration_seconds=300.0,
        heating_rate=0.018,
    )

    final = run_simulation(config)[-1]
    max_updraft = max(
        value for row in final.fields.vertical_velocity_m_per_s.values for value in row
    )
    max_cloud = max(
        value for row in final.fields.cloud_liquid_water_kg_per_kg.values for value in row
    )
    max_temperature_perturbation = max(
        value for row in final.fields.temperature_perturbation_k.values for value in row
    )

    assert max_temperature_perturbation > 0.1
    assert max_updraft > 0.01
    assert max_cloud > 0.0


def _boussinesq_config(
    *,
    duration_seconds: float = 90.0,
    relative_humidity: float = 0.92,
    heating_rate: float = 0.014,
    seed: int = 5,
) -> SimulationConfig:
    preset = fair_weather_cumulus_preset().config
    return preset.model_copy(
        update={
            "solver_type": "boussinesq_2d",
            "time": TimeConfig(
                time_step_seconds=2.0,
                duration_seconds=duration_seconds,
                frame_interval_seconds=30.0,
            ),
            "initial_atmosphere": preset.initial_atmosphere.model_copy(
                update={"relative_humidity": relative_humidity}
            ),
            "surface_heating": preset.surface_heating.model_copy(
                update={"max_warming_rate_k_per_s": heating_rate}
            ),
            "seed": seed,
        }
    )

import asyncio
from typing import Any, cast

import pytest

from app.sim import (
    BackgroundWindConfig,
    GridConfig,
    InitialAtmosphereConfig,
    SimulationConfig,
    SimulationFrame,
    SurfaceHeatingConfig,
    TimeConfig,
    run_manager,
    run_simulation,
    stream_run,
)

pytestmark = [pytest.mark.microphysics]


def test_microphysics_lab_emits_valid_schema_frames() -> None:
    config = _lab_config()

    frames = run_simulation(config)

    assert [frame.time_seconds for frame in frames] == [0.0, 30.0, 60.0, 90.0, 120.0]
    for frame in frames:
        SimulationFrame.model_validate(frame.to_transport_dict())
        assert frame.config.solver_type == "microphysics_lab"
        assert frame.grid.columns == config.grid.columns
        assert frame.grid.rows == config.grid.rows


def test_microphysics_lab_prescribed_lift_condenses_cloud_water_without_negative_moisture() -> None:
    frames = run_simulation(_lab_config())
    final = frames[-1]

    cloud = final.fields.cloud_liquid_water_kg_per_kg.values
    vapor = final.fields.water_vapor_kg_per_kg.values
    rain = final.fields.rain_water_kg_per_kg.values
    peak_cloud = max(
        value
        for frame in frames
        for row in frame.fields.cloud_liquid_water_kg_per_kg.values
        for value in row
    )

    assert peak_cloud > 0.0
    assert all(value >= 0.0 for row in vapor for value in row)
    assert all(value >= 0.0 for row in cloud for value in row)
    assert all(value >= 0.0 for row in rain for value in row)


def test_microphysics_lab_seeded_runs_are_reproducible() -> None:
    config = _lab_config(seed=17)

    first = [frame.to_transport_dict() for frame in run_simulation(config)]
    second = [frame.to_transport_dict() for frame in run_simulation(config)]

    assert first == second


def test_microphysics_lab_uses_prescribed_velocity_not_boussinesq_flow() -> None:
    config = _lab_config(vertical_velocity_m_per_s=1.25)
    final = run_simulation(config)[-1]

    u_values = final.fields.horizontal_velocity_m_per_s.values
    w_values = final.fields.vertical_velocity_m_per_s.values

    assert {value for row in u_values for value in row} == {0.0}
    assert {value for row in w_values for value in row} == {1.25}


def test_microphysics_lab_lifted_parcel_cools_to_3600_m_with_max_heating() -> None:
    config = _lab_config(
        duration_seconds=3_600.0,
        frame_interval_seconds=600.0,
        vertical_velocity_m_per_s=1.0,
    ).model_copy(
        update={
            "surface_heating": SurfaceHeatingConfig(max_warming_rate_k_per_s=0.025),
        }
    )

    final = run_simulation(config)[-1]
    final_temperature_k = final.fields.temperature_k.values[0][0]

    assert final_temperature_k < config.initial_atmosphere.surface_temperature_k
    assert final_temperature_k < 303.15


def test_microphysics_lab_dry_lift_tracks_dry_adiabatic_cooling() -> None:
    config = _lab_config(
        duration_seconds=600.0,
        frame_interval_seconds=600.0,
        vertical_velocity_m_per_s=1.0,
    ).model_copy(
        update={
            "initial_atmosphere": InitialAtmosphereConfig(
                surface_temperature_k=298.15,
                relative_humidity=0.3,
            ),
            "surface_heating": SurfaceHeatingConfig(max_warming_rate_k_per_s=0.0),
        }
    )

    final = run_simulation(config)[-1]
    final_temperature_k = final.fields.temperature_k.values[0][0]

    assert final_temperature_k == pytest.approx(298.15 - 0.0098 * 600.0)


def test_microphysics_lab_streams_through_run_manager() -> None:
    run = run_manager.create_run(_lab_config(duration_seconds=30.0, frame_interval_seconds=30.0))

    async def collect_messages() -> list[dict[str, object]]:
        return [message async for message in stream_run(run)]

    messages = asyncio.run(collect_messages())

    assert messages[0]["type"] == "metadata"
    assert messages[1]["type"] == "frame"
    frame = cast(dict[str, Any], messages[1]["frame"])
    config = cast(dict[str, Any], frame["config"])
    assert config["solver_type"] == "microphysics_lab"
    assert messages[-1]["type"] == "complete"


def _lab_config(
    *,
    seed: int = 5,
    duration_seconds: float = 120.0,
    frame_interval_seconds: float = 30.0,
    vertical_velocity_m_per_s: float = 2.0,
) -> SimulationConfig:
    return SimulationConfig(
        solver_type="microphysics_lab",
        grid=GridConfig(columns=6, rows=4),
        time=TimeConfig(
            time_step_seconds=5.0,
            duration_seconds=duration_seconds,
            frame_interval_seconds=frame_interval_seconds,
        ),
        initial_atmosphere=InitialAtmosphereConfig(
            surface_temperature_k=298.15,
            relative_humidity=0.99,
        ),
        surface_heating=SurfaceHeatingConfig(max_warming_rate_k_per_s=0.0),
        background_wind=BackgroundWindConfig(u_m_per_s=4.0, w_m_per_s=vertical_velocity_m_per_s),
        seed=seed,
    )

from math import isfinite

import pytest

from app.sim import (
    DomainConfig,
    GridConfig,
    InitialAtmosphereConfig,
    SimulationConfig,
    TimeConfig,
    build_grid_metadata,
    fair_weather_cumulus_preset,
    run_simulation,
    saturation_specific_humidity_kg_per_kg,
)
from app.sim.boussinesq_2d import _condense, initialize_state

pytestmark = [pytest.mark.boussinesq, pytest.mark.science]


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


def test_boussinesq_initial_vapor_is_well_mixed_in_uniform_boundary_layer() -> None:
    config = _boussinesq_config(relative_humidity=0.65).model_copy(
        update={
            "domain": DomainConfig(width_m=4_000.0, height_m=3_000.0),
            "grid": GridConfig(columns=4, rows=6),
            "initial_atmosphere": InitialAtmosphereConfig(
                surface_temperature_k=300.0,
                relative_humidity=0.45,
                boundary_layer_depth_m=1_000.0,
                humidity_profile="uniform",
            ),
        }
    )

    state = initialize_state(config)
    grid = build_grid_metadata(config)
    mixed_layer_values = {
        state.water_vapor_kg_per_kg[row_index][column_index]
        for row_index, z_m in enumerate(grid.z_coordinates_m)
        if z_m <= config.initial_atmosphere.boundary_layer_depth_m
        for column_index in range(config.grid.columns)
    }

    assert len(mixed_layer_values) == 1


def test_surface_moisture_profile_keeps_free_air_subsaturated() -> None:
    config = _boussinesq_config(relative_humidity=0.85).model_copy(
        update={
            "domain": DomainConfig(width_m=4_000.0, height_m=3_000.0),
            "grid": GridConfig(columns=4, rows=6),
            "initial_atmosphere": InitialAtmosphereConfig(
                surface_temperature_k=298.15,
                relative_humidity=0.85,
                boundary_layer_depth_m=1_500.0,
                moist_source_layer_depth_m=500.0,
                free_atmosphere_relative_humidity=0.55,
                humidity_profile="surface_moisture",
            ),
        }
    )

    state = initialize_state(config)
    grid = build_grid_metadata(config)
    relative_humidity_by_height = []
    for row_index, z_m in enumerate(grid.z_coordinates_m):
        temperature = state.environmental_temperature_k[row_index][0]
        vapor = state.water_vapor_kg_per_kg[row_index][0]
        relative_humidity_by_height.append(
            (z_m, vapor / saturation_specific_humidity_kg_per_kg(temperature))
        )

    assert relative_humidity_by_height[0][1] > 0.80
    assert max(rh for z_m, rh in relative_humidity_by_height if z_m > 1_000.0) < 0.70


def test_boussinesq_cloud_water_evaporates_in_subsaturated_air() -> None:
    result = _condense(
        temperature=[[300.0]],
        water_vapor=[[0.0]],
        cloud_liquid_water=[[0.001]],
        vertical_velocity=[[0.01]],
    )

    assert result.cloud_liquid_water_kg_per_kg[0][0] < 0.001
    assert result.water_vapor_kg_per_kg[0][0] > 0.0
    assert result.temperature_k[0][0] < 300.0


def test_lifted_parcel_cooling_can_trigger_condensation() -> None:
    result = _condense(
        temperature=[[298.15]],
        water_vapor=[[0.014]],
        cloud_liquid_water=[[0.0]],
        vertical_velocity=[[0.01]],
        parcel_lift_m=[[3_000.0]],
    )

    assert result.cloud_liquid_water_kg_per_kg[0][0] > 0.0
    assert result.temperature_k[0][0] < 298.15


def test_boussinesq_solver_produces_buoyant_motion_and_cloud_water() -> None:
    config = _boussinesq_config(
        relative_humidity=1.0,
        duration_seconds=600.0,
        heating_rate=0.04,
    ).model_copy(
        update={
            "surface_heating": fair_weather_cumulus_preset().config.surface_heating.model_copy(
                update={"max_warming_rate_k_per_s": 0.04, "pattern": "single_patch"}
            )
        }
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


@pytest.mark.slow
def test_boussinesq_solver_does_not_hit_safety_clamps_in_normal_long_run() -> None:
    config = _boussinesq_config(
        duration_seconds=1_800.0,
        relative_humidity=0.65,
        heating_rate=0.018,
    )

    final = run_simulation(config)[-1]
    max_abs_vertical_velocity = max(
        abs(value) for row in final.fields.vertical_velocity_m_per_s.values for value in row
    )
    max_abs_temperature_perturbation = max(
        abs(value) for row in final.fields.temperature_perturbation_k.values for value in row
    )
    max_cloud = max(
        value for row in final.fields.cloud_liquid_water_kg_per_kg.values for value in row
    )

    assert max_abs_vertical_velocity < 1.0
    assert max_abs_temperature_perturbation < 8.0
    assert max_cloud < 0.005


@pytest.mark.slow
def test_boussinesq_solver_does_not_create_clouds_without_forcing() -> None:
    config = _boussinesq_config(
        duration_seconds=1_800.0,
        relative_humidity=0.65,
        heating_rate=0.0,
    )

    final = run_simulation(config)[-1]
    max_abs_vertical_velocity = max(
        abs(value) for row in final.fields.vertical_velocity_m_per_s.values for value in row
    )
    max_abs_temperature_perturbation = max(
        abs(value) for row in final.fields.temperature_perturbation_k.values for value in row
    )
    max_cloud = max(
        value for row in final.fields.cloud_liquid_water_kg_per_kg.values for value in row
    )

    assert max_abs_vertical_velocity == 0.0
    assert max_abs_temperature_perturbation == 0.0
    assert max_cloud == 0.0


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

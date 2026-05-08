from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass
from math import exp

from app.sim.sample import build_grid_metadata, make_simulation_fields
from app.sim.schemas import SimulationConfig, SimulationFrame

Grid = list[list[float]]

DRY_ADIABATIC_LAPSE_RATE_K_PER_M = 0.0098
LATENT_HEATING_K_PER_KG_PER_KG = 1_200.0
RAIN_AUTOCONVERSION_THRESHOLD_KG_PER_KG = 8.0e-4
RAIN_AUTOCONVERSION_PER_SECOND = 1.5e-3
RAIN_EVAPORATION_FRACTION_PER_STEP = 0.02
MAX_WATER_VAPOR_KG_PER_KG = 0.05
MAX_CLOUD_LIQUID_WATER_KG_PER_KG = 0.02
MAX_RAIN_WATER_KG_PER_KG = 0.02


@dataclass(frozen=True)
class MicrophysicsLabState:
    step: int
    time_seconds: float
    parcel_height_m: float
    temperature_k: float
    initial_temperature_k: float
    water_vapor_kg_per_kg: float
    cloud_liquid_water_kg_per_kg: float
    rain_water_kg_per_kg: float


def initialize_state(config: SimulationConfig) -> MicrophysicsLabState:
    temperature_k = config.initial_atmosphere.surface_temperature_k
    initial_vapor = (
        _saturation_specific_humidity_kg_per_kg(temperature_k)
        * config.initial_atmosphere.relative_humidity
    )

    return MicrophysicsLabState(
        step=0,
        time_seconds=0.0,
        parcel_height_m=0.0,
        temperature_k=temperature_k,
        initial_temperature_k=temperature_k,
        water_vapor_kg_per_kg=_bounded(initial_vapor, 0.0, MAX_WATER_VAPOR_KG_PER_KG),
        cloud_liquid_water_kg_per_kg=0.0,
        rain_water_kg_per_kg=0.0,
    )


def step_state(config: SimulationConfig, state: MicrophysicsLabState) -> MicrophysicsLabState:
    dt = config.time.time_step_seconds
    prescribed_w_m_per_s = config.background_wind.w_m_per_s
    parcel_height_m = max(0.0, state.parcel_height_m + prescribed_w_m_per_s * dt)
    heating_rate_k_per_s = (
        config.surface_heating.max_warming_rate_k_per_s
        * _boundary_layer_heating_weight(config, state.parcel_height_m)
    )
    temperature_k = (
        state.temperature_k
        + (heating_rate_k_per_s - DRY_ADIABATIC_LAPSE_RATE_K_PER_M * prescribed_w_m_per_s) * dt
    )
    vapor = state.water_vapor_kg_per_kg
    cloud = state.cloud_liquid_water_kg_per_kg
    rain = state.rain_water_kg_per_kg

    saturation = _saturation_specific_humidity_kg_per_kg(temperature_k)
    if vapor > saturation:
        condensed = vapor - saturation
        vapor -= condensed
        cloud += condensed
        temperature_k += LATENT_HEATING_K_PER_KG_PER_KG * condensed
    elif cloud > 0.0:
        evaporated = min(cloud, saturation - vapor)
        vapor += evaporated
        cloud -= evaporated
        temperature_k -= LATENT_HEATING_K_PER_KG_PER_KG * evaporated

    if cloud > RAIN_AUTOCONVERSION_THRESHOLD_KG_PER_KG:
        rain_source = min(
            cloud - RAIN_AUTOCONVERSION_THRESHOLD_KG_PER_KG,
            cloud * RAIN_AUTOCONVERSION_PER_SECOND * dt,
        )
        cloud -= rain_source
        rain += rain_source

    if vapor < saturation and rain > 0.0:
        evaporated_rain = min(rain, (saturation - vapor) * RAIN_EVAPORATION_FRACTION_PER_STEP)
        vapor += evaporated_rain
        rain -= evaporated_rain
        temperature_k -= LATENT_HEATING_K_PER_KG_PER_KG * evaporated_rain

    return MicrophysicsLabState(
        step=state.step + 1,
        time_seconds=state.time_seconds + dt,
        parcel_height_m=parcel_height_m,
        temperature_k=temperature_k,
        initial_temperature_k=state.initial_temperature_k,
        water_vapor_kg_per_kg=_bounded(vapor, 0.0, MAX_WATER_VAPOR_KG_PER_KG),
        cloud_liquid_water_kg_per_kg=_bounded(cloud, 0.0, MAX_CLOUD_LIQUID_WATER_KG_PER_KG),
        rain_water_kg_per_kg=_bounded(rain, 0.0, MAX_RAIN_WATER_KG_PER_KG),
    )


def run_simulation(config: SimulationConfig | None = None) -> list[SimulationFrame]:
    resolved_config = config or SimulationConfig(solver_type="microphysics_lab")
    return list(stream_frames(resolved_config))


def stream_frames(config: SimulationConfig) -> Iterator[SimulationFrame]:
    state = initialize_state(config)
    yield state_to_frame(config, state)

    next_frame_time = config.time.frame_interval_seconds
    max_steps = int(config.time.duration_seconds / config.time.time_step_seconds)
    for _step_index in range(max_steps):
        state = step_state(config, state)
        if state.time_seconds + 1e-9 >= next_frame_time:
            yield state_to_frame(config, state)
            next_frame_time += config.time.frame_interval_seconds


def state_to_frame(config: SimulationConfig, state: MicrophysicsLabState) -> SimulationFrame:
    rows = config.grid.rows
    columns = config.grid.columns
    temperature_perturbation = state.temperature_k - state.initial_temperature_k

    return SimulationFrame(
        step=state.step,
        time_seconds=state.time_seconds,
        config=config,
        grid=build_grid_metadata(config),
        fields=make_simulation_fields(
            temperature=_constant_grid(rows, columns, state.temperature_k),
            temperature_perturbation=_constant_grid(rows, columns, temperature_perturbation),
            water_vapor=_constant_grid(rows, columns, state.water_vapor_kg_per_kg),
            cloud_liquid_water=_constant_grid(rows, columns, state.cloud_liquid_water_kg_per_kg),
            rain_water=_constant_grid(rows, columns, state.rain_water_kg_per_kg),
            horizontal_velocity=_constant_grid(rows, columns, 0.0),
            vertical_velocity=_constant_grid(rows, columns, config.background_wind.w_m_per_s),
            dynamic=True,
        ),
    )


def _saturation_specific_humidity_kg_per_kg(temperature_k: float) -> float:
    temperature_c = temperature_k - 273.15
    saturation_vapor_pressure_hpa = 6.112 * exp((17.67 * temperature_c) / (temperature_c + 243.5))
    saturation_vapor_pressure_pa = saturation_vapor_pressure_hpa * 100.0
    pressure_pa = 101_325.0
    return (
        0.622 * saturation_vapor_pressure_pa / (pressure_pa - 0.378 * saturation_vapor_pressure_pa)
    )


def _constant_grid(rows: int, columns: int, value: float) -> Grid:
    return [[float(value) for _column_index in range(columns)] for _row_index in range(rows)]


def _boundary_layer_heating_weight(config: SimulationConfig, parcel_height_m: float) -> float:
    boundary_layer_depth_m = config.initial_atmosphere.boundary_layer_depth_m
    if boundary_layer_depth_m <= 0.0:
        return 0.0

    return _bounded(1.0 - parcel_height_m / boundary_layer_depth_m, 0.0, 1.0)


def _bounded(value: float, minimum: float, maximum: float) -> float:
    return min(max(value, minimum), maximum)

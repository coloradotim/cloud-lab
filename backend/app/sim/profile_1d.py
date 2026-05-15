from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass

from app.sim.profile_diagnostics import classify_cloud_formation_potential
from app.sim.profile_schemas import (
    BoundaryLayer1DConfig,
    BoundaryLayer1DFrame,
    BoundaryLayer1DRun,
    BoundaryLayer1DScenario,
)
from app.sim.thermodynamics import (
    lcl_height_m,
    pressure_at_height_pa,
    relative_humidity_from_specific_humidity,
    saturation_specific_humidity_kg_per_kg,
)

SENSIBLE_HEATING_K_PER_HOUR = 1.6
MOISTURE_FLUX_KG_PER_KG_PER_HOUR = 1.0e-3
HEATING_GROWTH_M_PER_HOUR = 210.0
ENTRAINMENT_GROWTH_M_PER_HOUR = 45.0
ENTRAINMENT_EXCHANGE_PER_HOUR = 0.12
MIXED_LAYER_RELAXATION_FRACTION = 1.0
MIN_MIXED_LAYER_DEPTH_M = 50.0
MIN_WATER_VAPOR_KG_PER_KG = 0.0
MAX_RH_FRACTION = 1.05


@dataclass(frozen=True)
class BoundaryLayer1DState:
    step: int
    time_seconds: float
    z_m: list[float]
    temperature_k: list[float]
    water_vapor_kg_per_kg: list[float]
    mixed_layer_depth_m: float
    lcl_m: float
    surface_heating_accumulated_k: float
    surface_moisture_added_kg_per_kg: float
    entrainment_drying_proxy: float


def boundary_layer_1d_scenarios() -> list[BoundaryLayer1DScenario]:
    """Return built-in backend presets for Evolving Boundary Layer v1."""

    return [
        BoundaryLayer1DScenario(
            slug="morning-stable-layer-breaks-down",
            name="Morning Stable Layer Breaks Down",
            purpose="Baseline daytime warming and mixed-layer growth from a cool morning profile.",
            expected_status="moisture_limited",
            config=BoundaryLayer1DConfig(
                initial_surface_temperature_k=291.15,
                initial_relative_humidity=0.58,
                initial_mixed_layer_depth_m=180.0,
                inversion_height_m=1_600.0,
                inversion_strength_k=2.0,
                surface_heating_strength=0.58,
                surface_moisture_flux_strength=0.28,
                entrainment_strength=0.28,
            ),
        ),
        BoundaryLayer1DScenario(
            slug="moist-surface-cumulus-favorable",
            name="Moist Surface, Cumulus Favorable",
            purpose=(
                "Moist surface flux plus heating lowers LCL enough for shallow-cumulus potential."
            ),
            expected_status="cloud_favorable",
            config=BoundaryLayer1DConfig(
                initial_surface_temperature_k=293.15,
                initial_relative_humidity=0.85,
                free_atmosphere_relative_humidity=0.7,
                inversion_height_m=1_900.0,
                inversion_strength_k=1.5,
                surface_heating_strength=0.72,
                surface_moisture_flux_strength=1.0,
                entrainment_strength=0.22,
            ),
        ),
        BoundaryLayer1DScenario(
            slug="dry-entrainment-suppresses-potential",
            name="Dry Entrainment Suppresses Potential",
            purpose=(
                "Shows how dry air above the mixed layer can suppress potential despite growth."
            ),
            expected_status="dry_entrainment_suppressed",
            config=BoundaryLayer1DConfig(
                initial_relative_humidity=0.72,
                free_atmosphere_relative_humidity=0.12,
                inversion_height_m=2_100.0,
                inversion_strength_k=1.2,
                surface_heating_strength=0.72,
                surface_moisture_flux_strength=0.22,
                entrainment_strength=0.82,
            ),
        ),
        BoundaryLayer1DScenario(
            slug="surface-moisture-flux-enables-potential",
            name="Surface Moisture Flux Enables Potential",
            purpose=(
                "Shows moisture flux changing a dry surface case into a cloud-favorable profile."
            ),
            expected_status="cloud_favorable",
            config=BoundaryLayer1DConfig(
                initial_relative_humidity=0.78,
                free_atmosphere_relative_humidity=0.66,
                inversion_height_m=1_850.0,
                inversion_strength_k=1.6,
                surface_heating_strength=0.75,
                surface_moisture_flux_strength=1.0,
                entrainment_strength=0.18,
            ),
        ),
        BoundaryLayer1DScenario(
            slug="strong-cap-suppresses-growth",
            name="Strong Cap Suppresses Growth",
            purpose=(
                "A nearby strong inversion stalls mixed-layer growth before cloud-favorable depth."
            ),
            expected_status="cap_suppressed",
            config=BoundaryLayer1DConfig(
                initial_relative_humidity=0.7,
                inversion_height_m=850.0,
                inversion_strength_k=6.0,
                surface_heating_strength=0.72,
                surface_moisture_flux_strength=0.5,
                entrainment_strength=0.25,
            ),
        ),
        BoundaryLayer1DScenario(
            slug="no-flux-control",
            name="No-Flux Control",
            purpose="Validation control with negligible heating, moisture flux, and entrainment.",
            expected_status="no_flux_control",
            config=BoundaryLayer1DConfig(
                surface_heating_strength=0.0,
                surface_moisture_flux_strength=0.0,
                entrainment_strength=0.0,
                heating_curve="steady",
            ),
        ),
    ]


def run_profile(config: BoundaryLayer1DConfig | None = None) -> BoundaryLayer1DRun:
    resolved_config = config or BoundaryLayer1DConfig()
    return BoundaryLayer1DRun(
        config=resolved_config, frames=list(stream_profile_frames(resolved_config))
    )


def stream_profile_frames(config: BoundaryLayer1DConfig) -> Iterator[BoundaryLayer1DFrame]:
    state = initialize_profile_state(config)
    yield state_to_profile_frame(config, state)

    next_frame_time = config.frame_interval_seconds
    max_steps = int(config.duration_seconds / config.time_step_seconds)
    for _step_index in range(max_steps):
        state = step_profile_state(config, state)
        if state.time_seconds + 1e-9 >= next_frame_time:
            yield state_to_profile_frame(config, state)
            next_frame_time += config.frame_interval_seconds


def initialize_profile_state(config: BoundaryLayer1DConfig) -> BoundaryLayer1DState:
    dz_m = config.height_m / (config.levels - 1)
    z_m = [index * dz_m for index in range(config.levels)]
    temperature_k = [_initial_temperature_at_height(config, height_m) for height_m in z_m]
    water_vapor = [
        saturation_specific_humidity_kg_per_kg(
            temperature,
            pressure_at_height_pa(
                height_m, scale_temperature_k=config.initial_surface_temperature_k
            ),
        )
        * _initial_rh_at_height(config, height_m)
        for height_m, temperature in zip(z_m, temperature_k, strict=True)
    ]
    mixed_layer_depth_m = config.initial_mixed_layer_depth_m
    lcl_m = _mixed_layer_lcl_m(config, temperature_k, water_vapor, z_m, mixed_layer_depth_m)
    return BoundaryLayer1DState(
        step=0,
        time_seconds=0.0,
        z_m=z_m,
        temperature_k=temperature_k,
        water_vapor_kg_per_kg=water_vapor,
        mixed_layer_depth_m=mixed_layer_depth_m,
        lcl_m=lcl_m,
        surface_heating_accumulated_k=0.0,
        surface_moisture_added_kg_per_kg=0.0,
        entrainment_drying_proxy=0.0,
    )


def step_profile_state(
    config: BoundaryLayer1DConfig,
    state: BoundaryLayer1DState,
) -> BoundaryLayer1DState:
    dt_hours = config.time_step_seconds / 3_600.0
    curve_factor = _heating_curve_factor(config, state.time_seconds)
    heating_increment_k = (
        SENSIBLE_HEATING_K_PER_HOUR * config.surface_heating_strength * curve_factor * dt_hours
    )
    moisture_increment = (
        MOISTURE_FLUX_KG_PER_KG_PER_HOUR * config.surface_moisture_flux_strength * dt_hours
    )
    if (
        config.surface_heating_strength <= 0.0
        and config.surface_moisture_flux_strength <= 0.0
        and config.entrainment_strength <= 0.0
    ):
        return BoundaryLayer1DState(
            step=state.step + 1,
            time_seconds=state.time_seconds + config.time_step_seconds,
            z_m=state.z_m,
            temperature_k=state.temperature_k,
            water_vapor_kg_per_kg=state.water_vapor_kg_per_kg,
            mixed_layer_depth_m=state.mixed_layer_depth_m,
            lcl_m=state.lcl_m,
            surface_heating_accumulated_k=state.surface_heating_accumulated_k,
            surface_moisture_added_kg_per_kg=state.surface_moisture_added_kg_per_kg,
            entrainment_drying_proxy=state.entrainment_drying_proxy,
        )
    cap_resistance = _cap_resistance(config, state.mixed_layer_depth_m)
    growth_m = (
        (
            HEATING_GROWTH_M_PER_HOUR * config.surface_heating_strength * curve_factor
            + ENTRAINMENT_GROWTH_M_PER_HOUR * config.entrainment_strength
        )
        * cap_resistance
        * dt_hours
    )
    mixed_layer_depth_m = min(
        config.height_m,
        max(MIN_MIXED_LAYER_DEPTH_M, state.mixed_layer_depth_m + growth_m),
    )

    mixed_layer_indices = _mixed_layer_indices(state.z_m, mixed_layer_depth_m)
    entrainment_fraction = min(
        0.35,
        ENTRAINMENT_EXCHANGE_PER_HOUR * config.entrainment_strength * cap_resistance * dt_hours,
    )
    above_index = _first_index_above(state.z_m, mixed_layer_depth_m)
    above_temperature = state.temperature_k[above_index]
    above_vapor = state.water_vapor_kg_per_kg[above_index]
    mean_temperature = _mean_at_indices(state.temperature_k, mixed_layer_indices)
    mean_vapor = _mean_at_indices(state.water_vapor_kg_per_kg, mixed_layer_indices)

    mixed_temperature = (
        mean_temperature
        + heating_increment_k
        + entrainment_fraction * (above_temperature - mean_temperature)
    )
    mixed_vapor_before_entrainment = mean_vapor + moisture_increment
    mixed_vapor = max(
        MIN_WATER_VAPOR_KG_PER_KG,
        mixed_vapor_before_entrainment
        + entrainment_fraction * (above_vapor - mixed_vapor_before_entrainment),
    )
    entrainment_drying_increment = max(0.0, mixed_vapor_before_entrainment - mixed_vapor)

    temperature = list(state.temperature_k)
    water_vapor = list(state.water_vapor_kg_per_kg)
    for index in mixed_layer_indices:
        blend = MIXED_LAYER_RELAXATION_FRACTION
        temperature[index] = temperature[index] * (1.0 - blend) + mixed_temperature * blend
        water_vapor[index] = max(
            MIN_WATER_VAPOR_KG_PER_KG,
            water_vapor[index] * (1.0 - blend) + mixed_vapor * blend,
        )

    lcl_m = _mixed_layer_lcl_m(config, temperature, water_vapor, state.z_m, mixed_layer_depth_m)
    return BoundaryLayer1DState(
        step=state.step + 1,
        time_seconds=state.time_seconds + config.time_step_seconds,
        z_m=state.z_m,
        temperature_k=temperature,
        water_vapor_kg_per_kg=water_vapor,
        mixed_layer_depth_m=mixed_layer_depth_m,
        lcl_m=lcl_m,
        surface_heating_accumulated_k=state.surface_heating_accumulated_k + heating_increment_k,
        surface_moisture_added_kg_per_kg=(
            state.surface_moisture_added_kg_per_kg + moisture_increment
        ),
        entrainment_drying_proxy=state.entrainment_drying_proxy + entrainment_drying_increment,
    )


def state_to_profile_frame(
    config: BoundaryLayer1DConfig,
    state: BoundaryLayer1DState,
) -> BoundaryLayer1DFrame:
    relative_humidity_percent = [
        min(
            MAX_RH_FRACTION,
            relative_humidity_from_specific_humidity(
                temperature,
                vapor,
                pressure_at_height_pa(
                    height_m, scale_temperature_k=config.initial_surface_temperature_k
                ),
            ),
        )
        * 100.0
        for height_m, temperature, vapor in zip(
            state.z_m,
            state.temperature_k,
            state.water_vapor_kg_per_kg,
            strict=True,
        )
    ]
    rh_top = _value_near_height(
        state.z_m,
        relative_humidity_percent,
        min(state.mixed_layer_depth_m, config.height_m),
    )
    diagnostics = classify_cloud_formation_potential(
        mixed_layer_depth_m=state.mixed_layer_depth_m,
        lcl_m=state.lcl_m,
        inversion_height_m=config.inversion_height_m,
        inversion_strength_k=config.inversion_strength_k,
        rh_near_mixed_layer_top_percent=rh_top,
        max_relative_humidity_percent=max(relative_humidity_percent),
        surface_heating_accumulated_k=state.surface_heating_accumulated_k,
        surface_moisture_added_kg_per_kg=state.surface_moisture_added_kg_per_kg,
        entrainment_drying_proxy=state.entrainment_drying_proxy,
        surface_heating_strength=config.surface_heating_strength,
        surface_moisture_flux_strength=config.surface_moisture_flux_strength,
        entrainment_strength=config.entrainment_strength,
    )
    return BoundaryLayer1DFrame(
        step=state.step,
        time_seconds=state.time_seconds,
        time_hours_from_sunrise=state.time_seconds / 3_600.0,
        z_m=state.z_m,
        temperature_k=state.temperature_k,
        water_vapor_kg_per_kg=state.water_vapor_kg_per_kg,
        relative_humidity_percent=relative_humidity_percent,
        mixed_layer_depth_m=state.mixed_layer_depth_m,
        lcl_m=state.lcl_m,
        inversion_height_m=config.inversion_height_m,
        inversion_strength_k=config.inversion_strength_k,
        surface_heating_accumulated_k=state.surface_heating_accumulated_k,
        surface_moisture_added_kg_per_kg=state.surface_moisture_added_kg_per_kg,
        entrainment_drying_proxy=state.entrainment_drying_proxy,
        diagnostics=diagnostics,
    )


def _initial_temperature_at_height(config: BoundaryLayer1DConfig, height_m: float) -> float:
    base_temperature = (
        config.initial_surface_temperature_k - config.initial_lapse_rate_k_per_m * height_m
    )
    if height_m <= config.inversion_height_m:
        return base_temperature
    return base_temperature + config.inversion_strength_k


def _initial_rh_at_height(config: BoundaryLayer1DConfig, height_m: float) -> float:
    if height_m <= config.initial_mixed_layer_depth_m:
        return config.initial_relative_humidity
    return config.free_atmosphere_relative_humidity


def _heating_curve_factor(config: BoundaryLayer1DConfig, time_seconds: float) -> float:
    if config.heating_curve == "steady":
        return 1.0
    hours = time_seconds / 3_600.0
    return min(1.0, max(0.15, hours / 2.0))


def _cap_resistance(config: BoundaryLayer1DConfig, mixed_layer_depth_m: float) -> float:
    cap_gap_m = config.inversion_height_m - mixed_layer_depth_m
    if cap_gap_m > 450.0:
        return 1.0
    proximity = max(0.0, 1.0 - max(cap_gap_m, 0.0) / 450.0)
    return 1.0 / (1.0 + proximity * config.inversion_strength_k)


def _mixed_layer_lcl_m(
    config: BoundaryLayer1DConfig,
    temperature_k: list[float],
    water_vapor: list[float],
    z_m: list[float],
    mixed_layer_depth_m: float,
) -> float:
    mixed_layer_indices = _mixed_layer_indices(z_m, mixed_layer_depth_m)
    mean_temperature = _mean_at_indices(temperature_k, mixed_layer_indices)
    mean_vapor = _mean_at_indices(water_vapor, mixed_layer_indices)
    saturation = saturation_specific_humidity_kg_per_kg(
        mean_temperature,
        pressure_at_height_pa(0.0, scale_temperature_k=config.initial_surface_temperature_k),
    )
    rh = min(1.0, max(0.01, mean_vapor / max(saturation, 1e-12)))
    return lcl_height_m(
        mean_temperature,
        rh,
        max_height_m=config.height_m,
    )


def _mixed_layer_indices(z_m: list[float], mixed_layer_depth_m: float) -> list[int]:
    indices = [index for index, height_m in enumerate(z_m) if height_m <= mixed_layer_depth_m]
    if indices:
        return indices
    return [0]


def _first_index_above(z_m: list[float], height_m: float) -> int:
    for index, value in enumerate(z_m):
        if value > height_m:
            return index
    return len(z_m) - 1


def _mean_at_indices(values: list[float], indices: list[int]) -> float:
    return sum(values[index] for index in indices) / len(indices)


def _value_near_height(z_m: list[float], values: list[float], height_m: float) -> float:
    lower_indices = [index for index, height in enumerate(z_m) if height <= height_m]
    if lower_indices:
        return values[lower_indices[-1]]
    return values[0]

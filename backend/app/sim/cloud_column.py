from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass

from app.sim.cloud_column_diagnostics import diagnose_cloud_column
from app.sim.cloud_column_schemas import (
    CloudColumnConfig,
    CloudColumnForcing,
    CloudColumnFrame,
    CloudColumnProfile,
    CloudColumnRun,
    CloudColumnScenario,
    CloudColumnWaterBudgetSummary,
)
from app.sim.thermodynamics import (
    DRY_ADIABATIC_LAPSE_RATE_K_PER_M,
    pressure_at_height_pa,
    relative_humidity_from_specific_humidity,
    saturation_specific_humidity_kg_per_kg,
)

LATENT_HEATING_K_PER_KG_PER_KG = 1_200.0
MAX_RELATIVE_HUMIDITY_PERCENT = 105.0
MIN_WATER_VAPOR_KG_PER_KG = 0.0


@dataclass(frozen=True)
class CloudColumnState:
    step: int
    time_seconds: float
    parcel_height_m: float
    temperature_k: float
    water_vapor_kg_per_kg: float
    cloud_liquid_water_kg_per_kg: float
    total_condensed_kg_per_kg: float
    total_evaporated_kg_per_kg: float
    cap_restricted: bool


def cloud_column_scenarios() -> list[CloudColumnScenario]:
    """Return built-in controlled cloud-column scenarios and validation fixtures."""

    return [
        CloudColumnScenario(
            slug="humid-lifted-column",
            name="Humid Lifted Column",
            purpose="Humid profile with enough prescribed ascent to form cloud.",
            expected_status="cloud_formed",
            config=_scenario_config(relative_humidity=0.94, updraft=1.4),
        ),
        CloudColumnScenario(
            slug="dry-failed-column",
            name="Dry Failed Column",
            purpose="Dry profile lifted by the same prescribed forcing remains cloud-free.",
            expected_status="dry_failed",
            config=_scenario_config(relative_humidity=0.2, updraft=1.4),
        ),
        CloudColumnScenario(
            slug="weak-lift-no-cloud",
            name="Weak Lift / No Cloud",
            purpose="Moist profile with insufficient prescribed lift does not reach saturation.",
            expected_status="lift_too_weak",
            config=_scenario_config(relative_humidity=0.82, updraft=0.2, lift_duration=600.0),
        ),
        CloudColumnScenario(
            slug="stronger-lift-earlier-cloud",
            name="Stronger Lift / Earlier Cloud",
            purpose="Stronger prescribed lift reaches cloud earlier than the baseline humid case.",
            expected_status="cloud_formed",
            config=_scenario_config(relative_humidity=0.94, updraft=2.2),
        ),
        CloudColumnScenario(
            slug="capped-suppressed-column",
            name="Capped / Suppressed Column",
            purpose="A low strong cap restricts prescribed ascent before cloud can form.",
            expected_status="cap_suppressed",
            config=_scenario_config(
                relative_humidity=0.82,
                updraft=1.4,
                inversion_height_m=150.0,
                inversion_strength_k=10.0,
                cap_suppression_strength=1.0,
            ),
        ),
        CloudColumnScenario(
            slug="evaporation-in-subsaturated-layer",
            name="Evaporation In Subsaturated Layer",
            purpose="Existing cloud water evaporates as the parcel enters a subsaturated layer.",
            expected_status="evaporated",
            config=_scenario_config(
                relative_humidity=0.30,
                updraft=0.0,
                lift_duration=0.0,
                initial_cloud=2.0e-5,
            ),
        ),
        CloudColumnScenario(
            slug="no-lift-control",
            name="No-Lift Control",
            purpose="Control case with no prescribed lift remains cloud-free.",
            expected_status="lift_too_weak",
            config=_scenario_config(relative_humidity=0.75, updraft=0.0, lift_duration=0.0),
        ),
    ]


def run_cloud_column(config: CloudColumnConfig | None = None) -> CloudColumnRun:
    resolved_config = config or cloud_column_scenarios()[0].config
    frames = list(stream_cloud_column_frames(resolved_config))
    water_budget = _water_budget(frames)
    diagnostics = diagnose_cloud_column(
        frames=frames,
        forcing=resolved_config.forcing,
        water_budget=water_budget,
        cap_restricted=any(frame.prescribed_lift_m_per_s <= 0.0 for frame in frames[1:])
        and resolved_config.forcing.cap_suppression_strength > 0.0,
    )
    return CloudColumnRun(config=resolved_config, frames=frames, diagnostics=diagnostics)


def stream_cloud_column_frames(config: CloudColumnConfig) -> Iterator[CloudColumnFrame]:
    state = initialize_cloud_column_state(config)
    yield state_to_cloud_column_frame(config, state, prescribed_lift_m_per_s=0.0)

    next_frame_time = config.forcing.frame_interval_seconds
    max_steps = int(config.forcing.runtime_seconds / config.forcing.time_step_seconds)
    for _step_index in range(max_steps):
        state, prescribed_lift = step_cloud_column_state(config, state)
        if state.time_seconds + 1e-9 >= next_frame_time:
            yield state_to_cloud_column_frame(
                config, state, prescribed_lift_m_per_s=prescribed_lift
            )
            next_frame_time += config.forcing.frame_interval_seconds


def initialize_cloud_column_state(config: CloudColumnConfig) -> CloudColumnState:
    surface_temperature = _profile_value_at_height(
        config.profile.temperature_k, config.profile, 0.0
    )
    initial_vapor = _profile_vapor_at_height(config.profile, 0.0)
    initial_cloud = config.forcing.initial_cloud_liquid_water_kg_per_kg
    return CloudColumnState(
        step=0,
        time_seconds=0.0,
        parcel_height_m=0.0,
        temperature_k=surface_temperature,
        water_vapor_kg_per_kg=initial_vapor,
        cloud_liquid_water_kg_per_kg=initial_cloud,
        total_condensed_kg_per_kg=initial_cloud,
        total_evaporated_kg_per_kg=0.0,
        cap_restricted=False,
    )


def step_cloud_column_state(
    config: CloudColumnConfig,
    state: CloudColumnState,
) -> tuple[CloudColumnState, float]:
    forcing = config.forcing
    dt = forcing.time_step_seconds
    lift_active = state.time_seconds < forcing.lift_duration_seconds
    cap_factor = _cap_lift_factor(config, state.parcel_height_m)
    prescribed_lift = forcing.updraft_strength_m_per_s * cap_factor if lift_active else 0.0
    cap_restricted = state.cap_restricted or (lift_active and cap_factor < 0.35)
    next_height = min(config.profile.z_m[-1], state.parcel_height_m + prescribed_lift * dt)
    dz = max(0.0, next_height - state.parcel_height_m)
    environmental_vapor = _profile_vapor_at_height(config.profile, next_height)
    entrainment_fraction = forcing.entrainment_drying_factor * min(0.2, dt / 600.0)
    vapor = max(
        MIN_WATER_VAPOR_KG_PER_KG,
        state.water_vapor_kg_per_kg * (1.0 - entrainment_fraction)
        + environmental_vapor * entrainment_fraction,
    )
    temperature = (
        state.temperature_k
        - DRY_ADIABATIC_LAPSE_RATE_K_PER_M * dz
        + forcing.heating_tendency_k_per_s * dt
    )
    cloud = state.cloud_liquid_water_kg_per_kg
    condensed = 0.0
    evaporated = 0.0
    saturation = saturation_specific_humidity_kg_per_kg(
        temperature,
        pressure_at_height_pa(
            next_height,
            surface_pressure_pa=config.profile.surface_pressure_pa,
            scale_temperature_k=config.profile.temperature_k[0],
        ),
    )
    if vapor > saturation:
        condensed = vapor - saturation
        vapor -= condensed
        cloud += condensed
        temperature += LATENT_HEATING_K_PER_KG_PER_KG * condensed
    elif cloud > 0.0:
        evaporated = min(cloud, saturation - vapor)
        vapor += evaporated
        cloud -= evaporated
        temperature -= LATENT_HEATING_K_PER_KG_PER_KG * evaporated

    return (
        CloudColumnState(
            step=state.step + 1,
            time_seconds=state.time_seconds + dt,
            parcel_height_m=next_height,
            temperature_k=temperature,
            water_vapor_kg_per_kg=max(MIN_WATER_VAPOR_KG_PER_KG, vapor),
            cloud_liquid_water_kg_per_kg=max(0.0, cloud),
            total_condensed_kg_per_kg=state.total_condensed_kg_per_kg + condensed,
            total_evaporated_kg_per_kg=state.total_evaporated_kg_per_kg + evaporated,
            cap_restricted=cap_restricted,
        ),
        prescribed_lift,
    )


def state_to_cloud_column_frame(
    config: CloudColumnConfig,
    state: CloudColumnState,
    *,
    prescribed_lift_m_per_s: float,
) -> CloudColumnFrame:
    pressure_pa = pressure_at_height_pa(
        state.parcel_height_m,
        surface_pressure_pa=config.profile.surface_pressure_pa,
        scale_temperature_k=config.profile.temperature_k[0],
    )
    relative_humidity = relative_humidity_from_specific_humidity(
        state.temperature_k,
        state.water_vapor_kg_per_kg,
        pressure_pa,
    )
    return CloudColumnFrame(
        step=state.step,
        time_seconds=state.time_seconds,
        parcel_height_m=state.parcel_height_m,
        temperature_k=state.temperature_k,
        water_vapor_kg_per_kg=state.water_vapor_kg_per_kg,
        relative_humidity_percent=min(MAX_RELATIVE_HUMIDITY_PERCENT, relative_humidity * 100.0),
        cloud_liquid_water_kg_per_kg=state.cloud_liquid_water_kg_per_kg,
        condensation_rate_proxy_kg_per_kg_s=(
            state.total_condensed_kg_per_kg / max(state.time_seconds, 1.0)
        ),
        evaporation_rate_proxy_kg_per_kg_s=(
            state.total_evaporated_kg_per_kg / max(state.time_seconds, 1.0)
        ),
        prescribed_lift_m_per_s=prescribed_lift_m_per_s,
    )


def _scenario_config(
    *,
    relative_humidity: float,
    updraft: float,
    lift_duration: float = 1_200.0,
    inversion_height_m: float = 1_600.0,
    inversion_strength_k: float = 1.0,
    cap_suppression_strength: float = 0.0,
    initial_cloud: float = 0.0,
) -> CloudColumnConfig:
    z_m = [index * 100.0 for index in range(31)]
    temperature_k = [
        294.15 - 0.0065 * height + (inversion_strength_k if height > inversion_height_m else 0.0)
        for height in z_m
    ]
    relative_humidity_percent = [
        relative_humidity * 100.0 if height <= 1_500.0 else max(25.0, relative_humidity * 60.0)
        for height in z_m
    ]
    return CloudColumnConfig(
        profile=CloudColumnProfile(
            z_m=z_m,
            temperature_k=temperature_k,
            relative_humidity_percent=relative_humidity_percent,
            mixed_layer_depth_m=450.0,
            lcl_m=None,
            inversion_height_m=inversion_height_m,
            inversion_strength_k=inversion_strength_k,
        ),
        forcing=CloudColumnForcing(
            updraft_strength_m_per_s=updraft,
            lift_duration_seconds=lift_duration,
            runtime_seconds=1_800.0,
            time_step_seconds=10.0,
            frame_interval_seconds=60.0,
            cap_suppression_strength=cap_suppression_strength,
            initial_cloud_liquid_water_kg_per_kg=initial_cloud,
        ),
    )


def _profile_vapor_at_height(profile: CloudColumnProfile, height_m: float) -> float:
    if profile.water_vapor_kg_per_kg is not None:
        return _profile_value_at_height(profile.water_vapor_kg_per_kg, profile, height_m)
    temperature = _profile_value_at_height(profile.temperature_k, profile, height_m)
    rh_percent = _profile_value_at_height(
        profile.relative_humidity_percent or [], profile, height_m
    )
    pressure_pa = pressure_at_height_pa(
        height_m,
        surface_pressure_pa=profile.surface_pressure_pa,
        scale_temperature_k=profile.temperature_k[0],
    )
    return saturation_specific_humidity_kg_per_kg(temperature, pressure_pa) * (rh_percent / 100.0)


def _profile_value_at_height(
    values: list[float], profile: CloudColumnProfile, height_m: float
) -> float:
    if height_m <= profile.z_m[0]:
        return values[0]
    for lower_index, upper_index in zip(
        range(len(profile.z_m) - 1),
        range(1, len(profile.z_m)),
        strict=False,
    ):
        lower_height = profile.z_m[lower_index]
        upper_height = profile.z_m[upper_index]
        if lower_height <= height_m <= upper_height:
            span = upper_height - lower_height
            weight = (height_m - lower_height) / span if span > 0.0 else 0.0
            return values[lower_index] * (1.0 - weight) + values[upper_index] * weight
    return values[-1]


def _cap_lift_factor(config: CloudColumnConfig, parcel_height_m: float) -> float:
    cap_height = config.profile.inversion_height_m
    if cap_height is None or config.forcing.cap_suppression_strength <= 0.0:
        return 1.0
    if parcel_height_m < cap_height - 75.0:
        return 1.0
    cap_excess = max(0.0, parcel_height_m - cap_height)
    approach = max(0.0, 1.0 - max(cap_height - parcel_height_m, 0.0) / 75.0)
    cap_strength = (
        config.profile.inversion_strength_k or 0.0
    ) * config.forcing.cap_suppression_strength
    return 1.0 / (1.0 + approach * cap_strength + cap_excess / 100.0)


def _water_budget(frames: list[CloudColumnFrame]) -> CloudColumnWaterBudgetSummary:
    if not frames:
        return CloudColumnWaterBudgetSummary(
            initial_total_water_kg_per_kg=0.0,
            final_total_water_kg_per_kg=0.0,
            max_absolute_drift_kg_per_kg=0.0,
            total_condensed_kg_per_kg=0.0,
            total_evaporated_kg_per_kg=0.0,
        )
    totals = [frame.water_vapor_kg_per_kg + frame.cloud_liquid_water_kg_per_kg for frame in frames]
    initial_total = totals[0]
    return CloudColumnWaterBudgetSummary(
        initial_total_water_kg_per_kg=initial_total,
        final_total_water_kg_per_kg=totals[-1],
        max_absolute_drift_kg_per_kg=max(abs(total - initial_total) for total in totals),
        total_condensed_kg_per_kg=max(frame.cloud_liquid_water_kg_per_kg for frame in frames),
        total_evaporated_kg_per_kg=max(
            frame.evaporation_rate_proxy_kg_per_kg_s * max(frame.time_seconds, 1.0)
            for frame in frames
        ),
    )

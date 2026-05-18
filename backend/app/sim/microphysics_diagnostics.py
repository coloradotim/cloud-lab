from __future__ import annotations

from dataclasses import asdict, dataclass
from math import isfinite
from typing import Literal, cast

from app.sim.schemas import SimulationFrame

CLOUD_PRESENCE_THRESHOLD_KG_PER_KG = 1e-8
RAIN_PRESENCE_THRESHOLD_KG_PER_KG = 1e-10
TOTAL_WATER_DRIFT_TOLERANCE_KG_PER_KG = 1e-8
CONSTANT_TEMPERATURE_TOLERANCE_K = 1e-6
CONSTANT_VAPOR_TOLERANCE_KG_PER_KG = 1e-10
RAIN_AUTOCONVERSION_THRESHOLD_KG_PER_KG = 8e-4

PrecipitationStatus = Literal[
    "no_cloud",
    "cloud_no_rain",
    "rain_threshold_reached",
    "rain_formed",
    "evaporation_limited",
    "not_evaluated",
]


@dataclass(frozen=True)
class MicrophysicsDiagnostics:
    """Run-level warm-rain diagnostics derived from emitted microphysics frames."""

    schema_version: str
    initial_temperature_k: float
    final_temperature_k: float
    initial_water_vapor_kg_per_kg: float
    final_water_vapor_kg_per_kg: float
    initial_cloud_liquid_water_kg_per_kg: float
    final_cloud_liquid_water_kg_per_kg: float
    initial_rain_water_kg_per_kg: float
    final_rain_water_kg_per_kg: float
    final_parcel_height_m: float
    first_cloud_time_seconds: float | None
    first_rain_time_seconds: float | None
    max_cloud_liquid_water_kg_per_kg: float
    max_cloud_liquid_water_time_seconds: float | None
    max_rain_water_kg_per_kg: float
    max_rain_water_time_seconds: float | None
    cloud_water_integral: float
    rain_water_integral: float
    vapor_depletion: float
    total_water_budget_initial: float
    total_water_budget_final: float
    total_water_budget_drift: float
    max_absolute_total_water_drift_kg_per_kg: float
    subcloud_evaporation_proxy: float
    bulk_autoconversion_threshold: float
    precipitation_status: PrecipitationStatus
    precipitation_reason: str
    droplet_payload_status: str
    cooling_rate_before_condensation_k_per_s: float | None
    cooling_rate_after_condensation_k_per_s: float | None
    min_moisture_kg_per_kg: float
    non_finite_value_count: int

    @property
    def initial_total_water_kg_per_kg(self) -> float:
        return self.total_water_budget_initial

    @property
    def final_total_water_kg_per_kg(self) -> float:
        return self.total_water_budget_final

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


def compute_microphysics_diagnostics(frames: list[SimulationFrame]) -> MicrophysicsDiagnostics:
    if not frames:
        return MicrophysicsDiagnostics(
            schema_version="microphysics-diagnostics-v1",
            initial_temperature_k=0.0,
            final_temperature_k=0.0,
            initial_water_vapor_kg_per_kg=0.0,
            final_water_vapor_kg_per_kg=0.0,
            initial_cloud_liquid_water_kg_per_kg=0.0,
            final_cloud_liquid_water_kg_per_kg=0.0,
            initial_rain_water_kg_per_kg=0.0,
            final_rain_water_kg_per_kg=0.0,
            final_parcel_height_m=0.0,
            first_cloud_time_seconds=None,
            first_rain_time_seconds=None,
            max_cloud_liquid_water_kg_per_kg=0.0,
            max_cloud_liquid_water_time_seconds=None,
            max_rain_water_kg_per_kg=0.0,
            max_rain_water_time_seconds=None,
            cloud_water_integral=0.0,
            rain_water_integral=0.0,
            vapor_depletion=0.0,
            total_water_budget_initial=0.0,
            total_water_budget_final=0.0,
            total_water_budget_drift=0.0,
            max_absolute_total_water_drift_kg_per_kg=0.0,
            subcloud_evaporation_proxy=0.0,
            bulk_autoconversion_threshold=RAIN_AUTOCONVERSION_THRESHOLD_KG_PER_KG,
            precipitation_status="not_evaluated",
            precipitation_reason="No microphysics frames were available for diagnostics.",
            droplet_payload_status="not_available",
            cooling_rate_before_condensation_k_per_s=None,
            cooling_rate_after_condensation_k_per_s=None,
            min_moisture_kg_per_kg=0.0,
            non_finite_value_count=0,
        )

    initial = frames[0]
    final = frames[-1]
    totals = [_total_water(frame) for frame in frames]
    initial_total = totals[0]
    final_total = totals[-1]
    cloud_extreme = _max_field_with_time(frames, "cloud_liquid_water_kg_per_kg")
    rain_extreme = _max_field_with_time(frames, "rain_water_kg_per_kg")
    first_cloud_time = _first_time_above(
        frames,
        "cloud_liquid_water_kg_per_kg",
        CLOUD_PRESENCE_THRESHOLD_KG_PER_KG,
    )
    first_rain_time = _first_time_above(
        frames,
        "rain_water_kg_per_kg",
        RAIN_PRESENCE_THRESHOLD_KG_PER_KG,
    )
    subcloud_evaporation_proxy = _subcloud_evaporation_proxy(frames)
    precipitation_status, precipitation_reason = _precipitation_status(
        first_cloud_time=first_cloud_time,
        first_rain_time=first_rain_time,
        max_cloud=cloud_extreme[0],
        max_rain=rain_extreme[0],
        final_rain=_mean_field_value(final, "rain_water_kg_per_kg"),
        subcloud_evaporation_proxy=subcloud_evaporation_proxy,
    )

    return MicrophysicsDiagnostics(
        schema_version="microphysics-diagnostics-v1",
        initial_temperature_k=_mean_field_value(initial, "temperature_k"),
        final_temperature_k=_mean_field_value(final, "temperature_k"),
        initial_water_vapor_kg_per_kg=_mean_field_value(initial, "water_vapor_kg_per_kg"),
        final_water_vapor_kg_per_kg=_mean_field_value(final, "water_vapor_kg_per_kg"),
        initial_cloud_liquid_water_kg_per_kg=_mean_field_value(
            initial,
            "cloud_liquid_water_kg_per_kg",
        ),
        final_cloud_liquid_water_kg_per_kg=_mean_field_value(
            final,
            "cloud_liquid_water_kg_per_kg",
        ),
        initial_rain_water_kg_per_kg=_mean_field_value(initial, "rain_water_kg_per_kg"),
        final_rain_water_kg_per_kg=_mean_field_value(final, "rain_water_kg_per_kg"),
        final_parcel_height_m=final.time_seconds * final.config.background_wind.w_m_per_s,
        first_cloud_time_seconds=first_cloud_time,
        first_rain_time_seconds=first_rain_time,
        max_cloud_liquid_water_kg_per_kg=cloud_extreme[0],
        max_cloud_liquid_water_time_seconds=cloud_extreme[1],
        max_rain_water_kg_per_kg=rain_extreme[0],
        max_rain_water_time_seconds=rain_extreme[1],
        cloud_water_integral=_integrate_frame_mean_field(frames, "cloud_liquid_water_kg_per_kg"),
        rain_water_integral=_integrate_frame_mean_field(frames, "rain_water_kg_per_kg"),
        vapor_depletion=_mean_field_value(initial, "water_vapor_kg_per_kg")
        - _mean_field_value(final, "water_vapor_kg_per_kg"),
        total_water_budget_initial=initial_total,
        total_water_budget_final=final_total,
        total_water_budget_drift=final_total - initial_total,
        max_absolute_total_water_drift_kg_per_kg=max(
            abs(total - initial_total) for total in totals
        ),
        subcloud_evaporation_proxy=subcloud_evaporation_proxy,
        bulk_autoconversion_threshold=RAIN_AUTOCONVERSION_THRESHOLD_KG_PER_KG,
        precipitation_status=precipitation_status,
        precipitation_reason=precipitation_reason,
        droplet_payload_status="not_available",
        cooling_rate_before_condensation_k_per_s=_cooling_rate_before_condensation(frames),
        cooling_rate_after_condensation_k_per_s=_cooling_rate_after_condensation(frames),
        min_moisture_kg_per_kg=_min_moisture(frames),
        non_finite_value_count=_non_finite_value_count(frames),
    )


def _precipitation_status(
    *,
    first_cloud_time: float | None,
    first_rain_time: float | None,
    max_cloud: float,
    max_rain: float,
    final_rain: float,
    subcloud_evaporation_proxy: float,
) -> tuple[PrecipitationStatus, str]:
    if first_cloud_time is None or max_cloud <= CLOUD_PRESENCE_THRESHOLD_KG_PER_KG:
        return "no_cloud", "Cloud water never exceeded the diagnostic presence threshold."

    if first_rain_time is None or max_rain <= RAIN_PRESENCE_THRESHOLD_KG_PER_KG:
        if max_cloud >= RAIN_AUTOCONVERSION_THRESHOLD_KG_PER_KG:
            return (
                "rain_threshold_reached",
                "Cloud water reached the bulk autoconversion threshold but sampled rain water "
                "did not persist above the rain threshold.",
            )
        return (
            "cloud_no_rain",
            "Cloud formed, but cloud water stayed below the bulk autoconversion threshold.",
        )

    if (
        subcloud_evaporation_proxy > RAIN_PRESENCE_THRESHOLD_KG_PER_KG
        and final_rain <= RAIN_PRESENCE_THRESHOLD_KG_PER_KG
    ):
        return (
            "evaporation_limited",
            "Rain water formed but was removed by the diagnostic evaporation proxy before the "
            "final sampled frame.",
        )

    return "rain_formed", "Rain water exceeded the diagnostic presence threshold."


def _mean_field_value(frame: SimulationFrame, field_key: str) -> float:
    values = getattr(frame.fields, field_key).values
    flat_values = [cast(float, value) for row in values for value in row]
    return sum(flat_values) / len(flat_values)


def _max_field_value(frame: SimulationFrame, field_key: str) -> float:
    values = getattr(frame.fields, field_key).values
    return max(cast(float, value) for row in values for value in row)


def _total_water(frame: SimulationFrame) -> float:
    return (
        _mean_field_value(frame, "water_vapor_kg_per_kg")
        + _mean_field_value(frame, "cloud_liquid_water_kg_per_kg")
        + _mean_field_value(frame, "rain_water_kg_per_kg")
    )


def _first_time_above(
    frames: list[SimulationFrame],
    field_key: str,
    threshold: float,
) -> float | None:
    for frame in frames:
        if _max_field_value(frame, field_key) > threshold:
            return frame.time_seconds
    return None


def _max_field_with_time(
    frames: list[SimulationFrame],
    field_key: str,
) -> tuple[float, float | None]:
    max_value = max(_max_field_value(frame, field_key) for frame in frames)
    max_time = next(
        (
            frame.time_seconds
            for frame in frames
            if abs(_max_field_value(frame, field_key) - max_value) < 1e-15
        ),
        None,
    )
    return max_value, max_time


def _integrate_frame_mean_field(frames: list[SimulationFrame], field_key: str) -> float:
    total = 0.0
    for previous, current in zip(frames, frames[1:], strict=False):
        dt = current.time_seconds - previous.time_seconds
        total += (
            0.5
            * (_mean_field_value(previous, field_key) + _mean_field_value(current, field_key))
            * dt
        )
    return total


def _subcloud_evaporation_proxy(frames: list[SimulationFrame]) -> float:
    removed = 0.0
    for previous, current in zip(frames, frames[1:], strict=False):
        rain_change = _mean_field_value(previous, "rain_water_kg_per_kg") - _mean_field_value(
            current,
            "rain_water_kg_per_kg",
        )
        if rain_change > 0.0:
            removed += rain_change
    return removed


def _cooling_rate_before_condensation(frames: list[SimulationFrame]) -> float | None:
    first_cloud_time = _first_time_above(
        frames,
        "cloud_liquid_water_kg_per_kg",
        CLOUD_PRESENCE_THRESHOLD_KG_PER_KG,
    )
    if first_cloud_time is None:
        return _temperature_rate(frames[0], frames[-1])

    pre_cloud_frames = [frame for frame in frames if frame.time_seconds <= first_cloud_time]
    if len(pre_cloud_frames) < 2:
        return None
    return _temperature_rate(pre_cloud_frames[0], pre_cloud_frames[-1])


def _cooling_rate_after_condensation(frames: list[SimulationFrame]) -> float | None:
    first_cloud_time = _first_time_above(
        frames,
        "cloud_liquid_water_kg_per_kg",
        CLOUD_PRESENCE_THRESHOLD_KG_PER_KG,
    )
    if first_cloud_time is None:
        return None

    post_cloud_frames = [frame for frame in frames if frame.time_seconds >= first_cloud_time]
    if len(post_cloud_frames) < 2:
        return None
    return _temperature_rate(post_cloud_frames[0], post_cloud_frames[-1])


def _temperature_rate(start: SimulationFrame, end: SimulationFrame) -> float | None:
    elapsed = end.time_seconds - start.time_seconds
    if elapsed <= 0.0:
        return None
    return (_mean_field_value(end, "temperature_k") - _mean_field_value(start, "temperature_k")) / (
        elapsed
    )


def _min_moisture(frames: list[SimulationFrame]) -> float:
    return min(
        _mean_field_value(frame, field_key)
        for frame in frames
        for field_key in (
            "water_vapor_kg_per_kg",
            "cloud_liquid_water_kg_per_kg",
            "rain_water_kg_per_kg",
        )
    )


def _non_finite_value_count(frames: list[SimulationFrame]) -> int:
    return sum(
        1
        for frame in frames
        for _field_name, field in frame.fields
        for row in field.values
        for value in row
        if not isfinite(value)
    )

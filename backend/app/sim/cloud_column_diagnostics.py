from __future__ import annotations

from app.sim.cloud_column_schemas import (
    CloudColumnDiagnostics,
    CloudColumnForcing,
    CloudColumnForcingSummary,
    CloudColumnFrame,
    CloudColumnStatus,
    CloudColumnWaterBudgetSummary,
)

CLOUD_PRESENCE_THRESHOLD_KG_PER_KG = 1.0e-8
SUBSTANTIAL_CLOUD_THRESHOLD_KG_PER_KG = 5.0e-7


def diagnose_cloud_column(
    *,
    frames: list[CloudColumnFrame],
    forcing: CloudColumnForcing,
    water_budget: CloudColumnWaterBudgetSummary,
    cap_restricted: bool,
) -> CloudColumnDiagnostics:
    """Return deterministic cloud-formation diagnostics for a controlled column."""

    if not frames:
        return CloudColumnDiagnostics(
            cloud_formation_status="not_evaluated",
            cloud_formation_reason="No frames were emitted for this controlled-column run.",
            max_relative_humidity_percent=0.0,
            max_cloud_liquid_water_kg_per_kg=0.0,
            water_budget=water_budget,
            forcing=_forcing_summary(forcing),
        )

    cloudy_frames = [
        frame
        for frame in frames
        if frame.cloud_liquid_water_kg_per_kg > CLOUD_PRESENCE_THRESHOLD_KG_PER_KG
    ]
    saturated_frames = [frame for frame in frames if frame.relative_humidity_percent >= 99.5]
    first_cloud = cloudy_frames[0] if cloudy_frames else None
    max_cloud = max(frame.cloud_liquid_water_kg_per_kg for frame in frames)
    max_rh = max(frame.relative_humidity_percent for frame in frames)
    cloud_top = max((frame.parcel_height_m for frame in cloudy_frames), default=None)
    final_cloud = frames[-1].cloud_liquid_water_kg_per_kg

    status = _classify_status(
        forcing=forcing,
        first_cloud=first_cloud,
        max_cloud=max_cloud,
        max_rh=max_rh,
        final_cloud=final_cloud,
        cap_restricted=cap_restricted,
        evaporated=water_budget.total_evaporated_kg_per_kg > CLOUD_PRESENCE_THRESHOLD_KG_PER_KG,
    )
    return CloudColumnDiagnostics(
        cloud_formation_status=status,
        cloud_formation_reason=_status_reason(status),
        first_saturation_time_seconds=(
            saturated_frames[0].time_seconds if saturated_frames else None
        ),
        first_cloud_time_seconds=first_cloud.time_seconds if first_cloud else None,
        cloud_base_m=first_cloud.parcel_height_m if first_cloud else None,
        cloud_top_proxy_m=cloud_top,
        max_relative_humidity_percent=max_rh,
        max_cloud_liquid_water_kg_per_kg=max_cloud,
        water_budget=water_budget,
        forcing=_forcing_summary(forcing),
    )


def _classify_status(
    *,
    forcing: CloudColumnForcing,
    first_cloud: CloudColumnFrame | None,
    max_cloud: float,
    max_rh: float,
    final_cloud: float,
    cap_restricted: bool,
    evaporated: bool,
) -> CloudColumnStatus:
    if first_cloud is not None and max_cloud > SUBSTANTIAL_CLOUD_THRESHOLD_KG_PER_KG:
        if evaporated and final_cloud <= CLOUD_PRESENCE_THRESHOLD_KG_PER_KG:
            return "evaporated"
        return "cloud_formed"
    if forcing.updraft_strength_m_per_s <= 0.3 or forcing.lift_duration_seconds <= 0.0:
        return "lift_too_weak"
    if cap_restricted:
        return "cap_suppressed"
    return "moisture_limited" if max_rh >= 90.0 else "dry_failed"


def _status_reason(status: CloudColumnStatus) -> str:
    reasons: dict[CloudColumnStatus, str] = {
        "cloud_formed": (
            "Prescribed lift cooled the parcel to saturation, producing cloud liquid water."
        ),
        "dry_failed": (
            "The prescribed lift acted on an environment too dry to approach saturation."
        ),
        "cap_suppressed": (
            "The capping inversion limited prescribed ascent before the parcel could form cloud."
        ),
        "lift_too_weak": (
            "Prescribed lift was absent or too weak to cool the parcel enough for cloud formation."
        ),
        "moisture_limited": (
            "The parcel approached saturation but did not retain enough vapor to produce cloud."
        ),
        "evaporated": ("Cloud formed during prescribed lift, then evaporated in subsaturated air."),
        "not_evaluated": "The controlled-column run did not produce enough data to evaluate.",
    }
    return reasons[status]


def _forcing_summary(forcing: CloudColumnForcing) -> CloudColumnForcingSummary:
    return CloudColumnForcingSummary(
        updraft_strength_m_per_s=forcing.updraft_strength_m_per_s,
        lift_duration_seconds=forcing.lift_duration_seconds,
        entrainment_drying_factor=forcing.entrainment_drying_factor,
        heating_tendency_k_per_s=forcing.heating_tendency_k_per_s,
    )

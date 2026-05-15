from __future__ import annotations

from app.sim.profile_schemas import BoundaryLayer1DDiagnostics, CloudFormationPotentialStatus


def classify_cloud_formation_potential(
    *,
    mixed_layer_depth_m: float,
    lcl_m: float,
    inversion_height_m: float,
    inversion_strength_k: float,
    rh_near_mixed_layer_top_percent: float,
    max_relative_humidity_percent: float,
    surface_heating_accumulated_k: float,
    surface_moisture_added_kg_per_kg: float,
    entrainment_drying_proxy: float,
    surface_heating_strength: float,
    surface_moisture_flux_strength: float,
    entrainment_strength: float,
) -> BoundaryLayer1DDiagnostics:
    """Return deterministic cloud-potential diagnostics for a profile frame."""

    mixed_layer_lcl_difference_m = mixed_layer_depth_m - lcl_m
    cap_gap_m = inversion_height_m - mixed_layer_depth_m
    cap_suppression_index = inversion_strength_k / max(cap_gap_m / 250.0, 0.5)
    no_flux = (
        surface_heating_strength <= 0.02
        and surface_moisture_flux_strength <= 0.02
        and entrainment_strength <= 0.02
        and surface_heating_accumulated_k <= 0.15
    )
    cap_limited = (
        inversion_strength_k >= 4.5 and cap_gap_m <= 350.0 and mixed_layer_lcl_difference_m < 0.0
    )
    dry_entrainment_limited = (
        entrainment_drying_proxy >= 0.0015
        and rh_near_mixed_layer_top_percent < 72.0
        and mixed_layer_lcl_difference_m < 150.0
    )
    moisture_limited = mixed_layer_lcl_difference_m < -250.0 or max_relative_humidity_percent < 68.0
    heating_limited = (
        surface_heating_accumulated_k < 0.8
        and mixed_layer_lcl_difference_m < -100.0
        and not no_flux
    )

    if no_flux:
        status: CloudFormationPotentialStatus = "no_flux_control"
        reason = (
            "No meaningful surface heating or moisture flux was applied, so the "
            "profile stays near its initial state."
        )
    elif cap_limited:
        status = "cap_suppressed"
        reason = (
            "A strong nearby inversion is limiting mixed-layer growth before "
            "the profile reaches cloud-favorable depth."
        )
    elif dry_entrainment_limited:
        status = "dry_entrainment_suppressed"
        reason = (
            "Dry air entrained from above the mixed layer is lowering RH near "
            "the mixed-layer top and raising the effective LCL."
        )
    elif mixed_layer_lcl_difference_m >= -50.0 and rh_near_mixed_layer_top_percent >= 68.0:
        status = "cloud_favorable"
        reason = (
            "The mixed layer has grown to roughly the LCL and RH near the "
            "mixed-layer top is high enough for shallow-cumulus potential."
        )
    elif moisture_limited:
        status = "moisture_limited"
        reason = (
            "The profile remains too dry: LCL stays well above the mixed layer "
            "or peak RH is too low."
        )
    elif heating_limited:
        status = "heating_limited"
        reason = "Surface heating has not deepened the mixed layer enough to approach the LCL."
    else:
        status = "not_favorable_yet"
        reason = (
            "The profile is evolving, but mixed-layer depth, LCL, RH, and cap "
            "state have not yet aligned for shallow-cumulus potential."
        )

    return BoundaryLayer1DDiagnostics(
        cloud_formation_potential_status=status,
        cloud_formation_potential_reason=reason,
        mixed_layer_lcl_difference_m=mixed_layer_lcl_difference_m,
        rh_near_mixed_layer_top_percent=rh_near_mixed_layer_top_percent,
        max_relative_humidity_percent=max_relative_humidity_percent,
        cap_suppression_index=cap_suppression_index,
        heating_limited=heating_limited,
        moisture_limited=moisture_limited,
        cap_limited=cap_limited,
        dry_entrainment_limited=dry_entrainment_limited,
    )

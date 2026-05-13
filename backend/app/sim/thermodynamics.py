from __future__ import annotations

from math import exp

DRY_ADIABATIC_LAPSE_RATE_K_PER_M = 0.0098
EARTH_GRAVITY_M_PER_S2 = 9.81
GAS_CONSTANT_DRY_AIR_J_PER_KG_K = 287.05
SEA_LEVEL_PRESSURE_PA = 101_325.0
BOUSSINESQ_REFERENCE_SURFACE_PRESSURE_PA = 90_000.0
WATER_VAPOR_TO_DRY_AIR_MOLECULAR_WEIGHT_RATIO = 0.622


def pressure_at_height_pa(
    height_m: float,
    *,
    surface_pressure_pa: float = SEA_LEVEL_PRESSURE_PA,
    scale_temperature_k: float = 288.15,
) -> float:
    """Approximate hydrostatic pressure for Boussinesq thermodynamic diagnostics.

    The dynamics remain Boussinesq/incompressible. This profile is only used for
    warm-cloud saturation and LCL calculations so cloud-base diagnostics stop
    assuming one fixed pressure at every height.
    """

    scale_height_m = GAS_CONSTANT_DRY_AIR_J_PER_KG_K * scale_temperature_k / EARTH_GRAVITY_M_PER_S2
    return surface_pressure_pa * exp(-max(0.0, height_m) / scale_height_m)


def saturation_vapor_pressure_pa(temperature_k: float) -> float:
    temperature_c = temperature_k - 273.15
    return 611.2 * exp((17.67 * temperature_c) / (temperature_c + 243.5))


def saturation_specific_humidity_kg_per_kg(
    temperature_k: float,
    pressure_pa: float,
) -> float:
    vapor_pressure_pa = saturation_vapor_pressure_pa(temperature_k)
    denominator = (
        pressure_pa - (1.0 - WATER_VAPOR_TO_DRY_AIR_MOLECULAR_WEIGHT_RATIO) * vapor_pressure_pa
    )
    if denominator <= 0.0:
        return 1.0
    return max(
        0.0,
        WATER_VAPOR_TO_DRY_AIR_MOLECULAR_WEIGHT_RATIO * vapor_pressure_pa / denominator,
    )


def relative_humidity_from_specific_humidity(
    temperature_k: float,
    water_vapor_kg_per_kg: float,
    pressure_pa: float,
) -> float:
    saturation = saturation_specific_humidity_kg_per_kg(temperature_k, pressure_pa)
    return water_vapor_kg_per_kg / max(saturation, 1e-12)


def lcl_height_m(
    surface_temperature_k: float,
    relative_humidity: float,
    *,
    surface_pressure_pa: float = SEA_LEVEL_PRESSURE_PA,
    max_height_m: float = 15_000.0,
) -> float:
    """Estimate LCL by lifting a surface parcel through the pressure profile."""

    rh = min(max(relative_humidity, 1e-6), 1.0)
    surface_saturation = saturation_specific_humidity_kg_per_kg(
        surface_temperature_k,
        surface_pressure_pa,
    )
    vapor = surface_saturation * rh
    if vapor >= surface_saturation:
        return 0.0

    lower_m = 0.0
    upper_m = 100.0
    while upper_m < max_height_m:
        lifted_temperature_k = surface_temperature_k - DRY_ADIABATIC_LAPSE_RATE_K_PER_M * upper_m
        pressure_pa = pressure_at_height_pa(
            upper_m,
            surface_pressure_pa=surface_pressure_pa,
            scale_temperature_k=surface_temperature_k,
        )
        if vapor >= saturation_specific_humidity_kg_per_kg(lifted_temperature_k, pressure_pa):
            break
        lower_m = upper_m
        upper_m *= 2.0
    else:
        return max_height_m

    for _iteration in range(48):
        midpoint_m = (lower_m + upper_m) / 2.0
        lifted_temperature_k = surface_temperature_k - DRY_ADIABATIC_LAPSE_RATE_K_PER_M * midpoint_m
        pressure_pa = pressure_at_height_pa(
            midpoint_m,
            surface_pressure_pa=surface_pressure_pa,
            scale_temperature_k=surface_temperature_k,
        )
        if vapor >= saturation_specific_humidity_kg_per_kg(lifted_temperature_k, pressure_pa):
            upper_m = midpoint_m
        else:
            lower_m = midpoint_m

    return upper_m

from __future__ import annotations

from dataclasses import dataclass
from math import exp, sin

from app.sim.schemas import HeatingPatchConfig, SimulationConfig

Grid = list[list[float]]

HEATING_EDGE_TAPER_FRACTION = 0.25


@dataclass(frozen=True)
class StructuredGrid:
    dx_m: float
    x_coordinates_m: list[float]
    z_coordinates_m: list[float]


def surface_heating_weight(config: SimulationConfig, grid: StructuredGrid, x_m: float) -> float:
    """Return a 0..1 horizontal heating weight from the structured heating config."""
    pattern = config.surface_heating.pattern

    if pattern == "single_patch":
        patches = [
            HeatingPatchConfig(
                center_x_m=config.surface_heating.patch_center_x_m,
                width_m=config.surface_heating.patch_width_m,
                intensity_fraction=1.0,
            )
        ]
        return _combined_patch_weight(patches, grid, x_m)

    if pattern == "two_patches":
        patches = [
            HeatingPatchConfig(
                center_x_m=config.domain.width_m * 0.35,
                width_m=min(config.domain.width_m, config.surface_heating.patch_width_m),
                intensity_fraction=1.0,
            ),
            HeatingPatchConfig(
                center_x_m=config.domain.width_m * 0.65,
                width_m=min(config.domain.width_m, config.surface_heating.patch_width_m),
                intensity_fraction=0.85,
            ),
        ]
        return _combined_patch_weight(patches, grid, x_m)

    if pattern == "broad_plateau":
        patches = [
            HeatingPatchConfig(
                center_x_m=config.domain.width_m * 0.5,
                width_m=config.domain.width_m * 0.65,
                intensity_fraction=0.8,
            )
        ]
        return _combined_patch_weight(patches, grid, x_m)

    if pattern == "weak_random":
        normalized_x = x_m / max(config.domain.width_m, 1.0)
        bumps = [
            _seeded_bump(config.seed, index, normalized_x)
            for index in range(5)
        ]
        return _bounded(max(bumps, default=0.0), 0.0, 0.85)

    return _combined_patch_weight(config.surface_heating.patches, grid, x_m)


def surface_heating_weight_field(config: SimulationConfig, grid: StructuredGrid) -> Grid:
    """Return the surface-heating horizontal pattern broadcast over z for preview/tests."""
    row = [surface_heating_weight(config, grid, x_m) for x_m in grid.x_coordinates_m]
    return [row.copy() for _z_m in grid.z_coordinates_m]


def initial_relative_humidity(config: SimulationConfig, x_m: float, z_m: float) -> float:
    """Return structured initial RH for a location while preserving scalar fallback behavior."""
    base_rh = config.initial_atmosphere.relative_humidity
    profile = config.initial_atmosphere.humidity_profile

    if profile == "surface_moisture":
        source_top = min(
            config.initial_atmosphere.moist_source_layer_depth_m,
            config.initial_atmosphere.boundary_layer_depth_m,
        )
        transition_depth = max(config.domain.height_m * 0.08, 200.0)
        if z_m <= source_top:
            base_rh = config.initial_atmosphere.relative_humidity
        elif z_m >= source_top + transition_depth:
            base_rh = config.initial_atmosphere.free_atmosphere_relative_humidity
        else:
            weight = (z_m - source_top) / transition_depth
            base_rh = (
                config.initial_atmosphere.relative_humidity * (1.0 - weight)
                + config.initial_atmosphere.free_atmosphere_relative_humidity * weight
            )
    elif profile == "moist_boundary_layer":
        if z_m <= config.initial_atmosphere.boundary_layer_depth_m:
            base_rh = max(base_rh, min(1.0, base_rh + 0.12))
        else:
            base_rh = max(0.0, base_rh - 0.08)
    elif profile == "dry_cap":
        cap_center = config.initial_atmosphere.boundary_layer_depth_m
        cap_depth = max(config.domain.height_m * 0.12, 1.0)
        cap_weight = exp(-(((z_m - cap_center) / cap_depth) ** 2))
        base_rh = _bounded(base_rh - 0.28 * cap_weight, 0.0, 1.0)
    elif profile == "moist_layer":
        layer_bottom = config.initial_atmosphere.boundary_layer_depth_m * 0.75
        layer_top = min(
            config.domain.height_m,
            config.initial_atmosphere.boundary_layer_depth_m * 1.55,
        )
        if layer_bottom <= z_m <= layer_top:
            base_rh = max(base_rh, min(1.0, base_rh + 0.18))
    elif profile == "custom_layers":
        for layer in config.initial_atmosphere.humidity_layers:
            if layer.bottom_m <= z_m <= layer.top_m:
                base_rh = layer.relative_humidity
                break

    humidity_patch = config.initial_atmosphere.humidity_patch
    if humidity_patch is not None:
        half_width_m = humidity_patch.width_m / 2.0
        if abs(x_m - humidity_patch.center_x_m) <= half_width_m:
            base_rh = humidity_patch.relative_humidity

    return _bounded(base_rh, 0.0, 1.0)


def initial_relative_humidity_field(config: SimulationConfig, grid: StructuredGrid) -> Grid:
    return [
        [initial_relative_humidity(config, x_m, z_m) for x_m in grid.x_coordinates_m]
        for z_m in grid.z_coordinates_m
    ]


def _combined_patch_weight(
    patches: list[HeatingPatchConfig],
    grid: StructuredGrid,
    x_m: float,
) -> float:
    return _bounded(
        max((_patch_weight(patch, grid, x_m) for patch in patches), default=0.0), 0.0, 1.0
    )


def _patch_weight(patch: HeatingPatchConfig, grid: StructuredGrid, x_m: float) -> float:
    half_width_m = patch.width_m / 2.0
    distance_from_edge_m = abs(x_m - patch.center_x_m) - half_width_m
    if distance_from_edge_m <= 0.0:
        return patch.intensity_fraction

    taper_width_m = max(grid.dx_m, patch.width_m * HEATING_EDGE_TAPER_FRACTION)
    if distance_from_edge_m >= taper_width_m:
        return 0.0

    return patch.intensity_fraction * (1.0 - distance_from_edge_m / taper_width_m)


def _seeded_bump(seed: int, index: int, normalized_x: float) -> float:
    even_center = (index + 1) / 6.0
    center = even_center + 0.06 * (_seeded_unit(seed, index, 0) - 0.5)
    half_width = 0.018 + 0.022 * _seeded_unit(seed, index, 1)
    intensity = 0.35 + 0.45 * _seeded_unit(seed, index, 2)
    distance = abs(normalized_x - center)
    if distance >= half_width:
        return 0.0
    return intensity * (1.0 - distance / half_width)


def _seeded_unit(seed: int, index: int, salt: int) -> float:
    raw = sin(seed * 12.9898 + index * 78.233 + salt * 37.719) * 43_758.5453
    return raw % 1.0


def _bounded(value: float, minimum: float, maximum: float) -> float:
    return min(max(value, minimum), maximum)

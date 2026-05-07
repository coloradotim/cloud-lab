from __future__ import annotations

from dataclasses import dataclass
from math import exp, isfinite

from app.sim.sample import build_grid_metadata, make_simulation_fields
from app.sim.schemas import SimulationConfig, SimulationFrame

Grid = list[list[float]]

DRY_ADIABATIC_LAPSE_RATE_K_PER_M = 0.0098
GRAVITY_M_PER_S2 = 9.81
REFERENCE_TEMPERATURE_K = 300.0
LATENT_HEATING_K_PER_KG_PER_KG = 2_500.0
CONDENSATION_FRACTION_PER_STEP = 0.35
SPONGE_LAYER_DEPTH_CELLS = 2
SPONGE_RELAXATION_PER_SECOND = 0.08
THERMAL_BUOYANCY_SCALE = 0.16
WIND_RESPONSE_SCALE = 0.035
VELOCITY_DAMPING_PER_SECOND = 0.018
THERMAL_DIFFUSIVITY_M2_PER_S = 18.0
MOISTURE_DIFFUSIVITY_M2_PER_S = 9.0
MAX_ABS_VELOCITY_M_PER_S = 12.0
SURFACE_HEATING_LAYER_FRACTION = 0.12
SURFACE_HEATING_EDGE_TAPER_FRACTION = 0.2


@dataclass(frozen=True)
class SolverGrid:
    dx_m: float
    dz_m: float
    x_coordinates_m: list[float]
    z_coordinates_m: list[float]


@dataclass
class AtmosphereState:
    step: int
    time_seconds: float
    temperature_k: Grid
    water_vapor_kg_per_kg: Grid
    cloud_liquid_water_kg_per_kg: Grid
    rain_water_kg_per_kg: Grid
    horizontal_velocity_m_per_s: Grid
    vertical_velocity_m_per_s: Grid
    environmental_temperature_k: Grid


def initialize_state(config: SimulationConfig) -> AtmosphereState:
    """Create deterministic initial fields for a simplified warm-cloud slice."""
    solver_grid = _solver_grid(config)
    temperature: Grid = []
    environmental_temperature: Grid = []
    water_vapor: Grid = []

    for z_m in solver_grid.z_coordinates_m:
        env_temp = _initial_temperature_k(config, z_m)
        env_row = [env_temp for _x_m in solver_grid.x_coordinates_m]
        temp_row = [env_temp for _x_m in solver_grid.x_coordinates_m]
        vapor_row = [
            max(
                0.0,
                _saturation_specific_humidity_kg_per_kg(env_temp)
                * config.initial_atmosphere.relative_humidity,
            )
            for _x_m in solver_grid.x_coordinates_m
        ]
        environmental_temperature.append(env_row)
        temperature.append(temp_row)
        water_vapor.append(vapor_row)

    rows = config.grid.rows
    columns = config.grid.columns
    return AtmosphereState(
        step=0,
        time_seconds=0.0,
        temperature_k=temperature,
        water_vapor_kg_per_kg=water_vapor,
        cloud_liquid_water_kg_per_kg=_constant_grid(rows, columns, 0.0),
        rain_water_kg_per_kg=_constant_grid(rows, columns, 0.0),
        horizontal_velocity_m_per_s=_constant_grid(rows, columns, config.background_wind.u_m_per_s),
        vertical_velocity_m_per_s=_constant_grid(rows, columns, config.background_wind.w_m_per_s),
        environmental_temperature_k=environmental_temperature,
    )


def _initial_temperature_k(config: SimulationConfig, z_m: float) -> float:
    """Well-mixed boundary-layer temperature profile.

    Constant potential temperature implies an approximately dry-adiabatic actual temperature
    decrease in the mixed layer. Above the mixed-layer top, continue from that value with the
    configured environmental lapse rate so the profile remains continuous.
    """
    mixed_layer_depth_m = config.initial_atmosphere.boundary_layer_depth_m
    if z_m <= mixed_layer_depth_m:
        return (
            config.initial_atmosphere.surface_temperature_k - DRY_ADIABATIC_LAPSE_RATE_K_PER_M * z_m
        )

    mixed_layer_top_temperature_k = (
        config.initial_atmosphere.surface_temperature_k
        - DRY_ADIABATIC_LAPSE_RATE_K_PER_M * mixed_layer_depth_m
    )
    return mixed_layer_top_temperature_k - config.initial_atmosphere.lapse_rate_k_per_m * (
        z_m - mixed_layer_depth_m
    )


def step_state(config: SimulationConfig, state: AtmosphereState) -> AtmosphereState:
    """Advance the toy solver by one configured timestep.

    This is a deliberately simple explicit update. It is useful for early visualization and
    regression tests, but it is not a complete atmospheric dynamics model.
    """
    dt = config.time.time_step_seconds
    grid = _solver_grid(config)
    heated_temperature = _apply_surface_heating(config, grid, state.temperature_k, dt)
    advected_temperature = _advect(heated_temperature, state, grid, dt)
    advected_vapor = _clip_non_negative(_advect(state.water_vapor_kg_per_kg, state, grid, dt))
    advected_cloud = _clip_non_negative(
        _advect(state.cloud_liquid_water_kg_per_kg, state, grid, dt)
    )
    diffused_temperature = _diffuse(advected_temperature, grid, dt, THERMAL_DIFFUSIVITY_M2_PER_S)
    lifted_temperature = _apply_vertical_adiabatic_temperature_change(
        diffused_temperature,
        state,
        dt,
    )
    diffused_vapor = _clip_non_negative(
        _diffuse(advected_vapor, grid, dt, MOISTURE_DIFFUSIVITY_M2_PER_S)
    )
    diffused_cloud = _clip_non_negative(
        _diffuse(advected_cloud, grid, dt, MOISTURE_DIFFUSIVITY_M2_PER_S)
    )
    condensation = _condense(config, lifted_temperature, diffused_vapor, diffused_cloud)
    updated_temperature = condensation.temperature_k
    updated_vapor = condensation.water_vapor_kg_per_kg
    updated_cloud = condensation.cloud_liquid_water_kg_per_kg
    updated_rain = state.rain_water_kg_per_kg
    updated_u, updated_w = _update_velocity(config, grid, state, updated_temperature, dt)
    boundary = _apply_boundary_sponge(
        config,
        state,
        updated_temperature,
        updated_vapor,
        updated_cloud,
        updated_rain,
        updated_u,
        updated_w,
        dt,
    )

    return AtmosphereState(
        step=state.step + 1,
        time_seconds=state.time_seconds + dt,
        temperature_k=boundary.temperature_k,
        water_vapor_kg_per_kg=boundary.water_vapor_kg_per_kg,
        cloud_liquid_water_kg_per_kg=boundary.cloud_liquid_water_kg_per_kg,
        rain_water_kg_per_kg=boundary.rain_water_kg_per_kg,
        horizontal_velocity_m_per_s=boundary.horizontal_velocity_m_per_s,
        vertical_velocity_m_per_s=boundary.vertical_velocity_m_per_s,
        environmental_temperature_k=state.environmental_temperature_k,
    )


def run_simulation(config: SimulationConfig | None = None) -> list[SimulationFrame]:
    """Run the minimal solver and emit schema-compatible frames."""
    resolved_config = config or SimulationConfig()
    state = initialize_state(resolved_config)
    frames = [state_to_frame(resolved_config, state)]
    next_frame_time = resolved_config.time.frame_interval_seconds

    max_steps = int(resolved_config.time.duration_seconds / resolved_config.time.time_step_seconds)
    for _step_index in range(max_steps):
        state = step_state(resolved_config, state)
        if state.time_seconds + 1e-9 >= next_frame_time:
            frames.append(state_to_frame(resolved_config, state))
            next_frame_time += resolved_config.time.frame_interval_seconds

    return frames


def state_to_frame(config: SimulationConfig, state: AtmosphereState) -> SimulationFrame:
    return SimulationFrame(
        step=state.step,
        time_seconds=state.time_seconds,
        config=config,
        grid=build_grid_metadata(config),
        fields=make_simulation_fields(
            temperature=state.temperature_k,
            water_vapor=state.water_vapor_kg_per_kg,
            cloud_liquid_water=state.cloud_liquid_water_kg_per_kg,
            rain_water=state.rain_water_kg_per_kg,
            horizontal_velocity=state.horizontal_velocity_m_per_s,
            vertical_velocity=state.vertical_velocity_m_per_s,
            dynamic=True,
        ),
    )


@dataclass(frozen=True)
class _CondensationResult:
    temperature_k: Grid
    water_vapor_kg_per_kg: Grid
    cloud_liquid_water_kg_per_kg: Grid


@dataclass(frozen=True)
class _BoundaryResult:
    temperature_k: Grid
    water_vapor_kg_per_kg: Grid
    cloud_liquid_water_kg_per_kg: Grid
    rain_water_kg_per_kg: Grid
    horizontal_velocity_m_per_s: Grid
    vertical_velocity_m_per_s: Grid


def _condense(
    config: SimulationConfig,
    temperature: Grid,
    water_vapor: Grid,
    cloud_liquid_water: Grid,
) -> _CondensationResult:
    updated_temperature = _copy_grid(temperature)
    updated_vapor = _copy_grid(water_vapor)
    updated_cloud = _copy_grid(cloud_liquid_water)

    for row_index in range(config.grid.rows):
        for column_index in range(config.grid.columns):
            qsat = _saturation_specific_humidity_kg_per_kg(
                updated_temperature[row_index][column_index]
            )
            excess = max(0.0, updated_vapor[row_index][column_index] - qsat)
            condensed = excess * CONDENSATION_FRACTION_PER_STEP
            updated_vapor[row_index][column_index] = max(
                0.0, updated_vapor[row_index][column_index] - condensed
            )
            updated_cloud[row_index][column_index] = max(
                0.0, updated_cloud[row_index][column_index] + condensed
            )
            updated_temperature[row_index][column_index] += (
                LATENT_HEATING_K_PER_KG_PER_KG * condensed
            )

    return _CondensationResult(
        temperature_k=updated_temperature,
        water_vapor_kg_per_kg=updated_vapor,
        cloud_liquid_water_kg_per_kg=updated_cloud,
    )


def _apply_boundary_sponge(
    config: SimulationConfig,
    state: AtmosphereState,
    temperature: Grid,
    water_vapor: Grid,
    cloud_liquid_water: Grid,
    rain_water: Grid,
    horizontal_velocity: Grid,
    vertical_velocity: Grid,
    dt: float,
) -> _BoundaryResult:
    """Relax top/bottom edge cells toward the background state.

    The minimal solver uses closed finite-difference stencils at domain edges. A light sponge
    layer prevents edge cells from acting like artificial condensate reservoirs when a plume
    reaches the top or bottom boundary.
    """
    updated_temperature = _copy_grid(temperature)
    updated_vapor = _copy_grid(water_vapor)
    updated_cloud = _copy_grid(cloud_liquid_water)
    updated_rain = _copy_grid(rain_water)
    updated_u = _copy_grid(horizontal_velocity)
    updated_w = _copy_grid(vertical_velocity)
    rows = len(updated_temperature)

    for row_index in range(rows):
        weight = _sponge_weight(row_index, rows)
        if weight == 0.0:
            continue

        relaxation = min(1.0, SPONGE_RELAXATION_PER_SECOND * dt * weight)
        for column_index in range(len(updated_temperature[row_index])):
            target_temperature = state.environmental_temperature_k[row_index][column_index]
            target_vapor = (
                _saturation_specific_humidity_kg_per_kg(target_temperature)
                * config.initial_atmosphere.relative_humidity
            )
            updated_temperature[row_index][column_index] = _relax(
                updated_temperature[row_index][column_index],
                target_temperature,
                relaxation,
            )
            updated_vapor[row_index][column_index] = _relax(
                updated_vapor[row_index][column_index],
                target_vapor,
                relaxation,
            )
            updated_cloud[row_index][column_index] = _relax(
                updated_cloud[row_index][column_index],
                0.0,
                relaxation,
            )
            updated_rain[row_index][column_index] = _relax(
                updated_rain[row_index][column_index],
                0.0,
                relaxation,
            )
            updated_u[row_index][column_index] = _relax(
                updated_u[row_index][column_index],
                config.background_wind.u_m_per_s,
                relaxation,
            )
            updated_w[row_index][column_index] = _relax(
                updated_w[row_index][column_index],
                config.background_wind.w_m_per_s,
                relaxation,
            )

    return _BoundaryResult(
        temperature_k=updated_temperature,
        water_vapor_kg_per_kg=updated_vapor,
        cloud_liquid_water_kg_per_kg=updated_cloud,
        rain_water_kg_per_kg=updated_rain,
        horizontal_velocity_m_per_s=updated_u,
        vertical_velocity_m_per_s=updated_w,
    )


def _apply_surface_heating(
    config: SimulationConfig,
    grid: SolverGrid,
    temperature: Grid,
    dt: float,
) -> Grid:
    heated = _copy_grid(temperature)
    heating_top_m = config.domain.height_m * SURFACE_HEATING_LAYER_FRACTION
    for row_index, z_m in enumerate(grid.z_coordinates_m):
        vertical_weight = max(0.0, 1.0 - z_m / heating_top_m) if z_m <= heating_top_m else 0.0
        if vertical_weight == 0.0:
            continue

        for column_index, x_m in enumerate(grid.x_coordinates_m):
            horizontal_weight = _surface_heating_weight(config, grid, x_m)
            heated[row_index][column_index] += (
                config.surface_heating.max_warming_rate_k_per_s
                * vertical_weight
                * horizontal_weight
                * dt
            )

    return heated


def _apply_vertical_adiabatic_temperature_change(
    temperature: Grid,
    state: AtmosphereState,
    dt: float,
) -> Grid:
    adjusted = _copy_grid(temperature)

    for row_index, row in enumerate(adjusted):
        for column_index, temperature_k in enumerate(row):
            vertical_displacement_m = state.vertical_velocity_m_per_s[row_index][column_index] * dt
            adjusted[row_index][column_index] = (
                temperature_k - DRY_ADIABATIC_LAPSE_RATE_K_PER_M * vertical_displacement_m
            )

    return adjusted


def _update_velocity(
    config: SimulationConfig,
    grid: SolverGrid,
    state: AtmosphereState,
    temperature: Grid,
    dt: float,
) -> tuple[Grid, Grid]:
    u = _copy_grid(state.horizontal_velocity_m_per_s)
    w = _copy_grid(state.vertical_velocity_m_per_s)
    half_width_m = config.surface_heating.patch_width_m / 2.0

    for row_index, z_m in enumerate(grid.z_coordinates_m):
        lower_layer = max(
            0.0,
            1.0 - z_m / max(config.initial_atmosphere.boundary_layer_depth_m, 1.0),
        )
        upper_layer = z_m / config.domain.height_m
        for column_index, x_m in enumerate(grid.x_coordinates_m):
            temp_perturbation = (
                temperature[row_index][column_index]
                - state.environmental_temperature_k[row_index][column_index]
            )
            buoyancy = GRAVITY_M_PER_S2 * temp_perturbation / REFERENCE_TEMPERATURE_K
            center_offset = (x_m - config.surface_heating.patch_center_x_m) / half_width_m
            plume_weight = _surface_heating_weight(config, grid, x_m)
            circulation_weight = exp(-(center_offset**2))
            circulation = -center_offset * circulation_weight * (lower_layer - 0.35 * upper_layer)

            positive_buoyancy = max(0.0, buoyancy)
            w[row_index][column_index] += (
                THERMAL_BUOYANCY_SCALE * positive_buoyancy * plume_weight * dt
                - VELOCITY_DAMPING_PER_SECOND * w[row_index][column_index] * dt
            )
            u[row_index][column_index] += (
                WIND_RESPONSE_SCALE * circulation * dt
                - VELOCITY_DAMPING_PER_SECOND
                * (u[row_index][column_index] - config.background_wind.u_m_per_s)
                * dt
            )
            w[row_index][column_index] = _clamp(
                w[row_index][column_index], -MAX_ABS_VELOCITY_M_PER_S, MAX_ABS_VELOCITY_M_PER_S
            )
            u[row_index][column_index] = _clamp(
                u[row_index][column_index], -MAX_ABS_VELOCITY_M_PER_S, MAX_ABS_VELOCITY_M_PER_S
            )

    return u, w


def _surface_heating_weight(config: SimulationConfig, grid: SolverGrid, x_m: float) -> float:
    half_width_m = config.surface_heating.patch_width_m / 2.0
    distance_from_edge_m = abs(x_m - config.surface_heating.patch_center_x_m) - half_width_m
    if distance_from_edge_m <= 0.0:
        return 1.0

    taper_width_m = max(
        grid.dx_m,
        config.surface_heating.patch_width_m * SURFACE_HEATING_EDGE_TAPER_FRACTION,
    )
    if distance_from_edge_m >= taper_width_m:
        return 0.0

    return 1.0 - distance_from_edge_m / taper_width_m


def _advect(field: Grid, state: AtmosphereState, grid: SolverGrid, dt: float) -> Grid:
    rows = len(field)
    columns = len(field[0])
    updated = _copy_grid(field)
    courant_x = dt / grid.dx_m
    courant_z = dt / grid.dz_m

    for row_index in range(rows):
        for column_index in range(columns):
            u = state.horizontal_velocity_m_per_s[row_index][column_index]
            w = state.vertical_velocity_m_per_s[row_index][column_index]
            x_upwind = _upwind_x(field, row_index, column_index, u)
            z_upwind = _upwind_z(field, row_index, column_index, w)
            updated[row_index][column_index] = (
                field[row_index][column_index] - u * courant_x * x_upwind - w * courant_z * z_upwind
            )

    return updated


def _diffuse(field: Grid, grid: SolverGrid, dt: float, diffusivity_m2_per_s: float) -> Grid:
    rows = len(field)
    columns = len(field[0])
    updated = _copy_grid(field)
    dx2 = grid.dx_m * grid.dx_m
    dz2 = grid.dz_m * grid.dz_m

    for row_index in range(rows):
        for column_index in range(columns):
            center = field[row_index][column_index]
            left = field[row_index][max(0, column_index - 1)]
            right = field[row_index][min(columns - 1, column_index + 1)]
            below = field[max(0, row_index - 1)][column_index]
            above = field[min(rows - 1, row_index + 1)][column_index]
            laplacian = (left - 2.0 * center + right) / dx2 + (below - 2.0 * center + above) / dz2
            updated[row_index][column_index] = center + diffusivity_m2_per_s * dt * laplacian

    return updated


def _saturation_specific_humidity_kg_per_kg(temperature_k: float) -> float:
    temperature_c = temperature_k - 273.15
    saturation_vapor_pressure_hpa = 6.112 * exp((17.67 * temperature_c) / (temperature_c + 243.5))
    pressure_hpa = 900.0
    mixing_ratio = (
        0.622 * saturation_vapor_pressure_hpa / (pressure_hpa - saturation_vapor_pressure_hpa)
    )
    return max(0.0, mixing_ratio / (1.0 + mixing_ratio))


def _upwind_x(field: Grid, row_index: int, column_index: int, velocity: float) -> float:
    if velocity >= 0.0:
        upstream_column = max(0, column_index - 1)
    else:
        upstream_column = min(len(field[0]) - 1, column_index + 1)
    return field[row_index][column_index] - field[row_index][upstream_column]


def _upwind_z(field: Grid, row_index: int, column_index: int, velocity: float) -> float:
    upstream_row = max(0, row_index - 1) if velocity >= 0.0 else min(len(field) - 1, row_index + 1)
    return field[row_index][column_index] - field[upstream_row][column_index]


def _solver_grid(config: SimulationConfig) -> SolverGrid:
    metadata = build_grid_metadata(config)
    return SolverGrid(
        dx_m=config.domain.width_m / config.grid.columns,
        dz_m=config.domain.height_m / config.grid.rows,
        x_coordinates_m=metadata.x_coordinates_m,
        z_coordinates_m=metadata.z_coordinates_m,
    )


def _constant_grid(rows: int, columns: int, value: float) -> Grid:
    return [[value for _column_index in range(columns)] for _row_index in range(rows)]


def _copy_grid(grid: Grid) -> Grid:
    return [row.copy() for row in grid]


def _clip_non_negative(grid: Grid) -> Grid:
    return [[max(0.0, value) for value in row] for row in grid]


def _clamp(value: float, minimum: float, maximum: float) -> float:
    if not isfinite(value):
        return 0.0
    return min(max(value, minimum), maximum)


def _sponge_weight(row_index: int, rows: int) -> float:
    if rows <= 2:
        return 1.0

    distance_from_edge = min(row_index, rows - 1 - row_index)
    if distance_from_edge >= SPONGE_LAYER_DEPTH_CELLS:
        return 0.0

    return ((SPONGE_LAYER_DEPTH_CELLS - distance_from_edge) / SPONGE_LAYER_DEPTH_CELLS) ** 2


def _relax(value: float, target: float, fraction: float) -> float:
    return value + (target - value) * fraction

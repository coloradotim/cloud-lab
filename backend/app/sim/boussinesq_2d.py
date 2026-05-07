from __future__ import annotations

from dataclasses import dataclass
from math import exp, isfinite

from app.sim.sample import build_grid_metadata, make_simulation_fields
from app.sim.schemas import SimulationConfig, SimulationFrame

Grid = list[list[float]]

DRY_ADIABATIC_LAPSE_RATE_K_PER_M = 0.0098
GRAVITY_M_PER_S2 = 9.81
REFERENCE_TEMPERATURE_K = 300.0
LATENT_HEATING_K_PER_KG_PER_KG = 1_200.0
CONDENSATION_FRACTION_PER_STEP = 0.28
THERMAL_DIFFUSIVITY_M2_PER_S = 22.0
MOISTURE_DIFFUSIVITY_M2_PER_S = 10.0
KINEMATIC_VISCOSITY_M2_PER_S = 45.0
SURFACE_HEATING_LAYER_FRACTION = 0.10
SURFACE_HEATING_EDGE_TAPER_FRACTION = 0.25
POISSON_ITERATIONS = 80
VELOCITY_DAMPING_PER_SECOND = 0.004
TOP_SPONGE_DEPTH_CELLS = 2
TOP_SPONGE_RELAXATION_PER_SECOND = 0.05
MAX_ABS_VELOCITY_M_PER_S = 10.0
MAX_ABS_THETA_PERTURBATION_K = 15.0
MAX_ABS_VORTICITY_PER_SECOND = 0.08


@dataclass(frozen=True)
class SolverGrid:
    dx_m: float
    dz_m: float
    x_coordinates_m: list[float]
    z_coordinates_m: list[float]


@dataclass
class BoussinesqState:
    step: int
    time_seconds: float
    theta_perturbation_k: Grid
    water_vapor_kg_per_kg: Grid
    cloud_liquid_water_kg_per_kg: Grid
    rain_water_kg_per_kg: Grid
    vorticity_per_second: Grid
    horizontal_velocity_m_per_s: Grid
    vertical_velocity_m_per_s: Grid
    environmental_temperature_k: Grid


def initialize_state(config: SimulationConfig) -> BoussinesqState:
    grid = _solver_grid(config)
    environmental_temperature: Grid = []
    water_vapor: Grid = []

    for z_m in grid.z_coordinates_m:
        env_temp = _initial_temperature_k(config, z_m)
        environmental_temperature.append([env_temp for _x_m in grid.x_coordinates_m])
        water_vapor.append(
            [
                max(
                    0.0,
                    _saturation_specific_humidity_kg_per_kg(env_temp)
                    * config.initial_atmosphere.relative_humidity,
                )
                for _x_m in grid.x_coordinates_m
            ]
        )

    rows = config.grid.rows
    columns = config.grid.columns
    return BoussinesqState(
        step=0,
        time_seconds=0.0,
        theta_perturbation_k=_constant_grid(rows, columns, 0.0),
        water_vapor_kg_per_kg=water_vapor,
        cloud_liquid_water_kg_per_kg=_constant_grid(rows, columns, 0.0),
        rain_water_kg_per_kg=_constant_grid(rows, columns, 0.0),
        vorticity_per_second=_constant_grid(rows, columns, 0.0),
        horizontal_velocity_m_per_s=_constant_grid(rows, columns, config.background_wind.u_m_per_s),
        vertical_velocity_m_per_s=_constant_grid(rows, columns, config.background_wind.w_m_per_s),
        environmental_temperature_k=environmental_temperature,
    )


def step_state(config: SimulationConfig, state: BoussinesqState) -> BoussinesqState:
    dt = config.time.time_step_seconds
    grid = _solver_grid(config)

    heated_theta = _apply_surface_heating(config, grid, state.theta_perturbation_k, dt)
    advected_theta = _advect(heated_theta, state, grid, dt)
    diffused_theta = _diffuse(advected_theta, grid, dt, THERMAL_DIFFUSIVITY_M2_PER_S)
    theta = _clip_grid(
        diffused_theta,
        -MAX_ABS_THETA_PERTURBATION_K,
        MAX_ABS_THETA_PERTURBATION_K,
    )

    advected_vapor = _clip_non_negative(_advect(state.water_vapor_kg_per_kg, state, grid, dt))
    vapor = _clip_non_negative(_diffuse(advected_vapor, grid, dt, MOISTURE_DIFFUSIVITY_M2_PER_S))
    advected_cloud = _clip_non_negative(
        _advect(state.cloud_liquid_water_kg_per_kg, state, grid, dt)
    )
    cloud = _clip_non_negative(_diffuse(advected_cloud, grid, dt, MOISTURE_DIFFUSIVITY_M2_PER_S))

    advected_vorticity = _advect(state.vorticity_per_second, state, grid, dt)
    diffused_vorticity = _diffuse(advected_vorticity, grid, dt, KINEMATIC_VISCOSITY_M2_PER_S)
    buoyancy = _buoyancy(theta)
    forced_vorticity = _apply_buoyancy_vorticity_tendency(diffused_vorticity, buoyancy, grid, dt)
    vorticity = _clip_grid(
        forced_vorticity,
        -MAX_ABS_VORTICITY_PER_SECOND,
        MAX_ABS_VORTICITY_PER_SECOND,
    )

    streamfunction = _solve_streamfunction(vorticity, grid)
    u, w = _velocity_from_streamfunction(config, streamfunction, state, grid, dt)
    temperature = _temperature_from_perturbation(theta, state.environmental_temperature_k)
    condensation = _condense(temperature, vapor, cloud)
    theta = _theta_from_temperature(condensation.temperature_k, state.environmental_temperature_k)
    theta, vapor, cloud, vorticity, u, w = _apply_top_sponge(
        theta,
        condensation.water_vapor_kg_per_kg,
        condensation.cloud_liquid_water_kg_per_kg,
        vorticity,
        u,
        w,
        config,
        dt,
    )

    return BoussinesqState(
        step=state.step + 1,
        time_seconds=state.time_seconds + dt,
        theta_perturbation_k=theta,
        water_vapor_kg_per_kg=vapor,
        cloud_liquid_water_kg_per_kg=cloud,
        rain_water_kg_per_kg=state.rain_water_kg_per_kg,
        vorticity_per_second=vorticity,
        horizontal_velocity_m_per_s=u,
        vertical_velocity_m_per_s=w,
        environmental_temperature_k=state.environmental_temperature_k,
    )


def run_simulation(config: SimulationConfig | None = None) -> list[SimulationFrame]:
    resolved_config = config or SimulationConfig(solver_type="boussinesq_2d")
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


def state_to_frame(config: SimulationConfig, state: BoussinesqState) -> SimulationFrame:
    temperature = _temperature_from_perturbation(
        state.theta_perturbation_k,
        state.environmental_temperature_k,
    )
    return SimulationFrame(
        step=state.step,
        time_seconds=state.time_seconds,
        config=config,
        grid=build_grid_metadata(config),
        fields=make_simulation_fields(
            temperature=temperature,
            temperature_perturbation=state.theta_perturbation_k,
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


def _initial_temperature_k(config: SimulationConfig, z_m: float) -> float:
    mixed_layer_depth_m = config.initial_atmosphere.boundary_layer_depth_m
    if z_m <= mixed_layer_depth_m:
        return (
            config.initial_atmosphere.surface_temperature_k - DRY_ADIABATIC_LAPSE_RATE_K_PER_M * z_m
        )

    top_temperature = (
        config.initial_atmosphere.surface_temperature_k
        - DRY_ADIABATIC_LAPSE_RATE_K_PER_M * mixed_layer_depth_m
    )
    return top_temperature - config.initial_atmosphere.lapse_rate_k_per_m * (
        z_m - mixed_layer_depth_m
    )


def _apply_surface_heating(
    config: SimulationConfig,
    grid: SolverGrid,
    theta_perturbation: Grid,
    dt: float,
) -> Grid:
    heated = _copy_grid(theta_perturbation)
    heating_top_m = config.domain.height_m * SURFACE_HEATING_LAYER_FRACTION

    for row_index, z_m in enumerate(grid.z_coordinates_m):
        vertical_weight = max(0.0, 1.0 - z_m / heating_top_m) if z_m <= heating_top_m else 0.0
        if vertical_weight == 0.0:
            continue

        for column_index, x_m in enumerate(grid.x_coordinates_m):
            heated[row_index][column_index] += (
                config.surface_heating.max_warming_rate_k_per_s
                * vertical_weight
                * _surface_heating_weight(config, grid, x_m)
                * dt
            )

    return heated


def _apply_buoyancy_vorticity_tendency(
    vorticity: Grid,
    buoyancy: Grid,
    grid: SolverGrid,
    dt: float,
) -> Grid:
    rows = len(vorticity)
    columns = len(vorticity[0])
    updated = _copy_grid(vorticity)

    for row_index in range(rows):
        for column_index in range(columns):
            left = buoyancy[row_index][max(0, column_index - 1)]
            right = buoyancy[row_index][min(columns - 1, column_index + 1)]
            db_dx = (right - left) / (2.0 * grid.dx_m)
            updated[row_index][column_index] += db_dx * dt

    return updated


def _solve_streamfunction(vorticity: Grid, grid: SolverGrid) -> Grid:
    rows = len(vorticity)
    columns = len(vorticity[0])
    psi = _constant_grid(rows, columns, 0.0)
    dx2 = grid.dx_m * grid.dx_m
    dz2 = grid.dz_m * grid.dz_m
    denominator = 2.0 * (dx2 + dz2)

    for _iteration in range(POISSON_ITERATIONS):
        next_psi = _copy_grid(psi)
        for row_index in range(1, rows - 1):
            for column_index in range(1, columns - 1):
                next_psi[row_index][column_index] = (
                    dz2 * (psi[row_index][column_index - 1] + psi[row_index][column_index + 1])
                    + dx2 * (psi[row_index - 1][column_index] + psi[row_index + 1][column_index])
                    + vorticity[row_index][column_index] * dx2 * dz2
                ) / denominator
        psi = next_psi

    return psi


def _velocity_from_streamfunction(
    config: SimulationConfig,
    streamfunction: Grid,
    previous_state: BoussinesqState,
    grid: SolverGrid,
    dt: float,
) -> tuple[Grid, Grid]:
    rows = len(streamfunction)
    columns = len(streamfunction[0])
    u = _constant_grid(rows, columns, config.background_wind.u_m_per_s)
    w = _constant_grid(rows, columns, config.background_wind.w_m_per_s)
    damping = max(0.0, 1.0 - VELOCITY_DAMPING_PER_SECOND * dt)

    for row_index in range(rows):
        for column_index in range(columns):
            below = streamfunction[max(0, row_index - 1)][column_index]
            above = streamfunction[min(rows - 1, row_index + 1)][column_index]
            left = streamfunction[row_index][max(0, column_index - 1)]
            right = streamfunction[row_index][min(columns - 1, column_index + 1)]
            perturbation_u = (above - below) / (2.0 * grid.dz_m)
            perturbation_w = -(right - left) / (2.0 * grid.dx_m)
            u[row_index][column_index] = _clamp(
                config.background_wind.u_m_per_s
                + damping
                * (
                    perturbation_u
                    + previous_state.horizontal_velocity_m_per_s[row_index][column_index]
                    - config.background_wind.u_m_per_s
                ),
                -MAX_ABS_VELOCITY_M_PER_S,
                MAX_ABS_VELOCITY_M_PER_S,
            )
            w[row_index][column_index] = _clamp(
                config.background_wind.w_m_per_s
                + damping
                * (
                    perturbation_w
                    + previous_state.vertical_velocity_m_per_s[row_index][column_index]
                    - config.background_wind.w_m_per_s
                ),
                -MAX_ABS_VELOCITY_M_PER_S,
                MAX_ABS_VELOCITY_M_PER_S,
            )

    return u, w


def _condense(
    temperature: Grid,
    water_vapor: Grid,
    cloud_liquid_water: Grid,
) -> _CondensationResult:
    updated_temperature = _copy_grid(temperature)
    updated_vapor = _copy_grid(water_vapor)
    updated_cloud = _copy_grid(cloud_liquid_water)

    for row_index, row in enumerate(updated_temperature):
        for column_index, temperature_k in enumerate(row):
            qsat = _saturation_specific_humidity_kg_per_kg(temperature_k)
            excess = max(0.0, updated_vapor[row_index][column_index] - qsat)
            condensed = excess * CONDENSATION_FRACTION_PER_STEP
            updated_vapor[row_index][column_index] = max(
                0.0,
                updated_vapor[row_index][column_index] - condensed,
            )
            updated_cloud[row_index][column_index] += condensed
            updated_temperature[row_index][column_index] += (
                LATENT_HEATING_K_PER_KG_PER_KG * condensed
            )

    return _CondensationResult(
        temperature_k=updated_temperature,
        water_vapor_kg_per_kg=updated_vapor,
        cloud_liquid_water_kg_per_kg=updated_cloud,
    )


def _apply_top_sponge(
    theta: Grid,
    vapor: Grid,
    cloud: Grid,
    vorticity: Grid,
    u: Grid,
    w: Grid,
    config: SimulationConfig,
    dt: float,
) -> tuple[Grid, Grid, Grid, Grid, Grid, Grid]:
    updated_theta = _copy_grid(theta)
    updated_vapor = _copy_grid(vapor)
    updated_cloud = _copy_grid(cloud)
    updated_vorticity = _copy_grid(vorticity)
    updated_u = _copy_grid(u)
    updated_w = _copy_grid(w)
    rows = len(theta)

    for row_index in range(rows):
        weight = _top_sponge_weight(row_index, rows)
        if weight == 0.0:
            continue

        relaxation = min(1.0, TOP_SPONGE_RELAXATION_PER_SECOND * dt * weight)
        for column_index in range(len(theta[row_index])):
            updated_theta[row_index][column_index] = _relax(
                updated_theta[row_index][column_index],
                0.0,
                relaxation,
            )
            updated_cloud[row_index][column_index] = _relax(
                updated_cloud[row_index][column_index],
                0.0,
                relaxation,
            )
            updated_vorticity[row_index][column_index] = _relax(
                updated_vorticity[row_index][column_index],
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

    return updated_theta, updated_vapor, updated_cloud, updated_vorticity, updated_u, updated_w


def _advect(field: Grid, state: BoussinesqState, grid: SolverGrid, dt: float) -> Grid:
    rows = len(field)
    columns = len(field[0])
    updated = _copy_grid(field)
    courant_x = dt / grid.dx_m
    courant_z = dt / grid.dz_m

    for row_index in range(rows):
        for column_index in range(columns):
            u = state.horizontal_velocity_m_per_s[row_index][column_index]
            w = state.vertical_velocity_m_per_s[row_index][column_index]
            updated[row_index][column_index] = (
                field[row_index][column_index]
                - u * courant_x * _upwind_x(field, row_index, column_index, u)
                - w * courant_z * _upwind_z(field, row_index, column_index, w)
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


def _buoyancy(theta_perturbation: Grid) -> Grid:
    return [
        [GRAVITY_M_PER_S2 * value / REFERENCE_TEMPERATURE_K for value in row]
        for row in theta_perturbation
    ]


def _temperature_from_perturbation(
    theta_perturbation: Grid,
    environmental_temperature: Grid,
) -> Grid:
    return [
        [
            environmental_temperature[row_index][column_index]
            + theta_perturbation[row_index][column_index]
            for column_index in range(len(row))
        ]
        for row_index, row in enumerate(theta_perturbation)
    ]


def _theta_from_temperature(temperature: Grid, environmental_temperature: Grid) -> Grid:
    return [
        [
            temperature[row_index][column_index]
            - environmental_temperature[row_index][column_index]
            for column_index in range(len(row))
        ]
        for row_index, row in enumerate(temperature)
    ]


def _saturation_specific_humidity_kg_per_kg(temperature_k: float) -> float:
    temperature_c = temperature_k - 273.15
    saturation_vapor_pressure_hpa = 6.112 * exp((17.67 * temperature_c) / (temperature_c + 243.5))
    pressure_hpa = 900.0
    mixing_ratio = (
        0.622 * saturation_vapor_pressure_hpa / (pressure_hpa - saturation_vapor_pressure_hpa)
    )
    return max(0.0, mixing_ratio / (1.0 + mixing_ratio))


def _upwind_x(field: Grid, row_index: int, column_index: int, velocity: float) -> float:
    upstream_column = (
        max(0, column_index - 1) if velocity >= 0.0 else min(len(field[0]) - 1, column_index + 1)
    )
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


def _clip_grid(grid: Grid, minimum: float, maximum: float) -> Grid:
    return [[_clamp(value, minimum, maximum) for value in row] for row in grid]


def _top_sponge_weight(row_index: int, rows: int) -> float:
    distance_from_top = rows - 1 - row_index
    if distance_from_top >= TOP_SPONGE_DEPTH_CELLS:
        return 0.0
    return ((TOP_SPONGE_DEPTH_CELLS - distance_from_top) / TOP_SPONGE_DEPTH_CELLS) ** 2


def _relax(value: float, target: float, fraction: float) -> float:
    return value + (target - value) * fraction


def _clamp(value: float, minimum: float, maximum: float) -> float:
    if not isfinite(value):
        return 0.0
    return min(max(value, minimum), maximum)

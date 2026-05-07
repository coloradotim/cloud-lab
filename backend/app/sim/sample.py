from collections.abc import Callable
from random import Random

from app.sim.schemas import (
    DisplayScale,
    FieldMetadata,
    GridMetadata,
    ScalarField2D,
    SimulationConfig,
    SimulationFields,
    SimulationFrame,
)


def build_grid_metadata(config: SimulationConfig) -> GridMetadata:
    column_spacing_m = config.domain.width_m / config.grid.columns
    row_spacing_m = config.domain.height_m / config.grid.rows

    return GridMetadata(
        columns=config.grid.columns,
        rows=config.grid.rows,
        x_coordinates_m=[
            (column_index + 0.5) * column_spacing_m for column_index in range(config.grid.columns)
        ],
        z_coordinates_m=[
            (row_index + 0.5) * row_spacing_m for row_index in range(config.grid.rows)
        ],
    )


def create_sample_frame(config: SimulationConfig | None = None) -> SimulationFrame:
    """Create a deterministic placeholder frame that exercises the shared data contract."""
    resolved_config = config or SimulationConfig()
    grid = build_grid_metadata(resolved_config)
    rng = Random(resolved_config.seed)

    temperature = _build_grid(
        grid,
        lambda _x_m, z_m: (
            resolved_config.initial_atmosphere.surface_temperature_k
            - resolved_config.initial_atmosphere.lapse_rate_k_per_m * z_m
        ),
    )
    water_vapor = _build_grid(
        grid,
        lambda _x_m, z_m: max(
            0.0,
            0.012
            * resolved_config.initial_atmosphere.relative_humidity
            * (1.0 - 0.55 * z_m / resolved_config.domain.height_m),
        ),
    )
    zero_grid = _build_grid(grid, lambda _x_m, _z_m: 0.0)
    u_grid = _build_grid(
        grid,
        lambda _x_m, _z_m: resolved_config.background_wind.u_m_per_s + (rng.random() - 0.5) * 0.02,
    )
    w_grid = _build_grid(grid, lambda _x_m, _z_m: resolved_config.background_wind.w_m_per_s)

    return SimulationFrame(
        step=0,
        time_seconds=0.0,
        config=resolved_config,
        grid=grid,
        fields=make_simulation_fields(
            temperature=temperature,
            water_vapor=water_vapor,
            cloud_liquid_water=zero_grid,
            rain_water=zero_grid,
            horizontal_velocity=u_grid,
            vertical_velocity=w_grid,
            dynamic=False,
        ),
    )


def make_simulation_fields(
    *,
    temperature: list[list[float]],
    water_vapor: list[list[float]],
    cloud_liquid_water: list[list[float]],
    rain_water: list[list[float]],
    horizontal_velocity: list[list[float]],
    vertical_velocity: list[list[float]],
    dynamic: bool,
) -> SimulationFields:
    description_suffix = "solver field" if dynamic else "placeholder field"

    return SimulationFields(
        temperature_k=ScalarField2D(
            values=temperature,
            metadata=FieldMetadata(
                unit="K",
                display_name="Temperature",
                description=f"Absolute air temperature {description_suffix}.",
                display_scale=DisplayScale(min_value=270.0, max_value=305.0, color_map="magma"),
            ),
        ),
        water_vapor_kg_per_kg=ScalarField2D(
            values=water_vapor,
            metadata=FieldMetadata(
                unit="kg kg-1",
                display_name="Water vapor",
                description=f"Specific humidity {description_suffix}.",
                display_scale=DisplayScale(min_value=0.0, max_value=0.014, color_map="viridis"),
            ),
        ),
        cloud_liquid_water_kg_per_kg=ScalarField2D(
            values=cloud_liquid_water,
            metadata=FieldMetadata(
                unit="kg kg-1",
                display_name="Cloud liquid water",
                description="Condensed warm-cloud liquid water.",
                display_scale=DisplayScale(min_value=0.0, max_value=0.002, color_map="Blues"),
            ),
        ),
        rain_water_kg_per_kg=ScalarField2D(
            values=rain_water,
            metadata=FieldMetadata(
                unit="kg kg-1",
                display_name="Rain water",
                description="Rain water placeholder retained for schema stability.",
                display_scale=DisplayScale(min_value=0.0, max_value=0.002, color_map="PuBu"),
            ),
        ),
        horizontal_velocity_m_per_s=ScalarField2D(
            values=horizontal_velocity,
            metadata=FieldMetadata(
                unit="m s-1",
                display_name="Horizontal velocity",
                description="Horizontal air velocity.",
                display_scale=DisplayScale(min_value=-5.0, max_value=5.0, color_map="coolwarm"),
            ),
        ),
        vertical_velocity_m_per_s=ScalarField2D(
            values=vertical_velocity,
            metadata=FieldMetadata(
                unit="m s-1",
                display_name="Vertical velocity",
                description="Vertical air velocity.",
                display_scale=DisplayScale(min_value=-2.0, max_value=2.0, color_map="coolwarm"),
            ),
        ),
    )


def _build_grid(grid: GridMetadata, value_at: Callable[[float, float], float]) -> list[list[float]]:
    return [
        [float(value_at(x_m, z_m)) for x_m in grid.x_coordinates_m] for z_m in grid.z_coordinates_m
    ]

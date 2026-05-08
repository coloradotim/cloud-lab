from __future__ import annotations

from dataclasses import dataclass
from math import isfinite, sqrt

from app.sim.presets import fair_weather_cumulus_preset
from app.sim.schemas import (
    BackgroundWindConfig,
    DomainConfig,
    GridConfig,
    InitialAtmosphereConfig,
    SimulationConfig,
    SimulationFrame,
    SurfaceHeatingConfig,
    TimeConfig,
)

CLOUD_TOP_THRESHOLD_KG_PER_KG = 1e-6
DIVERGENCE_VELOCITY_FLOOR_M_PER_S = 1e-3


@dataclass(frozen=True)
class BoussinesqReferenceCase:
    slug: str
    name: str
    description: str
    config: SimulationConfig


@dataclass(frozen=True)
class BoussinesqModelSize:
    slug: str
    name: str
    description: str
    config_updates: dict[str, object]


@dataclass(frozen=True)
class BoussinesqDiagnostics:
    max_abs_horizontal_velocity_m_per_s: float
    max_abs_vertical_velocity_m_per_s: float
    max_velocity_m_per_s: float
    mean_velocity_m_per_s: float
    max_temperature_perturbation_k: float
    min_temperature_perturbation_k: float
    max_water_vapor_kg_per_kg: float
    max_cloud_liquid_water_kg_per_kg: float
    total_cloud_liquid_water_kg_per_kg: float
    cloud_top_height_m: float | None
    max_cloud_liquid_water_height_m: float | None
    max_abs_divergence_per_second: float
    mean_abs_divergence_per_second: float
    rms_divergence_per_second: float
    max_dimensionless_divergence: float
    rms_dimensionless_divergence: float
    non_finite_value_count: int
    min_moisture_kg_per_kg: float


def boussinesq_reference_cases() -> list[BoussinesqReferenceCase]:
    base = fair_weather_cumulus_preset().config
    return [
        BoussinesqReferenceCase(
            slug="quiet-atmosphere",
            name="Quiet atmosphere / no forcing",
            description="Saturated but unforced slice; should not invent motion or condensate.",
            config=_reference_config(
                base,
                duration_seconds=600.0,
                relative_humidity=1.0,
                heating_rate=0.0,
                lapse_rate=0.0065,
                wind_u=0.0,
                seed=11,
            ),
        ),
        BoussinesqReferenceCase(
            slug="dry-thermal-bubble",
            name="Dry thermal bubble",
            description="Dry heated patch; should create buoyant circulation without cloud water.",
            config=_reference_config(
                base,
                duration_seconds=900.0,
                relative_humidity=0.45,
                heating_rate=0.016,
                lapse_rate=0.0075,
                wind_u=0.0,
                seed=13,
            ),
        ),
        BoussinesqReferenceCase(
            slug="humid-lifted-thermal",
            name="Humid lifted thermal",
            description="Humid heated patch; should couple uplift and saturation adjustment.",
            config=_reference_config(
                base,
                duration_seconds=1_200.0,
                relative_humidity=0.98,
                heating_rate=0.022,
                lapse_rate=0.0065,
                wind_u=0.15,
                seed=17,
            ),
        ),
        BoussinesqReferenceCase(
            slug="stable-suppression",
            name="Stable stratification suppression",
            description="More stable profile; should weaken vertical development.",
            config=_reference_config(
                base,
                duration_seconds=1_200.0,
                relative_humidity=0.95,
                heating_rate=0.016,
                lapse_rate=0.0035,
                wind_u=0.15,
                seed=19,
            ),
        ),
        BoussinesqReferenceCase(
            slug="fair-weather-boussinesq",
            name="Fair-weather Boussinesq baseline",
            description="Baseline humid heated Boussinesq run for manual comparison.",
            config=_reference_config(
                base,
                duration_seconds=1_200.0,
                relative_humidity=0.98,
                heating_rate=0.018,
                lapse_rate=0.0065,
                wind_u=0.25,
                seed=23,
            ),
        ),
    ]


def boussinesq_model_sizes() -> list[BoussinesqModelSize]:
    return [
        BoussinesqModelSize(
            slug="small",
            name="Small / quick",
            description="Fast interactive sanity check for local iteration and CI-like runs.",
            config_updates={
                "domain": DomainConfig(width_m=8_000.0, height_m=3_000.0),
                "grid": GridConfig(columns=30, rows=20),
                "time": TimeConfig(
                    time_step_seconds=2.0,
                    duration_seconds=600.0,
                    frame_interval_seconds=20.0,
                ),
            },
        ),
        BoussinesqModelSize(
            slug="medium",
            name="Medium / standard",
            description="Default manual validation scale with about 20 minutes of simulated time.",
            config_updates={
                "domain": DomainConfig(width_m=10_000.0, height_m=3_000.0),
                "grid": GridConfig(columns=36, rows=24),
                "time": TimeConfig(
                    time_step_seconds=2.0,
                    duration_seconds=1_200.0,
                    frame_interval_seconds=30.0,
                ),
            },
        ),
        BoussinesqModelSize(
            slug="large",
            name="Large / slow",
            description="Higher-resolution local inspection; expected to be slower on laptops.",
            config_updates={
                "domain": DomainConfig(width_m=12_000.0, height_m=4_000.0),
                "grid": GridConfig(columns=54, rows=36),
                "time": TimeConfig(
                    time_step_seconds=2.0,
                    duration_seconds=1_800.0,
                    frame_interval_seconds=30.0,
                ),
            },
        ),
    ]


def compute_boussinesq_diagnostics(frame: SimulationFrame) -> BoussinesqDiagnostics:
    fields = frame.fields
    divergence = compute_divergence_field(frame)
    speed = _speed_grid(
        fields.horizontal_velocity_m_per_s.values,
        fields.vertical_velocity_m_per_s.values,
    )
    max_velocity = _max(speed)
    mean_velocity = _mean(speed)
    max_abs_divergence = _max_abs(divergence)
    rms_divergence = _rms(divergence)
    length_scale_m = min(
        frame.config.domain.width_m / frame.grid.columns,
        frame.config.domain.height_m / frame.grid.rows,
    )
    dimensionless_velocity_scale = max(max_velocity, DIVERGENCE_VELOCITY_FLOOR_M_PER_S)
    cloud_top_height_m: float | None = None
    max_cloud_height_m: float | None = None
    max_cloud = _max(fields.cloud_liquid_water_kg_per_kg.values)
    for row_index, row in enumerate(fields.cloud_liquid_water_kg_per_kg.values):
        if max(row) > CLOUD_TOP_THRESHOLD_KG_PER_KG:
            cloud_top_height_m = frame.grid.z_coordinates_m[row_index]
        if max_cloud > 0.0 and max(row) == max_cloud:
            max_cloud_height_m = frame.grid.z_coordinates_m[row_index]

    moisture_values = [
        value
        for field in (
            fields.water_vapor_kg_per_kg,
            fields.cloud_liquid_water_kg_per_kg,
            fields.rain_water_kg_per_kg,
        )
        for row in field.values
        for value in row
    ]
    all_values = [value for field in fields for row in field[1].values for value in row]

    return BoussinesqDiagnostics(
        max_abs_horizontal_velocity_m_per_s=_max_abs(fields.horizontal_velocity_m_per_s.values),
        max_abs_vertical_velocity_m_per_s=_max_abs(fields.vertical_velocity_m_per_s.values),
        max_velocity_m_per_s=max_velocity,
        mean_velocity_m_per_s=mean_velocity,
        max_temperature_perturbation_k=_max(fields.temperature_perturbation_k.values),
        min_temperature_perturbation_k=_min(fields.temperature_perturbation_k.values),
        max_water_vapor_kg_per_kg=_max(fields.water_vapor_kg_per_kg.values),
        max_cloud_liquid_water_kg_per_kg=max_cloud,
        total_cloud_liquid_water_kg_per_kg=sum(
            value for row in fields.cloud_liquid_water_kg_per_kg.values for value in row
        ),
        cloud_top_height_m=cloud_top_height_m,
        max_cloud_liquid_water_height_m=max_cloud_height_m,
        max_abs_divergence_per_second=max_abs_divergence,
        mean_abs_divergence_per_second=_mean_abs(divergence),
        rms_divergence_per_second=rms_divergence,
        max_dimensionless_divergence=(
            max_abs_divergence * length_scale_m / dimensionless_velocity_scale
        ),
        rms_dimensionless_divergence=(
            rms_divergence * length_scale_m / dimensionless_velocity_scale
        ),
        non_finite_value_count=sum(1 for value in all_values if not isfinite(value)),
        min_moisture_kg_per_kg=min(moisture_values),
    )


def compute_divergence_field(frame: SimulationFrame) -> list[list[float]]:
    """Compute du/dx + dw/dz on the frame grid in s^-1."""

    u = frame.fields.horizontal_velocity_m_per_s.values
    w = frame.fields.vertical_velocity_m_per_s.values
    dx_m = frame.config.domain.width_m / frame.grid.columns
    dz_m = frame.config.domain.height_m / frame.grid.rows
    rows = frame.grid.rows
    columns = frame.grid.columns
    divergence: list[list[float]] = []

    for row_index in range(rows):
        divergence_row: list[float] = []
        for column_index in range(columns):
            du_dx = _grid_derivative_x(u, row_index, column_index, dx_m)
            dw_dz = _grid_derivative_z(w, row_index, column_index, dz_m)
            divergence_row.append(du_dx + dw_dz)
        divergence.append(divergence_row)

    return divergence


def _reference_config(
    base: SimulationConfig,
    *,
    duration_seconds: float,
    relative_humidity: float,
    heating_rate: float,
    lapse_rate: float,
    wind_u: float,
    seed: int,
) -> SimulationConfig:
    return base.model_copy(
        update={
            "solver_type": "boussinesq_2d",
            "domain": DomainConfig(width_m=10_000.0, height_m=3_000.0),
            "grid": GridConfig(columns=36, rows=24),
            "time": TimeConfig(
                time_step_seconds=2.0,
                duration_seconds=duration_seconds,
                frame_interval_seconds=30.0,
            ),
            "initial_atmosphere": InitialAtmosphereConfig(
                surface_temperature_k=298.15,
                lapse_rate_k_per_m=lapse_rate,
                relative_humidity=relative_humidity,
                boundary_layer_depth_m=1_000.0,
            ),
            "surface_heating": SurfaceHeatingConfig(
                max_warming_rate_k_per_s=heating_rate,
                patch_center_x_m=5_000.0,
                patch_width_m=2_000.0,
            ),
            "background_wind": BackgroundWindConfig(u_m_per_s=wind_u, w_m_per_s=0.0),
            "seed": seed,
        }
    )


def _max_abs(grid: list[list[float]]) -> float:
    return max(abs(value) for row in grid for value in row)


def _mean_abs(grid: list[list[float]]) -> float:
    values = [abs(value) for row in grid for value in row]
    return sum(values) / len(values)


def _mean(grid: list[list[float]]) -> float:
    values = [value for row in grid for value in row]
    return sum(values) / len(values)


def _rms(grid: list[list[float]]) -> float:
    values = [value for row in grid for value in row]
    return sqrt(sum(value * value for value in values) / len(values))


def _max(grid: list[list[float]]) -> float:
    return max(value for row in grid for value in row)


def _min(grid: list[list[float]]) -> float:
    return min(value for row in grid for value in row)


def _speed_grid(
    horizontal_velocity: list[list[float]],
    vertical_velocity: list[list[float]],
) -> list[list[float]]:
    return [
        [
            sqrt(
                horizontal_velocity[row_index][column_index]
                * horizontal_velocity[row_index][column_index]
                + vertical_velocity[row_index][column_index]
                * vertical_velocity[row_index][column_index]
            )
            for column_index in range(len(row))
        ]
        for row_index, row in enumerate(horizontal_velocity)
    ]


def _grid_derivative_x(
    grid: list[list[float]],
    row_index: int,
    column_index: int,
    dx_m: float,
) -> float:
    columns = len(grid[0])
    if column_index == 0:
        return (grid[row_index][1] - grid[row_index][0]) / dx_m
    if column_index == columns - 1:
        return (grid[row_index][columns - 1] - grid[row_index][columns - 2]) / dx_m
    return (grid[row_index][column_index + 1] - grid[row_index][column_index - 1]) / (2.0 * dx_m)


def _grid_derivative_z(
    grid: list[list[float]],
    row_index: int,
    column_index: int,
    dz_m: float,
) -> float:
    rows = len(grid)
    if row_index == 0:
        return (grid[1][column_index] - grid[0][column_index]) / dz_m
    if row_index == rows - 1:
        return (grid[rows - 1][column_index] - grid[rows - 2][column_index]) / dz_m
    return (grid[row_index + 1][column_index] - grid[row_index - 1][column_index]) / (2.0 * dz_m)

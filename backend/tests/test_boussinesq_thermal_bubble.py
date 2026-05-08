from dataclasses import dataclass
from math import exp

from app.sim.boussinesq_2d import initialize_state, state_to_frame, step_state
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


@dataclass(frozen=True)
class ThermalBubbleDiagnostics:
    time_seconds: float
    max_vertical_velocity_m_per_s: float
    bubble_center_height_m: float
    max_temperature_height_m: float
    max_cloud_liquid_water_kg_per_kg: float
    horizontal_circulation_symmetry_ratio: float


def test_dry_thermal_bubble_rises_and_stays_cloud_free() -> None:
    diagnostics = _run_thermal_bubble_benchmark()

    max_vertical_velocity_by_time = [item.max_vertical_velocity_m_per_s for item in diagnostics]
    bubble_center_heights = [item.bubble_center_height_m for item in diagnostics]
    max_temperature_heights = [item.max_temperature_height_m for item in diagnostics]
    rise_rate_m_per_s = (bubble_center_heights[-1] - bubble_center_heights[0]) / diagnostics[
        -1
    ].time_seconds

    assert max_vertical_velocity_by_time[1] > 0.05
    assert max(max_vertical_velocity_by_time) > 0.2
    assert bubble_center_heights[-1] - bubble_center_heights[0] > 40.0
    assert max_temperature_heights[-1] >= max_temperature_heights[0]
    assert max(max_temperature_heights) > max_temperature_heights[0]
    assert 0.05 < rise_rate_m_per_s < 0.5
    assert all(
        current + 1.0 >= previous
        for previous, current in zip(bubble_center_heights, bubble_center_heights[1:], strict=False)
    )
    assert max(item.max_cloud_liquid_water_kg_per_kg for item in diagnostics) == 0.0
    assert max(item.horizontal_circulation_symmetry_ratio for item in diagnostics[1:]) < 0.25


def _run_thermal_bubble_benchmark() -> list[ThermalBubbleDiagnostics]:
    config = _thermal_bubble_config()
    state = initialize_state(config)
    grid = state_to_frame(config, state).grid

    for row_index, z_m in enumerate(grid.z_coordinates_m):
        for column_index, x_m in enumerate(grid.x_coordinates_m):
            state.theta_perturbation_k[row_index][column_index] = 3.0 * exp(
                -((x_m - config.domain.width_m / 2.0) ** 2 + (z_m - 700.0) ** 2)
                / (2.0 * 500.0 * 500.0)
            )

    diagnostics: list[ThermalBubbleDiagnostics] = []
    frame_interval_steps = int(config.time.frame_interval_seconds / config.time.time_step_seconds)
    max_steps = int(config.time.duration_seconds / config.time.time_step_seconds)

    for step_index in range(max_steps + 1):
        if step_index % frame_interval_steps == 0:
            diagnostics.append(_thermal_bubble_diagnostics(state_to_frame(config, state)))
        if step_index < max_steps:
            state = step_state(config, state)

    return diagnostics


def _thermal_bubble_config() -> SimulationConfig:
    return SimulationConfig(
        solver_type="boussinesq_2d",
        domain=DomainConfig(width_m=8_000.0, height_m=3_000.0),
        grid=GridConfig(columns=40, rows=24),
        time=TimeConfig(
            time_step_seconds=2.0,
            duration_seconds=300.0,
            frame_interval_seconds=60.0,
        ),
        initial_atmosphere=InitialAtmosphereConfig(
            surface_temperature_k=298.15,
            lapse_rate_k_per_m=0.0065,
            relative_humidity=0.0,
            boundary_layer_depth_m=1_000.0,
        ),
        surface_heating=SurfaceHeatingConfig(
            max_warming_rate_k_per_s=0.0,
            patch_center_x_m=4_000.0,
            patch_width_m=1_500.0,
        ),
        background_wind=BackgroundWindConfig(u_m_per_s=0.0, w_m_per_s=0.0),
        seed=39,
    )


def _thermal_bubble_diagnostics(frame: SimulationFrame) -> ThermalBubbleDiagnostics:
    temperature_perturbation = frame.fields.temperature_perturbation_k.values
    positive_theta_total = sum(max(value, 0.0) for row in temperature_perturbation for value in row)
    bubble_center_height = (
        sum(
            max(value, 0.0) * frame.grid.z_coordinates_m[row_index]
            for row_index, row in enumerate(temperature_perturbation)
            for value in row
        )
        / positive_theta_total
    )

    max_temperature_height = frame.grid.z_coordinates_m[
        max(
            range(frame.grid.rows),
            key=lambda row_index: max(temperature_perturbation[row_index]),
        )
    ]

    return ThermalBubbleDiagnostics(
        time_seconds=frame.time_seconds,
        max_vertical_velocity_m_per_s=max(
            value for row in frame.fields.vertical_velocity_m_per_s.values for value in row
        ),
        bubble_center_height_m=bubble_center_height,
        max_temperature_height_m=max_temperature_height,
        max_cloud_liquid_water_kg_per_kg=max(
            value for row in frame.fields.cloud_liquid_water_kg_per_kg.values for value in row
        ),
        horizontal_circulation_symmetry_ratio=_horizontal_symmetry_ratio(frame),
    )


def _horizontal_symmetry_ratio(frame: SimulationFrame) -> float:
    horizontal_velocity = frame.fields.horizontal_velocity_m_per_s.values
    center_column = frame.grid.columns // 2
    left_max_speed = max(abs(value) for row in horizontal_velocity for value in row[:center_column])
    right_max_speed = max(
        abs(value) for row in horizontal_velocity for value in row[center_column:]
    )
    reference_speed = max(left_max_speed, right_max_speed)
    if reference_speed == 0.0:
        return 0.0
    return abs(left_max_speed - right_max_speed) / reference_speed

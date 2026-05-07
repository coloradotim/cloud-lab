from pydantic import BaseModel, Field

from app.sim.schemas import (
    BackgroundWindConfig,
    DomainConfig,
    GridConfig,
    InitialAtmosphereConfig,
    SimulationConfig,
    SurfaceHeatingConfig,
    TimeConfig,
)


class SimulationPreset(BaseModel):
    slug: str = Field(description="Stable preset identifier.")
    name: str = Field(description="Human-readable preset name.")
    description: str = Field(description="Preset intent and expected behavior.")
    config: SimulationConfig


def fair_weather_cumulus_preset() -> SimulationPreset:
    return SimulationPreset(
        slug="fair-weather-cumulus",
        name="Fair-weather cumulus over heated ground",
        description=(
            "A humid boundary-layer slice with localized surface heating, light background "
            "wind, and enough runtime to produce visible thermals and cloud liquid water."
        ),
        config=SimulationConfig(
            domain=DomainConfig(width_m=10_000.0, height_m=3_000.0),
            grid=GridConfig(columns=36, rows=24),
            time=TimeConfig(
                time_step_seconds=2.0,
                duration_seconds=120.0,
                frame_interval_seconds=6.0,
            ),
            initial_atmosphere=InitialAtmosphereConfig(
                surface_temperature_k=298.15,
                lapse_rate_k_per_m=0.0098,
                relative_humidity=1.0,
                boundary_layer_depth_m=1_000.0,
            ),
            surface_heating=SurfaceHeatingConfig(
                max_warming_rate_k_per_s=0.012,
                patch_center_x_m=5_000.0,
                patch_width_m=2_000.0,
            ),
            background_wind=BackgroundWindConfig(u_m_per_s=0.25, w_m_per_s=0.0),
            seed=3,
        ),
    )


def simulation_presets() -> list[SimulationPreset]:
    return [fair_weather_cumulus_preset()]

from pydantic import BaseModel, Field


class SimulationConfig(BaseModel):
    """Configuration for a reproducible 2-D vertical-slice simulation run."""

    width_m: float = Field(default=10_000.0, gt=0, description="Horizontal domain width in meters.")
    height_m: float = Field(default=3_000.0, gt=0, description="Vertical domain height in meters.")
    grid_columns: int = Field(default=100, gt=1, description="Horizontal grid cell count.")
    grid_rows: int = Field(default=60, gt=1, description="Vertical grid cell count.")
    seed: int = Field(default=1, description="Deterministic random seed for reproducible runs.")


class SimulationFrame(BaseModel):
    """Stable frame envelope for future live simulation output."""

    step: int = Field(ge=0, description="Zero-based simulation step index.")
    elapsed_seconds: float = Field(ge=0, description="Simulated elapsed time in seconds.")
    config: SimulationConfig

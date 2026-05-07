"""Simulation core package.

This package must stay independent from API and frontend code so cloud physics can be
tested, reused, and evolved without browser or transport concerns.
"""

from app.sim.sample import build_grid_metadata, create_sample_frame
from app.sim.schemas import (
    BackgroundWindConfig,
    DisplayScale,
    DomainConfig,
    FieldMetadata,
    GridConfig,
    GridMetadata,
    InitialAtmosphereConfig,
    ScalarField2D,
    SimulationConfig,
    SimulationFields,
    SimulationFrame,
    SurfaceHeatingConfig,
    TimeConfig,
)

__all__ = [
    "BackgroundWindConfig",
    "DisplayScale",
    "DomainConfig",
    "FieldMetadata",
    "GridConfig",
    "GridMetadata",
    "InitialAtmosphereConfig",
    "ScalarField2D",
    "SimulationConfig",
    "SimulationFields",
    "SimulationFrame",
    "SurfaceHeatingConfig",
    "TimeConfig",
    "build_grid_metadata",
    "create_sample_frame",
]

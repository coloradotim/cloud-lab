"""Simulation core package.

This package must stay independent from API and frontend code so cloud physics can be
tested, reused, and evolved without browser or transport concerns.
"""

from app.sim.runs import RunStatus, SimulationRun, SimulationRunManager, run_manager
from app.sim.sample import build_grid_metadata, create_sample_frame, make_simulation_fields
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
from app.sim.solver import (
    AtmosphereState,
    initialize_state,
    run_simulation,
    state_to_frame,
    step_state,
)
from app.sim.streaming import stream_run

__all__ = [
    "AtmosphereState",
    "BackgroundWindConfig",
    "DisplayScale",
    "DomainConfig",
    "FieldMetadata",
    "GridConfig",
    "GridMetadata",
    "InitialAtmosphereConfig",
    "RunStatus",
    "ScalarField2D",
    "SimulationConfig",
    "SimulationFields",
    "SimulationFrame",
    "SimulationRun",
    "SimulationRunManager",
    "SurfaceHeatingConfig",
    "TimeConfig",
    "build_grid_metadata",
    "create_sample_frame",
    "initialize_state",
    "make_simulation_fields",
    "run_simulation",
    "run_manager",
    "state_to_frame",
    "step_state",
    "stream_run",
]

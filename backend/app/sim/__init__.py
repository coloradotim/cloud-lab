"""Simulation core package.

This package must stay independent from API and frontend code so cloud physics can be
tested, reused, and evolved without browser or transport concerns.
"""

from app.sim.presets import SimulationPreset, fair_weather_cumulus_preset, simulation_presets
from app.sim.runs import RunStatus, SimulationRun, SimulationRunManager, run_manager
from app.sim.sample import build_grid_metadata, create_sample_frame, make_simulation_fields
from app.sim.schemas import (
    BackgroundWindConfig,
    DisplayScale,
    DomainConfig,
    FieldMetadata,
    GridConfig,
    GridMetadata,
    HeatingPatchConfig,
    HumidityLayerConfig,
    HumidityPatchConfig,
    InitialAtmosphereConfig,
    ScalarField2D,
    SimulationConfig,
    SimulationFields,
    SimulationFrame,
    SolverType,
    SurfaceHeatingConfig,
    TimeConfig,
)
from app.sim.solver import (
    SUPPORTED_SOLVER_TYPES,
    AtmosphereState,
    initialize_state,
    run_simulation,
    solver_descriptors,
    state_to_frame,
    step_state,
    stream_simulation_frames,
)
from app.sim.streaming import stream_run
from app.sim.validation import (
    DIVERGENCE_VELOCITY_FLOOR_M_PER_S,
    BoussinesqDiagnostics,
    BoussinesqModelSize,
    BoussinesqReferenceCase,
    boussinesq_model_sizes,
    boussinesq_reference_cases,
    compute_boussinesq_diagnostics,
    compute_divergence_field,
)

__all__ = [
    "AtmosphereState",
    "BackgroundWindConfig",
    "BoussinesqDiagnostics",
    "BoussinesqModelSize",
    "BoussinesqReferenceCase",
    "DIVERGENCE_VELOCITY_FLOOR_M_PER_S",
    "DisplayScale",
    "DomainConfig",
    "FieldMetadata",
    "GridConfig",
    "GridMetadata",
    "HeatingPatchConfig",
    "HumidityLayerConfig",
    "HumidityPatchConfig",
    "InitialAtmosphereConfig",
    "RunStatus",
    "SUPPORTED_SOLVER_TYPES",
    "ScalarField2D",
    "SimulationConfig",
    "SimulationFields",
    "SimulationFrame",
    "SimulationPreset",
    "SolverType",
    "SimulationRun",
    "SimulationRunManager",
    "SurfaceHeatingConfig",
    "TimeConfig",
    "build_grid_metadata",
    "boussinesq_model_sizes",
    "boussinesq_reference_cases",
    "compute_boussinesq_diagnostics",
    "compute_divergence_field",
    "create_sample_frame",
    "fair_weather_cumulus_preset",
    "initialize_state",
    "make_simulation_fields",
    "run_simulation",
    "run_manager",
    "simulation_presets",
    "solver_descriptors",
    "state_to_frame",
    "step_state",
    "stream_simulation_frames",
    "stream_run",
]

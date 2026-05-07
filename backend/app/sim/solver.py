from __future__ import annotations

from collections.abc import Iterator

from app.sim import educational_2d
from app.sim.schemas import SimulationConfig, SimulationFrame, SolverType
from app.sim.solver_interface import SolverBackend, SolverDescriptor

AtmosphereState = educational_2d.AtmosphereState


class Educational2DBackend:
    descriptor = SolverDescriptor(
        solver_type="educational_2d",
        name="Educational 2-D",
        description=(
            "Current V1 warm-cloud slice for learning, UI validation, and regression tests."
        ),
        status="available",
        limitations=(
            "No pressure solve or incompressible/anelastic projection.",
            "No mass-conserving velocity field.",
            "Educational saturation adjustment and thermal-circulation approximations.",
        ),
    )

    def run(self, config: SimulationConfig) -> list[SimulationFrame]:
        return list(self.stream_frames(config))

    def stream_frames(self, config: SimulationConfig) -> Iterator[SimulationFrame]:
        state = educational_2d.initialize_state(config)
        yield educational_2d.state_to_frame(config, state)

        next_frame_time = config.time.frame_interval_seconds
        max_steps = int(config.time.duration_seconds / config.time.time_step_seconds)
        for _step_index in range(max_steps):
            state = educational_2d.step_state(config, state)
            if state.time_seconds + 1e-9 >= next_frame_time:
                yield educational_2d.state_to_frame(config, state)
                next_frame_time += config.time.frame_interval_seconds


class PlaceholderBackend:
    def __init__(self, descriptor: SolverDescriptor) -> None:
        self.descriptor = descriptor

    def run(self, config: SimulationConfig) -> list[SimulationFrame]:
        raise NotImplementedError(f"{self.descriptor.solver_type} is not implemented yet")

    def stream_frames(self, config: SimulationConfig) -> Iterator[SimulationFrame]:
        raise NotImplementedError(f"{self.descriptor.solver_type} is not implemented yet")


_BACKENDS: dict[SolverType, SolverBackend] = {
    "educational_2d": Educational2DBackend(),
    "boussinesq_2d": PlaceholderBackend(
        SolverDescriptor(
            solver_type="boussinesq_2d",
            name="Boussinesq 2-D",
            description="Future pressure-coupled 2-D dynamics backend.",
            status="planned",
            limitations=("Placeholder only; not available for runs yet.",),
        )
    ),
}

SUPPORTED_SOLVER_TYPES = tuple(_BACKENDS.keys())


def run_simulation(config: SimulationConfig | None = None) -> list[SimulationFrame]:
    """Run a simulation through the configured solver backend."""
    resolved_config = config or SimulationConfig()
    return _available_backend(resolved_config.solver_type).run(resolved_config)


def stream_simulation_frames(config: SimulationConfig) -> Iterator[SimulationFrame]:
    """Yield simulation frames through the configured solver backend."""
    return _available_backend(config.solver_type).stream_frames(config)


def solver_descriptors() -> list[SolverDescriptor]:
    return [backend.descriptor for backend in _BACKENDS.values()]


def initialize_state(config: SimulationConfig) -> educational_2d.AtmosphereState:
    """Initialize the educational 2-D solver state.

    This compatibility function keeps existing tests and callers explicit while the project grows
    a multi-solver interface.
    """
    _require_educational_solver(config)
    return educational_2d.initialize_state(config)


def step_state(
    config: SimulationConfig,
    state: educational_2d.AtmosphereState,
) -> educational_2d.AtmosphereState:
    """Advance one educational 2-D solver step."""
    _require_educational_solver(config)
    return educational_2d.step_state(config, state)


def state_to_frame(
    config: SimulationConfig,
    state: educational_2d.AtmosphereState,
) -> SimulationFrame:
    """Serialize an educational 2-D state to the shared frame schema."""
    _require_educational_solver(config)
    return educational_2d.state_to_frame(config, state)


def _require_educational_solver(config: SimulationConfig) -> None:
    if config.solver_type != "educational_2d":
        raise ValueError("Stateful stepping currently supports only solver_type='educational_2d'")


def _available_backend(solver_type: SolverType) -> SolverBackend:
    backend = _BACKENDS[solver_type]
    if backend.descriptor.status != "available":
        raise ValueError(f"Solver backend '{solver_type}' is {backend.descriptor.status}")
    return backend

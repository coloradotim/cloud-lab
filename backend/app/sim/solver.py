from __future__ import annotations

from collections.abc import Iterator

from app.sim import boussinesq_2d, educational_2d, microphysics_lab
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


class Boussinesq2DBackend:
    descriptor = SolverDescriptor(
        solver_type="boussinesq_2d",
        name="Boussinesq 2-D",
        description=(
            "Prototype streamfunction-vorticity backend with incompressible 2-D flow, buoyancy "
            "from temperature perturbation, and simple warm-cloud saturation adjustment."
        ),
        status="available",
        limitations=(
            "Prototype finite-difference dynamics, not a validated atmospheric model.",
            "No turbulence closure, terrain, Coriolis force, precipitation sedimentation, or ice.",
            "Simple saturation adjustment remains intentionally minimal.",
        ),
    )

    def run(self, config: SimulationConfig) -> list[SimulationFrame]:
        return list(self.stream_frames(config))

    def stream_frames(self, config: SimulationConfig) -> Iterator[SimulationFrame]:
        state = boussinesq_2d.initialize_state(config)
        yield boussinesq_2d.state_to_frame(config, state)

        next_frame_time = config.time.frame_interval_seconds
        max_steps = int(config.time.duration_seconds / config.time.time_step_seconds)
        for _step_index in range(max_steps):
            state = boussinesq_2d.step_state(config, state)
            if state.time_seconds + 1e-9 >= next_frame_time:
                yield boussinesq_2d.state_to_frame(config, state)
                next_frame_time += config.time.frame_interval_seconds


class MicrophysicsLabBackend:
    descriptor = SolverDescriptor(
        solver_type="microphysics_lab",
        name="Microphysics Lab",
        description=(
            "Controlled parcel/box warm-cloud microphysics mode with prescribed lift, "
            "adiabatic cooling, saturation adjustment, and simple bulk rain conversion."
        ),
        status="available",
        limitations=(
            "No resolved 2-D dynamics or Boussinesq velocity coupling.",
            "Bulk placeholder microphysics, not PySDM and not a validated cloud model.",
            "Scalar parcel/box state is broadcast over the shared 2-D frame grid.",
        ),
    )

    def run(self, config: SimulationConfig) -> list[SimulationFrame]:
        return microphysics_lab.run_simulation(config)

    def stream_frames(self, config: SimulationConfig) -> Iterator[SimulationFrame]:
        return microphysics_lab.stream_frames(config)


_BACKENDS: dict[SolverType, SolverBackend] = {
    "educational_2d": Educational2DBackend(),
    "boussinesq_2d": Boussinesq2DBackend(),
    "microphysics_lab": MicrophysicsLabBackend(),
}

SUPPORTED_SOLVER_TYPES = tuple(_BACKENDS.keys())
PUBLIC_SOLVER_TYPES: tuple[SolverType, ...] = ("boussinesq_2d", "microphysics_lab")


def run_simulation(config: SimulationConfig | None = None) -> list[SimulationFrame]:
    """Run a simulation through the configured solver backend."""
    resolved_config = config or SimulationConfig(solver_type="boussinesq_2d")
    return _available_backend(resolved_config.solver_type).run(resolved_config)


def stream_simulation_frames(config: SimulationConfig) -> Iterator[SimulationFrame]:
    """Yield simulation frames through the configured solver backend."""
    return _available_backend(config.solver_type).stream_frames(config)


def solver_descriptors() -> list[SolverDescriptor]:
    return [_BACKENDS[solver_type].descriptor for solver_type in PUBLIC_SOLVER_TYPES]


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

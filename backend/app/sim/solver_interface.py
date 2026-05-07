from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass
from typing import Protocol

from app.sim.schemas import SimulationConfig, SimulationFrame


@dataclass(frozen=True)
class SolverDescriptor:
    solver_type: str
    name: str
    description: str
    status: str
    limitations: tuple[str, ...] = ()


class SolverBackend(Protocol):
    descriptor: SolverDescriptor

    def run(self, config: SimulationConfig) -> list[SimulationFrame]:
        """Run a complete simulation and return shared-schema frames."""

    def stream_frames(self, config: SimulationConfig) -> Iterator[SimulationFrame]:
        """Yield shared-schema frames for streaming APIs."""

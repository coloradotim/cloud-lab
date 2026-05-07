from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from uuid import uuid4

from app.sim.schemas import SimulationConfig


class RunStatus(StrEnum):
    CREATED = "created"
    RUNNING = "running"
    COMPLETED = "completed"
    STOPPED = "stopped"
    CANCELLED = "cancelled"
    FAILED = "failed"


@dataclass
class SimulationRun:
    run_id: str
    config: SimulationConfig
    status: RunStatus = RunStatus.CREATED
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    started_at: datetime | None = None
    completed_at: datetime | None = None
    last_frame_step: int = 0
    last_frame_time_seconds: float = 0.0
    error: str | None = None
    stop_requested: bool = False

    def metadata(self) -> dict[str, object]:
        return {
            "run_id": self.run_id,
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "last_frame_step": self.last_frame_step,
            "last_frame_time_seconds": self.last_frame_time_seconds,
            "duration_seconds": self.config.time.duration_seconds,
            "frame_interval_seconds": self.config.time.frame_interval_seconds,
            "error": self.error,
        }


class SimulationRunManager:
    def __init__(self) -> None:
        self._runs: dict[str, SimulationRun] = {}

    def create_run(self, config: SimulationConfig) -> SimulationRun:
        run = SimulationRun(run_id=str(uuid4()), config=config)
        self._runs[run.run_id] = run
        return run

    def get_run(self, run_id: str) -> SimulationRun | None:
        return self._runs.get(run_id)

    def request_stop(self, run_id: str) -> SimulationRun | None:
        run = self.get_run(run_id)
        if run is None:
            return None

        run.stop_requested = True
        if run.status in {RunStatus.CREATED, RunStatus.RUNNING}:
            run.status = RunStatus.STOPPED
            run.completed_at = datetime.now(UTC)
        return run

    def mark_running(self, run: SimulationRun) -> None:
        run.status = RunStatus.RUNNING
        run.started_at = datetime.now(UTC)
        run.completed_at = None

    def mark_frame(self, run: SimulationRun, step: int, time_seconds: float) -> None:
        run.last_frame_step = step
        run.last_frame_time_seconds = time_seconds

    def mark_completed(self, run: SimulationRun) -> None:
        run.status = RunStatus.COMPLETED
        run.completed_at = datetime.now(UTC)

    def mark_cancelled(self, run: SimulationRun) -> None:
        run.status = RunStatus.CANCELLED
        run.completed_at = datetime.now(UTC)

    def mark_failed(self, run: SimulationRun, error: str) -> None:
        run.status = RunStatus.FAILED
        run.error = error
        run.completed_at = datetime.now(UTC)


run_manager = SimulationRunManager()

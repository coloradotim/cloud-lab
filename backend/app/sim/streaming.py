from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator

from app.sim.runs import SimulationRun, run_manager
from app.sim.solver import stream_simulation_frames

STREAM_SLEEP_SECONDS = 0.02


async def stream_run(run: SimulationRun) -> AsyncIterator[dict[str, object]]:
    """Yield metadata and frames for a simulation run without frontend coupling."""
    if _stop_was_requested(run):
        yield {"type": "stopped", "run": run.metadata()}
        return

    run_manager.mark_running(run)
    yield {"type": "metadata", "run": run.metadata()}

    try:
        for frame in stream_simulation_frames(run.config):
            if _stop_was_requested(run):
                yield {"type": "stopped", "run": run.metadata()}
                return

            yield _frame_message(run, frame.to_transport_dict())
            await asyncio.sleep(STREAM_SLEEP_SECONDS)

        run_manager.mark_completed(run)
        yield {"type": "complete", "run": run.metadata()}
    except asyncio.CancelledError:
        run_manager.mark_cancelled(run)
        raise
    except Exception as error:
        run_manager.mark_failed(run, str(error))
        yield {"type": "error", "run": run.metadata(), "message": str(error)}


def _frame_message(run: SimulationRun, frame: dict[str, object]) -> dict[str, object]:
    step = frame.get("step")
    time_seconds = frame.get("time_seconds")
    if isinstance(step, int) and isinstance(time_seconds, int | float):
        run_manager.mark_frame(run, step=step, time_seconds=float(time_seconds))

    return {"type": "frame", "run_id": run.run_id, "frame": frame}


def _stop_was_requested(run: SimulationRun) -> bool:
    return run.stop_requested

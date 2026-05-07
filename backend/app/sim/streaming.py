from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator

from app.sim.runs import SimulationRun, run_manager
from app.sim.solver import initialize_state, state_to_frame, step_state

STREAM_SLEEP_SECONDS = 0.02


async def stream_run(run: SimulationRun) -> AsyncIterator[dict[str, object]]:
    """Yield metadata and frames for a simulation run without frontend coupling."""
    if _stop_was_requested(run):
        yield {"type": "stopped", "run": run.metadata()}
        return

    run_manager.mark_running(run)
    yield {"type": "metadata", "run": run.metadata()}

    state = initialize_state(run.config)
    yield _frame_message(run, state_to_frame(run.config, state).to_transport_dict())

    next_frame_time = run.config.time.frame_interval_seconds
    max_steps = int(run.config.time.duration_seconds / run.config.time.time_step_seconds)

    try:
        for _step_index in range(max_steps):
            if _stop_was_requested(run):
                yield {"type": "stopped", "run": run.metadata()}
                return

            state = step_state(run.config, state)
            if state.time_seconds + 1e-9 >= next_frame_time:
                yield _frame_message(run, state_to_frame(run.config, state).to_transport_dict())
                next_frame_time += run.config.time.frame_interval_seconds
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

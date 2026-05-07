from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, status

from app.sim.runs import run_manager
from app.sim.sample import create_sample_frame
from app.sim.schemas import (
    BackgroundWindConfig,
    GridConfig,
    InitialAtmosphereConfig,
    SimulationConfig,
    SurfaceHeatingConfig,
    TimeConfig,
)
from app.sim.solver import run_simulation
from app.sim.streaming import stream_run

router = APIRouter(prefix="/simulations", tags=["simulations"])


@router.get("/sample-frame")
def sample_frame() -> dict[str, object]:
    return create_sample_frame().to_transport_dict()


@router.get("/sample-run")
def sample_run() -> dict[str, object]:
    config = SimulationConfig(
        grid=GridConfig(columns=36, rows=24),
        time=TimeConfig(time_step_seconds=2.0, duration_seconds=120.0, frame_interval_seconds=30.0),
        initial_atmosphere=InitialAtmosphereConfig(relative_humidity=0.96),
        surface_heating=SurfaceHeatingConfig(max_warming_rate_k_per_s=0.012),
        background_wind=BackgroundWindConfig(u_m_per_s=0.25),
        seed=3,
    )
    frames = run_simulation(config)

    return {
        "frame_count": len(frames),
        "frames": [frame.to_transport_dict() for frame in frames],
    }


@router.post("/runs", status_code=status.HTTP_201_CREATED)
def start_run() -> dict[str, object]:
    run = run_manager.create_run(_playback_config())
    return run.metadata()


@router.get("/runs/{run_id}")
def get_run(run_id: str) -> dict[str, object]:
    run = run_manager.get_run(run_id)
    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Simulation run not found",
        )
    return run.metadata()


@router.post("/runs/{run_id}/stop")
def stop_run(run_id: str) -> dict[str, object]:
    run = run_manager.request_stop(run_id)
    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Simulation run not found",
        )
    return run.metadata()


@router.websocket("/runs/{run_id}/stream")
async def stream_simulation_run(websocket: WebSocket, run_id: str) -> None:
    run = run_manager.get_run(run_id)
    if run is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="run not found")
        return

    await websocket.accept()

    try:
        async for message in stream_run(run):
            await websocket.send_json(message)
    except WebSocketDisconnect:
        run_manager.mark_cancelled(run)
    finally:
        await websocket.close()


def _playback_config() -> SimulationConfig:
    return SimulationConfig(
        grid=GridConfig(columns=36, rows=24),
        time=TimeConfig(time_step_seconds=2.0, duration_seconds=120.0, frame_interval_seconds=6.0),
        initial_atmosphere=InitialAtmosphereConfig(relative_humidity=0.96),
        surface_heating=SurfaceHeatingConfig(max_warming_rate_k_per_s=0.012),
        background_wind=BackgroundWindConfig(u_m_per_s=0.25),
        seed=3,
    )

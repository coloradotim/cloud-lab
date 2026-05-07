from typing import Annotated

from fastapi import APIRouter, Body, HTTPException, WebSocket, WebSocketDisconnect, status

from app.sim.presets import fair_weather_cumulus_preset, simulation_presets
from app.sim.runs import run_manager
from app.sim.sample import create_sample_frame
from app.sim.schemas import SimulationConfig
from app.sim.solver import run_simulation, solver_descriptors
from app.sim.streaming import stream_run

router = APIRouter(prefix="/simulations", tags=["simulations"])


@router.get("/sample-frame")
def sample_frame() -> dict[str, object]:
    return create_sample_frame().to_transport_dict()


@router.get("/sample-run")
def sample_run() -> dict[str, object]:
    preset_config = fair_weather_cumulus_preset().config
    config = preset_config.model_copy(
        update={"time": preset_config.time.model_copy(update={"frame_interval_seconds": 30.0})}
    )
    frames = run_simulation(config)

    return {
        "frame_count": len(frames),
        "frames": [frame.to_transport_dict() for frame in frames],
    }


@router.get("/solvers")
def solvers() -> dict[str, object]:
    return {
        "solvers": [
            {
                "solver_type": descriptor.solver_type,
                "name": descriptor.name,
                "description": descriptor.description,
                "status": descriptor.status,
                "limitations": list(descriptor.limitations),
            }
            for descriptor in solver_descriptors()
        ]
    }


@router.get("/presets")
def presets() -> dict[str, object]:
    return {"presets": [preset.model_dump(mode="json") for preset in simulation_presets()]}


@router.post("/runs", status_code=status.HTTP_201_CREATED)
def start_run(config: Annotated[SimulationConfig | None, Body()] = None) -> dict[str, object]:
    resolved_config = config or fair_weather_cumulus_preset().config
    run = run_manager.create_run(resolved_config)
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

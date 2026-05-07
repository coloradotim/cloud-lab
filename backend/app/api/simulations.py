from fastapi import APIRouter

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

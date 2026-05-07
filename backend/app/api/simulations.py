from fastapi import APIRouter

from app.sim.sample import create_sample_frame

router = APIRouter(prefix="/simulations", tags=["simulations"])


@router.get("/sample-frame")
def sample_frame() -> dict[str, object]:
    return create_sample_frame().to_transport_dict()

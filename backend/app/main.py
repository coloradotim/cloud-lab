from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.simulations import router as simulations_router
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=False,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(simulations_router)


@app.websocket("/ws/simulations/{run_id}")
async def simulation_frames(websocket: WebSocket, run_id: str) -> None:
    """Reserve a live-frame streaming boundary for future simulation runs."""
    await websocket.accept()
    await websocket.send_json(
        {
            "type": "not_implemented",
            "runId": run_id,
            "message": (
                "Live simulation frames will stream from this endpoint in a later milestone."
            ),
        }
    )
    await websocket.close(code=1000)

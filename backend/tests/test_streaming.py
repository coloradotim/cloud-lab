import asyncio

from fastapi.testclient import TestClient

from app.main import app
from app.sim import RunStatus, SimulationConfig, run_manager, stream_run


def test_run_lifecycle_streams_metadata_frames_and_completion() -> None:
    client = TestClient(app)

    response = client.post("/simulations/runs")
    assert response.status_code == 201
    run_id = response.json()["run_id"]

    with client.websocket_connect(f"/simulations/runs/{run_id}/stream") as websocket:
        metadata = websocket.receive_json()
        first_frame = websocket.receive_json()

        assert metadata["type"] == "metadata"
        assert metadata["run"]["status"] == RunStatus.RUNNING
        assert first_frame["type"] == "frame"
        assert first_frame["frame"]["schema_version"] == "sim-frame-v1"

        message = first_frame
        while message["type"] == "frame":
            message = websocket.receive_json()

        assert message["type"] == "complete"
        assert message["run"]["status"] == RunStatus.COMPLETED


def test_run_can_be_stopped_cleanly_while_streaming() -> None:
    client = TestClient(app)
    response = client.post("/simulations/runs")
    run_id = response.json()["run_id"]

    with client.websocket_connect(f"/simulations/runs/{run_id}/stream") as websocket:
        assert websocket.receive_json()["type"] == "metadata"
        assert websocket.receive_json()["type"] == "frame"

        stop_response = client.post(f"/simulations/runs/{run_id}/stop")

        assert stop_response.status_code == 200
        message = websocket.receive_json()
        while message["type"] == "frame":
            message = websocket.receive_json()

        assert message["type"] == "stopped"
        assert message["run"]["status"] == RunStatus.STOPPED


def test_stream_run_honors_stop_before_start() -> None:
    run = run_manager.create_run(SimulationConfig())
    run_manager.request_stop(run.run_id)

    async def collect_messages() -> list[dict[str, object]]:
        return [message async for message in stream_run(run)]

    messages = asyncio.run(collect_messages())

    assert messages == [{"type": "stopped", "run": run.metadata()}]


def test_stop_unknown_run_returns_404() -> None:
    client = TestClient(app)

    response = client.post("/simulations/runs/not-a-real-run/stop")

    assert response.status_code == 404

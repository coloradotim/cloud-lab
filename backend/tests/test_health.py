import pytest
from fastapi.testclient import TestClient

from app.main import app

pytestmark = pytest.mark.contract


def test_health_endpoint_returns_service_status() -> None:
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "Cloud Lab API",
        "version": "0.1.0",
    }


def test_health_endpoint_allows_local_frontend_origin() -> None:
    client = TestClient(app)

    response = client.get("/health", headers={"Origin": "http://localhost:5173"})

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_local_frontend_can_preflight_post_requests() -> None:
    client = TestClient(app)

    response = client.options(
        "/simulations/runs",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "POST" in response.headers["access-control-allow-methods"]


def test_sample_frame_endpoint_returns_frontend_safe_schema() -> None:
    client = TestClient(app)

    response = client.get("/simulations/sample-frame")

    assert response.status_code == 200
    payload = response.json()
    assert payload["schema_version"] == "sim-frame-v1"
    assert payload["config"]["schema_version"] == "sim-config-v1"
    assert payload["grid"]["columns"] == 100
    assert payload["grid"]["rows"] == 60
    assert payload["fields"]["temperature_k"]["metadata"]["unit"] == "K"
    assert payload["fields"]["rain_water_kg_per_kg"]["metadata"]["unit"] == "kg kg-1"


def test_sample_run_endpoint_returns_time_evolving_frames() -> None:
    client = TestClient(app)

    response = client.get("/simulations/sample-run")

    assert response.status_code == 200
    payload = response.json()
    assert payload["frame_count"] >= 2
    first_frame = payload["frames"][0]
    final_frame = payload["frames"][-1]
    assert first_frame["schema_version"] == "sim-frame-v1"
    assert final_frame["time_seconds"] > first_frame["time_seconds"]
    assert final_frame["fields"]["vertical_velocity_m_per_s"]["metadata"]["unit"] == "m s-1"

from fastapi.testclient import TestClient

from app.main import app
from app.sim import fair_weather_cumulus_preset, run_simulation


def test_presets_endpoint_returns_fair_weather_cumulus_config() -> None:
    client = TestClient(app)

    response = client.get("/simulations/presets")

    assert response.status_code == 200
    presets = response.json()["presets"]
    assert len(presets) == 1
    preset = presets[0]
    assert preset["slug"] == "fair-weather-cumulus"
    assert preset["name"] == "Fair-weather cumulus over heated ground"
    assert preset["config"]["schema_version"] == "sim-config-v1"
    assert preset["config"]["solver_type"] == "educational_2d"
    assert preset["config"]["initial_atmosphere"]["relative_humidity"] == 1.0
    assert preset["config"]["surface_heating"]["max_warming_rate_k_per_s"] == 0.012
    assert preset["config"]["seed"] == 3


def test_fair_weather_cumulus_preset_produces_reproducible_cloud_water() -> None:
    config = fair_weather_cumulus_preset().config

    first_run = run_simulation(config)
    second_run = run_simulation(config)

    first_final_cloud = first_run[-1].fields.cloud_liquid_water_kg_per_kg.values
    second_final_cloud = second_run[-1].fields.cloud_liquid_water_kg_per_kg.values
    assert first_final_cloud == second_final_cloud
    assert max(max(row) for row in first_final_cloud) > 0


def test_start_run_accepts_custom_config_from_frontend_controls() -> None:
    client = TestClient(app)
    config = fair_weather_cumulus_preset().config.model_copy(
        update={
            "time": fair_weather_cumulus_preset().config.time.model_copy(
                update={"duration_seconds": 180.0, "frame_interval_seconds": 12.0}
            )
        }
    )

    response = client.post("/simulations/runs", json=config.model_dump(mode="json"))

    assert response.status_code == 201
    payload = response.json()
    assert payload["duration_seconds"] == 180.0
    assert payload["frame_interval_seconds"] == 12.0


def test_solver_catalog_exposes_available_educational_and_planned_backends() -> None:
    client = TestClient(app)

    response = client.get("/simulations/solvers")

    assert response.status_code == 200
    solvers = response.json()["solvers"]
    assert solvers[0]["solver_type"] == "educational_2d"
    assert solvers[0]["status"] == "available"
    boussinesq = next(solver for solver in solvers if solver["solver_type"] == "boussinesq_2d")
    assert boussinesq["status"] == "available"


def test_start_run_accepts_boussinesq_solver_backend() -> None:
    client = TestClient(app)
    config = fair_weather_cumulus_preset().config.model_copy(
        update={
            "solver_type": "boussinesq_2d",
            "time": fair_weather_cumulus_preset().config.time.model_copy(
                update={"duration_seconds": 20.0, "frame_interval_seconds": 10.0}
            ),
        }
    )

    response = client.post("/simulations/runs", json=config.model_dump(mode="json"))

    assert response.status_code == 201
    assert response.json()["duration_seconds"] == 20.0

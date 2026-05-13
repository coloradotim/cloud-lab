import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.sim import (
    GridConfig,
    SimulationConfig,
    TimeConfig,
    compute_boussinesq_thermodynamic_diagnostics,
    fair_weather_cumulus_preset,
    run_simulation,
)

pytestmark = [pytest.mark.contract, pytest.mark.lab]


def test_presets_endpoint_returns_fair_weather_cumulus_config() -> None:
    client = TestClient(app)

    response = client.get("/simulations/presets")

    assert response.status_code == 200
    presets = response.json()["presets"]
    assert len(presets) == 1
    preset = presets[0]
    assert preset["slug"] == "fair-weather-cumulus"
    assert preset["name"] == "Fair-weather cumulus over heated ground"
    assert preset["category"] == "user-facing scenario"
    assert preset["intended_phenomenon"]
    assert preset["thermodynamic_assumptions"]
    assert preset["forcing_setup"]
    assert preset["expected_outcome"]
    assert preset["diagnostic_expectations"]
    assert preset["known_limitations"]
    assert preset["config"]["schema_version"] == "sim-config-v1"
    assert preset["config"]["solver_type"] == "boussinesq_2d"
    initial = preset["config"]["initial_atmosphere"]
    heating = preset["config"]["surface_heating"]
    assert initial["humidity_profile"] == "surface_moisture"
    assert 0.75 <= initial["relative_humidity"] <= 0.90
    assert initial["free_atmosphere_relative_humidity"] < initial["relative_humidity"]
    assert initial["moist_source_layer_depth_m"] <= initial["boundary_layer_depth_m"]
    assert heating["max_warming_rate_k_per_s"] > 0.0
    assert preset["config"]["surface_heating"]["pattern"] == "two_patches"
    assert "paired" in preset["description"]
    assert preset["config"]["seed"] == 3


@pytest.mark.science
@pytest.mark.slow
@pytest.mark.validation
def test_fair_weather_cumulus_preset_produces_reproducible_cloud_water() -> None:
    config = fair_weather_cumulus_preset().config

    first_run = run_simulation(config)
    second_run = run_simulation(config)

    first_initial_cloud = first_run[0].fields.cloud_liquid_water_kg_per_kg.values
    first_final_cloud = first_run[-1].fields.cloud_liquid_water_kg_per_kg.values
    second_final_cloud = second_run[-1].fields.cloud_liquid_water_kg_per_kg.values
    diagnostics = compute_boussinesq_thermodynamic_diagnostics(first_run)

    assert _max_value(first_initial_cloud) == 0.0
    assert first_final_cloud == second_final_cloud
    assert _max_value(first_final_cloud) > 1e-8
    assert diagnostics.first_cloud_time_seconds is not None
    assert diagnostics.first_cloud_time_seconds > 0.0
    assert diagnostics.first_cloud_height_m is not None
    assert diagnostics.first_cloud_height_m >= 0.0
    assert diagnostics.boundary_cloud_fraction < 0.10


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


def test_solver_catalog_exposes_available_solver_backends() -> None:
    client = TestClient(app)

    response = client.get("/simulations/solvers")

    assert response.status_code == 200
    solvers = response.json()["solvers"]
    assert [solver["solver_type"] for solver in solvers] == ["boussinesq_2d", "microphysics_lab"]
    assert solvers[0]["status"] == "available"
    boussinesq = next(solver for solver in solvers if solver["solver_type"] == "boussinesq_2d")
    microphysics = next(solver for solver in solvers if solver["solver_type"] == "microphysics_lab")
    assert boussinesq["status"] == "available"
    assert microphysics["status"] == "available"
    assert "educational_2d" not in {solver["solver_type"] for solver in solvers}


def test_explicit_educational_solver_config_remains_legacy_runnable() -> None:
    config = SimulationConfig(
        solver_type="educational_2d",
        time=TimeConfig(
            time_step_seconds=2.0,
            duration_seconds=20.0,
            frame_interval_seconds=10.0,
        ),
        grid=GridConfig(columns=8, rows=6),
    )

    frames = run_simulation(config)

    assert [frame.time_seconds for frame in frames] == [0.0, 10.0, 20.0]
    assert all(frame.config.solver_type == "educational_2d" for frame in frames)


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


def test_start_run_accepts_microphysics_lab_solver_backend() -> None:
    client = TestClient(app)
    config = fair_weather_cumulus_preset().config.model_copy(
        update={
            "solver_type": "microphysics_lab",
            "time": fair_weather_cumulus_preset().config.time.model_copy(
                update={"duration_seconds": 20.0, "frame_interval_seconds": 10.0}
            ),
        }
    )

    response = client.post("/simulations/runs", json=config.model_dump(mode="json"))

    assert response.status_code == 201
    assert response.json()["duration_seconds"] == 20.0


def _max_value(grid: list[list[float]]) -> float:
    return max(value for row in grid for value in row)

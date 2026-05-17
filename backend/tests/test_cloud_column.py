from __future__ import annotations

import math

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app
from app.sim.cloud_column import (
    cloud_column_microphysics_handoff,
    cloud_column_scenarios,
    run_cloud_column,
)
from app.sim.cloud_column_schemas import (
    CloudColumnConfig,
    CloudColumnFrame,
    CloudColumnMicrophysicsHandoff,
    CloudColumnProfile,
)

pytestmark = [pytest.mark.lab, pytest.mark.diagnostic]


def test_controlled_cloud_column_emits_valid_deterministic_outputs() -> None:
    config = _scenario_config("humid-lifted-column")

    first = run_cloud_column(config)
    second = run_cloud_column(config)

    assert first.model_dump(mode="json") == second.model_dump(mode="json")
    assert first.schema_version == "cloud-column-run-v1"
    assert first.diagnostics.forcing.forcing_type == "prescribed_lift"
    assert first.diagnostics.forcing.dynamics_label == "prescribed, not predicted"
    assert first.diagnostics.cloud_formation_status == "cloud_formed"
    assert first.diagnostics.first_cloud_time_seconds is not None
    assert first.diagnostics.cloud_base_m is not None
    for frame in first.frames:
        CloudColumnFrame.model_validate(frame.model_dump())
        assert frame.model_type == "controlled_cloud_column"
        assert all(math.isfinite(value) for value in _frame_numbers(frame))
        assert frame.water_vapor_kg_per_kg >= 0.0
        assert frame.cloud_liquid_water_kg_per_kg >= 0.0
        assert frame.relative_humidity_percent >= 0.0


def test_cloud_column_profile_schema_validates_profile_inputs() -> None:
    with pytest.raises(ValidationError, match="water_vapor_kg_per_kg or relative_humidity"):
        CloudColumnProfile(z_m=[0.0, 100.0], temperature_k=[294.0, 293.0])

    with pytest.raises(ValidationError, match="strictly increasing"):
        CloudColumnProfile(
            z_m=[0.0, 0.0],
            temperature_k=[294.0, 293.0],
            relative_humidity_percent=[80.0, 80.0],
        )

    with pytest.raises(ValidationError, match="length must match"):
        CloudColumnProfile(
            z_m=[0.0, 100.0],
            temperature_k=[294.0, 293.0],
            relative_humidity_percent=[80.0],
        )


def test_required_scenarios_report_expected_statuses() -> None:
    scenarios = cloud_column_scenarios()

    assert [scenario.slug for scenario in scenarios] == [
        "humid-lifted-column",
        "dry-failed-column",
        "weak-lift-no-cloud",
        "stronger-lift-earlier-cloud",
        "capped-suppressed-column",
        "evaporation-in-subsaturated-layer",
        "no-lift-control",
    ]
    for scenario in scenarios:
        run = run_cloud_column(scenario.config)
        assert run.diagnostics.cloud_formation_reason
        if scenario.expected_status is not None:
            assert run.diagnostics.cloud_formation_status == scenario.expected_status


def test_no_lift_control_remains_cloud_free() -> None:
    run = run_cloud_column(_scenario_config("no-lift-control"))

    assert run.diagnostics.cloud_formation_status == "lift_too_weak"
    assert run.diagnostics.first_cloud_time_seconds is None
    assert run.diagnostics.max_cloud_liquid_water_kg_per_kg == pytest.approx(0.0)
    assert all(frame.prescribed_lift_m_per_s == 0.0 for frame in run.frames)


def test_dry_failed_column_remains_cloud_free_or_negligible() -> None:
    run = run_cloud_column(_scenario_config("dry-failed-column"))

    assert run.diagnostics.cloud_formation_status == "dry_failed"
    assert run.diagnostics.first_cloud_time_seconds is None
    assert run.diagnostics.max_cloud_liquid_water_kg_per_kg <= 1.0e-8


def test_higher_humidity_forms_cloud_earlier_than_lower_humidity() -> None:
    humid = run_cloud_column(_scenario_config("humid-lifted-column")).diagnostics
    drier_config = _scenario_config("humid-lifted-column").model_copy(
        update={
            "profile": _profile_with_relative_humidity(
                _scenario_config("humid-lifted-column"),
                mixed_layer_rh_percent=82.0,
            )
        },
        deep=True,
    )
    drier = run_cloud_column(drier_config).diagnostics

    assert humid.first_cloud_time_seconds is not None
    assert drier.first_cloud_time_seconds is not None
    assert humid.first_cloud_time_seconds < drier.first_cloud_time_seconds


def test_stronger_lift_forms_cloud_earlier_than_weaker_lift() -> None:
    baseline = run_cloud_column(_scenario_config("humid-lifted-column")).diagnostics
    strong = run_cloud_column(_scenario_config("stronger-lift-earlier-cloud")).diagnostics

    assert baseline.first_cloud_time_seconds is not None
    assert strong.first_cloud_time_seconds is not None
    assert strong.first_cloud_time_seconds < baseline.first_cloud_time_seconds
    assert strong.max_cloud_liquid_water_kg_per_kg >= baseline.max_cloud_liquid_water_kg_per_kg


def test_cap_suppression_prevents_cloud_relative_to_uncapped_case() -> None:
    uncapped = run_cloud_column(_scenario_config("humid-lifted-column")).diagnostics
    capped = run_cloud_column(_scenario_config("capped-suppressed-column")).diagnostics

    assert uncapped.first_cloud_time_seconds is not None
    assert capped.cloud_formation_status == "cap_suppressed"
    assert capped.first_cloud_time_seconds is None
    assert capped.max_cloud_liquid_water_kg_per_kg <= uncapped.max_cloud_liquid_water_kg_per_kg


def test_dry_entrainment_reduces_cloud_water_or_delays_onset() -> None:
    baseline_config = _scenario_config("humid-lifted-column")
    dry_entrainment_config = baseline_config.model_copy(
        update={
            "forcing": baseline_config.forcing.model_copy(update={"entrainment_drying_factor": 0.9})
        },
        deep=True,
    )

    baseline = run_cloud_column(baseline_config).diagnostics
    entrained = run_cloud_column(dry_entrainment_config).diagnostics

    assert baseline.first_cloud_time_seconds is not None
    assert entrained.first_cloud_time_seconds is not None
    assert (
        entrained.first_cloud_time_seconds >= baseline.first_cloud_time_seconds
        or entrained.max_cloud_liquid_water_kg_per_kg < baseline.max_cloud_liquid_water_kg_per_kg
    )


def test_evaporation_reduces_cloud_water_in_subsaturated_layer() -> None:
    run = run_cloud_column(_scenario_config("evaporation-in-subsaturated-layer"))

    assert run.diagnostics.cloud_formation_status == "evaporated"
    assert run.frames[0].cloud_liquid_water_kg_per_kg > run.frames[-1].cloud_liquid_water_kg_per_kg
    assert run.frames[-1].cloud_liquid_water_kg_per_kg <= 1.0e-8
    assert run.diagnostics.water_budget.total_evaporated_kg_per_kg > 0.0


def test_water_budget_diagnostics_are_finite_and_bounded() -> None:
    run = run_cloud_column(_scenario_config("humid-lifted-column"))
    budget = run.diagnostics.water_budget

    assert all(math.isfinite(value) for value in budget.model_dump().values())
    assert budget.max_absolute_drift_kg_per_kg <= 1.0e-8
    assert budget.total_condensed_kg_per_kg > 0.0


def test_cloud_column_microphysics_handoff_preserves_cloud_water_and_provenance() -> None:
    run = run_cloud_column(_scenario_config("humid-lifted-column"))

    handoff = cloud_column_microphysics_handoff(
        run,
        source_scenario_id="lower-atmosphere-v2-baseline-shallow-cloud",
        source_profile_time_seconds=14_400.0,
        source_profile_time_hours_from_sunrise=4.0,
        cloud_column_run_id="local-run-1",
    )

    assert handoff.schema_version == "cloud-column-microphysics-handoff-v1"
    assert handoff.source_model == "controlled_cloud_column"
    assert handoff.source_scenario_id == "lower-atmosphere-v2-baseline-shallow-cloud"
    assert handoff.source_profile_time_seconds == pytest.approx(14_400.0)
    assert handoff.source_profile_time_hours_from_sunrise == pytest.approx(4.0)
    assert handoff.cloud_column_run_id == "local-run-1"
    assert handoff.precipitation_status == "precipitation_not_enabled"
    assert handoff.microphysics_source == "none"
    assert handoff.droplet_effective_radius_source == "absent"
    assert handoff.rain_water_kg_per_kg is None
    assert handoff.first_rain_time_seconds is None
    assert handoff.max_rain_water_kg_per_kg is None
    assert handoff.max_cloud_liquid_water_kg_per_kg == pytest.approx(
        run.diagnostics.max_cloud_liquid_water_kg_per_kg
    )
    assert handoff.first_cloud_time_seconds == run.diagnostics.first_cloud_time_seconds
    assert handoff.cloud_base_m == run.diagnostics.cloud_base_m
    assert handoff.cloud_top_proxy_m == run.diagnostics.cloud_top_proxy_m
    assert handoff.total_condensed_kg_per_kg == pytest.approx(
        run.diagnostics.water_budget.total_condensed_kg_per_kg
    )
    assert handoff.total_evaporated_kg_per_kg == pytest.approx(
        run.diagnostics.water_budget.total_evaporated_kg_per_kg
    )
    assert handoff.water_budget_summary == run.diagnostics.water_budget
    assert handoff.prescribed_lift_summary == run.diagnostics.forcing
    assert handoff.cloud_column_time_seconds == [frame.time_seconds for frame in run.frames]
    assert handoff.cloud_liquid_water_kg_per_kg == [
        frame.cloud_liquid_water_kg_per_kg for frame in run.frames
    ]
    assert handoff.temperature_k == [frame.temperature_k for frame in run.frames]
    assert handoff.water_vapor_kg_per_kg == [frame.water_vapor_kg_per_kg for frame in run.frames]
    assert handoff.relative_humidity_percent == [
        frame.relative_humidity_percent for frame in run.frames
    ]
    assert handoff.cloud_water_integral > 0.0


def test_cloud_column_microphysics_handoff_keeps_rain_fields_optional() -> None:
    run = run_cloud_column(_scenario_config("humid-lifted-column"))

    handoff = CloudColumnMicrophysicsHandoff.model_validate(
        cloud_column_microphysics_handoff(run).model_dump()
    )

    assert handoff.precipitation_status == "precipitation_not_enabled"
    assert handoff.rain_water_kg_per_kg is None
    assert handoff.effective_radius_um is None
    assert handoff.droplet_size_distribution is None
    assert handoff.number_concentration_m3 is None


def test_cloud_column_microphysics_handoff_rejects_boussinesq_source() -> None:
    payload = cloud_column_microphysics_handoff(
        run_cloud_column(_scenario_config("humid-lifted-column"))
    ).model_dump()
    payload["source_model"] = "boussinesq_2d"

    with pytest.raises(ValidationError):
        CloudColumnMicrophysicsHandoff.model_validate(payload)


def test_cloud_column_microphysics_handoff_allows_declared_future_statuses_and_sources() -> None:
    payload = cloud_column_microphysics_handoff(
        run_cloud_column(_scenario_config("humid-lifted-column"))
    ).model_dump()

    for status in [
        "precipitation_not_enabled",
        "not_evaluated",
        "cloud_no_rain",
        "rain_threshold_reached",
        "rain_formed",
        "evaporation_limited",
    ]:
        assert (
            CloudColumnMicrophysicsHandoff.model_validate(
                payload | {"precipitation_status": status}
            ).precipitation_status
            == status
        )

    for source in ["none", "bulk", "PySDM", "reference", "synthetic"]:
        assert (
            CloudColumnMicrophysicsHandoff.model_validate(
                payload | {"microphysics_source": source}
            ).microphysics_source
            == source
        )

    for radius_source in ["absent", "assumed", "bulk_estimate", "PySDM", "reference"]:
        assert (
            CloudColumnMicrophysicsHandoff.model_validate(
                payload | {"droplet_effective_radius_source": radius_source}
            ).droplet_effective_radius_source
            == radius_source
        )


def test_cloud_column_microphysics_handoff_marks_missing_cloud_water_not_evaluated() -> None:
    run = run_cloud_column(_scenario_config("no-lift-control"))

    handoff = cloud_column_microphysics_handoff(run)

    assert handoff.max_cloud_liquid_water_kg_per_kg == pytest.approx(0.0)
    assert handoff.first_cloud_time_seconds is None
    assert handoff.precipitation_status == "not_evaluated"
    assert handoff.cloud_water_integral == pytest.approx(0.0)


def test_cloud_column_api_exposes_scenarios_and_run_payload() -> None:
    client = TestClient(app)

    scenarios_response = client.get("/simulations/controlled-cloud-column/scenarios")
    assert scenarios_response.status_code == 200
    scenarios_payload = scenarios_response.json()
    assert [scenario["slug"] for scenario in scenarios_payload["scenarios"]] == [
        "humid-lifted-column",
        "dry-failed-column",
        "weak-lift-no-cloud",
        "stronger-lift-earlier-cloud",
        "capped-suppressed-column",
        "evaporation-in-subsaturated-layer",
        "no-lift-control",
    ]

    config = scenarios_payload["scenarios"][0]["config"] | {
        "forcing": scenarios_payload["scenarios"][0]["config"]["forcing"]
        | {
            "runtime_seconds": 600.0,
            "lift_duration_seconds": 600.0,
            "frame_interval_seconds": 120.0,
        }
    }
    run_response = client.post("/simulations/controlled-cloud-column/run", json=config)

    assert run_response.status_code == 200
    payload = run_response.json()
    assert payload["schema_version"] == "cloud-column-run-v1"
    assert payload["config"]["model_type"] == "controlled_cloud_column"
    assert payload["diagnostics"]["forcing"]["dynamics_label"] == "prescribed, not predicted"
    assert payload["diagnostics"]["cloud_formation_reason"]
    assert payload["frames"]


def _scenario_config(slug: str) -> CloudColumnConfig:
    return next(scenario.config for scenario in cloud_column_scenarios() if scenario.slug == slug)


def _profile_with_relative_humidity(
    config: CloudColumnConfig,
    *,
    mixed_layer_rh_percent: float,
) -> CloudColumnProfile:
    return config.profile.model_copy(
        update={
            "relative_humidity_percent": [
                mixed_layer_rh_percent if height <= 1_500.0 else 35.0
                for height in config.profile.z_m
            ]
        }
    )


def _frame_numbers(frame: CloudColumnFrame) -> list[float]:
    return [float(value) for value in frame.model_dump().values() if isinstance(value, int | float)]

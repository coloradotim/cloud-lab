from __future__ import annotations

import math

import pytest
from pydantic import ValidationError

from app.sim.profile_1d import boundary_layer_1d_scenarios, run_profile
from app.sim.profile_schemas import BoundaryLayer1DConfig, BoundaryLayer1DFrame

pytestmark = [pytest.mark.lab, pytest.mark.diagnostic]


def test_boundary_layer_profile_emits_valid_deterministic_frames_without_cloud_water() -> None:
    config = BoundaryLayer1DConfig(
        levels=12,
        duration_seconds=1_800.0,
        time_step_seconds=300.0,
        frame_interval_seconds=600.0,
        seed=9,
    )

    first = run_profile(config)
    second = run_profile(config)

    assert first.model_dump(mode="json") == second.model_dump(mode="json")
    assert [frame.time_seconds for frame in first.frames] == [0.0, 600.0, 1_200.0, 1_800.0]
    for frame in first.frames:
        BoundaryLayer1DFrame.model_validate(frame.model_dump())
        assert frame.model_type == "boundary_layer_1d"
        assert not hasattr(frame, "cloud_liquid_water_kg_per_kg")
        assert _is_monotonic(frame.z_m)
        assert all(math.isfinite(value) for value in _flatten_frame_numbers(frame))
        assert all(value >= 0.0 for value in frame.water_vapor_kg_per_kg)
        assert all(0.0 <= value <= 105.0 for value in frame.relative_humidity_percent)
        assert 0.0 <= frame.mixed_layer_depth_m <= config.height_m
        assert frame.diagnostics.cloud_formation_potential_reason


def test_boundary_layer_config_rejects_invalid_profile_geometry() -> None:
    with pytest.raises(ValidationError, match="initial_mixed_layer_depth_m"):
        BoundaryLayer1DConfig(initial_mixed_layer_depth_m=4_000.0)

    with pytest.raises(ValidationError, match="inversion_height_m"):
        BoundaryLayer1DConfig(inversion_height_m=4_000.0)

    with pytest.raises(ValidationError, match="frame_interval_seconds"):
        BoundaryLayer1DConfig(time_step_seconds=600.0, frame_interval_seconds=300.0)


def test_no_flux_control_remains_mostly_unchanged() -> None:
    config = _scenario_config("no-flux-control")

    run = run_profile(config)
    initial = run.frames[0]
    final = run.frames[-1]

    assert final.diagnostics.cloud_formation_potential_status == "no_flux_control"
    assert final.mixed_layer_depth_m == pytest.approx(initial.mixed_layer_depth_m)
    assert final.surface_heating_accumulated_k == pytest.approx(0.0)
    assert final.surface_moisture_added_kg_per_kg == pytest.approx(0.0)
    assert (
        max(
            abs(current - start)
            for current, start in zip(final.temperature_k, initial.temperature_k, strict=True)
        )
        < 0.05
    )


def test_stronger_heating_deepens_mixed_layer_more_than_weak_heating() -> None:
    weak = BoundaryLayer1DConfig(surface_heating_strength=0.25, surface_moisture_flux_strength=0.3)
    strong = weak.model_copy(update={"surface_heating_strength": 0.85})

    weak_final = run_profile(weak).frames[-1]
    strong_final = run_profile(strong).frames[-1]

    assert strong_final.mixed_layer_depth_m > weak_final.mixed_layer_depth_m
    assert strong_final.surface_heating_accumulated_k > weak_final.surface_heating_accumulated_k


def test_stronger_moisture_flux_lowers_lcl_or_increases_rh() -> None:
    dry = BoundaryLayer1DConfig(
        initial_relative_humidity=0.6,
        surface_heating_strength=0.55,
        surface_moisture_flux_strength=0.0,
        entrainment_strength=0.15,
    )
    moist = dry.model_copy(update={"surface_moisture_flux_strength": 0.9})

    dry_final = run_profile(dry).frames[-1]
    moist_final = run_profile(moist).frames[-1]

    assert moist_final.lcl_m < dry_final.lcl_m or (
        moist_final.diagnostics.max_relative_humidity_percent
        > dry_final.diagnostics.max_relative_humidity_percent
    )


def test_higher_initial_humidity_lowers_initial_lcl() -> None:
    dry = BoundaryLayer1DConfig(initial_relative_humidity=0.45)
    humid = dry.model_copy(update={"initial_relative_humidity": 0.82})

    dry_initial = run_profile(dry).frames[0]
    humid_initial = run_profile(humid).frames[0]

    assert humid_initial.lcl_m < dry_initial.lcl_m


def test_stronger_cap_suppresses_mixed_layer_growth_relative_to_weak_cap() -> None:
    weak = BoundaryLayer1DConfig(
        inversion_height_m=950.0,
        inversion_strength_k=0.5,
        surface_heating_strength=0.8,
    )
    strong = weak.model_copy(update={"inversion_strength_k": 6.0})

    weak_final = run_profile(weak).frames[-1]
    strong_final = run_profile(strong).frames[-1]

    assert strong_final.mixed_layer_depth_m < weak_final.mixed_layer_depth_m
    assert strong_final.diagnostics.cloud_formation_potential_status == "cap_suppressed"


def test_stronger_dry_entrainment_worsens_cloud_potential_when_air_aloft_is_dry() -> None:
    weak = BoundaryLayer1DConfig(
        initial_relative_humidity=0.72,
        free_atmosphere_relative_humidity=0.12,
        surface_heating_strength=0.7,
        surface_moisture_flux_strength=0.2,
        entrainment_strength=0.05,
        inversion_height_m=2_200.0,
        inversion_strength_k=1.0,
    )
    strong = weak.model_copy(update={"entrainment_strength": 0.9})

    weak_final = run_profile(weak).frames[-1]
    strong_final = run_profile(strong).frames[-1]

    assert strong_final.entrainment_drying_proxy > weak_final.entrainment_drying_proxy
    assert (
        strong_final.diagnostics.rh_near_mixed_layer_top_percent
        < weak_final.diagnostics.rh_near_mixed_layer_top_percent
    )
    assert strong_final.diagnostics.cloud_formation_potential_status in {
        "dry_entrainment_suppressed",
        "moisture_limited",
    }


def test_longer_duration_does_not_reduce_accumulated_heating() -> None:
    short = BoundaryLayer1DConfig(duration_seconds=3_600.0)
    long = short.model_copy(update={"duration_seconds": 7_200.0})

    short_final = run_profile(short).frames[-1]
    long_final = run_profile(long).frames[-1]

    assert long_final.surface_heating_accumulated_k >= short_final.surface_heating_accumulated_k


def test_required_scenario_presets_have_expected_diagnostic_statuses() -> None:
    scenarios = boundary_layer_1d_scenarios()

    assert [scenario.slug for scenario in scenarios] == [
        "morning-stable-layer-breaks-down",
        "moist-surface-cumulus-favorable",
        "dry-entrainment-suppresses-potential",
        "surface-moisture-flux-enables-potential",
        "strong-cap-suppresses-growth",
        "no-flux-control",
    ]
    for scenario in scenarios:
        final = run_profile(scenario.config).frames[-1]
        if scenario.expected_status is not None:
            assert final.diagnostics.cloud_formation_potential_status == scenario.expected_status
        assert final.diagnostics.cloud_formation_potential_reason


def _scenario_config(slug: str) -> BoundaryLayer1DConfig:
    return next(
        scenario.config for scenario in boundary_layer_1d_scenarios() if scenario.slug == slug
    )


def _is_monotonic(values: list[float]) -> bool:
    return all(upper > lower for lower, upper in zip(values, values[1:], strict=False))


def _flatten_frame_numbers(frame: BoundaryLayer1DFrame) -> list[float]:
    dump = frame.model_dump()
    values: list[float] = []
    for value in dump.values():
        if isinstance(value, int | float):
            values.append(float(value))
        elif isinstance(value, list):
            values.extend(float(item) for item in value if isinstance(item, int | float))
        elif isinstance(value, dict):
            values.extend(float(item) for item in value.values() if isinstance(item, int | float))
    return values

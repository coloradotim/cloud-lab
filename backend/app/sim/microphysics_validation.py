from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from typing import Any

from app.sim.microphysics_diagnostics import (
    CLOUD_PRESENCE_THRESHOLD_KG_PER_KG,
    CONSTANT_TEMPERATURE_TOLERANCE_K,
    CONSTANT_VAPOR_TOLERANCE_KG_PER_KG,
    RAIN_AUTOCONVERSION_THRESHOLD_KG_PER_KG,
    RAIN_PRESENCE_THRESHOLD_KG_PER_KG,
    TOTAL_WATER_DRIFT_TOLERANCE_KG_PER_KG,
    MicrophysicsDiagnostics,
    compute_microphysics_diagnostics,
)
from app.sim.schemas import (
    BackgroundWindConfig,
    GridConfig,
    InitialAtmosphereConfig,
    SimulationConfig,
    SimulationFrame,
    SurfaceHeatingConfig,
    TimeConfig,
)
from app.sim.solver import run_simulation


@dataclass(frozen=True)
class MicrophysicsValidationCase:
    slug: str
    name: str
    description: str
    config: SimulationConfig


@dataclass(frozen=True)
class MicrophysicsValidationResult:
    case: MicrophysicsValidationCase
    diagnostics: MicrophysicsDiagnostics
    passed: bool
    failures: tuple[str, ...]
    notes: tuple[str, ...]


def microphysics_validation_cases() -> list[MicrophysicsValidationCase]:
    base = _base_config()
    return [
        MicrophysicsValidationCase(
            slug="sub-saturated-no-lift",
            name="Sub-saturated no-lift control",
            description="Sub-saturated parcel with no lift and no heating should stay dry.",
            config=base.model_copy(
                update={
                    "initial_atmosphere": base.initial_atmosphere.model_copy(
                        update={"relative_humidity": 0.75}
                    ),
                    "background_wind": BackgroundWindConfig(u_m_per_s=0.0, w_m_per_s=0.0),
                    "time": base.time.model_copy(update={"duration_seconds": 300.0}),
                }
            ),
        ),
        MicrophysicsValidationCase(
            slug="humid-lifted-parcel",
            name="Humid lifted parcel",
            description="Humid parcel lifted dry adiabatically until saturation and condensation.",
            config=base.model_copy(
                update={
                    "initial_atmosphere": base.initial_atmosphere.model_copy(
                        update={"relative_humidity": 0.99}
                    ),
                    "background_wind": BackgroundWindConfig(u_m_per_s=0.0, w_m_per_s=1.0),
                    "time": base.time.model_copy(update={"duration_seconds": 1_800.0}),
                }
            ),
        ),
        MicrophysicsValidationCase(
            slug="strong-lift-rain-threshold",
            name="Strong lift / rain threshold",
            description="Near-saturated stronger lift should trigger bulk rain after cloud forms.",
            config=base.model_copy(
                update={
                    "initial_atmosphere": base.initial_atmosphere.model_copy(
                        update={"relative_humidity": 1.0}
                    ),
                    "background_wind": BackgroundWindConfig(u_m_per_s=0.0, w_m_per_s=1.4),
                    "time": base.time.model_copy(update={"duration_seconds": 2_400.0}),
                }
            ),
        ),
        MicrophysicsValidationCase(
            slug="heating-offsets-lift",
            name="Heating offsets lift",
            description=(
                "Positive boundary-layer heating should reduce condensation versus no heat."
            ),
            config=base.model_copy(
                update={
                    "initial_atmosphere": base.initial_atmosphere.model_copy(
                        update={"relative_humidity": 0.99}
                    ),
                    "background_wind": BackgroundWindConfig(u_m_per_s=0.0, w_m_per_s=1.0),
                    "surface_heating": SurfaceHeatingConfig(max_warming_rate_k_per_s=0.012),
                    "time": base.time.model_copy(update={"duration_seconds": 1_800.0}),
                }
            ),
        ),
    ]


def run_microphysics_validation() -> dict[str, Any]:
    results = [validate_microphysics_case(case) for case in microphysics_validation_cases()]
    return {
        "schema_version": "microphysics-validation-v1",
        "thresholds": {
            "cloud_presence_threshold_kg_per_kg": CLOUD_PRESENCE_THRESHOLD_KG_PER_KG,
            "rain_presence_threshold_kg_per_kg": RAIN_PRESENCE_THRESHOLD_KG_PER_KG,
            "total_water_drift_tolerance_kg_per_kg": TOTAL_WATER_DRIFT_TOLERANCE_KG_PER_KG,
            "constant_temperature_tolerance_k": CONSTANT_TEMPERATURE_TOLERANCE_K,
            "constant_vapor_tolerance_kg_per_kg": CONSTANT_VAPOR_TOLERANCE_KG_PER_KG,
        },
        "passed": all(result.passed for result in results),
        "cases": [_result_to_dict(result) for result in results],
        "notes": [
            "Validation covers the current bulk parcel/box model, not droplet-resolved physics.",
            "All cases use microphysics_lab and remain decoupled from boussinesq_2d.",
        ],
    }


def validate_microphysics_case(
    case: MicrophysicsValidationCase,
) -> MicrophysicsValidationResult:
    frames = run_simulation(case.config)
    diagnostics = compute_microphysics_diagnostics(frames)
    failures: list[str] = []
    notes: list[str] = []

    _check_common_sanity(diagnostics, failures)

    if case.slug == "sub-saturated-no-lift":
        _check_no_lift_control(diagnostics, failures)
    elif case.slug == "humid-lifted-parcel":
        _check_humid_lifted_parcel(frames, diagnostics, failures, notes)
    elif case.slug == "strong-lift-rain-threshold":
        _check_strong_lift_rain_case(frames, diagnostics, failures)
        gentle_case = microphysics_validation_cases()[1]
        gentle_diagnostics = compute_microphysics_diagnostics(run_simulation(gentle_case.config))
        if (
            diagnostics.first_cloud_time_seconds is not None
            and gentle_diagnostics.first_cloud_time_seconds is not None
            and diagnostics.first_cloud_time_seconds > gentle_diagnostics.first_cloud_time_seconds
        ):
            failures.append("strong lift did not condense earlier than the gentler lift case")
        if (
            diagnostics.max_cloud_liquid_water_kg_per_kg
            < gentle_diagnostics.max_cloud_liquid_water_kg_per_kg
        ):
            failures.append("strong lift did not produce at least as much peak cloud water")
    elif case.slug == "heating-offsets-lift":
        reference_config = case.config.model_copy(
            update={"surface_heating": SurfaceHeatingConfig(max_warming_rate_k_per_s=0.0)}
        )
        reference_diagnostics = compute_microphysics_diagnostics(run_simulation(reference_config))
        if (
            diagnostics.first_cloud_time_seconds is not None
            and reference_diagnostics.first_cloud_time_seconds is not None
            and diagnostics.first_cloud_time_seconds
            < reference_diagnostics.first_cloud_time_seconds
        ):
            failures.append("heating caused earlier condensation than the no-heating reference")
        if (
            diagnostics.max_cloud_liquid_water_kg_per_kg
            > reference_diagnostics.max_cloud_liquid_water_kg_per_kg + 1e-5
        ):
            failures.append("heating produced more peak cloud water than the no-heating reference")
        notes.append(
            "compared against equivalent no-heating lifted parcel for condensation suppression"
        )

    return MicrophysicsValidationResult(
        case=case,
        diagnostics=diagnostics,
        passed=len(failures) == 0,
        failures=tuple(failures),
        notes=tuple(notes),
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate microphysics_lab sanity cases.")
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON output.")
    args = parser.parse_args()
    result = run_microphysics_validation()

    if args.json:
        print(json.dumps(result, indent=2, sort_keys=True))
        return

    for case in result["cases"]:
        status = "PASS" if case["passed"] else "FAIL"
        metrics = case["diagnostics"]
        print(
            f"{status} {case['name']}: "
            f"first cloud={metrics['first_cloud_time_seconds']} s, "
            f"first rain={metrics['first_rain_time_seconds']} s, "
            f"max cloud={metrics['max_cloud_liquid_water_kg_per_kg']:.3e}, "
            f"max rain={metrics['max_rain_water_kg_per_kg']:.3e}, "
            f"water drift={metrics['max_absolute_total_water_drift_kg_per_kg']:.3e}"
        )
        for failure in case["failures"]:
            print(f"  - {failure}")


def _check_common_sanity(diagnostics: MicrophysicsDiagnostics, failures: list[str]) -> None:
    if diagnostics.non_finite_value_count:
        failures.append(f"{diagnostics.non_finite_value_count} non-finite emitted values")
    if diagnostics.min_moisture_kg_per_kg is not None and diagnostics.min_moisture_kg_per_kg < 0.0:
        failures.append("one or more moisture fields are negative")
    if diagnostics.max_absolute_total_water_drift_kg_per_kg > TOTAL_WATER_DRIFT_TOLERANCE_KG_PER_KG:
        failures.append("total water drift exceeds tolerance")


def _check_no_lift_control(
    diagnostics: MicrophysicsDiagnostics,
    failures: list[str],
) -> None:
    if diagnostics.max_cloud_liquid_water_kg_per_kg > CLOUD_PRESENCE_THRESHOLD_KG_PER_KG:
        failures.append("cloud water formed in no-lift sub-saturated control")
    if diagnostics.max_rain_water_kg_per_kg > RAIN_PRESENCE_THRESHOLD_KG_PER_KG:
        failures.append("rain water formed in no-lift sub-saturated control")
    if abs(diagnostics.final_temperature_k - diagnostics.initial_temperature_k) > (
        CONSTANT_TEMPERATURE_TOLERANCE_K
    ):
        failures.append("temperature changed in no-lift no-heating control")
    if abs(diagnostics.final_water_vapor_kg_per_kg - diagnostics.initial_water_vapor_kg_per_kg) > (
        CONSTANT_VAPOR_TOLERANCE_KG_PER_KG
    ):
        failures.append("water vapor changed in no-lift no-heating control")


def _check_humid_lifted_parcel(
    frames: list[SimulationFrame],
    diagnostics: MicrophysicsDiagnostics,
    failures: list[str],
    notes: list[str],
) -> None:
    if not _parcel_height_is_monotonic(frames):
        failures.append("parcel height is not monotonic during lifted run")
    if diagnostics.first_cloud_time_seconds is None:
        failures.append("humid lifted parcel did not form cloud water")
        return
    if not _temperature_decreases_before_cloud(frames, diagnostics.first_cloud_time_seconds):
        failures.append("temperature did not decrease before condensation")
    if not _vapor_decreases_after_cloud(frames, diagnostics.first_cloud_time_seconds):
        failures.append("water vapor did not decrease after condensation began")
    after = diagnostics.cooling_rate_after_condensation_k_per_s
    dry_cooling_rate = -frames[0].config.background_wind.w_m_per_s * 0.0098
    if after is not None and abs(after) > abs(dry_cooling_rate) + 1e-9:
        failures.append("latent heating did not reduce cooling relative to dry adiabatic lift")
    notes.append("latent heating check uses frame-scale average cooling rates")


def _check_strong_lift_rain_case(
    frames: list[SimulationFrame],
    diagnostics: MicrophysicsDiagnostics,
    failures: list[str],
) -> None:
    if diagnostics.initial_rain_water_kg_per_kg > RAIN_PRESENCE_THRESHOLD_KG_PER_KG:
        failures.append("rain water was present at t=0")
    if diagnostics.first_cloud_time_seconds is None:
        failures.append("strong lift case did not form cloud water")
    if diagnostics.max_cloud_liquid_water_kg_per_kg < RAIN_AUTOCONVERSION_THRESHOLD_KG_PER_KG:
        failures.append("cloud water never exceeded the autoconversion threshold")
    if diagnostics.first_rain_time_seconds is None:
        failures.append("strong lift case did not form rain water")
    elif (
        diagnostics.first_cloud_time_seconds is not None
        and diagnostics.first_rain_time_seconds <= diagnostics.first_cloud_time_seconds
    ):
        failures.append("rain water appeared before or at the same frame as cloud water")
    if not _rain_after_threshold_crossing(frames, diagnostics.first_rain_time_seconds):
        failures.append("rain appeared before sampled cloud water exceeded the threshold")


def _result_to_dict(result: MicrophysicsValidationResult) -> dict[str, Any]:
    return {
        "slug": result.case.slug,
        "name": result.case.name,
        "description": result.case.description,
        "passed": result.passed,
        "failures": list(result.failures),
        "notes": list(result.notes),
        "diagnostics": result.diagnostics.to_dict(),
    }


def _field_value(frame: SimulationFrame, field_key: str) -> float:
    values = getattr(frame.fields, field_key).values
    return float(values[0][0])


def _parcel_height_is_monotonic(frames: list[SimulationFrame]) -> bool:
    heights = [frame.time_seconds * frame.config.background_wind.w_m_per_s for frame in frames]
    return all(current >= previous for previous, current in zip(heights, heights[1:], strict=False))


def _temperature_decreases_before_cloud(
    frames: list[SimulationFrame],
    first_cloud_time_seconds: float,
) -> bool:
    pre_cloud_frames = [frame for frame in frames if frame.time_seconds <= first_cloud_time_seconds]
    if len(pre_cloud_frames) < 2:
        return True
    return _field_value(pre_cloud_frames[-1], "temperature_k") < _field_value(
        pre_cloud_frames[0],
        "temperature_k",
    )


def _vapor_decreases_after_cloud(
    frames: list[SimulationFrame],
    first_cloud_time_seconds: float,
) -> bool:
    post_cloud_frames = [
        frame for frame in frames if frame.time_seconds >= first_cloud_time_seconds
    ]
    if len(post_cloud_frames) < 2:
        return True
    return _field_value(post_cloud_frames[-1], "water_vapor_kg_per_kg") < _field_value(
        post_cloud_frames[0],
        "water_vapor_kg_per_kg",
    )


def _rain_after_threshold_crossing(
    frames: list[SimulationFrame],
    first_rain_time_seconds: float | None,
) -> bool:
    if first_rain_time_seconds is None:
        return False

    return any(
        frame.time_seconds <= first_rain_time_seconds
        and _field_value(frame, "cloud_liquid_water_kg_per_kg")
        > RAIN_AUTOCONVERSION_THRESHOLD_KG_PER_KG
        for frame in frames
    )


def _base_config() -> SimulationConfig:
    return SimulationConfig(
        solver_type="microphysics_lab",
        grid=GridConfig(columns=6, rows=4),
        time=TimeConfig(
            time_step_seconds=5.0,
            duration_seconds=1_800.0,
            frame_interval_seconds=5.0,
        ),
        initial_atmosphere=InitialAtmosphereConfig(
            surface_temperature_k=298.15,
            relative_humidity=0.98,
            boundary_layer_depth_m=1_000.0,
        ),
        surface_heating=SurfaceHeatingConfig(max_warming_rate_k_per_s=0.0),
        background_wind=BackgroundWindConfig(u_m_per_s=0.0, w_m_per_s=1.0),
        seed=151,
    )


if __name__ == "__main__":
    main()

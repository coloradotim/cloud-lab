import pytest

from app.sim.microphysics_validation import (
    CLOUD_PRESENCE_THRESHOLD_KG_PER_KG,
    RAIN_PRESENCE_THRESHOLD_KG_PER_KG,
    TOTAL_WATER_DRIFT_TOLERANCE_KG_PER_KG,
    MicrophysicsValidationCase,
    microphysics_validation_cases,
    run_microphysics_validation,
    validate_microphysics_case,
)

pytestmark = [pytest.mark.microphysics, pytest.mark.science, pytest.mark.validation]


def test_microphysics_validation_summary_reports_all_cases_passing() -> None:
    result = run_microphysics_validation()

    assert result["schema_version"] == "microphysics-validation-v1"
    assert result["passed"] is True
    assert {case["slug"] for case in result["cases"]} == {
        "sub-saturated-no-lift",
        "humid-lifted-parcel",
        "strong-lift-rain-threshold",
        "heating-offsets-lift",
    }
    assert all(case["passed"] for case in result["cases"])


def test_no_lift_sub_saturated_case_stays_dry_and_conserved() -> None:
    case = _case_by_slug("sub-saturated-no-lift")
    result = validate_microphysics_case(case)
    diagnostics = result.diagnostics

    assert result.passed is True
    assert diagnostics.first_cloud_time_seconds is None
    assert diagnostics.first_rain_time_seconds is None
    assert diagnostics.max_cloud_liquid_water_kg_per_kg <= CLOUD_PRESENCE_THRESHOLD_KG_PER_KG
    assert diagnostics.max_rain_water_kg_per_kg <= RAIN_PRESENCE_THRESHOLD_KG_PER_KG
    assert diagnostics.final_temperature_k == diagnostics.initial_temperature_k
    assert diagnostics.final_water_vapor_kg_per_kg == diagnostics.initial_water_vapor_kg_per_kg
    assert diagnostics.max_absolute_total_water_drift_kg_per_kg <= (
        TOTAL_WATER_DRIFT_TOLERANCE_KG_PER_KG
    )


def test_humid_lifted_case_condenses_and_depletes_vapor() -> None:
    case = _case_by_slug("humid-lifted-parcel")
    result = validate_microphysics_case(case)
    diagnostics = result.diagnostics

    assert result.passed is True
    assert diagnostics.final_parcel_height_m > 0.0
    assert diagnostics.final_temperature_k < diagnostics.initial_temperature_k
    assert diagnostics.first_cloud_time_seconds is not None
    assert diagnostics.final_water_vapor_kg_per_kg < diagnostics.initial_water_vapor_kg_per_kg
    assert diagnostics.cooling_rate_after_condensation_k_per_s is not None
    assert abs(diagnostics.cooling_rate_after_condensation_k_per_s) < (
        case.config.background_wind.w_m_per_s * 0.0098
    )


def test_strong_lift_forms_cloud_before_rain_and_crosses_threshold() -> None:
    case = _case_by_slug("strong-lift-rain-threshold")
    result = validate_microphysics_case(case)
    diagnostics = result.diagnostics

    assert result.passed is True
    assert diagnostics.initial_rain_water_kg_per_kg == 0.0
    assert diagnostics.first_cloud_time_seconds is not None
    assert diagnostics.first_rain_time_seconds is not None
    assert diagnostics.first_cloud_time_seconds < diagnostics.first_rain_time_seconds
    assert diagnostics.max_cloud_liquid_water_kg_per_kg > 8e-4
    assert diagnostics.max_rain_water_kg_per_kg > RAIN_PRESENCE_THRESHOLD_KG_PER_KG
    assert diagnostics.min_moisture_kg_per_kg >= 0.0
    assert diagnostics.non_finite_value_count == 0


def test_stronger_lift_condenses_earlier_than_humid_lift_case() -> None:
    humid = validate_microphysics_case(_case_by_slug("humid-lifted-parcel")).diagnostics
    strong = validate_microphysics_case(_case_by_slug("strong-lift-rain-threshold")).diagnostics

    assert strong.first_cloud_time_seconds is not None
    assert humid.first_cloud_time_seconds is not None
    assert strong.first_cloud_time_seconds <= humid.first_cloud_time_seconds
    assert strong.max_cloud_liquid_water_kg_per_kg >= humid.max_cloud_liquid_water_kg_per_kg


def test_heating_offsets_lift_by_delaying_or_reducing_condensation() -> None:
    heated = validate_microphysics_case(_case_by_slug("heating-offsets-lift")).diagnostics
    reference_case = _case_by_slug("heating-offsets-lift")
    reference_config = reference_case.config.model_copy(
        update={
            "surface_heating": reference_case.config.surface_heating.model_copy(
                update={"max_warming_rate_k_per_s": 0.0}
            )
        }
    )
    reference = validate_microphysics_case(
        reference_case.__class__(
            slug="reference-no-heating",
            name="Reference no heating",
            description="No-heating reference for test comparison.",
            config=reference_config,
        )
    ).diagnostics

    assert heated.first_cloud_time_seconds is not None
    assert reference.first_cloud_time_seconds is not None
    assert heated.first_cloud_time_seconds >= reference.first_cloud_time_seconds
    assert heated.max_cloud_liquid_water_kg_per_kg <= (
        reference.max_cloud_liquid_water_kg_per_kg + 1e-5
    )


def _case_by_slug(slug: str) -> MicrophysicsValidationCase:
    return next(case for case in microphysics_validation_cases() if case.slug == slug)

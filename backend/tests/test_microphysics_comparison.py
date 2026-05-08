from app.sim.microphysics_comparison import run_microphysics_comparison


def test_microphysics_comparison_produces_expected_structure() -> None:
    result = run_microphysics_comparison()

    assert result["schema_version"] == "microphysics-comparison-v1"
    assert {
        "simple_saturation_adjustment",
        "microphysics_lab",
    } <= set(result["models"])
    assert len(result["cases"]) >= 4

    first_case = result["cases"][0]
    assert {
        "slug",
        "name",
        "forcing",
        "models",
        "interpretation",
    } <= set(first_case)
    assert {
        "first_cloud_time_seconds",
        "max_cloud_liquid_water_kg_per_kg",
        "integrated_cloud_liquid_water_kg_per_kg_s",
        "water_vapor_depletion_kg_per_kg",
        "first_rain_time_seconds",
        "max_rain_water_kg_per_kg",
        "final_temperature_c",
        "final_height_m",
    } <= set(first_case["models"]["microphysics_lab"])


def test_stronger_cooling_condenses_no_later_than_gentle_case() -> None:
    result = run_microphysics_comparison()
    cases = {case["slug"]: case for case in result["cases"]}

    gentle_cloud_time = cases["gentle-cooling-low-supersaturation"]["models"]["microphysics_lab"][
        "first_cloud_time_seconds"
    ]
    strong_cloud_time = cases["stronger-cooling-high-supersaturation"]["models"][
        "microphysics_lab"
    ]["first_cloud_time_seconds"]

    assert gentle_cloud_time is not None
    assert strong_cloud_time is not None
    assert strong_cloud_time <= gentle_cloud_time


def test_rain_stress_case_produces_more_rain_than_gentle_case() -> None:
    result = run_microphysics_comparison()
    cases = {case["slug"]: case for case in result["cases"]}

    gentle_rain = cases["gentle-cooling-low-supersaturation"]["models"]["microphysics_lab"][
        "max_rain_water_kg_per_kg"
    ]
    stress_rain = cases["rain-initiation-stress"]["models"]["microphysics_lab"][
        "max_rain_water_kg_per_kg"
    ]

    assert stress_rain >= gentle_rain

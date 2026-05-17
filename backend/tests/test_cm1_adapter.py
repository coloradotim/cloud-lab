from pathlib import Path

import pytest

from app.reference import ReferenceFrame, adapt_cm1_reference_output

pytestmark = pytest.mark.contract


def test_cm1_adapter_loads_tiny_fixture_and_maps_coordinates() -> None:
    run = adapt_cm1_reference_output(_tiny_cm1_fixture())

    assert run.schema_version == "reference-run-v1"
    assert run.source_model == "CM1"
    assert run.source_case_id == "tiny-shallow-cumulus"
    assert len(run.frames) == 2
    assert run.frames[0].grid.x_coordinates_m == [500.0, 1_500.0]
    assert run.frames[0].grid.z_coordinates_m == [250.0, 750.0, 1_250.0]
    assert run.frames[1].time_seconds == 60.0


def test_cm1_adapter_preserves_units_and_field_provenance() -> None:
    run = adapt_cm1_reference_output(_tiny_cm1_fixture())
    frame = run.frames[1]
    cloud_field = frame.fields["cloud_liquid_water_kg_per_kg"]

    assert cloud_field.values[1][0] == pytest.approx(2.0e-6)
    assert cloud_field.metadata.unit == "kg kg-1"
    assert cloud_field.metadata.source_variable == "qc"
    assert cloud_field.metadata.provenance == "Mapped from offline CM1/reference output."
    assert frame.provenance.source_model == "CM1"
    assert frame.provenance.source_is_synthetic_fixture is True
    assert "CM1 reference data is not interactive reduced-model output." in frame.assumptions


def test_cm1_adapter_reports_missing_optional_fields_as_warnings() -> None:
    run = adapt_cm1_reference_output(_tiny_cm1_fixture())

    assert "horizontal_velocity_m_per_s" not in run.frames[0].fields
    assert "pressure_pa" not in run.frames[0].fields
    assert "Missing CM1 field for horizontal_velocity_m_per_s." in run.warnings
    assert "Missing CM1 field for pressure_pa." in run.warnings
    assert run.diagnostics.missing_field_warnings == run.warnings


def test_cm1_adapter_computes_reference_diagnostics() -> None:
    run = adapt_cm1_reference_output(_tiny_cm1_fixture())
    diagnostics = run.diagnostics

    assert diagnostics.max_cloud_liquid_water_kg_per_kg == pytest.approx(2.0e-6)
    assert diagnostics.integrated_cloud_liquid_water_kg_per_kg == pytest.approx(3.0e-6)
    assert diagnostics.cloud_base_m == pytest.approx(750.0)
    assert diagnostics.cloud_top_m == pytest.approx(1_250.0)
    assert diagnostics.first_cloud_time_seconds == pytest.approx(60.0)
    assert diagnostics.max_updraft_m_per_s == pytest.approx(1.2)
    assert diagnostics.max_rain_water_kg_per_kg == pytest.approx(0.0)
    assert diagnostics.first_rain_time_seconds is None


def test_cm1_adapter_output_validates_and_is_visualization_ready() -> None:
    run = adapt_cm1_reference_output(_tiny_cm1_fixture())

    for frame in run.frames:
        ReferenceFrame.model_validate(frame.to_transport_dict())
    assert run.diagnostics.visualization_ready is True
    assert {
        "cloud_liquid_water_kg_per_kg",
        "potential_temperature_k",
        "vertical_velocity_m_per_s",
        "water_vapor_kg_per_kg",
    }.issubset(set(run.diagnostics.available_fields))


def test_cm1_adapter_rejects_field_shape_mismatch() -> None:
    fixture = _tiny_cm1_fixture()
    variables = fixture["variables"]
    assert isinstance(variables, dict)
    variables["qc"] = [
        [[0.0, 0.0]],
        [[0.0, 0.0]],
    ]

    with pytest.raises(ValueError, match="row count"):
        adapt_cm1_reference_output(fixture)


def test_reference_adapter_does_not_add_default_heavy_dependencies() -> None:
    pyproject = Path(__file__).parents[1] / "pyproject.toml"
    pyproject_text = pyproject.read_text()

    default_dependencies = pyproject_text.split("[project.optional-dependencies]", maxsplit=1)[0]
    assert "xarray" not in default_dependencies
    assert "netCDF4" not in default_dependencies


def _tiny_cm1_fixture() -> dict[str, object]:
    zero = [
        [0.0, 0.0],
        [0.0, 0.0],
        [0.0, 0.0],
    ]
    return {
        "source_case_id": "tiny-shallow-cumulus",
        "source_is_synthetic_fixture": True,
        "source_file_metadata": {
            "fixture_kind": "synthetic_cm1_like_mapping_fixture",
            "cm1_version": None,
        },
        "time_seconds": [0.0, 60.0],
        "x_coordinates_m": [500.0, 1_500.0],
        "z_coordinates_m": [250.0, 750.0, 1_250.0],
        "variable_units": {
            "theta": "K",
            "qv": "kg kg-1",
            "qc": "kg kg-1",
            "qr": "kg kg-1",
            "w": "m s-1",
        },
        "variables": {
            "theta": [
                [
                    [299.0, 299.1],
                    [296.0, 296.1],
                    [293.0, 293.1],
                ],
                [
                    [299.2, 299.3],
                    [296.2, 296.3],
                    [293.2, 293.3],
                ],
            ],
            "qv": [
                [
                    [0.010, 0.010],
                    [0.009, 0.009],
                    [0.007, 0.007],
                ],
                [
                    [0.010, 0.010],
                    [0.009, 0.009],
                    [0.007, 0.007],
                ],
            ],
            "qc": [
                zero,
                [
                    [0.0, 0.0],
                    [2.0e-6, 0.0],
                    [0.0, 1.0e-6],
                ],
            ],
            "qr": [zero, zero],
            "w": [
                [
                    [0.0, 0.0],
                    [0.2, 0.1],
                    [0.0, 0.0],
                ],
                [
                    [0.0, 0.0],
                    [1.2, 0.4],
                    [0.1, 0.0],
                ],
            ],
        },
    }

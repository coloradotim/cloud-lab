import json
import subprocess
from pathlib import Path

import pytest

from app.reference import ReferenceRun, ingest_cm1_reference_output, write_local_reference_index

pytestmark = pytest.mark.contract


def test_cm1_ingest_writes_reference_run_and_manifest(tmp_path: Path) -> None:
    input_dir = tmp_path / "shallow-input"
    output_dir = tmp_path / "ingested"
    input_dir.mkdir()
    (input_dir / "cloud_lab_cm1_adapter_input.json").write_text(
        json.dumps(_adapter_source(cloud=True)),
        encoding="utf-8",
    )

    artifact = ingest_cm1_reference_output(
        case_id="cm1-shallow-cumulus-baseline-v1",
        input_dir=input_dir,
        output_dir=output_dir,
        cm1_version="cm1r21.1-test",
    )

    saved_run = ReferenceRun.model_validate(
        json.loads(artifact.artifact_path.read_text(encoding="utf-8"))
    )
    saved_manifest = json.loads(artifact.manifest_path.read_text(encoding="utf-8"))

    assert saved_run.schema_version == "reference-run-v1"
    assert saved_run.source_case_id == "cm1-shallow-cumulus-baseline-v1"
    assert saved_run.frames[0].provenance.source_is_synthetic_fixture is False
    assert saved_run.frames[0].provenance.source_file_metadata["cm1_version"] == "cm1r21.1-test"
    assert saved_manifest["schema_version"] == "cloud-lab-cm1-ingested-reference-manifest-v1"
    assert saved_manifest["required_fields_missing"] == []
    assert saved_manifest["frame_count"] == 2
    assert saved_manifest["time_range_seconds"] == [0.0, 60.0]
    assert saved_manifest["grid_shape"] == {"rows": 2, "columns": 2}
    assert saved_manifest["diagnostics_available"]["first_cloud_time_seconds"] == 60.0
    assert not any("case may need calibration" in warning for warning in saved_manifest["warnings"])


def test_cm1_ingest_reports_dry_failed_cloud_calibration_warning(tmp_path: Path) -> None:
    input_dir = tmp_path / "dry-input"
    output_dir = tmp_path / "ingested"
    input_dir.mkdir()
    (input_dir / "cloud_lab_cm1_adapter_input.json").write_text(
        json.dumps(_adapter_source(cloud=True)),
        encoding="utf-8",
    )

    artifact = ingest_cm1_reference_output(
        case_id="cm1-dry-failed-cumulus-v1",
        input_dir=input_dir,
        output_dir=output_dir,
    )

    assert any(
        "Dry failed cumulus output contains meaningful cloud water" in warning
        for warning in artifact.manifest["warnings"]
    )


def test_cm1_ingest_preserves_missing_field_warnings(tmp_path: Path) -> None:
    input_dir = tmp_path / "missing-input"
    output_dir = tmp_path / "ingested"
    source = _adapter_source(cloud=False)
    variables = source["variables"]
    assert isinstance(variables, dict)
    variables.pop("w")
    input_dir.mkdir()
    (input_dir / "cloud_lab_cm1_adapter_input.json").write_text(
        json.dumps(source),
        encoding="utf-8",
    )

    artifact = ingest_cm1_reference_output(
        case_id="cm1-dry-failed-cumulus-v1",
        input_dir=input_dir,
        output_dir=output_dir,
    )

    assert "Missing CM1 field for vertical_velocity_m_per_s." in artifact.run.warnings
    assert "vertical_velocity_m_per_s" in artifact.manifest["required_fields_missing"]


def test_cm1_ingest_rejects_invalid_grid_shape(tmp_path: Path) -> None:
    input_dir = tmp_path / "bad-input"
    output_dir = tmp_path / "ingested"
    source = _adapter_source(cloud=False)
    variables = source["variables"]
    assert isinstance(variables, dict)
    variables["qc"] = [[[0.0, 0.0]]]
    input_dir.mkdir()
    (input_dir / "cloud_lab_cm1_adapter_input.json").write_text(
        json.dumps(source),
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="row count"):
        ingest_cm1_reference_output(
            case_id="cm1-dry-failed-cumulus-v1",
            input_dir=input_dir,
            output_dir=output_dir,
        )


def test_cm1_ingest_writes_local_reference_index(tmp_path: Path) -> None:
    input_dir = tmp_path / "shallow-input"
    output_dir = tmp_path / "ingested"
    index_dir = tmp_path / "public-index"
    input_dir.mkdir()
    (input_dir / "cloud_lab_cm1_adapter_input.json").write_text(
        json.dumps(_adapter_source(cloud=True)),
        encoding="utf-8",
    )
    artifact = ingest_cm1_reference_output(
        case_id="cm1-shallow-cumulus-baseline-v1",
        input_dir=input_dir,
        output_dir=output_dir,
    )

    index_path = write_local_reference_index(
        artifacts=[artifact],
        output_dir=index_dir,
        public_base_url="/reference/cm1/local",
    )
    index = json.loads(index_path.read_text(encoding="utf-8"))

    assert index["schema_version"] == "cloud-lab-cm1-local-reference-index-v1"
    assert index["runs"][0]["case_id"] == "cm1-shallow-cumulus-baseline-v1"
    assert index["runs"][0]["artifact_url"] == (
        "/reference/cm1/local/cm1-shallow-cumulus-baseline-v1/reference-run.json"
    )


def test_cm1_ingest_scripts_have_help_and_syntax() -> None:
    root = Path(__file__).parents[2]
    scripts = [
        root / "scripts/reference/cm1/ingest_reference_pair.sh",
        root / "scripts/reference/cm1/ingest_cm1_output.py",
    ]

    subprocess.run(["bash", "-n", str(scripts[0])], check=True)
    for script in scripts:
        result = subprocess.run([str(script), "--help"], check=True, text=True, capture_output=True)
        assert "ingest" in result.stdout.lower()


def _adapter_source(*, cloud: bool) -> dict[str, object]:
    cloud_frame = [[0.0, 0.0], [2.0e-6, 0.0]] if cloud else [[0.0, 0.0], [0.0, 0.0]]
    return {
        "source_case_id": "will-be-overridden",
        "source_is_synthetic_fixture": True,
        "source_file_metadata": {
            "fixture_kind": "test_adapter_source",
        },
        "time_seconds": [0.0, 60.0],
        "x_coordinates_m": [0.0, 500.0],
        "z_coordinates_m": [250.0, 750.0],
        "variable_units": {
            "theta": "K",
            "qv": "kg kg-1",
            "qc": "kg kg-1",
            "w": "m s-1",
        },
        "variables": {
            "theta": [
                [[299.0, 299.0], [296.0, 296.0]],
                [[299.0, 299.0], [296.0, 296.0]],
            ],
            "qv": [
                [[0.011, 0.011], [0.009, 0.009]],
                [[0.011, 0.011], [0.009, 0.009]],
            ],
            "qc": [
                [[0.0, 0.0], [0.0, 0.0]],
                cloud_frame,
            ],
            "w": [
                [[0.0, 0.0], [0.1, 0.0]],
                [[0.0, 0.0], [1.2, 0.0]],
            ],
        },
    }

from __future__ import annotations

import importlib.util
import json
import os
import stat
import subprocess
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
BATCH_SCRIPT_PATH = ROOT / "scripts/reference/cm1/run_validation_batch.py"
SHELL_WRAPPER = ROOT / "scripts/reference/cm1/run_validation_batch.sh"

spec = importlib.util.spec_from_file_location("cm1_validation_batch", BATCH_SCRIPT_PATH)
assert spec is not None
batch = importlib.util.module_from_spec(spec)
sys.modules["cm1_validation_batch"] = batch
assert spec.loader is not None
spec.loader.exec_module(batch)


def _write_executable(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IXUSR)


def _cm1_run_dir(tmp_path: Path, script: str, *, include_landuse: bool = True) -> Path:
    run_dir = tmp_path / "cm1-run"
    run_dir.mkdir()
    _write_executable(run_dir / "cm1.exe", script)
    if include_landuse:
        (run_dir / "LANDUSE.TBL").write_text("fake landuse table\n", encoding="utf-8")
    return run_dir


def _preflight_env(tmp_path: Path) -> dict[str, str]:
    fake_bin = tmp_path / "fake-bin"
    fake_pythonpath = tmp_path / "fake-pythonpath"
    fake_bin.mkdir(exist_ok=True)
    fake_pythonpath.mkdir(exist_ok=True)
    _write_executable(fake_bin / "nf-config", "#!/usr/bin/env bash\necho /tmp/fake-netcdf\n")
    (fake_pythonpath / "xarray.py").write_text("# fake test module\n", encoding="utf-8")
    (fake_pythonpath / "netCDF4.py").write_text("# fake test module\n", encoding="utf-8")
    env = os.environ.copy()
    env["PATH"] = f"{fake_bin}{os.pathsep}{env.get('PATH', '')}"
    env["PYTHONPATH"] = f"{fake_pythonpath}{os.pathsep}{env.get('PYTHONPATH', '')}"
    return env


def _fake_cm1_script(*, dry_succeeds: bool = True, shallow_succeeds: bool = True) -> str:
    dry_block = _adapter_source_json(cloud=False)
    shallow_block = _adapter_source_json(cloud=True)
    capped_block = _adapter_source_json(cloud=False)
    humid_block = _adapter_source_json(cloud=True)
    low_stratus_block = _adapter_source_json(cloud=True, low_cloud=True)
    dry_exit = "exit 7" if not dry_succeeds else ""
    shallow_exit = "exit 8" if not shallow_succeeds else ""
    return f"""#!/usr/bin/env bash
set -euo pipefail
case "$PWD" in
  *dry-failed-cumulus*)
    echo "fake dry CM1 run"
    {dry_exit}
    touch cm1out_000001.nc
    cat > cloud_lab_cm1_adapter_input.json <<'JSON'
{dry_block}
JSON
    ;;
  *shallow-cumulus-baseline*)
    echo "fake shallow CM1 run"
    {shallow_exit}
    touch cm1out_000001.nc
    cat > cloud_lab_cm1_adapter_input.json <<'JSON'
{shallow_block}
JSON
    ;;
  *capped-suppressed-cumulus*)
    echo "fake capped/suppressed CM1 run"
    touch cm1out_000001.nc
    cat > cloud_lab_cm1_adapter_input.json <<'JSON'
{capped_block}
JSON
    ;;
  *humid-low-cloud-contrast*)
    echo "fake humid low-cloud CM1 run"
    touch cm1out_000001.nc
    cat > cloud_lab_cm1_adapter_input.json <<'JSON'
{humid_block}
JSON
    ;;
  *low-stratus-develops*)
    echo "fake low-stratus CM1 run"
    touch cm1out_000001.nc
    cat > cloud_lab_cm1_adapter_input.json <<'JSON'
{low_stratus_block}
JSON
    ;;
  *)
    echo "unknown fake CM1 case" >&2
    exit 9
    ;;
esac
"""


def test_validation_batch_dry_run_reports_planned_cases(tmp_path: Path) -> None:
    cm1_run_dir = _cm1_run_dir(tmp_path, _fake_cm1_script())
    output_root = tmp_path / "validation-runs"

    result = subprocess.run(
        [
            str(SHELL_WRAPPER),
            "--cm1-run-dir",
            str(cm1_run_dir),
            "--output-root",
            str(output_root),
        ],
        check=False,
        text=True,
        capture_output=True,
        cwd=ROOT,
        env=_preflight_env(tmp_path),
    )

    assert result.returncode == 0, result.stderr
    report_path = _reported_path(result.stdout)
    report = json.loads(report_path.read_text(encoding="utf-8"))
    assert report["execute"] is False
    assert report["case_count"] == 5
    assert {case["case_id"] for case in report["case_results"]} == {
        "cm1-dry-failed-cumulus-v1",
        "cm1-shallow-cumulus-baseline-v1",
        "cm1-capped-suppressed-cumulus-v1",
        "cm1-humid-low-cloud-contrast-v1",
        "cm1-low-stratus-develops-v1",
    }
    assert {case["status"] for case in report["case_results"]} == {"planned"}
    assert not (report_path.parent / "dry-failed-cumulus/cm1.stdout.log").exists()


def test_validation_batch_preflight_fails_when_required_landuse_is_missing(
    tmp_path: Path,
) -> None:
    cm1_run_dir = _cm1_run_dir(tmp_path, _fake_cm1_script(), include_landuse=False)

    result = subprocess.run(
        [
            str(SHELL_WRAPPER),
            "--cm1-run-dir",
            str(cm1_run_dir),
            "--output-root",
            str(tmp_path / "validation-runs"),
            "--execute",
        ],
        check=False,
        text=True,
        capture_output=True,
        cwd=ROOT,
        env=_preflight_env(tmp_path),
    )

    assert result.returncode == 1
    assert "requires LANDUSE.TBL" in result.stderr


def test_validation_batch_records_ingest_success_and_qc_statuses(tmp_path: Path) -> None:
    cm1_run_dir = _cm1_run_dir(tmp_path, _fake_cm1_script())

    result = subprocess.run(
        [
            str(SHELL_WRAPPER),
            "--cm1-run-dir",
            str(cm1_run_dir),
            "--output-root",
            str(tmp_path / "validation-runs"),
            "--ingested-output",
            str(tmp_path / "ingested"),
            "--public-output",
            str(tmp_path / "public"),
            "--execute",
        ],
        check=False,
        text=True,
        capture_output=True,
        cwd=ROOT,
        env=_preflight_env(tmp_path),
    )

    assert result.returncode == 0, result.stderr
    report = json.loads(_reported_path(result.stdout).read_text(encoding="utf-8"))
    by_case = {case["case_id"]: case for case in report["case_results"]}

    assert by_case["cm1-dry-failed-cumulus-v1"]["status"] == "accepted"
    assert by_case["cm1-dry-failed-cumulus-v1"]["agreement_status"] in {
        "accepted",
        "accepted_with_notes",
    }
    assert by_case["cm1-dry-failed-cumulus-v1"]["max_cloud_water"] == 0.0
    assert by_case["cm1-shallow-cumulus-baseline-v1"]["status"] == "accepted"
    assert by_case["cm1-shallow-cumulus-baseline-v1"]["first_cloud_time"] == 60.0
    assert by_case["cm1-shallow-cumulus-baseline-v1"]["cloud_base"] == 750.0
    assert by_case["cm1-shallow-cumulus-baseline-v1"]["frontend_index_status"] == "updated"
    assert by_case["cm1-capped-suppressed-cumulus-v1"]["status"] == "accepted"
    assert by_case["cm1-humid-low-cloud-contrast-v1"]["status"] == "accepted"
    assert by_case["cm1-low-stratus-develops-v1"]["status"] == "accepted"
    assert by_case["cm1-low-stratus-develops-v1"]["cloud_base"] == 250.0
    assert report["summary"]["accepted_count"] == 5


def test_validation_batch_continues_after_cm1_case_failure(tmp_path: Path) -> None:
    cm1_run_dir = _cm1_run_dir(tmp_path, _fake_cm1_script(dry_succeeds=False))

    result = subprocess.run(
        [
            str(SHELL_WRAPPER),
            "--cm1-run-dir",
            str(cm1_run_dir),
            "--output-root",
            str(tmp_path / "validation-runs"),
            "--ingested-output",
            str(tmp_path / "ingested"),
            "--public-output",
            str(tmp_path / "public"),
            "--execute",
        ],
        check=False,
        text=True,
        capture_output=True,
        cwd=ROOT,
        env=_preflight_env(tmp_path),
    )

    assert result.returncode == 0, result.stderr
    report = json.loads(_reported_path(result.stdout).read_text(encoding="utf-8"))
    by_case = {case["case_id"]: case for case in report["case_results"]}

    assert by_case["cm1-dry-failed-cumulus-v1"]["status"] == "cm1_failed"
    assert by_case["cm1-shallow-cumulus-baseline-v1"]["status"] == "accepted"
    assert report["summary"]["failed_count"] == 1


def test_validation_batch_records_missing_netcdf_output_as_cm1_failure(tmp_path: Path) -> None:
    cm1_run_dir = _cm1_run_dir(
        tmp_path,
        "#!/usr/bin/env bash\nset -euo pipefail\necho 'finished without output'\n",
    )

    result = subprocess.run(
        [
            str(SHELL_WRAPPER),
            "--cm1-run-dir",
            str(cm1_run_dir),
            "--output-root",
            str(tmp_path / "validation-runs"),
            "--ingested-output",
            str(tmp_path / "ingested"),
            "--public-output",
            str(tmp_path / "public"),
            "--case-id",
            "cm1-dry-failed-cumulus-v1",
            "--execute",
        ],
        check=False,
        text=True,
        capture_output=True,
        cwd=ROOT,
        env=_preflight_env(tmp_path),
    )

    assert result.returncode == 0, result.stderr
    report = json.loads(_reported_path(result.stdout).read_text(encoding="utf-8"))
    case = report["case_results"][0]
    assert case["status"] == "cm1_failed"
    assert case["agreement_status"] == "failed"
    assert any("expected output" in warning.lower() for warning in case["warnings"])


def test_validation_batch_help_and_syntax() -> None:
    subprocess.run(["bash", "-n", str(SHELL_WRAPPER)], check=True)
    subprocess.run([sys.executable, "-m", "py_compile", str(BATCH_SCRIPT_PATH)], check=True)
    result = subprocess.run(
        [str(SHELL_WRAPPER), "--help"],
        check=True,
        text=True,
        capture_output=True,
        cwd=ROOT,
    )
    assert "validation batch" in result.stdout.lower()


def test_validation_batch_outputs_remain_gitignored() -> None:
    gitignore = (ROOT / ".gitignore").read_text(encoding="utf-8")

    assert "data/reference/cm1/" in gitignore
    assert "frontend/public/reference/cm1/local/" in gitignore
    assert not list((ROOT / "reference/cm1/cases").glob("**/*.nc"))
    assert not list((ROOT / "reference/cm1/cases").glob("**/LANDUSE.TBL"))


def _reported_path(stdout: str) -> Path:
    prefix = "Wrote CM1 validation batch report: "
    for line in stdout.splitlines():
        if line.startswith(prefix):
            return Path(line.removeprefix(prefix))
    raise AssertionError(f"Report path not found in stdout: {stdout}")


def _adapter_source_json(*, cloud: bool, low_cloud: bool = False) -> str:
    if not cloud:
        cloud_frame = [[0.0, 0.0], [0.0, 0.0]]
    elif low_cloud:
        cloud_frame = [[2.0e-6, 0.0], [0.0, 0.0]]
    else:
        cloud_frame = [[0.0, 0.0], [2.0e-6, 0.0]]
    source: dict[str, Any] = {
        "source_case_id": "will-be-overridden",
        "source_is_synthetic_fixture": True,
        "source_file_metadata": {"fixture_kind": "validation_batch_test"},
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
    return json.dumps(source)

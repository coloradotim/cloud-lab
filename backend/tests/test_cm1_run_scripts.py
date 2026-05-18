from __future__ import annotations

import re
import stat
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RUN_CASE_SCRIPT = ROOT / "scripts/reference/cm1/run_cm1_case.sh"


def _write_executable(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IXUSR)


def _make_cm1_run_dir(tmp_path: Path, cm1_script: str, *, include_landuse: bool) -> Path:
    cm1_run_dir = tmp_path / "cm1-run"
    cm1_run_dir.mkdir()
    _write_executable(cm1_run_dir / "cm1.exe", cm1_script)
    if include_landuse:
        (cm1_run_dir / "LANDUSE.TBL").write_text("fake landuse table\n", encoding="utf-8")
    return cm1_run_dir


def _make_case_dir(
    tmp_path: Path,
    *,
    output_format: int = 2,
    requires_landuse: bool = True,
    sounding_top_m: float = 20_000.0,
) -> Path:
    case_dir = tmp_path / "case"
    case_dir.mkdir()
    isfcflx = 1 if requires_landuse else 0
    sfcmodel = 1 if requires_landuse else 0
    initsfc = 1 if requires_landuse else 0
    (case_dir / "namelist.input").write_text(
        f"""
 &param0
 nx = 4,
 ny = 4,
 nz = 4,
 /
 &param1
 dz = 500.0,
 /
 &param9
 output_format = {output_format},
 /
 &param12
 isfcflx = {isfcflx},
 sfcmodel = {sfcmodel},
 initsfc = {initsfc},
 /
""".strip()
        + "\n",
        encoding="utf-8",
    )
    (case_dir / "input_sounding").write_text(
        f"""
965.0 299.0 10.0
0.0 299.0 10.0 2.0 0.0
{sounding_top_m:.1f} 310.0 1.0 5.0 0.0
""".lstrip(),
        encoding="utf-8",
    )
    return case_dir


def _run_case(
    tmp_path: Path,
    case_dir: Path,
    cm1_run_dir: Path,
    *,
    execute: bool = True,
) -> subprocess.CompletedProcess[str]:
    output_dir = tmp_path / "output"
    args = [
        str(RUN_CASE_SCRIPT),
        "--case-dir",
        str(case_dir),
        "--cm1-run-dir",
        str(cm1_run_dir),
        "--output-dir",
        str(output_dir),
    ]
    if execute:
        args.append("--execute")
    return subprocess.run(
        args,
        check=False,
        text=True,
        capture_output=True,
        cwd=ROOT,
    )


def _namelist_value(path: Path, key: str) -> float:
    pattern = re.compile(rf"^\s*{re.escape(key)}\s*=\s*([^,!]+)", re.IGNORECASE)
    for line in path.read_text(encoding="utf-8").splitlines():
        match = pattern.match(line)
        if match:
            return float(match.group(1).strip())
    raise AssertionError(f"{key} not found in {path}")


def _sounding_top(path: Path) -> float:
    top = 0.0
    for line in path.read_text(encoding="utf-8").splitlines()[1:]:
        parts = line.split()
        if len(parts) >= 5:
            top = float(parts[0])
    return top


def test_run_cm1_case_copies_landuse_and_requires_netcdf_output(tmp_path: Path) -> None:
    case_dir = _make_case_dir(tmp_path, output_format=2, requires_landuse=True)
    cm1_run_dir = _make_cm1_run_dir(
        tmp_path,
        "#!/usr/bin/env bash\nset -euo pipefail\ntouch cm1out_000001.nc\n",
        include_landuse=True,
    )

    result = _run_case(tmp_path, case_dir, cm1_run_dir)

    assert result.returncode == 0, result.stderr
    assert (tmp_path / "output/LANDUSE.TBL").is_file()
    assert (tmp_path / "output/cm1out_000001.nc").is_file()
    assert "produced expected output: NetCDF (*.nc)" in result.stdout


def test_run_cm1_case_fails_before_execute_when_required_landuse_is_missing(
    tmp_path: Path,
) -> None:
    case_dir = _make_case_dir(tmp_path, output_format=2, requires_landuse=True)
    cm1_run_dir = _make_cm1_run_dir(
        tmp_path,
        "#!/usr/bin/env bash\nset -euo pipefail\ntouch should-not-run.nc\n",
        include_landuse=False,
    )

    result = _run_case(tmp_path, case_dir, cm1_run_dir)

    assert result.returncode == 1
    assert "Missing required CM1 runtime support file" in result.stderr
    assert not (tmp_path / "output/should-not-run.nc").exists()


def test_run_cm1_case_rejects_soundings_below_grid_top(tmp_path: Path) -> None:
    case_dir = _make_case_dir(
        tmp_path,
        output_format=2,
        requires_landuse=False,
        sounding_top_m=1_000.0,
    )
    cm1_run_dir = _make_cm1_run_dir(
        tmp_path,
        "#!/usr/bin/env bash\nset -euo pipefail\ntouch cm1out_000001.nc\n",
        include_landuse=False,
    )

    result = _run_case(tmp_path, case_dir, cm1_run_dir, execute=False)

    assert result.returncode == 1
    assert "input_sounding top is below the configured grid top" in result.stderr


def test_run_cm1_case_fails_when_expected_netcdf_output_is_missing(
    tmp_path: Path,
) -> None:
    case_dir = _make_case_dir(tmp_path, output_format=2, requires_landuse=True)
    cm1_run_dir = _make_cm1_run_dir(
        tmp_path,
        "#!/usr/bin/env bash\nset -euo pipefail\necho 'finished without output'\n",
        include_landuse=True,
    )

    result = _run_case(tmp_path, case_dir, cm1_run_dir)

    assert result.returncode == 1
    assert "expected output was not found: NetCDF (*.nc)" in result.stderr
    assert "stdout:" in result.stderr
    assert "finished without output" in result.stderr


def test_run_cm1_case_surfaces_known_netcdf_compile_failure(tmp_path: Path) -> None:
    case_dir = _make_case_dir(tmp_path, output_format=2, requires_landuse=True)
    cm1_run_dir = _make_cm1_run_dir(
        tmp_path,
        """#!/usr/bin/env bash
set -euo pipefail
echo 'You have requested netcdf output, but you have not compiled the code with netcdf capability.'
exit 2
""",
        include_landuse=True,
    )

    result = _run_case(tmp_path, case_dir, cm1_run_dir)

    assert result.returncode == 2
    assert "not compiled with NetCDF support" in result.stderr
    assert "CM1 src/Makefile" in result.stderr


def test_run_cm1_case_dry_run_stays_safe(tmp_path: Path) -> None:
    case_dir = _make_case_dir(tmp_path, output_format=2, requires_landuse=True)
    cm1_run_dir = _make_cm1_run_dir(
        tmp_path,
        "#!/usr/bin/env bash\nset -euo pipefail\ntouch should-not-run.nc\n",
        include_landuse=False,
    )

    result = _run_case(tmp_path, case_dir, cm1_run_dir, execute=False)

    assert result.returncode == 0, result.stderr
    assert "Dry run only" in result.stdout
    assert not (tmp_path / "output").exists()


def test_committed_reference_pair_soundings_cover_configured_grid_top() -> None:
    for case_dir in [
        ROOT / "reference/cm1/cases/dry-failed-cumulus",
        ROOT / "reference/cm1/cases/shallow-cumulus-baseline",
    ]:
        namelist = case_dir / "namelist.input"
        sounding = case_dir / "input_sounding"
        nz = _namelist_value(namelist, "nz")
        dz = _namelist_value(namelist, "dz")
        ztop = _namelist_value(namelist, "ztop")
        grid_top = max(nz * dz, ztop)

        assert _namelist_value(namelist, "output_format") == 2
        assert _sounding_top(sounding) >= grid_top


def test_generated_cm1_outputs_and_runtime_files_are_gitignored() -> None:
    gitignore = (ROOT / ".gitignore").read_text(encoding="utf-8")

    assert "data/reference/cm1/" in gitignore
    assert "frontend/public/reference/cm1/local/" in gitignore
    assert not (ROOT / "reference/cm1/cases/dry-failed-cumulus/LANDUSE.TBL").exists()
    assert not (ROOT / "reference/cm1/cases/shallow-cumulus-baseline/LANDUSE.TBL").exists()
    assert not list((ROOT / "reference/cm1/cases").glob("**/*.nc"))

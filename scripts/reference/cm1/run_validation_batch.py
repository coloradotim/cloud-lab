#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parents[3]
BACKEND_DIR = ROOT_DIR / "backend"
VENV_PYTHON = BACKEND_DIR / ".venv/bin/python"
if VENV_PYTHON.exists() and Path(sys.executable).resolve() != VENV_PYTHON.resolve():
    os.execv(str(VENV_PYTHON), [str(VENV_PYTHON), *sys.argv])

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.reference.cm1_ingest import REFERENCE_CASE_IDS  # noqa: E402


CASE_STATUS_PLANNED = "planned"
CASE_STATUS_RUNNING = "running"
CASE_STATUS_CM1_FAILED = "cm1_failed"
CASE_STATUS_INGEST_FAILED = "ingest_failed"
CASE_STATUS_QC_FAILED = "qc_failed"
CASE_STATUS_ACCEPTED = "accepted"
CASE_STATUS_NEEDS_CALIBRATION = "needs_calibration"
QC_ACCEPTED = "accepted"
QC_ACCEPTED_WITH_NOTES = "accepted_with_notes"
QC_NEEDS_CALIBRATION = "needs_calibration"
QC_FAILED = "failed"
CLOUD_MEANINGFUL_THRESHOLD_KG_PER_KG = 1.0e-8


@dataclass(frozen=True)
class BatchCase:
    case_id: str
    case_name: str
    case_dir: Path
    slug: str
    expected_regime: str
    matrix_status: str


def main() -> None:
    args = parse_args()
    try:
        report_path = run_validation_batch(args)
    except BatchFatalError as exc:
        print(f"Fatal preflight failure: {exc}", file=sys.stderr)
        sys.exit(1)

    print(f"Wrote CM1 validation batch report: {report_path}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run, ingest, QC, and report on a local CM1 validation batch."
    )
    parser.add_argument("--cm1-run-dir", required=True, type=Path)
    parser.add_argument(
        "--matrix",
        default=ROOT_DIR / "docs/reference-models/cm1-lower-atmosphere-validation-matrix.md",
        type=Path,
    )
    parser.add_argument("--case-root", default=ROOT_DIR / "reference/cm1/cases", type=Path)
    parser.add_argument(
        "--output-root",
        default=ROOT_DIR / "data/reference/cm1/validation-runs",
        type=Path,
    )
    parser.add_argument(
        "--ingested-output",
        default=ROOT_DIR / "data/reference/cm1/ingested",
        type=Path,
    )
    parser.add_argument(
        "--public-output",
        default=ROOT_DIR / "frontend/public/reference/cm1/local",
        type=Path,
    )
    parser.add_argument("--case-id", action="append", choices=REFERENCE_CASE_IDS)
    parser.add_argument("--cm1-version", default=None)
    parser.add_argument("--mpi-procs", default=None)
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def run_validation_batch(args: argparse.Namespace) -> Path:
    cm1_run_dir = _resolve_path(args.cm1_run_dir)
    matrix_path = _resolve_path(args.matrix)
    case_root = _resolve_path(args.case_root)
    output_root = _resolve_path(args.output_root)
    ingested_output = _resolve_path(args.ingested_output)
    public_output = _resolve_path(args.public_output)
    batch_id = _utc_now_compact()
    batch_dir = output_root / batch_id
    cases = discover_batch_cases(
        case_root=case_root,
        matrix_path=matrix_path,
        selected_case_ids=args.case_id,
    )
    preflight = run_preflight(
        cm1_run_dir=cm1_run_dir,
        matrix_path=matrix_path,
        cases=cases,
        execute=args.execute,
    )
    if preflight["fatal"]:
        raise BatchFatalError("; ".join(preflight["errors"]))

    batch_dir.mkdir(parents=True, exist_ok=True)
    report = {
        "schema_version": "cloud-lab-cm1-validation-batch-report-v1",
        "batch_id": batch_id,
        "created_at": _utc_now(),
        "cm1_version": args.cm1_version,
        "matrix_path": str(matrix_path),
        "matrix_version_or_commit": _git_head_short(),
        "execute": args.execute,
        "case_count": len(cases),
        "preflight": preflight,
        "case_results": [],
        "summary": {},
    }

    for case in cases:
        result = run_case_workflow(
            case=case,
            batch_dir=batch_dir,
            cm1_run_dir=cm1_run_dir,
            ingested_output=ingested_output,
            public_output=public_output,
            execute=args.execute,
            force=args.force,
            mpi_procs=args.mpi_procs,
            cm1_version=args.cm1_version,
        )
        report["case_results"].append(result)

    report["summary"] = summarize_case_results(report["case_results"])
    report_path = batch_dir / "validation-report.json"
    report_path.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
    return report_path


def discover_batch_cases(
    *,
    case_root: Path,
    matrix_path: Path,
    selected_case_ids: list[str] | None,
) -> list[BatchCase]:
    if not case_root.is_dir():
        raise BatchFatalError(f"Case root not found: {case_root}")
    matrix_entries = parse_validation_matrix(matrix_path)
    selected = set(selected_case_ids or REFERENCE_CASE_IDS)
    cases: list[BatchCase] = []
    for manifest_path in sorted(case_root.glob("*/manifest.json")):
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        case_id = str(manifest.get("case_id", ""))
        if case_id not in selected:
            continue
        if case_id not in REFERENCE_CASE_IDS:
            continue
        case_dir = manifest_path.parent
        matrix_entry = matrix_entries.get(case_id, {})
        cases.append(
            BatchCase(
                case_id=case_id,
                case_name=str(manifest.get("case_name") or case_dir.name),
                case_dir=case_dir,
                slug=case_dir.name,
                expected_regime=str(
                    matrix_entry.get("expected_regime")
                    or manifest.get("expected_outcome")
                    or "not specified"
                ),
                matrix_status=str(matrix_entry.get("validation_status") or "not specified"),
            )
        )
    if not cases:
        selected_text = ", ".join(sorted(selected))
        raise BatchFatalError(f"No committed runnable validation cases found for: {selected_text}")
    return cases


def parse_validation_matrix(matrix_path: Path) -> dict[str, dict[str, str]]:
    if not matrix_path.is_file():
        raise BatchFatalError(f"Validation matrix not found: {matrix_path}")
    entries: dict[str, dict[str, str]] = {}
    for line in matrix_path.read_text(encoding="utf-8").splitlines():
        if not line.startswith("|"):
            continue
        cells = [_clean_markdown_cell(cell) for cell in line.strip().strip("|").split("|")]
        if len(cells) < 16 or cells[0] in {"---", "Phase"}:
            continue
        case_id = cells[1]
        if not case_id.startswith("cm1-"):
            continue
        entries[case_id] = {
            "phase": cells[0],
            "experiment_served": cells[2],
            "controls_represented": cells[3],
            "expected_regime": cells[4],
            "observed_regime": cells[5],
            "cloud_outcome": cells[7],
            "agreement_target": cells[14],
            "validation_status": cells[15],
            "notes": cells[16] if len(cells) > 16 else "",
        }
    return entries


def run_preflight(
    *,
    cm1_run_dir: Path,
    matrix_path: Path,
    cases: list[BatchCase],
    execute: bool,
) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    cm1_exe = cm1_run_dir / "cm1.exe"

    if not cm1_run_dir.is_dir():
        errors.append(f"CM1 run directory not found: {cm1_run_dir}")
    if not cm1_exe.is_file():
        errors.append(f"CM1 executable not found: {cm1_exe}")
    elif execute and not os.access(cm1_exe, os.X_OK):
        errors.append(f"CM1 executable is not executable: {cm1_exe}")

    any_netcdf = False
    for case in cases:
        namelist = case.case_dir / "namelist.input"
        sounding = case.case_dir / "input_sounding"
        output_format = namelist_int(namelist, "output_format", default=1)
        if output_format == 2:
            any_netcdf = True
        if case_requires_landuse(namelist) and not (cm1_run_dir / "LANDUSE.TBL").is_file():
            errors.append(
                f"{case.case_id} requires LANDUSE.TBL, but it was not found in {cm1_run_dir}."
            )
        sounding_error = validate_sounding_top(namelist, sounding)
        if sounding_error:
            errors.append(f"{case.case_id}: {sounding_error}")

    if any_netcdf:
        if shutil.which("nf-config") is None:
            message = (
                "At least one case uses output_format = 2, but nf-config was not found. "
                "Install NetCDF Fortran and rebuild CM1 with NetCDF support."
            )
            if execute:
                errors.append(message)
            else:
                warnings.append(message)
        for package in ("xarray", "netCDF4"):
            if importlib.util.find_spec(package) is None:
                message = (
                    f"Python package {package} is unavailable. Install backend optional "
                    "reference dependencies before ingesting NetCDF output."
                )
                if execute:
                    errors.append(message)
                else:
                    warnings.append(message)

    for path in (matrix_path,):
        if not path.is_file():
            errors.append(f"Required file not found: {path}")

    local_policy = [
        "Generated CM1 output and reports should stay under ignored local paths.",
        "Do not commit CM1 NetCDF output, binaries, LANDUSE.TBL, or validation run folders.",
    ]
    return {
        "fatal": bool(errors),
        "errors": errors,
        "warnings": warnings,
        "case_count": len(cases),
        "cm1_run_dir": str(cm1_run_dir),
        "netcdf_requested": any_netcdf,
        "data_policy": local_policy,
    }


def run_case_workflow(
    *,
    case: BatchCase,
    batch_dir: Path,
    cm1_run_dir: Path,
    ingested_output: Path,
    public_output: Path,
    execute: bool,
    force: bool,
    mpi_procs: str | None,
    cm1_version: str | None,
) -> dict[str, Any]:
    run_output_dir = batch_dir / case.slug
    result: dict[str, Any] = {
        "case_id": case.case_id,
        "case_name": case.case_name,
        "status": CASE_STATUS_PLANNED,
        "run_output_path": str(run_output_dir),
        "ingested_artifact_path": None,
        "frontend_index_status": "not_updated",
        "first_cloud_time": None,
        "cloud_base": None,
        "cloud_top": None,
        "max_cloud_water": None,
        "max_updraft": None,
        "rain_onset": None,
        "expected_regime": case.expected_regime,
        "observed_regime": "not run",
        "agreement_status": "not_evaluated",
        "warnings": [],
        "next_action": "Run the batch with --execute.",
    }

    if not execute:
        return result

    result["status"] = CASE_STATUS_RUNNING
    cm1 = run_cm1_case(
        case=case,
        cm1_run_dir=cm1_run_dir,
        output_dir=run_output_dir,
        force=force,
        mpi_procs=mpi_procs,
    )
    if cm1.returncode != 0:
        result["status"] = CASE_STATUS_CM1_FAILED
        result["agreement_status"] = QC_FAILED
        result["warnings"] = known_failure_messages(cm1.stdout, cm1.stderr)
        result["next_action"] = "Inspect CM1 logs, fix the local runtime/preflight issue, and rerun."
        return result

    if not expected_output_exists(run_output_dir, case.case_dir / "namelist.input"):
        result["status"] = CASE_STATUS_CM1_FAILED
        result["agreement_status"] = QC_FAILED
        result["warnings"] = [
            "CM1 exited without expected output artifacts.",
            *known_failure_messages(cm1.stdout, cm1.stderr),
        ]
        result["next_action"] = "Inspect CM1 logs and rerun after expected output is produced."
        return result

    ingest = run_ingest_case(
        case=case,
        run_output_dir=run_output_dir,
        ingested_output=ingested_output,
        public_output=public_output,
        cm1_version=cm1_version,
    )
    if ingest.returncode != 0:
        result["status"] = CASE_STATUS_INGEST_FAILED
        result["agreement_status"] = QC_FAILED
        result["warnings"] = known_failure_messages(ingest.stdout, ingest.stderr)
        result["next_action"] = "Inspect ingest output, missing fields, and optional dependencies."
        return result

    manifest_path = ingested_output / case.case_id / "ingested-manifest.json"
    artifact_path = ingested_output / case.case_id / "reference-run.json"
    if not manifest_path.is_file():
        result["status"] = CASE_STATUS_INGEST_FAILED
        result["agreement_status"] = QC_FAILED
        result["warnings"] = ["Ingest completed but ingested-manifest.json was not found."]
        result["next_action"] = "Inspect ingest logs and generated artifact paths."
        return result

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    diagnostics = manifest.get("diagnostics_available", {})
    if isinstance(diagnostics, dict):
        result.update(diagnostic_report_fields(diagnostics))
    result["ingested_artifact_path"] = str(artifact_path) if artifact_path.is_file() else None
    result["frontend_index_status"] = (
        "updated" if (public_output / "index.json").is_file() else "not_updated"
    )
    result["warnings"] = list(manifest.get("warnings", []))
    qc = evaluate_case_qc(case=case, diagnostics=diagnostics, warnings=result["warnings"])
    result["agreement_status"] = qc["agreement_status"]
    result["observed_regime"] = qc["observed_regime"]
    result["next_action"] = qc["next_action"]
    if qc["agreement_status"] in {QC_ACCEPTED, QC_ACCEPTED_WITH_NOTES}:
        result["status"] = CASE_STATUS_ACCEPTED
    elif qc["agreement_status"] == QC_NEEDS_CALIBRATION:
        result["status"] = CASE_STATUS_NEEDS_CALIBRATION
    else:
        result["status"] = CASE_STATUS_QC_FAILED
    return result


def run_cm1_case(
    *,
    case: BatchCase,
    cm1_run_dir: Path,
    output_dir: Path,
    force: bool,
    mpi_procs: str | None,
) -> subprocess.CompletedProcess[str]:
    command = [
        str(ROOT_DIR / "scripts/reference/cm1/run_cm1_case.sh"),
        "--case-dir",
        str(case.case_dir),
        "--cm1-run-dir",
        str(cm1_run_dir),
        "--output-dir",
        str(output_dir),
        "--execute",
    ]
    if force:
        command.append("--force")
    if mpi_procs:
        command.extend(["--mpi-procs", mpi_procs])
    return subprocess.run(command, check=False, text=True, capture_output=True, cwd=ROOT_DIR)


def run_ingest_case(
    *,
    case: BatchCase,
    run_output_dir: Path,
    ingested_output: Path,
    public_output: Path,
    cm1_version: str | None,
) -> subprocess.CompletedProcess[str]:
    command = [
        str(ROOT_DIR / "scripts/reference/cm1/ingest_cm1_output.py"),
        "--case-id",
        case.case_id,
        "--input-dir",
        str(run_output_dir),
        "--output-dir",
        str(ingested_output),
        "--public-output-dir",
        str(public_output),
    ]
    if cm1_version:
        command.extend(["--cm1-version", cm1_version])
    return subprocess.run(command, check=False, text=True, capture_output=True, cwd=ROOT_DIR)


def evaluate_case_qc(
    *,
    case: BatchCase,
    diagnostics: object,
    warnings: list[Any],
) -> dict[str, str]:
    if not isinstance(diagnostics, dict):
        return {
            "agreement_status": QC_FAILED,
            "observed_regime": "diagnostics unavailable",
            "next_action": "Inspect ingest artifact; diagnostics were not available for QC.",
        }
    max_cloud = _optional_float(diagnostics.get("max_cloud_liquid_water_kg_per_kg"))
    first_cloud = _optional_float(diagnostics.get("first_cloud_time_seconds"))
    cloud_base = _optional_float(diagnostics.get("cloud_base_m"))
    cloud_top = _optional_float(diagnostics.get("cloud_top_m"))
    max_updraft = _optional_float(diagnostics.get("max_updraft_m_per_s"))

    if case.case_id == "cm1-dry-failed-cumulus-v1":
        if max_cloud is None:
            return _qc_needs_calibration("cloud water unavailable", "Inspect missing cloud-water field.")
        if max_cloud > CLOUD_MEANINGFUL_THRESHOLD_KG_PER_KG or first_cloud is not None:
            return _qc_needs_calibration(
                "cloud formed",
                "Dry-failed anchor produced meaningful cloud; inspect case setup before accepting.",
            )
        status = QC_ACCEPTED_WITH_NOTES if warnings else QC_ACCEPTED
        return {
            "agreement_status": status,
            "observed_regime": "motion without meaningful cloud",
            "next_action": "Accepted as a dry-failed validation anchor.",
        }

    if case.case_id == "cm1-shallow-cumulus-baseline-v1":
        if max_cloud is None or max_cloud <= CLOUD_MEANINGFUL_THRESHOLD_KG_PER_KG:
            return _qc_needs_calibration("no meaningful cloud", "Inspect shallow-cumulus case setup.")
        if first_cloud is None or cloud_base is None or cloud_top is None:
            return _qc_needs_calibration(
                "cloud diagnostics incomplete",
                "Inspect adapter diagnostics for first cloud time and cloud bounds.",
            )
        status = QC_ACCEPTED_WITH_NOTES if warnings else QC_ACCEPTED
        next_action = "Accepted as a shallow-cumulus validation anchor."
        if max_updraft is None:
            status = QC_ACCEPTED_WITH_NOTES
            next_action = "Accepted, but inspect missing max-updraft diagnostics."
        return {
            "agreement_status": status,
            "observed_regime": "shallow cumulus forms",
            "next_action": next_action,
        }

    if case.case_id == "cm1-capped-suppressed-cumulus-v1":
        if max_cloud is None:
            return _qc_needs_calibration("cloud water unavailable", "Inspect missing cloud-water field.")
        if cloud_top is not None and cloud_top > 3_000.0:
            return _qc_needs_calibration(
                "deep uncapped cloud",
                "Capped/suppressed anchor exceeded the expected cap layer; inspect case setup.",
            )
        status = QC_ACCEPTED_WITH_NOTES if warnings or first_cloud is None else QC_ACCEPTED
        observed = "suppressed cloud" if first_cloud is None else "delayed/shallow capped cloud"
        return {
            "agreement_status": status,
            "observed_regime": observed,
            "next_action": "Review cap/top relationship manually before marking Phase B accepted.",
        }

    if case.case_id == "cm1-humid-low-cloud-contrast-v1":
        if max_cloud is None or max_cloud <= CLOUD_MEANINGFUL_THRESHOLD_KG_PER_KG:
            return _qc_needs_calibration(
                "no meaningful cloud",
                "Humid low-cloud anchor did not produce cloud; inspect moisture/forcing setup.",
            )
        if first_cloud is None or cloud_base is None:
            return _qc_needs_calibration(
                "cloud diagnostics incomplete",
                "Inspect adapter diagnostics for first cloud time and cloud base.",
            )
        if cloud_base > 1_250.0:
            return _qc_needs_calibration(
                "cloud base not lower than baseline",
                "Humid low-cloud anchor did not lower cloud base relative to the baseline acceptance value.",
            )
        status = QC_ACCEPTED_WITH_NOTES if warnings else QC_ACCEPTED
        return {
            "agreement_status": status,
            "observed_regime": "humid low-cloud contrast forms",
            "next_action": "Review low-LCL/cloud-base contrast manually before marking Phase B accepted.",
        }

    if case.case_id == "cm1-low-stratus-develops-v1":
        if max_cloud is None or max_cloud <= CLOUD_MEANINGFUL_THRESHOLD_KG_PER_KG:
            return _qc_needs_calibration(
                "no meaningful low cloud",
                "Low-stratus anchor did not produce cloud; inspect moisture/stability setup.",
            )
        if first_cloud is None or cloud_base is None or cloud_top is None:
            return _qc_needs_calibration(
                "low-cloud diagnostics incomplete",
                "Inspect adapter diagnostics for low-cloud timing and cloud bounds.",
            )
        if cloud_base > 500.0:
            return _qc_needs_calibration(
                "cloud base too high for low-stratus anchor",
                "Low-stratus anchor is not low enough; inspect setup before accepting.",
            )
        if cloud_top > 2_500.0:
            return _qc_needs_calibration(
                "cloud too deep for low-stratus anchor",
                "Low-stratus anchor grew deeper than intended; inspect setup before accepting.",
            )
        status = QC_ACCEPTED_WITH_NOTES if warnings else QC_ACCEPTED
        return {
            "agreement_status": status,
            "observed_regime": "low stratus-like cloud develops",
            "next_action": "Review low-cloud/stratus label manually before marking Phase B accepted.",
        }

    return {
        "agreement_status": QC_ACCEPTED_WITH_NOTES,
        "observed_regime": "not automatically classified",
        "next_action": "Review this case manually against the validation matrix.",
    }


def diagnostic_report_fields(diagnostics: dict[str, Any]) -> dict[str, float | None]:
    return {
        "first_cloud_time": _optional_float(diagnostics.get("first_cloud_time_seconds")),
        "cloud_base": _optional_float(diagnostics.get("cloud_base_m")),
        "cloud_top": _optional_float(diagnostics.get("cloud_top_m")),
        "max_cloud_water": _optional_float(
            diagnostics.get("max_cloud_liquid_water_kg_per_kg")
        ),
        "max_updraft": _optional_float(diagnostics.get("max_updraft_m_per_s")),
        "rain_onset": _optional_float(diagnostics.get("first_rain_time_seconds")),
    }


def expected_output_exists(output_dir: Path, namelist: Path) -> bool:
    output_format = namelist_int(namelist, "output_format", default=1)
    if output_format == 2:
        return any(output_dir.glob("*.nc"))
    return any(output_dir.glob("cm1out_*")) or any(output_dir.glob("*.dat"))


def known_failure_messages(stdout: str, stderr: str) -> list[str]:
    combined = f"{stdout}\n{stderr}"
    messages: list[str] = []
    if re.search(r"not compiled.*netcdf|requested netcdf output", combined, re.IGNORECASE):
        messages.append(
            "Your cm1.exe was not compiled with NetCDF support. Enable NetCDF in "
            "CM1 src/Makefile, rebuild, and rerun."
        )
    if re.search(r"LANDUSE\.TBL|error opening the LANDUSE", combined, re.IGNORECASE):
        messages.append("LANDUSE.TBL is missing beside cm1.exe in the generated run directory.")
    if re.search(r"zmax of sounding < zmax of grid", combined, re.IGNORECASE):
        messages.append("input_sounding does not extend above the configured grid top.")
    if re.search(r"No ingestible CM1 reference source|No NetCDF|xarray|netCDF4", combined):
        messages.append(
            "Ingest failed because expected NetCDF/adapter input or Python reference "
            "dependencies were unavailable."
        )
    if re.search(r"expected output (was )?not found|expected output artifacts", combined, re.IGNORECASE):
        messages.append("CM1 exited without expected output artifacts.")
    if not messages:
        tail = "\n".join(combined.strip().splitlines()[-12:])
        if tail:
            messages.append(tail)
    return messages


def summarize_case_results(results: object) -> dict[str, Any]:
    if not isinstance(results, list):
        return {}
    by_status: dict[str, int] = {}
    for result in results:
        if not isinstance(result, dict):
            continue
        status = str(result.get("status", "unknown"))
        by_status[status] = by_status.get(status, 0) + 1
    return {
        "case_count": len(results),
        "by_status": by_status,
        "accepted_count": by_status.get(CASE_STATUS_ACCEPTED, 0),
        "needs_calibration_count": by_status.get(CASE_STATUS_NEEDS_CALIBRATION, 0),
        "failed_count": sum(
            by_status.get(status, 0)
            for status in (CASE_STATUS_CM1_FAILED, CASE_STATUS_INGEST_FAILED, CASE_STATUS_QC_FAILED)
        ),
    }


def case_requires_landuse(namelist: Path) -> bool:
    return any(
        namelist_int(namelist, key, default=0) != 0
        for key in ("isfcflx", "sfcmodel", "initsfc")
    )


def validate_sounding_top(namelist: Path, sounding: Path) -> str | None:
    if not sounding.is_file():
        return None
    sounding_top = None
    for line in sounding.read_text(encoding="utf-8").splitlines()[1:]:
        parts = line.split()
        if len(parts) >= 5:
            try:
                sounding_top = float(parts[0])
            except ValueError:
                continue
    if sounding_top is None:
        return f"Could not determine top level in {sounding}."
    nz = namelist_int(namelist, "nz", default=0)
    dz = namelist_float(namelist, "dz", default=0.0)
    ztop = namelist_float(namelist, "ztop", default=0.0)
    grid_top = max(float(nz) * dz, ztop)
    if grid_top > 0.0 and sounding_top < grid_top:
        return (
            f"input_sounding top {sounding_top:g} m is below configured grid top "
            f"{grid_top:g} m."
        )
    return None


def namelist_int(path: Path, key: str, *, default: int) -> int:
    return int(namelist_float(path, key, default=float(default)))


def namelist_float(path: Path, key: str, *, default: float) -> float:
    if not path.is_file():
        return default
    pattern = re.compile(rf"^\s*{re.escape(key)}\s*=\s*([^,!]+)", re.IGNORECASE)
    for line in path.read_text(encoding="utf-8").splitlines():
        match = pattern.match(line)
        if match:
            return float(match.group(1).strip())
    return default


def _clean_markdown_cell(value: str) -> str:
    value = value.strip()
    value = value.replace("`", "")
    value = re.sub(r"<br\s*/?>", " ", value)
    return re.sub(r"\s+", " ", value)


def _qc_needs_calibration(observed_regime: str, next_action: str) -> dict[str, str]:
    return {
        "agreement_status": QC_NEEDS_CALIBRATION,
        "observed_regime": observed_regime,
        "next_action": next_action,
    }


def _optional_float(value: object) -> float | None:
    if value is None:
        return None
    return float(value)


def _resolve_path(path: Path) -> Path:
    return path if path.is_absolute() else ROOT_DIR / path


def _git_head_short() -> str | None:
    result = subprocess.run(
        ["git", "rev-parse", "--short", "HEAD"],
        check=False,
        text=True,
        capture_output=True,
        cwd=ROOT_DIR,
    )
    if result.returncode != 0:
        return None
    return result.stdout.strip()


def _utc_now() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _utc_now_compact() -> str:
    return datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")


class BatchFatalError(RuntimeError):
    pass


if __name__ == "__main__":
    main()

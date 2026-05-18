from __future__ import annotations

import argparse
import importlib
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast

from app.reference.cm1_adapter import CM1_FIELD_SPECS, adapt_cm1_reference_output
from app.reference.reference_schemas import ReferenceRun

REFERENCE_CASE_IDS = (
    "cm1-dry-failed-cumulus-v1",
    "cm1-shallow-cumulus-baseline-v1",
)
REFERENCE_CASE_NAMES = {
    "cm1-dry-failed-cumulus-v1": "Dry Failed Cumulus",
    "cm1-shallow-cumulus-baseline-v1": "Shallow Cumulus Baseline",
}
CLOUD_MEANINGFUL_THRESHOLD_KG_PER_KG = 1.0e-8
DEFAULT_ADAPTER_INPUT_NAME = "cloud_lab_cm1_adapter_input.json"


@dataclass(frozen=True)
class IngestedReferenceArtifact:
    case_id: str
    artifact_path: Path
    manifest_path: Path
    run: ReferenceRun
    manifest: dict[str, Any]


def ingest_cm1_reference_output(
    *,
    case_id: str,
    input_dir: Path,
    output_dir: Path,
    adapter_input_path: Path | None = None,
    cm1_version: str | None = None,
    created_at: str | None = None,
) -> IngestedReferenceArtifact:
    if case_id not in REFERENCE_CASE_IDS:
        raise ValueError(f"Unsupported CM1 reference case id: {case_id}")
    source = load_cm1_adapter_source(
        case_id=case_id,
        input_dir=input_dir,
        adapter_input_path=adapter_input_path,
        cm1_version=cm1_version,
    )
    run = adapt_cm1_reference_output(source)
    artifact_dir = output_dir / case_id
    artifact_dir.mkdir(parents=True, exist_ok=True)
    artifact_path = artifact_dir / "reference-run.json"
    manifest_path = artifact_dir / "ingested-manifest.json"
    artifact_path.write_text(
        json.dumps(run.to_transport_dict(), indent=2, sort_keys=True), encoding="utf-8"
    )

    manifest = build_ingested_manifest(
        run=run,
        input_dir=input_dir,
        artifact_path=artifact_path,
        created_at=created_at or _utc_now(),
    )
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")
    return IngestedReferenceArtifact(
        case_id=case_id,
        artifact_path=artifact_path,
        manifest_path=manifest_path,
        run=run,
        manifest=manifest,
    )


def load_cm1_adapter_source(
    *,
    case_id: str,
    input_dir: Path,
    adapter_input_path: Path | None = None,
    cm1_version: str | None = None,
) -> dict[str, object]:
    source_path = adapter_input_path or input_dir / DEFAULT_ADAPTER_INPUT_NAME
    if source_path.exists():
        return _source_from_adapter_input(source_path, case_id=case_id, cm1_version=cm1_version)

    netcdf_paths = sorted(input_dir.glob("*.nc"))
    if netcdf_paths:
        return _source_from_netcdf_files(netcdf_paths, case_id=case_id, cm1_version=cm1_version)

    raise FileNotFoundError(
        "No ingestible CM1 reference source found. Expected "
        f"{DEFAULT_ADAPTER_INPUT_NAME} or NetCDF files (*.nc) in {input_dir}."
    )


def build_ingested_manifest(
    *,
    run: ReferenceRun,
    input_dir: Path,
    artifact_path: Path,
    created_at: str,
) -> dict[str, Any]:
    diagnostics = run.diagnostics
    first_frame = run.frames[0]
    time_values = [frame.time_seconds for frame in run.frames]
    required_fields = [
        spec.standard_name for spec in CM1_FIELD_SPECS if spec.required_for_visual_path
    ]
    required_fields.extend(["temperature_k_or_potential_temperature_k"])
    required_fields_present = [
        field
        for field in required_fields
        if field in diagnostics.available_fields
        or (
            field == "temperature_k_or_potential_temperature_k"
            and (
                "temperature_k" in diagnostics.available_fields
                or "potential_temperature_k" in diagnostics.available_fields
            )
        )
    ]
    required_fields_missing = [
        field for field in required_fields if field not in required_fields_present
    ]
    case_warnings = _case_expectation_warnings(run)

    return {
        "schema_version": "cloud-lab-cm1-ingested-reference-manifest-v1",
        "case_id": run.source_case_id,
        "case_name": REFERENCE_CASE_NAMES[run.source_case_id],
        "source_model": run.source_model,
        "cm1_version": first_frame.provenance.source_file_metadata.get("cm1_version"),
        "created_at": created_at,
        "local_output_path": str(input_dir),
        "local_artifact_path": str(artifact_path),
        "source_is_synthetic_fixture": first_frame.provenance.source_is_synthetic_fixture,
        "required_fields_present": required_fields_present,
        "required_fields_missing": required_fields_missing,
        "diagnostics_available": diagnostics.model_dump(mode="json"),
        "frame_count": len(run.frames),
        "time_range_seconds": [min(time_values), max(time_values)],
        "grid_shape": {
            "rows": first_frame.grid.rows,
            "columns": first_frame.grid.columns,
        },
        "warnings": [*run.warnings, *case_warnings],
        "notes": [
            "Ingested through the Cloud Lab CM1 reference adapter.",
            "Raw CM1 output remains local and ignored by git.",
            "The frontend should consume reference-run-v1 artifacts, not raw CM1 output.",
        ],
    }


def write_local_reference_index(
    *,
    artifacts: list[IngestedReferenceArtifact],
    output_dir: Path,
    public_base_url: str | None = None,
) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    index_path = output_dir / "index.json"
    runs = []
    for artifact in artifacts:
        artifact_url = (
            f"{public_base_url.rstrip('/')}/{artifact.case_id}/reference-run.json"
            if public_base_url
            else f"{artifact.case_id}/reference-run.json"
        )
        runs.append(
            {
                "case_id": artifact.case_id,
                "case_name": REFERENCE_CASE_NAMES[artifact.case_id],
                "source_model": "CM1",
                "artifact_url": artifact_url,
                "manifest_url": (
                    f"{public_base_url.rstrip('/')}/{artifact.case_id}/ingested-manifest.json"
                    if public_base_url
                    else f"{artifact.case_id}/ingested-manifest.json"
                ),
                "source_is_synthetic_fixture": False,
                "frame_count": len(artifact.run.frames),
                "time_range_seconds": artifact.manifest["time_range_seconds"],
                "grid_shape": artifact.manifest["grid_shape"],
            }
        )
    index = {
        "schema_version": "cloud-lab-cm1-local-reference-index-v1",
        "created_at": _utc_now(),
        "runs": runs,
        "notes": [
            "Generated local index for ingested CM1 reference artifacts.",
            "Do not commit generated local reference artifacts or raw CM1 output.",
        ],
    }
    index_path.write_text(json.dumps(index, indent=2, sort_keys=True), encoding="utf-8")
    return index_path


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Ingest local CM1 output into Cloud Lab reference artifacts."
    )
    parser.add_argument("--case-id", required=True, choices=REFERENCE_CASE_IDS)
    parser.add_argument("--input-dir", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument(
        "--adapter-input",
        type=Path,
        help=f"Optional explicit {DEFAULT_ADAPTER_INPUT_NAME} path.",
    )
    parser.add_argument("--cm1-version", default=None)
    parser.add_argument(
        "--index-dir",
        type=Path,
        default=None,
        help="Optional directory where a local reference index should be written.",
    )
    parser.add_argument(
        "--public-base-url",
        default=None,
        help="Optional public URL prefix for index artifact URLs, such as /reference/cm1/local.",
    )
    args = parser.parse_args()

    artifact = ingest_cm1_reference_output(
        case_id=args.case_id,
        input_dir=args.input_dir,
        output_dir=args.output_dir,
        adapter_input_path=args.adapter_input,
        cm1_version=args.cm1_version,
    )
    print(json.dumps(artifact.manifest, indent=2, sort_keys=True))
    if args.index_dir:
        index_path = write_local_reference_index(
            artifacts=[artifact],
            output_dir=args.index_dir,
            public_base_url=args.public_base_url,
        )
        print(f"Wrote local reference index: {index_path}")


def _source_from_adapter_input(
    source_path: Path,
    *,
    case_id: str,
    cm1_version: str | None,
) -> dict[str, object]:
    raw = json.loads(source_path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError(f"{source_path} must contain a JSON object")
    source = cast(dict[str, object], raw)
    source["source_case_id"] = case_id
    source["source_is_synthetic_fixture"] = False
    metadata = source.get("source_file_metadata")
    metadata_dict = dict(cast(dict[str, object], metadata)) if isinstance(metadata, dict) else {}
    metadata_dict.setdefault("source_path", str(source_path))
    if cm1_version is not None:
        metadata_dict["cm1_version"] = cm1_version
    metadata_dict.setdefault("ingest_format", "cloud_lab_cm1_adapter_input_json")
    source["source_file_metadata"] = metadata_dict
    return source


def _source_from_netcdf_files(
    paths: list[Path],
    *,
    case_id: str,
    cm1_version: str | None,
) -> dict[str, object]:
    try:
        xr = importlib.import_module("xarray")
    except ImportError as exc:
        raise RuntimeError(
            "NetCDF ingestion requires optional package xarray. "
            f"Use {DEFAULT_ADAPTER_INPUT_NAME} or install optional reference dependencies."
        ) from exc

    dataset = xr.open_mfdataset([str(path) for path in paths], combine="by_coords")
    try:
        time = _dataset_coord_values(dataset, ("time", "time_seconds"))
        x = _dataset_coord_values(dataset, ("xh", "x", "x_coordinates_m"))
        z = _dataset_coord_values(dataset, ("zh", "z", "z_coordinates_m"))
        if max(abs(value) for value in x) < 1_000:
            x = [value * 1_000.0 for value in x]
        if max(abs(value) for value in z) < 100:
            z = [value * 1_000.0 for value in z]

        variables: dict[str, object] = {}
        variable_units: dict[str, str] = {}
        for spec in CM1_FIELD_SPECS:
            for alias in spec.aliases:
                if alias in dataset:
                    variables[alias] = _xz_time_values(
                        dataset[alias], x_count=len(x), z_count=len(z)
                    )
                    unit = dataset[alias].attrs.get("units")
                    variable_units[alias] = str(unit) if unit else spec.default_unit
                    break

        return {
            "source_case_id": case_id,
            "source_is_synthetic_fixture": False,
            "source_file_metadata": {
                "source_paths": [str(path) for path in paths],
                "cm1_version": cm1_version,
                "ingest_format": "netcdf_xarray_optional",
            },
            "time_seconds": time,
            "x_coordinates_m": x,
            "z_coordinates_m": z,
            "variable_units": variable_units,
            "variables": variables,
        }
    finally:
        dataset.close()


def _dataset_coord_values(dataset: Any, names: tuple[str, ...]) -> list[float]:
    for name in names:
        if name in dataset.coords:
            return [float(value) for value in dataset.coords[name].values.tolist()]
    raise ValueError(f"NetCDF dataset is missing coordinate aliases: {', '.join(names)}")


def _xz_time_values(variable: Any, *, x_count: int, z_count: int) -> list[list[list[float]]]:
    data = variable
    dims = list(data.dims)
    if "time" not in dims and "time_seconds" not in dims:
        data = data.expand_dims(time=[0.0])
        dims = list(data.dims)
    time_dim = "time" if "time" in dims else "time_seconds"
    z_dim = next((dim for dim in ("z", "zh", "z_coordinates_m") if dim in dims), None)
    x_dim = next((dim for dim in ("x", "xh", "x_coordinates_m") if dim in dims), None)
    y_dim = next((dim for dim in ("y", "yh", "y_coordinates_m") if dim in dims), None)
    if z_dim is None or x_dim is None:
        raise ValueError(f"Variable {variable.name} is missing x/z dimensions")
    if y_dim is not None:
        data = data.isel({y_dim: data.sizes[y_dim] // 2})
    data = data.transpose(time_dim, z_dim, x_dim)
    values = cast(list[list[list[float]]], data.values.tolist())
    if len(values[0]) != z_count or len(values[0][0]) != x_count:
        raise ValueError(f"Variable {variable.name} produced an unexpected x-z shape")
    return values


def _case_expectation_warnings(run: ReferenceRun) -> list[str]:
    max_cloud = run.diagnostics.max_cloud_liquid_water_kg_per_kg
    if run.source_case_id == "cm1-dry-failed-cumulus-v1":
        if max_cloud is not None and max_cloud > CLOUD_MEANINGFUL_THRESHOLD_KG_PER_KG:
            return [
                "Dry failed cumulus output contains meaningful cloud water; "
                "case may need calibration."
            ]
        return []
    if run.source_case_id == "cm1-shallow-cumulus-baseline-v1" and (
        max_cloud is None or max_cloud <= CLOUD_MEANINGFUL_THRESHOLD_KG_PER_KG
    ):
        return [
            "Shallow cumulus baseline output does not contain meaningful cloud water; "
            "case may need calibration."
        ]
    return []


def _utc_now() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


if __name__ == "__main__":
    main()

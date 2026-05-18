#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[3]
BACKEND_DIR = ROOT_DIR / "backend"
VENV_PYTHON = BACKEND_DIR / ".venv/bin/python"
if VENV_PYTHON.exists() and Path(sys.executable).resolve() != VENV_PYTHON.resolve():
    os.execv(str(VENV_PYTHON), [str(VENV_PYTHON), *sys.argv])

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.reference.cm1_ingest import REFERENCE_CASE_IDS, ingest_cm1_reference_output  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Ingest one local CM1 output directory into Cloud Lab reference artifacts."
    )
    parser.add_argument("--case-id", required=True, choices=REFERENCE_CASE_IDS)
    parser.add_argument("--input-dir", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--adapter-input", type=Path, default=None)
    parser.add_argument("--cm1-version", default=None)
    parser.add_argument(
        "--public-output-dir",
        type=Path,
        default=None,
        help="Optional ignored Vite public directory, e.g. frontend/public/reference/cm1/local.",
    )
    args = parser.parse_args()

    artifact = ingest_cm1_reference_output(
        case_id=args.case_id,
        input_dir=args.input_dir,
        output_dir=args.output_dir,
        adapter_input_path=args.adapter_input,
        cm1_version=args.cm1_version,
    )
    if args.public_output_dir:
        public_case_dir = args.public_output_dir / artifact.case_id
        public_case_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(artifact.artifact_path, public_case_dir / artifact.artifact_path.name)
        shutil.copy2(artifact.manifest_path, public_case_dir / artifact.manifest_path.name)
        upsert_public_index(
            public_output_dir=args.public_output_dir,
            artifact=artifact,
        )

    print(json.dumps(artifact.manifest, indent=2, sort_keys=True))
    print(f"Wrote reference artifact: {artifact.artifact_path}")
    print(f"Wrote ingest manifest: {artifact.manifest_path}")
    if args.public_output_dir:
        print(f"Updated local frontend reference index: {args.public_output_dir / 'index.json'}")


def upsert_public_index(*, public_output_dir: Path, artifact) -> None:  # type: ignore[no-untyped-def]
    index_path = public_output_dir / "index.json"
    if index_path.exists():
        index = json.loads(index_path.read_text(encoding="utf-8"))
    else:
        index = {
            "schema_version": "cloud-lab-cm1-local-reference-index-v1",
            "created_at": None,
            "runs": [],
            "notes": [
                "Generated local index for ingested CM1 reference artifacts.",
                "Do not commit generated local reference artifacts or raw CM1 output.",
            ],
        }
    runs = [run for run in index.get("runs", []) if run.get("case_id") != artifact.case_id]
    runs.append(
        {
            "case_id": artifact.case_id,
            "case_name": artifact.manifest["case_name"],
            "source_model": "CM1",
            "artifact_url": f"/reference/cm1/local/{artifact.case_id}/reference-run.json",
            "manifest_url": f"/reference/cm1/local/{artifact.case_id}/ingested-manifest.json",
            "source_is_synthetic_fixture": False,
            "frame_count": len(artifact.run.frames),
            "time_range_seconds": artifact.manifest["time_range_seconds"],
            "grid_shape": artifact.manifest["grid_shape"],
        }
    )
    index["runs"] = sorted(runs, key=lambda run: run["case_id"])
    index_path.write_text(json.dumps(index, indent=2, sort_keys=True), encoding="utf-8")


if __name__ == "__main__":
    main()

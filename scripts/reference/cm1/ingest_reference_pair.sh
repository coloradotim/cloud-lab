#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
INPUT_ROOT="$ROOT_DIR/data/reference/cm1"
OUTPUT_DIR="$ROOT_DIR/data/reference/cm1/ingested"
PUBLIC_OUTPUT_DIR="$ROOT_DIR/frontend/public/reference/cm1/local"
DRY_INPUT_DIR=""
SHALLOW_INPUT_DIR=""
CM1_VERSION=""

usage() {
  cat <<'USAGE'
Usage: scripts/reference/cm1/ingest_reference_pair.sh [options]

Ingest locally generated CM1 reference-pair outputs into Cloud Lab reference
artifacts. Raw CM1 output stays in ignored local data paths.

Options:
  --input <dir>          Local CM1 data root. Defaults to data/reference/cm1.
  --output <dir>         Ignored artifact output dir. Defaults to data/reference/cm1/ingested.
  --public-output <dir>  Ignored Vite public dir. Defaults to frontend/public/reference/cm1/local.
  --dry-input <dir>      Explicit dry-failed-cumulus run/input directory.
  --shallow-input <dir>  Explicit shallow-cumulus-baseline run/input directory.
  --cm1-version <text>   CM1 version metadata to stamp into artifacts.
  -h, --help             Show this help.

Each input directory should contain either:
  - cloud_lab_cm1_adapter_input.json, or
  - NetCDF CM1 output files (*.nc) readable through optional xarray.

The generated frontend index is intentionally ignored by git. It lets the Vite
app prefer real local ingested CM1 output when present.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --input)
      INPUT_ROOT="${2:-}"
      shift 2
      ;;
    --output)
      OUTPUT_DIR="${2:-}"
      shift 2
      ;;
    --public-output)
      PUBLIC_OUTPUT_DIR="${2:-}"
      shift 2
      ;;
    --dry-input)
      DRY_INPUT_DIR="${2:-}"
      shift 2
      ;;
    --shallow-input)
      SHALLOW_INPUT_DIR="${2:-}"
      shift 2
      ;;
    --cm1-version)
      CM1_VERSION="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

abspath() {
  local path="$1"
  if [[ "$path" = /* ]]; then
    printf '%s\n' "$path"
  else
    printf '%s\n' "$ROOT_DIR/$path"
  fi
}

INPUT_ROOT="$(abspath "$INPUT_ROOT")"
OUTPUT_DIR="$(abspath "$OUTPUT_DIR")"
PUBLIC_OUTPUT_DIR="$(abspath "$PUBLIC_OUTPUT_DIR")"
if [[ -n "$DRY_INPUT_DIR" ]]; then
  DRY_INPUT_DIR="$(abspath "$DRY_INPUT_DIR")"
fi
if [[ -n "$SHALLOW_INPUT_DIR" ]]; then
  SHALLOW_INPUT_DIR="$(abspath "$SHALLOW_INPUT_DIR")"
fi

find_case_input() {
  local explicit="$1"
  local slug="$2"
  if [[ -n "$explicit" ]]; then
    printf '%s\n' "$explicit"
    return
  fi
  local match
  match="$(find "$INPUT_ROOT" -type f \( -name 'cloud_lab_cm1_adapter_input.json' -o -name '*.nc' \) -path "*$slug*" -print -quit 2>/dev/null || true)"
  if [[ -n "$match" ]]; then
    dirname "$match"
    return
  fi
  printf '%s\n' "$INPUT_ROOT/$slug"
}

run_ingest() {
  local case_id="$1"
  local input_dir="$2"
  local args=(
    "$ROOT_DIR/scripts/reference/cm1/ingest_cm1_output.py"
    --case-id "$case_id"
    --input-dir "$input_dir"
    --output-dir "$OUTPUT_DIR"
    --public-output-dir "$PUBLIC_OUTPUT_DIR"
  )
  if [[ -n "$CM1_VERSION" ]]; then
    args+=(--cm1-version "$CM1_VERSION")
  fi
  "${args[@]}"
}

dry_dir="$(find_case_input "$DRY_INPUT_DIR" "dry-failed-cumulus")"
shallow_dir="$(find_case_input "$SHALLOW_INPUT_DIR" "shallow-cumulus-baseline")"

echo "CM1 reference pair ingest plan"
echo "Input root:      $INPUT_ROOT"
echo "Output dir:      $OUTPUT_DIR"
echo "Public output:   $PUBLIC_OUTPUT_DIR"
echo "Dry input:       $dry_dir"
echo "Shallow input:   $shallow_dir"
echo

run_ingest "cm1-dry-failed-cumulus-v1" "$dry_dir"
echo
run_ingest "cm1-shallow-cumulus-baseline-v1" "$shallow_dir"

cat <<POLICY

Ingest complete.

Output policy:
  - Raw CM1 output stays under ignored local paths such as data/reference/cm1/.
  - Generated reference artifacts and frontend local index are ignored by git.
  - Do not commit large CM1 NetCDF/GrADS output, CM1 binaries, or local build products.
POLICY

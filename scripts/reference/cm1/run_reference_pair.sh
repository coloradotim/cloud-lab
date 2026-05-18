#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CM1_RUN_DIR=""
OUTPUT_ROOT="$ROOT_DIR/data/reference/cm1/runs"
MPI_PROCS=""
EXECUTE=false
FORCE=false

usage() {
  cat <<'USAGE'
Usage: scripts/reference/cm1/run_reference_pair.sh --cm1-run-dir <dir> [options]

Prepares and optionally runs the first Cloud Lab CM1 reference pair:
  - dry-failed-cumulus
  - shallow-cumulus-baseline

Required:
  --cm1-run-dir <dir>  Local CM1 run directory containing cm1.exe.

Options:
  --output-root <dir>  Ignored local output root. Defaults to data/reference/cm1/runs.
  --mpi-procs <n>      Pass mpirun -np <n> through to each case run.
  --execute            Actually copy files and run CM1. Without this, print the pair plan only.
  --force              Allow existing output directories.
  -h, --help           Show this help.

This script does not download CM1, build CM1, modify system packages, or commit output.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --cm1-run-dir)
      CM1_RUN_DIR="${2:-}"
      shift 2
      ;;
    --output-root)
      OUTPUT_ROOT="${2:-}"
      shift 2
      ;;
    --mpi-procs)
      MPI_PROCS="${2:-}"
      shift 2
      ;;
    --execute)
      EXECUTE=true
      shift
      ;;
    --force)
      FORCE=true
      shift
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

if [[ -z "$CM1_RUN_DIR" ]]; then
  echo "Missing required --cm1-run-dir." >&2
  usage >&2
  exit 2
fi

if [[ "$CM1_RUN_DIR" != /* ]]; then
  CM1_RUN_DIR="$ROOT_DIR/$CM1_RUN_DIR"
fi
if [[ "$OUTPUT_ROOT" != /* ]]; then
  OUTPUT_ROOT="$ROOT_DIR/$OUTPUT_ROOT"
fi

case_dirs=(
  "reference/cm1/cases/dry-failed-cumulus"
  "reference/cm1/cases/shallow-cumulus-baseline"
)

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"

echo "CM1 reference pair run plan"
echo
echo "CM1 run dir: $CM1_RUN_DIR"
echo "Output root: $OUTPUT_ROOT"
echo "Execute:     $EXECUTE"
if [[ -n "$MPI_PROCS" ]]; then
  echo "MPI procs:   $MPI_PROCS"
fi
echo

for case_dir in "${case_dirs[@]}"; do
  case_name="$(basename "$case_dir")"
  output_dir="$OUTPUT_ROOT/${timestamp}-${case_name}"
  args=(
    "$ROOT_DIR/scripts/reference/cm1/run_cm1_case.sh"
    --case-dir "$case_dir"
    --cm1-run-dir "$CM1_RUN_DIR"
    --output-dir "$output_dir"
  )

  if [[ -n "$MPI_PROCS" ]]; then
    args+=(--mpi-procs "$MPI_PROCS")
  fi
  if [[ "$EXECUTE" == "true" ]]; then
    args+=(--execute)
  fi
  if [[ "$FORCE" == "true" ]]; then
    args+=(--force)
  fi

  "${args[@]}"
  echo
done

cat <<'POLICY'
Pair output policy:
  - Keep generated output under data/reference/cm1/ or another ignored local path.
  - Do not commit large CM1 output files, CM1 binaries, or local build products.
  - After output inspection, ingest selected fields through the CM1 reference adapter.
POLICY

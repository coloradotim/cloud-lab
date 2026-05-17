#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CASE_DIR=""
CM1_RUN_DIR=""
OUTPUT_DIR=""
MPI_PROCS=""
EXECUTE=false
FORCE=false

usage() {
  cat <<'USAGE'
Usage: scripts/reference/cm1/run_cm1_case.sh --case-dir <dir> --cm1-run-dir <dir> [options]

Prepares and optionally runs a local CM1 reference case in an ignored output directory.

Required:
  --case-dir <dir>     Prepared case directory containing namelist.input.
  --cm1-run-dir <dir>  Local CM1 run directory containing cm1.exe.

Options:
  --output-dir <dir>   Output/run directory. Defaults to data/reference/cm1/runs/<case>-<timestamp>.
  --mpi-procs <n>      Run with mpirun -np <n>.
  --execute            Actually copy files and run CM1. Without this, print the plan only.
  --force              Allow an existing output directory.
  -h, --help           Show this help.

This script does not download CM1, build CM1, modify system packages, or commit output.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --case-dir)
      CASE_DIR="${2:-}"
      shift 2
      ;;
    --cm1-run-dir)
      CM1_RUN_DIR="${2:-}"
      shift 2
      ;;
    --output-dir)
      OUTPUT_DIR="${2:-}"
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

if [[ -z "$CASE_DIR" || -z "$CM1_RUN_DIR" ]]; then
  echo "Missing required --case-dir or --cm1-run-dir." >&2
  usage >&2
  exit 2
fi

if [[ "$CASE_DIR" != /* ]]; then
  CASE_DIR="$ROOT_DIR/$CASE_DIR"
fi
if [[ "$CM1_RUN_DIR" != /* ]]; then
  CM1_RUN_DIR="$ROOT_DIR/$CM1_RUN_DIR"
fi

if [[ ! -d "$CASE_DIR" ]]; then
  echo "Case directory not found: $CASE_DIR" >&2
  exit 1
fi
if [[ ! -f "$CASE_DIR/namelist.input" ]]; then
  echo "Case directory must contain namelist.input: $CASE_DIR" >&2
  exit 1
fi
if [[ ! -x "$CM1_RUN_DIR/cm1.exe" ]]; then
  echo "CM1 executable not found or not executable: $CM1_RUN_DIR/cm1.exe" >&2
  exit 1
fi

case_name="$(basename "$CASE_DIR")"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"

if [[ -z "$OUTPUT_DIR" ]]; then
  OUTPUT_DIR="$ROOT_DIR/data/reference/cm1/runs/${case_name}-${timestamp}"
elif [[ "$OUTPUT_DIR" != /* ]]; then
  OUTPUT_DIR="$ROOT_DIR/$OUTPUT_DIR"
fi

if [[ -n "$MPI_PROCS" && ! "$MPI_PROCS" =~ ^[1-9][0-9]*$ ]]; then
  echo "--mpi-procs must be a positive integer." >&2
  exit 2
fi

run_command=(./cm1.exe)
if [[ -n "$MPI_PROCS" ]]; then
  if ! command -v mpirun >/dev/null 2>&1; then
    echo "mpirun is required when --mpi-procs is set." >&2
    exit 1
  fi
  run_command=(mpirun -np "$MPI_PROCS" ./cm1.exe)
fi

cat <<PLAN
CM1 reference case run plan

Case directory: $CASE_DIR
CM1 run dir:    $CM1_RUN_DIR
Output dir:     $OUTPUT_DIR
Command:        ${run_command[*]}
Execute:        $EXECUTE

Output policy:
  - Keep generated output under data/reference/cm1/ or another ignored local path.
  - Do not commit large CM1 output files, binaries, or local build products.
PLAN

if [[ "$EXECUTE" != "true" ]]; then
  echo
  echo "Dry run only. Add --execute to copy the case and run CM1."
  exit 0
fi

if [[ -e "$OUTPUT_DIR" && "$FORCE" != "true" ]]; then
  echo "Output directory already exists. Use --force or choose a new --output-dir: $OUTPUT_DIR" >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"
cp "$CM1_RUN_DIR/cm1.exe" "$OUTPUT_DIR/"
cp "$CASE_DIR/namelist.input" "$OUTPUT_DIR/"

if [[ -f "$CASE_DIR/input_sounding" ]]; then
  cp "$CASE_DIR/input_sounding" "$OUTPUT_DIR/"
fi

if [[ -f "$CASE_DIR/README.md" ]]; then
  cp "$CASE_DIR/README.md" "$OUTPUT_DIR/CASE_README.md"
fi

echo
echo "Running CM1 in $OUTPUT_DIR..."
(
  cd "$OUTPUT_DIR"
  "${run_command[@]}" >cm1.stdout.log 2>cm1.stderr.log
)

echo "CM1 run finished. Output directory: $OUTPUT_DIR"
echo "stdout: $OUTPUT_DIR/cm1.stdout.log"
echo "stderr: $OUTPUT_DIR/cm1.stderr.log"

#!/usr/bin/env bash
set -euo pipefail

STRICT=false

usage() {
  cat <<'USAGE'
Usage: scripts/reference/cm1/check_cm1_environment.sh [--strict]

Checks common macOS prerequisites for local CM1 reference runs.

Options:
  --strict   Exit non-zero when required tools are missing.
  -h, --help Show this help.

This script does not install packages, download CM1, run CM1, or create model output.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --strict)
      STRICT=true
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

missing_required=0

check_required() {
  local label="$1"
  local command_name="$2"

  if command -v "$command_name" >/dev/null 2>&1; then
    echo "ok: $label ($command_name -> $(command -v "$command_name"))"
  else
    echo "missing: $label ($command_name)"
    missing_required=1
  fi
}

check_optional_any() {
  local label="$1"
  shift

  local found=()
  local candidate
  for candidate in "$@"; do
    if command -v "$candidate" >/dev/null 2>&1; then
      found+=("$candidate -> $(command -v "$candidate")")
    fi
  done

  if [[ "${#found[@]}" -gt 0 ]]; then
    echo "ok: $label (${found[*]})"
  else
    echo "missing/optional: $label ($*)"
  fi
}

check_macos_tools() {
  if [[ "$(uname -s)" == "Darwin" ]]; then
    echo "ok: macOS host detected"
  else
    echo "warning: this guide targets macOS; detected $(uname -s)"
  fi

  if command -v xcode-select >/dev/null 2>&1 && xcode-select -p >/dev/null 2>&1; then
    echo "ok: Xcode Command Line Tools ($(xcode-select -p))"
  else
    echo "missing: Xcode Command Line Tools"
    missing_required=1
  fi
}

check_disk_space() {
  local data_dir="${1:-data/reference/cm1}"
  local parent
  parent="$(dirname "$data_dir")"

  if [[ -d "$data_dir" ]]; then
    df -h "$data_dir" | awk 'NR == 1 || NR == 2 { print }'
  elif [[ -d "$parent" ]]; then
    df -h "$parent" | awk 'NR == 1 || NR == 2 { print }'
  else
    df -h . | awk 'NR == 1 || NR == 2 { print }'
  fi
}

echo "CM1 local environment check"
echo

check_macos_tools
check_required "make" "make"
check_required "git" "git"
check_required "curl" "curl"
check_required "tar" "tar"
check_optional_any "Fortran compiler" gfortran ifort ifx nvfortran
check_optional_any "MPI compiler/runtime" mpifort mpirun mpiexec
check_optional_any "NetCDF config tools" nf-config nc-config
check_optional_any "Homebrew" brew

echo
echo "Disk space for local reference data path:"
check_disk_space "data/reference/cm1"

cat <<'NEXT_STEPS'

Next steps:
  1. Download CM1 from the official NCAR/UCAR CM1 pages.
  2. Build CM1 outside this repo, usually from the CM1 src directory.
  3. Keep generated output under data/reference/cm1/ or another ignored local path.
  4. Do not commit CM1 source, binaries, or large output files.

See docs/reference-models/cm1-local-setup-macos.md for the full workflow.
NEXT_STEPS

if [[ "$STRICT" == "true" && "$missing_required" -ne 0 ]]; then
  exit 1
fi

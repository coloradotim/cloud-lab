#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CASE_DIR=""
CM1_RUN_DIR=""
OUTPUT_DIR=""
MPI_PROCS=""
EXECUTE=false
FORCE=false
EXPECTED_OUTPUT_KIND=""

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

namelist_value() {
  local key="$1"
  local file="$2"
  awk -v key="$key" '
    {
      line = $0
      sub(/!.*/, "", line)
      lower_line = tolower(line)
      pattern = "^[[:space:]]*" tolower(key) "[[:space:]]*="
      if (lower_line ~ pattern) {
        split(line, parts, "=")
        split(parts[2], values, ",")
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", values[1])
        print values[1]
        exit
      }
    }
  ' "$file"
}

namelist_int() {
  local value
  value="$(namelist_value "$1" "$2")"
  value="${value%%.*}"
  if [[ "$value" =~ ^-?[0-9]+$ ]]; then
    printf '%s\n' "$value"
  else
    printf '0\n'
  fi
}

namelist_number() {
  local value
  value="$(namelist_value "$1" "$2")"
  if [[ "$value" =~ ^-?[0-9]+([.][0-9]+)?([eE][-+]?[0-9]+)?$ ]]; then
    printf '%s\n' "$value"
  else
    printf '0\n'
  fi
}

case_requires_landuse() {
  local namelist="$1"
  local isfcflx sfcmodel initsfc
  isfcflx="$(namelist_int "isfcflx" "$namelist")"
  sfcmodel="$(namelist_int "sfcmodel" "$namelist")"
  initsfc="$(namelist_int "initsfc" "$namelist")"
  [[ "$isfcflx" -ne 0 || "$sfcmodel" -ne 0 || "$initsfc" -ne 0 ]]
}

case_output_format() {
  local value
  value="$(namelist_int "output_format" "$1")"
  if [[ "$value" -eq 0 ]]; then
    value=1
  fi
  printf '%s\n' "$value"
}

expected_output_kind() {
  local output_format="$1"
  if [[ "$output_format" -eq 2 ]]; then
    printf 'NetCDF (*.nc)\n'
  else
    printf 'CM1 output files\n'
  fi
}

sounding_top_m() {
  local sounding="$1"
  awk '
    NF >= 5 && $1 ~ /^-?[0-9]+([.][0-9]+)?$/ { top = $1 }
    END {
      if (top == "") {
        print "0"
      } else {
        print top
      }
    }
  ' "$sounding"
}

grid_top_m() {
  local namelist="$1"
  local nz dz ztop
  nz="$(namelist_number "nz" "$namelist")"
  dz="$(namelist_number "dz" "$namelist")"
  ztop="$(namelist_number "ztop" "$namelist")"
  awk -v nz="$nz" -v dz="$dz" -v ztop="$ztop" 'BEGIN {
    computed = nz * dz
    if (ztop > computed) {
      print ztop
    } else {
      print computed
    }
  }'
}

validate_sounding_top() {
  local namelist="$1"
  local sounding="$2"
  if [[ ! -f "$sounding" ]]; then
    return 0
  fi

  local top grid_top
  top="$(sounding_top_m "$sounding")"
  grid_top="$(grid_top_m "$namelist")"
  if ! awk -v top="$top" -v grid="$grid_top" 'BEGIN { exit(top >= grid ? 0 : 1) }'; then
    cat >&2 <<ERROR
input_sounding top is below the configured grid top.
  input_sounding top: ${top} m
  grid top estimate:  ${grid_top} m

Append a final input_sounding level at or above the grid top before running CM1.
ERROR
    exit 1
  fi
}

print_netcdf_preflight() {
  local output_format="$1"
  if [[ "$output_format" -ne 2 ]]; then
    return 0
  fi

  if command -v nf-config >/dev/null 2>&1; then
    echo "ok: output_format = 2 and nf-config is available ($(nf-config --version 2>/dev/null || true))"
  else
    cat >&2 <<'WARNING'
warning: output_format = 2 requests NetCDF output, but nf-config was not found.
  Make sure cm1.exe was compiled with NetCDF Fortran support.
  If CM1 exits with a NetCDF capability error, enable the NetCDF section in
  CM1 src/Makefile, rebuild, and rerun.
WARNING
  fi
}

print_landuse_preflight() {
  local cm1_run_dir="$1"
  local namelist="$2"
  if ! case_requires_landuse "$namelist"; then
    return 0
  fi

  if [[ -f "$cm1_run_dir/LANDUSE.TBL" ]]; then
    echo "ok: LANDUSE.TBL is available in the CM1 run directory"
  else
    cat >&2 <<WARNING
warning: this case appears to require LANDUSE.TBL, but it was not found at:
  $cm1_run_dir/LANDUSE.TBL

Execution will fail before CM1 launches unless --cm1-run-dir points at a CM1 run
directory containing LANDUSE.TBL.
WARNING
  fi
}

copy_runtime_support_files() {
  local cm1_run_dir="$1"
  local output_dir="$2"
  local namelist="$3"

  if [[ -f "$cm1_run_dir/LANDUSE.TBL" ]]; then
    cp "$cm1_run_dir/LANDUSE.TBL" "$output_dir/"
    echo "Copied runtime support file: LANDUSE.TBL"
  elif case_requires_landuse "$namelist"; then
    cat >&2 <<ERROR
Missing required CM1 runtime support file: $cm1_run_dir/LANDUSE.TBL

This case namelist enables surface physics/initialization that requires
LANDUSE.TBL beside cm1.exe in the run directory. Copy LANDUSE.TBL into the CM1
run directory or use --cm1-run-dir that contains the CM1-distributed run files.
ERROR
    exit 1
  else
    echo "warning: LANDUSE.TBL was not found in $cm1_run_dir; continuing because this case does not appear to require it." >&2
  fi
}

expected_output_exists() {
  local output_dir="$1"
  local output_format="$2"
  if [[ "$output_format" -eq 2 ]]; then
    find "$output_dir" -maxdepth 1 -type f -name '*.nc' -print -quit | grep -q .
  else
    find "$output_dir" -maxdepth 1 -type f \( -name 'cm1out_*' -o -name '*.dat' -o -name '*.ctl' \) -print -quit | grep -q .
  fi
}

print_known_failure_hints() {
  local output_dir="$1"
  local stdout_log="$output_dir/cm1.stdout.log"
  local stderr_log="$output_dir/cm1.stderr.log"

  echo "stdout: $stdout_log" >&2
  echo "stderr: $stderr_log" >&2
  echo >&2
  echo "Last relevant log lines:" >&2
  if [[ -f "$stdout_log" ]]; then
    tail -n 40 "$stdout_log" >&2 || true
  fi
  if [[ -s "$stderr_log" ]]; then
    tail -n 40 "$stderr_log" >&2 || true
  fi

  if grep -qi "not compiled.*netcdf\\|requested netcdf output" "$stdout_log" "$stderr_log" 2>/dev/null; then
    cat >&2 <<'HINT'

Likely cause: Your cm1.exe was not compiled with NetCDF support. Enable the
NetCDF section in CM1 src/Makefile, rebuild, and rerun.
HINT
  fi
  if grep -qi "LANDUSE.TBL\\|error opening the LANDUSE" "$stdout_log" "$stderr_log" 2>/dev/null; then
    cat >&2 <<'HINT'

Likely cause: LANDUSE.TBL is missing beside cm1.exe in the generated run
directory. Re-run through run_cm1_case.sh with --cm1-run-dir pointing at a CM1
run directory that contains LANDUSE.TBL.
HINT
  fi
  if grep -qi "zmax of sounding < zmax of grid" "$stdout_log" "$stderr_log" 2>/dev/null; then
    cat >&2 <<'HINT'

Likely cause: input_sounding does not extend above the configured grid top.
Append a final sounding level at or above the grid top and rerun.
HINT
  fi
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

output_format="$(case_output_format "$CASE_DIR/namelist.input")"
EXPECTED_OUTPUT_KIND="$(expected_output_kind "$output_format")"
validate_sounding_top "$CASE_DIR/namelist.input" "$CASE_DIR/input_sounding"
print_netcdf_preflight "$output_format"
print_landuse_preflight "$CM1_RUN_DIR" "$CASE_DIR/namelist.input"

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
Expected output: $EXPECTED_OUTPUT_KIND

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
copy_runtime_support_files "$CM1_RUN_DIR" "$OUTPUT_DIR" "$CASE_DIR/namelist.input"

if [[ -f "$CASE_DIR/input_sounding" ]]; then
  cp "$CASE_DIR/input_sounding" "$OUTPUT_DIR/"
fi

if [[ -f "$CASE_DIR/README.md" ]]; then
  cp "$CASE_DIR/README.md" "$OUTPUT_DIR/CASE_README.md"
fi

if [[ -f "$CASE_DIR/manifest.json" ]]; then
  cp "$CASE_DIR/manifest.json" "$OUTPUT_DIR/case_manifest.json"
fi

echo
echo "Running CM1 in $OUTPUT_DIR..."
run_status=0
(
  cd "$OUTPUT_DIR"
  "${run_command[@]}" >cm1.stdout.log 2>cm1.stderr.log
) || run_status=$?

if [[ "$run_status" -ne 0 ]]; then
  echo "CM1 exited with status $run_status." >&2
  print_known_failure_hints "$OUTPUT_DIR"
  exit "$run_status"
fi

if ! expected_output_exists "$OUTPUT_DIR" "$output_format"; then
  echo "CM1 process exited, but expected output was not found: $EXPECTED_OUTPUT_KIND" >&2
  print_known_failure_hints "$OUTPUT_DIR"
  exit 1
fi

echo "CM1 run finished and produced expected output: $EXPECTED_OUTPUT_KIND"
echo "Output directory: $OUTPUT_DIR"
echo "stdout: $OUTPUT_DIR/cm1.stdout.log"
echo "stderr: $OUTPUT_DIR/cm1.stderr.log"

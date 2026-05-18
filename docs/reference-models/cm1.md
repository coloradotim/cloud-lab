# CM1 Reference Model Adapter

Issue: #179

Cloud Lab uses CM1 as the first offline reference-model anchor for credible
lower-atmosphere cloud-resolving behavior.

CM1 output should support this product path:

```text
credible lower-atmosphere numerical model output
→ Cloud Lab reference adapter
→ scientific 2-D cloud visualization
→ diagnostics and comparison
→ later cloud appearance / 2.5-D rendering
```

## Role In Cloud Lab

CM1 reference output is not a live Cloud Lab solver. Cloud Lab should ingest
offline CM1 datasets, map fields into reference frames, compute deterministic
diagnostics, and expose those fields to future scientific visualization,
comparison, and optics paths.

Current policy:

```text
CM1 output is offline reference-model output.
Cloud Lab does not run CM1 in normal app sessions.
CM1 reference data is not interactive reduced-model output.
Synthetic CM1-like fixtures validate mapping only; they are not scientific truth.
```

The reference path is separate from the current `boussinesq_2d` prototype. The
Boussinesq solver remains a Yellow-status visual dynamics scaffold and should
not be used as the lower-atmosphere credibility path.

## Adapter Code

The first adapter lives under:

```text
backend/app/reference/
```

Key modules:

```text
backend/app/reference/cm1_adapter.py
backend/app/reference/reference_schemas.py
backend/app/reference/reference_diagnostics.py
backend/tests/test_cm1_adapter.py
```

The adapter currently accepts a tiny CM1-like mapping fixture. This keeps the
default backend install free of heavy reference-model dependencies while still
testing the Cloud Lab field, provenance, and diagnostics contract.

## Reference Frame Contract

Mapped output uses a distinct reference schema rather than pretending offline
CM1 output is an interactive `SimulationFrame`.

`ReferenceFrame` includes:

```text
schema_version = "reference-frame-v1"
source_model = "CM1"
source_case_id
source_file_metadata
time_seconds
grid metadata
x coordinate
z coordinate
field metadata
units
provenance metadata
assumptions
warnings
```

`ReferenceRun` wraps the frame sequence and run-level diagnostics:

```text
schema_version = "reference-run-v1"
source_model = "CM1"
source_case_id
frames
diagnostics
warnings
```

Reference frames are designed to be consumed by future 2-D scientific viewers,
reference comparison, and appearance rendering. They are not a replacement for
the app's live simulation frame schema.

## Expected Source Fields

The adapter maps common CM1-like variable names into Cloud Lab reference fields.

| Cloud Lab field | Example source aliases | Unit |
| --- | --- | --- |
| `potential_temperature_k` | `theta`, `th`, `thpert`, `potential_temperature` | K |
| `temperature_k` | `temperature`, `temperature_k`, `temp`, `t` | K |
| `water_vapor_kg_per_kg` | `qv`, `qvapor`, `water_vapor`, `mixing_ratio` | kg kg-1 |
| `cloud_liquid_water_kg_per_kg` | `qc`, `qcloud`, `cloud_liquid_water` | kg kg-1 |
| `rain_water_kg_per_kg` | `qr`, `qrain`, `rain_water` | kg kg-1 |
| `vertical_velocity_m_per_s` | `w`, `wa`, `vertical_velocity` | m s-1 |
| `horizontal_velocity_m_per_s` | `u`, `ua`, `horizontal_velocity` | m s-1 |
| `pressure_pa` | `p`, `prs`, `pressure` | Pa |

If a field is missing, the adapter records a warning instead of silently
inventing values. Temperature or potential temperature should be present for
useful reference cases. Rain, horizontal velocity, and pressure are optional in
early fixtures but should be preserved when real CM1 output provides them.

## Diagnostics

The initial diagnostics are visualization- and comparison-ready:

```text
available fields
missing-field warnings
max cloud liquid water
integrated cloud liquid water
cloud base
cloud top
first cloud time
max updraft
first rain time
max rain water
source provenance
visualization readiness
```

Cloud base and cloud top are diagnosed from cloud-liquid-water cells above a
small presence threshold. First cloud time and first rain time are diagnosed
from the first frame crossing the same kind of threshold. These diagnostics are
deterministic mapping products, not validation that the source fixture is
scientifically credible.

## Fixture Strategy

Do not commit large CM1 output files.

The current tests use a tiny synthetic mapping fixture built in Python. It
mimics enough CM1-like shape to verify:

- time, x, and z coordinate mapping
- field unit and provenance metadata
- cloud-water mapping
- missing-field warnings
- cloud base/top diagnostics
- max-updraft diagnostics
- schema validation
- visualization readiness
- no default dependency on optional CM1/reference packages

Future real CM1 outputs should live outside git, such as under:

```text
data/reference/cm1/
```

Commit only docs, scripts, manifests, configs, and tiny fixtures unless a
separate artifact/storage policy is approved.

## Dependency Policy

The default backend install should not require CM1, xarray, netCDF4, or large
scientific data dependencies.

If a future issue adds direct NetCDF ingestion, it should use an optional
dependency path such as:

```text
[reference]
xarray
netCDF4
```

Tests that require optional dependencies should skip cleanly when those
dependencies are unavailable, or keep using synthetic pure-Python fixtures.

## Visualization Readiness

Reference frames are intended to support these later display modes:

```text
cloud liquid water field
water vapor / RH field
temperature / theta field
vertical velocity field
rain water field, if available
cloud base / cloud top overlays
time replay
```

Future viewers should label source data as:

```text
CM1 reference output
Offline reference case
Scientific field view
Not live interactive simulation
```

Cloud appearance and 2.5-D views may consume these same fields later, but they
must label visual assumptions such as assumed droplet radius, optical-depth
approximation, and lack of full radiative transfer.

## Future Real CM1 Cases

Real reference cases should be added through the case-library and local-run
issues rather than this adapter issue. At minimum, a real case should provide:

- stable case id
- source metadata and CM1 version
- time coordinate
- x/z grid coordinates
- cloud liquid water and vertical velocity
- temperature or potential temperature
- water vapor or mixing ratio
- rain water if relevant
- pressure or pressure-derived metadata if available
- a local manifest describing output paths and required fields

Reference cases are offline datasets used to anchor visual understanding and
diagnostics. Interactive reduced models do not need to match every CM1
morphology detail; they should match teaching-relevant relationships and
diagnostics.

The first lower-atmosphere visual case library is defined in
`docs/reference-models/cm1-lower-atmosphere-cases.md`. It prioritizes the
immediate dry-failed cumulus and shallow-cumulus baseline pair before local CM1
setup, first real reference output generation, scientific 2-D replay, appearance
rendering, and reduced-model comparison.

Local macOS setup guidance for downloading, building, and running CM1 outside
Cloud Lab lives in `docs/reference-models/cm1-local-setup-macos.md`. The helper
scripts under `scripts/reference/cm1/` check prerequisites and run prepared
local cases without making CM1 a default app dependency.

The first committed dry-failed-cumulus and shallow-cumulus-baseline case assets
live under `reference/cm1/cases/` and are documented in
`docs/reference-models/cm1-first-reference-pair.md`. Generated CM1 output from
those cases must remain under ignored local paths such as
`data/reference/cm1/` until a separate artifact/storage policy exists.

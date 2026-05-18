# Microphysics Output Schema Proposal

This document proposes a versioned schema extension for droplet-size distributions
and related warm-cloud microphysics outputs. It is a design proposal for future
`microphysics_lab` and PySDM-adjacent work; it does not change the current
`sim-frame-v1` contract.

## Goals

- Represent droplet-size distributions without exposing PySDM internals.
- Preserve existing `sim-frame-v1` frames and current solvers.
- Support global, regional/probe, and optional gridded summaries.
- Keep WebSocket payloads reasonable for local streaming.
- Give the renderer and scientific dashboard stable concepts for droplets, rain
  initiation, and optics without coupling to one microphysics library.

## Non-Goals

- Do not require all solvers to emit droplet outputs.
- Do not replace existing scalar fields such as `cloud_liquid_water_kg_per_kg`.
- Do not implement production PySDM coupling here.
- Do not require per-cell full droplet spectra in routine live streaming.

## Versioning Strategy

Existing frames remain:

```text
schema_version = "sim-frame-v1"
```

Future frames that include optional microphysics payloads should use either:

```text
schema_version = "sim-frame-v1"
microphysics = null | MicrophysicsPayload
```

or, if strict schema-version semantics are preferred at implementation time:

```text
schema_version = "sim-frame-v1.1"
microphysics = null | MicrophysicsPayload
```

The recommended first implementation is an optional top-level `microphysics` field
because it allows existing solvers and frontend consumers to keep working. Absence of
the field, or `microphysics: null`, means no droplet distribution is available.

Optics consumes microphysics products through the physical-field contract in
`docs/optics-field-contract.md`. Microphysics fields such as
`effective_radius_um`, `number_concentration_m3`, and droplet distributions are
optional `microphysics_output` inputs. If they are absent, appearance views may
use an assumed effective radius only when labeled as `Assumed droplet radius`;
they should show `Droplet-aware input` only when real droplet fields are
available.

## Lower Atmosphere v2 Handoff Contract

Lower Atmosphere Cloud Basics v2 uses a separate handoff before any optional
droplet payload exists:

```text
cloud-column-microphysics-handoff-v1
```

The handoff source is intentionally limited to:

```text
source_model = controlled_cloud_column
```

It is not a `boussinesq_2d` coupling point and it does not implement rain
physics. It preserves controlled-column cloud-water timing, amount, water-budget
metadata, prescribed-lift metadata, source scenario and selected-profile
provenance, and the scalar time series future controlled microphysics needs.

Required handoff fields:

```text
source_model
source_scenario_id
source_profile_time_seconds
source_profile_time_hours_from_sunrise
cloud_column_run_id
cloud_column_time_seconds
cloud_liquid_water_kg_per_kg
max_cloud_liquid_water_kg_per_kg
cloud_water_integral
first_cloud_time_seconds
cloud_base_m
cloud_top_proxy_m
total_condensed_kg_per_kg
total_evaporated_kg_per_kg
water_budget_summary
prescribed_lift_summary
temperature_k
water_vapor_kg_per_kg
relative_humidity_percent
precipitation_status
microphysics_source
droplet_effective_radius_source
```

Rain and droplet fields are optional and absent in early v2:

```text
rain_water_kg_per_kg
first_rain_time_seconds
max_rain_water_kg_per_kg
effective_radius_um
droplet_size_distribution
number_concentration_m3
```

Precipitation statuses:

```text
precipitation_not_enabled
not_evaluated
cloud_no_rain
rain_threshold_reached
rain_formed
evaporation_limited
```

Early Lower Atmosphere v2 should use `precipitation_not_enabled` when cloud water
is available for later warm-rain diagnostics and `not_evaluated` when no cloud
water formed.

Microphysics source labels:

```text
none
bulk
PySDM
reference
synthetic
```

Droplet/effective-radius source labels:

```text
absent
assumed
bulk_estimate
PySDM
reference
```

## Controlled Warm-Rain Diagnostics v1

The current `microphysics_lab` does not emit a droplet distribution payload. It now
has a run-level diagnostics contract for the controlled bulk warm-rain path:

```text
schema_version = "microphysics-diagnostics-v1"
```

Required diagnostic fields:

```text
first_cloud_time_seconds
first_rain_time_seconds
max_cloud_liquid_water_kg_per_kg
max_rain_water_kg_per_kg
cloud_water_integral
rain_water_integral
vapor_depletion
total_water_budget_initial
total_water_budget_final
total_water_budget_drift
subcloud_evaporation_proxy
bulk_autoconversion_threshold
precipitation_status
precipitation_reason
droplet_payload_status
```

`cloud_water_integral` and `rain_water_integral` are trapezoidal integrals of the
emitted frame-mean mixing ratios over time, in `kg kg-1 s`. The budget fields are
computed from vapor + cloud liquid + rain water. The subcloud evaporation proxy is
a diagnostic sum of sampled rain-water decreases; it is not a resolved subcloud
evaporation model.

The allowed controlled warm-rain precipitation statuses are:

```text
not_evaluated
no_cloud
cloud_no_rain
rain_threshold_reached
rain_formed
evaporation_limited
```

The current droplet payload status is `not_available`. Future PySDM or other
droplet-aware work should add optional payloads without removing the bulk scalar
diagnostics, because diagnostics, comparison, and saved-run summaries need stable
cloud/rain timing and water-budget fields even when no distribution data exists.

## Proposed Frame Shape

```json
{
  "schema_version": "sim-frame-v1",
  "step": 30,
  "time_seconds": 600.0,
  "config": {},
  "grid": {},
  "fields": {},
  "microphysics": {
    "schema_version": "microphysics-v1",
    "source": {
      "solver": "microphysics_lab",
      "method": "super-droplet",
      "library": "PySDM",
      "library_version": "2.131"
    },
    "bin_axis": {
      "name": "particle_radius",
      "edge_values": [1.0, 2.0, 4.0, 8.0, 16.0, 32.0, 64.0],
      "unit": "um",
      "scale": "log",
      "closed": "left"
    },
    "global_distribution": {},
    "regional_distributions": [],
    "cell_summaries": {},
    "diagnostics": {},
    "metadata": {}
  }
}
```

`microphysics` is optional. Within it, only `schema_version`, `source`, and `bin_axis`
should be required for payloads that emit any distribution. Global, regional,
cell-summary, and diagnostic sections are independently optional.

## Bin Axis

The bin axis defines the coordinate system shared by distribution arrays.

| Field | Type | Meaning |
| --- | --- | --- |
| `name` | string | Usually `particle_radius`; future options may include `particle_diameter` or `dry_radius`. |
| `edge_values` | list of numbers | Bin edges, length `N + 1` for `N` bins. |
| `unit` | string | Recommended first unit: `um`. |
| `scale` | string | `log` or `linear`. |
| `closed` | string | Which side of each bin interval is inclusive, usually `left`. |

Use bin edges rather than centers so different products can be integrated or
thresholded consistently. Consumers can compute centers for plotting.

## Distribution Products

A distribution product should describe what each bin value means.

```json
{
  "product": "number_concentration",
  "unit": "m-3",
  "values": [12000000.0, 8000000.0, 2500000.0],
  "normalization": "per_bin",
  "radius_range_role": "all_droplets"
}
```

Recommended first product names:

| Product | Unit | Notes |
| --- | --- | --- |
| `number_concentration` | `m-3` | Particle count represented by each bin per air volume. |
| `liquid_water_mixing_ratio` | `kg kg-1` | Liquid water mass per dry-air mass by bin. |
| `liquid_water_content` | `kg m-3` | Liquid water mass per air volume by bin, useful for optics. |
| `particle_volume_fraction` | `m3 m-3` | PySDM smoke prototype currently emits this style of quantity. |

`normalization` should be explicit:

- `per_bin`: values are already integrated over each bin.
- `per_log_radius`: values represent a density such as `dX/dlnr`.
- `per_radius`: values represent a density such as `dX/dr`.

This matters because PySDM-like outputs may report a spectrum such as particle volume
versus logarithmic radius, while a UI plot may need integrated bin values.

## Global Distribution

Global distributions describe the whole frame or a single parcel/box run.

```json
{
  "scope": "global",
  "products": [
    {
      "product": "particle_volume_fraction",
      "unit": "m3 m-3",
      "normalization": "per_log_radius",
      "values": [0.0, 1.2e-8, 3.4e-7]
    }
  ],
  "summary": {
    "total_number_concentration_m3": 80000000.0,
    "cloud_liquid_water_kg_per_kg": 0.0004,
    "rain_water_kg_per_kg": 0.0,
    "mean_radius_um": 9.4,
    "effective_radius_um": 11.2,
    "rain_indicator_fraction": 0.02
  }
}
```

Use global distributions for:

- parcel prototypes
- box prototypes
- run-level summaries
- low-cost live display
- replay metadata

## Regional And Probe Distributions

Regional distributions describe named regions, probe samples, or user-selected areas.

```json
{
  "region_id": "probe-1",
  "scope": "probe",
  "label": "Probe at x=5.0 km z=1.2 km",
  "sample": {
    "x_m": 5000.0,
    "z_m": 1200.0,
    "radius_m": 150.0
  },
  "products": [],
  "summary": {}
}
```

Recommended scopes:

- `probe`: one user probe or small sample around it.
- `region`: named mask, drawn area, or diagnostic region.
- `column`: vertical column or slab.
- `cloud_object`: future segmented cloud region.

Probe/regional output should be produced on demand or at sparse cadence. Do not emit
many regional distributions every frame unless the user requested them.

## Cell Summaries

Cell summaries are compact gridded fields derived from the droplet distribution. They
should reuse the existing scalar field shape where possible instead of carrying full
spectra for each cell.

```json
{
  "mean_radius_um": {
    "unit": "um",
    "values": [[8.0, 8.2], [9.1, 10.5]]
  },
  "effective_radius_um": {
    "unit": "um",
    "values": [[10.0, 10.4], [11.0, 13.2]]
  },
  "rain_indicator_fraction": {
    "unit": "1",
    "values": [[0.0, 0.0], [0.03, 0.1]]
  }
}
```

Recommended first summaries:

- `mean_radius_um`
- `effective_radius_um`
- `number_concentration_m3`
- `rain_indicator_fraction`
- `collision_coalescence_rate_s-1` if available and well defined
- `condensation_growth_rate_um_s-1` if available and well defined

These summaries are renderer-friendly and keep payloads small. A future renderer can
use `effective_radius_um` and liquid water content for opacity/scattering hints
without reading full spectra.

When used by optics, cell summaries remain physical or microphysics outputs.
Renderer-derived opacity, brightness, shadow, rain-shaft, or optical-depth
products should be labeled as `Derived diagnostic` or `Visual approximation`
rather than written back into the microphysics payload.

## Optional Per-Cell Spectra

Full per-cell distributions are expensive. If needed, they should be explicit and
sparse:

```json
{
  "cell_distributions": {
    "encoding": "sparse_cells",
    "cell_indices": [[12, 8], [13, 8]],
    "products": [
      {
        "product": "number_concentration",
        "unit": "m-3",
        "normalization": "per_bin",
        "values": [
          [10.0, 20.0, 5.0],
          [9.0, 19.0, 8.0]
        ]
      }
    ]
  }
}
```

Avoid dense `rows x columns x bins` spectra in live frames by default. For a
`100 x 60` grid with `32` bins, one dense product is `192,000` numbers per frame
before JSON overhead. Multiple products would quickly dominate WebSocket traffic and
browser memory. Dense spectra should be reserved for saved artifacts, analysis
exports, or small diagnostic grids.

## Diagnostics

Microphysics diagnostics should expose process indicators without requiring the
frontend to understand a specific library.

```json
{
  "diagnostics": {
    "rain_radius_threshold_um": 40.0,
    "cloud_radius_range_um": [1.0, 40.0],
    "rain_radius_range_um": [40.0, 1000.0],
    "activation_fraction": 0.65,
    "rain_initiation_detected": false,
    "max_supersaturation_percent": 0.42,
    "collision_coalescence_active": true,
    "condensation_active": true
  }
}
```

Keep thresholds in metadata. A rain indicator is only meaningful if the threshold is
visible in the payload.

## Metadata And Uncertainty

Microphysics payloads should include enough metadata to avoid scientific overclaiming.

```json
{
  "metadata": {
    "assumptions": [
      "0-D box coalescence only",
      "no resolved dynamics",
      "radius bins are logarithmic"
    ],
    "approximation_level": "evaluation",
    "stochastic": true,
    "seed": 1,
    "sample_representativeness": "super-droplet approximation",
    "missing_processes": ["ice", "sedimentation"],
    "notes": "Bulk rain indicator uses radius >= 40 um."
  }
}
```

`approximation_level` should be one of:

- `evaluation`
- `prototype`
- `validated_reference`
- `production`

## Frontend Behavior

Frontend consumers should:

- treat `microphysics` as optional
- show existing scalar fields exactly as they do now when it is absent
- hide droplet-distribution charts when no distribution is present
- use product `unit`, `normalization`, and `bin_axis` metadata for labels
- prefer global/probe distributions for charts
- prefer cell summaries for heatmaps and optics
- avoid assuming the source library is PySDM

The renderer should not mutate solver state or infer physical meaning from display
colors. It should consume declared physical outputs.

Frontend optics consumers should also preserve the provenance category for each
input field. A droplet-aware optics view must not appear when the payload lacks
effective radius, number concentration, or distribution products; an
assumed-radius fallback is allowed only with explicit labeling.

## Migration Path

1. Keep current `sim-frame-v1` schema and solvers unchanged.
2. Implement optional Pydantic models for `MicrophysicsPayload` behind the current
   frame model or a `sim-frame-v1.1` model.
3. Add sample-frame tests proving frames without `microphysics` still validate.
4. Add synthetic microphysics payload tests before connecting PySDM.
5. Update frontend TypeScript types so `microphysics` is optional.
6. Add UI behavior that gracefully hides droplet panels when absent.
7. Let `microphysics_lab` emit global distributions first.
8. Add probe/regional distributions on demand.
9. Add cell summaries for visualization and optics.
10. Reserve dense per-cell spectra for saved/replay/export paths unless performance
    testing proves live streaming is acceptable.

## Validation Expectations

When schema code is added, tests should cover:

- backwards compatibility with existing frames
- missing optional microphysics payloads
- rectangular cell-summary shapes
- bin-edge length equals value length plus one
- distribution product units and normalization metadata
- frontend-safe JSON serialization
- payload-size guardrails for live streaming presets

## Relationship To PySDM

PySDM products can map into this schema, but the schema should not expose PySDM class
names, super-droplet attribute names, or internal product object shapes directly.

The abstraction boundary should be:

```text
PySDM particulator/products -> Cloud Lab microphysics adapter -> MicrophysicsPayload
```

This keeps the future frontend, renderer, replay files, and probes tied to Cloud Lab
concepts rather than one optional backend dependency.

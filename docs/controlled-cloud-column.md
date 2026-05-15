# Controlled Cloud Column

Issue: #178

`controlled_cloud_column` is Cloud Lab's first profile-driven cloud-formation
model in the lower-atmosphere reduced-model stack.

It answers:

```text
Given this environment and prescribed lift, does cloud form?
```

The model is intentionally controlled. It does not predict 2-D or 3-D dynamics,
does not use live `boussinesq_2d` velocity, does not include terrain, does not
produce precipitation, and does not implement PySDM or droplet distributions.

## Role In The Science Stack

`controlled_cloud_column` sits after `boundary_layer_1d`:

```text
boundary_layer_1d profile evolution
  -> controlled_cloud_column prescribed-lift cloud formation
  -> controlled microphysics / precipitation paths later
```

`boundary_layer_1d` diagnoses whether an environment becomes cloud-favorable.
`controlled_cloud_column` takes an initial or evolved profile plus a prescribed
lift history and diagnoses whether actual cloud liquid water forms.

This is a reduced interactive model, not a cloud-resolving model.

## Files

Backend implementation:

- `backend/app/sim/cloud_column_schemas.py`
- `backend/app/sim/cloud_column.py`
- `backend/app/sim/cloud_column_diagnostics.py`
- `backend/tests/test_cloud_column.py`

API endpoints:

- `GET /simulations/controlled-cloud-column/scenarios`
- `POST /simulations/controlled-cloud-column/run`

## Configuration

`CloudColumnConfig` uses:

```text
schema_version = cloud-column-config-v1
model_type = controlled_cloud_column
```

Inputs:

- vertical profile height, temperature, and either water vapor or RH
- optional mixed-layer depth, LCL, inversion height, and inversion strength
- prescribed updraft strength
- lift duration
- entrainment drying factor
- optional heating/cooling tendency
- runtime, timestep, and frame cadence
- optional initial cloud water for evaporation fixtures

## Output

`CloudColumnRun` uses:

```text
schema_version = cloud-column-run-v1
```

Each emitted `CloudColumnFrame` includes:

- time
- parcel height
- parcel temperature
- water vapor
- relative humidity
- cloud liquid water
- condensation-rate proxy
- evaporation-rate proxy
- prescribed lift

Run diagnostics include:

- first saturation time
- first cloud time
- cloud base
- cloud-top proxy
- cloud formation status and reason
- max RH
- max cloud liquid water
- water-budget summary
- forcing summary that labels lift as prescribed, not predicted

## Statuses

The v1 deterministic statuses are:

- `cloud_formed`
- `dry_failed`
- `cap_suppressed`
- `lift_too_weak`
- `moisture_limited`
- `evaporated`
- `not_evaluated`

Status explanations are deterministic strings generated from diagnostics. They
are not AI-generated summaries.

## Built-In Scenarios

Backend fixtures:

1. `humid-lifted-column`
2. `dry-failed-column`
3. `weak-lift-no-cloud`
4. `stronger-lift-earlier-cloud`
5. `capped-suppressed-column`
6. `evaporation-in-subsaturated-layer`
7. `no-lift-control`

These fixtures protect the v1 science relationships and provide future UI/API
integration anchors.

## Thermodynamic Method

The v1 model uses pressure-aware warm-cloud saturation helpers from
`backend/app/sim/thermodynamics.py`.

Each step applies:

- prescribed vertical lift while lift is active
- dry-adiabatic cooling from prescribed ascent
- optional prescribed heating/cooling tendency
- optional entrainment drying toward the environmental profile
- bulk saturation adjustment between vapor and cloud liquid water
- latent heating/cooling from condensation and evaporation

The lift is externally specified forcing. It is not a predicted circulation.

## Validation Expectations

Tests protect:

- valid schemas
- deterministic output
- finite fields
- nonnegative vapor/cloud water
- no-lift control stays cloud-free
- dry failed column stays cloud-free
- humid lifted column forms cloud
- stronger lift forms cloud earlier
- higher humidity forms cloud earlier
- cap suppression prevents cloud relative to uncapped forcing
- dry entrainment delays onset or reduces cloud water
- cloud evaporates in subsaturated conditions
- water-budget diagnostics stay finite and bounded for closed-water cases
- forcing metadata labels dynamics as prescribed, not predicted

## Relationship To Lower Atmosphere Cloud Basics

Lower Atmosphere Cloud Basics v1 still uses Yellow-labeled `boussinesq_2d` for
controlled qualitative experiments.

Lower Atmosphere Cloud Basics v2 should use `boundary_layer_1d` profiles,
`controlled_cloud_column` prescribed-lift formation, CM1 references, diagnostics,
and optics consuming physical fields.

## Relationship To Warm Rain / Droplet Growth

`controlled_cloud_column` produces bulk cloud liquid water but no rain,
sedimentation, droplet spectra, or PySDM output.

Warm Rain / Droplet Growth should remain a separate controlled microphysics path
until a lab requires explicit coupling.

## Known Limitations

V1 does not include:

- predicted dynamics
- 2-D or 3-D velocity fields
- terrain or orographic lift
- precipitation sedimentation
- droplet distributions
- PySDM
- radiative transfer or optics
- CM1/WRF reference ingestion

The model is useful because it makes cloud formation and failure cases
interpretable, not because it resolves atmospheric turbulence.

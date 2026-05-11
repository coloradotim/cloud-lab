# Boussinesq 2-D Physics Core

`boussinesq_2d` is Cloud Lab's current experimental 2-D dynamics physics core.

It is useful for selected labs, especially Fair-Weather Cumulus, but it is not the product architecture and not the final hard-core cloud model.

For validation status and science gates, see `docs/boussinesq-validation.md`.

For the lab-driven product direction, see `docs/lab-roadmap.md` and `docs/architecture-decisions/ADR-001-lab-driven-product.md`.

## Role In The Lab Roadmap

Current best uses:

- Fair-Weather Cumulus Lab
- controlled shallow-cloud visual experiments
- source-layer moisture and cloud-base diagnostics
- early layered-atmosphere experiments where limitations are clear
- possible early terrain/orographic experiments with validation companions

Current non-uses:

- quantitative atmospheric prediction
- research-grade CFD
- full turbulence/entrainment modeling
- droplet-resolved warm rain
- ice or mixed-phase clouds
- final host for advanced PySDM microphysics

## Scope

The solver emits the same `SimulationFrame` schema as other current physics cores:

- absolute temperature, `temperature_k`
- temperature perturbation, `temperature_perturbation_k`
- water vapor, `water_vapor_kg_per_kg`
- cloud liquid water, `cloud_liquid_water_kg_per_kg`
- rain water placeholder, `rain_water_kg_per_kg`
- horizontal velocity, `horizontal_velocity_m_per_s`
- vertical velocity, `vertical_velocity_m_per_s`

The shared frame contract lets labs, diagnostics, saved runs, comparison, and visualization consume Boussinesq output without depending on solver internals.

## Governing Approach

The prototype uses a 2-D Boussinesq-style vertical slice with:

- incompressible velocity from a streamfunction
- vorticity evolved by advection, diffusion, and horizontal buoyancy gradients
- buoyancy from temperature perturbation: `b = g * theta_prime / theta_ref`
- surface heating applied as a lower-layer temperature-perturbation tendency
- environmental-stability cooling for lifted warm perturbations
- Lagrangian-style parcel lift and parcel-temperature memory for condensation decisions
- surface-moist source-layer initialization for fair-weather scenarios
- scalar advection for temperature perturbation, vapor, cloud water, and vorticity
- simple diffusion for thermal, moisture, and vorticity fields
- explicit thermal and vorticity damping to keep this prototype in a conservative regime
- simple saturation adjustment for warm-cloud condensation in actively lifted cloudy cells

The streamfunction solve uses a fixed-iteration Jacobi Poisson solve:

```text
laplacian(psi) = -omega
u' = d psi / dz
w' = -d psi / dx
u = background_u + u'
w = background_w + w'
```

Vorticity receives the Boussinesq buoyancy source:

```text
d omega / dt ... += d b / dx
```

This makes heating gradients generate circulation while keeping the perturbation velocity approximately non-divergent.

## Numerical Approach

Each timestep applies:

1. Surface heating to temperature perturbation.
2. First-order upwind advection of temperature perturbation, vapor, cloud water, and vorticity.
3. Explicit diffusion of scalar and vorticity fields.
4. Environmental-stability cooling for vertically displaced warm perturbations.
5. Thermal and vorticity damping.
6. Buoyancy-gradient forcing of vorticity.
7. Jacobi streamfunction solve.
8. Velocity recovery from streamfunction.
9. Parcel lift and parcel-temperature memory updates for air being carried upward.
10. Warm-cloud saturation adjustment with latent heating in cells with active updrafts or existing cloud water.
11. A shallow top sponge to reduce closed-lid artifacts.

Constants are named in `backend/app/sim/boussinesq_2d.py`. They are intentionally visible because this is a prototype numerical core, not a tuned black box.

## Differences From `educational_2d`

- `educational_2d` directly accelerates vertical velocity from local temperature perturbation and applies an illustrative thermal circulation around the heater.
- `boussinesq_2d` evolves vorticity and derives velocity from a streamfunction, which gives a more coherent circulation and a better path toward pressure-coupled dynamics.
- Both solvers currently use simple warm-cloud saturation adjustment, not advanced microphysics.
- Both solvers emit the same frame schema, but only `boussinesq_2d` is part of the public 2-D cloud workflow.

## Limitations

- The Poisson solve is fixed-iteration Jacobi, not a production multigrid or spectral solver.
- Boundary conditions are simple and still need validation.
- Damping and perturbation caps are safety rails for prototype stability, not calibrated physics.
- No turbulence closure, terrain-following coordinates, Coriolis force, rain sedimentation, ice physics, or aerosol/CCN treatment.
- Moist physics remains simple saturation adjustment.
- No formal benchmark validation against a trusted CFD or atmospheric model.

## Validation Notes

Automated tests and validation reports check that the prototype:

- emits valid shared-schema frames
- remains finite over short fair-weather runs
- is deterministic for seeded configurations
- keeps moisture fields non-negative
- produces buoyant motion and delayed cloud water under fair-weather heated conditions
- does not create cloud water, temperature perturbations, or vertical motion in a saturated no-heating run
- keeps the legacy educational solver runnable through explicit configs while hiding it from the public solver list
- passes divergence, thermal-bubble, and fair-weather thermodynamic structure diagnostics within current prototype expectations

These are stability, relationship, and lab-support checks. They do not prove atmospheric realism.

## Lab-Driven Improvement Rule

Improve this core when a lab exposes a specific need:

- Fair-Weather Cumulus cloud base or onset is misleading.
- Evolving Boundary Layer needs time-varying profiles coupled into 2-D dynamics.
- Orographic / Terrain Clouds reveal boundary or transport artifacts.
- Validation diagnostics show physically wrong relationships in controlled scenarios.

Do not tune this core endlessly in pursuit of a generic final model. Future hard-core modeling may require a new physics core behind the same lab/scenario/frame/diagnostic contracts.

# Prototype Boussinesq 2-D Solver

Issue #25 introduces `boussinesq_2d`, Cloud Lab's first backend beyond the frozen educational solver.

This backend is a prototype for more credible dynamics. It is still a compact local model, but its velocity field is generated from a 2-D streamfunction/vorticity formulation instead of the educational solver's direct thermal-circulation forcing.

## Scope

The solver emits the same `SimulationFrame` schema as `educational_2d`:

- absolute temperature, `temperature_k`
- temperature perturbation, `temperature_perturbation_k`
- water vapor, `water_vapor_kg_per_kg`
- cloud liquid water, `cloud_liquid_water_kg_per_kg`
- rain water placeholder, `rain_water_kg_per_kg`
- horizontal velocity, `horizontal_velocity_m_per_s`
- vertical velocity, `vertical_velocity_m_per_s`

## Governing Approach

The prototype uses a 2-D Boussinesq-style vertical slice with:

- incompressible velocity from a streamfunction
- vorticity evolved by advection, diffusion, and horizontal buoyancy gradients
- buoyancy from temperature perturbation: `b = g * theta_prime / theta_ref`
- surface heating applied as a lower-layer temperature-perturbation tendency
- environmental-stability cooling for lifted warm perturbations
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
9. Warm-cloud saturation adjustment with latent heating in cells with active updrafts or existing cloud water.
10. A shallow top sponge to reduce closed-lid artifacts.

Constants are named in `backend/app/sim/boussinesq_2d.py`. They are intentionally visible because this is a prototype numerical core, not a tuned black box.

## Differences From `educational_2d`

- `educational_2d` directly accelerates vertical velocity from local temperature perturbation and applies an illustrative thermal circulation around the heater.
- `boussinesq_2d` evolves vorticity and derives velocity from a streamfunction, which gives a more coherent circulation and a better path toward pressure-coupled dynamics.
- Both solvers currently use simple warm-cloud saturation adjustment, not advanced microphysics.
- Both solvers emit the same frame schema and can be selected by `SimulationConfig.solver_type`.

## Limitations

- The Poisson solve is fixed-iteration Jacobi, not a production multigrid or spectral solver.
- Boundary conditions are simple and still need validation.
- Damping and perturbation caps are safety rails for prototype stability, not calibrated physics.
- No turbulence closure, terrain, Coriolis force, rain sedimentation, ice physics, or aerosol/CCN treatment.
- Moist physics remains simple saturation adjustment. New cloud water is gated by a small updraft threshold so diffusion across a saturated initial humidity profile does not create a stationary boundary-layer cloud band without forcing.
- No formal benchmark validation yet.

## Validation Notes

Automated tests check that the prototype:

- emits valid shared-schema frames
- remains finite over short fair-weather runs
- is deterministic for seeded configurations
- keeps moisture fields non-negative
- produces buoyant motion and cloud water under humid heated conditions
- does not create cloud water, temperature perturbations, or vertical motion in a saturated no-heating run

These are stability and integration tests, not atmospheric validation.

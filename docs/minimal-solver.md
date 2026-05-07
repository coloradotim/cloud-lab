# Minimal 2-D Solver

Issue #3 introduces Cloud Lab's first intentionally simple 2-D vertical-slice atmosphere solver. It is designed for early visualization and regression testing, not for research-grade atmospheric prediction.

## Scope

The solver evolves row-major `x-z` fields for:

- temperature, `temperature_k`, in K
- water vapor, `water_vapor_kg_per_kg`, in kg kg-1
- cloud liquid water, `cloud_liquid_water_kg_per_kg`, in kg kg-1
- rain water placeholder, `rain_water_kg_per_kg`, in kg kg-1
- horizontal velocity, `horizontal_velocity_m_per_s`, in m s-1
- vertical velocity, `vertical_velocity_m_per_s`, in m s-1

Frames are emitted as `SimulationFrame` values, so API and frontend consumers use the same schema as future solver versions.

## Governing Assumptions

This first solver uses a simplified warm-cloud slice:

- 2-D vertical slice with no y dimension.
- Explicit timestep update.
- Localized surface heating in the lower part of the domain.
- A smooth initial temperature profile with a dry-adiabatic well-mixed boundary layer and a configurable environmental lapse rate above it.
- Temperature and moisture are advected by the current velocity field.
- Simple diffusion smooths temperature and moisture fields.
- Temperature perturbation from the initial environmental profile drives vertical acceleration.
- A simple convergence/divergence wind response creates thermal circulation around the heating patch.
- Saturation is estimated with a Tetens-style saturation vapor pressure formula at a fixed representative pressure of 900 hPa.
- Supersaturated vapor condenses into cloud liquid water.
- Condensation applies latent heating with a named constant.

## Numerical Approach

Each timestep applies:

1. Surface heating near the lower boundary using a uniform horizontal patch with tapered shoulders.
2. First-order upwind advection for temperature, water vapor, and cloud liquid water.
3. Explicit Laplacian diffusion for temperature and moisture.
4. Saturation adjustment that transfers excess vapor into cloud liquid water.
5. Latent heating from condensed water.
6. Buoyancy and circulation updates for horizontal and vertical velocity.
7. Velocity damping and clipping to keep the toy model stable.

The model prioritizes readable behavior over performance. It uses Python lists rather than NumPy so the initial dependency footprint stays small.

## Timestep And Stability Notes

The default local sample run uses a small grid and a 2 second timestep. This is appropriate for the current toy dynamics and CI tests. Larger velocity, smaller grid spacing, stronger heating, or longer timesteps can violate the simple explicit stability assumptions.

Named constants in `backend/app/sim/solver.py` document the current damping, diffusion, buoyancy, condensation, and clipping controls. They should be revisited when the solver becomes more physically complete.

## Validation Notes

Automated tests currently check:

- Seeded runs are reproducible.
- Output frames follow the shared frame schema.
- Fields preserve configured shape.
- Field values remain finite.
- Surface heating produces a stronger updraft than the initial state.
- Uniform scalar fields stay unchanged under first-order upwind advection.
- The fair-weather heated lower patch remains warm and upward-moving early in the run.
- Humid seeded runs produce non-zero cloud liquid water.
- Cloud liquid water remains non-negative.

These tests are sanity checks, not validation against observed cases or a trusted numerical model.

## Known Limitations

- No pressure solve or incompressible projection.
- No mass-conserving velocity field.
- No terrain, Coriolis force, precipitation sedimentation, ice physics, or turbulence closure.
- No energy or total-water conservation guarantee.
- Fixed representative pressure in the saturation approximation.
- Rain water remains a zero placeholder for schema stability.
- The wind response is an educational thermal-circulation approximation, not Navier-Stokes.

## Level-Up Path

Good next steps:

- Add clearer stability diagnostics and configuration warnings.
- Add conservation-oriented validation checks.
- Replace the toy velocity response with a better pressure/buoyancy coupling.
- Add terrain forcing and painted surface heating controls.
- Evaluate PySDM for warm-cloud microphysics once transport and frame schemas are stable.
- Introduce 2.5-D or 3-D only after the 2-D frame contract and validation story are solid.

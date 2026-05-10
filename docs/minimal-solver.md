# Educational 2-D Solver

Cloud Lab's first intentionally simple 2-D vertical-slice atmosphere solver is
now frozen as the `educational_2d` backend. It is designed for explicit legacy
configs and regression testing, not as a public cloud-physics model and not for
research-grade atmospheric prediction.

Future scientific credibility should come from new solver backends behind the shared solver interface, not from incrementally tuning this educational model.

The first such backend is documented in `docs/boussinesq-solver.md`.

## Scope

The `educational_2d` solver evolves row-major `x-z` fields for:

- temperature, `temperature_k`, in K
- water vapor, `water_vapor_kg_per_kg`, in kg kg-1
- cloud liquid water, `cloud_liquid_water_kg_per_kg`, in kg kg-1
- rain water placeholder, `rain_water_kg_per_kg`, in kg kg-1
- horizontal velocity, `horizontal_velocity_m_per_s`, in m s-1
- vertical velocity, `vertical_velocity_m_per_s`, in m s-1

Frames are emitted as `SimulationFrame` values, so API and frontend consumers
use the same schema as future solver versions. The backend registry in
`backend/app/sim/solver.py` dispatches by `SimulationConfig.solver_type`, but
`educational_2d` is intentionally hidden from the public solver catalog.

## Governing Assumptions

This educational solver uses a simplified warm-cloud slice:

- 2-D vertical slice with no y dimension.
- Explicit timestep update.
- Localized surface heating in the lower part of the domain.
- A smooth initial temperature profile with a dry-adiabatic well-mixed boundary layer and a configurable environmental lapse rate above it.
- Temperature and moisture are advected by the current velocity field.
- Rising and sinking air applies a simple dry-adiabatic temperature tendency before condensation.
- Simple diffusion smooths temperature and moisture fields.
- Temperature perturbation from the initial environmental profile drives vertical acceleration.
- A simple convergence/divergence wind response creates thermal circulation around the heating patch.
- Saturation is estimated with a Tetens-style saturation vapor pressure formula at a fixed representative pressure of 900 hPa.
- Supersaturated vapor condenses into cloud liquid water.
- Condensation applies latent heating with a named constant.

Historical educational-solver max-heating runs produced small illustrative cloud
liquid water values, but new fair-weather scenario contracts should be validated
against the `boussinesq_2d` reference cases instead. The educational solver's
late-run liquid-water values should still be treated as illustrative rather than
validated cloud microphysics.

## Numerical Approach

Each timestep applies:

1. Surface heating near the lower boundary using a uniform horizontal patch with tapered shoulders.
2. First-order upwind advection for temperature, water vapor, and cloud liquid water.
3. Explicit Laplacian diffusion for temperature and moisture.
4. Dry-adiabatic temperature adjustment from vertical displacement.
5. Saturation adjustment that transfers excess vapor into cloud liquid water.
6. Latent heating from condensed water.
7. Buoyancy and circulation updates for horizontal and vertical velocity.
8. Velocity damping and clipping to keep the toy model stable.

The model prioritizes readable behavior over performance. It uses Python lists rather than NumPy so the educational dependency footprint stays small.

## Timestep And Stability Notes

The default local sample run uses a small grid and a 2 second timestep. This is appropriate for the current toy dynamics and CI tests. Larger velocity, smaller grid spacing, stronger heating, or longer timesteps can violate the simple explicit stability assumptions.

Named constants in `backend/app/sim/educational_2d.py` document the current damping, diffusion, buoyancy, condensation, and clipping controls. They are preserved for regression stability; new scientific work should start in a new backend.

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
- The dry-adiabatic lifting/cooling tendency is a local educational approximation, not a full thermodynamic parcel model.
- The top rows use a shallow sponge layer that relaxes temperature, vapor, condensate, and velocity toward the background state. This avoids closed-lid condensate buildup without damping the surface-heated layer.
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

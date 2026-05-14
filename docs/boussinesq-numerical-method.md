# Boussinesq Numerical Method Contract

Issue: #172

This document is the numerical-method contract for Cloud Lab's current
`boussinesq_2d` solver. It describes what the solver actually does today, how
its fields should be interpreted, what its stabilizers and safety caps mean,
and what trust limits follow from the #153-#159 remediation evidence.

This is a documentation and design contract. It does not tune solver constants,
change scenario presets, alter renderer behavior, or claim that `boussinesq_2d`
is Green.

## 1. Current Role And Trust Status

`boussinesq_2d` is an experimental 2-D dynamics scaffold. It is useful for
selected qualitative Lower Atmosphere Cloud Basics experiments, but it is not a
quantitative atmospheric model, not research-grade CFD, and not a final
cloud-resolving engine.

Current trust status:

```text
Yellow
```

Yellow means:

- OK for controlled qualitative experiments with honest experimental labels.
- OK for Lower Atmosphere Cloud Basics when diagnostics and caveats remain
  visible.
- Not OK as a broadly trusted atmospheric-dynamics foundation.
- Not OK as the final host for polished future Boussinesq-dependent labs unless
  trust gaps are resolved or explicitly accepted.
- Future Boussinesq-dependent labs should remain prototype-only or pause until
  #160 decides whether to invest in a successor dynamics path.

The #159 stabilizer audit is central to this status:

```text
The default Lower Atmosphere baseline reaches the theta perturbation safety cap,
and damping/diffusion materially shape cloud amount, timing, and vertical
development.
```

That does not make the current solver useless. It means normal supported
behavior is partly shaped by prototype guardrails, so product claims must stay
qualitative and diagnostics must stay explicit.

## 2. Intended Governing Approximation

The intended model class is:

- 2-D vertical slice in x and z.
- Boussinesq-style / incompressible scaffold.
- Streamfunction-vorticity flow.
- Buoyancy from temperature perturbation.
- Scalar advection/diffusion for temperature perturbation, water vapor, cloud
  water, and vorticity.
- Simple warm-cloud saturation adjustment.
- Pressure-aware saturation and LCL diagnostics while dynamics remain
  Boussinesq-style.

Actual dynamics:

- Vorticity is evolved and inverted to a streamfunction.
- Perturbation velocity is diagnosed from streamfunction gradients.
- Surface heating creates temperature perturbations.
- Horizontal buoyancy gradients force vorticity.
- Scalars are advected using first-order upwind differences and diffused
  explicitly.

Parameterized or heuristic terms:

- Environmental stability adjustment applies a local displacement-based cooling
  term to temperature perturbation.
- Parcel lift and parcel temperature are helper-memory fields used to make
  condensation respond to lifted air.
- Condensation is gated by updraft or existing cloud water.
- Diffusion, damping, relaxation, and caps are prototype stabilizers and
  guardrails, not calibrated turbulence or microphysics.

Not modeled:

- No turbulence closure.
- No terrain.
- No Coriolis force.
- No precipitation sedimentation.
- No ice or mixed phase.
- No full compressible thermodynamics.
- No anelastic pressure/Exner coupling.
- No quantitative cloud forecast value.

## 3. State-Variable Classification

| State variable | Classification | Emitted frame relationship | Notes |
| --- | --- | --- | --- |
| `theta_perturbation_k` | Prognostic model state | Directly emitted as `temperature_perturbation_k`; also added to environmental temperature to emit `temperature_k`. | Heated, advected, diffused, stability-adjusted, relaxed, clipped, modified by latent heating/cooling, and top-sponged. |
| `water_vapor_kg_per_kg` | Prognostic model state | Directly emitted. | Initialized from configured humidity profile; advected, diffused, clipped nonnegative and capped; changed by condensation/evaporation. |
| `cloud_liquid_water_kg_per_kg` | Prognostic model state | Directly emitted. | Starts at zero; advected, diffused, clipped nonnegative and capped; changed by condensation/evaporation; top-sponged. |
| `rain_water_kg_per_kg` | Placeholder / output-only field | Directly emitted, but currently remains unchanged. | Present for shared frame schema compatibility; no sedimentation or rain microphysics in `boussinesq_2d`. |
| `parcel_temperature_k` | Heuristic memory/helper state | Not emitted directly. | Advected and cooled by vertical motion; reset after top sponge to match emitted temperature. Used to compute lifted condensation target. |
| `parcel_lift_m` | Heuristic memory/helper state | Not emitted directly. | Advected, decayed, incremented by vertical velocity, and bounded by domain height. Used to cool the condensation target. |
| `vorticity_per_second` | Prognostic model state | Not emitted directly. | Advected, diffused, damped, buoyancy-forced, clipped, and inverted to streamfunction. |
| `horizontal_velocity_m_per_s` | Diagnostic field carried as state | Directly emitted. | Recovered from streamfunction plus background wind. Used by the next advection step. |
| `vertical_velocity_m_per_s` | Diagnostic field carried as state | Directly emitted. | Recovered from streamfunction plus background vertical wind. Used by the next advection and parcel update. |
| `environmental_temperature_k` | Prescribed background state | Used to reconstruct emitted `temperature_k`; not emitted separately. | Initialized from surface temperature, dry-adiabatic mixed layer, boundary-layer depth, and free-atmosphere lapse rate. It does not evolve. |

The emitted absolute temperature field is reconstructed:

```text
temperature_k = environmental_temperature_k + theta_perturbation_k
```

The emitted velocity fields are diagnostic products of the vorticity /
streamfunction solve, but the solver stores them because the next timestep uses
the previous velocity for advection.

## 4. Timestep / Operator Sequence

`step_state` applies a fixed explicit operator sequence.

| Step | Operation | Classification | Can materially alter cloud outcome? |
| ---: | --- | --- | --- |
| 1 | Surface heating | Physical model term / prescribed forcing | Yes. It creates the thermal source. |
| 2 | Temperature perturbation advection | Numerical discretization | Yes. It transports thermal anomalies. |
| 3 | Thermal diffusion | Numerical stabilizer / model simplification | Yes. #159 shows damping/diffusion materially shape outcome. |
| 4 | Environmental stability adjustment | Heuristic model term | Yes. It supports stable/capped suppression behavior. |
| 5 | Thermal relaxation | Prototype stabilizer | Yes. Included in #159 half-damping/diffusion sensitivity. |
| 6 | Temperature perturbation clipping | Safety cap | Yes when reached. #159 shows the default baseline reaches the theta cap. |
| 7 | Water vapor advection | Numerical discretization | Yes. It moves moisture toward cloud-forming levels. |
| 8 | Water vapor diffusion/clipping | Numerical stabilizer / safety cap | Yes. Vapor transport and smoothing affect saturation. |
| 9 | Cloud water advection | Numerical discretization | Yes. It transports condensate. |
| 10 | Cloud water diffusion/clipping | Numerical stabilizer / safety cap | Yes. It smooths and bounds condensate. |
| 11 | Vorticity advection | Numerical discretization | Yes. It transports circulation. |
| 12 | Vorticity diffusion | Numerical stabilizer / model simplification | Yes. Included in #159 half-damping/diffusion sensitivity. |
| 13 | Buoyancy calculation | Physical model term | Yes. Links thermal anomaly to circulation. |
| 14 | Vorticity damping | Prototype stabilizer | Yes. Included in #159 half-damping/diffusion sensitivity. |
| 15 | Buoyancy-gradient vorticity forcing | Physical model term / finite-difference discretization | Yes. Drives thermal circulation. |
| 16 | Vorticity clipping | Safety cap | Yes when reached. Reduced damping/diffusion can hit it. |
| 17 | Streamfunction solve | Numerical discretization | Yes. Converts vorticity to flow. |
| 18 | Velocity recovery | Diagnostic/output step with safety cap | Yes. Velocity controls later advection and parcel lift. |
| 19 | Parcel-lift update | Heuristic memory term | Yes. It changes condensation target temperature. |
| 20 | Parcel-temperature update | Heuristic memory term | Yes. It changes condensation target temperature. |
| 21 | Condensation/evaporation | Heuristic warm-cloud model term | Yes. Directly creates/removes cloud water. |
| 22 | Latent heating/cooling | Heuristic physical model term | Yes. Feeds cloud changes back into theta. |
| 23 | Top sponge | Boundary guardrail | Not in #159 normal-height cases; still possible near lid. |
| 24 | Final emitted state | Diagnostic/output step | No, except it defines what downstream diagnostics see. |

Important ordering implications:

- Vapor and cloud water are advected/diffused before condensation/evaporation.
- Velocity is recovered before parcel lift and condensation in the same step.
- Latent heating can push theta back toward the theta cap.
- The top sponge is applied after condensation and velocity recovery.

## 5. Spatial Discretization

Grid layout:

- Row-major 2-D arrays.
- `row_index` maps to vertical coordinate `z`.
- `column_index` maps to horizontal coordinate `x`.
- `x_coordinates_m` and `z_coordinates_m` are cell-center coordinates emitted in
  `GridMetadata`.
- `dx_m = domain.width_m / grid.columns`.
- `dz_m = domain.height_m / grid.rows`.

Numerical methods:

- Advection uses first-order upwind differences.
- Diffusion uses an explicit 5-point Laplacian with nearest-edge sampling.
- Buoyancy is `g * theta_prime / theta_ref`.
- Vorticity forcing uses centered finite differences of buoyancy in x, with edge
  columns sampled from the nearest in-domain column.
- Streamfunction inversion uses a fixed-iteration Jacobi solve for a Poisson-like
  equation.
- Velocity is recovered from streamfunction:

```text
u' = d psi / dz
w' = -d psi / dx
u = background_u + u'
w = background_w + w'
```

Known limitations:

- No staggered grid.
- No emitted ghost cells.
- Approximate edge behavior.
- Fixed `POISSON_ITERATIONS = 80`, not convergence-controlled.
- No formal convergence proof.
- First-order advection is diffusive and can shape plume/cloud structure.
- Explicit diffusion requires timestep caution, though current supported
  defaults are comfortably small relative to simple diffusion stability scales.

## 6. Boundary Conditions

Current boundary behavior is simple and prototype-oriented.

Advection:

- Upwind sampling clamps to the nearest in-domain row/column at edges.
- This effectively creates one-sided / no-exterior sampling at boundaries.

Diffusion:

- The Laplacian samples nearest in-domain edge values.
- This approximates a zero-normal-gradient style edge for scalar and vorticity
  diffusion, but it is not a full ghost-cell boundary condition.

Streamfunction:

- The Jacobi solve initializes streamfunction to zero.
- Interior cells are iterated; boundary streamfunction remains fixed at zero.
- This is a simple closed-boundary scaffold, not a validated atmospheric
  boundary treatment.

Velocity:

- Velocity is recovered from streamfunction using clamped neighbor sampling at
  boundaries.
- Background wind is added after perturbation velocity recovery.
- Velocity is clipped by `MAX_ABS_VELOCITY_M_PER_S`.

Top sponge:

- The top `TOP_SPONGE_DEPTH_CELLS` rows are relaxed toward quiet conditions with
  a quadratic vertical weight.
- The sponge relaxes theta, cloud water, vorticity, and velocity toward
  background state.
- Vapor is copied through but not relaxed by the current sponge implementation.

#159 finding:

```text
Top sponge was not found to materially change coarse outcomes for audited
normal-height Lower Atmosphere cases, but it remains a boundary guardrail.
```

Boundary cloud water:

- #157 classifies below-LCL, return-flow, boundary, top-sponge, lateral-boundary,
  and boundary-connected cloud-water signals.
- These diagnostics are warnings or hard failures depending on the signal.
- Renderer layers must not hide cloud water to make these warnings disappear.

Longer-run return-flow and boundary interpretation remain under #157 policy and
Yellow trust status.

## 7. Thermodynamics And Moisture

Pressure-aware helpers:

- `pressure_at_height_pa` uses an exponential hydrostatic approximation.
- `BOUSSINESQ_REFERENCE_SURFACE_PRESSURE_PA = 90_000 Pa` preserves the
  prototype's historical Boussinesq reference pressure.
- `saturation_specific_humidity_kg_per_kg` uses temperature and local pressure.
- `lcl_height_m` dry-lifts a surface parcel through the pressure profile.

Important distinction:

- The dynamics remain Boussinesq-style and incompressible.
- The pressure profile is used for saturation, relative humidity, LCL, and
  diagnostics. It is not a compressible pressure evolution.

Initialization:

- `environmental_temperature_k` is dry adiabatic up to
  `boundary_layer_depth_m`, then follows the configured lapse rate aloft.
- `surface_moisture` initializes source-layer vapor from surface saturation and
  source-layer relative humidity, then transitions to environmental vapor above
  the moist source layer.
- Source-layer vapor is capped at
  `INITIAL_SATURATION_CAP_FRACTION * local_saturation`.
- Uniform and moist-boundary-layer profiles use a mixed-layer vapor estimate
  below `boundary_layer_depth_m`, also capped against local saturation.

Condensation/evaporation:

- Parcel lift cools the condensation target by a bounded dry-adiabatic signal.
- `parcel_temperature_k` carries an advected, step-wise cooled memory signal.
- Condensation uses the lifted-parcel target saturation.
- Condensation can happen only when vertical velocity exceeds
  `CONDENSATION_UPDRAFT_THRESHOLD_M_PER_S` or existing cloud exceeds
  `CONDENSATION_CONTINUATION_CLOUD_THRESHOLD_KG_PER_KG`.
- Evaporation of pre-existing transported cloud water uses the emitted cell's
  local pressure-aware saturation state.
- Condensation warms and evaporation cools temperature through the latent
  heating term.

#155 changed the thermodynamic path by making saturation/LCL diagnostics
pressure-aware instead of using one fixed pressure at every height.

#166 changed local evaporation behavior so transported cloud water is evaporated
against the emitted cell's local saturation state while lifted-parcel
condensation remains available.

Three moisture states must not be conflated:

- Lifted-parcel condensation target: heuristic cloud-formation target.
- Emitted-cell local saturation state: local RH/evaporation diagnostic state.
- Diagnostic RH/LCL state: pressure-aware interpretation of emitted frames and
  initialized profiles.

## 8. Stabilizers, Caps, And Damping Classification

| Constant | Value | Unit | Controls | Classification | Normal scenario evidence | Recommendation |
| --- | ---: | --- | --- | --- | --- | --- |
| `THERMAL_DIFFUSIVITY_M2_PER_S` | 22.0 | m2 s-1 | Theta diffusion | Numerical stabilizer / model simplification | Half damping/diffusion materially changes cloud amount, onset, top, and updraft. | Keep for now; expose diagnostics; future calibration or redesign concern. |
| `MOISTURE_DIFFUSIVITY_M2_PER_S` | 10.0 | m2 s-1 | Vapor and cloud-water diffusion | Numerical stabilizer / model simplification | Half damping/diffusion materially changes cloud outcomes. | Keep for now; calibrate only with explicit acceptance criteria. |
| `KINEMATIC_VISCOSITY_M2_PER_S` | 90.0 | m2 s-1 | Vorticity diffusion | Numerical stabilizer / model simplification | Half damping/diffusion strongly changes motion and cap proximity. | Keep for now; successor-core concern. |
| `VORTICITY_DAMPING_PER_SECOND` | 0.025 | s-1 | Vorticity damping | Prototype stabilizer | Half damping/diffusion can push vorticity to cap. | Keep; tune only under explicit numerical contract. |
| `THERMAL_RELAXATION_PER_SECOND` | 0.0018 | s-1 | Theta relaxation toward zero | Prototype stabilizer | Default baseline still hits theta cap; halving relaxation changes outcomes. | Keep; expose cap/stabilizer warnings. |
| `VELOCITY_DAMPING_PER_SECOND` | 0.004 | s-1 | Named velocity guardrail | Currently unused named guardrail | Included in audit variant, but emitted velocity is diagnosed from streamfunction and not damped by this constant. | Either wire deliberately or remove in a future cleanup; do not treat as active physics. |
| `TOP_SPONGE_DEPTH_CELLS` | 2 | cells | Top sponge thickness | Boundary stabilizer | Normal-height #159 cases did not respond materially to sponge removal. | Keep as boundary guardrail; warn when cloud reaches top sponge. |
| `TOP_SPONGE_RELAXATION_PER_SECOND` | 0.05 | s-1 | Top sponge relaxation rate | Boundary stabilizer | No-top-sponge did not alter audited normal-height outcomes. | Keep; not the apparent normal shallow-cloud cause. |
| `PARCEL_LIFT_DECAY_PER_SECOND` | 0.001 | s-1 | Parcel-lift memory decay | Heuristic parameter | Affects lifted condensation memory; not isolated by #159. | Keep documented; future thermodynamic redesign candidate. |
| `PARCEL_LIFT_COOLING_FRACTION` | 0.40 | dimensionless | Fraction of lift memory used for condensation cooling | Heuristic parameter | Supports lifted condensation; not isolated by #159. | Keep documented; calibrate only with cloud-base contract. |
| `MAX_PARCEL_COOLING_LIFT_M` | 1000.0 | m | Bound on lift used for parcel cooling | Heuristic safety bound | Not separately audited. | Keep as guardrail; expose if successor work targets condensation memory. |
| `MIN_PARCEL_TEMPERATURE_K` | 180.0 | K | Parcel temperature lower clamp | Safety cap | Not approached in normal Lower Atmosphere evidence. | Keep. |
| `MAX_PARCEL_TEMPERATURE_K` | 330.0 | K | Parcel temperature upper clamp | Safety cap | Not approached in normal Lower Atmosphere evidence. | Keep. |
| `MAX_ABS_VELOCITY_M_PER_S` | 10.0 | m s-1 | Velocity component cap | Safety cap | Default normal-height cases do not approach; half damping/diffusion baseline reaches 0.894 of cap. | Keep; cap proximity should remain visible. |
| `MAX_ABS_THETA_PERTURBATION_K` | 10.0 | K | Theta perturbation cap | Safety cap | Default `fair-weather-moderate-base` reaches cap; multi-thermal approaches it. | Keep for guardrail, but this is a Yellow trust concern. |
| `MAX_ABS_VORTICITY_PER_SECOND` | 0.08 | s-1 | Vorticity cap | Safety cap | Defaults remain below; half damping/diffusion can hit cap. | Keep; successor-core concern if normal variants keep hitting. |
| `MAX_WATER_VAPOR_KG_PER_KG` | 0.04 | kg kg-1 | Vapor cap | Safety cap | Defaults below cap; half damping/diffusion baseline reaches cap. | Keep; investigate only if defaults approach. |
| `MAX_CLOUD_LIQUID_WATER_KG_PER_KG` | 0.01 | kg kg-1 | Cloud-water cap | Safety cap | Defaults do not approach; half damping/diffusion baseline hits cap. | Keep; not default limiter but important diagnostic. |
| `INITIAL_SATURATION_CAP_FRACTION` | 0.98 | dimensionless | Initial vapor cap against local saturation | Initialization guardrail / heuristic parameter | #154/#155 show it shapes initialized source-layer structure. | Keep documented; future profile/thermo redesign candidate. |

Required #159 findings:

- Default `fair-weather-moderate-base` reaches the theta cap.
- `multi-thermal-cumulus-field` approaches the theta cap.
- Velocity/cloud-water caps are not approached by default normal-height runs.
- Half damping/diffusion materially changes cloud amount, timing, updraft, and
  cloud-top height.
- Top sponge did not materially affect audited normal-height outcomes.

## 9. Stability And Supported Operating Envelope

Recommended current Lower Atmosphere Cloud Basics envelope:

| Control | Supported range | Notes |
| --- | --- | --- |
| Grid | `30 x 20` through `54 x 36` | Qualitative outcomes are stable, but cloud amount and updraft strength are resolution-sensitive. |
| Domain | `8 km x 2.5 km` through `12 km x 4 km` | Smaller/shallow baseline runs can trigger return-flow warnings. |
| Runtime | `1200 s` through `1800 s` for cloud-forming cases | `600 s` is diagnostic-only and too short to prove delayed cloud formation. |
| Timestep | `2 s` default | Code does not dynamically enforce CFL or diffusion stability. |
| Frame cadence | `30 s` standard, `20 s` quick, `120 s` long reproduction | Diagnostics depend on emitted frames, so coarse cadence can miss timing detail. |

Practical numerical guidance:

- Current default `10 km x 3 km`, `36 x 24` gives `dx ~= 278 m`,
  `dz = 125 m`, `dt = 2 s`.
- Under the velocity cap of `10 m s-1`, advective Courant numbers are roughly
  `0.072` in x and `0.16` in z for the default grid.
- Observed default Lower Atmosphere velocities are lower than the velocity cap,
  but #159 half damping/diffusion variants can become cap-adjacent.
- Explicit diffusion factors for current defaults are small relative to simple
  2-D explicit diffusion stability limits, but the code does not enforce a
  stability check if a user supplies a very high diffusivity, high resolution,
  or large timestep.

UI implication:

- Keep raw grid, domain, timestep, and frame cadence controls advanced.
- Warn or constrain unsupported configs before presenting them as lab-valid.
- Treat high-resolution, long-runtime, and reduced-stabilizer variants as
  diagnostic/developer evidence, not polished user defaults.

## 10. Conservation And Invariants

Hard invariants:

- Fields remain finite.
- Vapor, cloud water, and rain water remain nonnegative.
- Seeded outputs are reproducible.
- Frame schema remains valid.
- Quiet/no-forcing case remains quiet.
- Dry failed / dry thermal controls do not create meaningful cloud water.

Expected but approximate:

- Velocity remains bounded.
- Temperature perturbation remains bounded.
- Divergence diagnostics remain bounded.
- Cloud water should not persist in clearly subsaturated emitted cells beyond
  documented thresholds.
- Stable/capped profiles should directionally suppress vertical response and
  cloud potential.

Not guaranteed:

- Total water conservation under all processes.
- Energy conservation.
- Quantitative cloud timing.
- Quantitative cloud depth.
- True precipitation behavior.
- True turbulence or entrainment closure.
- Formal convergence.

Water conservation is not guaranteed because the current solver uses explicit
advection/diffusion with edge sampling, saturation adjustment with clipping and
caps, top-sponge relaxation of cloud water, non-evolving rain placeholder, and
diagnostic/heuristic condensation memory. It should keep moisture nonnegative
and qualitatively bounded, but it is not a conservative moist CFD core.

## 11. Validation Map

| Claim protected | Test/report | Type | Hard fail or warning | What it does not prove |
| --- | --- | --- | --- | --- |
| Quiet/no-forcing remains quiet | `test_quiet_boussinesq_reference_case_remains_quiet`, `test_quiet_boussinesq_divergence_and_velocity_stay_below_dimensional_ceilings` | Numerical sanity / validation | Hard fail | Does not validate active-flow realism. |
| Dry thermal rises and stays cloud-free | `test_dry_boussinesq_reference_case_lifts_without_cloud_water`, `test_dry_thermal_bubble_rises_and_stays_cloud_free` | Physics relationship / validation | Hard fail | Does not prove moist cloud placement. |
| Humid lifted thermal forms bounded cloud | `test_isolated_boussinesq_reference_case_creates_bounded_cloud_water` | Scenario/reference validation | Hard fail | Does not prove peak cloud is at BL top; related aloft check remains xfail. |
| Pressure-aware LCL behaves directionally | `test_lcl_diagnostic_returns_plausible_common_values`, `test_higher_rh_produces_lower_lcl_at_same_temperature`, `test_warmer_drier_conditions_raise_lcl_relative_to_humid_baseline` | Thermodynamic diagnostic | Hard fail | Does not make dynamics pressure-aware. |
| Initialized profile reports saturation caps and RH | `test_initialized_profile_reports_pressure_aware_rh_and_saturation_caps` | Diagnostic warning | Hard fail for diagnostic shape | Does not prove profile is physically ideal. |
| Stable/capped suppression relationship holds | `test_lapse_rate_pair_suppresses_vertical_response_and_cloud_potential`, `test_low_strong_cap_suppresses_cloud_development_against_high_weak_cap` | Physics relationship | Hard fail | Does not prove quantitative cap/cloud-top realism. |
| Return-flow/boundary artifacts are classified | `test_cloud_artifact_policy_*` and #157 docs | Diagnostic warning / policy | Warning except large below-LCL fraction can fail | Does not solve artifacts. |
| Long subsaturated cloud-water persistence is bounded | `test_long_two_patch_run_reports_and_limits_subsaturated_cloud_persistence` | Regression / diagnostic warning | Hard fail for regression threshold, warning for return flow | Does not remove return-flow warnings. |
| Resolution/domain/runtime sensitivity is bounded enough for current defaults | `run_lower_atmosphere_sensitivity_validation`, `docs/fair-weather-resolution-domain-sensitivity.md` | Validation / diagnostic warning | Warning-oriented | Does not prove convergence or Green trust. |
| Stabilizer/cap/damping influence is visible | `run_boussinesq_stabilizer_audit`, `docs/boussinesq-stabilizer-audit.md` | Numerical audit / validation | Warn/fail audit status | Does not tune or fix stabilizer-shaped behavior. |
| Dry failed cumulus remains cloud-free | `test_lower_atmosphere_sensitivity_validation_reports_required_matrix` plus scenario diagnostics | Scenario contract | Hard fail for meaningful cloud in dry failed | Does not prove all dry configs are cloud-free. |
| Multi-thermal cloud field forms separated regions for part of run | `test_two_hot_patch_case_keeps_separate_cloud_cells_before_merger`, preset validation | Scenario/reference validation | Hard fail or warning by case | Does not prove final morphology remains separated. |
| Public solver/schema contract remains stable | schema/API/preset tests such as `test_solver_catalog_exposes_available_solver_backends` | Contract | Hard fail | Does not validate science. |

## 12. Current Trust Assessment

Chosen classification:

```text
B. Current solver is acceptable only for prototype/debug use until specific gaps
are closed.
```

More precisely:

`boussinesq_2d` can remain a Yellow-labeled prototype engine for controlled
Lower Atmosphere Cloud Basics experiments because it preserves key invariants,
supports useful directional comparisons, and exposes diagnostic warnings.

It should not be treated as a polished cloud-resolving engine. The #159 audit
shows that the default single-patch baseline reaches the theta perturbation cap
and that damping/diffusion materially shape cloud amount, timing, vertical
development, and cap proximity.

## 13. Green / Yellow / Red Criteria

Green criteria would require evidence that:

- Normal Lower Atmosphere baseline no longer hits theta cap, or cap influence is
  scientifically justified, bounded, and documented.
- Damping/diffusion sensitivity is calibrated and documented.
- Stable/capped relationships pass.
- Humidity and heating relationships pass.
- Cloud onset/base diagnostics are coherent with LCL/profile assumptions.
- Supported resolution/domain/runtime envelope is documented and bounded.
- Return-flow/boundary warnings stay within documented limits.
- Dry/no-forcing/dry-failed invariants hold.
- Solver behavior remains explainable without a growing pile of hidden
  compensating patches.

Yellow criteria:

- Solver remains useful for qualitative Lower Atmosphere experiments.
- Key directional relationships hold.
- Warnings are explicit and surfaced.
- Caps/stabilizers shape behavior but are documented.
- User-facing labels remain honest.
- Future Boussinesq-dependent labs stay prototype-only.

Red triggers:

- Normal scenarios hit multiple safety caps.
- Modest resolution/domain changes flip qualitative outcomes.
- Stability, humidity, or heating relationships fail directionally.
- Cloud water routinely appears in thermodynamically implausible regions.
- Boundary/return-flow artifacts dominate normal runs.
- Stabilizers/damping are shown to create the apparent cloud behavior.
- Repeated patches make the model harder to explain than replace.

## 14. Implications For #160

#160 should evaluate at least:

- Keep `boussinesq_2d` as a Yellow prototype scaffold.
- Recalibrate/refactor current Boussinesq with explicit numerical acceptance
  criteria.
- Design a pseudo-anelastic / anelastic successor core.
- Use prescribed-flow/profile-coupled dynamics for near-term labs.
- Evaluate an external/PDE framework.
- Restrict Boussinesq to prototype/reference visualization while
  non-Boussinesq labs proceed.

#160 should not treat current Boussinesq as a trusted foundation unless it
explains why cap/stabilizer-shaped behavior is acceptable or defines a concrete
refactor/calibration path that removes that concern.

## Required Issue Conclusion

Can `boussinesq_2d` remain the Lower Atmosphere Cloud Basics engine right now?

Yes, but only as a Yellow-labeled prototype engine for controlled qualitative
experiments with visible diagnostics and honest approximation labels.

Can it support polished future Boussinesq-dependent labs right now?

No. The #159 audit shows normal baseline behavior is cap/stabilizer-shaped
enough that polished future cloud-resolving labs should wait for #160's
successor-dynamics decision or an approved targeted refactor/calibration plan.

What must #160 decide?

#160 must decide whether to keep the current solver as a Yellow scaffold,
recalibrate/refactor it under explicit numerical acceptance criteria, design a
pseudo-anelastic or anelastic successor, use prescribed/profile-coupled dynamics
for near-term labs, or evaluate an external/PDE framework.

What should not be done next?

Do not tune presets or constants simply to hide the audit findings. Do not
remove stabilizers blindly. Do not couple advanced microphysics, terrain, rain,
or future polished Boussinesq-dependent labs to this core as if the current
dynamics are already trusted.

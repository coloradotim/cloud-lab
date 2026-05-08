# PySDM Evaluation

This document evaluates PySDM as Cloud Lab's warm-cloud microphysics direction. It
follows the next-core decision in `docs/next-physics-core.md`: evaluate PySDM in
isolation first, and do not couple it to `boussinesq_2d` yet.

## Sources Checked

- PySDM PyPI package pages: <https://pypi.org/project/pysdm/>
- PySDM API documentation: <https://open-atmos.github.io/PySDM/PySDM.html>
- PySDM examples documentation: <https://open-atmos.github.io/PySDM/PySDM_examples.html>

## Summary Recommendation

Partially adopt PySDM as an optional evaluation dependency for an isolated
`microphysics_lab` path.

Do not make PySDM a required backend dependency yet, and do not integrate it into
`boussinesq_2d` now. PySDM is promising for droplet-size distributions,
condensational growth, collision/coalescence, and rain-initiation experiments, but it
has a large dependency footprint and its GPLv3 license needs an explicit project
decision before any production coupling.

## Architecture Findings

PySDM represents warm-cloud microphysics through super-droplets. A small number of
computational particles carry multiplicity and physical attributes such as wet volume,
dry volume, and hygroscopicity-related quantities. A `Builder` assembles:

- a backend, such as CPU/Numba
- an environment, such as box, parcel, single-column, or prescribed-flow
- dynamics, such as condensation or coalescence
- products, such as water mixing ratio, concentration, effective radius, parcel
  displacement, or size spectra

The main runnable object is a particulator. It owns state, advances with `run(...)`,
and exposes products through named product objects.

The PySDM examples ecosystem already includes the modes Cloud Lab cares about:

- 0-D box
- 0-D parcel
- 1-D prescribed-flow single column
- 2-D prescribed-flow kinematic examples

That shape fits the `microphysics_lab` direction better than direct coupling to the
current Boussinesq prototype.

## Isolated Prototype

The repo now includes an optional smoke prototype:

```bash
cd backend
python -m pip install -e ".[pysdm-eval]"
python -m app.sim.pysdm_evaluation --json
```

The prototype runs a tiny 0-D PySDM box coalescence case:

- `128` super-droplets
- `1 s` timestep
- Golovin coalescence kernel
- logarithmic radius bins from `10 um` to `1000 um`
- output snapshots at `0`, `10`, `20`, and `60` simulated seconds

It returns:

- PySDM version
- elapsed runtime
- radius-bin edges
- per-snapshot particle-volume spectrum
- bulk total particle volume
- peak bin value
- a simple rain-indicator fraction for bins at or above `40 um`

Observed local result on a MacBook Air:

- PySDM version: `2.131`
- smoke runtime after install: about `1.7-1.9 s`
- first import/install path triggered Numba compilation and an ARM64 warning that
  Numba threading is disabled on ARM64 because atomics do not work yet
- seeded distribution output was reproducible in repeated runs
- total particle volume stayed effectively conserved over the short coalescence-only
  smoke case
- the rain-indicator fraction increased from about `0.255` to about `0.287`

This is not yet a parcel condensation demonstration. It is a minimal real-PySDM
exercise proving that Cloud Lab can run PySDM, extract a droplet-size distribution,
and map distribution-derived quantities into Cloud Lab-style diagnostics without
touching production solvers.

## Mapping To Cloud Lab Concepts

| Cloud Lab concept | PySDM mapping direction |
| --- | --- |
| Water vapor | Use environment/product water-vapor or mixing-ratio products in parcel/column modes. |
| Cloud liquid water | Use water mixing ratio over cloud-size radius ranges. |
| Rain water | Use water mixing ratio over rain-size radius ranges or a thresholded radius product. |
| Droplet-size distribution | Use size-spectral products such as particle volume versus radius-log bins. |
| Rain initiation | Track growth of large-radius-bin mass, collision/coalescence products, and threshold crossing. |
| Renderer inputs | Convert PySDM products into physical fields or run-level products; renderer stays separate. |

The current `SimulationFrame` scalar fields can carry bulk vapor/cloud/rain values,
but droplet-size distributions need a schema extension. The proposed Cloud Lab
abstraction is documented in `docs/microphysics-schema.md`: optional microphysics
payloads with bin-axis metadata, global/probe distributions, compact cell summaries,
and explicit radius thresholds for cloud/rain aggregate fields.

This should be added deliberately rather than squeezed into the existing scalar grid
contract or exposed as PySDM-specific frontend data.

## Dependency And License Findings

PySDM installation pulled in a broad dependency tree, including:

- NumPy
- SciPy
- Numba / llvmlite
- Pint
- chempy
- pyevtk
- ThrustRTC
- CURandRTC
- matplotlib
- Jupyter/notebook-related transitive dependencies through chempy/pyodesys

PySDM's package metadata and documentation identify it as GPLv3. That is a major
project-level consideration. Keeping PySDM optional and isolated avoids forcing a
license decision onto the default Cloud Lab backend while evaluation continues.

## Runtime And CI Classification

PySDM should be treated as optional and science-heavy:

- do not install it in default backend CI yet
- do not make PySDM tests part of the default fast PR path
- use the `pysdm` marker for optional PySDM checks
- run longer parcel/column/coalescence tests manually or in a separate science job
- keep `educational_2d` and `boussinesq_2d` free of PySDM imports

The current smoke test is marked `pysdm` and `science`. It skips cleanly when PySDM is
not installed.

## Why Not Couple To Boussinesq Yet

PySDM improves particle microphysics. It does not fix the current unresolved
Boussinesq questions:

- thermodynamic placement of cloud water
- entrainment behavior
- pressure-coupled dynamics
- boundary-condition realism
- turbulence closure
- vertical transport limitations

Coupling now would make failures difficult to interpret because a bad cloud outcome
could come from dynamics, microphysics, schema mapping, or visualization. Isolated
microphysics-lab cases keep the evaluation scientifically readable.

## Strengths

- Strong conceptual fit for warm-cloud droplet and rain processes.
- Existing examples cover box, parcel, column, and prescribed-flow modes.
- Product API can expose size spectra and bulk microphysics quantities.
- Optional smoke prototype ran locally and reproducibly.
- Good match for future droplet-size visualization and optics work.

## Limitations And Risks

- GPLv3 licensing may affect how Cloud Lab can distribute or couple the dependency.
- Dependency footprint is large for a local-first app.
- First import/JIT behavior can affect perceived runtime.
- ARM64 Numba threading warning indicates Mac performance needs explicit testing.
- Example ecosystem is notebook-heavy and may not map directly to production code.
- Droplet distributions require schema evolution.
- Coupled dynamics/microphysics failures would be hard to interpret without isolated
  validation first.

## Follow-On Implementation Issues

Create or update issues for:

- Add `microphysics_lab` solver descriptor and backend scaffold.
- Add a parcel-ascent PySDM prototype with condensation growth.
- Add a prescribed-flow or single-column PySDM prototype.
- Implement the droplet-size distribution schema proposed in `docs/microphysics-schema.md`.
- Add optional science CI or manual workflow for PySDM tests.
- Audit GPLv3 implications before production dependency adoption.
- Compare Cloud Lab saturation adjustment against PySDM parcel outputs.

## Current Decision

PySDM should remain optional and isolated while Cloud Lab builds a
`microphysics_lab` path. It is promising enough to continue, but not ready to become a
required dependency or a direct `boussinesq_2d` microphysics module.

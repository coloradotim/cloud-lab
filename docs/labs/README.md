# Cloud Lab Lab Specs

This directory contains dedicated specs for each Cloud Lab phenomenon lab.

Each lab spec should follow `docs/lab-contract-template.md` and the process in `docs/lab-development-process.md`.

## Current planned lab sequence

| Order | Spec | User-facing lab name | Status |
| --- | --- | --- | --- |
| 1 | `fair-weather-cumulus.md` | Fair-Weather Cumulus | prototype / first reference lab |
| 2 | `cloud-optics-beauty.md` | Clouds, Light, and Shadow | concept / spec created |
| 3 | `evolving-boundary-layer.md` | Evolving Boundary Layer | planned |
| 4 | `layered-atmosphere.md` | Layered Atmosphere | planned |
| 5 | `orographic-terrain-clouds.md` | Orographic / Terrain Clouds | planned |
| 6 | `warm-rain-droplet-growth.md` | Warm Rain / Droplet Growth | planned |
| 7 | `fog-stratus.md` | Fog / Stratus | planned |
| 8 | `mixed-phase-ice.md` | Mixed-Phase / Ice | planned |
| 9 | future spec TBD | Higher-fidelity / hard-core modeling path | future |

## Rule

Do not add a new lab implementation issue until the corresponding lab spec exists or the implementation issue explicitly creates that lab spec first.

A lab spec should define:

- physical question
- user promise
- concepts taught
- controls
- initial conditions and forcing
- expected behavior
- diagnostics
- visualization modes
- physics-core requirements
- schema requirements
- approximation labels
- built-in scenarios
- validation expectations
- known limitations
- future upgrades

## Current priority

The current implementation phase is Workbench V2 plus the Fair-Weather Cumulus reference lab. See `docs/current-phase-plan.md`.

Clouds, Light, and Shadow now has a concept-level lab spec. Implementation should wait until the Fair-Weather Cumulus reference flow is usable enough to support the next lab cleanly, unless the team intentionally pulls optics/renderer work forward.

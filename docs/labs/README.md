# Cloud Lab Lab Specs

This directory contains dedicated specs for each Cloud Lab phenomenon lab.

Each lab spec should follow `docs/lab-contract-template.md` and the process in `docs/lab-development-process.md`.

## Current planned lab sequence

| Order | Spec | User-facing lab name | Status |
| --- | --- | --- | --- |
| 1 | `lower-atmosphere-cloud-basics.md` | Lower Atmosphere Cloud Basics | prototype / first reference lab |
| 2 | `cloud-optics-beauty.md` | Clouds, Light, and Shadow | concept / static optics lab prototype |
| 3 | `evolving-boundary-layer.md` | Evolving Boundary Layer | concept / spec created |
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

The current implementation phase is Workbench V2 plus the Lower Atmosphere Cloud Basics reference lab. Fair-weather cumulus is a scenario family inside that lab. See `docs/current-phase-plan.md`.

Clouds, Light, and Shadow now has a concept-level lab spec, static Workbench V2 optics flow, deterministic preset source scenes, semantic sun/camera controls, and a first lightweight rendered/science-view experience.

Evolving Boundary Layer now has a concept-level lab spec. It is designed as a standalone 1-D profile-evolution lab that diagnoses cloud formation potential without producing cloud water in v1. Implementation should wait until the spec and follow-on issue split are reviewed.

# Cloud Lab Lab Specs

This directory contains dedicated specs for each Cloud Lab phenomenon lab.

Each lab spec should follow `docs/lab-contract-template.md` and the process in `docs/lab-development-process.md`.

## Current planned lab sequence

| Order | Spec | User-facing lab name | Status |
| --- | --- | --- | --- |
| 1 | `lower-atmosphere-cloud-basics.md` | Lower Atmosphere Cloud Basics | prototype / first reference lab |
| 2 | `cloud-optics-beauty.md` | Clouds, Light, and Shadow | concept / static optics lab prototype |
| 3 | `evolving-boundary-layer.md` | Evolving Boundary Layer | prototype / Workbench V2 profile lab v1 |
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

The current implementation phase is Workbench V2 plus the first usable lower-atmosphere
labs. Fair-weather cumulus is a scenario family inside Lower Atmosphere Cloud
Basics. Evolving Boundary Layer v1 now exposes the standalone `boundary_layer_1d`
profile path in Workbench V2. See `docs/current-phase-plan.md`.

Clouds, Light, and Shadow now has a concept-level lab spec, static Workbench V2 optics flow, deterministic preset source scenes, semantic sun/camera controls, and a first lightweight rendered/science-view experience.

Evolving Boundary Layer now has a Workbench V2 v1 profile workbench around the
standalone backend profile model, `boundary_layer_1d`, documented in
`docs/boundary-layer-1d.md`. It supports scenario selection, profile controls,
profile/sounding visualization, timeline replay, and deterministic cloud
formation potential diagnostics without producing cloud water in v1.

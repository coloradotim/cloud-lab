# Cloud Lab Lab Specs

This directory contains dedicated specs for each Cloud Lab phenomenon lab.

Each lab spec should follow `docs/lab-contract-template.md` and the process in `docs/lab-development-process.md`.

## Current planned lab sequence

1. `fair-weather-cumulus.md`
2. `cloud-optics-beauty.md`
3. `evolving-boundary-layer.md`
4. `layered-atmosphere.md`
5. `orographic-terrain-clouds.md`
6. `warm-rain-droplet-growth.md`
7. `fog-stratus.md`
8. `mixed-phase-ice.md`
9. Future hard-core modeling / higher-fidelity core path, likely documented separately once the earlier labs establish requirements

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

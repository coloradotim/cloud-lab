# Lower Atmosphere Cloud Basics Resolution / Domain Sensitivity

Issue: #158

This report documents resolution, physical-domain, and runtime sensitivity for
the Lower Atmosphere Cloud Basics fair-weather scenario family. The filename is
kept for continuity with the original issue title; the user-facing lab name is
Lower Atmosphere Cloud Basics, and fair-weather cumulus is a scenario family
inside that lab.

This validation is diagnostic. It does not change solver physics, scenario
presets, UI defaults, renderer thresholds, or the `boussinesq_2d` Yellow trust
status.

## Matrix

Scenarios:

- `fair-weather-moderate-base`: baseline shallow cloud, single heated patch
- `dry-failed-cumulus`: buoyant motion without meaningful condensate
- `dry-cap-suppressed-cumulus`: capped / suppressed cloud case after #156

Axes are varied separately:

- resolution: low `30 x 20`, medium `36 x 24`, high `54 x 36`
- domain: smaller / shallower `8 km x 2.5 km`, default `10 km x 3 km`, wider /
  taller `12 km x 4 km`
- runtime: short `600 s`, standard `1200 s`, long `1800 s`

Short runtime is diagnostic-only for the cloud-forming baseline because it may
end before delayed cloud onset. It is not part of the recommended supported
envelope for proving cloud formation.

## Command

```bash
cd backend
.venv/bin/python -m app.sim.validation --sensitivity --json
```

The validation surface reports:

- first cloud time and height
- expected LCL
- cloud base and top
- max updraft
- integrated and maximum cloud water
- boundary cloud fraction
- return-flow cloud fraction
- below / near / above LCL cloud-water fractions
- qualitative scenario status and diagnostic notes

## Results

All 27 matrix cells completed with finite fields and no hard validation failure.
Every case reports `warn` status because `boussinesq_2d` remains Yellow and the
thermodynamic diagnostics intentionally surface prototype caveats.

| Scenario | Axis | Variant | Supported? | First cloud | Cloud base | Cloud top | Max cloud | Total cloud | Max updraft | Return-flow cloud | Read |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Baseline shallow cloud | Resolution | Low | yes | 1050 s | 675 m | 675 m | 1.69e-05 | 1.69e-05 | 0.43 | 0.00 | Cloud-forming, weaker/sparser than default. |
| Baseline shallow cloud | Resolution | Medium | yes | 840 s | 688 m | 812 m | 7.92e-05 | 1.36e-04 | 1.06 | 0.00 | Default supported reference. |
| Baseline shallow cloud | Resolution | High | yes | 660 s | 542 m | 875 m | 4.94e-04 | 1.89e-03 | 1.61 | 0.20 | Cloud-forming, but materially stronger and return-flow warned. |
| Baseline shallow cloud | Domain | Smaller / shallower | yes | 900 s | 573 m | 781 m | 4.06e-05 | 1.28e-04 | 1.28 | 0.39 | Cloud-forming, but return-flow warned; use cautiously. |
| Baseline shallow cloud | Domain | Default | yes | 840 s | 688 m | 812 m | 7.92e-05 | 1.36e-04 | 1.06 | 0.00 | Default supported reference. |
| Baseline shallow cloud | Domain | Wider / taller | yes | 840 s | 750 m | 917 m | 2.98e-05 | 5.74e-05 | 1.02 | 0.00 | Cloud-forming, weaker but qualitatively stable. |
| Baseline shallow cloud | Runtime | Short | no | none | none | none | 0.00e+00 | 0.00e+00 | 0.21 | 0.00 | Diagnostic-only; too short for delayed cloud promise. |
| Baseline shallow cloud | Runtime | Standard | yes | 840 s | 688 m | 812 m | 7.92e-05 | 1.36e-04 | 1.06 | 0.00 | Default supported reference. |
| Baseline shallow cloud | Runtime | Long | yes | 840 s | 312 m | 1188 m | 1.11e-03 | 7.06e-03 | 1.56 | 0.00 | Cloud-forming, much stronger/deeper; artifact policy warns. |
| Dry failed cumulus | Resolution | Low | yes | none | none | none | 0.00e+00 | 0.00e+00 | 0.11 | 0.00 | Cloud-free with thermal motion. |
| Dry failed cumulus | Resolution | Medium | yes | none | none | none | 0.00e+00 | 0.00e+00 | 0.20 | 0.00 | Cloud-free with thermal motion. |
| Dry failed cumulus | Resolution | High | yes | none | none | none | 0.00e+00 | 0.00e+00 | 0.37 | 0.00 | Cloud-free with stronger resolved motion. |
| Dry failed cumulus | Domain | Smaller / shallower | yes | none | none | none | 0.00e+00 | 0.00e+00 | 0.22 | 0.00 | Cloud-free with thermal motion. |
| Dry failed cumulus | Domain | Default | yes | none | none | none | 0.00e+00 | 0.00e+00 | 0.20 | 0.00 | Default supported reference. |
| Dry failed cumulus | Domain | Wider / taller | yes | none | none | none | 0.00e+00 | 0.00e+00 | 0.17 | 0.00 | Cloud-free with thermal motion. |
| Dry failed cumulus | Runtime | Short | no | none | none | none | 0.00e+00 | 0.00e+00 | 0.08 | 0.00 | Diagnostic-only; cloud-free but shorter than supported envelope. |
| Dry failed cumulus | Runtime | Standard | yes | none | none | none | 0.00e+00 | 0.00e+00 | 0.20 | 0.00 | Default supported reference. |
| Dry failed cumulus | Runtime | Long | yes | none | none | none | 0.00e+00 | 0.00e+00 | 0.30 | 0.00 | Cloud-free with stronger motion. |
| Capped / suppressed cloud | Resolution | Low | yes | none | none | none | 0.00e+00 | 0.00e+00 | 0.18 | 0.00 | Fully suppressed. |
| Capped / suppressed cloud | Resolution | Medium | yes | none | none | none | 0.00e+00 | 0.00e+00 | 0.35 | 0.00 | Fully suppressed. |
| Capped / suppressed cloud | Resolution | High | yes | none | none | none | 0.00e+00 | 0.00e+00 | 0.53 | 0.00 | Fully suppressed with stronger motion. |
| Capped / suppressed cloud | Domain | Smaller / shallower | yes | none | none | none | 0.00e+00 | 0.00e+00 | 0.37 | 0.00 | Fully suppressed. |
| Capped / suppressed cloud | Domain | Default | yes | none | none | none | 0.00e+00 | 0.00e+00 | 0.35 | 0.00 | Default supported reference. |
| Capped / suppressed cloud | Domain | Wider / taller | yes | none | none | none | 0.00e+00 | 0.00e+00 | 0.30 | 0.00 | Fully suppressed. |
| Capped / suppressed cloud | Runtime | Short | no | none | none | none | 0.00e+00 | 0.00e+00 | 0.12 | 0.00 | Diagnostic-only; shorter than supported envelope. |
| Capped / suppressed cloud | Runtime | Standard | yes | none | none | none | 0.00e+00 | 0.00e+00 | 0.35 | 0.00 | Default supported reference. |
| Capped / suppressed cloud | Runtime | Long | yes | none | none | none | 0.00e+00 | 0.00e+00 | 0.99 | 0.00 | Fully suppressed, but motion strengthens over longer runtime. |

## Supported Envelope

Recommended supported ranges for Lower Atmosphere Cloud Basics with the current
`boussinesq_2d` prototype:

| Control | Supported range | Notes |
| --- | --- | --- |
| Resolution | `30 x 20` through `54 x 36` | Qualitative outcomes are stable, but cloud amount and updraft strength are resolution-sensitive. High resolution should remain an advanced/local inspection option. |
| Domain | `8 km x 2.5 km` through `12 km x 4 km` | Qualitative outcomes are stable. Smaller/shallower baseline runs can trigger return-flow warnings and should be interpreted cautiously. |
| Runtime | `1200 s` through `1800 s` for cloud-forming scenarios | `600 s` is too short to prove delayed cloud formation in the baseline. It remains useful for quick motion checks and dry/suppressed diagnostics. |

## Interpretation

The matrix supports keeping the default medium `10 km x 3 km`, `36 x 24`,
`1200 s` configuration as the public default.

The baseline shallow-cloud scenario remains qualitatively cloud-forming across
supported resolution and domain variants. Dry failed remains cloud-free across
the matrix. The capped/suppressed scenario remains fully suppressed across the
matrix.

The current evidence does not support calling the solver Green:

- high-resolution baseline runs form earlier, stronger, deeper cloud and trigger
  return-flow warnings
- smaller/shallower baseline runs trigger return-flow warnings
- long baseline runtime produces much more cloud water and a lower cloud base,
  with artifact-policy warnings
- all cases keep thermodynamic Yellow warnings visible

These findings are sensitivity evidence, not a request to tune scenarios inside
#158.

## UI Default Recommendation

No immediate UI default change is required.

Keep:

- default resolution: `36 x 24`
- default domain: `10 km x 3 km`
- default runtime: `1200 s`

UI copy and docs should continue treating Low / Medium / High model size as
convenience presets, while keeping raw resolution, domain, and runtime controls
advanced. Short runtime should not be described as sufficient to validate the
baseline shallow-cloud outcome.

## Follow-Up Ownership

- #159 should own whether stabilizers, damping, diffusion, or sponge behavior
  drive the high-resolution / long-runtime sensitivity.
- #160 should own successor dynamics decisions if the Yellow status remains too
  limiting for polished cloud-resolving labs.
- A future product/control issue may add user-facing copy that marks short
  runtime as quick-look/diagnostic rather than proof of cloud formation.

## Non-Changes

- No solver physics changed.
- No scenario defaults changed.
- No UI defaults changed.
- No renderer masking or hiding changed.
- No Lower Atmosphere Cloud Basics naming changed.

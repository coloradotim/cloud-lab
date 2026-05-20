# CM1 Lower-Atmosphere Validation Matrix

Issue: #234

This document defines the first curated CM1 validation matrix for Lower
Atmosphere Cloud Basics experiment controls.

It is a design/spec document. It does not run CM1, add CM1 case configs,
commit CM1 output, tune CM1 physics, change reduced-model science, change
Boussinesq behavior, or implement UI warnings.

## Purpose

CM1 is Cloud Lab's lower-atmosphere reference and validation backbone. The
user-facing product should still feel like a guided cloud experiment, not a CM1
comparison tool.

The validation matrix answers:

```text
For the controls users can adjust, where does the simplified model agree with
CM1 on cloud timing, cloud base/top, and cloud outcome?

Where does it disagree?

Where are results validated, exploratory, or outside the tested reference
space?
```

The matrix should support this product path:

```text
real local CM1 output
  ->
reference-run-v1 / reference-frame-v1
  ->
2-D scientific replay and appearance view
  ->
reduced-model/reference diagnostic comparison
  ->
validated-range labels for user controls
```

## User-Facing Control Axes

The first validation matrix should focus on controls users can understand and
meaningfully tweak:

| Control axis | User-facing meaning | Primary diagnostics to validate | Notes |
| --- | --- | --- | --- |
| Low-level moisture | How much water vapor is available near the ground. | LCL/cloud base, first cloud time, cloud/no-cloud, max cloud water. | First priority because it separates dry failed, baseline, humid low cloud, and fog/stratus-like behavior. |
| Surface heating | How strongly the ground warms and drives boundary-layer motion. | first cloud time, max updraft, cloud depth, cloud/no-cloud threshold. | Should be a physical control; avoid exposing raw CM1 flux parameters to users. |
| Cap strength / stability | How hard it is for rising air to grow upward. | cloud top, cloud-top/cap relationship, suppression/delay, max cloud water. | Needed for capped/suppressed experiments and validated out-of-range warnings. |
| Dry air aloft / entrainment environment | How easily drier air above erodes cloud. | cloud lifetime, cloud top, evaporating/short-lived cloud outcome, max cloud water. | Needed to explain cloud forms but fades, and why exact morphology is not pass/fail. |

Lift strength should not be a primary user control in this matrix. It is useful
internally for the reduced model, but it feels derived/fake to users and should
remain framed as prescribed or diagnostic rather than a first-class experiment
knob.

Users should not directly tweak CM1 namelist values or raw CM1 parameters. CM1
case configs should map from these semantic experiment axes through documented
case assets and manifests.

## Validation Phases

The matrix is staged to avoid an unbounded factorial while still validating
real user decisions.

### Phase A: Existing Anchor Cases

These are already generated/accepted as the first real local reference pair.
That acceptance proved the local CM1 run/ingest/replay workflow and broad dry
versus cloudy regimes. It is now provisional for product-valid visual
validation because those outputs used the old 120 km / 2 km-grid configuration.
The committed Phase A/B case assets now use the #254 cloud-scale policy
(`16 km x 16 km`, `200 m` horizontal spacing, `6 km` vertical domain), and Phase
A should be rerun and re-inspected under that policy before it is treated as
final cloud-scale visual validation.

| Case id | Experiment served | Controls represented | Expected regime | Validation status |
| --- | --- | --- | --- | --- |
| `cm1-dry-failed-cumulus-v1` | Dry failed cumulus | low moisture, baseline heating, baseline cap/dry-air context | motion without meaningful cloud | workflow/provisional accepted |
| `cm1-shallow-cumulus-baseline-v1` | Baseline shallow cloud | baseline moisture, baseline heating, baseline cap/dry-air context | shallow cumulus forms | workflow/provisional accepted |

Phase A anchors the first binary contrast:

```text
similar lower-atmosphere setup
  ->
dry case stays cloud-free
  ->
moister case forms shallow cumulus
```

### Phase B: Immediate Missing Anchors

Phase B should add missing validation anchors for user-facing experiments, not
just more visuals.

| Case id | Experiment served | Controls represented | Expected regime | Priority | Validation status |
| --- | --- | --- | --- | --- | --- |
| `cm1-capped-suppressed-cumulus-v1` | Capped / suppressed cloud | baseline moisture, baseline or moderate heating, stronger cap/stability | cloud delayed, shallow, capped, or suppressed | immediate | planned |
| `cm1-humid-low-cloud-contrast-v1` | Humid low-cloud contrast | high low-level moisture, moderate heating, baseline/weak cap | lower cloud base, easier cloud formation | immediate | planned |
| `cm1-low-stratus-develops-v1` | Low-cloud / fog-like contrast | very high near-surface moisture, weak heating or cooling/near-saturation setup, shallow stable layer | low stratus-like low cloud develops | immediate | planned |

The fog/low-stratus anchor is intentionally early. Cloud Lab needs to validate
low-cloud behavior and not only fair-weather cumulus. #223 chooses the low
stratus name because the committed first-pass setup is weak-heating and shallow
stable-layer driven, not a full radiative-cooling fog design.

### Phase C: One-Factor Sensitivity Sweeps Around Baseline

Do not start Phase C from the old 120 km / 2 km-grid setup. Phase C depends on
cloud-scale Phase A/B case configs and at least a rerun/reinspection decision
for the cloud-scale shallow-cumulus baseline. Sensitivity sweeps should inherit
the #254 cloud-scale policy unless a specific exception is documented in the
case manifest and validation report.

Phase C validates directional trends around the accepted shallow-cumulus
baseline without requiring a full `3^4` factorial.

Use a curated one-factor-at-a-time batch:

| Axis | Cases | Intended validation |
| --- | --- | --- |
| Low-level moisture | low moisture / baseline moisture / high moisture | Cloud base lowers and first cloud time generally moves earlier as moisture increases; low moisture can fail. |
| Surface heating | weak heating / baseline heating / strong heating | Updraft and first cloud timing respond directionally; strong heating may deepen cloud. |
| Cap strength / stability | weak cap / baseline cap / strong cap | Cloud top and cloud depth respond directionally; strong cap suppresses or limits cloud. |
| Dry air aloft | less dry aloft / baseline dry aloft / more dry aloft | Cloud persistence and depth respond directionally; drier air aloft can erode or shorten cloud. |

Recommended first curated Phase C batch:

| Case id | Axis | Relation to baseline | Expected regime | Validation status |
| --- | --- | --- | --- | --- |
| `cm1-baseline-low-moisture-v1` | low-level moisture | drier than baseline but not as dry as dry-failed | barely cloud-free or delayed/weak cloud | planned |
| `cm1-baseline-high-moisture-v1` | low-level moisture | moister than baseline but less extreme than humid-low-cloud | lower cloud base / earlier cloud | planned |
| `cm1-baseline-weak-heating-v1` | surface heating | weaker heating than baseline | delayed or weaker cloud | planned |
| `cm1-baseline-strong-heating-v1` | surface heating | stronger heating than baseline | earlier/stronger updraft, possibly deeper cloud | planned |
| `cm1-baseline-weak-cap-v1` | cap/stability | weaker cap than baseline | deeper cloud or higher cloud top | planned |
| `cm1-baseline-strong-cap-v1` | cap/stability | stronger cap than baseline | shallower/capped cloud or suppression | planned |
| `cm1-baseline-less-dry-aloft-v1` | dry air aloft | less dry entrainment environment | longer-lived or deeper cloud | planned |
| `cm1-baseline-more-dry-aloft-v1` | dry air aloft | more dry entrainment environment | shorter-lived or evaporating cloud | planned |

This gives the app directional validation coverage without exploding run count.
Add paired/sparse combinations only after these one-factor checks are ingested
and accepted.

### Phase D: Boundary Cases

Phase D should target threshold behavior. These cases are valuable for
validated-range warnings because they show where a small control change flips
the teaching outcome.

| Case id | Boundary type | Expected regime | Validation status |
| --- | --- | --- | --- |
| `cm1-threshold-barely-cloud-free-v1` | cloud/no-cloud threshold | motion and near-saturation but no meaningful cloud | planned |
| `cm1-threshold-barely-cloud-forming-v1` | cloud/no-cloud threshold | first weak cloud appears near threshold | planned |
| `cm1-cloud-forms-evaporates-quickly-v1` | entrainment/lifetime threshold | cloud forms then dissipates quickly | planned |
| `cm1-shallow-cloud-capped-threshold-v1` | cap-depth threshold | cloud forms but remains shallow below cap | planned |

### Phase E: Rain Later

Defer rain validation until the warm-cloud regime and non-rain shallow-cloud
cases are well characterized.

| Case id | Experiment served | Expected regime | Validation status |
| --- | --- | --- | --- |
| `cm1-cloud-no-rain-v1` | warm-cloud no-rain control | cloud forms without rain onset | later |
| `cm1-warm-rain-shallow-cloud-v1` | warm rain / droplet growth | cloud water transitions to rain water | later |
| `cm1-rain-evaporates-below-cloud-base-v1` | rain evaporation / virga-like contrast | rain appears aloft and evaporates below cloud base | later |

## Validation Metrics

Every CM1 validation case should eventually be tracked with these fields:

| Metric | Meaning | Agreement target |
| --- | --- | --- |
| `case_id` | Stable reference case id. | exact |
| `experiment_served` | User-facing Lower Atmosphere experiment/scenario. | exact |
| `user_facing_controls_represented` | Semantic control-axis values represented by the case. | exact |
| `expected_regime` | Planned qualitative regime before CM1 output is generated. | exact as planned label |
| `cm1_observed_regime` | Regime after real output inspection. | accepted or needs calibration |
| `simplified_model_expected_regime` | Reduced-model outcome expected for comparable user controls. | qualitative |
| `cloud_no_cloud_outcome` | Cloud formed, dry failed, suppressed, fog/stratus, rain later, etc. | required regime agreement |
| `first_cloud_time_seconds` | First meaningful cloud-water time. | approximate / directionally useful |
| `cloud_base_m` | Diagnosed cloud-base height. | approximate / directionally useful |
| `cloud_top_m` | Diagnosed cloud-top height. | approximate / directionally useful |
| `max_cloud_liquid_water_kg_per_kg` | Max cloud-water field value. | teaching diagnostic, not calibration target |
| `max_updraft_m_per_s` | Max vertical velocity. | teaching diagnostic, not exact target |
| `rain_onset_seconds` | First meaningful rain-water time, if applicable. | later / approximate |
| `agreement_target` | exact, approximate, or qualitative. | exact value from policy |
| `validation_status` | planned, generated, ingested, accepted, needs calibration. | exact |
| `notes` | Known limitations, source/manifests, inspection comments. | narrative |

## Initial Matrix

| Phase | Case id | Experiment served | Controls represented | Expected regime | CM1 observed regime | Simplified model expected regime | Cloud outcome | First cloud time | Cloud base | Cloud top | Max cloud water | Max updraft | Rain onset | Agreement target | Validation status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A | `cm1-dry-failed-cumulus-v1` | Dry failed cumulus | low moisture; baseline heating; baseline cap; dry aloft | motion without meaningful cloud | dry failed / no meaningful cloud | dry failed | no cloud | unavailable | unavailable | unavailable | 0.00 kg/kg observed in old acceptance | 0.558 m/s observed in old acceptance | unavailable | qualitative regime; diagnostics plausible | accepted_workflow_provisional | Existing real local output accepted in #221 using old 120 km / 2 km-grid setup; rerun with #254 cloud-scale config before final visual validation. |
| A | `cm1-shallow-cumulus-baseline-v1` | Baseline shallow cloud | baseline moisture; baseline heating; baseline cap; dry aloft | shallow cumulus forms | cloud formed | cloud formed | cloud | 600 s observed in old acceptance | 1250 m observed | 4250 m observed | 0.00191 kg/kg observed | 6.56 m/s observed | 1800 s observed | qualitative regime; timing/base/top approximate | accepted_workflow_provisional | Existing real local output accepted in #221 using old 120 km / 2 km-grid setup; rerun with #254 cloud-scale config before final visual validation. |
| B | `cm1-capped-suppressed-cumulus-v1` | Capped / suppressed cloud | baseline moisture; baseline/moderate heating; strong cap | delayed/shallow/capped or suppressed cloud | TBD | capped/suppressed | delayed/capped/suppressed | TBD | TBD | below/near cap | TBD | TBD | unavailable unless produced | regime required; cap relationship approximate | planned | #223 commits case assets/manifests/run hooks; real output still must be generated, ingested, and inspected. |
| B | `cm1-humid-low-cloud-contrast-v1` | Humid low-cloud contrast | high low-level moisture; moderate heating; baseline/weak cap | low-base cloud forms more easily | TBD | low-base cloud favorable | cloud | TBD, likely earlier than baseline | lower than baseline | TBD | TBD | TBD | TBD | regime required; base/timing approximate | planned | #223 commits case assets/manifests/run hooks; real output still must be generated, ingested, and inspected. |
| B | `cm1-low-stratus-develops-v1` | Low-cloud / fog-like contrast | very high near-surface moisture; weak heating or near-saturation/cooling setup; shallow stable layer | low stratus-like low cloud | TBD | low-cloud favorable | low cloud/stratus | TBD | near surface / very low | shallow | TBD | weak to moderate | likely unavailable | regime required; low-cloud base/top approximate | planned | #223 chose low stratus because the committed setup is weak-heating/stable-layer, not a full radiative-cooling fog design. Real output still must be generated, ingested, and inspected. |
| C | `cm1-baseline-low-moisture-v1` | Moisture sensitivity | low moisture, baseline other axes | delayed/weak cloud or near failure | TBD | weaker cloud tendency | TBD | later or unavailable | higher than baseline | lower/shallower | lower | TBD | unavailable | directional | planned | One-factor moisture sweep. |
| C | `cm1-baseline-high-moisture-v1` | Moisture sensitivity | high moisture, baseline other axes | earlier/lower cloud | TBD | stronger cloud tendency | cloud | earlier than baseline | lower than baseline | TBD | higher or comparable | TBD | TBD | directional | planned | One-factor moisture sweep. |
| C | `cm1-baseline-weak-heating-v1` | Heating sensitivity | weak heating, baseline other axes | delayed/weaker cloud | TBD | weaker/delayed cloud | TBD | later | TBD | lower/shallower | lower | lower | unavailable | directional | planned | One-factor heating sweep. |
| C | `cm1-baseline-strong-heating-v1` | Heating sensitivity | strong heating, baseline other axes | earlier/stronger updraft, possibly deeper cloud | TBD | earlier/stronger cloud tendency | cloud | earlier | TBD | higher or deeper | higher or comparable | higher | TBD | directional | planned | One-factor heating sweep. |
| C | `cm1-baseline-weak-cap-v1` | Cap/stability sensitivity | weak cap, baseline other axes | deeper cloud or higher cloud top | TBD | deeper cloud favorable | cloud | comparable/earlier | TBD | higher | TBD | TBD | TBD | directional | planned | One-factor cap sweep. |
| C | `cm1-baseline-strong-cap-v1` | Cap/stability sensitivity | strong cap, baseline other axes | capped/shallow/suppressed cloud | TBD | capped/suppressed | capped/suppressed | later/unavailable | TBD | below cap | lower | TBD | unavailable | directional | planned | May overlap Phase B cap anchor; keep Phase B as named user experiment. |
| C | `cm1-baseline-less-dry-aloft-v1` | Entrainment sensitivity | less dry air aloft, baseline other axes | longer-lived/deeper cloud | TBD | longer-lived cloud | cloud | comparable | TBD | higher/deeper | higher or sustained | TBD | TBD | directional | planned | One-factor entrainment environment sweep. |
| C | `cm1-baseline-more-dry-aloft-v1` | Entrainment sensitivity | more dry air aloft, baseline other axes | shorter-lived or evaporating cloud | TBD | cloud erodes faster | cloud forms then weakens | comparable/later | TBD | lower/shallower | lower | TBD | unavailable | directional | planned | One-factor entrainment environment sweep. |
| D | `cm1-threshold-barely-cloud-free-v1` | Threshold/no-cloud boundary | near-threshold moisture/heating/stability | barely cloud-free | TBD | near-threshold dry failed | no cloud | unavailable | unavailable | unavailable | near zero | TBD | unavailable | qualitative threshold | planned | Useful for validated-range warnings. |
| D | `cm1-threshold-barely-cloud-forming-v1` | Threshold/cloud boundary | near-threshold moisture/heating/stability | weak cloud barely forms | TBD | barely cloud-forming | weak cloud | late/weak | TBD | shallow | small | TBD | unavailable | qualitative threshold | planned | Paired with barely cloud-free. |
| D | `cm1-cloud-forms-evaporates-quickly-v1` | Evaporation/lifetime boundary | dry air aloft / entrainment stress | cloud forms then evaporates quickly | TBD | cloud erodes | transient cloud | present | TBD | TBD | transient | TBD | unavailable | qualitative threshold | planned | Tests cloud lifetime explanation. |
| D | `cm1-shallow-cloud-capped-threshold-v1` | Cap-depth boundary | cap near expected cloud top | shallow cloud remains capped | TBD | capped shallow cloud | capped cloud | present/delayed | TBD | below cap | lower | TBD | unavailable | qualitative threshold | planned | Tests cap/top relationship. |
| E | `cm1-cloud-no-rain-v1` | Warm-cloud no-rain control | cloud forms, rain suppressed/absent | cloud but no rain | TBD | cloud/no-rain | cloud, no rain | present | present | present | present | present | unavailable | qualitative rain regime | later | Defer until warm-rain path. |
| E | `cm1-warm-rain-shallow-cloud-v1` | Warm rain / droplet growth | warm-cloud setup with rain possible | rain onset after cloud | TBD | rain later | cloud and rain | present | present | present | present | present | present | qualitative rain regime | later | Defer until warm-cloud regime is validated. |
| E | `cm1-rain-evaporates-below-cloud-base-v1` | Rain evaporation / virga-like contrast | rain aloft, drier sub-cloud air | rain evaporates below cloud base | TBD | rain evaporation later | rain/evaporation | present | present | present | present | present | present | qualitative rain regime | later | Later precipitation/appearance work. |

## Agreement Policy

Use these tiers when deciding whether a case validates a user-control range:

| Agreement category | Requirement |
| --- | --- |
| Regime agreement | Required for a range to be considered validated. Examples: dry failed, shallow cloud, capped/suppressed, humid low cloud, low stratus/fog-like. |
| Cloud base/top/timing | Should be broadly plausible and directionally useful. Do not require exact forecast matching. |
| Max cloud water/updraft | Teaching diagnostics. Useful for comparison and trend direction, but not forecast calibration targets. |
| Exact cloud morphology | Not pass/fail. Do not score exact cell placement, eddy shape, or cloud outline. |
| Rain onset | Later agreement category after warm-cloud/no-rain behavior is validated. |

If CM1 and the simplified model disagree on regime, mark that user-control
range as `exploratory` or `needs calibration`, not validated. Then decide in a
separate issue whether the CM1 case, the reduced model, the mapping, or the UI
control range needs adjustment.

## Validated-Range Policy

Future app controls should be able to label user choices using nearby CM1
validation coverage.

| Label | Meaning | Suggested UI interpretation |
| --- | --- | --- |
| Validated range | Covered by nearby accepted CM1 reference cases on the relevant control axes. | Use normal confidence language. |
| Exploratory range | Simplified result is plausible but not reference-backed in this part of control space. | Show gentle caution and encourage comparison with accepted anchors. |
| Outside validated range | Reference-backed behavior is unavailable or known to disagree. | Use caution; avoid strong claims and exact morphology language. |

This issue only defines the policy. UI implementation should be separate.

## Execution Plan

1. Treat the old Phase A run as workflow/provisional evidence and rerun Phase A
   with the cloud-scale #254 configs before final visual validation claims.
2. Use `scripts/reference/cm1/run_validation_batch.sh` to rerun/ingest/QC the
   committed runnable anchors as a local validation batch when needed.
3. Implement Phase B as the next validation-anchor batch before adding ad hoc
   visual cases.
4. Generate and ingest Phase B outputs through the existing local CM1 workflow.
5. Manually accept/reject Phase B using the metrics in this matrix.
6. Add Phase C one-factor sensitivity cases only after cloud-scale Phase A/B
   anchors are accepted or explicitly marked exploratory.
7. Add Phase D threshold cases when the app is ready to label validated versus
   exploratory control ranges.
8. Defer Phase E rain cases until warm-cloud/no-rain behavior and warm-rain
   diagnostics are ready.

The batch report lives under:

```text
data/reference/cm1/validation-runs/<timestamp>/validation-report.json
```

It records per-case statuses (`planned`, `cm1_failed`, `ingest_failed`,
`qc_failed`, `accepted`, `needs_calibration`), diagnostics, expected/observed
regimes, agreement status, warnings, and next actions. See
`docs/reference-models/cm1-validation-batch-workflow.md`.

Generated outputs remain local and ignored under paths such as:

```text
data/reference/cm1/
frontend/public/reference/cm1/local/
```

Commit docs, scripts, manifests, and tiny fixtures only. Do not commit large
NetCDF outputs, CM1 source, binaries, runtime support files, or local run
directories.

## Issue #223 Implementation Scope

Issue #223 is the Phase B CM1 validation-anchor implementation issue. It should
commit only the immediate Phase B runnable case assets/manifests/run hooks:

```text
cm1-capped-suppressed-cumulus-v1
cm1-humid-low-cloud-contrast-v1
cm1-low-stratus-develops-v1
```

The low-cloud anchor is named low stratus rather than fog because the committed
first-pass setup uses weak heating and shallow stability rather than a full
radiative-cooling fog design. Real output must still be generated, ingested,
and manually inspected before any Phase B case is marked accepted.

Do not use #223 to start Phase C sweeps, Phase D boundaries, Phase E rain,
terrain/orographic cases, PySDM, or warm-rain work.

## Non-Goals

- Do not run CM1.
- Do not add new case configs in this issue.
- Do not add batch automation.
- Do not change frontend UI.
- Do not tune CM1 physics.
- Do not change reduced-model science.
- Do not change Boussinesq behavior.
- Do not add PySDM or warm-rain physics.

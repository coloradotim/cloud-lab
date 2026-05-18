# CM1 Real Output Acceptance Report

Issue: #221 — Manual UX and science acceptance pass for real CM1 reference path

## Recommendation

Proceed to #222 polish.

The first real local CM1 reference pair is scientifically usable for the current Cloud Lab milestone. The dry-failed case remains cloud-free while showing motion, and the shallow-cumulus baseline forms cloud with coherent timing and cloud diagnostics. The CM1 scientific replay, reduced-model comparison, and cloud appearance view are functioning with honest provenance and assumption labels.

Do not calibrate the first CM1 cases before #222. The immediate next step should be view/layout/visual polish, not more science plumbing.

## Commit / app state inspected

Manual acceptance was performed after #220 completed and local CM1 outputs were ingested into Cloud Lab reference artifacts.

Relevant completed path:

```text
local CM1 output
→ reference-run-v1 / reference-frame-v1 artifacts
→ frontend local reference index
→ CM1 scientific replay view
→ CM1 cloud appearance view
→ Lower Atmosphere v2 reduced-model/reference comparison
```

The inspected app was served locally at:

```text
http://localhost:5173/
```

Lab inspected:

```text
Lower Atmosphere Cloud Basics
```

Reference cases inspected:

```text
cm1-dry-failed-cumulus-v1
cm1-shallow-cumulus-baseline-v1
```

## Commands / workflow used

Local CM1 reference outputs were generated and ingested through the repo scripts. The successful ingest command was:

```bash
scripts/reference/cm1/ingest_reference_pair.sh \
  --dry-input data/reference/cm1/runs/20260518T040131Z-dry-failed-cumulus \
  --shallow-input data/reference/cm1/runs/20260518T040131Z-shallow-cumulus-baseline \
  --output data/reference/cm1/ingested \
  --public-output frontend/public/reference/cm1/local
```

The app was then inspected in the browser.

## Science sanity results

### Dry failed cumulus

Result: Pass.

The dry-failed CM1 reference case loaded as real local ingested output and behaved as expected.

Observed CM1 diagnostics:

```text
Frame count: 25
Time range: 0–7200 s
First cloud time: unavailable
Cloud base/top: unavailable / unavailable
Max updraft: 0.558 m/s
Max cloud water: 0.00 kg/kg
Cloud/no-cloud status: Dry failed
Source: real local ingested CM1 reference output
```

Observed reduced-model default run:

```text
Scenario: Dry failed cumulus
Flow: Evolve + lift
Selected profile time: 4.0 h after sunrise
Profile status: Moisture limited
Mixed-layer depth / LCL: 598 m / 1524 m
Cloud-column status: Dry failed
First cloud time: unavailable
Max cloud water: 0.00e+0 kg/kg
```

The reduced model and CM1 reference agree on the high-level teaching outcome: dry failed / no cloud. This is exactly the intended contrast case.

### Shallow cumulus baseline

Result: Pass.

The shallow-cumulus CM1 reference case loaded as real local ingested output and produced meaningful cloud.

Observed CM1 diagnostics:

```text
Frame count: 25
Time range: 0–7200 s
First cloud time: 600 s
Cloud base/top: 1250 m / 4250 m
Max updraft: 6.56 m/s
Max cloud water: 0.00191 kg/kg
Rain onset: 1800 s
Source: real local ingested CM1 reference output
```

Observed reduced-model default run:

```text
Scenario: Baseline shallow cloud
Flow: Evolve + lift
Selected profile time: 4.0 h after sunrise
Profile status: Cloud favorable
Mixed-layer depth / LCL: 746 m / 320 m
Cloud-column status: Cloud formed
First cloud time: 240 s
Max cloud water: 4.07e-3 kg/kg
```

The reduced model and CM1 reference agree on the high-level teaching outcome: cloud formed. Differences in first cloud time, cloud base/top, updraft, and cloud amount are acceptable at this stage because the app correctly labels the comparison as qualitative and teaching-relevant rather than exact morphology scoring.

## UX / product acceptance findings

### What worked

* Lower Atmosphere Cloud Basics opens cleanly.
* The reduced-model v2 path still works.
* The app loads real local CM1 reference output.
* The app distinguishes real local CM1 reference output from synthetic fixture/demo data.
* The scientific replay view works with real CM1 output.
* The reference field selector is present.
* Timeline/scrubber controls exist.
* The app shows useful CM1 diagnostics:

  * first cloud time
  * cloud base/top
  * max updraft
  * max cloud water
  * rain onset when available
* The reduced-model/reference comparison panel is scientifically honest:

  * compares outcomes and teaching diagnostics
  * does not score exact cloud morphology
  * labels reduced lift as prescribed
  * labels CM1 as reference-model output
* The appearance view consumes CM1/reference cloud-water fields and preserves assumption labels.
* The appearance view labels:

  * visual interpretation
  * assumed droplet radius
  * not direct radiative transfer
  * not live CM1 simulation

### Appearance view acceptance

Result: Pass for milestone; needs polish.

Observed appearance diagnostics for shallow cumulus:

```text
Appearance source: CM1/reference cloud liquid water
Max optical depth proxy: 76.8
Mean opacity: 0.0153
Assumed droplet radius: 12 um
First cloud time: 600 s
Cloud base/top: 1250 m / 4250 m
Max updraft: 6.56 m/s
Max cloud water: 0.00191 kg/kg
```

The appearance view is connected to real CM1 output and is honestly labeled. It is acceptable for this milestone.

However, the visual payoff is still weak. The rendered cloud field is faint/blocky and does not yet feel visually satisfying. This should be a #222 focus item.

## Issues to carry into #222

### 1. Scientific 2-D field view needs visual polish

The scientific field view works, but the display is visually crude. Cloud liquid water appears as blocky/low-contrast patches. It proves the data path works, but it does not yet feel like “watching cloud evolution.”

#222 should improve:

* cloud-water color scaling
* contrast
* legends
* field readability
* time replay clarity
* optional interpolation/smoothing if honest and labeled

### 2. Appearance view needs stronger visual payoff

The appearance view is honest and connected to real CM1 fields, but it is too faint and flat.

#222 should improve:

* cloud opacity/density mapping
* brightness/contrast mapping
* visual separation of cloud vs sky/background
* zero-cloud dry-case behavior
* shallow-cumulus visual payoff
* labels explaining that this is a visual interpretation

### 3. Comparison layout is cramped / not robust

The reference comparison panel becomes unreadable in PDF/narrow layout, with text wrapping into vertical fragments. This is a serious UX polish issue.

#222 should improve the comparison layout using a wider table/card structure, better responsive behavior, or more compact rows.

### 4. Source/provenance labels are too repetitive

The labels are scientifically useful but cluttered. Some labels repeat similar ideas, such as “Not live interactive simulation” and “Not a live interactive CM1 simulation.”

#222 should tighten the label set while preserving honesty.

### 5. Pre-run state needs clearer explanation

Before the reduced-model run, the CM1 reference already shows a complete reference case. That is valid, but users may not understand why a reference case appears before they run the reduced model.

Add copy such as:

```text
Reference case is available before you run the reduced model. Run the v2 flow to compare your reduced-model result against this CM1 reference.
```

### 6. Missing temperature field warning should be improved

The app currently reports:

```text
Missing fields: Missing CM1 field for temperature_k.
```

This is technically true but potentially confusing because potential temperature is available. Consider clearer wording:

```text
Temperature field unavailable; using potential temperature where available.
```

or suppress the warning where `potential_temperature_k` is present and acceptable for the selected view.

## Proceed / hold decision

Proceed to #222.

No case calibration is required before #222.

The first real CM1 dry-failed and shallow-cumulus reference pair is scientifically usable for the current milestone:

```text
Dry failed: motion without meaningful cloud.
Shallow cumulus: meaningful cloud formation.
```

## Recommended next issue

Work:

```text
#222 — Polish CM1 2-D scientific replay and cloud appearance views after real-output acceptance
```

Primary #222 priorities:

1. Improve cloud visualization contrast/readability.
2. Improve appearance view visual payoff.
3. Fix reference comparison layout/responsiveness.
4. Tighten source/provenance/assumption labels.
5. Improve pre-run reference explanation.
6. Improve or suppress confusing missing-temperature warnings.

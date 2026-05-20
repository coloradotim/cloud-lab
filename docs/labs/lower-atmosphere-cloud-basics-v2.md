# Lower Atmosphere Cloud Basics v2

Issue: #183

Lower Atmosphere Cloud Basics v2 is the reduced-model replacement for the current Boussinesq-based Lower Atmosphere Cloud Basics experience.

It is designed around:

```text
boundary_layer_1d
→ controlled_cloud_column
→ deterministic diagnostics
→ focused scientific visualization
→ precipitation and optics extension points
```

v2 should replace the current Boussinesq-based Lower Atmosphere lab as the main user-facing science path. The current `boussinesq_2d` prototype may remain available temporarily as a developer/reference/prototype artifact, but it should not be the default v2 engine and should not be presented as the trusted cloud-resolving path.

## Decision Summary

Lower Atmosphere Cloud Basics v2 should fully replace the current Boussinesq-centered Lower Atmosphere lab with an explainable reduced-model workflow.

The v2 science stack is:

1. `boundary_layer_1d` for environmental/profile evolution.
2. `controlled_cloud_column` for prescribed-lift cloud formation from a selected profile.
3. Deterministic diagnostics that explain why cloud forms, fails, evaporates, or is suppressed.
4. A precipitation-ready architecture that can later attach controlled warm-rain microphysics.
5. Visualization that starts simple and scientific, then iterates toward richer cloud and optics views only after the science contract is stable.
6. Future CM1 reference comparison to anchor reduced-model behavior against credible cloud-resolving cases.

The v2 workbench now also includes a first CM1/reference scientific replay
panel. This panel is separate from the reduced-model flow: it displays offline
`reference-frame-v1` fields with CM1 source/provenance labels and does not run
CM1 or present the reduced-model result as CM1.
The initial mounted data is a tiny synthetic fixture for viewer coverage until
real local CM1 output is ingested.

That reference panel now also exposes the first CM1/reference cloud appearance
mode. The appearance mode interprets the reference cloud-water field visually,
preserves replay/provenance labels, and lets the user switch back to the
scientific field view. It is labeled as an assumed-radius visual interpretation,
not direct radiative transfer or live CM1 simulation.

Lower Atmosphere v2 now also has the first reduced-model versus CM1/reference
diagnostic comparison panel. The initial available comparison maps the reduced
`lower-atmosphere-v2-baseline-shallow-cloud` scenario to
`cm1-shallow-cumulus-baseline-v1` and compares teaching-relevant diagnostics:
cloud/no-cloud status, first cloud time, cloud base, cloud top, max cloud water,
max updraft, rain onset, and profile context. Other scenario mappings are
declared for the dry-failed, capped/suppressed, humid low-cloud, and later
warm-rain reference cases, but those show the explicit fallback:

```text
No CM1 reference case is available for this scenario yet.
```

The comparison is qualitative and diagnostic. It must not score exact cloud
morphology or imply CM1 runs live in the app.

When local CM1 artifacts have been ingested, the v2 reference panel and
comparison panel prefer the real local `reference-run-v1` artifact for the
mapped case id. The generated local index lives under
`frontend/public/reference/cm1/local/index.json` and is ignored by git. If no
real local artifact is available, the shallow-cumulus fixture remains visible
only as `Synthetic fixture data`, `Not scientific truth`, and `For UI/testing
only`.

#222 polish keeps the first real-output science fixed and improves the v2
experience around it. The scientific replay should show clearer cloud-water
contrast, selected-frame min/max readouts, no-cloud/no-signal states for the dry
case, and a field note when potential temperature is available but direct
temperature is missing. The appearance mode should make shallow-cumulus cloud
water more visible while preserving zero-cloud dry behavior and labeling it as
an assumed-radius visual interpretation, not direct radiative transfer. The
comparison panel should remain readable in narrow/export-like layouts and should
explain that the offline CM1 reference is visible before Run v2 computes the
reduced-model side.

#231 keeps the same science and improves the CM1/reference field rendering
itself. Cloud and rain water should use display-only log/adaptive palettes that
leave zero-signal dry frames quiet. Vertical velocity, water vapor, and
temperature/theta should each use field-appropriate palettes. The appearance
view may use stronger opacity, soft edges, highlights, and cloud-base shadowing
from the same CM1 cloud-water field, but it remains a labeled visual
interpretation and must not fake clouds in dry-failed cases.

#233 keeps that same accepted CM1 science and rebuilds the user-facing Lower
Atmosphere experience around a guided cloud experiment rather than a
setup/stage/inspector or model-comparison layout. The main experience should
show:

```text
choose an experiment
→ watch cloud evolution
→ understand why cloud formed or failed
→ try the next atmospheric contrast
→ open Model details / Why trust this for validation/provenance
```

Experiment cards should use plain atmospheric questions, expected visual
outcomes, primary controls to try, and reference/trust status. Cloud Appearance
should be the default visual after a run, with Scientific Fields one clear
toggle away and paired with variable explanations. The CM1/reduced-model
diagnostic comparison remains available, but it belongs under collapsed Model
details / Why trust this rather than in the main user flow. The main story
should say "cloud formed" or "cloud did not form" in atmospheric language, not
"both models formed cloud."

#240 finishes the first guided interaction pass. After an experiment is
selected, the full card gallery should collapse into a compact selected
experiment summary with a Change experiment action and a few scenario switches.
The main working controls belong near the replay: run mode, Run experiment /
Run again, Reset, Cloud Appearance / Scientific Fields, Scientific field
selector, and replay controls. Cloud Appearance uses a display-only vertical
viewport that starts in the lower atmosphere and expands upward with cloud-top
growth; Scientific Fields shows the full x-z domain by default. Both views
should show x/z labels and major tick marks. Understand Why should explain
moisture, lift, stability, cloud depth, rain signal, and no-cloud outcomes in
atmospheric language. Try Next should separate planned setup tweaks from
switching to another scenario. Model details / Why trust this remains collapsed
for CM1/reference provenance, validation, and qualitative diagnostic checks.

#243 refines that guided replay layout without changing the science. The visual
field should use a stable bounded display frame in both Appearance and
Scientific Fields modes, so the field picker, frame readout, and replay
controls remain usable without excessive scrolling. Appearance mode should keep
following cloud-top growth through display-only x-z viewport mapping and label
the visible range, while Scientific Fields should keep the full domain by
default and fit it into the bounded frame. Run mode, Run experiment / Run
again, Reset, view mode, and Scientific field selection should read as one
control group attached to the cloud replay.

#248 replaces the planned Try Next tweak buttons with real editable atmospheric
ingredient controls. The primary user-facing controls are lower-atmosphere
humidity, surface moisture, surface heating, cap strength, cap height, dry air
above the cloud layer, and mixing with dry air. These controls use relative
presets such as Drier / Baseline / More humid and map centrally to
`boundary_layer_1d` profile controls using existing scenario/default anchors.
Lift strength and lift duration remain hidden from the normal UI because lift
is prescribed/internal in this reduced-model flow. Tweaked setups are labeled as
reduced-model exploratory until they have direct CM1 validation coverage; the
offline CM1 reference artifacts are not changed or rerun.

#251 clarifies and fixes the horizontal-domain presentation for CM1/reference
replay. The committed Phase A/B CM1 case assets currently target `nx = 60` with
`dx = 2000 m`, so the full x-domain is about 120 km. That is too wide to be the
default visual mental model for a guided shallow-cumulus experiment. The
scientific field view may still expose the full centered CM1 domain with clear
domain-width labeling, but the Cloud Appearance view should default to a
cloud-focused horizontal window and offer full-domain inspection explicitly.
This is display-window behavior only; it does not tune CM1 cases, alter
reference fields, or change reduced-model science.

The v2 user should be able to ask:

```text
Why did this environment become cloud-favorable?
Why did lifted air form cloud or fail?
What limited cloud formation?
What would need to change for cloud or rain?
How does this compare to reference cloud-resolving behavior later?
```

## Replacement Policy

v2 is not a Boussinesq comparison skin. It is the new primary Lower Atmosphere Cloud Basics path.

Current policy:

```text
boussinesq_2d = Yellow prototype visual dynamics scaffold
```

v2 should not depend on Boussinesq for its core user promise.

As of #197, the normal user path opens the v2 reduced-model flow and the
Boussinesq-centered v1 scenario catalog is quarantined as developer/prototype
metadata. The normal Lab Picker and Lower Atmosphere v2 scenario selector do
not expose the Boussinesq v1 scenarios as trusted/default Lower Atmosphere
experiences.

Allowed Boussinesq role, if kept temporarily:

- developer-only comparison
- archived prototype scenario
- diagnostics/regression reference
- optional advanced/system view with strong Yellow labels

Not allowed in v2:

- default user-facing engine
- trusted cloud-resolving comparison
- host for precipitation/microphysics
- terrain/orographic cloud foundation
- optics truth source
- hidden fallback when reduced models fail

If the reduced-model workflow is good enough, Boussinesq can be removed from the Lower Atmosphere v2 UI.

## User Promise

Users can explore how lower-atmosphere heating, moisture, stability, entrainment, and prescribed lift control warm-cloud formation.

The lab should help users understand:

- how a morning lower-atmosphere profile becomes cloud-favorable
- why warm ground alone is not enough
- how LCL, mixed-layer depth, RH, cap strength, and entrainment interact
- why lifted air forms cloud in one setup and fails in another
- how a cap suppresses cloud formation
- how dry entrainment prevents or erodes cloud potential
- how cloud water appears under prescribed lift
- how future rain/precipitation diagnostics attach to cloud water and microphysics
- why visualization/optics should consume physical fields rather than inventing weather

V2 should be beautiful later, but the first priority is physically coherent, deterministic explanation.

## Core User Flows

v2 should support three first-class flows.

### Flow 1 — Atmosphere Evolution Only

Question:

```text
Does the lower atmosphere become favorable for clouds?
```

Engine:

```text
boundary_layer_1d
```

User action:

```text
Choose scenario/profile controls → run profile evolution → inspect cloud formation potential
```

Outputs:

- evolved temperature profile
- evolved RH/water vapor profile
- mixed-layer depth
- LCL
- mixed-layer depth minus LCL
- cap/inversion state
- entrainment drying proxy
- cloud formation potential status
- deterministic limiting reason
- first favorable time, when applicable

No cloud water is produced in this flow.

Best use:

- teaching profile evolution
- showing moisture-limited vs cap-suppressed vs cloud-favorable environments
- selecting a profile time to use in a cloud-column run

### Flow 2 — Lifted Cloud Only

Question:

```text
Given this profile and prescribed lift, does cloud form?
```

Engine:

```text
controlled_cloud_column
```

User action:

```text
Choose or use a profile → choose prescribed lift settings → run cloud column → inspect cloud formation
```

Profile source options:

- built-in simple profile
- selected initial profile
- selected evolved profile from a previous `boundary_layer_1d` run
- future CM1/reference-derived sounding/profile

Outputs:

- parcel/column height over time
- temperature
- RH
- water vapor
- cloud liquid water
- first cloud time
- cloud base
- cloud-top proxy
- condensation/evaporation proxies
- cloud formation status
- deterministic reason
- water-budget summary
- prescribed forcing metadata

Best use:

- teaching cloud formation/failure under controlled lift
- isolating moisture, cap, and lift effects
- showing why lift is prescribed, not predicted dynamics

### Flow 3 — Combined Atmosphere Evolution → Lifted Cloud

Question:

```text
After the atmosphere evolves, what happens when air is lifted?
```

Engines:

```text
boundary_layer_1d → controlled_cloud_column
```

User action:

```text
Choose scenario → run profile evolution → select profile time or use auto-selected time → run cloud column
```

Recommended default behavior:

- run profile evolution
- auto-select the final profile time by default, but allow user selection
- run controlled cloud column from the selected profile
- present both environmental favorability and lifted-cloud outcome

Outputs:

- profile evolution result
- selected profile time
- cloud-column formation result
- expected vs observed scenario contract
- limiting factor explanation
- future precipitation readiness metadata

Best use:

- main v2 Lower Atmosphere learning flow
- showing environment-to-cloud causality
- explaining why favorable potential is not the same as guaranteed cloud/rain

## Recommended First Implementation Experience

Early v2 should prioritize science and diagnostics over visual richness.

Minimum v2 layout:

```text
Setup panel
  - scenario
  - flow mode
  - profile controls
  - prescribed lift controls
  - run controls

Main stage
  - profile evolution view
  - cloud-column view
  - simple timeline/scrubber
  - result/status cards

Inspector
  - profile diagnostics
  - cloud-column diagnostics
  - expected vs observed
  - assumptions and limitations
```

Do not start with cloud-like rendering as the main deliverable. Use:

- profile charts
- height/time line plots
- simple cloud-water-over-time plot
- cloud-column curtain/heatmap later if practical
- clear diagnostic cards

## Flow Mode Selector

Add a clear v2 flow selector:

```text
What do you want to explore?

1. Atmosphere evolution
2. Lifted cloud formation
3. Evolution + lifted cloud
```

Suggested labels:

- `Evolve atmosphere`
- `Lift cloud column`
- `Evolve + lift`

Descriptions:

```text
Evolve atmosphere
Watch the lower-atmosphere profile change after sunrise and diagnose cloud formation potential. No cloud water is produced.

Lift cloud column
Apply prescribed lift to a selected profile and diagnose whether cloud water forms.

Evolve + lift
Evolve the atmosphere first, then run prescribed lift from a selected profile time.
```

## Scenario Set

v2 should define scenario families rather than one-off solver configs.

### 1. Baseline Shallow Cloud

Physical question:

```text
When do heating, moisture, and lift combine to form shallow warm cloud?
```

Profile setup:

- moderate morning humidity
- moderate surface heating
- weak/moderate cap
- manageable dry air aloft

Lift setup:

- moderate prescribed lift
- sufficient lift duration

Expected outcome:

- profile may become cloud-favorable
- cloud column forms cloud when lift reaches saturation
- first cloud time and cloud base are reported

Diagnostics:

- mixed-layer depth vs LCL
- first favorable profile time
- first cloud time
- cloud base
- max cloud water
- water-budget summary

### 2. Dry Failed Cumulus

Physical question:

```text
Why can air rise but fail to form cloud?
```

Profile setup:

- low initial RH or low surface moisture flux
- LCL remains high
- mixed layer may grow but stays below LCL

Lift setup:

- prescribed lift strong enough to test ascent, but weaker than the baseline
  shallow-cloud case so the default combined flow remains cloud-free

Expected outcome:

- little or no cloud water
- profile status: `moisture_limited`
- cloud-column status: `dry_failed` or another clearly cloud-free status
- deterministic explanation points to high LCL / low RH

Diagnostics:

- LCL too high
- RH near mixed-layer top too low
- first cloud time absent
- cloud liquid water near zero

### 3. Capped / Suppressed Cloud

Physical question:

```text
How does an inversion or cap prevent cloud formation?
```

Profile setup:

- moderate low-level moisture
- low/strong inversion
- mixed-layer growth stalls below cap

Lift setup:

- lift restricted or column run uses capped profile metadata

Expected outcome:

- cloud delayed, suppressed, or prevented
- status: `cap_suppressed`
- if cloud forms, depth is limited

Diagnostics:

- inversion height
- inversion strength
- mixed-layer depth near cap
- cloud top/proxy relative to cap
- expected vs observed suppression

### 4. Moist Surface Enables Cloud

Physical question:

```text
How does surface moisture change cloud potential?
```

Profile setup:

- compare dry surface vs moist surface
- same heating and cap
- higher moisture flux lowers LCL or sustains RH

Lift setup:

- same lift for both comparison cases

Expected outcome:

- dry surface case remains moisture-limited
- moist surface case becomes favorable and/or forms cloud

Diagnostics:

- surface moisture added
- LCL change
- cloud/no-cloud comparison
- first favorable time

### 5. Dry Entrainment Suppresses Cloud

Physical question:

```text
How can a growing boundary layer become less cloud-favorable?
```

Profile setup:

- mixed layer grows
- dry air above mixed layer
- strong entrainment

Lift setup:

- use selected evolved profile
- moderate lift

Expected outcome:

- RH decreases or LCL rises
- cloud formation potential worsens
- column cloud is delayed, reduced, or absent

Diagnostics:

- entrainment drying proxy
- RH near mixed-layer top
- LCL trend
- cloud amount reduction

### 6. Stronger Heating / Stronger Lift Comparison

Physical question:

```text
What is the difference between making the environment favorable and lifting air strongly?
```

Profile setup:

- weak vs strong surface heating
- otherwise similar moisture/cap

Lift setup:

- weak vs strong prescribed lift

Expected outcome:

- stronger heating may deepen mixed layer
- stronger lift may form cloud earlier
- neither guarantees cloud if moisture/cap is limiting

Diagnostics:

- heating accumulation
- mixed-layer depth
- updraft/lift strength
- first cloud time
- cloud amount

### 7. Humid Low-Cloud Contrast

Physical question:

```text
What happens when the LCL is very low?
```

Profile setup:

- high near-surface RH
- low LCL
- possible weak cap or surface cooling variant later

Lift setup:

- weak/moderate lift

Expected outcome:

- low cloud forms easily under lift
- label as low-cloud contrast, not classic fair-weather cumulus

Diagnostics:

- low LCL
- low cloud base
- warning that this is a contrast case

Decision:

Keep only if it teaches a useful contrast. Do not present as the default Lower Atmosphere baseline.

### 8. Rain-Capable Warm Cloud Later

Physical question:

```text
When does cloud water become rain?
```

Profile setup:

- humid/favorable profile
- lift sufficient to produce sustained cloud water

Lift setup:

- longer lift/cloud duration
- microphysics handoff enabled later

Expected outcome in v2 design:

- v2 reserves the architecture for rain
- early implementation may report `precipitation_not_enabled`
- future microphysics path reports rain status, first rain time, water budget

Diagnostics:

- cloud water duration
- cloud water amount
- future rain status
- future first rain time
- future water-budget drift
- future effective radius/droplet fields

## Scenario Contract Metadata

Issue #191 adds implementation-facing metadata for the v2 scenario set and
comparison pairs.

Backend source:

```text
backend/app/sim/lower_atmosphere_v2_scenarios.py
```

Frontend source:

```text
frontend/src/labs/lowerAtmosphereV2Scenarios.ts
```

The metadata defines the eight v2 scenario contracts, their supported flow
modes, reduced-model defaults, expected profile/cloud-column/precipitation
statuses, key diagnostics, teaching purpose, comparison suggestions,
limitations, and honesty labels.

The metadata is intentionally not the v2 UI shell and does not implement
profile-to-column orchestration. It exists so future Lower Atmosphere v2 work can
reuse one coherent scenario contract rather than rediscovering the design in UI
components.

## Workbench Shell Status

Issue #193 makes the v2 reduced-model shell the default Lower Atmosphere Cloud
Basics user-facing path. The implementation keeps the legacy internal lab id
`fair-weather-cumulus` to avoid route/config churn, but the visible default is
now the v2 shell rather than the Boussinesq 2-D run screen.

Issue #194 wires the shell to the existing reduced-model endpoints. The default
v2 path can now run profile evolution, prescribed cloud-column lift, or the
combined profile-to-column flow without using Boussinesq.

Issue #195 adds the deterministic v2 diagnostics/inspector layer on top of that
orchestration. The inspector now summarizes what happened, why it happened, what
to try next, key profile/cloud-column numbers, expected-vs-observed scenario
status, and an honest precipitation placeholder without using freeform AI text.

Issue #203 tightens scenario interpretation. The default `Dry failed cumulus`
combined flow should remain cloud-free under prescribed lift, while legitimate
split outcomes such as `profile moisture_limited + column cloud_formed` should
be labeled as cloud formed under prescribed lift rather than implied free
convection.

The shell includes:

- the three v2 flow modes: atmosphere evolution, lifted cloud, and combined
  evolution + lift
- setup groups for scenario, flow mode, atmosphere profile, surface forcing,
  cap/inversion, entrainment, prescribed lift, and advanced settings
- profile, cloud-column, combined-result, timeline/scrubber, and status-card
  surfaces that display the current run state
- inspector sections for profile diagnostics, cloud-column diagnostics,
  expected vs observed status, assumptions/limitations, and precipitation
  status
- visible honesty labels, including `No Boussinesq default`

The orchestration preserves selected-profile provenance:

```text
source_model = boundary_layer_1d
source_frame_time_seconds
source_time_hours_from_sunrise
source_scenario_id
source_profile_status
```

The implementation still does not add precipitation, CM1 comparison, optics,
new model physics, or Boussinesq coupling. Those remain follow-on issues.

Required comparison pairs:

- baseline shallow cloud vs dry failed cumulus
- baseline shallow cloud vs capped/suppressed cloud
- dry surface vs moist surface
- weak heating vs strong heating
- weak lift vs strong lift
- weak entrainment vs dry entrainment
- baseline shallow cloud vs humid low-cloud contrast
- cloud formed vs rain-capable-later placeholder

## Controls

### Primary Controls

These should be the first user-facing controls:

| Control | Applies to | Meaning |
| --- | --- | --- |
| Flow mode | all | Atmosphere evolution, lifted cloud, or combined run |
| Scenario | all | Coherent teaching setup |
| Duration after sunrise | profile | How long the profile evolves |
| Surface heating | profile | Sensible heating strength |
| Surface moisture flux | profile | Moisture source strength |
| Initial mixed-layer humidity | profile | Starting lower-atmosphere moisture |
| Dry air above mixed layer | profile | Entrained dry-air reservoir |
| Inversion height | profile | Cap height |
| Inversion strength | profile | Cap strength |
| Entrainment strength | profile | Mixed-layer-top exchange |
| Lift strength | cloud column | Prescribed updraft/lift magnitude |
| Lift duration | cloud column | How long lift is applied |
| Selected profile time | combined | Which evolved profile feeds cloud column |

### Secondary Controls

| Control | Applies to | Meaning |
| --- | --- | --- |
| Initial mixed-layer depth | profile | Starting depth |
| Background profile preset | profile/column | Starting sounding family |
| Heating curve | profile | Steady vs morning ramp |
| Entrainment drying factor | column | Column-level drying |
| Cooling/heating tendency | column | Prescribed tendency for experiments |
| Runtime | column | Cloud-column runtime |

### Advanced Controls

Keep hidden by default:

- vertical resolution
- timestep
- output cadence
- raw flux scalars
- raw pressure settings
- seed
- schema/debug information

## Diagnostics

v2 diagnostics should be deterministic, structured, and user-readable.

### Profile Diagnostics

Required:

- cloud formation potential status
- deterministic reason
- mixed-layer depth
- LCL
- mixed-layer depth minus LCL
- RH near mixed-layer top
- max RH
- inversion height
- inversion strength
- cap suppression index
- entrainment drying proxy
- surface heating accumulated
- surface moisture added
- first favorable time, if any

### Cloud Column Diagnostics

Required:

- cloud formation status
- deterministic reason
- prescribed forcing label
- first saturation time
- first cloud time
- cloud base
- cloud-top proxy
- max RH
- max cloud liquid water
- total condensed
- total evaporated
- water-budget summary
- cap restriction flag
- dry failed / lift too weak / moisture limited / cap suppressed status

### Combined Diagnostics

Required:

- selected profile time
- profile status at selected time
- column status from selected profile
- expected vs observed scenario status
- main limiting factor
- suggested next experiment
- whether precipitation diagnostics are enabled or deferred

### Precipitation-Ready Diagnostics

Do not require full rain implementation in early v2. Issue #196 adds the
`cloud-column-microphysics-handoff-v1` contract so future warm-rain diagnostics
can consume controlled-cloud output without coupling to Boussinesq.

- precipitation status
- first rain time
- max rain water
- rain water integral
- cloud water available for microphysics
- water-budget drift
- effective radius / droplet payload availability
- microphysics source label: `none`, `bulk`, `PySDM`, `reference`

Allowed early statuses:

```text
precipitation_not_enabled
not_evaluated
```

`precipitation_not_enabled` means cloud water is available but rain physics is
deferred. `not_evaluated` means no cloud water formed, so rain cannot be
evaluated honestly.

## Deterministic Explanation Pattern

Every result should answer:

```text
What happened?
Why did it happen?
What should the user try next?
```

Examples:

### Moisture Limited

```text
The mixed layer grew, but the LCL stayed above the mixed-layer top.
Rising air did not reach saturation.

Try increasing surface moisture flux, starting with higher humidity, or reducing dry entrainment.
```

### Cap Suppressed

```text
Surface heating warmed the lower atmosphere, but the inversion limited mixed-layer growth before the profile became cloud-favorable.

Try weakening the cap, raising the inversion height, or comparing with the weak-cap scenario.
```

### Cloud Formed

```text
Prescribed lift cooled the parcel enough to reach saturation and form cloud liquid water.

Try comparing with a drier profile or weaker lift to see what changes.
```

If cloud forms from a profile that was not cloud-favorable, label the split
outcome explicitly:

```text
The atmosphere did not become cloud-favorable on its own, but prescribed lift
cooled the selected profile enough to reach saturation and form cloud. This is
controlled lift, not predicted free convection.
```

### Dry Failed

```text
Both the atmosphere evolution and the lifted column remained too dry to form
meaningful cloud water.

Try increasing humidity or using a profile from later in the atmosphere-evolution run.
```

No freeform AI generation. Text should be generated from deterministic status keys and model values.

## Visualization Modes

Early v2 should be modest and scientific.

### Required Early Views

#### Profile View

Shows:

- temperature profile
- RH profile
- mixed-layer depth marker
- LCL marker
- inversion/cap marker
- current hours after sunrise
- initial vs current profile overlay when possible

#### Cloud Column View

Shows:

- parcel/column height over time
- RH over time
- cloud liquid water over time
- cloud base marker when cloud forms
- prescribed lift interval

Acceptable first implementation:

- line charts
- simple height/time plot
- simple status cards

Do not require cloud-like rendering in the first v2 implementation.

#### Combined View

Shows:

- profile evolution summary
- selected profile time
- cloud-column result
- expected vs observed scenario card
- limiting factor card

### Later Views

- cloud-water height/time curtain
- simple cloud-like column appearance
- reference-model comparison view
- optics view
- rain/microphysics view
- side-by-side scenario comparison

## Honesty Labels

Use labels such as:

- Reduced model
- 1-D profile evolution
- Prescribed lift
- Controlled cloud formation
- Cloud formation potential
- Cloud liquid water from column model
- Precipitation not enabled / precipitation-ready architecture
- Derived diagnostic
- Not cloud-resolving dynamics
- Not LES/CFD
- Not weather prediction

Avoid labels that imply:

- live 2-D/3-D cloud-resolving dynamics
- quantitative forecast
- turbulence-resolving model
- real precipitation unless microphysics supports it
- current Boussinesq trust

## Relationship To Current Lower Atmosphere v1

Lower Atmosphere v1 currently uses Yellow-labeled `boussinesq_2d`.

v2 replaces that as the main Lower Atmosphere product path.

Migration policy:

1. New v2 implementation should become the default Lower Atmosphere Cloud Basics lab.
2. Old Boussinesq-based scenarios should be removed from the default Lower Atmosphere user flow.
3. If retained temporarily, they should be behind a developer/experimental prototype route or clearly separated comparison mode.
4. Boussinesq warnings should remain visible wherever Boussinesq output is still exposed.
5. Do not design v2 around Boussinesq parity.

## Relationship To CM1 References

CM1 reference work should come after this v2 design.

CM1 should support v2 by providing credible cloud-resolving reference behavior for:

- dry thermal
- shallow cumulus baseline
- dry failed cumulus
- capped/suppressed cumulus
- warm-rain shallow cloud later
- orographic/terrain case later

CM1 comparison should answer:

```text
How does the reduced-model teaching result compare to credible cloud-resolving behavior?
```

Reduced models do not need to match every CM1 morphology detail. They should match teaching-relevant relationships and diagnostics.

## Relationship To Precipitation

v2 should be precipitation-capable from the start architecturally.

That means:

- cloud-column output should preserve cloud-water timing and amount
- diagnostics should have a precipitation placeholder/status
- future microphysics handoff should use `cloud-column-microphysics-handoff-v1`
- optics should know whether rain/droplet fields are absent, assumed, bulk, reference, or microphysics-generated

Do not implement full rain in the v2 design or handoff issues.

The handoff contract preserves:

- `source_model = controlled_cloud_column`
- source scenario id and selected-profile time, when available
- cloud-column run id or local equivalent
- cloud-column time samples
- cloud liquid water time series
- max cloud liquid water
- cloud-water integral
- first cloud time
- cloud base and cloud-top proxy
- total condensed and evaporated amounts
- water-budget summary
- prescribed-lift summary
- temperature, water vapor, and RH time series
- precipitation status
- microphysics and droplet/effective-radius source labels

Future optional fields include rain water, first rain time, max rain water,
effective radius, droplet-size distribution, number concentration, and a
microphysics source label. These fields are optional so early v2 does not imply
rain, PySDM, or droplet-resolved output.

Future precipitation path:

```text
controlled_cloud_column cloud water
→ controlled microphysics / warm-rain diagnostics
→ rain status / first rain time / water budget
→ droplet-aware optics later
```

## Relationship To Optics

Early v2 does not need rich cloud rendering.

However, v2 should prepare the field/provenance handoff:

- source model: `boundary_layer_1d`, `controlled_cloud_column`, `CM1`, `microphysics_lab`
- field provenance
- cloud liquid water source
- rain water source, if available
- effective radius source: absent, assumed, bulk, PySDM, reference
- optical approximation labels

Optics should consume physical fields. It should not determine cloud formation.

## Required Follow-On Implementation Issues

The following implementation issues should be created after #183, unless equivalent issues already exist.

### Follow-On 1 — Replace Lower Atmosphere Cloud Basics default with v2 reduced-model shell

Goal:

Create the v2 Lower Atmosphere Cloud Basics shell and make it the default Lower Atmosphere experience.

Status:

Implemented by #193 as a shell/default-routing step. Profile-to-cloud-column
orchestration landed separately in #194.

Scope:

- add v2 lab route or replace current Lower Atmosphere route
- add flow mode selector
- add setup groups for profile and cloud-column controls
- preserve current Boussinesq only as developer/prototype if needed
- no new science model code

Acceptance:

- v2 shell opens as Lower Atmosphere default
- flow selector supports atmosphere evolution, lifted cloud, combined run
- UI labels reduced-model / prescribed-lift / not cloud-resolving
- Boussinesq is not the default v2 engine

### Follow-On 2 — Implement profile-to-cloud-column orchestration

Goal:

Wire `boundary_layer_1d` outputs into `controlled_cloud_column`.

Status:

Implemented by #194 for the current v2 shell.

Scope:

- let user run profile evolution
- select evolved profile time
- convert selected profile into cloud-column input
- run cloud column
- support combined run shortcut
- preserve provenance

Acceptance:

- atmosphere evolution only works
- lifted cloud only works
- combined run works
- selected profile time is visible
- prescribed lift is labeled
- no Boussinesq coupling

### Follow-On 3 — Build v2 diagnostics and inspector

Goal:

Create deterministic v2 diagnostics that combine profile and cloud-column status.

Status:

Implemented by #195 for the current v2 shell.

Scope:

- profile diagnostics
- cloud-column diagnostics
- combined diagnostics
- expected vs observed scenario contract
- deterministic “try next” suggestions
- precipitation-ready placeholder status

Acceptance:

- inspector explains what happened, why, and what to try next
- no AI-generated explanation
- precipitation status exists even if disabled
- expected vs observed scenario check exists

### Follow-On 4 — Build v2 scientific visualizations

Goal:

Add minimal v2 visualizations focused on science correctness.

Scope:

- profile chart
- profile timeline
- cloud-column time/height chart
- cloud-water time plot
- status cards
- no cloud-like rendering required

Acceptance:

- users can see profile evolution
- users can see column lift/cloud outcome
- timeline/scrubber works
- visualization states are stable and error-bounded

### Follow-On 5 — Add v2 scenario contracts and comparison pairs

Goal:

Implement scenario metadata for v2.

Scope:

- baseline shallow cloud
- dry failed
- capped/suppressed
- moist surface enables cloud
- dry entrainment suppresses cloud
- stronger heating/lift comparison
- humid low-cloud contrast if kept
- rain-capable warm cloud later

Acceptance:

- every scenario has physical question, setup, expected outcome, diagnostics, limitations
- comparison pairs are explicit
- UI does not imply cloud-resolving dynamics

### Follow-On 6 — Add precipitation/microphysics handoff contract

Goal:

Prepare controlled-cloud output for warm-rain diagnostics.

Scope:

- define handoff fields
- define precipitation status enum
- define source/provenance labels
- no PySDM integration yet unless separately scoped

Acceptance:

- cloud-column output can be consumed by future microphysics
- precipitation status can report disabled/not enabled
- water-budget metadata preserved

### Follow-On 7 — Retire or quarantine Boussinesq Lower Atmosphere v1 UI

Goal:

Remove old Boussinesq-centered Lower Atmosphere from the default user path.

Scope:

- remove or hide Boussinesq from default Lower Atmosphere lab
- keep developer/prototype access only if useful
- preserve docs explaining why it was demoted

Acceptance:

- Lower Atmosphere default uses v2 reduced-model flow
- Boussinesq is not presented as trusted or default
- no Boussinesq solver behavior changes

### Follow-On 8 — Add CM1 reference comparison after adapter/cases land

Goal:

Connect v2 diagnostics to CM1 reference cases.

Scope:

- consume CM1 reference frames
- show reduced-model vs reference diagnostics
- no need to match morphology exactly
- label reference provenance

Acceptance:

- v2 can compare a scenario to a reference case
- comparison highlights physical relationships and diagnostics
- reference output is labeled as offline CM1 data

## Open Questions For Later

These are intentionally not resolved in #183:

- Should v2 support direct observed sounding import?
- Should v2 eventually support a profile editor?
- Should Boussinesq be removed entirely or remain as a developer prototype?
- Should precipitation be bulk-only first or PySDM-backed first?
- What exact CM1 cases should be generated first?
- Should optics consume column output before or after CM1 reference comparison?
- Should Lower Atmosphere v2 include a side-by-side scenario comparison mode in the first implementation?

## Non-Goals For #183

Do not:

- implement v2 UI
- implement new backend model code
- change `boundary_layer_1d`
- change `controlled_cloud_column`
- change `boussinesq_2d`
- tune Boussinesq constants or presets
- add CM1 adapter code
- add CM1 output files
- add PySDM
- implement precipitation
- implement optics
- change frontend routing
- remove current Lower Atmosphere lab code

## Acceptance Criteria

- `docs/labs/lower-atmosphere-cloud-basics-v2.md` exists.
- The design says v2 fully replaces the current Boussinesq-based Lower Atmosphere user path.
- The design supports three flows:
  - atmosphere evolution only
  - lifted cloud only
  - combined evolution + lifted cloud
- The design prioritizes science/diagnostics over heavy visualization in early implementation.
- The design is precipitation-capable architecturally.
- The design defines Boussinesq as out of the default v2 path.
- The design defines scenarios, controls, diagnostics, visualization modes, labels, and non-goals.
- The design includes concrete follow-on implementation issue outlines.
- No code changes are made.

## Suggested PR Summary

```text
Summary:
- Added `docs/labs/lower-atmosphere-cloud-basics-v2.md`.
- Defined Lower Atmosphere Cloud Basics v2 as the reduced-model replacement for the current Boussinesq-based lab.
- Defined three v2 user flows: atmosphere evolution only, lifted cloud only, and combined evolution + lifted cloud.
- Defined v2 scenarios, controls, diagnostics, visualization modes, honesty labels, precipitation architecture, and Boussinesq replacement policy.
- Added follow-on implementation issue outlines for v2 shell, profile-to-column orchestration, diagnostics, visualization, scenario contracts, precipitation handoff, Boussinesq retirement/quarantine, and CM1 comparison.
- No solver physics, scenario presets, frontend behavior, renderer behavior, dependencies, or CI behavior changed.

Verification:
- Docs-only change; backend/frontend checks not run.
```

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.sim.cloud_column import cloud_column_scenarios
from app.sim.cloud_column_schemas import CloudColumnConfig, CloudColumnStatus
from app.sim.profile_1d import boundary_layer_1d_scenarios
from app.sim.profile_schemas import BoundaryLayer1DConfig, CloudFormationPotentialStatus

LowerAtmosphereV2FlowMode = Literal[
    "atmosphere_evolution",
    "lifted_cloud",
    "evolution_lifted_cloud",
]
PrecipitationStatus = Literal[
    "precipitation_not_enabled",
    "not_evaluated",
    "cloud_no_rain_path_enabled_later",
]

LOWER_ATMOSPHERE_V2_HONESTY_LABELS = (
    "Reduced model",
    "1-D profile evolution",
    "Prescribed lift",
    "Controlled cloud formation",
    "Not cloud-resolving dynamics",
    "Not LES/CFD",
    "Not weather prediction",
)


@dataclass(frozen=True)
class LowerAtmosphereV2ScenarioContract:
    id: str
    name: str
    short_description: str
    physical_question: str
    flow_modes: tuple[LowerAtmosphereV2FlowMode, ...]
    profile_config_defaults: BoundaryLayer1DConfig
    cloud_column_config_defaults: CloudColumnConfig
    expected_profile_status: CloudFormationPotentialStatus
    expected_cloud_column_status: CloudColumnStatus
    expected_precipitation_status: PrecipitationStatus
    key_diagnostics: tuple[str, ...]
    teaching_purpose: str
    comparison_suggestions: tuple[str, ...]
    known_limitations: tuple[str, ...]
    honesty_labels: tuple[str, ...] = LOWER_ATMOSPHERE_V2_HONESTY_LABELS


@dataclass(frozen=True)
class LowerAtmosphereV2ComparisonPair:
    id: str
    left_scenario_id: str
    right_scenario_id: str
    question_answered: str
    expected_difference: str
    diagnostics_to_compare: tuple[str, ...]


ALL_FLOW_MODES: tuple[LowerAtmosphereV2FlowMode, ...] = (
    "atmosphere_evolution",
    "lifted_cloud",
    "evolution_lifted_cloud",
)


def lower_atmosphere_v2_scenario_contracts() -> list[LowerAtmosphereV2ScenarioContract]:
    """Return Lower Atmosphere Cloud Basics v2 reduced-model scenario contracts.

    These contracts define v2 scenario metadata and default reduced-model configs.
    They do not route the UI, run orchestration, or use the Yellow Boussinesq
    prototype.
    """

    profile = _profile_configs_by_slug()
    column = _cloud_column_configs_by_slug()

    return [
        LowerAtmosphereV2ScenarioContract(
            id="lower-atmosphere-v2-baseline-shallow-cloud",
            name="Baseline shallow cloud",
            short_description=(
                "Moderate heating, moisture, cap, and prescribed lift combine to form "
                "a shallow warm cloud."
            ),
            physical_question=(
                "When do heating, moisture, and lift combine to form shallow warm cloud?"
            ),
            flow_modes=ALL_FLOW_MODES,
            profile_config_defaults=profile["moist-surface-cumulus-favorable"],
            cloud_column_config_defaults=column["humid-lifted-column"],
            expected_profile_status="cloud_favorable",
            expected_cloud_column_status="cloud_formed",
            expected_precipitation_status="precipitation_not_enabled",
            key_diagnostics=(
                "mixed-layer depth vs LCL",
                "first favorable profile time",
                "first cloud time",
                "cloud base",
                "max cloud water",
                "water-budget summary",
            ),
            teaching_purpose=(
                "Establishes the main v2 positive case for environment-to-cloud causality."
            ),
            comparison_suggestions=(
                "lower-atmosphere-v2-dry-failed-cumulus",
                "lower-atmosphere-v2-capped-suppressed-cloud",
                "lower-atmosphere-v2-humid-low-cloud-contrast",
            ),
            known_limitations=(
                "Reduced model, not cloud-resolving dynamics.",
                "Lift is prescribed rather than predicted.",
                "Precipitation is architecturally deferred.",
            ),
        ),
        LowerAtmosphereV2ScenarioContract(
            id="lower-atmosphere-v2-dry-failed-cumulus",
            name="Dry failed cumulus",
            short_description="Air is lifted, but low humidity keeps the column cloud-free.",
            physical_question="Why can air rise but fail to form cloud?",
            flow_modes=ALL_FLOW_MODES,
            profile_config_defaults=profile["morning-stable-layer-breaks-down"],
            cloud_column_config_defaults=column["dry-failed-column"],
            expected_profile_status="moisture_limited",
            expected_cloud_column_status="dry_failed",
            expected_precipitation_status="not_evaluated",
            key_diagnostics=(
                "LCL too high",
                "RH near mixed-layer top too low",
                "first cloud time absent",
                "cloud liquid water near zero",
            ),
            teaching_purpose="Shows that lift alone does not guarantee saturation or cloud water.",
            comparison_suggestions=("lower-atmosphere-v2-baseline-shallow-cloud",),
            known_limitations=(
                "Dry-failed status is a deterministic reduced-model diagnosis.",
                "No Boussinesq thermal motion is used to justify the result.",
            ),
        ),
        LowerAtmosphereV2ScenarioContract(
            id="lower-atmosphere-v2-capped-suppressed-cloud",
            name="Capped / suppressed cloud",
            short_description=(
                "A low, strong inversion suppresses profile growth and limits lifted cloud."
            ),
            physical_question="How does an inversion or cap prevent cloud formation?",
            flow_modes=ALL_FLOW_MODES,
            profile_config_defaults=profile["strong-cap-suppresses-growth"],
            cloud_column_config_defaults=column["capped-suppressed-column"],
            expected_profile_status="cap_suppressed",
            expected_cloud_column_status="cap_suppressed",
            expected_precipitation_status="not_evaluated",
            key_diagnostics=(
                "inversion height",
                "inversion strength",
                "mixed-layer depth near cap",
                "cloud top/proxy relative to cap",
                "expected vs observed suppression",
            ),
            teaching_purpose="Makes the cap/inversion an explicit cloud-limiting mechanism.",
            comparison_suggestions=("lower-atmosphere-v2-baseline-shallow-cloud",),
            known_limitations=(
                "Cap suppression is a controlled reduced-model proxy.",
                "The column lift is restricted by metadata, not predicted dynamics.",
            ),
        ),
        LowerAtmosphereV2ScenarioContract(
            id="lower-atmosphere-v2-moist-surface-enables-cloud",
            name="Moist surface enables cloud",
            short_description="Surface moisture changes a marginal profile into a favorable one.",
            physical_question="How does surface moisture change cloud potential?",
            flow_modes=ALL_FLOW_MODES,
            profile_config_defaults=profile["surface-moisture-flux-enables-potential"],
            cloud_column_config_defaults=column["humid-lifted-column"],
            expected_profile_status="cloud_favorable",
            expected_cloud_column_status="cloud_formed",
            expected_precipitation_status="precipitation_not_enabled",
            key_diagnostics=(
                "surface moisture added",
                "LCL change",
                "cloud/no-cloud comparison",
                "first favorable time",
            ),
            teaching_purpose=(
                "Supports dry-surface versus moist-surface comparison without changing "
                "the dynamics engine."
            ),
            comparison_suggestions=("lower-atmosphere-v2-dry-failed-cumulus",),
            known_limitations=(
                "Surface flux is a reduced-model preset scalar.",
                "Rain is not evaluated even when cloud forms.",
            ),
        ),
        LowerAtmosphereV2ScenarioContract(
            id="lower-atmosphere-v2-dry-entrainment-suppresses-cloud",
            name="Dry entrainment suppresses cloud",
            short_description=(
                "Growth entrains dry air, worsening cloud potential and reducing cloud outcome."
            ),
            physical_question="How can a growing boundary layer become less cloud-favorable?",
            flow_modes=ALL_FLOW_MODES,
            profile_config_defaults=profile["dry-entrainment-suppresses-potential"],
            cloud_column_config_defaults=column["dry-failed-column"],
            expected_profile_status="dry_entrainment_suppressed",
            expected_cloud_column_status="dry_failed",
            expected_precipitation_status="not_evaluated",
            key_diagnostics=(
                "entrainment drying proxy",
                "RH near mixed-layer top",
                "LCL trend",
                "cloud amount reduction",
            ),
            teaching_purpose=(
                "Separates boundary-layer growth from cloud favorability when air aloft is dry."
            ),
            comparison_suggestions=("lower-atmosphere-v2-baseline-shallow-cloud",),
            known_limitations=(
                "Entrainment is simplified and deterministic.",
                "Column cloud reduction is interpreted through prescribed-profile inputs.",
            ),
        ),
        LowerAtmosphereV2ScenarioContract(
            id="lower-atmosphere-v2-heating-lift-comparison",
            name="Stronger heating / stronger lift comparison",
            short_description=(
                "Compares environment-deepening controls with prescribed-lift controls."
            ),
            physical_question=(
                "What is the difference between making the environment favorable and "
                "lifting air strongly?"
            ),
            flow_modes=ALL_FLOW_MODES,
            profile_config_defaults=profile["moist-surface-cumulus-favorable"],
            cloud_column_config_defaults=column["stronger-lift-earlier-cloud"],
            expected_profile_status="cloud_favorable",
            expected_cloud_column_status="cloud_formed",
            expected_precipitation_status="precipitation_not_enabled",
            key_diagnostics=(
                "heating accumulation",
                "mixed-layer depth",
                "lift strength",
                "first cloud time",
                "cloud amount",
            ),
            teaching_purpose=(
                "Shows that surface heating and prescribed lift affect different parts "
                "of the v2 workflow."
            ),
            comparison_suggestions=("lower-atmosphere-v2-baseline-shallow-cloud",),
            known_limitations=(
                "Stronger lift is prescribed forcing, not predicted circulation.",
                "The scenario is a comparison contract, not a tuned forecast.",
            ),
        ),
        LowerAtmosphereV2ScenarioContract(
            id="lower-atmosphere-v2-humid-low-cloud-contrast",
            name="Humid low-cloud contrast",
            short_description="Very humid low-level air forms low cloud easily under lift.",
            physical_question="What happens when the LCL is very low?",
            flow_modes=ALL_FLOW_MODES,
            profile_config_defaults=_humid_low_cloud_profile_config(),
            cloud_column_config_defaults=column["humid-lifted-column"],
            expected_profile_status="cloud_favorable",
            expected_cloud_column_status="cloud_formed",
            expected_precipitation_status="precipitation_not_enabled",
            key_diagnostics=(
                "low LCL",
                "low cloud base",
                "contrast-case warning",
            ),
            teaching_purpose=(
                "Provides a useful low-LCL contrast without presenting it as classic "
                "fair-weather cumulus."
            ),
            comparison_suggestions=("lower-atmosphere-v2-baseline-shallow-cloud",),
            known_limitations=(
                "Contrast case, not the default Lower Atmosphere baseline.",
                "Low-cloud ease should not be described as cloud-resolving truth.",
            ),
        ),
        LowerAtmosphereV2ScenarioContract(
            id="lower-atmosphere-v2-rain-capable-warm-cloud-later",
            name="Rain-capable warm cloud later",
            short_description="Sustained cloud water is reserved for future warm-rain diagnostics.",
            physical_question="When does cloud water become rain?",
            flow_modes=ALL_FLOW_MODES,
            profile_config_defaults=profile["moist-surface-cumulus-favorable"],
            cloud_column_config_defaults=_rain_capable_column_config(column["humid-lifted-column"]),
            expected_profile_status="cloud_favorable",
            expected_cloud_column_status="cloud_formed",
            expected_precipitation_status="precipitation_not_enabled",
            key_diagnostics=(
                "cloud water duration",
                "cloud water amount",
                "future rain status",
                "future first rain time",
                "future water-budget drift",
                "future effective radius/droplet fields",
            ),
            teaching_purpose=(
                "Keeps precipitation architecture visible while being honest that rain "
                "is not implemented."
            ),
            comparison_suggestions=("lower-atmosphere-v2-baseline-shallow-cloud",),
            known_limitations=(
                "Precipitation diagnostics are not enabled in early v2.",
                "No PySDM, droplet distributions, or rain sedimentation are implied.",
            ),
        ),
    ]


def lower_atmosphere_v2_comparison_pairs() -> list[LowerAtmosphereV2ComparisonPair]:
    return [
        LowerAtmosphereV2ComparisonPair(
            id="baseline-vs-dry-failed",
            left_scenario_id="lower-atmosphere-v2-baseline-shallow-cloud",
            right_scenario_id="lower-atmosphere-v2-dry-failed-cumulus",
            question_answered="How does moisture availability change cloud formation?",
            expected_difference=(
                "The baseline forms cloud; the dry case remains cloud-free or moisture-limited."
            ),
            diagnostics_to_compare=(
                "LCL",
                "RH near mixed-layer top",
                "first cloud time",
                "max cloud water",
            ),
        ),
        LowerAtmosphereV2ComparisonPair(
            id="baseline-vs-capped-suppressed",
            left_scenario_id="lower-atmosphere-v2-baseline-shallow-cloud",
            right_scenario_id="lower-atmosphere-v2-capped-suppressed-cloud",
            question_answered="How does a cap limit profile growth and cloud depth?",
            expected_difference="The capped case is suppressed or shallower than the baseline.",
            diagnostics_to_compare=(
                "inversion height",
                "cap suppression index",
                "cloud top proxy",
            ),
        ),
        LowerAtmosphereV2ComparisonPair(
            id="dry-surface-vs-moist-surface",
            left_scenario_id="lower-atmosphere-v2-dry-failed-cumulus",
            right_scenario_id="lower-atmosphere-v2-moist-surface-enables-cloud",
            question_answered="How does surface moisture flux change the outcome?",
            expected_difference=(
                "The moist surface lowers LCL or sustains RH enough to become favorable."
            ),
            diagnostics_to_compare=("surface moisture added", "LCL", "first favorable time"),
        ),
        LowerAtmosphereV2ComparisonPair(
            id="weak-heating-vs-strong-heating",
            left_scenario_id="lower-atmosphere-v2-dry-failed-cumulus",
            right_scenario_id="lower-atmosphere-v2-heating-lift-comparison",
            question_answered="What changes when the environment receives stronger heating?",
            expected_difference=(
                "Stronger heating deepens the mixed layer but still depends on moisture "
                "and cap state."
            ),
            diagnostics_to_compare=(
                "surface heating accumulated",
                "mixed-layer depth",
                "profile status",
            ),
        ),
        LowerAtmosphereV2ComparisonPair(
            id="weak-lift-vs-strong-lift",
            left_scenario_id="lower-atmosphere-v2-baseline-shallow-cloud",
            right_scenario_id="lower-atmosphere-v2-heating-lift-comparison",
            question_answered="How does prescribed lift strength affect cloud timing?",
            expected_difference=(
                "Stronger prescribed lift forms cloud earlier when the profile is moist enough."
            ),
            diagnostics_to_compare=("lift strength", "first cloud time", "max cloud water"),
        ),
        LowerAtmosphereV2ComparisonPair(
            id="weak-entrainment-vs-dry-entrainment",
            left_scenario_id="lower-atmosphere-v2-baseline-shallow-cloud",
            right_scenario_id="lower-atmosphere-v2-dry-entrainment-suppresses-cloud",
            question_answered="How does dry air aloft reduce cloud potential?",
            expected_difference=(
                "Dry entrainment raises LCL or lowers RH enough to delay or prevent cloud."
            ),
            diagnostics_to_compare=(
                "entrainment drying proxy",
                "RH near mixed-layer top",
                "LCL trend",
            ),
        ),
        LowerAtmosphereV2ComparisonPair(
            id="baseline-vs-humid-low-cloud-contrast",
            left_scenario_id="lower-atmosphere-v2-baseline-shallow-cloud",
            right_scenario_id="lower-atmosphere-v2-humid-low-cloud-contrast",
            question_answered="What changes when the LCL is very low?",
            expected_difference=(
                "The humid contrast forms lower cloud and should be labeled as a contrast case."
            ),
            diagnostics_to_compare=("LCL", "cloud base", "contrast-case warning"),
        ),
        LowerAtmosphereV2ComparisonPair(
            id="cloud-formed-vs-rain-capable-later",
            left_scenario_id="lower-atmosphere-v2-baseline-shallow-cloud",
            right_scenario_id="lower-atmosphere-v2-rain-capable-warm-cloud-later",
            question_answered="What would future rain diagnostics need beyond cloud formation?",
            expected_difference=(
                "Both can form cloud, but rain-capable later stays "
                "precipitation_not_enabled in early v2."
            ),
            diagnostics_to_compare=(
                "max cloud water",
                "cloud water duration",
                "precipitation status",
            ),
        ),
    ]


def _profile_configs_by_slug() -> dict[str, BoundaryLayer1DConfig]:
    return {
        scenario.slug: scenario.config.model_copy(deep=True)
        for scenario in boundary_layer_1d_scenarios()
    }


def _cloud_column_configs_by_slug() -> dict[str, CloudColumnConfig]:
    return {
        scenario.slug: scenario.config.model_copy(deep=True)
        for scenario in cloud_column_scenarios()
    }


def _humid_low_cloud_profile_config() -> BoundaryLayer1DConfig:
    return BoundaryLayer1DConfig(
        initial_surface_temperature_k=291.15,
        initial_mixed_layer_depth_m=220.0,
        initial_relative_humidity=0.92,
        free_atmosphere_relative_humidity=0.82,
        inversion_height_m=1_500.0,
        inversion_strength_k=1.2,
        surface_heating_strength=0.45,
        surface_moisture_flux_strength=0.65,
        entrainment_strength=0.12,
    )


def _rain_capable_column_config(base: CloudColumnConfig) -> CloudColumnConfig:
    return base.model_copy(
        deep=True,
        update={
            "forcing": base.forcing.model_copy(
                update={
                    "lift_duration_seconds": 1_500.0,
                    "runtime_seconds": 2_400.0,
                }
            )
        },
    )

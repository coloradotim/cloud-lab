from __future__ import annotations

import argparse
import json
from collections.abc import Callable
from dataclasses import dataclass
from math import isfinite, sqrt
from typing import Any

from app.sim.boussinesq_2d import (
    CONDENSATION_FRACTION_PER_STEP,
    EVAPORATION_FRACTION_PER_STEP,
    SUBSATURATED_CLOUD_EVAPORATION_FRACTION_PER_STEP,
)
from app.sim.presets import fair_weather_cumulus_preset
from app.sim.schemas import (
    BackgroundWindConfig,
    DomainConfig,
    GridConfig,
    HumidityProfilePattern,
    InitialAtmosphereConfig,
    SimulationConfig,
    SimulationFrame,
    SurfaceHeatingConfig,
    SurfaceHeatingPattern,
    TimeConfig,
)
from app.sim.solver import run_simulation
from app.sim.structured_fields import initial_relative_humidity
from app.sim.thermodynamics import (
    BOUSSINESQ_REFERENCE_SURFACE_PRESSURE_PA,
    lcl_height_m,
    pressure_at_height_pa,
    relative_humidity_from_specific_humidity,
)
from app.sim.thermodynamics import (
    saturation_specific_humidity_kg_per_kg as pressure_aware_saturation_specific_humidity_kg_per_kg,
)

CLOUD_TOP_THRESHOLD_KG_PER_KG = 1e-6
THERMODYNAMIC_CLOUD_THRESHOLD_KG_PER_KG = 1e-8
DIVERGENCE_VELOCITY_FLOOR_M_PER_S = 1e-3
DRY_ADIABATIC_LAPSE_RATE_K_PER_M = 0.0098
INITIAL_SATURATION_CAP_FRACTION = 0.98
SURFACE_MOISTURE_HUMIDITY_PROFILE = "surface_moisture"
MIXED_LAYER_HUMIDITY_PROFILES = {"uniform", "moist_boundary_layer"}
LCL_GRID_TOLERANCE_CELLS = 1.0
LCL_WARN_TOLERANCE_CELLS = 2.0
BELOW_LCL_WARN_FRACTION = 0.05
BELOW_LCL_FAIL_FRACTION = 0.20
BASE_SPREAD_WARN_CELLS = 2.0
BASE_SPREAD_FAIL_CELLS = 4.0
SUBSATURATED_RH_THRESHOLD = 0.99
NEAR_SURFACE_DEPTH_M = 250.0

ValidationStatus = str


@dataclass(frozen=True)
class BoussinesqReferenceCase:
    slug: str
    name: str
    description: str
    expected_regime: str
    config: SimulationConfig


@dataclass(frozen=True)
class BoussinesqModelSize:
    slug: str
    name: str
    description: str
    config_updates: dict[str, object]


@dataclass(frozen=True)
class BoussinesqDiagnostics:
    max_abs_horizontal_velocity_m_per_s: float
    max_abs_vertical_velocity_m_per_s: float
    max_velocity_m_per_s: float
    mean_velocity_m_per_s: float
    max_temperature_perturbation_k: float
    min_temperature_perturbation_k: float
    max_water_vapor_kg_per_kg: float
    max_cloud_liquid_water_kg_per_kg: float
    total_cloud_liquid_water_kg_per_kg: float
    cloud_top_height_m: float | None
    max_cloud_liquid_water_height_m: float | None
    max_abs_divergence_per_second: float
    mean_abs_divergence_per_second: float
    rms_divergence_per_second: float
    max_dimensionless_divergence: float
    rms_dimensionless_divergence: float
    non_finite_value_count: int
    min_moisture_kg_per_kg: float


@dataclass(frozen=True)
class BoussinesqThermodynamicValidationCase:
    slug: str
    name: str
    description: str
    config: SimulationConfig


@dataclass(frozen=True)
class MixedLayerDiagnostics:
    source_layer_top_m: float
    theta_spread_k: float
    water_vapor_spread_kg_per_kg: float
    relative_humidity_spread: float
    well_mixed: bool


@dataclass(frozen=True)
class CloudRegionDiagnostics:
    region_count: int
    cloud_base_heights_m: tuple[float, ...]
    cloud_top_heights_m: tuple[float, ...]
    cloud_base_spread_m: float | None
    cloud_top_spread_m: float | None


@dataclass(frozen=True)
class BoussinesqThermodynamicDiagnostics:
    expected_lcl_m: float
    initialized_profile: InitializedProfileDiagnostics
    first_cloud_time_seconds: float | None
    first_cloud_height_m: float | None
    first_cloud_lcl_delta_m: float | None
    max_cloud_height_m: float | None
    cloud_water_centroid_m: float | None
    total_cloud_water_kg_per_kg: float
    below_lcl_cloud_water_kg_per_kg: float
    below_lcl_cloud_fraction: float
    near_lcl_cloud_fraction: float
    above_lcl_cloud_fraction: float
    cloud_onset_relative_humidity: float | None
    cloud_onset_saturation_excess_kg_per_kg: float | None
    lifted_path_saturation_decreases: bool
    lifted_path_relative_humidity_increases: bool
    mixed_layer: MixedLayerDiagnostics
    cloud_regions: CloudRegionDiagnostics
    cloud_water_persistence: CloudWaterPersistenceDiagnostics
    boundary_cloud_fraction: float
    return_flow_cloud_fraction: float
    status: ValidationStatus
    notes: tuple[str, ...]


@dataclass(frozen=True)
class BoussinesqScenarioDiagnostics:
    cloud_coverage_fraction: float
    cloud_region_count: int
    cloud_top_height_m: float | None
    max_cloud_liquid_water_kg_per_kg: float
    max_abs_vertical_velocity_m_per_s: float
    expected_lcl_m: float
    boundary_layer_depth_m: float
    status: ValidationStatus
    notes: tuple[str, ...]


@dataclass(frozen=True)
class CloudWaterPersistenceDiagnostics:
    cloud_water_in_subsaturated_air_fraction: float
    cloud_water_in_subsaturated_air_mass_fraction: float
    cloud_water_in_subsaturated_air_cell_fraction: float
    cloud_water_in_downdraft_fraction: float
    cloud_water_in_return_flow_fraction: float
    cloud_water_below_lcl_fraction: float
    cloud_water_near_surface_fraction: float
    cloud_water_near_boundary_fraction: float
    cloud_water_lifetime_after_subsaturation_seconds: float | None
    evaporation_tendency_total_kg_per_kg_per_s: float
    condensation_tendency_total_kg_per_kg_per_s: float
    max_cloud_water_in_subsaturated_air_kg_per_kg: float
    subsaturated_cloud_min_height_m: float | None
    subsaturated_cloud_max_height_m: float | None


@dataclass(frozen=True)
class LiftedSaturationSanity:
    saturation_values_kg_per_kg: tuple[float, ...]
    relative_humidity_values: tuple[float, ...]
    saturation_decreases: bool
    relative_humidity_increases: bool


@dataclass(frozen=True)
class InitializedProfileDiagnostics:
    heights_m: tuple[float, ...]
    pressure_profile_pa: tuple[float, ...]
    temperature_profile_k: tuple[float, ...]
    water_vapor_profile_kg_per_kg: tuple[float, ...]
    relative_humidity_profile: tuple[float, ...]
    source_layer_vapor_spread_kg_per_kg: float
    source_layer_vapor_conserved: bool
    saturation_cap_cell_count: int
    saturation_cap_heights_m: tuple[float, ...]
    effective_source_layer_top_m: float
    transition_layer_bottom_m: float
    transition_layer_top_m: float
    initialized_saturation_height_m: float | None
    well_mixed_for_shared_cloud_base: bool


def boussinesq_reference_cases() -> list[BoussinesqReferenceCase]:
    base = fair_weather_cumulus_preset().config
    return [
        BoussinesqReferenceCase(
            slug="quiet-atmosphere",
            name="Quiet atmosphere / no forcing",
            description="Unsaturated unforced slice; should not invent motion or condensate.",
            expected_regime="quiet",
            config=_reference_config(
                base,
                duration_seconds=600.0,
                relative_humidity=0.65,
                heating_rate=0.0,
                lapse_rate=0.0065,
                wind_u=0.0,
                seed=11,
            ),
        ),
        BoussinesqReferenceCase(
            slug="dry-thermal-bubble",
            name="Dry thermal bubble",
            description="Dry heated patch; should create buoyant circulation without cloud water.",
            expected_regime="dry_thermal",
            config=_reference_config(
                base,
                duration_seconds=900.0,
                relative_humidity=0.45,
                heating_rate=0.016,
                lapse_rate=0.0075,
                wind_u=0.0,
                seed=13,
            ),
        ),
        BoussinesqReferenceCase(
            slug="isolated-fair-weather-cumulus",
            name="Isolated fair-weather cumulus",
            description="Moderately humid paired thermals; should form separated shallow clouds.",
            expected_regime="isolated_cumulus",
            config=_reference_config(
                base,
                duration_seconds=1_200.0,
                relative_humidity=0.85,
                heating_rate=0.024,
                lapse_rate=0.0065,
                wind_u=0.15,
                seed=17,
                boundary_layer_depth_m=1_500.0,
                moist_source_layer_depth_m=800.0,
                free_atmosphere_relative_humidity=0.55,
                humidity_profile="surface_moisture",
                heating_pattern="two_patches",
            ),
        ),
        BoussinesqReferenceCase(
            slug="humid-cloud-deck",
            name="Humid cloud deck",
            description="Very humid mixed layer; should warn as a broad deck-prone regime.",
            expected_regime="humid_deck",
            config=_reference_config(
                base,
                duration_seconds=1_200.0,
                relative_humidity=0.98,
                heating_rate=0.05,
                lapse_rate=0.0065,
                wind_u=0.25,
                seed=23,
                boundary_layer_depth_m=1_000.0,
                moist_source_layer_depth_m=1_000.0,
                free_atmosphere_relative_humidity=0.98,
                humidity_profile="uniform",
                heating_pattern="weak_random",
            ),
        ),
        BoussinesqReferenceCase(
            slug="deep-convection-candidate",
            name="Deep convection candidate",
            description="Warmer deeper domain; should grow taller than fair-weather cumulus.",
            expected_regime="deep_candidate",
            config=_reference_config(
                base,
                duration_seconds=1_800.0,
                relative_humidity=0.82,
                heating_rate=0.022,
                lapse_rate=0.0075,
                wind_u=0.10,
                seed=29,
                boundary_layer_depth_m=1_000.0,
                moist_source_layer_depth_m=900.0,
                free_atmosphere_relative_humidity=0.65,
                humidity_profile="surface_moisture",
                domain=DomainConfig(width_m=10_000.0, height_m=6_000.0),
                grid=GridConfig(columns=48, rows=48),
                surface_temperature_k=303.15,
            ),
        ),
    ]


def run_boussinesq_scenario_validation() -> dict[str, Any]:
    cases = []
    for case in boussinesq_reference_cases():
        frames = run_simulation(case.config)
        diagnostics = compute_boussinesq_scenario_diagnostics(case, frames)
        cases.append(
            {
                "slug": case.slug,
                "name": case.name,
                "description": case.description,
                "expected_regime": case.expected_regime,
                "status": diagnostics.status,
                "diagnostics": _scenario_diagnostics_to_dict(diagnostics),
            }
        )

    return {
        "schema_version": "boussinesq-scenario-validation-v1",
        "cases": cases,
    }


def format_boussinesq_scenario_summary(report: dict[str, Any]) -> str:
    lines: list[str] = []
    for case in report["cases"]:
        diagnostics = case["diagnostics"]
        lines.append(
            "case: {name}\n"
            "expected_regime: {expected_regime}\n"
            "cloud_coverage_fraction: {cloud_coverage_fraction:.3f}\n"
            "cloud_region_count: {cloud_region_count}\n"
            "cloud_top_height_m: {cloud_top_height_m}\n"
            "max_cloud_liquid_water_kg_per_kg: {max_cloud_liquid_water_kg_per_kg:.3e}\n"
            "max_abs_vertical_velocity_m_per_s: {max_abs_vertical_velocity_m_per_s:.3f}\n"
            "expected_lcl_m: {expected_lcl_m:.0f}\n"
            "boundary_layer_depth_m: {boundary_layer_depth_m:.0f}\n"
            "status: {status}\n"
            "notes: {notes}".format(
                name=case["name"],
                expected_regime=case["expected_regime"],
                cloud_coverage_fraction=diagnostics["cloud_coverage_fraction"],
                cloud_region_count=diagnostics["cloud_region_count"],
                cloud_top_height_m=_optional_metric(diagnostics["cloud_top_height_m"]),
                max_cloud_liquid_water_kg_per_kg=diagnostics["max_cloud_liquid_water_kg_per_kg"],
                max_abs_vertical_velocity_m_per_s=diagnostics["max_abs_vertical_velocity_m_per_s"],
                expected_lcl_m=diagnostics["expected_lcl_m"],
                boundary_layer_depth_m=diagnostics["boundary_layer_depth_m"],
                status=case["status"],
                notes="; ".join(diagnostics["notes"]) or "none",
            )
        )
    return "\n\n".join(lines)


def boussinesq_model_sizes() -> list[BoussinesqModelSize]:
    return [
        BoussinesqModelSize(
            slug="small",
            name="Small / quick",
            description="Fast interactive sanity check for local iteration and CI-like runs.",
            config_updates={
                "domain": DomainConfig(width_m=8_000.0, height_m=3_000.0),
                "grid": GridConfig(columns=30, rows=20),
                "time": TimeConfig(
                    time_step_seconds=2.0,
                    duration_seconds=600.0,
                    frame_interval_seconds=20.0,
                ),
            },
        ),
        BoussinesqModelSize(
            slug="medium",
            name="Medium / standard",
            description="Default manual validation scale with about 20 minutes of simulated time.",
            config_updates={
                "domain": DomainConfig(width_m=10_000.0, height_m=3_000.0),
                "grid": GridConfig(columns=36, rows=24),
                "time": TimeConfig(
                    time_step_seconds=2.0,
                    duration_seconds=1_200.0,
                    frame_interval_seconds=30.0,
                ),
            },
        ),
        BoussinesqModelSize(
            slug="large",
            name="Large / slow",
            description="Higher-resolution local inspection; expected to be slower on laptops.",
            config_updates={
                "domain": DomainConfig(width_m=12_000.0, height_m=4_000.0),
                "grid": GridConfig(columns=54, rows=36),
                "time": TimeConfig(
                    time_step_seconds=2.0,
                    duration_seconds=1_800.0,
                    frame_interval_seconds=30.0,
                ),
            },
        ),
    ]


def boussinesq_thermodynamic_validation_cases() -> list[BoussinesqThermodynamicValidationCase]:
    base = fair_weather_cumulus_preset().config
    humid = _reference_config(
        base,
        duration_seconds=1_200.0,
        relative_humidity=0.98,
        heating_rate=0.018,
        lapse_rate=0.0065,
        wind_u=0.2,
        seed=31,
    )
    drier = _reference_config(
        base,
        duration_seconds=1_200.0,
        relative_humidity=0.78,
        heating_rate=0.018,
        lapse_rate=0.0065,
        wind_u=0.2,
        seed=37,
    )
    warmer_drier = _reference_config(
        base,
        duration_seconds=1_200.0,
        relative_humidity=0.70,
        heating_rate=0.018,
        lapse_rate=0.0065,
        wind_u=0.2,
        seed=41,
    ).model_copy(
        update={
            "initial_atmosphere": InitialAtmosphereConfig(
                surface_temperature_k=303.15,
                lapse_rate_k_per_m=0.0065,
                relative_humidity=0.70,
                boundary_layer_depth_m=1_000.0,
            )
        }
    )
    multi_patch = humid.model_copy(
        update={
            "surface_heating": humid.surface_heating.model_copy(update={"pattern": "two_patches"}),
            "seed": 43,
        }
    )
    layered = humid.model_copy(
        update={
            "initial_atmosphere": humid.initial_atmosphere.model_copy(
                update={"relative_humidity": 0.82, "humidity_profile": "moist_layer"}
            ),
            "surface_heating": humid.surface_heating.model_copy(update={"pattern": "two_patches"}),
            "seed": 47,
        }
    )

    return [
        BoussinesqThermodynamicValidationCase(
            slug="humid-well-mixed-fair-weather",
            name="Humid well-mixed fair-weather",
            description="Humid fair-weather case for LCL/cloud-base consistency diagnostics.",
            config=humid,
        ),
        BoussinesqThermodynamicValidationCase(
            slug="drier-well-mixed-fair-weather",
            name="Drier well-mixed fair-weather",
            description=(
                "Drier source layer should raise the expected LCL and delay or suppress cloud."
            ),
            config=drier,
        ),
        BoussinesqThermodynamicValidationCase(
            slug="warmer-drier-fair-weather",
            name="Warmer/drier fair-weather",
            description=(
                "Warmer drier source layer should raise the expected LCL versus humid baseline."
            ),
            config=warmer_drier,
        ),
        BoussinesqThermodynamicValidationCase(
            slug="multi-patch-fair-weather",
            name="Multi-patch fair-weather",
            description=(
                "Multiple heating patches should produce clustered bases if source layer is mixed."
            ),
            config=multi_patch,
        ),
        BoussinesqThermodynamicValidationCase(
            slug="layered-moisture-fair-weather",
            name="Layered-moisture fair-weather",
            description="Layered humidity case should report that shared bases are less expected.",
            config=layered,
        ),
    ]


def run_boussinesq_thermodynamic_validation() -> dict[str, Any]:
    cases = []
    for case in boussinesq_thermodynamic_validation_cases():
        diagnostics = compute_boussinesq_thermodynamic_diagnostics(run_simulation(case.config))
        cases.append(
            {
                "slug": case.slug,
                "name": case.name,
                "description": case.description,
                "status": diagnostics.status,
                "diagnostics": _thermodynamic_diagnostics_to_dict(diagnostics),
            }
        )

    return {
        "schema_version": "boussinesq-thermodynamic-validation-v1",
        "thresholds": {
            "cloud_presence_threshold_kg_per_kg": THERMODYNAMIC_CLOUD_THRESHOLD_KG_PER_KG,
            "lcl_grid_tolerance_cells": LCL_GRID_TOLERANCE_CELLS,
            "lcl_warn_tolerance_cells": LCL_WARN_TOLERANCE_CELLS,
            "below_lcl_warn_fraction": BELOW_LCL_WARN_FRACTION,
            "below_lcl_fail_fraction": BELOW_LCL_FAIL_FRACTION,
            "base_spread_warn_cells": BASE_SPREAD_WARN_CELLS,
            "base_spread_fail_cells": BASE_SPREAD_FAIL_CELLS,
        },
        "cases": cases,
    }


def format_boussinesq_thermodynamic_summary(report: dict[str, Any]) -> str:
    lines: list[str] = []
    for case in report["cases"]:
        diagnostics = case["diagnostics"]
        lines.append(
            "case: {name}\n"
            "expected_lcl_m: {expected_lcl_m:.0f}\n"
            "first_cloud_height_m: {first_cloud_height_m}\n"
            "cloud_base_delta_m: {first_cloud_lcl_delta_m}\n"
            "below_lcl_cloud_fraction: {below_lcl_cloud_fraction:.3f}\n"
            "cloud_water_centroid_m: {cloud_water_centroid_m}\n"
            "cloud_base_spread_m: {cloud_base_spread_m}\n"
            "cloud_top_spread_m: {cloud_top_spread_m}\n"
            "mixed_layer_theta_spread_k: {mixed_layer_theta_spread_k:.3f}\n"
            "status: {status}\n"
            "notes: {notes}".format(
                name=case["name"],
                expected_lcl_m=diagnostics["expected_lcl_m"],
                first_cloud_height_m=_optional_metric(diagnostics["first_cloud_height_m"]),
                first_cloud_lcl_delta_m=_optional_metric(diagnostics["first_cloud_lcl_delta_m"]),
                below_lcl_cloud_fraction=diagnostics["below_lcl_cloud_fraction"],
                cloud_water_centroid_m=_optional_metric(diagnostics["cloud_water_centroid_m"]),
                cloud_base_spread_m=_optional_metric(diagnostics["cloud_base_spread_m"]),
                cloud_top_spread_m=_optional_metric(diagnostics["cloud_top_spread_m"]),
                mixed_layer_theta_spread_k=diagnostics["mixed_layer_theta_spread_k"],
                status=case["status"],
                notes="; ".join(diagnostics["notes"]) or "none",
            )
        )
    return "\n\n".join(lines)


def compute_lcl_height_m(temperature_k: float, relative_humidity: float) -> float:
    """Estimate LCL by dry-lifting a parcel through the pressure-aware profile."""

    return lcl_height_m(
        temperature_k,
        relative_humidity,
        surface_pressure_pa=BOUSSINESQ_REFERENCE_SURFACE_PRESSURE_PA,
    )


def compute_boussinesq_thermodynamic_diagnostics(
    frames: list[SimulationFrame],
) -> BoussinesqThermodynamicDiagnostics:
    if not frames:
        raise ValueError("at least one frame is required")

    initial = frames[0]
    final = frames[-1]
    dz_m = final.config.domain.height_m / final.grid.rows
    initialized_profile = compute_initialized_profile_diagnostics(initial)
    lcl_m = compute_lcl_height_m(
        initial.config.initial_atmosphere.surface_temperature_k,
        initial.config.initial_atmosphere.relative_humidity,
    )
    lcl_tolerance_m = dz_m * LCL_GRID_TOLERANCE_CELLS
    warn_tolerance_m = dz_m * LCL_WARN_TOLERANCE_CELLS
    mixed_layer = compute_mixed_layer_diagnostics(initial)
    first_cloud_frame = _first_cloud_frame(frames)
    first_cloud_height = (
        _lowest_cloud_height(first_cloud_frame) if first_cloud_frame is not None else None
    )
    onset_sample = _first_cloud_sample(first_cloud_frame) if first_cloud_frame is not None else None
    cloud_onset_rh = None
    cloud_onset_excess = None
    if first_cloud_frame is not None and onset_sample is not None:
        row_index, column_index = onset_sample
        temperature = first_cloud_frame.fields.temperature_k.values[row_index][column_index]
        vapor = first_cloud_frame.fields.water_vapor_kg_per_kg.values[row_index][column_index]
        pressure_pa = pressure_at_height_pa(
            first_cloud_frame.grid.z_coordinates_m[row_index],
            surface_pressure_pa=BOUSSINESQ_REFERENCE_SURFACE_PRESSURE_PA,
            scale_temperature_k=first_cloud_frame.config.initial_atmosphere.surface_temperature_k,
        )
        saturation = saturation_specific_humidity_kg_per_kg(temperature, pressure_pa)
        cloud_onset_rh = vapor / max(saturation, 1e-12)
        cloud_onset_excess = vapor - saturation

    cloud = final.fields.cloud_liquid_water_kg_per_kg.values
    total_cloud = sum(value for row in cloud for value in row)
    below_lcl_cloud = _cloud_water_below_height(final, lcl_m - lcl_tolerance_m)
    near_lcl_cloud = _cloud_water_between_heights(
        final,
        lcl_m - lcl_tolerance_m,
        lcl_m + lcl_tolerance_m,
    )
    above_lcl_cloud = _cloud_water_above_height(final, lcl_m + lcl_tolerance_m)
    regions = compute_cloud_region_diagnostics(final)
    centroid = _cloud_water_centroid(final)
    max_height = _max_cloud_height(final)
    boundary_cloud = _boundary_cloud_fraction(final)
    return_flow_cloud = _return_flow_cloud_fraction(final)
    persistence = compute_cloud_water_persistence_diagnostics(frames, expected_lcl_m=lcl_m)
    lifted_path = lifted_saturation_sanity_path(
        initial.config.initial_atmosphere.surface_temperature_k,
        initial.config.initial_atmosphere.relative_humidity,
    )
    notes: list[str] = []
    status_rank = 0

    if not mixed_layer.well_mixed:
        notes.append("source layer is not well mixed; shared cloud bases are less expected")
        status_rank = max(status_rank, 1)
    if initialized_profile.saturation_cap_cell_count > 0:
        notes.append("source-layer vapor was capped against local saturation during initialization")
        status_rank = max(status_rank, 1)
    if not initialized_profile.source_layer_vapor_conserved:
        notes.append("initialized source-layer vapor is not conserved with height")
        status_rank = max(status_rank, 1)
    if first_cloud_height is None:
        notes.append("no cloud water formed above threshold")
    else:
        delta = first_cloud_height - lcl_m
        if delta < -warn_tolerance_m:
            notes.append("cloud onset is well below expected LCL")
            status_rank = max(status_rank, 2)
        elif delta < -lcl_tolerance_m:
            notes.append("cloud onset is somewhat below expected LCL")
            status_rank = max(status_rank, 1)
        else:
            notes.append("cloud onset is near or above expected LCL tolerance")

    below_fraction = below_lcl_cloud / total_cloud if total_cloud > 0.0 else 0.0
    if below_fraction >= BELOW_LCL_FAIL_FRACTION:
        notes.append("significant cloud water lies below expected LCL")
        status_rank = max(status_rank, 2)
    elif below_fraction >= BELOW_LCL_WARN_FRACTION:
        notes.append("small but nonzero cloud water lies below expected LCL")
        status_rank = max(status_rank, 1)

    if cloud_onset_rh is not None and cloud_onset_rh < 0.98:
        notes.append("cloud onset cell is not near saturation by diagnostic RH")
        status_rank = max(status_rank, 1)
    if not lifted_path.saturation_decreases or not lifted_path.relative_humidity_increases:
        notes.append("synthetic lifted-path saturation sanity check failed")
        status_rank = max(status_rank, 2)
    if boundary_cloud > 0.10:
        notes.append("more than 10% of cloud water is in boundary rows or columns")
        status_rank = max(status_rank, 1)
    if return_flow_cloud > 0.10:
        notes.append("more than 10% of cloud water is in low-level return-flow regions")
        status_rank = max(status_rank, 1)
    if persistence.cloud_water_in_subsaturated_air_mass_fraction > 0.05:
        notes.append("cloud water persists in diagnostically subsaturated air")
        status_rank = max(status_rank, 1)
    if (
        mixed_layer.well_mixed
        and regions.cloud_base_spread_m is not None
        and regions.region_count > 1
    ):
        if regions.cloud_base_spread_m > dz_m * BASE_SPREAD_FAIL_CELLS:
            notes.append("cloud-base spread is large for a well-mixed source layer")
            status_rank = max(status_rank, 2)
        elif regions.cloud_base_spread_m > dz_m * BASE_SPREAD_WARN_CELLS:
            notes.append("cloud-base spread is elevated for a well-mixed source layer")
            status_rank = max(status_rank, 1)

    status = ("pass", "warn", "fail")[status_rank]
    return BoussinesqThermodynamicDiagnostics(
        expected_lcl_m=lcl_m,
        initialized_profile=initialized_profile,
        first_cloud_time_seconds=first_cloud_frame.time_seconds if first_cloud_frame else None,
        first_cloud_height_m=first_cloud_height,
        first_cloud_lcl_delta_m=(
            first_cloud_height - lcl_m if first_cloud_height is not None else None
        ),
        max_cloud_height_m=max_height,
        cloud_water_centroid_m=centroid,
        total_cloud_water_kg_per_kg=total_cloud,
        below_lcl_cloud_water_kg_per_kg=below_lcl_cloud,
        below_lcl_cloud_fraction=below_fraction,
        near_lcl_cloud_fraction=near_lcl_cloud / total_cloud if total_cloud > 0.0 else 0.0,
        above_lcl_cloud_fraction=above_lcl_cloud / total_cloud if total_cloud > 0.0 else 0.0,
        cloud_onset_relative_humidity=cloud_onset_rh,
        cloud_onset_saturation_excess_kg_per_kg=cloud_onset_excess,
        lifted_path_saturation_decreases=lifted_path.saturation_decreases,
        lifted_path_relative_humidity_increases=lifted_path.relative_humidity_increases,
        mixed_layer=mixed_layer,
        cloud_regions=regions,
        cloud_water_persistence=persistence,
        boundary_cloud_fraction=boundary_cloud,
        return_flow_cloud_fraction=return_flow_cloud,
        status=status,
        notes=tuple(notes),
    )


def compute_cloud_water_persistence_diagnostics(
    frames: list[SimulationFrame],
    *,
    expected_lcl_m: float | None = None,
) -> CloudWaterPersistenceDiagnostics:
    if not frames:
        raise ValueError("at least one frame is required")

    final = frames[-1]
    lcl_m = (
        expected_lcl_m
        if expected_lcl_m is not None
        else compute_lcl_height_m(
            final.config.initial_atmosphere.surface_temperature_k,
            final.config.initial_atmosphere.relative_humidity,
        )
    )
    total_cloud = 0.0
    cloudy_cells = 0
    subsaturated_cloud = 0.0
    subsaturated_cells = 0
    downdraft_cloud = 0.0
    return_flow_cloud = 0.0
    below_lcl_cloud = 0.0
    near_surface_cloud = 0.0
    boundary_cloud = 0.0
    evaporation_tendency_total = 0.0
    condensation_tendency_total = 0.0
    max_subsaturated_cloud = 0.0
    subsaturated_heights: list[float] = []

    for row_index, row in enumerate(final.fields.cloud_liquid_water_kg_per_kg.values):
        z_m = final.grid.z_coordinates_m[row_index]
        pressure_pa = pressure_at_height_pa(
            z_m,
            surface_pressure_pa=BOUSSINESQ_REFERENCE_SURFACE_PRESSURE_PA,
            scale_temperature_k=final.config.initial_atmosphere.surface_temperature_k,
        )
        for column_index, cloud in enumerate(row):
            if cloud <= THERMODYNAMIC_CLOUD_THRESHOLD_KG_PER_KG:
                continue

            total_cloud += cloud
            cloudy_cells += 1
            temperature = final.fields.temperature_k.values[row_index][column_index]
            vapor = final.fields.water_vapor_kg_per_kg.values[row_index][column_index]
            saturation = pressure_aware_saturation_specific_humidity_kg_per_kg(
                temperature,
                pressure_pa,
            )
            relative_humidity = vapor / max(saturation, 1e-12)
            vertical_velocity = final.fields.vertical_velocity_m_per_s.values[row_index][
                column_index
            ]
            is_boundary = (
                row_index == 0
                or row_index == final.grid.rows - 1
                or column_index == 0
                or column_index == final.grid.columns - 1
            )

            if relative_humidity < SUBSATURATED_RH_THRESHOLD:
                subsaturated_cloud += cloud
                subsaturated_cells += 1
                max_subsaturated_cloud = max(max_subsaturated_cloud, cloud)
                subsaturated_heights.append(z_m)

            if vertical_velocity < 0.0:
                downdraft_cloud += cloud
                if z_m <= final.config.initial_atmosphere.boundary_layer_depth_m:
                    return_flow_cloud += cloud
            if z_m < lcl_m:
                below_lcl_cloud += cloud
            if z_m <= NEAR_SURFACE_DEPTH_M:
                near_surface_cloud += cloud
            if is_boundary:
                boundary_cloud += cloud

            local_deficit = max(0.0, saturation - vapor)
            local_excess = max(0.0, vapor - saturation)
            evaporation_tendency_total += (
                min(
                    cloud,
                    local_deficit * EVAPORATION_FRACTION_PER_STEP
                    + (
                        cloud * SUBSATURATED_CLOUD_EVAPORATION_FRACTION_PER_STEP
                        if local_deficit > 0.0
                        else 0.0
                    ),
                )
                / final.config.time.time_step_seconds
            )
            condensation_tendency_total += (
                local_excess * CONDENSATION_FRACTION_PER_STEP / final.config.time.time_step_seconds
            )

    lifetime_after_subsaturation = _cloud_water_lifetime_after_subsaturation(frames)
    if total_cloud == 0.0:
        return CloudWaterPersistenceDiagnostics(
            cloud_water_in_subsaturated_air_fraction=0.0,
            cloud_water_in_subsaturated_air_mass_fraction=0.0,
            cloud_water_in_subsaturated_air_cell_fraction=0.0,
            cloud_water_in_downdraft_fraction=0.0,
            cloud_water_in_return_flow_fraction=0.0,
            cloud_water_below_lcl_fraction=0.0,
            cloud_water_near_surface_fraction=0.0,
            cloud_water_near_boundary_fraction=0.0,
            cloud_water_lifetime_after_subsaturation_seconds=lifetime_after_subsaturation,
            evaporation_tendency_total_kg_per_kg_per_s=0.0,
            condensation_tendency_total_kg_per_kg_per_s=0.0,
            max_cloud_water_in_subsaturated_air_kg_per_kg=0.0,
            subsaturated_cloud_min_height_m=None,
            subsaturated_cloud_max_height_m=None,
        )

    subsaturated_cell_fraction = subsaturated_cells / cloudy_cells if cloudy_cells else 0.0
    return CloudWaterPersistenceDiagnostics(
        cloud_water_in_subsaturated_air_fraction=subsaturated_cloud / total_cloud,
        cloud_water_in_subsaturated_air_mass_fraction=subsaturated_cloud / total_cloud,
        cloud_water_in_subsaturated_air_cell_fraction=subsaturated_cell_fraction,
        cloud_water_in_downdraft_fraction=downdraft_cloud / total_cloud,
        cloud_water_in_return_flow_fraction=return_flow_cloud / total_cloud,
        cloud_water_below_lcl_fraction=below_lcl_cloud / total_cloud,
        cloud_water_near_surface_fraction=near_surface_cloud / total_cloud,
        cloud_water_near_boundary_fraction=boundary_cloud / total_cloud,
        cloud_water_lifetime_after_subsaturation_seconds=lifetime_after_subsaturation,
        evaporation_tendency_total_kg_per_kg_per_s=evaporation_tendency_total,
        condensation_tendency_total_kg_per_kg_per_s=condensation_tendency_total,
        max_cloud_water_in_subsaturated_air_kg_per_kg=max_subsaturated_cloud,
        subsaturated_cloud_min_height_m=min(subsaturated_heights) if subsaturated_heights else None,
        subsaturated_cloud_max_height_m=max(subsaturated_heights) if subsaturated_heights else None,
    )


def compute_boussinesq_scenario_diagnostics(
    case: BoussinesqReferenceCase,
    frames: list[SimulationFrame],
) -> BoussinesqScenarioDiagnostics:
    if not frames:
        raise ValueError("at least one frame is required")

    final = frames[-1]
    dynamics = compute_boussinesq_diagnostics(final)
    thermo = compute_boussinesq_thermodynamic_diagnostics(frames)
    cloud_coverage = _cloud_coverage_fraction(final)
    status_rank = 0
    notes: list[str] = []

    if dynamics.non_finite_value_count:
        notes.append("non-finite values appeared in final frame")
        status_rank = max(status_rank, 2)
    if dynamics.min_moisture_kg_per_kg < -1e-12:
        notes.append("negative moisture appeared in final frame")
        status_rank = max(status_rank, 2)

    if case.expected_regime == "quiet":
        if dynamics.max_cloud_liquid_water_kg_per_kg > 0.0:
            notes.append("quiet scenario produced cloud water")
            status_rank = max(status_rank, 2)
        if dynamics.max_abs_vertical_velocity_m_per_s > 1e-9:
            notes.append("quiet scenario produced vertical motion")
            status_rank = max(status_rank, 2)
    elif case.expected_regime == "dry_thermal":
        if dynamics.max_cloud_liquid_water_kg_per_kg > 1e-8:
            notes.append("dry thermal produced condensate")
            status_rank = max(status_rank, 2)
        if dynamics.max_abs_vertical_velocity_m_per_s < 0.05:
            notes.append("dry thermal did not develop a resolved circulation")
            status_rank = max(status_rank, 1)
    elif case.expected_regime == "isolated_cumulus":
        if cloud_coverage < 0.002:
            notes.append("isolated cumulus scenario produced too little cloud")
            status_rank = max(status_rank, 2)
        if cloud_coverage > 0.20:
            notes.append("isolated cumulus scenario produced a broad cloud shield")
            status_rank = max(status_rank, 2)
        if thermo.cloud_regions.region_count < 2:
            notes.append("paired heating did not leave separated cloud regions")
            status_rank = max(status_rank, 1)
        if thermo.cloud_regions.region_count > 4:
            notes.append("cloud field fragmented into too many regions")
            status_rank = max(status_rank, 1)
    elif case.expected_regime == "humid_deck":
        if cloud_coverage < 0.20:
            notes.append("humid deck scenario did not produce a broad cloud field")
            status_rank = max(status_rank, 1)
        if thermo.expected_lcl_m >= case.config.initial_atmosphere.boundary_layer_depth_m:
            notes.append("humid deck setup no longer has LCL inside the mixed layer")
            status_rank = max(status_rank, 1)
    elif case.expected_regime == "deep_candidate":
        if dynamics.cloud_top_height_m is None or dynamics.cloud_top_height_m < 1_500.0:
            notes.append("deep candidate did not grow above shallow-cumulus depth")
            status_rank = max(status_rank, 1)
        if dynamics.max_cloud_liquid_water_kg_per_kg >= 0.009:
            notes.append("deep candidate hit the cloud-water limiter")
            status_rank = max(status_rank, 1)

    if case.expected_regime in {"quiet", "dry_thermal"}:
        pass
    elif thermo.status == "fail":
        notes.append("thermodynamic diagnostics failed")
        status_rank = max(status_rank, 2)
    elif thermo.status == "warn":
        notes.append("thermodynamic diagnostics warned")
        status_rank = max(status_rank, 1)

    if not notes:
        notes.append("scenario matched its coarse expected regime")

    return BoussinesqScenarioDiagnostics(
        cloud_coverage_fraction=cloud_coverage,
        cloud_region_count=thermo.cloud_regions.region_count,
        cloud_top_height_m=dynamics.cloud_top_height_m,
        max_cloud_liquid_water_kg_per_kg=dynamics.max_cloud_liquid_water_kg_per_kg,
        max_abs_vertical_velocity_m_per_s=dynamics.max_abs_vertical_velocity_m_per_s,
        expected_lcl_m=thermo.expected_lcl_m,
        boundary_layer_depth_m=case.config.initial_atmosphere.boundary_layer_depth_m,
        status=("pass", "warn", "fail")[status_rank],
        notes=tuple(notes),
    )


def compute_boussinesq_diagnostics(frame: SimulationFrame) -> BoussinesqDiagnostics:
    fields = frame.fields
    divergence = compute_divergence_field(frame)
    speed = _speed_grid(
        fields.horizontal_velocity_m_per_s.values,
        fields.vertical_velocity_m_per_s.values,
    )
    max_velocity = _max(speed)
    mean_velocity = _mean(speed)
    max_abs_divergence = _max_abs(divergence)
    rms_divergence = _rms(divergence)
    length_scale_m = min(
        frame.config.domain.width_m / frame.grid.columns,
        frame.config.domain.height_m / frame.grid.rows,
    )
    dimensionless_velocity_scale = max(max_velocity, DIVERGENCE_VELOCITY_FLOOR_M_PER_S)
    cloud_top_height_m: float | None = None
    max_cloud_height_m: float | None = None
    max_cloud = _max(fields.cloud_liquid_water_kg_per_kg.values)
    for row_index, row in enumerate(fields.cloud_liquid_water_kg_per_kg.values):
        if max(row) > CLOUD_TOP_THRESHOLD_KG_PER_KG:
            cloud_top_height_m = frame.grid.z_coordinates_m[row_index]
        if max_cloud > 0.0 and max(row) == max_cloud:
            max_cloud_height_m = frame.grid.z_coordinates_m[row_index]

    moisture_values = [
        value
        for field in (
            fields.water_vapor_kg_per_kg,
            fields.cloud_liquid_water_kg_per_kg,
            fields.rain_water_kg_per_kg,
        )
        for row in field.values
        for value in row
    ]
    all_values = [value for field in fields for row in field[1].values for value in row]

    return BoussinesqDiagnostics(
        max_abs_horizontal_velocity_m_per_s=_max_abs(fields.horizontal_velocity_m_per_s.values),
        max_abs_vertical_velocity_m_per_s=_max_abs(fields.vertical_velocity_m_per_s.values),
        max_velocity_m_per_s=max_velocity,
        mean_velocity_m_per_s=mean_velocity,
        max_temperature_perturbation_k=_max(fields.temperature_perturbation_k.values),
        min_temperature_perturbation_k=_min(fields.temperature_perturbation_k.values),
        max_water_vapor_kg_per_kg=_max(fields.water_vapor_kg_per_kg.values),
        max_cloud_liquid_water_kg_per_kg=max_cloud,
        total_cloud_liquid_water_kg_per_kg=sum(
            value for row in fields.cloud_liquid_water_kg_per_kg.values for value in row
        ),
        cloud_top_height_m=cloud_top_height_m,
        max_cloud_liquid_water_height_m=max_cloud_height_m,
        max_abs_divergence_per_second=max_abs_divergence,
        mean_abs_divergence_per_second=_mean_abs(divergence),
        rms_divergence_per_second=rms_divergence,
        max_dimensionless_divergence=(
            max_abs_divergence * length_scale_m / dimensionless_velocity_scale
        ),
        rms_dimensionless_divergence=(
            rms_divergence * length_scale_m / dimensionless_velocity_scale
        ),
        non_finite_value_count=sum(1 for value in all_values if not isfinite(value)),
        min_moisture_kg_per_kg=min(moisture_values),
    )


def compute_mixed_layer_diagnostics(frame: SimulationFrame) -> MixedLayerDiagnostics:
    source_layer_top = min(
        frame.config.initial_atmosphere.boundary_layer_depth_m,
        frame.config.domain.height_m,
    )
    theta_values: list[float] = []
    vapor_values: list[float] = []
    rh_values: list[float] = []

    for row_index, z_m in enumerate(frame.grid.z_coordinates_m):
        if z_m > source_layer_top:
            continue
        for column_index in range(frame.grid.columns):
            temperature = frame.fields.temperature_k.values[row_index][column_index]
            vapor = frame.fields.water_vapor_kg_per_kg.values[row_index][column_index]
            pressure_pa = pressure_at_height_pa(
                z_m,
                surface_pressure_pa=BOUSSINESQ_REFERENCE_SURFACE_PRESSURE_PA,
                scale_temperature_k=frame.config.initial_atmosphere.surface_temperature_k,
            )
            theta_values.append(temperature + DRY_ADIABATIC_LAPSE_RATE_K_PER_M * z_m)
            vapor_values.append(vapor)
            rh_values.append(
                relative_humidity_from_specific_humidity(temperature, vapor, pressure_pa)
            )

    theta_spread = _spread(theta_values)
    vapor_spread = _spread(vapor_values)
    rh_spread = _spread(rh_values)
    return MixedLayerDiagnostics(
        source_layer_top_m=source_layer_top,
        theta_spread_k=theta_spread,
        water_vapor_spread_kg_per_kg=vapor_spread,
        relative_humidity_spread=rh_spread,
        well_mixed=theta_spread <= 0.5 and vapor_spread <= 0.002,
    )


def compute_initialized_profile_diagnostics(
    frame: SimulationFrame,
) -> InitializedProfileDiagnostics:
    heights: list[float] = []
    pressures: list[float] = []
    temperatures: list[float] = []
    vapors: list[float] = []
    relative_humidities: list[float] = []
    capped_heights: set[float] = set()
    capped_cells = 0
    source_layer_vapor_values: list[float] = []
    initialized_saturation_height_m: float | None = None

    for row_index, z_m in enumerate(frame.grid.z_coordinates_m):
        row_temperatures = frame.fields.temperature_k.values[row_index]
        row_vapors = frame.fields.water_vapor_kg_per_kg.values[row_index]
        pressure_pa = pressure_at_height_pa(
            z_m,
            surface_pressure_pa=BOUSSINESQ_REFERENCE_SURFACE_PRESSURE_PA,
            scale_temperature_k=frame.config.initial_atmosphere.surface_temperature_k,
        )
        row_rh = [
            relative_humidity_from_specific_humidity(temperature, vapor, pressure_pa)
            for temperature, vapor in zip(row_temperatures, row_vapors, strict=False)
        ]

        heights.append(z_m)
        pressures.append(pressure_pa)
        temperatures.append(sum(row_temperatures) / len(row_temperatures))
        vapors.append(sum(row_vapors) / len(row_vapors))
        relative_humidities.append(sum(row_rh) / len(row_rh))

        if initialized_saturation_height_m is None and max(row_rh, default=0.0) >= 1.0:
            initialized_saturation_height_m = z_m

        for column_index, (temperature, vapor) in enumerate(
            zip(row_temperatures, row_vapors, strict=False)
        ):
            if z_m <= _effective_source_layer_top_m(frame.config):
                source_layer_vapor_values.append(vapor)
            if _source_layer_vapor_was_capped(
                frame.config,
                frame.grid.x_coordinates_m[column_index],
                z_m,
                temperature,
                vapor,
            ):
                capped_cells += 1
                capped_heights.add(z_m)

    source_layer_vapor_spread = _spread(source_layer_vapor_values)
    return InitializedProfileDiagnostics(
        heights_m=tuple(heights),
        pressure_profile_pa=tuple(pressures),
        temperature_profile_k=tuple(temperatures),
        water_vapor_profile_kg_per_kg=tuple(vapors),
        relative_humidity_profile=tuple(relative_humidities),
        source_layer_vapor_spread_kg_per_kg=source_layer_vapor_spread,
        source_layer_vapor_conserved=source_layer_vapor_spread <= 0.002,
        saturation_cap_cell_count=capped_cells,
        saturation_cap_heights_m=tuple(sorted(capped_heights)),
        effective_source_layer_top_m=_effective_source_layer_top_m(frame.config),
        transition_layer_bottom_m=_transition_layer_bottom_m(frame.config),
        transition_layer_top_m=_transition_layer_top_m(frame.config),
        initialized_saturation_height_m=initialized_saturation_height_m,
        well_mixed_for_shared_cloud_base=source_layer_vapor_spread <= 0.002
        and _spread(relative_humidities) <= 0.35,
    )


def saturation_specific_humidity_kg_per_kg(
    temperature_k: float,
    pressure_pa: float = BOUSSINESQ_REFERENCE_SURFACE_PRESSURE_PA,
) -> float:
    return pressure_aware_saturation_specific_humidity_kg_per_kg(temperature_k, pressure_pa)


def lifted_saturation_sanity_path(
    surface_temperature_k: float,
    relative_humidity: float,
    *,
    lift_step_m: float = 100.0,
    steps: int = 8,
) -> LiftedSaturationSanity:
    initial_saturation = saturation_specific_humidity_kg_per_kg(
        surface_temperature_k,
        pressure_at_height_pa(
            0.0,
            surface_pressure_pa=BOUSSINESQ_REFERENCE_SURFACE_PRESSURE_PA,
            scale_temperature_k=surface_temperature_k,
        ),
    )
    vapor = initial_saturation * relative_humidity
    saturation_values = []
    rh_values = []

    for step in range(steps + 1):
        height_m = lift_step_m * step
        temperature = surface_temperature_k - DRY_ADIABATIC_LAPSE_RATE_K_PER_M * height_m
        pressure_pa = pressure_at_height_pa(
            height_m,
            surface_pressure_pa=BOUSSINESQ_REFERENCE_SURFACE_PRESSURE_PA,
            scale_temperature_k=surface_temperature_k,
        )
        saturation = saturation_specific_humidity_kg_per_kg(temperature, pressure_pa)
        saturation_values.append(saturation)
        rh_values.append(vapor / max(saturation, 1e-12))

    return LiftedSaturationSanity(
        saturation_values_kg_per_kg=tuple(saturation_values),
        relative_humidity_values=tuple(rh_values),
        saturation_decreases=all(
            current < previous
            for previous, current in zip(saturation_values, saturation_values[1:], strict=False)
        ),
        relative_humidity_increases=all(
            current > previous for previous, current in zip(rh_values, rh_values[1:], strict=False)
        ),
    )


def compute_cloud_region_diagnostics(
    frame: SimulationFrame,
    *,
    threshold_kg_per_kg: float = THERMODYNAMIC_CLOUD_THRESHOLD_KG_PER_KG,
) -> CloudRegionDiagnostics:
    cloud = frame.fields.cloud_liquid_water_kg_per_kg.values
    cloudy_columns = [
        any(row[column_index] > threshold_kg_per_kg for row in cloud)
        for column_index in range(frame.grid.columns)
    ]
    regions: list[tuple[int, int]] = []
    start: int | None = None
    for column_index, is_cloudy in enumerate(cloudy_columns):
        if is_cloudy and start is None:
            start = column_index
        elif not is_cloudy and start is not None:
            regions.append((start, column_index - 1))
            start = None
    if start is not None:
        regions.append((start, frame.grid.columns - 1))

    base_heights: list[float] = []
    top_heights: list[float] = []
    for start_column, end_column in regions:
        cloudy_rows = [
            row_index
            for row_index, row in enumerate(cloud)
            if any(
                row[column_index] > threshold_kg_per_kg
                for column_index in range(start_column, end_column + 1)
            )
        ]
        if cloudy_rows:
            base_heights.append(frame.grid.z_coordinates_m[min(cloudy_rows)])
            top_heights.append(frame.grid.z_coordinates_m[max(cloudy_rows)])

    return CloudRegionDiagnostics(
        region_count=len(base_heights),
        cloud_base_heights_m=tuple(base_heights),
        cloud_top_heights_m=tuple(top_heights),
        cloud_base_spread_m=_spread(base_heights) if len(base_heights) > 1 else None,
        cloud_top_spread_m=_spread(top_heights) if len(top_heights) > 1 else None,
    )


def compute_divergence_field(frame: SimulationFrame) -> list[list[float]]:
    """Compute du/dx + dw/dz on the frame grid in s^-1.

    The Boussinesq streamfunction solve stores only physical frame cells, not ghost
    cells. Centered derivatives are therefore the numerically consistent diagnostic
    stencil; edge cells are filled from the nearest centered interior value instead
    of inventing a one-sided wall stencil that is not part of the solver.
    """

    u = frame.fields.horizontal_velocity_m_per_s.values
    w = frame.fields.vertical_velocity_m_per_s.values
    dx_m = frame.config.domain.width_m / frame.grid.columns
    dz_m = frame.config.domain.height_m / frame.grid.rows
    rows = frame.grid.rows
    columns = frame.grid.columns
    divergence = [[0.0 for _ in range(columns)] for _ in range(rows)]

    for row_index in range(1, rows - 1):
        for column_index in range(1, columns - 1):
            du_dx = (u[row_index][column_index + 1] - u[row_index][column_index - 1]) / (2.0 * dx_m)
            dw_dz = (w[row_index + 1][column_index] - w[row_index - 1][column_index]) / (2.0 * dz_m)
            divergence[row_index][column_index] = du_dx + dw_dz

    _fill_boundary_from_nearest_interior(divergence)

    return divergence


def _effective_source_layer_top_m(config: SimulationConfig) -> float:
    return min(
        config.initial_atmosphere.moist_source_layer_depth_m,
        config.initial_atmosphere.boundary_layer_depth_m,
        config.domain.height_m,
    )


def _transition_layer_bottom_m(config: SimulationConfig) -> float:
    if config.initial_atmosphere.humidity_profile != SURFACE_MOISTURE_HUMIDITY_PROFILE:
        return _effective_source_layer_top_m(config)
    return _effective_source_layer_top_m(config)


def _transition_layer_top_m(config: SimulationConfig) -> float:
    if config.initial_atmosphere.humidity_profile != SURFACE_MOISTURE_HUMIDITY_PROFILE:
        return _effective_source_layer_top_m(config)
    transition_depth = max(config.domain.height_m * 0.08, 200.0)
    return min(config.domain.height_m, _effective_source_layer_top_m(config) + transition_depth)


def _source_layer_vapor_was_capped(
    config: SimulationConfig,
    x_m: float,
    z_m: float,
    temperature_k: float,
    vapor_kg_per_kg: float,
) -> bool:
    if config.initial_atmosphere.humidity_profile not in (
        {SURFACE_MOISTURE_HUMIDITY_PROFILE} | MIXED_LAYER_HUMIDITY_PROFILES
    ):
        return False
    if z_m > _transition_layer_top_m(config):
        return False

    pressure_pa = pressure_at_height_pa(
        z_m,
        surface_pressure_pa=BOUSSINESQ_REFERENCE_SURFACE_PRESSURE_PA,
        scale_temperature_k=config.initial_atmosphere.surface_temperature_k,
    )
    local_cap = (
        saturation_specific_humidity_kg_per_kg(temperature_k, pressure_pa)
        * INITIAL_SATURATION_CAP_FRACTION
    )
    surface_saturation = saturation_specific_humidity_kg_per_kg(
        config.initial_atmosphere.surface_temperature_k,
        pressure_at_height_pa(
            0.0,
            surface_pressure_pa=BOUSSINESQ_REFERENCE_SURFACE_PRESSURE_PA,
            scale_temperature_k=config.initial_atmosphere.surface_temperature_k,
        ),
    )
    source_vapor = surface_saturation * initial_relative_humidity(config, x_m, 0.0)
    return source_vapor > local_cap and abs(vapor_kg_per_kg - local_cap) <= max(
        1e-8,
        local_cap * 1e-4,
    )


def _first_cloud_frame(frames: list[SimulationFrame]) -> SimulationFrame | None:
    return next(
        (
            frame
            for frame in frames
            if _max(frame.fields.cloud_liquid_water_kg_per_kg.values)
            > THERMODYNAMIC_CLOUD_THRESHOLD_KG_PER_KG
        ),
        None,
    )


def _first_cloud_sample(frame: SimulationFrame | None) -> tuple[int, int] | None:
    if frame is None:
        return None

    cloud = frame.fields.cloud_liquid_water_kg_per_kg.values
    for row_index, row in enumerate(cloud):
        for column_index, value in enumerate(row):
            if value > THERMODYNAMIC_CLOUD_THRESHOLD_KG_PER_KG:
                return row_index, column_index
    return None


def _lowest_cloud_height(frame: SimulationFrame | None) -> float | None:
    sample = _first_cloud_sample(frame)
    if frame is None or sample is None:
        return None
    return frame.grid.z_coordinates_m[sample[0]]


def _max_cloud_height(frame: SimulationFrame) -> float | None:
    cloud = frame.fields.cloud_liquid_water_kg_per_kg.values
    max_cloud = _max(cloud)
    if max_cloud <= THERMODYNAMIC_CLOUD_THRESHOLD_KG_PER_KG:
        return None
    for row_index, row in enumerate(cloud):
        if max(row) == max_cloud:
            return frame.grid.z_coordinates_m[row_index]
    return None


def _cloud_water_centroid(frame: SimulationFrame) -> float | None:
    total = 0.0
    weighted = 0.0
    for row_index, row in enumerate(frame.fields.cloud_liquid_water_kg_per_kg.values):
        z_m = frame.grid.z_coordinates_m[row_index]
        for value in row:
            if value > THERMODYNAMIC_CLOUD_THRESHOLD_KG_PER_KG:
                total += value
                weighted += value * z_m
    if total == 0.0:
        return None
    return weighted / total


def _cloud_water_below_height(frame: SimulationFrame, height_m: float) -> float:
    return _cloud_water_where(frame, lambda z_m: z_m < height_m)


def _cloud_water_above_height(frame: SimulationFrame, height_m: float) -> float:
    return _cloud_water_where(frame, lambda z_m: z_m > height_m)


def _cloud_water_between_heights(frame: SimulationFrame, bottom_m: float, top_m: float) -> float:
    return _cloud_water_where(frame, lambda z_m: bottom_m <= z_m <= top_m)


def _cloud_water_where(frame: SimulationFrame, predicate: Callable[[float], bool]) -> float:
    total = 0.0
    for row_index, row in enumerate(frame.fields.cloud_liquid_water_kg_per_kg.values):
        z_m = frame.grid.z_coordinates_m[row_index]
        if not predicate(z_m):
            continue
        total += sum(value for value in row if value > THERMODYNAMIC_CLOUD_THRESHOLD_KG_PER_KG)
    return total


def _boundary_cloud_fraction(frame: SimulationFrame) -> float:
    cloud = frame.fields.cloud_liquid_water_kg_per_kg.values
    total = sum(
        value for row in cloud for value in row if value > THERMODYNAMIC_CLOUD_THRESHOLD_KG_PER_KG
    )
    if total == 0.0:
        return 0.0

    boundary = 0.0
    for row_index, row in enumerate(cloud):
        for column_index, value in enumerate(row):
            if value <= THERMODYNAMIC_CLOUD_THRESHOLD_KG_PER_KG:
                continue
            if (
                row_index == 0
                or row_index == frame.grid.rows - 1
                or column_index == 0
                or column_index == frame.grid.columns - 1
            ):
                boundary += value
    return boundary / total


def _return_flow_cloud_fraction(frame: SimulationFrame) -> float:
    cloud = frame.fields.cloud_liquid_water_kg_per_kg.values
    w = frame.fields.vertical_velocity_m_per_s.values
    total = sum(
        value for row in cloud for value in row if value > THERMODYNAMIC_CLOUD_THRESHOLD_KG_PER_KG
    )
    if total == 0.0:
        return 0.0
    return_flow = 0.0
    low_level_top = frame.config.initial_atmosphere.boundary_layer_depth_m
    for row_index, row in enumerate(cloud):
        z_m = frame.grid.z_coordinates_m[row_index]
        if z_m > low_level_top:
            continue
        for column_index, value in enumerate(row):
            if value > THERMODYNAMIC_CLOUD_THRESHOLD_KG_PER_KG and w[row_index][column_index] < 0.0:
                return_flow += value
    return return_flow / total


def _cloud_water_lifetime_after_subsaturation(frames: list[SimulationFrame]) -> float | None:
    longest_seconds = 0.0
    current_start: float | None = None
    current_end: float | None = None

    for frame in frames:
        if _frame_has_subsaturated_cloud_water(frame):
            if current_start is None:
                current_start = frame.time_seconds
            current_end = frame.time_seconds
        else:
            if current_start is not None and current_end is not None:
                longest_seconds = max(longest_seconds, current_end - current_start)
            current_start = None
            current_end = None

    if current_start is not None and current_end is not None:
        longest_seconds = max(longest_seconds, current_end - current_start)
    return longest_seconds if longest_seconds > 0.0 else None


def _frame_has_subsaturated_cloud_water(frame: SimulationFrame) -> bool:
    for row_index, row in enumerate(frame.fields.cloud_liquid_water_kg_per_kg.values):
        z_m = frame.grid.z_coordinates_m[row_index]
        pressure_pa = pressure_at_height_pa(
            z_m,
            surface_pressure_pa=BOUSSINESQ_REFERENCE_SURFACE_PRESSURE_PA,
            scale_temperature_k=frame.config.initial_atmosphere.surface_temperature_k,
        )
        for column_index, cloud in enumerate(row):
            if cloud <= THERMODYNAMIC_CLOUD_THRESHOLD_KG_PER_KG:
                continue
            temperature = frame.fields.temperature_k.values[row_index][column_index]
            vapor = frame.fields.water_vapor_kg_per_kg.values[row_index][column_index]
            saturation = pressure_aware_saturation_specific_humidity_kg_per_kg(
                temperature,
                pressure_pa,
            )
            if vapor / max(saturation, 1e-12) < SUBSATURATED_RH_THRESHOLD:
                return True
    return False


def _thermodynamic_diagnostics_to_dict(
    diagnostics: BoussinesqThermodynamicDiagnostics,
) -> dict[str, Any]:
    return {
        "expected_lcl_m": diagnostics.expected_lcl_m,
        "initialized_profile": _initialized_profile_to_dict(diagnostics.initialized_profile),
        "first_cloud_time_seconds": diagnostics.first_cloud_time_seconds,
        "first_cloud_height_m": diagnostics.first_cloud_height_m,
        "first_cloud_lcl_delta_m": diagnostics.first_cloud_lcl_delta_m,
        "max_cloud_height_m": diagnostics.max_cloud_height_m,
        "cloud_water_centroid_m": diagnostics.cloud_water_centroid_m,
        "total_cloud_water_kg_per_kg": diagnostics.total_cloud_water_kg_per_kg,
        "below_lcl_cloud_water_kg_per_kg": diagnostics.below_lcl_cloud_water_kg_per_kg,
        "below_lcl_cloud_fraction": diagnostics.below_lcl_cloud_fraction,
        "near_lcl_cloud_fraction": diagnostics.near_lcl_cloud_fraction,
        "above_lcl_cloud_fraction": diagnostics.above_lcl_cloud_fraction,
        "cloud_onset_relative_humidity": diagnostics.cloud_onset_relative_humidity,
        "cloud_onset_saturation_excess_kg_per_kg": (
            diagnostics.cloud_onset_saturation_excess_kg_per_kg
        ),
        "lifted_path_saturation_decreases": diagnostics.lifted_path_saturation_decreases,
        "lifted_path_relative_humidity_increases": (
            diagnostics.lifted_path_relative_humidity_increases
        ),
        "mixed_layer_source_top_m": diagnostics.mixed_layer.source_layer_top_m,
        "mixed_layer_theta_spread_k": diagnostics.mixed_layer.theta_spread_k,
        "mixed_layer_water_vapor_spread_kg_per_kg": (
            diagnostics.mixed_layer.water_vapor_spread_kg_per_kg
        ),
        "mixed_layer_relative_humidity_spread": diagnostics.mixed_layer.relative_humidity_spread,
        "mixed_layer_well_mixed": diagnostics.mixed_layer.well_mixed,
        "cloud_region_count": diagnostics.cloud_regions.region_count,
        "cloud_base_heights_m": list(diagnostics.cloud_regions.cloud_base_heights_m),
        "cloud_top_heights_m": list(diagnostics.cloud_regions.cloud_top_heights_m),
        "cloud_base_spread_m": diagnostics.cloud_regions.cloud_base_spread_m,
        "cloud_top_spread_m": diagnostics.cloud_regions.cloud_top_spread_m,
        "cloud_water_persistence": _cloud_water_persistence_to_dict(
            diagnostics.cloud_water_persistence
        ),
        "boundary_cloud_fraction": diagnostics.boundary_cloud_fraction,
        "return_flow_cloud_fraction": diagnostics.return_flow_cloud_fraction,
        "status": diagnostics.status,
        "notes": list(diagnostics.notes),
    }


def _cloud_water_persistence_to_dict(
    diagnostics: CloudWaterPersistenceDiagnostics,
) -> dict[str, Any]:
    return {
        "cloud_water_in_subsaturated_air_fraction": (
            diagnostics.cloud_water_in_subsaturated_air_fraction
        ),
        "cloud_water_in_subsaturated_air_mass_fraction": (
            diagnostics.cloud_water_in_subsaturated_air_mass_fraction
        ),
        "cloud_water_in_subsaturated_air_cell_fraction": (
            diagnostics.cloud_water_in_subsaturated_air_cell_fraction
        ),
        "cloud_water_in_downdraft_fraction": diagnostics.cloud_water_in_downdraft_fraction,
        "cloud_water_in_return_flow_fraction": diagnostics.cloud_water_in_return_flow_fraction,
        "cloud_water_below_lcl_fraction": diagnostics.cloud_water_below_lcl_fraction,
        "cloud_water_near_surface_fraction": diagnostics.cloud_water_near_surface_fraction,
        "cloud_water_near_boundary_fraction": diagnostics.cloud_water_near_boundary_fraction,
        "cloud_water_lifetime_after_subsaturation_seconds": (
            diagnostics.cloud_water_lifetime_after_subsaturation_seconds
        ),
        "evaporation_tendency_total_kg_per_kg_per_s": (
            diagnostics.evaporation_tendency_total_kg_per_kg_per_s
        ),
        "condensation_tendency_total_kg_per_kg_per_s": (
            diagnostics.condensation_tendency_total_kg_per_kg_per_s
        ),
        "max_cloud_water_in_subsaturated_air_kg_per_kg": (
            diagnostics.max_cloud_water_in_subsaturated_air_kg_per_kg
        ),
        "subsaturated_cloud_min_height_m": diagnostics.subsaturated_cloud_min_height_m,
        "subsaturated_cloud_max_height_m": diagnostics.subsaturated_cloud_max_height_m,
    }


def _initialized_profile_to_dict(
    diagnostics: InitializedProfileDiagnostics,
) -> dict[str, Any]:
    return {
        "heights_m": list(diagnostics.heights_m),
        "pressure_profile_pa": list(diagnostics.pressure_profile_pa),
        "temperature_profile_k": list(diagnostics.temperature_profile_k),
        "water_vapor_profile_kg_per_kg": list(diagnostics.water_vapor_profile_kg_per_kg),
        "relative_humidity_profile": list(diagnostics.relative_humidity_profile),
        "source_layer_vapor_spread_kg_per_kg": diagnostics.source_layer_vapor_spread_kg_per_kg,
        "source_layer_vapor_conserved": diagnostics.source_layer_vapor_conserved,
        "saturation_cap_cell_count": diagnostics.saturation_cap_cell_count,
        "saturation_cap_heights_m": list(diagnostics.saturation_cap_heights_m),
        "effective_source_layer_top_m": diagnostics.effective_source_layer_top_m,
        "transition_layer_bottom_m": diagnostics.transition_layer_bottom_m,
        "transition_layer_top_m": diagnostics.transition_layer_top_m,
        "initialized_saturation_height_m": diagnostics.initialized_saturation_height_m,
        "well_mixed_for_shared_cloud_base": diagnostics.well_mixed_for_shared_cloud_base,
    }


def _scenario_diagnostics_to_dict(
    diagnostics: BoussinesqScenarioDiagnostics,
) -> dict[str, Any]:
    return {
        "cloud_coverage_fraction": diagnostics.cloud_coverage_fraction,
        "cloud_region_count": diagnostics.cloud_region_count,
        "cloud_top_height_m": diagnostics.cloud_top_height_m,
        "max_cloud_liquid_water_kg_per_kg": diagnostics.max_cloud_liquid_water_kg_per_kg,
        "max_abs_vertical_velocity_m_per_s": diagnostics.max_abs_vertical_velocity_m_per_s,
        "expected_lcl_m": diagnostics.expected_lcl_m,
        "boundary_layer_depth_m": diagnostics.boundary_layer_depth_m,
        "status": diagnostics.status,
        "notes": list(diagnostics.notes),
    }


def _cloud_coverage_fraction(frame: SimulationFrame) -> float:
    cloudy_cells = sum(
        1
        for row in frame.fields.cloud_liquid_water_kg_per_kg.values
        for value in row
        if value > THERMODYNAMIC_CLOUD_THRESHOLD_KG_PER_KG
    )
    return cloudy_cells / (frame.grid.rows * frame.grid.columns)


def _optional_metric(value: object) -> str:
    if value is None:
        return "none"
    if isinstance(value, float):
        return f"{value:.0f}"
    return str(value)


def _fill_boundary_from_nearest_interior(grid: list[list[float]]) -> None:
    rows = len(grid)
    columns = len(grid[0])

    for row_index in range(1, rows - 1):
        grid[row_index][0] = grid[row_index][1]
        grid[row_index][columns - 1] = grid[row_index][columns - 2]
    for column_index in range(columns):
        grid[0][column_index] = grid[1][column_index]
        grid[rows - 1][column_index] = grid[rows - 2][column_index]


def _reference_config(
    base: SimulationConfig,
    *,
    duration_seconds: float,
    relative_humidity: float,
    heating_rate: float,
    lapse_rate: float,
    wind_u: float,
    seed: int,
    boundary_layer_depth_m: float = 1_000.0,
    moist_source_layer_depth_m: float = 500.0,
    free_atmosphere_relative_humidity: float = 0.55,
    humidity_profile: HumidityProfilePattern = "surface_moisture",
    heating_pattern: SurfaceHeatingPattern = "single_patch",
    domain: DomainConfig | None = None,
    grid: GridConfig | None = None,
    surface_temperature_k: float = 298.15,
) -> SimulationConfig:
    return base.model_copy(
        update={
            "solver_type": "boussinesq_2d",
            "domain": domain or DomainConfig(width_m=10_000.0, height_m=3_000.0),
            "grid": grid or GridConfig(columns=36, rows=24),
            "time": TimeConfig(
                time_step_seconds=2.0,
                duration_seconds=duration_seconds,
                frame_interval_seconds=30.0,
            ),
            "initial_atmosphere": InitialAtmosphereConfig(
                surface_temperature_k=surface_temperature_k,
                lapse_rate_k_per_m=lapse_rate,
                relative_humidity=relative_humidity,
                boundary_layer_depth_m=boundary_layer_depth_m,
                moist_source_layer_depth_m=moist_source_layer_depth_m,
                free_atmosphere_relative_humidity=free_atmosphere_relative_humidity,
                humidity_profile=humidity_profile,
            ),
            "surface_heating": SurfaceHeatingConfig(
                max_warming_rate_k_per_s=heating_rate,
                patch_center_x_m=5_000.0,
                patch_width_m=2_000.0,
                pattern=heating_pattern,
            ),
            "background_wind": BackgroundWindConfig(u_m_per_s=wind_u, w_m_per_s=0.0),
            "seed": seed,
        }
    )


def _max_abs(grid: list[list[float]]) -> float:
    return max(abs(value) for row in grid for value in row)


def _mean_abs(grid: list[list[float]]) -> float:
    values = [abs(value) for row in grid for value in row]
    return sum(values) / len(values)


def _mean(grid: list[list[float]]) -> float:
    values = [value for row in grid for value in row]
    return sum(values) / len(values)


def _spread(values: list[float]) -> float:
    if not values:
        return 0.0
    return max(values) - min(values)


def _rms(grid: list[list[float]]) -> float:
    values = [value for row in grid for value in row]
    return sqrt(sum(value * value for value in values) / len(values))


def _max(grid: list[list[float]]) -> float:
    return max(value for row in grid for value in row)


def _min(grid: list[list[float]]) -> float:
    return min(value for row in grid for value in row)


def _speed_grid(
    horizontal_velocity: list[list[float]],
    vertical_velocity: list[list[float]],
) -> list[list[float]]:
    return [
        [
            sqrt(
                horizontal_velocity[row_index][column_index]
                * horizontal_velocity[row_index][column_index]
                + vertical_velocity[row_index][column_index]
                * vertical_velocity[row_index][column_index]
            )
            for column_index in range(len(row))
        ]
        for row_index, row in enumerate(horizontal_velocity)
    ]


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Boussinesq validation diagnostics.")
    parser.add_argument(
        "--thermodynamics",
        action="store_true",
        help="Run fair-weather cumulus thermodynamic structure diagnostics.",
    )
    parser.add_argument(
        "--scenarios",
        action="store_true",
        help="Run coarse expected-regime diagnostics for named Boussinesq scenarios.",
    )
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON.")
    args = parser.parse_args()

    if args.thermodynamics:
        report = run_boussinesq_thermodynamic_validation()
        if args.json:
            print(json.dumps(report, indent=2, sort_keys=True))
        else:
            print(format_boussinesq_thermodynamic_summary(report))
        return

    if args.scenarios:
        report = run_boussinesq_scenario_validation()
        if args.json:
            print(json.dumps(report, indent=2, sort_keys=True))
        else:
            print(format_boussinesq_scenario_summary(report))
        return

    parser.print_help()


if __name__ == "__main__":
    main()

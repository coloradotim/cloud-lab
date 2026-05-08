from __future__ import annotations

import argparse
import json
from collections.abc import Callable
from dataclasses import dataclass
from math import exp, isfinite, sqrt
from typing import Any

from app.sim.presets import fair_weather_cumulus_preset
from app.sim.schemas import (
    BackgroundWindConfig,
    DomainConfig,
    GridConfig,
    InitialAtmosphereConfig,
    SimulationConfig,
    SimulationFrame,
    SurfaceHeatingConfig,
    TimeConfig,
)
from app.sim.solver import run_simulation

CLOUD_TOP_THRESHOLD_KG_PER_KG = 1e-6
THERMODYNAMIC_CLOUD_THRESHOLD_KG_PER_KG = 1e-8
DIVERGENCE_VELOCITY_FLOOR_M_PER_S = 1e-3
DRY_ADIABATIC_LAPSE_RATE_K_PER_M = 0.0098
BOUSSINESQ_REFERENCE_PRESSURE_HPA = 900.0
LCL_GRID_TOLERANCE_CELLS = 1.0
LCL_WARN_TOLERANCE_CELLS = 2.0
BELOW_LCL_WARN_FRACTION = 0.05
BELOW_LCL_FAIL_FRACTION = 0.20
BASE_SPREAD_WARN_CELLS = 2.0
BASE_SPREAD_FAIL_CELLS = 4.0

ValidationStatus = str


@dataclass(frozen=True)
class BoussinesqReferenceCase:
    slug: str
    name: str
    description: str
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
    boundary_cloud_fraction: float
    return_flow_cloud_fraction: float
    status: ValidationStatus
    notes: tuple[str, ...]


@dataclass(frozen=True)
class LiftedSaturationSanity:
    saturation_values_kg_per_kg: tuple[float, ...]
    relative_humidity_values: tuple[float, ...]
    saturation_decreases: bool
    relative_humidity_increases: bool


def boussinesq_reference_cases() -> list[BoussinesqReferenceCase]:
    base = fair_weather_cumulus_preset().config
    return [
        BoussinesqReferenceCase(
            slug="quiet-atmosphere",
            name="Quiet atmosphere / no forcing",
            description="Unsaturated unforced slice; should not invent motion or condensate.",
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
            slug="humid-lifted-thermal",
            name="Humid lifted thermal",
            description="Humid heated patch; should couple uplift and saturation adjustment.",
            config=_reference_config(
                base,
                duration_seconds=1_200.0,
                relative_humidity=0.98,
                heating_rate=0.022,
                lapse_rate=0.0065,
                wind_u=0.15,
                seed=17,
            ),
        ),
        BoussinesqReferenceCase(
            slug="stable-suppression",
            name="Stable stratification suppression",
            description="More stable profile; should weaken vertical development.",
            config=_reference_config(
                base,
                duration_seconds=1_200.0,
                relative_humidity=0.45,
                heating_rate=0.016,
                lapse_rate=0.0035,
                wind_u=0.15,
                seed=19,
            ),
        ),
        BoussinesqReferenceCase(
            slug="fair-weather-boussinesq",
            name="Fair-weather Boussinesq baseline",
            description="Baseline humid heated Boussinesq run for manual comparison.",
            config=_reference_config(
                base,
                duration_seconds=1_200.0,
                relative_humidity=0.98,
                heating_rate=0.018,
                lapse_rate=0.0065,
                wind_u=0.25,
                seed=23,
            ),
        ),
    ]


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
    """Estimate LCL by dry-lifting a parcel against the diagnostic saturation curve."""
    rh = min(max(relative_humidity, 1e-6), 1.0)
    vapor = saturation_specific_humidity_kg_per_kg(temperature_k) * rh
    if vapor >= saturation_specific_humidity_kg_per_kg(temperature_k):
        return 0.0

    lower_m = 0.0
    upper_m = 100.0
    max_height_m = 15_000.0
    while upper_m < max_height_m:
        lifted_temperature_k = temperature_k - DRY_ADIABATIC_LAPSE_RATE_K_PER_M * upper_m
        if vapor >= saturation_specific_humidity_kg_per_kg(lifted_temperature_k):
            break
        lower_m = upper_m
        upper_m *= 2.0
    else:
        return max_height_m

    for _iteration in range(48):
        midpoint_m = (lower_m + upper_m) / 2.0
        lifted_temperature_k = temperature_k - DRY_ADIABATIC_LAPSE_RATE_K_PER_M * midpoint_m
        if vapor >= saturation_specific_humidity_kg_per_kg(lifted_temperature_k):
            upper_m = midpoint_m
        else:
            lower_m = midpoint_m

    return upper_m


def compute_boussinesq_thermodynamic_diagnostics(
    frames: list[SimulationFrame],
) -> BoussinesqThermodynamicDiagnostics:
    if not frames:
        raise ValueError("at least one frame is required")

    initial = frames[0]
    final = frames[-1]
    dz_m = final.config.domain.height_m / final.grid.rows
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
        saturation = saturation_specific_humidity_kg_per_kg(temperature)
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
    lifted_path = lifted_saturation_sanity_path(
        initial.config.initial_atmosphere.surface_temperature_k,
        initial.config.initial_atmosphere.relative_humidity,
    )
    notes: list[str] = []
    status_rank = 0

    if not mixed_layer.well_mixed:
        notes.append("source layer is not well mixed; shared cloud bases are less expected")
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
        boundary_cloud_fraction=boundary_cloud,
        return_flow_cloud_fraction=return_flow_cloud,
        status=status,
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
            theta_values.append(temperature + DRY_ADIABATIC_LAPSE_RATE_K_PER_M * z_m)
            vapor_values.append(vapor)
            rh_values.append(
                vapor / max(saturation_specific_humidity_kg_per_kg(temperature), 1e-12)
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


def saturation_specific_humidity_kg_per_kg(temperature_k: float) -> float:
    temperature_c = temperature_k - 273.15
    saturation_vapor_pressure_hpa = 6.112 * exp((17.67 * temperature_c) / (temperature_c + 243.5))
    mixing_ratio = (
        0.622
        * saturation_vapor_pressure_hpa
        / (BOUSSINESQ_REFERENCE_PRESSURE_HPA - saturation_vapor_pressure_hpa)
    )
    return max(0.0, mixing_ratio / (1.0 + mixing_ratio))


def lifted_saturation_sanity_path(
    surface_temperature_k: float,
    relative_humidity: float,
    *,
    lift_step_m: float = 100.0,
    steps: int = 8,
) -> LiftedSaturationSanity:
    initial_saturation = saturation_specific_humidity_kg_per_kg(surface_temperature_k)
    vapor = initial_saturation * relative_humidity
    saturation_values = []
    rh_values = []

    for step in range(steps + 1):
        temperature = surface_temperature_k - DRY_ADIABATIC_LAPSE_RATE_K_PER_M * lift_step_m * step
        saturation = saturation_specific_humidity_kg_per_kg(temperature)
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


def compute_cloud_region_diagnostics(frame: SimulationFrame) -> CloudRegionDiagnostics:
    cloud = frame.fields.cloud_liquid_water_kg_per_kg.values
    cloudy_columns = [
        any(row[column_index] > THERMODYNAMIC_CLOUD_THRESHOLD_KG_PER_KG for row in cloud)
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
                row[column_index] > THERMODYNAMIC_CLOUD_THRESHOLD_KG_PER_KG
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


def _thermodynamic_diagnostics_to_dict(
    diagnostics: BoussinesqThermodynamicDiagnostics,
) -> dict[str, Any]:
    return {
        "expected_lcl_m": diagnostics.expected_lcl_m,
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
        "boundary_cloud_fraction": diagnostics.boundary_cloud_fraction,
        "return_flow_cloud_fraction": diagnostics.return_flow_cloud_fraction,
        "status": diagnostics.status,
        "notes": list(diagnostics.notes),
    }


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
) -> SimulationConfig:
    return base.model_copy(
        update={
            "solver_type": "boussinesq_2d",
            "domain": DomainConfig(width_m=10_000.0, height_m=3_000.0),
            "grid": GridConfig(columns=36, rows=24),
            "time": TimeConfig(
                time_step_seconds=2.0,
                duration_seconds=duration_seconds,
                frame_interval_seconds=30.0,
            ),
            "initial_atmosphere": InitialAtmosphereConfig(
                surface_temperature_k=298.15,
                lapse_rate_k_per_m=lapse_rate,
                relative_humidity=relative_humidity,
                boundary_layer_depth_m=1_000.0,
            ),
            "surface_heating": SurfaceHeatingConfig(
                max_warming_rate_k_per_s=heating_rate,
                patch_center_x_m=5_000.0,
                patch_width_m=2_000.0,
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
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON.")
    args = parser.parse_args()

    if args.thermodynamics:
        report = run_boussinesq_thermodynamic_validation()
        if args.json:
            print(json.dumps(report, indent=2, sort_keys=True))
        else:
            print(format_boussinesq_thermodynamic_summary(report))
        return

    parser.print_help()


if __name__ == "__main__":
    main()

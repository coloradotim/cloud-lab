from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

CloudColumnModelType = Literal["controlled_cloud_column"]
PrecipitationHandoffStatus = Literal[
    "precipitation_not_enabled",
    "not_evaluated",
    "cloud_no_rain",
    "rain_threshold_reached",
    "rain_formed",
    "evaporation_limited",
]
MicrophysicsSourceLabel = Literal["none", "bulk", "PySDM", "reference", "synthetic"]
DropletEffectiveRadiusSourceLabel = Literal[
    "absent",
    "assumed",
    "bulk_estimate",
    "PySDM",
    "reference",
]
CloudColumnStatus = Literal[
    "cloud_formed",
    "dry_failed",
    "cap_suppressed",
    "lift_too_weak",
    "moisture_limited",
    "evaporated",
    "not_evaluated",
]


class CloudColumnProfile(BaseModel):
    """Vertical environment consumed by the controlled cloud-column model."""

    z_m: list[float]
    temperature_k: list[float]
    water_vapor_kg_per_kg: list[float] | None = None
    relative_humidity_percent: list[float] | None = None
    surface_pressure_pa: float = Field(default=101_325.0, gt=0.0)
    mixed_layer_depth_m: float | None = Field(default=None, ge=0.0)
    lcl_m: float | None = Field(default=None, ge=0.0)
    inversion_height_m: float | None = Field(default=None, ge=0.0)
    inversion_strength_k: float | None = Field(default=None, ge=0.0)

    @model_validator(mode="after")
    def validate_profile_lengths(self) -> CloudColumnProfile:
        expected = len(self.z_m)
        if expected < 2:
            raise ValueError("z_m must contain at least two levels")
        if any(upper <= lower for lower, upper in zip(self.z_m, self.z_m[1:], strict=False)):
            raise ValueError("z_m must be strictly increasing")
        if len(self.temperature_k) != expected:
            raise ValueError("temperature_k length must match z_m")
        if self.water_vapor_kg_per_kg is None and self.relative_humidity_percent is None:
            raise ValueError("water_vapor_kg_per_kg or relative_humidity_percent is required")
        if self.water_vapor_kg_per_kg is not None and len(self.water_vapor_kg_per_kg) != expected:
            raise ValueError("water_vapor_kg_per_kg length must match z_m")
        if (
            self.relative_humidity_percent is not None
            and len(self.relative_humidity_percent) != expected
        ):
            raise ValueError("relative_humidity_percent length must match z_m")
        return self


class CloudColumnForcing(BaseModel):
    """Prescribed lift and thermodynamic forcing for a controlled column run."""

    updraft_strength_m_per_s: float = Field(default=1.0, ge=0.0)
    lift_duration_seconds: float = Field(default=1_200.0, ge=0.0)
    entrainment_drying_factor: float = Field(default=0.0, ge=0.0, le=1.0)
    heating_tendency_k_per_s: float = Field(default=0.0)
    runtime_seconds: float = Field(default=1_800.0, gt=0.0)
    time_step_seconds: float = Field(default=10.0, gt=0.0)
    frame_interval_seconds: float = Field(default=60.0, gt=0.0)
    cap_suppression_strength: float = Field(default=0.0, ge=0.0, le=1.0)
    initial_cloud_liquid_water_kg_per_kg: float = Field(default=0.0, ge=0.0)

    @model_validator(mode="after")
    def validate_timing(self) -> CloudColumnForcing:
        if self.runtime_seconds < self.time_step_seconds:
            raise ValueError("runtime_seconds must be at least one time_step_seconds")
        if self.frame_interval_seconds < self.time_step_seconds:
            raise ValueError("frame_interval_seconds must be at least one time_step_seconds")
        if self.lift_duration_seconds > self.runtime_seconds:
            raise ValueError("lift_duration_seconds must not exceed runtime_seconds")
        return self


class CloudColumnConfig(BaseModel):
    """Configuration for profile-driven controlled cloud formation."""

    schema_version: Literal["cloud-column-config-v1"] = "cloud-column-config-v1"
    model_type: CloudColumnModelType = "controlled_cloud_column"
    profile: CloudColumnProfile
    forcing: CloudColumnForcing = Field(default_factory=CloudColumnForcing)
    seed: int = Field(default=1, description="Reserved deterministic seed for compatibility.")


class CloudColumnFrame(BaseModel):
    """One emitted controlled-column sample."""

    schema_version: Literal["cloud-column-frame-v1"] = "cloud-column-frame-v1"
    step: int = Field(ge=0)
    time_seconds: float = Field(ge=0.0)
    model_type: CloudColumnModelType = "controlled_cloud_column"
    parcel_height_m: float = Field(ge=0.0)
    temperature_k: float = Field(gt=0.0)
    water_vapor_kg_per_kg: float = Field(ge=0.0)
    relative_humidity_percent: float = Field(ge=0.0)
    cloud_liquid_water_kg_per_kg: float = Field(ge=0.0)
    condensation_rate_proxy_kg_per_kg_s: float = Field(ge=0.0)
    evaporation_rate_proxy_kg_per_kg_s: float = Field(ge=0.0)
    prescribed_lift_m_per_s: float = Field(ge=0.0)


class CloudColumnWaterBudgetSummary(BaseModel):
    initial_total_water_kg_per_kg: float = Field(ge=0.0)
    final_total_water_kg_per_kg: float = Field(ge=0.0)
    max_absolute_drift_kg_per_kg: float = Field(ge=0.0)
    total_condensed_kg_per_kg: float = Field(ge=0.0)
    total_evaporated_kg_per_kg: float = Field(ge=0.0)


class CloudColumnForcingSummary(BaseModel):
    forcing_type: Literal["prescribed_lift"] = "prescribed_lift"
    dynamics_label: Literal["prescribed, not predicted"] = "prescribed, not predicted"
    updraft_strength_m_per_s: float = Field(ge=0.0)
    lift_duration_seconds: float = Field(ge=0.0)
    entrainment_drying_factor: float = Field(ge=0.0, le=1.0)
    heating_tendency_k_per_s: float


class CloudColumnDiagnostics(BaseModel):
    cloud_formation_status: CloudColumnStatus
    cloud_formation_reason: str = Field(min_length=1)
    first_saturation_time_seconds: float | None = Field(default=None, ge=0.0)
    first_cloud_time_seconds: float | None = Field(default=None, ge=0.0)
    cloud_base_m: float | None = Field(default=None, ge=0.0)
    cloud_top_proxy_m: float | None = Field(default=None, ge=0.0)
    max_relative_humidity_percent: float = Field(ge=0.0)
    max_cloud_liquid_water_kg_per_kg: float = Field(ge=0.0)
    water_budget: CloudColumnWaterBudgetSummary
    forcing: CloudColumnForcingSummary


class CloudColumnRun(BaseModel):
    """Complete deterministic output from a controlled cloud-column run."""

    schema_version: Literal["cloud-column-run-v1"] = "cloud-column-run-v1"
    config: CloudColumnConfig
    frames: list[CloudColumnFrame]
    diagnostics: CloudColumnDiagnostics


class CloudColumnMicrophysicsHandoff(BaseModel):
    """Contract for passing cloud-column output to future warm-rain microphysics."""

    schema_version: Literal["cloud-column-microphysics-handoff-v1"] = (
        "cloud-column-microphysics-handoff-v1"
    )
    source_model: CloudColumnModelType = "controlled_cloud_column"
    source_scenario_id: str | None = None
    source_profile_time_seconds: float | None = Field(default=None, ge=0.0)
    source_profile_time_hours_from_sunrise: float | None = Field(default=None, ge=0.0)
    cloud_column_run_id: str | None = None
    cloud_column_time_seconds: list[float]
    cloud_liquid_water_kg_per_kg: list[float]
    max_cloud_liquid_water_kg_per_kg: float = Field(ge=0.0)
    cloud_water_integral: float = Field(ge=0.0)
    first_cloud_time_seconds: float | None = Field(default=None, ge=0.0)
    cloud_base_m: float | None = Field(default=None, ge=0.0)
    cloud_top_proxy_m: float | None = Field(default=None, ge=0.0)
    total_condensed_kg_per_kg: float = Field(ge=0.0)
    total_evaporated_kg_per_kg: float = Field(ge=0.0)
    water_budget_summary: CloudColumnWaterBudgetSummary
    prescribed_lift_summary: CloudColumnForcingSummary
    temperature_k: list[float]
    water_vapor_kg_per_kg: list[float]
    relative_humidity_percent: list[float]
    precipitation_status: PrecipitationHandoffStatus = "precipitation_not_enabled"
    microphysics_source: MicrophysicsSourceLabel = "none"
    droplet_effective_radius_source: DropletEffectiveRadiusSourceLabel = "absent"
    rain_water_kg_per_kg: list[float] | None = None
    first_rain_time_seconds: float | None = Field(default=None, ge=0.0)
    max_rain_water_kg_per_kg: float | None = Field(default=None, ge=0.0)
    effective_radius_um: list[float] | None = None
    droplet_size_distribution: dict[str, object] | None = None
    number_concentration_m3: list[float] | None = None

    @model_validator(mode="after")
    def validate_time_series_lengths(self) -> CloudColumnMicrophysicsHandoff:
        expected = len(self.cloud_column_time_seconds)
        if expected == 0:
            raise ValueError("cloud_column_time_seconds must contain at least one sample")
        series = {
            "cloud_liquid_water_kg_per_kg": self.cloud_liquid_water_kg_per_kg,
            "temperature_k": self.temperature_k,
            "water_vapor_kg_per_kg": self.water_vapor_kg_per_kg,
            "relative_humidity_percent": self.relative_humidity_percent,
            "rain_water_kg_per_kg": self.rain_water_kg_per_kg,
            "effective_radius_um": self.effective_radius_um,
            "number_concentration_m3": self.number_concentration_m3,
        }
        for name, values in series.items():
            if values is not None and len(values) != expected:
                raise ValueError(f"{name} length must match cloud_column_time_seconds")
        return self


class CloudColumnScenario(BaseModel):
    """Named backend fixture for controlled cloud-column validation."""

    slug: str = Field(min_length=1)
    name: str = Field(min_length=1)
    purpose: str = Field(min_length=1)
    expected_status: CloudColumnStatus | None = None
    config: CloudColumnConfig

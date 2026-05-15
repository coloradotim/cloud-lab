from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

BoundaryLayerModelType = Literal["boundary_layer_1d"]
BoundaryLayerHeatingCurve = Literal["steady", "morning_ramp"]
CloudFormationPotentialStatus = Literal[
    "not_favorable_yet",
    "cloud_favorable",
    "moisture_limited",
    "heating_limited",
    "cap_suppressed",
    "dry_entrainment_suppressed",
    "no_flux_control",
    "not_evaluated",
]


class BoundaryLayer1DConfig(BaseModel):
    """Configuration for the standalone 1-D boundary-layer profile model."""

    schema_version: Literal["profile-config-v1"] = Field(
        default="profile-config-v1",
        description="Version marker for boundary-layer profile configurations.",
    )
    model_type: BoundaryLayerModelType = Field(
        default="boundary_layer_1d",
        description="Standalone 1-D lower-atmosphere profile evolution model.",
    )
    height_m: float = Field(default=3_000.0, gt=0, description="Profile top height in meters.")
    levels: int = Field(default=61, ge=4, description="Number of vertical profile levels.")
    time_step_seconds: float = Field(
        default=60.0,
        gt=0,
        description="Numerical timestep in seconds.",
    )
    duration_seconds: float = Field(
        default=14_400.0,
        gt=0,
        description="Total profile evolution duration in seconds.",
    )
    frame_interval_seconds: float = Field(
        default=900.0,
        gt=0,
        description="Cadence for emitted profile frames in seconds.",
    )
    initial_surface_temperature_k: float = Field(
        default=292.15,
        gt=0,
        description="Initial near-surface air temperature in kelvin.",
    )
    initial_mixed_layer_depth_m: float = Field(
        default=250.0,
        gt=0,
        description="Initial morning mixed-layer depth in meters.",
    )
    initial_relative_humidity: float = Field(
        default=0.62,
        ge=0.0,
        le=1.0,
        description="Initial mixed-layer relative humidity fraction.",
    )
    initial_lapse_rate_k_per_m: float = Field(
        default=0.0065,
        ge=0.0,
        description="Initial environmental temperature decrease with height.",
    )
    inversion_height_m: float = Field(
        default=1_500.0,
        gt=0,
        description="Capping inversion height in meters.",
    )
    inversion_strength_k: float = Field(
        default=2.5,
        ge=0.0,
        description="Temperature jump/resistance proxy for the capping inversion in kelvin.",
    )
    free_atmosphere_relative_humidity: float = Field(
        default=0.35,
        ge=0.0,
        le=1.0,
        description="Relative humidity fraction above the initial mixed layer.",
    )
    surface_heating_strength: float = Field(
        default=0.55,
        ge=0.0,
        le=1.0,
        description="Dimensionless sensible-heating preset strength.",
    )
    surface_moisture_flux_strength: float = Field(
        default=0.45,
        ge=0.0,
        le=1.0,
        description="Dimensionless surface moisture-flux preset strength.",
    )
    entrainment_strength: float = Field(
        default=0.35,
        ge=0.0,
        le=1.0,
        description="Dimensionless entrainment-mixing preset strength.",
    )
    heating_curve: BoundaryLayerHeatingCurve = Field(
        default="morning_ramp",
        description="Sensible-heating curve over hours from sunrise.",
    )
    seed: int = Field(default=1, description="Reserved deterministic seed for compatibility.")

    @model_validator(mode="after")
    def validate_profile_settings(self) -> BoundaryLayer1DConfig:
        if self.duration_seconds < self.time_step_seconds:
            raise ValueError("duration_seconds must be at least one time_step_seconds")
        if self.frame_interval_seconds < self.time_step_seconds:
            raise ValueError("frame_interval_seconds must be at least one time_step_seconds")
        if self.initial_mixed_layer_depth_m >= self.height_m:
            raise ValueError("initial_mixed_layer_depth_m must be below height_m")
        if self.inversion_height_m >= self.height_m:
            raise ValueError("inversion_height_m must be below height_m")
        if self.initial_mixed_layer_depth_m > self.inversion_height_m:
            raise ValueError("initial_mixed_layer_depth_m must not exceed inversion_height_m")
        return self


class BoundaryLayer1DDiagnostics(BaseModel):
    """Deterministic profile diagnostics for one emitted frame."""

    cloud_formation_potential_status: CloudFormationPotentialStatus
    cloud_formation_potential_reason: str = Field(min_length=1)
    mixed_layer_lcl_difference_m: float
    rh_near_mixed_layer_top_percent: float = Field(ge=0.0, le=100.0)
    max_relative_humidity_percent: float = Field(ge=0.0, le=100.0)
    cap_suppression_index: float = Field(ge=0.0)
    heating_limited: bool
    moisture_limited: bool
    cap_limited: bool
    dry_entrainment_limited: bool


class BoundaryLayer1DFrame(BaseModel):
    """One emitted profile frame from the 1-D boundary-layer model."""

    schema_version: Literal["profile-frame-v1"] = Field(
        default="profile-frame-v1",
        description="Version marker for standalone profile frames.",
    )
    step: int = Field(ge=0)
    time_seconds: float = Field(ge=0.0)
    time_hours_from_sunrise: float = Field(ge=0.0)
    model_type: BoundaryLayerModelType = "boundary_layer_1d"
    z_m: list[float]
    temperature_k: list[float]
    water_vapor_kg_per_kg: list[float]
    relative_humidity_percent: list[float]
    mixed_layer_depth_m: float = Field(ge=0.0)
    lcl_m: float = Field(ge=0.0)
    inversion_height_m: float = Field(ge=0.0)
    inversion_strength_k: float = Field(ge=0.0)
    surface_heating_accumulated_k: float = Field(ge=0.0)
    surface_moisture_added_kg_per_kg: float = Field(ge=0.0)
    entrainment_drying_proxy: float = Field(ge=0.0)
    diagnostics: BoundaryLayer1DDiagnostics

    @model_validator(mode="after")
    def validate_profile_lengths(self) -> BoundaryLayer1DFrame:
        expected = len(self.z_m)
        if expected < 2:
            raise ValueError("z_m must contain at least two levels")
        if any(upper <= lower for lower, upper in zip(self.z_m, self.z_m[1:], strict=False)):
            raise ValueError("z_m must be strictly increasing")
        for field_name in ("temperature_k", "water_vapor_kg_per_kg", "relative_humidity_percent"):
            values = getattr(self, field_name)
            if len(values) != expected:
                raise ValueError(f"{field_name} length must match z_m")
        return self


class BoundaryLayer1DRun(BaseModel):
    """Complete deterministic output from a boundary-layer profile run."""

    schema_version: Literal["profile-run-v1"] = "profile-run-v1"
    config: BoundaryLayer1DConfig
    frames: list[BoundaryLayer1DFrame]


class BoundaryLayer1DScenario(BaseModel):
    """Named backend preset for the Evolving Boundary Layer lab."""

    slug: str = Field(min_length=1)
    name: str = Field(min_length=1)
    purpose: str = Field(min_length=1)
    expected_status: CloudFormationPotentialStatus | None = None
    config: BoundaryLayer1DConfig

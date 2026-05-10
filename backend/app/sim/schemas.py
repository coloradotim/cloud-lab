from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

ScalarGrid = list[list[float]]
SolverType = Literal["educational_2d", "boussinesq_2d", "microphysics_lab"]
SurfaceHeatingPattern = Literal[
    "single_patch",
    "two_patches",
    "broad_plateau",
    "weak_random",
    "custom_patches",
]
HumidityProfilePattern = Literal[
    "surface_moisture",
    "uniform",
    "moist_boundary_layer",
    "dry_cap",
    "moist_layer",
    "custom_layers",
]


class DomainConfig(BaseModel):
    """Physical domain for a 2-D vertical slice."""

    width_m: float = Field(default=10_000.0, gt=0, description="Horizontal domain width in meters.")
    height_m: float = Field(default=3_000.0, gt=0, description="Vertical domain height in meters.")


class GridConfig(BaseModel):
    """Grid resolution for a 2-D vertical slice."""

    columns: int = Field(default=100, gt=1, description="Horizontal grid cell count.")
    rows: int = Field(default=60, gt=1, description="Vertical grid cell count.")


class TimeConfig(BaseModel):
    """Simulation clock and frame cadence controls."""

    time_step_seconds: float = Field(
        default=1.0,
        gt=0,
        description="Numerical timestep in simulated seconds.",
    )
    duration_seconds: float = Field(
        default=600.0,
        gt=0,
        description="Total simulated duration in seconds.",
    )
    frame_interval_seconds: float = Field(
        default=10.0,
        gt=0,
        description="Cadence for emitted frames in simulated seconds.",
    )

    @model_validator(mode="after")
    def validate_cadence(self) -> "TimeConfig":
        if self.duration_seconds < self.time_step_seconds:
            raise ValueError("duration_seconds must be at least one time_step_seconds")
        if self.frame_interval_seconds < self.time_step_seconds:
            raise ValueError("frame_interval_seconds must be at least one time_step_seconds")
        return self


class InitialAtmosphereConfig(BaseModel):
    """Initial temperature and humidity assumptions for a simple warm-cloud run."""

    surface_temperature_k: float = Field(
        default=298.15,
        gt=0,
        description="Initial near-surface air temperature in kelvin.",
    )
    lapse_rate_k_per_m: float = Field(
        default=0.0065,
        ge=0,
        description=(
            "Environmental temperature decrease with height above the mixed layer in kelvin "
            "per meter."
        ),
    )
    relative_humidity: float = Field(
        default=0.78,
        ge=0,
        le=1,
        description="Initial relative humidity fraction from 0 to 1.",
    )
    boundary_layer_depth_m: float = Field(
        default=1_000.0,
        gt=0,
        description="Boundary-layer or inversion top height in meters.",
    )
    moist_source_layer_depth_m: float = Field(
        default=500.0,
        gt=0,
        description=(
            "Depth of the initially moist source layer that feeds thermals; this is "
            "separate from the boundary-layer/inversion top."
        ),
    )
    free_atmosphere_relative_humidity: float = Field(
        default=0.55,
        ge=0,
        le=1,
        description="Relative humidity used above the moist source layer.",
    )
    humidity_profile: HumidityProfilePattern = Field(
        default="surface_moisture",
        description="Structured relative-humidity profile used to initialize 2-D solvers.",
    )
    humidity_layers: list["HumidityLayerConfig"] = Field(
        default_factory=list,
        description="Optional vertical relative-humidity layers for future painted scenarios.",
    )
    humidity_patch: "HumidityPatchConfig | None" = Field(
        default=None,
        description="Optional horizontal relative-humidity patch for future painted scenarios.",
    )


class HumidityLayerConfig(BaseModel):
    """A vertical relative-humidity layer for structured initial conditions."""

    bottom_m: float = Field(default=0.0, ge=0, description="Layer bottom height in meters.")
    top_m: float = Field(default=1_000.0, gt=0, description="Layer top height in meters.")
    relative_humidity: float = Field(
        default=0.95,
        ge=0,
        le=1,
        description="Relative humidity used within this layer.",
    )

    @model_validator(mode="after")
    def validate_layer_order(self) -> "HumidityLayerConfig":
        if self.top_m <= self.bottom_m:
            raise ValueError("humidity layer top_m must be greater than bottom_m")
        return self


class HumidityPatchConfig(BaseModel):
    """A horizontal relative-humidity patch for early structured experiments."""

    center_x_m: float = Field(default=5_000.0, ge=0, description="Patch center x position.")
    width_m: float = Field(default=2_000.0, gt=0, description="Patch width in meters.")
    relative_humidity: float = Field(
        default=0.98,
        ge=0,
        le=1,
        description="Relative humidity inside the patch.",
    )


class HeatingPatchConfig(BaseModel):
    """A horizontal heating patch used by structured surface-heating patterns."""

    center_x_m: float = Field(default=5_000.0, ge=0, description="Patch center x position.")
    width_m: float = Field(default=2_000.0, gt=0, description="Patch width in meters.")
    intensity_fraction: float = Field(
        default=1.0,
        ge=0,
        le=1,
        description="Fraction of max_warming_rate_k_per_s applied in this patch.",
    )


class SurfaceHeatingConfig(BaseModel):
    """Simple lower-boundary heating control for early cumulus experiments."""

    max_warming_rate_k_per_s: float = Field(
        default=0.003,
        ge=0,
        description="Maximum surface-driven warming rate in kelvin per second.",
    )
    patch_center_x_m: float = Field(
        default=5_000.0,
        ge=0,
        description="Center of the heating patch in meters from the left boundary.",
    )
    patch_width_m: float = Field(
        default=2_000.0, gt=0, description="Heating patch width in meters."
    )
    pattern: SurfaceHeatingPattern = Field(
        default="single_patch",
        description="Structured surface-heating pattern for 2-D solvers.",
    )
    patches: list[HeatingPatchConfig] = Field(
        default_factory=list,
        description="Optional custom heating patches for future painted-map compatibility.",
    )


class BackgroundWindConfig(BaseModel):
    """Simple uniform background wind."""

    u_m_per_s: float = Field(default=1.5, description="Horizontal wind speed in meters per second.")
    w_m_per_s: float = Field(default=0.0, description="Vertical wind speed in meters per second.")


class SimulationConfig(BaseModel):
    """Configuration for a reproducible 2-D vertical-slice simulation run."""

    schema_version: Literal["sim-config-v1"] = Field(
        default="sim-config-v1",
        description="Version marker for saved simulation configuration compatibility.",
    )
    solver_type: SolverType = Field(
        default="boussinesq_2d",
        description=(
            "Simulation backend identifier. Educational and Boussinesq solvers emit 2-D "
            "vertical-slice fields; microphysics_lab emits controlled parcel/box "
            "microphysics experiments through the same frame envelope."
        ),
    )
    domain: DomainConfig = Field(default_factory=DomainConfig)
    grid: GridConfig = Field(default_factory=GridConfig)
    time: TimeConfig = Field(default_factory=TimeConfig)
    initial_atmosphere: InitialAtmosphereConfig = Field(default_factory=InitialAtmosphereConfig)
    surface_heating: SurfaceHeatingConfig = Field(default_factory=SurfaceHeatingConfig)
    background_wind: BackgroundWindConfig = Field(default_factory=BackgroundWindConfig)
    seed: int = Field(default=1, description="Deterministic random seed for reproducible runs.")

    @model_validator(mode="after")
    def validate_spatial_settings(self) -> "SimulationConfig":
        if self.initial_atmosphere.boundary_layer_depth_m > self.domain.height_m:
            raise ValueError("boundary_layer_depth_m must not exceed domain height")
        if self.initial_atmosphere.moist_source_layer_depth_m > self.domain.height_m:
            raise ValueError("moist_source_layer_depth_m must not exceed domain height")
        if self.surface_heating.patch_center_x_m > self.domain.width_m:
            raise ValueError("patch_center_x_m must fit inside the domain width")
        if self.surface_heating.patch_width_m > self.domain.width_m:
            raise ValueError("patch_width_m must not exceed domain width")
        for index, patch in enumerate(self.surface_heating.patches):
            if patch.center_x_m > self.domain.width_m:
                raise ValueError(
                    f"surface_heating.patches[{index}].center_x_m exceeds domain width"
                )
            if patch.width_m > self.domain.width_m:
                raise ValueError(f"surface_heating.patches[{index}].width_m exceeds domain width")
        for index, layer in enumerate(self.initial_atmosphere.humidity_layers):
            if layer.top_m > self.domain.height_m:
                raise ValueError(
                    f"initial_atmosphere.humidity_layers[{index}].top_m exceeds domain height"
                )
        if self.initial_atmosphere.humidity_patch is not None:
            humidity_patch = self.initial_atmosphere.humidity_patch
            if humidity_patch.center_x_m > self.domain.width_m:
                raise ValueError("humidity_patch.center_x_m must fit inside the domain width")
            if humidity_patch.width_m > self.domain.width_m:
                raise ValueError("humidity_patch.width_m must not exceed domain width")
        return self


class GridMetadata(BaseModel):
    """Grid coordinates shared by every 2-D field in a frame."""

    columns: int = Field(gt=1, description="Horizontal grid cell count.")
    rows: int = Field(gt=1, description="Vertical grid cell count.")
    x_coordinates_m: list[float] = Field(description="Cell-center x coordinates in meters.")
    z_coordinates_m: list[float] = Field(description="Cell-center z coordinates in meters.")

    @model_validator(mode="after")
    def validate_coordinate_lengths(self) -> "GridMetadata":
        if len(self.x_coordinates_m) != self.columns:
            raise ValueError("x_coordinates_m length must match columns")
        if len(self.z_coordinates_m) != self.rows:
            raise ValueError("z_coordinates_m length must match rows")
        return self


class DisplayScale(BaseModel):
    """Display hints for frontend visualization without coupling to solver internals."""

    min_value: float | None = Field(default=None, description="Suggested display minimum.")
    max_value: float | None = Field(default=None, description="Suggested display maximum.")
    color_map: str = Field(default="viridis", description="Suggested color map name.")


class FieldMetadata(BaseModel):
    """Units and display metadata for one modeled 2-D field."""

    unit: str = Field(min_length=1, description="Physical unit for every value in the field.")
    display_name: str = Field(min_length=1, description="Human-readable field label.")
    description: str = Field(
        min_length=1, description="Meaning, assumptions, or placeholder status."
    )
    display_scale: DisplayScale = Field(default_factory=DisplayScale)


class ScalarField2D(BaseModel):
    """A row-major scalar field over the frame grid."""

    values: ScalarGrid
    metadata: FieldMetadata

    @model_validator(mode="after")
    def validate_rectangular_values(self) -> "ScalarField2D":
        if not self.values:
            raise ValueError("values must include at least one row")

        column_count = len(self.values[0])
        if column_count == 0:
            raise ValueError("values must include at least one column")

        if any(len(row) != column_count for row in self.values):
            raise ValueError("values must be rectangular")

        return self


class SimulationFields(BaseModel):
    """Core fields emitted in every frame."""

    temperature_k: ScalarField2D
    temperature_perturbation_k: ScalarField2D
    water_vapor_kg_per_kg: ScalarField2D
    cloud_liquid_water_kg_per_kg: ScalarField2D
    rain_water_kg_per_kg: ScalarField2D
    horizontal_velocity_m_per_s: ScalarField2D
    vertical_velocity_m_per_s: ScalarField2D

    @field_validator("*")
    @classmethod
    def require_units_metadata(cls, field: ScalarField2D) -> ScalarField2D:
        if not field.metadata.unit:
            raise ValueError("modeled fields must include units metadata")
        return field


class SimulationFrame(BaseModel):
    """Stable frame envelope for future live simulation output."""

    model_config = ConfigDict(populate_by_name=True)

    schema_version: Literal["sim-frame-v1"] = Field(
        default="sim-frame-v1",
        description="Version marker for serialized frame compatibility.",
    )
    step: int = Field(ge=0, description="Zero-based simulation step index.")
    time_seconds: float = Field(ge=0, description="Simulated time for this frame in seconds.")
    config: SimulationConfig
    grid: GridMetadata
    fields: SimulationFields

    @model_validator(mode="after")
    def validate_field_shapes(self) -> "SimulationFrame":
        expected_shape = (self.grid.rows, self.grid.columns)

        for field_name, field in self.fields:
            field_shape = (len(field.values), len(field.values[0]))
            if field_shape != expected_shape:
                raise ValueError(
                    f"{field_name} shape {field_shape} does not match grid shape {expected_shape}"
                )

        return self

    def to_transport_dict(self) -> dict[str, Any]:
        """Return JSON-safe data for HTTP responses or WebSocket messages."""
        return self.model_dump(mode="json")

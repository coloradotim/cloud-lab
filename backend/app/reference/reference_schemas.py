from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

ReferenceSourceModel = Literal["CM1"]
ReferenceMetadataValue = str | int | float | bool | None
ReferenceScalarGrid = list[list[float]]


class ReferenceGridMetadata(BaseModel):
    """Grid coordinates for an offline reference-model x-z frame."""

    columns: int = Field(gt=1, description="Horizontal grid cell count.")
    rows: int = Field(gt=1, description="Vertical grid cell count.")
    x_coordinates_m: list[float] = Field(description="Cell-center x coordinates in meters.")
    z_coordinates_m: list[float] = Field(description="Cell-center z coordinates in meters.")

    @model_validator(mode="after")
    def validate_coordinate_lengths(self) -> "ReferenceGridMetadata":
        if len(self.x_coordinates_m) != self.columns:
            raise ValueError("x_coordinates_m length must match columns")
        if len(self.z_coordinates_m) != self.rows:
            raise ValueError("z_coordinates_m length must match rows")
        return self


class ReferenceProvenance(BaseModel):
    """Reference source provenance carried with every mapped frame."""

    source_model: ReferenceSourceModel = Field(description="Offline reference model name.")
    source_case_id: str = Field(min_length=1, description="Stable reference case identifier.")
    source_file_metadata: dict[str, ReferenceMetadataValue] = Field(default_factory=dict)
    adapter_name: str = Field(default="cm1_reference_adapter")
    adapter_version: str = Field(default="cm1-reference-adapter-v1")
    source_is_synthetic_fixture: bool = Field(
        default=False,
        description="Whether the source is a tiny mapping fixture rather than scientific output.",
    )


class ReferenceFieldMetadata(BaseModel):
    """Units, source-variable provenance, and display metadata for a reference field."""

    unit: str = Field(min_length=1)
    display_name: str = Field(min_length=1)
    description: str = Field(min_length=1)
    source_variable: str = Field(min_length=1)
    standard_name: str = Field(min_length=1)
    provenance: str = Field(min_length=1)


class ReferenceScalarField2D(BaseModel):
    """A row-major reference-model scalar field."""

    values: ReferenceScalarGrid
    metadata: ReferenceFieldMetadata

    @model_validator(mode="after")
    def validate_rectangular_values(self) -> "ReferenceScalarField2D":
        if not self.values:
            raise ValueError("values must include at least one row")
        column_count = len(self.values[0])
        if column_count == 0:
            raise ValueError("values must include at least one column")
        if any(len(row) != column_count for row in self.values):
            raise ValueError("values must be rectangular")
        return self


class ReferenceFrame(BaseModel):
    """Versioned frame envelope for offline CM1/reference-model output."""

    schema_version: Literal["reference-frame-v1"] = "reference-frame-v1"
    source_model: ReferenceSourceModel = "CM1"
    source_case_id: str = Field(min_length=1)
    source_file_metadata: dict[str, ReferenceMetadataValue] = Field(default_factory=dict)
    time_seconds: float = Field(ge=0.0)
    grid: ReferenceGridMetadata
    fields: dict[str, ReferenceScalarField2D]
    provenance: ReferenceProvenance
    assumptions: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)

    @field_validator("fields")
    @classmethod
    def require_fields(
        cls, fields: dict[str, ReferenceScalarField2D]
    ) -> dict[str, ReferenceScalarField2D]:
        if not fields:
            raise ValueError("reference frames must include at least one mapped field")
        return fields

    @model_validator(mode="after")
    def validate_field_shapes(self) -> "ReferenceFrame":
        expected_shape = (self.grid.rows, self.grid.columns)
        for field_name, field in self.fields.items():
            field_shape = (len(field.values), len(field.values[0]))
            if field_shape != expected_shape:
                raise ValueError(
                    f"{field_name} shape {field_shape} does not match grid shape {expected_shape}"
                )
        return self

    def to_transport_dict(self) -> dict[str, object]:
        """Return JSON-safe data for future API/viewer consumers."""
        return self.model_dump(mode="json")


class ReferenceDiagnostics(BaseModel):
    """Run-level diagnostics computed from mapped reference frames."""

    schema_version: Literal["reference-diagnostics-v1"] = "reference-diagnostics-v1"
    source_model: ReferenceSourceModel = "CM1"
    source_case_id: str = Field(min_length=1)
    available_fields: list[str] = Field(default_factory=list)
    missing_field_warnings: list[str] = Field(default_factory=list)
    max_cloud_liquid_water_kg_per_kg: float | None = Field(default=None, ge=0.0)
    integrated_cloud_liquid_water_kg_per_kg: float | None = Field(default=None, ge=0.0)
    cloud_base_m: float | None = Field(default=None, ge=0.0)
    cloud_top_m: float | None = Field(default=None, ge=0.0)
    first_cloud_time_seconds: float | None = Field(default=None, ge=0.0)
    max_updraft_m_per_s: float | None = None
    first_rain_time_seconds: float | None = Field(default=None, ge=0.0)
    max_rain_water_kg_per_kg: float | None = Field(default=None, ge=0.0)
    source_provenance: ReferenceProvenance
    visualization_ready: bool = Field(
        description="Whether mapped fields and grid coordinates are ready for a 2-D view."
    )

    @model_validator(mode="after")
    def validate_cloud_bounds(self) -> "ReferenceDiagnostics":
        if (
            self.cloud_base_m is not None
            and self.cloud_top_m is not None
            and self.cloud_top_m < self.cloud_base_m
        ):
            raise ValueError("cloud_top_m must be greater than or equal to cloud_base_m")
        return self


class ReferenceRun(BaseModel):
    """Mapped offline reference run, including frames and diagnostics."""

    schema_version: Literal["reference-run-v1"] = "reference-run-v1"
    source_model: ReferenceSourceModel = "CM1"
    source_case_id: str = Field(min_length=1)
    frames: list[ReferenceFrame] = Field(min_length=1)
    diagnostics: ReferenceDiagnostics
    warnings: list[str] = Field(default_factory=list)

    def to_transport_dict(self) -> dict[str, object]:
        """Return JSON-safe data for future API/viewer consumers."""
        return self.model_dump(mode="json")

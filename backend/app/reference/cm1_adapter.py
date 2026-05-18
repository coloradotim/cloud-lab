from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import cast

from app.reference.reference_diagnostics import compute_reference_run_diagnostics
from app.reference.reference_schemas import (
    ReferenceFieldMetadata,
    ReferenceFrame,
    ReferenceGridMetadata,
    ReferenceMetadataValue,
    ReferenceProvenance,
    ReferenceRun,
    ReferenceScalarField2D,
)

CM1_REFERENCE_ASSUMPTIONS = [
    "CM1 output is offline reference-model output.",
    "Cloud Lab does not run CM1 in normal app sessions.",
    "CM1 reference data is not interactive reduced-model output.",
    "Synthetic CM1-like fixtures validate mapping only; they are not scientific truth.",
]


@dataclass(frozen=True)
class CM1FieldSpec:
    standard_name: str
    aliases: tuple[str, ...]
    default_unit: str
    display_name: str
    description: str
    required_for_visual_path: bool


CM1_FIELD_SPECS: tuple[CM1FieldSpec, ...] = (
    CM1FieldSpec(
        standard_name="potential_temperature_k",
        aliases=("theta", "th", "thpert", "potential_temperature", "potential_temperature_k"),
        default_unit="K",
        display_name="Potential temperature",
        description="Potential temperature from offline CM1/reference output.",
        required_for_visual_path=False,
    ),
    CM1FieldSpec(
        standard_name="temperature_k",
        aliases=("temperature", "temperature_k", "temp", "t"),
        default_unit="K",
        display_name="Temperature",
        description="Air temperature from offline CM1/reference output.",
        required_for_visual_path=False,
    ),
    CM1FieldSpec(
        standard_name="water_vapor_kg_per_kg",
        aliases=("qv", "qvapor", "water_vapor", "water_vapor_kg_per_kg", "mixing_ratio"),
        default_unit="kg kg-1",
        display_name="Water vapor",
        description="Water vapor mixing ratio or specific humidity from CM1/reference output.",
        required_for_visual_path=True,
    ),
    CM1FieldSpec(
        standard_name="cloud_liquid_water_kg_per_kg",
        aliases=("qc", "qcloud", "cloud_liquid_water", "cloud_liquid_water_kg_per_kg"),
        default_unit="kg kg-1",
        display_name="Cloud liquid water",
        description="Cloud liquid water from offline CM1/reference output.",
        required_for_visual_path=True,
    ),
    CM1FieldSpec(
        standard_name="rain_water_kg_per_kg",
        aliases=("qr", "qrain", "rain_water", "rain_water_kg_per_kg"),
        default_unit="kg kg-1",
        display_name="Rain water",
        description="Rain water from offline CM1/reference output, when available.",
        required_for_visual_path=False,
    ),
    CM1FieldSpec(
        standard_name="vertical_velocity_m_per_s",
        aliases=("w", "wa", "vertical_velocity", "vertical_velocity_m_per_s"),
        default_unit="m s-1",
        display_name="Vertical velocity",
        description="Vertical velocity from offline CM1/reference output.",
        required_for_visual_path=True,
    ),
    CM1FieldSpec(
        standard_name="horizontal_velocity_m_per_s",
        aliases=("u", "ua", "horizontal_velocity", "horizontal_velocity_m_per_s"),
        default_unit="m s-1",
        display_name="Horizontal velocity",
        description="Horizontal velocity from offline CM1/reference output, when available.",
        required_for_visual_path=False,
    ),
    CM1FieldSpec(
        standard_name="pressure_pa",
        aliases=("p", "prs", "pressure", "pressure_pa"),
        default_unit="Pa",
        display_name="Pressure",
        description="Pressure or pressure-derived metadata from offline CM1/reference output.",
        required_for_visual_path=False,
    ),
)


def adapt_cm1_reference_output(source: Mapping[str, object]) -> ReferenceRun:
    """Map a small CM1-like payload into Cloud Lab reference frames.

    The input is intentionally a minimal mapping so tests can use tiny synthetic fixtures
    without adding NetCDF/xarray dependencies to the default backend install.
    """

    source_case_id = _string_value(source.get("source_case_id"), "source_case_id")
    source_file_metadata = _metadata_mapping(source.get("source_file_metadata"))
    source_is_synthetic_fixture = bool(source.get("source_is_synthetic_fixture", False))
    time_seconds = _number_list(source.get("time_seconds", source.get("time")), "time_seconds")
    x_coordinates_m = _number_list(
        source.get("x_coordinates_m", source.get("x")), "x_coordinates_m"
    )
    z_coordinates_m = _number_list(
        source.get("z_coordinates_m", source.get("z")), "z_coordinates_m"
    )
    variables = _mapping_value(source.get("variables"), "variables")
    variable_units = _string_mapping(source.get("variable_units", {}), "variable_units")

    grid = ReferenceGridMetadata(
        columns=len(x_coordinates_m),
        rows=len(z_coordinates_m),
        x_coordinates_m=x_coordinates_m,
        z_coordinates_m=z_coordinates_m,
    )
    provenance = ReferenceProvenance(
        source_model="CM1",
        source_case_id=source_case_id,
        source_file_metadata=source_file_metadata,
        source_is_synthetic_fixture=source_is_synthetic_fixture,
    )

    warnings = _string_list(source.get("warnings", []), "warnings")
    mapped_variables: dict[str, tuple[CM1FieldSpec, str, list[list[list[float]]]]] = {}
    for spec in CM1_FIELD_SPECS:
        source_name = _first_available_alias(variables, spec.aliases)
        if source_name is None:
            warnings.append(f"Missing CM1 field for {spec.standard_name}.")
            continue
        mapped_variables[spec.standard_name] = (
            spec,
            source_name,
            _field_frames(variables[source_name], len(time_seconds), grid, source_name),
        )

    if not _has_temperature_or_theta(mapped_variables):
        warnings.append("Missing CM1 temperature or potential-temperature field.")

    frames: list[ReferenceFrame] = []
    for time_index, time_value in enumerate(time_seconds):
        fields: dict[str, ReferenceScalarField2D] = {}
        for standard_name, (spec, source_name, values_by_time) in mapped_variables.items():
            unit = variable_units.get(source_name, spec.default_unit)
            fields[standard_name] = ReferenceScalarField2D(
                values=values_by_time[time_index],
                metadata=ReferenceFieldMetadata(
                    unit=unit,
                    display_name=spec.display_name,
                    description=spec.description,
                    source_variable=source_name,
                    standard_name=standard_name,
                    provenance="Mapped from offline CM1/reference output.",
                ),
            )
        frames.append(
            ReferenceFrame(
                source_case_id=source_case_id,
                source_file_metadata=source_file_metadata,
                time_seconds=time_value,
                grid=grid,
                fields=fields,
                provenance=provenance,
                assumptions=list(CM1_REFERENCE_ASSUMPTIONS),
                warnings=list(warnings),
            )
        )

    diagnostics = compute_reference_run_diagnostics(
        frames=frames,
        provenance=provenance,
        warnings=warnings,
    )
    return ReferenceRun(
        source_case_id=source_case_id,
        frames=frames,
        diagnostics=diagnostics,
        warnings=warnings,
    )


def _has_temperature_or_theta(
    mapped_variables: Mapping[str, tuple[CM1FieldSpec, str, list[list[list[float]]]]],
) -> bool:
    return "temperature_k" in mapped_variables or "potential_temperature_k" in mapped_variables


def _first_available_alias(variables: Mapping[str, object], aliases: tuple[str, ...]) -> str | None:
    lowered_names = {name.lower(): name for name in variables}
    for alias in aliases:
        source_name = lowered_names.get(alias.lower())
        if source_name is not None:
            return source_name
    return None


def _field_frames(
    raw_values: object,
    time_count: int,
    grid: ReferenceGridMetadata,
    source_name: str,
) -> list[list[list[float]]]:
    values = _sequence_value(raw_values, source_name)
    if not values:
        raise ValueError(f"{source_name} must include values")

    if _is_number_sequence(values[0]):
        frame_values = [_grid_values(values, grid, source_name)]
        if time_count != 1:
            raise ValueError(
                f"{source_name} provides one frame but time_seconds has {time_count} values"
            )
        return frame_values

    frames = [_grid_values(frame_values, grid, source_name) for frame_values in values]
    if len(frames) != time_count:
        raise ValueError(
            f"{source_name} frame count {len(frames)} does not match "
            f"time_seconds length {time_count}"
        )
    return frames


def _grid_values(
    raw_grid: object,
    grid: ReferenceGridMetadata,
    source_name: str,
) -> list[list[float]]:
    rows = _sequence_value(raw_grid, source_name)
    if len(rows) != grid.rows:
        raise ValueError(
            f"{source_name} row count {len(rows)} does not match grid rows {grid.rows}"
        )

    parsed_rows: list[list[float]] = []
    for row_index, raw_row in enumerate(rows):
        row_values = _number_list(raw_row, f"{source_name}[{row_index}]")
        if len(row_values) != grid.columns:
            raise ValueError(
                f"{source_name}[{row_index}] column count {len(row_values)} "
                f"does not match grid columns {grid.columns}"
            )
        parsed_rows.append(row_values)
    return parsed_rows


def _is_number_sequence(value: object) -> bool:
    if not isinstance(value, Sequence) or isinstance(value, str | bytes):
        return False
    return all(_is_number(item) for item in value)


def _sequence_value(value: object, name: str) -> Sequence[object]:
    if isinstance(value, Sequence) and not isinstance(value, str | bytes):
        return value
    raise ValueError(f"{name} must be a sequence")


def _number_list(value: object, name: str) -> list[float]:
    sequence = _sequence_value(value, name)
    parsed: list[float] = []
    for item in sequence:
        if not _is_number(item):
            raise ValueError(f"{name} must contain only numeric values")
        parsed.append(float(cast(int | float, item)))
    if not parsed:
        raise ValueError(f"{name} must include at least one value")
    return parsed


def _is_number(value: object) -> bool:
    return isinstance(value, int | float) and not isinstance(value, bool)


def _string_value(value: object, name: str) -> str:
    if isinstance(value, str) and value:
        return value
    raise ValueError(f"{name} must be a non-empty string")


def _mapping_value(value: object, name: str) -> Mapping[str, object]:
    if isinstance(value, Mapping):
        return cast(Mapping[str, object], value)
    raise ValueError(f"{name} must be a mapping")


def _string_mapping(value: object, name: str) -> dict[str, str]:
    mapping = _mapping_value(value, name)
    parsed: dict[str, str] = {}
    for key, item in mapping.items():
        if not isinstance(key, str) or not isinstance(item, str):
            raise ValueError(f"{name} must map strings to strings")
        parsed[key] = item
    return parsed


def _string_list(value: object, name: str) -> list[str]:
    sequence = _sequence_value(value, name)
    parsed: list[str] = []
    for item in sequence:
        if not isinstance(item, str):
            raise ValueError(f"{name} must contain only strings")
        parsed.append(item)
    return parsed


def _metadata_mapping(value: object) -> dict[str, ReferenceMetadataValue]:
    if value is None:
        return {}
    mapping = _mapping_value(value, "source_file_metadata")
    parsed: dict[str, ReferenceMetadataValue] = {}
    for key, item in mapping.items():
        if not isinstance(key, str):
            raise ValueError("source_file_metadata keys must be strings")
        if isinstance(item, str | int | float | bool) or item is None:
            parsed[key] = item
        else:
            raise ValueError("source_file_metadata values must be JSON scalar values")
    return parsed

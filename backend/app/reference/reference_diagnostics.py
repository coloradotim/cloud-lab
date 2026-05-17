from app.reference.reference_schemas import (
    ReferenceDiagnostics,
    ReferenceFrame,
    ReferenceProvenance,
)

CLOUD_PRESENCE_THRESHOLD_KG_PER_KG = 1.0e-8
RAIN_PRESENCE_THRESHOLD_KG_PER_KG = 1.0e-8


def compute_reference_run_diagnostics(
    *,
    frames: list[ReferenceFrame],
    provenance: ReferenceProvenance,
    warnings: list[str],
) -> ReferenceDiagnostics:
    """Compute visualization-oriented diagnostics from mapped reference frames."""

    available_fields = sorted({field_name for frame in frames for field_name in frame.fields})
    missing_field_warnings = [warning for warning in warnings if warning.startswith("Missing")]

    cloud_values = _field_values(frames, "cloud_liquid_water_kg_per_kg")
    cloud_positions = _field_positions_above(
        frames,
        "cloud_liquid_water_kg_per_kg",
        CLOUD_PRESENCE_THRESHOLD_KG_PER_KG,
    )
    rain_values = _field_values(frames, "rain_water_kg_per_kg")
    vertical_velocity_values = _field_values(frames, "vertical_velocity_m_per_s")

    first_cloud_time = _first_threshold_time(
        frames, "cloud_liquid_water_kg_per_kg", CLOUD_PRESENCE_THRESHOLD_KG_PER_KG
    )
    first_rain_time = _first_threshold_time(
        frames, "rain_water_kg_per_kg", RAIN_PRESENCE_THRESHOLD_KG_PER_KG
    )

    return ReferenceDiagnostics(
        source_case_id=provenance.source_case_id,
        available_fields=available_fields,
        missing_field_warnings=missing_field_warnings,
        max_cloud_liquid_water_kg_per_kg=max(cloud_values) if cloud_values else None,
        integrated_cloud_liquid_water_kg_per_kg=sum(cloud_values) if cloud_values else None,
        cloud_base_m=min(cloud_positions) if cloud_positions else None,
        cloud_top_m=max(cloud_positions) if cloud_positions else None,
        first_cloud_time_seconds=first_cloud_time,
        max_updraft_m_per_s=max(vertical_velocity_values) if vertical_velocity_values else None,
        first_rain_time_seconds=first_rain_time,
        max_rain_water_kg_per_kg=max(rain_values) if rain_values else None,
        source_provenance=provenance,
        visualization_ready=bool(frames and available_fields),
    )


def _field_values(frames: list[ReferenceFrame], field_name: str) -> list[float]:
    values: list[float] = []
    for frame in frames:
        field = frame.fields.get(field_name)
        if field is None:
            continue
        values.extend(value for row in field.values for value in row)
    return values


def _field_positions_above(
    frames: list[ReferenceFrame],
    field_name: str,
    threshold: float,
) -> list[float]:
    heights: list[float] = []
    for frame in frames:
        field = frame.fields.get(field_name)
        if field is None:
            continue
        for row_index, row in enumerate(field.values):
            if any(value > threshold for value in row):
                heights.append(frame.grid.z_coordinates_m[row_index])
    return heights


def _first_threshold_time(
    frames: list[ReferenceFrame],
    field_name: str,
    threshold: float,
) -> float | None:
    for frame in frames:
        field = frame.fields.get(field_name)
        if field is None:
            continue
        if any(value > threshold for row in field.values for value in row):
            return frame.time_seconds
    return None

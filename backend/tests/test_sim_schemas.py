import pytest
from pydantic import ValidationError

from app.sim import (
    FieldMetadata,
    GridConfig,
    ScalarField2D,
    SimulationConfig,
    SimulationFrame,
    SurfaceHeatingConfig,
    create_sample_frame,
)


def test_default_simulation_config_defines_vertical_slice_controls() -> None:
    config = SimulationConfig(seed=42)

    assert config.domain.width_m == 10_000.0
    assert config.domain.height_m == 3_000.0
    assert config.grid.columns == 100
    assert config.grid.rows == 60
    assert config.time.time_step_seconds == 1.0
    assert config.time.duration_seconds == 600.0
    assert config.time.frame_interval_seconds == 10.0
    assert config.initial_atmosphere.surface_temperature_k == 298.15
    assert config.initial_atmosphere.lapse_rate_k_per_m == 0.0098
    assert config.initial_atmosphere.relative_humidity == 0.78
    assert config.surface_heating.max_warming_rate_k_per_s == 0.003
    assert config.background_wind.u_m_per_s == 1.5
    assert config.seed == 42


@pytest.mark.parametrize(
    "payload",
    [
        {"domain": {"width_m": 0}},
        {"grid": {"columns": 1}},
        {"time": {"time_step_seconds": 2.0, "frame_interval_seconds": 1.0}},
        {"surface_heating": {"patch_width_m": 0}},
    ],
)
def test_simulation_config_rejects_invalid_values(payload: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        SimulationConfig.model_validate(payload)


def test_simulation_config_rejects_spatial_values_outside_domain() -> None:
    with pytest.raises(ValidationError, match="patch_center_x_m"):
        SimulationConfig(surface_heating=SurfaceHeatingConfig(patch_center_x_m=20_000.0))


def test_sample_frame_shape_matches_grid() -> None:
    config = SimulationConfig(grid=GridConfig(columns=4, rows=3))

    frame = create_sample_frame(config)

    assert frame.grid.columns == 4
    assert frame.grid.rows == 3
    for _field_name, field in frame.fields:
        assert len(field.values) == 3
        assert all(len(row) == 4 for row in field.values)


def test_simulation_frame_rejects_field_shape_mismatch() -> None:
    frame = create_sample_frame(SimulationConfig(grid=GridConfig(columns=4, rows=3)))
    payload = frame.model_dump()
    payload["fields"]["temperature_k"]["values"] = [[1.0, 2.0]]

    with pytest.raises(ValidationError, match="temperature_k shape"):
        SimulationFrame.model_validate(payload)


def test_sample_frame_is_deterministic_for_seed() -> None:
    config = SimulationConfig(grid=GridConfig(columns=4, rows=3), seed=7)

    first = create_sample_frame(config).to_transport_dict()
    second = create_sample_frame(config).to_transport_dict()

    assert first == second
    assert (
        first["fields"]["horizontal_velocity_m_per_s"]["values"]
        == second["fields"]["horizontal_velocity_m_per_s"]["values"]
    )


def test_sample_frame_changes_seeded_velocity_when_seed_changes() -> None:
    first = create_sample_frame(SimulationConfig(grid=GridConfig(columns=4, rows=3), seed=7))
    second = create_sample_frame(SimulationConfig(grid=GridConfig(columns=4, rows=3), seed=8))

    assert (
        first.fields.horizontal_velocity_m_per_s.values
        != second.fields.horizontal_velocity_m_per_s.values
    )


def test_modeled_fields_include_units_metadata() -> None:
    frame = create_sample_frame(SimulationConfig(grid=GridConfig(columns=3, rows=2)))

    for field_name, field in frame.fields:
        assert field.metadata.unit, f"{field_name} is missing units metadata"


def test_scalar_field_requires_units_metadata() -> None:
    with pytest.raises(ValidationError):
        ScalarField2D(
            values=[[1.0]],
            metadata=FieldMetadata(unit="", display_name="Bad", description="Missing units."),
        )

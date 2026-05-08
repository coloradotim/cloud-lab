import pytest
from pydantic import ValidationError

from app.sim import (
    FieldMetadata,
    GridConfig,
    HeatingPatchConfig,
    HumidityLayerConfig,
    HumidityPatchConfig,
    InitialAtmosphereConfig,
    ScalarField2D,
    SimulationConfig,
    SimulationFrame,
    SurfaceHeatingConfig,
    create_sample_frame,
)
from app.sim.sample import build_grid_metadata
from app.sim.structured_fields import (
    StructuredGrid,
    initial_relative_humidity_field,
    surface_heating_weight_field,
)


def test_default_simulation_config_defines_vertical_slice_controls() -> None:
    config = SimulationConfig(seed=42)

    assert config.domain.width_m == 10_000.0
    assert config.solver_type == "educational_2d"
    assert config.domain.height_m == 3_000.0
    assert config.grid.columns == 100
    assert config.grid.rows == 60
    assert config.time.time_step_seconds == 1.0
    assert config.time.duration_seconds == 600.0
    assert config.time.frame_interval_seconds == 10.0
    assert config.initial_atmosphere.surface_temperature_k == 298.15
    assert config.initial_atmosphere.lapse_rate_k_per_m == 0.0065
    assert config.initial_atmosphere.relative_humidity == 0.78
    assert config.initial_atmosphere.humidity_profile == "uniform"
    assert config.surface_heating.max_warming_rate_k_per_s == 0.003
    assert config.surface_heating.pattern == "single_patch"
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


def test_structured_heating_and_humidity_config_validate_domain_bounds() -> None:
    with pytest.raises(ValidationError, match="patches\\[0\\].width_m"):
        SimulationConfig(
            surface_heating=SurfaceHeatingConfig(
                pattern="custom_patches",
                patches=[HeatingPatchConfig(width_m=20_000.0)],
            )
        )

    with pytest.raises(ValidationError, match="humidity_layers\\[0\\].top_m"):
        SimulationConfig(
            initial_atmosphere=InitialAtmosphereConfig(
                humidity_profile="custom_layers",
                humidity_layers=[
                    HumidityLayerConfig(bottom_m=1_000.0, top_m=5_000.0, relative_humidity=0.9)
                ],
            )
        )

    with pytest.raises(ValidationError, match="humidity_patch.width_m"):
        SimulationConfig(
            initial_atmosphere=InitialAtmosphereConfig(
                humidity_patch=HumidityPatchConfig(width_m=20_000.0)
            )
        )


def test_structured_heating_field_has_shape_and_bounded_weights() -> None:
    config = SimulationConfig(
        grid=GridConfig(columns=8, rows=4),
        surface_heating=SurfaceHeatingConfig(pattern="two_patches"),
    )
    metadata = build_grid_metadata(config)
    field = surface_heating_weight_field(
        config,
        StructuredGrid(
            dx_m=config.domain.width_m / config.grid.columns,
            x_coordinates_m=metadata.x_coordinates_m,
            z_coordinates_m=metadata.z_coordinates_m,
        ),
    )

    assert len(field) == config.grid.rows
    assert all(len(row) == config.grid.columns for row in field)
    assert max(max(row) for row in field) <= 1.0
    assert min(min(row) for row in field) >= 0.0
    assert sum(1 for value in field[0] if value > 0.0) >= 2


def test_structured_humidity_field_has_shape_and_expected_layers() -> None:
    config = SimulationConfig(
        grid=GridConfig(columns=6, rows=6),
        initial_atmosphere=InitialAtmosphereConfig(
            relative_humidity=0.7,
            boundary_layer_depth_m=1_000.0,
            humidity_profile="moist_boundary_layer",
        ),
    )
    metadata = build_grid_metadata(config)
    field = initial_relative_humidity_field(
        config,
        StructuredGrid(
            dx_m=config.domain.width_m / config.grid.columns,
            x_coordinates_m=metadata.x_coordinates_m,
            z_coordinates_m=metadata.z_coordinates_m,
        ),
    )

    assert len(field) == config.grid.rows
    assert all(len(row) == config.grid.columns for row in field)
    assert max(max(row) for row in field) <= 1.0
    assert min(min(row) for row in field) >= 0.0
    assert field[0][0] > field[-1][0]


def test_simulation_config_accepts_microphysics_lab_solver_type() -> None:
    config = SimulationConfig(solver_type="microphysics_lab")

    assert config.solver_type == "microphysics_lab"


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

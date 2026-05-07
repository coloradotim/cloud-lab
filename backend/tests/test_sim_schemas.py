import pytest
from pydantic import ValidationError

from app.sim import SimulationConfig, SimulationFrame


def test_default_simulation_config_has_vertical_slice_shape() -> None:
    config = SimulationConfig()

    assert config.width_m == 10_000.0
    assert config.height_m == 3_000.0
    assert config.grid_columns == 100
    assert config.grid_rows == 60


def test_simulation_frame_schema_is_stable() -> None:
    frame = SimulationFrame(step=0, elapsed_seconds=0.0, config=SimulationConfig(seed=42))

    assert frame.model_dump() == {
        "step": 0,
        "elapsed_seconds": 0.0,
        "config": {
            "width_m": 10_000.0,
            "height_m": 3_000.0,
            "grid_columns": 100,
            "grid_rows": 60,
            "seed": 42,
        },
    }


def test_simulation_config_rejects_non_positive_domain_dimensions() -> None:
    with pytest.raises(ValidationError):
        SimulationConfig(width_m=0)

import pytest

from app.sim.pysdm_evaluation import PySDMUnavailableError, run_box_coalescence_smoke

pytestmark = [pytest.mark.pysdm, pytest.mark.science]


def test_pysdm_box_coalescence_smoke_is_reproducible() -> None:
    try:
        first = run_box_coalescence_smoke()
        second = run_box_coalescence_smoke()
    except PySDMUnavailableError as exc:
        pytest.skip(str(exc))

    assert first.radius_bin_edges_um == second.radius_bin_edges_um
    assert first.snapshots == second.snapshots
    assert first.snapshots[0].time_seconds == 0
    assert first.snapshots[-1].time_seconds > first.snapshots[0].time_seconds
    assert first.snapshots[-1].rain_indicator_fraction >= first.snapshots[0].rain_indicator_fraction
    assert first.snapshots[-1].total_particle_volume_m3_per_m3 == pytest.approx(
        first.snapshots[0].total_particle_volume_m3_per_m3
    )

from __future__ import annotations

import argparse
import json
import time
import warnings
from dataclasses import asdict, dataclass, field
from importlib import import_module
from importlib.metadata import PackageNotFoundError, version
from typing import Any, cast


class PySDMUnavailableError(RuntimeError):
    """Raised when the optional PySDM evaluation dependency is unavailable."""


@dataclass(frozen=True)
class PySDMBoxCoalescenceConfig:
    """Small isolated PySDM box-model smoke configuration.

    This intentionally exercises PySDM outside Cloud Lab's production solvers.
    """

    super_droplet_count: int = 128
    timestep_seconds: float = 1.0
    box_volume_m3: float = 1.0e6
    output_times_seconds: tuple[int, ...] = (0, 10, 20, 60)
    radius_bin_min_um: float = 10.0
    radius_bin_max_um: float = 1_000.0
    radius_bin_count: int = 16
    seed: int = 1


@dataclass(frozen=True)
class DropletDistributionSnapshot:
    time_seconds: int
    total_particle_volume_m3_per_m3: float
    peak_particle_volume_m3_per_m3: float
    rain_indicator_fraction: float
    volume_distribution_by_radius_bin: list[float]


@dataclass(frozen=True)
class PySDMBoxCoalescenceResult:
    pysdm_version: str
    elapsed_seconds: float
    radius_bin_edges_um: list[float]
    snapshots: list[DropletDistributionSnapshot] = field(default_factory=list)


def run_box_coalescence_smoke(
    config: PySDMBoxCoalescenceConfig | None = None,
) -> PySDMBoxCoalescenceResult:
    """Run a tiny isolated PySDM coalescence box and return distribution snapshots."""

    resolved = config or PySDMBoxCoalescenceConfig()
    dependencies = _load_pysdm_dependencies()
    np = dependencies["numpy"]
    si = dependencies["si"]
    start = time.perf_counter()

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        initial_spectrum = dependencies["Exponential"](
            norm_factor=8.39e12,
            scale=1.19e5 * si.um**3,
        )
        volume, multiplicity = dependencies["ConstantMultiplicity"](
            spectrum=initial_spectrum
        ).sample(resolved.super_droplet_count)
        attributes = {"volume": volume, "multiplicity": multiplicity}
        radius_bin_edges = np.logspace(
            np.log10(resolved.radius_bin_min_um * si.um),
            np.log10(resolved.radius_bin_max_um * si.um),
            resolved.radius_bin_count + 1,
        )
        environment = dependencies["Box"](
            dt=resolved.timestep_seconds * si.s,
            dv=resolved.box_volume_m3 * si.m**3,
        )
        builder = dependencies["Builder"](
            n_sd=resolved.super_droplet_count,
            backend=dependencies["CPU"](dependencies["Formulae"](seed=resolved.seed)),
            environment=environment,
        )
        builder.add_dynamic(
            dependencies["Coalescence"](
                collision_kernel=dependencies["Golovin"](b=1.5e3 / si.s),
                optimized_random=False,
            )
        )
        products = [
            dependencies["ParticleVolumeVersusRadiusLogarithmSpectrum"](
                radius_bins_edges=radius_bin_edges,
                name="dv/dlnr",
            )
        ]
        particulator = builder.build(attributes, products)
        snapshots = [
            _snapshot_for_time(
                particulator=particulator,
                target_time_seconds=target_time,
                radius_bin_edges=radius_bin_edges,
            )
            for target_time in resolved.output_times_seconds
        ]

    return PySDMBoxCoalescenceResult(
        pysdm_version=_package_version("PySDM"),
        elapsed_seconds=time.perf_counter() - start,
        radius_bin_edges_um=[float(edge / si.um) for edge in radius_bin_edges.tolist()],
        snapshots=snapshots,
    )


def _snapshot_for_time(
    *,
    particulator: Any,
    target_time_seconds: int,
    radius_bin_edges: Any,
) -> DropletDistributionSnapshot:
    particulator.run(target_time_seconds - particulator.n_steps)
    distribution = cast(Any, particulator.products["dv/dlnr"].get())[0]
    distribution_values = [float(value) for value in distribution.tolist()]
    total_volume = sum(distribution_values)
    rain_threshold_bin_index = _first_bin_index_at_or_above(radius_bin_edges, threshold_um=40.0)
    rain_volume = sum(distribution_values[rain_threshold_bin_index:])

    return DropletDistributionSnapshot(
        time_seconds=target_time_seconds,
        total_particle_volume_m3_per_m3=total_volume,
        peak_particle_volume_m3_per_m3=max(distribution_values),
        rain_indicator_fraction=rain_volume / total_volume if total_volume > 0.0 else 0.0,
        volume_distribution_by_radius_bin=distribution_values,
    )


def _first_bin_index_at_or_above(radius_bin_edges: Any, *, threshold_um: float) -> int:
    edges = [float(edge) for edge in radius_bin_edges.tolist()]
    threshold_m = threshold_um * 1.0e-6
    for index, edge in enumerate(edges[:-1]):
        if edge >= threshold_m:
            return index
    return max(0, len(edges) - 2)


def _load_pysdm_dependencies() -> dict[str, Any]:
    try:
        pysdm = import_module("PySDM")
        backends = import_module("PySDM.backends")
        environments = import_module("PySDM.environments")
        dynamics = import_module("PySDM.dynamics")
        kernels = import_module("PySDM.dynamics.collisions.collision_kernels")
        sampling = import_module("PySDM.initialisation.sampling.spectral_sampling")
        spectra = import_module("PySDM.initialisation.spectra")
        physics = import_module("PySDM.physics")
        products = import_module("PySDM.products")
        numpy = import_module("numpy")
    except ImportError as exc:
        raise PySDMUnavailableError(
            'Install the optional evaluation dependency with: pip install -e ".[pysdm-eval]"'
        ) from exc

    return {
        "numpy": numpy,
        "Builder": pysdm.Builder,
        "Formulae": pysdm.Formulae,
        "CPU": backends.CPU,
        "Box": environments.Box,
        "Coalescence": dynamics.Coalescence,
        "Golovin": kernels.Golovin,
        "ConstantMultiplicity": sampling.ConstantMultiplicity,
        "Exponential": spectra.Exponential,
        "si": physics.si,
        "ParticleVolumeVersusRadiusLogarithmSpectrum": (
            products.ParticleVolumeVersusRadiusLogarithmSpectrum
        ),
    }


def _package_version(package_name: str) -> str:
    try:
        return version(package_name)
    except PackageNotFoundError:
        return "unknown"


def _to_jsonable(result: PySDMBoxCoalescenceResult) -> dict[str, object]:
    return cast(dict[str, object], asdict(result))


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the isolated PySDM box smoke prototype.")
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON.")
    args = parser.parse_args()

    result = run_box_coalescence_smoke()
    if args.json:
        print(json.dumps(_to_jsonable(result), indent=2, sort_keys=True))
        return

    print(f"PySDM {result.pysdm_version} box coalescence smoke")
    print(f"Elapsed: {result.elapsed_seconds:.3f} s")
    for snapshot in result.snapshots:
        print(
            f"t={snapshot.time_seconds:>3}s "
            f"total={snapshot.total_particle_volume_m3_per_m3:.6e} "
            f"peak={snapshot.peak_particle_volume_m3_per_m3:.6e} "
            f"rain_indicator={snapshot.rain_indicator_fraction:.3f}"
        )


if __name__ == "__main__":
    main()

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from typing import Any

from app.sim import microphysics_lab
from app.sim.schemas import (
    BackgroundWindConfig,
    GridConfig,
    InitialAtmosphereConfig,
    SimulationConfig,
    SurfaceHeatingConfig,
    TimeConfig,
)
from app.sim.solver import run_simulation


@dataclass(frozen=True)
class ComparisonCase:
    slug: str
    name: str
    description: str
    config: SimulationConfig


def microphysics_comparison_cases() -> list[ComparisonCase]:
    base = _base_config()
    return [
        ComparisonCase(
            slug="gentle-cooling-low-supersaturation",
            name="Gentle cooling / low supersaturation",
            description=(
                "Slow prescribed ascent from a humid parcel. Expected to condense gradually "
                "without rain initiation."
            ),
            config=base.model_copy(
                update={
                    "initial_atmosphere": base.initial_atmosphere.model_copy(
                        update={"relative_humidity": 0.90}
                    ),
                    "background_wind": BackgroundWindConfig(u_m_per_s=0.0, w_m_per_s=0.20),
                    "time": base.time.model_copy(update={"duration_seconds": 1_200.0}),
                }
            ),
        ),
        ComparisonCase(
            slug="stronger-cooling-high-supersaturation",
            name="Stronger cooling / high supersaturation",
            description=(
                "Faster ascent from a nearly saturated parcel. Expected to condense earlier "
                "and produce more cloud water."
            ),
            config=base.model_copy(
                update={
                    "initial_atmosphere": base.initial_atmosphere.model_copy(
                        update={"relative_humidity": 0.99}
                    ),
                    "background_wind": BackgroundWindConfig(u_m_per_s=0.0, w_m_per_s=1.0),
                    "time": base.time.model_copy(update={"duration_seconds": 1_800.0}),
                }
            ),
        ),
        ComparisonCase(
            slug="prescribed-updraft-history",
            name="Prescribed updraft history",
            description=(
                "Constant prescribed lift over a longer parcel path. This stands in for "
                "the first repeatable updraft-history case until time-varying forcing exists."
            ),
            config=base.model_copy(
                update={
                    "initial_atmosphere": base.initial_atmosphere.model_copy(
                        update={"relative_humidity": 0.98}
                    ),
                    "background_wind": BackgroundWindConfig(u_m_per_s=0.0, w_m_per_s=0.75),
                    "time": base.time.model_copy(update={"duration_seconds": 2_400.0}),
                }
            ),
        ),
        ComparisonCase(
            slug="rain-initiation-stress",
            name="Rain-initiation stress",
            description=(
                "Very humid strong-lift case for exercising the current bulk autoconversion "
                "placeholder. This is not collision/coalescence physics."
            ),
            config=base.model_copy(
                update={
                    "initial_atmosphere": base.initial_atmosphere.model_copy(
                        update={"relative_humidity": 1.0}
                    ),
                    "background_wind": BackgroundWindConfig(u_m_per_s=0.0, w_m_per_s=1.4),
                    "time": base.time.model_copy(update={"duration_seconds": 2_400.0}),
                }
            ),
        ),
    ]


def run_microphysics_comparison() -> dict[str, Any]:
    return {
        "schema_version": "microphysics-comparison-v1",
        "models": {
            "simple_saturation_adjustment": (
                "Instant saturation adjustment with latent heating and no rain conversion."
            ),
            "microphysics_lab": (
                "Production bulk parcel/box mode with saturation adjustment, latent heating, "
                "and simple rain autoconversion."
            ),
        },
        "cases": [_case_result(case) for case in microphysics_comparison_cases()],
        "notes": [
            "No PySDM output is included unless a future optional PySDM runner is added.",
            "Current comparison is bulk microphysics only; it is not droplet-resolved validation.",
            "All cases remain decoupled from boussinesq_2d dynamics.",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Cloud Lab microphysics comparison cases.")
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON output.")
    args = parser.parse_args()
    result = run_microphysics_comparison()

    if args.json:
        print(json.dumps(result, indent=2, sort_keys=True))
        return

    for case in result["cases"]:
        print(f"{case['name']} ({case['slug']})")
        for model_name, metrics in case["models"].items():
            print(
                f"  {model_name}: first cloud={metrics['first_cloud_time_seconds']} s, "
                f"max cloud={metrics['max_cloud_liquid_water_kg_per_kg']:.3e}, "
                f"max rain={metrics['max_rain_water_kg_per_kg']:.3e}"
            )


def _case_result(case: ComparisonCase) -> dict[str, Any]:
    simple_samples = _run_simple_saturation_adjustment(case.config)
    lab_frames = run_simulation(case.config)
    lab_samples = [_sample_from_frame(frame) for frame in lab_frames]

    return {
        "slug": case.slug,
        "name": case.name,
        "description": case.description,
        "forcing": {
            "duration_seconds": case.config.time.duration_seconds,
            "time_step_seconds": case.config.time.time_step_seconds,
            "relative_humidity": case.config.initial_atmosphere.relative_humidity,
            "vertical_velocity_m_per_s": case.config.background_wind.w_m_per_s,
            "surface_heating_max_k_per_s": case.config.surface_heating.max_warming_rate_k_per_s,
        },
        "models": {
            "simple_saturation_adjustment": _metrics_from_samples(simple_samples),
            "microphysics_lab": _metrics_from_samples(lab_samples),
        },
        "interpretation": _interpret_case(simple_samples, lab_samples),
    }


def _run_simple_saturation_adjustment(config: SimulationConfig) -> list[dict[str, float]]:
    dt = config.time.time_step_seconds
    max_steps = int(config.time.duration_seconds / dt)
    next_sample_time = 0.0
    samples: list[dict[str, float]] = []

    temperature_k = config.initial_atmosphere.surface_temperature_k
    initial_saturation = microphysics_lab._saturation_specific_humidity_kg_per_kg(temperature_k)
    vapor = initial_saturation * config.initial_atmosphere.relative_humidity
    cloud = 0.0
    height = 0.0

    for step in range(max_steps + 1):
        time_seconds = step * dt
        if time_seconds + 1e-9 >= next_sample_time:
            samples.append(
                {
                    "time_seconds": time_seconds,
                    "temperature_k": temperature_k,
                    "height_m": height,
                    "water_vapor_kg_per_kg": vapor,
                    "cloud_liquid_water_kg_per_kg": cloud,
                    "rain_water_kg_per_kg": 0.0,
                }
            )
            next_sample_time += config.time.frame_interval_seconds

        if step == max_steps:
            break

        heating_rate = (
            config.surface_heating.max_warming_rate_k_per_s
            * microphysics_lab._boundary_layer_heating_weight(config, height)
        )
        temperature_k += (
            heating_rate
            - microphysics_lab.DRY_ADIABATIC_LAPSE_RATE_K_PER_M * config.background_wind.w_m_per_s
        ) * dt
        height = max(0.0, height + config.background_wind.w_m_per_s * dt)
        saturation = microphysics_lab._saturation_specific_humidity_kg_per_kg(temperature_k)
        if vapor > saturation:
            condensed = vapor - saturation
            vapor -= condensed
            cloud += condensed
            temperature_k += microphysics_lab.LATENT_HEATING_K_PER_KG_PER_KG * condensed
        elif cloud > 0.0:
            evaporated = min(cloud, saturation - vapor)
            vapor += evaporated
            cloud -= evaporated
            temperature_k -= microphysics_lab.LATENT_HEATING_K_PER_KG_PER_KG * evaporated

    return samples


def _sample_from_frame(frame: Any) -> dict[str, float]:
    return {
        "time_seconds": frame.time_seconds,
        "temperature_k": _field_value(frame, "temperature_k"),
        "height_m": frame.time_seconds * frame.config.background_wind.w_m_per_s,
        "water_vapor_kg_per_kg": _field_value(frame, "water_vapor_kg_per_kg"),
        "cloud_liquid_water_kg_per_kg": _field_value(frame, "cloud_liquid_water_kg_per_kg"),
        "rain_water_kg_per_kg": _field_value(frame, "rain_water_kg_per_kg"),
    }


def _metrics_from_samples(samples: list[dict[str, float]]) -> dict[str, float | None]:
    first = samples[0]
    final = samples[-1]
    first_cloud_time = _first_time_above(samples, "cloud_liquid_water_kg_per_kg", 1e-10)
    first_rain_time = _first_time_above(samples, "rain_water_kg_per_kg", 1e-10)
    max_cloud = max(sample["cloud_liquid_water_kg_per_kg"] for sample in samples)
    max_rain = max(sample["rain_water_kg_per_kg"] for sample in samples)

    return {
        "first_cloud_time_seconds": first_cloud_time,
        "max_cloud_liquid_water_kg_per_kg": max_cloud,
        "integrated_cloud_liquid_water_kg_per_kg_s": _integrate_time_series(
            samples,
            "cloud_liquid_water_kg_per_kg",
        ),
        "water_vapor_depletion_kg_per_kg": (
            first["water_vapor_kg_per_kg"] - final["water_vapor_kg_per_kg"]
        ),
        "first_rain_time_seconds": first_rain_time,
        "max_rain_water_kg_per_kg": max_rain,
        "final_temperature_c": final["temperature_k"] - 273.15,
        "final_height_m": final["height_m"],
    }


def _interpret_case(
    simple_samples: list[dict[str, float]],
    lab_samples: list[dict[str, float]],
) -> list[str]:
    simple_metrics = _metrics_from_samples(simple_samples)
    lab_metrics = _metrics_from_samples(lab_samples)
    notes = [
        "Both paths use bulk saturation adjustment, so neither represents droplet-resolved growth.",
    ]

    if lab_metrics["max_rain_water_kg_per_kg"] and lab_metrics["max_rain_water_kg_per_kg"] > 0.0:
        notes.append("microphysics_lab converts some cloud water to rain water in this case.")
    else:
        notes.append("microphysics_lab does not initiate rain water in this case.")

    if simple_metrics["first_cloud_time_seconds"] != lab_metrics["first_cloud_time_seconds"]:
        notes.append(
            "Cloud timing differs because lab rain/evaporation feedback changes the budget."
        )
    else:
        notes.append("Cloud timing matches because both paths use instant saturation adjustment.")

    return notes


def _first_time_above(
    samples: list[dict[str, float]],
    key: str,
    threshold: float,
) -> float | None:
    for sample in samples:
        if sample[key] > threshold:
            return sample["time_seconds"]
    return None


def _integrate_time_series(samples: list[dict[str, float]], key: str) -> float:
    total = 0.0
    for previous, current in zip(samples, samples[1:], strict=False):
        dt = current["time_seconds"] - previous["time_seconds"]
        total += 0.5 * (previous[key] + current[key]) * dt
    return total


def _field_value(frame: Any, field_key: str) -> float:
    values = frame.fields.__getattribute__(field_key).values
    return values[0][0]


def _base_config() -> SimulationConfig:
    return SimulationConfig(
        solver_type="microphysics_lab",
        grid=GridConfig(columns=6, rows=4),
        time=TimeConfig(
            time_step_seconds=5.0,
            duration_seconds=1_800.0,
            frame_interval_seconds=60.0,
        ),
        initial_atmosphere=InitialAtmosphereConfig(
            surface_temperature_k=298.15,
            relative_humidity=0.98,
            boundary_layer_depth_m=1_000.0,
        ),
        surface_heating=SurfaceHeatingConfig(max_warming_rate_k_per_s=0.0),
        background_wind=BackgroundWindConfig(u_m_per_s=0.0, w_m_per_s=0.5),
        seed=101,
    )


if __name__ == "__main__":
    main()

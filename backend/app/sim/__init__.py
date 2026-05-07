"""Simulation core package.

This package must stay independent from API and frontend code so cloud physics can be
tested, reused, and evolved without browser or transport concerns.
"""

from app.sim.schemas import SimulationConfig, SimulationFrame

__all__ = ["SimulationConfig", "SimulationFrame"]

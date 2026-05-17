"""Offline reference-model adapters for Cloud Lab.

Reference adapters ingest outputs from external models such as CM1. They do not run
those models inside normal Cloud Lab app sessions.
"""

from app.reference.cm1_adapter import CM1_FIELD_SPECS, adapt_cm1_reference_output
from app.reference.reference_diagnostics import compute_reference_run_diagnostics
from app.reference.reference_schemas import (
    ReferenceDiagnostics,
    ReferenceFieldMetadata,
    ReferenceFrame,
    ReferenceGridMetadata,
    ReferenceProvenance,
    ReferenceRun,
    ReferenceScalarField2D,
)

__all__ = [
    "CM1_FIELD_SPECS",
    "ReferenceDiagnostics",
    "ReferenceFieldMetadata",
    "ReferenceFrame",
    "ReferenceGridMetadata",
    "ReferenceProvenance",
    "ReferenceRun",
    "ReferenceScalarField2D",
    "adapt_cm1_reference_output",
    "compute_reference_run_diagnostics",
]

# Legacy Effect Library (Deprecated)

Status: DEPRECATED (WAVE 4859+)

This folder is kept only as a code repository/reference for historical fixes.

Rules:
- Do not wire anything in runtime flow to classes under `src/core/effects/library/**`.
- Main execution flow must run only through Hephaestus `.lfx` clips (`fxType: "heph-custom"`).
- New effects must be authored in `.lfx` (V3), not as legacy TypeScript effect classes.

Enforcement:
- `TimelineEngine` blocks non-`heph-custom` clip routes and logs a one-time deprecation warning per `fxType`.

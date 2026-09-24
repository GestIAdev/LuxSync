/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 MCC CAPABILITY — WAVE 8040B: ¿MCC-Cell o MCC-Z?
 *
 * Fuente única de verdad sobre si el runtime compilado lleva los parches
 * Δ1–Δ3 (WAVE 8040A — blendSuffix celular en HephaestusRuntime,
 * `cell` en HephFixtureOutput, match exacto `_nodeCellMatches` en
 * HephaestusAetherAdapter).
 *
 *   true  → MCC-Cell: independencia por celda vía `track.cell`.
 *   false → MCC-Z:    degradación honesta — celdas agrupadas por zona
 *                     (aetherZone). Jamás se emite un `.lfx` que prometa
 *                     independencia que el runtime colapsaría (§T7).
 *
 * Es una constante de BUILD — los parches viven en este árbol fuente.
 * Si una build futura excluyera Δ1–Δ3, esta bandera se pondría a false
 * en el mismo commit y la UI degradaría sola.
 *
 * @module HephaestusView/asteria/mccCapability
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Δ1+Δ2+Δ3 presentes en este build (commit 3e08a27e, WAVE 8040A). */
export const MCC_CELL_AVAILABLE = true

/** Tooltip honesto cuando MCC-Cell no está disponible (§T7 verbatim). */
export const MCC_CELL_UNAVAILABLE_TOOLTIP =
  'Per-cell independence: requires WAVE 8040. Falling back to zone grouping.'

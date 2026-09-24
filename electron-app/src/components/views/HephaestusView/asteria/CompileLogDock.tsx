/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 COMPILE LOG DOCK — WAVE 8203 (M2): CUARENTENA DEL LOGGER
 *
 * Mini-terminal colapsable acoplada al fondo del rail del Inspector.
 * Reemplaza al logger que flotaba sobre el canvas 2D (BudgetDetail del
 * transport drawer): el lienzo táctico ya no se tapa jamás.
 *
 *   ┌─ COMPILE LOG ──────────── [2 ERR] [4 WARN] [▾] ┐
 *   │  ✖ TRACK_REJECTED 'ast_pan_…' — kf fuera de [0,D]   │
 *   │  ✖ NO_TRACKS — no emittable targetParam             │
 *   │  ⚠ COHORT_ZONE_SPILL fl [pan] — 3 node(s) fuera…   │
 *   │  ⚠ PARAM_SKIPPED 'gobo1' — sin canal sintetizable  │
 *   └─────────────────────────────────────────────────┘
 *
 * Severidad por código de warning (emissionPlan/AsteriaCompiler):
 *   ERR  → la emisión quedó rota o la intención violada (EMPTY_FIELD,
 *          NO_TRACKS, TRACK_REJECTED, RIDE_*, COHORT_EMPTY,
 *          AST_SHADOWS_FORGE).
 *   WARN → notas de optimización/cobertura que el operador puede
 *          aceptar (PARAM_*, COHORT_ZONE_SPILL, COLOR_*, GLYPH_*,
 *          SHAPE_ISOLATED, COHORT_ISOLATED, MCC_DEVICE_NO_SPILL,
 *          GAIN_REQUIRES_COHORTS).
 *
 * Auto-expansión: un reporte nuevo con errores abre el dock por sí solo
 * (la crítica se impone); el operador puede colapsarlo y su decisión se
 * respeta hasta el próximo reporte.
 *
 * @module HephaestusView/asteria/CompileLogDock
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useEffect, useState } from 'react'
import { useAsteriaStore } from './store/useAsteriaStore'

// ═══════════════════════════════════════════════════════════════════════════
// SEVERITY — código → clase
// ═══════════════════════════════════════════════════════════════════════════

/** Códigos que marcan emisión rota / intención violada → rojo crítico. */
const CRITICAL_CODES: ReadonlySet<string> = new Set([
  'EMPTY_FIELD',
  'NO_TRACKS',
  'TRACK_REJECTED',
  'RIDE_SOURCE_MISSING',
  'RIDE_TYPE_MISMATCH',
  'COHORT_EMPTY',
  'AST_SHADOWS_FORGE',
])

/** Extrae el `CODE` inicial del string (`CODE 'x' — desc` / `CODE — desc`). */
function warningCode(w: string): string {
  const m = /^([A-Z][A-Z0-9_]+)/.exec(w)
  return m ? m[1] : ''
}

function isCritical(w: string): boolean {
  return CRITICAL_CODES.has(warningCode(w))
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const CompileLogDock: React.FC = () => {
  const report = useAsteriaStore((s) => s.lastCompileReport)
  const [open, setOpen] = useState(false)

  const warnings = report?.warnings ?? []
  const errCount = warnings.filter(isCritical).length
  const warnCount = warnings.length - errCount

  // 🜨 La crítica se impone: un reporte con errores reabre el dock.
  // `report` cambia de identidad en cada compile — dep correcta.
  useEffect(() => {
    if (report && errCount > 0) setOpen(true)
  }, [report, errCount])

  return (
    <div className="asteria-rail__section asteria-logdock">
      <button
        type="button"
        className="asteria-logdock__head"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="asteria-rail__title">COMPILE LOG</span>
        {errCount > 0 && (
          <span className="asteria-logdock__badge asteria-logdock__badge--err">
            {errCount} ERR
          </span>
        )}
        {warnCount > 0 && (
          <span className="asteria-logdock__badge asteria-logdock__badge--warn">
            {warnCount} WARN
          </span>
        )}
        <span className="asteria-logdock__chev">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="asteria-logdock__body">
          {!report && (
            <div className="asteria-logdock__line asteria-logdock__line--dim">
              awaiting first compile…
            </div>
          )}
          {report && warnings.length === 0 && (
            <div className="asteria-logdock__line asteria-logdock__line--ok">
              ✓ 0 warnings — clean compile
            </div>
          )}
          {warnings.map((w) => (
            <div
              key={w}
              className={`asteria-logdock__line ${
                isCritical(w)
                  ? 'asteria-logdock__line--err'
                  : 'asteria-logdock__line--warn'
              }`}
            >
              {isCritical(w) ? '✖' : '⚠'} {w}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default CompileLogDock

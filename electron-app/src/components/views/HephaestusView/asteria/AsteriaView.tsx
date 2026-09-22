/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 ASTERIA VIEW — WAVE 8010-P2: ORQUESTADOR DEL LIENZO TÁCTICO
 *
 * Layout interno del Pixel Mapper (blueprint §Arquitectura):
 *
 *   ┌──────────┬──────────────────────────────┬────────────────┐
 *   │ TOOLBOX  │      TACTICAL CANVAS         │  GESTURE STACK │
 *   │ (56px)   │      <AsteriaCanvas />       │  (260px)       │
 *   └──────────┴──────────────────────────────┴────────────────┘
 *
 * P2: monta useNodeAtlas (fetch del NodeGraph real, WAVE 8000) — el atlas
 * se deposita en useAsteriaStore y las capas del canvas lo leen por
 * getState() dentro del RAF (zero React cost). El rail muestra de momento
 * el estado del atlas como HUD mínimo; las herramientas y el Gesture
 * Stack llegan en waves posteriores.
 *
 * `preview` (HephPreviewReturn) y `temporalActions` ya entran por props —
 * son el contrato con la shell de Hephaestus y alimentarán la TimeBar /
 * AUDITION en waves posteriores. P2 no los consume aún.
 *
 * @module HephaestusView/asteria/AsteriaView
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React from 'react'
import type { HephPreviewReturn } from '../useHephPreview'
import type { TemporalActions } from '../types/HephaestusShared'
import { AsteriaCanvas } from './canvas/AsteriaCanvas'
import { useNodeAtlas } from './canvas/useNodeAtlas'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface AsteriaViewProps {
  /** Preview a 44 Hz del clip en edición — AUDITION/scrub (WAVE posterior). */
  preview: HephPreviewReturn
  /** Undo/redo y transporte temporal compartido con Forge/Lab. */
  temporalActions: TemporalActions
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const AsteriaView: React.FC<AsteriaViewProps> = (_props) => {
  const { atlas, loading, error } = useNodeAtlas()

  return (
    <div className="asteria-view">
      {/* ── TOOLBOX — WAVE 8020: Chrono-Brush · Wavefront · Glyph ·
              Slicer · Bisturí Celular · Noise ── */}
      <div className="asteria-toolbox" aria-label="Asteria tools" />

      {/* ── LIENZO TÁCTICO ── */}
      <AsteriaCanvas />

      {/* ── GESTURE STACK / inspector — HUD del atlas hasta el Stack ── */}
      <div className="asteria-side-rail" aria-label="Gesture stack">
        <div className="asteria-rail__section">
          <div className="asteria-rail__title">NODE ATLAS</div>
          {loading && <div className="asteria-rail__muted">cargando topología…</div>}
          {!loading && error && (
            <div className="asteria-rail__error">{error}</div>
          )}
          {!loading && !error && atlas && (
            <>
              <div className="asteria-rail__stat">
                {atlas.entries.length} nodos
              </div>
              <div className="asteria-rail__muted">
                {atlas.entries.filter((e) => e.position).length} con posición
              </div>
            </>
          )}
          {!loading && !error && !atlas && (
            <div className="asteria-rail__muted">sin datos del grafo</div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 ASTERIA VIEW — WAVE 8010-P1: ORQUESTADOR DEL LIENZO TÁCTICO
 *
 * Layout interno del Pixel Mapper (blueprint §Arquitectura):
 *
 *   ┌──────────┬──────────────────────────────┬────────────────┐
 *   │ TOOLBOX  │      TACTICAL CANVAS         │  GESTURE STACK │
 *   │ (56px)   │      <AsteriaCanvas />       │  (260px)       │
 *   └──────────┴──────────────────────────────┴────────────────┘
 *
 * P1 monta la estructura: raíl de herramientas y panel derecho quedan como
 * placeholders estilizados hasta que P2 añada Chrono-Brush, Wavefront,
 * Glyph Stamper, Slicer, Bisturí y el Gesture Stack.
 *
 * `preview` (HephPreviewReturn) y `temporalActions` ya entran por props —
 * son el contrato con la shell de Hephaestus y alimentarán la TimeBar /
 * AUDITION en waves posteriores. P1 no los consume aún.
 *
 * @module HephaestusView/asteria/AsteriaView
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React from 'react'
import type { HephPreviewReturn } from '../useHephPreview'
import type { TemporalActions } from '../types/HephaestusShared'
import { AsteriaCanvas } from './canvas/AsteriaCanvas'

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
  return (
    <div className="asteria-view">
      {/* ── TOOLBOX — WAVE 8010-P2: Chrono-Brush · Wavefront · Glyph ·
              Slicer · Bisturí Celular · Noise ── */}
      <div className="asteria-toolbox" aria-label="Asteria tools" />

      {/* ── LIENZO TÁCTICO ── */}
      <AsteriaCanvas />

      {/* ── GESTURE STACK / inspector — WAVE 8010-P2 ── */}
      <div className="asteria-side-rail" aria-label="Gesture stack" />
    </div>
  )
}

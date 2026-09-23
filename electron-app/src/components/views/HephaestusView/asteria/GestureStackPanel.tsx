/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 GESTURE STACK PANEL — WAVE 8055: LAS CAPAS
 *
 * El Gesture Stack como panel de capas estilo Photoshop:
 *
 *   ┌─ GESTURE STACK ───────────── [↺ reset] ┐
 *   │  A  GLYPH   "LUX" · GAIN          [✕] │  ← cima de la pila
 *   │  ✎  CHRONO  47 pts                [✕] │
 *   │  ◉  BASE    +0ms · ×1.00          [✕] │  ← fondo
 *   └────────────────────────────────────────┘
 *
 * - Cima de la pila primero (los últimos gestos mezclan sobre los
 *   primeros — el orden visual refleja el orden de evaluación).
 * - Click en la fila → `setSelectedGesture` (capa activa del inspector).
 * - ✕ → `removeGesture(id)` — eliminación no destructiva, la receta
 *   se recompila sin esa capa.
 * - ↺ → `resetProject()` — pila nueva con el gesto `base` identidad.
 * - En modo solo-lectura (rig drift) los botones se deshabilitan — las
 *   acciones del store ya los guardan, pero el UI lo comunica antes.
 *
 * Puro render: ningún hook de RAF ni de compilación vive aquí.
 *
 * @module HephaestusView/asteria/GestureStackPanel
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React from 'react'
import { useAsteriaStore } from './store/useAsteriaStore'
import type { Gesture, GestureKind } from './model/AsteriaProject'

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS DE PRESENTACIÓN
// ═══════════════════════════════════════════════════════════════════════════

/** Icono por kind — coherente con los glyphs de las tools del toolbox. */
const KIND_ICON: Record<GestureKind, string> = {
  base: '◉',
  wave: '≈',
  chrono: '✎',
  glyph: 'A',
  slice: '▦',
  manual: '◈',
  noise: '⁂',
}

/** Descriptor corto — lo que el operador necesita reconocer la capa. */
function describe(g: Gesture): string {
  switch (g.kind) {
    case 'base':
      return `+${g.delayMs}ms · ×${g.gain.toFixed(2)}`
    case 'wave':
      return `${g.shape} · ${g.speedMps} m/s`
    case 'chrono':
      return `${g.stroke.length} pts · ${g.radiusM.toFixed(2)} m`
    case 'glyph':
      return `"${g.text ?? '…'}" · ${g.channel.toUpperCase()}`
    case 'slice':
      return `${g.axis} · ${g.buckets}×${g.spanMs}ms`
    case 'manual':
      return `${g.entries.length} nodo(s)`
    case 'noise':
      return `seed ${g.seed} · ±${g.amountMs}ms`
  }
}

/** Nº de nodos targeteados (mask o entries manual). */
function targetCount(g: Gesture): number | null {
  if (g.kind === 'manual') return g.entries.length
  if (g.kind === 'base') return null // base cubre todo el rig
  return g.mask.nodeIds.length
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const GestureStackPanel: React.FC = () => {
  const stack = useAsteriaStore((s) => s.project.stack)
  const selectedGestureId = useAsteriaStore((s) => s.selectedGestureId)
  const setSelectedGesture = useAsteriaStore((s) => s.setSelectedGesture)
  const removeGesture = useAsteriaStore((s) => s.removeGesture)
  const resetProject = useAsteriaStore((s) => s.resetProject)
  const driftReadOnly = useAsteriaStore((s) => s.driftReadOnly)
  // 🜨 WAVE 8150-F3: affordance del historial local (Ctrl+Z es
  // invisible sin esto — los botones hacen el feature descubrible).
  const canUndo = useAsteriaStore((s) => s.past.length > 0)
  const canRedo = useAsteriaStore((s) => s.future.length > 0)
  const undo = useAsteriaStore((s) => s.undo)
  const redo = useAsteriaStore((s) => s.redo)

  return (
    <div className="asteria-rail__section asteria-stack">
      <div className="asteria-rail__title asteria-stack__header">
        <span>GESTURE STACK</span>
        <span className="asteria-stack__count">{stack.length}</span>
        <button
          type="button"
          className="asteria-stack__reset"
          title="Deshacer (Ctrl+Z)"
          disabled={!canUndo}
          onClick={undo}
        >
          ↶
        </button>
        <button
          type="button"
          className="asteria-stack__reset"
          title="Rehacer (Ctrl+Shift+Z / Ctrl+Y)"
          disabled={!canRedo}
          onClick={redo}
        >
          ↷
        </button>
        <button
          type="button"
          className="asteria-stack__reset"
          title="Reset pila — vuelve al gesto base identidad"
          disabled={driftReadOnly}
          onClick={resetProject}
        >
          ↺
        </button>
      </div>

      <div className="asteria-stack__list">
        {[...stack].reverse().map((g) => {
          const selected = g.id === selectedGestureId
          const targets = targetCount(g)
          return (
            <div
              key={g.id}
              role="button"
              tabIndex={0}
              className={`asteria-layer ${selected ? 'asteria-layer--selected' : ''}`}
              title={g.id}
              onClick={() => setSelectedGesture(selected ? null : g.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setSelectedGesture(selected ? null : g.id)
                }
              }}
            >
              <span className="asteria-layer__icon">{KIND_ICON[g.kind]}</span>
              <span className="asteria-layer__body">
                <span className="asteria-layer__kind">
                  {g.kind.toUpperCase()}
                  {targets !== null && (
                    <span className="asteria-layer__targets">
                      {' '}
                      {targets}n
                    </span>
                  )}
                </span>
                <span className="asteria-layer__desc">{describe(g)}</span>
              </span>
              <button
                type="button"
                className="asteria-layer__delete"
                title="Eliminar capa (no destructivo — la pila se recompila)"
                disabled={driftReadOnly}
                onClick={(e) => {
                  e.stopPropagation()
                  removeGesture(g.id)
                }}
              >
                ✕
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

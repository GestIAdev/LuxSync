/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔀 FORGE MODE SWITCHER — WAVE 4548.8c
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Toggle SIMPLE / ADVANCED para el editor de fixtures.
 *
 * SIMPLE MODE:
 *  - El Channel Rack muestra la vista pasiva channels[]
 *  - Solo disponible si el grafo contiene únicamente nodos input_dmx y output_dmx
 *
 * ADVANCED MODE:
 *  - El tab NODE GRAPH está activo y editable
 *  - Cualquier topología de grafo es válida
 *
 * isSimpleCompatible():
 *  Retorna false si el grafo contiene nodos de categoría 'process' o 'logic',
 *  o inputs que no sean input_dmx (audio_band, beat, bpm, energy, constant, time).
 *
 * @module components/views/ForgeView/canvas/ForgeModeSwitcher
 * @version WAVE 4548.8c
 */

import React, { useCallback } from 'react'
import type { IForgeNodeGraph } from '../../../../core/forge/types'
import './ForgeModeSwitcher.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type ForgeEditMode = 'simple' | 'advanced'

export type SimpleModeStatus = 'editable' | 'readonly'

// ═══════════════════════════════════════════════════════════════════════════
// isSimpleCompatible
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Determina si un grafo puede representarse en Simple Mode (solo pasthrough
 * input_dmx → output_dmx sin ninguna lógica/proceso intermedia).
 */
export function isSimpleCompatible(graph: IForgeNodeGraph | null): boolean {
  if (!graph || graph.nodes.length === 0) return true

  for (const node of graph.nodes) {
    // Si hay nodos de categoría process o logic → no compatible
    if (node.category === 'process' || node.category === 'logic') return false

    // Si hay nodos input que no sean input_dmx → no compatible
    if (node.category === 'input' && node.type !== 'input_dmx') return false

    // Si hay compound → no compatible
    if (node.category === 'compound') return false
  }
  return true
}

/**
 * Devuelve el estado de Simple Mode para un grafo dado.
 */
export function getSimpleModeStatus(graph: IForgeNodeGraph | null): SimpleModeStatus {
  if (!graph) return 'editable'
  if (graph.nodes.length === 0) return 'editable'
  return isSimpleCompatible(graph) ? 'editable' : 'readonly'
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface ForgeModeSwitcherProps {
  mode: ForgeEditMode
  graph: IForgeNodeGraph | null
  onModeChange: (mode: ForgeEditMode) => void
}

export const ForgeModeSwitcher: React.FC<ForgeModeSwitcherProps> = ({
  mode,
  graph,
  onModeChange,
}) => {
  const status = getSimpleModeStatus(graph)
  const simpleEnabled = status === 'editable'

  const handleToggle = useCallback(
    (target: ForgeEditMode) => {
      if (target === mode) return
      if (target === 'simple' && !simpleEnabled) return
      onModeChange(target)
    },
    [mode, simpleEnabled, onModeChange]
  )

  return (
    <div className={`fms-wrapper fms-wrapper--${mode}`} title={
      status !== 'editable'
        ? 'Simple Mode is read-only: this fixture uses advanced node logic'
        : undefined
    }>
      <button
        className={`fms-btn${mode === 'simple' ? ' fms-btn--active' : ''}`}
        onClick={() => handleToggle('simple')}
        disabled={!simpleEnabled}
      >
        SIMPLE
      </button>
      <button
        className={`fms-btn${mode === 'advanced' ? ' fms-btn--active' : ''}`}
        onClick={() => handleToggle('advanced')}
      >
        ADVANCED
      </button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SIMPLE MODE BANNER — Se muestra en Channel Rack cuando el grafo es complejo
// ═══════════════════════════════════════════════════════════════════════════

interface SimpleModeBannerProps {
  onJumpToCanvas: () => void
}

export const SimpleModeLockBanner: React.FC<SimpleModeBannerProps> = ({
  onJumpToCanvas,
}) => (
  <div className="fms-lock-banner">
    <span className="fms-lock-banner__icon">🔒</span>
    <p className="fms-lock-banner__text">
      Read-only: This fixture uses a complex node graph with process/logic nodes.
      Edit in Advanced Mode.
    </p>
    <button className="fms-lock-banner__btn" onClick={onJumpToCanvas}>
      → Switch to Advanced
    </button>
  </div>
)

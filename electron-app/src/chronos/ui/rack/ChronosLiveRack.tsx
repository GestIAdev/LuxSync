/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎛️ CHRONOS LIVE RACK — WAVE 2046.2: EL INJERTO
 * 
 * Contenedor adaptador que aloja TheProgrammerContent dentro de Chronos.
 * 
 * PROBLEMA: TheProgrammer vive en StageSidebar con dimensiones fijas
 * (min/max-width: 450px, height: 100%, border-left). Chronos tiene un
 * layout horizontal completamente diferente.
 * 
 * SOLUCIÓN: Este wrapper:
 * 1. Importa TheProgrammerContent (sin tabs — solo controles puros)
 * 2. Sobreescribe CSS conflictivo via .chronos-live-rack scope
 * 3. Añade header propio con título + botón collapse
 * 4. Se integra como panel lateral derecho en ChronosLayout
 * 
 * CUÁNDO SE MUESTRA:
 * - isRecording === true (grabación activa)
 * - showLiveControls === true (toggle manual del usuario)
 * 
 * @module chronos/ui/rack/ChronosLiveRack
 * @version WAVE 2046.2
 */

import React, { useState, useCallback, memo } from 'react'
import { TheProgrammerContent } from '../../../components/hyperion/controls/TheProgrammerContent'
import { useSelectedArray } from '../../../stores/selectionStore'
import './ChronosLiveRack.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ChronosLiveRackProps {
  /** External collapse control */
  collapsed?: boolean
  /** Callback when user toggles collapse */
  onCollapseToggle?: () => void
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const ChronosLiveRack: React.FC<ChronosLiveRackProps> = memo(({
  collapsed = false,
  onCollapseToggle,
}) => {
  // Selection count for badge
  const selectedIds = useSelectedArray()
  const selectionCount = selectedIds.length

  // Internal collapse if no external control
  const [internalCollapsed, setInternalCollapsed] = useState(false)
  const isCollapsed = onCollapseToggle ? collapsed : internalCollapsed

  const handleToggle = useCallback(() => {
    if (onCollapseToggle) {
      onCollapseToggle()
    } else {
      setInternalCollapsed(prev => !prev)
    }
  }, [onCollapseToggle])

  // ─── COLLAPSED STATE: Thin vertical strip ───
  if (isCollapsed) {
    return (
      <div className="chronos-live-rack chronos-live-rack--collapsed" onClick={handleToggle}>
        <div className="rack-collapsed-label">
          <span className="rack-collapsed-icon">🎛️</span>
          <span className="rack-collapsed-text">LIVE</span>
          {selectionCount > 0 && (
            <span className="rack-collapsed-badge">{selectionCount}</span>
          )}
        </div>
      </div>
    )
  }

  // ─── EXPANDED STATE: Full programmer content ───
  return (
    <div className="chronos-live-rack">
      {/* HEADER */}
      <div className="rack-header">
        <div className="rack-title-group">
          <span className="rack-icon">🎛️</span>
          <span className="rack-title">LIVE RACK</span>
          {selectionCount > 0 && (
            <span className="rack-badge">{selectionCount}</span>
          )}
        </div>
        <button
          className="rack-collapse-btn"
          onClick={handleToggle}
          title="Collapse panel"
        >
          ▶
        </button>
      </div>

      {/* PROGRAMMER CONTENT — scoped override via parent class */}
      <div className="rack-body">
        <TheProgrammerContent />
      </div>
    </div>
  )
})

ChronosLiveRack.displayName = 'ChronosLiveRack'

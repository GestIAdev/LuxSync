import React, { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useSelectionStore } from '../../../../stores/selectionStore'
import { useStageStore } from '../../../../stores/stageStore'

// ═══════════════════════════════════════════════════════════════════════════
// RadialMenu — Menú Contextual Rápido
// PROYECTO EREBUS FASE 8
//
// Anillo flotante renderizado vía React Portal sobre el DOM.
// Intercepta onContextMenu (click derecho) sobre cualquier entidad en 2D o 3D.
//
// 6 iconos de acción rápida:
//   1. Duplicar   2. Elevar   3. Orientación
//   4. Calibrar   5. Zona      6. Eliminar
//
// Se despliega en la posición del cursor y se cierra al click fuera o ESC.
// ═══════════════════════════════════════════════════════════════════════════

interface RadialMenuState {
  x: number
  y: number
  fixtureId: string
}

interface RadialMenuProps {
  /** Callback when an action is selected */
  onAction?: (action: string, fixtureId: string) => void
}

const ACTIONS = [
  { id: 'duplicate', label: 'Duplicate', icon: '⧉', angle: 0 },
  { id: 'elevate', label: 'Elevate', icon: '▲', angle: 60 },
  { id: 'orientation', label: 'Orientation', icon: '◐', angle: 120 },
  { id: 'calibrate', label: 'Calibrate', icon: '◎', angle: 180 },
  { id: 'zone', label: 'Zone', icon: '◇', angle: 240 },
  { id: 'delete', label: 'Delete', icon: '✕', angle: 300 },
]

const RADIUS = 56
const ICON_SIZE = 28

export const RadialMenu: React.FC<RadialMenuProps> = ({ onAction }) => {
  const [menuState, setMenuState] = useState<RadialMenuState | null>(null)
  const select = useSelectionStore(s => s.select)
  const removeFixture = useStageStore(s => s.removeFixture)

  // ── Listen for context menu events from DragDropControllers ───────────────
  useEffect(() => {
    const handleRadialMenu = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.clientX !== undefined && detail?.fixtureId) {
        setMenuState({
          x: detail.clientX,
          y: detail.clientY,
          fixtureId: detail.fixtureId,
        })
      }
    }

    window.addEventListener('erebus:radial-menu', handleRadialMenu)
    return () => window.removeEventListener('erebus:radial-menu', handleRadialMenu)
  }, [])

  // ── Close on ESC or click outside ──────────────────────────────────────────
  useEffect(() => {
    if (!menuState) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuState(null)
    }

    const handleClickOutside = (e: MouseEvent) => {
      // Close on any click outside the radial menu
      const target = e.target as HTMLElement
      if (!target.closest('.erebus-radial-menu')) {
        setMenuState(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('mousedown', handleClickOutside)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('mousedown', handleClickOutside)
    }
  }, [menuState])

  // ── Handle action selection ────────────────────────────────────────────────
  const handleAction = useCallback(
    (actionId: string) => {
      if (!menuState) return
      const { fixtureId } = menuState

      switch (actionId) {
        case 'duplicate':
          // Emit event for duplication logic
          window.dispatchEvent(new CustomEvent('erebus:action-duplicate', { detail: { fixtureId } }))
          break
        case 'elevate':
          // Emit event for elevation mode
          window.dispatchEvent(new CustomEvent('erebus:action-elevate', { detail: { fixtureId } }))
          break
        case 'orientation':
          window.dispatchEvent(new CustomEvent('erebus:action-orientation', { detail: { fixtureId } }))
          break
        case 'calibrate':
          window.dispatchEvent(new CustomEvent('erebus:action-calibrate', { detail: { fixtureId } }))
          break
        case 'zone':
          window.dispatchEvent(new CustomEvent('erebus:action-zone', { detail: { fixtureId } }))
          break
        case 'delete':
          removeFixture(fixtureId)
          break
      }

      onAction?.(actionId, fixtureId)
      setMenuState(null)
    },
    [menuState, removeFixture, onAction],
  )

  if (!menuState) return null

  // ── Render via Portal ──────────────────────────────────────────────────────
  return createPortal(
    <div
      className="erebus-radial-menu"
      style={{
        position: 'fixed',
        left: menuState.x,
        top: menuState.y,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {/* Center dot */}
      <div className="erebus-radial-center" />

      {/* Action buttons arranged in a circle */}
      {ACTIONS.map(action => {
        const rad = (action.angle * Math.PI) / 180
        const x = Math.cos(rad) * RADIUS
        const y = Math.sin(rad) * RADIUS
        const isDelete = action.id === 'delete'

        return (
          <button
            key={action.id}
            className={`erebus-radial-btn ${isDelete ? 'erebus-radial-btn--danger' : ''}`}
            style={{
              position: 'absolute',
              left: x - ICON_SIZE / 2,
              top: y - ICON_SIZE / 2,
              width: ICON_SIZE,
              height: ICON_SIZE,
              pointerEvents: 'auto',
            }}
            title={action.label}
            onClick={() => handleAction(action.id)}
          >
            <span className="erebus-radial-icon">{action.icon}</span>
            <span className="erebus-radial-label">{action.label}</span>
          </button>
        )
      })}
    </div>,
    document.body,
  )
}

export default RadialMenu

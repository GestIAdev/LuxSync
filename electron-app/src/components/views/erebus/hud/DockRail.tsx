import React, { useState, useCallback, useRef, useEffect } from 'react'
import { DockFlyout } from './DockFlyout'

// ═══════════════════════════════════════════════════════════════════════════
// DockRail — Satélite Izquierdo (La Librería que Respira)
// PROYECTO EREBUS FASE 1 + FASE 9
//
// Barra vertical pegada a la izquierda (48px), separada de los bordes.
// Al hacer hover sobre un icono de categoría, despliega el DockFlyout.
// Doble click en icono hace pin (ancla) del flyout.
// ═══════════════════════════════════════════════════════════════════════════

const CATEGORIES = [
  { id: 'moving', label: 'Moving Heads', icon: '◐' },
  { id: 'par', label: 'PAR / Wash', icon: '▭' },
  { id: 'strobe', label: 'Strobe / Blinder', icon: '◇' },
  { id: 'laser', label: 'Laser', icon: '✳' },
  { id: 'rigging', label: 'Rigging', icon: '─' },
  { id: 'ingenio', label: 'Ingenios', icon: '◈' },
]

export const DockRail: React.FC = () => {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null)
  const [pinnedCategory, setPinnedCategory] = useState<string | null>(null)
  const hoverTimerRef = useRef<number | null>(null)

  const activeCategory = pinnedCategory ?? hoveredCategory
  const isPinned = pinnedCategory !== null

  // ── Hover with 150ms delay to prevent flicker ─────────────────────────────
  const handleMouseEnter = useCallback((catId: string) => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    hoverTimerRef.current = window.setTimeout(() => setHoveredCategory(catId), 150)
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    setHoveredCategory(null)
  }, [])

  // ── Double click to pin/unpin ─────────────────────────────────────────────
  const handleDoubleClick = useCallback((catId: string) => {
    setPinnedCategory(prev => (prev === catId ? null : catId))
  }, [])

  // ── Restore flyout after drag ends ────────────────────────────────────────
  useEffect(() => {
    const handleRestore = () => {
      // Flyout restore is handled by DockFlyout itself via event
    }
    window.addEventListener('erebus:dock-flyout-restore', handleRestore)
    return () => window.removeEventListener('erebus:dock-flyout-restore', handleRestore)
  }, [])

  return (
    <>
      <div className="erebus-dock-rail">
        {CATEGORIES.map((cat, i) => (
          <React.Fragment key={cat.id}>
            <button
              className={`erebus-rail-btn ${
                activeCategory === cat.id ? 'erebus-rail-btn--active' : ''
              }`}
              title={cat.label}
              onMouseEnter={() => handleMouseEnter(cat.id)}
              onMouseLeave={handleMouseLeave}
              onDoubleClick={() => handleDoubleClick(cat.id)}
            >
              <span style={{ fontSize: 16 }}>{cat.icon}</span>
            </button>
            {i === 3 && <div className="erebus-rail-divider" />}
          </React.Fragment>
        ))}
      </div>

      {/* DockFlyout — shown when hovering or pinned */}
      {activeCategory && (
        <DockFlyout
          categoryId={activeCategory}
          pinned={isPinned}
          visible={hoveredCategory !== null}
        />
      )}
    </>
  )
}

export default DockRail

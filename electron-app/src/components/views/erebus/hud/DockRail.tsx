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
  const closeTimerRef = useRef<number | null>(null)

  const activeCategory = pinnedCategory ?? hoveredCategory
  const isPinned = pinnedCategory !== null

  // ── Hover with 150ms open delay ────────────────────────────────────────────
  const handleMouseEnter = useCallback((catId: string) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    hoverTimerRef.current = window.setTimeout(() => setHoveredCategory(catId), 100)
  }, [])

  // ── Delayed close (300ms) so user can move from rail to flyout ─────────────
  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    closeTimerRef.current = window.setTimeout(() => setHoveredCategory(null), 300)
  }, [])

  // ── Cancel close when entering the flyout area ─────────────────────────────
  const handleFlyoutEnter = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  // ── Double click to pin/unpin ─────────────────────────────────────────────
  const handleDoubleClick = useCallback((catId: string) => {
    setPinnedCategory(prev => (prev === catId ? null : catId))
  }, [])

  // ── Cleanup timers on unmount ──────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
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
        <div
          onMouseEnter={handleFlyoutEnter}
          onMouseLeave={handleMouseLeave}
          style={{
            position: 'absolute',
            top: 64,
            left: 60,
            width: 280,
            height: 'calc(100% - 100px)',
            zIndex: 99,
          }}
        >
          <DockFlyout
            categoryId={activeCategory}
            pinned={isPinned}
            visible={hoveredCategory !== null || isPinned}
          />
        </div>
      )}
    </>
  )
}

export default DockRail

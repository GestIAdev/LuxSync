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
  // 🩸 WAVE 7604: forceOpen — set by onClick or restore-after-drag to keep
  // the flyout visible even when the mouse is no longer over the rail.
  const [forceOpen, setForceOpen] = useState<string | null>(null)
  const hoverTimerRef = useRef<number | null>(null)
  const closeTimerRef = useRef<number | null>(null)

  const activeCategory = pinnedCategory ?? hoveredCategory ?? forceOpen
  const isPinned = pinnedCategory !== null

  // ── Hover with 100ms open delay ────────────────────────────────────────────
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

  // ── 🩸 WAVE 7604: Delayed close (400ms, was 300ms) for better transit tolerance
  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    closeTimerRef.current = window.setTimeout(() => {
      setHoveredCategory(null)
      // 🩸 WAVE 7604: Don't clear forceOpen on mouse leave — it's only cleared
      // by explicit user action (clicking another category, or closing).
    }, 400)
  }, [])

  // ── Cancel close when entering the flyout area ─────────────────────────────
  const handleFlyoutEnter = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  // ── 🩸 WAVE 7604: Single click opens flyout immediately (bypasses 100ms timer)
  // This gives click-preferring users instant access without waiting for hover.
  const handleClick = useCallback((catId: string) => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    setHoveredCategory(catId)
    setForceOpen(catId)
  }, [])

  // ── Double click to pin/unpin ─────────────────────────────────────────────
  const handleDoubleClick = useCallback((catId: string) => {
    setPinnedCategory(prev => (prev === catId ? null : catId))
  }, [])

  // ── 🩸 WAVE 7604: Restore flyout after drag-and-drop ──────────────────────
  // The FixtureCard dispatches 'erebus:dock-flyout-restore' on dragEnd. We
  // re-show the flyout by setting forceOpen to the last active category,
  // even if the mouse is no longer over the rail. A close timer will hide
  // it after 400ms if the user doesn't move the mouse back to the rail/flyout.
  useEffect(() => {
    const handleRestore = () => {
      if (pinnedCategory) {
        // Pinned flyout is always visible — nothing to do
        return
      }
      const cat = hoveredCategory ?? forceOpen
      if (cat) {
        setForceOpen(cat)
        // Auto-clear forceOpen after 600ms if user doesn't re-enter rail/flyout
        closeTimerRef.current = window.setTimeout(() => {
          setForceOpen(null)
        }, 600)
      }
    }
    window.addEventListener('erebus:dock-flyout-restore', handleRestore)
    return () => window.removeEventListener('erebus:dock-flyout-restore', handleRestore)
  }, [pinnedCategory, hoveredCategory, forceOpen])

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
              onClick={() => handleClick(cat.id)}
              onDoubleClick={() => handleDoubleClick(cat.id)}
            >
              <span style={{ fontSize: 16 }}>{cat.icon}</span>
            </button>
            {i === 3 && <div className="erebus-rail-divider" />}
          </React.Fragment>
        ))}
      </div>

      {/* DockFlyout — shown when hovering, pinned, or force-opened.
          🩸 WAVE 7604: left: 48px (was 60px) — eliminates the 12px dead-zone
          gap between the rail and the flyout that caused mouseleave to fire. */}
      {activeCategory && (
        <div
          onMouseEnter={handleFlyoutEnter}
          onMouseLeave={handleMouseLeave}
          style={{
            position: 'absolute',
            top: 64,
            left: 48,
            width: 280,
            height: 'calc(100% - 100px)',
            zIndex: 99,
          }}
        >
          <DockFlyout
            categoryId={activeCategory}
            pinned={isPinned}
            visible={hoveredCategory !== null || isPinned || forceOpen !== null}
          />
        </div>
      )}
    </>
  )
}

export default DockRail

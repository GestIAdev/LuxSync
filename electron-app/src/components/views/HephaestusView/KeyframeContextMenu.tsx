/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ KEYFRAME CONTEXT MENU - WAVE 2030.14
 * Right-click context menu for keyframe operations
 * 
 * Features:
 * - Delete keyframe
 * - Change interpolation (Hold/Linear/Bezier)
 * - Bind audio source (Energy/Bass/Mids/Highs)
 * 
 * @module views/HephaestusView/KeyframeContextMenu
 * @version WAVE 2030.14
 */

import React, { useEffect, useRef } from 'react'
import type { HephInterpolation, HephAudioBinding } from '../../../core/hephaestus/types'

// ═══════════════════════════════════════════════════════════════════════════
// AUDIO SOURCE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export type AudioSource = HephAudioBinding['source']

export const AUDIO_SOURCES: { id: AudioSource; label: string; icon: string }[] = [
  { id: 'none',   label: 'None (Disconnect)', icon: '🚫' },
  { id: 'energy', label: 'Energy (Volume)',   icon: '⚡' },
  { id: 'bass',   label: 'Bass (Kicks)',      icon: '🥁' },
  { id: 'mids',   label: 'Mids (Synths)',     icon: '🎹' },
  { id: 'highs',  label: 'Highs (Cymbals)',   icon: '🔔' },
]

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface KeyframeContextMenuProps {
  /** Screen position X */
  x: number
  /** Screen position Y */
  y: number
  /** Current interpolation type */
  currentInterpolation: HephInterpolation
  /** Current audio binding (if any) */
  currentAudioBinding?: HephAudioBinding
  /** Callback: Delete keyframe */
  onDelete: () => void
  /** Callback: Change interpolation */
  onInterpolationChange: (interp: HephInterpolation) => void
  /** Callback: Bind audio source */
  onAudioBind: (source: AudioSource) => void
  /** Callback: Close menu */
  onClose: () => void
  /** ⚒️ WAVE 2043.5: Callback: Copy selected keyframes */
  onCopy?: () => void
}

export const KeyframeContextMenu: React.FC<KeyframeContextMenuProps> = ({
  x,
  y,
  currentInterpolation,
  currentAudioBinding,
  onDelete,
  onInterpolationChange,
  onAudioBind,
  onClose,
  onCopy,
}) => {
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  // ⚒️ WAVE 2043.12: Smart menu positioning — prevent cut-off at screen edges
  const menuWidth = 200
  const menuHeight = 280
  const subMenuWidth = 180

  // If menu would extend beyond right edge, AND there's not enough room for submenu either,
  // position the menu to open leftward from cursor
  const wouldOverflowRight = x + menuWidth + subMenuWidth > window.innerWidth
  const adjustedX = wouldOverflowRight 
    ? Math.max(0, x - menuWidth)  // Open to the left of cursor
    : Math.min(x, window.innerWidth - menuWidth - subMenuWidth)
  
  const adjustedY = Math.min(y, window.innerHeight - menuHeight)

  // Submenu direction: if we're positioned on the right side, submenus go left
  const subMenuGoesLeft = adjustedX + menuWidth + subMenuWidth > window.innerWidth

  const currentSource = currentAudioBinding?.source ?? 'none'

  return (
    <div
      ref={menuRef}
      className="heph-menu-dropdown"
      style={{
        position: 'fixed',
        left: adjustedX,
        top: adjustedY,
      }}
    >
      {/* Delete */}
      <button
        className="heph-menu-dropdown__item heph-menu-dropdown__item--danger"
        onClick={() => { onDelete(); onClose() }}
      >
        <span className="heph-menu-dropdown__item-icon">❌</span>
        <span className="heph-menu-dropdown__item-label">Delete Keyframe</span>
      </button>

      {/* ⚒️ WAVE 2043.5: Copy */}
      {onCopy && (
        <button
          className="heph-menu-dropdown__item"
          onClick={() => { onCopy(); onClose() }}
        >
          <span className="heph-menu-dropdown__item-icon">📋</span>
          <span className="heph-menu-dropdown__item-label">Copy Selection</span>
        </button>
      )}

      <div className="heph-menu-dropdown__divider" />

      {/* Interpolation submenu - WAVE 2030.15: Pure CSS hover */}
      <div className="heph-menu-dropdown__item heph-menu-dropdown__item--submenu">
        <span className="heph-menu-dropdown__item-icon">📈</span>
        <span className="heph-menu-dropdown__item-label">Interpolation</span>
        <span className="heph-menu-dropdown__item-arrow">{subMenuGoesLeft ? '◀' : '▶'}</span>
        
        <div 
          className="heph-menu-dropdown heph-menu-dropdown__submenu"
          style={subMenuGoesLeft ? { left: 'auto', right: '100%' } : undefined}
        >
          {(['hold', 'linear', 'bezier'] as HephInterpolation[]).map(interp => (
            <button
              key={interp}
              className={`heph-menu-dropdown__item ${currentInterpolation === interp ? 'heph-menu-dropdown__item--active' : ''}`}
              onClick={() => { onInterpolationChange(interp); onClose() }}
            >
              <span className="heph-menu-dropdown__item-icon">
                {interp === 'hold' ? '⏹️' : interp === 'linear' ? '📐' : '〰️'}
              </span>
              <span className="heph-menu-dropdown__item-label">
                {interp.charAt(0).toUpperCase() + interp.slice(1)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="heph-menu-dropdown__divider" />

      {/* Audio Binding submenu - WAVE 2030.15: Pure CSS hover */}
      <div className="heph-menu-dropdown__item heph-menu-dropdown__item--submenu">
        <span className="heph-menu-dropdown__item-icon">🔊</span>
        <span className="heph-menu-dropdown__item-label">
          Bind Audio
          {currentSource !== 'none' && <span style={{ marginLeft: 4, color: '#00f0ff', fontSize: 10 }}>● {currentSource.toUpperCase()}</span>}
        </span>
        <span className="heph-menu-dropdown__item-arrow">{subMenuGoesLeft ? '◀' : '▶'}</span>
        
        <div 
          className="heph-menu-dropdown heph-menu-dropdown__submenu"
          style={subMenuGoesLeft ? { left: 'auto', right: '100%' } : undefined}
        >
          {AUDIO_SOURCES.map(source => (
            <button
              key={source.id}
              className={`heph-menu-dropdown__item ${currentSource === source.id ? 'heph-menu-dropdown__item--active' : ''}`}
              onClick={() => { onAudioBind(source.id); onClose() }}
            >
              <span className="heph-menu-dropdown__item-icon">{source.icon}</span>
              <span className="heph-menu-dropdown__item-label">{source.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default KeyframeContextMenu

// ═══════════════════════════════════════════════════════════════════════════
// ⚒️ BACKGROUND CONTEXT MENU - WAVE 2043.5
// Right-click on empty space: "Paste Here" at click position
// ═══════════════════════════════════════════════════════════════════════════

interface BackgroundContextMenuProps {
  x: number
  y: number
  clickTimeMs: number
  hasClipboard: boolean
  onPasteHere: (timeMs: number) => void
  onClose: () => void
}

export const BackgroundContextMenu: React.FC<BackgroundContextMenuProps> = ({
  x,
  y,
  clickTimeMs,
  hasClipboard,
  onPasteHere,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  const adjustedX = Math.min(x, window.innerWidth - 200)
  const adjustedY = Math.min(y, window.innerHeight - 100)

  return (
    <div
      ref={menuRef}
      className="heph-menu-dropdown"
      style={{
        position: 'fixed',
        left: adjustedX,
        top: adjustedY,
      }}
    >
      <button
        className={`heph-menu-dropdown__item${!hasClipboard ? ' heph-menu-dropdown__item--disabled' : ''}`}
        onClick={() => {
          if (hasClipboard) {
            onPasteHere(clickTimeMs)
          }
        }}
        disabled={!hasClipboard}
      >
        <span className="heph-menu-dropdown__item-icon">📋</span>
        <span className="heph-menu-dropdown__item-label">
          Paste Here{hasClipboard ? ` (${clickTimeMs}ms)` : ' (empty clipboard)'}
        </span>
      </button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ⚒️ MULTI-SELECTION CONTEXT MENU - WAVE 2043.11
// Right-click on a keyframe that's part of a multi-selection:
// "Apply Shape" submenu with mathematical oscillators
// ═══════════════════════════════════════════════════════════════════════════

/** Shape definitions for contextual shapes */
const CONTEXTUAL_SHAPES: { id: string; label: string; icon: string }[] = [
  { id: 'sine',     label: 'Sine Wave ∿',    icon: '∿' },
  { id: 'triangle', label: 'Triangle △',      icon: '△' },
  { id: 'sawtooth', label: 'Sawtooth ⩘',     icon: '⩘' },
  { id: 'square',   label: 'Square ⊓',       icon: '⊓' },
  { id: 'pulse',    label: 'Pulse ♥',        icon: '♥' },
  { id: 'bounce',   label: 'Bounce ⚽',       icon: '⚽' },
]

interface MultiSelectionContextMenuProps {
  x: number
  y: number
  selectionCount: number
  onApplyShape: (shapeId: string) => void
  onDelete: () => void
  onCopy?: () => void
  /** ⚒️ WAVE 2043.12: Batch audio bind for all selected keyframes */
  onBatchAudioBind?: (source: AudioSource) => void
  onClose: () => void
}

export const MultiSelectionContextMenu: React.FC<MultiSelectionContextMenuProps> = ({
  x,
  y,
  selectionCount,
  onApplyShape,
  onDelete,
  onCopy,
  onBatchAudioBind,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  // ⚒️ WAVE 2043.12: Smart menu positioning — prevent cut-off at screen edges
  const menuWidth = 220
  const menuHeight = 380  // Increased to account for audio bind submenu
  const subMenuWidth = 180

  const wouldOverflowRight = x + menuWidth + subMenuWidth > window.innerWidth
  const adjustedX = wouldOverflowRight 
    ? Math.max(0, x - menuWidth)
    : Math.min(x, window.innerWidth - menuWidth - subMenuWidth)
  
  const adjustedY = Math.min(y, window.innerHeight - menuHeight)

  const subMenuGoesLeft = adjustedX + menuWidth + subMenuWidth > window.innerWidth

  return (
    <div
      ref={menuRef}
      className="heph-menu-dropdown"
      style={{
        position: 'fixed',
        left: adjustedX,
        top: adjustedY,
      }}
    >
      {/* Header — selection count */}
      <div className="heph-menu-dropdown__header" style={{
        padding: '6px 12px',
        color: 'var(--accent-primary, #ff6b2b)',
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        pointerEvents: 'none',
      }}>
        ⚒ {selectionCount} Keyframes Selected
      </div>

      {/* Copy */}
      {onCopy && (
        <button
          className="heph-menu-dropdown__item"
          onClick={() => { onCopy(); onClose() }}
        >
          <span className="heph-menu-dropdown__item-icon">📋</span>
          <span className="heph-menu-dropdown__item-label">Copy Selection</span>
        </button>
      )}

      {/* Delete All Selected */}
      <button
        className="heph-menu-dropdown__item heph-menu-dropdown__item--danger"
        onClick={() => { onDelete(); onClose() }}
      >
        <span className="heph-menu-dropdown__item-icon">❌</span>
        <span className="heph-menu-dropdown__item-label">Delete Selected</span>
      </button>

      <div className="heph-menu-dropdown__divider" />

      {/* ⚒️ Apply Shape submenu — mathematical oscillators */}
      <div className="heph-menu-dropdown__item heph-menu-dropdown__item--submenu">
        <span className="heph-menu-dropdown__item-icon">🔬</span>
        <span className="heph-menu-dropdown__item-label">Apply Shape</span>
        <span className="heph-menu-dropdown__item-arrow">{subMenuGoesLeft ? '◀' : '▶'}</span>

        <div 
          className="heph-menu-dropdown heph-menu-dropdown__submenu"
          style={subMenuGoesLeft ? { left: 'auto', right: '100%' } : undefined}
        >
          {CONTEXTUAL_SHAPES.map(shape => (
            <button
              key={shape.id}
              className="heph-menu-dropdown__item"
              onClick={() => { onApplyShape(shape.id); onClose() }}
            >
              <span className="heph-menu-dropdown__item-icon">{shape.icon}</span>
              <span className="heph-menu-dropdown__item-label">{shape.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ⚒️ WAVE 2043.12: Batch Audio Bind submenu */}
      {onBatchAudioBind && (
        <div className="heph-menu-dropdown__item heph-menu-dropdown__item--submenu">
          <span className="heph-menu-dropdown__item-icon">🔊</span>
          <span className="heph-menu-dropdown__item-label">Bind Audio (All)</span>
          <span className="heph-menu-dropdown__item-arrow">{subMenuGoesLeft ? '◀' : '▶'}</span>

          <div 
            className="heph-menu-dropdown heph-menu-dropdown__submenu"
            style={subMenuGoesLeft ? { left: 'auto', right: '100%' } : undefined}
          >
            {AUDIO_SOURCES.map(source => (
              <button
                key={source.id}
                className="heph-menu-dropdown__item"
                onClick={() => { onBatchAudioBind(source.id); onClose() }}
              >
                <span className="heph-menu-dropdown__item-icon">{source.icon}</span>
                <span className="heph-menu-dropdown__item-label">{source.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

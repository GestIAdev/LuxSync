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

  // Adjust position to stay within viewport
  const adjustedX = Math.min(x, window.innerWidth - 200)
  const adjustedY = Math.min(y, window.innerHeight - 280)

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

      <div className="heph-menu-dropdown__divider" />

      {/* Interpolation submenu - WAVE 2030.15: Pure CSS hover */}
      <div className="heph-menu-dropdown__item heph-menu-dropdown__item--submenu">
        <span className="heph-menu-dropdown__item-icon">📈</span>
        <span className="heph-menu-dropdown__item-label">Interpolation</span>
        <span className="heph-menu-dropdown__item-arrow">▶</span>
        
        <div className="heph-menu-dropdown heph-menu-dropdown__submenu">
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
        <span className="heph-menu-dropdown__item-arrow">▶</span>
        
        <div className="heph-menu-dropdown heph-menu-dropdown__submenu">
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

/**
 * 🪟 TITLE BAR - WAVE 35.3: Global Window Controls & Drag Region
 * WAVE 375: Zen Mode Toggle Button
 * WAVE 2049: NetIndicator + MidiLearn Badge Integration
 * WAVE UX-1: THE TACTICAL HUB & HEADER CLEANUP
 * WAVE 2049.2: Custom frameless window controls (minimize/maximize/close)
 *
 * Layout: [ZEN] [MIDI] [HUB] ——— LUXSYNC ——— [─][□][✕]
 */

import React, { useState, useEffect, useCallback } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import MidiLearnOverlay from '../MidiLearnOverlay'
import TacticalHub from './TacticalHub'
import './TitleBar.css'

interface TitleBarProps {
  title?: string
  isZenMode?: boolean
  onToggleZenMode?: () => void
}

const lux = (window as any).luxsync as {
  window?: {
    minimize: () => Promise<void>
    maximize: () => Promise<void>
    close: () => Promise<void>
    isMaximized: () => Promise<boolean>
    onMaximizeChange: (cb: (isMax: boolean) => void) => () => void
  }
} | undefined

const TitleBar: React.FC<TitleBarProps> = ({ 
  title = 'LUXSYNC',
  isZenMode = false,
  onToggleZenMode
}) => {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    if (!lux?.window) return
    lux.window.isMaximized().then(setIsMaximized)
    const unsubscribe = lux.window.onMaximizeChange(setIsMaximized)
    return unsubscribe
  }, [])

  const handleMinimize = useCallback(() => lux?.window?.minimize(), [])
  const handleMaximize = useCallback(() => lux?.window?.maximize(), [])
  const handleClose    = useCallback(() => lux?.window?.close(),    [])

  return (
    <div className="global-title-bar">
      {/* 🔧 WAVE UX-1: Left pill cluster — ZEN → MIDI → HUB */}
      <div className="title-bar-pills">
        {/* 🧘 ZEN pill */}
        <button 
          className={`tb-pill tb-pill--zen ${isZenMode ? 'active' : ''}`}
          onClick={onToggleZenMode}
          title={isZenMode ? 'Exit Zen Mode [Z]' : 'Enter Zen Mode [Z]'}
        >
          {isZenMode ? (
            <Minimize2 size={12} className="tb-pill-icon" />
          ) : (
            <Maximize2 size={12} className="tb-pill-icon" />
          )}
          <span className="tb-pill-label">ZEN</span>
        </button>

        {/* 🎹 MIDI pill */}
        <MidiLearnOverlay />

        {/* ⚙️ HUB pill (Art-Net + future tools) */}
        <TacticalHub />
      </div>

      {/* Drag Region */}
      <div className="title-bar-drag">
        <span className="title-bar-text">{title}</span>
      </div>

      {/* 🪟 WAVE 2049.2: Custom window controls */}
      <div className="title-bar-wc">
        <button
          className="tb-wc-btn tb-wc-minimize"
          onClick={handleMinimize}
          title="Minimize"
          aria-label="Minimize window"
        >
          <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
            <rect width="10" height="1" />
          </svg>
        </button>

        <button
          className="tb-wc-btn tb-wc-maximize"
          onClick={handleMaximize}
          title={isMaximized ? 'Restore' : 'Maximize'}
          aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
        >
          {isMaximized ? (
            /* Restore icon: two overlapping squares */
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="2" y="0" width="8" height="8" />
              <polyline points="0,2 0,10 8,10" />
            </svg>
          ) : (
            /* Maximize icon: single square */
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="0" y="0" width="10" height="10" />
            </svg>
          )}
        </button>

        <button
          className="tb-wc-btn tb-wc-close"
          onClick={handleClose}
          title="Close"
          aria-label="Close window"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
            <line x1="0" y1="0" x2="10" y2="10" />
            <line x1="10" y1="0" x2="0" y2="10" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default TitleBar

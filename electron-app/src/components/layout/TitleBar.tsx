/**
 * 🪟 TITLE BAR - WAVE 35.3: Global Window Controls & Drag Region
 * WAVE 375: Zen Mode Toggle Button
 * WAVE 2049: NetIndicator + MidiLearn Badge Integration
 * WAVE UX-1: THE TACTICAL HUB & HEADER CLEANUP
 * WAVE 2049.2: Custom frameless window controls (minimize/maximize/close)
 *
 * Layout: [ZEN] [MIDI] [HUB] ——— LUXSYNC ——— [─][□][✕]
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import MidiLearnOverlay from '../MidiLearnOverlay'
import TacticalHub from './TacticalHub'
import { useNavigationStore, selectActiveTab } from '../../stores/navigationStore'
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
    // WAVE 7568: Manual drag IPC
    dragStart: (cursorPos: { x: number; y: number }) => void
    dragMove: (cursorPos: { x: number; y: number }) => void
    dragEnd: () => void
    dragDoubleClick: () => Promise<void>
  }
} | undefined

const TitleBar: React.FC<TitleBarProps> = ({ 
  title = 'LUXSYNC',
  isZenMode = false,
  onToggleZenMode
}) => {
  const [isMaximized, setIsMaximized]       = useState(false)
  const activeTab = useNavigationStore(selectActiveTab)
  const setActiveTab = useNavigationStore(s => s.setActiveTab)

  useEffect(() => {
    if (!lux?.window) return
    lux.window.isMaximized().then(setIsMaximized)
    const unsubscribe = lux.window.onMaximizeChange(setIsMaximized)
    return unsubscribe
  }, [])

  const handleMinimize = useCallback(() => lux?.window?.minimize(), [])
  const handleMaximize = useCallback(() => lux?.window?.maximize(), [])
  const handleClose    = useCallback(() => lux?.window?.close(),    [])

  // ═══════════════════════════════════════════════════════════════════════
  // 🪟 WAVE 7568: MANUAL DRAG — Workaround for Electron 31/32 Windows bug
  // -webkit-app-region: drag is broken on Electron 31+ on Windows (issue #43371).
  // This uses Pointer Events + setPointerCapture to drag the window via IPC,
  // bypassing the broken CSS region entirely.
  // ═══════════════════════════════════════════════════════════════════════
  const dragRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = dragRef.current
    if (!el || !lux?.window) return

    let dragging = false
    let pointerId = 0

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return // left button only
      // Don't start drag if clicking on interactive elements (buttons, pills)
      const target = e.target as HTMLElement
      if (target.closest('button') || target.closest('.title-bar-pills') || target.closest('.title-bar-wc')) {
        return
      }
      dragging = true
      pointerId = e.pointerId
      el.setPointerCapture(pointerId)
      const cursor = { x: e.screenX, y: e.screenY }
      lux!.window!.dragStart(cursor)
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return
      const cursor = { x: e.screenX, y: e.screenY }
      lux!.window!.dragMove(cursor)
    }

    const onPointerUp = (e: PointerEvent) => {
      if (!dragging) return
      dragging = false
      try { el.releasePointerCapture(pointerId) } catch { /* already released */ }
      lux!.window!.dragEnd()
    }

    const onDoubleClick = () => {
      lux!.window!.dragDoubleClick()
    }

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerUp)
    el.addEventListener('dblclick', onDoubleClick)

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
      el.removeEventListener('dblclick', onDoubleClick)
    }
  }, [])

  return (
    <>
      {/* WAVE 7568: ref for manual drag — -webkit-app-region is broken in Electron 31+ */}
      <div className="global-title-bar" ref={dragRef}>
        {/* 🔧 WAVE UX-1: Left pill cluster — ZEN → MIDI → KF → HUB */}
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

          {/* ⌨ KEYFORGE pill */}
          <button
            className={`tb-pill tb-pill--keyforge ${activeTab === 'keyforge' ? 'active' : ''}`}
            onClick={() => setActiveTab('keyforge')}
            title="KeyForge — Dedicated View"
          >
            <span style={{ fontSize: '11px', lineHeight: 1 }}>⌨</span>
            <span className="tb-pill-label">KF</span>
          </button>

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
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
                <rect x="2" y="0" width="8" height="8" />
                <polyline points="0,2 0,10 8,10" />
              </svg>
            ) : (
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

    </>
  )
}

export default TitleBar

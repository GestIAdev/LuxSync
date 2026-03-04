/**
 * 🪟 TITLE BAR - Custom frameless window controls
 *
 * - Drag region to move window
 * - Minimize / Maximize(restore) / Close buttons
 * - Reacts to window maximize state changes from main process
 */

import React, { useEffect, useState } from 'react'
import './TitleBar.css'

interface TitleBarProps {
  title?: string
}

const TitleBar: React.FC<TitleBarProps> = ({ title = 'LUXSYNC' }) => {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    // Sync initial state
    const win = (window as any).lux?.window
    if (!win) return

    win.isMaximized().then(setIsMaximized).catch(() => {})

    // Subscribe to maximize/unmaximize events from main
    const unsub = win.onMaximizeChange?.((val: boolean) => setIsMaximized(val))
    return () => unsub?.()
  }, [])

  const handleMinimize = () => (window as any).lux?.window?.minimize()
  const handleMaximize = () => (window as any).lux?.window?.maximize()
  const handleClose = () => (window as any).lux?.window?.close()

  return (
    <div className="title-bar">
      {/* Drag region */}
      <div className="title-bar-drag">
        <span className="title-bar-text">{title}</span>
      </div>

      {/* Window control buttons */}
      <div className="title-bar-controls">
        <button
          className="tb-btn tb-minimize"
          onClick={handleMinimize}
          title="Minimize"
          aria-label="Minimize"
        >
          <svg width="10" height="1" viewBox="0 0 10 1">
            <line x1="0" y1="0.5" x2="10" y2="0.5" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        </button>

        <button
          className="tb-btn tb-maximize"
          onClick={handleMaximize}
          title={isMaximized ? 'Restore' : 'Maximize'}
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? (
            /* Restore icon: two overlapping squares */
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect x="2" y="0" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="0" y="2" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          ) : (
            /* Maximize icon: single square */
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect x="0.75" y="0.75" width="8.5" height="8.5" fill="none" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          )}
        </button>

        <button
          className="tb-btn tb-close"
          onClick={handleClose}
          title="Close"
          aria-label="Close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

export default TitleBar

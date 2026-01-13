/**
 * 🪟 TITLE BAR - WAVE 35.3: Global Window Controls & Drag Region
 * WAVE 375: Zen Mode Toggle Button
 * 
 * Sistema de controles de ventana para Electron
 * - Drag region para mover la ventana
 * - Safe zone para evitar overlapping con controles nativos
 * - GLOBAL: Siempre visible en todas las vistas
 * - ZEN MODE: Toggle button para colapsar sidebar
 */

import React from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import './TitleBar.css'

interface TitleBarProps {
  title?: string
  isZenMode?: boolean
  onToggleZenMode?: () => void
}

const TitleBar: React.FC<TitleBarProps> = ({ 
  title = 'LUXSYNC',
  isZenMode = false,
  onToggleZenMode
}) => {
  return (
    <div className="global-title-bar">
      {/* 🧘 WAVE 375: Zen Mode Toggle Button */}
      <button 
        className={`zen-mode-toggle ${isZenMode ? 'active' : ''}`}
        onClick={onToggleZenMode}
        title={isZenMode ? 'Exit Zen Mode [Z]' : 'Enter Zen Mode [Z]'}
      >
        {isZenMode ? (
          <Minimize2 size={14} className="zen-icon" />
        ) : (
          <Maximize2 size={14} className="zen-icon" />
        )}
      </button>
      
      {/* Drag Region - spans full width, native controls overlay on right */}
      <div className="title-bar-drag">
        <span className="title-bar-text">{title}</span>
        {isZenMode && <span className="zen-mode-indicator">ZEN</span>}
      </div>
      
      {/* Safe zone spacer for native window controls (Win/Mac) */}
      <div className="title-bar-safe-zone" />
    </div>
  )
}

export default TitleBar

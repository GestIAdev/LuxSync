/**
 * 🪟 TITLE BAR - WAVE 35.2: Window Controls & Drag Region
 * 
 * Sistema de controles de ventana para Electron
 * - Drag region para mover la ventana
 * - Safe zone para evitar overlapping con controles nativos
 */

import React from 'react'
import './TitleBar.css'

interface TitleBarProps {
  title?: string
}

const TitleBar: React.FC<TitleBarProps> = ({ title = 'LUXSYNC' }) => {
  return (
    <div className="title-bar">
      {/* Drag Region - spans full width, native controls overlay on right */}
      <div className="title-bar-drag">
        <span className="title-bar-text">{title}</span>
      </div>
      
      {/* Safe zone spacer for native window controls (Win/Mac) */}
      <div className="title-bar-safe-zone" />
    </div>
  )
}

export default TitleBar

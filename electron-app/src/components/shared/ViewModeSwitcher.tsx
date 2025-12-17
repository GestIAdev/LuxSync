/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔄 VIEW MODE SWITCHER - WAVE 30: Stage Command & Dashboard
 * Botón elegante para alternar entre vista 2D (Tactical) y 3D (Visualizer)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React from 'react'
import { useControlStore, selectViewMode } from '../../stores/controlStore'
import './ViewModeSwitcher.css'

export interface ViewModeSwitcherProps {
  className?: string
  compact?: boolean
}

export const ViewModeSwitcher: React.FC<ViewModeSwitcherProps> = ({
  className = '',
  compact = false,
}) => {
  const viewMode = useControlStore(selectViewMode)
  const toggleViewMode = useControlStore(state => state.toggleViewMode)
  const setViewMode = useControlStore(state => state.setViewMode)
  
  const is3D = viewMode === '3D'
  
  if (compact) {
    // Versión compacta: solo un botón toggle
    return (
      <button
        className={`view-mode-toggle ${className} ${is3D ? 'mode-3d' : 'mode-2d'}`}
        onClick={toggleViewMode}
        title={is3D ? 'Cambiar a Vista Táctica 2D' : 'Cambiar a Visualizer 3D'}
      >
        {is3D ? '🎬 3D' : '📐 2D'}
      </button>
    )
  }
  
  // Versión completa: switch con labels
  return (
    <div className={`view-mode-switcher ${className}`}>
      <button
        className={`view-mode-btn ${!is3D ? 'active' : ''}`}
        onClick={() => setViewMode('2D')}
        title="Vista Táctica 2D - Canvas optimizado"
      >
        <span className="view-mode-icon">📐</span>
        <span className="view-mode-label">Tactical</span>
      </button>
      
      <div className="view-mode-divider" />
      
      <button
        className={`view-mode-btn ${is3D ? 'active' : ''}`}
        onClick={() => setViewMode('3D')}
        title="Visualizer 3D - React Three Fiber"
      >
        <span className="view-mode-icon">🎬</span>
        <span className="view-mode-label">Visualizer</span>
      </button>
    </div>
  )
}

export default ViewModeSwitcher

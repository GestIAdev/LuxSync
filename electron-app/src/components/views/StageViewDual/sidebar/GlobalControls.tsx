/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌍 GLOBAL CONTROLS - WAVE 33.3: Sidebar Cleanup
 * Panel de control global cuando no hay selección
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Muestra cuando NO hay selección:
 * - Selector de paleta de colores (PaletteControlMini)
 * - Toggle Selene AI
 * - Release All Overrides button
 * 
 * WAVE 33.2: Mode Switcher moved to StageViewDual toolbar
 * WAVE 33.3: Status panel removed (redundant with main sidebar)
 * 
 * @module components/views/StageViewDual/sidebar/GlobalControls
 * @version 33.3.0
 */

import React, { useCallback } from 'react'
import { useControlStore } from '../../../../stores/controlStore'
import { useOverrideStore, selectOverrideCount, selectHasAnyOverride } from '../../../../stores/overrideStore'
import { PaletteControlMini } from './PaletteControlMini'
import { MovementRadar } from './widgets'
import './GlobalControls.css'

export interface GlobalControlsProps {
  className?: string
}

export const GlobalControls: React.FC<GlobalControlsProps> = ({
  className = '',
}) => {
  // Control Store - AI toggle
  const aiEnabled = useControlStore(state => state.aiEnabled)
  const toggleAI = useControlStore(state => state.toggleAI)
  
  // Override Store
  const overrideCount = useOverrideStore(selectOverrideCount)
  const hasOverrides = useOverrideStore(selectHasAnyOverride)
  const clearAllOverrides = useOverrideStore(state => state.clearAllOverrides)
  
  // Handlers
  const handleReleaseAll = useCallback(() => {
    clearAllOverrides()
  }, [clearAllOverrides])
  
  return (
    <div className={`global-controls ${className}`}>
      {/* HEADER */}
      <div className="global-header">
        <span className="title">🎮 Control Global</span>
      </div>
      
      {/* 🎨 PALETTE CONTROL */}
      <PaletteControlMini />
      
      {/* 🕹️ MOVEMENT RADAR - WAVE 33.3 */}
      <MovementRadar />
      
      {/* AI TOGGLE */}
      <div className="control-section">
        <div className="toggle-row">
          <span className="toggle-label">🌙 Selene AI</span>
          <button 
            className={`toggle-btn ${aiEnabled ? 'on' : 'off'}`}
            onClick={toggleAI}
          >
            {aiEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>
      
      {/* RELEASE ALL OVERRIDES */}
      {hasOverrides && (
        <>
          <div className="divider" />
          <div className="control-section">
            <button 
              className="action-btn release-all"
              onClick={handleReleaseAll}
            >
              🔓 Release All Overrides ({overrideCount})
            </button>
          </div>
        </>
      )}
      
      {/* HELP */}
      <div className="divider" />
      <div className="help-section">
        <p className="help-text">
          💡 Haz clic en un fixture para seleccionarlo y controlar su color, 
          intensidad y movimiento manualmente.
        </p>
        <p className="help-text">
          Ctrl+Click para multi-selección, Shift+Click para rango.
        </p>
      </div>
    </div>
  )
}

export default GlobalControls

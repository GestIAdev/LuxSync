/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌍 GLOBAL CONTROLS - WAVE 33.2: Color Migration & Polish
 * Panel de control global cuando no hay selección
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Muestra cuando NO hay selección:
 * - Selector de paleta de colores (PaletteControlMini)
 * - Blackout button
 * - Estadísticas generales
 * - Info de conexión DMX
 * 
 * WAVE 33.2: Mode Switcher moved to StageViewDual header
 * 
 * @module components/views/StageViewDual/sidebar/GlobalControls
 * @version 33.2.0
 */

import React, { useCallback } from 'react'
import { useControlStore } from '../../../../stores/controlStore'
import { useTruthStore, selectHardware, selectSystem } from '../../../../stores/truthStore'
import { useOverrideStore, selectOverrideCount, selectHasAnyOverride } from '../../../../stores/overrideStore'
import { PaletteControlMini } from './PaletteControlMini'
import './GlobalControls.css'

export interface GlobalControlsProps {
  className?: string
}

export const GlobalControls: React.FC<GlobalControlsProps> = ({
  className = '',
}) => {
  // Control Store - Only AI toggle (Mode moved to Header)
  const aiEnabled = useControlStore(state => state.aiEnabled)
  const toggleAI = useControlStore(state => state.toggleAI)
  
  // Truth Store
  const hardware = useTruthStore(selectHardware)
  const system = useTruthStore(selectSystem)
  
  // Override Store
  const overrideCount = useOverrideStore(selectOverrideCount)
  const hasOverrides = useOverrideStore(selectHasAnyOverride)
  const clearAllOverrides = useOverrideStore(state => state.clearAllOverrides)
  
  // Fixture stats
  const fixtureCount = hardware?.fixtures?.length || 0
  const dmxConnected = hardware?.dmx?.connected ?? false
  
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
      
      {/* 🎨 WAVE 33.2: PALETTE CONTROL - Replaces Mode Selector (moved to Header) */}
      <PaletteControlMini />
      
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
      
      {/* DIVIDER */}
      <div className="divider" />
      
      {/* SYSTEM STATUS */}
      <div className="control-section">
        <h4 className="section-title">📊 Estado</h4>
        <div className="status-grid">
          <div className="status-item">
            <span className="status-label">Fixtures</span>
            <span className="status-value">{fixtureCount}</span>
          </div>
          <div className="status-item">
            <span className="status-label">DMX</span>
            <span className={`status-value ${dmxConnected ? 'connected' : 'disconnected'}`}>
              {dmxConnected ? '🟢' : '🔴'}
            </span>
          </div>
          <div className="status-item">
            <span className="status-label">Overrides</span>
            <span className="status-value">{overrideCount}</span>
          </div>
          <div className="status-item">
            <span className="status-label">FPS</span>
            <span className="status-value">{(system as { fps?: number })?.fps ?? '--'}</span>
          </div>
        </div>
      </div>
      
      {/* RELEASE ALL */}
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

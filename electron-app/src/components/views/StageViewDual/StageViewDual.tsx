/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎭 STAGE VIEW DUAL - WAVE 30: Stage Command & Dashboard
 * Vista dual que alterna entre Canvas 2D (Tactical) y R3F 3D (Visualizer)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Este componente:
 * 1. Lee el viewMode del controlStore
 * 2. Renderiza condicionalmente StageSimulator2 (2D) o Stage3DCanvas (3D)
 * 3. Incluye el ViewModeSwitcher para alternar
 * 
 * @module components/views/StageViewDual
 * @version 30.0.0
 */

import React, { Suspense, lazy } from 'react'
import { useControlStore, selectViewMode, selectIs3DMode } from '../../../stores/controlStore'
import { ViewModeSwitcher } from '../../shared/ViewModeSwitcher'
import { StageSimulator2 } from '../SimulateView/StageSimulator2'
import './StageViewDual.css'

// Lazy load del componente 3D (es pesado con Three.js)
const Stage3DCanvas = lazy(() => import('../../stage3d/Stage3DCanvas'))

// ═══════════════════════════════════════════════════════════════════════════
// LOADING FALLBACK
// ═══════════════════════════════════════════════════════════════════════════

const Loading3DFallback: React.FC = () => (
  <div className="stage-view-loading">
    <div className="loading-spinner" />
    <span className="loading-text">Cargando Visualizer 3D...</span>
    <span className="loading-hint">Preparando React Three Fiber</span>
  </div>
)

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export interface StageViewDualProps {
  className?: string
  showSwitcher?: boolean
}

export const StageViewDual: React.FC<StageViewDualProps> = ({
  className = '',
  showSwitcher = true,
}) => {
  const viewMode = useControlStore(selectViewMode)
  const is3D = useControlStore(selectIs3DMode)
  const showDebugOverlay = useControlStore(state => state.showDebugOverlay)
  const toggleDebugOverlay = useControlStore(state => state.toggleDebugOverlay)
  
  return (
    <div className={`stage-view-dual ${className}`}>
      {/* ═══════════════════════════════════════════════════════════════════
       * TOOLBAR
       * ═══════════════════════════════════════════════════════════════════ */}
      {showSwitcher && (
        <div className="stage-view-toolbar">
          <ViewModeSwitcher />
          
          <div className="toolbar-spacer" />
          
          <button
            className={`toolbar-btn ${showDebugOverlay ? 'active' : ''}`}
            onClick={toggleDebugOverlay}
            title="Toggle Debug Overlay"
          >
            🔧 Debug
          </button>
        </div>
      )}
      
      {/* ═══════════════════════════════════════════════════════════════════
       * VIEWPORT CONTAINER
       * ═══════════════════════════════════════════════════════════════════ */}
      <div className="stage-view-viewport">
        {is3D ? (
          /* 3D MODE - React Three Fiber */
          <Suspense fallback={<Loading3DFallback />}>
            <Stage3DCanvas showStats={showDebugOverlay} />
          </Suspense>
        ) : (
          /* 2D MODE - Canvas Tactical */
          <StageSimulator2 />
        )}
      </div>
      
      {/* ═══════════════════════════════════════════════════════════════════
       * MODE INDICATOR (Floating)
       * ═══════════════════════════════════════════════════════════════════ */}
      <div className="stage-view-mode-indicator">
        {is3D ? '🎬 VISUALIZER 3D' : '📐 TACTICAL 2D'}
      </div>
    </div>
  )
}

export default StageViewDual

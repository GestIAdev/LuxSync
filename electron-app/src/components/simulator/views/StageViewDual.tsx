/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎭 STAGE VIEW DUAL - WAVE 700.4: THE COCKPIT REDESIGN
 * Vista dual que alterna entre Canvas 2D (Tactical) y R3F 3D (Visualizer)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 700.4: THE DASHBOARD (Top StatusBar)
 * - Solo monitoreo: BPM, Energy, Mood (auto), View Mode
 * - Strike y Debug movidos aquí (utility cluster)
 * - Consciousness movido al CommandDeck (bottom)
 * 
 * @module components/simulator/views/StageViewDual
 * @version 700.4
 */

import React, { Suspense, lazy, useState, useCallback } from 'react'
import { useControlStore, selectViewMode, selectIs3DMode } from '../../../stores/controlStore'
import { useTruthSensory } from '../../../hooks'
import { ViewModeSwitcher } from '../../shared/ViewModeSwitcher'
import { StageSimulator2 } from './SimulateView/StageSimulator2'
import { StageSidebar } from '../controls/sidebar'
import './StageViewDual.css'

// Lazy load del componente 3D (es pesado con Three.js)
const Stage3DCanvas = lazy(() => import('./stage3d/Stage3DCanvas'))

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

// WAVE 610: No modes - Solo botón FORCE STRIKE
// Override eliminado - no sirve para nada

const MOOD_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  peaceful: { label: 'CHILL', icon: '😌', color: '#4ECDC4' },
  energetic: { label: 'ENERGY', icon: '⚡', color: '#FF6B6B' },
  chaotic: { label: 'CHAOS', icon: '🌪️', color: '#A855F7' },
  harmonious: { label: 'VIBE', icon: '🌊', color: '#4ADE80' },
  building: { label: 'BUILD', icon: '📈', color: '#FBBF24' },
  dropping: { label: 'DROP!', icon: '💥', color: '#FF1744' },
}

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
  showSidebar?: boolean
}

export const StageViewDual: React.FC<StageViewDualProps> = ({
  className = '',
  showSwitcher = true,
  showSidebar = true,
}) => {
  const viewMode = useControlStore(selectViewMode)
  const is3D = useControlStore(selectIs3DMode)
  const showDebugOverlay = useControlStore(state => state.showDebugOverlay)
  const toggleDebugOverlay = useControlStore(state => state.toggleDebugOverlay)
  
  // � WAVE 700.4: BPM & Mood from truthStore (MONITORING ONLY)
  const sensory = useTruthSensory()
  const displayBpm = sensory?.beat?.bpm ?? 0
  const bpmConfidence = sensory?.beat?.confidence ?? 0
  const isBeatSync = sensory?.beat?.onBeat ?? false
  // Mood inferred from audio energy (AUTOMATIC - different from MoodController)
  const energy = sensory?.audio?.energy ?? 0.5
  const currentMood = energy > 0.7 ? 'energetic' : energy > 0.4 ? 'harmonious' : 'peaceful'
  const moodConfig = MOOD_LABELS[currentMood] || MOOD_LABELS.harmonious
  const bpmColor = bpmConfidence > 0.7 ? '#4ADE80' : bpmConfidence > 0.4 ? '#FBBF24' : '#EF4444'
  
  // WAVE 429: Sidebar visibility state (no collapse, just show/hide)
  const [showInspector, setShowInspector] = useState(true)
  const handleCloseSidebar = useCallback(() => {
    setShowInspector(false)
  }, [])
  
  const handleOpenSidebar = useCallback(() => {
    setShowInspector(true)
  }, [])
  
  // Reopen sidebar when selection changes
  React.useEffect(() => {
    // Si hay algo seleccionado y el sidebar está cerrado, abrirlo
    // (comentado para no forzar - el usuario puede abrirlo manualmente)
    // if (selectedIds?.size > 0 && !showInspector) setShowInspector(true)
  }, [])
  
  return (
    <div className={`stage-view-dual ${className}`}>
      {/* ═══════════════════════════════════════════════════════════════════
       * STATUS BAR (TOP) - WAVE 700.4: THE DASHBOARD
       * Only monitoring: View Mode, BPM, Energy/Mood, Strike, Debug
       * ═══════════════════════════════════════════════════════════════════ */}
      {showSwitcher && (
        <div className="stage-view-toolbar">
          {/* View Mode Switcher (2D/3D) */}
          <ViewModeSwitcher />
          
          {/* DIVIDER */}
          <div className="toolbar-divider" />
          
          {/* 🎵 BPM INDICATOR */}
          <div className="toolbar-indicator bpm-indicator">
            <span className="indicator-icon">💓</span>
            <span className="indicator-value" style={{ color: bpmColor }}>
              {displayBpm > 0 ? displayBpm.toFixed(0) : '--'}
            </span>
            <span className="indicator-unit">BPM</span>
            <div className={`beat-dot ${isBeatSync ? 'pulse' : ''}`} />
          </div>
          
          {/* 📊 ENERGY BAR (mini) */}
          <div className="toolbar-indicator energy-indicator">
            <span className="indicator-icon">⚡</span>
            <div className="energy-bar-mini">
              <div 
                className="energy-bar-fill"
                style={{ 
                  width: `${Math.round(energy * 100)}%`,
                  backgroundColor: moodConfig.color,
                }}
              />
            </div>
            <span className="indicator-value" style={{ color: moodConfig.color }}>
              {Math.round(energy * 100)}%
            </span>
          </div>
          
          {/* � MOOD INDICATOR (Auto - from audio) */}
          <div className="toolbar-indicator mood-indicator">
            <span className="indicator-icon">{moodConfig.icon}</span>
            <span className="indicator-label" style={{ color: moodConfig.color }}>
              {moodConfig.label}
            </span>
          </div>
          
          <div className="toolbar-spacer" />
          
          {/* 🧨 FORCE STRIKE - Panic Button (smaller, tactical) */}
          <button
            className="force-strike-btn toolbar-btn-small"
            onClick={async () => {
              try {
                await window.lux?.forceStrike?.({ effect: 'solar_flare', intensity: 1.0 })
                console.log('[StageViewDual] 🧨 FORCE STRIKE TRIGGERED!')
                const btn = document.querySelector('.force-strike-btn')
                btn?.classList.add('strike-pulse')
                setTimeout(() => btn?.classList.remove('strike-pulse'), 500)
              } catch (err) {
                console.error('[StageViewDual] Force Strike error:', err)
              }
            }}
            title="⚡ FORCE STRIKE - Dispara Solar Flare"
          >
            <span className="strike-icon">⚡</span>
          </button>
          
          {/* DEBUG TOGGLE */}
          <button
            className={`toolbar-btn ${showDebugOverlay ? 'active' : ''}`}
            onClick={toggleDebugOverlay}
            title="Toggle Debug Overlay"
          >
            🔧
          </button>
        </div>
      )}
      
      {/* ═══════════════════════════════════════════════════════════════════
       * MAIN CONTENT: VIEWPORT + SIDEBAR
       * ═══════════════════════════════════════════════════════════════════ */}
      <div className="stage-view-main">
        {/* VIEWPORT CONTAINER */}
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
          
          {/* MODE INDICATOR (Floating) */}
          <div className="stage-view-mode-indicator">
            {is3D ? '🎬 VISUALIZER 3D' : '📐 TACTICAL 2D'}
          </div>
          
          {/* WAVE 429: Floating button to reopen sidebar */}
          {showSidebar && !showInspector && (
            <button
              className="sidebar-reopen-btn"
              onClick={handleOpenSidebar}
              title="Open Inspector (I)"
            >
              ⚙️
            </button>
          )}
        </div>
        
        {/* SIDEBAR - WAVE 429: Show/Hide (no collapse) */}
        {showSidebar && showInspector && (
          <StageSidebar 
            isVisible={showInspector}
            onClose={handleCloseSidebar}
          />
        )}
      </div>
    </div>
  )
}

export default StageViewDual

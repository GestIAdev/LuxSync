/**
 * 🎯 HUNT MONITOR V2 - TACTICAL HUD EDITION
 * ==========================================
 * WAVE 550: SeleneTitanConscious Telemetry HUD
 * 
 * Shows real AI telemetry from the consciousness system:
 * - Hunt Status (Sleeping / Stalking / Evaluating / Striking / Learning)
 * - Confidence Gauge (Barra de carga)
 * - Prediction Intel (Drop incoming, etc)
 * - Beauty Metrics (PHI score, trend)
 * - Energy Override Status
 * 
 * @module components/telemetry/HuntMonitor
 * @version 550.0.0
 */

import React, { useCallback } from 'react'
import { useTruthAI, useTruthConnected } from '../../../hooks'
import './HuntMonitor.css'

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS LOCALES
// ═══════════════════════════════════════════════════════════════════════════

type HuntState = 'sleeping' | 'stalking' | 'evaluating' | 'striking' | 'learning'

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

const HuntMonitor: React.FC = () => {
  const ai = useTruthAI()
  const connected = useTruthConnected()
  
  // ═══════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════════
  
  const handleForceMutate = useCallback(() => {
    window.lux?.forceMutate?.()
  }, [])
  
  const handleResetMemory = useCallback(() => {
    if (window.confirm('⚠️ Confirm MEMORY WIPE?')) {
      window.lux?.resetMemory?.()
    }
  }, [])
  
  // ═══════════════════════════════════════════════════════════════════════
  // VISUAL HELPERS
  // ═══════════════════════════════════════════════════════════════════════
  
  const getStatusConfig = (state: HuntState): { color: string; icon: string; label: string; pulse: boolean } => {
    switch (state) {
      case 'striking':
        return { color: '#ff2222', icon: '🎯', label: 'STRIKING', pulse: true }
      case 'stalking':
        return { color: '#f97316', icon: '🐱', label: 'STALKING', pulse: true }
      case 'evaluating':
        return { color: '#fbbf24', icon: '🔍', label: 'EVALUATING', pulse: false }
      case 'learning':
        return { color: '#8b5cf6', icon: '🧠', label: 'LEARNING', pulse: false }
      case 'sleeping':
      default:
        return { color: '#64748b', icon: '💤', label: 'SLEEPING', pulse: false }
    }
  }
  
  const getTrendIcon = (trend: 'rising' | 'falling' | 'stable'): string => {
    switch (trend) {
      case 'rising': return '📈'
      case 'falling': return '📉'
      default: return '➡️'
    }
  }
  
  const formatPhi = (score: number): string => {
    const phi = 1.618033988749
    const phiRatio = score * phi
    return phiRatio.toFixed(3)
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // DATA
  // ═══════════════════════════════════════════════════════════════════════
  
  const isEnabled = ai?.enabled ?? false
  const huntState = ai?.huntState ?? 'sleeping'
  const confidence = ai?.confidence ?? 0
  const prediction = ai?.prediction ?? null
  const beautyScore = ai?.beautyScore ?? 0.5
  const beautyTrend = ai?.beautyTrend ?? 'stable'
  const consonance = ai?.consonance ?? 1
  const energyOverride = ai?.energyOverrideActive ?? false
  const biases = ai?.biasesDetected ?? []
  const reasoning = ai?.reasoning ?? null
  
  const statusConfig = getStatusConfig(huntState)
  const confidencePct = Math.round(confidence * 100)
  
  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  
  return (
    <div className={`hunt-panel-container ${connected ? 'online' : 'offline'} ${isEnabled ? 'active' : 'disabled'}`}>
      
      {/* SECTION 1: TARGET STATUS (El Ojo) */}
      <div className="hunt-header">
        <div className="status-indicator">
          <div 
            className={`status-led ${statusConfig.pulse ? 'pulse' : ''}`} 
            style={{ background: statusConfig.color, boxShadow: `0 0 12px ${statusConfig.color}` }} 
          />
          <span className="status-icon">{statusConfig.icon}</span>
          <span className="status-text" style={{ color: statusConfig.color }}>
            {statusConfig.label}
          </span>
        </div>
        
        {/* AI Toggle Indicator */}
        <div className={`ai-toggle-badge ${isEnabled ? 'on' : 'off'}`}>
          {isEnabled ? '🧠 CONSCIOUS' : '⚙️ REACTIVE'}
        </div>
      </div>

      {/* SECTION 2: CONFIDENCE GAUGE (La Barra) */}
      <div className="strike-gauge-section">
        <div className="gauge-labels">
          <span className="label">CONFIDENCE</span>
          <span className="value" style={{ color: confidence > 0.8 ? '#22c55e' : confidence > 0.5 ? '#fbbf24' : '#64748b' }}>
            {confidencePct}%
          </span>
        </div>
        
        <div className="gauge-track">
          <div className="gauge-threshold" style={{ left: '50%' }} title="Decision threshold" />
          <div className="gauge-threshold critical" style={{ left: '80%' }} title="Strike threshold" />
          
          <div 
            className={`gauge-fill ${confidence > 0.8 ? 'ready' : confidence > 0.5 ? 'warm' : ''}`}
            style={{ 
              width: `${confidencePct}%`,
              background: confidence > 0.8 
                ? 'linear-gradient(90deg, #22c55e, #4ade80)' 
                : confidence > 0.5 
                  ? 'linear-gradient(90deg, #f97316, #fbbf24)' 
                  : 'linear-gradient(90deg, #475569, #64748b)'
            }}
          />
        </div>
        
        <div className="gauge-ruler">
          <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
        </div>
      </div>

      {/* SECTION 3: INTEL (Datos de Predicción y Belleza) */}
      <div className="intel-section">
        <div className={`intel-row prediction ${prediction ? 'active' : ''}`}>
          <span className="intel-label">🔮 PREDICTION</span>
          <span className="intel-value">{prediction ?? '—'}</span>
        </div>
        
        <div className="intel-row beauty">
          <span className="intel-label">✨ PHI</span>
          <span className="intel-value">{formatPhi(beautyScore)} {getTrendIcon(beautyTrend)}</span>
        </div>
        
        <div className="intel-row consonance">
          <span className="intel-label">🎵 CONSONANCE</span>
          <span className="intel-value">{Math.round(consonance * 100)}%</span>
        </div>
      </div>

      {/* DIAGNOSTICS: Status Indicators */}
      <div className="diagnostics-grid">
        <div className={`diag-item ${isEnabled ? 'met' : ''}`}>
          <div className="diag-box" />
          <span className="diag-label">AI ON</span>
        </div>
        <div className={`diag-item ${confidence > 0.5 ? 'met' : ''}`}>
          <div className="diag-box" />
          <span className="diag-label">CONF</span>
        </div>
        <div className={`diag-item ${energyOverride ? 'warning' : 'met'}`}>
          <div className="diag-box" />
          <span className="diag-label">{energyOverride ? 'VETO' : 'OPEN'}</span>
        </div>
        <div className={`diag-item ${biases.length === 0 ? 'met' : 'warning'}`}>
          <div className="diag-box" />
          <span className="diag-label">BIAS</span>
        </div>
      </div>
      
      {/* Reasoning (si hay) */}
      {reasoning && (
        <div className="reasoning-bar">
          <span className="reasoning-text">💭 {reasoning}</span>
        </div>
      )}

      {/* TACTICAL CONTROLS */}
      <div className="tactical-controls">
        <button className="tac-btn mutate" onClick={handleForceMutate}>
          <span className="icon">⚡</span> MUTATE
        </button>
        
        <div className="control-group-right">
          <button className="tac-btn reset" onClick={handleResetMemory} title="Wipe Memory">
            🗑️
          </button>
        </div>
      </div>

    </div>
  )
}

export default HuntMonitor

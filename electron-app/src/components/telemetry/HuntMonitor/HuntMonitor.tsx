/**
 * 🎯 HUNT MONITOR - TACTICAL HUD EDITION
 * WAVE 29: Visualización de Caza y Disparo
 * * Shows:
 * - HUD Status (Idle / Stalking / Striking)
 * - Strike Gauge (Barra de carga agresiva)
 * - Target Lock Information (Si hay patrón detectado)
 * - System Diagnostics (Condiciones de disparo)
 * - Manual Overrides (Mutate / Reset)
 */

import React, { useState, useCallback } from 'react'
import { useTruthMusicalDNA, useTruthCognitive, useTruthConnected } from '../../../hooks'
import './HuntMonitor.css'

const HuntMonitor: React.FC = () => {
  const prediction = useTruthMusicalDNA()?.prediction
  const cognitive = useTruthCognitive()
  const connected = useTruthConnected()
  
  const [showSettings, setShowSettings] = useState(false)
  
  // Handlers
  const handleForceMutate = useCallback(() => {
    window.lux?.forceMutate?.()
  }, [])
  
  const handleResetMemory = useCallback(() => {
    if (window.confirm('Confirm MEMORY WIPE?')) {
      window.lux?.resetMemory?.()
    }
  }, [])
  
  // Data Mapping
  const huntStatus = prediction?.huntStatus?.phase ?? 'idle'
  const beauty = cognitive?.beauty
  
  const data = {
    status: huntStatus,
    target: prediction?.huntStatus?.targetType ? { 
      pattern: prediction.huntStatus.targetType,
      lock: prediction.huntStatus.lockPercentage || 0,
      cycles: 0, 
      maxCycles: 10
    } : null,
    score: {
      current: (beauty?.current ?? 0) * 100,
      threshold: 85,
      isReady: (beauty?.current ?? 0) >= 0.85
    },
    conditions: [
      { id: 'beauty', label: 'BEAUTY', met: (beauty?.current ?? 0) >= 0.85 },
      { id: 'trend', label: 'TREND', met: false }, // Placeholder lógica real
      { id: 'harmony', label: 'HARMONY', met: false },
      { id: 'health', label: 'HEALTH', met: true },
      { id: 'cooldown', label: 'COOLDOWN', met: true }
    ]
  }

  // Visual Helpers
  const getStatusColor = (s: string) => {
    if (s === 'striking') return '#ff2222' // Rojo Disparo
    if (s === 'stalking') return '#f97316' // Naranja Buscando
    if (s === 'evaluating') return '#fbbf24' // Amarillo Evaluando
    return '#64748b' // Gris Idle
  }

  return (
    <div className={`hunt-panel-container ${connected ? 'online' : 'offline'}`}>
      
      {/* HEADER: STATUS & TARGET */}
      <div className="hunt-header">
        <div className="status-indicator">
          <div className="status-led" style={{ background: getStatusColor(data.status) }} />
          <span className="status-text" style={{ color: getStatusColor(data.status) }}>
            {data.status.toUpperCase()}
          </span>
        </div>
        {data.target && (
          <div className="target-lock">
            <span className="lock-icon">⌖</span>
            <span className="lock-name">{data.target.pattern}</span>
            <span className="lock-val">{Math.round(data.target.lock)}%</span>
          </div>
        )}
      </div>

      {/* MAIN GAUGE: STRIKE SCORE */}
      <div className="strike-gauge-section">
        <div className="gauge-labels">
          <span className="label">STRIKE PROBABILITY</span>
          <span className="value">{Math.round(data.score.current)}%</span>
        </div>
        
        <div className="gauge-track">
          {/* Threshold Marker */}
          <div className="gauge-threshold" style={{ left: `${data.score.threshold}%` }} />
          
          {/* Fill Bar */}
          <div 
            className={`gauge-fill ${data.score.isReady ? 'ready' : ''}`}
            style={{ width: `${data.score.current}%` }}
          />
        </div>
        <div className="gauge-ruler">
          <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
        </div>
      </div>

      {/* DIAGNOSTICS: CONDITIONS GRID */}
      <div className="diagnostics-grid">
        {data.conditions.map(cond => (
          <div key={cond.id} className={`diag-item ${cond.met ? 'met' : ''}`}>
            <div className="diag-box" />
            <span className="diag-label">{cond.label}</span>
          </div>
        ))}
      </div>

      {/* TACTICAL CONTROLS */}
      <div className="tactical-controls">
        <button className="tac-btn mutate" onClick={handleForceMutate}>
          <span className="icon">⚡</span> MUTATE
        </button>
        
        <div className="control-group-right">
          <button className="tac-btn reset" onClick={handleResetMemory} title="Wipe Memory">
            🗑️
          </button>
          <button 
            className={`tac-btn settings ${showSettings ? 'active' : ''}`} 
            onClick={() => setShowSettings(!showSettings)}
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* EXPANDABLE SETTINGS */}
      {showSettings && (
        <div className="tactical-settings">
          <div className="setting-row">
            <span>THRESHOLD</span> <span className="val">85%</span>
          </div>
          <div className="setting-row">
            <span>COOLDOWN</span> <span className="val">3000ms</span>
          </div>
        </div>
      )}

    </div>
  )
}

export default HuntMonitor

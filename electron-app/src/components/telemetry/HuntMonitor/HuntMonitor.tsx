/**
 * 🎯 HUNT MONITOR
 * WAVE 14.3: Stalking & Strike engine visualization + Control Actions embebidos
 * 🧠 WAVE 25.6: Migrado a truthStore
 * 
 * Shows:
 * - Hunt status (idle/stalking/evaluating/striking)
 * - Current target info
 * - Strike conditions (5 conditions)
 * - Strike score bar
 * - Action buttons: Force Mutate, Reset Memory (INTEGRADO)
 */

import React, { useState, useCallback } from 'react'
import { useTruthMusicalDNA, useTruthCognitive, useTruthConnected } from '../../../hooks'
import './HuntMonitor.css'

const HuntMonitor: React.FC = () => {
  // 🧠 WAVE 25.6: Use truthStore
  const prediction = useTruthMusicalDNA()?.prediction
  const cognitive = useTruthCognitive()
  const connected = useTruthConnected()
  
  // Estado para settings expandidos
  const [showSettings, setShowSettings] = useState(false)
  
  // Handlers de acciones
  const handleForceMutate = useCallback(() => {
    console.log('[HUNT] Force Mutate triggered')
    window.lux?.forceMutate?.()
  }, [])
  
  const handleResetMemory = useCallback(() => {
    if (window.confirm('¿Borrar toda la memoria de Selene? Esta acción no se puede deshacer.')) {
      console.log('[HUNT] Reset Memory triggered')
      window.lux?.resetMemory?.()
    }
  }, [])
  
  // Build hunt data from truth
  const huntStatus = prediction?.huntStatus?.phase ?? 'idle'
  const beauty = cognitive?.beauty
  
  const data = {
    status: huntStatus,
    cycleId: null,
    currentTarget: prediction?.huntStatus?.targetType ? { 
      pattern: prediction.huntStatus.targetType,
      huntWorthiness: prediction.huntStatus.lockPercentage / 100,
      cyclesObserved: 0,
      maxCycles: 10
    } : null,
    strikeConditions: {
      beauty: { current: beauty?.current ?? 0, threshold: 0.85, met: (beauty?.current ?? 0) >= 0.85 },
      trend: { direction: 'stable', required: 'rising', met: false },
      harmony: { consonance: 0, threshold: 0.7, met: false },
      health: { current: 0, threshold: 0.6, met: false },
      cooldown: { ready: true, timeUntilReady: 0 },
      conditionsMet: 0,
      totalConditions: 5,
      strikeScore: beauty?.current ?? 0,
      allConditionsMet: false,
    },
    preyCandidates: [],
    estimatedTimeToStrike: prediction?.dropPrediction?.barsUntil ?? -1,
  }
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'idle': return '😴'
      case 'stalking': return '👁️'
      case 'evaluating': return '🔍'
      case 'striking': return '⚡'
      case 'learning': return '📚'
      case 'completed': return '✅'
      default: return '❓'
    }
  }
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'idle': return '#64748b'
      case 'stalking': return '#f97316'
      case 'evaluating': return '#fbbf24'
      case 'striking': return '#22c55e'
      case 'learning': return '#a855f7'
      case 'completed': return '#3b82f6'
      default: return '#94a3b8'
    }
  }
  
  const conditions = data.strikeConditions

  return (
    <div className={`telemetry-panel hunt-monitor ${connected ? 'connected' : 'disconnected'}`}>
      <div className="panel-header">
        <h3>🎯 HUNT STATUS</h3>
        <span 
          className="hunt-status-badge"
          style={{ 
            color: getStatusColor(data.status),
            borderColor: getStatusColor(data.status)
          }}
        >
          {getStatusIcon(data.status)} {data.status.toUpperCase()}
        </span>
      </div>
      
      {/* Strike Score */}
      <div className="strike-score-section">
        <div className="score-header">
          <span className="score-label">Strike Score</span>
          <span className="score-value">
            {Math.round(conditions.strikeScore * 100)}%
          </span>
        </div>
        <div className="score-bar">
          <div 
            className={`score-fill ${conditions.allConditionsMet ? 'ready' : ''}`}
            style={{ width: `${conditions.strikeScore * 100}%` }}
          />
          <div className="score-threshold" style={{ left: '85%' }} />
        </div>
        <div className="score-info">
          <span className="conditions-count">
            {conditions.conditionsMet}/{conditions.totalConditions} conditions
          </span>
          {conditions.allConditionsMet && (
            <span className="ready-badge">🚀 READY</span>
          )}
        </div>
      </div>
      
      {/* Strike Conditions */}
      <div className="conditions-section">
        <span className="section-title">Conditions</span>
        <div className="conditions-grid">
          <div className={`condition-item ${conditions.beauty.met ? 'met' : ''}`}>
            <span className="condition-icon">{conditions.beauty.met ? '✓' : '○'}</span>
            <span className="condition-name">Beauty</span>
            <span className="condition-value">
              {Math.round(conditions.beauty.current * 100)}% / {Math.round(conditions.beauty.threshold * 100)}%
            </span>
          </div>
          
          <div className={`condition-item ${conditions.trend.met ? 'met' : ''}`}>
            <span className="condition-icon">{conditions.trend.met ? '✓' : '○'}</span>
            <span className="condition-name">Trend</span>
            <span className="condition-value">
              {conditions.trend.direction} → {conditions.trend.required}
            </span>
          </div>
          
          <div className={`condition-item ${conditions.harmony.met ? 'met' : ''}`}>
            <span className="condition-icon">{conditions.harmony.met ? '✓' : '○'}</span>
            <span className="condition-name">Harmony</span>
            <span className="condition-value">
              {Math.round(conditions.harmony.consonance * 100)}%
            </span>
          </div>
          
          <div className={`condition-item ${conditions.health.met ? 'met' : ''}`}>
            <span className="condition-icon">{conditions.health.met ? '✓' : '○'}</span>
            <span className="condition-name">Health</span>
            <span className="condition-value">
              {Math.round(conditions.health.current * 100)}%
            </span>
          </div>
          
          <div className={`condition-item ${conditions.cooldown.ready ? 'met' : ''}`}>
            <span className="condition-icon">{conditions.cooldown.ready ? '✓' : '⏳'}</span>
            <span className="condition-name">Cooldown</span>
            <span className="condition-value">
              {conditions.cooldown.ready ? 'Ready' : `${Math.round(conditions.cooldown.timeUntilReady / 1000)}s`}
            </span>
          </div>
        </div>
      </div>
      
      {/* Current Target (if any) */}
      {data.currentTarget && (
        <div className="target-section">
          <span className="section-title">🎯 Current Target</span>
          <div className="target-info">
            <div className="target-row">
              <span className="target-label">Pattern</span>
              <span className="target-value">{data.currentTarget.pattern}</span>
            </div>
            <div className="target-row">
              <span className="target-label">Worthiness</span>
              <span className="target-value">
                {Math.round(data.currentTarget.huntWorthiness * 100)}%
              </span>
            </div>
            <div className="target-row">
              <span className="target-label">Cycles</span>
              <span className="target-value">
                {data.currentTarget.cyclesObserved}/{data.currentTarget.maxCycles}
              </span>
            </div>
          </div>
        </div>
      )}
      
      {/* Action Toolbar - WAVE 14.3: Controles Embebidos */}
      <div className="action-toolbar">
        <button 
          className="action-btn mutate"
          onClick={handleForceMutate}
          title="Forzar una mutación de paleta ahora"
        >
          ⚡ MUTATE
        </button>
        <button 
          className="action-btn reset"
          onClick={handleResetMemory}
          title="Borrar memoria de paletas aprendidas"
        >
          🗑️ RESET
        </button>
        <button 
          className={`action-btn settings ${showSettings ? 'active' : ''}`}
          onClick={() => setShowSettings(!showSettings)}
          title="Ajustes avanzados de caza"
        >
          ⚙️
        </button>
      </div>
      
      {/* Settings Expandibles */}
      {showSettings && (
        <div className="inline-settings">
          <div className="setting-item">
            <span className="setting-label">Beauty Threshold</span>
            <span className="setting-value">85%</span>
          </div>
          <div className="setting-item">
            <span className="setting-label">Cooldown</span>
            <span className="setting-value">3s</span>
          </div>
          <div className="setting-item">
            <span className="setting-label">Max Cycles</span>
            <span className="setting-value">8</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default HuntMonitor

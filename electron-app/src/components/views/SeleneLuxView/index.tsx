/**
 * 🧠 SELENE LUX VIEW - AI Brain Dashboard
 * WAVE 9.2: Estado del cerebro, métricas y decision log
 * WAVE 10: Connected to real brain data via IPC
 */

import React, { useEffect, useState } from 'react'
import { useSeleneStore, LOG_ENTRY_CONFIG, initializeSeleneStoreIPC } from '../../../stores/seleneStore'
import './SeleneLuxView.css'

const SeleneLuxView: React.FC = () => {
  const {
    brainConnected = false,
    currentMode = 'flow',
    confidence = 0.5,
    energy = 0,
    beautyScore = 0.75,
    framesProcessed = 0,
    patternsLearned = 0,
    sessionPatterns = 0,
    memoryUsage = 0,
    decisionLog = [],
    logPaused = false,
    logFilter = 'ALL',
    toggleLogPause,
    setLogFilter,
    clearLog,
  } = useSeleneStore()

  // 🧠 WAVE 10: Initialize IPC subscriptions on mount
  useEffect(() => {
    const cleanup = initializeSeleneStoreIPC()
    return cleanup
  }, [])

  // Neural wave animation
  const [neuralPhase, setNeuralPhase] = useState(0)
  
  useEffect(() => {
    if (!brainConnected) return
    const interval = setInterval(() => {
      setNeuralPhase(p => (p + 1) % 20)
    }, 100)
    return () => clearInterval(interval)
  }, [brainConnected])

  // Generate animated neural wave based on energy
  const generateNeuralWave = (row: number) => {
    const chars = []
    for (let i = 0; i < 24; i++) {
      const phase = (i + neuralPhase + row * 3) % 6
      const char = phase < 2 ? '∿' : phase < 4 ? '∼' : '~'
      chars.push(char)
    }
    return chars.join('')
  }

  const filteredLog = logFilter === 'ALL' 
    ? decisionLog 
    : decisionLog.filter(entry => entry.type === logFilter)

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    const time = date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
    })
    const ms = date.getMilliseconds().toString().padStart(3, '0')
    return `${time}.${ms}`
  }

  // Get status based on metrics
  const getConsciousnessLevel = () => {
    if (!brainConnected) return 'OFFLINE'
    if (energy > 0.8) return 'HYPER-AWARE'
    if (energy > 0.5) return 'ACTIVE'
    if (energy > 0.2) return 'DREAMING'
    return 'RESTING'
  }

  return (
    <div className="selene-view">
      <header className="view-header">
        <h2 className="view-title">🧠 SELENE LUX</h2>
        <div className="view-status">
          <span className={`consciousness-level ${getConsciousnessLevel().toLowerCase().replace('-', '')}`}>
            {getConsciousnessLevel()}
          </span>
        </div>
      </header>

      <div className="selene-content">
        {/* Top Panels */}
        <div className="selene-top-panels">
          {/* Consciousness State */}
          <section className="panel consciousness-panel">
            <h3>🌙 CONSCIOUSNESS STATE</h3>
            <div className={`neural-activity ${brainConnected ? 'active' : ''}`}>
              <div className="neural-wave" style={{ opacity: 0.4 + energy * 0.3 }}>{generateNeuralWave(0)}</div>
              <div className="neural-wave" style={{ opacity: 0.5 + energy * 0.3 }}>{generateNeuralWave(1)}</div>
              <div className="neural-wave" style={{ opacity: 0.6 + energy * 0.3 }}>{generateNeuralWave(2)}</div>
              <span className="neural-label">Neural Activity</span>
            </div>
            <div className="consciousness-info">
              <div className="info-row">
                <span className={`status-badge ${brainConnected ? 'active' : 'inactive'}`}>
                  {brainConnected ? '🟢 ACTIVE' : '🔴 OFFLINE'}
                </span>
              </div>
              <div className="info-row">
                <span>Mode:</span>
                <span className="value mode-value">{currentMode.toUpperCase()}</span>
              </div>
              <div className="info-row">
                <span>Beauty:</span>
                <span className="value">{beautyScore.toFixed(2)} avg</span>
              </div>
            </div>
          </section>

          {/* Memory Stats */}
          <section className="panel memory-panel">
            <h3>💾 MEMORY STATS</h3>
            <div className="memory-stats">
              <div className="stat-row">
                <span>Total Patterns:</span>
                <span className="value">{patternsLearned.toLocaleString()}</span>
              </div>
              <div className="stat-row">
                <span>This Session:</span>
                <span className="value">{sessionPatterns}</span>
              </div>
              <div className="stat-row">
                <span>Frames Processed:</span>
                <span className="value">{framesProcessed.toLocaleString()}</span>
              </div>
              <div className="memory-usage">
                <span>Memory Usage:</span>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${memoryUsage * 100}%` }} 
                  />
                </div>
                <span>{(memoryUsage * 100).toFixed(0)}%</span>
              </div>
            </div>
            <div className="memory-actions">
              <button className="btn btn-small">Cleanup</button>
              <button className="btn btn-small">Backup</button>
            </div>
          </section>
        </div>

        {/* Real-time Metrics */}
        <section className="panel metrics-panel">
          <h3>📊 REAL-TIME METRICS</h3>
          <div className="metrics-bars">
            <div className="metric-row">
              <span className="metric-label">Confidence</span>
              <div className="metric-bar">
                <div 
                  className="metric-fill confidence" 
                  style={{ width: `${confidence * 100}%` }} 
                />
              </div>
              <span className="metric-value">{(confidence * 100).toFixed(0)}%</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Energy</span>
              <div className="metric-bar">
                <div 
                  className="metric-fill energy" 
                  style={{ width: `${energy * 100}%` }} 
                />
              </div>
              <span className="metric-value">{(energy * 100).toFixed(0)}%</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Beauty</span>
              <div className="metric-bar">
                <div 
                  className="metric-fill beauty" 
                  style={{ width: `${beautyScore * 100}%` }} 
                />
              </div>
              <span className="metric-value">{(beautyScore * 100).toFixed(0)}%</span>
            </div>
          </div>
        </section>

        {/* Decision Log */}
        <section className="panel log-panel">
          <div className="log-header">
            <h3>📜 DECISION LOG</h3>
            <div className="log-controls">
              <select 
                value={logFilter} 
                onChange={(e) => setLogFilter(e.target.value as any)}
                className="log-filter"
              >
                <option value="ALL">ALL</option>
                <option value="LEARN">LEARN</option>
                <option value="MEMORY">MEMORY</option>
                <option value="SECTION">SECTION</option>
                <option value="GENRE">GENRE</option>
                <option value="MODE">MODE</option>
                <option value="PALETTE">PALETTE</option>
                <option value="ENERGY">ENERGY</option>
                <option value="ERROR">ERROR</option>
              </select>
              <button 
                className={`btn btn-small ${logPaused ? 'active' : ''}`}
                onClick={toggleLogPause}
              >
                {logPaused ? '▶ Resume' : '⏸ Pause'}
              </button>
              <button className="btn btn-small" onClick={clearLog}>
                🗑 Clear
              </button>
            </div>
          </div>
          <div className="log-entries">
            {filteredLog.length === 0 ? (
              <div className="log-empty">No log entries yet...</div>
            ) : (
              filteredLog.slice(0, 100).map((entry) => {
                const config = LOG_ENTRY_CONFIG[entry.type]
                return (
                  <div key={entry.id} className="log-entry">
                    <span className="log-time">{formatTime(entry.timestamp)}</span>
                    <span 
                      className="log-type" 
                      style={{ color: config.color }}
                    >
                      {config.icon} {entry.type}
                    </span>
                    <span className="log-message">{entry.message}</span>
                  </div>
                )
              })
            )}
          </div>
          <div className="log-footer">
            <span>Showing {Math.min(filteredLog.length, 100)} of {filteredLog.length} entries</span>
            <button className="btn btn-small">Export CSV</button>
          </div>
        </section>
      </div>
    </div>
  )
}

export default SeleneLuxView

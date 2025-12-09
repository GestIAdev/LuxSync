/**
 * 📜 TACTICAL LOG - Full-screen Decision Console
 * WAVE 14: Consola gigante para leer la mente de Selene
 * 
 * Features:
 * - Filtros por tipo de log
 * - Búsqueda de texto
 * - Colores por severidad
 * - Auto-scroll opcional
 * - Exportar a CSV
 */

import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useTelemetryStore, type TelemetryLogEntry } from '../../../stores/telemetryStore'
import './TacticalLog.css'

// Log type configuration with colors and icons
const LOG_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  MODE: { icon: '🎭', color: '#a855f7', label: 'Mode' },
  BEAT: { icon: '🥁', color: '#22c55e', label: 'Beat' },
  BPM: { icon: '💓', color: '#ec4899', label: 'BPM' },
  GENRE: { icon: '🎵', color: '#06b6d4', label: 'Genre' },
  STRIKE: { icon: '⚡', color: '#fbbf24', label: 'Strike' },
  BIAS: { icon: '🎯', color: '#f97316', label: 'Bias' },
  PALETTE: { icon: '🎨', color: '#d946ef', label: 'Palette' },
  ZODIAC: { icon: '♈', color: '#8b5cf6', label: 'Zodiac' },
  SECTION: { icon: '📍', color: '#14b8a6', label: 'Section' },
  HUNT: { icon: '🎯', color: '#f97316', label: 'Hunt' },
  MEMORY: { icon: '💾', color: '#3b82f6', label: 'Memory' },
  MUTATION: { icon: '🧬', color: '#84cc16', label: 'Mutation' },
  INFO: { icon: 'ℹ️', color: '#64748b', label: 'Info' },
}

const SEVERITY_COLORS: Record<string, string> = {
  info: 'rgba(255, 255, 255, 0.7)',
  success: '#22c55e',
  warning: '#fbbf24',
  error: '#ef4444',
}

export const TacticalLog: React.FC = () => {
  const logs = useTelemetryStore((state) => state.logs)
  const logFilter = useTelemetryStore((state) => state.logFilter)
  const logAutoScroll = useTelemetryStore((state) => state.logAutoScroll)
  const setLogFilter = useTelemetryStore((state) => state.setLogFilter)
  const toggleLogAutoScroll = useTelemetryStore((state) => state.toggleLogAutoScroll)
  const clearLogs = useTelemetryStore((state) => state.clearLogs)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(true)
  const logContainerRef = useRef<HTMLDivElement>(null)
  
  // Filter and search logs
  const filteredLogs = useMemo(() => {
    let result = logs
    
    // Type filter
    if (logFilter !== 'ALL') {
      result = result.filter(log => log.type === logFilter)
    }
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(log => 
        log.message.toLowerCase().includes(query) ||
        log.type.toLowerCase().includes(query)
      )
    }
    
    return result
  }, [logs, logFilter, searchQuery])
  
  // Auto-scroll to top when new logs arrive
  useEffect(() => {
    if (logAutoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = 0
    }
  }, [logs, logAutoScroll])
  
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
  
  const exportToCSV = () => {
    const headers = ['Timestamp', 'Type', 'Severity', 'Message']
    const rows = filteredLogs.map(log => [
      new Date(log.timestamp).toISOString(),
      log.type,
      log.severity,
      `"${log.message.replace(/"/g, '""')}"`,
    ])
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = `selene-logs-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    
    URL.revokeObjectURL(url)
  }
  
  const logTypes = ['ALL', ...Object.keys(LOG_CONFIG)]

  return (
    <div className="tactical-log">
      {/* Toolbar */}
      <div className="log-toolbar">
        <div className="toolbar-left">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            {searchQuery && (
              <button 
                className="clear-search"
                onClick={() => setSearchQuery('')}
              >
                ✕
              </button>
            )}
          </div>
          
          <button 
            className={`toolbar-btn ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            🏷️ Filters
          </button>
        </div>
        
        <div className="toolbar-right">
          <span className="log-count">
            {filteredLogs.length} / {logs.length} entries
          </span>
          
          <button 
            className={`toolbar-btn ${logAutoScroll ? 'active' : ''}`}
            onClick={toggleLogAutoScroll}
            title="Toggle auto-scroll"
          >
            {logAutoScroll ? '📜 Auto' : '📜 Manual'}
          </button>
          
          <button 
            className="toolbar-btn"
            onClick={exportToCSV}
            title="Export to CSV"
          >
            📤 Export
          </button>
          
          <button 
            className="toolbar-btn danger"
            onClick={clearLogs}
            title="Clear all logs"
          >
            🗑️ Clear
          </button>
        </div>
      </div>
      
      {/* Filter Pills */}
      {showFilters && (
        <div className="filter-pills">
          {logTypes.map(type => {
            const config = LOG_CONFIG[type]
            const isActive = logFilter === type
            const count = type === 'ALL' 
              ? logs.length 
              : logs.filter(l => l.type === type).length
            
            return (
              <button
                key={type}
                className={`filter-pill ${isActive ? 'active' : ''}`}
                onClick={() => setLogFilter(type)}
                style={isActive && config ? { 
                  borderColor: config.color,
                  color: config.color,
                } : undefined}
              >
                {config?.icon || '📋'} {config?.label || type}
                <span className="pill-count">{count}</span>
              </button>
            )
          })}
        </div>
      )}
      
      {/* Log Container */}
      <div className="log-container" ref={logContainerRef}>
        {filteredLogs.length === 0 ? (
          <div className="log-empty">
            <span className="empty-icon">📭</span>
            <span className="empty-text">
              {searchQuery 
                ? 'No logs match your search' 
                : 'Waiting for Selene to think...'}
            </span>
          </div>
        ) : (
          <div className="log-entries">
            {filteredLogs.map((entry) => {
              const config = LOG_CONFIG[entry.type] || LOG_CONFIG.INFO
              
              return (
                <div 
                  key={entry.id} 
                  className={`log-entry severity-${entry.severity}`}
                >
                  <span className="log-time">{formatTime(entry.timestamp)}</span>
                  <span 
                    className="log-type"
                    style={{ color: config.color }}
                  >
                    {config.icon} {entry.type}
                  </span>
                  <span 
                    className="log-message"
                    style={{ color: SEVERITY_COLORS[entry.severity] }}
                  >
                    {entry.message}
                  </span>
                  {entry.duplicateCount > 1 && (
                    <span className="log-duplicate">
                      ×{entry.duplicateCount}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

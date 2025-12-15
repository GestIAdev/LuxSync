/**
 * 📜 TACTICAL LOG - Full-screen Decision Console
 * WAVE 14: Consola gigante para leer la mente de Selene
 * 📜 WAVE 25.7: Migrado a logStore dedicado
 * 
 * Features:
 * - Filtros por tipo de log
 * - Búsqueda de texto
 * - Colores por severidad
 * - Auto-scroll opcional
 * - Exportar a CSV
 */

import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useLogStore, type LogEntry } from '../../../stores/logStore'
import './TacticalLog.css'

// Log type configuration with colors and icons
const LOG_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  Mode: { icon: '🎭', color: '#a855f7', label: 'Mode' },
  Beat: { icon: '🥁', color: '#22c55e', label: 'Beat' },
  Music: { icon: '🎵', color: '#06b6d4', label: 'Music' },
  Genre: { icon: '🎶', color: '#ec4899', label: 'Genre' },
  Brain: { icon: '🧠', color: '#fbbf24', label: 'Brain' },
  Visual: { icon: '🎨', color: '#d946ef', label: 'Visual' },
  DMX: { icon: '💡', color: '#14b8a6', label: 'DMX' },
  System: { icon: '⚙️', color: '#64748b', label: 'System' },
  // Legacy categories (for backwards compat)
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
  // 📜 WAVE 25.7: Use dedicated logStore
  const logs = useLogStore((state) => state.logs)
  const clearLogs = useLogStore((state) => state.clearLogs)
  
  const [logFilter, setLogFilter] = useState<string>('ALL')
  const [logAutoScroll, setLogAutoScroll] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(true)
  const logContainerRef = useRef<HTMLDivElement>(null)
  
  // Filter and search logs
  const filteredLogs = useMemo(() => {
    let result = logs
    
    // Type filter
    if (logFilter !== 'ALL') {
      result = result.filter(log => log.category === logFilter)
    }
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(log => 
        log.message.toLowerCase().includes(query) ||
        log.category.toLowerCase().includes(query)
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
    const headers = ['Timestamp', 'Category', 'Message']
    const rows = filteredLogs.map(log => [
      new Date(log.timestamp).toISOString(),
      log.category,
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
  
  const toggleAutoScroll = () => setLogAutoScroll(!logAutoScroll)
  
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
            onClick={toggleAutoScroll}
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
              : logs.filter(l => l.category === type).length
            
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
              const config = LOG_CONFIG[entry.category] || LOG_CONFIG.INFO
              
              return (
                <div 
                  key={entry.id} 
                  className="log-entry"
                >
                  <span className="log-time">{formatTime(entry.timestamp)}</span>
                  <span 
                    className="log-type"
                    style={{ color: config.color }}
                  >
                    {config.icon} {entry.category}
                  </span>
                  <span className="log-message">
                    {entry.message}
                  </span>
                  {entry.data && (
                    <span className="log-data" title={JSON.stringify(entry.data)}>
                      📎
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

/**
 * 📜 TACTICAL LOG - DECISION CONSOLE
 * WAVE 29: Cyberpunk Terminal Edition
 * * Muestra el flujo de pensamiento de Selene en tiempo real.
 * * FIX: Incluye el listener para recibir datos del backend.
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useLogStore } from '../../../stores/logStore'
import { Filter, Download, Trash2, Search, Pause, Play, Terminal } from 'lucide-react'
import './TacticalLog.css'

// Configuration for Log Types (Cyberpunk Palette)
// 🧬 WAVE 560: Added consciousness categories
const LOG_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  // 🧬 CONSCIOUSNESS (WAVE 560)
  Hunt: { icon: '🎯', color: '#f97316', label: 'HUNT' },      // Orange - Stalking/Strike
  Brain: { icon: '🧠', color: '#fbbf24', label: 'BRAIN' },    // Amber - Predictions/Dreams
  Mode: { icon: '🎭', color: '#a855f7', label: 'MODE' },      // Purple - State changes
  
  // Audio Analysis
  Beat: { icon: '🥁', color: '#22c55e', label: 'BEAT' },
  Music: { icon: '🎵', color: '#06b6d4', label: 'MUSIC' },
  Genre: { icon: '🧬', color: '#ec4899', label: 'GENRE' },
  
  // Output
  Visual: { icon: '🎨', color: '#d946ef', label: 'VISUAL' },
  DMX: { icon: '💡', color: '#14b8a6', label: 'DMX' },
  
  // System
  System: { icon: '⚙️', color: '#64748b', label: 'SYSTEM' },
  Error: { icon: '💀', color: '#ef4444', label: 'ERROR' },
  Info: { icon: 'ℹ️', color: '#94a3b8', label: 'INFO' },
}

export const TacticalLog: React.FC = () => {
  // STORE
  const logs = useLogStore((state) => state.logs)
  const addLog = useLogStore((state) => state.addLog) // Necesitamos esto para inyectar
  const clearLogs = useLogStore((state) => state.clearLogs)
  
  // STATE
  const [activeFilter, setActiveFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const logEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // ---------------------------------------------------------------------------
  // 🔌 THE MISSING LINK: LISTENER DE EVENTOS
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // Definimos el handler
    const handleLog = (event: any, data: any) => {
      // Soporte para ambos formatos: (event, data) o (data) directo
      const payload = data || event 
      if (payload) {
        addLog(payload)
      }
    }

    // Suscribirse al canal IPC (Asumiendo que window.lux expone 'on' o 'onLog')
    // Ajusta esto según cómo expusiste el IPC en preload.ts
    let cleanup: (() => void) | undefined

    // Prefer the typed bridge method 'onLog' exposed in preload.ts
    const bridge = (window as any).lux
    if (bridge?.onLog) {
      // onLog returns an unsubscribe function per our preload contract
      cleanup = bridge.onLog((payload: any) => {
        // Normalize payload to expected store shape
        const normalized = {
          id: payload.id || `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
          timestamp: payload.timestamp || Date.now(),
          category: payload.category || payload.type || 'Info',
          message: payload.message || payload.text || String(payload),
          data: payload.data || payload.meta || null,
          level: payload.level || 'info'
        }
        handleLog(null, normalized)
      })
    } else {
      // Fallbacks for older bridge shapes
      const luxAny = bridge
      if (luxAny?.on) {
        // Generic ipc wrapper: on(channel, cb)
        cleanup = luxAny.on('lux:log', handleLog)
      } else if (luxAny?.events?.onLog) {
        cleanup = luxAny.events.onLog(handleLog)
      }
      // Fallback para debug si no hay backend conectado
      console.warn('[TacticalLog] No Backend connection found. Mocking logs...')
      /* Uncomment to test UI without backend:
      const interval = setInterval(() => {
        addLog({ 
          timestamp: Date.now(), 
          category: Math.random() > 0.5 ? 'Beat' : 'Brain', 
          message: 'Simulated log message for UI testing',
          level: 'info'
        })
      }, 2000)
      return () => clearInterval(interval)
      */
    }

    return () => {
      if (cleanup) cleanup()
    }
  }, [addLog])

  // ---------------------------------------------------------------------------
  // AUTO SCROLL LOGIC
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll, activeFilter])

  const handleScroll = () => {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    // Si el usuario sube un poco, desactivamos autoscroll
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
    if (autoScroll && !isAtBottom) setAutoScroll(false)
    if (!autoScroll && isAtBottom) setAutoScroll(true)
  }

  // ---------------------------------------------------------------------------
  // FILTERING
  // ---------------------------------------------------------------------------
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesType = activeFilter === 'ALL' || log.category === activeFilter
      const matchesSearch = !searchQuery || 
        log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.category.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesType && matchesSearch
    })
  }, [logs, activeFilter, searchQuery])

  // Helpers
  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`
  }

  const exportLogs = () => {
    const text = logs.map(l => `[${new Date(l.timestamp).toISOString()}] [${l.category}] ${l.message}`).join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `selene_logs_${Date.now()}.txt`
    a.click()
  }

  return (
    <div className="tactical-console">
      
      {/* TOOLBAR SUPERIOR */}
      <div className="console-toolbar">
        <div className="toolbar-group">
          <div className="search-wrapper">
            <Search size={14} className="search-icon"/>
            <input 
              type="text" 
              placeholder="SEARCH STREAM..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="filter-scroll">
            {Object.keys(LOG_CONFIG).slice(0, 6).map(key => (
              <button 
                key={key}
                className={`filter-chip ${activeFilter === key ? 'active' : ''}`}
                onClick={() => setActiveFilter(activeFilter === key ? 'ALL' : key)}
                style={{ '--chip-color': LOG_CONFIG[key].color } as any}
              >
                {LOG_CONFIG[key].label}
              </button>
            ))}
          </div>
        </div>

        <div className="toolbar-group actions">
          <button 
            className={`icon-btn ${autoScroll ? 'active' : ''}`} 
            onClick={() => setAutoScroll(!autoScroll)}
            title={autoScroll ? "Pause Scroll" : "Resume Scroll"}
          >
            {autoScroll ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button className="icon-btn" onClick={exportLogs} title="Export Logs">
            <Download size={16} />
          </button>
          <button className="icon-btn danger" onClick={clearLogs} title="Clear Terminal">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* LOG STREAM AREA */}
      <div 
        className="console-stream" 
        ref={containerRef}
        onScroll={handleScroll}
      >
        {filteredLogs.length === 0 ? (
          <div className="stream-empty">
            <Terminal size={48} />
            <span>WAITING FOR DATA LINK...</span>
            <small>System ready. Listening for Selene events.</small>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const cfg = LOG_CONFIG[log.category] || LOG_CONFIG.Info
            return (
              <div key={log.id} className="log-line">
                <span className="log-time">{formatTime(log.timestamp)}</span>
                <span className="log-cat" style={{ color: cfg.color }}>
                  {cfg.icon} {cfg.label}
                </span>
                <span className="log-msg">{log.message}</span>
                {log.data && (
                  <span className="log-meta">
                    {JSON.stringify(log.data).slice(0, 50)}
                    {JSON.stringify(log.data).length > 50 ? '...' : ''}
                  </span>
                )}
              </div>
            )
          })
        )}
        <div ref={logEndRef} />
      </div>
      
      {/* STATUS FOOTER */}
      <div className="console-footer">
        <span>BUFFER: {logs.length} / 1000</span>
        <span>STATUS: {autoScroll ? 'LIVE' : 'PAUSED'}</span>
        <span>FILTER: {activeFilter}</span>
      </div>
    </div>
  )
}
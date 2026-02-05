/**
 * 📜 NEURAL STREAM LOG - WAVE 1167
 * 
 * Log en streaming con:
 * - 12 categorías con iconos custom
 * - Timestamps relativos ("5s ago")
 * - Auto-scroll con pause
 * - Filtro por categoría
 * - Limpieza de logs
 */

import { memo, useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useLogStore, selectFilteredLogs } from '../../../stores/logStore'
import { StreamLogIcon, LiveDotIcon } from '../../icons/LuxIcons'
import { LogEntry } from './LogEntry'
import './NeuralStreamLog.css'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const MAX_VISIBLE_LOGS = 50
const TIME_UPDATE_INTERVAL = 1000 // Update relative times every second

const CATEGORY_FILTERS = [
  { key: 'all', label: 'ALL' },
  { key: 'brain', label: '🧠' },
  { key: 'dream', label: '💭' },
  { key: 'strike', label: '⚡' },
  { key: 'beat', label: '🥁' },
  { key: 'drop', label: '💥' },
  { key: 'effect', label: '✨' },
  { key: 'color', label: '🎨' },
  { key: 'system', label: '⚙️' },
]

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const NeuralStreamLog = memo(() => {
  // Store
  const logs = useLogStore(selectFilteredLogs)
  const clearLogs = useLogStore((state) => state.clearLogs)
  const setFilter = useLogStore((state) => state.setFilter)
  const activeFilters = useLogStore((state) => state.activeFilters)
  
  // Local state
  const [isPaused, setIsPaused] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [now, setNow] = useState(Date.now())
  
  // Refs
  const scrollRef = useRef<HTMLDivElement>(null)
  const isUserScrolling = useRef(false)
  
  // Update "now" every second for relative timestamps
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now())
    }, TIME_UPDATE_INTERVAL)
    return () => clearInterval(interval)
  }, [])
  
  // Auto-scroll to bottom on new logs (if not paused)
  useEffect(() => {
    if (!isPaused && scrollRef.current && !isUserScrolling.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs, isPaused])
  
  // Detect user scroll
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
    
    // If user scrolled up, pause auto-scroll
    if (!isAtBottom) {
      isUserScrolling.current = true
    } else {
      isUserScrolling.current = false
    }
  }, [])
  
  // Filter by category
  const handleCategoryFilter = useCallback((category: string) => {
    setActiveCategory(category)
    
    if (category === 'all') {
      // Clear all filters
      CATEGORY_FILTERS.slice(1).forEach(f => setFilter(f.key, false))
    } else {
      // Set only this category
      CATEGORY_FILTERS.slice(1).forEach(f => setFilter(f.key, f.key === category))
    }
  }, [setFilter])
  
  // Filtered and sliced logs
  const visibleLogs = useMemo(() => {
    let filtered = logs
    
    if (activeCategory !== 'all') {
      filtered = logs.filter(log => 
        log.category.toLowerCase().includes(activeCategory)
      )
    }
    
    return filtered.slice(0, MAX_VISIBLE_LOGS)
  }, [logs, activeCategory])
  
  // Toggle pause
  const togglePause = useCallback(() => {
    setIsPaused(p => !p)
    isUserScrolling.current = false
  }, [])
  
  return (
    <div className="neural-card neural-stream-log">
      {/* Header */}
      <div className="neural-card__header neural-stream-log__header">
        <StreamLogIcon size={14} color="var(--accent-secondary)" />
        <span>NEURAL STREAM</span>
        
        {/* Live indicator */}
        <div className={`neural-stream-log__status ${isPaused ? 'neural-stream-log__status--paused' : ''}`}>
          <LiveDotIcon size={8} color={isPaused ? 'var(--text-muted)' : 'var(--accent-success)'} />
          <span>{isPaused ? 'PAUSED' : 'LIVE'}</span>
        </div>
        
        {/* Actions */}
        <div className="neural-stream-log__actions">
          <button
            className="neural-stream-log__btn"
            onClick={togglePause}
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? '▶' : '⏸'}
          </button>
          <button
            className="neural-stream-log__btn neural-stream-log__btn--danger"
            onClick={clearLogs}
            title="Clear logs"
          >
            🗑️
          </button>
        </div>
      </div>
      
      {/* Category Filters */}
      <div className="neural-stream-log__filters">
        {CATEGORY_FILTERS.map(filter => (
          <button
            key={filter.key}
            className={`neural-stream-log__filter ${activeCategory === filter.key ? 'neural-stream-log__filter--active' : ''}`}
            onClick={() => handleCategoryFilter(filter.key)}
          >
            {filter.label}
          </button>
        ))}
      </div>
      
      {/* Log Stream */}
      <div 
        className="neural-stream-log__scroll"
        ref={scrollRef}
        onScroll={handleScroll}
      >
        {visibleLogs.length === 0 ? (
          <div className="neural-stream-log__empty">
            <span>📜</span>
            <span>Waiting for neural activity...</span>
          </div>
        ) : (
          visibleLogs.map(entry => (
            <LogEntry 
              key={entry.id} 
              entry={entry} 
              now={now}
            />
          ))
        )}
      </div>
      
      {/* Footer: Log count */}
      <div className="neural-stream-log__footer">
        <span>{logs.length} entries</span>
        {activeCategory !== 'all' && (
          <span className="neural-stream-log__filter-label">
            filtered: {activeCategory}
          </span>
        )}
      </div>
    </div>
  )
})

NeuralStreamLog.displayName = 'NeuralStreamLog'

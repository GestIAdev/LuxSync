/**
 * 📜 NEURAL STREAM LOG - WAVE 1197: THE WAR LOG
 * 
 * Log táctico fullscreen con:
 * - Filtros tipo "Nave Espacial" con LuxIcons 32px
 * - Log Humanizer: traduce logs técnicos a lenguaje táctico
 * - Virtual scroll: solo renderiza últimas 100 entradas
 * - Sticky header para filtros
 * - Auto-scroll con pause
 */

import { memo, useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useLogStore, selectFilteredLogs } from '../../../stores/logStore'
import { 
  StreamLogIcon, 
  LiveDotIcon,
  SpectrumBarsIcon,
  BrainNeuralIcon,
  OracleEyeIcon,
  DreamCloudIcon,
  ShieldCheckIcon,
  LightningStrikeIcon,
} from '../../icons/LuxIcons'
import './NeuralStreamLog.css'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const MAX_VISIBLE_LOGS = 100
const TIME_UPDATE_INTERVAL = 1000

// ═══════════════════════════════════════════════════════════════════════════
// FILTER CATEGORIES - Spaceship Style
// ═══════════════════════════════════════════════════════════════════════════

interface FilterConfig {
  key: string
  label: string
  icon: React.ComponentType<{ size?: number; color?: string }>
  color: string
  categories: string[] // Backend categories that match this filter
}

const FILTER_CONFIG: FilterConfig[] = [
  { 
    key: 'all', 
    label: 'ALL', 
    icon: StreamLogIcon, 
    color: 'var(--text-secondary)',
    categories: []
  },
  { 
    key: 'sensory', 
    label: 'SENSORY', 
    icon: SpectrumBarsIcon, 
    color: '#22d3ee', // Cyan
    categories: ['music', 'beat', 'genre', 'audio', 'spectrum', 'bpm']
  },
  { 
    key: 'consciousness', 
    label: 'BRAIN', 
    icon: BrainNeuralIcon, 
    color: '#a78bfa', // Violet
    categories: ['brain', 'hunt', 'ai', 'consciousness', 'state']
  },
  { 
    key: 'prediction', 
    label: 'ORACLE', 
    icon: OracleEyeIcon, 
    color: '#67e8f9', // Light cyan
    categories: ['prediction', 'cassandra', 'oracle', 'prebuffer', 'forecast']
  },
  { 
    key: 'dream', 
    label: 'DREAM', 
    icon: DreamCloudIcon, 
    color: '#c084fc', // Purple
    categories: ['dream', 'effect', 'strike', 'drop', 'color', 'visual']
  },
  { 
    key: 'ethics', 
    label: 'ETHICS', 
    icon: ShieldCheckIcon, 
    color: '#fb923c', // Orange
    categories: ['ethics', 'block', 'fatigue', 'protection', 'intervention']
  },
  { 
    key: 'system', 
    label: 'SYSTEM', 
    icon: LightningStrikeIcon, 
    color: '#94a3b8', // Slate
    categories: ['system', 'dmx', 'error', 'info', 'mode', 'startup']
  },
]

// ═══════════════════════════════════════════════════════════════════════════
// LOG HUMANIZER - Translate Tech to Tactical
// ═══════════════════════════════════════════════════════════════════════════

interface HumanizedLog {
  message: string
  category: string
  style: 'cassandra' | 'ethics' | 'divine' | 'dream' | 'system' | 'default'
}

function humanizeLog(rawCategory: string, rawMessage: string): HumanizedLog {
  const catLower = rawCategory.toLowerCase()
  const msgLower = rawMessage.toLowerCase()
  
  // 🔮 CASSANDRA / PREDICTION
  if (catLower.includes('prediction') || catLower.includes('cassandra') || 
      msgLower.includes('cassandra') || msgLower.includes('prebuffer') ||
      msgLower.includes('pre-buffer') || msgLower.includes('forecast')) {
    
    // Extract effect name and confidence if present
    const effectMatch = rawMessage.match(/["']([^"']+)["']/i) || rawMessage.match(/effect[:\s]+(\w+)/i)
    const confMatch = rawMessage.match(/(\d+)%/) || rawMessage.match(/confidence[:\s]+([\d.]+)/i)
    
    const effectName = effectMatch ? effectMatch[1] : 'Effect'
    const confidence = confMatch ? confMatch[1] : '??'
    
    if (msgLower.includes('armed') || msgLower.includes('buffer') || msgLower.includes('waiting')) {
      return {
        message: `PRE-ARMED: ${effectName} (Confidence: ${confidence}%) - Waiting for moment`,
        category: 'ORACLE',
        style: 'cassandra'
      }
    }
    
    if (msgLower.includes('fired') || msgLower.includes('executed') || msgLower.includes('launch')) {
      return {
        message: `LAUNCHED: ${effectName} fired from prediction buffer`,
        category: 'ORACLE',
        style: 'cassandra'
      }
    }
    
    return {
      message: `FORECAST: ${rawMessage.replace(/\[.*?\]/g, '').trim()}`,
      category: 'ORACLE',
      style: 'cassandra'
    }
  }
  
  // 🛡️ ETHICS / BLOCK
  if (catLower.includes('ethics') || catLower.includes('block') || 
      msgLower.includes('blocked') || msgLower.includes('fatigue') ||
      msgLower.includes('protection') || msgLower.includes('cooldown')) {
    
    // Extract reason
    let reason = 'visual fatigue protection'
    if (msgLower.includes('fatigue')) reason = 'visual fatigue protection'
    else if (msgLower.includes('cooldown')) reason = 'effect cooldown active'
    else if (msgLower.includes('frequency')) reason = 'frequency limit reached'
    else if (msgLower.includes('energy')) reason = 'energy insufficient'
    
    const effectMatch = rawMessage.match(/["']([^"']+)["']/) || rawMessage.match(/(\w+)\s+blocked/i)
    const effectName = effectMatch ? effectMatch[1] : 'Effect'
    
    return {
      message: `INTERVENTION: ${effectName} blocked - ${reason}`,
      category: 'ETHICS',
      style: 'ethics'
    }
  }
  
  // ⚡ DIVINE MOMENT / Z-SCORE
  if (msgLower.includes('divine') || msgLower.includes('z-score') || 
      msgLower.includes('z=') || msgLower.includes('zscore')) {
    
    const zMatch = rawMessage.match(/z[=:\s]*([\d.]+)/i)
    const zScore = zMatch ? zMatch[1] : '?'
    
    return {
      message: `⚡ DIVINE INTERVENTION (Z-Score ${zScore}σ) - Firing Arsenal`,
      category: 'DIVINE',
      style: 'divine'
    }
  }
  
  // 💭 DREAM / EFFECT SELECTION
  if (catLower.includes('dream') || catLower.includes('effect') || catLower.includes('strike')) {
    
    if (msgLower.includes('insufficient') || msgLower.includes('worthiness') || 
        msgLower.includes('rejected') || msgLower.includes('not worthy')) {
      return {
        message: `HOLD: Music energy insufficient for effect`,
        category: 'DREAM',
        style: 'dream'
      }
    }
    
    if (msgLower.includes('selected') || msgLower.includes('chosen') || msgLower.includes('cast')) {
      const effectMatch = rawMessage.match(/["']([^"']+)["']/) || rawMessage.match(/selected[:\s]+(\w+)/i)
      const effectName = effectMatch ? effectMatch[1] : 'Effect'
      return {
        message: `CASTING: ${effectName} selected for deployment`,
        category: 'DREAM',
        style: 'dream'
      }
    }
    
    if (msgLower.includes('drop') || msgLower.includes('impact')) {
      return {
        message: `💥 DROP DETECTED - Deploying arsenal`,
        category: 'DREAM',
        style: 'divine'
      }
    }
    
    return {
      message: rawMessage.replace(/\[.*?\]/g, '').trim(),
      category: 'DREAM',
      style: 'dream'
    }
  }
  
  // 🧠 BRAIN / HUNT STATE
  if (catLower.includes('brain') || catLower.includes('hunt') || catLower.includes('state')) {
    
    if (msgLower.includes('stalking') || msgLower.includes('hunting')) {
      return {
        message: `HUNT MODE: Actively searching for targets`,
        category: 'BRAIN',
        style: 'default'
      }
    }
    
    if (msgLower.includes('resting') || msgLower.includes('idle') || msgLower.includes('waiting')) {
      return {
        message: `REST MODE: Conserving energy, waiting for music`,
        category: 'BRAIN',
        style: 'default'
      }
    }
    
    return {
      message: rawMessage.replace(/\[.*?\]/g, '').trim(),
      category: 'BRAIN',
      style: 'default'
    }
  }
  
  // 🎵 SENSORY / AUDIO
  if (catLower.includes('music') || catLower.includes('beat') || 
      catLower.includes('audio') || catLower.includes('bpm')) {
    
    if (msgLower.includes('beat')) {
      const bpmMatch = rawMessage.match(/(\d+)\s*bpm/i)
      const bpm = bpmMatch ? bpmMatch[1] : '???'
      return {
        message: `PULSE: Beat detected @ ${bpm} BPM`,
        category: 'SENSORY',
        style: 'default'
      }
    }
    
    return {
      message: rawMessage.replace(/\[.*?\]/g, '').trim(),
      category: 'SENSORY',
      style: 'default'
    }
  }
  
  // ⚙️ SYSTEM / DEFAULT
  return {
    message: rawMessage.replace(/\[.*?\]/g, '').trim(),
    category: catLower.includes('error') ? 'ERROR' : 'SYSTEM',
    style: catLower.includes('error') ? 'ethics' : 'system'
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function formatRelativeTime(timestamp: number, now: number): string {
  const diff = now - timestamp
  if (diff < 1000) return 'now'
  if (diff < 60000) return `${Math.floor(diff / 1000)}s`
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
  return `${Math.floor(diff / 3600000)}h`
}

function getCategoryStyle(style: HumanizedLog['style']): React.CSSProperties {
  switch (style) {
    case 'cassandra':
      return { color: '#22d3ee' } // Cyan
    case 'ethics':
      return { color: '#fb923c' } // Orange
    case 'divine':
      return { color: '#fbbf24', fontWeight: 600 } // Gold
    case 'dream':
      return { color: '#94a3b8' } // Muted gray
    case 'system':
      return { color: '#64748b' }
    default:
      return { color: 'var(--text-secondary)' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const NeuralStreamLog = memo(() => {
  // Store
  const logs = useLogStore(selectFilteredLogs)
  const clearLogs = useLogStore((state) => state.clearLogs)
  
  // Local state
  const [isPaused, setIsPaused] = useState(false)
  const [activeFilter, setActiveFilter] = useState<string>('all')
  
  // WAVE 2097.1: Imperative time ref — NO re-renders every second.
  // Timestamps update only when new logs arrive (logs.length changes)
  // or when the user changes filter. The ref always holds a fresh "now".
  const nowRef = useRef(Date.now())
  
  // Keep nowRef fresh (runs silently, no state change, no re-render)
  useEffect(() => {
    const interval = setInterval(() => {
      nowRef.current = Date.now()
    }, TIME_UPDATE_INTERVAL)
    return () => clearInterval(interval)
  }, [])
  
  // Snapshot "now" for render — recalculated only when logs or filter change
  const now = useMemo(() => {
    nowRef.current = Date.now()
    return nowRef.current
  }, [logs, activeFilter])
  
  // Refs
  const scrollRef = useRef<HTMLDivElement>(null)
  const isUserScrolling = useRef(false)
  
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
    isUserScrolling.current = !isAtBottom
  }, [])
  
  // Filter and slice logs
  const visibleLogs = useMemo(() => {
    let filtered = logs
    
    if (activeFilter !== 'all') {
      const filterConfig = FILTER_CONFIG.find(f => f.key === activeFilter)
      if (filterConfig) {
        filtered = logs.filter(log => {
          const catLower = log.category.toLowerCase()
          const msgLower = log.message.toLowerCase()
          return filterConfig.categories.some(cat => 
            catLower.includes(cat) || msgLower.includes(cat)
          )
        })
      }
    }
    
    return filtered.slice(0, MAX_VISIBLE_LOGS)
  }, [logs, activeFilter])
  
  // Toggle pause
  const togglePause = useCallback(() => {
    setIsPaused(p => !p)
    isUserScrolling.current = false
  }, [])
  
  // Resume and scroll to bottom
  const resumeAndScroll = useCallback(() => {
    setIsPaused(false)
    isUserScrolling.current = false
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])
  
  return (
    <div className="war-log">
      {/* ═══════════════════════════════════════════════════════════════════
          STICKY HEADER
          ═══════════════════════════════════════════════════════════════════ */}
      <header className="war-log__header">
        <div className="war-log__title-row">
          <StreamLogIcon size={20} color="var(--accent-secondary)" />
          <h2 className="war-log__title">WAR LOG</h2>
          
          {/* Status */}
          <div className={`war-log__status ${isPaused ? 'war-log__status--paused' : ''}`}>
            <LiveDotIcon size={10} color={isPaused ? 'var(--text-muted)' : 'var(--accent-success)'} />
            <span>{isPaused ? 'PAUSED' : 'LIVE'}</span>
          </div>
          
          {/* Actions */}
          <div className="war-log__actions">
            <button
              className="war-log__btn"
              onClick={togglePause}
              title={isPaused ? 'Resume' : 'Pause'}
            >
              {isPaused ? '▶' : '⏸'}
            </button>
            <button
              className="war-log__btn war-log__btn--danger"
              onClick={clearLogs}
              title="Clear logs"
            >
              ✕
            </button>
          </div>
        </div>
        
        {/* ═══════════════════════════════════════════════════════════════════
            SPACESHIP FILTERS
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="war-log__filters">
          {FILTER_CONFIG.map(filter => {
            const IconComponent = filter.icon
            const isActive = activeFilter === filter.key
            return (
              <button
                key={filter.key}
                className={`war-log__filter ${isActive ? 'war-log__filter--active' : ''}`}
                onClick={() => setActiveFilter(filter.key)}
                style={{
                  '--filter-color': filter.color,
                } as React.CSSProperties}
              >
                <IconComponent 
                  size={24} 
                  color={isActive ? filter.color : 'var(--text-muted)'} 
                />
                <span className="war-log__filter-label">{filter.label}</span>
              </button>
            )
          })}
        </div>
      </header>
      
      {/* ═══════════════════════════════════════════════════════════════════
          LOG STREAM
          ═══════════════════════════════════════════════════════════════════ */}
      <div 
        className="war-log__scroll"
        ref={scrollRef}
        onScroll={handleScroll}
      >
        {visibleLogs.length === 0 ? (
          <div className="war-log__empty">
            <BrainNeuralIcon size={48} color="var(--text-muted)" />
            <span>Awaiting tactical data...</span>
          </div>
        ) : (
          visibleLogs.map(entry => {
            const humanized = humanizeLog(entry.category, entry.message)
            const style = getCategoryStyle(humanized.style)
            
            return (
              <div 
                key={entry.id} 
                className={`war-log__entry war-log__entry--${humanized.style}`}
              >
                {/* Timestamp */}
                <span className="war-log__time">
                  {formatRelativeTime(entry.timestamp, now)}
                </span>
                
                {/* Category Badge */}
                <span 
                  className="war-log__category"
                  style={{ color: style.color }}
                >
                  {humanized.category}
                </span>
                
                {/* Humanized Message */}
                <span 
                  className="war-log__message"
                  style={style}
                >
                  {humanized.message}
                </span>
              </div>
            )
          })
        )}
      </div>
      
      {/* ═══════════════════════════════════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════════════════════════════════ */}
      <footer className="war-log__footer">
        <span>{logs.length} entries</span>
        {activeFilter !== 'all' && (
          <span className="war-log__filter-active">
            {FILTER_CONFIG.find(f => f.key === activeFilter)?.label}
          </span>
        )}
        {isPaused && (
          <button className="war-log__resume" onClick={resumeAndScroll}>
            ↓ Resume Live
          </button>
        )}
      </footer>
    </div>
  )
})

NeuralStreamLog.displayName = 'NeuralStreamLog'

export { NeuralStreamLog as default }

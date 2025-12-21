/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧠 SELENE BRAIN - WAVE 35.3/35.4: Real Event Logging
 * Terminal-style display showing REAL AI logs from logStore
 * 
 * Filtered feed for DJ-facing dashboard:
 * ✅ MUSIC, MOOD, BRAIN, VISUAL, MODE, BEAT, GENRE
 * ❌ SYSTEM, DEBUG, NETWORK, ERROR (hidden unless critical)
 * 
 * 🎛️ WAVE 62: Added VibeSelector for context switching
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useEffect, useRef, useMemo } from 'react'
import { 
  useTruthStore, 
  selectCognitive, 
  selectSection,
  selectMode
} from '../../../../stores/truthStore'
import { useLogStore, selectLogs, LogEntry } from '../../../../stores/logStore'
import { useControlStore } from '../../../../stores/controlStore'
import { VibeSelector } from './VibeSelector'
import './SeleneBrain.css'

// Categories to show in Dashboard (DJ-facing, narrative flow)
const DJ_CATEGORIES = new Set([
  'Music',
  'Mood', 
  'Brain',
  'Visual',
  'Mode',
  'Beat',
  'Genre',
  'DMX',    // Hardware status is useful
])

// Category color map for terminal styling
const CATEGORY_COLORS: Record<string, string> = {
  Music: '#00ffff',  // Cyan
  Mood: '#ff00ff',   // Magenta
  Brain: '#a855f7',  // Purple
  Visual: '#22d3ee', // Light cyan
  Mode: '#f59e0b',   // Amber
  Beat: '#10b981',   // Green
  Genre: '#ec4899',  // Pink
  DMX: '#3b82f6',    // Blue
}

export const SeleneBrain: React.FC<{ className?: string }> = ({ className = '' }) => {
  const terminalRef = useRef<HTMLDivElement>(null)
  
  // REAL LOGS from logStore (same source as System Logs view)
  const allLogs = useLogStore(selectLogs)
  
  // TruthStore for AI state display
  const cognitive = useTruthStore(selectCognitive)
  const section = useTruthStore(selectSection)
  const truthMode = useTruthStore(selectMode)
  const globalMode = useControlStore(state => state.globalMode)
  
  // Real data from truth store
  const mood = cognitive?.mood?.toUpperCase?.() || 'ANALYZING'
  const confidence = 75 // Confidence not yet in truthStore schema
  const currentSection = section?.current || 'verse'
  const lastTrigger = `Section: ${currentSection}`
  
  // Filter logs for DJ-facing narrative (only DJ_CATEGORIES)
  const filteredLogs = useMemo(() => {
    return allLogs
      .filter(log => DJ_CATEGORIES.has(log.category))
      .slice(0, 20) // Show last 20 relevant logs
  }, [allLogs])
  
  // Auto-scroll terminal when new logs arrive
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [filteredLogs])
  
  // Format timestamp for display
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { hour12: false })
  }
  
  // Get category color
  const getCategoryColor = (category: string): string => {
    return CATEGORY_COLORS[category] || '#888888'
  }
  
  return (
    <div className={`selene-brain ${className}`}>
      {/* Stats Row */}
      <div className="brain-stats">
        <div className="stat-item">
          <span className="stat-label">CONFIDENCE</span>
          <span className="stat-value">{Math.round(confidence)}%</span>
          <div className="stat-bar">
            <div className="stat-fill" style={{ width: `${confidence}%` }} />
          </div>
        </div>
        <div className="stat-item">
          <span className="stat-label">MOOD</span>
          <span className="stat-value mood">{mood}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">LAST TRIGGER</span>
          <span className="stat-value trigger">{lastTrigger}</span>
        </div>
      </div>
      
      {/* 🎛️ WAVE 62: Vibe Context Selector */}
      <VibeSelector />
      
      {/* Terminal - Real Logs */}
      <div className="brain-terminal" ref={terminalRef}>
        {filteredLogs.length === 0 ? (
          <div className="terminal-line waiting">
            <span className="terminal-time">[--:--:--]</span>
            <span className="terminal-type">WAIT</span>
            <span className="terminal-msg">Awaiting system events...</span>
          </div>
        ) : (
          filteredLogs.map(log => (
            <div 
              key={log.id} 
              className={`terminal-line category-${log.category.toLowerCase()}`}
            >
              <span className="terminal-time">[{formatTime(log.timestamp)}]</span>
              <span 
                className="terminal-type" 
                style={{ color: getCategoryColor(log.category) }}
              >
                {log.category.toUpperCase()}
              </span>
              <span className="terminal-msg">{log.message}</span>
            </div>
          ))
        )}
        
        {/* Blinking cursor for active feel */}
        <div className="terminal-cursor-line">
          <span className="cursor">▊</span>
        </div>
      </div>
    </div>
  )
}

export default SeleneBrain

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎭 MOOD TOGGLE - WAVE 700.4: THE COCKPIT REDESIGN
 * Manual mood preference control - CALM / BALANCED / PUNK
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Este componente conecta directamente con MoodController.
 * Controla la "actitud" de los efectos - qué tan agresivos o calmados.
 * 
 * Hierarchy: Vibe Shield (Constitution) > Mood > Effect Selector
 * 
 * @module components/commandDeck/MoodToggle
 * @version 700.4
 */

import React, { useState, useEffect, useCallback } from 'react'
import { MoodController, MoodId } from '../../core/mood'
import './MoodToggle.css'

// ═══════════════════════════════════════════════════════════════════════════
// SVG ICONS - Custom mood icons
// ═══════════════════════════════════════════════════════════════════════════

/** 🧘 Yoga/Meditation Pose - CALM */
const IconCalm: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    className={className} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2"
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    {/* Head */}
    <circle cx="12" cy="4" r="2" />
    {/* Body */}
    <path d="M12 6v6" />
    {/* Arms extended in meditation */}
    <path d="M4 12h4c1 0 2-1 4-1s3 1 4 1h4" />
    {/* Legs crossed */}
    <path d="M8 18c0-2 2-4 4-4s4 2 4 4" />
    <path d="M6 20h4" />
    <path d="M14 20h4" />
  </svg>
)

/** ⚖️ Balance Scale - BALANCED */
const IconBalanced: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    className={className} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2"
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    {/* Center pillar */}
    <path d="M12 3v18" />
    {/* Base */}
    <path d="M8 21h8" />
    {/* Horizontal beam */}
    <path d="M4 8h16" />
    {/* Left pan */}
    <path d="M4 8l2 6h-4l2-6" />
    <ellipse cx="4" cy="14" rx="3" ry="1" />
    {/* Right pan */}
    <path d="M20 8l2 6h-4l2-6" />
    <ellipse cx="20" cy="14" rx="3" ry="1" />
    {/* Fulcrum */}
    <circle cx="12" cy="6" r="2" />
  </svg>
)

/** 🤘 Rock Hand / Mano Cornuta - PUNK */
const IconPunk: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    className={className} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2"
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    {/* Index finger up */}
    <path d="M8 12V4c0-1 1-2 2-2s2 1 2 2v4" />
    {/* Pinky up */}
    <path d="M16 12V6c0-1 1-2 2-2s2 1 2 2v6" />
    {/* Palm */}
    <path d="M4 14v-2c0-1 1-2 2-2h12c1 0 2 1 2 2v2" />
    {/* Middle and ring fingers folded */}
    <path d="M10 12v2c0 1-1 2-2 2" />
    <path d="M14 12v2c0 1 1 2 2 2" />
    {/* Thumb */}
    <path d="M4 14c0 4 3 7 8 7s8-3 8-7" />
  </svg>
)

// ═══════════════════════════════════════════════════════════════════════════
// MOOD CONFIG
// ═══════════════════════════════════════════════════════════════════════════

interface MoodConfig {
  id: MoodId
  label: string
  icon: React.FC<{ className?: string }>
  color: string
  colorRgb: string // For rgba usage
  description: string
}

const MOOD_CONFIGS: MoodConfig[] = [
  {
    id: 'calm',
    label: 'CALM',
    icon: IconCalm,
    color: '#00CED1', // Dark Cyan
    colorRgb: '0, 206, 209',
    description: 'Efectos sutiles, transiciones suaves',
  },
  {
    id: 'balanced',
    label: 'BALANCED',
    icon: IconBalanced,
    color: '#4169E1', // Royal Blue
    colorRgb: '65, 105, 225',
    description: 'Mezcla equilibrada de efectos',
  },
  {
    id: 'punk',
    label: 'PUNK',
    icon: IconPunk,
    color: '#FF1493', // Deep Pink / Magenta
    colorRgb: '255, 20, 147',
    description: 'Efectos agresivos, sin límites',
  },
]

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export interface MoodToggleProps {
  compact?: boolean
  className?: string
}

export const MoodToggle: React.FC<MoodToggleProps> = ({
  compact = false,
  className = '',
}) => {
  const [currentMood, setCurrentMood] = useState<MoodId>(() => 
    MoodController.getInstance().getCurrentMood()
  )
  
  // Subscribe to mood changes (in case something else changes it)
  useEffect(() => {
    const controller = MoodController.getInstance()
    const unsubscribe = controller.subscribe((mood) => {
      setCurrentMood(mood)
    })
    return () => unsubscribe()
  }, [])
  
  // Handle mood selection
  const handleMoodSelect = useCallback((moodId: MoodId) => {
    const controller = MoodController.getInstance()
    controller.setMood(moodId)
    setCurrentMood(moodId)
    
    // 🎭 WAVE 700.5.4: Notify backend via IPC
    console.log('[MoodToggle] 🔌 Checking IPC availability:', !!window.lux?.mood?.setMood)
    if (window.lux?.mood?.setMood) {
      console.log('[MoodToggle] 🔌 Calling IPC lux:setMood:', moodId)
      window.lux.mood.setMood(moodId)
        .then((result) => console.log('[MoodToggle] 🔌 IPC Response:', result))
        .catch((err: Error) => console.error('[MoodToggle] ❌ IPC Failed:', err))
    } else {
      console.warn('[MoodToggle] ⚠️ window.lux.mood.setMood NOT AVAILABLE!')
    }
    
    // Visual feedback
    console.log(`[MoodToggle] 🎭 Mood changed to: ${moodId.toUpperCase()}`)
  }, [])
  
  const currentConfig = MOOD_CONFIGS.find(m => m.id === currentMood) || MOOD_CONFIGS[1]
  
  return (
    <div className={`mood-toggle ${compact ? 'compact' : ''} ${className}`}>
      <div className="mood-toggle-label">MOOD</div>
      
      <div className="mood-toggle-buttons">
        {MOOD_CONFIGS.map((config) => {
          const Icon = config.icon
          const isActive = currentMood === config.id
          
          return (
            <button
              key={config.id}
              className={`mood-btn ${isActive ? 'active' : ''}`}
              onClick={() => handleMoodSelect(config.id)}
              title={`${config.label}: ${config.description}`}
              style={{
                '--mood-color': config.color,
                '--mood-color-rgb': config.colorRgb,
              } as React.CSSProperties}
            >
              <Icon className="mood-icon" />
              {!compact && <span className="mood-label">{config.label}</span>}
            </button>
          )
        })}
      </div>
      
      {/* Active indicator bar */}
      <div 
        className="mood-active-bar"
        style={{ backgroundColor: currentConfig.color }}
      />
    </div>
  )
}

export default MoodToggle

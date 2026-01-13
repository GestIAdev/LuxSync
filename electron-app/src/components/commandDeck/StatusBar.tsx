/**
 * 📊 STATUS BAR - WAVE 375
 * Shows BPM, Energy, and Mood
 */

import React from 'react'
import './CommandDeck.css'

interface StatusBarProps {
  bpm: number
  energy: number  // 0-1
  onBeat: boolean
}

// Mood config based on energy level
const getMood = (energy: number): { label: string; emoji: string; color: string } => {
  if (energy > 0.8) return { label: 'FIRE', emoji: '🔥', color: '#FF4444' }
  if (energy > 0.6) return { label: 'ENERGY', emoji: '⚡', color: '#FFAA00' }
  if (energy > 0.4) return { label: 'VIBE', emoji: '🌊', color: '#4ADE80' }
  return { label: 'CHILL', emoji: '😌', color: '#4ECDC4' }
}

export const StatusBar: React.FC<StatusBarProps> = ({
  bpm,
  energy,
  onBeat
}) => {
  const mood = getMood(energy)
  const energyPercent = Math.round(energy * 100)
  
  return (
    <div className="status-bar">
      {/* BPM Display */}
      <div className="status-bpm">
        <span className="status-label">BPM</span>
        <span className="status-value bpm-value">
          {bpm > 0 ? bpm.toFixed(0) : '--'}
        </span>
        <span className={`beat-dot ${onBeat ? 'pulse' : ''}`} />
      </div>
      
      {/* Energy Bar */}
      <div className="status-energy">
        <span className="status-label">ENERGY</span>
        <div className="energy-bar">
          <div 
            className="energy-fill"
            style={{ 
              width: `${energyPercent}%`,
              backgroundColor: mood.color
            }}
          />
        </div>
        <span className="energy-value">{energyPercent}%</span>
      </div>
      
      {/* Mood Indicator */}
      <div className="status-mood" style={{ color: mood.color }}>
        <span className="mood-emoji">{mood.emoji}</span>
        <span className="mood-label">{mood.label}</span>
      </div>
    </div>
  )
}

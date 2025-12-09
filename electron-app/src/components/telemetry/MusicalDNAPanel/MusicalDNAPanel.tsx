/**
 * 🧬 MUSICAL DNA PANEL
 * WAVE 14: Real-time musical analysis display
 * 
 * Shows:
 * - Key & Mode (with description)
 * - Mood
 * - Zodiac element/sign
 * - Section type
 * - Genre (primary/secondary)
 * - Syncopation level
 */

import React from 'react'
import { useTelemetryStore, type MusicalDNATelemetry } from '../../../stores/telemetryStore'
import './MusicalDNAPanel.css'

const MusicalDNAPanel: React.FC = () => {
  const dna = useTelemetryStore((state) => state.dna)
  const connected = useTelemetryStore((state) => state.connected)
  
  // Default values
  const data: MusicalDNATelemetry = dna || {
    key: null,
    mode: 'major',
    modeDescription: 'Desconocido',
    mood: 'neutral',
    zodiac: { element: 'earth', position: 0, sign: 'Taurus', symbol: '♉' },
    section: { type: 'unknown', confidence: 0, estimatedDuration: 0 },
    rhythm: { bpm: 120, bpmConfidence: 0, syncopation: 0 },
    genre: { primary: 'unknown', secondary: null, confidence: 0 },
    energy: 0,
    energyTrend: 'stable',
  }
  
  // 🔧 WAVE 14.6: Guardianes contra NaN y undefined - RESCUE DIRECTIVE
  const sectionConfidence = (data.section && !isNaN(data.section.confidence)) ? data.section.confidence : 0;
  const syncopation = (data.rhythm && !isNaN(data.rhythm.syncopation)) ? data.rhythm.syncopation : 0;
  const genreConfidence = (data.genre && !isNaN(data.genre.confidence)) ? data.genre.confidence : 0;
  
  const getElementColor = (element: string) => {
    switch (element) {
      case 'fire': return '#ef4444'
      case 'water': return '#3b82f6'
      case 'air': return '#a855f7'
      case 'earth': return '#22c55e'
      default: return '#94a3b8'
    }
  }
  
  const getElementEmoji = (element: string) => {
    switch (element) {
      case 'fire': return '🔥'
      case 'water': return '💧'
      case 'air': return '💨'
      case 'earth': return '🌍'
      default: return '⭐'
    }
  }
  
  const getMoodEmoji = (mood: string) => {
    const moods: Record<string, string> = {
      'energetic': '⚡',
      'melancholic': '🌧️',
      'peaceful': '🌸',
      'aggressive': '🔥',
      'mysterious': '🌙',
      'joyful': '☀️',
      'tense': '⚠️',
      'dreamy': '✨',
      'neutral': '〰️',
    }
    return moods[mood] || '〰️'
  }
  
  const getSectionEmoji = (section: string) => {
    const sections: Record<string, string> = {
      'intro': '🎬',
      'verse': '📝',
      'chorus': '🎤',
      'bridge': '🌉',
      'drop': '💥',
      'buildup': '📈',
      'breakdown': '📉',
      'outro': '🏁',
      'unknown': '❓',
    }
    return sections[section] || '❓'
  }

  return (
    <div className={`telemetry-panel musical-dna-panel ${connected ? 'connected' : 'disconnected'}`}>
      <div className="panel-header">
        <h3>🧬 MUSICAL DNA</h3>
        <span 
          className="zodiac-badge"
          style={{ color: getElementColor(data.zodiac.element) }}
        >
          {data.zodiac.symbol}
        </span>
      </div>
      
      {/* Key & Mode */}
      <div className="dna-section key-section">
        <div className="key-display">
          <span className="key-value">{data.key || '—'}</span>
          <span className="mode-value">{data.mode}</span>
        </div>
        <span className="mode-description">{data.modeDescription}</span>
      </div>
      
      {/* Mood & Zodiac */}
      <div className="dna-row">
        <div className="dna-item">
          <span className="dna-label">Mood</span>
          <span className="dna-value mood-value">
            {getMoodEmoji(data.mood)} {data.mood}
          </span>
        </div>
        <div className="dna-item">
          <span className="dna-label">Element</span>
          <span 
            className="dna-value element-value"
            style={{ color: getElementColor(data.zodiac.element) }}
          >
            {getElementEmoji(data.zodiac.element)} {data.zodiac.element}
          </span>
        </div>
      </div>
      
      {/* Section */}
      <div className="dna-section section-display">
        <div className="section-header">
          <span className="section-type">
            {getSectionEmoji(data.section.type)} {data.section.type.toUpperCase()}
          </span>
          <span className="section-confidence">
            {Math.round(sectionConfidence * 100)}%
          </span>
        </div>
        <div className="section-bar">
          <div 
            className="section-fill"
            style={{ width: `${sectionConfidence * 100}%` }}
          />
        </div>
      </div>
      
      {/* Genre */}
      <div className="dna-section genre-section">
        <span className="dna-label">Genre</span>
        <div className="genre-tags">
          <span className="genre-primary">{data.genre.primary}</span>
          {data.genre.secondary && (
            <span className="genre-secondary">{data.genre.secondary}</span>
          )}
        </div>
      </div>
      
      {/* Syncopation */}
      <div className="syncopation-section">
        <span className="dna-label">Syncopation</span>
        <div className="syncopation-bar">
          <div 
            className="syncopation-fill"
            style={{ width: `${syncopation * 100}%` }}
          />
        </div>
        <span className="syncopation-value">
          {Math.round(syncopation * 100)}%
        </span>
      </div>
      
      {/* Zodiac Info */}
      <div className="zodiac-info">
        <span 
          className="zodiac-sign"
          style={{ color: getElementColor(data.zodiac.element) }}
        >
          {data.zodiac.symbol} {data.zodiac.sign}
        </span>
      </div>
    </div>
  )
}

export default MusicalDNAPanel

/**
 * 🎵 CONTEXT MATRIX PANEL - WAVE 1167
 * 
 * Muestra el contexto musical:
 * - Key (tonalidad) + Mode (mayor/menor)
 * - Section (intro, verse, chorus, drop...)
 * - Vibe activo (techno-club, chill-lounge...)
 * - Mood emocional (euphoric, melancholic...)
 * 
 * SIN ZODÍACO. Eso queda en el legacy land.
 */

import { memo } from 'react'
import { useTruthContext, useTruthCognitive } from '../../../hooks/useSeleneTruth'
import { 
  ContextMatrixIcon, 
  MusicalKeyIcon, 
  SectionFlowIcon, 
  VibeAuraIcon 
} from '../../icons/LuxIcons'
import type { MusicalKey, MusicalMode, SectionType, Mood, MacroGenre } from '../../../core/protocol/MusicalContext'
import type { VibeId } from '../../../core/protocol/SeleneProtocol'
import './ContextMatrixPanel.css'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const KEY_DISPLAY: Record<MusicalKey, string> = {
  'C': 'C',
  'C#': 'C♯',
  'D': 'D',
  'D#': 'D♯',
  'E': 'E',
  'F': 'F',
  'F#': 'F♯',
  'G': 'G',
  'G#': 'G♯',
  'A': 'A',
  'A#': 'A♯',
  'B': 'B',
}

const MODE_DISPLAY: Record<MusicalMode, { label: string; color: string }> = {
  'major': { label: 'Major', color: 'var(--accent-success)' },
  'minor': { label: 'Minor', color: 'var(--accent-warning)' },
  'unknown': { label: '?', color: 'var(--text-muted)' },
}

const SECTION_CONFIG: Record<SectionType, { label: string; emoji: string; color: string }> = {
  'intro': { label: 'Intro', emoji: '🌅', color: '#60a5fa' },
  'verse': { label: 'Verse', emoji: '📖', color: '#a78bfa' },
  'chorus': { label: 'Chorus', emoji: '🎤', color: '#f472b6' },
  'bridge': { label: 'Bridge', emoji: '🌉', color: '#facc15' },
  'breakdown': { label: 'Breakdown', emoji: '⬇️', color: '#818cf8' },
  'buildup': { label: 'Buildup', emoji: '📈', color: '#fbbf24' },
  'drop': { label: 'DROP', emoji: '💥', color: '#ef4444' },
  'outro': { label: 'Outro', emoji: '🌙', color: '#64748b' },
  'unknown': { label: 'Unknown', emoji: '❓', color: '#475569' },
}

const MOOD_CONFIG: Record<Mood, { label: string; emoji: string; color: string }> = {
  'euphoric': { label: 'Euphoric', emoji: '🌟', color: '#fbbf24' },
  'melancholic': { label: 'Melancholic', emoji: '🌧️', color: '#60a5fa' },
  'aggressive': { label: 'Aggressive', emoji: '🔥', color: '#ef4444' },
  'dreamy': { label: 'Dreamy', emoji: '☁️', color: '#a78bfa' },
  'neutral': { label: 'Neutral', emoji: '⚖️', color: '#64748b' },
  'mysterious': { label: 'Mysterious', emoji: '🌙', color: '#8b5cf6' },
  'triumphant': { label: 'Triumphant', emoji: '🏆', color: '#22c55e' },
}

const VIBE_CONFIG: Record<VibeId, { label: string; color: string }> = {
  'techno-club': { label: 'Techno Club', color: '#ef4444' },
  'fiesta-latina': { label: 'Fiesta Latina', color: '#f97316' },
  'pop-rock': { label: 'Pop Rock', color: '#8b5cf6' },
  'chill-lounge': { label: 'Chill Lounge', color: '#06b6d4' },
  'idle': { label: 'Idle', color: '#64748b' },
  'custom': { label: 'Custom', color: '#a855f7' },
}

const GENRE_COLORS: Record<MacroGenre, string> = {
  'ELECTRONIC': '#8b5cf6',
  'LATIN': '#f97316',
  'ROCK': '#ef4444',
  'POP': '#ec4899',
  'CHILL': '#06b6d4',
  'UNKNOWN': '#64748b',
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const ContextMatrixPanel = memo(() => {
  const context = useTruthContext()
  const cognitive = useTruthCognitive()
  
  // Extraer datos
  const key = context.key || 'C'
  const mode = context.mode || 'unknown'
  const section = context.section?.type || 'unknown'
  const sectionConf = context.section?.confidence || 0
  const vibe = cognitive.vibe?.active || 'idle'
  const mood = context.mood || 'neutral'
  const genre = context.genre?.macro || 'UNKNOWN'
  
  // Configs
  const keyDisplay = KEY_DISPLAY[key] || key
  const modeInfo = MODE_DISPLAY[mode]
  const sectionInfo = SECTION_CONFIG[section]
  const moodInfo = MOOD_CONFIG[mood]
  const vibeInfo = VIBE_CONFIG[vibe]
  const genreColor = GENRE_COLORS[genre]
  
  return (
    <div className="neural-card context-matrix-panel">
      {/* Header */}
      <div className="neural-card__header">
        <ContextMatrixIcon size={14} color="var(--accent-primary)" />
        <span>CONTEXT MATRIX</span>
      </div>
      
      {/* Content - 2x2 Grid */}
      <div className="neural-card__content">
        <div className="context-matrix-grid">
          
          {/* Key + Mode */}
          <div className="context-cell context-cell--key">
            <div className="context-cell__icon">
              <MusicalKeyIcon size={16} color={modeInfo.color} />
            </div>
            <div className="context-cell__content">
              <span className="context-cell__label">Key</span>
              <div className="context-cell__value">
                <span className="context-key">{keyDisplay}</span>
                <span className="context-mode" style={{ color: modeInfo.color }}>
                  {modeInfo.label}
                </span>
              </div>
            </div>
          </div>
          
          {/* Section */}
          <div 
            className={`context-cell context-cell--section ${section === 'drop' ? 'context-cell--drop' : ''}`}
          >
            <div className="context-cell__icon">
              <SectionFlowIcon size={16} color={sectionInfo.color} />
            </div>
            <div className="context-cell__content">
              <span className="context-cell__label">Section</span>
              <div className="context-cell__value">
                <span className="context-section-emoji">{sectionInfo.emoji}</span>
                <span className="context-section" style={{ color: sectionInfo.color }}>
                  {sectionInfo.label}
                </span>
                {sectionConf > 0.5 && (
                  <span className="context-confidence">{Math.round(sectionConf * 100)}%</span>
                )}
              </div>
            </div>
          </div>
          
          {/* Vibe */}
          <div className="context-cell context-cell--vibe">
            <div className="context-cell__icon">
              <VibeAuraIcon size={16} color={vibeInfo.color} />
            </div>
            <div className="context-cell__content">
              <span className="context-cell__label">Vibe</span>
              <div className="context-cell__value">
                <span className="context-vibe" style={{ color: vibeInfo.color }}>
                  {vibeInfo.label}
                </span>
              </div>
            </div>
          </div>
          
          {/* Mood */}
          <div className="context-cell context-cell--mood">
            <div className="context-cell__icon">
              <span className="context-mood-emoji">{moodInfo.emoji}</span>
            </div>
            <div className="context-cell__content">
              <span className="context-cell__label">Mood</span>
              <div className="context-cell__value">
                <span className="context-mood" style={{ color: moodInfo.color }}>
                  {moodInfo.label}
                </span>
              </div>
            </div>
          </div>
          
        </div>
        
        {/* Genre Badge */}
        <div className="context-genre-footer">
          <span 
            className="context-genre-badge"
            style={{ 
              backgroundColor: `${genreColor}20`,
              borderColor: `${genreColor}50`,
              color: genreColor 
            }}
          >
            {genre}
          </span>
        </div>
      </div>
    </div>
  )
})

ContextMatrixPanel.displayName = 'ContextMatrixPanel'

/**
 * 🎵 CONTEXT MATRIX PANEL - WAVE 1167/1174
 * 
 * Muestra el contexto musical:
 * - Key (tonalidad) + Mode (mayor/menor)
 * - Section (intro, verse, chorus, drop...) - CON DISPLAY LATCH
 * - Vibe activo (techno-club, chill-lounge...) - REAL desde AI
 * - Energy Zone (PEAK, RISING, VALLEY...) - REEMPLAZA MOOD
 * 
 * WAVE 1174: Context Cleanup & Matrix Fix
 * - ❌ ELIMINADO: Genre Badge footer (basura visual)
 * - ✅ RECONECTADO: Vibe desde consciousness.vibe.active
 * - ✅ REEMPLAZADO: Mood por Energy Zone
 * - ✅ ESTABILIZADO: Section con Display Latch (2s delay, <80% confidence)
 */

import { memo, useState, useEffect, useRef } from 'react'
import { useTruthContext, useTruthCognitive, useTruthAI } from '../../../hooks/useSeleneTruth'
import { 
  ContextMatrixIcon, 
  MusicalKeyIcon, 
  SectionFlowIcon, 
  VibeAuraIcon 
} from '../../icons/LuxIcons'
import type { MusicalKey, MusicalMode, SectionType } from '../../../core/protocol/MusicalContext'
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

// ═══════════════════════════════════════════════════════════════════════════
// ENERGY ZONE CONFIG - WAVE 1175: Alineado con backend (TitanEngine)
// Backend envía: 'calm' | 'rising' | 'peak' | 'falling'
// ═══════════════════════════════════════════════════════════════════════════
const ENERGY_ZONE_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  'peak':    { label: 'PEAK',    emoji: '🔥', color: '#ef4444' },  // Rojo - máxima energía
  'rising':  { label: 'RISING',  emoji: '📈', color: '#f97316' },  // Naranja - subiendo
  'calm':    { label: 'CALM',    emoji: '🌿', color: '#22c55e' },  // Verde - tranquilo
  'falling': { label: 'FALLING', emoji: '�', color: '#3b82f6' },  // Azul - bajando
  'idle':    { label: 'IDLE',    emoji: '💤', color: '#64748b' },  // Gris - sin señal
}

const VIBE_CONFIG: Record<VibeId, { label: string; color: string }> = {
  'techno-club': { label: 'Techno Club', color: '#ef4444' },
  'fiesta-latina': { label: 'Fiesta Latina', color: '#f97316' },
  'pop-rock': { label: 'Pop Rock', color: '#8b5cf6' },
  'chill-lounge': { label: 'Chill Lounge', color: '#06b6d4' },
  'idle': { label: 'Idle', color: '#64748b' },
  'custom': { label: 'Custom', color: '#a855f7' },
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

// Display Latch: evita flickering en Section cuando confidence < 80%
const SECTION_LATCH_DELAY_MS = 2000
const SECTION_LATCH_MIN_CONFIDENCE = 0.80

export const ContextMatrixPanel = memo(() => {
  const context = useTruthContext()
  const cognitive = useTruthCognitive()
  
  // Display Latch para Section - evita flickering
  const [displayedSection, setDisplayedSection] = useState<SectionType>('unknown')
  const [displayedSectionConf, setDisplayedSectionConf] = useState(0)
  const lastSectionChangeRef = useRef<number>(Date.now())
  
  // Extraer datos reales
  const key = context.key || 'C'
  const mode = context.mode || 'unknown'
  const realSection = context.section?.type || 'unknown'
  const realSectionConf = context.section?.confidence || 0
  const vibe = cognitive.vibe?.active || 'idle'
  const energyZone = cognitive.ai?.energyZone || 'idle'
  
  // Display Latch Logic - estabiliza Section para evitar flickering
  useEffect(() => {
    const now = Date.now()
    const timeSinceLastChange = now - lastSectionChangeRef.current
    
    // Si confidence es alta (>80%) o han pasado más de 2 segundos, actualizar inmediatamente
    if (realSectionConf >= SECTION_LATCH_MIN_CONFIDENCE || timeSinceLastChange >= SECTION_LATCH_DELAY_MS) {
      if (displayedSection !== realSection) {
        setDisplayedSection(realSection)
        setDisplayedSectionConf(realSectionConf)
        lastSectionChangeRef.current = now
      } else {
        // Solo actualizar confidence si es la misma sección
        setDisplayedSectionConf(realSectionConf)
      }
    }
    // Si confidence es baja y no han pasado 2s, mantener el valor anterior (latch)
  }, [realSection, realSectionConf, displayedSection])
  
  // Usar valores con latch para el render
  const section = displayedSection
  const sectionConf = displayedSectionConf
  
  // Configs
  const keyDisplay = KEY_DISPLAY[key] || key
  const modeInfo = MODE_DISPLAY[mode]
  const sectionInfo = SECTION_CONFIG[section]
  const vibeInfo = VIBE_CONFIG[vibe]
  const energyInfo = ENERGY_ZONE_CONFIG[energyZone] || ENERGY_ZONE_CONFIG['idle']
  
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
          
          {/* Energy Zone (reemplaza Mood) */}
          <div className="context-cell context-cell--energy">
            <div className="context-cell__icon">
              <span className="context-energy-emoji">{energyInfo.emoji}</span>
            </div>
            <div className="context-cell__content">
              <span className="context-cell__label">Energy</span>
              <div className="context-cell__value">
                <span className="context-energy" style={{ color: energyInfo.color }}>
                  {energyInfo.label}
                </span>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  )
})

ContextMatrixPanel.displayName = 'ContextMatrixPanel'

/**
 * 🧬 MUSICAL DNA PANEL
 * WAVE 29: Cyberpunk Intelligence Display
 * WAVE 63: Replaced GENRE with ACTIVE VIBE from VibeManager
 * WAVE 66: Now uses cognitive.vibe from truthStore (no separate IPC)
 * 
 * Muestra el análisis profundo de Selene:
 * - Musical Key & Scale (El núcleo armónico)
 * - Energy Dynamics (Section detection)
 * - Semantic Analysis (Mood & Zodiac)
 * - Rhythm Analysis (Syncopation)
 * - Active Vibe (WAVE 66: From truthStore)
 */

import React from 'react'
import { useTruthMusicalDNA, useTruthCognitive, useTruthConnected, useTruthAudio, useTruthSystem, useTruthContext } from '../../../hooks'
import './MusicalDNAPanel.css'

// 🎛️ WAVE 66: Vibe display names (local mapping)
const VIBE_DISPLAY: Record<string, { name: string; icon: string }> = {
  'techno-club': { name: 'Techno', icon: '⚡' },
  'fiesta-latina': { name: 'Latino', icon: '🔥' },
  'pop-rock': { name: 'Pop/Rock', icon: '🎤' },
  'chill-lounge': { name: 'Chill', icon: '🛋️' },
  'idle': { name: 'IDLE', icon: '⏸️' }
}

const MusicalDNAPanel: React.FC = () => {
  const musicalDNA = useTruthMusicalDNA()
  const cognitive = useTruthCognitive()
  const connected = useTruthConnected()
  const audio = useTruthAudio()  // 🔥 WAVE 66.5: Para barra de energía
  const system = useTruthSystem()  // 🌉 WAVE 260.5: Para vibe activo
  const contextData = useTruthContext()  // � WAVE 260.5: Para mood real
  
  // 🌉 WAVE 260.5: Get vibe from SYSTEM (not cognitive)
  // truth.system.vibe es donde TitanOrchestrator pone el vibe activo
  const activeVibeId = system?.vibe ?? 'idle'
  const vibeDisplay = VIBE_DISPLAY[activeVibeId] ?? VIBE_DISPLAY['idle']
  
  // Data Extraction & Null Checks
  const zodiacElement = cognitive?.zodiac?.element ?? 'void'
  const zodiacSign = cognitive?.zodiac?.sign ?? '---'
  
  // Helper de Símbolos Zodiacales
  const getZodiacSymbol = (sign: string): string => {
    const map: Record<string, string> = {
      'Aries': '♈', 'Taurus': '♉', 'Gemini': '♊', 'Cancer': '♋',
      'Leo': '♌', 'Virgo': '♍', 'Libra': '♎', 'Scorpio': '♏',
      'Sagittarius': '♐', 'Capricorn': '♑', 'Aquarius': '♒', 'Pisces': '♓'
    }
    return map[sign] || '⭐'
  }

  // Helper de Colores Elementales
  const getElementColor = (element: string) => {
    switch (element.toLowerCase()) {
      case 'fire': return '#ff4444' // Rojo Fuego
      case 'water': return '#3388ff' // Azul Agua
      case 'air': return '#bf00ff'   // Púrpura Aire
      case 'earth': return '#00ff88' // Verde Tierra
      default: return '#666'
    }
  }

  // Estructura de Datos para Render
  const data = {
    key: musicalDNA?.key || '---',
    // Si la clave es 'C Major', intentamos separar
    scale: musicalDNA?.key?.includes('m') ? 'Minor' : 'Major', 
    
    // � WAVE 260.5: Mood viene del CONTEXTO (truth.context.mood)
    // Fallback a cognitive.stableEmotion si no hay mood en context
    mood: contextData?.mood?.toUpperCase() || cognitive?.stableEmotion || 'NEUTRAL',
    
    zodiac: {
      sign: zodiacSign,
      element: zodiacElement,
      symbol: getZodiacSymbol(zodiacSign),
      color: getElementColor(zodiacElement)
    },
    
    section: {
      name: musicalDNA?.section?.current || 'Scanning...',
      confidence: musicalDNA?.section?.confidence || 0,
      energy: audio?.energy || 0,  // 🔥 WAVE 66.5: Energía suavizada para barra
      // 🎢 WAVE 68: DROP solo se muestra si:
      // 1. Estado es SUSTAIN (único estado de drop real, PEAK no existe)
      // 2. isActive = true
      isDrop: cognitive?.dropState?.state === 'SUSTAIN' && 
              cognitive?.dropState?.isActive === true
    },
    
    rhythm: {
      syncopation: musicalDNA?.rhythm?.syncopation || 0
    },
    
    // 🎛️ WAVE 66: Vibe from truthStore
    vibe: {
      id: activeVibeId,
      name: vibeDisplay.name,
      icon: vibeDisplay.icon
    }
  }

  // Icono de Sección
  const getSectionIcon = (type: string) => {
    if (type.includes('drop')) return '💥'
    if (type.includes('break')) return '📉'
    if (type.includes('build')) return '📈'
    return '🌊'
  }

  return (
    <div className={`dna-panel-container ${connected ? 'online' : 'offline'}`}>
      
      {/* HEADER */}
      <div className="dna-header">
        <div className="dna-title">
          <span className="icon">🧬</span>
          <span>MUSICAL DNA</span>
        </div>
        <div className="dna-status-dot" />
      </div>

      {/* CORE IDENTITY (KEY & SCALE) */}
      <div className="dna-core">
        <div className="key-display">
          <span className="key-note">{data.key.replace(/Major|Minor/i, '').trim()}</span>
          <span className="key-scale">{data.scale}</span>
        </div>
        <div className="dna-decoration">
          <div className="hex-tech" />
        </div>
      </div>

      {/* SEMANTIC LAYER (MOOD & ZODIAC) */}
      <div className="dna-semantics">
        
        {/* Mood Item */}
        <div className="semantic-item">
          <span className="label">AFFECTIVE STATE</span>
          <span className="value mood">{data.mood.toUpperCase()}</span>
        </div>

        {/* Zodiac Item */}
        <div className="semantic-item">
          <span className="label">ZODIAC SIGN</span>
          <div className="zodiac-value" style={{ color: data.zodiac.color, textShadow: `0 0 10px ${data.zodiac.color}` }}>
            <span className="symbol">{data.zodiac.symbol}</span>
            <span className="text">{data.zodiac.sign.toUpperCase()}</span>
          </div>
        </div>

      </div>

      {/* 🔥 WAVE 66.5: STRUCTURAL LAYER - Energía + Sección (sin DROP parpadeante) */}
      <div className="dna-structure">
        <div className="structure-header">
          <span className="section-name">
            {/* Solo mostrar DROP si isDrop es true, sino mostrar sección normal */}
            {data.section.isDrop ? '💥 DROP' : `${getSectionIcon(data.section.name)} ${data.section.name.toUpperCase()}`}
          </span>
          <span className="energy-val">{Math.round(data.section.energy * 100)}%</span>
        </div>
        
        {/* 🔥 WAVE 66.5: Barra de ENERGÍA (no confianza) - más estable y útil */}
        <div className="structure-bar-track">
          <div 
            className={`structure-bar-fill ${data.section.isDrop ? 'drop-state' : ''}`}
            style={{ width: `${data.section.energy * 100}%` }}
          />
        </div>
      </div>

      {/* CLASSIFICATION LAYER (VIBE & RHYTHM) - WAVE 63: Replaced Genre with Vibe */}
      <div className="dna-classification">
        <div className="class-pill genre">
          <span className="pill-label">VIBE</span>
          <span className="pill-val">{data.vibe.icon} {data.vibe.name}</span>
        </div>
        
        <div className="class-pill rhythm">
          <span className="pill-label">SYNCO</span>
          <span className="pill-val">{(data.rhythm.syncopation * 100).toFixed(0)}%</span>
        </div>
      </div>

    </div>
  )
}

export default MusicalDNAPanel

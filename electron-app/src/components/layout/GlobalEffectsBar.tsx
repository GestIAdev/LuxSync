/**
 * ⚡ GLOBAL EFFECTS BAR - WAVE 10.7
 * Controles de efectos profesionales con Lucide Icons
 * Conectados al backend via IPC
 */

import React, { useCallback } from 'react'
import { useEffectsStore, EFFECTS, EffectId } from '../../stores/effectsStore'
import { LucideIcon } from 'lucide-react'
import { 
  Flashlight,    // BEAM
  Triangle,      // PRISM  
  Zap,           // STROBE
  Sun,           // BLINDER
  Wind,          // SMOKE
  Target,        // LASER
  Palette,       // RAINBOW
  Siren,         // POLICE
  Square,        // BLACKOUT
} from 'lucide-react'
import './GlobalEffectsBar.css'

// Mapeo de EffectId a icono Lucide y color cyberpunk
const EFFECT_CONFIG: Record<EffectId, { 
  Icon: LucideIcon
  color: string
  glowColor: string
}> = {
  beam:    { Icon: Flashlight, color: '#00FFFF', glowColor: 'rgba(0, 255, 255, 0.5)' },
  prism:   { Icon: Triangle,   color: '#FF00FF', glowColor: 'rgba(255, 0, 255, 0.5)' },
  strobe:  { Icon: Zap,        color: '#FFFF00', glowColor: 'rgba(255, 255, 0, 0.5)' },
  blinder: { Icon: Sun,        color: '#FFFFFF', glowColor: 'rgba(255, 255, 255, 0.5)' },
  smoke:   { Icon: Wind,       color: '#8B9DC3', glowColor: 'rgba(139, 157, 195, 0.5)' },
  laser:   { Icon: Target,     color: '#FF3366', glowColor: 'rgba(255, 51, 102, 0.5)' },
  rainbow: { Icon: Palette,    color: '#A855F7', glowColor: 'rgba(168, 85, 247, 0.5)' },
  police:  { Icon: Siren,      color: '#3B82F6', glowColor: 'rgba(59, 130, 246, 0.5)' },
}

const GlobalEffectsBar: React.FC = () => {
  const { blackout, activeEffects, toggleEffect, toggleBlackout } = useEffectsStore()

  // 🔌 Conectar al backend via IPC
  const handleEffectClick = useCallback(async (effectId: EffectId) => {
    const isCurrentlyActive = activeEffects.has(effectId)
    
    // Toggle en el store local
    toggleEffect(effectId)
    
    // Enviar al backend
    try {
      if (!isCurrentlyActive) {
        // Activar efecto
        const params = getEffectParams(effectId)
        // 🔥 Efectos de pulso (strobe, blinder) tienen duración corta
        const duration = (effectId === 'strobe' || effectId === 'blinder') ? 3000 : 0
        await window.lux?.triggerEffect(effectId, params, duration)
        console.log(`[GlobalEffectsBar] ⚡ Activated: ${effectId}`)
        
        // Auto-desactivar efectos de pulso en el frontend
        if (duration > 0) {
          setTimeout(() => {
            toggleEffect(effectId) // Toggle off en store local
          }, duration)
        }
      } else {
        // Desactivar efecto - pasar el NOMBRE del efecto, no un ID numérico
        await window.lux?.cancelEffect(effectId)
        console.log(`[GlobalEffectsBar] 🛑 Deactivated: ${effectId}`)
      }
    } catch (err) {
      console.error('[GlobalEffectsBar] Effect error:', err)
    }
  }, [activeEffects, toggleEffect])

  // Parámetros específicos por efecto
  const getEffectParams = (effectId: EffectId): Record<string, number> => {
    switch (effectId) {
      case 'beam':
        return { beamWidth: 0.0, iris: 0.2, zoom: 0, intensity: 1.0 }
      case 'prism':
        return { fragmentation: 1.0, textureRotation: 0.5, prismActive: 1, intensity: 1.0 }
      case 'strobe':
        return { rate: 10, intensity: 1.0 }
      case 'blinder':
        return { intensity: 1.0, dimmer: 255 }
      case 'smoke':
        return { amount: 1.0, duration: 3000 }
      case 'laser':
        return { pattern: 1, intensity: 1.0 }
      case 'rainbow':
        return { rate: 0.5, saturation: 1.0 }
      case 'police':
        return { rate: 4 }
      default:
        return {}
    }
  }

  // Blackout con IPC
  const handleBlackout = useCallback(async () => {
    toggleBlackout()
    try {
      await window.lux?.setBlackout(!blackout)
      console.log(`[GlobalEffectsBar] 🔲 Blackout: ${!blackout}`)
    } catch (err) {
      console.error('[GlobalEffectsBar] Blackout error:', err)
    }
  }, [blackout, toggleBlackout])

  return (
    <footer className="effects-bar">
      {/* Effect Buttons */}
      <div className="effects-buttons">
        {EFFECTS.map((effect) => {
          const config = EFFECT_CONFIG[effect.id]
          const isActive = activeEffects.has(effect.id)
          const IconComponent = config.Icon
          
          return (
            <button
              key={effect.id}
              className={`effect-btn ${isActive ? 'active' : ''} ${blackout ? 'disabled' : ''}`}
              onClick={() => handleEffectClick(effect.id)}
              disabled={blackout}
              title={`${effect.description} [${effect.shortcut}]`}
              style={{
                '--effect-color': config.color,
                '--effect-glow': config.glowColor,
              } as React.CSSProperties}
            >
              <IconComponent size={22} className="effect-icon-svg" />
              <span className="effect-label">{effect.label}</span>
              <span className="effect-shortcut">{effect.shortcut}</span>
            </button>
          )
        })}
      </div>

      {/* Blackout Master Button */}
      <button
        className={`blackout-btn ${blackout ? 'active' : ''}`}
        onClick={handleBlackout}
        title="BLACKOUT - All lights off [SPACE]"
      >
        <Square size={24} className="blackout-icon-svg" />
        <span className="blackout-label">BLACKOUT</span>
        <span className="blackout-shortcut">SPACE</span>
      </button>
    </footer>
  )
}

export default GlobalEffectsBar

/**
 * ⚡ QUICK ACTIONS - WAVE 375
 * Global effects: Strobe, Blinder, Smoke
 * Only GLOBAL effects that affect the whole venue
 */

import React, { useCallback } from 'react'
import { StrobeIcon, BlinderIcon, SmokeIcon } from '../icons/LuxIcons'
import { useEffectsStore, EffectId } from '../../stores/effectsStore'
import './CommandDeck.css'

// Only global effects in the deck
const QUICK_EFFECTS: { id: EffectId; label: string; icon: React.ReactNode; color: string; shortcut: string }[] = [
  { id: 'strobe', label: 'STROBE', icon: <StrobeIcon size={24} />, color: '#FFFF00', shortcut: '1' },
  { id: 'blinder', label: 'BLINDER', icon: <BlinderIcon size={24} />, color: '#FFFFFF', shortcut: '2' },
  { id: 'smoke', label: 'SMOKE', icon: <SmokeIcon size={24} />, color: '#8B9DC3', shortcut: '3' },
]

interface QuickActionsProps {
  disabled?: boolean
}

export const QuickActions: React.FC<QuickActionsProps> = ({ disabled }) => {
  const { activeEffects, toggleEffect } = useEffectsStore()
  
  const handleEffectClick = useCallback(async (effectId: EffectId) => {
    const isActive = activeEffects.has(effectId)
    
    // Toggle local state
    toggleEffect(effectId)
    
    // Send to backend
    try {
      if (!isActive) {
        const params = getEffectParams(effectId)
        const duration = (effectId === 'strobe' || effectId === 'blinder') ? 3000 : 0
        await window.lux?.triggerEffect(effectId, params, duration)
        console.log(`[QuickActions] ⚡ Activated: ${effectId}`)
        
        // Auto-off for pulse effects
        if (duration > 0) {
          setTimeout(() => toggleEffect(effectId), duration)
        }
      } else {
        await window.lux?.cancelEffect(effectId)
        console.log(`[QuickActions] 🛑 Deactivated: ${effectId}`)
      }
    } catch (err) {
      console.error('[QuickActions] Effect error:', err)
    }
  }, [activeEffects, toggleEffect])
  
  return (
    <div className="quick-actions">
      {QUICK_EFFECTS.map(effect => {
        const isActive = activeEffects.has(effect.id)
        return (
          <button
            key={effect.id}
            className={`quick-btn ${isActive ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
            onClick={() => handleEffectClick(effect.id)}
            disabled={disabled}
            style={{ '--effect-color': effect.color } as React.CSSProperties}
            title={`${effect.label} [${effect.shortcut}]`}
          >
            <span className="quick-icon">{effect.icon}</span>
            <span className="quick-label">{effect.label}</span>
            <span className="quick-shortcut">{effect.shortcut}</span>
          </button>
        )
      })}
    </div>
  )
}

function getEffectParams(effectId: EffectId): Record<string, number> {
  switch (effectId) {
    case 'strobe': return { rate: 10, intensity: 1.0 }
    case 'blinder': return { intensity: 1.0, dimmer: 255 }
    case 'smoke': return { amount: 1.0, duration: 3000 }
    default: return {}
  }
}

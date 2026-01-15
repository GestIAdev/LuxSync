/**
 * ⚡ QUICK ACTIONS - WAVE 431: PANIC GRID
 * Global effects: Strobe, Blinder, Smoke + MORE FX placeholder
 * 4-column grid layout for dense, tactile feel
 */

import React, { useCallback } from 'react'
import { StrobeIcon, BlinderIcon, SmokeIcon } from '../icons/LuxIcons'
import { Sparkles } from 'lucide-react'
import { useEffectsStore, EffectId } from '../../stores/effectsStore'
import './CommandDeck.css'

// Panic effects + placeholder for future FX drawer
const QUICK_EFFECTS: { id: EffectId | 'more_fx'; label: string; icon: React.ReactNode; color: string; shortcut: string; isPlaceholder?: boolean }[] = [
  { id: 'strobe', label: 'STROBE', icon: <StrobeIcon size={28} />, color: '#FFFF00', shortcut: '1' },
  { id: 'blinder', label: 'BLINDER', icon: <BlinderIcon size={28} />, color: '#FFFFFF', shortcut: '2' },
  { id: 'smoke', label: 'SMOKE', icon: <SmokeIcon size={28} />, color: '#8B9DC3', shortcut: '3' },
  { id: 'more_fx', label: 'MORE FX', icon: <Sparkles size={28} />, color: '#A855F7', shortcut: '...', isPlaceholder: true },
]

interface QuickActionsProps {
  disabled?: boolean
}

export const QuickActions: React.FC<QuickActionsProps> = ({ disabled }) => {
  const { activeEffects, toggleEffect } = useEffectsStore()
  
  const handleEffectClick = useCallback(async (effectId: EffectId | 'more_fx') => {
    // Placeholder button - do nothing for now
    if (effectId === 'more_fx') {
      console.log('[QuickActions] 🎨 MORE FX drawer coming soon...')
      return
    }
    
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
        const isActive = effect.id !== 'more_fx' && activeEffects.has(effect.id as EffectId)
        const isPlaceholder = effect.isPlaceholder
        
        return (
          <button
            key={effect.id}
            className={`quick-btn ${isActive ? 'active' : ''} ${disabled ? 'disabled' : ''} ${isPlaceholder ? 'placeholder' : ''}`}
            onClick={() => handleEffectClick(effect.id)}
            disabled={disabled}
            style={{ '--effect-color': effect.color } as React.CSSProperties}
            title={isPlaceholder ? 'More effects coming soon' : `${effect.label} [${effect.shortcut}]`}
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

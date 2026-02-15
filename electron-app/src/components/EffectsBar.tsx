/**
 * ⚡ EFFECTS BAR - WAVE 10.7: Optical Controls + Panic Buttons
 * Controles manuales de BEAM, PRISM, STROBE, BLINDER
 * Hold = Momentáneo, Click = Toggle
 * 
 * WAVE 25.5: Migrado a truthStore (lectura) - muestra estado REAL del backend
 */

import { useState, useCallback } from 'react'
import { useLuxSyncStore, EffectId, EFFECTS, selectEffectsBar } from '../stores/luxsyncStore'
import { useShallow } from 'zustand/shallow'
import { BeamIcon, PrismIcon, StrobeIcon, BlinderIcon, SmokeIcon, RainbowIcon, PoliceIcon, LaserIcon } from './icons/LuxIcons'
// 🌙 WAVE 25.5: Truth hook para lectura de estado real
import { useTruthEffects } from '../hooks'

// Tipos de efecto: 'hold' = solo mientras mantienes, 'toggle' = on/off
type EffectMode = 'hold' | 'toggle'

interface EffectButton {
  id: EffectId
  icon: React.ReactNode
  label: string
  color: string
  mode: EffectMode
  shortcut?: string
}

const EFFECT_BUTTONS: EffectButton[] = [
  // 🔦 OPTICAL CONTROLS (Hold for momentary)
  { id: 'beam', icon: <BeamIcon size={28} />, label: 'BEAM', color: '#00FFFF', mode: 'hold', shortcut: 'B' },
  { id: 'prism', icon: <PrismIcon size={28} />, label: 'PRISM', color: '#FF00FF', mode: 'hold', shortcut: 'P' },
  
  // ⚡ PANIC BUTTONS (Toggle)
  { id: 'strobe', icon: <StrobeIcon size={28} />, label: 'STROBE', color: '#FBBF24', mode: 'toggle', shortcut: 'S' },
  { id: 'blinder', icon: <BlinderIcon size={28} />, label: 'BLINDER', color: '#FFFFFF', mode: 'toggle', shortcut: 'L' },
  
  // 🌈 EFFECTS (Toggle)
  { id: 'smoke', icon: <SmokeIcon size={28} />, label: 'SMOKE', color: '#94A3B8', mode: 'toggle' },
  { id: 'rainbow', icon: <RainbowIcon size={28} />, label: 'RAINBOW', color: '#A855F7', mode: 'toggle' },
]

export default function EffectsBar() {
  // 🛡️ WAVE 2042.13.5: useShallow para evitar infinite loop
  const { activeEffects, toggleEffect, triggerEffect } = useLuxSyncStore(useShallow(selectEffectsBar))
  const [holdingEffects, setHoldingEffects] = useState<Set<EffectId>>(new Set())
  
  // 🌙 WAVE 25.5: Estado REAL de efectos desde el backend
  const truthEffects = useTruthEffects()

  // 🔌 WAVE 10.7: Conectar al backend via IPC
  const sendEffectToBackend = useCallback(async (effectId: EffectId, active: boolean) => {
    try {
      if (active) {
        // Trigger effect con parámetros específicos
        const params = getEffectParams(effectId)
        await window.lux?.triggerEffect(effectId, params, effectId === 'strobe' ? undefined : 0)
        console.log(`[EffectsBar] ⚡ Triggered: ${effectId}`, params)
      } else {
        // Cancel effect
        await window.lux?.cancelEffect(0) // TODO: Track effect IDs
        console.log(`[EffectsBar] 🛑 Cancelled: ${effectId}`)
      }
    } catch (err) {
      console.error('[EffectsBar] Effect error:', err)
    }
  }, [])

  // Parámetros específicos por efecto
  const getEffectParams = (effectId: EffectId): Record<string, number> => {
    switch (effectId) {
      case 'beam':
        return { beamWidth: 0.0, iris: 0.2, zoom: 0 } // Haz cerrado
      case 'prism':
        return { fragmentation: 1.0, textureRotation: 0.5, prismActive: 1 }
      case 'strobe':
        return { rate: 10, intensity: 1.0 }
      case 'blinder':
        return { intensity: 1.0, dimmer: 255 }
      default:
        return {}
    }
  }

  // Hold handlers (mousedown/mouseup)
  const handleMouseDown = useCallback((id: EffectId, mode: EffectMode) => {
    if (mode === 'hold') {
      setHoldingEffects(prev => new Set(prev).add(id))
      triggerEffect(id)
      sendEffectToBackend(id, true)
    }
  }, [triggerEffect, sendEffectToBackend])

  const handleMouseUp = useCallback((id: EffectId, mode: EffectMode) => {
    if (mode === 'hold') {
      setHoldingEffects(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      toggleEffect(id) // Turn off
      sendEffectToBackend(id, false)
    }
  }, [toggleEffect, sendEffectToBackend])

  // Toggle handler (click)
  const handleClick = useCallback((id: EffectId, mode: EffectMode) => {
    if (mode === 'toggle') {
      const isActive = activeEffects.has(id)
      toggleEffect(id)
      sendEffectToBackend(id, !isActive)
    }
  }, [activeEffects, toggleEffect, sendEffectToBackend])

  return (
    <div className="effects-bar">
      {EFFECT_BUTTONS.map(({ id, icon, label, color, mode, shortcut }) => {
        const isActive = activeEffects.has(id) || holdingEffects.has(id)
        const isHoldMode = mode === 'hold'
        
        // 🌙 WAVE 25.5: Verificar estado real del backend
        const truthEffect = truthEffects?.[id as keyof typeof truthEffects]
        // truthEffect puede ser boolean o { active: boolean, ... }
        const isConfirmedByBackend = typeof truthEffect === 'boolean' 
          ? truthEffect 
          : (truthEffect as { active?: boolean } | undefined)?.active === true
        
        return (
          <button
            key={id}
            className={`effect-btn ${isActive ? 'active' : ''} ${isHoldMode ? 'hold-mode' : ''} ${isConfirmedByBackend ? 'backend-confirmed' : ''}`}
            onClick={() => handleClick(id, mode)}
            onMouseDown={() => handleMouseDown(id, mode)}
            onMouseUp={() => handleMouseUp(id, mode)}
            onMouseLeave={() => handleMouseUp(id, mode)}
            style={{
              '--effect-color': color,
            } as React.CSSProperties}
            title={`${label}${shortcut ? ` (${shortcut})` : ''} - ${isHoldMode ? 'Hold' : 'Toggle'}${isConfirmedByBackend ? ' ✓ Active' : ''}`}
          >
            <span className="effect-icon">{icon}</span>
            <span className="effect-label">{label}</span>
            {shortcut && <span className="effect-shortcut">{shortcut}</span>}
            {isActive && <div className="active-indicator" />}
            {isConfirmedByBackend && <div className="backend-indicator" title="Active in backend" />}
            {isHoldMode && <span className="hold-badge">HOLD</span>}
          </button>
        )
      })}

      <style>{`
        .effects-bar {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: var(--space-sm, 8px);
        }

        .effect-btn {
          height: 90px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          background: linear-gradient(180deg, rgba(30, 30, 40, 0.9) 0%, rgba(15, 15, 25, 0.95) 100%);
          border: 2px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.15s ease;
          position: relative;
          overflow: hidden;
          color: white;
        }

        .effect-btn.hold-mode {
          border-style: dashed;
        }

        .effect-btn:hover {
          border-color: var(--effect-color);
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
        }

        .effect-btn:active {
          transform: translateY(0) scale(0.98);
        }

        .effect-btn.active {
          background: linear-gradient(
            180deg, 
            color-mix(in srgb, var(--effect-color) 30%, rgba(30, 30, 40, 1)) 0%, 
            color-mix(in srgb, var(--effect-color) 15%, rgba(15, 15, 25, 1)) 100%
          );
          border-color: var(--effect-color);
          border-style: solid;
          box-shadow: 
            0 0 30px color-mix(in srgb, var(--effect-color) 50%, transparent),
            inset 0 0 20px color-mix(in srgb, var(--effect-color) 20%, transparent);
        }

        .effect-icon {
          font-size: 1.8rem;
          transition: all 0.2s ease;
          color: rgba(255, 255, 255, 0.8);
        }

        .effect-btn.active .effect-icon {
          transform: scale(1.15);
          filter: drop-shadow(0 0 10px var(--effect-color));
          color: var(--effect-color);
        }

        .effect-label {
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          color: rgba(255, 255, 255, 0.5);
          transition: color 0.2s ease;
        }

        .effect-btn.active .effect-label {
          color: var(--effect-color);
          text-shadow: 0 0 10px var(--effect-color);
        }

        .effect-shortcut {
          position: absolute;
          top: 6px;
          right: 6px;
          font-size: 0.6rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.3);
          background: rgba(0, 0, 0, 0.3);
          padding: 2px 5px;
          border-radius: 4px;
        }

        .hold-badge {
          position: absolute;
          bottom: 6px;
          font-size: 0.5rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.3);
          letter-spacing: 0.1em;
        }

        .effect-btn.active .hold-badge {
          color: var(--effect-color);
          opacity: 0.7;
        }

        .active-indicator {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: var(--effect-color);
          box-shadow: 0 0 15px var(--effect-color);
          animation: pulse-bar 0.5s ease-in-out infinite alternate;
        }

        /* 🌙 WAVE 25.5: Indicador de confirmación backend */
        .backend-indicator {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 8px;
          height: 8px;
          background: #00ff88;
          border-radius: 50%;
          box-shadow: 0 0 8px #00ff88;
          animation: pulse-dot 1s ease-in-out infinite;
        }

        @keyframes pulse-dot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.7; }
        }

        .effect-btn.backend-confirmed {
          border-color: #00ff88 !important;
        }

        @keyframes pulse-bar {
          from { opacity: 0.7; }
          to { opacity: 1; }
        }

        /* Strobe flash animation when active */
        .effect-btn.active[style*="FBBF24"] {
          animation: strobe-flash 0.1s infinite;
        }

        @keyframes strobe-flash {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        /* Prism rainbow shimmer when active */
        .effect-btn.active[style*="FF00FF"]::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(45deg, 
            rgba(255,0,0,0.1), rgba(0,255,0,0.1), rgba(0,0,255,0.1), 
            rgba(255,0,255,0.1), rgba(0,255,255,0.1));
          background-size: 400% 400%;
          animation: prism-shimmer 2s ease infinite;
          pointer-events: none;
        }

        @keyframes prism-shimmer {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  )
}

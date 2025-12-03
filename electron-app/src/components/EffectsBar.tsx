/**
 * ⚡ EFFECTS BAR - Botones de pánico GRANDES
 * Fáciles de golpear en medio del show
 */

import { useLuxSyncStore, EffectId, EFFECTS } from '../stores/luxsyncStore'

const EFFECT_BUTTONS: { id: EffectId; icon: string; label: string; color: string }[] = [
  { id: 'strobe', icon: '⚡', label: 'STROBE', color: '#FBBF24' },
  { id: 'blinder', icon: '💡', label: 'BLINDER', color: '#FFFFFF' },
  { id: 'smoke', icon: '💨', label: 'SMOKE', color: '#94A3B8' },
  { id: 'laser', icon: '🔴', label: 'LASER', color: '#EF4444' },
  { id: 'rainbow', icon: '🌈', label: 'RAINBOW', color: '#A855F7' },
  { id: 'police', icon: '🚨', label: 'POLICE', color: '#3B82F6' },
]

export default function EffectsBar() {
  const { effects, toggleEffect, triggerEffect } = useLuxSyncStore()

  return (
    <div className="effects-bar">
      {EFFECT_BUTTONS.map(({ id, icon, label, color }) => {
        const isActive = effects.active.has(id)
        
        return (
          <button
            key={id}
            className={`effect-btn ${isActive ? 'active' : ''}`}
            onClick={() => toggleEffect(id)}
            onDoubleClick={() => triggerEffect(id)}
            style={{
              '--effect-color': color,
            } as React.CSSProperties}
          >
            <span className="effect-icon">{icon}</span>
            <span className="effect-label">{label}</span>
            {isActive && <div className="active-indicator" />}
          </button>
        )
      })}

      <style>{`
        .effects-bar {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: var(--space-sm);
        }

        .effect-btn {
          height: 90px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: var(--space-xs);
          background: linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-deep) 100%);
          border: 2px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          cursor: pointer;
          transition: all 0.15s ease;
          position: relative;
          overflow: hidden;
        }

        .effect-btn:hover {
          border-color: var(--effect-color);
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
        }

        .effect-btn:active {
          transform: translateY(0);
        }

        .effect-btn.active {
          background: linear-gradient(
            180deg, 
            color-mix(in srgb, var(--effect-color) 30%, var(--bg-surface)) 0%, 
            color-mix(in srgb, var(--effect-color) 15%, var(--bg-deep)) 100%
          );
          border-color: var(--effect-color);
          box-shadow: 
            0 0 30px color-mix(in srgb, var(--effect-color) 50%, transparent),
            inset 0 0 20px color-mix(in srgb, var(--effect-color) 20%, transparent);
        }

        .effect-icon {
          font-size: 2rem;
          transition: all 0.2s ease;
        }

        .effect-btn.active .effect-icon {
          transform: scale(1.2);
          filter: drop-shadow(0 0 10px var(--effect-color));
        }

        .effect-label {
          font-family: var(--font-display);
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: var(--text-secondary);
          transition: color 0.2s ease;
        }

        .effect-btn.active .effect-label {
          color: var(--effect-color);
          text-shadow: 0 0 10px var(--effect-color);
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

        @keyframes pulse-bar {
          from { opacity: 0.7; }
          to { opacity: 1; }
        }

        /* Efecto especial para strobe cuando está activo */
        .effect-btn.active[style*="FBBF24"] {
          animation: strobe-flash 0.1s infinite;
        }

        @keyframes strobe-flash {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  )
}

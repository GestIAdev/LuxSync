/**
 * ⚡ EFFECTS BAR - Botones de pánico para efectos
 * Strobe, Blinder, Smoke, Laser, Rainbow, Police
 */

import { useLuxSyncStore, EffectId, EFFECTS } from '../stores/luxsyncStore'

export default function EffectsBar() {
  const { effects, toggleEffect } = useLuxSyncStore()

  const effectIds: EffectId[] = ['strobe', 'blinder', 'smoke', 'laser', 'rainbow', 'police']

  return (
    <div className="effects-bar">
      <div className="effects-container">
        {effectIds.map((id) => {
          const effect = EFFECTS[id]
          const isActive = effects.active.has(id)

          return (
            <button
              key={id}
              className={`effect-btn ${isActive ? 'active' : ''}`}
              onClick={() => toggleEffect(id)}
              style={{
                '--effect-color': effect.color,
              } as React.CSSProperties}
            >
              <span className="effect-icon">{effect.icon}</span>
              <span className="effect-label">{effect.label}</span>
              {isActive && (
                <>
                  <div className="effect-glow" />
                  <div className="effect-pulse" />
                </>
              )}
            </button>
          )
        })}
      </div>

      <style>{`
        .effects-bar {
          padding: var(--space-md);
          background: var(--bg-surface);
          border-top: 1px solid var(--border-subtle);
        }

        .effects-container {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: var(--space-sm);
        }

        .effect-btn {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: var(--space-xs);
          padding: var(--space-md) var(--space-sm);
          background: var(--bg-deep);
          border: 2px solid transparent;
          border-radius: var(--radius-lg);
          cursor: pointer;
          transition: all 0.15s ease;
          overflow: hidden;
        }

        .effect-btn:hover {
          background: var(--bg-elevated);
          border-color: var(--border-active);
          transform: translateY(-2px);
        }

        .effect-btn.active {
          background: color-mix(in srgb, var(--effect-color) 20%, var(--bg-deep));
          border-color: var(--effect-color);
          box-shadow: 
            0 0 20px color-mix(in srgb, var(--effect-color) 40%, transparent),
            inset 0 0 20px color-mix(in srgb, var(--effect-color) 10%, transparent);
        }

        .effect-icon {
          font-size: 1.5rem;
          transition: transform 0.2s ease, filter 0.2s ease;
        }

        .effect-btn:hover .effect-icon {
          transform: scale(1.1);
        }

        .effect-btn.active .effect-icon {
          filter: drop-shadow(0 0 8px var(--effect-color));
          animation: icon-pulse 0.5s ease-in-out infinite alternate;
        }

        @keyframes icon-pulse {
          from { transform: scale(1); }
          to { transform: scale(1.15); }
        }

        .effect-label {
          font-family: var(--font-display);
          font-size: 0.625rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--text-muted);
          transition: color 0.2s ease;
        }

        .effect-btn.active .effect-label {
          color: var(--effect-color);
        }

        .effect-glow {
          position: absolute;
          inset: 0;
          background: radial-gradient(
            ellipse at center,
            color-mix(in srgb, var(--effect-color) 20%, transparent) 0%,
            transparent 70%
          );
          pointer-events: none;
        }

        .effect-pulse {
          position: absolute;
          inset: -2px;
          border-radius: var(--radius-lg);
          border: 2px solid var(--effect-color);
          animation: pulse-ring 1s ease-out infinite;
          pointer-events: none;
        }

        @keyframes pulse-ring {
          0% {
            opacity: 1;
            transform: scale(1);
          }
          100% {
            opacity: 0;
            transform: scale(1.1);
          }
        }

        /* Efectos específicos */
        .effect-btn[data-effect="strobe"].active .effect-icon {
          animation: strobe-flash 0.1s linear infinite;
        }

        @keyframes strobe-flash {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0.3; }
        }

        /* Responsive */
        @media (max-width: 800px) {
          .effects-container {
            grid-template-columns: repeat(3, 1fr);
          }
        }
      `}</style>
    </div>
  )
}

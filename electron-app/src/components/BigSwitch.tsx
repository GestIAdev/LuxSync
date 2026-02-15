/**
 * 🎛️ BIG SWITCH - Panel de Control Vertical
 * Power + Modos en columna izquierda
 */

import { useLuxSyncStore, SeleneMode, selectBigSwitch } from '../stores/luxsyncStore'
import { useShallow } from 'zustand/shallow'
import { useState } from 'react'

// WAVE 422: MODES simplificados - 'flow' eliminado (Auto-Override System)
const MODES: { mode: SeleneMode; label: string; color: string; desc: string; icon: string }[] = [
  { mode: 'selene', label: 'SELENE', color: '#8b5cf6', desc: 'IA Consciente', icon: '🧠' },
  { mode: 'locked', label: 'OVERRIDE', color: '#ef4444', desc: 'Control Manual', icon: '🔒' },
]

export default function BigSwitch() {
  // 🛡️ WAVE 2042.13.5: useShallow para evitar infinite loop
  const { seleneMode, setSeleneMode } = useLuxSyncStore(useShallow(selectBigSwitch))
  const [isActive, setIsActive] = useState(true)

  return (
    <div className="big-switch">
      {/* POWER BUTTON - El corazón */}
      <button
        className={`power-btn ${isActive ? 'active' : ''}`}
        onClick={() => setIsActive(!isActive)}
      >
        <svg className="power-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 2v10M18.4 6.6a9 9 0 1 1-12.8 0" />
        </svg>
        <span className="power-label">{isActive ? 'LIVE' : 'OFF'}</span>
      </button>

      {/* MODE SELECTOR - Vertical */}
      <div className="mode-selector">
        <span className="mode-title">MODE</span>
        {MODES.map(({ mode, label, color, desc, icon }) => {
          const isModeActive = seleneMode === mode
          return (
            <button
              key={mode}
              className={`mode-btn ${isModeActive ? 'active' : ''}`}
              onClick={() => setSeleneMode(mode)}
              style={{ '--mode-color': color } as React.CSSProperties}
            >
              <span className="mode-icon">{icon}</span>
              <div className="mode-info">
                <span className="mode-label">{label}</span>
                <span className="mode-desc">{desc}</span>
              </div>
              {isModeActive && <div className="active-bar" />}
            </button>
          )
        })}
      </div>

      {/* STATUS INDICATOR */}
      <div className="big-switch-status">
        <div className={`big-switch-dot ${isActive ? 'live' : ''}`} />
        <span className="big-switch-status-text">
          {isActive ? 'Sistema Activo' : 'Sistema Pausado'}
        </span>
      </div>

      <style>{`
        .big-switch {
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
          height: 100%;
        }

        /* POWER BUTTON */
        .big-switch .power-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: var(--space-sm);
          padding: var(--space-lg);
          background: var(--bg-surface);
          border: 3px solid var(--border-subtle);
          border-radius: var(--radius-xl);
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .big-switch .power-btn:hover {
          border-color: var(--border-active);
        }

        .big-switch .power-btn.active {
          border-color: var(--accent-primary);
          background: radial-gradient(ellipse at center, var(--accent-primary-glow) 0%, var(--bg-surface) 70%);
          box-shadow: 0 0 40px var(--accent-primary-glow);
        }

        .big-switch .power-icon {
          width: 48px;
          height: 48px;
          color: var(--text-muted);
          transition: all 0.3s ease;
        }

        .big-switch .power-btn.active .power-icon {
          color: var(--accent-primary);
          filter: drop-shadow(0 0 15px var(--accent-primary));
        }

        .big-switch .power-label {
          font-family: var(--font-display);
          font-size: 0.875rem;
          font-weight: 700;
          letter-spacing: 0.2em;
          color: var(--text-muted);
        }

        .big-switch .power-btn.active .power-label {
          color: var(--accent-primary);
        }

        /* MODE SELECTOR */
        .big-switch .mode-selector {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: var(--space-xs);
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: var(--space-sm);
        }

        .big-switch .mode-title {
          font-family: var(--font-display);
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--text-muted);
          letter-spacing: 0.15em;
          text-align: center;
          padding-bottom: var(--space-xs);
          border-bottom: 1px solid var(--border-subtle);
        }

        .big-switch .mode-btn {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
          padding: var(--space-sm);
          background: var(--bg-deep);
          border: 2px solid transparent;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
        }

        .big-switch .mode-btn:hover {
          border-color: var(--mode-color);
          background: var(--bg-elevated);
        }

        .big-switch .mode-btn.active {
          border-color: var(--mode-color);
          background: color-mix(in srgb, var(--mode-color) 15%, var(--bg-deep));
          box-shadow: 0 0 20px color-mix(in srgb, var(--mode-color) 30%, transparent);
        }

        .big-switch .mode-icon {
          font-size: 1.25rem;
        }

        .big-switch .mode-info {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
        }

        .big-switch .mode-label {
          font-family: var(--font-display);
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--text-secondary);
          letter-spacing: 0.1em;
        }

        .big-switch .mode-btn.active .mode-label {
          color: var(--mode-color);
        }

        .big-switch .mode-desc {
          font-size: 0.6rem;
          color: var(--text-muted);
        }

        .big-switch .active-bar {
          position: absolute;
          right: 0;
          top: 0;
          bottom: 0;
          width: 4px;
          background: var(--mode-color);
          box-shadow: 0 0 10px var(--mode-color);
        }

        /* BIG SWITCH STATUS (renamed to avoid conflicts) */
        .big-switch-status {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-sm);
          padding: var(--space-sm);
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
        }

        .big-switch-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--text-muted);
          transition: all 0.3s ease;
        }

        .big-switch-dot.live {
          background: var(--accent-primary);
          box-shadow: 0 0 15px var(--accent-primary);
          animation: pulse-dot 2s ease-in-out infinite;
        }

        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.2); }
        }

        .big-switch-status-text {
          font-size: 0.7rem;
          color: var(--text-muted);
        }

        .big-switch-dot.live + .big-switch-status-text {
          color: var(--accent-primary);
        }
      `}</style>
    </div>
  )
}


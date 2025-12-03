/**
 * 🎚️ THE BIG SWITCH - Control Maestro
 * El corazón del dashboard - cambia entre FLOW, SELENE y LOCKED
 */

import { useLuxSyncStore, SeleneMode } from '../stores/luxsyncStore'

const MODES: { id: SeleneMode; icon: string; label: string; description: string; color: string }[] = [
  {
    id: 'flow',
    icon: '🌊',
    label: 'FLOW',
    description: 'Manual con asistencia',
    color: '#4ADE80',
  },
  {
    id: 'selene',
    icon: '🌙',
    label: 'SELENE',
    description: 'IA toma el control',
    color: '#7C4DFF',
  },
  {
    id: 'locked',
    icon: '🔒',
    label: 'LOCKED',
    description: 'Sin cambios automáticos',
    color: '#FF4444',
  },
]

export default function BigSwitch() {
  const { selene, setSeleneMode } = useLuxSyncStore()
  const currentMode = MODES.find((m) => m.id === selene.mode) || MODES[0]

  const handleModeChange = (mode: SeleneMode) => {
    setSeleneMode(mode)
    // Feedback táctil/visual futuro
  }

  return (
    <div className="big-switch-container">
      <div className="big-switch-header">
        <h2 className="big-switch-title">THE BIG SWITCH</h2>
        <span className="big-switch-subtitle">Control Maestro</span>
      </div>

      <div className="big-switch-panel">
        <div className="mode-indicator" style={{ '--mode-color': currentMode.color } as React.CSSProperties}>
          <span className="mode-icon">{currentMode.icon}</span>
          <span className="mode-label">{currentMode.label}</span>
          <span className="mode-description">{currentMode.description}</span>
        </div>

        <div className="switch-track">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              className={`switch-option ${selene.mode === mode.id ? 'active' : ''}`}
              onClick={() => handleModeChange(mode.id)}
              style={{ '--option-color': mode.color } as React.CSSProperties}
            >
              <span className="option-icon">{mode.icon}</span>
              <span className="option-label">{mode.label}</span>
              {selene.mode === mode.id && <div className="option-glow" />}
            </button>
          ))}
          <div 
            className="switch-slider"
            style={{ 
              transform: `translateX(${MODES.findIndex((m) => m.id === selene.mode) * 100}%)`,
              '--slider-color': currentMode.color,
            } as React.CSSProperties}
          />
        </div>

        {/* Extra info para modo SELENE */}
        {selene.mode === 'selene' && (
          <div className="selene-info">
            <div className="selene-stat">
              <span className="stat-label">Confianza</span>
              <div className="stat-bar">
                <div 
                  className="stat-fill" 
                  style={{ width: `${selene.confidence * 100}%` }}
                />
              </div>
              <span className="stat-value">{Math.round(selene.confidence * 100)}%</span>
            </div>
            <div className="selene-stat">
              <span className="stat-label">Salud</span>
              <div className="stat-bar">
                <div 
                  className="stat-fill health" 
                  style={{ width: `${selene.health * 100}%` }}
                />
              </div>
              <span className="stat-value">{Math.round(selene.health * 100)}%</span>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .big-switch-container {
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
        }

        .big-switch-header {
          display: flex;
          flex-direction: column;
          gap: var(--space-xs);
        }

        .big-switch-title {
          font-family: var(--font-display);
          font-size: 0.875rem;
          font-weight: 700;
          color: var(--text-secondary);
          letter-spacing: 0.1em;
          margin: 0;
        }

        .big-switch-subtitle {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .big-switch-panel {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-xl);
          padding: var(--space-lg);
          display: flex;
          flex-direction: column;
          gap: var(--space-lg);
        }

        .mode-indicator {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: var(--space-xl);
          background: linear-gradient(
            135deg,
            color-mix(in srgb, var(--mode-color) 10%, transparent) 0%,
            transparent 100%
          );
          border-radius: var(--radius-lg);
          border: 1px solid color-mix(in srgb, var(--mode-color) 30%, transparent);
        }

        .mode-icon {
          font-size: 3rem;
          margin-bottom: var(--space-sm);
          filter: drop-shadow(0 0 20px var(--mode-color));
        }

        .mode-label {
          font-family: var(--font-display);
          font-size: 2rem;
          font-weight: 700;
          color: var(--mode-color);
          text-shadow: 0 0 20px var(--mode-color);
        }

        .mode-description {
          font-size: 0.875rem;
          color: var(--text-muted);
          margin-top: var(--space-xs);
        }

        .switch-track {
          position: relative;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-xs);
          padding: var(--space-xs);
          background: var(--bg-deep);
          border-radius: var(--radius-lg);
        }

        .switch-slider {
          position: absolute;
          top: var(--space-xs);
          left: var(--space-xs);
          width: calc(33.333% - var(--space-xs) / 3);
          height: calc(100% - var(--space-xs) * 2);
          background: color-mix(in srgb, var(--slider-color) 20%, transparent);
          border: 1px solid var(--slider-color);
          border-radius: var(--radius-md);
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          pointer-events: none;
          box-shadow: 0 0 20px color-mix(in srgb, var(--slider-color) 30%, transparent);
        }

        .switch-option {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-xs);
          padding: var(--space-md) var(--space-sm);
          background: transparent;
          border: none;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 0.2s ease;
          z-index: 1;
        }

        .switch-option:hover {
          transform: scale(1.02);
        }

        .switch-option .option-icon {
          font-size: 1.5rem;
          transition: filter 0.3s ease;
        }

        .switch-option.active .option-icon {
          filter: drop-shadow(0 0 10px var(--option-color));
        }

        .switch-option .option-label {
          font-family: var(--font-display);
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-muted);
          transition: color 0.3s ease;
        }

        .switch-option.active .option-label {
          color: var(--option-color);
        }

        .option-glow {
          position: absolute;
          inset: 0;
          background: radial-gradient(
            ellipse at center,
            color-mix(in srgb, var(--option-color) 10%, transparent) 0%,
            transparent 70%
          );
          pointer-events: none;
        }

        .selene-info {
          display: flex;
          flex-direction: column;
          gap: var(--space-sm);
          padding: var(--space-md);
          background: var(--bg-deep);
          border-radius: var(--radius-md);
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .selene-stat {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
        }

        .stat-label {
          font-size: 0.75rem;
          color: var(--text-muted);
          min-width: 70px;
        }

        .stat-bar {
          flex: 1;
          height: 6px;
          background: var(--bg-surface);
          border-radius: var(--radius-full);
          overflow: hidden;
        }

        .stat-fill {
          height: 100%;
          background: var(--accent-secondary);
          border-radius: var(--radius-full);
          transition: width 0.5s ease;
        }

        .stat-fill.health {
          background: var(--accent-success);
        }

        .stat-value {
          font-family: var(--font-mono);
          font-size: 0.75rem;
          color: var(--text-secondary);
          min-width: 35px;
          text-align: right;
        }
      `}</style>
    </div>
  )
}

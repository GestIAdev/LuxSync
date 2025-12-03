/**
 * 🔴 BLACKOUT - Botón maestro de apagado
 * El gran botón rojo de emergencia
 */

import { useLuxSyncStore } from '../stores/luxsyncStore'

export default function Blackout() {
  const { blackout, toggleBlackout } = useLuxSyncStore()

  return (
    <div className="blackout-container">
      <button 
        className={`blackout-btn ${blackout ? 'active' : ''}`}
        onClick={toggleBlackout}
      >
        <span className="blackout-icon">■</span>
        <span className="blackout-label">BLACKOUT MASTER</span>
        {blackout && <div className="blackout-glow" />}
      </button>

      <style>{`
        .blackout-container {
          padding: var(--space-md) var(--space-lg);
          background: linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-deep) 100%);
          border-top: 1px solid var(--border-subtle);
        }

        .blackout-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-md);
          padding: var(--space-lg);
          background: linear-gradient(135deg, #1a0000 0%, #0a0000 100%);
          border: 2px solid #331111;
          border-radius: var(--radius-lg);
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
        }

        .blackout-btn:hover {
          border-color: var(--accent-danger);
          background: linear-gradient(135deg, #2a0000 0%, #1a0000 100%);
        }

        .blackout-btn.active {
          background: linear-gradient(135deg, var(--accent-danger) 0%, #aa0000 100%);
          border-color: #ff4444;
          box-shadow: 
            0 0 30px rgba(255, 0, 0, 0.5),
            inset 0 0 30px rgba(255, 255, 255, 0.1);
          animation: blackout-pulse 0.5s ease-in-out infinite alternate;
        }

        @keyframes blackout-pulse {
          from { 
            box-shadow: 
              0 0 30px rgba(255, 0, 0, 0.5),
              inset 0 0 30px rgba(255, 255, 255, 0.1);
          }
          to { 
            box-shadow: 
              0 0 50px rgba(255, 0, 0, 0.8),
              inset 0 0 50px rgba(255, 255, 255, 0.2);
          }
        }

        .blackout-icon {
          font-size: 1.5rem;
          color: var(--accent-danger);
          transition: all 0.2s ease;
        }

        .blackout-btn.active .blackout-icon {
          color: white;
          text-shadow: 0 0 10px white;
        }

        .blackout-label {
          font-family: var(--font-display);
          font-size: 1rem;
          font-weight: 700;
          letter-spacing: 0.2em;
          color: var(--accent-danger);
          transition: all 0.2s ease;
        }

        .blackout-btn.active .blackout-label {
          color: white;
          text-shadow: 0 0 10px white;
        }

        .blackout-glow {
          position: absolute;
          inset: 0;
          background: radial-gradient(
            circle at center,
            rgba(255, 255, 255, 0.2) 0%,
            transparent 70%
          );
          animation: glow-rotate 2s linear infinite;
        }

        @keyframes glow-rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* Keyboard hint */
        .blackout-btn::after {
          content: 'SPACE';
          position: absolute;
          bottom: var(--space-xs);
          right: var(--space-md);
          font-family: var(--font-mono);
          font-size: 0.625rem;
          color: var(--text-muted);
          opacity: 0.5;
        }
      `}</style>
    </div>
  )
}

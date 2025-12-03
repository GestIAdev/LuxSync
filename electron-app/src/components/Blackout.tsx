/**
 * 🔴 BLACKOUT MASTER - Botón de emergencia GENEROSO
 * El gran botón rojo que todo DJ necesita
 */

import { useEffect } from 'react'
import { useLuxSyncStore } from '../stores/luxsyncStore'

export default function Blackout() {
  const { blackout, toggleBlackout } = useLuxSyncStore()

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC para salir del blackout
      if (e.key === 'Escape' && blackout) {
        toggleBlackout()
      }
      // SPACE para toggle (solo si no está en un input)
      if (e.key === ' ' && e.target === document.body) {
        e.preventDefault()
        toggleBlackout()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [blackout, toggleBlackout])

  return (
    <button 
      className={`blackout-btn ${blackout ? 'active' : ''}`}
      onClick={toggleBlackout}
    >
      <div className="blackout-content">
        <span className="blackout-icon">■</span>
        <span className="blackout-label">BLACKOUT MASTER</span>
        <span className="blackout-hint">[SPACE]</span>
      </div>
      
      {blackout && <div className="danger-pulse" />}

      <style>{`
        .blackout-btn {
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(180deg, #1a0505 0%, #0a0000 100%);
          border: 2px solid #331111;
          border-radius: var(--radius-lg);
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
        }

        .blackout-btn:hover {
          border-color: var(--accent-danger);
          background: linear-gradient(180deg, #2a0808 0%, #1a0303 100%);
          box-shadow: 0 0 20px rgba(255, 0, 0, 0.2);
        }

        .blackout-btn.active {
          background: linear-gradient(180deg, var(--accent-danger) 0%, #990000 100%);
          border-color: #ff4444;
          box-shadow: 
            0 0 40px rgba(255, 0, 0, 0.6),
            inset 0 0 30px rgba(255, 255, 255, 0.1);
          animation: danger-border 0.3s infinite alternate;
        }

        @keyframes danger-border {
          from { border-color: #ff4444; }
          to { border-color: #ff0000; }
        }

        .blackout-content {
          display: flex;
          align-items: center;
          gap: var(--space-md);
          z-index: 1;
        }

        .blackout-icon {
          font-size: 1.5rem;
          color: var(--accent-danger);
          transition: all 0.2s ease;
        }

        .blackout-btn.active .blackout-icon {
          color: white;
          filter: drop-shadow(0 0 15px #ff0000);
          animation: icon-pulse 0.5s infinite alternate;
        }

        @keyframes icon-pulse {
          from { transform: scale(1); }
          to { transform: scale(1.1); }
        }

        .blackout-label {
          font-family: var(--font-display);
          font-size: 1rem;
          font-weight: 900;
          letter-spacing: 0.15em;
          color: var(--accent-danger);
          transition: all 0.2s ease;
        }

        .blackout-btn.active .blackout-label {
          color: white;
          text-shadow: 0 0 20px #ff0000;
        }

        .blackout-hint {
          font-family: var(--font-mono);
          font-size: 0.65rem;
          color: var(--text-muted);
          opacity: 0.5;
        }

        .blackout-btn.active .blackout-hint {
          color: rgba(255,255,255,0.5);
        }

        .danger-pulse {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at center, rgba(255, 0, 0, 0.3) 0%, transparent 70%);
          animation: pulse-danger 0.8s ease-in-out infinite;
        }

        @keyframes pulse-danger {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
      `}</style>
    </button>
  )
}

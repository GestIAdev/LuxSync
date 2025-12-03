/**
 * 🚀 LUXSYNC - APP PRINCIPAL
 * La Nave Espacial de Iluminación - FILL SCREEN MODE
 */

import Header from './components/Header'
import BigSwitch from './components/BigSwitch'
import PaletteReactor from './components/PaletteReactor'
import MovementControl from './components/MovementControl'
import EffectsBar from './components/EffectsBar'
import Blackout from './components/Blackout'
import { useLuxSyncStore } from './stores/luxsyncStore'

function App() {
  const { blackout, toggleBlackout } = useLuxSyncStore()

  return (
    <div className="app-container">
      {/* Header - Status Bar (FIJO) */}
      <Header />

      {/* Main Content - FLEX GROW para llenar espacio */}
      <main className="main-content">
        {/* Left Column - Big Switch */}
        <section className="left-column">
          <BigSwitch />
        </section>

        {/* Right Column - Controls */}
        <section className="right-column">
          <PaletteReactor />
          <MovementControl />
        </section>
      </main>

      {/* Footer - Effects & Blackout (FIJO GENEROSO) */}
      <footer className="footer-bar">
        <EffectsBar />
        <Blackout />
      </footer>

      {/* Blackout Overlay */}
      {blackout && (
        <div className="blackout-overlay" onClick={toggleBlackout}>
          <span className="blackout-text">BLACKOUT</span>
          <span className="blackout-hint">Click o ESC para salir</span>
        </div>
      )}

      <style>{`
        .app-container {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: var(--bg-deepest);
          overflow: hidden;
        }

        /* MAIN - SE ESTIRA para llenar todo */
        .main-content {
          flex: 1;
          display: grid;
          grid-template-columns: 240px 1fr;
          gap: var(--space-md);
          padding: var(--space-sm) var(--space-md);
          overflow: hidden;
          min-height: 0;
        }

        .left-column {
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
        }

        .right-column {
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
          min-height: 0;
        }

        /* FOOTER - Fijo pero generoso */
        .footer-bar {
          flex: 0 0 auto;
          display: flex;
          flex-direction: column;
          gap: var(--space-xs);
          padding: var(--space-sm) var(--space-md) var(--space-md);
          background: linear-gradient(180deg, transparent 0%, var(--bg-surface) 30%);
          border-top: 1px solid var(--border-subtle);
        }

        .blackout-overlay {
          position: fixed;
          inset: 0;
          background: #000;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: var(--z-overlay);
          animation: fade-in 0.2s ease-out;
          cursor: pointer;
        }

        .blackout-text {
          font-family: var(--font-display);
          font-size: 4rem;
          font-weight: 900;
          color: var(--accent-danger);
          text-shadow: 0 0 30px var(--accent-danger);
          animation: pulse-glow 1s ease-in-out infinite;
        }

        .blackout-hint {
          margin-top: var(--space-lg);
          font-size: 0.875rem;
          color: var(--text-muted);
          opacity: 0.5;
        }

        @keyframes pulse-glow {
          0%, 100% { opacity: 1; text-shadow: 0 0 30px var(--accent-danger); }
          50% { opacity: 0.7; text-shadow: 0 0 60px var(--accent-danger); }
        }

        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )
}

export default App

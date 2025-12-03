/**
 * 🚀 LUXSYNC - APP PRINCIPAL
 * La Nave Espacial de Iluminación
 */

import Header from './components/Header'
import BigSwitch from './components/BigSwitch'
import PaletteReactor from './components/PaletteReactor'
import MovementControl from './components/MovementControl'
import EffectsBar from './components/EffectsBar'
import Blackout from './components/Blackout'
import { useLuxSyncStore } from './stores/luxsyncStore'

function App() {
  const { blackout } = useLuxSyncStore()

  return (
    <div className="app-container">
      {/* Header - Status Bar */}
      <Header />

      {/* Main Content */}
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

      {/* Footer - Effects & Blackout */}
      <EffectsBar />
      <Blackout />

      {/* Blackout Overlay */}
      {blackout && (
        <div className="blackout-overlay">
          <span className="blackout-text">BLACKOUT</span>
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

        .main-content {
          flex: 1;
          display: grid;
          grid-template-columns: 380px 1fr;
          gap: var(--space-lg);
          padding: var(--space-lg);
          overflow: hidden;
        }

        .left-column {
          display: flex;
          flex-direction: column;
          gap: var(--space-lg);
        }

        .right-column {
          display: flex;
          flex-direction: column;
          gap: var(--space-lg);
        }

        .blackout-overlay {
          position: fixed;
          inset: 0;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: var(--z-overlay);
          animation: fade-in 0.2s ease-out;
        }

        .blackout-text {
          font-family: var(--font-display);
          font-size: 4rem;
          font-weight: 900;
          color: var(--accent-danger);
          text-shadow: 0 0 30px var(--accent-danger);
          animation: pulse-glow 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}

export default App

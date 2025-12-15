/**
 * 🚀 LUXSYNC - APP PRINCIPAL
 * La Nave Espacial de Iluminación - FILL SCREEN MODE
 * 
 * Wave 3: Conectado con Selene Lux Core via Audio Capture
 */

import { useEffect } from 'react'
import Header from './components/Header'
import BigSwitch from './components/BigSwitch'
import PaletteReactor from './components/PaletteReactor'
import MovementControl from './components/MovementControl'
import EffectsBar from './components/EffectsBar'
import Blackout from './components/Blackout'
import { useLuxSyncStore } from './stores/luxsyncStore'
import { useAudioCapture } from './hooks'
import { useSelene } from './hooks'
import { initializeLogIPC } from './stores/logStore'

function App() {
  const { blackout, toggleBlackout, updateAudio } = useLuxSyncStore()
  const { metrics, isCapturing, startCapture, setSimulationMode } = useAudioCapture()
  const { start: startSelene, isRunning } = useSelene()

  // Iniciar Selene y Audio al montar
  useEffect(() => {
    const initSystem = async () => {
      console.log('[App] 🚀 Initializing LuxSync System...')
      
      // 📜 WAVE 25.7: Initialize Log IPC listener
      const cleanupLogs = initializeLogIPC()
      
      // Iniciar Selene en Main Process
      if (window.lux) {
        await startSelene()
        console.log('[App] ✅ Selene started')
      }
      
      // Iniciar captura de audio (con fallback a simulación)
      setSimulationMode(true) // Empezar con simulación para demo
      await startCapture()
      console.log('[App] 🎵 Audio capture started')
      
      return cleanupLogs
    }

    initSystem()
  }, []) // Solo al montar

  // Sincronizar métricas de audio con el store de Zustand
  useEffect(() => {
    if (isCapturing && metrics) {
      updateAudio({
        bass: metrics.bass,
        mid: metrics.mid,
        treble: metrics.treble,
        energy: metrics.energy,
        bpm: metrics.bpm,
        beatSync: metrics.onBeat,
      })
    }
  }, [metrics, isCapturing, updateAudio])

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

      {/* System Status Indicator */}
      <div className="system-status">
        <span className={`status-dot ${isRunning ? 'active' : ''}`} />
        <span className="status-text">
          {isRunning ? 'SELENE ACTIVE' : 'OFFLINE'}
        </span>
        {isCapturing && (
          <span className="audio-indicator">🎵</span>
        )}
      </div>

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

        /* System Status Indicator */
        .system-status {
          position: fixed;
          bottom: var(--space-md);
          left: var(--space-md);
          display: flex;
          align-items: center;
          gap: var(--space-xs);
          padding: var(--space-xs) var(--space-sm);
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          font-size: 0.7rem;
          z-index: 100;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--accent-danger);
          transition: background 0.3s ease;
        }

        .status-dot.active {
          background: var(--accent-success);
          box-shadow: 0 0 8px var(--accent-success);
          animation: pulse-dot 2s ease-in-out infinite;
        }

        .status-text {
          font-family: var(--font-mono);
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .audio-indicator {
          animation: bounce 0.5s ease infinite;
        }

        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
      `}</style>
    </div>
  )
}

export default App

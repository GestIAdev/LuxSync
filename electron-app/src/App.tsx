/**
 * 🚀 LUXSYNC - APP PRINCIPAL
 * La Nave Espacial de Iluminación - FILL SCREEN MODE
 * 
 * Wave 3: Conectado con Selene Lux Core via Audio Capture
 * Wave 33.3: Cleaned up legacy components (moved to StageViewDual)
 * WAVE 264.6: Eliminado useAudioCapture duplicado - TrinityProvider maneja audio
 * WAVE 377: Added TitanSyncBridge for auto-sync stageStore → Backend
 */

import { useEffect } from 'react'
import Header from './components/Header'
import BigSwitch from './components/BigSwitch'
import EffectsBar from './components/EffectsBar'
import { useLuxSyncStore, selectAppMain } from './stores/luxsyncStore'
import { useSelene } from './hooks'
import { useAudioStore, selectAudioMetrics } from './stores/audioStore'
import { initializeLogIPC } from './stores/logStore'
import { TitanSyncBridge } from './core/sync'
import { useShallow } from 'zustand/shallow'

function App() {
  // 🛡️ WAVE 2042.13.5: useShallow para evitar infinite loop
  const { blackout, toggleBlackout, updateAudio } = useLuxSyncStore(useShallow(selectAppMain))
  // 🛡️ WAVE 2042.13.4: Use stable selector to prevent infinite loops
  const audioMetrics = useAudioStore(useShallow(selectAudioMetrics))
  const { start: startSelene, isRunning } = useSelene()

  // Iniciar Selene al montar
  // 🔧 WAVE 264.6: Audio capture ahora es responsabilidad de TrinityProvider
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
      
      // 🔧 WAVE 264.6: Audio capture se inicia en TrinityProvider, no aquí
      console.log('[App] 📡 Waiting for TrinityProvider to start audio capture...')
      
      return cleanupLogs
    }

    initSystem()
  }, []) // Solo al montar

  // Sincronizar métricas de audio de audioStore → luxSyncStore
  // 🔧 WAVE 264.6: Ahora lee de audioStore (single source of truth)
  useEffect(() => {
    if (audioMetrics.isConnected) {
      updateAudio({
        bass: audioMetrics.bass,
        mid: audioMetrics.mid,
        treble: audioMetrics.treble,
        energy: (audioMetrics.bass + audioMetrics.mid + audioMetrics.treble) / 3,
        bpm: audioMetrics.bpm,
        beatSync: audioMetrics.onBeat,
      })
    }
  }, [audioMetrics, updateAudio])

  return (
    <div className="app-container">
      {/* 🌉 WAVE 377: Invisible Sync Bridge - stageStore → Backend */}
      <TitanSyncBridge />
      
      {/* Header - Status Bar (FIJO) */}
      <Header />

      {/* Main Content - FLEX GROW para llenar espacio */}
      <main className="main-content">
        {/* Left Column - Big Switch */}
        <section className="left-column">
          <BigSwitch />
        </section>

        {/* Right Column - Controls (Legacy removed in WAVE 33.3, now in StageViewDual sidebar) */}
        <section className="right-column">
          {/* PaletteControlMini and MovementRadar are now in GlobalControls */}
          <p style={{ color: '#666', fontSize: '12px', padding: '20px' }}>
            ℹ️ Use StageViewDual for new controls
          </p>
        </section>
      </main>

      {/* Footer - Effects & Blackout (FIJO GENEROSO) */}
      <footer className="footer-bar">
        <EffectsBar />
      </footer>

      {/* System Status Indicator */}
      <div className="system-status">
        <span className={`status-dot ${isRunning ? 'active' : ''}`} />
        <span className="status-text">
          {isRunning ? 'SELENE ACTIVE' : 'OFFLINE'}
        </span>
        {audioMetrics.isConnected && (
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

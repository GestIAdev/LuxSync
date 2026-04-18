/**
 * 🚀 LUXSYNC - MAIN ENTRY POINT
 * WAVE 9: Commander Layout → AppCommander
 * WAVE 2097.1: Purged legacy App.tsx (267 lines of dead code)
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import AppCommander from './AppCommander'
import './styles/globals.css'

// ═══════════════════════════════════════════════════════════════════════════
// 🔇 WAVE 3290: RENDERER SILENCED — Blackout total del proceso renderer.
// El renderer (React/Vite) no emite logs de conciencia. Todo lo que sale
// de aquí es ruido: [GOD EAR], [BETA], [AGC], [INTERVAL], senses, FFT...
// La narrativa de Selene corre exclusivamente en el main process.
//
// DEBUG PROBE — Reactivar para auditoría del renderer.
// ─────────────────────────────────────────────────────────────────────────────
;(function installRendererBlackout() {
  const _noop = () => { /* BLACKOUT — WAVE 3290 */ }
  console.log   = _noop
  console.info  = _noop
  console.debug = _noop
  console.warn  = _noop
  console.error = _noop
})()
// ─────────────────────────────────────────────────────────────────────────────

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppCommander />
  </React.StrictMode>,
)

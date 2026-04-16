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
// 🔇 OPERACIÓN BLACKOUT — I/O SILENCE (RENDERER PROCESS)
// Silencia todos los console.* del renderer (incluyendo workers inline).
// RESTAURAR: comentar este bloque completo.
// ─────────────────────────────────────────────────────────────────────────────
;(function installRendererBlackout() {
  const _noop = () => { /* BLACKOUT */ }
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

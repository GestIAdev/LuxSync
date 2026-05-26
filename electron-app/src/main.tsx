/**
 * 🚀 LUXSYNC - MAIN ENTRY POINT
 * WAVE 9: Commander Layout → AppCommander
 * WAVE 2097.1: Purged legacy App.tsx (267 lines of dead code)
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import AppCommander from './AppCommander'
import TheiaOutputView from './components/views/TheiaOutputView'  // 🎬 WAVE 4864
import './styles/globals.css'

// 🎬 WAVE 4864 — Theia Output Window: ventana secundaria del proyector.
// Misma URL/bundle que la app principal pero con flag ?theia-output=1.
// Branchea aquí para evitar montar todo el AppCommander cuando solo
// necesitamos un canvas hiper-ligero que blittea el SAB.
const isTheiaOutputWindow = (() => {
  try {
    const params = new URLSearchParams(window.location.search)
    return params.get('theia-output') === '1'
  } catch {
    return false
  }
})()

// ═══════════════════════════════════════════════════════════════════════════
// 🔇 WAVE 3290: RENDERER SILENCED — Blackout total del proceso renderer.
// El renderer (React/Vite) no emite logs de conciencia. Todo lo que sale
// de aquí es ruido: [GOD EAR], [BETA], [AGC], [INTERVAL], senses, FFT...
// La narrativa de Selene corre exclusivamente en el main process.
//
// 🔓 WAVE 4571: RENDERER BLACKOUT DISABLED — F12 console ahora visible
// ─────────────────────────────────────────────────────────────────────────────
// ;(function installRendererBlackout() {
//   const _noop = () => { /* BLACKOUT — WAVE 3290 */ }
//   console.log   = _noop
//   console.info  = _noop
//   console.debug = _noop
//   console.warn  = _noop
//   console.error = _noop
// })()
// ─────────────────────────────────────────────────────────────────────────────

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isTheiaOutputWindow ? <TheiaOutputView /> : <AppCommander />}
  </React.StrictMode>,
)

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

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 7608: CRYSTAL BOX UNLOCK — Dev console exposure for stage dimensions
// Allows the Architect to change stage dimensions from DevTools console
// without needing a UI panel. Essential for warehouse testing where the
// physical room may be larger than the default 12×8×6m.
//
// Usage in DevTools console:
//   __lux.setStage({ width: 20, depth: 15, height: 8 })
//   __lux.getStage()
//   __lux.resetStage()
// ═══════════════════════════════════════════════════════════════════════════
;(async function exposeStageDevAPI() {
  try {
    const { useStageStore } = await import('./stores/stageStore')
    const api = {
      setStage: (dims: { width?: number; depth?: number; height?: number; gridSize?: number }) => {
        useStageStore.getState().updateStageDimensions(dims)
        const stage = useStageStore.getState().showFile?.stage
        console.log('[WAVE 7608] Stage dimensions updated:', stage)
      },
      getStage: () => {
        const stage = useStageStore.getState().showFile?.stage
        console.log('[WAVE 7608] Current stage dimensions:', stage)
        return stage
      },
      resetStage: () => {
        useStageStore.getState().updateStageDimensions({ width: 50, depth: 25, height: 15, gridSize: 0.25 })
        console.log('[WAVE 7609] Stage dimensions reset to 50×25×15m (warehouse-scale)')
      },
    }
    ;(window as any).__lux = api
    console.log('[WAVE 7608] Crystal Box unlocked. Use __lux.setStage({width,depth,height}) in console.')
  } catch (e) {
    console.warn('[WAVE 7608] Failed to expose stage dev API:', e)
  }
})()

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

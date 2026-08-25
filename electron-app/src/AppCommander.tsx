/**
 * 🚀 LUXSYNC APP - SELENE COMMANDER
 * La Nave Espacial de Iluminación
 * 
 * Arquitectura: Sidebar + Tabs + Global Effects
 * WAVE 377: Added TitanSyncBridge for stageStore → Backend sync
 * WAVE 438: Setup stageStore IPC listeners for show loading
 * WAVE 2049: NetIndicator + MidiLearnOverlay moved to TitleBar
 * WAVE 4800: KeyForge Cortex replaces legacy KeyboardProvider
 */

import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import MainLayout from './components/layout/MainLayout'
import GlassCanvas from './components/GlassCanvas'
import { TrinityProvider } from './providers/TrinityProvider'
import { TitanSyncBridge } from './core/sync'
import { useMidiLearn } from './hooks/useMidiLearn' // 🎹 WAVE 2047: MIDI Input Runtime
import { useKeyboardCortex } from './hooks/useKeyboardCortex' // ⌨ WAVE 4800: KeyForge Cortex
import { useSeleneStore, selectAppCommanderActions } from './stores/seleneStore'
import { useSeleneTruth } from './hooks/useSeleneTruth'
import { usePerformanceHydration } from './hooks/usePerformanceHydration' // 🚀 WAVE 7580: Vanguard Launcher hydration
import { usePerformanceStore, selectIsBlurDisabled } from './stores/performanceStore' // 🌿 WAVE 7582: Blur Killer
import { setupStageStoreListeners } from './stores/stageStore'
import { initializeLogIPC } from './stores/logStore' // 📜 WAVE 1198: THE WARLOG HEARTBEAT
import { useLicenseStore } from './stores/licenseStore' // 🔒 WAVE 2490: THE TIER SEPARATION PROTOCOL
import { initStadiumLoadoutIfEmpty, patchMissingStadiumBindings } from './keyforge/stadiumLoadout' // ⌨ WAVE 4800-F
import { initArsenalCatalog } from './midi/MidiActionRegistry' // ⚡ WAVE 4914: Live effect catalog
import './styles/globals.css'
// 🌿 WAVE 7582: ECO-MODE — imported LAST so it sits at the bottom of the
// cascade and wins over every component stylesheet (audit §3.3). All rules
// are scoped under `body.eco-mode`, so this is a no-op in HQ/balanced modes.
import './styles/eco-mode.css'

function AppContent() {
  // 🛡️ WAVE 2042.13.8: useShallow for stable reference
  const { startSession, addLogEntry } = useSeleneStore(useShallow(selectAppCommanderActions))

  // 🔒 V-06 FIX: License hydration gate — prevents UI flicker where a DJ_FOUNDER
  // briefly sees FULL_SUITE components (Chronos/Hephaestus) before the tier arrives.
  // MainLayout is not rendered until the license tier has been hydrated from main process.
  const [licenseReady, setLicenseReady] = useState(false)

  // Connect to Universal Truth Protocol (SeleneBroadcast @ 30fps)
  useSeleneTruth()

  // 🚀 WAVE 7580: VANGUARD LAUNCHER — hydrate the render fidelity tier chosen
  // pre-boot into usePerformanceStore. Runs once; the module-scoped
  // `_hasHydrated` flag inside the hook survives React 19 Strict Mode remount.
  usePerformanceHydration()

  // � WAVE 7582: THE BLUR KILLER — toggle the `eco-mode` class on <body>
  // based on the hydrated performance tier. `selectIsBlurDisabled` is true for
  // both 'balanced' and 'eco' (tier !== 'hq'), so the blur tax is stripped the
  // moment the operator picks anything other than HQ in the Vanguard Launcher.
  // The class gates every rule in eco-mode.css; when it's absent the sheet is
  // a complete no-op, so HQ mode is byte-for-byte unaffected.
  const isBlurDisabled = usePerformanceStore(selectIsBlurDisabled)
  useEffect(() => {
    const body = document.body
    if (isBlurDisabled) {
      body.classList.add('eco-mode')
    } else {
      body.classList.remove('eco-mode')
    }
    // Cleanup on unmount — AppContent is always-mounted, but Strict Mode's
    // mount → unmount → mount cycle in dev would otherwise leave a stale class
    // if the toggle ran before hydration resolved.
    return () => {
      body.classList.remove('eco-mode')
    }
  }, [isBlurDisabled])

  // �🎹 WAVE 2047: Global MIDI input handler (Learn + Runtime dispatch)
  useMidiLearn()

  // ⌨ WAVE 4800: KeyForge global keyboard cortex (replaces KeyboardProvider)
  useKeyboardCortex()

  // Initialize system on mount
  useEffect(() => {
    // 📜 WAVE 1198: Initialize War Log IPC listener
    const cleanupLogs = initializeLogIPC()

    // 🔒 V-06 FIX: AWAIT license hydration before rendering MainLayout.
    // This blocks the tier-gated tabs (Chronos/Hephaestus) from rendering with
    // the default FULL_SUITE tier while the real tier hasn't arrived from main.
    useLicenseStore.getState().hydrate().finally(() => {
      setLicenseReady(true)
    })

    // Start Selene session
    startSession()
    addLogEntry({ type: 'INIT', message: 'LuxSync Commander started' })

    // ⌨ WAVE 4800-F: Load stadium-default bindings on fresh install
    initStadiumLoadoutIfEmpty()
    // ⌨ WAVE 4914: Migrate any missing stadium defaults to existing user stores
    // (new bindings added to stadiumLoadout.ts propagate without wiping user config)
    patchMissingStadiumBindings()

    // ⚡ WAVE 4914: Populate MidiLearn + KeyForge with live .lfx catalog from DynamicEffectRegistry
    initArsenalCatalog()

    // 🔌 WAVE 438: Setup stageStore IPC listeners
    const unsubscribeStageListeners = setupStageStoreListeners()

    // 🌊 WAVE 6060: El layout se sincroniza bidireccionalmente vía TitanSyncBridge
    // tras setFixtures (backend detecta por fixtures) + botón manual del usuario.
    // NO forzar persistedLayout al boot — evita desfase cuando el backend detecta
    // 7.1 por posición de fixtures pero el store persistió 4.1.

    // 🧹 WAVE 63.7: Single clean log
    console.log('[Selene UI] 🚀 System Ready')

    // Cleanup on unmount
    return () => {
      cleanupLogs()
      unsubscribeStageListeners()
    }
  }, [startSession, addLogEntry])

  // ─── WAVE 4910.9-B: Drag-global guard ────────────────────────────────────
  // Viviendo aquí (AppContent = siempre montado) el preventDefault es permanente.
  // Sin esto, cualquier vista que no tenga TheiaEngineView montada muestra el
  // cursor de "prohibido" al arrastrar un archivo encima de la app.
  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    const onDragOver = (e: DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    const onDrop = (e: DragEvent) => {
      e.preventDefault() // evita que Electron navegue al file://
    }
    document.addEventListener('dragenter', onDragEnter, true)
    document.addEventListener('dragover', onDragOver, true)
    window.addEventListener('dragenter', onDragEnter, true)
    window.addEventListener('dragover', onDragOver, true)
    document.addEventListener('drop', onDrop, true)
    window.addEventListener('drop', onDrop, true)
    return () => {
      document.removeEventListener('dragenter', onDragEnter, true)
      document.removeEventListener('dragover', onDragOver, true)
      window.removeEventListener('dragenter', onDragEnter, true)
      window.removeEventListener('dragover', onDragOver, true)
      document.removeEventListener('drop', onDrop, true)
      window.removeEventListener('drop', onDrop, true)
    }
  }, [])

  return (
    <>
      {/* 🌉 WAVE 377: Invisible Sync Bridge - stageStore → Backend */}
      <TitanSyncBridge />
      <GlassCanvas />

      {/* 🔒 V-06 FIX: Gate MainLayout behind license hydration.
          Prevents DJ_FOUNDER from briefly seeing FULL_SUITE tabs (Chronos/Hephaestus)
          before the real tier arrives from the main process via IPC.
          GlassCanvas + TitanSyncBridge run regardless — they don't render tier-gated UI. */}
      {licenseReady ? (
        <MainLayout />
      ) : null}
    </>
  )
}

function App() {
  return (
    <TrinityProvider>
      <AppContent />
    </TrinityProvider>
  )
}

export default App

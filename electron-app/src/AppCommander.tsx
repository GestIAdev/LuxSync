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

import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import MainLayout from './components/layout/MainLayout'
import { TrinityProvider } from './providers/TrinityProvider'
import { TitanSyncBridge } from './core/sync'
import { useMidiLearn } from './hooks/useMidiLearn' // 🎹 WAVE 2047: MIDI Input Runtime
import { useKeyboardCortex } from './hooks/useKeyboardCortex' // ⌨ WAVE 4800: KeyForge Cortex
import { useSeleneStore, selectAppCommanderActions } from './stores/seleneStore'
import { useSeleneTruth } from './hooks/useSeleneTruth'
import { setupStageStoreListeners } from './stores/stageStore'
import { initializeLogIPC } from './stores/logStore' // 📜 WAVE 1198: THE WARLOG HEARTBEAT
import { useLicenseStore } from './stores/licenseStore' // 🔒 WAVE 2490: THE TIER SEPARATION PROTOCOL
import { initStadiumLoadoutIfEmpty } from './keyforge/stadiumLoadout' // ⌨ WAVE 4800-F
import './styles/globals.css'

function AppContent() {
  // 🛡️ WAVE 2042.13.8: useShallow for stable reference
  const { startSession, addLogEntry } = useSeleneStore(useShallow(selectAppCommanderActions))
  
  // Connect to Universal Truth Protocol (SeleneBroadcast @ 30fps)
  useSeleneTruth()

  // 🎹 WAVE 2047: Global MIDI input handler (Learn + Runtime dispatch)
  useMidiLearn()

  // ⌨ WAVE 4800: KeyForge global keyboard cortex (replaces KeyboardProvider)
  useKeyboardCortex()

  // Initialize system on mount
  useEffect(() => {
    // 📜 WAVE 1198: Initialize War Log IPC listener
    const cleanupLogs = initializeLogIPC()

    // 🔒 WAVE 2490: Hydrate license tier from main process
    useLicenseStore.getState().hydrate()

    // Start Selene session
    startSession()
    addLogEntry({ type: 'INIT', message: 'LuxSync Commander started' })
    
    // ⌨ WAVE 4800-F: Load stadium-default bindings on fresh install
    initStadiumLoadoutIfEmpty()

    // 🔌 WAVE 438: Setup stageStore IPC listeners
    const unsubscribeStageListeners = setupStageStoreListeners()
    
    // 🧹 WAVE 63.7: Single clean log
    console.log('[Selene UI] 🚀 System Ready')
    
    // Cleanup on unmount
    return () => {
      cleanupLogs()
      unsubscribeStageListeners()
    }
  }, [startSession, addLogEntry])

  return (
    <>
      {/* 🌉 WAVE 377: Invisible Sync Bridge - stageStore → Backend */}
      <TitanSyncBridge />

      {/* 🎯 WAVE 2049: MainLayout now includes TitleBar with NetIndicator + MidiLearnOverlay */}
      <MainLayout />
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

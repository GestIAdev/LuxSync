/**
 * 🚀 LUXSYNC APP - SELENE COMMANDER
 * La Nave Espacial de Iluminación
 * 
 * Arquitectura: Sidebar + Tabs + Global Effects
 * WAVE 377: Added TitanSyncBridge for stageStore → Backend sync
 * WAVE 438: Setup stageStore IPC listeners for show loading
 */

import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import MainLayout from './components/layout/MainLayout'
import KeyboardProvider from './providers/KeyboardProvider'
import { TrinityProvider } from './providers/TrinityProvider'
import { TitanSyncBridge } from './core/sync'
import NetIndicator from './components/NetIndicator' // 📡 WAVE 2048: Art-Net Discovery
import { useSeleneStore, selectAppCommanderActions } from './stores/seleneStore'
import { useSeleneTruth } from './hooks/useSeleneTruth'
import { setupStageStoreListeners } from './stores/stageStore'
import { initializeLogIPC } from './stores/logStore' // 📜 WAVE 1198: THE WARLOG HEARTBEAT
import './styles/globals.css'

function AppContent() {
  // 🛡️ WAVE 2042.13.8: useShallow for stable reference
  const { startSession, addLogEntry } = useSeleneStore(useShallow(selectAppCommanderActions))
  
  // Connect to Universal Truth Protocol (SeleneBroadcast @ 30fps)
  useSeleneTruth()

  // Initialize system on mount
  useEffect(() => {
    // 📜 WAVE 1198: Initialize War Log IPC listener
    const cleanupLogs = initializeLogIPC()
    
    // Start Selene session
    startSession()
    addLogEntry({ type: 'INIT', message: 'LuxSync Commander started' })
    
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
    <KeyboardProvider>
      {/* 🌉 WAVE 377: Invisible Sync Bridge - stageStore → Backend */}
      <TitanSyncBridge />
      
      <MainLayout />
      
      {/* 📡 WAVE 2048: Art-Net Network Discovery (Fixed Position Overlay) */}
      <NetIndicator />
    </KeyboardProvider>
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

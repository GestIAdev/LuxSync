/**
 * 🚀 LUXSYNC APP - SELENE COMMANDER
 * La Nave Espacial de Iluminación
 * 
 * Arquitectura: Sidebar + Tabs + Global Effects
 * WAVE 377: Added TitanSyncBridge for stageStore → Backend sync
 * WAVE 438: Setup stageStore IPC listeners for show loading
 */

import { useEffect } from 'react'
import MainLayout from './components/layout/MainLayout'
import KeyboardProvider from './providers/KeyboardProvider'
import { TrinityProvider } from './providers/TrinityProvider'
import { TitanSyncBridge } from './core/sync'
import { useSeleneStore } from './stores/seleneStore'
import { useSeleneTruth } from './hooks/useSeleneTruth'
import { setupStageStoreListeners } from './stores/stageStore'
import './styles/globals.css'

function AppContent() {
  const { startSession, addLogEntry } = useSeleneStore()
  
  // Connect to Universal Truth Protocol (SeleneBroadcast @ 30fps)
  useSeleneTruth()

  // Initialize system on mount
  useEffect(() => {
    // Start Selene session
    startSession()
    addLogEntry({ type: 'INIT', message: 'LuxSync Commander started' })
    
    // 🔌 WAVE 438: Setup stageStore IPC listeners
    const unsubscribeStageListeners = setupStageStoreListeners()
    
    // 🧹 WAVE 63.7: Single clean log
    console.log('[Selene UI] 🚀 System Ready')
    
    // Cleanup on unmount
    return () => {
      unsubscribeStageListeners()
    }
  }, [startSession, addLogEntry])

  return (
    <KeyboardProvider>
      {/* 🌉 WAVE 377: Invisible Sync Bridge - stageStore → Backend */}
      <TitanSyncBridge />
      <MainLayout />
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

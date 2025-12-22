/**
 * 🚀 LUXSYNC APP - SELENE COMMANDER
 * La Nave Espacial de Iluminación
 * 
 * Arquitectura: Sidebar + Tabs + Global Effects
 */

import { useEffect } from 'react'
import MainLayout from './components/layout/MainLayout'
import KeyboardProvider from './providers/KeyboardProvider'
import { TrinityProvider } from './providers/TrinityProvider'
import { useSeleneStore } from './stores/seleneStore'
import { useSeleneTruth } from './hooks/useSeleneTruth'
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
    
    // 🧹 WAVE 63.7: Single clean log
    console.log('[Selene UI] 🚀 System Ready')
  }, [startSession, addLogEntry])

  return (
    <KeyboardProvider>
      <MainLayout />
    </KeyboardProvider>
  )
}

function App() {
  return (
    <TrinityProvider autoStart={true}>
      <AppContent />
    </TrinityProvider>
  )
}

export default App

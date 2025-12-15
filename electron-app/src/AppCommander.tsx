/**
 * 🚀 LUXSYNC APP - WAVE 9 COMMANDER LAYOUT
 * La Nave Espacial de Iluminación - Commander Edition
 * 
 * TRINITY PHASE 2: Integración viva Audio → Brain → UI
 * WAVE 25: Universal Truth Protocol
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
  
  // 🌙 WAVE 25: Connect to Universal Truth Protocol
  // This pumps SeleneBroadcast into truthStore at 30fps
  useSeleneTruth()

  // Initialize system on mount
  useEffect(() => {
    console.log('[App] 🚀 WAVE 9 - Commander Layout + TRINITY PHASE 2 + WAVE 25 Truth')
    
    // Start Selene session
    startSession()
    addLogEntry({ type: 'INIT', message: 'LuxSync Commander Layout started' })
    
    console.log('[App] ✅ Commander Layout Ready!')
    console.log('[App] 🔺 Trinity Provider will handle audio + brain connection')
    console.log('[App] 🌙 WAVE 25: Universal Truth Protocol ACTIVE')
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

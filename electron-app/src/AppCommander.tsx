/**
 * 🚀 LUXSYNC APP - WAVE 9 COMMANDER LAYOUT
 * La Nave Espacial de Iluminación - Commander Edition
 * 
 * Arquitectura: Sidebar + Tabs + Global Effects
 */

import { useEffect } from 'react'
import MainLayout from './components/layout/MainLayout'
import KeyboardProvider from './providers/KeyboardProvider'
import { useSeleneStore } from './stores/seleneStore'
import { useAudioStore } from './stores/audioStore'
import './styles/globals.css'

function App() {
  const { startSession, addLogEntry } = useSeleneStore()
  const { updateMetrics } = useAudioStore()

  // Initialize system on mount
  useEffect(() => {
    console.log('[App] 🚀 WAVE 9 - Commander Layout Initializing...')
    
    // Start Selene session
    startSession()
    addLogEntry({ type: 'INIT', message: 'LuxSync Commander Layout started' })
    
    // Simulated audio metrics for demo
    const audioSimulation = setInterval(() => {
      const bpm = 120 + Math.sin(Date.now() / 5000) * 10
      const bass = 0.3 + Math.random() * 0.5
      const mid = 0.2 + Math.random() * 0.4
      const treble = 0.1 + Math.random() * 0.3
      const level = -20 + Math.random() * 15
      
      updateMetrics({ bpm, bass, mid, treble, level })
    }, 100)
    
    console.log('[App] ✅ Commander Layout Ready!')
    
    return () => {
      clearInterval(audioSimulation)
    }
  }, [])

  return (
    <KeyboardProvider>
      <MainLayout />
    </KeyboardProvider>
  )
}

export default App

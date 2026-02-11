/**
 * CONTENT AREA - WAVE 1110: THE GREAT UNBUNDLING
 * 
 * 3 Stages + 4 Tools Architecture:
 *   - dashboard: DashboardView (Command Center + Show Load)
 *   - live: StageViewDual (Performance - 2D/3D) → MOVED to simulator/
 *   - calibration: CalibrationView (Hardware Setup)
 *   - constructor: StageConstructorView (Stage Layout)
 *   - forge: ForgeView (Fixture Definition Editor) - WAVE 1110
 *   - setup: SetupView (Audio + DMX Config)
 *   - core: NeuralCommandView (AI Monitoring) - WAVE 1167
 * 
 * WAVE 379.4: Atomic Handoff for WebGL transitions
 */

import React, { Suspense, lazy, useState, useEffect, useRef } from 'react'
import { useNavigationStore } from '../../stores/navigationStore'
import './ContentArea.css'

// Lazy load views for better performance
const DashboardView = lazy(() => import('../views/DashboardView'))
const StageConstructorView = lazy(() => import('../views/StageConstructorView'))
const LiveStageView = lazy(() => import('../simulator'))
const CalibrationView = lazy(() => import('../views/CalibrationView'))
const ForgeView = lazy(() => import('../views/ForgeView'))  // 🔨 WAVE 1110
const VisualPatcher = lazy(() => import('../views/VisualPatcher/VisualPatcher'))
const NeuralCommandView = lazy(() => import('../views/NeuralCommandView'))  // 🧠 WAVE 1167
const ChronosStudio = lazy(() => import('../../chronos/ui/ChronosLayout'))  // ⏱️ WAVE 2004
const HephaestusView = lazy(() => import('../views/HephaestusView'))  // ⚒️ WAVE 2030.3

// Loading fallback
const ViewLoader: React.FC = () => (
  <div className="view-loader">
    <div className="loader-spinner" />
    <span className="loader-text">Loading...</span>
  </div>
)

// WAVE 379.4: Transition loader (brief flash during GPU handoff)
const TransitionLoader: React.FC = () => (
  <div className="view-loader transition-loader">
    <div className="loader-spinner fast" />
  </div>
)

// WAVE 428: Vistas que tienen WebGL Canvas pesado
// WAVE 429: SETUP no es WebGL, solo audio inputs + DMX config
const WEBGL_VIEWS = ['live', 'calibration', 'constructor', 'nexus']

// WAVE 379.4: Tiempo de "aire" para que la GPU respire (ms)
const GPU_HANDOFF_DELAY = 150

const ContentArea: React.FC = () => {
  const { activeTab } = useNavigationStore()
  
  // WAVE 379.4: ATOMIC HANDOFF STATE
  const [renderedTab, setRenderedTab] = useState<string | null>(activeTab)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const previousTabRef = useRef<string>(activeTab)
  
  // WAVE 379.4: Detectar si es transicion entre vistas WebGL pesadas
  useEffect(() => {
    const previousTab = previousTabRef.current
    const isHeavyTransition = 
      WEBGL_VIEWS.includes(previousTab) && 
      WEBGL_VIEWS.includes(activeTab) && 
      previousTab !== activeTab
    
    if (isHeavyTransition) {
      // ATOMIC HANDOFF: Transicion entre dos vistas WebGL
      console.log(`[ContentArea] ATOMIC HANDOFF: ${previousTab} -> ${activeTab}`)
      
      // Paso 1: Matar el componente actual (PUNTO MUERTO)
      setIsTransitioning(true)
      setRenderedTab(null)
      
      // Paso 2: Esperar a que la GPU respire
      const timer = setTimeout(() => {
        // Paso 3: Montar el nuevo componente en contexto limpio
        setRenderedTab(activeTab)
        setIsTransitioning(false)
        console.log(`[ContentArea] HANDOFF COMPLETE: ${activeTab} mounted`)
      }, GPU_HANDOFF_DELAY)
      
      previousTabRef.current = activeTab
      return () => clearTimeout(timer)
    } else {
      // Transicion normal (no WebGL -> WebGL)
      setRenderedTab(activeTab)
      previousTabRef.current = activeTab
    }
  }, [activeTab])

  const renderView = () => {
    // WAVE 379.4: Si estamos en transicion, no renderizar nada
    if (isTransitioning || renderedTab === null) {
      return <TransitionLoader />
    }
    
    // WAVE 1110: 3 Stages + 4 Tools routing (Forge promoted)
    switch (renderedTab) {
      case 'dashboard':
        return <DashboardView />
      case 'constructor':
        return <StageConstructorView />
      case 'live':
        return <LiveStageView />
      case 'calibration':
        return <CalibrationView />
      case 'forge':
        return <ForgeView />  // 🔨 WAVE 1110
      case 'chronos':
        return <ChronosStudio />  // ⏱️ WAVE 2004
      case 'hephaestus':
        return <HephaestusView />  // ⚒️ WAVE 2030.3
      case 'nexus':
        return <VisualPatcher />
      case 'core':
        return <NeuralCommandView />  // 🧠 WAVE 1167
      default:
        return <DashboardView />
    }
  }

  return (
    <main className="content-area">
      <Suspense fallback={<ViewLoader />}>
        {/* WAVE 379.4: key fuerza unmount cuando renderedTab cambia */}
        <div className="view-container" key={renderedTab || 'transitioning'}>
          {renderView()}
        </div>
      </Suspense>
    </main>
  )
}

export default ContentArea

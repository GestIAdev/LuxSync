/**
 * CONTENT AREA - WAVE 428: Full System Restore
 * 
 * 4 Stages + 2 Tools Architecture:
 *   - dashboard: DashboardView (Command Center + Show Load)
 *   - constructor: StageConstructorView (Fixture Creation)
 *   - live: StageViewDual (Performance - 2D/3D)
 *   - calibration: CalibrationView (Hardware Setup)
 *   - setup: SetupView (Audio + DMX Config)
 *   - core: LuxCoreView (AI Monitoring)
 * 
 * WAVE 379.4: Atomic Handoff for WebGL transitions
 */

import React, { Suspense, lazy, useState, useEffect, useRef } from 'react'
import { useNavigationStore } from '../../stores/navigationStore'
import './ContentArea.css'

// Lazy load views for better performance
// WAVE 428: Full routing structure
const DashboardView = lazy(() => import('../views/DashboardView'))
const StageConstructorView = lazy(() => import('../views/StageConstructorView'))
const LiveStageView = lazy(() => import('../views/StageViewDual'))
const CalibrationView = lazy(() => import('../views/CalibrationView'))
const SetupView = lazy(() => import('../views/SetupView'))
const LuxCoreView = lazy(() => import('../views/LuxCoreView'))

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
const WEBGL_VIEWS = ['live', 'calibration', 'constructor']

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
    
    // WAVE 428: 4 Stages + 2 Tools routing
    switch (renderedTab) {
      case 'dashboard':
        return <DashboardView />
      case 'constructor':
        return <StageConstructorView />
      case 'live':
        return <LiveStageView />
      case 'calibration':
        return <CalibrationView />
      case 'setup':
        return <SetupView />
      case 'core':
        return <LuxCoreView />
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

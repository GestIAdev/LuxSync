/**
 * 📺 CONTENT AREA - Dynamic View Container
 * WAVE 9: Renders active view based on navigation state
 * WAVE 25.5: SimulateView now uses StageSimulator2 (Canvas 2.0)
 * WAVE 361: Added StageConstructorView for CONSTRUCT tab
 * WAVE 379.3: Exclusive rendering - unmount 3D views properly
 */

import React, { Suspense, lazy } from 'react'
import { useNavigationStore } from '../../stores/navigationStore'
import './ContentArea.css'

// Lazy load views for better performance
const LiveView = lazy(() => import('../views/LiveView'))
// 🌙 WAVE 25.5: El Cambiazo - SimulateView ahora es StageSimulator2
const SimulateView = lazy(() => import('../views/StageView'))
const LuxCoreView = lazy(() => import('../views/LuxCoreView'))
const SetupView = lazy(() => import('../views/SetupView'))
// 🏗️ WAVE 361: Stage Constructor
const StageConstructorView = lazy(() => import('../views/StageConstructorView'))

// Loading fallback
const ViewLoader: React.FC = () => (
  <div className="view-loader">
    <div className="loader-spinner" />
    <span className="loader-text">Loading...</span>
  </div>
)

// 🔥 WAVE 379.3: Vistas que tienen WebGL Canvas y necesitan unmount exclusivo
const WEBGL_VIEWS = ['constructor', 'simulate']

const ContentArea: React.FC = () => {
  const { activeTab } = useNavigationStore()
  
  // 🔥 WAVE 379.3: Key para forzar unmount de vistas WebGL
  // Solo aplicamos key cuando la vista tiene Canvas 3D para garantizar limpieza
  const viewKey = WEBGL_VIEWS.includes(activeTab) ? activeTab : 'standard'

  const renderView = () => {
    switch (activeTab) {
      case 'live':
        return <LiveView />
      case 'simulate':
        return <SimulateView />
      case 'constructor':
        return <StageConstructorView />
      case 'core':
        return <LuxCoreView />
      case 'setup':
        return <SetupView />
      default:
        return <LiveView />
    }
  }

  return (
    <main className="content-area">
      <Suspense fallback={<ViewLoader />}>
        {/* � WAVE 379.3: key={viewKey} fuerza unmount real al cambiar entre vistas WebGL */}
        {/* Esto garantiza que R3F limpie el Canvas antes de montar uno nuevo */}
        <div className="view-container" key={viewKey}>
          {renderView()}
        </div>
      </Suspense>
    </main>
  )
}

export default ContentArea

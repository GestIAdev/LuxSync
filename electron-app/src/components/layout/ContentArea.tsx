/**
 * 📺 CONTENT AREA - Dynamic View Container
 * WAVE 9: Renders active view based on navigation state
 */

import React, { Suspense, lazy } from 'react'
import { useNavigationStore } from '../../stores/navigationStore'
import './ContentArea.css'

// Lazy load views for better performance
const LiveView = lazy(() => import('../views/LiveView'))
const SimulateView = lazy(() => import('../views/SimulateView'))
const SeleneLuxView = lazy(() => import('../views/SeleneLuxView'))
const SetupView = lazy(() => import('../views/SetupView'))

// Loading fallback
const ViewLoader: React.FC = () => (
  <div className="view-loader">
    <div className="loader-spinner" />
    <span className="loader-text">Loading...</span>
  </div>
)

const ContentArea: React.FC = () => {
  const { activeTab } = useNavigationStore()

  const renderView = () => {
    switch (activeTab) {
      case 'live':
        return <LiveView />
      case 'simulate':
        return <SimulateView />
      case 'selene':
        return <SeleneLuxView />
      case 'setup':
        return <SetupView />
      default:
        return <LiveView />
    }
  }

  return (
    <main className="content-area">
      <Suspense fallback={<ViewLoader />}>
        <div className="view-container" key={activeTab}>
          {renderView()}
        </div>
      </Suspense>
    </main>
  )
}

export default ContentArea

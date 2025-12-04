/**
 * 🏗️ MAIN LAYOUT - Commander Layout Structure
 * WAVE 9: Sidebar + Content Area + Global Effects Bar
 */

import React from 'react'
import Sidebar from './Sidebar'
import ContentArea from './ContentArea'
import GlobalEffectsBar from './GlobalEffectsBar'
import BlackoutOverlay from './BlackoutOverlay'
import { useEffectsStore } from '../../stores'
import './MainLayout.css'

const MainLayout: React.FC = () => {
  const { blackout } = useEffectsStore()

  return (
    <div className="main-layout">
      {/* Sidebar - Fixed 280px */}
      <Sidebar />
      
      {/* Content Area - Flexible */}
      <div className="layout-content">
        <ContentArea />
        
        {/* Global Effects Bar - Fixed 80px bottom */}
        <GlobalEffectsBar />
      </div>
      
      {/* Blackout Overlay */}
      {blackout && <BlackoutOverlay />}
    </div>
  )
}

export default MainLayout

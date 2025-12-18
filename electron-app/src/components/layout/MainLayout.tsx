/**
 * 🏗️ MAIN LAYOUT - Commander Layout Structure
 * WAVE 9: Sidebar + Content Area + Global Effects Bar
 * WAVE 35.3: Global TitleBar always visible
 */

import React from 'react'
import Sidebar from './Sidebar'
import ContentArea from './ContentArea'
import GlobalEffectsBar from './GlobalEffectsBar'
import BlackoutOverlay from './BlackoutOverlay'
import TitleBar from './TitleBar'
import { useEffectsStore } from '../../stores'
import './MainLayout.css'

const MainLayout: React.FC = () => {
  const { blackout } = useEffectsStore()

  return (
    <div className="main-layout">
      {/* Global Title Bar - Always visible, max z-index */}
      <TitleBar />
      
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

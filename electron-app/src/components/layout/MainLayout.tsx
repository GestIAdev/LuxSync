/**
 * 🏗️ MAIN LAYOUT - Commander Layout Structure
 * WAVE 9: Sidebar + Content Area + Global Effects Bar
 * WAVE 35.3: Global TitleBar always visible
 * WAVE 39.9: FLEXBOX STRUCTURAL LAYOUT - TitleBar ocupa espacio real (no position:fixed)
 * WAVE 375: ZEN MODE - Sidebar collapse for maximum viewport
 * WAVE 375.2: COMMAND DECK - Replaces GlobalEffectsBar (140px height)
 */

import React, { useState, useEffect, useCallback } from 'react'
import Sidebar from './Sidebar'
import ContentArea from './ContentArea'
import { CommandDeck } from '../commandDeck'
import BlackoutOverlay from './BlackoutOverlay'
import TitleBar from './TitleBar'
import { useEffectsStore } from '../../stores'
import './MainLayout.css'

const MainLayout: React.FC = () => {
  const { blackout } = useEffectsStore()
  
  // 🧘 WAVE 375: Zen Mode - Sidebar collapse state
  const [isZenMode, setIsZenMode] = useState(false)
  
  // Toggle function (passed to TitleBar)
  const toggleZenMode = useCallback(() => {
    setIsZenMode(prev => !prev)
    console.log(`[MainLayout] 🧘 Zen Mode: ${!isZenMode ? 'ACTIVATED' : 'DEACTIVATED'}`)
  }, [isZenMode])
  
  // ⌨️ Keyboard listener for F11 / Z
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in input/textarea
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      
      // F11 or Z toggles Zen Mode
      if (e.key === 'F11' || e.key === 'z' || e.key === 'Z') {
        e.preventDefault()
        toggleZenMode()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleZenMode])

  return (
    <div className={`app-layout ${isZenMode ? 'zen-mode' : ''}`}>
      {/* 🪟 Global Title Bar - Flex item, NO position:fixed */}
      <TitleBar isZenMode={isZenMode} onToggleZenMode={toggleZenMode} />
      
      {/* 🏗️ Main content row: Sidebar + Content */}
      <div className="main-layout">
        {/* Sidebar - Collapses in Zen Mode */}
        <div className={`sidebar-container ${isZenMode ? 'collapsed' : ''}`}>
          <Sidebar />
        </div>
        
        {/* Content Area - Flexible */}
        <div className="layout-content">
          <ContentArea />
        </div>
      </div>
      
      {/* 🎛️ WAVE 375: Command Deck - 140px bottom bar, full width */}
      <CommandDeck />
      
      {/* Blackout Overlay */}
      {blackout && <BlackoutOverlay />}
    </div>
  )
}

export default MainLayout

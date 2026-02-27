/**
 * 🏗️ MAIN LAYOUT - Commander Layout Structure
 * WAVE 9: Sidebar + Content Area + Global Effects Bar
 * WAVE 35.3: Global TitleBar always visible
 * WAVE 39.9: FLEXBOX STRUCTURAL LAYOUT - TitleBar ocupa espacio real (no position:fixed)
 * WAVE 375: ZEN MODE - Sidebar collapse for maximum viewport
 * WAVE 375.2: COMMAND DECK - Replaces GlobalEffectsBar (140px height)
 * WAVE 2009: CHRONOS FULLSCREEN - Hide CommandDeck in Chronos view
 * WAVE 2074.1: OVERLAY KILL — Blackout no longer blocks the UI.
 *   Blackout is a DMX state, not a UI mode. You can patch, navigate,
 *   and operate freely while lights are off. A subtle red border
 *   on the app frame signals blackout is active.
 */

import React, { useState, useEffect, useCallback } from 'react'
import Sidebar from './Sidebar'
import ContentArea from './ContentArea'
import { CommandDeck } from '../commandDeck'
import TitleBar from './TitleBar'
import { useEffectsStore, selectBlackout } from '../../stores'
import { useNavigationStore, selectMainLayoutNav } from '../../stores/navigationStore'
import { useShallow } from 'zustand/shallow'
import './MainLayout.css'

const MainLayout: React.FC = () => {
  // ⚡ WAVE 2074.1: Blackout state for visual indicator (NOT a blocking overlay)
  const blackout = useEffectsStore(selectBlackout)
  const { activeTab } = useNavigationStore(useShallow(selectMainLayoutNav))
  
  // 🎬 WAVE 2009: Chronos is a full-screen experience
  const isChronosView = activeTab === 'chronos'
  
  // 🧘 WAVE 375: Zen Mode - Sidebar collapse state
  const [isZenMode, setIsZenMode] = useState(false)
  
  // 🎬 WAVE 2009: Auto-enable Zen Mode when entering Chronos
  useEffect(() => {
    if (isChronosView && !isZenMode) {
      setIsZenMode(true)
      console.log('[MainLayout] 🎬 Chronos detected → Auto Zen Mode')
    }
  }, [isChronosView])
  
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
    <div className={`app-layout ${isZenMode ? 'zen-mode' : ''} ${blackout ? 'blackout-active' : ''}`}>
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
      {/* 🎬 WAVE 2009: Hidden in Chronos (Chronos has its own Arsenal Dock) */}
      {!isChronosView && <CommandDeck />}
    </div>
  )
}

export default MainLayout

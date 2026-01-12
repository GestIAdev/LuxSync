/**
 * 🏗️ SETUP LAYOUT - The Dashboard Skeleton
 * WAVE 370: UI LEGACY PURGE - No more tabs navigation
 * 
 * Structure:
 * - SetupStatusBar (44px fixed)
 * - Content Area (flex-grow) - DevicesTab only
 */

import React from 'react'
import { SetupStatusBar } from './SetupStatusBar'
import './SetupLayout.css'

// ============================================
// MAIN LAYOUT
// ============================================

interface SetupLayoutProps {
  children: React.ReactNode
}

export const SetupLayout: React.FC<SetupLayoutProps> = ({ children }) => {
  return (
    <div className="setup-layout">
      <SetupStatusBar />
      <div className="setup-content">
        {children}
      </div>
    </div>
  )
}

export default SetupLayout

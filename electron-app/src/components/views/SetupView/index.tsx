/**
 * SETUP VIEW - DEVICES ONLY
 * WAVE 370: UI LEGACY PURGE
 * 
 * Simplified Architecture:
 * - SetupStatusBar: Header with VU, Show name, DMX status
 * - DevicesTab: Audio Input + DMX Output (the only tab now)
 * 
 * PATCH/LIBRARY eliminated - Stage Constructor handles fixtures
 */

import React from 'react'
import { SetupLayout } from './SetupLayout'
import { DevicesTab } from './tabs'
import './SetupView.css'

const SetupView: React.FC = () => {
  return (
    <SetupLayout>
      <DevicesTab />
    </SetupLayout>
  )
}

export default SetupView

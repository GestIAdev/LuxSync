/**
 * 🔌 DEVICES TAB - Audio & DMX Configuration
 * WAVE 26 Phase 2: Complete Implementation
 * 
 * Layout: 2-column grid (Audio left, DMX right)
 * Responsive: Stacks on narrow screens
 */

import React from 'react'
import { AudioConfig } from './AudioConfig'
import { DMXConfig } from './DMXConfig'
import './DevicesTab.css'

export const DevicesTab: React.FC = () => {
  return (
    <div className="devices-tab">
      <div className="devices-grid">
        <AudioConfig />
        <DMXConfig />
      </div>
    </div>
  )
}

export default DevicesTab

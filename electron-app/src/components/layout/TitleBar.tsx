/**
 * 🪟 TITLE BAR - WAVE 35.3: Global Window Controls & Drag Region
 * WAVE 375: Zen Mode Toggle Button
 * WAVE 2049: NetIndicator + MidiLearn Badge Integration
 * WAVE UX-1: THE TACTICAL HUB & HEADER CLEANUP
 *   - Left block: [ZEN pill] [MIDI pill] [HUB pill]
 *   - Center: LUXSYNC drag region
 *   - Right: safe zone for native window controls
 *   - Art-Net Discovery migrated into TacticalHub dropdown
 *   - MIDI pill gets same visual treatment as ZEN (active glow)
 *
 * Layout: [ZEN] [MIDI] [HUB] ——— LUXSYNC ——— [safe-zone]
 */

import React from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import MidiLearnOverlay from '../MidiLearnOverlay'
import TacticalHub from './TacticalHub'
import './TitleBar.css'

interface TitleBarProps {
  title?: string
  isZenMode?: boolean
  onToggleZenMode?: () => void
}

const TitleBar: React.FC<TitleBarProps> = ({ 
  title = 'LUXSYNC',
  isZenMode = false,
  onToggleZenMode
}) => {
  return (
    <div className="global-title-bar">
      {/* 🔧 WAVE UX-1: Left pill cluster — ZEN → MIDI → HUB */}
      <div className="title-bar-pills">
        {/* 🧘 ZEN pill */}
        <button 
          className={`tb-pill tb-pill--zen ${isZenMode ? 'active' : ''}`}
          onClick={onToggleZenMode}
          title={isZenMode ? 'Exit Zen Mode [Z]' : 'Enter Zen Mode [Z]'}
        >
          {isZenMode ? (
            <Minimize2 size={12} className="tb-pill-icon" />
          ) : (
            <Maximize2 size={12} className="tb-pill-icon" />
          )}
          <span className="tb-pill-label">ZEN</span>
        </button>

        {/* 🎹 MIDI pill */}
        <MidiLearnOverlay />

        {/* ⚙️ HUB pill (Art-Net + future tools) */}
        <TacticalHub />
      </div>

      {/* Drag Region - spans full width, native controls overlay on right */}
      <div className="title-bar-drag">
        <span className="title-bar-text">{title}</span>
      </div>
      
      {/* Safe zone spacer for native window controls (Win/Mac) */}
      <div className="title-bar-safe-zone" />
    </div>
  )
}

export default TitleBar

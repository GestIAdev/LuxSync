/**
 * 🏛️ SETUP STATUS BAR - The Immutable Header
 * WAVE 370: UI LEGACY PURGE - Connected to stageStore
 * 
 * Fixed status bar (40-50px) always visible:
 * - Left: Mini VU Meter + "AUDIO INPUT"
 * - Center: "SHOW: [actual .luxshow file name]"
 * - Right: DMX Status (ONLINE/OFFLINE)
 */

import React from 'react'
import { useTruthStore, selectAudio, useHardware } from '../../../stores/truthStore'
import { useStageStore } from '../../../stores/stageStore'
import './SetupStatusBar.css'

// ============================================
// MINI VU METER COMPONENT
// ============================================

interface MiniVuMeterProps {
  energy: number  // 0-1
}

const MiniVuMeter: React.FC<MiniVuMeterProps> = ({ energy }) => {
  // Clamp energy to 0-1
  const level = Math.max(0, Math.min(1, energy))
  
  // Color gradient: green → yellow → red
  const getColor = (lvl: number): string => {
    if (lvl < 0.5) return '#00ff88'    // Green
    if (lvl < 0.75) return '#ffcc00'   // Yellow  
    return '#ff4444'                    // Red (clipping)
  }
  
  return (
    <div className="mini-vu-meter">
      <div 
        className="mini-vu-fill"
        style={{ 
          width: `${level * 100}%`,
          backgroundColor: getColor(level)
        }}
      />
      <div className="mini-vu-peak" style={{ left: `${level * 100}%` }} />
    </div>
  )
}

// ============================================
// DMX STATUS INDICATOR
// ============================================

interface DmxStatusProps {
  connected: boolean
  fps?: number
}

const DmxStatus: React.FC<DmxStatusProps> = ({ connected, fps }) => {
  return (
    <div className={`dmx-status ${connected ? 'online' : 'offline'}`}>
      <div className={`dmx-indicator ${connected ? 'pulse' : ''}`} />
      <span className="dmx-label">
        {connected ? 'ONLINE' : 'OFFLINE'}
      </span>
      {connected && fps !== undefined && (
        <span className="dmx-fps">{fps} FPS</span>
      )}
    </div>
  )
}

// ============================================
// MAIN STATUS BAR
// ============================================

export const SetupStatusBar: React.FC = () => {
  const audio = useTruthStore(selectAudio)
  const hardware = useHardware() // 🛡️ WAVE 2042.12: React 19 stable hook
  // WAVE 370: Connected to REAL showFile from stageStore
  const showFileName = useStageStore((s) => s.showFile?.name)
  
  return (
    <div className="setup-status-bar">
      {/* LEFT: Audio Input */}
      <div className="status-section status-left">
        <MiniVuMeter energy={audio.energy} />
        <span className="status-label">AUDIO INPUT</span>
      </div>
      
      {/* CENTER: Show Name (REAL from Stage Constructor) */}
      <div className="status-section status-center">
        <span className="show-name">
          SHOW: <span style={{color: '#fff', fontWeight: 'bold'}}>{showFileName || 'No Show Loaded'}</span>
        </span>
      </div>
      
      {/* RIGHT: DMX Status */}
      <div className="status-section status-right">
        <DmxStatus 
          connected={hardware.dmx.connected} 
          fps={hardware.dmx.connected ? hardware.dmx.frameRate : undefined}
        />
      </div>
    </div>
  )
}

export default SetupStatusBar

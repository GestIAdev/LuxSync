/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⏱️ CHRONOS LAYOUT - WAVE 2004: THE SKELETON
 * Main container for Chronos Studio - Offline Timeline Editor
 * 
 * Layout Architecture:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                    TRANSPORT BAR (fixed top)                            │
 * ├─────────────────────────────────────────────────────────┬───────────────┤
 * │                                                         │               │
 * │                 STAGE PREVIEW (35%)                     │   ARSENAL     │
 * │                 [Mini Stage Simulator]                  │   (Effects)   │
 * │                                                         │               │
 * ├─────────────────────────────────────────────────────────┤   Panel       │
 * │                                                         │               │
 * │                                                         │               │
 * │                 TIMELINE CANVAS (65%)                   │               │
 * │                 [Tracks: Ruler | Waveform | Vibe | FX]  │               │
 * │                                                         │               │
 * │                                                         │               │
 * └─────────────────────────────────────────────────────────┴───────────────┘
 * 
 * @module chronos/ui/ChronosLayout
 * @version WAVE 2004
 */

import React, { useState, useCallback } from 'react'
import { TransportBar } from './transport/TransportBar'
import { TimelineCanvas } from './timeline/TimelineCanvas'
import './ChronosLayout.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ChronosLayoutProps {
  className?: string
}

// ═══════════════════════════════════════════════════════════════════════════
// PLACEHOLDER COMPONENTS (to be replaced in future WAVEs)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Stage Preview Placeholder - Will contain mini StageSimulator
 */
const StagePreviewPlaceholder: React.FC = () => (
  <div className="chronos-stage-preview">
    <div className="preview-placeholder">
      <div className="preview-icon">🎭</div>
      <span className="preview-label">STAGE PREVIEW</span>
      <span className="preview-hint">Conectará con StageSimulator2</span>
    </div>
  </div>
)

/**
 * Arsenal Panel Placeholder - Will contain effect library/palette
 */
const ArsenalPlaceholder: React.FC = () => (
  <div className="chronos-arsenal">
    <div className="arsenal-header">
      <span className="arsenal-icon">🎨</span>
      <span className="arsenal-title">THE ARSENAL</span>
    </div>
    <div className="arsenal-content">
      <div className="arsenal-section">
        <div className="section-label">VIBES</div>
        <div className="arsenal-items">
          <div className="arsenal-item vibe-chillout">CHILLOUT</div>
          <div className="arsenal-item vibe-techno">TECHNO</div>
          <div className="arsenal-item vibe-ambient">AMBIENT</div>
        </div>
      </div>
      <div className="arsenal-section">
        <div className="section-label">EFFECTS</div>
        <div className="arsenal-items">
          <div className="arsenal-item fx-strobe">STROBE</div>
          <div className="arsenal-item fx-sweep">SWEEP</div>
          <div className="arsenal-item fx-pulse">PULSE</div>
          <div className="arsenal-item fx-chase">CHASE</div>
        </div>
      </div>
    </div>
  </div>
)

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const ChronosLayout: React.FC<ChronosLayoutProps> = ({ className = '' }) => {
  // Transport state (will connect to ChronosStore in future WAVEs)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [bpm, setBpm] = useState(120)
  
  // Transport controls
  const handlePlay = useCallback(() => {
    setIsPlaying(prev => !prev)
    console.log('[ChronosLayout] ▶️ Play toggled')
  }, [])
  
  const handleStop = useCallback(() => {
    setIsPlaying(false)
    setCurrentTime(0)
    console.log('[ChronosLayout] ⏹️ Stop')
  }, [])
  
  const handleRecord = useCallback(() => {
    setIsRecording(prev => !prev)
    console.log('[ChronosLayout] ⏺️ Record toggled')
  }, [])
  
  const handleSeek = useCallback((time: number) => {
    setCurrentTime(time)
    console.log('[ChronosLayout] ⏭️ Seek to:', time)
  }, [])
  
  return (
    <div className={`chronos-layout ${className}`}>
      {/* ═══════════════════════════════════════════════════════════════════
       * TRANSPORT BAR - The Cockpit
       * ═══════════════════════════════════════════════════════════════════ */}
      <TransportBar
        isPlaying={isPlaying}
        isRecording={isRecording}
        currentTime={currentTime}
        bpm={bpm}
        onPlay={handlePlay}
        onStop={handleStop}
        onRecord={handleRecord}
        onBpmChange={setBpm}
      />
      
      {/* ═══════════════════════════════════════════════════════════════════
       * MAIN CONTENT AREA
       * ═══════════════════════════════════════════════════════════════════ */}
      <div className="chronos-main">
        {/* Left: Stage + Timeline Stack */}
        <div className="chronos-workspace">
          {/* Stage Preview (35% height) */}
          <StagePreviewPlaceholder />
          
          {/* Horizontal Divider */}
          <div className="chronos-divider horizontal" />
          
          {/* Timeline Canvas (65% height) */}
          <TimelineCanvas
            currentTime={currentTime}
            bpm={bpm}
            isPlaying={isPlaying}
            onSeek={handleSeek}
          />
        </div>
        
        {/* Vertical Divider */}
        <div className="chronos-divider vertical" />
        
        {/* Right: Arsenal Panel */}
        <ArsenalPlaceholder />
      </div>
    </div>
  )
}

export default ChronosLayout

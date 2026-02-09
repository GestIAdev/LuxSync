/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⏯️ TRANSPORT BAR - WAVE 2004: THE COCKPIT
 * Master control panel for Chronos Studio playback and recording
 * 
 * Layout:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ [⏮] [⏹] [▶/⏸] [⏺] │ 00:00:00.000 │ ⊙ 120 BPM │ [QUANT] [SNAP] [LOOP] │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * @module chronos/ui/transport/TransportBar
 * @version WAVE 2004
 */

import React, { useCallback, memo } from 'react'
import './TransportBar.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface TransportBarProps {
  isPlaying: boolean
  isRecording: boolean
  currentTime: number          // in milliseconds
  bpm: number
  onPlay: () => void
  onStop: () => void
  onRecord: () => void
  onBpmChange: (bpm: number) => void
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Format milliseconds to timecode: HH:MM:SS.mmm
 */
function formatTimecode(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const milliseconds = ms % 1000
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`
}

// ═══════════════════════════════════════════════════════════════════════════
// TRANSPORT BUTTON COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface TransportButtonProps {
  icon: string
  label: string
  onClick: () => void
  active?: boolean
  variant?: 'default' | 'play' | 'record' | 'stop'
  disabled?: boolean
}

const TransportButton: React.FC<TransportButtonProps> = memo(({
  icon,
  label,
  onClick,
  active = false,
  variant = 'default',
  disabled = false,
}) => (
  <button
    className={`transport-btn ${variant} ${active ? 'active' : ''}`}
    onClick={onClick}
    disabled={disabled}
    title={label}
    aria-label={label}
  >
    <span className="transport-btn-icon">{icon}</span>
  </button>
))

TransportButton.displayName = 'TransportButton'

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const TransportBar: React.FC<TransportBarProps> = memo(({
  isPlaying,
  isRecording,
  currentTime,
  bpm,
  onPlay,
  onStop,
  onRecord,
  onBpmChange,
}) => {
  // BPM adjustment handlers
  const handleBpmDecrease = useCallback(() => {
    onBpmChange(Math.max(20, bpm - 1))
  }, [bpm, onBpmChange])
  
  const handleBpmIncrease = useCallback(() => {
    onBpmChange(Math.min(300, bpm + 1))
  }, [bpm, onBpmChange])
  
  const handleBpmInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    if (!isNaN(value) && value >= 20 && value <= 300) {
      onBpmChange(value)
    }
  }, [onBpmChange])
  
  // Rewind to start
  const handleRewind = useCallback(() => {
    console.log('[TransportBar] ⏮️ Rewind to start')
    // Will be connected to seek(0) in parent
  }, [])
  
  return (
    <div className="transport-bar">
      {/* ═══════════════════════════════════════════════════════════════════
       * TRANSPORT CONTROLS (Left)
       * ═══════════════════════════════════════════════════════════════════ */}
      <div className="transport-controls">
        {/* Rewind */}
        <TransportButton
          icon="⏮"
          label="Rewind to Start"
          onClick={handleRewind}
        />
        
        {/* Stop */}
        <TransportButton
          icon="⏹"
          label="Stop"
          onClick={onStop}
          variant="stop"
        />
        
        {/* Play/Pause */}
        <TransportButton
          icon={isPlaying ? '⏸' : '▶'}
          label={isPlaying ? 'Pause' : 'Play'}
          onClick={onPlay}
          active={isPlaying}
          variant="play"
        />
        
        {/* Record */}
        <TransportButton
          icon="⏺"
          label="Record Arm"
          onClick={onRecord}
          active={isRecording}
          variant="record"
        />
      </div>
      
      {/* ═══════════════════════════════════════════════════════════════════
       * TIMECODE DISPLAY (Center)
       * ═══════════════════════════════════════════════════════════════════ */}
      <div className="transport-timecode">
        <span className="timecode-value">{formatTimecode(currentTime)}</span>
      </div>
      
      {/* ═══════════════════════════════════════════════════════════════════
       * BPM CONTROL (Center-Right)
       * ═══════════════════════════════════════════════════════════════════ */}
      <div className="transport-bpm">
        <button
          className="bpm-adjust decrease"
          onClick={handleBpmDecrease}
          title="Decrease BPM"
        >
          −
        </button>
        <div className="bpm-display">
          <input
            type="number"
            className="bpm-input"
            value={bpm}
            onChange={handleBpmInput}
            min={20}
            max={300}
          />
          <span className="bpm-label">BPM</span>
        </div>
        <button
          className="bpm-adjust increase"
          onClick={handleBpmIncrease}
          title="Increase BPM"
        >
          +
        </button>
      </div>
      
      {/* ═══════════════════════════════════════════════════════════════════
       * MODE TOGGLES (Right)
       * ═══════════════════════════════════════════════════════════════════ */}
      <div className="transport-modes">
        <button className="mode-toggle" title="Quantize to Grid">
          <span className="mode-icon">⊞</span>
          <span className="mode-label">QUANT</span>
        </button>
        
        <button className="mode-toggle" title="Snap to Beats">
          <span className="mode-icon">🧲</span>
          <span className="mode-label">SNAP</span>
        </button>
        
        <button className="mode-toggle" title="Loop Playback">
          <span className="mode-icon">🔁</span>
          <span className="mode-label">LOOP</span>
        </button>
      </div>
      
      {/* ═══════════════════════════════════════════════════════════════════
       * CHRONOS BRANDING (Far Right)
       * ═══════════════════════════════════════════════════════════════════ */}
      <div className="transport-brand">
        <span className="brand-icon">⏱</span>
        <span className="brand-name">CHRONOS</span>
      </div>
    </div>
  )
})

TransportBar.displayName = 'TransportBar'

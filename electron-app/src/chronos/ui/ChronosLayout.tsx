/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⏱️ CHRONOS LAYOUT - WAVE 2005: THE PULSE
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
 * WAVE 2005: Added audio loading and waveform visualization
 * 
 * @module chronos/ui/ChronosLayout
 * @version WAVE 2005
 */

import React, { useState, useCallback, useRef } from 'react'
import { TransportBar } from './transport/TransportBar'
import { TimelineCanvas } from './timeline/TimelineCanvas'
// 👻 WAVE 2005.3: Use Phantom Worker for audio analysis (zero renderer memory)
import { useAudioLoaderPhantom } from '../hooks/useAudioLoaderPhantom'
import type { AnalysisData } from '../core/types'
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
  // 👻 WAVE 2005.3: Use Phantom Worker for audio analysis (zero renderer memory)
  const audioLoader = useAudioLoaderPhantom()
  
  // Transport state
  const [isPlaying, setIsPlaying] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [bpm, setBpm] = useState(120)
  
  // Drag state
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Update BPM from analysis if available
  React.useEffect(() => {
    if (audioLoader.result?.analysisData?.beatGrid?.bpm) {
      setBpm(Math.round(audioLoader.result.analysisData.beatGrid.bpm))
    }
  }, [audioLoader.result])
  
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
  
  // ═══════════════════════════════════════════════════════════════════════
  // DRAG & DROP HANDLERS - WAVE 2005
  // ═══════════════════════════════════════════════════════════════════════
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])
  
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      console.log('[ChronosLayout] 📂 File dropped:', file.name)
      await audioLoader.loadFile(file)
    }
  }, [audioLoader])
  
  const handleLoadAudioClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])
  
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      await audioLoader.loadFile(files[0])
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [audioLoader])
  
  // 👻 WAVE 2005.3: Close audio and reset state
  const handleCloseAudio = useCallback(() => {
    console.log('[ChronosLayout] 🗑️ Closing audio file')
    audioLoader.reset()
    setIsPlaying(false)
    setCurrentTime(0)
    setBpm(120) // Reset to default
  }, [audioLoader])
  
  return (
    <div 
      className={`chronos-layout ${className} ${isDragOver ? 'dragover' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".mp3,.wav,.ogg,.flac,.m4a,.aac,.webm,audio/*"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
      
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
        audioLoaded={!!audioLoader.result}
        audioFileName={audioLoader.result?.fileName}
        onLoadAudio={handleLoadAudioClick}
        onCloseAudio={handleCloseAudio}
      />
      
      {/* ═══════════════════════════════════════════════════════════════════
       * LOADING OVERLAY
       * ═══════════════════════════════════════════════════════════════════ */}
      {audioLoader.isLoading && (
        <div className="chronos-loading-overlay">
          <div className="loading-spinner" />
          <div className="loading-phase">{audioLoader.phase.toUpperCase()}</div>
          <div className="loading-message">{audioLoader.message}</div>
          <div className="loading-progress-bar">
            <div 
              className="loading-progress-fill"
              style={{ width: `${audioLoader.progress}%` }}
            />
          </div>
          <div className="loading-percent">{audioLoader.progress}%</div>
        </div>
      )}
      
      {/* ═══════════════════════════════════════════════════════════════════
       * DRAG OVERLAY
       * ═══════════════════════════════════════════════════════════════════ */}
      {isDragOver && (
        <div className="chronos-drag-overlay">
          <div className="drag-icon">🎵</div>
          <div className="drag-text">DROP AUDIO FILE</div>
          <div className="drag-formats">MP3, WAV, OGG, FLAC, M4A</div>
        </div>
      )}
      
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
            analysisData={audioLoader.result?.analysisData ?? null}
            durationMs={audioLoader.result?.durationMs ?? 60000}
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

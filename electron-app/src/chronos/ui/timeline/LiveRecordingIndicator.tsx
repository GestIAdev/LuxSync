/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 LIVE RECORDING INDICATOR - WAVE 2045.2: INFINITE TAPE
 * 
 * Indicador visual que crece en el track de audio mientras grabas en modo LIVE.
 * Aparece SOLO cuando:
 * - audioSourceMode === 'live'
 * - isRecording === true
 * 
 * RENDER:
 * - Bloque rojo con texto "REC●" que crece desde 0ms hasta currentTime
 * - Parpadeo de "REC●" cada 500ms (heartbeat visual)
 * - Borde pulsante (2px → 4px en beat)
 * 
 * ROADMAP (Future):
 * - Dibujar waveform en tiempo real capturando buffers de useLiveAudioInput
 * - Escribir en Canvas a medida que entran los samples
 * 
 * @module chronos/ui/timeline/LiveRecordingIndicator
 * @version WAVE 2045.2
 */

import React, { memo, useEffect, useState } from 'react'
import './LiveRecordingIndicator.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface LiveRecordingIndicatorProps {
  /** Current playhead time in ms */
  currentTimeMs: number
  
  /** Viewport config */
  viewport: {
    startTime: number
    pixelsPerSecond: number
  }
  
  /** Track dimensions */
  trackY: number
  trackHeight: number
  
  /** Is currently recording */
  isRecording: boolean
  
  /** Audio source mode */
  audioSourceMode: 'file' | 'live'
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const LiveRecordingIndicator: React.FC<LiveRecordingIndicatorProps> = memo(({
  currentTimeMs,
  viewport,
  trackY,
  trackHeight,
  isRecording,
  audioSourceMode,
}) => {
  // Blink state for "REC●" text (500ms heartbeat)
  const [isBlinkOn, setIsBlinkOn] = useState(true)
  
  useEffect(() => {
    if (!isRecording) {
      setIsBlinkOn(true)
      return
    }
    
    const interval = setInterval(() => {
      setIsBlinkOn(prev => !prev)
    }, 500)
    
    return () => clearInterval(interval)
  }, [isRecording])
  
  // Only render if in LIVE mode and recording
  if (audioSourceMode !== 'live' || !isRecording) {
    return null
  }
  
  // Calculate width from 0ms to currentTime
  const widthPx = (currentTimeMs / 1000) * viewport.pixelsPerSecond
  
  // If recording started after viewport start, offset X position
  const startX = Math.max(0, (0 - viewport.startTime) / 1000 * viewport.pixelsPerSecond)
  
  if (widthPx <= 0) {
    return null
  }
  
  return (
    <g className="live-recording-indicator">
      {/* Background block - red gradient */}
      <rect
        x={startX}
        y={trackY + 2}
        width={widthPx}
        height={trackHeight - 4}
        fill="url(#liveRecGradient)"
        className="live-rec-block"
      />
      
      {/* Border pulse - thicker on beat */}
      <rect
        x={startX}
        y={trackY + 2}
        width={widthPx}
        height={trackHeight - 4}
        fill="none"
        stroke="#ff003c"
        strokeWidth={2}
        className="live-rec-border"
      />
      
      {/* "REC●" label - centered in block */}
      {widthPx > 60 && (
        <text
          x={startX + widthPx / 2}
          y={trackY + trackHeight / 2}
          className={`live-rec-label ${isBlinkOn ? 'blink-on' : 'blink-off'}`}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          REC●
        </text>
      )}
      
      {/* Gradient definition */}
      <defs>
        <linearGradient id="liveRecGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(255, 0, 60, 0.15)" />
          <stop offset="50%" stopColor="rgba(255, 0, 60, 0.25)" />
          <stop offset="100%" stopColor="rgba(255, 0, 60, 0.35)" />
        </linearGradient>
      </defs>
    </g>
  )
})

LiveRecordingIndicator.displayName = 'LiveRecordingIndicator'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📊 TIMELINE CANVAS - WAVE 2005: THE PULSE
 * High-performance SVG/Canvas timeline for Chronos Studio
 * 
 * Track Structure (Top to Bottom):
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ RULER TRACK     │ |1|2|3|4|5|6|7|8|... (beat/bar markers)              │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ WAVEFORM TRACK  │ ▃▅▇█▇▅▃▁▃▅▇... (audio visualization)                │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ VIBE TRACK      │ [CHILLOUT][BUILD][DROP][TECHNO]... (vibe regions)    │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ FX TRACK        │ ◆────◆────◆ (effect keyframes)                       │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * Interactions:
 * - Wheel: Horizontal zoom
 * - Shift+Wheel: Vertical scroll (track selection)
 * - Click on ruler: Seek playhead
 * - Drag: Pan timeline
 * 
 * WAVE 2005: Integrated WaveformLayer for audio visualization
 * 
 * @module chronos/ui/timeline/TimelineCanvas
 * @version WAVE 2005
 */

import React, { useRef, useState, useCallback, useEffect, memo } from 'react'
import { WaveformLayer } from './WaveformLayer'
import type { AnalysisData } from '../../core/types'
import './TimelineCanvas.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface TimelineCanvasProps {
  currentTime: number          // in milliseconds
  bpm: number
  isPlaying: boolean
  onSeek: (time: number) => void
  // WAVE 2005: Audio analysis data
  analysisData?: AnalysisData | null
  durationMs?: number
}

interface TimelineViewport {
  startTime: number           // visible start time (ms)
  endTime: number             // visible end time (ms)
  pixelsPerSecond: number     // zoom level
}

// Track types
type TrackType = 'ruler' | 'waveform' | 'vibe' | 'fx'

interface Track {
  id: string
  type: TrackType
  label: string
  height: number              // pixels
  color: string
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_TRACKS: Track[] = [
  { id: 'ruler', type: 'ruler', label: 'TIME', height: 32, color: '#3b82f6' },
  { id: 'waveform', type: 'waveform', label: 'AUDIO', height: 64, color: '#22d3ee' },
  { id: 'vibe', type: 'vibe', label: 'VIBE', height: 48, color: '#a855f7' },
  { id: 'fx1', type: 'fx', label: 'FX 1', height: 40, color: '#f97316' },
  { id: 'fx2', type: 'fx', label: 'FX 2', height: 40, color: '#ef4444' },
]

const MIN_PIXELS_PER_SECOND = 10
const MAX_PIXELS_PER_SECOND = 500
const DEFAULT_PIXELS_PER_SECOND = 100
const TRACK_LABEL_WIDTH = 80

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate beat positions for ruler rendering
 */
function calculateBeatPositions(
  viewport: TimelineViewport,
  bpm: number,
  width: number
): { position: number; beat: number; isBar: boolean }[] {
  const msPerBeat = 60000 / bpm
  const beatsPerBar = 4 // 4/4 time signature
  
  const positions: { position: number; beat: number; isBar: boolean }[] = []
  
  // Find first beat in viewport
  const firstBeat = Math.floor(viewport.startTime / msPerBeat)
  const lastBeat = Math.ceil(viewport.endTime / msPerBeat)
  
  for (let beat = firstBeat; beat <= lastBeat; beat++) {
    const timeMs = beat * msPerBeat
    const position = ((timeMs - viewport.startTime) / 1000) * viewport.pixelsPerSecond
    
    if (position >= 0 && position <= width) {
      positions.push({
        position,
        beat: beat + 1, // 1-indexed for display
        isBar: beat % beatsPerBar === 0,
      })
    }
  }
  
  return positions
}

/**
 * Format time for ruler labels
 */
function formatRulerTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// ═══════════════════════════════════════════════════════════════════════════
// TRACK RENDERERS
// ═══════════════════════════════════════════════════════════════════════════

interface TrackRendererProps {
  track: Track
  viewport: TimelineViewport
  bpm: number
  width: number
  yOffset: number
}

/**
 * Ruler Track - Time markers and beat grid
 */
const RulerTrackRenderer: React.FC<TrackRendererProps> = memo(({
  track,
  viewport,
  bpm,
  width,
  yOffset,
}) => {
  const beats = calculateBeatPositions(viewport, bpm, width)
  
  return (
    <g className="timeline-track ruler-track">
      {/* Background */}
      <rect
        x={TRACK_LABEL_WIDTH}
        y={yOffset}
        width={width - TRACK_LABEL_WIDTH}
        height={track.height}
        fill="var(--bg-deepest)"
        opacity="0.8"
      />
      
      {/* Beat markers */}
      {beats.map(({ position, beat, isBar }) => (
        <g key={beat}>
          <line
            x1={TRACK_LABEL_WIDTH + position}
            y1={yOffset}
            x2={TRACK_LABEL_WIDTH + position}
            y2={yOffset + track.height}
            stroke={isBar ? track.color : 'var(--border-subtle)'}
            strokeWidth={isBar ? 1.5 : 0.5}
            opacity={isBar ? 0.8 : 0.3}
          />
          {isBar && (
            <text
              x={TRACK_LABEL_WIDTH + position + 4}
              y={yOffset + 20}
              fill={track.color}
              fontSize="11"
              fontFamily="var(--font-mono)"
            >
              {Math.floor(beat / 4) + 1}
            </text>
          )}
        </g>
      ))}
      
      {/* Track label */}
      <rect
        x={0}
        y={yOffset}
        width={TRACK_LABEL_WIDTH}
        height={track.height}
        fill="var(--bg-deep)"
      />
      <text
        x={8}
        y={yOffset + track.height / 2 + 4}
        fill="var(--text-secondary)"
        fontSize="10"
        fontFamily="var(--font-mono)"
        fontWeight="600"
      >
        {track.label}
      </text>
    </g>
  )
})

RulerTrackRenderer.displayName = 'RulerTrackRenderer'

/**
 * Generic Track Renderer - Placeholder for waveform/vibe/fx
 */
const GenericTrackRenderer: React.FC<TrackRendererProps> = memo(({
  track,
  viewport,
  bpm,
  width,
  yOffset,
}) => {
  const beats = calculateBeatPositions(viewport, bpm, width)
  
  return (
    <g className={`timeline-track ${track.type}-track`}>
      {/* Background */}
      <rect
        x={TRACK_LABEL_WIDTH}
        y={yOffset}
        width={width - TRACK_LABEL_WIDTH}
        height={track.height}
        fill="var(--bg-deep)"
        opacity="0.6"
      />
      
      {/* Grid lines (subtle) */}
      {beats.filter(b => b.isBar).map(({ position, beat }) => (
        <line
          key={beat}
          x1={TRACK_LABEL_WIDTH + position}
          y1={yOffset}
          x2={TRACK_LABEL_WIDTH + position}
          y2={yOffset + track.height}
          stroke="var(--border-subtle)"
          strokeWidth={0.5}
          opacity={0.2}
        />
      ))}
      
      {/* Placeholder content indicator */}
      <text
        x={width / 2}
        y={yOffset + track.height / 2 + 4}
        fill={track.color}
        fontSize="11"
        fontFamily="var(--font-mono)"
        textAnchor="middle"
        opacity="0.3"
      >
        {track.type === 'waveform' ? '〰️ DROP AUDIO FILE' : 
         track.type === 'vibe' ? '⬛ DRAG VIBES HERE' : 
         '◆ ADD KEYFRAMES'}
      </text>
      
      {/* Track label */}
      <rect
        x={0}
        y={yOffset}
        width={TRACK_LABEL_WIDTH}
        height={track.height}
        fill="var(--bg-surface)"
      />
      <rect
        x={0}
        y={yOffset}
        width={4}
        height={track.height}
        fill={track.color}
      />
      <text
        x={12}
        y={yOffset + track.height / 2 + 4}
        fill="var(--text-secondary)"
        fontSize="10"
        fontFamily="var(--font-mono)"
        fontWeight="600"
      >
        {track.label}
      </text>
    </g>
  )
})

GenericTrackRenderer.displayName = 'GenericTrackRenderer'

// ═══════════════════════════════════════════════════════════════════════════
// PLAYHEAD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface PlayheadProps {
  currentTime: number
  viewport: TimelineViewport
  height: number
}

const Playhead: React.FC<PlayheadProps> = memo(({
  currentTime,
  viewport,
  height,
}) => {
  const position = TRACK_LABEL_WIDTH + 
    ((currentTime - viewport.startTime) / 1000) * viewport.pixelsPerSecond
  
  // Don't render if outside viewport
  if (position < TRACK_LABEL_WIDTH || position > 2000) return null
  
  return (
    <g className="timeline-playhead">
      {/* Playhead line */}
      <line
        x1={position}
        y1={0}
        x2={position}
        y2={height}
        stroke="#ff0055"
        strokeWidth={2}
      />
      {/* Playhead triangle */}
      <polygon
        points={`${position - 6},0 ${position + 6},0 ${position},10`}
        fill="#ff0055"
      />
    </g>
  )
})

Playhead.displayName = 'Playhead'

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const TimelineCanvas: React.FC<TimelineCanvasProps> = memo(({
  currentTime,
  bpm,
  isPlaying,
  analysisData,
  durationMs = 60000, // Default 1 minute if no audio
  onSeek,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 1200, height: 300 })
  const [viewport, setViewport] = useState<TimelineViewport>({
    startTime: 0,
    endTime: 12000, // 12 seconds
    pixelsPerSecond: DEFAULT_PIXELS_PER_SECOND,
  })
  
  // Track the container size
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })
    
    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [])
  
  // Calculate total tracks height
  const totalTracksHeight = DEFAULT_TRACKS.reduce((sum, t) => sum + t.height, 0)
  
  // Zoom handler - Using native event listener to allow preventDefault on wheel
  // React synthetic wheel events are passive by default, which causes the console warning
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      
      if (e.ctrlKey || e.metaKey) {
        // Zoom
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
        setViewport(prev => {
          const newPPS = Math.max(
            MIN_PIXELS_PER_SECOND,
            Math.min(MAX_PIXELS_PER_SECOND, prev.pixelsPerSecond * zoomFactor)
          )
          const visibleDuration = (dimensions.width - TRACK_LABEL_WIDTH) / newPPS * 1000
          return {
            ...prev,
            pixelsPerSecond: newPPS,
            endTime: prev.startTime + visibleDuration,
          }
        })
      } else {
        // Pan
        const panAmount = e.deltaX * 10 // 10ms per pixel of scroll
        setViewport(prev => {
          const newStart = Math.max(0, prev.startTime + panAmount)
          const duration = prev.endTime - prev.startTime
          return {
            ...prev,
            startTime: newStart,
            endTime: newStart + duration,
          }
        })
      }
    }
    
    // Register with { passive: false } to allow preventDefault
    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [dimensions.width])
  
  // Click to seek
  const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const x = e.clientX - rect.left
    
    // Only seek if clicking in timeline area (not track labels)
    if (x > TRACK_LABEL_WIDTH) {
      const timeOffset = ((x - TRACK_LABEL_WIDTH) / viewport.pixelsPerSecond) * 1000
      const seekTime = viewport.startTime + timeOffset
      onSeek(Math.max(0, seekTime))
    }
  }, [viewport, onSeek])
  
  // Calculate waveform track position (second track, after ruler)
  const waveformTrackIndex = DEFAULT_TRACKS.findIndex(t => t.type === 'waveform')
  const waveformTrackY = waveformTrackIndex >= 0 
    ? DEFAULT_TRACKS.slice(0, waveformTrackIndex).reduce((sum, t) => sum + t.height, 0)
    : 0
  const waveformTrack = waveformTrackIndex >= 0 ? DEFAULT_TRACKS[waveformTrackIndex] : null
  
  return (
    <div 
      ref={containerRef}
      className="timeline-canvas-container"
    >
      <svg
        className="timeline-canvas"
        width={dimensions.width}
        height={Math.max(dimensions.height, totalTracksHeight)}
        onClick={handleClick}
      >
        {/* Background */}
        <rect
          x={0}
          y={0}
          width={dimensions.width}
          height={totalTracksHeight}
          fill="var(--bg-deepest)"
        />
        
        {/* Render tracks */}
        {DEFAULT_TRACKS.map((track, index) => {
          const yOffset = DEFAULT_TRACKS
            .slice(0, index)
            .reduce((sum, t) => sum + t.height, 0)
          
          const TrackRenderer = track.type === 'ruler' 
            ? RulerTrackRenderer 
            : GenericTrackRenderer
          
          return (
            <TrackRenderer
              key={track.id}
              track={track}
              viewport={viewport}
              bpm={bpm}
              width={dimensions.width}
              yOffset={yOffset}
            />
          )
        })}
        
        {/* Playhead */}
        <Playhead
          currentTime={currentTime}
          viewport={viewport}
          height={totalTracksHeight}
        />
        
        {/* Track separator lines */}
        {DEFAULT_TRACKS.map((_, index) => {
          if (index === 0) return null
          const y = DEFAULT_TRACKS
            .slice(0, index)
            .reduce((sum, t) => sum + t.height, 0)
          
          return (
            <line
              key={`sep-${index}`}
              x1={0}
              y1={y}
              x2={dimensions.width}
              y2={y}
              stroke="var(--border-subtle)"
              strokeWidth={1}
            />
          )
        })}
      </svg>
      
      {/* Waveform Canvas Overlay - Positioned over waveform track */}
      {analysisData?.waveform && waveformTrack && (
        <div
          className="waveform-layer-container"
          style={{
            position: 'absolute',
            top: waveformTrackY,
            left: TRACK_LABEL_WIDTH,
            width: dimensions.width - TRACK_LABEL_WIDTH,
            height: waveformTrack.height,
            pointerEvents: 'none', // Allow clicks to pass through to SVG
          }}
        >
          <WaveformLayer
            analysisData={analysisData}
            viewportStartMs={viewport.startTime}
            viewportEndMs={viewport.endTime}
            pixelsPerSecond={viewport.pixelsPerSecond}
            height={waveformTrack.height}
            leftOffset={0}
            durationMs={analysisData.durationMs ?? durationMs}
            bpm={bpm}
            showBeatGrid={false}
          />
        </div>
      )}
      
      {/* Zoom indicator */}
      <div className="timeline-zoom-indicator">
        <span className="zoom-value">{Math.round(viewport.pixelsPerSecond)}px/s</span>
        <span className="zoom-hint">Ctrl+Scroll to zoom</span>
      </div>
    </div>
  )
})

TimelineCanvas.displayName = 'TimelineCanvas'

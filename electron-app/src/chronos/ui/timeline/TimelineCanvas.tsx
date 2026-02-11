/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📊 TIMELINE CANVAS - WAVE 2006: THE INTERACTIVE CANVAS
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
 * WAVE 2005: Integrated WaveformLayer for audio visualization
 * WAVE 2006: Interactive clips, drag & drop, snapping, auto-scroll
 * 
 * @module chronos/ui/timeline/TimelineCanvas
 * @version WAVE 2006
 */

import React, { useRef, useState, useCallback, useEffect, memo } from 'react'
import { WaveformLayer } from './WaveformLayer'
import { ClipRenderer } from './ClipRenderer'
import type { AnalysisData } from '../../core/types'
import type { TimelineClip, DragPayload } from '../../core/TimelineClip'
import { deserializeDragPayload } from '../../core/TimelineClip'
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
  // WAVE 2006: Clips and interaction
  clips?: TimelineClip[]
  selectedClipIds?: Set<string>
  snapEnabled?: boolean
  snapPosition?: number | null
  onClipSelect?: (clipId: string, addToSelection: boolean) => void
  onClipMove?: (clipId: string, newStartMs: number) => void
  onClipResize?: (clipId: string, edge: 'left' | 'right', newTimeMs: number) => void
  onClipDrop?: (payload: DragPayload, timeMs: number, trackId: string) => void
  onClipContextMenu?: (clipId: string, event: React.MouseEvent) => void
  // WAVE 2006: Auto-scroll
  followEnabled?: boolean
  onFollowToggle?: () => void
  onUserScroll?: () => void
  // WAVE 2013.6: Living Clip - shows pulse animation for active recording clip
  growingClipId?: string | null
  // WAVE 2013.6: Live duration override for growing clip (in ms)
  // This bypasses React state and provides real-time duration from recorder
  growingClipEndMs?: number | null
  // WAVE 2013.6: Is recording active? (for force-update during recording)
  isRecording?: boolean
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

/**
 * 🎹 WAVE 2012: Track list with 4 FX tracks for Smart Layering
 * FX tracks are thinner to fit more without overwhelming the UI
 */
const DEFAULT_TRACKS: Track[] = [
  { id: 'ruler', type: 'ruler', label: 'TIME', height: 32, color: '#3b82f6' },
  // 🌊 WAVE 2015: Increased waveform height for spectral effect
  { id: 'waveform', type: 'waveform', label: 'AUDIO', height: 80, color: '#22d3ee' },
  { id: 'vibe', type: 'vibe', label: 'VIBE', height: 48, color: '#a855f7' },
  { id: 'fx1', type: 'fx', label: 'FX 1', height: 36, color: '#f97316' },
  { id: 'fx2', type: 'fx', label: 'FX 2', height: 36, color: '#ef4444' },
  { id: 'fx3', type: 'fx', label: 'FX 3', height: 36, color: '#22d3ee' },
  { id: 'fx4', type: 'fx', label: 'FX 4', height: 36, color: '#10b981' },
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
 * 🎼 WAVE 2011: MUSICAL RULER - Bars & Beats (not seconds!)
 * DAW-style musical grid:
 * - Major marks: Every BAR (compás) with bar number
 * - Minor marks: Every BEAT within the bar
 * - Based on BPM and 4/4 time signature
 * 
 * Formula: msPerBeat = 60000 / BPM
 *          msPerBar = msPerBeat * 4 (4/4 time)
 */
const RulerTrackRenderer: React.FC<TrackRendererProps> = memo(({
  track,
  viewport,
  bpm,
  width,
  yOffset,
}) => {
  // 🎼 MUSICAL GRID CALCULATIONS
  const msPerBeat = 60000 / bpm
  const msPerBar = msPerBeat * 4 // 4/4 time signature
  const pixelsPerMs = viewport.pixelsPerSecond / 1000
  
  // Determine if we should show beat subdivisions based on zoom
  const showBeats = viewport.pixelsPerSecond > 30
  const showSubBeats = viewport.pixelsPerSecond > 100
  
  // Build grid lines: bars and beats
  const gridLines: { 
    timeMs: number
    x: number 
    type: 'bar' | 'beat' | 'subbeat'
    barNum: number
    beatNum: number
  }[] = []
  
  // Find first bar in viewport
  const firstBar = Math.max(0, Math.floor(viewport.startTime / msPerBar))
  const lastBar = Math.ceil(viewport.endTime / msPerBar)
  
  for (let bar = firstBar; bar <= lastBar; bar++) {
    // Add bar marker
    const barTimeMs = bar * msPerBar
    const barX = TRACK_LABEL_WIDTH + (barTimeMs - viewport.startTime) * pixelsPerMs
    
    if (barX >= TRACK_LABEL_WIDTH - 50 && barX <= width + 50) {
      gridLines.push({
        timeMs: barTimeMs,
        x: barX,
        type: 'bar',
        barNum: bar + 1, // 1-indexed for display
        beatNum: 1,
      })
    }
    
    // Add beat markers within this bar
    if (showBeats) {
      for (let beat = 1; beat < 4; beat++) { // Beats 2, 3, 4 (beat 1 is the bar)
        const beatTimeMs = barTimeMs + (beat * msPerBeat)
        const beatX = TRACK_LABEL_WIDTH + (beatTimeMs - viewport.startTime) * pixelsPerMs
        
        if (beatX >= TRACK_LABEL_WIDTH && beatX <= width) {
          gridLines.push({
            timeMs: beatTimeMs,
            x: beatX,
            type: 'beat',
            barNum: bar + 1,
            beatNum: beat + 1,
          })
        }
      }
    }
    
    // Add sub-beat markers (1/8th notes) if very zoomed in
    if (showSubBeats) {
      for (let subbeat = 0; subbeat < 8; subbeat++) {
        if (subbeat % 2 === 0) continue // Skip quarter notes (already drawn)
        const subbeatTimeMs = barTimeMs + (subbeat * msPerBeat / 2)
        const subbeatX = TRACK_LABEL_WIDTH + (subbeatTimeMs - viewport.startTime) * pixelsPerMs
        
        if (subbeatX >= TRACK_LABEL_WIDTH && subbeatX <= width) {
          gridLines.push({
            timeMs: subbeatTimeMs,
            x: subbeatX,
            type: 'subbeat',
            barNum: bar + 1,
            beatNum: Math.floor(subbeat / 2) + 1,
          })
        }
      }
    }
  }
  
  return (
    <g className="timeline-track ruler-track" style={{ pointerEvents: 'none' }}>
      {/* Background */}
      <rect
        x={TRACK_LABEL_WIDTH}
        y={yOffset}
        width={width - TRACK_LABEL_WIDTH}
        height={track.height}
        fill="var(--bg-deepest)"
        pointerEvents="none"
      />
      
      {/* 🎼 Musical Grid Lines */}
      {gridLines.map(({ timeMs, x, type, barNum, beatNum }) => {
        const isBar = type === 'bar'
        const isBeat = type === 'beat'
        
        // Colors and sizes based on type
        const strokeColor = isBar ? '#3b82f6' : isBeat ? 'rgba(59, 130, 246, 0.5)' : 'rgba(255,255,255,0.15)'
        const strokeWidth = isBar ? 1.5 : isBeat ? 0.75 : 0.5
        const lineY1 = isBar ? yOffset : isBeat ? yOffset + 12 : yOffset + 20
        
        return (
          <g key={`${barNum}-${beatNum}-${type}`} style={{ pointerEvents: 'none' }}>
            {/* Grid line */}
            <line
              x1={x}
              y1={lineY1}
              x2={x}
              y2={yOffset + track.height}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              pointerEvents="none"
            />
            
            {/* Bar number label */}
            {isBar && (
              <text
                x={x + 4}
                y={yOffset + 14}
                fill="#3b82f6"
                fontSize="12"
                fontFamily="var(--font-mono)"
                fontWeight="700"
                pointerEvents="none"
              >
                {barNum}
              </text>
            )}
            
            {/* Beat number (small, subtle) */}
            {isBeat && viewport.pixelsPerSecond > 60 && (
              <text
                x={x + 2}
                y={yOffset + 22}
                fill="rgba(59, 130, 246, 0.4)"
                fontSize="8"
                fontFamily="var(--font-mono)"
                fontWeight="500"
                pointerEvents="none"
              >
                .{beatNum}
              </text>
            )}
          </g>
        )
      })}
      
      {/* Track label */}
      <rect
        x={0}
        y={yOffset}
        width={TRACK_LABEL_WIDTH}
        height={track.height}
        fill="var(--bg-deep)"
        pointerEvents="none"
      />
      <text
        x={8}
        y={yOffset + track.height / 2 + 4}
        fill="var(--text-secondary)"
        fontSize="10"
        fontFamily="var(--font-mono)"
        fontWeight="600"
        pointerEvents="none"
      >
        BARS
      </text>
      
      {/* BPM indicator */}
      <text
        x={TRACK_LABEL_WIDTH - 8}
        y={yOffset + track.height / 2 + 4}
        fill="rgba(59, 130, 246, 0.6)"
        fontSize="9"
        fontFamily="var(--font-mono)"
        fontWeight="500"
        textAnchor="end"
        pointerEvents="none"
      >
        {bpm}
      </text>
    </g>
  )
})

RulerTrackRenderer.displayName = 'RulerTrackRenderer'

/**
 * 🎼 WAVE 2011: Generic Track Renderer with Musical Grid
 * Shows beat grid lines for visual quantize feedback
 */
const GenericTrackRenderer: React.FC<TrackRendererProps> = memo(({
  track,
  viewport,
  bpm,
  width,
  yOffset,
}) => {
  // 🎼 Calculate musical grid for visual feedback
  const msPerBeat = 60000 / bpm
  const msPerBar = msPerBeat * 4
  const pixelsPerMs = viewport.pixelsPerSecond / 1000
  const showBeats = viewport.pixelsPerSecond > 30
  
  // Build grid positions
  const gridLines: { x: number; isBar: boolean }[] = []
  const firstBar = Math.max(0, Math.floor(viewport.startTime / msPerBar))
  const lastBar = Math.ceil(viewport.endTime / msPerBar)
  
  for (let bar = firstBar; bar <= lastBar; bar++) {
    const barTimeMs = bar * msPerBar
    const barX = TRACK_LABEL_WIDTH + (barTimeMs - viewport.startTime) * pixelsPerMs
    
    if (barX >= TRACK_LABEL_WIDTH && barX <= width) {
      gridLines.push({ x: barX, isBar: true })
    }
    
    // Add beat lines
    if (showBeats) {
      for (let beat = 1; beat < 4; beat++) {
        const beatTimeMs = barTimeMs + (beat * msPerBeat)
        const beatX = TRACK_LABEL_WIDTH + (beatTimeMs - viewport.startTime) * pixelsPerMs
        if (beatX >= TRACK_LABEL_WIDTH && beatX <= width) {
          gridLines.push({ x: beatX, isBar: false })
        }
      }
    }
  }
  
  return (
    <g className={`timeline-track ${track.type}-track`} style={{ pointerEvents: 'none' }}>
      {/* Background */}
      <rect
        x={TRACK_LABEL_WIDTH}
        y={yOffset}
        width={width - TRACK_LABEL_WIDTH}
        height={track.height}
        fill="var(--bg-deep)"
        opacity="0.6"
        pointerEvents="none"
      />
      
      {/* 🎼 WAVE 2011: Musical Grid Lines (subtle quantize visual) */}
      {gridLines.map(({ x, isBar }, i) => (
        <line
          key={i}
          x1={x}
          y1={yOffset}
          x2={x}
          y2={yOffset + track.height}
          stroke={isBar ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.05)'}
          strokeWidth={isBar ? 1 : 0.5}
          pointerEvents="none"
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
        pointerEvents="none"
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
        pointerEvents="none"
      />
      <rect
        x={0}
        y={yOffset}
        width={4}
        height={track.height}
        fill={track.color}
        pointerEvents="none"
      />
      <text
        x={12}
        y={yOffset + track.height / 2 + 4}
        fill="var(--text-secondary)"
        fontSize="10"
        fontFamily="var(--font-mono)"
        fontWeight="600"
        pointerEvents="none"
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
    <g className="timeline-playhead" style={{ pointerEvents: 'none' }}>
      {/* Playhead line */}
      <line
        x1={position}
        y1={0}
        x2={position}
        y2={height}
        stroke="#ff0055"
        strokeWidth={2}
        pointerEvents="none"
      />
      {/* Playhead triangle */}
      <polygon
        points={`${position - 6},0 ${position + 6},0 ${position},10`}
        fill="#ff0055"
        pointerEvents="none"
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
  // WAVE 2006 props
  clips = [],
  selectedClipIds = new Set(),
  snapEnabled = true,
  snapPosition = null,
  onClipSelect,
  onClipMove,
  onClipResize,
  onClipDrop,
  onClipContextMenu,
  followEnabled = true,
  onFollowToggle,
  onUserScroll,
  // WAVE 2013.6 props
  growingClipId = null,
  growingClipEndMs = null,
  isRecording = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 1200, height: 300 })
  const [viewport, setViewport] = useState<TimelineViewport>({
    startTime: 0,
    endTime: 12000, // 12 seconds
    pixelsPerSecond: DEFAULT_PIXELS_PER_SECOND,
  })
  
  // WAVE 2006: Auto-follow playhead
  const lastUserScrollRef = useRef<number>(0)
  const USER_SCROLL_COOLDOWN = 2000 // Wait 2s after user scrolls before auto-following
  
  useEffect(() => {
    // Only auto-follow when playing and follow is enabled
    if (!isPlaying || !followEnabled) return
    
    // Don't interrupt if user recently scrolled
    const timeSinceUserScroll = Date.now() - lastUserScrollRef.current
    if (timeSinceUserScroll < USER_SCROLL_COOLDOWN) return
    
    const viewportDuration = viewport.endTime - viewport.startTime
    const viewportWidth = dimensions.width - TRACK_LABEL_WIDTH
    
    // Calculate playhead position in viewport
    const playheadRelative = currentTime - viewport.startTime
    const playheadPosition = (playheadRelative / 1000) * viewport.pixelsPerSecond
    
    // Define "safe zone" - playhead should stay in left 80% of viewport
    const safeZoneEnd = viewportWidth * 0.8
    
    // If playhead exits right side of safe zone, scroll so playhead is at 10% from left
    if (playheadPosition > safeZoneEnd || playheadPosition < 0) {
      // Position playhead at 10% from left edge (not center)
      const targetStart = currentTime - viewportDuration * 0.1
      const newStart = Math.max(0, targetStart)
      
      setViewport(prev => ({
        ...prev,
        startTime: newStart,
        endTime: newStart + viewportDuration,
      }))
    }
  }, [currentTime, isPlaying, followEnabled, viewport.pixelsPerSecond, dimensions.width])
  
  // WAVE 2006: Drag state
  const [isDragOver, setIsDragOver] = useState(false)
  const [dragTrackId, setDragTrackId] = useState<string | null>(null)
  const [dragTimeMs, setDragTimeMs] = useState<number | null>(null)
  
  // WAVE 2006 + 2013.5: Clip drag state
  // startMs stores the ORIGINAL time at drag start (clip.startMs for move, edge time for resize)
  const [draggingClipId, setDraggingClipId] = useState<string | null>(null)
  const [resizingClip, setResizingClip] = useState<{ id: string; edge: 'left' | 'right' } | null>(null)
  const dragStartRef = useRef<{ x: number; startMs: number; originalEdgeMs: number } | null>(null)
  
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
        // Pan - user is manually scrolling
        lastUserScrollRef.current = Date.now()  // Mark user scroll time
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
  
  // ═══════════════════════════════════════════════════════════════════════
  // WAVE 2006: DRAG & DROP FROM ARSENAL
  // ═══════════════════════════════════════════════════════════════════════
  
  const getTrackAtY = useCallback((y: number): string | null => {
    let accY = 0
    for (const track of DEFAULT_TRACKS) {
      if (y >= accY && y < accY + track.height) {
        return track.id
      }
      accY += track.height
    }
    return null
  }, [])
  
  const getTimeAtX = useCallback((x: number): number => {
    const offsetX = x - TRACK_LABEL_WIDTH
    return viewport.startTime + (offsetX / viewport.pixelsPerSecond) * 1000
  }, [viewport])
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    const types = e.dataTransfer.types
    
    // Detect drag type using TYPE-SPECIFIC mime types
    const isVibeDrag = types.includes('application/luxsync-vibe')
    const isFxDrag = types.includes('application/luxsync-fx')
    const isClipDrag = isVibeDrag || isFxDrag
    
    if (!isClipDrag) {
      // Not a clip drag - don't interfere
      return
    }
    
    // Get drop position
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const trackId = getTrackAtY(y)
    const timeMs = getTimeAtX(x)
    
    // Determine if drop is valid (vibe→vibe, fx→fx)
    const isVibeTrack = trackId === 'vibe'
    const isFxTrack = trackId === 'fx1' || trackId === 'fx2'
    const isValidDrop = (isVibeDrag && isVibeTrack) || (isFxDrag && isFxTrack)
    const isTrackArea = isVibeTrack || isFxTrack
    
    if (isValidDrop) {
      // Valid drop - allow and show highlight
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = 'copy'
      setIsDragOver(true)
      setDragTrackId(trackId)
      setDragTimeMs(timeMs)
    } else if (isTrackArea) {
      // Invalid drop (cross-type) - show forbidden cursor
      // Don't preventDefault - browser will show forbidden cursor naturally
      setIsDragOver(false)
      setDragTrackId(null)
      setDragTimeMs(null)
    } else {
      // Over ruler/waveform - allow cursor but no highlight
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = 'copy'
      setIsDragOver(false)
      setDragTrackId(null)
      setDragTimeMs(null)
    }
  }, [getTrackAtY, getTimeAtX])
  
  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
    setDragTrackId(null)
    setDragTimeMs(null)
  }, [])
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()  // 🔧 WAVE 2019.11: Prevent double handling by parent
    setIsDragOver(false)
    setDragTrackId(null)
    setDragTimeMs(null)
    
    const data = e.dataTransfer.getData('application/luxsync-clip')
    if (!data) return
    
    const payload = deserializeDragPayload(data)
    if (!payload) return
    
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    const trackId = getTrackAtY(y)
    const timeMs = getTimeAtX(x)
    
    if (!trackId) return
    
    // Validate drop target matches clip type
    const isVibeTrack = trackId === 'vibe'
    const isFxTrack = trackId === 'fx1' || trackId === 'fx2'
    
    if ((payload.clipType === 'vibe' && isVibeTrack) || 
        (payload.clipType === 'fx' && isFxTrack)) {
      onClipDrop?.(payload, timeMs, trackId)
      console.log(`[TimelineCanvas] 🎬 Dropped ${payload.clipType} at ${(timeMs/1000).toFixed(2)}s on track ${trackId}`)
    }
  }, [getTrackAtY, getTimeAtX, onClipDrop])
  
  // ═══════════════════════════════════════════════════════════════════════
  // WAVE 2006: CLIP INTERACTION
  // ═══════════════════════════════════════════════════════════════════════
  
  const handleClipSelect = useCallback((clipId: string, e: React.MouseEvent) => {
    onClipSelect?.(clipId, e.shiftKey || e.ctrlKey || e.metaKey)
  }, [onClipSelect])
  
  const handleClipDragStart = useCallback((clipId: string, e: React.MouseEvent) => {
    const clip = clips.find(c => c.id === clipId)
    if (!clip) return
    
    setDraggingClipId(clipId)
    // WAVE 2013.5: Store original position for correct delta calculation
    dragStartRef.current = { x: e.clientX, startMs: clip.startMs, originalEdgeMs: 0 }
  }, [clips])
  
  const handleClipResizeStart = useCallback((clipId: string, edge: 'left' | 'right', e: React.MouseEvent) => {
    const clip = clips.find(c => c.id === clipId)
    if (!clip) return
    
    // WAVE 2013.5: Store the ORIGINAL edge time at drag start
    const originalEdgeMs = edge === 'left' ? clip.startMs : clip.endMs
    setResizingClip({ id: clipId, edge })
    dragStartRef.current = { x: e.clientX, startMs: clip.startMs, originalEdgeMs }
  }, [clips])
  
  // Global mouse move/up for drag operations
  useEffect(() => {
    if (!draggingClipId && !resizingClip) return
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return
      
      // WAVE 2013.5: Correct delta calculation
      // deltaX is in pixels, convert to milliseconds using zoom level
      const deltaX = e.clientX - dragStartRef.current.x
      const deltaMs = (deltaX / viewport.pixelsPerSecond) * 1000
      
      if (draggingClipId) {
        // MOVE: Calculate new position from ORIGINAL startMs + delta
        const newStartMs = Math.max(0, dragStartRef.current.startMs + deltaMs)
        onClipMove?.(draggingClipId, newStartMs)
      } else if (resizingClip) {
        // RESIZE: Calculate new edge time from ORIGINAL edge position + delta
        // This prevents drift by always calculating from the fixed starting point
        const newTimeMs = Math.max(0, dragStartRef.current.originalEdgeMs + deltaMs)
        onClipResize?.(resizingClip.id, resizingClip.edge, newTimeMs)
      }
    }
    
    const handleMouseUp = () => {
      setDraggingClipId(null)
      setResizingClip(null)
      dragStartRef.current = null
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [draggingClipId, resizingClip, viewport.pixelsPerSecond, clips, onClipMove, onClipResize])
  
  // ═══════════════════════════════════════════════════════════════════════
  // WAVE 2006: CLIP RENDERING HELPERS
  // ═══════════════════════════════════════════════════════════════════════
  
  const getTrackYOffset = useCallback((trackId: string): number => {
    let offset = 0
    for (const track of DEFAULT_TRACKS) {
      if (track.id === trackId) return offset
      offset += track.height
    }
    return offset
  }, [])
  
  const getTrackHeight = useCallback((trackId: string): number => {
    const track = DEFAULT_TRACKS.find(t => t.id === trackId)
    return track?.height ?? 40
  }, [])

  // Calculate waveform track position (second track, after ruler)
  const waveformTrackIndex = DEFAULT_TRACKS.findIndex(t => t.type === 'waveform')
  const waveformTrackY = waveformTrackIndex >= 0 
    ? DEFAULT_TRACKS.slice(0, waveformTrackIndex).reduce((sum, t) => sum + t.height, 0)
    : 0
  const waveformTrack = waveformTrackIndex >= 0 ? DEFAULT_TRACKS[waveformTrackIndex] : null
  
  return (
    <div 
      ref={containerRef}
      className={`timeline-canvas-container ${isDragOver ? 'drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <svg
        className="timeline-canvas"
        width={dimensions.width}
        height={Math.max(dimensions.height, totalTracksHeight)}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Background - pointer events none to let SVG handle drag */}
        <rect
          x={0}
          y={0}
          width={dimensions.width}
          height={totalTracksHeight}
          fill="var(--bg-deepest)"
          pointerEvents="none"
        />
        
        {/* 🎹 WAVE 2015: GOD MODE GRID - Musical Beat Lines across ALL tracks
            - Bar lines: Bright blue, full opacity
            - Beat lines: Subtle blue
            - Highlight: When dragging, nearby beats glow white
        */}
        {(() => {
          const lines: React.ReactNode[] = []
          const msPerBeat = 60000 / bpm
          const msPerBar = msPerBeat * 4
          const pixelsPerMs = viewport.pixelsPerSecond / 1000
          
          // Show beat subdivisions when zoomed in enough
          const showBeats = viewport.pixelsPerSecond > 30
          
          // Find first bar in viewport
          const firstBar = Math.max(0, Math.floor(viewport.startTime / msPerBar))
          const lastBar = Math.ceil(viewport.endTime / msPerBar)
          
          // Calculate if we're dragging (for glow effect)
          const isDragging = draggingClipId !== null || resizingClip !== null
          const dragClip = draggingClipId 
            ? clips.find(c => c.id === draggingClipId) 
            : resizingClip 
              ? clips.find(c => c.id === resizingClip.id) 
              : null
          const dragTimeMs = dragClip?.startMs ?? null
          const dragEndMs = dragClip?.endMs ?? null
          
          for (let bar = firstBar; bar <= lastBar; bar++) {
            // Bar line
            const barTimeMs = bar * msPerBar
            const barX = TRACK_LABEL_WIDTH + (barTimeMs - viewport.startTime) * pixelsPerMs
            
            if (barX >= TRACK_LABEL_WIDTH && barX <= dimensions.width) {
              // 🌟 WAVE 2015: Highlight if clip edge is near this beat
              const isNearDrag = isDragging && dragTimeMs !== null && (
                Math.abs(barTimeMs - dragTimeMs) < msPerBeat * 0.5 ||
                (dragEndMs !== null && Math.abs(barTimeMs - dragEndMs) < msPerBeat * 0.5)
              )
              
              lines.push(
                <line
                  key={`bar-${bar}`}
                  x1={barX}
                  y1={32} // Start below ruler
                  x2={barX}
                  y2={totalTracksHeight}
                  stroke={isNearDrag ? '#ffffff' : 'rgba(59, 130, 246, 0.35)'}
                  strokeWidth={isNearDrag ? 2 : 1}
                  opacity={isNearDrag ? 0.9 : 1}
                  pointerEvents="none"
                  className={isNearDrag ? 'grid-line-glow' : ''}
                />
              )
            }
            
            // Beat lines within this bar
            if (showBeats) {
              for (let beat = 1; beat < 4; beat++) {
                const beatTimeMs = barTimeMs + (beat * msPerBeat)
                const beatX = TRACK_LABEL_WIDTH + (beatTimeMs - viewport.startTime) * pixelsPerMs
                
                if (beatX >= TRACK_LABEL_WIDTH && beatX <= dimensions.width) {
                  // 🌟 WAVE 2015: Highlight if clip edge is near this beat
                  const isNearDrag = isDragging && dragTimeMs !== null && (
                    Math.abs(beatTimeMs - dragTimeMs) < msPerBeat * 0.3 ||
                    (dragEndMs !== null && Math.abs(beatTimeMs - dragEndMs) < msPerBeat * 0.3)
                  )
                  
                  lines.push(
                    <line
                      key={`beat-${bar}-${beat}`}
                      x1={beatX}
                      y1={32}
                      x2={beatX}
                      y2={totalTracksHeight}
                      stroke={isNearDrag ? '#ffffff' : 'rgba(59, 130, 246, 0.12)'}
                      strokeWidth={isNearDrag ? 1.5 : 0.5}
                      opacity={isNearDrag ? 0.8 : 1}
                      pointerEvents="none"
                      className={isNearDrag ? 'grid-line-glow' : ''}
                    />
                  )
                }
              }
            }
          }
          return lines
        })()}
        
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
        
        {/* WAVE 2006 + 2013.6: Render Clips (with live duration for growing clip) */}
        {clips.map(clip => {
          // WAVE 2013.6: THE ADRENALINE SHOT
          // If this is the growing clip and we have a live endMs, use it instead of stale state
          const isThisClipGrowing = growingClipId === clip.id
          const liveEndMs = (isThisClipGrowing && growingClipEndMs !== null) 
            ? growingClipEndMs 
            : clip.endMs
          
          const x = TRACK_LABEL_WIDTH + ((clip.startMs - viewport.startTime) / 1000) * viewport.pixelsPerSecond
          const width = ((liveEndMs - clip.startMs) / 1000) * viewport.pixelsPerSecond
          const y = getTrackYOffset(clip.trackId)
          const height = getTrackHeight(clip.trackId) - 4 // Padding
          
          // Skip if completely outside viewport (but never skip growing clip)
          if (!isThisClipGrowing && (x + width < TRACK_LABEL_WIDTH || x > dimensions.width)) return null
          
          return (
            <ClipRenderer
              key={clip.id}
              clip={clip}
              x={Math.max(TRACK_LABEL_WIDTH, x)}
              width={Math.max(4, width)} // Minimum 4px to always be visible
              y={y + 2}
              height={height}
              isSelected={selectedClipIds.has(clip.id)}
              isGrowing={isThisClipGrowing}
              onSelect={handleClipSelect}
              onDragStart={handleClipDragStart}
              onResizeStart={handleClipResizeStart}
              onContextMenu={onClipContextMenu}
            />
          )
        })}
        
        {/* WAVE 2006: Snap Indicator Line */}
        {snapEnabled && snapPosition !== null && (
          <line
            x1={TRACK_LABEL_WIDTH + ((snapPosition - viewport.startTime) / 1000) * viewport.pixelsPerSecond}
            y1={0}
            x2={TRACK_LABEL_WIDTH + ((snapPosition - viewport.startTime) / 1000) * viewport.pixelsPerSecond}
            y2={totalTracksHeight}
            stroke="#22d3ee"
            strokeWidth={2}
            opacity={0.8}
            strokeDasharray="4 2"
            className="snap-indicator"
            pointerEvents="none"
          />
        )}
        
        {/* WAVE 2006: Drop Target Highlight */}
        {isDragOver && dragTrackId && dragTimeMs !== null && (
          <>
            {/* Track highlight */}
            <rect
              x={TRACK_LABEL_WIDTH}
              y={getTrackYOffset(dragTrackId)}
              width={dimensions.width - TRACK_LABEL_WIDTH}
              height={getTrackHeight(dragTrackId)}
              fill="rgba(34, 211, 238, 0.1)"
              stroke="#22d3ee"
              strokeWidth={2}
              strokeDasharray="8 4"
              pointerEvents="none"
            />
            {/* Drop position line */}
            <line
              x1={TRACK_LABEL_WIDTH + ((dragTimeMs - viewport.startTime) / 1000) * viewport.pixelsPerSecond}
              y1={getTrackYOffset(dragTrackId)}
              x2={TRACK_LABEL_WIDTH + ((dragTimeMs - viewport.startTime) / 1000) * viewport.pixelsPerSecond}
              y2={getTrackYOffset(dragTrackId) + getTrackHeight(dragTrackId)}
              stroke="#22d3ee"
              strokeWidth={3}
              pointerEvents="none"
            />
          </>
        )}
        
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
              pointerEvents="none"
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
      
      {/* WAVE 2006: Status Bar */}
      <div className="timeline-status-bar">
        {/* Snap Toggle */}
        <button 
          className={`status-btn ${snapEnabled ? 'active' : ''}`}
          title="Magnetic Grid (Snap to Beats)"
        >
          🧲 {snapEnabled ? 'SNAP ON' : 'SNAP OFF'}
        </button>
        
        {/* Follow Toggle */}
        <button 
          className={`status-btn ${followEnabled ? 'active' : ''}`}
          onClick={onFollowToggle}
          title="Auto-scroll to follow playhead"
        >
          🎯 {followEnabled ? 'FOLLOW' : 'FREE'}
        </button>
        
        {/* Zoom indicator */}
        <span className="zoom-value">{Math.round(viewport.pixelsPerSecond)}px/s</span>
        <span className="zoom-hint">Ctrl+Scroll to zoom</span>
      </div>
    </div>
  )
})

TimelineCanvas.displayName = 'TimelineCanvas'

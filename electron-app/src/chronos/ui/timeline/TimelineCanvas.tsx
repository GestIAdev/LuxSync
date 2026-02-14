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

import React, { useRef, useState, useCallback, useEffect, useLayoutEffect, memo, useMemo } from 'react'
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
 * 🎹 WAVE 2040.9b: SEMANTIC TIMELINE — Track labels match MixBus reality
 * 
 * VISUAL MAPPING:
 *   fx1 → GLOBAL  🔴  Takeovers, blinders, strobes masivos
 *   fx2 → MOVEMENT 🟡  Pan/tilt, scans, sweeps, chases
 *   fx3 → AMBIENT  🟢  Niebla, lluvia, auroras, breaths
 *   fx4 → ACCENT   🔵  Destellos cortos, zoom hits, solos
 * 
 * Heights graduales: alta prioridad visual (40) → detalles finos (32)
 * Colors: coherentes con NewClipModal MixBus selector
 * 
 * NOTA: Los trackId internos ('fx1'-'fx4') NO cambian.
 *       Solo cambian label, height y color. Zero riesgo de rotura.
 */
const DEFAULT_TRACKS: Track[] = [
  { id: 'ruler', type: 'ruler', label: 'TIME', height: 32, color: '#3b82f6' },
  // 🔧 WAVE 2040.31: Audio track diet — reduced from 80px to 64px for vertical space
  { id: 'waveform', type: 'waveform', label: 'AUDIO', height: 64, color: '#22d3ee' },
  // 🔧 WAVE 2040.30: DIETA DE VIBES — reducimos height de 48 a 32px para liberar espacio vertical
  { id: 'vibe', type: 'vibe', label: 'VIBE', height: 32, color: '#a855f7' },
  { id: 'fx1', type: 'fx', label: 'GLOBAL', height: 40, color: '#ef4444' },
  { id: 'fx2', type: 'fx', label: 'MOVEMENT', height: 40, color: '#f59e0b' },
  { id: 'fx3', type: 'fx', label: 'AMBIENT', height: 36, color: '#10b981' },
  { id: 'fx4', type: 'fx', label: 'ACCENT', height: 32, color: '#3b82f6' },
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
  
  // 🔥 WAVE 2040.40: INFINITE HORIZON — Calculate last bar from SCREEN WIDTH
  // Not from viewport.endTime (which is a logical concept, not visual limit)
  const visibleWidth = width - TRACK_LABEL_WIDTH
  const visibleDurationMs = visibleWidth / pixelsPerMs
  const viewportEnd = viewport.startTime + visibleDurationMs
  const lastBar = Math.ceil(viewportEnd / msPerBar) + 1  // +1 for safety margin
  
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
  
  // 🔧 WAVE 2040.13: PLAYHEAD ALWAYS VISIBLE (no hardcoded 2000px limit)
  // SVG viewport will naturally clip if playhead is outside visible area
  // This fixes: "playhead appears 1s late and disappears 1s early"
  
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
  // � WAVE 2040.39: NUCLEAR OPTION — Start with any dimensions
  // ResizeObserver will fix it BEFORE paint (browser-level timing)
  const [dimensions, setDimensions] = useState({ width: 1920, height: 400 })
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
    
    // 🚀 WAVE 2040.15: UNCHAINED SCROLL
    // Safe zone at 95% - playhead can travel almost to the edge before scroll kicks in
    const safeZoneEnd = viewportWidth * 0.95
    
    // If playhead exits right side of safe zone, scroll so playhead is at 10% from left
    if (playheadPosition > safeZoneEnd || playheadPosition < 0) {
      // Position playhead at 10% from left edge (not center)
      const targetStart = currentTime - viewportDuration * 0.05
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
  // 🔥 WAVE 2040.39: NUCLEAR OPTION — ResizeObserver at browser level
  // This executes AFTER layout but BEFORE paint (perfect timing window)
  // No React tricks, no setTimeout, no useLayoutEffect games
  // Just pure browser API doing what it does best
  
  // Store viewport in ref to access inside ResizeObserver without deps
  const viewportRef = useRef(viewport)
  useEffect(() => { viewportRef.current = viewport }, [viewport])
  
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    
    // � NUCLEAR: Native ResizeObserver — fires before paint
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const newWidth = Math.round(entry.contentRect.width)
        const newHeight = Math.round(entry.contentRect.height)
        
        // Skip invalid or unchanged dimensions
        if (newWidth === 0 || newHeight === 0) return
        
        // � SYNCHRONOUS state update — React batches this with current render
        setDimensions({ width: newWidth, height: newHeight })
      }
    })
    
    // Observe starts immediately — catches mount + any resize
    resizeObserver.observe(container)
    
    return () => {
      resizeObserver.disconnect()
    }
  }, [])  // Mount once, never re-run
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🎹 WAVE 2040.12: ELASTIC TRACKS — Dynamic height distribution
  // 
  // PROBLEM: Canvas taller than track sum → void space at bottom with orphan grid
  // SOLUTION: Weighted elastic distribution prioritizing AUDIO track
  // 
  // ALGORITHM:
  // 1. Calculate total fixed height from DEFAULT_TRACKS
  // 2. If container height > fixed → distribute surplus proportionally
  // 3. AUDIO track gets 50% weight, others share 50% equally
  // 4. Result: ACCENT track always touches bottom edge, no void space
  // ═══════════════════════════════════════════════════════════════════════
  
  const elasticTracks = useMemo(() => {
    const totalFixedHeight = DEFAULT_TRACKS.reduce((sum, t) => sum + t.height, 0)
    const availableHeight = dimensions.height
    
    // If we have surplus space, distribute it elastically
    if (availableHeight > totalFixedHeight) {
      const surplus = availableHeight - totalFixedHeight
      
      // AUDIO gets 50% of surplus, rest shared equally among other tracks
      const audioWeight = 0.5
      const otherTracksCount = DEFAULT_TRACKS.length - 1 // Exclude audio
      const otherWeight = (1 - audioWeight) / otherTracksCount
      
      return DEFAULT_TRACKS.map(track => {
        if (track.type === 'waveform') {
          // AUDIO track absorbs most of the surplus
          return { ...track, height: track.height + (surplus * audioWeight) }
        } else {
          // Other tracks get equal share of remaining surplus
          return { ...track, height: track.height + (surplus * otherWeight) }
        }
      })
    }
    
    // No surplus → use default heights
    return DEFAULT_TRACKS
  }, [dimensions.height])
  
  // Calculate total tracks height (now using elastic heights)
  const totalTracksHeight = elasticTracks.reduce((sum, t) => sum + t.height, 0)
  
  // WAVE 2040.7: Visible canvas height — fill the container, not just the tracks
  const visibleCanvasHeight = Math.max(dimensions.height, totalTracksHeight)
  
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
          // 🔧 WAVE 2040.14: VIEWPORT RECALIBRATION — Clamp to t=0, no negative scroll
          // User should zoom out to see t=0 clips fully, not scroll into negative time
          const minStartTime = 0
          const newStart = Math.max(minStartTime, prev.startTime + panAmount)
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
  // WAVE 2006: DRAG & DROP FROM ARSENAL (WAVE 2040.12: Use elastic tracks)
  // ═══════════════════════════════════════════════════════════════════════
  
  const getTrackAtY = useCallback((y: number): string | null => {
    let accY = 0
    for (const track of elasticTracks) {
      if (y >= accY && y < accY + track.height) {
        return track.id
      }
      accY += track.height
    }
    return null
  }, [elasticTracks])
  
  const getTimeAtX = useCallback((x: number): number => {
    const offsetX = x - TRACK_LABEL_WIDTH
    return viewport.startTime + (offsetX / viewport.pixelsPerSecond) * 1000
  }, [viewport])
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    const types = e.dataTransfer.types
    
    // Detect drag type using TYPE-SPECIFIC mime types
    // WAVE 2030.17: Added luxsync-heph for Hephaestus custom FX
    const isVibeDrag = types.includes('application/luxsync-vibe')
    const isFxDrag = types.includes('application/luxsync-fx') || types.includes('application/luxsync-heph')
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
    
    // Determine if drop is valid (vibe→vibe, fx→fx tracks 1-4)
    const isVibeTrack = trackId === 'vibe'
    // WAVE 2030.17: Expanded to all 4 FX tracks
    const isFxTrack = trackId === 'fx1' || trackId === 'fx2' || trackId === 'fx3' || trackId === 'fx4'
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
    
    // WAVE 2040.18: Read the FULL JSON payload, not the ID-only HEPH mime
    // Priority: luxsync-fx (full JSON with Diamond Data) → luxsync-clip (generic)
    // NOTE: 'application/luxsync-heph' only carries the clip ID string,
    // NOT the full JSON payload. Reading it first was causing silent drop failures.
    const data = e.dataTransfer.getData('application/luxsync-fx')
               || e.dataTransfer.getData('application/luxsync-clip')
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
    // WAVE 2030.17: Expanded to all 4 FX tracks
    const isFxTrack = trackId === 'fx1' || trackId === 'fx2' || trackId === 'fx3' || trackId === 'fx4'
    
    if ((payload.clipType === 'vibe' && isVibeTrack) || 
        (payload.clipType === 'fx' && isFxTrack)) {
      onClipDrop?.(payload, timeMs, trackId)
      // WAVE 2030.17: Enhanced logging for Hephaestus
      const sourceLabel = payload.source === 'hephaestus' ? '⚒️ HEPH' : '🎹'
      console.log(`[TimelineCanvas] 🎬 ${sourceLabel} Dropped ${payload.clipType} at ${(timeMs/1000).toFixed(2)}s on track ${trackId}`)
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
  // WAVE 2006: CLIP RENDERING HELPERS (WAVE 2040.12: Use elastic tracks)
  // ═══════════════════════════════════════════════════════════════════════
  
  const getTrackYOffset = useCallback((trackId: string): number => {
    let offset = 0
    for (const track of elasticTracks) {
      if (track.id === trackId) return offset
      offset += track.height
    }
    return offset
  }, [elasticTracks])
  
  const getTrackHeight = useCallback((trackId: string): number => {
    const track = elasticTracks.find(t => t.id === trackId)
    return track?.height ?? 40
  }, [elasticTracks])

  // Calculate waveform track position (second track, after ruler)
  const waveformTrackIndex = elasticTracks.findIndex(t => t.type === 'waveform')
  const waveformTrackY = waveformTrackIndex >= 0 
    ? elasticTracks.slice(0, waveformTrackIndex).reduce((sum: number, t) => sum + t.height, 0)
    : 0
  const waveformTrack = waveformTrackIndex >= 0 ? elasticTracks[waveformTrackIndex] : null
  
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
        height={visibleCanvasHeight}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Background — WAVE 2040.7: Fill entire visible container, not just tracks */}
        <rect
          x={0}
          y={0}
          width={dimensions.width}
          height={visibleCanvasHeight}
          fill="var(--bg-deepest)"
          pointerEvents="none"
        />
        
        {/* 🎹 WAVE 2015: GOD MODE GRID - Musical Beat Lines across ALL tracks
            - Bar lines: Bright blue, full opacity
            - Beat lines: Subtle blue
            - Highlight: When dragging, nearby beats glow white
            
            🔥 WAVE 2040.40: INFINITE HORIZON — Grid fills entire viewport width
            - Previously: Drew only up to viewport.endTime (12s default = cut short)
            - Now: Draws to edge of physical screen width, regardless of viewport duration
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
          
          // 🔥 WAVE 2040.40: INFINITE HORIZON — Calculate last bar from SCREEN WIDTH
          // Not from viewport.endTime (which might be shorter than visible area)
          const visibleWidth = dimensions.width - TRACK_LABEL_WIDTH
          const visibleDurationMs = visibleWidth / pixelsPerMs
          const viewportEnd = viewport.startTime + visibleDurationMs
          const lastBar = Math.ceil(viewportEnd / msPerBar) + 1  // +1 for safety margin
          
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
                  y2={visibleCanvasHeight}
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
                      y2={visibleCanvasHeight}
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
        
        {/* Render tracks (WAVE 2040.12: Use elastic heights) */}
        {elasticTracks.map((track, index) => {
          const yOffset = elasticTracks
            .slice(0, index)
            .reduce((sum: number, t) => sum + t.height, 0)
          
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
          let liveEndMs = (isThisClipGrowing && growingClipEndMs !== null) 
            ? growingClipEndMs 
            : clip.endMs
          
          // 🎭 WAVE 2040.10b: INFINITE VIBE RENDER
          // Make VIBE clips render continuously until next VIBE clip on same track (or viewport end)
          if (clip.type === 'vibe' && !isThisClipGrowing) {
            // Find next VIBE clip on same track
            const nextVibeClip = clips
              .filter(c => c.type === 'vibe' && c.trackId === clip.trackId && c.startMs > clip.startMs)
              .sort((a, b) => a.startMs - b.startMs)[0]
            
            if (nextVibeClip) {
              liveEndMs = nextVibeClip.startMs // Extend to next VIBE
            } else {
              // No next VIBE — extend to viewport end + 10 seconds (infinite feel)
              liveEndMs = viewport.startTime + (dimensions.width * 1000 / viewport.pixelsPerSecond) + 10000
            }
          }
          
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
            y2={visibleCanvasHeight}
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
          height={visibleCanvasHeight}
        />
        
        {/* Track separator lines (WAVE 2040.12: Use elastic heights) */}
        {elasticTracks.map((_, index) => {
          if (index === 0) return null
          const y = elasticTracks
            .slice(0, index)
            .reduce((sum: number, t) => sum + t.height, 0)
          
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

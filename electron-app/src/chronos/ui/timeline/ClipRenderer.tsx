/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎬 CLIP RENDERER - WAVE 2013: THE LIVING CLIP
 * 
 * Renders timeline clips (vibes, effects) with interaction support.
 * 
 * FEATURES:
 * - Visual clip rendering with color coding
 * - Selection highlighting
 * - Resize handles (left/right edges)
 * - Hover states
 * - Drag feedback
 * - WAVE 2013: "Growing" animation for active recording clips
 * 
 * @module chronos/ui/timeline/ClipRenderer
 * @version WAVE 2013
 */

import React, { useCallback, memo, useState } from 'react'
import type { TimelineClip, VibeClip, FXClip } from '../../core/TimelineClip'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ClipRendererProps {
  /** Clip data */
  clip: TimelineClip
  
  /** X position in pixels */
  x: number
  
  /** Width in pixels */
  width: number
  
  /** Y offset for track position */
  y: number
  
  /** Track height */
  height: number
  
  /** Is this clip selected */
  isSelected: boolean
  
  /** WAVE 2013: Is this clip actively growing during recording? */
  isGrowing?: boolean
  
  /** Click handler */
  onSelect: (clipId: string, event: React.MouseEvent) => void
  
  /** Double click handler (for edit) */
  onDoubleClick?: (clipId: string) => void
  
  /** Drag start handler */
  onDragStart?: (clipId: string, event: React.MouseEvent) => void
  
  /** Resize start handler */
  onResizeStart?: (clipId: string, edge: 'left' | 'right', event: React.MouseEvent) => void
  
  /** Context menu handler */
  onContextMenu?: (clipId: string, event: React.MouseEvent) => void
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const RESIZE_HANDLE_WIDTH = 8
const MIN_CLIP_WIDTH_FOR_HANDLES = 24
const BORDER_RADIUS = 4

// ═══════════════════════════════════════════════════════════════════════════
// VIBE CLIP RENDERER
// ═══════════════════════════════════════════════════════════════════════════

const VibeClipContent: React.FC<{ clip: VibeClip; width: number; height: number }> = memo(({
  clip,
  width,
  height,
}) => {
  const canShowLabel = width > 60
  const canShowIcon = width > 30
  
  return (
    <>
      {/* Gradient fill */}
      <defs>
        <linearGradient id={`vibe-gradient-${clip.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={clip.color} stopOpacity={0.9} />
          <stop offset="50%" stopColor={clip.color} stopOpacity={0.7} />
          <stop offset="100%" stopColor={clip.color} stopOpacity={0.5} />
        </linearGradient>
      </defs>
      
      {/* Fade in/out regions */}
      {clip.fadeInMs > 0 && (
        <polygon
          points={`0,${height} ${Math.min(width * 0.1, 20)},0 ${Math.min(width * 0.1, 20)},${height}`}
          fill={clip.color}
          opacity={0.3}
        />
      )}
      
      {/* Label */}
      {canShowLabel && (
        <text
          x={width / 2}
          y={height / 2 + 4}
          textAnchor="middle"
          fill="#fff"
          fontSize="10"
          fontFamily="var(--font-mono)"
          fontWeight="600"
          filter="url(#fx-label-shadow)"
        >
          {clip.label}
        </text>
      )}
      
      {/* Icon only for small clips */}
      {!canShowLabel && canShowIcon && (
        <text
          x={width / 2}
          y={height / 2 + 5}
          textAnchor="middle"
          fill="#fff"
          fontSize="14"
        >
          🎭
        </text>
      )}
    </>
  )
})

VibeClipContent.displayName = 'VibeClipContent'

// ═══════════════════════════════════════════════════════════════════════════
// FX CLIP RENDERER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚡ WAVE 2040.18: CORE FX ICON MAPPING
 * Maps effect types to their visual icons (emojis for now, SVG later)
 */
const FX_ICONS: Record<string, string> = {
  'strobe': '⚡',
  'sweep': '🌊',
  'pulse': '💓',
  'chase': '🎯',
  'fade': '🌅',
  'blackout': '⬛',
  'color-wash': '🎨',
  'intensity-ramp': '📈',
}

const FXClipContent: React.FC<{ clip: FXClip; width: number; height: number }> = memo(({
  clip,
  width,
  height,
}) => {
  const canShowLabel = width > 50
  const canShowIcon = width > 30
  
  // ⚡ WAVE 2040.18 → 2040.19: Get icon for this effect type
  const effectIcon = FX_ICONS[clip.fxType] || '⚙️'

  // ⚡ WAVE 2040.19: Hero icon size — proportional to clip height, clamped
  const heroFontSize = Math.min(Math.max(height * 0.6, 18), 40)
  
  return (
    <>
      {/* ⚡ WAVE 2040.19: HERO ICON — single centered watermark, no macramé */}
      {canShowIcon && (
        <text
          x={width / 2}
          y={height / 2 + heroFontSize * 0.35}
          textAnchor="middle"
          fill="rgba(255, 255, 255, 0.60)"
          fontSize={heroFontSize}
          style={{ pointerEvents: 'none' }}
        >
          {effectIcon}
        </text>
      )}
      
      {/* ⚡ WAVE 2040.19: Label with strong text shadow for legibility */}
      {canShowLabel && (
        <text
          x={6}
          y={12}
          fill="#fff"
          fontSize="9"
          fontFamily="var(--font-mono)"
          fontWeight="700"
          filter="url(#fx-label-shadow)"
        >
          {clip.label}
        </text>
      )}
    </>
  )
})

FXClipContent.displayName = 'FXClipContent'

// ═══════════════════════════════════════════════════════════════════════════
// ⚒️ WAVE 2030.17 → 2040.18: HEPHAESTUS CUSTOM FX CLIP RENDERER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚒️ WAVE 2040.17: HEPHAESTUS MIXBUS-AWARE COLOR MAPPING
 * Each Hephaestus clip gets colored by its MixBus routing.
 */
const HEPH_MIXBUS_COLORS: Record<string, string> = {
  'global':  '#ef4444',  // Red — match FX1 track
  'htp':     '#f59e0b',  // Orange — match FX2 track
  'ambient': '#10b981',  // Green — match FX3 track
  'accent':  '#3b82f6',  // Blue — match FX4 track
}
const HEPH_EMBER_COLOR = '#ff6b2b'  // Fallback ember orange

const HephClipContent: React.FC<{ clip: FXClip; width: number; height: number }> = memo(({
  clip,
  width,
  height,
}) => {
  const canShowLabel = width > 50
  const canShowIcon = width > 25
  
  /**
   * ⚒️ WAVE 2040.18: DIAMOND COLOR
   * Use the clip's actual background color (set by mixBus in createHephFXClip).
   * No need to recalculate — it's already correct.
   */
  const displayColor = clip.color
  
  /**
   * ⚒️ WAVE 2040.18: ONLY render curve if hephClip exists (Diamond Data present).
   * If no Diamond Data, show icon pattern instead (like Core FX).
   */
  const hasRealCurves = clip.hephClip && Object.keys(clip.hephClip.curves || {}).length > 0
  
  const curvePath = React.useMemo(() => {
    if (!hasRealCurves || width < 40) return null
    
    const keyframes = clip.keyframes
    if (!keyframes || keyframes.length === 0) return null
    
    // Determine time range from clip
    const clipDurationMs = clip.endMs - clip.startMs
    if (clipDurationMs <= 0) return null
    
    const points: string[] = []
    const padding = 2 // px padding top/bottom
    const drawHeight = height - padding * 2
    
    for (let i = 0; i < keyframes.length; i++) {
      const kf = keyframes[i]
      // Map offsetMs to x position
      const x = (kf.offsetMs / clipDurationMs) * width
      // Map value (0-1) to y position (inverted: 0=top, 1=bottom → we want 1=top)
      const y = padding + drawHeight * (1 - Math.max(0, Math.min(1, kf.value)))
      points.push(`${x.toFixed(1)},${y.toFixed(1)}`)
    }
    
    if (points.length < 2) return null
    return `M ${points.join(' L ')}`
  }, [hasRealCurves, width, height, clip.keyframes, clip.startMs, clip.endMs])
  
  return (
    <>
      {/* EMBER gradient background */}
      <defs>
        <linearGradient id={`heph-gradient-${clip.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={displayColor} stopOpacity={0.9} />
          <stop offset="50%" stopColor={displayColor} stopOpacity={0.7} />
          <stop offset="100%" stopColor={displayColor} stopOpacity={0.5} />
        </linearGradient>
      </defs>
      
      {/* ⚒️ WAVE 2040.18: ONLY show curve if Diamond Data present */}
      {curvePath && (
        <path
          d={curvePath}
          fill="none"
          stroke="rgba(255, 255, 255, 0.6)"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      
      {/* ⚒️ WAVE 2040.18: If no curves, show icon pattern like Core FX */}
      {!hasRealCurves && canShowIcon && (
        <text
          x={width / 2}
          y={height / 2 + 8}
          textAnchor="middle"
          fill="rgba(255, 255, 255, 0.2)"
          fontSize="20"
        >
          ⚒️
        </text>
      )}
      
      {/* ⚒️ Hephaestus icon badge */}
      {canShowIcon && (
        <text
          x={6}
          y={height - 6}
          fill="#fff"
          fontSize="10"
          opacity={0.7}
        >
          ⚒️
        </text>
      )}
      
      {/* Label — WAVE 2040.19: Consistent shadow filter */}
      {canShowLabel && (
        <text
          x={width > 60 ? 20 : 6}
          y={12}
          fill="#fff"
          fontSize="9"
          fontFamily="var(--font-mono)"
          fontWeight="700"
          filter="url(#fx-label-shadow)"
        >
          {clip.label}
        </text>
      )}
      
      {/* CUSTOM badge for very wide clips */}
      {width > 100 && (
        <text
          x={width - 6}
          y={height - 6}
          textAnchor="end"
          fill="rgba(255, 255, 255, 0.5)"
          fontSize="7"
          fontFamily="var(--font-mono)"
          fontWeight="600"
        >
          HEPH
        </text>
      )}
    </>
  )
})

HephClipContent.displayName = 'HephClipContent'

// ═══════════════════════════════════════════════════════════════════════════
// MAIN CLIP RENDERER
// ═══════════════════════════════════════════════════════════════════════════

export const ClipRenderer: React.FC<ClipRendererProps> = memo(({
  clip,
  x,
  width,
  y,
  height,
  isSelected,
  isGrowing = false,
  onSelect,
  onDoubleClick,
  onDragStart,
  onResizeStart,
  onContextMenu,
}) => {
  const [isHovered, setIsHovered] = useState(false)
  
  const showResizeHandles = width >= MIN_CLIP_WIDTH_FOR_HANDLES && (isHovered || isSelected)
  
  // Event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    
    // Check if clicking on resize handles
    const rect = (e.currentTarget as SVGGElement).getBoundingClientRect()
    const localX = e.clientX - rect.left
    
    if (showResizeHandles) {
      if (localX < RESIZE_HANDLE_WIDTH) {
        onResizeStart?.(clip.id, 'left', e)
        return
      }
      if (localX > width - RESIZE_HANDLE_WIDTH) {
        onResizeStart?.(clip.id, 'right', e)
        return
      }
    }
    
    // Regular click = select + maybe drag
    onSelect(clip.id, e)
    onDragStart?.(clip.id, e)
  }, [clip.id, width, showResizeHandles, onSelect, onDragStart, onResizeStart])
  
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onDoubleClick?.(clip.id)
  }, [clip.id, onDoubleClick])
  
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onContextMenu?.(clip.id, e)
  }, [clip.id, onContextMenu])
  
  return (
    <g
      className={`timeline-clip ${clip.type} ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''} ${isGrowing ? 'growing' : ''}`}
      transform={`translate(${x}, ${y})`}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ cursor: clip.locked ? 'not-allowed' : 'pointer' }}
    >
      {/* WAVE 2013: Growing pulse animation (active recording indicator) */}
      {isGrowing && (
        <rect
          x={width - 4}
          y={0}
          width={6}
          height={height}
          fill="#ff0055"
          opacity={0.9}
          rx={2}
          ry={2}
        >
          <animate
            attributeName="opacity"
            values="0.9;0.4;0.9"
            dur="0.5s"
            repeatCount="indefinite"
          />
        </rect>
      )}
      
      {/* WAVE 2007: Selection halo glow (behind clip) */}
      {isSelected && (
        <rect
          x={-3}
          y={-3}
          width={width + 6}
          height={height + 6}
          rx={BORDER_RADIUS + 2}
          ry={BORDER_RADIUS + 2}
          fill="none"
          stroke="#fff"
          strokeWidth={2}
          opacity={0.6}
          filter="url(#selection-glow)"
        />
      )}
      
      {/* Selection glow filter */}
      <defs>
        <filter id="selection-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* ⚡ WAVE 2040.19: Text shadow filter for FX clip labels */}
        <filter id="fx-label-shadow" x="-10%" y="-30%" width="130%" height="180%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000" floodOpacity="0.85" />
        </filter>
      </defs>
      
      {/* Clip background */}
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        rx={BORDER_RADIUS}
        ry={BORDER_RADIUS}
        fill={clip.color}
        opacity={isSelected ? 0.97 : 0.88}
        stroke={isSelected ? '#fff' : isHovered ? 'rgba(255,255,255,0.5)' : 'transparent'}
        strokeWidth={isSelected ? 2 : 1}
      />
      
      {/* Content based on type - WAVE 2030.17: Hephaestus detection */}
      {clip.type === 'vibe' ? (
        <VibeClipContent clip={clip as VibeClip} width={width} height={height} />
      ) : (clip as FXClip).isHephCustom ? (
        <HephClipContent clip={clip as FXClip} width={width} height={height} />
      ) : (
        <FXClipContent clip={clip as FXClip} width={width} height={height} />
      )}
      
      {/* Resize handles */}
      {showResizeHandles && !clip.locked && (
        <>
          {/* Left handle */}
          <rect
            x={0}
            y={0}
            width={RESIZE_HANDLE_WIDTH}
            height={height}
            fill="rgba(255,255,255,0.3)"
            rx={BORDER_RADIUS}
            style={{ cursor: 'ew-resize' }}
          />
          {/* Right handle */}
          <rect
            x={width - RESIZE_HANDLE_WIDTH}
            y={0}
            width={RESIZE_HANDLE_WIDTH}
            height={height}
            fill="rgba(255,255,255,0.3)"
            rx={BORDER_RADIUS}
            style={{ cursor: 'ew-resize' }}
          />
        </>
      )}
      
      {/* Locked indicator */}
      {clip.locked && (
        <text
          x={width - 16}
          y={height - 6}
          fontSize="10"
          fill="rgba(255,255,255,0.6)"
        >
          🔒
        </text>
      )}
    </g>
  )
})

ClipRenderer.displayName = 'ClipRenderer'

export default ClipRenderer

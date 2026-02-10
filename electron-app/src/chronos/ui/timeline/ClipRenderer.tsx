/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎬 CLIP RENDERER - WAVE 2006: THE INTERACTIVE CANVAS
 * 
 * Renders timeline clips (vibes, effects) with interaction support.
 * 
 * FEATURES:
 * - Visual clip rendering with color coding
 * - Selection highlighting
 * - Resize handles (left/right edges)
 * - Hover states
 * - Drag feedback
 * 
 * @module chronos/ui/timeline/ClipRenderer
 * @version WAVE 2006
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
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
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

const FXClipContent: React.FC<{ clip: FXClip; width: number; height: number }> = memo(({
  clip,
  width,
  height,
}) => {
  const canShowLabel = width > 50
  
  // Draw keyframe curve
  const keyframePath = React.useMemo(() => {
    if (clip.keyframes.length < 2 || width < 20) return null
    
    const clipDuration = clip.endMs - clip.startMs
    const points = clip.keyframes.map(kf => {
      const x = (kf.offsetMs / clipDuration) * width
      const y = height - (kf.value * (height - 8)) - 4
      return `${x},${y}`
    })
    
    return `M ${points.join(' L ')}`
  }, [clip.keyframes, clip.endMs, clip.startMs, width, height])
  
  return (
    <>
      {/* Keyframe automation curve */}
      {keyframePath && (
        <path
          d={keyframePath}
          fill="none"
          stroke="#fff"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.8}
        />
      )}
      
      {/* Keyframe dots */}
      {width > 40 && clip.keyframes.map((kf, i) => {
        const clipDuration = clip.endMs - clip.startMs
        const x = (kf.offsetMs / clipDuration) * width
        const y = height - (kf.value * (height - 8)) - 4
        
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={3}
            fill="#fff"
            stroke={clip.color}
            strokeWidth={1.5}
          />
        )
      })}
      
      {/* Label */}
      {canShowLabel && (
        <text
          x={6}
          y={12}
          fill="#fff"
          fontSize="9"
          fontFamily="var(--font-mono)"
          fontWeight="600"
          opacity={0.9}
        >
          {clip.label}
        </text>
      )}
    </>
  )
})

FXClipContent.displayName = 'FXClipContent'

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
      className={`timeline-clip ${clip.type} ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
      transform={`translate(${x}, ${y})`}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ cursor: clip.locked ? 'not-allowed' : 'pointer' }}
    >
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
        opacity={isSelected ? 0.95 : 0.75}
        stroke={isSelected ? '#fff' : isHovered ? 'rgba(255,255,255,0.5)' : 'transparent'}
        strokeWidth={isSelected ? 2 : 1}
      />
      
      {/* Content based on type */}
      {clip.type === 'vibe' ? (
        <VibeClipContent clip={clip as VibeClip} width={width} height={height} />
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

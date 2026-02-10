/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 USE AUTO SCROLL - WAVE 2006: THE INTERACTIVE CANVAS
 * 
 * Auto-scroll hook for keeping the playhead centered during playback.
 * 
 * FEATURES:
 * - Follow Mode: Auto-scrolls to keep playhead centered
 * - User Override: Disables follow when user scrolls manually
 * - Smooth Animation: Uses lerp for smooth scroll transitions
 * - Configurable: Adjustable follow speed and center zone
 * 
 * @module chronos/hooks/useAutoScroll
 * @version WAVE 2006
 */

import { useState, useCallback, useRef, useEffect } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface UseAutoScrollOptions {
  /** Current playback time in ms */
  currentTimeMs: number
  
  /** Is currently playing */
  isPlaying: boolean
  
  /** Viewport start time in ms */
  viewportStartMs: number
  
  /** Viewport end time in ms */
  viewportEndMs: number
  
  /** Callback to update viewport */
  setViewportStart: (startMs: number) => void
  
  /** Follow speed (0-1, higher = faster) */
  followSpeed?: number
  
  /** Center zone as percentage of viewport (0.3 = 30% from center) */
  centerZone?: number
  
  /** Delay before re-enabling follow after user scroll (ms) */
  reEnableDelay?: number
}

export interface UseAutoScrollReturn {
  /** Is follow mode enabled */
  followEnabled: boolean
  
  /** Toggle follow mode */
  toggleFollow: () => void
  
  /** Enable follow mode */
  enableFollow: () => void
  
  /** Disable follow mode */
  disableFollow: () => void
  
  /** Call when user manually scrolls */
  onUserScroll: () => void
  
  /** Is currently auto-scrolling */
  isAutoScrolling: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════

export function useAutoScroll(options: UseAutoScrollOptions): UseAutoScrollReturn {
  const {
    currentTimeMs,
    isPlaying,
    viewportStartMs,
    viewportEndMs,
    setViewportStart,
    followSpeed = 0.1,
    centerZone = 0.3,
    reEnableDelay = 2000,
  } = options
  
  // State
  const [followEnabled, setFollowEnabled] = useState(true)
  const [isAutoScrolling, setIsAutoScrolling] = useState(false)
  
  // Refs for timing
  const lastUserScrollRef = useRef<number>(0)
  const animationFrameRef = useRef<number | null>(null)
  const targetScrollRef = useRef<number>(viewportStartMs)
  
  // Calculate viewport center
  const viewportDuration = viewportEndMs - viewportStartMs
  const viewportCenter = viewportStartMs + viewportDuration / 2
  
  // Check if playhead is in center zone
  const centerStart = viewportCenter - viewportDuration * centerZone
  const centerEnd = viewportCenter + viewportDuration * centerZone
  const playheadInCenter = currentTimeMs >= centerStart && currentTimeMs <= centerEnd
  
  // Toggle follow mode
  const toggleFollow = useCallback(() => {
    setFollowEnabled(prev => !prev)
  }, [])
  
  const enableFollow = useCallback(() => {
    setFollowEnabled(true)
  }, [])
  
  const disableFollow = useCallback(() => {
    setFollowEnabled(false)
  }, [])
  
  // Handle user scroll
  const onUserScroll = useCallback(() => {
    lastUserScrollRef.current = Date.now()
    // Temporarily disable auto-scroll
    setIsAutoScrolling(false)
  }, [])
  
  // Auto-scroll effect
  useEffect(() => {
    if (!isPlaying || !followEnabled) {
      setIsAutoScrolling(false)
      return
    }
    
    // Check if user recently scrolled
    const timeSinceUserScroll = Date.now() - lastUserScrollRef.current
    if (timeSinceUserScroll < reEnableDelay) {
      setIsAutoScrolling(false)
      return
    }
    
    // Check if playhead is outside center zone
    if (playheadInCenter) {
      setIsAutoScrolling(false)
      return
    }
    
    // Calculate target scroll position (center playhead)
    const targetStart = currentTimeMs - viewportDuration / 2
    targetScrollRef.current = Math.max(0, targetStart)
    
    // Start smooth scroll animation
    setIsAutoScrolling(true)
    
    const animate = () => {
      const current = viewportStartMs
      const target = targetScrollRef.current
      
      // Lerp towards target
      const diff = target - current
      if (Math.abs(diff) < 10) {
        setViewportStart(target)
        setIsAutoScrolling(false)
        return
      }
      
      const newStart = current + diff * followSpeed
      setViewportStart(newStart)
      
      animationFrameRef.current = requestAnimationFrame(animate)
    }
    
    animationFrameRef.current = requestAnimationFrame(animate)
    
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [
    isPlaying, 
    followEnabled, 
    currentTimeMs, 
    playheadInCenter, 
    viewportDuration, 
    viewportStartMs, 
    setViewportStart, 
    followSpeed, 
    reEnableDelay
  ])
  
  return {
    followEnabled,
    toggleFollow,
    enableFollow,
    disableFollow,
    onUserScroll,
    isAutoScrolling,
  }
}

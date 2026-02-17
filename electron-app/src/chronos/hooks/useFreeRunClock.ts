/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⏰ USE FREE RUN CLOCK - WAVE 2045.2: INFINITE TAPE
 * 
 * Reloj infinito para modo LIVE que NO depende de la duración de un archivo.
 * Permite que Chronos funcione como grabadora de cinta corriendo indefinidamente.
 * 
 * ARQUITECTURA:
 * - Cuando Source == LIVE y le das PLAY/REC:
 *   1. Desacopla el transporte de la duración del audio
 *   2. Inicia cronómetro interno (performance.now() - startTime)
 *   3. Mueve playhead indefinidamente hasta STOP
 * - Ghost Recording escribe keyframes en el timeline mientras corres
 * - El playhead NO se detiene (a menos que el DJ le dé STOP)
 * 
 * DIFERENCIAS con useStreamingPlayback:
 * - useStreamingPlayback: Acoplado a HTMLAudioElement con duración fija
 * - useFreeRunClock: FREE RUN, duración = infinito, solo cronómetro
 * 
 * @module chronos/hooks/useFreeRunClock
 * @version WAVE 2045.2
 */

import { useState, useCallback, useRef, useEffect } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface FreeRunClockState {
  /** Is clock running */
  isRunning: boolean
  
  /** Current elapsed time in milliseconds */
  currentTimeMs: number
  
  /** Session start timestamp (for recovery after pause) */
  sessionStartMs: number
  
  /** Total paused duration (to compute accurate elapsed time) */
  totalPausedMs: number
}

export interface UseFreeRunClockReturn extends FreeRunClockState {
  /** Start clock from current position or 0 */
  start: () => void
  
  /** Pause clock (keeps current time) */
  pause: () => void
  
  /** Stop clock and reset to 0 */
  stop: () => void
  
  /** Resume from paused state */
  resume: () => void
  
  /** Seek to specific time (unusual for free run, but supported) */
  seek: (timeMs: number) => void
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const UPDATE_INTERVAL_MS = 16.67 // ~60fps for smooth playhead

// ═══════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════

export function useFreeRunClock(): UseFreeRunClockReturn {
  // Refs for real-time tracking (avoid stale closure)
  const isRunningRef = useRef<boolean>(false)
  const animationFrameRef = useRef<number | null>(null)
  const clockStartTimeRef = useRef<number>(0)      // performance.now() when started
  const pauseStartTimeRef = useRef<number>(0)      // performance.now() when paused
  const baseTimeOffsetRef = useRef<number>(0)      // Offset for resume after pause
  
  // React state for UI updates
  const [state, setState] = useState<FreeRunClockState>({
    isRunning: false,
    currentTimeMs: 0,
    sessionStartMs: 0,
    totalPausedMs: 0,
  })
  
  /**
   * Update state helper
   */
  const updateState = useCallback((partial: Partial<FreeRunClockState>) => {
    setState(prev => ({ ...prev, ...partial }))
  }, [])
  
  /**
   * Clock tick loop - runs at 60fps
   */
  const startTickLoop = useCallback(() => {
    const tick = () => {
      if (isRunningRef.current) {
        const now = performance.now()
        const elapsed = now - clockStartTimeRef.current + baseTimeOffsetRef.current
        
        updateState({ currentTimeMs: elapsed })
        
        animationFrameRef.current = requestAnimationFrame(tick)
      }
    }
    animationFrameRef.current = requestAnimationFrame(tick)
  }, [updateState])
  
  /**
   * Stop tick loop
   */
  const stopTickLoop = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }, [])
  
  /**
   * Start clock from current position or 0
   */
  const start = useCallback(() => {
    if (isRunningRef.current) return
    
    const now = performance.now()
    clockStartTimeRef.current = now
    isRunningRef.current = true
    
    updateState({ 
      isRunning: true,
      sessionStartMs: now,
    })
    
    startTickLoop()
    
    console.log('[FreeRunClock] ⏰ Started from', (baseTimeOffsetRef.current / 1000).toFixed(2), 's')
  }, [updateState, startTickLoop])
  
  /**
   * Pause clock (keeps current time)
   */
  const pause = useCallback(() => {
    if (!isRunningRef.current) return
    
    const now = performance.now()
    pauseStartTimeRef.current = now
    isRunningRef.current = false
    
    // Store current elapsed time as base offset for resume
    const elapsed = now - clockStartTimeRef.current + baseTimeOffsetRef.current
    baseTimeOffsetRef.current = elapsed
    
    updateState({ isRunning: false })
    stopTickLoop()
    
    console.log('[FreeRunClock] ⏸️ Paused at', (elapsed / 1000).toFixed(2), 's')
  }, [updateState, stopTickLoop])
  
  /**
   * Resume from paused state
   */
  const resume = useCallback(() => {
    if (isRunningRef.current) return
    
    const now = performance.now()
    
    // Calculate paused duration
    let newTotalPausedMs = state.totalPausedMs
    if (pauseStartTimeRef.current > 0) {
      const pausedDuration = now - pauseStartTimeRef.current
      newTotalPausedMs += pausedDuration
    }
    
    clockStartTimeRef.current = now
    isRunningRef.current = true
    
    updateState({ 
      isRunning: true,
      totalPausedMs: newTotalPausedMs,
    })
    startTickLoop()
    
    console.log('[FreeRunClock] ▶️ Resumed from', (baseTimeOffsetRef.current / 1000).toFixed(2), 's')
  }, [state.totalPausedMs, updateState, startTickLoop])
  
  /**
   * Stop clock and reset to 0
   */
  const stop = useCallback(() => {
    isRunningRef.current = false
    stopTickLoop()
    
    // Reset all time tracking
    clockStartTimeRef.current = 0
    pauseStartTimeRef.current = 0
    baseTimeOffsetRef.current = 0
    
    updateState({ 
      isRunning: false,
      currentTimeMs: 0,
      sessionStartMs: 0,
      totalPausedMs: 0,
    })
    
    console.log('[FreeRunClock] ⏹️ Stopped and reset')
  }, [updateState, stopTickLoop])
  
  /**
   * Seek to specific time (for manual scrubbing in LIVE mode)
   */
  const seek = useCallback((timeMs: number) => {
    const clampedTime = Math.max(0, timeMs)
    
    if (isRunningRef.current) {
      // If running, update base offset and restart from new position
      const now = performance.now()
      clockStartTimeRef.current = now
      baseTimeOffsetRef.current = clampedTime
      updateState({ currentTimeMs: clampedTime })
    } else {
      // If paused, just update base offset
      baseTimeOffsetRef.current = clampedTime
      updateState({ currentTimeMs: clampedTime })
    }
    
    console.log('[FreeRunClock] ⏭️ Seek to', (clampedTime / 1000).toFixed(2), 's')
  }, [updateState])
  
  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      stopTickLoop()
    }
  }, [stopTickLoop])
  
  return {
    ...state,
    start,
    pause,
    resume,
    stop,
    seek,
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎵 USE STREAMING PLAYBACK - WAVE 2005.4: THE SPECTRAL LINK
 * 
 * Streaming audio playback using HTMLAudioElement.
 * The audio streams directly from disk via Blob URL - never loaded to RAM.
 * 
 * ARCHITECTURE:
 * - Uses <audio> element with src = blob URL (from useAudioLoaderPhantom)
 * - Streaming from disk, constant ~5MB memory footprint
 * - Supports seek, play/pause, playback rate
 * - Emits currentTime updates at 60fps for UI sync
 * 
 * WHY NOT AudioBufferSourceNode:
 * - BufferSource requires decodeAudioData → loads entire file to RAM
 * - 170MB MP3 = 2GB+ decoded PCM in memory
 * - MediaElementSource streams, no RAM bloat
 * 
 * @module chronos/hooks/useStreamingPlayback
 * @version WAVE 2005.4
 */

import { useState, useCallback, useRef, useEffect } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface StreamingPlaybackState {
  /** Is audio loaded and ready to play */
  isReady: boolean
  
  /** Is currently playing */
  isPlaying: boolean
  
  /** Current playback time in milliseconds */
  currentTimeMs: number
  
  /** Total duration in milliseconds */
  durationMs: number
  
  /** Playback rate (1.0 = normal) */
  playbackRate: number
  
  /** Volume (0.0 - 1.0) */
  volume: number
  
  /** Is looping enabled */
  looping: boolean
  
  /** Error if failed to load */
  error: string | null
}

export interface UseStreamingPlaybackReturn extends StreamingPlaybackState {
  /** Load audio from Blob URL */
  loadAudio: (blobUrl: string) => void
  
  /** Unload current audio */
  unloadAudio: () => void
  
  /** Toggle play/pause */
  togglePlay: () => void
  
  /** Play */
  play: () => Promise<void>
  
  /** Pause */
  pause: () => void
  
  /** Stop (pause + seek to 0) */
  stop: () => void
  
  /** Seek to time in milliseconds */
  seek: (timeMs: number) => void
  
  /** Set playback rate (0.25 - 4.0) */
  setPlaybackRate: (rate: number) => void
  
  /** Set volume (0.0 - 1.0) */
  setVolume: (vol: number) => void
  
  /** Toggle looping */
  setLooping: (enabled: boolean) => void
  
  /** Reference to audio element (for external use if needed) */
  audioRef: React.RefObject<HTMLAudioElement>
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const UPDATE_INTERVAL_MS = 16.67 // ~60fps

// ═══════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════

export function useStreamingPlayback(): UseStreamingPlaybackReturn {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const currentBlobUrlRef = useRef<string | null>(null)
  const isPlayingRef = useRef<boolean>(false) // 🎵 Use ref to avoid stale closure
  
  const [state, setState] = useState<StreamingPlaybackState>({
    isReady: false,
    isPlaying: false,
    currentTimeMs: 0,
    durationMs: 0,
    playbackRate: 1.0,
    volume: 1.0,
    looping: false,
    error: null,
  })
  
  /**
   * Update state helper
   */
  const updateState = useCallback((partial: Partial<StreamingPlaybackState>) => {
    setState(prev => ({ ...prev, ...partial }))
  }, [])
  
  /**
   * Create audio element if not exists
   */
  const ensureAudioElement = useCallback(() => {
    if (!audioRef.current) {
      console.log('[StreamingPlayback] 🎵 Creating audio element')
      audioRef.current = new Audio()
      audioRef.current.preload = 'metadata'
    }
    return audioRef.current
  }, [])
  
  /**
   * Start time update loop - uses ref to avoid stale closure
   */
  const startTimeUpdateLoop = useCallback(() => {
    const update = () => {
      if (audioRef.current && isPlayingRef.current) {
        const currentTimeMs = audioRef.current.currentTime * 1000
        updateState({ currentTimeMs })
        animationFrameRef.current = requestAnimationFrame(update)
      }
    }
    animationFrameRef.current = requestAnimationFrame(update)
  }, [updateState])
  
  /**
   * Stop time update loop
   */
  const stopTimeUpdateLoop = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }, [])
  
  /**
   * Load audio from Blob URL
   */
  const loadAudio = useCallback((blobUrl: string) => {
    const audio = ensureAudioElement()
    
    console.log('[StreamingPlayback] 📂 Loading audio from Blob URL')
    
    // Clean up previous
    if (currentBlobUrlRef.current && currentBlobUrlRef.current !== blobUrl) {
      // Previous URL will be revoked by the loader, not here
      audio.pause()
      stopTimeUpdateLoop()
    }
    
    currentBlobUrlRef.current = blobUrl
    
    // Reset state
    updateState({
      isReady: false,
      isPlaying: false,
      currentTimeMs: 0,
      durationMs: 0,
      error: null,
    })
    
    // Set up event handlers
    audio.onloadedmetadata = () => {
      const durationMs = audio.duration * 1000
      console.log(`[StreamingPlayback] ⏱️ Duration: ${(durationMs / 1000).toFixed(2)}s`)
      updateState({ 
        isReady: true, 
        durationMs,
      })
    }
    
    audio.onplay = () => {
      console.log('[StreamingPlayback] ▶️ Playing')
      isPlayingRef.current = true
      updateState({ isPlaying: true })
      startTimeUpdateLoop()
    }
    
    audio.onpause = () => {
      console.log('[StreamingPlayback] ⏸️ Paused')
      isPlayingRef.current = false
      updateState({ isPlaying: false })
      stopTimeUpdateLoop()
    }
    
    audio.onended = () => {
      console.log('[StreamingPlayback] ⏹️ Ended')
      isPlayingRef.current = false
      updateState({ 
        isPlaying: false, 
        currentTimeMs: audio.duration * 1000,
      })
      stopTimeUpdateLoop()
    }
    
    audio.onerror = (e) => {
      console.error('[StreamingPlayback] ❌ Error:', e)
      updateState({ 
        error: 'Failed to load audio',
        isReady: false,
      })
    }
    
    audio.ontimeupdate = () => {
      // Backup time update for when not using RAF
      if (!animationFrameRef.current) {
        updateState({ currentTimeMs: audio.currentTime * 1000 })
      }
    }
    
    // Load the audio
    audio.src = blobUrl
    audio.load()
  }, [ensureAudioElement, updateState, startTimeUpdateLoop, stopTimeUpdateLoop])
  
  /**
   * Unload current audio
   */
  const unloadAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      stopTimeUpdateLoop()
    }
    currentBlobUrlRef.current = null
    isPlayingRef.current = false
    
    updateState({
      isReady: false,
      isPlaying: false,
      currentTimeMs: 0,
      durationMs: 0,
      error: null,
    })
    
    console.log('[StreamingPlayback] 🗑️ Audio unloaded')
  }, [stopTimeUpdateLoop, updateState])
  
  /**
   * Play
   */
  const play = useCallback(async () => {
    if (!audioRef.current || !state.isReady) {
      console.warn('[StreamingPlayback] Cannot play: audio not ready')
      return
    }
    
    try {
      await audioRef.current.play()
    } catch (err) {
      console.error('[StreamingPlayback] Play error:', err)
      updateState({ error: 'Playback failed' })
    }
  }, [state.isReady, updateState])
  
  /**
   * Pause
   */
  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
    }
  }, [])
  
  /**
   * Toggle play/pause
   */
  const togglePlay = useCallback(() => {
    if (state.isPlaying) {
      pause()
    } else {
      play()
    }
  }, [state.isPlaying, play, pause])
  
  /**
   * Stop (pause + seek to 0)
   */
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      isPlayingRef.current = false
      updateState({ 
        isPlaying: false, 
        currentTimeMs: 0,
      })
      stopTimeUpdateLoop()
    }
  }, [updateState, stopTimeUpdateLoop])
  
  /**
   * Seek to time in milliseconds
   */
  const seek = useCallback((timeMs: number) => {
    if (!audioRef.current) return
    
    const clampedTime = Math.max(0, Math.min(timeMs, state.durationMs))
    audioRef.current.currentTime = clampedTime / 1000
    updateState({ currentTimeMs: clampedTime })
    
    console.log(`[StreamingPlayback] ⏭️ Seek to ${(clampedTime / 1000).toFixed(2)}s`)
  }, [state.durationMs, updateState])
  
  /**
   * Set playback rate
   */
  const setPlaybackRate = useCallback((rate: number) => {
    const clampedRate = Math.max(0.25, Math.min(rate, 4.0))
    
    if (audioRef.current) {
      audioRef.current.playbackRate = clampedRate
    }
    
    updateState({ playbackRate: clampedRate })
  }, [updateState])
  
  /**
   * Set volume
   */
  const setVolume = useCallback((vol: number) => {
    const clampedVol = Math.max(0, Math.min(vol, 1))
    
    if (audioRef.current) {
      audioRef.current.volume = clampedVol
    }
    
    updateState({ volume: clampedVol })
  }, [updateState])
  
  /**
   * Set looping
   */
  const setLooping = useCallback((enabled: boolean) => {
    if (audioRef.current) {
      audioRef.current.loop = enabled
    }
    
    updateState({ looping: enabled })
  }, [updateState])
  
  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      stopTimeUpdateLoop()
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
      }
    }
  }, [stopTimeUpdateLoop])
  
  // Fix: audioRef needs to be a proper RefObject for external use
  const externalAudioRef = useRef<HTMLAudioElement>(null!)
  
  // Keep external ref in sync
  useEffect(() => {
    if (audioRef.current) {
      (externalAudioRef as React.MutableRefObject<HTMLAudioElement>).current = audioRef.current
    }
  }, [state.isReady])
  
  return {
    ...state,
    loadAudio,
    unloadAudio,
    togglePlay,
    play,
    pause,
    stop,
    seek,
    setPlaybackRate,
    setVolume,
    setLooping,
    audioRef: externalAudioRef,
  }
}

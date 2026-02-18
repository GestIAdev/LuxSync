/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎮 USE SCENE PLAYER - WAVE 2053.2: REMOTE CONTROL
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * DUMB frontend remote for .lux scene playback.
 * 
 * THIS HOOK DOES NOT:
 *   ❌ Run effect classes
 *   ❌ Convert HSL→RGB
 *   ❌ Send commands to MasterArbiter
 *   ❌ Process zoneOverrides
 *   ❌ Interpolate keyframes
 *   ❌ Instantiate ILightEffect instances
 *
 * THIS HOOK DOES:
 *   ✅ Manage <audio> element (load, play, pause, seek)
 *   ✅ Run requestAnimationFrame clock for UI sync
 *   ✅ Send lux:playback:tick(timeMs) to backend every frame
 *   ✅ Send lux:playback:load(project) on scene load
 *   ✅ Send lux:playback:stop on stop
 *   ✅ Expose progress/state for Hyperion UI (bar, play/pause)
 * 
 * All lighting physics run in TimelineEngine.ts (Main process).
 * 
 * @module hooks/useScenePlayer
 * @version WAVE 2053.2
 */

import { useRef, useState, useCallback, useEffect } from 'react'
import type { LuxProject } from '../chronos/core/ChronosProject'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type PlayerState = 'idle' | 'loaded' | 'playing' | 'paused'

export interface ScenePlayerStatus {
  /** Estado actual del player */
  state: PlayerState
  /** Escena cargada */
  project: LuxProject | null
  /** Tiempo actual en ms */
  currentTimeMs: number
  /** Duración total en ms */
  durationMs: number
  /** Progreso normalizado (0-1) */
  progress: number
  /** ¿Loop activo? */
  loop: boolean
  /** Número de clips activos en este frame (reported by backend) */
  activeClipCount: number
  /** ¿Tiene audio válido cargado? (false = silent playback mode) */
  hasAudio: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// BACKEND API ACCESSOR
// ═══════════════════════════════════════════════════════════════════════════

function getPlaybackApi() {
  return (window as any).lux?.playback
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════

export function useScenePlayer() {
  // ── State ──
  const [status, setStatus] = useState<ScenePlayerStatus>({
    state: 'idle',
    project: null,
    currentTimeMs: 0,
    durationMs: 0,
    progress: 0,
    loop: false,
    activeClipCount: 0,
    hasAudio: false,
  })

  // ── Refs (no re-render) ──
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const projectRef = useRef<LuxProject | null>(null)
  const loopRef = useRef(false)

  // ── Silent Clock refs (performance.now() based) ──
  const silentModeRef = useRef(false)
  const clockStartRef = useRef(0)
  const clockOffsetRef = useRef(0)

  // ═══════════════════════════════════════════════════════════════════════
  // LOAD SCENE → Backend
  // ═══════════════════════════════════════════════════════════════════════

  const loadScene = useCallback(async (project: LuxProject, audioUrl?: string) => {
    // Stop current playback
    stopPlayback()

    projectRef.current = project
    silentModeRef.current = true
    clockOffsetRef.current = 0

    // ── Audio setup ──
    let audioLoaded = false
    if (audioUrl) {
      try {
        const audio = new Audio(audioUrl)
        audio.preload = 'auto'

        await new Promise<void>((resolve, reject) => {
          audio.oncanplaythrough = () => resolve()
          audio.onerror = () => reject(new Error('Audio load failed'))
          setTimeout(() => reject(new Error('Audio load timeout')), 3000)
        })

        audioRef.current = audio
        silentModeRef.current = false
        audioLoaded = true
        console.log('[ScenePlayer] 🔊 Audio loaded OK')
      } catch (err) {
        console.warn(`[ScenePlayer] 🔇 Audio unavailable: ${(err as Error).message}. Silent mode.`)
        audioRef.current = null
        silentModeRef.current = true
      }
    }

    const durationMs = project.meta.durationMs ||
      (audioRef.current ? audioRef.current.duration * 1000 : 60000)

    // ── Send project to backend TimelineEngine ──
    const api = getPlaybackApi()
    if (api?.load) {
      const result = await api.load(project)
      if (!result.success) {
        console.error(`[ScenePlayer] ❌ Backend load failed: ${result.error}`)
      }
    }

    setStatus({
      state: 'loaded',
      project,
      currentTimeMs: 0,
      durationMs,
      progress: 0,
      loop: loopRef.current,
      activeClipCount: 0,
      hasAudio: audioLoaded,
    })

    console.log(
      `[ScenePlayer] 🎬 Loaded: "${project.meta.name}" ` +
      `(${Math.round(durationMs / 1000)}s, ${project.timeline.clips.length} clips, ` +
      `audio: ${audioLoaded ? 'YES' : 'SILENT'})`
    )
  }, [])

  // ═══════════════════════════════════════════════════════════════════════
  // TICK — rAF loop: clock + IPC tick to backend
  // ═══════════════════════════════════════════════════════════════════════

  const tick = useCallback(() => {
    const project = projectRef.current
    if (!project) return

    // ── HYBRID CLOCK: Audio clock OR performance.now() ──
    let currentTimeMs: number
    const audio = audioRef.current

    if (!silentModeRef.current && audio) {
      currentTimeMs = audio.currentTime * 1000
    } else {
      currentTimeMs = clockOffsetRef.current + (performance.now() - clockStartRef.current)
    }

    const durationMs = project.meta.durationMs ||
      (audio && !silentModeRef.current ? audio.duration * 1000 : 60000)

    // ── Check for end ──
    const hasEnded = silentModeRef.current
      ? currentTimeMs >= durationMs
      : (audio?.ended ?? currentTimeMs >= durationMs)

    if (hasEnded) {
      if (loopRef.current) {
        if (!silentModeRef.current && audio) {
          audio.currentTime = 0
          audio.play()
        } else {
          clockStartRef.current = performance.now()
          clockOffsetRef.current = 0
        }
        currentTimeMs = 0
      } else {
        stopPlayback()
        return
      }
    }

    // ── Send tick to backend (fire-and-forget) ──
    const api = getPlaybackApi()
    if (api?.tick) {
      api.tick(currentTimeMs)
    }

    // ── Update UI status (visual sync only) ──
    setStatus(prev => ({
      ...prev,
      state: 'playing',
      currentTimeMs,
      durationMs,
      progress: durationMs > 0 ? currentTimeMs / durationMs : 0,
    }))

    // ── Next frame ──
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  // ═══════════════════════════════════════════════════════════════════════
  // TRANSPORT CONTROLS
  // ═══════════════════════════════════════════════════════════════════════

  const play = useCallback(() => {
    const project = projectRef.current
    if (!project) return

    const audio = audioRef.current
    if (!silentModeRef.current && audio) {
      audio.play().catch(err => {
        console.warn('[ScenePlayer] Audio play failed, switching to silent mode:', err.message)
        silentModeRef.current = true
        audioRef.current = null
      })
    }

    // Start silent clock (always set — it's the fallback)
    clockStartRef.current = performance.now()

    // Start rAF loop
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)

    setStatus(prev => ({ ...prev, state: 'playing', hasAudio: !silentModeRef.current }))
    console.log(`[ScenePlayer] ▶ Play (${silentModeRef.current ? 'silent' : 'audio'} mode)`)
  }, [tick])

  const pause = useCallback(() => {
    const audio = audioRef.current
    if (!silentModeRef.current && audio) {
      audio.pause()
    }

    // Save accumulated time for silent clock resume
    if (silentModeRef.current) {
      clockOffsetRef.current += performance.now() - clockStartRef.current
    }

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    setStatus(prev => ({ ...prev, state: 'paused' }))
    console.log('[ScenePlayer] ⏸ Pause')
  }, [])

  const stopPlayback = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }

    // Reset silent clock
    clockStartRef.current = 0
    clockOffsetRef.current = 0

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    // ── Tell backend to stop (clears effects + arbiter) ──
    const api = getPlaybackApi()
    if (api?.stop) {
      api.stop().catch(() => {})
    }

    setStatus(prev => ({
      ...prev,
      state: prev.project ? 'loaded' : 'idle',
      currentTimeMs: 0,
      progress: 0,
      activeClipCount: 0,
    }))

    console.log('[ScenePlayer] ⏹ Stop')
  }, [])

  const stop = stopPlayback

  const seek = useCallback((timeMs: number) => {
    const audio = audioRef.current
    if (!silentModeRef.current && audio) {
      audio.currentTime = timeMs / 1000
    }
    // Reset silent clock to this position
    clockOffsetRef.current = timeMs
    clockStartRef.current = performance.now()

    setStatus(prev => ({
      ...prev,
      currentTimeMs: timeMs,
      progress: prev.durationMs > 0 ? timeMs / prev.durationMs : 0,
    }))
  }, [])

  const toggleLoop = useCallback(() => {
    loopRef.current = !loopRef.current
    if (audioRef.current) {
      audioRef.current.loop = loopRef.current
    }
    setStatus(prev => ({ ...prev, loop: loopRef.current }))
  }, [])

  const unloadScene = useCallback(() => {
    stopPlayback()
    if (audioRef.current) {
      audioRef.current.src = ''
      audioRef.current = null
    }
    projectRef.current = null
    silentModeRef.current = false
    
    setStatus({
      state: 'idle',
      project: null,
      currentTimeMs: 0,
      durationMs: 0,
      progress: 0,
      loop: false,
      activeClipCount: 0,
      hasAudio: false,
    })
  }, [stopPlayback])

  // ═══════════════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════════════

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
      }
      // Tell backend to stop on unmount
      const api = getPlaybackApi()
      if (api?.stop) {
        api.stop().catch(() => {})
      }
    }
  }, [])

  // ═══════════════════════════════════════════════════════════════════════
  // RETURN
  // ═══════════════════════════════════════════════════════════════════════

  return {
    status,
    loadScene,
    unloadScene,
    play,
    pause,
    stop,
    seek,
    toggleLoop,
  }
}

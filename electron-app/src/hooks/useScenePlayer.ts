/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎬 USE SCENE PLAYER - WAVE 2050: HYPERION SCENE PLAYER ENGINE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Reproduce escenas .lux exportadas desde Chronos directamente en Hyperion.
 * 
 * ARQUITECTURA:
 * - HTMLAudioElement para audio (no AudioContext — más simple y fiable)
 * - requestAnimationFrame loop para sync visual
 * - En cada frame: busca clips activos, envía comandos al MasterArbiter
 * - Respeta GrandMaster de Hyperion (multiplica, no sobrescribe)
 * - Source of truth: el .lux file es autosuficiente
 * 
 * FLUJO:
 * 1. Importar .lux → parseado a LuxProject
 * 2. loadScene(project) → carga audio + prepara timeline
 * 3. play() → inicia audio + rAF loop
 * 4. Cada frame: evalúa clips → despacha a Arbiter
 * 5. stop() → limpia todo
 * 
 * @module hooks/useScenePlayer
 * @version WAVE 2050
 */

import { useRef, useState, useCallback, useEffect } from 'react'
import type { LuxProject } from '../chronos/core/ChronosProject'
import type { TimelineClip, VibeClip, FXClip } from '../chronos/core/TimelineClip'

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
  /** Último vibe aplicado */
  activeVibe: string | null
  /** Número de clips activos en este frame */
  activeClipCount: number
}

// ═══════════════════════════════════════════════════════════════════════════
// ARBITER API ACCESSOR
// ═══════════════════════════════════════════════════════════════════════════

function getArbiterApi() {
  return (window as any).lux?.arbiter
}

function getLuxApi() {
  return (window as any).lux
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
    activeVibe: null,
    activeClipCount: 0,
  })

  // ── Refs (no re-render) ──
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const projectRef = useRef<LuxProject | null>(null)
  const loopRef = useRef(false)
  const lastVibeRef = useRef<string | null>(null)
  const lastFxSetRef = useRef<Set<string>>(new Set())

  // ═══════════════════════════════════════════════════════════════════════
  // LOAD SCENE
  // ═══════════════════════════════════════════════════════════════════════

  const loadScene = useCallback(async (project: LuxProject, audioUrl?: string) => {
    // Detener reproducción actual
    stopPlayback()

    projectRef.current = project
    lastVibeRef.current = null
    lastFxSetRef.current = new Set()

    // Preparar audio si existe
    if (audioUrl) {
      const audio = new Audio(audioUrl)
      audio.preload = 'auto'
      audioRef.current = audio

      // Esperar a que cargue
      await new Promise<void>((resolve, reject) => {
        audio.oncanplaythrough = () => resolve()
        audio.onerror = () => reject(new Error('Failed to load audio'))
        // Timeout safety
        setTimeout(() => resolve(), 5000)
      })
    }

    const durationMs = project.meta.durationMs ||
      (audioRef.current ? audioRef.current.duration * 1000 : 60000)

    setStatus({
      state: 'loaded',
      project,
      currentTimeMs: 0,
      durationMs,
      progress: 0,
      loop: loopRef.current,
      activeVibe: null,
      activeClipCount: 0,
    })

    console.log(`[ScenePlayer] 🎬 Loaded: "${project.meta.name}" (${Math.round(durationMs / 1000)}s, ${project.timeline.clips.length} clips)`)
  }, [])

  // ═══════════════════════════════════════════════════════════════════════
  // PLAYBACK LOOP (rAF)
  // ═══════════════════════════════════════════════════════════════════════

  const tick = useCallback(() => {
    const project = projectRef.current
    if (!project) return

    const audio = audioRef.current
    const currentTimeMs = audio ? audio.currentTime * 1000 : 0
    const durationMs = project.meta.durationMs ||
      (audio ? audio.duration * 1000 : 60000)

    // ── Check for end ──
    if (audio && audio.ended) {
      if (loopRef.current) {
        audio.currentTime = 0
        audio.play()
      } else {
        stopPlayback()
        return
      }
    }

    // ── Find active clips ──
    const activeClips = project.timeline.clips.filter(
      clip => currentTimeMs >= clip.startMs && currentTimeMs < clip.endMs
    )

    // ── Process Vibe Clips ──
    const activeVibes = activeClips.filter(c => c.type === 'vibe') as VibeClip[]
    if (activeVibes.length > 0) {
      // Take highest intensity vibe
      const dominant = activeVibes.reduce((a, b) => a.intensity > b.intensity ? a : b)
      
      if (lastVibeRef.current !== dominant.vibeType) {
        lastVibeRef.current = dominant.vibeType
        const luxApi = getLuxApi()
        if (luxApi?.setVibe) {
          luxApi.setVibe(dominant.vibeType).catch(() => {
            // Silent fail — vibe system might not be available
          })
        }
      }
    }

    // ── Process FX Clips → Arbiter ──
    const activeFx = activeClips.filter(c => c.type === 'fx') as FXClip[]
    const currentFxIds = new Set(activeFx.map(fx => fx.id))
    
    // Release FX that ended
    for (const prevId of lastFxSetRef.current) {
      if (!currentFxIds.has(prevId)) {
        // FX clip ended — clear its overrides
        const arbiter = getArbiterApi()
        if (arbiter?.clearAllManual) {
          arbiter.clearAllManual().catch(() => {})
        }
      }
    }
    lastFxSetRef.current = currentFxIds

    // Apply active FX overrides
    for (const fx of activeFx) {
      dispatchFxToArbiter(fx, currentTimeMs)
    }

    // ── Update status ──
    setStatus(prev => ({
      ...prev,
      state: 'playing',
      currentTimeMs,
      durationMs,
      progress: durationMs > 0 ? currentTimeMs / durationMs : 0,
      activeVibe: lastVibeRef.current,
      activeClipCount: activeClips.length,
    }))

    // ── Next frame ──
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  // ═══════════════════════════════════════════════════════════════════════
  // FX → ARBITER DISPATCH
  // ═══════════════════════════════════════════════════════════════════════

  function dispatchFxToArbiter(fx: FXClip, currentTimeMs: number) {
    const arbiter = getArbiterApi()
    if (!arbiter?.setManual) return

    // Calculate local time within clip
    const localTimeMs = currentTimeMs - fx.startMs
    const clipDurationMs = fx.endMs - fx.startMs
    const t = clipDurationMs > 0 ? localTimeMs / clipDurationMs : 0

    // Interpolate keyframes
    const intensity = interpolateKeyframes(fx.keyframes, localTimeMs)

    // Build controls based on FX type
    const controls: Record<string, number> = {}
    const channels: string[] = []

    switch (fx.fxType) {
      case 'strobe':
        controls.dimmer = intensity > 0.5 ? 1 : 0
        channels.push('dimmer')
        break

      case 'blackout':
        controls.dimmer = 0
        channels.push('dimmer')
        break

      case 'color-wash': {
        // Use params for RGB if available
        const r = typeof fx.params?.red === 'number' ? fx.params.red as number : 255
        const g = typeof fx.params?.green === 'number' ? fx.params.green as number : 0
        const b = typeof fx.params?.blue === 'number' ? fx.params.blue as number : 255
        controls.red = r * intensity
        controls.green = g * intensity
        controls.blue = b * intensity
        controls.dimmer = intensity
        channels.push('red', 'green', 'blue', 'dimmer')
        break
      }

      case 'intensity-ramp':
        controls.dimmer = intensity
        channels.push('dimmer')
        break

      case 'sweep':
        controls.pan = t * 255
        controls.dimmer = intensity
        channels.push('pan', 'dimmer')
        break

      case 'chase':
        controls.dimmer = intensity
        channels.push('dimmer')
        break

      case 'pulse':
        controls.dimmer = intensity
        channels.push('dimmer')
        break

      case 'fade':
        controls.dimmer = intensity
        channels.push('dimmer')
        break

      default:
        controls.dimmer = intensity
        channels.push('dimmer')
    }

    // Get target fixtures from zones or ALL
    const zones = fx.zones
    
    // Dispatch to arbiter — zones handled server-side
    arbiter.setManual({
      fixtureIds: zones || ['*'],
      controls,
      channels,
      source: 'scene_player',
      autoReleaseMs: 100, // Auto-release after 100ms if no refresh
    }).catch(() => {
      // Silent fail — arbiter might not be running
    })
  }

  // ═══════════════════════════════════════════════════════════════════════
  // KEYFRAME INTERPOLATION
  // ═══════════════════════════════════════════════════════════════════════

  function interpolateKeyframes(
    keyframes: FXClip['keyframes'],
    localTimeMs: number
  ): number {
    if (!keyframes || keyframes.length === 0) return 1

    // Before first keyframe
    if (localTimeMs <= keyframes[0].offsetMs) return keyframes[0].value

    // After last keyframe
    if (localTimeMs >= keyframes[keyframes.length - 1].offsetMs) {
      return keyframes[keyframes.length - 1].value
    }

    // Find surrounding keyframes
    for (let i = 0; i < keyframes.length - 1; i++) {
      const k1 = keyframes[i]
      const k2 = keyframes[i + 1]

      if (localTimeMs >= k1.offsetMs && localTimeMs < k2.offsetMs) {
        const range = k2.offsetMs - k1.offsetMs
        const t = range > 0 ? (localTimeMs - k1.offsetMs) / range : 0

        switch (k1.easing) {
          case 'step': return k1.value
          case 'linear': return k1.value + (k2.value - k1.value) * t
          case 'ease-in': return k1.value + (k2.value - k1.value) * (t * t)
          case 'ease-out': return k1.value + (k2.value - k1.value) * (1 - (1 - t) * (1 - t))
          case 'ease-in-out': {
            const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
            return k1.value + (k2.value - k1.value) * ease
          }
          default: return k1.value + (k2.value - k1.value) * t
        }
      }
    }

    return keyframes[keyframes.length - 1].value
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TRANSPORT CONTROLS
  // ═══════════════════════════════════════════════════════════════════════

  const play = useCallback(() => {
    const project = projectRef.current
    if (!project) return

    const audio = audioRef.current
    if (audio) {
      audio.play().catch(err => {
        console.warn('[ScenePlayer] Audio play failed:', err.message)
      })
    }

    // Start rAF loop
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)

    setStatus(prev => ({ ...prev, state: 'playing' }))
    console.log('[ScenePlayer] ▶ Play')
  }, [tick])

  const pause = useCallback(() => {
    const audio = audioRef.current
    if (audio) audio.pause()

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

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    // Clear arbiter overrides
    const arbiter = getArbiterApi()
    if (arbiter?.clearAllManual) {
      arbiter.clearAllManual().catch(() => {})
    }

    lastVibeRef.current = null
    lastFxSetRef.current = new Set()

    setStatus(prev => ({
      ...prev,
      state: prev.project ? 'loaded' : 'idle',
      currentTimeMs: 0,
      progress: 0,
      activeVibe: null,
      activeClipCount: 0,
    }))

    console.log('[ScenePlayer] ⏹ Stop')
  }, [])

  const stop = stopPlayback

  const seek = useCallback((timeMs: number) => {
    const audio = audioRef.current
    if (audio) {
      audio.currentTime = timeMs / 1000
    }
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
    
    setStatus({
      state: 'idle',
      project: null,
      currentTimeMs: 0,
      durationMs: 0,
      progress: 0,
      loop: false,
      activeVibe: null,
      activeClipCount: 0,
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
      // Clear arbiter on unmount
      const arbiter = getArbiterApi()
      if (arbiter?.clearAllManual) {
        arbiter.clearAllManual().catch(() => {})
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

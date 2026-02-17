/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎬 USE SCENE PLAYER - WAVE 2050.1: HYBRID CLOCK ENGINE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Reproduce escenas .lux exportadas desde Chronos directamente en Hyperion.
 * 
 * ARQUITECTURA:
 * - DUAL CLOCK: Audio clock (si disponible) o performance.now() fallback
 * - requestAnimationFrame loop para sync visual
 * - En cada frame: busca clips activos, envía comandos al MasterArbiter
 * - Respeta GrandMaster de Hyperion (multiplica, no sobrescribe)
 * - Source of truth: el .lux file es autosuficiente
 * 
 * WAVE 2050.1 FIX — HYBRID CLOCK:
 * El audio de un .lux viene como ruta/blob que puede ser inválida.
 * Si no hay audio o falla la carga → "Silent Playback" mode:
 * performance.now() - startTime = currentTimeMs.
 * Las luces se mueven SIEMPRE, con o sin audio.
 * 
 * @module hooks/useScenePlayer
 * @version WAVE 2050.1
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
  /** ¿Tiene audio válido cargado? (false = silent playback mode) */
  hasAudio: boolean
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
    hasAudio: false,
  })

  // ── Refs (no re-render) ──
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const projectRef = useRef<LuxProject | null>(null)
  const loopRef = useRef(false)
  const lastVibeRef = useRef<string | null>(null)
  const lastFxSetRef = useRef<Set<string>>(new Set())

  // ── Silent Clock refs (performance.now() based) ──
  const silentModeRef = useRef(false)
  const clockStartRef = useRef(0)       // performance.now() when play() was called
  const clockOffsetRef = useRef(0)      // accumulated time before last pause (ms)
  const pauseStampRef = useRef(0)       // performance.now() at pause moment

  // ═══════════════════════════════════════════════════════════════════════
  // LOAD SCENE
  // ═══════════════════════════════════════════════════════════════════════

  const loadScene = useCallback(async (project: LuxProject, audioUrl?: string) => {
    // Detener reproducción actual
    stopPlayback()

    projectRef.current = project
    lastVibeRef.current = null
    lastFxSetRef.current = new Set()
    silentModeRef.current = true  // Default: silent until audio proves valid
    clockOffsetRef.current = 0
    pauseStampRef.current = 0

    // Preparar audio si existe
    let audioLoaded = false
    if (audioUrl) {
      try {
        const audio = new Audio(audioUrl)
        audio.preload = 'auto'

        await new Promise<void>((resolve, reject) => {
          audio.oncanplaythrough = () => resolve()
          audio.onerror = () => reject(new Error('Audio load failed'))
          // Timeout: si en 3s no carga, seguimos sin audio
          setTimeout(() => reject(new Error('Audio load timeout')), 3000)
        })

        audioRef.current = audio
        silentModeRef.current = false
        audioLoaded = true
        console.log('[ScenePlayer] 🔊 Audio loaded OK')
      } catch (err) {
        // Audio muerto — no pasa nada, entramos en Silent Playback
        console.warn(`[ScenePlayer] 🔇 Audio unavailable: ${(err as Error).message}. Silent playback mode.`)
        audioRef.current = null
        silentModeRef.current = true
      }
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
      hasAudio: audioLoaded,
    })

    console.log(
      `[ScenePlayer] 🎬 Loaded: "${project.meta.name}" ` +
      `(${Math.round(durationMs / 1000)}s, ${project.timeline.clips.length} clips, ` +
      `audio: ${audioLoaded ? 'YES' : 'SILENT'})`
    )
  }, [])

  // ═══════════════════════════════════════════════════════════════════════
  // PLAYBACK LOOP (rAF)
  // ═══════════════════════════════════════════════════════════════════════

  const tick = useCallback(() => {
    const project = projectRef.current
    if (!project) return

    // ── HYBRID CLOCK: Audio clock OR performance.now() ──
    let currentTimeMs: number
    const audio = audioRef.current

    if (!silentModeRef.current && audio) {
      // Audio mode: use audio.currentTime as master clock
      currentTimeMs = audio.currentTime * 1000
    } else {
      // Silent mode: performance.now() based clock
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
        // Reset clock for loop
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

    // Build controls based on FX type
    const controls: Record<string, number> = {}
    const channels: string[] = []

    // ═══════════════════════════════════════════════════════════════════════
    // 🔥 WAVE 2050.4: HEPHAESTUS CUSTOM CLIPS (.lfx)
    // These have their own curve system in hephClip.curves
    // ═══════════════════════════════════════════════════════════════════════
    if (fx.fxType === 'heph-custom' && (fx as any).hephClip?.curves) {
      const curves = (fx as any).hephClip.curves as Record<string, {
        keyframes: Array<{ timeMs: number; value: number; interpolation?: string }>
      }>
      
      // Process each curve
      for (const [paramId, curve] of Object.entries(curves)) {
        if (!curve.keyframes || curve.keyframes.length === 0) continue
        
        const value = interpolateHephKeyframes(curve.keyframes, localTimeMs)
        
        // Map paramId to DMX channel
        switch (paramId) {
          case 'intensity':
          case 'dimmer':
            controls.dimmer = value
            if (!channels.includes('dimmer')) channels.push('dimmer')
            break
          case 'white':
            // White = RGB(255,255,255) * value
            controls.red = 255 * value
            controls.green = 255 * value
            controls.blue = 255 * value
            controls.dimmer = Math.max(controls.dimmer ?? 0, value)
            if (!channels.includes('red')) channels.push('red')
            if (!channels.includes('green')) channels.push('green')
            if (!channels.includes('blue')) channels.push('blue')
            if (!channels.includes('dimmer')) channels.push('dimmer')
            break
          case 'red':
            controls.red = 255 * value
            if (!channels.includes('red')) channels.push('red')
            break
          case 'green':
            controls.green = 255 * value
            if (!channels.includes('green')) channels.push('green')
            break
          case 'blue':
            controls.blue = 255 * value
            if (!channels.includes('blue')) channels.push('blue')
            break
          case 'pan':
            controls.pan = 255 * value
            if (!channels.includes('pan')) channels.push('pan')
            break
          case 'tilt':
            controls.tilt = 255 * value
            if (!channels.includes('tilt')) channels.push('tilt')
            break
          case 'gobo':
          case 'gobo_wheel':
            controls.gobo_wheel = 255 * value
            if (!channels.includes('gobo_wheel')) channels.push('gobo_wheel')
            break
          case 'strobe':
            controls.strobe = 255 * value
            if (!channels.includes('strobe')) channels.push('strobe')
            break
          default:
            // Unknown param — pass through as normalized
            controls[paramId] = value
            if (!channels.includes(paramId)) channels.push(paramId)
        }
      }
    } else {
      // ═════════════════════════════════════════════════════════════════════
      // STANDARD FX CLIPS (legacy keyframes)
      // ═════════════════════════════════════════════════════════════════════
      const intensity = interpolateKeyframes(fx.keyframes, localTimeMs)
      
      // Cast to string for dynamic core effects (not in FXType union)
      const fxTypeStr = fx.fxType as string

      switch (fxTypeStr) {
        case 'strobe':
          controls.dimmer = intensity > 0.5 ? 1 : 0
          channels.push('dimmer')
          break

        case 'blackout':
          controls.dimmer = 0
          channels.push('dimmer')
          break

        case 'color-wash': {
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
        case 'fade':
        case 'pulse':
        case 'chase':
          controls.dimmer = intensity
          channels.push('dimmer')
          break

        case 'sweep':
          controls.pan = t * 255
          controls.dimmer = intensity
          channels.push('pan', 'dimmer')
          break

        // ═══════════════════════════════════════════════════════════════════
        // 🔥 WAVE 2050.4: CORE EFFECTS — Default intense white behaviors
        // ═══════════════════════════════════════════════════════════════════
        case 'core_meltdown':
          // Meltdown: pulsing white heat with intensity
          controls.dimmer = intensity
          controls.red = 255 * intensity
          controls.green = 200 * intensity  // Slightly warm
          controls.blue = 150 * intensity
          channels.push('dimmer', 'red', 'green', 'blue')
          break

        case 'industrial_strobe':
          // Harsh white strobe
          controls.dimmer = intensity > 0.3 ? 1 : 0
          controls.red = 255
          controls.green = 255
          controls.blue = 255
          channels.push('dimmer', 'red', 'green', 'blue')
          break

        case 'void_mist':
          // Deep blue atmospheric
          controls.dimmer = intensity * 0.6  // Softer
          controls.red = 50 * intensity
          controls.green = 100 * intensity
          controls.blue = 255 * intensity
          channels.push('dimmer', 'red', 'green', 'blue')
          break

        case 'neon_surge':
          // Vibrant magenta
          controls.dimmer = intensity
          controls.red = 255 * intensity
          controls.green = 0
          controls.blue = 255 * intensity
          channels.push('dimmer', 'red', 'green', 'blue')
          break

        case 'solar_flare':
          // Warm orange burst
          controls.dimmer = intensity
          controls.red = 255 * intensity
          controls.green = 150 * intensity
          controls.blue = 0
          channels.push('dimmer', 'red', 'green', 'blue')
          break

        case 'thunder_crack':
          // White flash
          controls.dimmer = intensity > 0.5 ? 1 : 0
          controls.red = 255
          controls.green = 255
          controls.blue = 255
          channels.push('dimmer', 'red', 'green', 'blue')
          break

        default:
          controls.dimmer = intensity
          channels.push('dimmer')
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 🎨 WAVE 2050.4: AUTO-WHITE INJECTION
    // If we're sending dimmer > 0 but NO color, inject pure white.
    // Prevents "invisible" intensity without color.
    // ═══════════════════════════════════════════════════════════════════════
    if (controls.dimmer !== undefined && controls.dimmer > 0) {
      if (controls.red === undefined && controls.green === undefined && controls.blue === undefined) {
        controls.red = 255
        controls.green = 255
        controls.blue = 255
        if (!channels.includes('red')) channels.push('red')
        if (!channels.includes('green')) channels.push('green')
        if (!channels.includes('blue')) channels.push('blue')
      }
    }

    // Get target fixtures from zones or ALL
    // WAVE 2050.3: Fix empty array — [] is truthy but means "all fixtures"
    const zones = fx.zones
    const targetFixtures = zones && zones.length > 0 ? zones : ['*']
    
    // Dispatch to arbiter — zones handled server-side
    arbiter.setManual({
      fixtureIds: targetFixtures,
      controls,
      channels,
      source: 'scene_player',
      autoReleaseMs: 100, // Auto-release after 100ms if no refresh
    }).catch(() => {
      // Silent fail — arbiter might not be running
    })
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HEPHAESTUS KEYFRAME INTERPOLATION (timeMs based, not offsetMs)
  // ═══════════════════════════════════════════════════════════════════════

  function interpolateHephKeyframes(
    keyframes: Array<{ timeMs: number; value: number; interpolation?: string }>,
    localTimeMs: number
  ): number {
    if (!keyframes || keyframes.length === 0) return 0

    // Before first keyframe
    if (localTimeMs <= keyframes[0].timeMs) return keyframes[0].value

    // After last keyframe
    if (localTimeMs >= keyframes[keyframes.length - 1].timeMs) {
      return keyframes[keyframes.length - 1].value
    }

    // Find surrounding keyframes
    for (let i = 0; i < keyframes.length - 1; i++) {
      const k1 = keyframes[i]
      const k2 = keyframes[i + 1]

      if (localTimeMs >= k1.timeMs && localTimeMs < k2.timeMs) {
        const range = k2.timeMs - k1.timeMs
        const t = range > 0 ? (localTimeMs - k1.timeMs) / range : 0

        // Hephaestus uses interpolation field
        switch (k1.interpolation) {
          case 'hold':
          case 'step':
            return k1.value
          case 'linear':
            return k1.value + (k2.value - k1.value) * t
          case 'bezier': {
            // Approximated ease-in-out for bezier
            const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
            return k1.value + (k2.value - k1.value) * ease
          }
          default:
            return k1.value + (k2.value - k1.value) * t
        }
      }
    }

    return keyframes[keyframes.length - 1].value
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
    if (!silentModeRef.current && audio) {
      audio.play().catch(err => {
        console.warn('[ScenePlayer] Audio play failed, switching to silent mode:', err.message)
        // Audio falló en play — switch a silent mode
        silentModeRef.current = true
        audioRef.current = null
      })
    }

    // Start silent clock (always set — it's the fallback)
    clockStartRef.current = performance.now()
    // clockOffsetRef ya tiene el offset acumulado si estamos resumiendo de pause

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
      activeVibe: null,
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

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌙 useSeleneTruth - WAVE 248: TITAN 2.0 TRUTH CONNECTOR
 * "El Cable de la Verdad"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Este hook conecta el Frontend al canal IPC 'selene:truth'.
 * Se invoca UNA SOLA VEZ en la raíz de la aplicación.
 * 
 * Después de esto, CUALQUIER componente puede leer del truthStore
 * usando los selectores optimizados:
 * 
 * ```tsx
 * const audio = useTruthStore(selectAudio)
 * const palette = useTruthStore(selectPalette)
 * const genre = useTruthStore(selectGenre)
 * ```
 * 
 * WAVE 248: Migrado de SeleneBroadcast a SeleneTruth (TITAN 2.0)
 * 
 * @module hooks/useSeleneTruth
 * @version 248.0.0
 */

import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useTruthStore } from '../stores/truthStore'
import { injectTransientTruth } from '../stores/transientStore'
import type { SeleneTruth } from '../core/protocol/SeleneProtocol'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface UseSeleneTruthOptions {
  /** Log cada N frames (default: 0 = disabled) */
  debugInterval?: number
  /** Callback opcional cuando se recibe data */
  onData?: (data: SeleneTruth) => void
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🌙 Hook que conecta el Frontend al Universal Truth Protocol (TITAN 2.0)
 * 
 * IMPORTANTE: Llamar SOLO UNA VEZ en App.tsx o Layout principal.
 * 
 * @example
 * ```tsx
 * // En App.tsx
 * function App() {
 *   useSeleneTruth() // ¡Solo esto! La sangre empieza a fluir.
 *   return <RouterProvider router={router} />
 * }
 * ```
 */
export function useSeleneTruth(options: UseSeleneTruthOptions = {}) {
  const { debugInterval = 0, onData } = options
  
  const setTruth = useTruthStore((state) => state.setTruth)
  const setConnected = useTruthStore((state) => state.setConnected)
  
  // Ref para tracking de frames (evita re-renders)
  const frameCountRef = useRef(0)
  const lastLogRef = useRef(Date.now())
  
  useEffect(() => {
    // Verificar que window.lux existe (preload cargado)
    if (!window.lux?.onTruthUpdate) {
      console.error('[useSeleneTruth] ❌ window.lux.onTruthUpdate not found!')
      setConnected(false)
      return
    }
    
    // Suscribirse al canal de la verdad (TITAN 2.0)
    const removeListener = window.lux.onTruthUpdate((data: SeleneTruth) => {
      // WAVE 380: Debug fixture IDs arriving from backend
      frameCountRef.current++
      if (frameCountRef.current % 300 === 0) { // Every ~5s
        const fixtureCount = data?.hardware?.fixtures?.length || 0
        const firstIds = data?.hardware?.fixtures?.slice(0, 3).map((f: any) => f?.id).join(', ') || 'none'
        console.log(`[useSeleneTruth] 🩸 Received ${fixtureCount} fixtures:`, firstIds, '...')
      }
      
      // 🔥 WAVE 348: DUAL UPDATE
      // 1. Zustand store (para layout changes, vibe changes - cosas LENTAS)
      setTruth(data)
      
      // 2. Transient store (para physics - 60fps directo a Three.js)
      injectTransientTruth(data)
      
      // Callback opcional
      if (onData) {
        onData(data)
      }
      
      // Debug logging (throttled)
      frameCountRef.current++
      if (debugInterval > 0 && frameCountRef.current % debugInterval === 0) {
        const now = Date.now()
        const elapsed = now - lastLogRef.current
        const fps = Math.round((debugInterval / elapsed) * 1000)
        lastLogRef.current = now
        
        console.log(`[useSeleneTruth] 🌙 Frame ${data.system.frameNumber}`, {
          fps,
          mode: data.system.mode,
          energy: data.sensory.audio.energy.toFixed(3),
          genre: data.context.genre?.macro ?? 'UNKNOWN',
          mood: data.consciousness.mood,
        })
      }
    })
    
    setConnected(true)
    // 🧹 WAVE 63.7: Log silenciado - conexión automática
    
    // Cleanup al desmontar
    return () => {
      // 🧹 WAVE 63.7: Log silenciado
      if (removeListener) {
        removeListener()
      }
      setConnected(false)
    }
  }, [setTruth, setConnected, debugInterval, onData])
}

// ═══════════════════════════════════════════════════════════════════════════
// CONVENIENCE HOOKS (Para uso directo en componentes) - WAVE 248 REMAPPED
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Hook para obtener datos de audio
 * @returns { energy, bass, mid, high, peak, average }
 */
export function useTruthAudio() {
  return useTruthStore(useShallow((state) => state.truth.sensory.audio))
}

/**
 * Hook para obtener estado del beat
 * @returns { bpm, onBeat, confidence, beatPhase, barPhase }
 */
export function useTruthBeat() {
  return useTruthStore(useShallow((state) => state.truth.sensory.beat))
}

/**
 * Hook para obtener paleta de colores (from intent layer)
 * @returns palette object
 */
export function useTruthPalette() {
  return useTruthStore(useShallow((state) => state.truth.intent.palette))
}

/**
 * 🔥 WAVE 74: Hook THROTTLEADO para paleta - Solo actualiza 1 vez por segundo
 * Evita re-renders innecesarios del Chromatic Core
 * @returns palette object
 */
export function useTruthPaletteThrottled() {
  const palette = useTruthStore(useShallow((state) => state.truth.intent.palette))
  const [throttledPalette, setThrottledPalette] = useState(palette)
  const lastUpdateRef = useRef(0)
  
  useEffect(() => {
    const now = Date.now()
    // Solo actualizar si ha pasado más de 1 segundo
    if (now - lastUpdateRef.current >= 1000) {
      lastUpdateRef.current = now
      setThrottledPalette(palette)
    }
  }, [palette])
  
  return throttledPalette
}

/**
 * Hook para obtener género musical (from context layer)
 * @returns { macro, subGenre, confidence }
 */
export function useTruthGenre() {
  return useTruthStore(useShallow((state) => state.truth.context.genre))
}

/**
 * Hook para obtener sección musical actual (from context layer)
 * @returns { type, confidence, duration, isTransition }
 */
export function useTruthSection() {
  return useTruthStore(useShallow((state) => state.truth.context.section))
}

/**
 * Hook para obtener datos de ritmo (from context layer)
 * @returns { bpm, syncopation, beatPhase }
 */
export function useTruthRhythm() {
  return useTruthStore(useShallow((state) => ({
    bpm: state.truth.context.bpm,
    syncopation: state.truth.context.syncopation,
    beatPhase: state.truth.context.beatPhase,
    confidence: state.truth.context.confidence
  })))
}

/**
 * Hook para obtener datos cognitivos (mood, dreams, zodiac)
 * @returns { mood, consciousnessLevel, evolution, dream, zodiac, beauty }
 */
export function useTruthCognitive() {
  return useTruthStore(useShallow((state) => state.truth.consciousness))
}

/**
 * Hook para obtener estado del sistema
 * @returns { mode, brainStatus, fps, uptime, performance }
 */
export function useTruthSystem() {
  return useTruthStore(useShallow((state) => state.truth.system))
}

/**
 * Hook para obtener movimiento (from intent layer)
 * @returns { pattern, speed, amplitude, centerX, centerY, beatSync }
 */
export function useTruthMovement() {
  return useTruthStore(useShallow((state) => state.truth.intent.movement))
}

/**
 * 🌙 WAVE 25.5: Hook para obtener efectos especiales (from intent layer)
 * @returns effects array
 */
export function useTruthEffects() {
  return useTruthStore(useShallow((state) => state.truth.intent.effects))
}

/**
 * 🌙 WAVE 25.5: Hook para obtener parámetros de color globales
 * @returns { intensity, saturation }
 */
export function useTruthColorParams() {
  return useTruthStore(useShallow((state) => ({
    intensity: state.truth.intent.masterIntensity,
    saturation: 1, // WAVE 248: saturation is now part of palette
  })))
}

/**
 * Hook para verificar conexión
 * @returns boolean
 */
export function useTruthConnected() {
  return useTruthStore((state) => state.isConnected)
}

/**
 * Hook para obtener FPS actual
 * @returns number
 */
export function useTruthFPS() {
  return useTruthStore((state) => state.truth.system.actualFPS)
}

// ═══════════════════════════════════════════════════════════════════════════
// 🧠 WAVE 248: TITAN 2.0 HOOKS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Hook para obtener datos sensoriales (Audio, BPM, Energy)
 * @returns { audio, beat, input, fft }
 */
export function useTruthSensory() {
  return useTruthStore(useShallow((state) => state.truth.sensory))
}

/**
 * Hook para obtener contexto musical (from context layer)
 * @returns MusicalContext
 */
export function useTruthContext() {
  return useTruthStore(useShallow((state) => state.truth.context))
}

/**
 * Hook para obtener consciencia de Selene
 * @returns CognitiveData
 */
export function useTruthConsciousness() {
  return useTruthStore(useShallow((state) => state.truth.consciousness))
}

/**
 * Hook para obtener estado del hardware (DMX, Fixtures)
 * @returns HardwareState
 */
export function useTruthHardware() {
  return useTruthStore(useShallow((state) => state.truth.hardware))
}

/**
 * Hook para obtener intent de iluminación
 * @returns LightingIntent
 */
export function useTruthIntent() {
  return useTruthStore(useShallow((state) => state.truth.intent))
}

/**
 * Hook para obtener Musical DNA (genre predictions, hunt status, etc.)
 * Combines context and consciousness for a complete "musical fingerprint"
 * @returns { genre, section, bpm, key, rhythm, mode, prediction }
 */
export function useTruthMusicalDNA() {
  return useTruthStore(useShallow((state) => ({
    // Musical context
    genre: state.truth.context.genre,
    section: state.truth.context.section,
    bpm: state.truth.context.bpm,
    energy: state.truth.context.energy,
    mood: state.truth.context.mood,
    // Additional context fields
    key: state.truth.context.key,
    mode: state.truth.context.mode,
    rhythm: {
      bpm: state.truth.context.bpm,
      beatPhase: state.truth.context.beatPhase,
      syncopation: state.truth.context.syncopation
    },
    // Prediction data from consciousness/beauty analysis
    prediction: {
      huntStatus: {
        phase: state.truth.consciousness.mood,
        targetType: state.truth.context.genre?.macro ?? 'UNKNOWN',
        lockPercentage: state.truth.context.confidence * 100
      },
      confidence: state.truth.context.confidence
    }
  })))
}

/**
 * 🧠 WAVE 550: Hook para obtener telemetría de IA (para HuntMonitor HUD)
 * @returns AI telemetry data from SeleneTitanConscious
 */
export function useTruthAI() {
  return useTruthStore(useShallow((state) => state.truth.consciousness.ai))
}

// Default export para conveniencia
export default useSeleneTruth

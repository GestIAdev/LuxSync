/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌙 useSeleneTruth - WAVE 25: UNIVERSAL TRUTH CONNECTOR
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
 * @module hooks/useSeleneTruth
 * @version 25.0.0
 */

import { useEffect, useRef, useState } from 'react'
import { useTruthStore } from '../stores/truthStore'
import type { SeleneBroadcast } from '../types/SeleneProtocol'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface UseSeleneTruthOptions {
  /** Log cada N frames (default: 0 = disabled) */
  debugInterval?: number
  /** Callback opcional cuando se recibe data */
  onData?: (data: SeleneBroadcast) => void
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🌙 Hook que conecta el Frontend al Universal Truth Protocol
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
    
    // Suscribirse al canal de la verdad
    const removeListener = window.lux.onTruthUpdate((data: SeleneBroadcast) => {
      // Actualizar el store
      setTruth(data)
      
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
          genre: data.musicalDNA.genre.primary,
          palette: data.visualDecision.palette.source,
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
// CONVENIENCE HOOKS (Para uso directo en componentes)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Hook para obtener datos de audio
 * @returns { energy, bass, mid, high, peak, average }
 */
export function useTruthAudio() {
  return useTruthStore((state) => state.truth.sensory.audio)
}

/**
 * Hook para obtener estado del beat
 * @returns { bpm, onBeat, confidence, beatPhase, barPhase }
 */
export function useTruthBeat() {
  return useTruthStore((state) => state.truth.sensory.beat)
}

/**
 * Hook para obtener paleta de colores (UnifiedColor con HSL+RGB+HEX)
 * @returns { primary, secondary, accent, ambient, contrast, strategy, temperature }
 */
export function useTruthPalette() {
  return useTruthStore((state) => state.truth.visualDecision.palette)
}

/**
 * 🔥 WAVE 74: Hook THROTTLEADO para paleta - Solo actualiza 1 vez por segundo
 * Evita re-renders innecesarios del Chromatic Core
 * @returns { primary, secondary, accent, ambient, contrast, strategy, temperature }
 */
export function useTruthPaletteThrottled() {
  const palette = useTruthStore((state) => state.truth.visualDecision.palette)
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
 * Hook para obtener género musical
 * @returns { primary, subGenre, confidence, distribution }
 */
export function useTruthGenre() {
  return useTruthStore((state) => state.truth.musicalDNA.genre)
}

/**
 * Hook para obtener sección musical actual
 * @returns { current, energy, barsInSection, confidence }
 */
export function useTruthSection() {
  return useTruthStore((state) => state.truth.musicalDNA.section)
}

/**
 * Hook para obtener datos de ritmo
 * @returns { bpm, syncopation, swing, complexity, pattern }
 */
export function useTruthRhythm() {
  return useTruthStore((state) => state.truth.musicalDNA.rhythm)
}

/**
 * Hook para obtener predicciones
 * @returns { nextSection, dropPrediction, huntStatus }
 */
export function useTruthPrediction() {
  return useTruthStore((state) => state.truth.musicalDNA.prediction)
}

/**
 * Hook para obtener datos cognitivos (mood, dreams, zodiac)
 * @returns { mood, consciousnessLevel, evolution, dream, zodiac, beauty }
 */
export function useTruthCognitive() {
  return useTruthStore((state) => state.truth.cognitive)
}

/**
 * Hook para obtener estado del sistema
 * @returns { mode, brainStatus, fps, uptime, performance }
 */
export function useTruthSystem() {
  return useTruthStore((state) => state.truth.system)
}

/**
 * Hook para obtener movimiento
 * @returns { pan, tilt, speed, patternName, physicsActive }
 */
export function useTruthMovement() {
  return useTruthStore((state) => state.truth.visualDecision.movement)
}

/**
 * 🌙 WAVE 25.5: Hook para obtener efectos especiales
 * @returns { strobe, fog, laser, beam, prism, blackout }
 */
export function useTruthEffects() {
  return useTruthStore((state) => state.truth.visualDecision.effects)
}

/**
 * 🌙 WAVE 25.5: Hook para obtener parámetros de color globales
 * @returns { intensity, saturation }
 */
export function useTruthColorParams() {
  return useTruthStore((state) => ({
    intensity: state.truth.visualDecision.intensity,
    saturation: state.truth.visualDecision.saturation,
  }))
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
// 🧠 WAVE 25.6: COGNITIVE HOOKS (The Awakened Mind)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Hook para obtener datos sensoriales (Audio, BPM, Energy)
 * @returns { audio, beat }
 */
export function useTruthSensory() {
  return useTruthStore((state) => state.truth.sensory)
}

/**
 * Hook para obtener DNA musical (Género, Key, Sección)
 * @returns { genre, section, rhythm, key, prediction }
 */
export function useTruthMusicalDNA() {
  return useTruthStore((state) => state.truth.musicalDNA)
}

/**
 * Hook para obtener estado del hardware (DMX, Fixtures)
 * @returns { dmx, fixtures }
 */
export function useTruthHardware() {
  return useTruthStore((state) => state.truth.hardwareState)
}

// Default export para conveniencia
export default useSeleneTruth

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 2487: TEST HARNESS — The Safety Net (Mock Generators Deterministas)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Generadores DETERMINISTAS de señales de audio para tests.
 * Zero Math.random(). Zero heurísticas. Mismos inputs → mismos outputs.
 *
 * @module hal/physics/__tests__/test-harness
 * @version WAVE 2487 — THE SAFETY NET
 */

import type { GodEarBands } from '../../../workers/GodEarFFT'
import type { LiquidStereoInput } from '../LiquidStereoPhysics'

// ═══════════════════════════════════════════════════════════════════════════
// BAND GENERATORS — Perfiles espectrales deterministas
// ═══════════════════════════════════════════════════════════════════════════

/** Silencio absoluto — 0 en todas las bandas */
export function silentBands(): GodEarBands {
  return { subBass: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, treble: 0, ultraAir: 0 }
}

/** Kick limpio de electrónica — bass+subBass dominan, el resto es residual */
export function kickBands(strength = 0.85): GodEarBands {
  return {
    subBass: strength * 0.70,
    bass: strength,
    lowMid: strength * 0.25,
    mid: strength * 0.10,
    highMid: strength * 0.05,
    treble: strength * 0.03,
    ultraAir: 0.01,
  }
}

/** Hi-hat abierto — treble dominante con aire */
export function hihatBands(strength = 0.60): GodEarBands {
  return {
    subBass: 0.01,
    bass: 0.02,
    lowMid: 0.03,
    mid: 0.15,
    highMid: strength * 0.5,
    treble: strength,
    ultraAir: strength * 0.30,
  }
}

/** Snare electrónica — mid dominante con body en lowMid */
export function snareBands(strength = 0.75): GodEarBands {
  return {
    subBass: 0.05,
    bass: 0.10,
    lowMid: strength * 0.40,
    mid: strength,
    highMid: strength * 0.35,
    treble: strength * 0.15,
    ultraAir: 0.02,
  }
}

/** Melodía atmosférica — mid + highMid (synths melódicos) */
export function melodicBands(): GodEarBands {
  return {
    subBass: 0.05,
    bass: 0.15,
    lowMid: 0.30,
    mid: 0.65,
    highMid: 0.45,
    treble: 0.20,
    ultraAir: 0.05,
  }
}

/**
 * Guitarra eléctrica distorsionada — broadband, mid pesado, harshness alto.
 * El peor caso para un motor de fluidos: señal densa sin valles claros.
 */
export function guitarBands(strength = 0.70): GodEarBands {
  return {
    subBass: strength * 0.10,
    bass: strength * 0.30,
    lowMid: strength * 0.65,
    mid: strength * 0.85,
    highMid: strength * 0.55,
    treble: strength * 0.35,
    ultraAir: strength * 0.08,
  }
}

/**
 * Batería acústica con sangrado — todos los canales contaminados.
 * Simula lo que el GodEarFFT ve con un kit real (hi-hat sangra al mid, bombo al lowMid).
 */
export function acousticDrumBands(strength = 0.80): GodEarBands {
  return {
    subBass: strength * 0.45,
    bass: strength * 0.60,
    lowMid: strength * 0.50,
    mid: strength * 0.40,
    highMid: strength * 0.55,
    treble: strength * 0.35,
    ultraAir: strength * 0.12,
  }
}

/** Pad de chill — mid+lowMid continuo, sin transitorios */
export function chillPadBands(strength = 0.50): GodEarBands {
  return {
    subBass: strength * 0.35,
    bass: strength * 0.20,
    lowMid: strength * 0.60,
    mid: strength * 0.80,
    highMid: strength * 0.25,
    treble: strength * 0.12,
    ultraAir: strength * 0.03,
  }
}

/**
 * Reggaetón — TÚN-tacka-TÚN-tacka: bass+snare alternante con mid vocal.
 * Solo el TÚN (kick frame): bass alto, mid moderado.
 */
export function latinKickBands(strength = 0.75): GodEarBands {
  return {
    subBass: strength * 0.55,
    bass: strength * 0.80,
    lowMid: strength * 0.30,
    mid: strength * 0.45,
    highMid: strength * 0.15,
    treble: strength * 0.10,
    ultraAir: 0.02,
  }
}

/** Reggaetón — El TAcka (el frame de snare/hi-hat del dembow) */
export function latinSnareBands(strength = 0.65): GodEarBands {
  return {
    subBass: 0.08,
    bass: 0.12,
    lowMid: strength * 0.20,
    mid: strength * 0.50,
    highMid: strength * 0.60,
    treble: strength * 0.55,
    ultraAir: strength * 0.15,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PATTERN GENERATORS — Secuencias temporales deterministas
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Genera un patrón 4/4 a N BPM con kicks limpios intercalados con silencio.
 * Devuelve un array de GodEarBands listo para procesar frame a frame.
 *
 * @param bpm        Tempo del patrón
 * @param durationMs Duración total en ms
 * @param fps        Frames por segundo del motor (default 20)
 * @param strength   Intensidad del kick (0-1)
 */
export function generate4x4Pattern(
  bpm: number,
  durationMs: number,
  fps = 20,
  strength = 0.85,
): GodEarBands[] {
  const frameMs = 1000 / fps
  const beatMs = 60000 / bpm
  const totalFrames = Math.floor(durationMs / frameMs)
  const frames: GodEarBands[] = []

  for (let i = 0; i < totalFrames; i++) {
    const timeMs = i * frameMs
    const beatPos = timeMs % beatMs
    // Un kick dura ~2 frames (100ms @ 20fps) al principio de cada beat
    const isKickFrame = beatPos < frameMs * 2
    frames.push(isKickFrame ? kickBands(strength) : silentBands())
  }

  return frames
}

/**
 * Genera un patrón dembow (3-3-2) a N BPM.
 * TÚN-tacka-TÚN-tacka con swing latino.
 */
export function generateDembowPattern(
  bpm: number,
  durationMs: number,
  fps = 20,
): GodEarBands[] {
  const frameMs = 1000 / fps
  const beatMs = 60000 / bpm
  const totalFrames = Math.floor(durationMs / frameMs)
  const frames: GodEarBands[] = []

  // Dembow: en un compás de 4/4 dividido en 8 subdivisiones
  // 3-3-2: hit en 1, 4, 7 (basados en 0: posiciones 0, 3, 6)
  const subdMs = beatMs / 2  // 8va nota

  for (let i = 0; i < totalFrames; i++) {
    const timeMs = i * frameMs
    const measurePos = timeMs % (beatMs * 2) // compás completo = 2 beats
    const subdivPos = Math.floor(measurePos / subdMs) % 8
    const isKick = subdivPos === 0 || subdivPos === 3
    const isSnare = subdivPos === 6

    if (isKick) {
      frames.push(latinKickBands(0.75))
    } else if (isSnare) {
      frames.push(latinSnareBands(0.65))
    } else {
      // Piso melódico continuo (voz + bajo latino)
      frames.push({
        subBass: 0.10, bass: 0.15, lowMid: 0.25,
        mid: 0.45, highMid: 0.08, treble: 0.06, ultraAir: 0.02,
      })
    }
  }
  return frames
}

/**
 * Genera señal broadband ruidosa de guitarra distorsionada.
 * Simula una señal densa sin valles para probar el amortiguador del Omniliquid.
 */
export function generateBroadbandNoise(
  durationMs: number,
  fps = 20,
  baseStrength = 0.65,
): GodEarBands[] {
  const frameMs = 1000 / fps
  const totalFrames = Math.floor(durationMs / frameMs)
  const frames: GodEarBands[] = []

  for (let i = 0; i < totalFrames; i++) {
    // Variación determinista usando seno — sin Math.random()
    const t = i * frameMs
    const variation = 0.15 * Math.sin(t / 200) + 0.10 * Math.sin(t / 370)
    const s = Math.max(0.3, Math.min(0.95, baseStrength + variation))
    frames.push(guitarBands(s))
  }

  return frames
}

// ═══════════════════════════════════════════════════════════════════════════
// INPUT FACTORY
// ═══════════════════════════════════════════════════════════════════════════

/** Crea un LiquidStereoInput completo con defaults sensatos */
export function makeInput(
  bands: GodEarBands,
  overrides?: Partial<Omit<LiquidStereoInput, 'bands'>>,
): LiquidStereoInput {
  return {
    bands,
    sectionType: 'drop',
    isRealSilence: false,
    isAGCTrap: false,
    harshness: 0.45,
    flatness: 0.35,
    ...overrides,
  }
}

/**
 * Procesa N frames en un motor y devuelve todos los resultados.
 * Avanza fake timers automáticamente.
 */
export function processFrames(
  engine: { applyBands: (input: LiquidStereoInput) => any },
  frames: GodEarBands[],
  advanceTimers: (ms: number) => void,
  fps = 20,
  inputOverrides?: Partial<Omit<LiquidStereoInput, 'bands'>>,
): any[] {
  const frameMs = 1000 / fps
  const results: any[] = []
  for (const bands of frames) {
    advanceTimers(frameMs)
    results.push(engine.applyBands(makeInput(bands, inputOverrides)))
  }
  return results
}

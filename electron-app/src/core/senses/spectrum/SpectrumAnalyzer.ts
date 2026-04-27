/**
 * 🩻 WAVE 3504-EXT.3 — SpectrumAnalyzer
 *
 * Analizador espectral quirúrgico basado en GOD EAR FFT.
 * Extraído de senses.ts — sin cambios funcionales.
 *
 * Agnóstico al entorno Worker: recibe buffers Float32Array y devuelve
 * resultados tipados. No conoce parentPort, IPC ni SharedRingBuffer.
 *
 * WAVE 1017: GOD EAR — Blackman-Harris windowing, Linkwitz-Riley 4th order,
 *            7 bandas tácticas con ZERO overlap, per-band AGC Trust Zones.
 *
 * Dependencias:
 *   - GodEarFFT (solo los tipos y clases que ya existen en el worker)
 *   - PsychoacousticScaler (puro, in-package)
 */

import { GodEarAnalyzer, toLegacyFormat, type GodEarSpectrum } from '../../../workers/GodEarFFT';
import { toWebAudioScaledLevel } from './PsychoacousticScaler';

// ============================================
// OUTPUT TYPES
// ============================================

/**
 * Resultado completo del análisis espectral de un frame de 4096 samples.
 * Equivalente exacto al objeto devuelto por SpectrumAnalyzer.analyze()
 * en la versión monolítica de senses.ts.
 */
export interface SpectrumResult {
  // Bandas principales (normalizadas 0-1 — LEGACY FORMAT, WebAudio compatible)
  bass: number;
  mid: number;
  treble: number;

  // WAVE 1011.2: spectralCentroid en Hz (sin normalizar — RockStereoPhysics2 lo necesita)
  spectralCentroid: number;
  spectralFlux: number;

  // Bandas extendidas (LEGACY FORMAT con GOD EAR data)
  subBass: number;
  lowMid: number;
  highMid: number;
  dominantFrequency: number;

  // Detección de transientes — GOD EAR slope-based
  kickDetected: boolean;
  snareDetected: boolean;
  hihatDetected: boolean;

  // WAVE 50.1: Texture-based detection
  harshness: number;
  spectralFlatness: number;

  // WAVE 1018: Clarity para PROG ROCK detection
  clarity: number;

  // WAVE 1162: THE BYPASS — Pre-AGC bass (critico para kick detection)
  rawBassEnergy: number;

  // WAVE 2118: THE FREQUENCY SCALPEL — Bandas raw individuales por sub-banda
  rawSubBassEnergy: number;
  rawBassOnlyEnergy: number;

  // WAVE 2153: BROADBAND ANCHOR — Medios raw para detección de ataque del kick
  rawLowMidEnergy: number;
  rawMidEnergy: number;

  // WAVE 2301: 12-bin chromagram del GodEar (pitch classes C→B, normalized 0-1)
  chroma: number[];

  // WAVE 2347: crestFactor — relación pico/RMS espectral (kick vs rolling bass)
  crestFactor: number;
}

// ============================================
// SpectrumAnalyzer
// ============================================

/**
 * 🩻 WAVE 1017: THE TRANSPLANT
 *
 * Analizador espectral quirúrgico con GOD EAR FFT.
 *
 * REEMPLAZA: El viejo Cooley-Tukey del WAVE 15
 * AHORA USA: Blackman-Harris 4-term windowing (-92dB sidelobes)
 *            Linkwitz-Riley 4th order filters (24dB/octave)
 *            7 bandas tácticas con ZERO overlap
 *            Per-band AGC Trust Zones
 *
 * PERFORMANCE TARGET: <2ms (GODLIKE: <1ms)
 */
export class SpectrumAnalyzer {
  private readonly godEar: GodEarAnalyzer;
  private prevEnergy: number = 0;
  private frameCount: number = 0;
  private lastGodEarResult: GodEarSpectrum | null = null;

  constructor(sampleRate: number = 44100) {
    // GOD EAR con 4096 muestras para resolución máxima
    this.godEar = new GodEarAnalyzer(sampleRate, 4096);
  }

  /**
   * Analiza un buffer de 4096 samples y devuelve el resultado espectral completo.
   *
   * Contrato: el buffer debe estar linealizado (no circular) antes de llamar aquí.
   * El caller (AudioRingBuffer/SensesPipeline) es responsable de la linearización.
   *
   * @param buffer      Float32Array de 4096 samples (pre-AGC, audio crudo)
   * @param sampleRate  Sample rate del audio (típico 44100)
   * @returns           SpectrumResult con todas las bandas y métricas
   */
  analyze(buffer: Float32Array, sampleRate: number): SpectrumResult {
    // WAVE 2162: FFT sobre audio CRUDO (sin AGC) — el AGC aplasta transientes
    const godEarResult = this.godEar.analyze(buffer);
    this.lastGodEarResult = godEarResult;
    this.frameCount++;

    // SHADOW MODE TELEMETRY — cada ~2 segundos (40 frames @ ~20fps)
    if (this.frameCount % 40 === 0) {
      console.log(`[GOD EAR 🩻] SHADOW MODE TELEMETRY:`);
      console.log(`   Clarity:     ${godEarResult.spectral.clarity.toFixed(3)} (Rock target: >0.7)`);
      console.log(`   Flatness:    ${godEarResult.spectral.flatness.toFixed(3)} (Tonal<0.3, Noise>0.7)`);
      console.log(`   Centroid:    ${godEarResult.spectral.centroid.toFixed(0)}Hz (Bright>2000, Dark<1200)`);
      console.log(`   CrestFactor: ${godEarResult.spectral.crestFactor.toFixed(2)} (Dynamics)`);
      console.log(`   Rolloff:     ${godEarResult.spectral.rolloff.toFixed(0)}Hz (85% energy)`);
      console.log(`   Latency:     ${godEarResult.meta.processingLatencyMs.toFixed(2)}ms`);
      console.log(`   UltraAir:    ${godEarResult.bands.ultraAir.toFixed(3)} (16-22kHz sizzle)`);
    }

    // Legacy Adapter — convierte al formato viejo para compatibilidad downstream
    const legacy = toLegacyFormat(godEarResult);

    // WAVE 3431: Psychoacoustic scaling (WebAudio AnalyserNode-compatible)
    const psycho = {
      subBass: toWebAudioScaledLevel(legacy.subBass),
      bass: toWebAudioScaledLevel(legacy.bass),
      lowMid: toWebAudioScaledLevel(legacy.lowMid),
      mid: toWebAudioScaledLevel(legacy.mid),
      highMid: toWebAudioScaledLevel(legacy.highMid),
      treble: toWebAudioScaledLevel(legacy.treble),
    };

    // Flujo espectral en dominio perceptual (cambio de energía total)
    const currentEnergy = psycho.bass + psycho.mid + psycho.treble;
    const spectralFlux = Math.min(1, Math.abs(currentEnergy - this.prevEnergy) * 2);
    this.prevEnergy = currentEnergy;

    return {
      // Bandas principales (normalizadas 0-1) — LEGACY FORMAT
      bass: psycho.bass,
      mid: psycho.mid,
      treble: psycho.treble,

      // WAVE 1011.2: spectralCentroid en Hz directo del GOD EAR (sin normalizar)
      spectralCentroid: godEarResult.spectral.centroid,
      spectralFlux,

      // Bandas extendidas (LEGACY FORMAT con GOD EAR data)
      subBass: psycho.subBass,
      lowMid: psycho.lowMid,
      highMid: psycho.highMid,
      dominantFrequency: godEarResult.dominantFrequency,

      // Transient detection — GOD EAR slope-based (más preciso que threshold)
      kickDetected: godEarResult.transients.kick,
      snareDetected: godEarResult.transients.snare,
      hihatDetected: godEarResult.transients.hihat,

      // Texture metrics — GOD EAR native
      harshness: psycho.highMid, // Proxy perceptual para harshness
      spectralFlatness: godEarResult.spectral.flatness,

      // WAVE 2347: crestFactor — el tubo arreglado
      crestFactor: godEarResult.spectral.crestFactor,

      // WAVE 1018: Clarity para PROG ROCK detection
      clarity: godEarResult.spectral.clarity,

      // WAVE 1162 / WAVE 3425: THE BYPASS — Pre-AGC bass para el pacemaker
      // bandsRaw viene del path post-FFT/pre-AGC (integral + legacy gain)
      rawBassEnergy: godEarResult.bandsRaw.subBass + godEarResult.bandsRaw.bass,

      // WAVE 2118: THE FREQUENCY SCALPEL — bandas raw individuales
      rawSubBassEnergy: godEarResult.bandsRaw.subBass,
      rawBassOnlyEnergy: godEarResult.bandsRaw.bass,
      rawLowMidEnergy: godEarResult.bandsRaw.lowMid,
      rawMidEnergy: godEarResult.bandsRaw.mid,

      // WAVE 2301: Native chromagram del GodEar Worker
      chroma: godEarResult.chroma,
    };
  }

  /**
   * Acceso directo al último resultado GOD EAR para métricas avanzadas.
   * Devuelve null si no se ha llamado a analyze() aún.
   */
  getLastGodEarResult(): GodEarSpectrum | null {
    return this.lastGodEarResult;
  }

  reset(): void {
    this.godEar.reset();
    this.prevEnergy = 0;
    this.frameCount = 0;
    this.lastGodEarResult = null;
  }
}

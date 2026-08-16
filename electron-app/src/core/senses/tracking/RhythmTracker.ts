/**
 * 🥁 WAVE 3504-EXT.3 — RhythmTracker
 *
 * Servicio de seguimiento rítmico y detección de BPM.
 * Coordina: TempoOracle + KickPhaseGate + GatedNeedlePipeline
 *           + AdaptiveFloorTracker + Kalman + pocket bounds por vibe
 *           + Dembow Ceiling.
 *
 * Extraído de senses.ts (WAVE 2168–2491).
 * Encapsula todo el estado de BPM detection que vivía en el scope global
 * del Worker: bpmTracker, currentVibeId, prevEnergies, adaptiveFloor.
 *
 * Sin dependencia de parentPort, IPC ni SharedRingBuffer.
 * Recibe un SpectrumResult por frame y devuelve RhythmTrackResult.
 *
 * ───── Historia ─────────────────────────────────────────────────────────────
 * WAVE 2168: IntervalBPMTracker ("The Resurrection") — interval-based detection
 * WAVE 2169: Gated Needle pipeline — 4 pasos centroid-based
 * WAVE 2175: Dance Pocket Folder — getMusicalBpm([min,max])
 * WAVE 2180: Context-aware pocket bounds — vibe-dependent
 * WAVE 2191: Dembow Ceiling — octave corrector para vibes latinos
 * WAVE 2307: Absolute Clock — acumulador monótono de samples
 * WAVE 2491: Adaptive floor auto-calibrado
 * WAVE 3414: Reset de adaptive floor en cambio de fuente de audio
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ───── TEMPO ORACLE TRANSPLANT ──────────────────────────────────────────────
 * El IntervalBPMTracker ya no participa en la ruta en tiempo real. La
 * estimación de tempo pasa de "medir el último hueco entre kicks"
 * (un DIFERENCIADOR: amplifica el ruido de cuantización de frame hasta
 * ±4 BPM) a "encontrar el periodo que mejor explica los últimos ~8 s de ODF"
 * (un INTEGRADOR: el ruido se promedia). Las dos responsabilidades clásicas
 * de un PLL quedan separadas:
 *
 *     TempoOracle    → FRECUENCIA (NSDF + escalera armónica + parábola)
 *     KickPhaseGate  → FASE       (onset + debounce adaptativo + acumulador)
 *
 * El Kalman y el Dance Pocket Folder sobreviven intactos, pero viven aquí
 * como estado escalar / función pura en vez de dentro del tracker legacy.
 * Contrato de salida (RhythmTrackResult) sin cambios.
 *
 * ───── KILL THE POCKETS & FREE THE DECIMALS ─────────────────────────────────
 * El pocket folder y el Dembow Ceiling están BYPASS en el hot path. El
 * TempoOracle usa la regla MPM (shortest-peak) para resolver octavas
 * matemáticamente, making the genre-based fold logic obsolete. El BPM
 * Kalman-smoothed es ahora el BPM musical final, sin restricciones de
 * género. Las funciones foldToPocket / applyDembowCeiling / getPocketBounds
 * permanecen exportadas para tests y Chronos offline.
 *
 * @see docs/technical_audits/AUTOCORRELATION_BLUEPRINT.md
 * ────────────────────────────────────────────────────────────────────────────
 */

import { AdaptiveFloorTracker } from '../bpm/AdaptiveFloorTracker';
import { processNeedle } from '../bpm/GatedNeedlePipeline';
import { KickPhaseGate } from '../bpm/KickPhaseGate';
import { TempoOracle } from '../bpm/TempoOracle';
import type { SpectrumResult } from '../spectrum/SpectrumAnalyzer';

// ============================================
// TIPOS
// ============================================

/**
 * Resultado del análisis rítmico de un frame.
 * Equivalente a lo que senses.ts almacenaba en state.currentBpm/bpmConfidence/etc.
 * más el bpmResult crudo del tracker.
 */
export interface RhythmTrackResult {
  /** BPM musical (Dance Pocket Folder aplicado + Dembow Ceiling si procede) */
  musicalBpm: number;
  /** Confianza 0-1 del tracker interno */
  confidence: number;
  /** Fase del beat 0-1 (posición dentro del ciclo actual) */
  beatPhase: number;
  /** Timestamp del último kick en el clock determinista (ms) */
  lastBeatTime: number;
  /** ¿Se detectó un kick en ESTE frame? */
  kickDetected: boolean;
  /** Contador acumulado de kicks desde el último reset */
  kickCount: number;
  /** BPM raw del tracker (sin Dance Pocket Folder) — solo para telemetría */
  rawBpm: number;
  // Telemetría del needle para ShadowLogger
  rawLowFlux: number;
  rawMidFlux: number;
  rawBassFlux: number;
  needle: number;
  currentFloor: number;
}

// ============================================
// POCKET BOUNDS (WAVE 2180)
// ============================================

/**
 * Devuelve el rango [min, max] de BPM para getMusicalBpm() según el vibe activo.
 * Los vibes técnicos necesitan [120,135] para rechazar armonicos en 107 BPM.
 * Los vibes latinos necesitan [85,105] para capturar reggaetón/dembow en 100 BPM.
 * Default [90,135] para house, trance, DnB y el resto.
 *
 * Función pura — no tiene estado propio, recibe el vibeId como parámetro.
 */
export function getPocketBounds(vibeId: string): [number, number] {
  const v = vibeId.toLowerCase();
  if (v === 'techno-club' || v === 'techno' || v === 'minimal' || v === 'hard-techno') {
    return [120, 135];
  }
  if (v === 'fiesta-latina' || v === 'reggaeton' || v === 'latin') {
    return [85, 105];
  }
  // Generic default — house, trance, drum-n-bass, generic
  return [90, 135];
}

// ============================================
// DEMBOW CEILING — WAVE 2191
// ============================================

const LATIN_BPM_CEILING = 145;
const LATIN_VIBE_IDS = new Set(['fiesta-latina', 'reggaeton', 'latin']);

/**
 * Corrector de octava para vibes latinos.
 *
 * PROBLEMA: En reggaetón/cumbia/salsa el tracker puede anclarse en
 * ~190-210 BPM detectando el redoble de conga o maracas. El Dance Pocket
 * Folder tiene ÷2.0 en su arsenal, pero si el tracker tiene stableBpm
 * "estable" en la octava errónea con confianza alta, el fold nunca se aplica.
 *
 * SOLUCIÓN: Post-procesado contextual ANTES de que el PLL use el valor.
 * "Don't limit the input data; limit the musical output." — PunkArchytect
 *
 * Función pura — recibe musicalBpm y vibeId, devuelve el BPM corregido.
 */
export function applyDembowCeiling(musicalBpm: number, vibeId: string): number {
  if (!LATIN_VIBE_IDS.has(vibeId.toLowerCase())) {
    return musicalBpm;
  }
  if (musicalBpm <= LATIN_BPM_CEILING) {
    return musicalBpm;
  }
  const corrected = Math.round(musicalBpm / 2);
  console.log(
    `[DEMBOW CEILING 🩸] Octave corrected: ${musicalBpm}→${corrected} BPM | vibe=${vibeId}`
  );
  return corrected;
}

// ============================================
// DANCE POCKET FOLDER — función pura (WAVE 2174/2180/2181)
// ============================================

/**
 * Ratios de plegado hacia abajo, en orden de prioridad.
 *   ×0.75 — Dotted 4:3 (semicorchea con puntillo). 161→121 (Hard Techno)
 *   ÷1.5  — Tresillo 3:2. 185→123 (Brejcha, techno polirrítmico)
 *   ÷2.0  — Double-time → pulso de blanca. 250→125 (DnB, hardcore)
 *   ÷3.0  — Triple-time. 275→92 (DnB/Speedcore extremo)
 *   ÷4.0  — Quadruple-time. 440→110 (Gabber/Extratone)
 * Float64Array a nivel de módulo → cero asignaciones en el hot path.
 */
const FOLD_DOWN = new Float64Array([0.75, 1 / 1.5, 0.5, 1 / 3, 0.25]);

/** Ratios de plegado hacia arriba: tresillo inverso, half-time, ultra-lento. */
const FOLD_UP = new Float64Array([1.5, 2.0, 3.0, 4.0]);

/** Margen de histéresis en los bordes del pocket (WAVE 7003 F7). */
const POCKET_HYSTERESIS_MARGIN = 5;

/**
 * Dance Pocket Folder — función PURA (antes IntervalBPMTracker.getMusicalBpm).
 *
 * El estimador mide eventos rítmicos por minuto. Eso es matemáticamente
 * correcto pero musicalmente inútil cuando el artista usa patrones
 * polirrítmicos: "Gravity" de Brejcha dispara eventos de bajo a 185/min
 * (tresillo 3:2), pero cualquier DJ te dirá que es un track de 123 BPM.
 *
 * Este plegado NUNCA deja pasar un BPM crudo fuera del pocket: un 275 BPM
 * llegando al motor de física haría oscilar los movers a 4.6 Hz — suicidio
 * mecánico para hardware de presupuesto. Si ningún ratio aterriza dentro,
 * se clampea al borde del pocket como última línea de defensa (WAVE 2181).
 *
 * @param raw              BPM crudo (post-Kalman, pre-pocket)
 * @param targetMin        Borde inferior del pocket
 * @param targetMax        Borde superior del pocket
 * @param lastMusicalBpm   Última salida musical, para la histéresis de borde
 * @returns                BPM plegado dentro del pocket, o 0 si no hay señal
 */
export function foldToPocket(
  raw: number,
  targetMin: number,
  targetMax: number,
  lastMusicalBpm: number
): number {
  if (raw <= 0) return 0;

  // Histéresis de borde: sin ella, un raw oscilando en 135±1 alterna entre
  // paso directo (135) y fold-down (102) → saltos de 33 BPM que atraviesan
  // el motor de física como un flash.
  const expandedMin = targetMin - POCKET_HYSTERESIS_MARGIN;
  const expandedMax = targetMax + POCKET_HYSTERESIS_MARGIN;

  if (raw >= expandedMin && raw <= expandedMax) {
    if (lastMusicalBpm > 0 && lastMusicalBpm !== raw) {
      const lastWasInPocket = lastMusicalBpm >= targetMin && lastMusicalBpm <= targetMax;
      if (lastWasInPocket && raw >= targetMin && raw <= targetMax) return raw;
      // El último valor fue un plegado y seguimos en la zona de histéresis:
      // mantener el plegado en vez de saltar al crudo.
      if (!lastWasInPocket && (raw < targetMin || raw > targetMax)) return lastMusicalBpm;
    }
    return raw;
  }

  if (raw > targetMax) {
    for (let i = 0; i < FOLD_DOWN.length; i++) {
      const folded = Math.round(raw * FOLD_DOWN[i]);
      if (folded >= targetMin && folded <= targetMax) return folded;
    }
  } else {
    for (let i = 0; i < FOLD_UP.length; i++) {
      const folded = Math.round(raw * FOLD_UP[i]);
      if (folded >= targetMin && folded <= targetMax) return folded;
    }
  }

  // Safety clamp — nunca devolver el crudo al motor de física.
  const pocketCenter = (targetMin + targetMax) / 2;
  return raw > pocketCenter ? targetMax : targetMin;
}

// ============================================
// KALMAN 1D — constantes (WAVE 7002.4 REC-13)
// ============================================

/** Ruido de proceso: cuánto esperamos que el tempo real derive por medida. */
const KALMAN_Q = 0.5;
/** Ruido de medida base, escalado por (1 − confianza) del Oracle. */
const KALMAN_R_BASE = 8.0;
/** Incertidumbre inicial. */
const KALMAN_P0 = 100.0;

/**
 * Escala del soft-gate de innovación, en BPM.
 *
 * Sustituye el gate binario de ±15 BPM del tracker legacy (Bottleneck 5 de la
 * auditoría), que creaba una frontera de aceptación DISCONTINUA: 143 BPM se
 * aceptaba y 144 se rechazaba, dejando el filtro pegado a un valor cuando
 * debería estar derivando. Aquí la R se infla con el cuadrado de la
 * innovación normalizada (forma robusta tipo Student-t):
 *
 *     R_eff = R × (1 + (innovación / GATE)²)
 *
 * Monótono, barato (sin exp), y sin frontera: una medida lejana no se
 * rechaza, simplemente pesa cada vez menos.
 */
const KALMAN_GATE_BPM = 12.0;

/** Por debajo de esta confianza el Oracle no actualiza el Kalman. */
const KALMAN_MIN_CONFIDENCE = 0.05;

// ============================================
// RhythmTracker — Servicio
// ============================================

/**
 * Servicio de seguimiento rítmico frame a frame.
 *
 * Estado encapsulado:
 * - IntervalBPMTracker (detecta kicks por ratio, calcula BPM por intervalos)
 * - AdaptiveFloorTracker (floor dinámico para el gated needle)
 * - Estado previo de energías (prevSub, prevBassOnly, prevMid) para flux
 * - vibeId activo (para pocket bounds y Dembow Ceiling)
 * - lastBeatTime (en el clock determinista del caller)
 */
export class RhythmTracker {
  /** FRECUENCIA — autocorrelación NSDF sobre el needle (cero asignaciones). */
  private readonly tempoOracle = new TempoOracle();
  /** FASE — onset gate + acumulador de beat phase (cero asignaciones). */
  private readonly phaseGate = new KickPhaseGate();
  private readonly adaptiveFloor = new AdaptiveFloorTracker();

  // Estado de energía previa para cálculo de flux (WAVE 2168)
  private prevSubEnergy = 0;
  private prevBassOnlyEnergy = 0;
  private prevMidEnergy = 0;

  // Vibe activo (actualizado por setVibe)
  private currentVibeId: string = '';

  // Último timestamp de kick en el clock determinista del caller
  private lastBeatTime = 0;

  // ─── Kalman 1D — estado escalar (antes dentro de IntervalBPMTracker) ────
  private kalmanBpm = 0;
  private kalmanP = KALMAN_P0;
  private kalmanInitialized = false;

  // Última salida musical, para la histéresis del pocket folder
  private lastMusicalBpm = 0;

  /**
   * Procesa un SpectrumResult y devuelve el estado rítmico actual.
   *
   * @param spectrum                  Resultado del SpectrumAnalyzer del frame actual
   * @param deterministicTimestampMs  Timestamp monótono del caller (totalSamples/sampleRate*1000)
   * @returns                         Estado rítmico completo del frame
   */
  process(spectrum: SpectrumResult, deterministicTimestampMs: number): RhythmTrackResult {
    // 1. Actualizar el floor adaptativo con el flux raw actual
    //    (lo calculamos aquí porque AdaptiveFloorTracker.update necesita rawBassFlux,
    //    que a su vez depende del flux del step anterior — se calcula en processNeedle)
    //    Hacemos un pre-cálculo del rawBassFlux solo para el floor:
    const preLowFlux = Math.max(0, spectrum.rawSubBassEnergy - this.prevSubEnergy);
    const preBassFlux = Math.max(0, spectrum.rawBassOnlyEnergy - this.prevBassOnlyEnergy);
    const preBassTotal = preLowFlux + preBassFlux;
    const currentFloor = this.adaptiveFloor.update(preBassTotal);

    // 2. Ejecutar el Gated Needle Pipeline (puro, sin estado)
    const needleOut = processNeedle({
      rawSubBassEnergy: spectrum.rawSubBassEnergy,
      rawBassOnlyEnergy: spectrum.rawBassOnlyEnergy,
      rawMidEnergy: spectrum.rawMidEnergy,
      spectralCentroid: spectrum.spectralCentroid,
      prevSubEnergy: this.prevSubEnergy,
      prevBassOnlyEnergy: this.prevBassOnlyEnergy,
      prevMidEnergy: this.prevMidEnergy,
      currentFloor,
    });

    // Actualizar energías previas para el siguiente frame
    this.prevSubEnergy = needleOut.newPrevSubEnergy;
    this.prevBassOnlyEnergy = needleOut.newPrevBassOnlyEnergy;
    this.prevMidEnergy = needleOut.newPrevMidEnergy;

    // 3. FRECUENCIA — inyectar el needle limpio en el Tempo Oracle.
    //    El Oracle es el ÚNICO estimador de tempo: correlaciona ~8 s de ODF
    //    contra copias retardadas de sí misma y devuelve un periodo continuo
    //    (interpolación parabólica sub-frame), no un múltiplo de la rejilla
    //    de lags. Aquí muere la cuantización de ±4 BPM.
    this.tempoOracle.process(needleOut.needle, deterministicTimestampMs);
    const oracleBpm = this.tempoOracle.bpm;
    const confidence = this.tempoOracle.confidence;

    // 4. Kalman 1D sobre la medida del Oracle (soft-gate, sin frontera dura)
    const smoothedBpm = this.kalmanUpdate(oracleBpm, confidence);

    // 5. FASE — onset gate alimentado con el tempo ya suavizado.
    //    Produce kickDetected / kickCount / beatPhase; NO produce BPM.
    this.phaseGate.process(
      needleOut.needle,
      currentFloor,
      smoothedBpm,
      deterministicTimestampMs
    );
    const kickDetected = this.phaseGate.kickDetected;

    // 6. KILL THE POCKETS — TempoOracle + MPM ya resuelve octavas matemáticamente.
    //    El legacy foldToPocket mutilaba 128→96 vía ×0.75 cuando el vibe estaba
    //    desactualizado (fiesta-latina escuchando techno). El Kalman-smoothed BPM
    //    es ahora el BPM musical final, sin restricciones de género.
    //    (getPocketBounds / foldToPocket / applyDembowCeiling permanecen
    //    exportados para tests y Chronos offline, pero no participan en el
    //    hot path. Ver DIRECTIVA "KILL THE POCKETS & FREE THE DECIMALS".)
    let musicalBpm = 0;
    if (confidence > 0.05) {
      musicalBpm = smoothedBpm;
      this.lastMusicalBpm = musicalBpm;
    }

    // 7. Actualizar lastBeatTime si hubo kick en este frame
    if (kickDetected) {
      this.lastBeatTime = deterministicTimestampMs;
    }

    return {
      musicalBpm,
      confidence,
      beatPhase: this.phaseGate.beatPhase,
      lastBeatTime: this.lastBeatTime,
      kickDetected,
      kickCount: this.phaseGate.kickCount,
      rawBpm: smoothedBpm,
      // Telemetría para ShadowLogger / diagnóstico
      rawLowFlux: needleOut.rawLowFlux,
      rawMidFlux: needleOut.rawMidFlux,
      rawBassFlux: needleOut.rawBassFlux,
      needle: needleOut.needle,
      currentFloor,
    };
  }

  /**
   * Kalman 1D: predice + corrige el BPM con la medida del Oracle.
   *
   * Estado escalar (bpm, P) — sin matrices, sin literales de objeto, cero
   * asignaciones. El modelo es "tempo constante + random walk": el ruido de
   * proceso Q permite derivas graduales (rampa de DJ) sin desbloquear.
   *
   * Dos diferencias frente al Kalman legacy:
   *   1. La medida ya no es un intervalo ruidoso sino un periodo integrado
   *      sobre ~8 s, así que R puede ser mucho más honesta.
   *   2. El gate de ±15 BPM binario se sustituye por inflado suave de R
   *      (ver KALMAN_GATE_BPM): las medidas lejanas pesan poco en vez de
   *      ser descartadas por completo.
   *
   * @returns El BPM suavizado (0 si aún no hay medida válida).
   */
  private kalmanUpdate(measurement: number, confidence: number): number {
    if (!(measurement > 0) || confidence < KALMAN_MIN_CONFIDENCE) {
      // Sin medida utilizable — mantener el estado. El Oracle ya reporta
      // confianza baja durante el warmup y los silencios; el freewheel del
      // PLL en el main thread se encarga del resto.
      return this.kalmanInitialized ? this.kalmanBpm : 0;
    }

    if (!this.kalmanInitialized) {
      this.kalmanBpm = measurement;
      this.kalmanP = KALMAN_P0;
      this.kalmanInitialized = true;
      return this.kalmanBpm;
    }

    // Predicción: el tempo no cambia, la incertidumbre crece.
    this.kalmanP += KALMAN_Q;

    // R adaptativa: menos confianza → más ruido de medida → menos peso.
    const innovation = measurement - this.kalmanBpm;
    const normalized = innovation / KALMAN_GATE_BPM;
    const R = KALMAN_R_BASE * (1.0 - Math.min(1.0, confidence)) * (1.0 + normalized * normalized)
      + 0.25; // suelo de R: evita K→1 y el consiguiente seguimiento del ruido

    const K = this.kalmanP / (this.kalmanP + R);
    this.kalmanBpm += K * innovation;
    this.kalmanP = (1 - K) * this.kalmanP;

    // Clamp de cordura — el pocket folder se encarga de la octava.
    if (this.kalmanBpm < 40) this.kalmanBpm = 40;
    else if (this.kalmanBpm > 300) this.kalmanBpm = 300;

    return this.kalmanBpm;
  }

  /**
   * Actualiza el vibe activo. Afecta pocket bounds y Dembow Ceiling.
   * Llamar cuando el Worker recibe MessageType.SET_VIBE.
   */
  setVibe(vibeId: string): void {
    this.currentVibeId = vibeId;
  }

  /**
   * Resetea TODOS los trackers al estado inicial.
   * Equivale a RESET_PACEMAKER + WAVE 3414 adaptive floor reset.
   *
   * Llamar cuando el Worker recibe MessageType.RESET_PACEMAKER.
   */
  reset(): void {
    this.tempoOracle.reset();
    this.phaseGate.reset();
    this.adaptiveFloor.reset();
    this.prevSubEnergy = 0;
    this.prevBassOnlyEnergy = 0;
    this.prevMidEnergy = 0;
    this.lastBeatTime = 0;
    this.kalmanBpm = 0;
    this.kalmanP = KALMAN_P0;
    this.kalmanInitialized = false;
    this.lastMusicalBpm = 0;
  }
}

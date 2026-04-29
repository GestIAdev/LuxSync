/**
 * 🥁 WAVE 3504-EXT.3 — RhythmTracker
 *
 * Servicio de seguimiento rítmico y detección de BPM.
 * Coordina: IntervalBPMTracker + GatedNeedlePipeline + AdaptiveFloorTracker
 *           + pocket bounds por vibe + Dembow Ceiling.
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
 */
import { IntervalBPMTracker } from '../../../workers/IntervalBPMTracker';
import { AdaptiveFloorTracker } from '../bpm/AdaptiveFloorTracker';
import { processNeedle } from '../bpm/GatedNeedlePipeline';
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
export function getPocketBounds(vibeId) {
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
export function applyDembowCeiling(musicalBpm, vibeId) {
    if (!LATIN_VIBE_IDS.has(vibeId.toLowerCase())) {
        return musicalBpm;
    }
    if (musicalBpm <= LATIN_BPM_CEILING) {
        return musicalBpm;
    }
    const corrected = Math.round(musicalBpm / 2);
    console.log(`[DEMBOW CEILING 🩸] Octave corrected: ${musicalBpm}→${corrected} BPM | vibe=${vibeId}`);
    return corrected;
}
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
    constructor() {
        this.bpmTracker = new IntervalBPMTracker();
        this.adaptiveFloor = new AdaptiveFloorTracker();
        // Estado de energía previa para cálculo de flux (WAVE 2168)
        this.prevSubEnergy = 0;
        this.prevBassOnlyEnergy = 0;
        this.prevMidEnergy = 0;
        // Vibe activo (actualizado por setVibe)
        this.currentVibeId = '';
        // Último timestamp de kick en el clock determinista del caller
        this.lastBeatTime = 0;
    }
    /**
     * Procesa un SpectrumResult y devuelve el estado rítmico actual.
     *
     * @param spectrum                  Resultado del SpectrumAnalyzer del frame actual
     * @param deterministicTimestampMs  Timestamp monótono del caller (totalSamples/sampleRate*1000)
     * @returns                         Estado rítmico completo del frame
     */
    process(spectrum, deterministicTimestampMs) {
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
        // 3. Inyectar el needle limpio en el IntervalBPMTracker
        const bpmResult = this.bpmTracker.process(needleOut.needle, false, deterministicTimestampMs);
        // 4. Dance Pocket Folder + Dembow Ceiling
        const [pocketMin, pocketMax] = getPocketBounds(this.currentVibeId);
        let musicalBpm = 0;
        if (bpmResult.confidence > 0.05) {
            musicalBpm = this.bpmTracker.getMusicalBpm(pocketMin, pocketMax);
            musicalBpm = applyDembowCeiling(musicalBpm, this.currentVibeId);
        }
        // 5. Actualizar lastBeatTime si hubo kick en este frame
        if (bpmResult.kickDetected) {
            this.lastBeatTime = deterministicTimestampMs;
        }
        return {
            musicalBpm,
            confidence: bpmResult.confidence,
            beatPhase: bpmResult.beatPhase,
            lastBeatTime: this.lastBeatTime,
            kickDetected: bpmResult.kickDetected,
            kickCount: bpmResult.kickCount,
            rawBpm: bpmResult.bpm,
            // Telemetría para ShadowLogger / diagnóstico
            rawLowFlux: needleOut.rawLowFlux,
            rawMidFlux: needleOut.rawMidFlux,
            rawBassFlux: needleOut.rawBassFlux,
            needle: needleOut.needle,
            currentFloor,
        };
    }
    /**
     * Actualiza el vibe activo. Afecta pocket bounds y Dembow Ceiling.
     * Llamar cuando el Worker recibe MessageType.SET_VIBE.
     */
    setVibe(vibeId) {
        this.currentVibeId = vibeId;
    }
    /**
     * Resetea TODOS los trackers al estado inicial.
     * Equivale a RESET_PACEMAKER + WAVE 3414 adaptive floor reset.
     *
     * Llamar cuando el Worker recibe MessageType.RESET_PACEMAKER.
     */
    reset() {
        this.bpmTracker.reset();
        this.adaptiveFloor.reset();
        this.prevSubEnergy = 0;
        this.prevBassOnlyEnergy = 0;
        this.prevMidEnergy = 0;
        this.lastBeatTime = 0;
    }
}

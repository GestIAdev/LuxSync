/**
 * 📦 WAVE 3504-EXT.4: ANALYSIS RESPONSE BUILDER
 *
 * Función pura que ensambla el ExtendedAudioAnalysis final a partir de
 * los resultados de todos los stages del pipeline de audio.
 *
 * Extrae el bloque "=== PHASE 4: Build Response ===" de processAudioBuffer()
 * en senses.ts, incluyendo:
 *   - calculateZeroCrossingRate() (WAVE 15 — pura, sin estado)
 *   - Asignación de campos BPM / Rhythm / Spectrum / Wave8
 *   - Phantom fields WAVE 1228 (valence/arousal/dominance → 0)
 *   - GenreOutput neutro (WAVE 61 — VibeManager es el nuevo dueño)
 *   - Mood pruning (WAVE 1228 — solo primary)
 *
 * Worker-agnostic: cero dependencias de parentPort, workerData o IPC.
 * Función pura: mismo input → mismo output, sin efectos secundarios.
 */
// ============================================
// PURE HELPERS
// ============================================
/**
 * WAVE 15: Zero Crossing Rate — métrica de texturas espectrales.
 * Pura: mismo buffer → mismo resultado.
 */
export function calculateZeroCrossingRate(buffer) {
    let crossings = 0;
    for (let i = 1; i < buffer.length; i++) {
        if ((buffer[i] >= 0) !== (buffer[i - 1] >= 0)) {
            crossings++;
        }
    }
    return crossings / buffer.length;
}
// ============================================
// BUILDER PRINCIPAL
// ============================================
/**
 * buildPayload() — ensamblador puro del mensaje IPC de salida.
 *
 * Recibe todos los resultados de análisis y los mapea al shape exacto
 * del protocolo `ExtendedAudioAnalysis` que se envía a ALPHA vía
 * `parentPort.postMessage()`.
 *
 * La responsabilidad del `postMessage()` pertenece al Worker shell
 * (senses.ts) — este builder no toca el hilo ni el puerto.
 */
export function buildPayload(input) {
    const { frameId, spectrum, agcResult, bpmResult, musicalBpm, bpmConfidence, beatPhase, snapshotBuffer, normalizedEnergy, rhythmOutput, harmonyOutput, sectionOutput, genreOutput, moodOutput, inputPeakAbs, inputRMS, } = input;
    // 🎵 WAVE 1228: Temperature field neutered — mood computed in mind.ts
    // harmonyOutput.temperature era decoration-only (nunca consumido por TitanEngine)
    const mood = 'neutral';
    return {
        // -- Timing --
        timestamp: Date.now(),
        frameId,
        // -- WAVE 670: AGC Gain Factor --
        agcGainFactor: agcResult.gainFactor,
        // -- rBPM (IntervalBPMTracker — Single Source of Truth) --
        bpm: musicalBpm,
        bpmConfidence,
        onBeat: bpmResult.kickDetected || spectrum.kickDetected,
        beatPhase,
        beatStrength: bpmResult.kickDetected ? 1 : 0,
        // 🥁 WAVE 2213: Cumulative kick counter
        kickCount: bpmResult.kickCount,
        // -- Wave 8 Rhythm (REGLA 3: Syncopation is king) --
        syncopation: rhythmOutput.syncopation,
        groove: rhythmOutput.groove,
        // 🎵 WAVE 1228: Phantom field — subdivision nunca consumido, valor estático
        subdivision: 4,
        // -- Spectrum --
        bass: spectrum.bass,
        mid: spectrum.mid,
        treble: spectrum.treble,
        // -- WAVE 1011: Extended spectrum --
        subBass: spectrum.subBass,
        lowMid: spectrum.lowMid,
        highMid: spectrum.highMid,
        // -- WAVE 1011: Spectral texture metrics --
        harshness: spectrum.harshness,
        spectralFlatness: spectrum.spectralFlatness,
        // -- WAVE 1011: Transient detection --
        kickDetected: spectrum.kickDetected,
        snareDetected: spectrum.snareDetected,
        hihatDetected: spectrum.hihatDetected,
        // -- Harmony / Mood --
        mood,
        key: harmonyOutput.key ?? undefined,
        energy: normalizedEnergy,
        // -- Technical metrics --
        spectralCentroid: spectrum.spectralCentroid,
        spectralFlux: spectrum.spectralFlux,
        zeroCrossingRate: calculateZeroCrossingRate(snapshotBuffer),
        // -- WAVE 1162: RAW BASS (pre-AGC, para Pacemaker) --
        rawBassEnergy: spectrum.rawBassEnergy,
        // -- WAVE 2301: Chromagram --
        chroma: spectrum.chroma,
        // -- WAVE 3418: Raw input telemetry --
        inputPeakAbs,
        inputRMS,
        // -- Wave 8 rich data para GAMMA --
        wave8: {
            rhythm: rhythmOutput,
            harmony: harmonyOutput,
            section: sectionOutput,
            genre: genreOutput,
            // 🌈 WAVE 1228: MoodSynthesizer pruning
            // CONSUMED: primary (EffectDNA organicity)
            // NOT CONSUMED: valence, arousal, dominance, intensity, stability (phantom fields)
            mood: {
                primary: moodOutput.primary,
                secondary: null, // 🎵 WAVE 1228: Phantom field
                valence: 0, // 🎵 WAVE 1228: Phantom field
                arousal: 0, // 🎵 WAVE 1228: Phantom field
                dominance: 0, // 🎵 WAVE 1228: Phantom field
                intensity: 0.5, // 🎵 WAVE 1228: Phantom field — neutral
                stability: 1, // 🎵 WAVE 1228: Phantom field — stable
            },
        },
    };
}

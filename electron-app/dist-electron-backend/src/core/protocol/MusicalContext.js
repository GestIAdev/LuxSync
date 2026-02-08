/**
 * 🏛️ WAVE 201: MUSICAL CONTEXT
 *
 * Define la salida del CEREBRO (TrinityBrain).
 * El Cerebro analiza audio y produce SOLO este tipo.
 *
 * REGLA: El Cerebro NO decide colores ni DMX. Solo describe QUÉ SUENA.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔬 WAVE 1026: THE ROSETTA STONE
 * ═══════════════════════════════════════════════════════════════════════════
 * Expansión del protocolo para transportar la carga útil del God Ear FFT 8K:
 * - SpectralContext: clarity, texture, bands (7 tactical bands)
 * - NarrativeContext: buildupScore, relativeEnergy, consensusVote (WAVE 1024)
 *
 * CONSUMIDORES:
 * - SeleneTitanConscious: Usa clarity para evaluación ética (no stress)
 * - HuntEngine: Usa texture para criterios de caza (glitch effects)
 * - SeleneLux: Usa ultraAir para lasers/scanners
 * - EffectDreamSimulator: Usa texture para DNA de efectos
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎵 WAVE 1228: PHANTOM FIELDS OPTIMIZATION
 * ═══════════════════════════════════════════════════════════════════════════
 * REMOVED COMPUTATION (for performance):
 * - rhythm.subdivision: Always 4, never consumed
 * - harmony.temperature: Decoration only, computed but not used
 * - mood.valence, arousal, dominance: Psychology metrics (UI decoration)
 * - mood.intensity, stability: Derived from energy (UI decoration)
 *
 * STRATEGY: Keep fields in interface (for API compatibility) but return
 * static/neutral values instead of computing them. This saves ~0.3ms per frame.
 *
 * CRITICAL FIELDS (NEVER CHANGE):
 * - key, mode, mood: Determine effect character and color palette
 * - syncopation: Determines color strategy (analogous/triadic/complementary)
 * - section.type: Determines organicity and effect family
 *
 * @see docs/WAVE-1227-WAVE8-FULL-AUTOPSY.md - Classification audit
 * @see docs/WAVE-1228-THE-REFINERY.md - Optimization details
 *
 * @layer CEREBRO → MOTOR
 * @version TITAN 2.0 → WAVE 1026 → WAVE 1228 (Phantom Optimization)
 */
// ═══════════════════════════════════════════════════════════════════════════
// FACTORY / HELPERS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Crea un EnergyContext por defecto (silencio)
 */
export function createDefaultEnergyContext() {
    return {
        absolute: 0,
        smoothed: 0,
        percentile: 0,
        zone: 'silence',
        previousZone: 'silence',
        sustainedLow: true,
        sustainedHigh: false,
        trend: 0,
        lastZoneChange: Date.now(),
        isFlashbang: false, // 🌋 WAVE 960
    };
}
/**
 * 🔬 WAVE 1026: Crea un SpectralContext por defecto (silencio/clean)
 */
export function createDefaultSpectralContext() {
    return {
        clarity: 0.5,
        texture: 'clean',
        flatness: 0,
        centroid: 440, // A4 - punto neutral
        harshness: 0,
        bands: {
            subBass: 0,
            bass: 0,
            lowMid: 0,
            mid: 0,
            highMid: 0,
            treble: 0,
            ultraAir: 0,
        },
    };
}
/**
 * 🎬 WAVE 1026: Crea un NarrativeContext por defecto (sin historia)
 */
export function createDefaultNarrativeContext() {
    return {
        buildupScore: 0,
        relativeEnergy: 0.5, // Medio del rango
        consensus: null,
        slidingWindow: {
            localMin: 0,
            localMax: 1,
            sampleCount: 0,
        },
    };
}
/**
 * 🔬 WAVE 1026: Deriva la textura espectral desde harshness, clarity y centroid
 *
 * REGLAS:
 * - clean: harshness < 0.3, clarity > 0.6 (piano, voz limpia)
 * - warm: centroid < 300Hz (graves dominantes, bass music)
 * - harsh: harshness > 0.6, clarity > 0.7 (metal controlado, distorsión intencional)
 * - noisy: harshness > 0.6, clarity < 0.4 (ruido sucio, clipping, audio malo)
 */
export function deriveSpectralTexture(harshness, clarity, centroid) {
    // Prioridad 1: ¿Es cálido? (frecuencias bajas dominantes)
    if (centroid < 300) {
        return 'warm';
    }
    // Prioridad 2: ¿Es ruidoso? (harshness alta + clarity baja = basura)
    if (harshness > 0.6 && clarity < 0.4) {
        return 'noisy';
    }
    // Prioridad 3: ¿Es áspero pero controlado? (metal, rock pesado)
    if (harshness > 0.6 && clarity > 0.7) {
        return 'harsh';
    }
    // Default: limpio
    return 'clean';
}
/**
 * Crea un MusicalContext por defecto (silencio/unknown)
 */
export function createDefaultMusicalContext() {
    return {
        key: null,
        mode: 'unknown',
        bpm: 120,
        beatPhase: 0,
        syncopation: 0,
        section: {
            type: 'unknown',
            current: 'unknown',
            confidence: 0,
            duration: 0,
            isTransition: false,
        },
        energy: 0,
        mood: 'neutral',
        energyContext: createDefaultEnergyContext(),
        genre: {
            macro: 'UNKNOWN',
            subGenre: null,
            confidence: 0,
        },
        // 🔬 WAVE 1026: Nuevos contextos
        spectral: createDefaultSpectralContext(),
        narrative: createDefaultNarrativeContext(),
        // 🔴 WAVE 1186.5: Legacy fields - valores por defecto
        zScore: 0,
        vibeId: 'unknown',
        inDrop: false,
        confidence: 0,
        timestamp: Date.now(),
    };
}

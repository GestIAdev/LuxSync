/**
 * 🎸 HARMONY DETECTOR
 * ============================================================
 * Motor de análisis armónico para Wave 8 - El Alma de la Fiesta
 *
 * Fuente: HarmonyEngine.ts + ScaleUtils.ts (Aura Forge)
 *
 * Concepto:
 * - Detectar TONALIDAD (Key): ¿Es Do Mayor o La Menor?
 * - Detectar MODO/MOOD: Major→Happy, Minor→Sad, Phrygian→Exotic
 * - Detectar DISONANCIA: Si las frecuencias chocan (tritono) → Tension
 *
 * ⚠️ REGLA 1: Este análisis es PESADO
 * - Ejecutar con Throttling (cada 200-500ms)
 * - NO en cada frame de 30ms
 * - La armonía no cambia tan rápido como el ritmo
 *
 * ═══════════════════════════════════════════════════════════════════════
 * 🎬 WAVE 1024.B - VOTE BOOST
 * ═══════════════════════════════════════════════════════════════════════
 * Nueva capacidad: Votos con peso basado en claridad del God Ear FFT.
 *
 * Problema Pre-1024: Todos los votos de detección de key tenían peso 1.0,
 * independientemente de si el frame tenía buena señal o era ruidoso.
 *
 * Solución WAVE 1024.B:
 * - El Trinity Bridge envía clarity (0-1) del God Ear
 * - Si clarity > 0.7: El voto tiene peso 2.0 (confianza alta)
 * - Si clarity < 0.4: El voto tiene peso 0.5 (señal ruidosa)
 * - Eventos key-change incluyen weight para KeyStabilizer
 * ═══════════════════════════════════════════════════════════════════════
 *
 * @author LuxSync Team
 * @version 1.1.0 - Wave 8 FASE 2 → WAVE 1024.B
 */
import { EventEmitter } from 'events';
import { NOTE_NAMES, createScaleIdentifier } from '../classification/ScaleIdentifier.js';
// ============================================================
// 📐 CONSTANTES - MAPEO MODO → MOOD
// ============================================================
/**
 * Mapeo de escala → mood emocional
 *
 * Esto es lo que decide si pones luces AZULES o NARANJAS
 * ¡El Alma de la Fiesta!
 */
export const MODE_TO_MOOD = {
    // === MODOS FELICES (Cálidos) ===
    major: 'happy', // Brillante, alegre → Naranjas, amarillos
    lydian: 'dreamy', // Etéreo, flotante → Púrpuras, azul claro
    mixolydian: 'bluesy', // Rock, blues feliz → Naranjas cálidos
    // === MODOS TRISTES (Fríos) ===
    minor: 'sad', // Melancólico → Azules profundos
    dorian: 'jazzy', // Sofisticado, jazz → Azules jazz, morados
    harmonic_minor: 'tense', // Dramático → Rojos oscuros
    melodic_minor: 'jazzy', // Jazz avanzado → Morados
    // === MODOS TENSOS/EXÓTICOS (Especiales) ===
    phrygian: 'spanish_exotic', // Spanish, flamenco → Rojos, negros
    locrian: 'tense', // Muy inestable → Rojos, strobes
    // === PENTATÓNICAS (Universales) ===
    pentatonic_major: 'universal', // Folk, simple → Colores naturales
    pentatonic_minor: 'bluesy', // Blues rock → Azul oscuro
    // === ESPECIALES ===
    blues: 'bluesy', // Blues → Azul profundo
    chromatic: 'tense', // Atonal → Caótico, strobes
};
/**
 * Niveles de temperatura de color por mood
 * Usado para decidir si la iluminación debe ser cálida o fría
 */
export const MOOD_TEMPERATURE = {
    happy: 'warm', // Naranjas, amarillos
    dreamy: 'cool', // Púrpuras suaves
    bluesy: 'warm', // Naranjas rock
    sad: 'cool', // Azules profundos
    jazzy: 'cool', // Azules sofisticados
    spanish_exotic: 'warm', // Rojos flamenco
    tense: 'neutral', // Puede ser cualquiera, intenso
    universal: 'neutral', // Adaptable
};
/**
 * Intervalos disonantes (en semitonos)
 * Estos intervalos crean tensión matemática
 */
export const DISSONANT_INTERVALS = [1, 2, 6, 10, 11]; // semitono, tono, tritono, 7ª menor, 7ª mayor
/**
 * El TRITONO (6 semitonos) - El diablo en la música
 * Históricamente llamado "diabolus in musica"
 */
export const TRITONE_INTERVAL = 6;
const DEFAULT_CONFIG = {
    throttleMs: 500, // REGLA 1: Throttled, no cada 30ms
    minConfidence: 0.3,
    detectDissonance: true,
    historySize: 5,
};
// ============================================================
// 🎸 HARMONY DETECTOR CLASS
// ============================================================
/**
 * Detector de armonía musical
 *
 * ⚠️ REGLA 1: Ejecutar throttled (500ms) en Worker Thread
 * ⚠️ REGLA 2: Retorna confidence para fallback
 * 🎬 WAVE 1024.B: Vote boost basado en clarity del God Ear
 */
export class HarmonyDetector extends EventEmitter {
    // ═══════════════════════════════════════════════════════════════════════
    constructor(config = {}) {
        super();
        // Estado interno
        this.lastAnalysis = null;
        this.lastAnalysisTime = 0;
        this.history = [];
        // Cache de chromagrama para smoothing
        this.chromaHistory = [];
        // ═══════════════════════════════════════════════════════════════════════
        // 🎬 WAVE 1024.B - VOTE BOOST STATE
        // ═══════════════════════════════════════════════════════════════════════
        /** Claridad del God Ear FFT (0-1). Actualizada externamente. */
        this.currentClarity = 0.5;
        /** Historial de votos con peso para estabilización */
        this.keyVoteHistory = new Map();
        /** Número de frames para mantener el historial de votos */
        this.VOTE_HISTORY_FRAMES = 10;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.scaleIdentifier = createScaleIdentifier();
    }
    // ============================================================
    // 🎬 WAVE 1024.B - CLARITY INTEGRATION
    // ============================================================
    /**
     * Actualizar claridad del God Ear
     *
     * Llamado por el Trinity Bridge cuando recibe nuevas métricas del FFT 8K.
     * Este valor determina el peso de los votos de detección de key.
     *
     * @param clarity Valor 0-1 del God Ear (1 = señal muy limpia)
     */
    setClarity(clarity) {
        this.currentClarity = Math.max(0, Math.min(1, clarity));
    }
    /**
     * Obtener el peso del voto basado en la claridad actual
     *
     * - clarity > 0.7: Peso 2.0 (señal limpia, voto fuerte)
     * - clarity 0.4-0.7: Peso 1.0 (señal normal)
     * - clarity < 0.4: Peso 0.5 (señal ruidosa, voto débil)
     */
    getVoteWeight() {
        if (this.currentClarity > 0.7) {
            return 2.0; // Alta confianza
        }
        else if (this.currentClarity < 0.4) {
            return 0.5; // Baja confianza
        }
        return 1.0; // Normal
    }
    /**
     * Registrar un voto de key con peso
     */
    registerKeyVote(key, weight) {
        const existing = this.keyVoteHistory.get(key) || { totalWeight: 0, count: 0 };
        existing.totalWeight += weight;
        existing.count += 1;
        this.keyVoteHistory.set(key, existing);
    }
    /**
     * Obtener la key con más votos ponderados
     */
    getStabilizedKey() {
        if (this.keyVoteHistory.size === 0) {
            return null;
        }
        let bestKey = '';
        let bestWeight = 0;
        let totalWeight = 0;
        for (const [key, votes] of this.keyVoteHistory) {
            totalWeight += votes.totalWeight;
            if (votes.totalWeight > bestWeight) {
                bestWeight = votes.totalWeight;
                bestKey = key;
            }
        }
        if (!bestKey || totalWeight === 0) {
            return null;
        }
        return {
            key: bestKey,
            confidence: bestWeight / totalWeight,
        };
    }
    /**
     * Decaer los votos históricos (llamar cada frame de análisis)
     */
    decayKeyVotes() {
        const DECAY_FACTOR = 0.9;
        for (const [key, votes] of this.keyVoteHistory) {
            votes.totalWeight *= DECAY_FACTOR;
            if (votes.totalWeight < 0.01) {
                this.keyVoteHistory.delete(key);
            }
        }
    }
    /**
     * Obtener diagnósticos del sistema de votos (para debugging)
     */
    getVoteDiagnostics() {
        const historyObject = {};
        for (const [key, votes] of this.keyVoteHistory) {
            historyObject[key] = { ...votes };
        }
        return {
            currentClarity: this.currentClarity,
            currentVoteWeight: this.getVoteWeight(),
            keyVoteHistory: historyObject,
            stabilizedKey: this.getStabilizedKey(),
        };
    }
    // ============================================================
    // 📊 MÉTODO PRINCIPAL - ANALYZE
    // ============================================================
    /**
     * Analizar armonía del audio
     *
     * ⚠️ THROTTLED: Solo ejecuta si ha pasado suficiente tiempo
     * ⚠️ REGLA 2: Siempre retorna confidence
     *
     * @param audio AudioAnalysis del frame actual
     * @param forceAnalysis Forzar análisis ignorando throttle (para tests)
     * @returns HarmonyAnalysis con key, mode, mood, chord y confidence
     */
    analyze(audio, forceAnalysis = false) {
        const now = Date.now();
        // THROTTLING: Retornar caché si no ha pasado suficiente tiempo
        if (!forceAnalysis &&
            this.lastAnalysis &&
            (now - this.lastAnalysisTime) < this.config.throttleMs) {
            return this.lastAnalysis;
        }
        // 🎬 WAVE 1024.B: Decaer votos históricos cada frame de análisis
        this.decayKeyVotes();
        // === CHECK SILENCIO PRIMERO ===
        // Verificar energía del audio ANTES de procesar
        const audioEnergy = this.calculateRawAudioEnergy(audio);
        if (audioEnergy < 0.05) {
            return this.createEmptyAnalysis(now);
        }
        // === PASO 1: Convertir FFT a Chromagrama ===
        const chromaAnalysis = this.extractChromagrama(audio);
        // Si el chromagrama no tiene información útil
        if (chromaAnalysis.totalEnergy < 0.1) {
            return this.createEmptyAnalysis(now);
        }
        // === PASO 2: Identificar Escala/Tonalidad ===
        const scaleMatch = this.scaleIdentifier.identifyScale(chromaAnalysis.chroma);
        // 🎬 WAVE 1024.B: Registrar voto de key con peso basado en clarity
        const voteWeight = this.getVoteWeight();
        this.registerKeyVote(scaleMatch.rootName, voteWeight * scaleMatch.confidence);
        // === PASO 3: Mapear a Mood ===
        const mood = MODE_TO_MOOD[scaleMatch.scale];
        // === PASO 4: Estimar Acorde Actual ===
        const chord = this.estimateChord(chromaAnalysis);
        // === PASO 5: Detectar Disonancia (opcional) ===
        let dissonance = null;
        if (this.config.detectDissonance) {
            dissonance = this.detectDissonance(chromaAnalysis);
        }
        // === PASO 6: Construir Resultado ===
        // 🎬 WAVE 1024.B: Usar key estabilizada si está disponible
        const stabilized = this.getStabilizedKey();
        const finalKey = (stabilized && stabilized.confidence > 0.6)
            ? stabilized.key
            : scaleMatch.rootName;
        const analysis = {
            key: finalKey,
            mode: {
                scale: scaleMatch.scale,
                confidence: scaleMatch.confidence,
                mood,
            },
            currentChord: chord,
            confidence: this.calculateOverallConfidence(scaleMatch, chord, chromaAnalysis),
            timestamp: now,
        };
        // === PASO 7: Actualizar Estado ===
        this.updateHistory(analysis);
        this.lastAnalysis = analysis;
        this.lastAnalysisTime = now;
        // === PASO 8: Emitir Eventos ===
        this.emit('harmony', analysis);
        if (dissonance?.suggestTension) {
            this.emit('tension', dissonance);
        }
        // 🎬 WAVE 1024.B: Detectar cambios de tonalidad con peso de voto
        // Solo emitimos key-change si el voto tiene peso significativo
        if (this.history.length > 1) {
            const prevKey = this.history[this.history.length - 2]?.key;
            if (prevKey && prevKey !== analysis.key && analysis.confidence > 0.6) {
                // El peso del evento indica cuán confiable es este cambio
                const keyChangeWeight = voteWeight * analysis.confidence;
                this.emit('key-change', {
                    from: prevKey,
                    to: analysis.key,
                    confidence: analysis.confidence,
                    weight: keyChangeWeight, // 🎬 WAVE 1024.B: Nuevo campo
                    clarity: this.currentClarity, // 🎬 WAVE 1024.B: Información de contexto
                });
            }
        }
        return analysis;
    }
    // ============================================================
    // 🎵 DETECCIÓN DE TONALIDAD (KEY)
    // ============================================================
    /**
     * Detectar tonalidad principal
     * Usa el historial para estabilizar la detección
     */
    detectKey(audio) {
        const chroma = this.extractChromagrama(audio);
        const match = this.scaleIdentifier.identifyScale(chroma.chroma);
        return {
            key: match.rootName,
            confidence: match.confidence,
        };
    }
    // ============================================================
    // 🎭 DETECCIÓN DE MODO/MOOD
    // ============================================================
    /**
     * Detectar modo y mapear a mood emocional
     */
    detectMode(audio) {
        const chroma = this.extractChromagrama(audio);
        const match = this.scaleIdentifier.identifyScale(chroma.chroma);
        const mood = MODE_TO_MOOD[match.scale];
        const temperature = MOOD_TEMPERATURE[mood];
        return {
            scale: match.scale,
            mood,
            confidence: match.confidence,
            temperature,
        };
    }
    // ============================================================
    // 🎸 ESTIMACIÓN DE ACORDES
    // ============================================================
    /**
     * Estimar el acorde actual basado en el chromagrama
     *
     * Algoritmo simplificado:
     * 1. Encontrar las 3-4 notas más fuertes
     * 2. Determinar la raíz (nota más grave con energía significativa)
     * 3. Analizar intervalos para determinar quality
     */
    estimateChord(chromaAnalysis) {
        const { chroma } = chromaAnalysis;
        // Encontrar las notas más fuertes
        const noteEnergies = chroma.map((energy, pitch) => ({ pitch, energy }))
            .filter(n => n.energy > 0.2)
            .sort((a, b) => b.energy - a.energy)
            .slice(0, 4);
        if (noteEnergies.length < 2) {
            return { root: null, quality: null, confidence: 0 };
        }
        // La nota más fuerte es probablemente la raíz
        const root = noteEnergies[0].pitch;
        const rootName = NOTE_NAMES[root];
        // Analizar intervalos desde la raíz
        const intervals = noteEnergies.slice(1).map(n => {
            let interval = n.pitch - root;
            if (interval < 0)
                interval += 12;
            return interval;
        });
        // Determinar quality
        const quality = this.determineChordQuality(intervals);
        // Calcular confianza basada en claridad del acorde
        const confidence = this.calculateChordConfidence(noteEnergies);
        return { root: rootName, quality, confidence };
    }
    /**
     * Determinar la calidad del acorde basado en intervalos
     */
    determineChordQuality(intervals) {
        const hasInterval = (target) => intervals.includes(target);
        // Major: tiene 3ª mayor (4 semitonos) y 5ª justa (7)
        if (hasInterval(4) && hasInterval(7))
            return 'major';
        // Minor: tiene 3ª menor (3 semitonos) y 5ª justa (7)
        if (hasInterval(3) && hasInterval(7))
            return 'minor';
        // Diminished: 3ª menor (3) y 5ª disminuida (6)
        if (hasInterval(3) && hasInterval(6))
            return 'diminished';
        // Augmented: 3ª mayor (4) y 5ª aumentada (8)
        if (hasInterval(4) && hasInterval(8))
            return 'augmented';
        // Sus4: sin 3ª, tiene 4ª (5 semitonos)
        if (!hasInterval(3) && !hasInterval(4) && hasInterval(5))
            return 'suspended';
        // Sus2: sin 3ª, tiene 2ª (2 semitonos)
        if (!hasInterval(3) && !hasInterval(4) && hasInterval(2))
            return 'suspended';
        return null;
    }
    /**
     * Calcular confianza del acorde
     */
    calculateChordConfidence(noteEnergies) {
        if (noteEnergies.length < 3)
            return 0.3;
        // Confianza alta si las notas del acorde son mucho más fuertes que el ruido
        const topEnergy = noteEnergies.slice(0, 3).reduce((sum, n) => sum + n.energy, 0);
        const avgEnergy = topEnergy / 3;
        // Si las notas principales tienen buena energía, alta confianza
        return Math.min(1, avgEnergy * 1.5);
    }
    // ============================================================
    // 😈 DETECCIÓN DE DISONANCIA
    // ============================================================
    /**
     * Detectar disonancia en el audio
     *
     * La disonancia indica TENSIÓN musical
     * Útil para preparar efectos de strobe o colores rojos
     */
    detectDissonance(chromaAnalysis) {
        const { chroma } = chromaAnalysis;
        // Encontrar notas presentes
        const presentNotes = chroma
            .map((energy, pitch) => ({ pitch, energy }))
            .filter(n => n.energy > 0.2);
        let dissonanceScore = 0;
        const detectedDissonance = [];
        let hasTritone = false;
        // Comparar cada par de notas
        for (let i = 0; i < presentNotes.length; i++) {
            for (let j = i + 1; j < presentNotes.length; j++) {
                let interval = Math.abs(presentNotes[j].pitch - presentNotes[i].pitch);
                if (interval > 6)
                    interval = 12 - interval; // Inversión
                if (DISSONANT_INTERVALS.includes(interval)) {
                    // Peso por la energía de las notas involucradas
                    const weight = (presentNotes[i].energy + presentNotes[j].energy) / 2;
                    dissonanceScore += weight;
                    detectedDissonance.push(interval);
                    if (interval === TRITONE_INTERVAL) {
                        hasTritone = true;
                        // El tritono es extra disonante
                        dissonanceScore += weight * 0.5;
                    }
                }
            }
        }
        // Normalizar score
        const normalizedDissonance = Math.min(1, dissonanceScore / 2);
        return {
            level: normalizedDissonance,
            hasTritone,
            disonantIntervals: [...new Set(detectedDissonance)],
            suggestTension: normalizedDissonance > 0.5 || hasTritone,
        };
    }
    // ============================================================
    // 🔧 MÉTODOS AUXILIARES
    // ============================================================
    /**
     * Extraer chromagrama del audio
     * Convierte el espectro FFT a 12 pitch classes
     */
    extractChromagrama(audio) {
        // Si tenemos rawFFT, usarlo para chromagrama real
        // Si no, aproximar desde las bandas de frecuencia
        const chroma = new Array(12).fill(0);
        if (audio.rawFFT && audio.rawFFT.length > 0) {
            // Chromagrama real desde FFT
            this.fftToChroma(audio.rawFFT, chroma);
        }
        else {
            // Aproximación desde bandas de frecuencia
            // Esto es menos preciso pero funcional
            this.spectrumToChroma(audio.spectrum, chroma);
        }
        // Normalizar
        const maxEnergy = Math.max(...chroma, 0.001);
        const normalizedChroma = chroma.map(e => e / maxEnergy);
        // Encontrar nota dominante
        let dominantPitch = 0;
        let maxVal = 0;
        for (let i = 0; i < 12; i++) {
            if (normalizedChroma[i] > maxVal) {
                maxVal = normalizedChroma[i];
                dominantPitch = i;
            }
        }
        // Smoothing: Promediar con historial
        this.chromaHistory.push(normalizedChroma);
        if (this.chromaHistory.length > this.config.historySize) {
            this.chromaHistory.shift();
        }
        const smoothedChroma = this.averageChroma();
        return {
            chroma: smoothedChroma,
            dominantPitch,
            totalEnergy: normalizedChroma.reduce((sum, e) => sum + e, 0),
        };
    }
    /**
     * Convertir FFT real a chromagrama
     *
     * Algoritmo:
     * - Mapear cada bin del FFT a su pitch class correspondiente
     * - Acumular energía por pitch class
     */
    fftToChroma(fft, chroma) {
        const sampleRate = 44100; // Asumir 44.1kHz
        const binSize = sampleRate / (fft.length * 2);
        for (let i = 1; i < fft.length / 2; i++) {
            const frequency = i * binSize;
            // Solo considerar frecuencias musicales (27.5Hz - 4186Hz, A0 - C8)
            if (frequency < 27.5 || frequency > 4186)
                continue;
            // Convertir frecuencia a número MIDI
            const midiNote = 12 * Math.log2(frequency / 440) + 69;
            if (midiNote >= 0 && midiNote < 128) {
                const pitchClass = Math.round(midiNote) % 12;
                const energy = Math.abs(fft[i]);
                chroma[pitchClass] += energy;
            }
        }
    }
    /**
     * Aproximar chromagrama desde bandas de frecuencia
     * Menos preciso pero funciona sin FFT raw
     */
    spectrumToChroma(spectrum, chroma) {
        // Aproximación muy simplificada:
        // Bass → notas graves (C, E, G típicas de bajo)
        // Mid → notas medias
        // Treble → armónicos
        const { bass, lowMid, mid, highMid, treble } = spectrum;
        // Bass suele tener C, E, G (I-III-V de la tónica)
        chroma[0] += bass * 0.5; // C
        chroma[4] += bass * 0.3; // E  
        chroma[7] += bass * 0.2; // G
        // LowMid añade color
        chroma[2] += lowMid * 0.3; // D
        chroma[5] += lowMid * 0.3; // F
        chroma[9] += lowMid * 0.3; // A
        // Mid es donde está la melodía principal
        // Distribuir uniformemente con algo de ruido
        for (let i = 0; i < 12; i++) {
            chroma[i] += mid * 0.1;
        }
        // HighMid y Treble son armónicos
        chroma[0] += highMid * 0.2;
        chroma[4] += highMid * 0.15;
        chroma[7] += highMid * 0.15;
        chroma[11] += treble * 0.1;
    }
    /**
     * Promediar chromagramas del historial para smoothing
     */
    averageChroma() {
        if (this.chromaHistory.length === 0) {
            return new Array(12).fill(0);
        }
        const avg = new Array(12).fill(0);
        for (const chroma of this.chromaHistory) {
            for (let i = 0; i < 12; i++) {
                avg[i] += chroma[i];
            }
        }
        const count = this.chromaHistory.length;
        return avg.map(v => v / count);
    }
    /**
     * Calcular confianza general del análisis
     */
    calculateOverallConfidence(scaleMatch, chord, chromaAnalysis) {
        // Factores de confianza:
        // 1. Confianza de la escala detectada (40%)
        // 2. Confianza del acorde (30%)
        // 3. Energía total (claridad de señal) (30%)
        const scaleConfidence = scaleMatch.confidence;
        const chordConfidence = chord.confidence;
        const energyConfidence = Math.min(1, chromaAnalysis.totalEnergy / 6);
        return (scaleConfidence * 0.4 +
            chordConfidence * 0.3 +
            energyConfidence * 0.3);
    }
    /**
     * Calcular energía raw del audio (antes de normalización)
     * Útil para detectar silencio
     */
    calculateRawAudioEnergy(audio) {
        const { spectrum, energy } = audio;
        // Si tenemos energía calculada, usarla directamente
        if (energy && typeof energy.current === 'number') {
            return energy.current;
        }
        // Fallback: calcular desde spectrum
        const { bass, lowMid, mid, highMid, treble } = spectrum;
        return (bass + lowMid + mid + highMid + treble) / 5;
    }
    /**
     * Crear análisis vacío para cuando no hay señal
     */
    createEmptyAnalysis(timestamp) {
        return {
            key: null,
            mode: {
                scale: 'chromatic',
                confidence: 0,
                mood: 'universal',
            },
            currentChord: {
                root: null,
                quality: null,
                confidence: 0,
            },
            confidence: 0,
            timestamp,
        };
    }
    /**
     * Actualizar historial de análisis
     */
    updateHistory(analysis) {
        this.history.push(analysis);
        if (this.history.length > this.config.historySize) {
            this.history.shift();
        }
    }
    // ============================================================
    // 📤 GETTERS Y UTILIDADES
    // ============================================================
    /**
     * Obtener último análisis (del caché)
     */
    getLastAnalysis() {
        return this.lastAnalysis;
    }
    /**
     * Obtener historial de análisis
     */
    getHistory() {
        return [...this.history];
    }
    /**
     * Obtener temperatura de color sugerida para el mood actual
     */
    getSuggestedTemperature() {
        if (!this.lastAnalysis)
            return 'neutral';
        return MOOD_TEMPERATURE[this.lastAnalysis.mode.mood];
    }
    /**
     * Resetear estado interno
     */
    reset() {
        this.lastAnalysis = null;
        this.lastAnalysisTime = 0;
        this.history = [];
        this.chromaHistory = [];
    }
    /**
     * Actualizar configuración
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
}
// ============================================================
// 📤 FACTORY FUNCTION
// ============================================================
/**
 * Crear instancia de HarmonyDetector con config por defecto
 */
export function createHarmonyDetector(config) {
    return new HarmonyDetector(config);
}
// Export default instance for quick usage
export const defaultHarmonyDetector = new HarmonyDetector();

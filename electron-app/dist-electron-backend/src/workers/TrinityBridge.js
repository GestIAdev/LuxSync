/**
 * 🌉 TRINITY BRIDGE - Adaptador Wave 8 ↔ Trinity Workers
 *
 * Convierte entre:
 * - WorkerProtocol types (Trinity)
 * - Musical Engine types (Wave 8)
 *
 * Este archivo permite que los workers usen los motores de Wave 8
 * sin modificar sus interfaces originales.
 */
// ============================================
// CONVERSION FUNCTIONS
// ============================================
/**
 * Convert HSL to Trinity RGB
 *
 * @deprecated WAVE 17.2 - Reemplazado por SeleneColorEngine.hslToRgb()
 * Esta función permanece SOLO para compatibilidad con createReactiveDecision (modo fallback).
 * Para modo INTELLIGENT, usa SeleneColorEngine.generateRgb() directamente.
 */
export function hslToTrinityRgb(hsl) {
    const h = hsl.h / 360;
    const s = hsl.s / 100;
    const l = hsl.l / 100;
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    }
    else {
        const hue2rgb = (p, q, t) => {
            if (t < 0)
                t += 1;
            if (t > 1)
                t -= 1;
            if (t < 1 / 6)
                return p + (q - p) * 6 * t;
            if (t < 1 / 2)
                return q;
            if (t < 2 / 3)
                return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
}
/**
 * Convert Trinity AudioAnalysis to AudioMetrics (for Wave 8 engines)
 */
export function trinityToAudioMetrics(analysis) {
    return {
        bass: analysis.bass,
        mid: analysis.mid,
        treble: analysis.treble,
        volume: analysis.energy,
        bpm: analysis.bpm,
        bpmConfidence: analysis.bpmConfidence,
        onBeat: analysis.onBeat,
        beatPhase: analysis.beatPhase,
        timestamp: analysis.timestamp,
    };
}
/**
 * Convert SelenePalette to Trinity LightingDecision palette
 */
export function paletteToTrinity(palette, intensity) {
    return {
        primary: hslToTrinityRgb(palette.primary),
        secondary: hslToTrinityRgb(palette.secondary),
        accent: hslToTrinityRgb(palette.accent),
        intensity,
    };
}
/**
 * Map section type to movement pattern
 */
export function sectionToMovement(section, energy, syncopation) {
    // High energy sections (including textural drops — vocal screams etc.)
    if (section.type === 'drop' || section.type === 'chorus' || section.type === 'textural_drop') {
        if (syncopation > 0.6)
            return 'figure8';
        if (energy > 0.8)
            return 'chase';
        return 'sweep';
    }
    // Building sections
    if (section.type === 'buildup') {
        return 'circle';
    }
    // Calm sections
    if (section.type === 'breakdown' || section.type === 'bridge') {
        return 'sweep';
    }
    // Intro/Outro
    if (section.type === 'intro' || section.type === 'outro') {
        return energy > 0.3 ? 'sweep' : 'static';
    }
    // Default based on energy
    if (energy > 0.7)
        return 'chase';
    if (energy > 0.4)
        return 'sweep';
    return 'static';
}
/**
 * Create a complete MusicalContext from Trinity AudioAnalysis
 * This is the main bridge function used by GAMMA worker
 */
export function createMusicalContextFromTrinity(analysis, rhythm, harmony, section, genre) {
    // Calculate combined confidence (REGLA 2)
    // 🔧 WAVE 74: CONFIDENCE CRASH FIX - GenreClassifier fue eliminado (zombie muerto)
    // genre.confidence ahora siempre es 0, así que redistribuimos los pesos
    // ANTES: rhythm=0.35, harmony=0.20, section=0.20, genre=0.25 (máximo=0.75 sin genre)
    // AHORA: rhythm=0.45, harmony=0.30, section=0.25, genre=0 (máximo=1.0)
    const combinedConfidence = rhythm.confidence * 0.45 +
        harmony.confidence * 0.30 +
        section.confidence * 0.25;
    // genre.confidence ya no se usa - GenreClassifier eliminado en WAVE 70+
    // Determine operation mode (REGLA 2)
    const operationMode = combinedConfidence >= 0.5 ? 'intelligent' : 'reactive';
    // Synthesize global energy
    const globalEnergy = (analysis.energy * 0.4 +
        section.energy * 0.3 +
        (analysis.onBeat ? analysis.beatStrength : 0) * 0.3);
    // Synthesize global mood
    let globalMood = harmony.mood;
    if (operationMode === 'reactive') {
        // In reactive mode, simplify mood based on energy
        globalMood = globalEnergy > 0.6 ? 'happy' : 'universal';
    }
    return {
        timestamp: analysis.timestamp,
        frameId: analysis.frameId,
        audio: trinityToAudioMetrics(analysis),
        rhythm,
        harmony,
        section,
        genre,
        globalEnergy,
        globalMood,
        operationMode,
        combinedConfidence,
    };
}
/**
 * Create fallback/reactive lighting decision
 * Used when confidence < 0.5 (V17 style direct mapping)
 *
 * OPERATION PURGE: Now uses procedural palette generation
 * instead of hardcoded colors. Fallback is NEUTRAL procedural,
 * NOT a fixed array.
 */
export function createReactiveDecision(analysis, frameId) {
    // V17 style: Direct audio → light mapping BUT with procedural colors
    // === PROCEDURAL FALLBACK ===
    // Derive mood from audio characteristics (no Wave 8 data available)
    const derivedMood = analysis.energy > 0.6
        ? (analysis.bass > analysis.treble ? 'happy' : 'tense')
        : (analysis.treble > analysis.mid ? 'dreamy' : 'universal');
    // Use SimplePaletteGenerator for reactive mode too
    const generator = new SimplePaletteGenerator();
    const palette = generator.generate(derivedMood, analysis.energy, 0, // Zero syncopation (unknown in reactive) - RESCUE DIRECTIVE: NO DEFAULTS
    null // No key detection in reactive mode
    );
    // Convert procedural palette to Trinity format
    const primary = hslToTrinityRgb(palette.primary);
    const secondary = hslToTrinityRgb(palette.secondary);
    const accent = hslToTrinityRgb(palette.accent);
    return {
        timestamp: Date.now(),
        frameId,
        decisionId: `reactive-${frameId}-${Date.now()}`,
        confidence: 0.3, // Low confidence = reactive mode
        beautyScore: 0.5, // Neutral beauty
        source: 'fallback',
        palette: {
            primary,
            secondary,
            accent,
            intensity: analysis.energy,
        },
        movement: {
            pattern: 'sweep',
            speed: 0.3 + analysis.bpm / 300,
            range: analysis.bass,
            sync: analysis.bpmConfidence > 0.5 ? 'beat' : 'free',
        },
        effects: {
            strobe: analysis.onBeat && analysis.energy > 0.9,
            strobeRate: analysis.bpm > 140 ? analysis.bpm / 60 : undefined,
            fog: 0,
            laser: analysis.treble > 0.8,
        },
    };
}
// ============================================
// SIMPLIFIED ANALYZERS FOR WORKERS
// ============================================
// Note: These are simplified versions that run in workers.
// The full Wave 8 engines run in main thread with throttling.
/**
 * Simplified rhythm detection for workers
 * 🌊 WAVE 41.1: Agregado EMA para suavizar sincopación
 * 🔧 WAVE 45.1: Confidence mide consistencia real, no solo historial
 */
export class SimpleRhythmDetector {
    constructor() {
        this.phaseHistory = [];
        this.historySize = 32;
        // 🌊 WAVE 41.1: EMA para sincopación suavizada
        this.smoothedSyncopation = 0.35; // Default neutral
        this.SYNC_ALPHA = 0.08; // Factor de suavizado (lento y estable)
        // 🔧 WAVE 45.1: Historial de sync para calcular varianza
        this.syncHistory = [];
    }
    analyze(audio) {
        // Track energy at different beat phases
        this.phaseHistory.push({
            phase: audio.beatPhase,
            energy: audio.bass + audio.mid * 0.5,
        });
        if (this.phaseHistory.length > this.historySize) {
            this.phaseHistory.shift();
        }
        // Calculate syncopation (off-beat energy ratio)
        // 🎯 WAVE 16.5: WIDEN THE NET - Fix "Techno Syncopation Bug"
        // Ventana ampliada a 50% para capturar kicks largos completos
        let onBeatEnergy = 0;
        let offBeatEnergy = 0;
        for (const frame of this.phaseHistory) {
            // ANTES: frame.phase < 0.15 || frame.phase > 0.85 (30% ventana)
            // AHORA: frame.phase < 0.25 || frame.phase > 0.75 (50% ventana)
            // RAZÓN: Kicks de Techno duran ~200ms en beat de 500ms = 40% del ciclo
            const isOnBeat = frame.phase < 0.25 || frame.phase > 0.75;
            if (isOnBeat) {
                onBeatEnergy += frame.energy;
            }
            else {
                offBeatEnergy += frame.energy;
            }
        }
        const totalEnergy = onBeatEnergy + offBeatEnergy;
        const instantSync = totalEnergy > 0 ? offBeatEnergy / totalEnergy : 0;
        // 🌊 WAVE 41.1: Aplicar EMA para suavizar sincopación
        // Evita saltos bruscos (0.03 → 1.00) que confunden al GenreClassifier
        this.smoothedSyncopation = (this.SYNC_ALPHA * instantSync) + ((1 - this.SYNC_ALPHA) * this.smoothedSyncopation);
        const syncopation = this.smoothedSyncopation;
        // 🔧 WAVE 45.1: Guardar historial de sync para calcular varianza
        this.syncHistory.push(syncopation);
        if (this.syncHistory.length > this.historySize) {
            this.syncHistory.shift();
        }
        // 🔧 WAVE 45.1: Calcular confidence basada en CONSISTENCIA real
        const syncVariance = this.calculateVariance(this.syncHistory);
        const rhythmQuality = Math.max(0, 1 - syncVariance * 4); // Varianza alta = baja calidad
        const coverage = Math.min(1, this.phaseHistory.length / this.historySize);
        const realConfidence = Math.min(0.95, coverage * rhythmQuality * 0.85 + 0.1); // Cap 0.95, min 0.10
        // Pattern detection (simplified)
        // 🔧 WAVE 45.1: Thresholds realistas basados en logs reales
        let pattern = 'unknown';
        if (syncopation < 0.40)
            pattern = 'four_on_floor'; // Era 0.2 (inalcanzable)
        else if (syncopation > 0.55)
            pattern = 'breakbeat'; // Era 0.5
        else if (audio.bpm >= 90 && audio.bpm <= 105 && syncopation > 0.25)
            pattern = 'reggaeton';
        return {
            pattern,
            syncopation,
            groove: 1 - Math.abs(syncopation - 0.3) * 2, // Groove peaks at moderate syncopation
            subdivision: audio.bpm > 140 ? 16 : audio.bpm > 100 ? 8 : 4,
            fillDetected: false,
            confidence: realConfidence, // 🔧 WAVE 45.1: Ahora mide consistencia real
            drums: {
                kick: audio.bass > 0.6,
                kickIntensity: audio.bass,
                snare: audio.mid > 0.5 && audio.onBeat,
                snareIntensity: audio.mid,
                hihat: audio.treble > 0.4,
                hihatIntensity: audio.treble,
            },
        };
    }
    // 🔧 WAVE 45.1: Calcular varianza para medir consistencia
    calculateVariance(arr) {
        if (arr.length < 2)
            return 0;
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
        const squaredDiffs = arr.map(x => (x - mean) ** 2);
        return squaredDiffs.reduce((a, b) => a + b, 0) / arr.length;
    }
    reset() {
        this.phaseHistory = [];
        this.syncHistory = []; // 🔧 WAVE 45.1
    }
}
/**
 * 🧮 WAVE 15: Harmony detection with dynamic thresholds
 *
 * Mejorado para trabajar con datos FFT reales.
 * Los umbrales se ajustan según el nivel de energía global.
 *
 * 🎵 WAVE 15.5: Añadido Key detection basado en frecuencia dominante
 * 🎵 WAVE 15.6: Estabilización de Key/Mood (anti-epilepsia)
 */
/**
 * 🎵 WAVE 16 PRO: SimpleHarmonyDetector con VOTACIÓN PONDERADA POR ENERGÍA
 *
 * MEJORA PRO #2: Los votos para Key/Mood se ponderan por energía:
 *   peso = energia^1.2
 *
 * Esto significa que los momentos de alta energía (drops, chorus)
 * tienen 3-4x más influencia que las partes quietas (intros).
 *
 * RESULTADO: Key y Mood detectados reflejan las partes "importantes"
 * de la canción, no las partes silenciosas.
 */
export class SimpleHarmonyDetector {
    constructor() {
        // 🎯 WAVE 16: Votación ponderada por energía
        this.moodWeightedVotes = new Map();
        this.temperatureWeightedVotes = new Map();
        // Legacy history para fallback
        this.moodHistory = [];
        this.temperatureHistory = [];
        this.historySize = 32; // WAVE 15.6: Era 16, ahora 32 (~2 seg) para estabilidad
        // Historial de ratios para detección de cambios
        this.bassToTrebleHistory = [];
        this.ratioHistorySize = 16; // WAVE 15.6: Era 8, ahora 16
        // 🎵 WAVE 15.5: Key detection
        // 🎵 WAVE 15.6: Aumentado historial para estabilidad
        // 🎯 WAVE 16: Ahora con votación ponderada
        // 🔧 WAVE 272: AJUSTADO PARA 10FPS (era calibrado para 30-60fps)
        this.noteWeightedVotes = new Map();
        this.noteHistory = [];
        this.noteHistorySize = 32; // 🔧 WAVE 272: Era 64, ahora 32 (~3 seg @ 10fps)
        this.lastDetectedKey = null;
        this.keyStabilityCounter = 0; // WAVE 15.6: Contador de estabilidad
        this.keyStabilityThreshold = 15; // 🔧 WAVE 272: Era 90, ahora 15 (~1.5 seg @ 10fps)
        // 🎯 WAVE 16: Tracking de energía para ponderación
        this.totalWeightAccumulated = 0;
        this.WEIGHT_DECAY = 0.997; // Decaimiento exponencial suave
        this.ENERGY_POWER = 1.2; // Exponente para peso: energia^1.2
        // Notas musicales ordenadas (A4 = 440Hz como referencia)
        this.NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    }
    /**
     * 🎵 Convertir frecuencia a nota musical
     * Usa A4 = 440Hz como referencia
     */
    frequencyToNote(freq) {
        // Ignorar frecuencias muy bajas (sub-bass) o muy altas (ruido)
        if (freq < 65 || freq > 4000)
            return null;
        const A4 = 440;
        // Calcular cuántos semitonos desde A4
        const semitonesFromA4 = 12 * Math.log2(freq / A4);
        // A4 es índice 9 (A), así que calculamos el índice en el array
        const noteIndex = Math.round(semitonesFromA4 + 9) % 12;
        return this.NOTE_NAMES[(noteIndex + 12) % 12]; // Handle negative
    }
    /**
     * 🎵 Detectar Key basándose en votación ponderada por energía
     * WAVE 16 PRO: Votos ponderados - momentos de alta energía pesan más
     * WAVE 15.6: Lógica de estabilidad anti-epilepsia
     * 🔧 WAVE 272: Ajustado para 10fps (antes era 30-60fps)
     * 🔧 WAVE 272: CORREGIDO BUG - Primera Key nunca se detectaba
     */
    detectKey() {
        // 🔧 WAVE 272: Reducido de 16 a 5 frames (~0.5 seg @ 10fps) para empezar a detectar
        if (this.noteHistory.length < 5)
            return this.lastDetectedKey;
        // 🎯 WAVE 16: Usar votos ponderados si hay suficiente peso acumulado
        if (this.totalWeightAccumulated > 1.0) {
            // Encontrar la nota con más peso ponderado
            let dominantNote = '';
            let maxWeight = 0;
            let totalWeight = 0;
            for (const [note, weight] of this.noteWeightedVotes) {
                totalWeight += weight;
                if (weight > maxWeight) {
                    dominantNote = note;
                    maxWeight = weight;
                }
            }
            // 🔧 WAVE 272: Threshold reducido de 0.30 a 0.20 para más sensibilidad
            const threshold = 0.20;
            const dominanceRatio = totalWeight > 0 ? maxWeight / totalWeight : 0;
            if (totalWeight > 0 && dominanceRatio >= threshold) {
                // 🔧 WAVE 272: FIX CRÍTICO - Si no hay Key previa, aceptar la primera dominante
                if (this.lastDetectedKey === null) {
                    this.lastDetectedKey = dominantNote;
                    console.log(`[Harmony 🎵] Initial Key: ${dominantNote} (${(dominanceRatio * 100).toFixed(0)}% dominance)`);
                    return this.lastDetectedKey;
                }
                if (dominantNote !== this.lastDetectedKey) {
                    this.keyStabilityCounter++;
                    // Solo cambiar si ha sido estable por suficientes frames
                    if (this.keyStabilityCounter >= this.keyStabilityThreshold) {
                        const oldKey = this.lastDetectedKey;
                        this.lastDetectedKey = dominantNote;
                        this.keyStabilityCounter = 0;
                        console.log(`[Harmony 🎵] Key Change: ${oldKey} → ${dominantNote} (${(dominanceRatio * 100).toFixed(0)}% dominance)`);
                    }
                }
                else {
                    this.keyStabilityCounter = 0;
                }
                return this.lastDetectedKey;
            }
        }
        // === FALLBACK: Método original por conteo simple ===
        // Contar ocurrencias de cada nota
        const noteCounts = new Map();
        for (const note of this.noteHistory) {
            noteCounts.set(note, (noteCounts.get(note) || 0) + 1);
        }
        // Encontrar la nota más común
        let dominantNote = '';
        let maxCount = 0;
        for (const [note, count] of noteCounts) {
            if (count > maxCount) {
                dominantNote = note;
                maxCount = count;
            }
        }
        // WAVE 15.6: Lógica de estabilidad anti-epilepsia
        // Solo cambiar Key si la nueva nota dominante es clara (>35%) Y estable
        // 🔧 WAVE 272: Reducido threshold de 0.35 a 0.25 para mejor detección
        const threshold = 0.25;
        if (maxCount > this.noteHistory.length * threshold) {
            // 🔧 WAVE 272: FIX CRÍTICO - Si no hay Key previa, aceptar la primera dominante
            if (this.lastDetectedKey === null) {
                this.lastDetectedKey = dominantNote;
                console.log(`[Harmony 🎵] Initial Key (fallback): ${dominantNote} (${(maxCount / this.noteHistory.length * 100).toFixed(0)}%)`);
                return this.lastDetectedKey;
            }
            if (dominantNote === this.lastDetectedKey) {
                // Misma nota, resetear contador
                this.keyStabilityCounter = 0;
            }
            else {
                // Nueva nota candidata
                this.keyStabilityCounter++;
                // Solo cambiar si ha sido estable por suficientes frames
                if (this.keyStabilityCounter >= this.keyStabilityThreshold) {
                    const oldKey = this.lastDetectedKey;
                    this.lastDetectedKey = dominantNote;
                    this.keyStabilityCounter = 0;
                    console.log(`[Harmony 🎵] Key Change (fallback): ${oldKey} → ${dominantNote}`);
                }
            }
        }
        else {
            // No hay nota dominante clara, no cambiar
            this.keyStabilityCounter = 0;
        }
        return this.lastDetectedKey;
    }
    analyze(audio) {
        // 🧮 WAVE 15: Umbrales dinámicos basados en energía global
        const energyLevel = audio.volume;
        // 🎯 WAVE 16 PRO: Calcular peso para votación ponderada
        // peso = energia^1.2 (drops tienen 3-4x más influencia)
        const weight = Math.pow(Math.max(0.01, energyLevel), this.ENERGY_POWER);
        // Aplicar decaimiento a votos anteriores (evita que el pasado lejano domine)
        this.applyDecayToVotes();
        this.totalWeightAccumulated = this.totalWeightAccumulated * this.WEIGHT_DECAY + weight;
        // Con más energía, los umbrales son más estrictos (la música está clara)
        // Con menos energía, los umbrales son más relajados (evitar defaults constantes)
        const bassThresholdHigh = energyLevel > 0.3 ? 2.0 : 1.4;
        const bassThresholdLow = energyLevel > 0.3 ? 0.5 : 0.7;
        const midThreshold = energyLevel > 0.3 ? 0.6 : 0.4;
        const bassToTreble = audio.bass / (audio.treble + 0.001); // Más precisión
        // Tracking del ratio para detectar cambios significativos
        this.bassToTrebleHistory.push(bassToTreble);
        if (this.bassToTrebleHistory.length > this.ratioHistorySize) {
            this.bassToTrebleHistory.shift();
        }
        // Calcular varianza del ratio (cambio = música dinámica)
        const avgRatio = this.bassToTrebleHistory.reduce((a, b) => a + b, 0) / this.bassToTrebleHistory.length;
        const ratioVariance = this.bassToTrebleHistory.reduce((sum, r) => sum + Math.pow(r - avgRatio, 2), 0) / this.bassToTrebleHistory.length;
        // Determinar mood y temperature
        let mood;
        let temperature;
        // 🎭 Lógica de mood mejorada con más estados
        if (bassToTreble > bassThresholdHigh) {
            // Mucho bass, poco treble = oscuro/profundo
            mood = audio.mid > midThreshold ? 'bluesy' : 'sad';
            temperature = 'cool';
        }
        else if (bassToTreble < bassThresholdLow) {
            // Poco bass, mucho treble = brillante/alegre
            mood = audio.mid > midThreshold ? 'happy' : 'dreamy';
            temperature = 'warm';
        }
        else if (audio.mid > midThreshold * 1.2) {
            // Medios dominantes = tensión/presencia
            mood = audio.bass > 0.4 ? 'tense' : 'jazzy';
            temperature = 'neutral';
        }
        else if (audio.treble > 0.5 && audio.bass > 0.5) {
            // Bass y treble altos, mids bajos = "scooped" sound (electrónica)
            mood = 'happy';
            temperature = 'warm';
        }
        else if (ratioVariance > 0.3) {
            // Alta varianza = música dinámica/exótica
            mood = 'spanish_exotic';
            temperature = 'warm';
        }
        else {
            // Default: depende de la energía
            mood = energyLevel > 0.5 ? 'happy' : 'universal';
            temperature = energyLevel > 0.5 ? 'warm' : 'neutral';
        }
        // 🎯 WAVE 16 PRO: Votación ponderada para Mood y Temperature
        const currentMoodWeight = this.moodWeightedVotes.get(mood) || 0;
        this.moodWeightedVotes.set(mood, currentMoodWeight + weight);
        const currentTempWeight = this.temperatureWeightedVotes.get(temperature) || 0;
        this.temperatureWeightedVotes.set(temperature, currentTempWeight + weight);
        // Track mood history for stability (legacy fallback)
        this.moodHistory.push(mood);
        if (this.moodHistory.length > this.historySize) {
            this.moodHistory.shift();
        }
        this.temperatureHistory.push(temperature);
        if (this.temperatureHistory.length > this.historySize) {
            this.temperatureHistory.shift();
        }
        // 🎯 WAVE 16: Usar votos ponderados para dominante (si hay suficiente peso)
        let dominantMood = this.getMostCommon(this.moodHistory);
        let dominantTemp = this.getMostCommon(this.temperatureHistory);
        let moodDominance = 0.5; // 🔧 WAVE 45.1: Track dominancia para confidence
        if (this.totalWeightAccumulated > 0.5) {
            const moodResult = this.getWeightedDominantWithDominance(this.moodWeightedVotes, 'universal');
            dominantMood = moodResult.winner;
            moodDominance = moodResult.dominance;
            dominantTemp = this.getWeightedDominant(this.temperatureWeightedVotes, 'neutral');
        }
        // 🎵 WAVE 15.5 + WAVE 16: Key detection con votación ponderada
        // 🔧 WAVE 272: Debugging verboso para diagnóstico
        if (audio.dominantFrequency && audio.dominantFrequency > 0) {
            const note = this.frequencyToNote(audio.dominantFrequency);
            if (note) {
                // 🎯 WAVE 16: Votación ponderada para Key
                const currentNoteWeight = this.noteWeightedVotes.get(note) || 0;
                this.noteWeightedVotes.set(note, currentNoteWeight + weight);
                this.noteHistory.push(note);
                if (this.noteHistory.length > this.noteHistorySize) {
                    this.noteHistory.shift();
                }
            }
            else {
                // 📝 WAVE 272: La frecuencia está fuera de rango (<65Hz o >4000Hz)
                // Log cada ~60 frames para no spamear
                if (Math.random() < 0.02) {
                    console.log(`[Harmony ⚠️] Freq ${audio.dominantFrequency.toFixed(0)}Hz fuera de rango musical`);
                }
            }
        }
        const detectedKey = this.detectKey();
        // Determinar mode basándose en mood (heurística)
        const mode = (dominantMood === 'sad' || dominantMood === 'bluesy' || dominantMood === 'tense')
            ? 'minor'
            : (dominantMood === 'happy' || dominantMood === 'dreamy')
                ? 'major'
                : 'unknown';
        // 🔧 WAVE 45.1: Confidence basada en dominancia real, no solo historial
        const coverage = Math.min(1, this.moodHistory.length / this.historySize);
        const realConfidence = Math.min(0.95, coverage * moodDominance * 0.9 + 0.05); // Cap 0.95, min 0.05
        return {
            key: detectedKey, // 🎵 WAVE 15.5: Ahora detecta Key real
            mode: mode,
            mood: dominantMood,
            temperature: dominantTemp,
            dissonance: Math.min(1, ratioVariance), // Usar varianza como proxy de disonancia
            chromaticNotes: [],
            confidence: realConfidence, // 🔧 WAVE 45.1: Ahora mide dominancia real
        };
    }
    /**
     * 🎯 WAVE 16: Aplica decaimiento exponencial a todos los votos ponderados
     * Esto evita que el pasado lejano domine la votación
     */
    applyDecayToVotes() {
        for (const [key, value] of this.moodWeightedVotes) {
            this.moodWeightedVotes.set(key, value * this.WEIGHT_DECAY);
        }
        for (const [key, value] of this.temperatureWeightedVotes) {
            this.temperatureWeightedVotes.set(key, value * this.WEIGHT_DECAY);
        }
        for (const [key, value] of this.noteWeightedVotes) {
            this.noteWeightedVotes.set(key, value * this.WEIGHT_DECAY);
        }
    }
    /**
     * 🎯 WAVE 16: Obtiene el valor con mayor peso acumulado
     */
    getWeightedDominant(votes, defaultValue) {
        return this.getWeightedDominantWithDominance(votes, defaultValue).winner;
    }
    // 🔧 WAVE 45.1: Versión que también devuelve dominancia para confidence real
    getWeightedDominantWithDominance(votes, defaultValue) {
        let maxKey = defaultValue;
        let maxWeight = 0;
        let totalWeight = 0;
        for (const [key, weight] of votes) {
            totalWeight += weight;
            if (weight > maxWeight) {
                maxKey = key;
                maxWeight = weight;
            }
        }
        // Dominancia = qué tan dominante es el ganador (0.0 a 1.0)
        const dominance = totalWeight > 0 ? maxWeight / totalWeight : 0.5;
        return { winner: maxKey, dominance };
    }
    getMostCommon(arr) {
        const counts = new Map();
        for (const item of arr) {
            counts.set(item, (counts.get(item) || 0) + 1);
        }
        let maxItem = arr[arr.length - 1] || 'universal';
        let maxCount = 0;
        for (const [item, count] of counts) {
            if (count > maxCount) {
                maxItem = item;
                maxCount = count;
            }
        }
        return maxItem;
    }
    reset() {
        this.moodHistory = [];
        this.temperatureHistory = [];
        this.bassToTrebleHistory = [];
        this.noteHistory = [];
        this.lastDetectedKey = null;
        this.keyStabilityCounter = 0; // WAVE 15.6
        // 🎯 WAVE 16: Limpiar votos ponderados
        this.moodWeightedVotes.clear();
        this.temperatureWeightedVotes.clear();
        this.noteWeightedVotes.clear();
        this.totalWeightAccumulated = 0;
    }
}
const VIBE_PROFILES = {
    'techno': {
        dropEnergyRatio: 1.40,
        maxDropDuration: 30000,
        dropAbsoluteThreshold: 0.75,
        dropCooldown: 15000,
        dropEnergyKillThreshold: 0.55,
        buildupDeltaThreshold: 0.03,
        // 🩸 WAVE 2099: Was 0.35 — techno with constant bass has wE ~0.30-0.40 normally.
        // With 0.35, any small dip triggered breakdown and the section got trapped forever.
        // At 0.25, only real energy collapses (intro, bridge, silence) trigger breakdown.
        breakdownEnergyThreshold: 0.25,
        frequencyWeights: { bass: 0.50, midBass: 0.25, mid: 0.15, treble: 0.10 },
    },
    'latino': {
        dropEnergyRatio: 1.20,
        maxDropDuration: 12000,
        dropAbsoluteThreshold: 0.70,
        dropCooldown: 6000,
        dropEnergyKillThreshold: 0.50,
        buildupDeltaThreshold: 0.05,
        breakdownEnergyThreshold: 0.45,
        frequencyWeights: { bass: 0.30, midBass: 0.40, mid: 0.20, treble: 0.10 },
    },
    'fiesta-latina': {
        dropEnergyRatio: 1.20,
        maxDropDuration: 12000,
        dropAbsoluteThreshold: 0.70,
        dropCooldown: 6000,
        dropEnergyKillThreshold: 0.50,
        buildupDeltaThreshold: 0.05,
        breakdownEnergyThreshold: 0.45,
        frequencyWeights: { bass: 0.30, midBass: 0.40, mid: 0.20, treble: 0.10 },
    },
    'rock': {
        dropEnergyRatio: 1.50,
        maxDropDuration: 8000,
        dropAbsoluteThreshold: 0.80,
        dropCooldown: 20000,
        dropEnergyKillThreshold: 0.60,
        buildupDeltaThreshold: 0.04,
        breakdownEnergyThreshold: 0.40,
        frequencyWeights: { bass: 0.20, midBass: 0.25, mid: 0.40, treble: 0.15 },
    },
    'chill': {
        dropEnergyRatio: 2.00,
        maxDropDuration: 5000,
        dropAbsoluteThreshold: 0.85,
        dropCooldown: 30000,
        dropEnergyKillThreshold: 0.70,
        buildupDeltaThreshold: 0.02,
        breakdownEnergyThreshold: 0.50,
        frequencyWeights: { bass: 0.25, midBass: 0.25, mid: 0.25, treble: 0.25 },
    },
};
// 🩸 WAVE 2097: VIBE ALIASES — Map UI vibe IDs to their Worker profile equivalents
// The UI uses 'techno-club', 'fiesta-latina' etc but Worker profiles use 'techno', 'latino'.
// Without these aliases, setVibe('techno-club') falls to DEFAULT_PROFILE silently.
VIBE_PROFILES['techno-club'] = VIBE_PROFILES['techno'];
VIBE_PROFILES['fiesta-latina'] = VIBE_PROFILES['latino'];
VIBE_PROFILES['pop-rock'] = VIBE_PROFILES['rock'];
VIBE_PROFILES['chill-lounge'] = VIBE_PROFILES['chill'];
// Default profile (techno-compatible for backwards compatibility)
const DEFAULT_PROFILE = VIBE_PROFILES['techno'];
class TriBandRollingStats {
    constructor(windowSize = 1800, wLow = 0.40, wMid = 0.35, wHigh = 0.25) {
        this.pos = 0;
        this.count = 0;
        // Running sums for mean/variance (Welford sliding window)
        this.lowSum = 0;
        this.lowSumSq = 0;
        this.midSum = 0;
        this.midSumSq = 0;
        this.highSum = 0;
        this.highSumSq = 0;
        this.fusedSum = 0;
        this.fusedSumSq = 0;
        this.windowSize = windowSize;
        this.wLow = wLow;
        this.wMid = wMid;
        this.wHigh = wHigh;
        this.lowBuf = new Float32Array(windowSize);
        this.midBuf = new Float32Array(windowSize);
        this.highBuf = new Float32Array(windowSize);
        this.fusedBuf = new Float32Array(windowSize);
        this._stats = {
            zLow: 0, zMid: 0, zHigh: 0, zTotal: 0,
            cfLow: 0, cfHigh: 0, fusedEnergy: 0,
        };
    }
    update(low, mid, high) {
        const fused = low * this.wLow + mid * this.wMid + high * this.wHigh;
        // If buffer full, subtract oldest from sums
        if (this.count >= this.windowSize) {
            const oL = this.lowBuf[this.pos];
            const oM = this.midBuf[this.pos];
            const oH = this.highBuf[this.pos];
            const oF = this.fusedBuf[this.pos];
            this.lowSum -= oL;
            this.lowSumSq -= oL * oL;
            this.midSum -= oM;
            this.midSumSq -= oM * oM;
            this.highSum -= oH;
            this.highSumSq -= oH * oH;
            this.fusedSum -= oF;
            this.fusedSumSq -= oF * oF;
        }
        else {
            this.count++;
        }
        // Write new values
        this.lowBuf[this.pos] = low;
        this.midBuf[this.pos] = mid;
        this.highBuf[this.pos] = high;
        this.fusedBuf[this.pos] = fused;
        // Add to sums
        this.lowSum += low;
        this.lowSumSq += low * low;
        this.midSum += mid;
        this.midSumSq += mid * mid;
        this.highSum += high;
        this.highSumSq += high * high;
        this.fusedSum += fused;
        this.fusedSumSq += fused * fused;
        // Advance
        this.pos = (this.pos + 1) % this.windowSize;
        // Compute stats
        const n = this.count;
        const meanLow = this.lowSum / n;
        const meanMid = this.midSum / n;
        const meanHigh = this.highSum / n;
        const meanFused = this.fusedSum / n;
        const varLow = Math.max(0, (this.lowSumSq - this.lowSum * this.lowSum / n) / n);
        const varMid = Math.max(0, (this.midSumSq - this.midSum * this.midSum / n) / n);
        const varHigh = Math.max(0, (this.highSumSq - this.highSum * this.highSum / n) / n);
        const varFused = Math.max(0, (this.fusedSumSq - this.fusedSum * this.fusedSum / n) / n);
        const stdLow = Math.sqrt(varLow);
        const stdMid = Math.sqrt(varMid);
        const stdHigh = Math.sqrt(varHigh);
        const stdFused = Math.sqrt(varFused);
        this._stats.zLow = stdLow > 1e-6 ? (low - meanLow) / stdLow : 0;
        this._stats.zMid = stdMid > 1e-6 ? (mid - meanMid) / stdMid : 0;
        this._stats.zHigh = stdHigh > 1e-6 ? (high - meanHigh) / stdHigh : 0;
        this._stats.zTotal = stdFused > 1e-6 ? (fused - meanFused) / stdFused : 0;
        // Crest factors: peak / RMS — scan buffer for peak (O(N), zero-alloc)
        const rmsLow = Math.sqrt(this.lowSumSq / n);
        const rmsHigh = Math.sqrt(this.highSumSq / n);
        let peakLow = 0, peakHigh = 0;
        for (let i = 0; i < this.count; i++) {
            if (this.lowBuf[i] > peakLow)
                peakLow = this.lowBuf[i];
            if (this.highBuf[i] > peakHigh)
                peakHigh = this.highBuf[i];
        }
        this._stats.cfLow = rmsLow > 1e-6 ? peakLow / rmsLow : 1;
        this._stats.cfHigh = rmsHigh > 1e-6 ? peakHigh / rmsHigh : 1;
        this._stats.fusedEnergy = fused;
        return this._stats;
    }
    reset() {
        this.lowBuf.fill(0);
        this.midBuf.fill(0);
        this.highBuf.fill(0);
        this.fusedBuf.fill(0);
        this.pos = 0;
        this.count = 0;
        this.lowSum = this.lowSumSq = 0;
        this.midSum = this.midSumSq = 0;
        this.highSum = this.highSumSq = 0;
        this.fusedSum = this.fusedSumSq = 0;
        this._stats.zLow = this._stats.zMid = this._stats.zHigh = this._stats.zTotal = 0;
        this._stats.cfLow = this._stats.cfHigh = 0;
        this._stats.fusedEnergy = 0;
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// 🌊 M-SARFE Phase 1: MultiSpectralSectionTracker
// ═══════════════════════════════════════════════════════════════════════════
// Replaces SimpleSectionTracker. Uses multi-spectral Z-Scores, crest factors,
// and spectral tension to classify sections via multi-criteria scoring.
//
// KEY DIFFERENCES vs SimpleSectionTracker:
// 1. NO blind hold timers (DROP_HOLD_TIME_MS eliminated)
// 2. Multi-criteria scoring: each section type scored against evidence
// 3. Hysteresis: 0.15 stay bonus, 30 frame minimum (not 45)
// 4. Emits SectionEvidence bundle for Main Thread Thermodynamic Veto
// 5. Detects textural_drop (vocal screams, high-freq tension with bass drop)
// 6. Zero allocation: all objects pre-allocated, mutated in place
// ═══════════════════════════════════════════════════════════════════════════
// Static constants — will be moved to vibe profile in future phases
const MSST_STAY_BONUS = 0.15;
const MSST_MIN_FRAMES = 30;
const MSST_SHORT_WINDOW = 64;
const MSST_RECENT_FRAMES = 16;
const MSST_OLDER_FRAMES = 32;
const MSST_CF_THRESHOLD = 4.0;
// Scoring thresholds
const MSST_DROP_Z_LOW = 1.0;
const MSST_DROP_Z_TOTAL = 0.8;
const MSST_DROP_BASS_RATIO = 1.3;
const MSST_DROP_KICK_INTENSITY = 0.3;
const MSST_DROP_ENERGY_DELTA = 0.05;
const MSST_TEXTURAL_Z_HIGH = 1.5;
const MSST_TEXTURAL_CF_HIGH = 5.0;
const MSST_TEXTURAL_Z_LOW = -0.5;
const MSST_TEXTURAL_TENSION = 0.8;
const MSST_TEXTURAL_DIVERGENCE = 2.5;
const MSST_TEXTURAL_Z_MID = 1.0;
const MSST_BUILDUP_DELTA = 0.03;
const MSST_BUILDUP_Z_TOTAL_LOW = -0.5;
const MSST_BUILDUP_Z_TOTAL_HIGH = 1.0;
const MSST_BUILDUP_BASS_RATIO_LOW = 1.05;
const MSST_BUILDUP_BASS_RATIO_HIGH = 1.3;
const MSST_BUILDUP_TENSION = 0.3;
const MSST_BREAKDOWN_DELTA = -0.08;
const MSST_BREAKDOWN_Z_TOTAL = -0.5;
const MSST_BREAKDOWN_Z_LOW = -0.5;
const MSST_BREAKDOWN_TENSION = 0.3;
const MSST_BREAKDOWN_DIVERGENCE = 1.5;
const MSST_CHORUS_Z_TOTAL = 0.5;
const MSST_CHORUS_BASS_RATIO_LOW = 0.85;
const MSST_CHORUS_BASS_RATIO_HIGH = 1.15;
const MSST_CHORUS_BEATS = 16;
const MSST_CHORUS_Z_HIGH = 1.0;
const MSST_CHORUS_TENSION = 0.5;
const MSST_VERSE_Z_TOTAL = 0.8;
const MSST_VERSE_DELTA = 0.03;
const MSST_VERSE_TENSION = 0.2;
const MSST_VERSE_BEATS = 32;
const MSST_SECTION_KEYS = [
    'intro', 'verse', 'buildup', 'chorus', 'drop',
    'textural_drop', 'breakdown', 'bridge', 'outro', 'unknown',
];
export class MultiSpectralSectionTracker {
    constructor() {
        this.energyHistoryPos = 0;
        this.bassHistoryPos = 0;
        this.historyCount = 0;
        this.historySize = MSST_SHORT_WINDOW;
        // State
        this.currentSection = 'verse';
        this.framesInCurrentSection = 0;
        this.beatsSinceChange = 0;
        this.frameCount = 0;
        this.hasHadBuildupOrDrop = false;
        // Vibe (stored for future profile-based weighting)
        this.activeVibeId = 'techno';
        this.bandStats = new TriBandRollingStats();
        this.energyHistory = new Float32Array(MSST_SHORT_WINDOW);
        this.bassHistory = new Float32Array(MSST_SHORT_WINDOW);
        this._evidence = {
            zLow: 0, zMid: 0, zHigh: 0, zTotal: 0,
            cfLow: 0, cfHigh: 0,
            eLow: 0, eMid: 0, eHigh: 0, eTotal: 0,
            spectralTension: 0, spectralDivergence: 0,
            hasKick: false, kickIntensity: 0,
            bpm: 0, beatPhase: 0,
            energyDelta: 0, bassRatio: 0,
        };
        this._output = {
            type: 'verse',
            energy: 0,
            transitionLikelihood: 0,
            beatsSinceChange: 0,
            confidence: 0,
            evidence: this._evidence,
        };
        this._scores = {
            intro: 0, verse: 0, buildup: 0, chorus: 0,
            drop: 0, textural_drop: 0, breakdown: 0,
            bridge: 0, outro: 0, unknown: 0,
        };
    }
    setVibe(vibeId) {
        this.activeVibeId = vibeId;
        console.log(`[MSST] Vibe → ${vibeId}`);
    }
    analyze(audio, rhythm) {
        this.frameCount++;
        this.framesInCurrentSection++;
        // 1. Update long-term band stats (Z-scores, crest factors)
        const stats = this.bandStats.update(audio.bass, audio.mid, audio.treble);
        // 2. Update short-term buffers (energy delta, bass ratio)
        this.energyHistory[this.energyHistoryPos] = audio.volume;
        this.bassHistory[this.bassHistoryPos] = audio.bass;
        this.energyHistoryPos = (this.energyHistoryPos + 1) % this.historySize;
        this.bassHistoryPos = (this.bassHistoryPos + 1) % this.historySize;
        if (this.historyCount < this.historySize)
            this.historyCount++;
        // 3. Beat tracking (frame-based fallback preserved)
        if (audio.onBeat)
            this.beatsSinceChange++;
        if (!audio.onBeat && this.frameCount % 30 === 0)
            this.beatsSinceChange++;
        // 4. Short-term metrics
        const recentEnergy = this.avgRecent(this.energyHistory, this.energyHistoryPos, MSST_RECENT_FRAMES);
        const olderEnergy = this.avgOldest(this.energyHistory, this.energyHistoryPos, MSST_OLDER_FRAMES);
        const recentBass = this.avgRecent(this.bassHistory, this.bassHistoryPos, MSST_RECENT_FRAMES);
        const olderBass = this.avgOldest(this.bassHistory, this.bassHistoryPos, MSST_OLDER_FRAMES) || 0.1;
        const energyDelta = recentEnergy - olderEnergy;
        const bassRatio = recentBass / olderBass;
        // 5. Rhythm data
        const hasKick = rhythm.drums?.kick && rhythm.drums.kickIntensity > 0.3;
        const kickIntensity = rhythm.drums?.kickIntensity ?? 0;
        // 6. Fill evidence object (mutate in place — zero alloc)
        const ev = this._evidence;
        ev.zLow = stats.zLow;
        ev.zMid = stats.zMid;
        ev.zHigh = stats.zHigh;
        ev.zTotal = stats.zTotal;
        ev.cfLow = stats.cfLow;
        ev.cfHigh = stats.cfHigh;
        ev.eLow = audio.bass;
        ev.eMid = audio.mid;
        ev.eHigh = audio.treble;
        ev.eTotal = stats.fusedEnergy;
        ev.spectralTension = this.computeTension(ev);
        ev.spectralDivergence = this.computeDivergence(ev);
        ev.hasKick = hasKick;
        ev.kickIntensity = kickIntensity;
        ev.bpm = audio.bpm;
        ev.beatPhase = audio.beatPhase;
        ev.energyDelta = energyDelta;
        ev.bassRatio = bassRatio;
        // 7. Score all section types (multi-criteria)
        this._scores.intro = this.scoreIntro(ev);
        this._scores.verse = this.scoreVerse(ev);
        this._scores.buildup = this.scoreBuildup(ev);
        this._scores.chorus = this.scoreChorus(ev);
        this._scores.drop = this.scoreDrop(ev);
        this._scores.textural_drop = this.scoreTexturalDrop(ev);
        this._scores.breakdown = this.scoreBreakdown(ev);
        this._scores.bridge = this.scoreBridge(ev);
        this._scores.outro = this.scoreOutro(ev);
        this._scores.unknown = 0;
        // 8. Select winner with hysteresis
        const winner = this.selectWithHysteresis();
        // 9. Compute confidence (winner / (winner + runner-up))
        const confidence = this.computeConfidence(winner);
        // 10. Fill output (mutate in place — zero alloc)
        this._output.type = winner;
        this._output.energy = recentEnergy;
        this._output.transitionLikelihood = Math.min(1, Math.abs(energyDelta) * 2 +
            (rhythm.fillDetected ? 0.4 : 0) +
            (bassRatio > 1.1 && !hasKick ? 0.3 : 0));
        this._output.beatsSinceChange = this.beatsSinceChange;
        this._output.confidence = confidence;
        this._output.evidence = this._evidence;
        // Log transitions
        if (winner !== this.currentSection) {
            console.log(`[MSST] 📍 ${this.currentSection} → ${winner} | ` +
                `zL=${ev.zLow.toFixed(1)} zM=${ev.zMid.toFixed(1)} zH=${ev.zHigh.toFixed(1)} ` +
                `zT=${ev.zTotal.toFixed(1)} T=${ev.spectralTension.toFixed(2)} ` +
                `D=${ev.spectralDivergence.toFixed(2)} cfH=${ev.cfHigh.toFixed(1)}`);
            this.currentSection = winner;
            this.framesInCurrentSection = 0;
        }
        // Periodic diagnostic (~5s)
        if (this.frameCount % 300 === 0) {
            console.log(`[MSST] 📊 section=${this.currentSection} | ` +
                `zL=${ev.zLow.toFixed(1)} zM=${ev.zMid.toFixed(1)} zH=${ev.zHigh.toFixed(1)} ` +
                `zT=${ev.zTotal.toFixed(1)} T=${ev.spectralTension.toFixed(2)} ` +
                `D=${ev.spectralDivergence.toFixed(2)} cfH=${ev.cfHigh.toFixed(1)} ` +
                `bassR=${ev.bassRatio.toFixed(2)} ΔE=${ev.energyDelta.toFixed(3)} kick=${ev.hasKick}`);
        }
        return this._output;
    }
    // ── Composite metrics (pure math, operate on evidence) ────────────────
    computeTension(ev) {
        const sigmoid = (x) => 1 / (1 + Math.exp(-x));
        return (Math.max(0, ev.zHigh) * sigmoid(ev.cfHigh - MSST_CF_THRESHOLD) +
            Math.max(0, -ev.zLow) * 0.5 +
            Math.max(0, ev.zMid - ev.zLow) * 0.3);
    }
    computeDivergence(ev) {
        return Math.abs(ev.zLow - ev.zHigh) + Math.abs(ev.zMid - (ev.zLow + ev.zHigh) / 2);
    }
    // ── Section scorers (multi-criteria, normalized to [0, 1]) ────────────
    scoreDrop(ev) {
        let s = 0;
        if (ev.zLow > MSST_DROP_Z_LOW)
            s++;
        if (ev.zTotal > MSST_DROP_Z_TOTAL)
            s++;
        if (ev.bassRatio > MSST_DROP_BASS_RATIO)
            s++;
        if (ev.hasKick)
            s++;
        if (ev.kickIntensity > MSST_DROP_KICK_INTENSITY)
            s++;
        if (ev.energyDelta > MSST_DROP_ENERGY_DELTA)
            s++;
        return s / 6;
    }
    scoreTexturalDrop(ev) {
        let s = 0;
        if (ev.zHigh > MSST_TEXTURAL_Z_HIGH)
            s++;
        if (ev.cfHigh > MSST_TEXTURAL_CF_HIGH)
            s++;
        if (ev.zLow < MSST_TEXTURAL_Z_LOW)
            s++;
        if (ev.spectralTension > MSST_TEXTURAL_TENSION)
            s++;
        if (ev.spectralDivergence > MSST_TEXTURAL_DIVERGENCE)
            s++;
        if (ev.zMid > MSST_TEXTURAL_Z_MID)
            s += 0.5;
        return Math.min(1, s / 5.5);
    }
    scoreBuildup(ev) {
        let s = 0;
        if (ev.energyDelta > MSST_BUILDUP_DELTA)
            s++;
        if (ev.zTotal > MSST_BUILDUP_Z_TOTAL_LOW && ev.zTotal < MSST_BUILDUP_Z_TOTAL_HIGH)
            s++;
        if (ev.bassRatio > MSST_BUILDUP_BASS_RATIO_LOW && ev.bassRatio < MSST_BUILDUP_BASS_RATIO_HIGH)
            s++;
        if (ev.spectralTension > MSST_BUILDUP_TENSION)
            s += 0.5;
        if (!ev.hasKick || ev.kickIntensity < 0.5)
            s++;
        return s / 4.5;
    }
    scoreBreakdown(ev) {
        let s = 0;
        if (ev.energyDelta < MSST_BREAKDOWN_DELTA)
            s++;
        if (ev.zTotal < MSST_BREAKDOWN_Z_TOTAL)
            s++;
        if (ev.zLow < MSST_BREAKDOWN_Z_LOW)
            s++;
        if (ev.spectralTension < MSST_BREAKDOWN_TENSION)
            s++;
        if (ev.spectralDivergence < MSST_BREAKDOWN_DIVERGENCE)
            s++;
        return s / 5;
    }
    scoreChorus(ev) {
        let s = 0;
        if (ev.zTotal > MSST_CHORUS_Z_TOTAL)
            s++;
        if (ev.bassRatio > MSST_CHORUS_BASS_RATIO_LOW && ev.bassRatio < MSST_CHORUS_BASS_RATIO_HIGH)
            s++;
        if (this.beatsSinceChange > MSST_CHORUS_BEATS)
            s++;
        if (ev.spectralTension < MSST_CHORUS_TENSION)
            s++;
        if (ev.zHigh < MSST_CHORUS_Z_HIGH)
            s++;
        return s / 5;
    }
    scoreVerse(ev) {
        let s = 0.3; // Base score — verse is the default
        if (Math.abs(ev.zTotal) < MSST_VERSE_Z_TOTAL)
            s++;
        if (Math.abs(ev.energyDelta) < MSST_VERSE_DELTA)
            s++;
        if (ev.spectralTension < MSST_VERSE_TENSION)
            s++;
        if (this.beatsSinceChange > MSST_VERSE_BEATS)
            s++;
        return Math.min(1, s / 4.3);
    }
    scoreIntro(ev) {
        if (!this.hasHadBuildupOrDrop && this.frameCount < 150 && ev.eTotal < 0.30)
            return 1.0;
        return 0;
    }
    scoreBridge(ev) {
        if (ev.zTotal > -0.3 && ev.zTotal < 0.3 && Math.abs(ev.energyDelta) < 0.02)
            return 0.4;
        return 0;
    }
    scoreOutro(ev) {
        if (this.hasHadBuildupOrDrop && ev.energyDelta < -0.05 && ev.zTotal < -0.3)
            return 0.6;
        return 0;
    }
    // ── Hysteresis (no blind hold timers — just a stay bonus) ─────────────
    selectWithHysteresis() {
        // Too early to transition — stay in current section
        if (this.framesInCurrentSection < MSST_MIN_FRAMES) {
            return this.currentSection;
        }
        // Apply stay bonus to current section (temporary mutation, restored after)
        if (this.currentSection !== 'unknown') {
            this._scores[this.currentSection] += MSST_STAY_BONUS;
        }
        // Find winner
        let winner = 'verse';
        let maxScore = -1;
        for (let i = 0; i < MSST_SECTION_KEYS.length; i++) {
            const key = MSST_SECTION_KEYS[i];
            const score = this._scores[key];
            if (score > maxScore) {
                maxScore = score;
                winner = key;
            }
        }
        // Restore original score (remove stay bonus)
        if (this.currentSection !== 'unknown') {
            this._scores[this.currentSection] -= MSST_STAY_BONUS;
        }
        // Track buildup/drop occurrence for intro/outro detection
        if (winner === 'buildup' || winner === 'drop' || winner === 'textural_drop') {
            this.hasHadBuildupOrDrop = true;
        }
        return winner;
    }
    computeConfidence(winner) {
        const winnerScore = this._scores[winner];
        let runnerUpScore = 0;
        for (let i = 0; i < MSST_SECTION_KEYS.length; i++) {
            const key = MSST_SECTION_KEYS[i];
            if (key !== winner) {
                const score = this._scores[key];
                if (score > runnerUpScore)
                    runnerUpScore = score;
            }
        }
        if (winnerScore + runnerUpScore < 1e-6)
            return 0;
        return Math.min(1, winnerScore / (winnerScore + runnerUpScore));
    }
    // ── Short-term buffer helpers (zero-alloc circular reads) ─────────────
    avgRecent(buf, pos, n) {
        if (this.historyCount === 0)
            return 0;
        const count = Math.min(n, this.historyCount);
        let sum = 0;
        for (let i = 0; i < count; i++) {
            const idx = (pos - 1 - i + this.historySize * 2) % this.historySize;
            sum += buf[idx];
        }
        return sum / count;
    }
    avgOldest(buf, pos, n) {
        if (this.historyCount === 0)
            return 0;
        const count = Math.min(n, this.historyCount);
        let sum = 0;
        const oldestPos = this.historyCount >= this.historySize ? pos : 0;
        for (let i = 0; i < count; i++) {
            const idx = (oldestPos + i) % this.historySize;
            sum += buf[idx];
        }
        return sum / count;
    }
    reset() {
        this.bandStats.reset();
        this.energyHistory.fill(0);
        this.bassHistory.fill(0);
        this.energyHistoryPos = 0;
        this.bassHistoryPos = 0;
        this.historyCount = 0;
        this.currentSection = 'verse';
        this.beatsSinceChange = 0;
        this.frameCount = 0;
        this.framesInCurrentSection = 0;
        this.hasHadBuildupOrDrop = false;
    }
}
// �️ WAVE 61: SimpleBinaryBias ELIMINADO
// La detección automática de género fue reemplazada por VibeManager.
// El DJ selecciona el contexto manualmente. Selene opera dentro de ese contexto.
/**
 * Simplified palette generator for workers
 * 🌊 WAVE 12.5: SELENE LIBRE - Colores de matemática pura
 * La música HABLA a través de sus números, no de etiquetas.
 *
 * @deprecated WAVE 17.2 - Reemplazado por SeleneColorEngine
 * Esta clase permanece SOLO para compatibilidad con createReactiveDecision (modo fallback).
 * Para modo INTELLIGENT, usa SeleneColorEngine directamente.
 */
export class SimplePaletteGenerator {
    generate(mood, energy, syncopation, key, uiPalette // Solo si el USUARIO elige manualmente
    ) {
        // 🎯 MAPEO DIRECTO SOLO SI EL USUARIO ELIGIÓ MANUALMENTE
        const uiMap = uiPalette ? SimplePaletteGenerator.UI_PALETTE_MAP[uiPalette.toLowerCase()] : null;
        let baseHue;
        let accentHue;
        let secondaryHue;
        if (uiMap) {
            // PALETA MANUAL: El usuario eligió una paleta específica
            baseHue = uiMap.primaryHue;
            accentHue = uiMap.accentHue;
            secondaryHue = uiMap.secondaryHue;
        }
        else if (key && SimplePaletteGenerator.KEY_TO_HUE[key] !== undefined) {
            // 🌊 WAVE 12.5: COLOR DESDE LA ARMONÍA (Key musical)
            // La tonalidad de la música determina el tono base
            baseHue = SimplePaletteGenerator.KEY_TO_HUE[key];
            // 🌊 SYNCOPATION modula el contraste del accent
            // Alta syncopation (latino) → Colores complementarios (máximo contraste)
            // Baja syncopation (electrónico) → Colores análogos (menor contraste)
            const contrastAngle = 90 + syncopation * 90; // 90° a 180° según syncopation
            accentHue = (baseHue + contrastAngle) % 360;
            secondaryHue = (baseHue + 30 + syncopation * 30) % 360;
        }
        else {
            // 🌊 WAVE 12.5: Mood-based hue con MODULACIÓN por syncopation
            const moodHues = {
                happy: 45, // Orange
                sad: 220, // Blue
                tense: 0, // Red
                dreamy: 280, // Purple
                bluesy: 30, // Warm orange
                jazzy: 260, // Purple-blue
                spanish_exotic: 15, // Red-orange
                universal: 120, // Green
            };
            baseHue = moodHues[mood] ?? 120;
            // Syncopation modula hacia dónde va el accent
            const contrastAngle = 90 + syncopation * 90;
            accentHue = (baseHue + contrastAngle) % 360;
            secondaryHue = (baseHue + 30 + syncopation * 30) % 360;
        }
        // Strategy based on energy
        const strategy = energy > 0.7 ? 'complementary' :
            energy > 0.4 ? 'triadic' :
                'analogous';
        // 🌊 WAVE 12.5: ENERGY → SATURACIÓN (más energía = más saturado)
        // 🌊 WAVE 12.5: SYNCOPATION → LIGHTNESS VARIATION (más sync = más contraste)
        const MIN_SATURATION = 70;
        const MIN_LIGHTNESS = 45;
        // Energy impulsa la saturación: E=0.3 → S=85%, E=0.9 → S=100%
        const baseSaturation = Math.max(MIN_SATURATION, 70 + energy * 30);
        // Energy también impulsa la luz: E=0.3 → L=50%, E=0.9 → L=70%
        const baseLightness = Math.max(MIN_LIGHTNESS, 45 + energy * 25);
        // PRIMARY (PARs) - Color base vibrante modulado por ENERGY
        const primary = {
            h: baseHue,
            s: baseSaturation,
            l: baseLightness
        };
        // SECONDARY - Variación del primary
        const secondary = {
            h: secondaryHue,
            s: Math.max(MIN_SATURATION, baseSaturation - 5),
            l: Math.max(MIN_LIGHTNESS, baseLightness - 5)
        };
        // � ACCENT (Moving Heads) - SYNCOPATION controla el contraste
        // Alta syncopation = accent MÁS brillante y saturado
        const accentBoost = 15 + syncopation * 15; // 15-30% boost según syncopation
        const accent = {
            h: accentHue,
            s: 100, // Siempre saturación máxima
            l: Math.max(55, baseLightness + accentBoost)
        };
        const ambient = {
            h: baseHue,
            s: Math.max(60, baseSaturation * 0.7),
            l: Math.max(40, baseLightness * 0.8)
        };
        const contrast = {
            h: (baseHue + 180) % 360,
            s: 40,
            l: 75
        };
        // 🌊 WAVE 12.5: Description muestra la matemática pura
        const mathDescription = `E:${energy.toFixed(2)} S:${syncopation.toFixed(2)} K:${key ?? mood}`;
        return {
            primary,
            secondary,
            accent,
            ambient,
            contrast,
            metadata: {
                strategy,
                transitionSpeed: energy > 0.7 ? 100 : 300,
                confidence: 0.8,
                description: uiPalette ? `UI:${uiPalette}` : mathDescription,
            },
        };
    }
}
/**
 * Circle of Fifths → Chromatic Circle mapping
 * C=0° (Red), G=210°, D=60°, etc.
 */
SimplePaletteGenerator.KEY_TO_HUE = {
    'C': 0, 'G': 210, 'D': 60, 'A': 270, 'E': 120,
    'B': 330, 'F#': 180, 'Db': 30, 'Ab': 240, 'Eb': 90,
    'Bb': 300, 'F': 150,
};
/**
 * 🌊 WAVE 12.5: UI_PALETTE_MAP mantenido solo para cuando el USUARIO
 * elige manualmente una paleta. Selene ya no fuerza paletas por género.
 */
SimplePaletteGenerator.UI_PALETTE_MAP = {
    'fuego': { primaryHue: 10, accentHue: 52, secondaryHue: 0 },
    'selva': { primaryHue: 120, accentHue: 320, secondaryHue: 90 },
    'hielo': { primaryHue: 210, accentHue: 185, secondaryHue: 240 },
    'neon': { primaryHue: 300, accentHue: 180, secondaryHue: 330 },
};

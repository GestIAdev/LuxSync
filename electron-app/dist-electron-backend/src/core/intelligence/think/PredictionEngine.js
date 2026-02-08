// ═══════════════════════════════════════════════════════════════════════════
//  🔮 PREDICTION ENGINE - El Oráculo Musical
// ═══════════════════════════════════════════════════════════════════════════
//  WAVE 500 - PROJECT GENESIS - PHASE 3
//  "Predice el futuro analizando el pasado"
// ═══════════════════════════════════════════════════════════════════════════
const PROGRESSION_PATTERNS = [
    // Buildup prolongado → Drop inminente (90%)
    {
        trigger: ['buildup', 'buildup'],
        nextSection: 'drop',
        probability: 0.90,
        predictionType: 'drop_incoming',
        actions: [
            { type: 'prepare', effect: 'intensity_ramp', intensity: 0.8, durationMs: 2000, timingOffsetMs: -2000 },
            { type: 'execute', effect: 'flash', intensity: 1.0, durationMs: 200, timingOffsetMs: 0 },
            { type: 'recover', effect: 'strobe', intensity: 0.9, durationMs: 4000, timingOffsetMs: 200 },
        ],
    },
    // Buildup simple → Drop probable (75%)
    {
        trigger: ['buildup'],
        nextSection: 'drop',
        probability: 0.75,
        predictionType: 'drop_incoming',
        actions: [
            { type: 'prepare', effect: 'intensity_ramp', intensity: 0.6, durationMs: 1500, timingOffsetMs: -1500 },
            { type: 'execute', effect: 'flash', intensity: 1.0, durationMs: 150, timingOffsetMs: 0 },
        ],
    },
    // Verse + Buildup → Chorus probable (85%)
    {
        trigger: ['verse', 'buildup'],
        nextSection: 'chorus',
        probability: 0.85,
        predictionType: 'transition_beat',
        actions: [
            { type: 'prepare', effect: 'color_shift', intensity: 0.5, durationMs: 1000, timingOffsetMs: -1000 },
            { type: 'execute', effect: 'pulse', intensity: 0.8, durationMs: 500, timingOffsetMs: 0 },
        ],
    },
    // Chorus doble → Verse/Breakdown probable (70%)
    {
        trigger: ['chorus', 'chorus'],
        nextSection: 'verse',
        probability: 0.70,
        predictionType: 'transition_beat',
        actions: [
            { type: 'prepare', effect: 'breathe', intensity: 0.6, durationMs: 800, timingOffsetMs: -800 },
        ],
    },
    // Drop doble → Breakdown probable (75%)
    {
        trigger: ['drop', 'drop'],
        nextSection: 'breakdown',
        probability: 0.75,
        predictionType: 'breakdown_imminent',
        actions: [
            { type: 'execute', effect: 'intensity_ramp', intensity: 0.3, durationMs: 2000, timingOffsetMs: 0 },
            { type: 'recover', effect: 'breathe', intensity: 0.4, durationMs: 3000, timingOffsetMs: 2000 },
        ],
    },
    // Breakdown → Buildup probable (80%)
    {
        trigger: ['breakdown'],
        nextSection: 'buildup',
        probability: 0.80,
        predictionType: 'buildup_starting',
        actions: [
            { type: 'prepare', effect: 'color_shift', intensity: 0.4, durationMs: 500, timingOffsetMs: -500 },
            { type: 'execute', effect: 'intensity_ramp', intensity: 0.5, durationMs: 2000, timingOffsetMs: 0 },
        ],
    },
    // Intro → Verse probable (85%)
    {
        trigger: ['intro'],
        nextSection: 'verse',
        probability: 0.85,
        predictionType: 'transition_beat',
        actions: [
            { type: 'execute', effect: 'pulse', intensity: 0.6, durationMs: 300, timingOffsetMs: 0 },
        ],
    },
    // Verse doble → Buildup probable (65%)
    {
        trigger: ['verse', 'verse'],
        nextSection: 'buildup',
        probability: 0.65,
        predictionType: 'buildup_starting',
        actions: [
            { type: 'prepare', effect: 'intensity_ramp', intensity: 0.4, durationMs: 1000, timingOffsetMs: -1000 },
        ],
    },
];
const MAX_HISTORY = 8;
let sectionHistory = [];
let lastPrediction = null;
// ═══════════════════════════════════════════════════════════════════════════
// FUNCIONES PÚBLICAS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Genera predicción basada en el patrón actual y historial
 *
 * @param pattern - Patrón musical actual
 * @returns Predicción musical
 */
export function predict(pattern) {
    const timestamp = pattern.timestamp;
    // Actualizar historial si cambió de sección
    updateHistory(pattern);
    // Buscar patrones de progresión que matcheen
    const matchedPattern = findMatchingPattern();
    if (matchedPattern) {
        // Calcular timing basado en BPM
        const beatsToEvent = estimateBeatsToEvent(pattern, matchedPattern);
        const msPerBeat = 60000 / pattern.bpm;
        const estimatedTimeMs = beatsToEvent * msPerBeat;
        // Ajustar probabilidad por contexto
        const adjustedProbability = adjustProbabilityByContext(matchedPattern.probability, pattern);
        const prediction = {
            type: matchedPattern.predictionType,
            probableSection: matchedPattern.nextSection,
            probability: adjustedProbability,
            estimatedTimeMs,
            estimatedBeats: beatsToEvent,
            reasoning: buildReasoning(matchedPattern, pattern),
            suggestedActions: matchedPattern.actions,
            timestamp,
        };
        lastPrediction = prediction;
        return prediction;
    }
    // Sin predicción clara
    const noPrediction = {
        type: 'none',
        probableSection: null,
        probability: 0,
        estimatedTimeMs: 0,
        estimatedBeats: 0,
        reasoning: 'No hay patrón de progresión reconocido',
        suggestedActions: [],
        timestamp,
    };
    lastPrediction = noPrediction;
    return noPrediction;
}
/**
 * Obtiene la última predicción
 */
export function getLastPrediction() {
    return lastPrediction;
}
/**
 * Obtiene el historial de secciones
 */
export function getSectionHistory() {
    return sectionHistory;
}
/**
 * Verifica si una predicción previa fue correcta
 * (para aprendizaje futuro)
 */
export function validatePrediction(prediction, actualSection) {
    return prediction.probableSection === actualSection;
}
/**
 * Resetea el estado de predicción
 */
export function resetPredictionEngine() {
    sectionHistory = [];
    lastPrediction = null;
    energyHistory = []; // 🔮 WAVE 1169: Reset energy history too
}
// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════
function updateHistory(pattern) {
    const currentSection = pattern.section;
    // Si el historial está vacío o cambió de sección
    if (sectionHistory.length === 0 ||
        sectionHistory[sectionHistory.length - 1].section !== currentSection) {
        // Calcular duración de la sección anterior
        if (sectionHistory.length > 0) {
            const lastEntry = sectionHistory[sectionHistory.length - 1];
            lastEntry.durationMs = pattern.timestamp - lastEntry.timestamp;
        }
        // Agregar nueva entrada
        sectionHistory.push({
            section: currentSection,
            timestamp: pattern.timestamp,
            durationMs: 0, // Se calculará cuando termine la sección
            energyLevel: pattern.rhythmicIntensity,
        });
        // Mantener tamaño máximo
        if (sectionHistory.length > MAX_HISTORY) {
            sectionHistory.shift();
        }
    }
}
function findMatchingPattern() {
    if (sectionHistory.length === 0)
        return null;
    // Ordenar patrones por longitud de trigger (más específicos primero)
    const sortedPatterns = [...PROGRESSION_PATTERNS].sort((a, b) => b.trigger.length - a.trigger.length);
    // Buscar match
    for (const pattern of sortedPatterns) {
        if (matchesTrigger(pattern.trigger)) {
            return pattern;
        }
    }
    return null;
}
function matchesTrigger(trigger) {
    if (trigger.length > sectionHistory.length)
        return false;
    // Comparar últimas N secciones con el trigger
    const recentSections = sectionHistory.slice(-trigger.length);
    for (let i = 0; i < trigger.length; i++) {
        if (recentSections[i].section !== trigger[i]) {
            return false;
        }
    }
    return true;
}
function estimateBeatsToEvent(pattern, matchedPattern) {
    // Estimación basada en tipo de predicción
    switch (matchedPattern.predictionType) {
        case 'drop_incoming':
            // Drops suelen venir en 4-8 beats
            return pattern.isBuilding ? 4 : 8;
        case 'buildup_starting':
            // Buildups empiezan en 2-4 beats
            return 4;
        case 'breakdown_imminent':
            // Breakdowns en 8-16 beats
            return 8;
        case 'transition_beat':
            // Transiciones en 4 beats
            return 4;
        default:
            return 8;
    }
}
function adjustProbabilityByContext(baseProbability, pattern) {
    let adjusted = baseProbability;
    // Si la energía está subiendo, aumentar probabilidad de predicción
    if (pattern.isBuilding) {
        adjusted *= 1.1;
    }
    // Si la tensión es alta, aumentar probabilidad
    if (pattern.emotionalTension > 0.7) {
        adjusted *= 1.05;
    }
    // Si hay mucha sincopación, puede ser menos predecible
    if (pattern.syncopation > 0.7) {
        adjusted *= 0.95;
    }
    return Math.min(1, Math.max(0, adjusted));
}
function buildReasoning(matchedPattern, pattern) {
    const triggerStr = matchedPattern.trigger.join(' → ');
    const prob = (matchedPattern.probability * 100).toFixed(0);
    let reason = `Patrón [${triggerStr}] detectado → ${matchedPattern.nextSection} (${prob}%)`;
    if (pattern.isBuilding) {
        reason += ', energía subiendo';
    }
    if (pattern.emotionalTension > 0.7) {
        reason += ', alta tensión';
    }
    return reason;
}
// ═══════════════════════════════════════════════════════════════════════════
// 🔮 WAVE 1169/1172: REACTIVE ENERGY PREDICTION
// "No dependas de etiquetas, lee la energía bruta"
// 
// WAVE 1172 TUNING: Oráculo más sensible
// - Spike threshold: 0.85 → 0.70
// - Drop detection: tension > 0.5 (was 0.6)
// - Rising energy feedback visible
// ═══════════════════════════════════════════════════════════════════════════
/** Historial de energía para detección de tendencias */
const MAX_ENERGY_HISTORY = 30; // ~0.5 segundos a 60fps
let energyHistory = [];
/** 🔮 WAVE 1172: Umbrales calibrados para mayor sensibilidad */
/** 🎯 WAVE 1176: OPERATION SNIPER - Sensibilidad x10 */
const ENERGY_THRESHOLDS = {
    SPIKE_DELTA: 0.08, // 🎯 WAVE 1176: Era 0.12, ahora x10 sensibilidad
    RISING_DELTA: 0.015, // 🎯 WAVE 1176: Era 0.04, detecta subidas sutiles
    FALLING_DELTA: -0.02, // 🎯 WAVE 1176: Era -0.06, detecta caídas antes
    MIN_ENERGY_FOR_RISING: 0.25, // 🎯 WAVE 1176: Era 0.35, activa mucho antes
    MIN_ENERGY_FOR_SPIKE: 0.60, // 🎯 WAVE 1176: Era 0.70, más sensible
    TENSION_FOR_DROP: 0.4, // 🎯 WAVE 1176: Era 0.5, más sensible
};
/**
 * Actualiza el historial de energía
 */
function updateEnergyHistory(energy) {
    energyHistory.push(energy);
    if (energyHistory.length > MAX_ENERGY_HISTORY) {
        energyHistory.shift();
    }
}
/**
 * Calcula la tendencia de energía (derivada suavizada)
 * 🔮 WAVE 1172: Usa umbrales calibrados
 * @returns 'rising' | 'falling' | 'stable' | 'spike'
 */
function calculateEnergyTrend() {
    if (energyHistory.length < 10)
        return 'stable';
    const recent = energyHistory.slice(-10);
    const older = energyHistory.slice(-20, -10);
    if (older.length < 5)
        return 'stable';
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    const delta = recentAvg - olderAvg;
    // 🔮 WAVE 1172: Umbrales más sensibles
    if (delta > ENERGY_THRESHOLDS.SPIKE_DELTA)
        return 'spike';
    if (delta > ENERGY_THRESHOLDS.RISING_DELTA)
        return 'rising';
    if (delta < ENERGY_THRESHOLDS.FALLING_DELTA)
        return 'falling';
    return 'stable';
}
/**
 * Calcula la velocidad de subida de energía (para estimar tiempo hasta pico)
 * @returns Velocidad de energía por frame (0-1 scale)
 */
function calculateEnergyVelocity() {
    if (energyHistory.length < 5)
        return 0;
    const recent = energyHistory.slice(-5);
    const velocities = [];
    for (let i = 1; i < recent.length; i++) {
        velocities.push(recent[i] - recent[i - 1]);
    }
    return velocities.reduce((a, b) => a + b, 0) / velocities.length;
}
/**
 * 🔮 WAVE 1169/1172: REACTIVE PREDICTION
 * Predice basándose en TENDENCIA DE ENERGÍA BRUTA, no en etiquetas de sección.
 *
 * WAVE 1172: Umbrales más bajos para feedback visual más activo
 * - Spike threshold: 0.70 (was 0.85)
 * - Tension for drop: 0.5 (was 0.6)
 *
 * @param pattern - Patrón musical actual
 * @param currentEnergy - Energía actual (0-1)
 * @param bpm - BPM actual
 * @returns Predicción reactiva basada en energía
 */
export function predictFromEnergy(pattern, currentEnergy, bpm = 120) {
    const timestamp = Date.now();
    // Actualizar historial
    updateEnergyHistory(currentEnergy);
    const trend = calculateEnergyTrend();
    const velocity = calculateEnergyVelocity();
    // ═══════════════════════════════════════════════════════════════════════
    // SPIKE DETECTION: Energía subiendo MUY rápido → Algo grande viene
    // WAVE 1172: Umbral bajado a 0.70
    // ═══════════════════════════════════════════════════════════════════════
    if (trend === 'spike' && currentEnergy >= ENERGY_THRESHOLDS.MIN_ENERGY_FOR_SPIKE) {
        // Estimar tiempo hasta pico basado en velocidad y energía actual
        const remainingEnergy = 1 - currentEnergy;
        const framesUntilPeak = velocity > 0 ? Math.ceil(remainingEnergy / velocity) : 60;
        const msPerBeat = 60000 / bpm;
        const beatsUntilPeak = Math.max(2, Math.round((framesUntilPeak / 60) * (bpm / 60)));
        return {
            type: 'energy_spike',
            probableSection: 'drop',
            probability: 0.75 + (velocity * 2), // Mayor velocidad = mayor certeza
            estimatedTimeMs: beatsUntilPeak * msPerBeat,
            estimatedBeats: beatsUntilPeak,
            reasoning: `⚡ ENERGY SPIKE: +${(velocity * 100).toFixed(1)}%/frame → Peak en ~${beatsUntilPeak} beats`,
            suggestedActions: [
                { type: 'prepare', effect: 'intensity_ramp', intensity: 0.8, durationMs: 1500, timingOffsetMs: -1500 },
                { type: 'execute', effect: 'flash', intensity: 1.0, durationMs: 200, timingOffsetMs: 0 },
            ],
            timestamp,
        };
    }
    // ═══════════════════════════════════════════════════════════════════════
    // RISING ENERGY: Subida sostenida → Buildup probable
    // WAVE 1172: Umbral bajado a 0.35
    // ═══════════════════════════════════════════════════════════════════════
    if (trend === 'rising' && currentEnergy > ENERGY_THRESHOLDS.MIN_ENERGY_FOR_RISING) {
        const msPerBeat = 60000 / bpm;
        const estimatedBeats = Math.round(8 - (currentEnergy * 4)); // Menos beats cuanto más alta la energía
        return {
            type: 'buildup_starting',
            probableSection: 'buildup',
            probability: 0.55 + (currentEnergy * 0.2), // 55-75% según energía
            estimatedTimeMs: estimatedBeats * msPerBeat,
            estimatedBeats,
            reasoning: `📈 RISING ENERGY: ${(currentEnergy * 100).toFixed(0)}% y subiendo → Buildup detectado`,
            suggestedActions: [
                { type: 'prepare', effect: 'intensity_ramp', intensity: 0.5, durationMs: 2000, timingOffsetMs: -2000 },
            ],
            timestamp,
        };
    }
    // ═══════════════════════════════════════════════════════════════════════
    // 🔮 WAVE 1172: RISING pero bajo umbral → Mostrar "ENERGY BUILDING"
    // UI Feedback activo aunque no haya predicción fuerte
    // ═══════════════════════════════════════════════════════════════════════
    if (trend === 'rising') {
        return {
            type: 'buildup_starting',
            probableSection: null,
            probability: 0.35 + (currentEnergy * 0.15), // 35-50% - bajo pero visible
            estimatedTimeMs: 8000,
            estimatedBeats: 8,
            reasoning: `⚠️ ENERGY BUILDING: ${(currentEnergy * 100).toFixed(0)}% | Trend: Rising`,
            suggestedActions: [],
            timestamp,
        };
    }
    // ═══════════════════════════════════════════════════════════════════════
    // DROP DETECTION: Tensión alta + energía cayendo → Drop incoming
    // WAVE 1172: Umbral de tensión bajado a 0.5
    // ═══════════════════════════════════════════════════════════════════════
    if (pattern.emotionalTension > ENERGY_THRESHOLDS.TENSION_FOR_DROP && trend === 'falling') {
        return {
            type: 'drop_incoming',
            probableSection: 'drop',
            probability: 0.60 + (pattern.emotionalTension * 0.2),
            estimatedTimeMs: 4000,
            estimatedBeats: 4,
            reasoning: `🎯 DROP INCOMING: Tension ${(pattern.emotionalTension * 100).toFixed(0)}% + Energy falling`,
            suggestedActions: [
                { type: 'prepare', effect: 'intensity_ramp', intensity: 0.7, durationMs: 2000, timingOffsetMs: -2000 },
                { type: 'execute', effect: 'flash', intensity: 1.0, durationMs: 150, timingOffsetMs: 0 },
            ],
            timestamp,
        };
    }
    // ═══════════════════════════════════════════════════════════════════════
    // FALLING ENERGY: Bajando → Recovery/Breakdown
    // ═══════════════════════════════════════════════════════════════════════
    if (trend === 'falling' && currentEnergy < 0.5) {
        return {
            type: 'energy_drop',
            probableSection: 'breakdown',
            probability: 0.50,
            estimatedTimeMs: 4000,
            estimatedBeats: 8,
            reasoning: `📉 FALLING ENERGY: ${(currentEnergy * 100).toFixed(0)}% y bajando → Recovery mode`,
            suggestedActions: [
                { type: 'recover', effect: 'breathe', intensity: 0.4, durationMs: 3000, timingOffsetMs: 0 },
            ],
            timestamp,
        };
    }
    // ═══════════════════════════════════════════════════════════════════════
    // STABLE: Sin cambio significativo → Analizar flow
    // ═══════════════════════════════════════════════════════════════════════
    return {
        type: 'none',
        probableSection: null,
        probability: 0,
        estimatedTimeMs: 0,
        estimatedBeats: 0,
        reasoning: `🌊 STABLE FLOW: ${(currentEnergy * 100).toFixed(0)}% | Analyzing...`,
        suggestedActions: [],
        timestamp,
    };
}
/**
 * 🔮 WAVE 1169: Combined Prediction
 * 🔮 WAVE 1190: PROJECT CASSANDRA - Integración de Spectral Buildup
 *
 * Combina predicción por sección + predicción por energía + spectral buildup
 * El spectral buildup detecta FÍSICAMENTE el buildup en el audio:
 * - Rising rolloff (brillo sube)
 * - Rising flatness (ruido blanco sube)
 * - Falling subbass (el bajo desaparece antes del drop)
 *
 * @param pattern - Patrón musical actual
 * @param currentEnergy - Energía actual (0-1)
 * @param spectralBuildupScore - Score de buildup espectral (0-1) desde SectionTracker
 */
export function predictCombined(pattern, currentEnergy, spectralBuildupScore) {
    // Predicción tradicional por sección
    const sectionPrediction = predict(pattern);
    // Predicción reactiva por energía
    const energyPrediction = predictFromEnergy(pattern, currentEnergy, pattern.bpm);
    // ═══════════════════════════════════════════════════════════════════════════
    // 🔮 WAVE 1190: PROJECT CASSANDRA - Spectral Buildup Boost
    // 
    // Si detectamos buildup espectral FÍSICO (>0.4), SABEMOS que viene algo.
    // Esto NO es heurística, es análisis real del espectro de frecuencias.
    // El sonido LITERALMENTE está cambiando hacia un buildup.
    // ═══════════════════════════════════════════════════════════════════════════
    const spectralScore = spectralBuildupScore ?? 0;
    let bestPrediction = energyPrediction.probability > sectionPrediction.probability
        ? energyPrediction
        : sectionPrediction;
    // Si spectral buildup > 0.4, BOOST a la predicción
    if (spectralScore > 0.4) {
        // Si ya estamos prediciendo buildup/drop, aumentar probabilidad
        if (bestPrediction.type === 'buildup_starting' ||
            bestPrediction.type === 'drop_incoming' ||
            bestPrediction.type === 'energy_spike') {
            // Boost proporcional al score espectral
            const spectralBoost = (spectralScore - 0.4) * 0.5; // Max +0.3 para score=1.0
            bestPrediction = {
                ...bestPrediction,
                probability: Math.min(0.95, bestPrediction.probability + spectralBoost),
                reasoning: `${bestPrediction.reasoning} | 🔊 SPECTRAL BUILDUP: ${(spectralScore * 100).toFixed(0)}%`,
            };
        }
        else if (spectralScore > 0.6) {
            // Spectral buildup fuerte pero no estamos prediciendo buildup/drop
            // CREAR una predicción de buildup desde cero
            const msPerBeat = 60000 / pattern.bpm;
            const estimatedBeats = 4 + (1 - spectralScore) * 4; // 4-8 beats según score
            bestPrediction = {
                type: 'buildup_starting',
                probableSection: 'buildup',
                probability: spectralScore * 0.85, // El spectral score ES la probabilidad
                estimatedTimeMs: estimatedBeats * msPerBeat,
                estimatedBeats,
                reasoning: `🔊 SPECTRAL BUILDUP DETECTED: Rolloff↑ Flatness↑ SubBass↓ (${(spectralScore * 100).toFixed(0)}%)`,
                suggestedActions: [
                    { type: 'prepare', effect: 'intensity_ramp', intensity: 0.6, durationMs: 2000, timingOffsetMs: -2000 },
                    { type: 'execute', effect: 'strobe', intensity: 0.9, durationMs: 500, timingOffsetMs: 0 },
                ],
                timestamp: pattern.timestamp,
            };
        }
    }
    return bestPrediction;
}
/**
 * Obtiene el estado del historial de energía (para debug)
 */
export function getEnergyPredictionState() {
    return {
        historyLength: energyHistory.length,
        trend: calculateEnergyTrend(),
        velocity: calculateEnergyVelocity(),
    };
}
/**
 * Reset del historial de energía (para tests)
 */
export function resetEnergyHistory() {
    energyHistory = [];
}

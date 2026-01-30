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

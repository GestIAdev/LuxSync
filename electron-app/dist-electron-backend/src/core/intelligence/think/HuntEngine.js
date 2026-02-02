// ═══════════════════════════════════════════════════════════════════════════
//  🐆 HUNT ENGINE - El Instinto del Cazador
// ═══════════════════════════════════════════════════════════════════════════
//  WAVE 500 - PROJECT GENESIS - PHASE 3
//  "Stalking + Evaluating + Striking - Unificado y Nativo"
// ═══════════════════════════════════════════════════════════════════════════
const DEFAULT_CONFIG = {
    minStalkingFrames: 5,
    maxStalkingFrames: 60, // ~1 segundo a 60fps
    beautyThreshold: 0.65,
    consonanceThreshold: 0.60,
    urgencyForceThreshold: 0.90,
    maxEvaluatingFrames: 15,
    learningCooldownFrames: 120, // 🔥 WAVE 635: 2 segundos de cooldown (era 10 = 166ms)
};
let state = createInitialState();
function createInitialState() {
    return {
        phase: 'sleeping',
        framesInPhase: 0,
        activeCandidate: null,
        lastStrikeTimestamp: 0,
        strikesThisSession: 0,
        worthinessHistory: [],
    };
}
// ═══════════════════════════════════════════════════════════════════════════
// FUNCIONES PÚBLICAS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Procesa el estado actual y decide qué hacer
 *
 * @param pattern - Patrón musical actual
 * @param beauty - Análisis de belleza
 * @param consonance - Análisis de consonancia
 * @param spectralHint - 🔮 WAVE 1026: Información espectral del God Ear FFT
 * @param config - Configuración opcional
 * @returns Decisión de caza
 */
export function processHunt(pattern, beauty, consonance, spectralHint, config = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    state.framesInPhase++;
    // 🔮 WAVE 1026: Calcular worthiness con consciencia espectral
    const worthiness = calculateWorthiness(pattern, beauty, consonance, spectralHint);
    updateWorthinessHistory(worthiness);
    // Decisión basada en fase actual
    switch (state.phase) {
        case 'sleeping':
            return processSleeping(pattern, worthiness, cfg);
        case 'stalking':
            return processStalking(pattern, beauty, consonance, worthiness, cfg);
        case 'evaluating':
            return processEvaluating(pattern, beauty, consonance, worthiness, cfg);
        case 'striking':
            return processStriking(pattern, cfg);
        case 'learning':
            return processLearning(pattern, cfg);
        default:
            return processSleeping(pattern, worthiness, cfg);
    }
}
/**
 * Fuerza transición de fase (para control externo)
 */
export function forcePhaseTransition(newPhase) {
    state.phase = newPhase;
    state.framesInPhase = 0;
    if (newPhase === 'sleeping') {
        state.activeCandidate = null;
    }
}
/**
 * Obtiene estado actual (para debug)
 */
export function getHuntState() {
    return { ...state };
}
/**
 * Resetea el hunt engine
 */
export function resetHuntEngine() {
    state = createInitialState();
}
/**
 * Obtiene estadísticas de la sesión
 */
export function getHuntStats() {
    return {
        strikes: state.strikesThisSession,
        lastStrike: state.lastStrikeTimestamp,
    };
}
// ═══════════════════════════════════════════════════════════════════════════
// PROCESADORES POR FASE
// ═══════════════════════════════════════════════════════════════════════════
function processSleeping(pattern, worthiness, cfg) {
    // Despertar si hay algo interesante
    const shouldWake = worthiness > 0.35 ||
        pattern.isBuilding ||
        pattern.section === 'buildup';
    if (shouldWake) {
        transitionTo('stalking');
        state.activeCandidate = createCandidate(worthiness, 'Actividad interesante detectada');
        return {
            suggestedPhase: 'stalking',
            worthiness: worthiness, // 🔥 WAVE 811: worthiness en lugar de shouldStrike
            confidence: 0.4,
            conditions: null,
            activeCandidate: state.activeCandidate,
            reasoning: `Despertando: worthiness=${worthiness.toFixed(2)}`,
        };
    }
    return {
        suggestedPhase: 'sleeping',
        worthiness: 0, // 🔥 WAVE 811: worthiness = 0 cuando duerme
        confidence: 0.2,
        conditions: null,
        activeCandidate: null,
        reasoning: 'Durmiendo - nada interesante',
    };
}
function processStalking(pattern, beauty, consonance, worthiness, cfg) {
    // Actualizar candidato
    if (state.activeCandidate) {
        state.activeCandidate.framesObserved++;
        state.activeCandidate.worthiness = worthiness;
        state.activeCandidate.worthinessTrend = calculateTrend();
    }
    // ¿Suficientes frames para evaluar?
    if (state.framesInPhase >= cfg.minStalkingFrames) {
        // ¿Vale la pena evaluar?
        if (worthiness > cfg.beautyThreshold * 0.8) {
            transitionTo('evaluating');
            return {
                suggestedPhase: 'evaluating',
                worthiness: worthiness, // 🔥 WAVE 811
                confidence: 0.5,
                conditions: null,
                activeCandidate: state.activeCandidate,
                reasoning: `Promoviendo a evaluating después de ${state.framesInPhase} frames`,
            };
        }
    }
    // ¿Demasiado tiempo sin encontrar nada bueno?
    if (state.framesInPhase > cfg.maxStalkingFrames && worthiness < 0.3) {
        transitionTo('sleeping');
        return {
            suggestedPhase: 'sleeping',
            worthiness: 0, // 🔥 WAVE 811
            confidence: 0.3,
            conditions: null,
            activeCandidate: null,
            reasoning: 'Volviendo a dormir - nada prometedor',
        };
    }
    return {
        suggestedPhase: 'stalking',
        worthiness: worthiness, // 🔥 WAVE 811
        confidence: 0.4,
        conditions: null,
        activeCandidate: state.activeCandidate,
        reasoning: `Stalking frame ${state.framesInPhase}, worthiness=${worthiness.toFixed(2)}`,
    };
}
function processEvaluating(pattern, beauty, consonance, worthiness, cfg) {
    // Evaluar condiciones de strike
    const conditions = evaluateStrikeConditions(pattern, beauty, consonance, cfg);
    // 🔥 WAVE 811: HuntEngine ya NO decide disparar
    // Solo reporta worthiness y condiciones - DecisionMaker decide
    // ¿Condiciones óptimas? (worthiness alto)
    if (conditions.allMet) {
        transitionTo('striking');
        // 🔥 WAVE 811: LOG INFORMATIVO (sensor detectó momento valioso)
        // ❌ ELIMINADO: [SOLAR FLARE] FIRED - El sensor NO dispara
        const weights = getVibeWeights(pattern.vibeId);
        console.log(`[HuntEngine �] WORTHY MOMENT: Score=${conditions.strikeScore.toFixed(2)} (Threshold: ${weights.threshold.toFixed(2)}) | Vibe: ${pattern.vibeId}`);
        return {
            suggestedPhase: 'striking',
            worthiness: conditions.strikeScore, // 🔥 WAVE 811: worthiness = strikeScore
            confidence: conditions.strikeScore,
            conditions,
            activeCandidate: state.activeCandidate,
            reasoning: conditions.reasoning,
        };
    }
    // ¿Urgencia alta + belleza suficiente?
    if (conditions.urgencyScore > cfg.urgencyForceThreshold && conditions.beautyMet) {
        transitionTo('striking');
        // 🔥 WAVE 811: LOG INFORMATIVO
        console.log(`[HuntEngine �] URGENT MOMENT: Urgency=${conditions.urgencyScore.toFixed(2)} | Beauty=${conditions.beautyScore.toFixed(2)}`);
        return {
            suggestedPhase: 'striking',
            worthiness: conditions.strikeScore * 0.9, // 🔥 WAVE 811
            confidence: conditions.strikeScore * 0.9,
            conditions,
            activeCandidate: state.activeCandidate,
            reasoning: `URGENT MOMENT: urgency=${conditions.urgencyScore.toFixed(2)}`,
        };
    }
    // ¿Demasiado tiempo evaluando?
    if (state.framesInPhase > cfg.maxEvaluatingFrames) {
        transitionTo('stalking');
        return {
            suggestedPhase: 'stalking',
            worthiness: conditions.strikeScore * 0.5, // 🔥 WAVE 811: worthiness degradado
            confidence: 0.3,
            conditions,
            activeCandidate: state.activeCandidate,
            reasoning: 'Timeout en evaluating - volviendo a stalking',
        };
    }
    // ¿Condiciones empeorando?
    if (conditions.trend === 'falling' && conditions.strikeScore < 0.5) {
        transitionTo('stalking');
        return {
            suggestedPhase: 'stalking',
            worthiness: conditions.strikeScore * 0.3, // 🔥 WAVE 811: worthiness bajo
            confidence: 0.3,
            conditions,
            activeCandidate: state.activeCandidate,
            reasoning: 'Condiciones empeorando - abortar evaluación',
        };
    }
    // 🕵️ WAVE 610: NEAR MISS LOGGING - El Chivato
    // 🎯 WAVE 625: Updated para mostrar weighted score vs threshold
    if (conditions.strikeScore > 0.4) {
        const weights = getVibeWeights(pattern.vibeId);
        // 🧹 WAVE 671.5: Silenced NEAR MISS spam (kept for future debug if needed)
        // if (!conditions.allMet) {
        //   const delta = (weights.threshold - conditions.strikeScore).toFixed(2)
        //   console.log(`[HUNT 🕵️] NEAR MISS: ${conditions.reasoning}`)
        // }
    }
    return {
        suggestedPhase: 'evaluating',
        worthiness: conditions.strikeScore, // 🔥 WAVE 811
        confidence: 0.5,
        conditions,
        activeCandidate: state.activeCandidate,
        reasoning: `Evaluando: score=${conditions.strikeScore.toFixed(2)}, waiting...`,
    };
}
function processStriking(_pattern, _cfg) {
    // El strike se ejecutó - transicionar a learning
    state.strikesThisSession++;
    state.lastStrikeTimestamp = Date.now();
    transitionTo('learning');
    return {
        suggestedPhase: 'learning',
        worthiness: 0, // 🔥 WAVE 811: Post-strike, worthiness = 0 (ya pasó)
        confidence: 0.8,
        conditions: null,
        activeCandidate: state.activeCandidate,
        reasoning: `Strike #${state.strikesThisSession} ejecutado`,
    };
}
function processLearning(_pattern, cfg) {
    // Cooldown después de strike
    if (state.framesInPhase >= cfg.learningCooldownFrames) {
        transitionTo('stalking');
        return {
            suggestedPhase: 'stalking',
            worthiness: 0, // 🔥 WAVE 811
            confidence: 0.4,
            conditions: null,
            activeCandidate: null, // Reset candidato
            reasoning: 'Cooldown completado - volviendo a stalking',
        };
    }
    return {
        suggestedPhase: 'learning',
        worthiness: 0, // 🔥 WAVE 811: En cooldown, worthiness = 0
        confidence: 0.3,
        conditions: null,
        activeCandidate: state.activeCandidate,
        reasoning: `Learning cooldown: ${state.framesInPhase}/${cfg.learningCooldownFrames}`,
    };
}
// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════
function transitionTo(newPhase) {
    state.phase = newPhase;
    state.framesInPhase = 0;
    if (newPhase === 'sleeping' || newPhase === 'learning') {
        state.activeCandidate = null;
        state.worthinessHistory = [];
    }
}
function createCandidate(worthiness, reason) {
    return {
        id: `hunt_${Date.now()}`,
        firstSpottedAt: Date.now(),
        framesObserved: 1,
        worthiness,
        worthinessTrend: 'stable',
        reason,
    };
}
/**
 * 🔮 WAVE 1026: ROSETTA STONE - Spectral-Aware Worthiness
 *
 * La fórmula ÉTICA para decidir si un momento vale la pena:
 *
 * - High Energy + High Harshness + HIGH CLARITY = EUPHORIA (BOOST)
 *   → Metal bien producido = poder trip
 *   → Clarity actúa como CONTROL, no como suavidad
 *
 * - High Harshness + LOW CLARITY = CHAOS (PENALTY)
 *   → Ruido sucio sin definición = estrés real
 *   → Glitch effects solo si texture === 'noisy' || 'harsh' && clarity < 0.4
 */
function calculateWorthiness(pattern, beauty, consonance, spectralHint) {
    // Combinar métricas para "worthiness" de caza
    const beautyScore = beauty.totalBeauty;
    const consonanceScore = consonance.totalConsonance;
    const tensionScore = pattern.emotionalTension;
    const rhythmScore = pattern.rhythmicIntensity;
    // Bonus por momentos especiales
    let bonus = 0;
    // Buildup = muy interesante
    if (pattern.section === 'buildup' || pattern.isBuilding) {
        bonus += 0.15;
    }
    // Chorus = interesante
    if (pattern.section === 'chorus') {
        bonus += 0.10;
    }
    // Alta tensión = interesante
    if (tensionScore > 0.7) {
        bonus += 0.10;
    }
    // Tendencia de belleza subiendo = muy interesante
    if (beauty.trend === 'rising') {
        bonus += 0.10;
    }
    // ═══════════════════════════════════════════════════════════════════════
    // 🔮 WAVE 1026: SPECTRAL CONSCIOUSNESS - The Rosetta Stone Formula
    // ═══════════════════════════════════════════════════════════════════════
    if (spectralHint) {
        const { clarity, harshness, texture } = spectralHint;
        // 🎸 EUPHORIA DETECTION: High Energy + High Harshness + HIGH CLARITY
        // = Metal bien producido = PODER, no estrés
        const isControlledPower = harshness > 0.5 && clarity > 0.65;
        if (isControlledPower && tensionScore > 0.6) {
            // 🔥 POWER BONUS: El cerebro humano DISFRUTA esto
            bonus += 0.12;
        }
        // 🌊 CLEAN & BEAUTIFUL: High clarity without harshness = premium pop/electronic
        const isPremiumProduction = clarity > 0.7 && harshness < 0.3;
        if (isPremiumProduction) {
            bonus += 0.08; // Subtle boost for hi-fi vibes
        }
        // ⚠️ CHAOS PENALTY: High harshness + LOW clarity = muddy noise
        // Esto SÍ es estresante - garage metal, feedback loop
        const isChaotic = harshness > 0.6 && clarity < 0.4;
        if (isChaotic) {
            bonus -= 0.15; // Penalizar - esto NO es disfrutable
        }
        // 🎭 TEXTURE-BASED DECISIONS (para efectos glitch/noise más adelante)
        // Solo permitir efectos "glitch" si la textura lo amerita Y hay control
        if (texture === 'noisy' && clarity < 0.4) {
            // Ruido real sin control - reducir worthiness para evitar overwhelm
            bonus -= 0.10;
        }
    }
    // Combinar (ponderado)
    const base = beautyScore * 0.35 +
        consonanceScore * 0.25 +
        tensionScore * 0.20 +
        rhythmScore * 0.20;
    return Math.min(1, Math.max(0, base + bonus));
}
function updateWorthinessHistory(worthiness) {
    state.worthinessHistory.push(worthiness);
    if (state.worthinessHistory.length > 15) {
        state.worthinessHistory.shift();
    }
}
function calculateTrend() {
    if (state.worthinessHistory.length < 3)
        return 'stable';
    const recent = state.worthinessHistory.slice(-5);
    const first = recent[0];
    const last = recent[recent.length - 1];
    const delta = last - first;
    if (delta > 0.05)
        return 'rising';
    if (delta < -0.05)
        return 'falling';
    return 'stable';
}
/**
 * WAVE 625: MATRIZ DINÁMICA DE STRIKES POR VIBE
 * WAVE 635: SNIPER CALIBRATION - Rebalance de pesos y thresholds
 * WAVE 640: SWEET SPOT UNLOCK - Thresholds más accesibles para música real
 *
 * LOS 4 VIBES REALES DE LUXSYNC:
 * - FIESTA-LATINA: Reggaeton/Cumbia → Ritmo es rey, armonía simple
 * - TECHNO-CLUB: Techno/House → Urgencia hipnótica, poca variación armónica
 * - POP-ROCK: Pop/Rock → Balance armonía + energía
 * - CHILL-LOUNGE: Ambient/Lounge → Belleza armónica > Urgencia
 *
 * WAVE 635 CHANGES:
 * - Consonance: 20% → 10% (dejó de regalar puntos)
 * - Beauty: Variable según vibe (20-70%)
 * - Urgency: Variable según vibe (10-60%)
 * - Thresholds: Subidos para evitar falsos positivos (podcasts)
 *
 * WAVE 640 CHANGES:
 * - fiesta-latina threshold: 0.70 → 0.65 (aceptar near-miss drops)
 * - techno-club threshold: 0.70 → 0.65 (loops repetitivos necesitan umbral bajo)
 * - Pesos: Sin cambios (funcionan bien)
 */
const VIBE_STRIKE_MATRIX = {
    // 🎉 FIESTA-LATINA: Rhythm-driven, armonía simple
    'fiesta-latina': {
        beautyWeight: 0.3, // WAVE 635: Subido de 0.2 a 0.3
        urgencyWeight: 0.6, // Ritmo sigue siendo rey
        consonanceWeight: 0.1, // WAVE 635: Bajado de 0.2 a 0.1
        threshold: 0.65, // WAVE 640: Bajado de 0.70 a 0.65 (sweet spot para cumbia)
        urgencyBoost: 0.1 // WAVE 635: Bajado de 0.2 a 0.1 (más sutil)
    },
    // 🔊 TECHNO-CLUB: Hypnotic urgency, minimal harmony
    'techno-club': {
        beautyWeight: 0.2, // WAVE 635: Subido de 0.1 a 0.2
        urgencyWeight: 0.7, // WAVE 635: Bajado de 0.8 a 0.7
        consonanceWeight: 0.1, // WAVE 635: Mantenido en 0.1
        threshold: 0.65, // WAVE 640: Bajado de 0.70 a 0.65 (loops necesitan umbral bajo)
        urgencyBoost: 0.1 // WAVE 635: Bajado de 0.2 a 0.1
    },
    // 🎸 POP-ROCK: Balanced, el estándar
    'pop-rock': {
        beautyWeight: 0.4, // Balance armonía + energía
        urgencyWeight: 0.5, // WAVE 635: Subido de 0.4 a 0.5
        consonanceWeight: 0.1, // WAVE 635: Bajado de 0.2 a 0.1
        threshold: 0.70, // WAVE 635: Subido de 0.65 a 0.70
        urgencyBoost: 0.0 // No boost, mediciones naturales
    },
    // 🌙 CHILL-LOUNGE: Harmony-driven, belleza es arte
    'chill-lounge': {
        beautyWeight: 0.7, // Belleza armónica es prioridad
        urgencyWeight: 0.2, // WAVE 635: Subido de 0.1 a 0.2
        consonanceWeight: 0.1, // WAVE 635: Bajado de 0.2 a 0.1
        threshold: 0.75, // WAVE 635: Subido de 0.70 a 0.75 (muy selectivo)
        urgencyBoost: 0.0
    },
    // 💤 IDLE: Neutro (cuando no hay vibe activo)
    'idle': {
        beautyWeight: 0.4,
        urgencyWeight: 0.5, // WAVE 635: Subido de 0.4 a 0.5
        consonanceWeight: 0.1, // WAVE 635: Bajado de 0.2 a 0.1
        threshold: 0.75, // WAVE 635: Subido de 0.70 a 0.75 (casi nunca dispara)
        urgencyBoost: 0.0
    },
};
/**
 * Obtiene los pesos de strike para el vibe actual
 * Si el vibe no existe en la matriz, usa pop-rock como default
 */
function getVibeWeights(vibeId) {
    return VIBE_STRIKE_MATRIX[vibeId] ?? VIBE_STRIKE_MATRIX['pop-rock'];
}
// ═══════════════════════════════════════════════════════════════════════════
// EVALUACIÓN DE CONDICIONES - WAVE 625 DYNAMIC MATRIX
// ═══════════════════════════════════════════════════════════════════════════
function evaluateStrikeConditions(pattern, beauty, consonance, cfg) {
    // Métricas base
    const beautyScore = beauty.totalBeauty;
    const consonanceScore = consonance.totalConsonance;
    const trend = beauty.trend;
    // WAVE 625: Calcular urgencia base (rhythmic + emotional)
    let urgency = pattern.rhythmicIntensity * 0.5 + pattern.emotionalTension * 0.5;
    // WAVE 625: Obtener matriz de pesos del vibe actual
    const weights = getVibeWeights(pattern.vibeId);
    // WAVE 625: Aplicar urgency boost para géneros rhythm-driven
    if (weights.urgencyBoost > 0) {
        urgency = Math.min(1.0, urgency + weights.urgencyBoost);
    }
    // WAVE 625: Calcular strikeScore PONDERADO en lugar de checks booleanos
    const strikeScore = (beautyScore * weights.beautyWeight) +
        (urgency * weights.urgencyWeight) +
        (consonanceScore * weights.consonanceWeight);
    // Condiciones individuales (para logging y reasoning)
    const beautyMet = beautyScore >= cfg.beautyThreshold;
    const consonanceMet = consonanceScore >= cfg.consonanceThreshold;
    const trendMet = trend !== 'falling';
    const urgencyMet = urgency > 0.5 || pattern.section === 'chorus' || pattern.section === 'buildup';
    // WAVE 625: allMet ahora se basa en strikeScore >= threshold
    const allMet = strikeScore >= weights.threshold;
    // Bonus por sección musical (chorus/buildup = momento crítico)
    let finalScore = strikeScore;
    if (pattern.section === 'chorus' || pattern.section === 'buildup') {
        finalScore = Math.min(1.0, strikeScore + 0.05);
    }
    // Bonus por trend rising (momentum ascendente)
    if (trend === 'rising') {
        finalScore = Math.min(1.0, finalScore + 0.05);
    }
    // Reasoning para debug
    let reasoning = '';
    if (allMet) {
        reasoning = `[${pattern.vibeId}] STRIKE! Score=${finalScore.toFixed(2)} (threshold=${weights.threshold.toFixed(2)}) | Beauty=${beautyScore.toFixed(2)}×${weights.beautyWeight} Urgency=${urgency.toFixed(2)}×${weights.urgencyWeight} Cons=${consonanceScore.toFixed(2)}×${weights.consonanceWeight}`;
    }
    else {
        const delta = (weights.threshold - finalScore).toFixed(2);
        reasoning = `[${pattern.vibeId}] Score=${finalScore.toFixed(2)} < ${weights.threshold.toFixed(2)} (need +${delta}) | Beauty=${beautyScore.toFixed(2)} Urgency=${urgency.toFixed(2)} Cons=${consonanceScore.toFixed(2)}`;
    }
    return {
        beautyMet,
        beautyScore,
        consonanceMet,
        consonanceScore,
        trendMet,
        trend,
        urgencyMet,
        urgencyScore: urgency,
        allMet,
        strikeScore: finalScore,
        reasoning,
    };
}

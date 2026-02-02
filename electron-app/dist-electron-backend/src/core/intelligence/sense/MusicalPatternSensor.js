// ═══════════════════════════════════════════════════════════════════════════
//  🎵 MUSICAL PATTERN SENSOR - Los Ojos que Ven la Música
// ═══════════════════════════════════════════════════════════════════════════
//  WAVE 500 - PROJECT GENESIS - PHASE 2
//  🎛️ WAVE 661 - SPECTRAL PIPELINE - Textura espectral añadida
//  "Convierte el caos del audio en patrones que Selene puede cazar"
// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES - Matemática pura, sin magia
// ═══════════════════════════════════════════════════════════════════════════
/** Thresholds de energía para clasificar momentos musicales */
const ENERGY_THRESHOLDS = {
    /** Umbral para considerar "valle" (momento tranquilo) */
    VALLEY: 0.35,
    /** Umbral para considerar "building" (subiendo tensión) */
    BUILDING: 0.55,
    /** Umbral para considerar "peak" (momento intenso) */
    PEAK: 0.75,
    /** Umbral para DROP absoluto (física total) */
    DROP: 0.85,
};
// 🎛️ WAVE 661: Frame counter para logging de textura espectral
let spectralLogFrameCount = 0;
/** Mapa de sección original → clasificación interna */
const SECTION_MAP = {
    'intro': 'intro',
    'verse': 'verse',
    'buildup': 'buildup',
    'build': 'buildup',
    'pre-chorus': 'buildup',
    'prechorus': 'buildup',
    'chorus': 'chorus',
    'drop': 'drop',
    'breakdown': 'breakdown',
    'bridge': 'breakdown',
    'outro': 'outro',
    'unknown': 'verse', // Default conservador
};
const MAX_HISTORY = 30; // ~500ms a 60fps
const patternHistory = [];
// ═══════════════════════════════════════════════════════════════════════════
// FUNCIONES PÚBLICAS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Analiza el estado de Titan y extrae un patrón musical que Selene puede procesar
 *
 * @param state - Estado estabilizado de TitanEngine
 * @returns Patrón musical detectado
 */
export function senseMusicalPattern(state) {
    const section = classifySection(state.sectionType);
    const energyPhase = classifyEnergyPhase(state.smoothedEnergy);
    // 🎛️ WAVE 661: Debug log de textura espectral cada ~1 segundo
    spectralLogFrameCount++;
    if (spectralLogFrameCount % 60 === 0 && state.harshness > 0) {
        const textureLabel = state.harshness > 0.5 ? 'HARSH/Dirty' :
            state.spectralFlatness > 0.6 ? 'NOISE/Percussive' : 'CLEAN/Tonal';
        console.log(`[SENSE 🎛️] Texture: ${textureLabel} | ` +
            `Harsh=${state.harshness.toFixed(2)} | ` +
            `Flat=${state.spectralFlatness.toFixed(2)} | ` +
            `Centroid=${state.spectralCentroid.toFixed(0)}Hz`);
    }
    // Actualizar historial
    updateHistory({
        timestamp: state.timestamp,
        energy: state.smoothedEnergy,
        section,
        beatPhase: state.beatPhase,
    });
    // Detectar cambios recientes
    const recentChanges = detectRecentChanges();
    // Calcular métricas derivadas
    const rhythmicIntensity = calculateRhythmicIntensity(state);
    const emotionalTension = calculateEmotionalTension(state, recentChanges);
    const harmonicDensity = calculateHarmonicDensity(state);
    return {
        // WAVE 625: Pasar vibeId desde TitanStabilizedState
        vibeId: state.vibeId,
        // Clasificaciones
        section,
        energyPhase,
        // Métricas de ritmo
        bpm: state.bpm,
        beatPhase: state.beatPhase,
        syncopation: state.syncopation,
        rhythmicIntensity,
        // Métricas de emoción/tensión
        emotionalTension,
        isBuilding: recentChanges.energyTrend > 0.05,
        isReleasing: recentChanges.energyTrend < -0.05,
        // Métricas de armonía
        harmonicDensity,
        // Bandas de frecuencia normalizadas
        bassPresence: state.bass,
        midPresence: state.mid,
        highPresence: state.high,
        // 🎛️ WAVE 661: Textura espectral (mapeo directo desde TitanStabilizedState)
        harshness: state.harshness,
        spectralFlatness: state.spectralFlatness,
        spectralCentroid: state.spectralCentroid,
        // 🔥 WAVE 642: Energía CANONICAL (rawEnergy para reacción, smoothed para visual)
        rawEnergy: state.rawEnergy,
        smoothedEnergy: state.smoothedEnergy,
        // Estado del drop
        isDropActive: state.isDropActive,
        distanceFromDrop: calculateDistanceFromDrop(state),
        // Timestamp
        timestamp: state.timestamp,
    };
}
/**
 * Detecta si hubo un cambio de sección musical significativo
 */
export function detectSectionChange(state) {
    if (patternHistory.length < 2)
        return false;
    const current = classifySection(state.sectionType);
    const previous = patternHistory[patternHistory.length - 1].section;
    return current !== previous;
}
/**
 * Calcula la "urgencia" del momento musical
 * Alta urgencia = decisiones rápidas, baja urgencia = tiempo para pensar
 */
export function calculateMomentUrgency(pattern) {
    // Drop activo = urgencia máxima
    if (pattern.isDropActive)
        return 1.0;
    // Building = urgencia alta
    if (pattern.isBuilding && pattern.energyPhase === 'peak')
        return 0.85;
    // Chorus = urgencia media-alta
    if (pattern.section === 'chorus')
        return 0.7;
    // Buildup = urgencia media
    if (pattern.section === 'buildup')
        return 0.6;
    // Verse/breakdown = urgencia baja (tiempo para pensar)
    if (pattern.section === 'verse' || pattern.section === 'breakdown')
        return 0.3;
    // Default
    return 0.5;
}
/**
 * Resetea el historial de patrones (útil al cambiar de vibe)
 */
export function resetPatternHistory() {
    patternHistory.length = 0;
}
// ═══════════════════════════════════════════════════════════════════════════
// FUNCIONES PRIVADAS - La matemática interna
// ═══════════════════════════════════════════════════════════════════════════
function classifySection(sectionType) {
    const normalized = sectionType.toLowerCase().trim();
    return SECTION_MAP[normalized] ?? 'verse';
}
function classifyEnergyPhase(energy) {
    if (energy >= ENERGY_THRESHOLDS.DROP)
        return 'drop';
    if (energy >= ENERGY_THRESHOLDS.PEAK)
        return 'peak';
    if (energy >= ENERGY_THRESHOLDS.BUILDING)
        return 'building';
    return 'valley';
}
function updateHistory(entry) {
    patternHistory.push(entry);
    if (patternHistory.length > MAX_HISTORY) {
        patternHistory.shift();
    }
}
function detectRecentChanges() {
    if (patternHistory.length < 5) {
        return { energyTrend: 0, sectionChanged: false, beatStability: 1 };
    }
    // Tendencia de energía (últimos 10 frames)
    const recentFrames = patternHistory.slice(-10);
    const firstEnergy = recentFrames[0].energy;
    const lastEnergy = recentFrames[recentFrames.length - 1].energy;
    const energyTrend = lastEnergy - firstEnergy;
    // ¿Cambió sección en últimos 5 frames?
    const last5Sections = patternHistory.slice(-5).map(e => e.section);
    const uniqueSections = new Set(last5Sections);
    const sectionChanged = uniqueSections.size > 1;
    // Estabilidad del beat (varianza del beatPhase)
    const phases = recentFrames.map(e => e.beatPhase);
    const avgPhase = phases.reduce((a, b) => a + b, 0) / phases.length;
    const variance = phases.reduce((sum, p) => sum + Math.pow(p - avgPhase, 2), 0) / phases.length;
    const beatStability = Math.max(0, 1 - variance * 4); // Normalizado 0-1
    return { energyTrend, sectionChanged, beatStability };
}
function calculateRhythmicIntensity(state) {
    // Combina bass (golpe) con syncopation (groove)
    // Bass = fuerza del ritmo
    // Syncopation = complejidad rítmica
    const bassWeight = 0.6;
    const syncopationWeight = 0.4;
    const intensity = state.bass * bassWeight +
        state.syncopation * syncopationWeight;
    return Math.min(1, Math.max(0, intensity));
}
function calculateEmotionalTension(state, changes) {
    // Tensión = energía acumulándose + inestabilidad
    let tension = 0;
    // Energía alta = tensión base
    tension += state.smoothedEnergy * 0.4;
    // Building = aumenta tensión
    if (changes.energyTrend > 0) {
        tension += changes.energyTrend * 2; // Amplificar tendencia
    }
    // Cambio de sección reciente = pico de tensión
    if (changes.sectionChanged) {
        tension += 0.2;
    }
    // Beat inestable = tensión
    tension += (1 - changes.beatStability) * 0.15;
    // Highs altos + bass bajo = tensión suspendida (buildup típico)
    if (state.high > 0.6 && state.bass < 0.3) {
        tension += 0.15;
    }
    return Math.min(1, Math.max(0, tension));
}
function calculateHarmonicDensity(state) {
    // Densidad armónica = qué tan "lleno" está el espectro
    // Más bandas activas = más densidad
    const bands = [state.bass, state.mid, state.high];
    const activeBands = bands.filter(b => b > 0.3).length;
    const avgLevel = bands.reduce((a, b) => a + b, 0) / bands.length;
    // Combinar activación con nivel promedio
    const density = (activeBands / 3) * 0.5 + avgLevel * 0.5;
    return Math.min(1, Math.max(0, density));
}
function calculateDistanceFromDrop(state) {
    // Distancia normalizada hasta el umbral de drop
    // 0 = estamos en drop, 1 = muy lejos del drop
    if (state.smoothedEnergy >= ENERGY_THRESHOLDS.DROP)
        return 0;
    const distance = ENERGY_THRESHOLDS.DROP - state.smoothedEnergy;
    const maxDistance = ENERGY_THRESHOLDS.DROP; // Normalizar contra el máximo
    return Math.min(1, distance / maxDistance);
}

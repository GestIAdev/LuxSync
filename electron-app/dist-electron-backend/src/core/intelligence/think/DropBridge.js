/**
 * ⚡ WAVE 668: DROP BRIDGE - El Puente del Trueno
 * ═══════════════════════════════════════════════════════════════════════════
 * "Cuando el universo se alinea, disparamos sin preguntar"
 *
 * Esta es la CONDICIÓN DIVINA - un override de máxima prioridad que
 * cortocircuita toda la lógica fuzzy cuando el momento es ÉPICO.
 *
 * CONDICIÓN:
 *   (energyZScore >= 3.0σ) AND (section ∈ {drop, chorus}) AND (energy >= 0.75)
 *   ⟹ FORCE_STRIKE con intensidad máxima
 *
 * JUSTIFICACIÓN ESTADÍSTICA:
 * - Z-Score >= 3.0 significa que estamos a 3 desviaciones estándar del promedio
 * - Esto ocurre solo en el 0.15% de los frames (~2.7 por cada 1800 frames)
 * - Cuando coincide con un drop/chorus, es EL MOMENTO
 *
 * ANATOMÍA DEL DROP:
 *
 *   Energía
 *     │
 *   1.0│        ╱─────╲      ← Drop Zone (z > 3)
 *     │       ╱       ╲
 *   0.8│     ╱         ╲
 *     │    ╱           ╲
 *   0.6│   │ BUILDUP    │ RELEASE
 *     │   │             │
 *   0.4│──╱             ╲──
 *     │
 *     └──────────────────────→ Tiempo
 *         ↑
 *    Drop Bridge Fires Here
 *
 * @module core/intelligence/think/DropBridge
 * @wave 668
 */
// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Configuración por defecto del Drop Bridge
 *
 * 🔬 WAVE 671: CALIBRADO CON DATOS EMPÍRICOS DEL LABORATORIO
 * ═══════════════════════════════════════════════════════════════════════════
 * Basado en CALIBRATION-REPORT.md:
 * - THE_DROP alcanza Z=4.2σ (supera threshold 3.0 por 40%)
 * - Energía pico del drop: E=0.63 (promedio)
 * - Techno agresivo: Z=2.4-2.6σ (no debe disparar)
 *
 * DECISIONES:
 * - zScoreThreshold: 3.0 (conservador - separa drops épicos de techno agresivo)
 * - minEnergy: 0.60 (bajado desde 0.75 - THE_DROP alcanza 0.63 de media pico)
 *   → Tolerante con masterización menos agresiva sin comprometer detección
 */
const DEFAULT_CONFIG = {
    zScoreThreshold: 3.0, // 3 sigma = 99.85 percentil (THE_DROP=4.2σ, Techno=2.6σ máx)
    peakSections: ['drop', 'chorus'],
    minEnergy: 0.60, // THE_DROP alcanza 0.63 pico - margen de seguridad para mal mastering
    requireKick: false, // Kick es bonus, no requerido
    watchingThreshold: 2.0, // Empezamos a prestar atención
    imminentThreshold: 2.5, // Algo gordo viene (techno agresivo ya dispara aquí)
};
// ═══════════════════════════════════════════════════════════════════════════
// LÓGICA PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════
/**
 * 🌩️ EVALUAR DROP BRIDGE
 *
 * Verifica si el momento actual califica para un override divino.
 *
 * @param input - Estado actual
 * @param config - Configuración opcional
 * @returns Resultado con decisión y métricas
 */
export function checkDropBridge(input, config = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const { energyZScore, sectionType, rawEnergy, hasKick } = input;
    // === EVALUAR CONDICIONES ===
    const conditionsMet = [];
    // Condición 1: Z-Score épico
    const isEpicZScore = energyZScore >= cfg.zScoreThreshold;
    if (isEpicZScore) {
        conditionsMet.push(`z=${energyZScore.toFixed(2)}≥${cfg.zScoreThreshold}`);
    }
    // Condición 2: Sección peak
    const isPeakSection = cfg.peakSections.includes(sectionType);
    if (isPeakSection) {
        conditionsMet.push(`section=${sectionType}∈peak`);
    }
    // Condición 3: Energía mínima
    const hasMinEnergy = rawEnergy >= cfg.minEnergy;
    if (hasMinEnergy) {
        conditionsMet.push(`E=${rawEnergy.toFixed(2)}≥${cfg.minEnergy}`);
    }
    // Condición 4 (opcional): Kick presente
    const kickCondition = !cfg.requireKick || hasKick;
    if (hasKick) {
        conditionsMet.push('KICK');
    }
    // === DECISIÓN DIVINA ===
    const shouldForceStrike = isEpicZScore && isPeakSection && hasMinEnergy && kickCondition;
    // === CALCULAR INTENSIDAD ===
    // Base: 0.85, escala con z-score hasta 1.0
    // z=3.0 → 0.85, z=3.5 → 0.925, z=4.0 → 1.0
    let intensity = 0;
    if (shouldForceStrike) {
        const zExcess = energyZScore - cfg.zScoreThreshold;
        intensity = Math.min(1.0, 0.85 + zExcess * 0.15);
        // Bonus por kick detectado
        if (hasKick) {
            intensity = Math.min(1.0, intensity + 0.05);
        }
        // Bonus por harshness alta (synth agresivo)
        if (input.harshness && input.harshness > 0.7) {
            intensity = Math.min(1.0, intensity + 0.03);
        }
    }
    // === DETERMINAR NIVEL DE ALERTA ===
    const alertLevel = determineAlertLevel(energyZScore, cfg, shouldForceStrike);
    // === GENERAR RAZÓN ===
    const reason = generateReason(shouldForceStrike, conditionsMet, energyZScore, sectionType, cfg);
    return {
        shouldForceStrike,
        intensity,
        reason,
        alertLevel,
        metrics: {
            zScore: energyZScore,
            section: sectionType,
            energy: rawEnergy,
            threshold: cfg.zScoreThreshold,
            conditionsMet,
        },
    };
}
/**
 * Determina el nivel de alerta basado en el Z-Score
 */
function determineAlertLevel(zScore, cfg, activated) {
    if (activated)
        return 'activated';
    if (zScore >= cfg.imminentThreshold)
        return 'imminent';
    if (zScore >= cfg.watchingThreshold)
        return 'watching';
    return 'none';
}
/**
 * Genera una razón legible para la decisión
 */
function generateReason(shouldFire, conditionsMet, zScore, section, cfg) {
    if (shouldFire) {
        return `🌩️ DROP BRIDGE ACTIVATED: ${conditionsMet.join(' + ')} → FORCE_STRIKE`;
    }
    const missing = [];
    if (zScore < cfg.zScoreThreshold) {
        missing.push(`z=${zScore.toFixed(2)}<${cfg.zScoreThreshold}`);
    }
    if (!cfg.peakSections.includes(section)) {
        missing.push(`section=${section}∉peak`);
    }
    if (missing.length === 0) {
        return `Drop Bridge: Conditions partially met [${conditionsMet.join(', ')}]`;
    }
    return `Drop Bridge INACTIVE: Missing ${missing.join(', ')}`;
}
// ═══════════════════════════════════════════════════════════════════════════
// CLASE WRAPPER
// ═══════════════════════════════════════════════════════════════════════════
/**
 * 🌩️ DropBridge Class
 *
 * Wrapper con estado para tracking histórico y cooldown
 */
export class DropBridge {
    constructor(config = {}) {
        this.lastActivation = 0;
        this.consecutiveHighZScores = 0;
        this.COOLDOWN_MS = 2000; // 2 segundos entre activaciones
        this.HIGH_Z_PERSISTENCE = 3; // Frames consecutivos con z alto
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /**
     * Evalúa si debe activarse el Drop Bridge
     */
    check(input) {
        const now = Date.now();
        // Track z-scores altos consecutivos
        if (input.energyZScore >= this.config.imminentThreshold) {
            this.consecutiveHighZScores++;
        }
        else {
            this.consecutiveHighZScores = 0;
        }
        // Evaluación base
        const result = checkDropBridge(input, this.config);
        // Aplicar cooldown
        if (result.shouldForceStrike) {
            const timeSinceLastActivation = now - this.lastActivation;
            if (timeSinceLastActivation < this.COOLDOWN_MS) {
                // Cooldown activo - suprimir activación
                return {
                    ...result,
                    shouldForceStrike: false,
                    alertLevel: 'imminent',
                    reason: `${result.reason} [COOLDOWN ${(this.COOLDOWN_MS - timeSinceLastActivation) / 1000}s remaining]`,
                };
            }
            // Activación válida
            this.lastActivation = now;
        }
        return result;
    }
    /**
     * Obtiene el número de frames consecutivos con z-score alto
     */
    getConsecutiveHighZScores() {
        return this.consecutiveHighZScores;
    }
    /**
     * ¿Está el sistema en alerta alta? (Múltiples frames con z alto)
     */
    isHighAlert() {
        return this.consecutiveHighZScores >= this.HIGH_Z_PERSISTENCE;
    }
    /**
     * Tiempo desde la última activación en ms
     */
    getTimeSinceLastActivation() {
        return Date.now() - this.lastActivation;
    }
    /**
     * Reset del estado (cambio de canción)
     */
    reset() {
        this.lastActivation = 0;
        this.consecutiveHighZScores = 0;
    }
    /**
     * Actualiza la configuración
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════════════════════
/**
 * 📊 Calcula la probabilidad estadística de un Z-Score
 * (Para documentación y debug)
 */
export function zScoreToProbability(zScore) {
    // Aproximación de la CDF normal estándar
    // Usando la función de error (erf)
    const absZ = Math.abs(zScore);
    // Aproximación de Abramowitz and Stegun
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    const t = 1.0 / (1.0 + p * absZ / Math.sqrt(2));
    const erf = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absZ * absZ / 2);
    // CDF
    const cdf = 0.5 * (1 + (zScore >= 0 ? erf : -erf));
    // Probabilidad de ser >= zScore (cola derecha)
    return 1 - cdf;
}
/**
 * Descripción legible de la rareza de un Z-Score
 */
export function describeZScore(zScore) {
    const absZ = Math.abs(zScore);
    if (absZ < 1.0)
        return 'Normal (68%)';
    if (absZ < 1.5)
        return 'Ligeramente inusual';
    if (absZ < 2.0)
        return 'Inusual (5%)';
    if (absZ < 2.5)
        return 'Notable (2.5%)';
    if (absZ < 3.0)
        return 'Muy raro (1%)';
    if (absZ < 3.5)
        return '🔥 EXTREMO (0.3%)';
    return '⚡ ÉPICO (0.05%)';
}

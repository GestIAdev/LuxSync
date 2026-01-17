// ═══════════════════════════════════════════════════════════════════════════
//  🌀 BEAUTY SENSOR - El Ojo que Ve la Matemática Dorada
// ═══════════════════════════════════════════════════════════════════════════
//  WAVE 500 - PROJECT GENESIS - PHASE 2
//  "La naturaleza habla en Fibonacci, Selene escucha"
// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES MATEMÁTICAS - La belleza tiene fórmulas
// ═══════════════════════════════════════════════════════════════════════════
/** PHI - El ratio divino que gobierna la espiral de la vida */
const PHI = (1 + Math.sqrt(5)) / 2; // ≈ 1.6180339887...
/** PHI inverso - útil para normalizaciones */
const PHI_INVERSE = 1 / PHI; // ≈ 0.6180339887...
/** Secuencia de Fibonacci precalculada (hasta índice 20) */
const FIBONACCI_SEQUENCE = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765];
/** Ángulos dorados precalculados (para distribución de hues) */
const GOLDEN_ANGLES = [0, 137.5, 275.0, 52.5, 190.0, 327.5, 105.0, 242.5]; // grados
const MAX_HISTORY = 30;
const beautyHistory = [];
let lastAnalysis = null;
// ═══════════════════════════════════════════════════════════════════════════
// FUNCIONES PÚBLICAS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Analiza la belleza matemática del estado actual
 *
 * @param palette - Paleta de colores actual
 * @param pattern - Patrón musical detectado
 * @returns Análisis de belleza
 */
export function senseBeauty(palette, pattern) {
    const timestamp = pattern.timestamp;
    // Calcular componentes de belleza
    const phiAlignment = calculatePhiAlignment(palette, pattern);
    const fibonacciDistribution = calculateFibonacciDistribution(palette);
    const chromaticHarmony = calculateChromaticHarmony(palette);
    const contrastBalance = calculateContrastBalance(palette, pattern);
    // Pesos para combinar (basados en teoría estética)
    const weights = {
        phi: 0.25,
        fibonacci: 0.20,
        chromatic: 0.35,
        contrast: 0.20,
    };
    // Score total ponderado
    const totalBeauty = phiAlignment * weights.phi +
        fibonacciDistribution * weights.fibonacci +
        chromaticHarmony * weights.chromatic +
        contrastBalance * weights.contrast;
    // Determinar tendencia
    const trend = calculateTrend(totalBeauty);
    // Actualizar historial
    updateHistory({ timestamp, totalBeauty });
    const analysis = {
        totalBeauty,
        phiAlignment,
        fibonacciDistribution,
        chromaticHarmony,
        contrastBalance,
        trend,
        timestamp,
    };
    lastAnalysis = analysis;
    return analysis;
}
/**
 * Obtiene el score de belleza promedio reciente
 */
export function getAverageBeauty() {
    if (beautyHistory.length === 0)
        return 0.5;
    return beautyHistory.reduce((sum, e) => sum + e.totalBeauty, 0) / beautyHistory.length;
}
/**
 * Obtiene la tendencia general de belleza
 */
export function getBeautyTrend() {
    if (beautyHistory.length < 5)
        return 'stable';
    const recent = beautyHistory.slice(-5);
    const first = recent[0].totalBeauty;
    const last = recent[recent.length - 1].totalBeauty;
    const delta = last - first;
    if (delta > 0.05)
        return 'rising';
    if (delta < -0.05)
        return 'falling';
    return 'stable';
}
/**
 * Evalúa si un hue propuesto sigue distribución dorada
 *
 * @param proposedHue - Hue a evaluar (0-360)
 * @param existingHues - Hues ya en la paleta
 * @returns Score de adherencia a distribución dorada (0-1)
 */
export function evaluateGoldenDistribution(proposedHue, existingHues) {
    if (existingHues.length === 0)
        return 1.0; // Cualquier hue es válido si está vacío
    // Calcular ángulo ideal según regla dorada
    const idealGoldenOffset = 137.5; // Grados (PHI * 360 / (PHI + 1))
    let bestScore = 0;
    for (const existing of existingHues) {
        // Distancia angular al hue existente
        let distance = Math.abs(proposedHue - existing);
        if (distance > 180)
            distance = 360 - distance;
        // ¿Qué tan cerca está de un múltiplo del ángulo dorado?
        for (let i = 1; i <= 3; i++) {
            const targetDistance = (idealGoldenOffset * i) % 360;
            const deviation = Math.abs(distance - targetDistance);
            const normalizedDeviation = deviation > 180 ? 360 - deviation : deviation;
            // Score: 1 si perfecto, 0 si muy lejos
            const score = Math.exp(-normalizedDeviation / 30);
            bestScore = Math.max(bestScore, score);
        }
    }
    return bestScore;
}
/**
 * Resetea historial de belleza
 */
export function resetBeautyHistory() {
    beautyHistory.length = 0;
    lastAnalysis = null;
}
// ═══════════════════════════════════════════════════════════════════════════
// FUNCIONES PRIVADAS - La matemática pura
// ═══════════════════════════════════════════════════════════════════════════
function calculatePhiAlignment(palette, pattern) {
    // Evalúa si las proporciones siguen PHI
    let phiScore = 0;
    let checks = 0;
    // Check 1: Proporción entre energía y tensión
    if (pattern.rhythmicIntensity > 0 && pattern.emotionalTension > 0) {
        const ratio = Math.max(pattern.rhythmicIntensity, pattern.emotionalTension) /
            Math.min(pattern.rhythmicIntensity, pattern.emotionalTension);
        const phiDeviation = Math.abs(ratio - PHI);
        phiScore += Math.exp(-phiDeviation * 2);
        checks++;
    }
    // Check 2: Proporción bass/mid/high (¿sigue fibonacci?)
    const bands = [pattern.bassPresence, pattern.midPresence, pattern.highPresence];
    const sorted = [...bands].sort((a, b) => a - b);
    if (sorted[0] > 0.1 && sorted[1] > 0.1) {
        const ratio1 = sorted[2] / sorted[1];
        const ratio2 = sorted[1] / sorted[0];
        const avgRatio = (ratio1 + ratio2) / 2;
        const phiDeviation = Math.abs(avgRatio - PHI);
        phiScore += Math.exp(-phiDeviation * 1.5);
        checks++;
    }
    // Check 3: Contraste en paleta sigue PHI_INVERSE
    const mainColor = palette.primary;
    const accentColor = palette.accent;
    if (mainColor && accentColor) {
        // Diferencia de saturación normalizada
        const satDiff = Math.abs((mainColor.s || 0.5) - (accentColor.s || 0.5));
        const phiDeviation = Math.abs(satDiff - PHI_INVERSE);
        phiScore += Math.exp(-phiDeviation * 3);
        checks++;
    }
    return checks > 0 ? phiScore / checks : 0.5;
}
function calculateFibonacciDistribution(palette) {
    // ¿Los colores están distribuidos en proporciones Fibonacci?
    const colors = [
        palette.primary,
        palette.secondary,
        palette.ambient,
        palette.accent,
        palette.contrast,
    ].filter(Boolean);
    if (colors.length < 2)
        return 0.5;
    // Extraer hues
    const hues = colors.map(c => c.h).filter(h => h !== undefined);
    if (hues.length < 2)
        return 0.5;
    // Calcular distancias entre hues consecutivos
    const sortedHues = [...hues].sort((a, b) => a - b);
    const distances = [];
    for (let i = 1; i < sortedHues.length; i++) {
        distances.push(sortedHues[i] - sortedHues[i - 1]);
    }
    // Agregar distancia circular
    distances.push(360 - sortedHues[sortedHues.length - 1] + sortedHues[0]);
    // Verificar si las distancias siguen proporción Fibonacci
    const sortedDistances = [...distances].sort((a, b) => a - b);
    let fibScore = 0;
    for (let i = 1; i < sortedDistances.length; i++) {
        const ratio = sortedDistances[i] / sortedDistances[i - 1];
        // Buscar ratio cercano a cualquier par consecutivo de Fibonacci
        let bestMatch = 0;
        for (let j = 1; j < 8; j++) {
            const fibRatio = FIBONACCI_SEQUENCE[j + 1] / FIBONACCI_SEQUENCE[j];
            const deviation = Math.abs(ratio - fibRatio);
            bestMatch = Math.max(bestMatch, Math.exp(-deviation * 0.5));
        }
        fibScore += bestMatch;
    }
    return sortedDistances.length > 0 ? fibScore / sortedDistances.length : 0.5;
}
function calculateChromaticHarmony(palette) {
    // Evalúa armonía cromática clásica (complementarios, análogos, etc.)
    const colors = [
        palette.primary,
        palette.secondary,
        palette.ambient,
        palette.accent,
    ].filter(Boolean);
    if (colors.length < 2)
        return 0.5;
    const hues = colors.map(c => c.h).filter(h => h !== undefined);
    if (hues.length < 2)
        return 0.5;
    let harmonyScore = 0;
    let pairs = 0;
    // Evaluar cada par de colores
    for (let i = 0; i < hues.length; i++) {
        for (let j = i + 1; j < hues.length; j++) {
            let distance = Math.abs(hues[i] - hues[j]);
            if (distance > 180)
                distance = 360 - distance;
            // Relaciones armónicas clásicas:
            // - Complementarios: 180° (tensión perfecta)
            // - Triádicos: 120° (equilibrio dinámico)
            // - Split-complementarios: 150° (sofisticado)
            // - Análogos: 30° (suave)
            const harmonicAngles = [0, 30, 60, 120, 150, 180];
            let bestHarmony = 0;
            for (const target of harmonicAngles) {
                const deviation = Math.abs(distance - target);
                const score = Math.exp(-deviation / 15); // 15° tolerancia
                bestHarmony = Math.max(bestHarmony, score);
            }
            harmonyScore += bestHarmony;
            pairs++;
        }
    }
    return pairs > 0 ? harmonyScore / pairs : 0.5;
}
function calculateContrastBalance(palette, pattern) {
    // El contraste debe reflejar la energía musical
    // Alta energía = alto contraste, baja energía = bajo contraste
    const targetContrast = pattern.rhythmicIntensity * 0.6 + pattern.emotionalTension * 0.4;
    // Calcular contraste actual de la paleta
    const primary = palette.primary;
    const contrast = palette.contrast;
    if (!primary || !contrast)
        return 0.5;
    // Contraste de saturación
    const satContrast = Math.abs((primary.s || 0.5) - (contrast.s || 0.5));
    // Contraste de luminosidad (aproximado por hue distance)
    let hueContrast = Math.abs((primary.h || 0) - (contrast.h || 0));
    if (hueContrast > 180)
        hueContrast = 360 - hueContrast;
    const normalizedHueContrast = hueContrast / 180;
    // Contraste combinado
    const actualContrast = satContrast * 0.5 + normalizedHueContrast * 0.5;
    // Score: qué tan cerca está del contraste objetivo
    const deviation = Math.abs(actualContrast - targetContrast);
    return Math.exp(-deviation * 3);
}
function calculateTrend(currentBeauty) {
    if (beautyHistory.length < 3)
        return 'stable';
    const recent = beautyHistory.slice(-3);
    const avgRecent = recent.reduce((sum, e) => sum + e.totalBeauty, 0) / recent.length;
    const delta = currentBeauty - avgRecent;
    if (delta > 0.03)
        return 'rising';
    if (delta < -0.03)
        return 'falling';
    return 'stable';
}
function updateHistory(entry) {
    beautyHistory.push(entry);
    if (beautyHistory.length > MAX_HISTORY) {
        beautyHistory.shift();
    }
}

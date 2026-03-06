/**
 * ⚡ WAVE 667: FUZZY DECISION MAKER
 * ═══════════════════════════════════════════════════════════════════════════
 * "La Consciencia Borrosa de Selene"
 *
 * Porque el universo no es binario, coño.
 * Un drop no es "drop" o "no-drop". Es 0.87 drop, 0.12 buildup, 0.01 verse.
 *
 * WAVE 700.1: Integración con MoodController
 * - El Mood modifica los UMBRALES de decisión
 * - CALM eleva el listón, PUNK lo baja
 *
 * WAVE 932: Integración con EnergyConsciousness
 * - Nuevas reglas de SUPRESIÓN para zonas de silencio
 * - El sistema difuso ahora "sabe" si está en un funeral
 *
 * ARQUITECTURA:
 *
 *   Crisp Inputs (números)
 *          │
 *          ▼
 *   ┌──────────────┐
 *   │  FUZZIFY     │ ← Convertir a membership grades (0-1 por categoría)
 *   └──────────────┘
 *          │
 *          ▼
 *   ┌──────────────┐
 *   │ RULE ENGINE  │ ← Evaluar TODAS las reglas difusas
 *   └──────────────┘
 *          │
 *          ▼
 *   ┌──────────────┐
 *   │ DEFUZZIFY    │ ← Agregar outputs → Decisión crisp
 *   └──────────────┘
 *          │
 *          ▼
 *   ┌──────────────┐
 *   │ 🎭 MOOD MOD  │ ← WAVE 700.1: Apply threshold/intensity multipliers
 *   └──────────────┘
 *          │
 *          ▼
 *   ┌───────────────┐
 *   │ 🔋 ENERGY CAP │ ← WAVE 932: Suppress in silence zones
 *   └───────────────┘
 *          │
 *          ▼
 *   FuzzyDecision
 *
 * @module core/intelligence/think/FuzzyDecisionMaker
 * @wave 667, 700.1, 932
 */
import { MoodController } from '../../mood';
// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES: PARÁMETROS DE MEMBERSHIP FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Parámetros para las funciones de membresía
 * Estos definen los "bordes" de cada categoría fuzzy
 *
 * 🔬 WAVE 671: CALIBRADO CON DATOS EMPÍRICOS DEL LABORATORIO
 * ═══════════════════════════════════════════════════════════════════════════
 * Basado en CALIBRATION-REPORT.md:
 * - Podcast/Silencio: Z ≤ 1.2σ (Normal)
 * - Techno Kicks/Buildup: Z = 2.4-2.6σ (Notable)
 * - THE_DROP: Z = 4.2σ (Epic)
 * - White Noise: H = 0.14 (Dirty threshold)
 * - Sine/Techno: H ≤ 0.05 (Clean)
 */
const MEMBERSHIP_PARAMS = {
    // Energy (0-1 input)
    // 🩸 WAVE 2107: FUZZY RESURRECTION REAL
    // Brejcha-style techno oscillates E=0.3-0.6. Old edge 0.65 meant energy.high=0 ALWAYS.
    // 5 of 7 STRIKE rules use energy.high → Fuzzy was mathematically DEAD.
    // New edge 0.50 lets energy.high activate from E=0.50 upward.
    // This doesn't make Fuzzy trigger-happy — suppression rules + defuzzify still gate it.
    energy: {
        low: { center: 0.0, spread: 0.35 }, // Pico en 0, cae hasta 0.35
        medium: { center: 0.5, spread: 0.30 }, // Pico en 0.5, ±0.30
        high: { center: 1.0, spread: 0.50 }, // 🩸 WAVE 2107: 0.35→0.50 spread. Activa desde E=0.50
    },
    // Z-Score (calibrado con datos reales)
    zScore: {
        normal: { threshold: 1.5 }, // |z| < 1.5 (Podcast=1.2, Silencio=0.0)
        notable: { low: 1.5, high: 2.8 }, // 1.5 <= |z| < 2.8 (Techno Kicks 2.4-2.6, Buildup 2.3)
        epic: { threshold: 2.8 }, // |z| >= 2.8 (THE_DROP alcanza 4.2σ - sobrepasa por 50%)
    },
    // Harshness (calibrado con datos reales)
    harshness: {
        low: { center: 0.0, spread: 0.05 }, // Clean: H ≤ 0.05 (Sine/Techno H=0.00)
        medium: { center: 0.075, spread: 0.05 }, // Zona intermedia
        high: { center: 0.15, spread: 0.10 }, // Dirty: H ≥ 0.10 (White Noise H=0.14, Podcast H=0.22)
    },
};
// ═══════════════════════════════════════════════════════════════════════════
// MEMBERSHIP FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Función de membresía triangular
 * Retorna 1 en el centro, decae linealmente hacia los lados
 */
function triangularMembership(value, center, spread) {
    const distance = Math.abs(value - center);
    if (distance >= spread)
        return 0;
    return 1 - (distance / spread);
}
/**
 * Función de membresía trapezoidal izquierda
 * Retorna 1 hasta cierto punto, luego decae
 */
function leftTrapezoid(value, edge, spread) {
    if (value <= edge - spread)
        return 1;
    if (value >= edge)
        return 0;
    return (edge - value) / spread;
}
/**
 * Función de membresía trapezoidal derecha
 * Crece hasta cierto punto, luego 1
 */
function rightTrapezoid(value, edge, spread) {
    if (value >= edge + spread)
        return 1;
    if (value <= edge)
        return 0;
    return (value - edge) / spread;
}
// ═══════════════════════════════════════════════════════════════════════════
// FUZZIFICACIÓN
// ═══════════════════════════════════════════════════════════════════════════
/**
 * 🔮 FUZZIFICAR: Convierte valores crisp a conjuntos difusos
 *
 * 🔋 WAVE 932: Ahora incluye fuzzificación de zona de energía absoluta
 *
 * @param input - Valores crisp (números reales)
 * @returns Conjuntos difusos con grados de membresía
 */
function fuzzify(input) {
    // === ENERGY ===
    // 🩸 WAVE 2107: energy.high edge moved from 0.65 to 0.50 (spread 0.50)
    // At E=0.59: old=rightTrapezoid(0.59,0.65,0.35)=0. New=rightTrapezoid(0.59,0.50,0.50)=0.18
    // At E=0.70: old=0.14. New=0.40. At E=0.85: old=0.57. New=0.70.
    // Fuzzy can now FEEL energy in Brejcha's 0.4-0.7 range instead of being blind.
    const energy = {
        low: leftTrapezoid(input.energy, 0.3, 0.3),
        medium: triangularMembership(input.energy, 0.5, 0.35),
        high: rightTrapezoid(input.energy, 0.50, 0.50), // 🩸 WAVE 2107: was (0.65, 0.35)
    };
    // === Z-SCORE ===
    // 🩸 WAVE 2110: Notable curve smoothed. Old notable at Z=1.0σ = 0.40 (too low for strike gate).
    //   Old formula: Z<1.5 → Z/2.5. At Z=1.0 → 0.40. CLIFF at Z=1.5 → jumps to 1.0.
    //   New formula: Z<1.5 → Z/2.0. At Z=1.0 → 0.50. Smoother ramp, no cliff.
    //   This lets Pure_Energy_Strike activate meaningfully from Z≥0.8σ instead of Z≥1.5σ.
    //   At Z=0.5σ: 0.25 (mild gate). At Z=1.0σ: 0.50 (moderate gate). At Z=1.5σ: 0.75 → 1.0.
    //   The defuzzify threshold (>0.25) + confidence mapping still prevent spam.
    const absZ = Math.abs(input.zScore);
    const zScore = {
        normal: absZ < 1.5 ? 1 - (absZ / 1.5) * 0.5 : Math.max(0, 1 - (absZ - 1.0)),
        notable: absZ < 1.5 ? absZ / 2.0 : absZ >= 2.5 ? Math.max(0, 1 - (absZ - 2.5) / 1.0) : 1, // 🩸 WAVE 2110: /2.5→/2.0
        epic: absZ < 2.5 ? Math.max(0, (absZ - 1.5) / 1.0) : Math.min(1, 0.5 + (absZ - 2.5) * 0.25),
    };
    // === SECTION ===
    const section = fuzzifySection(input.sectionType);
    // === HARSHNESS ===
    const harshness = {
        low: leftTrapezoid(input.harshness, 0.3, 0.3),
        medium: triangularMembership(input.harshness, 0.5, 0.35),
        high: rightTrapezoid(input.harshness, 0.65, 0.35),
    };
    // === 🔋 WAVE 932: ENERGY ZONE (consciencia energética absoluta) ===
    const energyZone = fuzzifyEnergyZone(input.energyContext);
    return {
        energy,
        zScore,
        section,
        harshness,
        energyZone,
        huntScore: input.huntScore,
        beauty: input.beauty,
    };
}
/**
 * 🔋 WAVE 932: Fuzzifica la zona de energía absoluta
 *
 * Esto permite que las reglas difusas "sientan" si están en:
 * - lowZone: silence/valley (supresión máxima)
 * - midZone: ambient/gentle (supresión parcial)
 * - highZone: active/intense/peak (sin supresión)
 */
function fuzzifyEnergyZone(energyContext) {
    // Si no hay contexto, asumir zona alta (sin supresión) para backwards compat
    if (!energyContext) {
        return { lowZone: 0, midZone: 0.3, highZone: 0.7 };
    }
    const zone = energyContext.zone;
    const absoluteEnergy = energyContext.absolute;
    // Mapeo de zonas a conjuntos difusos
    // Las transiciones son suaves, no binarias
    const zoneProfiles = {
        'silence': { lowZone: 1.0, midZone: 0.2, highZone: 0.0 },
        'valley': { lowZone: 0.8, midZone: 0.4, highZone: 0.0 },
        'ambient': { lowZone: 0.3, midZone: 0.9, highZone: 0.2 },
        'gentle': { lowZone: 0.1, midZone: 0.7, highZone: 0.4 },
        'active': { lowZone: 0.0, midZone: 0.3, highZone: 0.8 },
        'intense': { lowZone: 0.0, midZone: 0.1, highZone: 1.0 },
        'peak': { lowZone: 0.0, midZone: 0.0, highZone: 1.0 },
    };
    const baseProfile = zoneProfiles[zone] || zoneProfiles['active'];
    // Ajuste fino basado en energía absoluta para transiciones suaves
    // Esto evita saltos bruscos en los bordes de las zonas
    const smoothingFactor = 0.3;
    return {
        lowZone: baseProfile.lowZone * (1 - smoothingFactor) +
            (absoluteEnergy < 0.2 ? 1 : 0) * smoothingFactor,
        midZone: baseProfile.midZone * (1 - smoothingFactor) +
            (absoluteEnergy >= 0.2 && absoluteEnergy < 0.5 ? 1 : 0) * smoothingFactor,
        highZone: baseProfile.highZone * (1 - smoothingFactor) +
            (absoluteEnergy >= 0.5 ? 1 : 0) * smoothingFactor,
    };
}
/**
 * Fuzzifica el tipo de sección en quiet/building/peak
 *
 * 🩸 WAVE 2100: breakdown REBALANCED
 * Before: breakdown = { quiet: 0.8, building: 0.2, peak: 0.0 }
 * This made Fuzzy treat breakdown as near-silence, which in techno is WRONG.
 * Techno breakdowns still have bass/energy — they're tension-builders, not silences.
 * All STRIKE rules use section.peak via Math.min() — with peak=0.0, strike=0.0 ALWAYS.
 * FIX: breakdown = { quiet: 0.3, building: 0.5, peak: 0.2 }
 * This lets breakdown moments still trigger effects when energy/Z-score/hunt are high.
 * True silence is handled by EnergyZone suppression rules (weight 1.5).
 */
function fuzzifySection(sectionType) {
    // Mappeo de secciones a energía narrativa
    const sectionProfiles = {
        'intro': { quiet: 1.0, building: 0.2, peak: 0.0 },
        'verse': { quiet: 0.3, building: 0.7, peak: 0.1 },
        'chorus': { quiet: 0.0, building: 0.2, peak: 1.0 },
        'bridge': { quiet: 0.4, building: 0.6, peak: 0.2 },
        'buildup': { quiet: 0.0, building: 1.0, peak: 0.3 },
        'drop': { quiet: 0.0, building: 0.0, peak: 1.0 },
        'breakdown': { quiet: 0.3, building: 0.5, peak: 0.2 }, // 🩸 WAVE 2100: was 0.8/0.2/0.0
        'outro': { quiet: 1.0, building: 0.1, peak: 0.0 },
    };
    return sectionProfiles[sectionType] ?? { quiet: 0.5, building: 0.3, peak: 0.2 };
}
// ═══════════════════════════════════════════════════════════════════════════
// REGLAS DIFUSAS - EL CÓDIGO DE CONDUCTA DE SELENE
// ═══════════════════════════════════════════════════════════════════════════
/**
 * 📜 LAS REGLAS DE LA CONSCIENCIA
 *
 * Cada regla es un IF-THEN difuso:
 * - El antecedente calcula el grado de activación (0-1)
 * - El consecuente indica qué output se activa
 * - El weight indica la importancia de la regla
 *
 * Operadores:
 * - AND = Math.min (el más restrictivo gana)
 * - OR = Math.max (el más permisivo gana)
 */
const FUZZY_RULES = [
    // ═══════════════════════════════════════════════════════════════════════
    // FORCE STRIKE - Condición Divina (máxima prioridad)
    // ═══════════════════════════════════════════════════════════════════════
    {
        name: 'Divine_Drop',
        antecedent: (i) => Math.min(i.energy.high, i.zScore.epic, i.section.peak),
        consequent: 'forceStrike',
        weight: 1.0,
    },
    {
        name: 'Epic_Peak',
        antecedent: (i) => Math.min(i.zScore.epic, i.section.peak) * 0.9,
        consequent: 'forceStrike',
        weight: 0.95,
    },
    {
        name: 'Epic_Hunt',
        antecedent: (i) => i.zScore.epic * i.huntScore * i.energy.high,
        consequent: 'forceStrike',
        weight: 0.90,
    },
    // ═══════════════════════════════════════════════════════════════════════
    // STRIKE - Momento óptimo para actuar
    // ═══════════════════════════════════════════════════════════════════════
    {
        name: 'Hunt_Strike',
        antecedent: (i) => Math.min(i.energy.high, i.huntScore, i.section.peak),
        consequent: 'strike',
        weight: 0.85,
    },
    {
        name: 'Harsh_Climax',
        antecedent: (i) => Math.min(i.energy.high, i.harshness.high, i.section.peak),
        consequent: 'strike',
        weight: 0.80,
    },
    {
        name: 'Notable_Peak',
        antecedent: (i) => Math.min(i.zScore.notable, i.section.peak),
        consequent: 'strike',
        weight: 0.75,
    },
    {
        name: 'High_Energy_Hunt',
        antecedent: (i) => i.energy.high * i.huntScore * 0.9,
        consequent: 'strike',
        weight: 0.70,
    },
    {
        name: 'Beautiful_Peak',
        antecedent: (i) => Math.min(i.section.peak, i.beauty * 0.8),
        consequent: 'strike',
        weight: 0.65,
    },
    // 🩸 WAVE 2105: FUZZY RESURRECTION — 2 new STRIKE rules independent of section.peak
    // PROBLEM: All 5 existing STRIKE rules use section.peak via Math.min().
    // In buildup, section.peak = 0.3. Math.min(x, 0.3) * weight = MAX 0.255.
    // Defuzzify needs strike > 0.45. MATHEMATICALLY IMPOSSIBLE without section=drop.
    // But SimpleSectionTracker NEVER detects drops in Brejcha-style techno
    // (bassR=1.04 < threshold 1.4, wE=0.19 < threshold 0.75).
    // FIX: Two new rules that can reach strike WITHOUT section=drop.
    // They use Hunt worthiness + energy/z-score — the real signals that MATTER.
    {
        name: 'Hunt_Buildup_Strike',
        // Hunt confident + energy high + building = worth a strike even without "drop" label
        // In buildup: building=1.0, so this can reach 0.8*0.8=0.64 when hunt+energy are high
        antecedent: (i) => i.huntScore * i.energy.high * Math.max(i.section.building, i.section.peak) * 0.8,
        consequent: 'strike',
        weight: 0.80,
    },
    {
        name: 'Notable_Energy_Strike',
        // Notable z-score + high energy = something big is happening, section label be damned
        // z-score notable peaks at ~0.8 in typical techno, energy.high at ~0.7
        // Product: 0.56 * weight 0.75 = 0.42 — combined with other activations pushes past 0.45
        antecedent: (i) => i.zScore.notable * i.energy.high * i.energyZone.highZone,
        consequent: 'strike',
        weight: 0.75,
    },
    // 🩸 WAVE 2108→2110: STRIKE RULES — Resurrected + Rebalanced + Z-Smoothed
    // WAVE 2108: Created Pure_Energy_Strike and Energy_Building_Strike with MAX 2 factors.
    // WAVE 2109: LOG EVIDENCE (post-2108): 16 FUZZY STRIKE events, but too aggressive.
    //   FIX 2109: Added Z-Score gate. Energy alone isn't enough — need ANOMALOUS energy.
    // WAVE 2110: LOG EVIDENCE (post-2109): 2 strikes in 80 samples, 0 pass DecisionMaker.
    //   Fuzzy is DORMANT. Z-gate too aggressive: notable at Z=1.0σ was only 0.40 (old /2.5).
    //   FIX 2110: Notable curve smoothed (/2.5→/2.0), gate uses (notable + epic*0.5),
    //   Energy_Building_Strike gets highZone gate + weight boost (0.65→0.70).
    //   This restores Fuzzy's ability to contribute without the void-scream problem.
    {
        name: 'Pure_Energy_Strike',
        // 🩸 WAVE 2110: Z-gate SMOOTHED. Old gate: notable alone. At Z=1.0σ → 0.40 → too low.
        //   Post-2109 log: 80 fuzzy samples, only 2 strikes. Fuzzy is DORMANT.
        //   NEW: Use (notable + epic*0.5) clamped to [0,1]. This gives:
        //     Z=0.5σ: gate=0.25. Z=1.0σ: gate=0.50. Z=1.5σ: gate=1.0. Z=3.0σ: gate=1.35→1.0
        //   Math: E=0.72, Z=1.0σ → energy.high=0.44, highZone≈0.8, gate=0.50
        //     0.44 * 0.8 * 0.50 * 0.55 = 0.097 × weight 0.70 = 0.068 (still needs other rules)
        //   E=0.85, Z=1.5σ → energy.high=0.70, highZone≈1.0, gate=1.0
        //     0.70 * 1.0 * 1.0 * 0.55 = 0.385 × weight 0.70 = 0.270 → passes defuzzify ✓
        //   E=0.72, Z=0.3σ → gate=0.15 → 0.007 × weight = 0.005 → no chance (correct ✗)
        antecedent: (i) => {
            const zGate = Math.min(1, i.zScore.notable + i.zScore.epic * 0.5);
            return i.energy.high * i.energyZone.highZone * zGate * 0.55;
        },
        consequent: 'strike',
        weight: 0.70, // 🩸 WAVE 2110: 0.65→0.70. Needs slightly more weight with smoothed gate.
    },
    {
        name: 'Energy_Building_Strike',
        // 🩸 WAVE 2110: Added highZone gate. Without it, this fires in EVERY buildup with E>0.50.
        //   The highZone factor ensures we only strike when actually in high-energy zone,
        //   not just because section=buildup and energy barely passed 0.50.
        //   Old: 0.58 × 1.0 × 0.65 = 0.377. New: 0.58 × 1.0 × 0.8 × 0.70 = 0.325
        //   In low energy (E=0.45, highZone=0.1): 0.0 × 1.0 × 0.1 × 0.70 = 0.0 (correct)
        antecedent: (i) => i.energy.high * Math.max(i.section.building, i.section.peak) * i.energyZone.highZone * 0.70,
        consequent: 'strike',
        weight: 0.70, // 🩸 WAVE 2110: 0.65→0.70. Compensates the highZone gate.
    },
    // ═══════════════════════════════════════════════════════════════════════
    // PREPARE - Anticipación, algo viene
    // ═══════════════════════════════════════════════════════════════════════
    {
        name: 'Building_Tension',
        antecedent: (i) => Math.min(i.energy.medium, i.section.building),
        consequent: 'prepare',
        weight: 0.60,
    },
    {
        name: 'Notable_Building',
        antecedent: (i) => Math.min(i.zScore.notable, i.section.building),
        consequent: 'prepare',
        weight: 0.55,
    },
    {
        name: 'Harshness_Rising',
        antecedent: (i) => Math.min(i.harshness.high, i.section.building),
        consequent: 'prepare',
        weight: 0.50,
    },
    {
        name: 'Energy_Rising',
        antecedent: (i) => i.energy.medium * (1 - i.section.quiet) * 0.7,
        consequent: 'prepare',
        weight: 0.45,
    },
    {
        name: 'Hunt_Preparing',
        antecedent: (i) => i.huntScore * i.section.building * 0.8,
        consequent: 'prepare',
        weight: 0.50,
    },
    // ═══════════════════════════════════════════════════════════════════════
    // HOLD - Mantener estado, no hacer nada
    // ═══════════════════════════════════════════════════════════════════════
    {
        name: 'Quiet_Section',
        antecedent: (i) => Math.min(i.energy.low, i.section.quiet),
        consequent: 'hold',
        weight: 1.0,
    },
    {
        name: 'Normal_State',
        // 🩸 WAVE 2108: Added (1 - highZone) factor. In active/intense zones, 
        // this rule produces near-zero — it shouldn't compete with STRIKE rules
        // when the energy context says "this is a high-energy moment".
        // Before: 0.67 × 0.49 × 0.3 × 0.85 = 0.084 (small but beats strike's 0.023)
        // After in highZone: 0.67 × 0.49 × 0.3 × (1-0.8) × 0.85 = 0.017 (negligible)
        antecedent: (i) => i.zScore.normal * (1 - i.huntScore) * i.section.quiet * (1 - i.energyZone.highZone),
        consequent: 'hold',
        weight: 0.85,
    },
    {
        name: 'Low_Energy',
        antecedent: (i) => i.energy.low * (1 - i.section.peak),
        consequent: 'hold',
        weight: 0.70,
    },
    {
        name: 'No_Hunt_Interest',
        antecedent: (i) => (1 - i.huntScore) * i.energy.low,
        consequent: 'hold',
        weight: 0.60,
    },
    // ═══════════════════════════════════════════════════════════════════════
    // 🔋 WAVE 932: SUPRESIÓN ENERGÉTICA
    // La consciencia de zona de energía SUPRIME triggers en zonas bajas
    // Esto evita el "Síndrome del Grito en Biblioteca"
    //
    // 🩸 WAVE 2107: WEIGHTS REBALANCED
    // Old weights (1.5, 1.2, 1.0) produced hold=0.45 in ambient/gentle zones.
    // With max strike=0.225 in buildup, defuzzify NEVER picks strike (needs >0.45 AND >hold+0.15).
    // New weights (1.0, 0.85, 0.70) produce hold≈0.30 — still protective but beatable.
    // True silence (lowZone=1.0) still dominates: 1.0×1.0=1.0 hold. Library is still quiet.
    // But ambient/gentle (lowZone=0.3) now yields hold≈0.30 — Fuzzy CAN win when music warrants.
    // ═══════════════════════════════════════════════════════════════════════
    {
        name: 'Energy_Silence_Total_Suppress',
        antecedent: (i) => i.energyZone.lowZone * 1.0, // Zona de silencio = HOLD absoluto
        consequent: 'hold',
        weight: 1.0, // 🩸 WAVE 2107: 1.5→1.0. lowZone=1.0 (silence) still wins. lowZone=0.3 (ambient) = 0.30
    },
    {
        name: 'Energy_Valley_Suppress',
        antecedent: (i) => i.energyZone.lowZone * 0.8, // Valle también suprime
        consequent: 'hold',
        weight: 0.85, // 🩸 WAVE 2107: 1.2→0.85
    },
    {
        name: 'Energy_Low_Dampen_Action',
        antecedent: (i) => i.energyZone.lowZone * (1 - i.section.peak), // No en picos
        consequent: 'hold',
        weight: 0.70, // 🩸 WAVE 2107: 1.0→0.70
    },
];
// ═══════════════════════════════════════════════════════════════════════════
// MOTOR DE INFERENCIA
// ═══════════════════════════════════════════════════════════════════════════
/**
 * 🧠 EVALUAR REGLAS: Ejecuta todas las reglas y agrega activaciones
 *
 * Usa método de agregación MAX-MIN (Mamdani):
 * - Cada regla produce un grado de activación
 * - Se multiplica por el peso de la regla
 * - Para cada output, se toma el MAX de todas las reglas que lo activan
 */
function evaluateRules(fuzzyInputs) {
    // Inicializar outputs
    const outputs = {
        forceStrike: 0,
        strike: 0,
        prepare: 0,
        hold: 0,
    };
    // Tracking de activaciones para debug
    const activations = [];
    // Evaluar cada regla
    for (const rule of FUZZY_RULES) {
        // Calcular grado de activación del antecedente
        const rawActivation = rule.antecedent(fuzzyInputs);
        // Aplicar peso
        const weightedActivation = rawActivation * rule.weight;
        // Clamp a [0, 1]
        const activation = Math.max(0, Math.min(1, weightedActivation));
        // Registrar si hay activación significativa
        if (activation > 0.01) {
            activations.push({
                rule: rule.name,
                activation,
                output: rule.consequent,
            });
        }
        // Agregación MAX: el máximo de todas las reglas para este output
        outputs[rule.consequent] = Math.max(outputs[rule.consequent], activation);
    }
    // Ordenar activaciones por fuerza (para debug)
    activations.sort((a, b) => b.activation - a.activation);
    return { outputs, activations };
}
// ═══════════════════════════════════════════════════════════════════════════
// DEFUZZIFICACIÓN
// ═══════════════════════════════════════════════════════════════════════════
/**
 * 🎯 DEFUZZIFICAR: Convierte outputs difusos a decisión crisp
 *
 * Usa método de "Centro de Área" simplificado:
 * - Cada output tiene un "centro" predefinido
 * - La decisión final es el promedio ponderado
 *
 * Pero primero aplicamos prioridades:
 * 1. forceStrike > 0.5 → FORCE_STRIKE
 * 2. strike > hold + 0.1 → STRIKE
 * 3. prepare > hold → PREPARE
 * 4. default → HOLD
 */
function defuzzify(outputs, activations) {
    // Determinar acción por prioridad
    let action;
    let dominantRule = 'None';
    // Prioridad 1: Force Strike (override divino)
    if (outputs.forceStrike > 0.5) {
        action = 'force_strike';
        dominantRule = activations.find(a => a.output === 'forceStrike')?.rule ?? 'Divine_Override';
    }
    // 🩸 WAVE 2107→2109: DEFUZZIFY THRESHOLDS RECALIBRATED
    // WAVE 2107: 0.45/+0.15 → 0.35/+0.08. Still dead — max strike in Brejcha ≈ 0.23
    // WAVE 2108: 0.35 → 0.20, +0.08 → +0.05. Alive but too aggressive (16 strikes/100s).
    // WAVE 2109: 0.20 → 0.25, +0.05 → +0.08. The Z-gate on Pure_Energy_Strike already
    //   filters out normal-energy frames, so the defuzzify can be slightly more selective.
    //   With Pure_Energy_Strike (E=0.89, Z=1.9): strike≈0.33 vs hold≈0.05 → 0.33>0.13 ✓
    //   With Pure_Energy_Strike (E=0.79, Z=0.3): strike≈0.07 vs hold≈0.15 → FAILS ✗ (correct!)
    // Triple safety net: defuzzify + DecisionMaker confidence + Mood threshold.
    else if (outputs.strike > outputs.hold + 0.08 && outputs.strike > 0.25) {
        action = 'strike';
        dominantRule = activations.find(a => a.output === 'strike')?.rule ?? 'Strike_Rule';
    }
    // 🎯 WAVE 1176: Prepare también más exigente (SUBIDO de 0.25 → 0.35)
    // Prioridad 3: Prepare supera Hold
    else if (outputs.prepare > outputs.hold && outputs.prepare > 0.35) {
        action = 'prepare';
        dominantRule = activations.find(a => a.output === 'prepare')?.rule ?? 'Prepare_Rule';
    }
    // Default: Hold
    else {
        action = 'hold';
        dominantRule = activations.find(a => a.output === 'hold')?.rule ?? 'Default_Hold';
    }
    // Calcular intensidad basada en la fuerza de la decisión
    const intensity = calculateIntensity(action, outputs);
    // Calcular confianza basada en la claridad de la decisión
    const confidence = calculateConfidence(outputs);
    // Generar razonamiento
    const reasoning = generateReasoning(action, dominantRule, outputs, activations);
    return {
        action,
        intensity,
        confidence,
        reasoning,
        fuzzyScores: outputs,
        dominantRule,
    };
}
/**
 * Calcula la intensidad basada en la acción y sus scores
 */
function calculateIntensity(action, outputs) {
    switch (action) {
        case 'force_strike':
            // Force strike siempre es intenso: 0.85-1.0
            return 0.85 + outputs.forceStrike * 0.15;
        case 'strike':
            // Strike: 0.6-0.95 basado en su score
            return 0.6 + outputs.strike * 0.35;
        case 'prepare':
            // Prepare: 0.3-0.6 basado en su score
            return 0.3 + outputs.prepare * 0.3;
        case 'hold':
        default:
            // Hold: 0.0-0.3
            return outputs.hold * 0.3;
    }
}
/**
 * Calcula la confianza basada en qué tan "clara" es la decisión
 * Alta confianza = un output domina claramente sobre los demás
 *
 * 🩸 WAVE 2108→2109: CONFIDENCE RECALIBRATED
 * Old formula: (max + gap) / 2 where gap = max - secondMax across ALL 4 outputs.
 * Problem: strike=0.38, prepare=0.30, hold=0.08 → gap=0.08, conf=(0.38+0.08)/2=0.23
 * DecisionMaker needs conf≥0.50 → Fuzzy STRIKE ignored even when defuzzify chose it.
 *
 * WAVE 2108: Maps [0.20, 0.70] → [0.50, 0.90]. TOO GENEROUS.
 *   Log evidence: strike=0.39 → conf=0.67, strike=0.50 → conf=0.82.
 *   16 FUZZY STRIKEs in 100s, most with conf 0.55-0.90. Spammy.
 * WAVE 2109: Maps [0.25, 0.65] → [0.50, 0.80]. Tighter.
 *   strike=0.25 → conf=0.50 (bare minimum), strike=0.40 → conf=0.59, strike=0.55 → conf=0.69
 *   This means only strong strikes (>0.30) actually pass DecisionMaker's 0.50 gate.
 * For hold/prepare, use the old gap-based formula (we WANT low confidence for holds).
 */
function calculateConfidence(outputs) {
    const values = [outputs.forceStrike, outputs.strike, outputs.prepare, outputs.hold];
    const max = Math.max(...values);
    const secondMax = values.filter(v => v !== max).reduce((a, b) => Math.max(a, b), 0);
    // Gap entre el primero y el segundo
    const gap = max - secondMax;
    // If strike is the winner, confidence = the strike score itself (0-1 range)
    // This means strike=0.38 → conf=0.38, which after mood (÷1.20) = 0.317
    // Still needs to pass DecisionMaker's 0.50 check. So we scale it.
    // 🩸 WAVE 2109: Tighter mapping. strike=0.30→conf=0.51, strike=0.45→conf=0.65
    if (outputs.strike === max && outputs.strike > outputs.hold) {
        // Map strike [0.25, 0.65] → confidence [0.50, 0.80]
        const normalizedStrike = Math.min(1, Math.max(0, (outputs.strike - 0.25) / 0.40));
        return 0.50 + normalizedStrike * 0.30;
    }
    if (outputs.forceStrike === max && outputs.forceStrike > 0.3) {
        return 0.80 + outputs.forceStrike * 0.20;
    }
    // For prepare/hold: original formula (low confidence is fine)
    return (max + gap) / 2;
}
/**
 * Genera razonamiento humano-legible
 */
function generateReasoning(action, dominantRule, outputs, activations) {
    const topRules = activations.slice(0, 3).map(a => `${a.rule}(${a.activation.toFixed(2)})`).join(', ');
    const actionLabels = {
        force_strike: '⚡ FORCE_STRIKE',
        strike: '🎯 STRIKE',
        prepare: '🔮 PREPARE',
        hold: '😴 HOLD',
    };
    return `${actionLabels[action]} via [${dominantRule}] | ` +
        `Scores: F=${outputs.forceStrike.toFixed(2)} S=${outputs.strike.toFixed(2)} ` +
        `P=${outputs.prepare.toFixed(2)} H=${outputs.hold.toFixed(2)} | ` +
        `Top: ${topRules}`;
}
// ═══════════════════════════════════════════════════════════════════════════
// API PÚBLICA
// ═══════════════════════════════════════════════════════════════════════════
/**
 * 🎸 EVALUAR: El método principal del FuzzyDecisionMaker
 *
 * @param input - Valores crisp del estado actual
 * @returns Decisión fuzzy con acción, intensidad, confianza y razonamiento
 *
 * @example
 * ```ts
 * const decision = fuzzyEvaluate({
 *   energy: 0.85,
 *   zScore: 3.2,
 *   sectionType: 'drop',
 *   harshness: 0.7,
 *   huntScore: 0.9,
 *   beauty: 0.6,
 * })
 * // → { action: 'force_strike', intensity: 0.95, confidence: 0.88, ... }
 * ```
 */
export function fuzzyEvaluate(input) {
    // STEP 1: Fuzzificar inputs
    const fuzzyInputs = fuzzify(input);
    // STEP 2: Evaluar reglas
    const { outputs, activations } = evaluateRules(fuzzyInputs);
    // STEP 3: Defuzzificar
    const decision = defuzzify(outputs, activations);
    return decision;
}
/**
 * 🔬 DEBUG: Exponer fuzzificación para inspección
 */
export function debugFuzzify(input) {
    return fuzzify(input);
}
/**
 * 📜 Obtener todas las reglas (para debug/documentación)
 */
export function getFuzzyRules() {
    return FUZZY_RULES.map(r => ({
        name: r.name,
        output: r.consequent,
        weight: r.weight,
    }));
}
// ═══════════════════════════════════════════════════════════════════════════
// CLASE WRAPPER (Opcional - para quienes prefieren OOP)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * 🧬 FuzzyDecisionMaker Class
 * Wrapper OOP sobre las funciones puras
 *
 * WAVE 700.1: Integrado con MoodController
 * - El mood modifica los umbrales de decisión
 * - CALM necesita scores MÁS ALTOS para disparar
 * - PUNK dispara con scores MÁS BAJOS
 */
export class FuzzyDecisionMaker {
    constructor() {
        this.lastDecision = null;
        this.frameCount = 0;
        this.LOG_INTERVAL = 60; // Log cada 60 frames (~1 segundo)
        this.moodController = MoodController.getInstance();
    }
    /**
     * Evalúa el estado actual y retorna una decisión fuzzy
     *
     * WAVE 700.1: La decisión ahora pasa por el MoodController que:
     * 1. Aplica threshold multiplier al score efectivo
     * 2. Aplica intensity limits (min/max)
     */
    evaluate(input) {
        // STEP 1-3: Fuzzy evaluation (sin cambios)
        const rawDecision = fuzzyEvaluate(input);
        // STEP 4: 🎭 WAVE 700.1 - MOOD MODIFICATION
        const decision = this.applyMoodModifiers(rawDecision);
        this.lastDecision = decision;
        this.frameCount++;
        // Debug log periódico
        if (this.frameCount % this.LOG_INTERVAL === 0) {
            this.logDecision(input, decision);
        }
        return decision;
    }
    /**
     * 🎭 WAVE 700.1: Aplica los modificadores del mood a la decisión
     *
     * El mood modifica:
     * 1. El "score efectivo" - decide si la acción realmente se ejecuta
     * 2. La intensidad - clamp a min/max del mood
     *
     * JERARQUÍA: El Mood NO puede hacer legal lo ilegal (Vibe Shield es supremo)
     * Pero SÍ puede hacer que decisiones "strike" se conviertan en "hold"
     */
    applyMoodModifiers(decision) {
        const profile = this.moodController.getCurrentProfile();
        // El score que determina si realmente actuamos
        // Usamos la confianza como proxy del "score" de la decisión
        const rawScore = decision.confidence;
        const effectiveScore = this.moodController.applyThreshold(rawScore);
        // ═══════════════════════════════════════════════════════════════════════
        // LÓGICA DE DOWNGRADE POR MOOD
        // ═══════════════════════════════════════════════════════════════════════
        // 
        // Si el effectiveScore cae por debajo de ciertos umbrales,
        // la acción se "degrada" a una menos intensa.
        //
        // CALM mode puede convertir:
        //   - strike → prepare (si el score no es suficiente)
        //   - prepare → hold (si el score no es suficiente)
        //
        // PUNK mode casi nunca degrada (threshold 0.6 amplifica los scores)
        // ═══════════════════════════════════════════════════════════════════════
        let finalAction = decision.action;
        let wasDowngraded = false;
        // 🎯 WAVE 1176: OPERATION SNIPER - Umbrales más exigentes
        // 🩸 WAVE 2108→2109: strike threshold rebalanced.
        //   WAVE 2108: 0.60→0.40. Log showed 16 strikes, most passing easily.
        //   WAVE 2109: 0.40→0.50. With tighter confidence mapping [0.50-0.80],
        //   effectiveScore = conf/1.20 (BALANCED). conf=0.55→eff=0.458 → FAILS.
        //   conf=0.62→eff=0.517 → PASSES. Only strong Fuzzy strikes survive.
        const THRESHOLDS = {
            force_strike: 0.7, // Necesitas score alto para force_strike
            strike: 0.50, // 🩸 WAVE 2109: 0.40→0.50. Needs conf≥0.60 raw in BALANCED.
            prepare: 0.35, // 🎯 WAVE 1176: SUBIDO de 0.3 (Más exigente)
            hold: 0.0, // Hold siempre pasa
        };
        // Verificar si el effectiveScore pasa el umbral para la acción actual
        if (decision.action !== 'hold') {
            const requiredThreshold = THRESHOLDS[decision.action];
            if (effectiveScore < requiredThreshold) {
                wasDowngraded = true;
                // Degradar a la siguiente acción más baja
                if (decision.action === 'force_strike') {
                    // ¿Pasa para strike?
                    if (effectiveScore >= THRESHOLDS.strike) {
                        finalAction = 'strike';
                    }
                    else if (effectiveScore >= THRESHOLDS.prepare) {
                        finalAction = 'prepare';
                    }
                    else {
                        finalAction = 'hold';
                    }
                }
                else if (decision.action === 'strike') {
                    // ¿Pasa para prepare?
                    if (effectiveScore >= THRESHOLDS.prepare) {
                        finalAction = 'prepare';
                    }
                    else {
                        finalAction = 'hold';
                    }
                }
                else if (decision.action === 'prepare') {
                    finalAction = 'hold';
                }
            }
        }
        // ═══════════════════════════════════════════════════════════════════════
        // MODIFICAR INTENSIDAD
        // ═══════════════════════════════════════════════════════════════════════
        const finalIntensity = this.moodController.applyIntensity(decision.intensity);
        // ═══════════════════════════════════════════════════════════════════════
        // CONSTRUIR DECISIÓN MODIFICADA
        // ═══════════════════════════════════════════════════════════════════════
        // Si hubo degradación, actualizar el reasoning
        let finalReasoning = decision.reasoning;
        if (wasDowngraded) {
            const moodEmoji = profile.emoji;
            finalReasoning = `${moodEmoji} [MOOD:${profile.name.toUpperCase()}] ` +
                `Downgraded ${decision.action} → ${finalAction} ` +
                `(effectiveScore=${effectiveScore.toFixed(2)} < threshold=${THRESHOLDS[decision.action]}) | ` +
                `Original: ${decision.reasoning}`;
        }
        return {
            ...decision,
            action: finalAction,
            intensity: finalIntensity,
            reasoning: finalReasoning,
            // Añadir metadata del mood para debugging
            _moodModified: wasDowngraded,
            _moodProfile: profile.name,
            _effectiveScore: effectiveScore,
        };
    }
    /**
     * Obtiene la última decisión tomada
     */
    getLastDecision() {
        return this.lastDecision;
    }
    /**
     * Log de debug formateado
     */
    logDecision(input, decision) {
        const emoji = {
            force_strike: '⚡',
            strike: '🎯',
            prepare: '🔮',
            hold: '😴',
        }[decision.action];
        const mood = this.moodController.getCurrentProfile();
        console.log(`[FUZZY ${emoji}] ${decision.action.toUpperCase()} ` +
            `| E=${input.energy.toFixed(2)} Z=${input.zScore.toFixed(1)}σ ` +
            `| Conf=${decision.confidence.toFixed(2)} Int=${decision.intensity.toFixed(2)} ` +
            `| ${decision.dominantRule} ` +
            `| ${mood.emoji} MOOD:${mood.name.toUpperCase()}`);
    }
    /**
     * Reset del estado (para cambio de canción)
     */
    reset() {
        this.lastDecision = null;
        this.frameCount = 0;
    }
}

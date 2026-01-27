/**
 * 🔮 EFFECT DREAM SIMULATOR
 * "El Oráculo que ve el futuro de los efectos"
 *
 * WAVE 900.1 - Phase 1: Foundation
 * WAVE 920.2 - Mood integration (pre-filtering blocked effects)
 * WAVE 970 - 🧬 CONTEXTUAL DNA: Relevancia contextual reemplaza belleza hardcodeada
 *
 * @module EffectDreamSimulator
 * @description Sistema de simulación predictiva para efectos visuales.
 *              Simula múltiples escenarios de efectos y rankea por RELEVANCIA CONTEXTUAL,
 *              riesgo, coherencia de vibe y diversidad.
 *
 * RESPONSABILIDADES:
 * - Simular escenarios de efectos (no solo color como ScenarioSimulator)
 * - 🧬 WAVE 970: Predecir RELEVANCIA (no belleza) usando DNA matching
 * - Calcular risk level (GPU load, audience fatiga, cooldowns)
 * - Detectar conflictos de cooldown
 * - Mirar 4 compases adelante (musical prediction)
 * - Rankear escenarios por ADECUACIÓN CONTEXTUAL
 * - 🎭 WAVE 920.2: Pre-filtrar efectos bloqueados por mood
 *
 * FILOSOFÍA:
 * "Soñar antes de actuar. Ver el futuro antes de decidir."
 *
 * 🧬 WAVE 970 PHILOSOPHY:
 * "Selene no busca belleza. Selene busca VERDAD."
 * Un efecto no es "bonito" o "feo" - es ADECUADO o INADECUADO para el contexto.
 *
 * @author PunkOpus (Opus 4.5)
 * @date 2026-01-21
 */
// 🎭 WAVE 920.2: MOOD INTEGRATION
import { MoodController } from '../../mood/MoodController';
// 🧬 WAVE 970: CONTEXTUAL DNA SYSTEM
import { getDNAAnalyzer, EFFECT_DNA_REGISTRY } from '../dna/EffectDNA';
// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// 🌀 WAVE 902: VOCABULARY SYNC - Real effect names only
// 🔫 WAVE 930.2: ARSENAL PESADO - GatlingRaid, SkySaw added
// ═══════════════════════════════════════════════════════════════════════════
// Efectos conocidos agrupados por categoría (SYNCED with EffectManager registry)
// 🎯 WAVE 902.1: TRUTH - Only 2 genres implemented (Latina + Techno)
const EFFECT_CATEGORIES = {
    'techno-industrial': [
        'industrial_strobe', // ✅ WAVE 780: The hammer
        'acid_sweep', // ✅ WAVE 780: The blade
        'cyber_dualism', // ✅ WAVE 810: The twins
        'gatling_raid', // ✅ WAVE 930: Machine gun PAR barrage
        'sky_saw', // ✅ WAVE 930: Aggressive mover cuts
        'abyssal_rise', // ⚡ WAVE 988 RECONECTADO: 5s epic rise (was 8s, excluded)
    ],
    // 🌫️ WAVE 938: ATMOSPHERIC ARSENAL (low-energy zones)
    // 🗑️ WAVE 986: static_pulse ELIMINADO - Reemplazado por binary_glitch
    // 🔮 WAVE 988: fiber_optics AÑADIDO (traveling ambient colors)
    'techno-atmospheric': [
        'void_mist', // ✅ WAVE 938: Purple fog breathing
        'digital_rain', // ✅ WAVE 938: Matrix flicker cyan/lime
        'deep_breath', // ✅ WAVE 938: Organic 4-bar breathing
        'binary_glitch', // ⚔️ WAVE 986: Digital stutter chaos
        'seismic_snap', // ⚔️ WAVE 986: Mechanical impact snap
        'fiber_optics', // 🔮 WAVE 988: Traveling ambient colors
    ],
    // ☢️ WAVE 988: EXTREME ARSENAL (peak/epic zones only)
    'techno-extreme': [
        'core_meltdown', // ☢️ WAVE 988: LA BESTIA - extreme strobe
    ],
    'latino-organic': [
        'solar_flare', // ✅ WAVE 600: Takeover
        'strobe_storm', // ✅ WAVE 680: Harsh (multi-genre, latina compatible)
        'strobe_burst', // ✅ WAVE 691: Rhythmic latina strobe
        'tidal_wave', // ✅ WAVE 680: Wave flow
        'ghost_breath', // ✅ WAVE 680: Soft breathing
        'tropical_pulse', // ✅ WAVE 692: Conga bursts
        'salsa_fire', // ✅ WAVE 692: Fire flicker
        'cumbia_moon', // ✅ WAVE 692: Moon glow
        'clave_rhythm', // ✅ WAVE 700.6: 3-2 pattern
        'corazon_latino' // ✅ WAVE 750: Heartbeat passion
    ]
    // 🚧 chill-ambient: NOT IMPLEMENTED YET
    // 🚧 pop-rock: NOT IMPLEMENTED YET
};
// Pesos de belleza por tipo de efecto (WAVE 902.1: TRUTH - Only Latina + Techno)
const EFFECT_BEAUTY_WEIGHTS = {
    // 🔪 TECHNO-INDUSTRIAL (6 effects - WAVE 996 FIX)
    'industrial_strobe': { base: 0.75, energyMultiplier: 1.2, technoBonus: 0.15 },
    'acid_sweep': { base: 0.78, energyMultiplier: 1.15, technoBonus: 0.13 },
    'cyber_dualism': { base: 0.65, energyMultiplier: 1.0, technoBonus: 0.10 },
    'gatling_raid': { base: 0.82, energyMultiplier: 1.35, technoBonus: 0.20 }, // 🔫 WAVE 930
    'sky_saw': { base: 0.76, energyMultiplier: 1.25, technoBonus: 0.16 }, // 🗡️ WAVE 930
    'abyssal_rise': { base: 0.88, energyMultiplier: 1.40, technoBonus: 0.22 }, // 🌊 WAVE 996: Epic 5s rise - high beauty
    // 🌫️ WAVE 938: ATMOSPHERIC ARSENAL (low-energy zones)
    'void_mist': { base: 0.55, energyMultiplier: 0.6, technoBonus: 0.08 }, // 🌫️ Fog - low energy beauty
    // 🗑️ WAVE 986: static_pulse ELIMINADO
    'digital_rain': { base: 0.60, energyMultiplier: 0.75, technoBonus: 0.09 }, // 💧 Matrix - cyber beauty
    'deep_breath': { base: 0.52, energyMultiplier: 0.5, technoBonus: 0.07 }, // 🫁 Breathing - zen beauty
    // ⚡ WAVE 977: LA FÁBRICA
    'ambient_strobe': { base: 0.62, energyMultiplier: 0.9, technoBonus: 0.11 }, // 📸 Camera flashes - mid beauty
    'sonar_ping': { base: 0.54, energyMultiplier: 0.55, technoBonus: 0.06 }, // 🔵 Submarine ping - subtle beauty
    // ⚔️ WAVE 986: ACTIVE REINFORCEMENTS
    'binary_glitch': { base: 0.72, energyMultiplier: 1.05, technoBonus: 0.14 }, // 💻 Digital stutter - chaos beauty
    'seismic_snap': { base: 0.74, energyMultiplier: 1.10, technoBonus: 0.15 }, // 💥 Mechanical snap - impact beauty
    // 🔮 WAVE 988: THE FINAL ARSENAL
    'fiber_optics': { base: 0.50, energyMultiplier: 0.4, technoBonus: 0.05 }, // 🌈 Traveling colors - ambient beauty
    'core_meltdown': { base: 0.95, energyMultiplier: 1.5, technoBonus: 0.25 }, // ☢️ LA BESTIA - maximum beauty
    // 🌴 LATINO-ORGANIC (14 effects - THE LATINO LADDER)
    // WAVE 1009.1: Añadidos amazon_mist, glitch_guaguanco, machete_spark, latina_meltdown
    // 👻 ZONA 1: SILENCE (0-15%)
    'ghost_breath': { base: 0.68, energyMultiplier: 0.95, latinoBonus: 0.10 },
    'amazon_mist': { base: 0.62, energyMultiplier: 0.85, latinoBonus: 0.08 }, // 🆕 Neblina amazónica
    // 🌙 ZONA 2: VALLEY (15-30%)
    'cumbia_moon': { base: 0.70, energyMultiplier: 1.00, latinoBonus: 0.11 },
    'tidal_wave': { base: 0.72, energyMultiplier: 1.05, latinoBonus: 0.12 },
    // 💓 ZONA 3: AMBIENT (30-45%)
    'corazon_latino': { base: 0.90, energyMultiplier: 1.4, latinoBonus: 0.25 },
    'strobe_burst': { base: 0.78, energyMultiplier: 1.22, latinoBonus: 0.16 },
    // 🥁 ZONA 4: GENTLE (45-60%)
    'clave_rhythm': { base: 0.74, energyMultiplier: 1.10, latinoBonus: 0.13 },
    'tropical_pulse': { base: 0.82, energyMultiplier: 1.25, latinoBonus: 0.17 },
    // ⚔️ ZONA 5: ACTIVE (60-75%)
    'glitch_guaguanco': { base: 0.75, energyMultiplier: 1.15, latinoBonus: 0.14 }, // 🆕 Guaguancó glitcheado
    'machete_spark': { base: 0.77, energyMultiplier: 1.18, latinoBonus: 0.15 }, // 🆕 Chispa de machete
    // 🔥 ZONA 6: INTENSE (75-90%)
    'salsa_fire': { base: 0.76, energyMultiplier: 1.15, latinoBonus: 0.14 },
    'solar_flare': { base: 0.85, energyMultiplier: 1.3, latinoBonus: 0.20 },
    // 💥 ZONA 7: PEAK (90-100%)
    'latina_meltdown': { base: 0.92, energyMultiplier: 1.45, latinoBonus: 0.24 }, // 🆕 LA BESTIA LATINA
    'strobe_storm': { base: 0.80, energyMultiplier: 1.25, latinoBonus: 0.18 }
};
// GPU cost por efecto (WAVE 902.1: TRUTH, WAVE 930.2: Arsenal added)
const EFFECT_GPU_COST = {
    // 🔪 TECHNO-INDUSTRIAL (Alta intensidad)
    'industrial_strobe': 0.25,
    'acid_sweep': 0.30,
    'cyber_dualism': 0.28,
    'gatling_raid': 0.35, // 🔫 Alto costo - muchos PARs disparando
    'sky_saw': 0.32, // 🗡️ Alto costo - movimiento agresivo
    'abyssal_rise': 0.28, // 🌊 WAVE 996: Medium-high - 5s epic ramp
    // 🌫️ WAVE 938: ATMOSPHERIC ARSENAL (Bajo costo - efectos suaves)
    'void_mist': 0.08, // 🌫️ Muy bajo - solo dimmer suave
    // 🗑️ WAVE 986: static_pulse ELIMINADO
    'digital_rain': 0.10, // 💧 Bajo - flicker ligero
    'deep_breath': 0.06, // 🫁 Muy bajo - solo breathing
    // ⚡ WAVE 977: LA FÁBRICA
    'ambient_strobe': 0.14, // 📸 Bajo - flashes dispersos
    'sonar_ping': 0.09, // 🔵 Muy bajo - ping secuencial
    // ⚔️ WAVE 986: ACTIVE REINFORCEMENTS
    'binary_glitch': 0.15, // 💻 Bajo-medio - flashes rápidos
    'seismic_snap': 0.18, // 💥 Medio - flash + movement
    // 🔮 WAVE 988: THE FINAL ARSENAL
    'fiber_optics': 0.05, // 🌈 Muy bajo - solo colores viajando
    'core_meltdown': 0.40, // ☢️ ALTO - LA BESTIA consume GPU
    // 🌴 LATINO-ORGANIC (14 effects - THE LATINO LADDER)
    // WAVE 1009.1: Añadidos nuevos efectos
    // 👻 ZONA 1: SILENCE
    'ghost_breath': 0.12,
    'amazon_mist': 0.08, // 🆕 Muy bajo - neblina suave
    // 🌙 ZONA 2: VALLEY
    'cumbia_moon': 0.08,
    'tidal_wave': 0.10,
    // 💓 ZONA 3: AMBIENT
    'corazon_latino': 0.24,
    'strobe_burst': 0.28,
    // 🥁 ZONA 4: GENTLE
    'clave_rhythm': 0.15,
    'tropical_pulse': 0.20,
    // ⚔️ ZONA 5: ACTIVE
    'glitch_guaguanco': 0.22, // 🆕 Medio - glitches + groove
    'machete_spark': 0.25, // 🆕 Medio-alto - chispas
    // 🔥 ZONA 6: INTENSE
    'salsa_fire': 0.18,
    'solar_flare': 0.22,
    // 💥 ZONA 7: PEAK
    'latina_meltdown': 0.38, // 🆕 ALTO - LA BESTIA LATINA
    'strobe_storm': 0.32
};
// Fatigue impact por efecto (WAVE 902.1: TRUTH, WAVE 930.2: Arsenal added)
const EFFECT_FATIGUE_IMPACT = {
    // 🔪 TECHNO-INDUSTRIAL (Aumenta fatiga)
    'industrial_strobe': 0.08,
    'acid_sweep': 0.07,
    'cyber_dualism': 0.06,
    'gatling_raid': 0.10, // 🔫 Alta fatiga - muy intenso
    'sky_saw': 0.08, // 🗡️ Alta fatiga - movimiento agresivo
    'abyssal_rise': 0.04, // 🌊 WAVE 996: Low fatigue - epic build creates anticipation, not exhaustion
    // 🌫️ WAVE 938: ATMOSPHERIC ARSENAL (REDUCE fatiga - efectos relajantes)
    'void_mist': -0.04, // 🌫️ Reduce fatiga - ambiente zen
    // 🗑️ WAVE 986: static_pulse ELIMINADO
    'digital_rain': -0.02, // 💧 Reduce fatiga - hipnótico
    'deep_breath': -0.05, // 🫁 Muy relajante - máxima reducción
    // ⚡ WAVE 977: LA FÁBRICA
    'ambient_strobe': 0.03, // 📸 Leve fatiga - flashes moderados
    'sonar_ping': -0.03, // 🔵 Reduce fatiga - efecto zen/submarino
    // ⚔️ WAVE 986: ACTIVE REINFORCEMENTS
    'binary_glitch': 0.04, // 💻 Leve fatiga - glitches cortos
    'seismic_snap': 0.05, // 💥 Moderada fatiga - golpe seco
    // 🔮 WAVE 988: THE FINAL ARSENAL
    'fiber_optics': -0.06, // 🌈 Reduce fatiga - efecto hipnótico zen
    'core_meltdown': 0.15, // ☢️ ALTA fatiga - LA BESTIA agota
    // 🌴 LATINO-ORGANIC (14 effects - THE LATINO LADDER)
    // WAVE 1009.1: Añadidos nuevos efectos
    // 👻 ZONA 1: SILENCE (REDUCE FATIGA - muy relajante)
    'ghost_breath': -0.02, // Breathing, reduce fatiga
    'amazon_mist': -0.04, // 🆕 Neblina zen, reduce fatiga
    // 🌙 ZONA 2: VALLEY (REDUCE FATIGA - suaves)
    'cumbia_moon': -0.03, // Moon glow, reduce fatiga
    'tidal_wave': -0.01, // Suave, reduce fatiga
    // 💓 ZONA 3: AMBIENT (NEUTRAL)
    'corazon_latino': 0.05,
    'strobe_burst': 0.07,
    // 🥁 ZONA 4: GENTLE (LEVE AUMENTO)
    'clave_rhythm': 0.02,
    'tropical_pulse': 0.04,
    // ⚔️ ZONA 5: ACTIVE (MODERADO AUMENTO)
    'glitch_guaguanco': 0.05, // 🆕 Moderada - groove frenético
    'machete_spark': 0.06, // 🆕 Moderada - chispas rítmicas
    // 🔥 ZONA 6: INTENSE (AUMENTO)
    'salsa_fire': 0.03,
    'solar_flare': 0.06,
    // 💥 ZONA 7: PEAK (ALTA FATIGA)
    'latina_meltdown': 0.12, // 🆕 ALTA - LA BESTIA LATINA agota
    'strobe_storm': 0.09
};
// ═══════════════════════════════════════════════════════════════
// EFFECT DREAM SIMULATOR
// ═══════════════════════════════════════════════════════════════
export class EffectDreamSimulator {
    constructor() {
        this.simulationCount = 0;
        console.log('[DREAM_SIMULATOR] 🔮 Initialized');
    }
    // ═══════════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════════
    /**
     * Simula múltiples escenarios de efectos y rankea por belleza
     */
    async dreamEffects(currentState, musicalPrediction, context) {
        const startTime = Date.now();
        this.simulationCount++;
        console.log(`[DREAM_SIMULATOR] 🔮 Dream #${this.simulationCount} - Exploring futures...`);
        // 1. Generar candidatos basados en vibe y prediction
        const candidates = this.generateCandidates(currentState, musicalPrediction, context);
        console.log(`[DREAM_SIMULATOR] 📊 Generated ${candidates.length} candidates`);
        // 2. Simular cada escenario
        const scenarios = [];
        for (const candidate of candidates) {
            const scenario = this.simulateScenario(candidate, currentState, context);
            scenarios.push(scenario);
        }
        // 3. Rankear escenarios
        const rankedScenarios = this.rankScenarios(scenarios, musicalPrediction);
        // 4. Seleccionar mejor escenario
        const bestScenario = rankedScenarios[0] || null;
        // 5. Generar recomendación
        const recommendation = this.generateRecommendation(bestScenario, context);
        // 6. Detectar warnings
        const warnings = this.detectWarnings(rankedScenarios, context);
        const simulationTimeMs = Date.now() - startTime;
        console.log(`[DREAM_SIMULATOR] ✨ Dream complete in ${simulationTimeMs}ms`);
        if (bestScenario) {
            console.log(`[DREAM_SIMULATOR] 🎯 Best: ${bestScenario.effect.effect} (beauty: ${bestScenario.projectedBeauty.toFixed(2)}, risk: ${bestScenario.riskLevel.toFixed(2)})`);
        }
        return {
            scenarios: rankedScenarios,
            bestScenario,
            recommendation: recommendation.action,
            reason: recommendation.reason,
            warnings,
            simulationTimeMs
        };
    }
    /**
     * Simula UN escenario específico (para evaluación rápida)
     */
    simulateScenario(effect, currentState, context) {
        // Proyectar belleza
        const projectedBeauty = this.projectBeauty(effect, currentState, context);
        const beautyDelta = projectedBeauty - currentState.currentBeauty;
        // Calcular riesgo
        const riskLevel = this.calculateRisk(effect, currentState, context);
        // Proyectar consonancia (coherencia con estado anterior)
        const projectedConsonance = this.projectConsonance(effect, currentState);
        // Impacto en GPU
        const gpuLoadImpact = this.calculateGpuImpact(effect, context);
        // Impacto en fatiga de audiencia
        const audienceFatigueImpact = this.calculateFatigueImpact(effect, context);
        // Detectar conflictos
        const cooldownConflicts = this.detectCooldownConflicts(effect, currentState);
        const hardwareConflicts = this.detectHardwareConflicts(effect, context);
        // Coherencia con vibe
        const vibeCoherence = this.calculateVibeCoherence(effect, context);
        // Score de diversidad
        const diversityScore = this.calculateDiversityScore(effect, context);
        // Confianza en simulación
        const simulationConfidence = this.calculateSimulationConfidence(effect, currentState, context);
        // 🧬 WAVE 970: DNA-based contextual relevance
        const { relevance: projectedRelevance, distance: dnaDistance, targetDNA } = this.calculateDNARelevance(effect, currentState, context);
        return {
            effect,
            projectedBeauty,
            projectedRelevance, // 🧬 WAVE 970: DNA relevance (replaces beauty as primary)
            beautyDelta,
            riskLevel,
            dnaDistance, // 🧬 WAVE 970: Euclidean distance to target DNA
            targetDNA, // 🧬 WAVE 970: For debugging/logging
            projectedConsonance,
            gpuLoadImpact,
            audienceFatigueImpact,
            cooldownConflicts,
            hardwareConflicts,
            vibeCoherence,
            diversityScore,
            simulationConfidence
        };
    }
    /**
     * Explora efectos alternativos (similar a hue shifts pero para efectos)
     */
    exploreAlternatives(primaryEffect, context) {
        const alternatives = [];
        // Encontrar categoría del efecto primario
        let category = null;
        for (const [cat, effects] of Object.entries(EFFECT_CATEGORIES)) {
            if (effects.includes(primaryEffect.effect)) {
                category = cat;
                break;
            }
        }
        if (!category) {
            console.warn(`[DREAM_SIMULATOR] ⚠️ Unknown category for ${primaryEffect.effect}`);
            return [];
        }
        // Generar alternativas de la misma categoría
        const categoryEffects = EFFECT_CATEGORIES[category];
        for (const effect of categoryEffects) {
            if (effect === primaryEffect.effect)
                continue;
            alternatives.push({
                effect,
                intensity: primaryEffect.intensity * 0.9, // Ligeramente menor
                zones: primaryEffect.zones,
                reasoning: `Alternative to ${primaryEffect.effect} (same category)`,
                confidence: primaryEffect.confidence * 0.8
            });
        }
        return alternatives;
    }
    // ═══════════════════════════════════════════════════════════════
    // PRIVATE: CANDIDATE GENERATION
    // ═══════════════════════════════════════════════════════════════
    /**
     * 🛡️ WAVE 975: VIBE SHIELD
     *
     * Solo efectos permitidos para el VIBE actual.
     * industrial_strobe NUNCA aparece en fiesta-latina.
     * cumbia_moon NUNCA aparece en techno-club.
     */
    getVibeAllowedEffects(vibe) {
        const EFFECTS_BY_VIBE = {
            // 🔪 TECHNO CLUB: El Arsenal Industrial
            // 🗑️ WAVE 986: static_pulse ELIMINADO, binary_glitch y seismic_snap AÑADIDOS
            // 🎚️ WAVE 996: THE LADDER - 16 efectos techno totales
            'techno-club': [
                // PEAK (90-100%)
                'industrial_strobe', // El martillo
                'gatling_raid', // Machine gun
                'core_meltdown', // ☢️ WAVE 988: LA BESTIA
                // INTENSE (75-90%)
                'sky_saw', // Cortes agresivos
                'abyssal_rise', // �️ WAVE 930: Epic rise
                // ACTIVE (60-75%)
                'cyber_dualism', // Ping-pong L/R
                'seismic_snap', // ⚔️ WAVE 986: Golpe mecánico
                // GENTLE (45-60%)
                'ambient_strobe', // ⚡ WAVE 977: Flashes dispersos
                'binary_glitch', // ⚔️ WAVE 986: Tartamudeo digital
                // AMBIENT (30-45%)
                'acid_sweep', // Sweeps volumétricos
                'digital_rain', // Matrix flicker
                // VALLEY (15-30%)
                'void_mist', // 🌫️ WAVE 938: Neblina púrpura
                'fiber_optics', // 🔮 WAVE 988: Traveling colors
                // SILENCE (0-15%)
                'deep_breath', // 🫁 Respiración orgánica
                'sonar_ping', // ⚡ WAVE 977: Ping submarino
            ],
            // Aliases para techno
            'techno': [
                'industrial_strobe', 'gatling_raid', 'core_meltdown',
                'sky_saw', 'abyssal_rise',
                'cyber_dualism', 'seismic_snap',
                'ambient_strobe', 'binary_glitch',
                'acid_sweep', 'digital_rain',
                'void_mist', 'fiber_optics',
                'deep_breath', 'sonar_ping'
            ],
            'industrial': [
                'industrial_strobe', 'gatling_raid', 'core_meltdown',
                'sky_saw', 'abyssal_rise',
                'cyber_dualism', 'seismic_snap',
                'ambient_strobe', 'binary_glitch',
                'acid_sweep', 'digital_rain',
                'void_mist', 'fiber_optics',
                'deep_breath', 'sonar_ping'
            ],
            // 🎺 FIESTA LATINA: El Arsenal Tropical Completo (14 efectos)
            // WAVE 1009.1: Añadidos los 5 efectos faltantes de THE LATINO LADDER
            'fiesta-latina': [
                // 👻 ZONA 1: SILENCE (0-15%)
                'ghost_breath', // Respiro suave (A=0.12)
                'amazon_mist', // Neblina amazónica (A=0.10)
                // 🌙 ZONA 2: VALLEY (15-30%)
                'cumbia_moon', // Luna cumbianchera (A=0.25)
                'tidal_wave', // Ola oceánica (A=0.28)
                // 💓 ZONA 3: AMBIENT (30-45%)
                'corazon_latino', // El alma del arquitecto (A=0.38)
                'strobe_burst', // Destello rítmico (A=0.42)
                // 🥁 ZONA 4: GENTLE (45-60%)
                'clave_rhythm', // Ritmo de clave (A=0.52)
                'tropical_pulse', // Pulso de conga (A=0.55)
                // ⚔️ ZONA 5: ACTIVE (60-75%)
                'glitch_guaguanco', // 🆕 Guaguancó glitcheado (A=0.68)
                'machete_spark', // 🆕 Chispa de machete (A=0.72)
                // 🔥 ZONA 6: INTENSE (75-90%)
                'salsa_fire', // Fuego salsero (A=0.82)
                'solar_flare', // Explosión solar (A=0.85)
                // 💥 ZONA 7: PEAK (90-100%)
                'latina_meltdown', // 🆕 Meltdown latino (A=0.92)
                'strobe_storm', // 🆕 Tormenta estroboscópica (A=0.95)
            ],
            // Aliases para latino (FULL ARSENAL)
            'latino': [
                'ghost_breath', 'amazon_mist',
                'cumbia_moon', 'tidal_wave',
                'corazon_latino', 'strobe_burst',
                'clave_rhythm', 'tropical_pulse',
                'glitch_guaguanco', 'machete_spark',
                'salsa_fire', 'solar_flare',
                'latina_meltdown', 'strobe_storm'
            ],
            'tropical': [
                'ghost_breath', 'amazon_mist',
                'cumbia_moon', 'tidal_wave',
                'corazon_latino', 'strobe_burst',
                'clave_rhythm', 'tropical_pulse',
                'glitch_guaguanco', 'machete_spark',
                'salsa_fire', 'solar_flare',
                'latina_meltdown', 'strobe_storm'
            ],
        };
        // Buscar match exacto
        if (EFFECTS_BY_VIBE[vibe]) {
            return EFFECTS_BY_VIBE[vibe];
        }
        // Buscar match parcial (contiene)
        if (vibe.includes('techno') || vibe.includes('industrial')) {
            return EFFECTS_BY_VIBE['techno-club'];
        }
        if (vibe.includes('latin') || vibe.includes('latino') || vibe.includes('tropical') || vibe.includes('fiesta')) {
            return EFFECTS_BY_VIBE['fiesta-latina'];
        }
        // Default: todas (vibe desconocido)
        console.warn(`[DREAM_SIMULATOR] ⚠️ Unknown vibe: ${vibe}, allowing all effects`);
        return Object.values(EFFECTS_BY_VIBE).flat();
    }
    /**
     * 🧘 WAVE 975: ZONE AWARENESS
     * 🔥 WAVE 982: ZONE FILTER RECALIBRATION - Post Peak Hold
     *
     * Filtra efectos por zona energética usando DNA Aggression.
     *
     * FILOSOFÍA DE DISEÑO:
     * - DigitalRain (A=0.35): Efecto AMBIENTAL, no debe aparecer en drops pesados
     * - Gatling (A=0.90): AMETRALLADORA para builds finales y peaks ultra-rápidos
     *
     * AJUSTES POST-PEAK HOLD (WAVE 980.4):
     * - Zonas energéticas: active (0.82), intense (0.92), peak (≥0.92)
     * - Techno builds pre-drop (E=0.78-0.82) están en 'active'
     *
     * PROBLEMA DETECTADO (WAVE 982):
     * - Gatling (A=0.90) bloqueado en 'active' (max era 0.85)
     * - Builds intensos (E=0.80) = zona 'active' pero necesitan Gatling
     *
     * SOLUCIÓN:
     * - 'active': max 0.85 → 0.95 (GATLING entra en builds)
     * - 'intense': min 0.45 SIN CAMBIOS (DigitalRain correctamente bloqueado)
     */
    filterByZone(effects, zone) {
        // 🎚️ WAVE 996: THE LADDER OVERRIDES - Rangos ampliados para no competir con ContextualEffectSelector
        // THE LADDER ya hace la clasificación correcta en ContextualEffectSelector.
        // Aquí solo filtramos extremos obvios (no poner strobe pesado en silence).
        const aggressionLimits = {
            'silence': { min: 0, max: 0.30 }, // Solo efectos muy suaves
            'valley': { min: 0, max: 0.50 }, // Suaves + algo de respiración
            'ambient': { min: 0, max: 0.70 }, // Moderados (ampliar para digital_rain + acid_sweep)
            'gentle': { min: 0, max: 0.85 }, // Transición amplia (incluir ambient_strobe, binary_glitch)
            'active': { min: 0.20, max: 1.00 }, // Libertad casi total (cyber_dualism, seismic_snap)
            'intense': { min: 0.45, max: 1.00 }, // Agresivos completos (sky_saw, abyssal_rise)
            'peak': { min: 0.70, max: 1.00 }, // Solo los más brutales (gatling, core_meltdown, industrial)
        };
        const limits = aggressionLimits[zone] || { min: 0, max: 1 };
        const filtered = effects.filter(effect => {
            const dna = EFFECT_DNA_REGISTRY[effect];
            if (!dna) {
                console.warn(`[DREAM_SIMULATOR] ⚠️ No DNA for effect: ${effect}`);
                return false;
            }
            return dna.aggression >= limits.min && dna.aggression <= limits.max;
        });
        // Si el filtro es demasiado estricto y no queda nada, relajar
        if (filtered.length === 0) {
            console.log(`[DREAM_SIMULATOR] 🧘 Zone ${zone} filter too strict (limits: ${limits.min}-${limits.max}), returning suavest available`);
            // Devolver los 3 efectos con menor agresión de la lista original
            return effects
                .filter(e => EFFECT_DNA_REGISTRY[e])
                .sort((a, b) => EFFECT_DNA_REGISTRY[a].aggression - EFFECT_DNA_REGISTRY[b].aggression)
                .slice(0, 3);
        }
        return filtered;
    }
    /**
     * Helper para logging: muestra el rango de agresión de una zona
     * 🎚️ WAVE 996: Updated para THE LADDER - rangos ampliados
     */
    getZoneAggressionRange(zone) {
        const ranges = {
            'silence': '0-0.30',
            'valley': '0-0.50',
            'ambient': '0-0.70',
            'gentle': '0-0.85',
            'active': '0.20-1.00',
            'intense': '0.45-1.00',
            'peak': '0.70-1.00',
        };
        return ranges[zone] || '0-1.00';
    }
    /**
     * 🧘 WAVE 975: Deriva la zona energética del valor de energía (0-1)
     * Mismo mapeo que SeleneTitanConscious usa
     */
    deriveEnergyZone(energy) {
        if (energy < 0.10)
            return 'silence';
        if (energy < 0.25)
            return 'valley';
        if (energy < 0.40)
            return 'ambient';
        if (energy < 0.55)
            return 'gentle';
        if (energy < 0.70)
            return 'active';
        if (energy < 0.85)
            return 'intense';
        return 'peak';
    }
    generateCandidates(state, prediction, context) {
        const candidates = [];
        // 🛡️ WAVE 975: VIBE SHIELD - Solo efectos permitidos para este VIBE
        const vibeAllowedEffects = this.getVibeAllowedEffects(state.vibe);
        // � WAVE 975.5: ZONE UNIFICATION - Usar zona INYECTADA si está disponible
        // Si viene desde SeleneTitanConscious (source of truth), usarla
        // Si no, derivar localmente (fallback para compatibilidad)
        const energyZone = context.energyZone ?? this.deriveEnergyZone(context.energy);
        const zoneSource = context.energyZone ? 'SeleneTitanConscious' : 'local-fallback';
        const zoneFilteredEffects = this.filterByZone(vibeAllowedEffects, energyZone);
        console.log(`[DREAM_SIMULATOR] 🛡️ VIBE SHIELD: ${state.vibe} → ${vibeAllowedEffects.length} effects`);
        console.log(`[DREAM_SIMULATOR] 🧘 ZONE FILTER: ${energyZone} (E=${context.energy.toFixed(2)}, source=${zoneSource}) → ` +
            `${zoneFilteredEffects.length} effects (A=${this.getZoneAggressionRange(energyZone)})`);
        // 🎭 WAVE 920.2: Pre-filtrar efectos bloqueados por mood
        const moodController = MoodController.getInstance();
        const currentProfile = moodController.getCurrentProfile();
        let blockedCount = 0;
        let zoneBlockedCount = vibeAllowedEffects.length - zoneFilteredEffects.length;
        // Generar candidatos SOLO de efectos filtrados
        for (const effect of zoneFilteredEffects) {
            // 🎭 WAVE 920.2: Skip efectos bloqueados por mood (no gastar CPU simulando)
            if (moodController.isEffectBlocked(effect)) {
                blockedCount++;
                continue;
            }
            // Calcular intensidad basada en energía predicha
            const intensity = this.calculateIntensity(prediction.predictedEnergy, effect);
            candidates.push({
                effect,
                intensity,
                zones: ['all'], // Simplificado para Phase 1
                reasoning: `🧬 DNA Dream: vibe=${state.vibe} zone=${energyZone}`,
                confidence: prediction.confidence * 0.9 // Ligeramente menor que prediction
            });
        }
        if (blockedCount > 0) {
            console.log(`[DREAM_SIMULATOR] 🎭 Pre-filtered ${blockedCount} effects (blocked by ${currentProfile.emoji} mood)`);
        }
        if (zoneBlockedCount > 0) {
            console.log(`[DREAM_SIMULATOR] 🧘 Zone filtered ${zoneBlockedCount} effects (too aggressive/soft for ${energyZone})`);
        }
        return candidates;
    }
    calculateIntensity(predictedEnergy, effect) {
        // Intensidad base de la energía predicha
        let intensity = predictedEnergy;
        // Ajustar por tipo de efecto
        if (effect.includes('strobe') || effect.includes('laser')) {
            // Efectos agresivos usan full energy
            intensity = Math.min(1.0, predictedEnergy * 1.1);
        }
        else if (effect.includes('wave') || effect.includes('cascade')) {
            // Efectos suaves usan menos energy
            intensity = predictedEnergy * 0.8;
        }
        return Math.max(0, Math.min(1, intensity));
    }
    // ═══════════════════════════════════════════════════════════════
    // 🦕 LEGACY: BEAUTY PROJECTION (WAVE 970: DEPRECADO)
    // ═══════════════════════════════════════════════════════════════
    // 
    // ⚠️ WAVE 970: Este método está DEPRECADO.
    // La "belleza" ya no es el criterio principal.
    // Usamos calculateDNARelevance() para matching contextual.
    // 
    // Este método se mantiene SOLO para:
    // 1. Compatibilidad con código legacy que espere projectedBeauty
    // 2. Período de transición mientras se valida el nuevo sistema
    // 
    // TODO WAVE 971+: Remover completamente una vez validado DNA system
    // ═══════════════════════════════════════════════════════════════
    projectBeauty(effect, state, context) {
        const weights = EFFECT_BEAUTY_WEIGHTS[effect.effect];
        if (!weights) {
            console.warn(`[DREAM_SIMULATOR] ⚠️ Unknown effect beauty weights: ${effect.effect}`);
            return 0.5; // Neutral
        }
        // Base beauty
        let beauty = weights.base;
        // Energy multiplier
        beauty *= (1 + (context.energy - 0.5) * (weights.energyMultiplier - 1));
        // Vibe bonus (WAVE 902.1: Only Techno + Latino implemented)
        if (context.vibe.includes('techno') && 'technoBonus' in weights) {
            beauty += weights.technoBonus;
        }
        else if (context.vibe.includes('latino') && 'latinoBonus' in weights) {
            beauty += weights.latinoBonus;
        }
        // Note: chillBonus removed - chill genre not implemented yet
        // Intensity factor
        beauty *= (0.7 + 0.3 * effect.intensity);
        // Current beauty influence (momentum)
        beauty = beauty * 0.7 + state.currentBeauty * 0.3;
        return Math.max(0, Math.min(1, beauty));
    }
    // ═══════════════════════════════════════════════════════════════
    // PRIVATE: RISK CALCULATION
    // ═══════════════════════════════════════════════════════════════
    calculateRisk(effect, state, context) {
        let risk = 0.0;
        // GPU overload risk
        const gpuCost = EFFECT_GPU_COST[effect.effect] || 0.15;
        const projectedGpuLoad = context.gpuLoad + gpuCost * effect.intensity;
        if (projectedGpuLoad > 0.8) {
            risk += 0.3; // High GPU risk
        }
        else if (projectedGpuLoad > 0.6) {
            risk += 0.1; // Moderate GPU risk
        }
        // Audience fatigue risk
        const fatigueImpact = EFFECT_FATIGUE_IMPACT[effect.effect] || 0.05;
        const projectedFatigue = context.audienceFatigue + fatigueImpact * effect.intensity;
        if (projectedFatigue > 0.8) {
            risk += 0.4; // High fatigue risk
        }
        else if (projectedFatigue > 0.6) {
            risk += 0.2; // Moderate fatigue risk
        }
        // Epilepsy risk (strobes en epilepsy mode)
        if (context.epilepsyMode && effect.effect.includes('strobe')) {
            risk += 0.5; // Critical risk
        }
        // Cooldown violation risk
        if (state.activeCooldowns.has(effect.effect)) {
            risk += 0.2;
        }
        // Intensity risk (muy alto = arriesgado)
        if (effect.intensity > 0.9) {
            risk += 0.1;
        }
        return Math.min(1.0, risk);
    }
    // ═══════════════════════════════════════════════════════════════
    // PRIVATE: OTHER PROJECTIONS
    // ═══════════════════════════════════════════════════════════════
    projectConsonance(effect, state) {
        // Si no hay efecto anterior, consonancia neutral
        if (!state.lastEffect)
            return 0.7;
        // Mismo efecto = alta consonancia (pero puede ser monotonía)
        if (effect.effect === state.lastEffect)
            return 0.9;
        // Efectos de misma categoría = moderada consonancia
        for (const effects of Object.values(EFFECT_CATEGORIES)) {
            const effectList = effects;
            if (effectList.includes(effect.effect) &&
                effectList.includes(state.lastEffect)) {
                return 0.7;
            }
        }
        // Efectos de categoría diferente = baja consonancia (puede ser bueno o malo)
        return 0.4;
    }
    // ═══════════════════════════════════════════════════════════════
    // 🧬 WAVE 970: DNA-BASED CONTEXTUAL RELEVANCE
    // ═══════════════════════════════════════════════════════════════
    /**
     * Calcula la relevancia contextual de un efecto usando DNA matching.
     * Reemplaza el antiguo sistema de "belleza" con algo más inteligente.
     *
     * @returns { relevance: 0-1, distance: 0-√3, targetDNA: TargetDNA }
     */
    calculateDNARelevance(effect, state, context) {
        // Obtener el DNA del efecto del registry
        const effectDNA = EFFECT_DNA_REGISTRY[effect.effect];
        // Si no existe en el registry, usar valores neutros (wildcard)
        if (!effectDNA) {
            console.warn(`[DREAM_SIMULATOR] ⚠️ Effect ${effect.effect} not in DNA registry, using neutral DNA`);
            return {
                relevance: 0.50, // Neutral
                distance: 0.866, // √3/2 = centro del espacio
                targetDNA: { aggression: 0.5, chaos: 0.5, organicity: 0.5, confidence: 0.5 }
            };
        }
        // Construir MusicalContext para el DNAAnalyzer
        // Derivamos todo lo que podemos de AudienceSafetyContext + SystemState
        const musicalContext = {
            energy: state.energy,
            syncopation: undefined, // No disponible directamente
            mood: this.deriveMusicalMood(context),
            section: {
                type: this.deriveSection(state, context),
                confidence: 0.75
            },
            rhythm: {
                drums: {
                    kickIntensity: state.energy * 0.8 // Derivado de energía
                },
                fillDetected: false,
                groove: context.vibe.includes('latino') ? 0.8 : 0.5,
                confidence: 0.7
            },
            energyContext: {
                trend: state.energy > 0.5 ? 1 : state.energy < 0.3 ? -1 : 0
            },
            confidence: 0.75
        };
        // Construir AudioMetrics para el DNAAnalyzer
        const audioMetrics = {
            bass: state.energy * 0.7,
            mid: 0.5,
            treble: context.vibe.includes('techno') ? 0.6 : 0.4,
            volume: state.energy,
            harshness: context.vibe.includes('techno') ? 0.6 : 0.3,
            spectralFlatness: 0.5
        };
        // Usar el DNAAnalyzer singleton para derivar el Target DNA
        const dnaAnalyzer = getDNAAnalyzer();
        const targetDNA = dnaAnalyzer.deriveTargetDNA(musicalContext, audioMetrics);
        // Calcular distancia euclidiana 3D (effectDNA es directamente EffectDNA, no tiene .dna)
        const dA = effectDNA.aggression - targetDNA.aggression;
        const dC = effectDNA.chaos - targetDNA.chaos;
        const dO = effectDNA.organicity - targetDNA.organicity;
        const distance = Math.sqrt(dA * dA + dC * dC + dO * dO);
        // Convertir distancia a relevancia (0-1)
        // Distancia máxima teórica es √3 ≈ 1.732
        const MAX_DISTANCE = Math.sqrt(3);
        const relevance = 1.0 - (distance / MAX_DISTANCE);
        return { relevance, distance, targetDNA };
    }
    /**
     * 🧬 WAVE 970: Deriva mood musical del contexto de audiencia
     */
    deriveMusicalMood(context) {
        if (context.vibe.includes('techno'))
            return 'aggressive';
        if (context.vibe.includes('latino'))
            return 'euphoric';
        if (context.vibe.includes('chill') || context.vibe.includes('ambient'))
            return 'melancholic';
        return 'neutral';
    }
    /**
     * 🧬 WAVE 970: Deriva sección del estado actual
     */
    deriveSection(state, context) {
        // Derivación simple basada en energía
        if (state.energy > 0.85)
            return 'drop';
        if (state.energy > 0.65)
            return 'chorus';
        if (state.energy < 0.25)
            return 'breakdown';
        return 'verse';
    }
    calculateGpuImpact(effect, context) {
        const gpuCost = EFFECT_GPU_COST[effect.effect] || 0.15;
        return Math.min(1.0, gpuCost * effect.intensity);
    }
    calculateFatigueImpact(effect, context) {
        const fatigueImpact = EFFECT_FATIGUE_IMPACT[effect.effect] || 0.05;
        return fatigueImpact * effect.intensity;
    }
    detectCooldownConflicts(effect, state) {
        const conflicts = [];
        if (state.activeCooldowns.has(effect.effect)) {
            const remainingMs = state.activeCooldowns.get(effect.effect);
            conflicts.push(`${effect.effect} in cooldown (${(remainingMs / 1000).toFixed(1)}s remaining)`);
        }
        return conflicts;
    }
    detectHardwareConflicts(effect, context) {
        const conflicts = [];
        // GPU overload
        const gpuCost = EFFECT_GPU_COST[effect.effect] || 0.15;
        if (context.gpuLoad + gpuCost > 0.9) {
            conflicts.push('GPU overload risk');
        }
        // Epilepsy mode
        if (context.epilepsyMode && effect.effect.includes('strobe')) {
            conflicts.push('Epilepsy mode blocks strobes');
        }
        return conflicts;
    }
    calculateVibeCoherence(effect, context) {
        // WAVE 902.1: TRUTH - Only Techno + Latino implemented
        if (context.vibe.includes('techno')) {
            if (['industrial_strobe', 'acid_sweep', 'cyber_dualism'].includes(effect.effect)) {
                return 1.0;
            }
            else if (['solar_flare', 'tropical_pulse', 'salsa_fire', 'corazon_latino'].includes(effect.effect)) {
                return 0.0; // HEREJÍA - Latino en sesión Techno
            }
            return 0.5;
        }
        // WAVE 902.1: TRUTH - Latino effects (all 10)
        if (context.vibe.includes('latino')) {
            if (['solar_flare', 'strobe_storm', 'strobe_burst', 'tidal_wave', 'ghost_breath',
                'tropical_pulse', 'salsa_fire', 'cumbia_moon', 'clave_rhythm', 'corazon_latino'].includes(effect.effect)) {
                return 1.0;
            }
            return 0.6;
        }
        return 0.7; // Neutral para vibes desconocidos
    }
    calculateDiversityScore(effect, context) {
        // ═══════════════════════════════════════════════════════════════
        // 🔥 WAVE 982.5: DIVERSITY ENGINE - ESCALERA DE PENALIZACIÓN
        // ═══════════════════════════════════════════════════════════════
        // 🔍 WAVE 996.6: DEBUG - Ver historial recibido
        if (effect.effect === 'cyber_dualism') {
            console.log(`[DIVERSITY_DEBUG] 🔍 cyber_dualism: historySize=${context.recentEffects.length}, effects=[${context.recentEffects.map(e => e.effect).join(',')}]`);
        }
        // Contar uso reciente (últimos efectos en el historial)
        const recentUsage = context.recentEffects
            .filter(e => e.effect === effect.effect)
            .length;
        // 🎯 ESCALERA DE PENALIZACIÓN DIRECTA
        let diversityScore;
        switch (recentUsage) {
            case 0:
                diversityScore = 1.0; // ✅ Efecto fresco - sin penalización
                break;
            case 1:
                diversityScore = 0.7; // ⚠️ Usado 1x - 30% penalty
                break;
            case 2:
                diversityScore = 0.4; // 🟠 Usado 2x - 60% penalty
                break;
            default:
                diversityScore = 0.1; // 🔴 Usado 3+x - 90% SHADOWBAN
                break;
        }
        return diversityScore;
    }
    calculateSimulationConfidence(effect, state, context) {
        let confidence = 1.0;
        // Reducir confianza si poco historial
        if (context.recentEffects.length < 10) {
            confidence *= 0.7;
        }
        // Reducir confianza si alta fatiga (comportamiento impredecible)
        if (context.audienceFatigue > 0.7) {
            confidence *= 0.8;
        }
        // 🧬 WAVE 970: Usar EFFECT_DNA_REGISTRY para verificar efectos conocidos
        // Reducir confianza si efecto desconocido
        if (!(effect.effect in EFFECT_DNA_REGISTRY)) {
            confidence *= 0.5;
        }
        return confidence;
    }
    // ═══════════════════════════════════════════════════════════════
    // PRIVATE: RANKING & RECOMMENDATION
    // ═══════════════════════════════════════════════════════════════
    rankScenarios(scenarios, prediction) {
        // Multi-factor ranking
        // 🔍 WAVE 996.6: DEBUG - Log top candidates to diagnose diversity issues
        const scored = scenarios.map(s => ({
            scenario: s,
            score: this.calculateScenarioScore(s, prediction)
        })).sort((a, b) => b.score - a.score);
        // Log top 3 para debug
        if (scored.length >= 2) {
            const top3 = scored.slice(0, 3).map(s => `${s.scenario.effect.effect}(R=${s.scenario.projectedRelevance.toFixed(2)}×D=${s.scenario.diversityScore.toFixed(1)}→${s.score.toFixed(2)})`).join(' | ');
            console.log(`[DREAM_SIMULATOR] 🏆 TOP3: ${top3}`);
        }
        return scored.map(s => s.scenario);
    }
    calculateScenarioScore(scenario, prediction) {
        // ═══════════════════════════════════════════════════════════════
        // 🧬 WAVE 970: DNA-BASED SCORING
        // 🔥 WAVE 982.5: DIVERSITY ENGINE INTEGRATION
        // ═══════════════════════════════════════════════════════════════
        // 
        // FÓRMULA SIMPLIFICADA:
        // FinalScore = (Relevance * DiversityFactor) + vibeBonus + riskPenalty
        // 
        // DiversityFactor viene de calculateDiversityScore():
        // - 0 usos → 1.0 (sin penalización)
        // - 1 uso  → 0.7 (-30%)
        // - 2 usos → 0.4 (-60%)
        // - 3+ usos → 0.1 (-90% SHADOWBAN)
        // ═══════════════════════════════════════════════════════════════
        let score = 0;
        // 🎯 CORE: DNA Relevance MULTIPLICADA por Diversity Factor
        // diversityScore ya viene con la escalera (1.0 / 0.7 / 0.4 / 0.1)
        const adjustedRelevance = scenario.projectedRelevance * scenario.diversityScore;
        // 🧬 Pesos del scoring
        score += adjustedRelevance * 0.50; // 🧬 DNA + Diversity (50% del score)
        score += scenario.vibeCoherence * 0.20; // Coherencia de vibe
        score += (1 - scenario.riskLevel) * 0.20; // Bajo riesgo preferido
        score += scenario.simulationConfidence * 0.10; // Confianza en predicción
        // Penalizar conflictos
        score -= scenario.cooldownConflicts.length * 0.15;
        score -= scenario.hardwareConflicts.length * 0.20;
        // Boost si viene drop
        if (prediction.isDropComing && scenario.effect.intensity > 0.7) {
            score += 0.1;
        }
        // Boost si match perfecto (alta relevancia Y sin penalización de diversidad)
        if (adjustedRelevance > 0.80 && scenario.dnaDistance < 0.3) {
            score += 0.05;
        }
        return Math.max(0, Math.min(1, score));
    }
    generateRecommendation(bestScenario, context) {
        if (!bestScenario) {
            return {
                action: 'abort',
                reason: 'No viable scenarios found'
            };
        }
        // ABORT conditions
        if (bestScenario.riskLevel > 0.7) {
            return {
                action: 'abort',
                reason: `High risk: ${bestScenario.riskLevel.toFixed(2)}`
            };
        }
        if (bestScenario.hardwareConflicts.length > 0) {
            return {
                action: 'abort',
                reason: `Hardware conflicts: ${bestScenario.hardwareConflicts.join(', ')}`
            };
        }
        // MODIFY conditions
        if (bestScenario.projectedBeauty < 0.5) {
            return {
                action: 'modify',
                reason: `Low beauty: ${bestScenario.projectedBeauty.toFixed(2)} - consider alternatives`
            };
        }
        if (bestScenario.cooldownConflicts.length > 0) {
            return {
                action: 'modify',
                reason: `Cooldown conflicts - try alternative`
            };
        }
        // EXECUTE
        return {
            action: 'execute',
            reason: `Beauty: ${bestScenario.projectedBeauty.toFixed(2)}, Risk: ${bestScenario.riskLevel.toFixed(2)} - GO!`
        };
    }
    detectWarnings(scenarios, context) {
        const warnings = [];
        // High risk scenarios
        const highRiskScenarios = scenarios.filter(s => s.riskLevel > 0.7);
        if (highRiskScenarios.length > scenarios.length / 2) {
            warnings.push('⚠️ Majority of scenarios are high-risk');
        }
        // Low diversity
        const lowDiversityScenarios = scenarios.filter(s => s.diversityScore < 0.3);
        if (lowDiversityScenarios.length > scenarios.length / 2) {
            warnings.push('⚠️ Approaching monotony - diversity low');
        }
        // GPU stress
        if (context.gpuLoad > 0.7) {
            warnings.push('⚠️ GPU load high - consider lighter effects');
        }
        // Audience fatigue
        if (context.audienceFatigue > 0.7) {
            warnings.push('⚠️ Audience fatigue high - consider rest');
        }
        return warnings;
    }
}
// ═══════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════
export const effectDreamSimulator = new EffectDreamSimulator();

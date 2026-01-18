/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 CONTEXTUAL EFFECT SELECTOR - THE ARTISTIC BRAIN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 685: CONTEXTUAL INTELLIGENCE
 * WAVE 700.1: MOOD INTEGRATION
 *
 * "MG Music: Sonido e Iluminación Contextual IA"
 *
 * Este módulo es EL CEREBRO ARTÍSTICO de Selene. Decide QUÉ efecto disparar
 * basándose en el contexto musical completo:
 *
 * - Z-Score: ¿Qué tan intenso es el momento?
 * - Section Type: ¿Es buildup, drop, breakdown?
 * - Vibe: ¿Qué restricciones tenemos?
 * - Hunt Decision: ¿El cazador dice que es momento de atacar?
 * - Energy Trend: ¿Subiendo o bajando?
 * - 🎭 Mood: ¿Estamos en CALM, BALANCED o PUNK mode?
 *
 * FILOSOFÍA:
 * - NO es aleatorio - es contextual
 * - NO es repetitivo - variamos los efectos
 * - NO es invasivo - respetamos el Vibe
 * - SÍ es musical - respiramos con la canción
 *
 * @module core/effects/ContextualEffectSelector
 * @version WAVE 685, 700.1
 */
import { MoodController } from '../mood';
const DEFAULT_CONFIG = {
    minCooldownMs: 800, // 0.8 segundos mínimo entre efectos
    sameEffectCooldownMs: 3000, // 3 segundos si es el mismo efecto
    // 🌊 WAVE 691: Cooldowns por tipo - evita monopolio del fantasma
    // 🎺 WAVE 692: Cooldowns para nuevos efectos Fiesta Latina
    // 🎭 WAVE 700.5.2: CONSENSO DEL CÓNCLAVE - "Solomillo vs Patatas Fritas"
    //    Los efectos híbridos (que mueven color + movers) son SOLOMILLO = cooldown largo
    //    El mood multiplica estos valores (CALM 3.0x, BALANCED 1.5x, PUNK 0.7x)
    //    Target EPM: CALM 1-3, BALANCED 4-6, PUNK 8-10
    effectTypeCooldowns: {
        // === EFECTOS HÍBRIDOS (Solomillo - mueven todo el escenario) ===
        'cumbia_moon': 25000, // 25s base → CALM:75s, BALANCED:37s, PUNK:17s
        'tropical_pulse': 28000, // 28s base → CALM:84s, BALANCED:42s, PUNK:19s (↑ de 20s)
        'salsa_fire': 18000, // 18s base → CALM:54s, BALANCED:27s, PUNK:12s
        'clave_rhythm': 22000, // 22s base → CALM:66s, BALANCED:33s, PUNK:15s
        // === EFECTOS IMPACTO (Plato fuerte ocasional) ===
        'solar_flare': 30000, // 30s base → CALM:90s, BALANCED:45s, PUNK:21s
        'strobe_burst': 25000, // 25s base → Bloqueado en CALM
        'strobe_storm': 40000, // 40s base → Bloqueado en CALM
        // === EFECTOS AMBIENTE (Relleno sutil) ===
        'ghost_breath': 35000, // 35s base - fantasma raro
        'tidal_wave': 20000, // 20s base - ola ocasional
    },
    // 🌊 WAVE 691: Si energy > 0.3, bloquear efectos ambientales (ghost_breath)
    ambientBlockEnergyThreshold: 0.3,
    zScoreThresholds: {
        normal: 1.5,
        elevated: 2.0,
        epic: 2.8,
        divine: 3.5,
    },
    minHuntConfidence: 0.6,
};
// ═══════════════════════════════════════════════════════════════════════════
// EFFECT MAPPING BY CONTEXT
// ═══════════════════════════════════════════════════════════════════════════
/**
 * 🎨 EFFECT PALETTE BY SECTION
 *
 * Define qué efectos son apropiados para cada sección de la canción.
 * El selector elige de esta paleta basándose en intensidad y contexto.
 *
 * � WAVE 692: FIESTA LATINA ARSENAL - Paleta expandida con nuevos efectos
 * - tropical_pulse: Crescendo bursts como ritmo de conga
 * - salsa_fire: Parpadeo orgánico de fuego
 * - cumbia_moon: Respiro suave para breakdowns
 *
 * �🌊 WAVE 691.5: PURGA - TidalWave y GhostBreath ELIMINADOS para Fiesta Latina
 * Estos efectos espaciales no funcionan con la arquitectura actual.
 */
const SECTION_EFFECT_PALETTE = {
    'intro': {
        primary: 'solar_flare',
        secondary: 'tropical_pulse', // 🌴 WAVE 692
        ambient: 'cumbia_moon', // 🌙 WAVE 692
    },
    'verse': {
        primary: 'tropical_pulse', // 🌴 WAVE 692: Pulsos como conga
        secondary: 'salsa_fire', // 🔥 WAVE 692: Fuego orgánico
        ambient: 'cumbia_moon', // 🌙 WAVE 692
    },
    'chorus': {
        primary: 'solar_flare', // Momento épico
        secondary: 'strobe_burst',
        ambient: 'tropical_pulse',
        latinaOverride: 'tropical_pulse', // 🌴 WAVE 692
    },
    'bridge': {
        primary: 'salsa_fire', // 🔥 WAVE 692: Transición ardiente
        secondary: 'tropical_pulse',
        ambient: 'cumbia_moon', // 🌙 WAVE 692
    },
    'buildup': {
        primary: 'tropical_pulse', // 🌴 WAVE 692: Tensión creciente
        secondary: 'salsa_fire',
        ambient: 'strobe_burst',
    },
    'drop': {
        primary: 'solar_flare', // BOOM
        secondary: 'strobe_burst',
        ambient: 'tropical_pulse',
        latinaOverride: 'strobe_burst',
    },
    'breakdown': {
        primary: 'cumbia_moon', // 🌙 WAVE 692: Respiro suave
        secondary: 'salsa_fire', // 🔥 WAVE 692
        ambient: 'cumbia_moon',
    },
    'outro': {
        primary: 'solar_flare',
        secondary: 'cumbia_moon', // 🌙 WAVE 692: Cierre suave
        ambient: 'cumbia_moon',
    },
};
// ═══════════════════════════════════════════════════════════════════════════
// MAIN SELECTOR CLASS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * 🎯 CONTEXTUAL EFFECT SELECTOR
 *
 * El cerebro artístico que decide qué efecto pintar en cada momento.
 *
 * 🌊 WAVE 691: Ahora con cooldowns por tipo y protección anti-ghost
 * 🎭 WAVE 700.1: Integración con MoodController para cooldowns y blockList
 */
export class ContextualEffectSelector {
    constructor(config) {
        this.consecutiveSameEffect = 0;
        // 🌊 WAVE 691: Tracking de cooldowns por tipo de efecto
        this.effectTypeLastFired = new Map();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.moodController = MoodController.getInstance();
    }
    /**
     * 🌊 WAVE 691: Registra que un efecto fue disparado
     */
    registerEffectFired(effectType) {
        this.effectTypeLastFired.set(effectType, Date.now());
    }
    /**
     * 🌊 WAVE 691: Verifica si un efecto específico está en cooldown
     * 🎭 WAVE 700.1: Ahora respeta MoodController
     *    - PUNK forceUnlock = ignora cooldown
     *    - Cooldowns modificados por cooldownMultiplier
     */
    isEffectInCooldown(effectType) {
        // 🎭 WAVE 700.1: Si el mood tiene forceUnlock para este efecto, NUNCA está en cooldown
        if (this.moodController.isEffectForceUnlocked(effectType)) {
            return false;
        }
        const lastFired = this.effectTypeLastFired.get(effectType);
        if (!lastFired)
            return false;
        // Cooldown base del config
        const baseCooldown = this.config.effectTypeCooldowns[effectType] || this.config.minCooldownMs;
        // 🎭 WAVE 700.1: Aplicar multiplicador del mood
        const effectiveCooldown = this.moodController.applyCooldown(baseCooldown);
        return (Date.now() - lastFired) < effectiveCooldown;
    }
    /**
     * 🎭 WAVE 700.1: Verifica si un efecto está bloqueado por el mood actual
     *
     * IMPORTANTE: Esto es ADICIONAL al Vibe Shield.
     * El Vibe Shield es la autoridad suprema. El Mood solo puede AÑADIR restricciones,
     * nunca puede desbloquear algo que el Vibe tiene prohibido.
     */
    isEffectBlockedByMood(effectType) {
        return this.moodController.isEffectBlocked(effectType);
    }
    /**
     * 🎯 SELECT EFFECT
     *
     * Método principal: dado el contexto completo, decide qué efecto disparar.
     *
     * @returns Selección de efecto (puede ser null si no hay que disparar nada)
     */
    select(input) {
        const { musicalContext, sectionType, lastEffectTimestamp, lastEffectType } = input;
        const now = Date.now();
        // ═══════════════════════════════════════════════════════════════
        // PASO 1: COOLDOWN CHECK
        // ═══════════════════════════════════════════════════════════════
        const timeSinceLastEffect = now - lastEffectTimestamp;
        const cooldown = this.calculateCooldown(lastEffectType);
        if (timeSinceLastEffect < cooldown) {
            return this.noEffectDecision(musicalContext, `Cooldown (${cooldown - timeSinceLastEffect}ms remaining)`);
        }
        // ═══════════════════════════════════════════════════════════════
        // PASO 2: Z-SCORE CLASSIFICATION
        // ═══════════════════════════════════════════════════════════════
        const zLevel = this.classifyZScore(musicalContext.zScore);
        // 🌩️ DIVINE MOMENT: Z > 3.5 = SOLAR FLARE OBLIGATORIO
        if (zLevel === 'divine') {
            return this.divineDecision(musicalContext);
        }
        // ═══════════════════════════════════════════════════════════════
        // PASO 3: HUNT/FUZZY DECISION CHECK
        // ═══════════════════════════════════════════════════════════════
        const shouldStrike = this.evaluateHuntFuzzy(input);
        if (!shouldStrike.should) {
            return this.noEffectDecision(musicalContext, shouldStrike.reason);
        }
        // ═══════════════════════════════════════════════════════════════
        // PASO 4: CONTEXT-BASED EFFECT SELECTION
        // 🌊 WAVE 691: Ahora con vibe y musicalContext para anti-ghost
        // ═══════════════════════════════════════════════════════════════
        const effectType = this.selectEffectForContext(sectionType, zLevel, input.energyTrend, lastEffectType, musicalContext, musicalContext.vibeId);
        // 🔥 WAVE 691.5: Si el selector devuelve 'none', no disparar nada
        if (effectType === 'none') {
            return this.noEffectDecision(musicalContext, 'LATINA breathing - strobe in cooldown');
        }
        // 🌊 WAVE 691: Registrar que este efecto fue disparado
        this.registerEffectFired(effectType);
        // ═══════════════════════════════════════════════════════════════
        // PASO 5: INTENSITY CALCULATION
        // ═══════════════════════════════════════════════════════════════
        const intensity = this.calculateIntensity(musicalContext, zLevel);
        // ═══════════════════════════════════════════════════════════════
        // PASO 6: BUILD DECISION
        // ═══════════════════════════════════════════════════════════════
        // Anti-repetición tracking
        if (effectType === lastEffectType) {
            this.consecutiveSameEffect++;
        }
        else {
            this.consecutiveSameEffect = 0;
        }
        return {
            effectType,
            intensity,
            reason: `${zLevel.toUpperCase()} moment in ${sectionType} | Z=${musicalContext.zScore.toFixed(2)}σ`,
            confidence: shouldStrike.confidence,
            isOverride: false,
            musicalContext,
        };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE: Classification helpers
    // ─────────────────────────────────────────────────────────────────────────
    classifyZScore(z) {
        const { zScoreThresholds: t } = this.config;
        if (z >= t.divine)
            return 'divine';
        if (z >= t.epic)
            return 'epic';
        if (z >= t.elevated)
            return 'elevated';
        return 'normal';
    }
    calculateCooldown(lastEffectType) {
        if (!lastEffectType)
            return this.config.minCooldownMs;
        // Cooldown extra si repetimos el mismo efecto
        if (this.consecutiveSameEffect > 0) {
            return this.config.sameEffectCooldownMs * (1 + this.consecutiveSameEffect * 0.5);
        }
        return this.config.minCooldownMs;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE: Hunt/Fuzzy evaluation
    // ─────────────────────────────────────────────────────────────────────────
    evaluateHuntFuzzy(input) {
        const { huntDecision, fuzzyDecision, musicalContext } = input;
        // Si el Hunt dice strike con alta confianza, go
        if (huntDecision?.shouldStrike && huntDecision.confidence >= this.config.minHuntConfidence) {
            return {
                should: true,
                reason: `Hunt STRIKE (confidence=${huntDecision.confidence.toFixed(2)})`,
                confidence: huntDecision.confidence,
            };
        }
        // Si el Fuzzy dice strike/force_strike, go
        if (fuzzyDecision) {
            if (fuzzyDecision.action === 'force_strike') {
                return {
                    should: true,
                    reason: `Fuzzy FORCE_STRIKE: ${fuzzyDecision.reasoning}`,
                    confidence: fuzzyDecision.confidence,
                };
            }
            if (fuzzyDecision.action === 'strike' && fuzzyDecision.confidence >= 0.7) {
                return {
                    should: true,
                    reason: `Fuzzy STRIKE: ${fuzzyDecision.reasoning}`,
                    confidence: fuzzyDecision.confidence,
                };
            }
        }
        // Si Z-Score es epic (>2.8) aunque Hunt/Fuzzy no lo digan, dispararemos algo suave
        if (musicalContext.zScore >= this.config.zScoreThresholds.epic) {
            return {
                should: true,
                reason: `Epic Z-Score bypass (Z=${musicalContext.zScore.toFixed(2)}σ)`,
                confidence: 0.75,
            };
        }
        // No disparar
        return {
            should: false,
            reason: `No trigger conditions met (Z=${musicalContext.zScore.toFixed(2)}σ)`,
            confidence: 0,
        };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE: Effect selection logic
    // 🌊 WAVE 691: Refactorizado con cooldowns por tipo y protección anti-ghost
    // 🎭 WAVE 700.1: Integración con MoodController
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * 🎭 WAVE 700.1: Verifica si un efecto está disponible
     * Combina check de cooldown Y check de blockList del mood
     */
    isEffectAvailable(effectType) {
        // Primero: ¿está bloqueado por el mood?
        if (this.isEffectBlockedByMood(effectType)) {
            console.log(`[EffectSelector 🎭] ${effectType} BLOCKED by mood ${this.moodController.getCurrentMood().toUpperCase()}`);
            return false;
        }
        // Segundo: ¿está en cooldown? (ya considera forceUnlock del mood)
        if (this.isEffectInCooldown(effectType)) {
            return false;
        }
        return true;
    }
    selectEffectForContext(sectionType, zLevel, energyTrend, lastEffectType, musicalContext, vibe) {
        const palette = SECTION_EFFECT_PALETTE[sectionType] || SECTION_EFFECT_PALETTE['verse'];
        const energy = musicalContext?.energy ?? 0.5;
        const moodProfile = this.moodController.getCurrentProfile();
        // 🔍 WAVE 692/700.1: Debug logging con mood
        console.log(`[EffectSelector 🎯] Section=${sectionType} Z=${zLevel} Vibe=${vibe} Energy=${energy.toFixed(2)} Trend=${energyTrend} ${moodProfile.emoji}Mood=${moodProfile.name.toUpperCase()}`);
        // ═══════════════════════════════════════════════════════════════
        // 🎺 WAVE 692: FIESTA LATINA - ARSENAL COMPLETO
        // Ahora con TropicalPulse, SalsaFire y CumbiaMoon
        // El bypass dictatorial ha sido ELIMINADO
        // 🎭 WAVE 700.1: Ahora usa isEffectAvailable que considera mood
        // ═══════════════════════════════════════════════════════════════
        if (vibe === 'fiesta-latina') {
            // 🔥 EPIC/DIVINE: Strobe o Solar (efectos de impacto)
            if (zLevel === 'divine' || zLevel === 'epic') {
                if (this.isEffectAvailable('strobe_burst')) {
                    console.log(`[EffectSelector 🔥] LATINA EPIC: strobe_burst`);
                    return 'strobe_burst';
                }
                // Fallback a tropical pulse si strobe en cooldown o bloqueado
                if (this.isEffectAvailable('tropical_pulse')) {
                    console.log(`[EffectSelector 🌴] LATINA EPIC FALLBACK: tropical_pulse`);
                    return 'tropical_pulse';
                }
            }
            // 🌴 ELEVATED: TropicalPulse o SalsaFire (efectos de relleno medio)
            if (zLevel === 'elevated') {
                if (energyTrend === 'rising' && this.isEffectAvailable('tropical_pulse')) {
                    console.log(`[EffectSelector 🌴] LATINA ELEVATED RISING: tropical_pulse`);
                    return 'tropical_pulse';
                }
                if (this.isEffectAvailable('salsa_fire')) {
                    console.log(`[EffectSelector �] LATINA ELEVATED: salsa_fire`);
                    return 'salsa_fire';
                }
            }
            // 🌙 NORMAL/LOW + BREAKDOWN: CumbiaMoon (respiro suave)
            if (sectionType === 'breakdown' || energyTrend === 'falling') {
                if (this.isEffectAvailable('cumbia_moon')) {
                    console.log(`[EffectSelector 🌙] LATINA BREAKDOWN: cumbia_moon`);
                    return 'cumbia_moon';
                }
            }
            // 🎲 NORMAL: Rotación de efectos medios (evita monotonía)
            if (zLevel === 'normal') {
                // Priorizar efectos que NO se hayan disparado recientemente
                const candidates = ['clave_rhythm', 'tropical_pulse', 'salsa_fire', 'cumbia_moon'];
                for (const effect of candidates) {
                    if (this.isEffectAvailable(effect) && effect !== lastEffectType) {
                        console.log(`[EffectSelector 🎺] LATINA NORMAL: ${effect}`);
                        return effect;
                    }
                }
            }
            // 😴 Si todo está en cooldown, dejar respirar
            console.log(`[EffectSelector 😴] LATINA: all effects in cooldown, breathing`);
            return 'none';
        }
        // ═══════════════════════════════════════════════════════════════
        // REGLA 1: DIVINE/EPIC = Primary effect (lo más potente)
        // 🎭 WAVE 700.5.2: TODOS los returns deben pasar por isEffectAvailable
        // ═══════════════════════════════════════════════════════════════
        if (zLevel === 'divine' || zLevel === 'epic') {
            // Evitar repetir el mismo efecto
            const primary = palette.primary;
            if (primary === lastEffectType && this.consecutiveSameEffect >= 2) {
                if (this.isEffectAvailable(palette.secondary)) {
                    return palette.secondary;
                }
            }
            if (this.isEffectAvailable(primary)) {
                return primary;
            }
            // 🎭 WAVE 700.5.2: Fallback también debe verificar blockList
            if (this.isEffectAvailable(palette.secondary)) {
                return palette.secondary;
            }
            // Si secondary también bloqueado, usar tidal_wave como fallback seguro
            if (this.isEffectAvailable('tidal_wave')) {
                return 'tidal_wave';
            }
            return 'none';
        }
        // ═══════════════════════════════════════════════════════════════
        // 🌊 WAVE 691: ANTI-GHOST - Bloquear ghost_breath si hay ritmo
        // 🎭 WAVE 700.1: También considerar blockList del mood
        // (Solo para vibes que NO son fiesta-latina)
        // ═══════════════════════════════════════════════════════════════
        const ghostBlocked = energy > this.config.ambientBlockEnergyThreshold ||
            !this.isEffectAvailable('ghost_breath');
        // ═══════════════════════════════════════════════════════════════
        // REGLA 2: ELEVATED + RISING = Build tension
        // ═══════════════════════════════════════════════════════════════
        if (zLevel === 'elevated' && energyTrend === 'rising') {
            // Buildup/Bridge: Ghost Breath solo si NO bloqueado
            if ((sectionType === 'buildup' || sectionType === 'bridge') && !ghostBlocked) {
                return 'ghost_breath';
            }
            // Default: Tidal Wave para momentum
            if (this.isEffectAvailable('tidal_wave')) {
                return 'tidal_wave';
            }
        }
        // ═══════════════════════════════════════════════════════════════
        // REGLA 3: ELEVATED + FALLING = Release suave
        // ═══════════════════════════════════════════════════════════════
        if (zLevel === 'elevated' && energyTrend === 'falling') {
            if (this.isEffectAvailable('tidal_wave')) {
                return 'tidal_wave'; // Ola que baja
            }
        }
        // ═══════════════════════════════════════════════════════════════
        // REGLA 4: ELEVATED + STABLE = Mantener momentum
        // ═══════════════════════════════════════════════════════════════
        if (zLevel === 'elevated') {
            // En drop/chorus/breakdown: strobe para mantener energía
            if (sectionType === 'drop' || sectionType === 'chorus' || sectionType === 'breakdown') {
                const strobeType = 'strobe_storm';
                if (lastEffectType !== strobeType && this.isEffectAvailable(strobeType)) {
                    return strobeType;
                }
                return 'tidal_wave';
            }
            // Evitar ghost si está bloqueado
            if (palette.secondary === 'ghost_breath' && ghostBlocked) {
                return 'tidal_wave';
            }
            if (this.isEffectAvailable(palette.secondary)) {
                return palette.secondary;
            }
        }
        // ═══════════════════════════════════════════════════════════════
        // DEFAULT: Ambient effect (pero NO ghost si hay ritmo)
        // ═══════════════════════════════════════════════════════════════
        if (palette.ambient === 'ghost_breath' && ghostBlocked) {
            return 'tidal_wave';
        }
        if (this.isEffectAvailable(palette.ambient)) {
            return palette.ambient;
        }
        // Fallback final: tidal_wave siempre disponible
        return 'tidal_wave';
    }
    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE: Intensity calculation
    // ─────────────────────────────────────────────────────────────────────────
    calculateIntensity(musicalContext, zLevel) {
        // Base intensity por nivel de Z
        const baseIntensity = {
            normal: 0.4,
            elevated: 0.6,
            epic: 0.85,
            divine: 1.0,
        };
        let intensity = baseIntensity[zLevel];
        // Modular con energía del audio
        intensity = intensity * (0.7 + musicalContext.energy * 0.3);
        // Clamp
        return Math.min(1.0, Math.max(0.2, intensity));
    }
    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE: Decision builders
    // ─────────────────────────────────────────────────────────────────────────
    divineDecision(musicalContext) {
        return {
            effectType: 'solar_flare',
            intensity: 1.0,
            reason: `🌩️ DIVINE MOMENT! Z=${musicalContext.zScore.toFixed(2)}σ - SOLAR FLARE MANDATORY`,
            confidence: 0.99,
            isOverride: true,
            musicalContext,
        };
    }
    noEffectDecision(musicalContext, reason) {
        return {
            effectType: null,
            intensity: 0,
            reason,
            confidence: 0,
            isOverride: false,
            musicalContext,
        };
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════
let selectorInstance = null;
export function getContextualEffectSelector() {
    if (!selectorInstance) {
        selectorInstance = new ContextualEffectSelector();
    }
    return selectorInstance;
}
export function resetContextualEffectSelector() {
    selectorInstance = null;
}

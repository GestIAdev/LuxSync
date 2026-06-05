/**
 * ═══════════════════════════════════════════════════════════════════════════
 * �️ ARSENAL REPOSITORY (ArsenalRepository → Purificado)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🔪 WAVE 4992: PURIFICACIÓN COMPLETA
 *   Este módulo ya NO toma decisiones artísticas. Es un REPOSITORIO PURO.
 *   Responsabilidades:
 *     - Registrar cooldowns de efectos
 *     - Consultar disponibilidad (checkAvailability / isAvailable)
 *     - Filtrar arsenal DIVINE por vibe y textura
 *     - Gestionar blockList del mood
 *   Decisiones artísticas: DecisionMaker.ts único cerebro.
 *
 * Historial: WAVE 685 (ArsenalRepository) → WAVE 1010.5 (PURGE)
 *            → WAVE 4992 (RENOMBRADO + MÉTODOS DECISIÓN ELIMINADOS)
 *
 * @module core/effects/ContextualEffectSelector
 * @version WAVE 4992
 */
import { MoodController } from '../mood';
// 🚨 WAVE 1004.2: DNA Diversity System - Shadowban por repetición
import { getDNAAnalyzer } from '../intelligence/dna';
// ═══════════════════════════════════════════════════════════════════════════
// 🚪 WAVE 812: THE TIMEKEEPER - FUENTE DE VERDAD DEL TIEMPO
// ═══════════════════════════════════════════════════════════════════════════
// Exportada para que cualquier módulo pueda consultar los cooldowns oficiales
// NOTA: El MoodController MULTIPLICA estos valores según el mood actual
//       - CALM: 3.0x (muy conservador)
//       - BALANCED: 1.5x (equilibrado)
//       - PUNK: 0.7x (agresivo)
// ═══════════════════════════════════════════════════════════════════════════
// 🔒 WAVE 1179: DICTATOR HARD MINIMUM COOLDOWNS
// ═══════════════════════════════════════════════════════════════════════════
// Estos son cooldowns ABSOLUTOS que ni siquiera el DNA puede saltarse.
// Los efectos dictadores (mixBus='global') son de LARGO DURACIÓN y si se
// disparan 2x en 10 segundos el show se vuelve un caos sin sentido.
//
// FILOSOFÍA: Un dictador tiene el escenario. Cuando termina, necesita
// un RESPIRO MÍNIMO antes de que otro dictador pueda hablar.
// ═══════════════════════════════════════════════════════════════════════════
export const DICTATOR_HARD_MINIMUM_COOLDOWNS = {
    // DICTADORES TECHNO (mixBus='global')
    'abyssal_rise': 20000, // 20s MÍNIMO ABSOLUTO (efecto de 4-5s + respiro)
    'gatling_raid': 15000, // 15s MÍNIMO ABSOLUTO (efecto de 1.6s + respiro)
    'industrial_strobe': 8000, // 8s MÍNIMO ABSOLUTO (efecto de ~0.5s pero es STROBE)
    'core_meltdown': 12000, // WAVE 3469: 12s MÍNIMO ABSOLUTO — override nuclear operativo
    // 🔥 WAVE 2182: PARS PAINT, MOVERS PIERCE (dictadores APEX)
    'neon_blinder': 12000, // 12s MÍNIMO ABSOLUTO (flash wall, espacio entre impactos)
    'surgical_strike': 10000, // 10s MÍNIMO ABSOLUTO (bisturí rápido, pero no spam)
    // DICTADORES LATINOS (mixBus='global')
    'solar_flare': 20000, // 20s MÍNIMO ABSOLUTO
    'strobe_storm': 12000, // WAVE 2186: 18s→12s — cerrojo 1 abierto
    'latina_meltdown': 25000, // 25s MÍNIMO ABSOLUTO
    'oro_solido': 22000, // 🥇 WAVE 2189: 22s — dictador de oro necesita respiro
};
export const EFFECT_COOLDOWNS = {
    // === EFECTOS HÍBRIDOS (Solomillo - mueven todo el escenario) ===
    'cumbia_moon': 25000, // 25s base → CALM:75s, BALANCED:37s, PUNK:17s
    'tropical_pulse': 28000, // 28s base → CALM:84s, BALANCED:42s, PUNK:19s
    'salsa_fire': 18000, // 18s base → CALM:54s, BALANCED:27s, PUNK:12s
    'clave_rhythm': 22000, // 22s base → CALM:66s, BALANCED:33s, PUNK:15s
    // === EFECTOS IMPACTO (Plato fuerte ocasional) ===
    'solar_flare': 30000, // 30s base → CALM:90s, BALANCED:45s, PUNK:21s
    'strobe_burst': 25000, // 25s base → Bloqueado en CALM
    'strobe_storm': 20000, // WAVE 2186: 40s→20s — cerrojo 2 abierto
    'oro_solido': 28000, // 🥇 WAVE 2189: 28s base → CALM:84s, BALANCED:42s, PUNK:19s
    // ═══════════════════════════════════════════════════════════════════════════
    // ⚔️ WAVE 2730: LOS HUÉRFANOS ADOPTADOS — Cooldowns explícitos para efectos
    // que no los tenían. Sin cooldown explícito caen al fallback de 800ms,
    // lo que permite ráfagas de 12+ disparos en 60 segundos.
    // ═══════════════════════════════════════════════════════════════════════════
    'glitch_guaguanco': 15000, // 15s base → BALANCED:22s — efecto impacto, NO es relleno
    'machete_spark': 12000, // 12s base → BALANCED:18s — chispa de impacto, rotación sana
    'amazon_mist': 20000, // 20s base → BALANCED:30s — atmosférico denso, necesita respiro
    'corazon_latino': 30000, // 30s base → BALANCED:45s — el alma del arquitecto, momento sagrado
    // === EFECTOS AMBIENTE (Relleno sutil) ===
    'ghost_breath': 35000, // 35s base - fantasma raro
    'tidal_wave': 20000, // 20s base - ola ocasional
    // 🔪 WAVE 780: TECHNO CLUB - THE BLADE
    // 🔫 WAVE 930.3: ANTI-STROBE-SPAM - Aumentado de 2s a 10s
    // 🩸 WAVE 2103: THE REAL FIX - Cooldowns SLASHED for rotation
    // With BALANCED (1.5x), these become: strobe=12s, acid=12s, cyber=12s
    // That's 3 effects rotating every ~4s instead of silence.
    'industrial_strobe': 8000, // 8s base → BALANCED:12s, PUNK:5.6s (was 10s)
    'acid_sweep': 8000, // 8s base → BALANCED:12s, PUNK:5.6s (was 12s)
    // 🤖 WAVE 810: UNLOCK THE TWINS
    // 🩸 WAVE 2103: Slashed — 15s×1.5=22.5s was absurd for the bread-and-butter effect
    'cyber_dualism': 10000, // 10s base → BALANCED:15s, PUNK:7s (was 15s)
    // 🔫 WAVE 930: ARSENAL PESADO
    // 🩸 WAVE 2103: Cooldowns reduced for rotation pool depth
    'gatling_raid': 8000, // 8s base → BALANCED:12s (was 8s — kept)
    'sky_saw': 8000, // 8s base → BALANCED:12s (was 10s)
    'abyssal_rise': 30000, // 30s base → BALANCED:45s (was 45s — still rare)
    // 🌫️ WAVE 938 + 963: ATMOSPHERIC ARSENAL (cooldowns REDUCIDOS para rotation)
    // 🩸 WAVE 2103: Further reduced — these need to be part of the rotation pool
    'void_mist': 12000, // 12s base → BALANCED:18s (was 15s)
    // 🔪 WAVE 986: static_pulse PURGED
    'digital_rain': 12000, // 12s base → BALANCED:18s (was 18s)
    'deep_breath': 15000, // 15s base → BALANCED:22s (was 20s)
    // ⚡ WAVE 977: LA FÁBRICA - Nuevos efectos
    'ambient_strobe': 14000, // 14s base → Flashes dispersos gentle/active zone
    'sonar_ping': 25000, // 25s base → Ping submarino silence/valley (efecto raro)
    // 🔪 WAVE 986: ACTIVE REINFORCEMENTS
    // 🩸 WAVE 2103: Reduced for rotation depth
    'binary_glitch': 8000, // 8s base → BALANCED:12s (was 10s)
    'seismic_snap': 8000, // 8s base → BALANCED:12s (was 12s)
    // 🔮 WAVE 988: THE FINAL ARSENAL
    'fiber_optics': 20000, // 20s base → Traveling colors ambient (long effect, needs space)
    'core_meltdown': 12000, // WAVE 3469: 12s base → La Bestia entra en rotación pesada
    // 🔥 WAVE 2182: PARS PAINT, MOVERS PIERCE
    'neon_blinder': 10000, // 10s base → BALANCED:15s — flash wall, impactos espaciados
    'surgical_strike': 8000, // 8s base → BALANCED:12s — bisturí rápido, parte de la rotación
    'ghost_chase': 18000, // 18s base → BALANCED:27s — atmosférico, no spam
    // ═══════════════════════════════════════════════════════════════════════════
    // 🎸 WAVE 1020: POP-ROCK LEGENDS ARSENAL - LOS 5 MAGNÍFICOS
    // ═══════════════════════════════════════════════════════════════════════════
    'thunder_struck': 25000, // 25s base → Stadium blinder, momentos épicos (no spam)
    'liquid_solo': 30000, // 30s base → Spotlight del guitarrista (solos son raros)
    'amp_heat': 20000, // 20s base → Válvulas calientes, más frecuente (ambiente)
    'arena_sweep': 15000, // 15s base → El pan y mantequilla, frecuente pero no spam
    'feedback_storm': 35000, // 35s base → Caos visual, muy raro (solo harshness alto)
    // ═══════════════════════════════════════════════════════════════════════════
    // 🎸 WAVE 1020.9: ROCK ARSENAL EXPANSION - LOS 3 NUEVOS MAGNÍFICOS
    // ═══════════════════════════════════════════════════════════════════════════
    'power_chord': 20000, // 20s base → Flash + strobe, golpes de acorde (moderado)
    'stage_wash': 25000, // 25s base → Respiro cálido, transiciones (espaciado)
    'spotlight_pulse': 22000, // 22s base → Pulso emotivo, builds (medio-frecuente)
    // ═══════════════════════════════════════════════════════════════════════════
    // 🌊 WAVE 1071: THE LIVING OCEAN - CHILL LOUNGE ARSENAL
    // Cooldowns MUY largos - esto es una performance, no reactivo
    // ChillStereoPhysics tiene sus propios triggers, pero necesitan backup aquí
    // para evitar spam si el DreamEngine o algún otro sistema intenta forzarlos
    // ═══════════════════════════════════════════════════════════════════════════
    'solar_caustics': 45000, // 45s base → Rayos de sol descendiendo lentamente
    'school_of_fish': 35000, // 35s base → Cardumen cruzando el escenario
    'whale_song': 60000, // 60s base → Ballenas son RARAS y majestuosas
    'abyssal_jellyfish': 90000, // 90s base → Evento especial del abismo profundo
};
/**
 * 🎨 EFFECT TEXTURE METADATA
 *
 * Mapea cada efecto a su compatibilidad de textura.
 * Si un efecto no está en este mapa, se asume 'universal'.
 */
export const EFFECT_TEXTURE_COMPATIBILITY = {
    // ═══════════════════════════════════════════════════════════════════════
    // 🔥 DIRTY/HARSH COMPATIBLE - Solo con texturas sucias
    // Efectos de caos, strobes agresivos, ruido visual
    // ═══════════════════════════════════════════════════════════════════════
    'feedback_storm': 'dirty', // 😵 Caos visual - SOLO con distorsión/harshness
    'thunder_struck': 'dirty', // ⚡ Stadium blinder - impacto agresivo
    'industrial_strobe': 'dirty', // 🔨 El Martillo - techno sucio
    'strobe_storm': 'dirty', // ⚡ Tormenta de strobes - chaos
    'gatling_raid': 'dirty', // 🔫 Metralladora - industrial
    'core_meltdown': 'dirty', // ☢️ LA BESTIA - extreme
    'binary_glitch': 'dirty', // 💻 Digital glitch - solo con ruido
    'seismic_snap': 'dirty', // 💥 Golpe mecánico - impacto
    'power_chord': 'dirty', // ⚡ Flash + strobe - golpes de acorde
    // ═══════════════════════════════════════════════════════════════════════
    // 💎 CLEAN/LIQUID COMPATIBLE - Solo con texturas limpias
    // Efectos de elegancia, geometría, flujo
    // ═══════════════════════════════════════════════════════════════════════
    'liquid_solo': 'clean', // 🎸 Spotlight guitarra - solos elegantes
    'arena_sweep': 'clean', // 🌊 Barrido Wembley - geometría definida
    'amp_heat': 'clean', // 🔥 Válvulas calientes - warmth
    'stage_wash': 'clean', // 🌅 Respiro cálido - transiciones
    'spotlight_pulse': 'clean', // 💡 Pulso emotivo - contemplativo
    'fiber_optics': 'clean', // 🌈 Colores viajeros - elegante
    'deep_breath': 'clean', // 🫁 Respiración - zen
    'cumbia_moon': 'clean', // 🌙 Luna cumbianchera - suave
    'borealis_wave': 'clean', // 🌌 Aurora - espacial suave
    'corazon_latino': 'clean', // ❤️ Alma del arquitecto - emotivo
    // ═══════════════════════════════════════════════════════════════════════
    // 🌐 UNIVERSAL - Compatible con cualquier textura
    // Efectos versátiles que funcionan en cualquier contexto
    // ═══════════════════════════════════════════════════════════════════════
    'solar_flare': 'universal', // ☀️ Explosión dorada - épico universal
    'oro_solido': 'universal', // 🥇 WAVE 2189: Muro de oro — impacto puro universal
    'strobe_burst': 'universal', // 💥 Impacto puntual - versátil
    'tidal_wave': 'universal', // 🌊 Ola oceánica - momentum
    'tropical_pulse': 'universal', // 🌴 Pulso de conga - ritmo
    'salsa_fire': 'universal', // 🔥 Fuego salsero - energía
    'clave_rhythm': 'universal', // 🎶 Ritmo de clave - percusión
    'acid_sweep': 'universal', // 🧪 Sweeps volumétricos - techno
    'sky_saw': 'universal', // 🗡️ Cortes agresivos - tensión
    'cyber_dualism': 'universal', // 🤖 L/R ping-pong - dinámico
    'ghost_breath': 'universal', // 👻 Respiro oscuro - atmosférico
    'void_mist': 'universal', // 🌫️ Neblina púrpura - ambiente
    'digital_rain': 'universal', // 💧 Matrix flicker - ambiente
    'abyssal_rise': 'universal', // 🌪️ Transición épica - buildup
    'ambient_strobe': 'universal', // 📸 Camera flashes - suave
    'sonar_ping': 'universal', // 🔊 Ping submarino - ambiente
    'neon_blinder': 'universal', // ⚡ WAVE 2182: Flash wall masivo - funciona siempre
    'ghost_chase': 'universal', // 👻 WAVE 2182: Ghost chase - atmósfera versátil
    'surgical_strike': 'dirty', // 🎯 WAVE 2182: Bisturí en la oscuridad - solo con ruido
    // ═══════════════════════════════════════════════════════════════════════
    // 🌊 WAVE 1071: THE LIVING OCEAN - CHILL LOUNGE ARSENAL
    // Todos son CLEAN - la performance oceánica es pura elegancia
    // ═══════════════════════════════════════════════════════════════════════
    'solar_caustics': 'clean', // ☀️ Rayos de sol descendiendo - contemplativo
    'school_of_fish': 'clean', // 🐠 Cardumen atravesando - fluido
    'whale_song': 'clean', // 🐋 Canto de ballena - majestuoso
    'abyssal_jellyfish': 'clean', // 🪼 Medusas bioluminiscentes - etéreo
};
const DEFAULT_CONFIG = {
    minCooldownMs: 800, // 0.8 segundos mínimo entre efectos
    sameEffectCooldownMs: 3000, // 3 segundos si es el mismo efecto
    // 🚪 WAVE 812: Ahora usa la constante exportada
    effectTypeCooldowns: EFFECT_COOLDOWNS,
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
// ═══════════════════════════════════════════════════════════════════════════
// MAIN SELECTOR CLASS → ArsenalRepository
// ═══════════════════════════════════════════════════════════════════════════
/**
 * �️ ARSENAL REPOSITORY
 *
 * Puro repositorio de datos: cooldowns, disponibilidad, arsenal por vibe.
 * ZERO lógica de decisión artística. DecisionMaker es el único cerebro.
 *
 * 🔪 WAVE 4992: Renombrado desde ArsenalRepository.
 *   Métodos de decisión eliminados: selectEffectForContext, calculateIntensity,
 *   getHighImpactEffect, getEffectsAllowedForZone, isEffectAppropriateForZone.
 */
export class ArsenalRepository {
    constructor(config) {
        this.consecutiveSameEffect = 0;
        // 🌊 WAVE 691: Tracking de cooldowns por tipo de efecto
        this.effectTypeLastFired = new Map();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.moodController = MoodController.getInstance();
    }
    /**
     * 🌊 WAVE 691: Registra que un efecto fue disparado
     * 🚨 WAVE 1004.2: También registra en DNAAnalyzer para Diversity Factor
     */
    registerEffectFired(effectType) {
        this.effectTypeLastFired.set(effectType, Date.now());
        // 🚨 WAVE 1004.2: DNA Diversity - Shadowban por repetición
        // Esto reducirá la relevancia del efecto si se usa repetidamente
        getDNAAnalyzer().recordEffectUsage(effectType);
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // � WAVE 1010: EFFECT REPOSITORY - The Librarian (demoted from decision maker)
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * 🔪 WAVE 1010: Get first available effect from an arsenal (for DIVINE moments)
     * 🎨 WAVE 1028: THE CURATOR - Now texture-aware
     *
     * El General (DecisionMaker) ordena "DIVINE STRIKE" y proporciona un arsenal.
     * El Bibliotecario (este módulo) encuentra el primer efecto DISPONIBLE.
     *
     * @param arsenal - Lista de efectos válidos para este momento (ordenados por preferencia)
     * @param vibeId - Vibe actual para verificar cooldowns
     * @param spectralContext - (WAVE 1028) Contexto espectral para filtrado por textura
     * @returns El primer efecto disponible, o null si todos están en cooldown
     */
    getAvailableFromArsenal(arsenal, vibeId, spectralContext) {
        for (const effect of arsenal) {
            const availability = this.checkAvailability(effect, vibeId);
            if (!availability.available)
                continue;
            console.log(`[EffectRepository 🔪] Arsenal selection: ${effect} AVAILABLE (from [${arsenal.join(', ')}])`);
            return effect;
        }
        console.log(`[EffectRepository 🔪] Arsenal EXHAUSTED - all effects in cooldown: [${arsenal.join(', ')}]`);
        return null;
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // 🎨 WAVE 1028: THE CURATOR - Texture Filter System
    // ═══════════════════════════════════════════════════════════════════════════
    //
    // 3 REGLAS DE CURADURÍA:
    //
    // 📜 REGLA DE LA SUCIEDAD (The Grime Rule):
    //    Si texture === 'harsh' o 'noisy':
    //    - 🚫 BAN: Efectos líquidos (LiquidSolo, ArenaSweep)
    //    - ✅ BOOST: Efectos de corte/strobe (ThunderStruck +30% prob)
    //
    // 💎 REGLA DEL CRISTAL (The Crystal Rule):
    //    Si clarity > 0.85 (Sonido HD):
    //    - 🚫 BAN: Efectos caóticos/random (Chaos, FeedbackStorm)
    //    - ✅ BOOST: Efectos de geometría definida (ArenaSweep, BeamAlign)
    //
    // 🔥 REGLA DE LA CALIDEZ (The Warmth Rule):
    //    Si texture === 'warm' (Bajo profundo, Jazz):
    //    - ✅ BOOST: Efectos lentos y atmosféricos (AmpHeat, DeepBreath)
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * 🎨 WAVE 1028: THE CURATOR - Apply Texture Filter
     * 🔓 WAVE 2187: TEXTURE JAILBREAK — fiesta-latina bypasses all texture rules.
     *   En una fiesta latina, el contraste entre producción limpia y efectos visuales
     *   agresivos es estéticamente DESEABLE. El reggaetón moderno tiene clarity > 0.85
     *   (producción cristalina) pero sus efectos APEX son 'dirty' → CRYSTAL RULE los
     *   bloqueaba permanentemente. No más. En la cantina: las jaulas están abiertas.
     *
     * Evalúa si un efecto es apropiado para la textura espectral actual.
     * Implementa las 3 Reglas de Curaduría (Grime, Crystal, Warmth).
     *
     * @param effectType - Efecto a evaluar
     * @param spectralContext - Contexto espectral del GodEar FFT
     * @param vibeId - (WAVE 2187) Vibe actual para bypass por género
     * @returns TextureFilterResult con decisión y modificadores
     */
    applyTextureFilter(effectType, spectralContext, vibeId) {
        // ⚡ WAVE 4849: Texture concept disabled in Selene runtime (types preserved)
        void effectType;
        void spectralContext;
        void vibeId;
        return {
            allowed: true,
            probabilityMod: 0.0,
            reason: 'TEXTURE_DISABLED: pass-through',
            rule: 'none'
        };
    }
    /**
     * 🎨 WAVE 1028: Quick check if effect passes texture filter
     */
    isTextureCompatible(effectType, spectralContext) {
        return true;
    }
    /**
     * 🎨 WAVE 1028: Filter an arsenal by texture compatibility
     *
     * Útil para pre-filtrar arsenales antes de verificar cooldowns.
     *
     * @param arsenal - Lista de efectos
     * @param spectralContext - Contexto espectral
     * @returns Arsenal filtrado (solo efectos compatibles con la textura)
     */
    filterArsenalByTexture(arsenal, spectralContext, vibeId) {
        return arsenal;
    }
    /**
     * 🎨 WAVE 1028: Get texture-boosted effects for current context
     *
     * Devuelve efectos que tienen BOOST positivo para la textura actual.
     * Útil para priorizar efectos en selección.
     *
     * @param spectralContext - Contexto espectral
     * @returns Lista de efectos con boost, ordenados por boost descendente
     */
    getTextureBoostedEffects(spectralContext) {
        return [];
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // �🚪 WAVE 812: THE GATEKEEPER - Unified Availability Check
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * 🚪 WAVE 812: THE GATEKEEPER - Verifica si un efecto está disponible
     *
     * Este es el ÚNICO punto de verdad para saber si un efecto puede disparar.
     * Combina TODAS las verificaciones:
     * - MoodController blockList
     * - Cooldowns unificados (con multiplicadores de mood)
     * - MoodController forceUnlock (bypass para PUNK)
     *
     * @param effectType - Tipo de efecto a verificar
     * @param vibeId - Vibe actual para ajustar cooldowns
     * @returns Objeto con disponibilidad y razón si está bloqueado
     */
    checkAvailability(effectType, vibeId) {
        // 1. 🎭 MOOD FORCE UNLOCK - PUNK puede bypasear todo
        if (this.moodController.isEffectForceUnlocked(effectType)) {
            return {
                available: true,
                reason: 'FORCE_UNLOCK: Mood override active'
            };
        }
        // 2. 🚫 MOOD BLOCKLIST - Algunos efectos bloqueados por mood
        if (this.moodController.isEffectBlocked(effectType)) {
            return {
                available: false,
                reason: `MOOD_BLOCKED: Effect "${effectType}" blocked by current mood`
            };
        }
        // ═══════════════════════════════════════════════════════════════════════════
        // 2.5. 🔒 WAVE 1179: DICTATOR HARD MINIMUM COOLDOWN
        // ═══════════════════════════════════════════════════════════════════════════
        // Este check NO puede ser bypasado por DNA COOLDOWN OVERRIDE.
        // Los efectos dictadores necesitan un mínimo absoluto de respiro.
        // ═══════════════════════════════════════════════════════════════════════════
        const hardMinimum = DICTATOR_HARD_MINIMUM_COOLDOWNS[effectType];
        if (hardMinimum) {
            const lastFired = this.effectTypeLastFired.get(effectType);
            if (lastFired) {
                const elapsed = Date.now() - lastFired;
                const remaining = hardMinimum - elapsed;
                if (remaining > 0) {
                    return {
                        available: false,
                        reason: `🔒 HARD_COOLDOWN: ${effectType} needs ${Math.ceil(remaining / 1000)}s more (dictator protection)`,
                        cooldownRemaining: remaining
                    };
                }
            }
        }
        // 3. ⏱️ COOLDOWN CHECK - El reloj manda
        const lastFired = this.effectTypeLastFired.get(effectType);
        if (lastFired) {
            // Calcular cooldown efectivo
            let baseCooldown = this.config.effectTypeCooldowns[effectType] || this.config.minCooldownMs;
            baseCooldown = this.applyVibeCooldownAdjustment(effectType, baseCooldown, vibeId);
            const effectiveCooldown = this.moodController.applyCooldown(baseCooldown);
            const elapsed = Date.now() - lastFired;
            const remaining = effectiveCooldown - elapsed;
            if (remaining > 0) {
                return {
                    available: false,
                    reason: `COOLDOWN: ${effectType} ready in ${Math.ceil(remaining / 1000)}s`,
                    cooldownRemaining: remaining
                };
            }
        }
        // 4. ✅ AVAILABLE - Pase VIP concedido
        return {
            available: true,
            reason: 'AVAILABLE: Effect ready to fire'
        };
    }
    /**
     * 🚪 WAVE 812: Versión simplificada para checks rápidos
     */
    isAvailable(effectType, vibeId) {
        return this.checkAvailability(effectType, vibeId).available;
    }
    /**
     * 🌊 WAVE 691: Verifica si un efecto específico está en cooldown
     * 🎭 WAVE 700.1: Ahora respeta MoodController
     *    - PUNK forceUnlock = ignora cooldown
     *    - Cooldowns modificados por cooldownMultiplier
     */
    isEffectInCooldown(effectType, vibe) {
        // 🎭 WAVE 700.1: Si el mood tiene forceUnlock para este efecto, NUNCA está en cooldown
        if (this.moodController.isEffectForceUnlocked(effectType)) {
            return false;
        }
        const lastFired = this.effectTypeLastFired.get(effectType);
        if (!lastFired)
            return false;
        // Cooldown base del config
        let baseCooldown = this.config.effectTypeCooldowns[effectType] || this.config.minCooldownMs;
        // 🔥 WAVE 790.2: VIBE-SPECIFIC COOLDOWNS
        // Techno necesita cooldowns más agresivos que Fiesta Latina
        baseCooldown = this.applyVibeCooldownAdjustment(effectType, baseCooldown, vibe || 'unknown');
        // 🎭 WAVE 700.1: Aplicar multiplicador del mood
        const effectiveCooldown = this.moodController.applyCooldown(baseCooldown);
        return (Date.now() - lastFired) < effectiveCooldown;
    }
    /**
     * 🔥 WAVE 790.2: VIBE-SPECIFIC COOLDOWN ADJUSTMENT
     *
     * Ajusta el cooldown base según el vibe activo.
     * Techno necesita cooldowns más agresivos que Fiesta Latina.
     *
     * @param effectType - Tipo de efecto
     * @param baseCooldown - Cooldown base en ms
     * @param vibe - Vibe actual ('fiesta-latina', 'techno-club', etc.)
     * @returns Cooldown ajustado en ms
     */
    applyVibeCooldownAdjustment(effectType, baseCooldown, vibe) {
        // Solo ajustar SolarFlare (otros efectos mantienen su cooldown base)
        if (effectType !== 'solar_flare') {
            return baseCooldown;
        }
        // SolarFlare: Cooldown más agresivo en Techno
        if (vibe === 'techno-club') {
            return 12000; // 12s base para Techno → PUNK:8.4s, BALANCED:18s, CALM:36s
        }
        else if (vibe === 'fiesta-latina') {
            return 30000; // 30s base para Fiesta Latina → PUNK:21s, BALANCED:45s, CALM:90s
        }
        // Fallback: mantener baseCooldown
        return baseCooldown;
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
    calculateCooldown(lastEffectType) {
        if (!lastEffectType)
            return this.config.minCooldownMs;
        // Cooldown extra si repetimos el mismo efecto
        if (this.consecutiveSameEffect > 0) {
            return this.config.sameEffectCooldownMs * (1 + this.consecutiveSameEffect * 0.5);
        }
        return this.config.minCooldownMs;
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // 🔪 WAVE 1010.5: THE PURGE - evaluateHuntFuzzy() REMOVED
    // ═══════════════════════════════════════════════════════════════════════════
    // DELETED: evaluateHuntFuzzy() - Hunt/Fuzzy decision evaluation (118 lines)
    // REASON: DecisionMaker.determineDecisionType() ahora evalúa Hunt/Fuzzy/DIVINE
    // MIGRATED TO: DecisionMaker con lógica unificada de worthiness + DNA approval
    // ═══════════════════════════════════════════════════════════════════════════
    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE: Effect selection logic
    // 🌊 WAVE 691: Refactorizado con cooldowns por tipo y protección anti-ghost
    // 🎭 WAVE 700.1: Integración con MoodController
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * 🎭 WAVE 700.1: Verifica si un efecto está disponible
     * Combina check de cooldown Y check de blockList del mood
     * 🔥 WAVE 790.2: Ahora acepta vibe para cooldowns específicos por vibe
     */
    isEffectAvailable(effectType, vibe) {
        // Primero: ¿está bloqueado por el mood?
        if (this.isEffectBlockedByMood(effectType)) {
            console.log(`[EffectSelector 🎭] ${effectType} BLOCKED by mood ${this.moodController.getCurrentMood().toUpperCase()}`);
            return false;
        }
        // Segundo: ¿está en cooldown? (ya considera forceUnlock del mood)
        if (this.isEffectInCooldown(effectType, vibe)) {
            return false;
        }
        return true;
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// 🔪 WAVE 1010.5: THE PURGE - select() REMOVED
// ═══════════════════════════════════════════════════════════════════════════
// DELETED: select() - decision-making function (230 lines)
// REASON: DecisionMaker es ahora el ÚNICO cerebro. Este módulo es REPOSITORIO.
// MIGRATED TO: DecisionMaker.makeDecision() + getAvailableFromArsenal()
// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// � WAVE 1010.5: THE PURGE - classifyZScore() REMOVED
// ═══════════════════════════════════════════════════════════════════════════
// DELETED: classifyZScore() - Z-Score classification with energy awareness
// REASON: Esta lógica ahora vive en DecisionMaker.determineDecisionType()
// MIGRATED TO: DecisionMaker con zone awareness integrada
// ═══════════════════════════════════════════════════════════════════════════
/**
 * 🔋 WAVE 936: EFECTOS PERMITIDOS POR VIBE
 *
 * ¡ADIÓS CUMBIA EN TECHNO! Cada vibe tiene su propio arsenal.
 * El VibeLeakShield garantiza que los efectos latinos no contaminen techno.
 */
ArsenalRepository.EFFECTS_BY_VIBE = {
    // 🔪 TECHNO CLUB: El Arsenal Industrial
    'techno-club': [
        'ghost_breath', // Respiro oscuro
        'acid_sweep', // Sweeps volumétricos
        'cyber_dualism', // Ping-pong L/R
        'gatling_raid', // Machine gun
        'sky_saw', // Cortes agresivos
        'industrial_strobe', // El martillo
        'strobe_burst', // Impacto puntual
        'abyssal_rise', // Transición épica
        'tidal_wave', // Ola industrial
        // 🌫️ WAVE 938: ATMOSPHERIC ARSENAL (low-energy zones)
        'void_mist', // Neblina púrpura con respiración
        // 🔪 WAVE 986: static_pulse PURGED - replaced by binary_glitch + seismic_snap
        'digital_rain', // Matrix flicker cyan/lime
        'deep_breath', // Respiración orgánica azul/púrpura
        // ⚡ WAVE 977: LA FÁBRICA - Nuevos efectos
        'ambient_strobe', // Flashes dispersos tipo cámara (gentle/active)
        'sonar_ping', // Ping submarino back→front (silence/valley)
        // 🔪 WAVE 988: FIX! binary_glitch + seismic_snap AÑADIDOS (estaban en zonas pero NO en vibe!)
        'binary_glitch', // ⚡ Digital stutter chaos (gentle/active)
        'seismic_snap', // 💥 Mechanical impact snap (active/intense)
        // 🔮 WAVE 988: THE FINAL ARSENAL
        'fiber_optics', // 🌈 Ambient traveling colors (silence/valley)
        'core_meltdown', // ☢️ LA BESTIA - extreme strobe (peak only)
        // 🔥 WAVE 2182: PARS PAINT, MOVERS PIERCE
        'neon_blinder', // ⚡ APEX flash wall (peak)
        'surgical_strike', // 🎯 APEX mover strobe (peak)
        'ghost_chase', // 👻 Phantom dimmer chase (ambient) — WAVE 2186: valley→ambient
    ],
    // 🎺 FIESTA LATINA: El Arsenal Tropical
    // 🔓 WAVE 2186: Purga EDM + resurrección del roster completo
    'fiesta-latina': [
        'ghost_breath', // Respiro suave
        'tidal_wave', // Ola oceánica
        'cumbia_moon', // Luna cumbianchera
        'clave_rhythm', // Ritmo de clave
        'tropical_pulse', // Pulso de conga
        'salsa_fire', // Fuego salsero
        'strobe_burst', // Para drops latinos
        'solar_flare', // Explosión solar — APEX de luz latina
        'corazon_latino', // El alma del arquitecto
        'amazon_mist', // 🌿 Neblina amazónica
        'glitch_guaguanco', // 🎭 Guaguancó glitcheado
        'machete_spark', // ⚔️ Chispa de machete
        'latina_meltdown', // ☢️ Nuclear latina
        'oro_solido', // 🥇 WAVE 2189: El Trompetazo — muro de oro drop APEX
    ],
    // ═══════════════════════════════════════════════════════════════════════════
    // 🎸 WAVE 1020: POP-ROCK LEGENDS ARSENAL - LOS 5 MAGNÍFICOS
    // ═══════════════════════════════════════════════════════════════════════════
    'pop-rock': [
        // 🌊 CORE (80% del show - bread & butter)
        'arena_sweep', // Barrido de Wembley, vShape con inercia
        'amp_heat', // Válvulas calientes, intros/versos
        // 🎸 HIGH IMPACT (momentos especiales)
        'liquid_solo', // Spotlight del guitarrista, solos
        'thunder_struck', // Stadium blinder, drops
        // 😵 CHAOS (harshness reactive)
        'feedback_storm', // Caos visual, metal/distorsión
        // ═══════════════════════════════════════════════════════════════════════
        // 🎸 WAVE 1020.9: ROCK ARSENAL EXPANSION - LOS 3 NUEVOS MAGNÍFICOS
        // ═══════════════════════════════════════════════════════════════════════
        'stage_wash', // Respiro cálido, transiciones/intros
        'spotlight_pulse', // Pulso emotivo, builds contemplativos
        'power_chord', // Flash + strobe, golpes de acorde/drops
        // 🌐 UNIVERSAL FALLBACKS (compartidos)
        'ghost_breath', // Respiro suave (breakdowns)
        'strobe_burst', // Impacto puntual (drops menores)
    ],
};
// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════
let repositoryInstance = null;
export function getArsenalRepository() {
    if (!repositoryInstance) {
        repositoryInstance = new ArsenalRepository();
    }
    return repositoryInstance;
}
export function resetArsenalRepository() {
    repositoryInstance = null;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎛️ EFFECT MANAGER - THE ORCHESTRA CONDUCTOR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 600: EFFECT ARSENAL
 * WAVE 680: THE ARSENAL & THE SHIELD
 *
 * El EffectManager es el orquestador central de todos los efectos.
 * Mantiene la lista de efectos activos, los actualiza cada frame,
 * y combina sus outputs para el MasterArbiter.
 *
 * 🛡️ WAVE 680: THE SHIELD - Sistema de permisos por Vibe
 * Antes de disparar cualquier efecto, consulta las restricciones del Vibe activo.
 * Si el efecto está prohibido, se bloquea. Si está degradado, se ajusta.
 *
 * RESPONSABILIDADES:
 * 1. Registry de tipos de efectos disponibles
 * 2. Instanciar y disparar efectos bajo demanda
 * 3. 🛡️ Validar permisos de Vibe antes de disparar (THE SHIELD)
 * 4. Actualizar efectos activos cada frame
 * 5. Combinar outputs (HTP para dimmer, LTP para color)
 * 6. Limpiar efectos terminados
 *
 * SINGLETON: Solo hay un EffectManager global
 *
 * @module core/effects/EffectManager
 * @version WAVE 680
 */
import { EventEmitter } from 'events';
// Import effect library
import { SolarFlare } from './library/fiestalatina/SolarFlare';
import { StrobeStorm } from './library/fiestalatina/StrobeStorm';
import { StrobeBurst } from './library/fiestalatina/StrobeBurst';
import { TidalWave } from './library/fiestalatina/TidalWave';
import { GhostBreath } from './library/fiestalatina/GhostBreath';
// 🎺 WAVE 692: FIESTA LATINA ARSENAL
import { TropicalPulse } from './library/fiestalatina/TropicalPulse';
import { SalsaFire } from './library/fiestalatina/SalsaFire';
// 🥁 WAVE 700.6: NEW LATINA EFFECT
import { ClaveRhythm } from './library/fiestalatina/ClaveRhythm';
import { CumbiaMoon } from './library/fiestalatina/CumbiaMoon';
// ❤️ WAVE 750: THE ARCHITECT'S SOUL
import { CorazonLatino } from './library/fiestalatina/CorazonLatino';
// 🔪 WAVE 780: TECHNO CLUB - THE BLADE
import { IndustrialStrobe } from './library/techno/IndustrialStrobe';
import { AcidSweep } from './library/techno/AcidSweep';
// 🤖 WAVE 810: UNLOCK THE TWINS
import { CyberDualism } from './library/techno/CyberDualism';
// � WAVE 930: ARSENAL PESADO
import { GatlingRaid } from './library/techno/GatlingRaid';
import { SkySaw } from './library/techno/SkySaw';
import { AbyssalRise } from './library/techno/AbyssalRise';
// 🌫️ WAVE 938: ATMOSPHERIC ARSENAL (low-energy zones)
import { VoidMist } from './library/techno/VoidMist';
// 🔪 WAVE 986: StaticPulse PURGED - replaced by BinaryGlitch + SeismicSnap
import { DigitalRain } from './library/techno/DigitalRain';
import { DeepBreath } from './library/techno/DeepBreath';
// ⚡ WAVE 977: LA FÁBRICA - Nuevos efectos
import { AmbientStrobe } from './library/techno/AmbientStrobe';
import { SonarPing } from './library/techno/SonarPing';
// 🔪 WAVE 986: ACTIVE REINFORCEMENTS - Nuevas armas rápidas
import { BinaryGlitch } from './library/techno/BinaryGlitch';
import { SeismicSnap } from './library/techno/SeismicSnap';
// � WAVE 988: THE FINAL ARSENAL
import { FiberOptics } from './library/techno/FiberOptics';
import { CoreMeltdown } from './library/techno/CoreMeltdown';
// �🛡️ WAVE 680: Import VibeManager for THE SHIELD
import { VibeManager } from '../../engine/vibe/VibeManager';
/**
 * 🛡️ EFFECT TYPE → VIBE RULES
 *
 * Define qué efectos son bloqueados/degradados en cada Vibe.
 * Las reglas se consultan en runtime contra el VibeProfile activo.
 */
const EFFECT_VIBE_RULES = {
    'solar_flare': { isDynamic: true },
    'strobe_storm': { requiresStrobe: true, isDynamic: true },
    'strobe_burst': { isDynamic: true }, // 🔥 WAVE 691: Rhythmic strobe for Latina
    'tidal_wave': { isDynamic: true },
    'ghost_breath': { isDynamic: true },
    // 🎺 WAVE 692: FIESTA LATINA ARSENAL
    'tropical_pulse': { isDynamic: true }, // 🌴 Crescendo bursts
    'salsa_fire': { isDynamic: true }, // 🔥 Fire flicker
    'cumbia_moon': { isDynamic: false }, // 🌙 Ambient - allowed even in chill
    // 🥁 WAVE 700.6: NEW LATINA EFFECT
    'clave_rhythm': { isDynamic: true }, // 🥁 3-2 Clave pattern with movement
    // ❤️ WAVE 750: THE ARCHITECT'S SOUL
    'corazon_latino': { isDynamic: true }, // ❤️ Heartbeat passion effect
    // 🔪 WAVE 780: TECHNO CLUB - THE BLADE
    'industrial_strobe': { requiresStrobe: true, isDynamic: true }, // ⚡ Industrial hammer
    'acid_sweep': { isDynamic: true }, // 🧪 Volumetric blade of light
    // 🤖 WAVE 810: UNLOCK THE TWINS
    'cyber_dualism': { isDynamic: true }, // 🤖 Ping-pong L/R spatial targeting
    // 🔫 WAVE 930: ARSENAL PESADO
    'gatling_raid': { isDynamic: true }, // 🔫 Machine gun PARs
    'sky_saw': { isDynamic: true }, // 🗡️ Aggressive mover cuts
    'abyssal_rise': { isDynamic: true }, // 🌪️ Epic 8-bar transition
    // 🌫️ WAVE 938: ATMOSPHERIC ARSENAL
    'void_mist': { isDynamic: false }, // 🌫️ Ambient - allowed in chill
    // 🔪 WAVE 986: static_pulse PURGED
    'digital_rain': { isDynamic: true }, // 💧 Matrix effect - subtle dynamic
    'deep_breath': { isDynamic: false }, // 🫁 Ambient - allowed in chill
    // ⚡ WAVE 977: LA FÁBRICA
    'ambient_strobe': { isDynamic: true }, // 📸 Camera flashes - needs energy
    'sonar_ping': { isDynamic: false }, // 🔵 Submarine ping - allowed in chill (for silences)
    // 🔪 WAVE 986: ACTIVE REINFORCEMENTS
    'binary_glitch': { isDynamic: true }, // ⚡ Digital stutter - tartamudeo código
    'seismic_snap': { isDynamic: true }, // 💥 Physical light snap - golpe de obturador
    // 🔮 WAVE 988: THE FINAL ARSENAL
    'fiber_optics': { isDynamic: false }, // 🌈 Ambient traveling colors - allowed in chill
    'core_meltdown': { requiresStrobe: true, isDynamic: true }, // ☢️ LA BESTIA - extreme strobe
};
const EFFECT_ZONE_MAP = {
    // 🌑 SILENCE (0-15%): Respiración profunda y ecos minimalistas
    'deep_breath': 'silence',
    'sonar_ping': 'silence',
    // 🌫️ VALLEY (15-30%): Niebla y fibras - texturas atmosféricas pasivas
    'void_mist': 'valley',
    'fiber_optics': 'valley',
    // 🌧️ AMBIENT (30-45%): Lluvia digital y barridos ácidos - movimiento suave
    'digital_rain': 'ambient',
    'acid_sweep': 'ambient',
    // ⚡ GENTLE (45-60%): Primeros flashes y glitches - entrada a energía
    'ambient_strobe': 'gentle',
    'binary_glitch': 'gentle',
    // 👯 ACTIVE (60-75%): Dualismo cibernético y snaps sísmicos - ritmo establecido
    'cyber_dualism': 'active',
    'seismic_snap': 'active',
    // ☢️ INTENSE (75-90%): Sierra celestial y ascenso abismal - pre-clímax
    'sky_saw': 'intense',
    'abyssal_rise': 'intense',
    // 💣 PEAK (90-100%): Artillería pesada - territorio de drops
    'gatling_raid': 'peak',
    'core_meltdown': 'peak',
    'industrial_strobe': 'peak',
};
// ═══════════════════════════════════════════════════════════════════════════
// EFFECT MANAGER CLASS
// ═══════════════════════════════════════════════════════════════════════════
export class EffectManager extends EventEmitter {
    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────
    constructor() {
        super();
        // ─────────────────────────────────────────────────────────────────────────
        // State
        // ─────────────────────────────────────────────────────────────────────────
        /** Registry de factories de efectos */
        this.effectFactories = new Map();
        /** Efectos actualmente activos */
        this.activeEffects = new Map();
        /** Stats */
        this.stats = {
            totalTriggered: 0,
            lastTriggered: null,
            lastTriggerTime: 0,
        };
        /** Frame timing */
        this.lastUpdateTime = Date.now();
        this.registerBuiltinEffects();
        console.log('[EffectManager 🎛️] Initialized with built-in effects');
    }
    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * 🧨 TRIGGER - Dispara un efecto
     *
     * 🛡️ WAVE 680: THE SHIELD integrado
     * 🚦 WAVE 700.7: TRAFFIC CONTROL integrado
     *
     * Antes de disparar:
     * 1. Valida permisos del Vibe activo (THE SHIELD)
     * 2. Verifica si hay efectos críticos activos (TRAFFIC LIGHT)
     * 3. Evita duplicados del mismo tipo
     *
     * @param config Configuración del disparo
     * @returns ID de la instancia del efecto, o null si bloqueado/falla
     */
    trigger(config) {
        const factory = this.effectFactories.get(config.effectType);
        if (!factory) {
            console.warn(`[EffectManager ⚠️] Unknown effect type: ${config.effectType}`);
            return null;
        }
        // 🚦 WAVE 700.7: TRAFFIC CONTROL - Check if busy with critical effect
        const trafficResult = this.checkTraffic(config.effectType);
        if (!trafficResult.allowed) {
            console.log(`[EffectManager 🚦] ${config.effectType} BLOCKED: ${trafficResult.reason}`);
            this.emit('effectBlocked', {
                effectType: config.effectType,
                vibeId: config.musicalContext?.vibeId || 'unknown',
                reason: trafficResult.reason,
            });
            return null;
        }
        // 🛡️ THE SHIELD - Validar permisos del Vibe
        const vibeId = config.musicalContext?.vibeId || this.getCurrentVibeId();
        const shieldResult = this.validateWithShield(config.effectType, vibeId);
        if (!shieldResult.allowed) {
            console.log(`[EffectManager ⛔] ${config.effectType} BLOCKED in ${vibeId}. ${shieldResult.message}`);
            this.emit('effectBlocked', {
                effectType: config.effectType,
                vibeId,
                reason: shieldResult.message,
            });
            return null;
        }
        // Crear nueva instancia
        const effect = factory();
        // 🛡️ Si está degradado, aplicar constraints
        if (shieldResult.degraded && shieldResult.constraints) {
            this.applyShieldConstraints(effect, shieldResult.constraints);
            console.log(`[EffectManager ⚠️] ${config.effectType} DEGRADED in ${vibeId}. ${shieldResult.message}`);
        }
        // Disparar
        effect.trigger(config);
        // Registrar como activo
        this.activeEffects.set(effect.id, effect);
        // Stats
        this.stats.totalTriggered++;
        this.stats.lastTriggered = config.effectType;
        this.stats.lastTriggerTime = Date.now();
        // Emit event
        this.emit('effectTriggered', {
            effectId: effect.id,
            effectType: config.effectType,
            intensity: config.intensity,
            source: config.source,
            vibeId,
            degraded: shieldResult.degraded,
        });
        // 🛡️ WAVE 811: Log ÚNICO de ejecución - LA VOZ DEL EJECUTOR
        // Incluye: efecto, vibe, source, degraded, intensidad, z-score
        const shieldStatus = shieldResult.degraded ? '⚠️DEGRADED' : '';
        const zInfo = config.musicalContext?.zScore
            ? `Z:${config.musicalContext.zScore.toFixed(1)}`
            : '';
        const sourceTag = config.source ? `[${config.source}]` : '';
        console.log(`[EffectManager 🔥] ${config.effectType} FIRED ${sourceTag} in ${vibeId} ${shieldStatus} | I:${config.intensity.toFixed(2)} ${zInfo}`);
        return effect.id;
    }
    /**
     * 🔄 UPDATE - Actualiza todos los efectos activos
     *
     * Llamar cada frame desde TitanEngine o el main loop.
     */
    update() {
        const now = Date.now();
        const deltaMs = now - this.lastUpdateTime;
        this.lastUpdateTime = now;
        // Update each active effect
        const toRemove = [];
        for (const [id, effect] of this.activeEffects) {
            effect.update(deltaMs);
            if (effect.isFinished()) {
                toRemove.push(id);
            }
        }
        // Remove finished effects
        for (const id of toRemove) {
            this.activeEffects.delete(id);
            this.emit('effectFinished', { effectId: id });
        }
    }
    /**
     * 📤 GET COMBINED OUTPUT - Output combinado de todos los efectos activos
     *
     * Combina usando:
     * - HTP (Highest Takes Precedence) para dimmer
     * - Mayor prioridad para color
     * - 🧨 WAVE 630: globalOverride bypasea zonas
     * - 🥁 WAVE 700.7: Mayor prioridad para movement
     * - 🎨 WAVE 725: zoneOverrides para pinceles finos
     */
    getCombinedOutput() {
        if (this.activeEffects.size === 0) {
            return {
                hasActiveEffects: false,
                intensity: 0,
                contributingEffects: [],
            };
        }
        let maxDimmer = 0;
        let maxWhite = 0;
        let maxAmber = 0; // 🧨 WAVE 630
        let maxStrobeRate = 0;
        let maxIntensity = 0;
        let globalOverride = false; // 🧨 WAVE 630
        let highestPriorityColor;
        let highestPriority = -1; // Para color (legacy)
        // 🚂 WAVE 800: Mix Bus del efecto dominante
        let dominantMixBus = 'htp';
        // 🔗 WAVE 991: Prioridad separada para mixBus (THE MISSING LINK)
        let mixBusPriority = -1;
        // 🥁 WAVE 700.7: Movement tracking
        let highestPriorityMovement;
        let movementPriority = -1;
        // 🌴 WAVE 700.8: Zone tracking
        const allZones = new Set();
        const contributing = [];
        // 🎨 WAVE 725: Zone overrides acumulados de todos los efectos
        // Estructura: { [zoneId]: { color?, dimmer?, white?, amber?, movement?, priority } }
        const combinedZoneOverrides = {};
        for (const [id, effect] of this.activeEffects) {
            const output = effect.getOutput();
            if (!output)
                continue;
            contributing.push(id);
            // HTP for dimmer
            if (output.dimmerOverride !== undefined && output.dimmerOverride > maxDimmer) {
                maxDimmer = output.dimmerOverride;
            }
            // HTP for white
            if (output.whiteOverride !== undefined && output.whiteOverride > maxWhite) {
                maxWhite = output.whiteOverride;
            }
            // 🧨 WAVE 630: HTP for amber
            if (output.amberOverride !== undefined && output.amberOverride > maxAmber) {
                maxAmber = output.amberOverride;
            }
            // Max strobe rate
            if (output.strobeRate !== undefined && output.strobeRate > maxStrobeRate) {
                maxStrobeRate = output.strobeRate;
            }
            // Max intensity
            if (output.intensity > maxIntensity) {
                maxIntensity = output.intensity;
            }
            // 🧨 WAVE 630: Global override - cualquier efecto con globalOverride activa el bypass
            if (output.globalOverride) {
                globalOverride = true;
            }
            // Highest priority takes color (legacy fallback)
            if (output.colorOverride && effect.priority > highestPriority) {
                highestPriority = effect.priority;
                highestPriorityColor = output.colorOverride;
            }
            // � WAVE 991: THE MISSING LINK - El efecto de mayor prioridad determina el mixBus
            // CRÍTICO: Usar variable SEPARADA (mixBusPriority) para no depender de colorOverride
            // REGLA: Si hay empate de prioridad Y uno es 'global', el 'global' SIEMPRE gana
            if (effect.priority > mixBusPriority ||
                (effect.priority === mixBusPriority && effect.mixBus === 'global')) {
                mixBusPriority = effect.priority;
                dominantMixBus = effect.mixBus;
            }
            // 🥁 WAVE 700.7: Highest priority takes movement
            if (output.movement && effect.priority > movementPriority) {
                movementPriority = effect.priority;
                highestPriorityMovement = output.movement;
            }
            // 🌴 WAVE 700.8: Collect zones
            if (output.zones && output.zones.length > 0) {
                output.zones.forEach(z => allZones.add(z));
            }
            // 🎨 WAVE 725: ZONE OVERRIDES - "PINCELES FINOS"
            // Procesar zoneOverrides del efecto y mezclarlos con HTP/LTP
            if (output.zoneOverrides) {
                const zoneEntries = Object.entries(output.zoneOverrides);
                for (const [zoneId, zoneData] of zoneEntries) {
                    if (!combinedZoneOverrides[zoneId]) {
                        // Primera vez que vemos esta zona - inicializar
                        combinedZoneOverrides[zoneId] = {
                            priority: effect.priority,
                        };
                    }
                    const existing = combinedZoneOverrides[zoneId];
                    const existingPriority = existing.priority ?? -1;
                    // HTP para dimmer (el más alto gana)
                    if (zoneData.dimmer !== undefined) {
                        if (existing.dimmer === undefined || zoneData.dimmer > existing.dimmer) {
                            existing.dimmer = zoneData.dimmer;
                        }
                    }
                    // HTP para white (el más alto gana)
                    if (zoneData.white !== undefined) {
                        if (existing.white === undefined || zoneData.white > existing.white) {
                            existing.white = zoneData.white;
                        }
                    }
                    // HTP para amber (el más alto gana)
                    if (zoneData.amber !== undefined) {
                        if (existing.amber === undefined || zoneData.amber > existing.amber) {
                            existing.amber = zoneData.amber;
                        }
                    }
                    // LTP para color (mayor prioridad gana)
                    if (zoneData.color && effect.priority >= existingPriority) {
                        existing.color = zoneData.color;
                        existing.priority = effect.priority;
                    }
                    // LTP para movement (mayor prioridad gana)
                    if (zoneData.movement && effect.priority >= existingPriority) {
                        existing.movement = zoneData.movement;
                    }
                    // Agregar zona al set
                    allZones.add(zoneId);
                }
            }
        }
        // 🎨 WAVE 725: Determinar si hay zone overrides activos
        const hasZoneOverrides = Object.keys(combinedZoneOverrides).length > 0;
        return {
            hasActiveEffects: true,
            mixBus: dominantMixBus, // 🚂 WAVE 800: Railway Switch
            dimmerOverride: maxDimmer > 0 ? maxDimmer : undefined,
            whiteOverride: maxWhite > 0 ? maxWhite : undefined,
            amberOverride: maxAmber > 0 ? maxAmber : undefined, // 🧨 WAVE 630
            colorOverride: highestPriorityColor, // Legacy fallback
            strobeRate: maxStrobeRate > 0 ? maxStrobeRate : undefined,
            intensity: maxIntensity,
            contributingEffects: contributing,
            globalOverride: globalOverride, // 🧨 WAVE 630
            zones: allZones.size > 0 ? Array.from(allZones) : undefined, // 🌴 WAVE 700.8
            movementOverride: highestPriorityMovement, // 🥁 WAVE 700.7
            zoneOverrides: hasZoneOverrides ? combinedZoneOverrides : undefined, // 🎨 WAVE 725
        };
    }
    /**
     * 📊 GET STATE - Estado actual del manager
     */
    getState() {
        return {
            activeCount: this.activeEffects.size,
            activeEffects: Array.from(this.activeEffects.keys()),
            lastTriggered: this.stats.lastTriggered,
            lastTriggerTime: this.stats.lastTriggerTime,
            totalTriggered: this.stats.totalTriggered,
        };
    }
    /**
     * ⛔ ABORT ALL - Aborta todos los efectos activos
     */
    abortAll() {
        for (const effect of this.activeEffects.values()) {
            effect.abort();
        }
        this.activeEffects.clear();
        console.log('[EffectManager ⛔] All effects aborted');
    }
    /**
     * ⛔ ABORT - Aborta un efecto específico
     */
    abort(effectId) {
        const effect = this.activeEffects.get(effectId);
        if (effect) {
            effect.abort();
            this.activeEffects.delete(effectId);
            return true;
        }
        return false;
    }
    /**
     * 📋 LIST AVAILABLE - Lista tipos de efectos disponibles
     */
    getAvailableEffects() {
        return Array.from(this.effectFactories.keys());
    }
    /**
     * 🔌 REGISTER EFFECT - Registra un nuevo tipo de efecto
     */
    registerEffect(effectType, factory) {
        this.effectFactories.set(effectType, factory);
        console.log(`[EffectManager 🔌] Registered effect: ${effectType}`);
    }
    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE: Built-in effects registration
    // ─────────────────────────────────────────────────────────────────────────
    registerBuiltinEffects() {
        // ☀️ Solar Flare - WAVE 600
        this.effectFactories.set('solar_flare', () => new SolarFlare());
        // ⚡ Strobe Storm - WAVE 680 (harsh, for rock/techno)
        this.effectFactories.set('strobe_storm', () => new StrobeStorm());
        // 🔥 Strobe Burst - WAVE 691 (rhythmic, for latina/festive)
        this.effectFactories.set('strobe_burst', () => new StrobeBurst());
        // 🌊 Tidal Wave - WAVE 680
        this.effectFactories.set('tidal_wave', () => new TidalWave());
        // 👻 Ghost Breath - WAVE 680
        this.effectFactories.set('ghost_breath', () => new GhostBreath());
        // ═══════════════════════════════════════════════════════════════════════
        // 🎺 WAVE 692: FIESTA LATINA ARSENAL
        // ═══════════════════════════════════════════════════════════════════════
        // 🌴 Tropical Pulse - Crescendo bursts like conga rhythm
        this.effectFactories.set('tropical_pulse', () => new TropicalPulse());
        // 🔥 Salsa Fire - Organic fire flicker effect  
        this.effectFactories.set('salsa_fire', () => new SalsaFire());
        // 🌙 Cumbia Moon - Soft breathing glow for breakdowns
        this.effectFactories.set('cumbia_moon', () => new CumbiaMoon());
        // ═══════════════════════════════════════════════════════════════════════
        // 🥁 WAVE 700.6: NEW LATINA EFFECT
        // ═══════════════════════════════════════════════════════════════════════
        // 🥁 Clave Rhythm - 3-2 pattern with color + movement
        this.effectFactories.set('clave_rhythm', () => new ClaveRhythm());
        // ═══════════════════════════════════════════════════════════════════════
        // ❤️ WAVE 750: THE ARCHITECT'S SOUL
        // ═══════════════════════════════════════════════════════════════════════
        // ❤️ Corazón Latino - Heartbeat passion effect for epic moments
        this.effectFactories.set('corazon_latino', () => new CorazonLatino());
        // ═══════════════════════════════════════════════════════════════════════
        // 🔪 WAVE 780: TECHNO CLUB - THE BLADE
        // 🤖 WAVE 810: UNLOCK THE TWINS
        // 🔫 WAVE 930: ARSENAL PESADO
        // ═══════════════════════════════════════════════════════════════════════
        // ⚡ Industrial Strobe - The hammer that strikes steel
        this.effectFactories.set('industrial_strobe', () => new IndustrialStrobe());
        // 🧪 Acid Sweep - Volumetric blade of light
        this.effectFactories.set('acid_sweep', () => new AcidSweep());
        // 🤖 Cyber Dualism - The ping-pong twins (L/R spatial targeting)
        this.effectFactories.set('cyber_dualism', () => new CyberDualism());
        // 🔫 Gatling Raid - Machine gun PAR barrage
        this.effectFactories.set('gatling_raid', () => new GatlingRaid());
        // 🗡️ Sky Saw - Aggressive mover cuts
        this.effectFactories.set('sky_saw', () => new SkySaw());
        // 🌪️ Abyssal Rise - Epic 8-bar transition
        this.effectFactories.set('abyssal_rise', () => new AbyssalRise());
        // ═══════════════════════════════════════════════════════════════════════
        // 🌫️ WAVE 938: ATMOSPHERIC ARSENAL (low-energy zones)
        // ═══════════════════════════════════════════════════════════════════════
        // 🌫️ Void Mist - Purple fog with breathing
        this.effectFactories.set('void_mist', () => new VoidMist());
        // 🔪 WAVE 986: static_pulse PURGED - replaced by binary_glitch + seismic_snap
        // 💧 Digital Rain - Matrix flicker (cyan/lime)
        this.effectFactories.set('digital_rain', () => new DigitalRain());
        // 🫁 Deep Breath - Organic 4-bar breathing (blue/purple)
        this.effectFactories.set('deep_breath', () => new DeepBreath());
        // ═══════════════════════════════════════════════════════════════════════
        // ⚡ WAVE 977: LA FÁBRICA - Nuevos Efectos
        // ═══════════════════════════════════════════════════════════════════════
        // 📸 Ambient Strobe - Flashes dispersos tipo cámara de estadio (gentle/active zone)
        this.effectFactories.set('ambient_strobe', () => new AmbientStrobe());
        // 🔵 Sonar Ping - Ping submarino back→front (silence/valley zone)
        this.effectFactories.set('sonar_ping', () => new SonarPing());
        // ═══════════════════════════════════════════════════════════════════════
        // 🔪 WAVE 986: ACTIVE REINFORCEMENTS - Nuevas armas rápidas
        // ═══════════════════════════════════════════════════════════════════════
        // ⚡ Binary Glitch - Tartamudeo de código morse corrupto (active zone)
        this.effectFactories.set('binary_glitch', () => new BinaryGlitch());
        // 💥 Seismic Snap - Golpe físico de luz tipo obturador (active/intense zone)
        this.effectFactories.set('seismic_snap', () => new SeismicSnap());
        // ═══════════════════════════════════════════════════════════════════════
        // 🔮 WAVE 988: THE FINAL ARSENAL
        // ═══════════════════════════════════════════════════════════════════════
        // 🌈 Fiber Optics - Traveling ambient colors (silence/valley/ambient)
        this.effectFactories.set('fiber_optics', () => new FiberOptics());
        // ☢️ Core Meltdown - LA BESTIA extreme strobe (intense/peak)
        this.effectFactories.set('core_meltdown', () => new CoreMeltdown());
    }
    /**
     * 🚦 IS BUSY - Check if a critical effect is hogging the stage
     *
     * @returns true if a critical effect is currently active
     */
    isBusy() {
        for (const effect of this.activeEffects.values()) {
            if (EffectManager.CRITICAL_EFFECTS.has(effect.effectType)) {
                return true;
            }
        }
        return false;
    }
    /**
     * 🚦 CHECK TRAFFIC - Full traffic control validation
     *
     * Rules:
     * 0. 🔒 WAVE 998: GLOBAL LOCK - If DICTATOR (mixBus='global') is active → BLOCK ALL (except emergency)
     * 1. If a CRITICAL effect is active → block AMBIENT effects
     * 2. If same effectType is already active → block (no duplicates)
     * 3. 🔒 WAVE 996: ZONE MUTEX - If another effect from same zone is active → block
     * 4. 🌫️ WAVE 998: ATMOSPHERIC EXCLUSIVITY - Only one atmospheric at a time
     * 5. Otherwise → allow
     *
     * @param effectType Effect type to check
     * @returns { allowed: boolean, reason: string }
     */
    checkTraffic(effectType) {
        // 🔒 WAVE 998: Rule 0 - GLOBAL LOCK (THE RESPECT PROTOCOL)
        // Si hay un DICTADOR (mixBus='global') activo, NADIE le interrumpe
        const activeDictator = Array.from(this.activeEffects.values())
            .find(e => e.mixBus === 'global');
        if (activeDictator) {
            // Excepción: Si el candidato es PEAK/EMERGENCY (techno-extreme)
            const isEmergency = ['solar_flare', 'strobe_storm'].includes(effectType);
            const dictatorIsPeak = ['solar_flare', 'strobe_storm'].includes(activeDictator.effectType);
            if (!isEmergency || dictatorIsPeak) {
                console.log(`🔒 [GLOBAL_LOCK] ${effectType} BLOQUEADO: ${activeDictator.effectType} tiene la palabra.`);
                return {
                    allowed: false,
                    reason: `🔒 GLOBAL_LOCK: ${activeDictator.effectType} (dictator) is speaking`,
                };
            }
        }
        // Rule 1: Critical effects block ambient
        if (this.isBusy() && EffectManager.AMBIENT_EFFECTS.has(effectType)) {
            const criticalEffect = Array.from(this.activeEffects.values())
                .find(e => EffectManager.CRITICAL_EFFECTS.has(e.effectType));
            return {
                allowed: false,
                reason: `Blocked by critical effect: ${criticalEffect?.effectType || 'unknown'}`,
            };
        }
        // Rule 2: No duplicates
        const isDuplicate = Array.from(this.activeEffects.values())
            .some(e => e.effectType === effectType);
        if (isDuplicate) {
            return {
                allowed: false,
                reason: `Duplicate blocked: ${effectType} already active`,
            };
        }
        // 🌫️ WAVE 998: Rule 3 - ATMOSPHERIC EXCLUSIVITY
        // Solo un efecto atmosférico a la vez
        const ATMOSPHERIC_EFFECTS = ['void_mist', 'deep_breath', 'sonar_ping', 'fiber_optics', 'digital_rain'];
        const isAtmospheric = ATMOSPHERIC_EFFECTS.includes(effectType);
        if (isAtmospheric) {
            const atmosphericRunning = Array.from(this.activeEffects.values())
                .find(e => ATMOSPHERIC_EFFECTS.includes(e.effectType));
            if (atmosphericRunning) {
                console.log(`🌫️ [ATMOSPHERIC_LOCK] ${effectType} BLOQUEADO: ${atmosphericRunning.effectType} ya está en el aire.`);
                return {
                    allowed: false,
                    reason: `🌫️ ATMOSPHERIC_LOCK: ${atmosphericRunning.effectType} already running`,
                };
            }
        }
        // 🔒 WAVE 996: Rule 4 - ZONE MUTEX
        // Solo un efecto por zona energética a la vez
        const incomingZone = EFFECT_ZONE_MAP[effectType];
        if (incomingZone) {
            const zoneConflict = Array.from(this.activeEffects.values())
                .find(e => EFFECT_ZONE_MAP[e.effectType] === incomingZone);
            if (zoneConflict) {
                return {
                    allowed: false,
                    reason: `🔒 MUTEX: Zone ${incomingZone} occupied by ${zoneConflict.effectType}`,
                };
            }
        }
        // All clear
        return { allowed: true, reason: 'OK' };
    }
    /**
     * 🚦 GET ACTIVE EFFECT TYPES
     * Returns list of currently active effect type names.
     */
    getActiveEffectTypes() {
        return Array.from(this.activeEffects.values()).map(e => e.effectType);
    }
    // ─────────────────────────────────────────────────────────────────────────
    // �🛡️ THE SHIELD - Vibe Permission System (WAVE 680)
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * 🛡️ GET CURRENT VIBE ID
     *
     * Obtiene el Vibe activo del VibeManager singleton.
     */
    getCurrentVibeId() {
        try {
            return VibeManager.getInstance().getActiveVibe().id;
        }
        catch {
            return 'idle'; // Fallback si VibeManager no está inicializado
        }
    }
    /**
     * 🛡️ VALIDATE WITH SHIELD
     *
     * Valida si un efecto está permitido en el Vibe actual.
     *
     * REGLAS:
     * - chill-lounge: BLOQUEO TOTAL de efectos dinámicos
     * - fiesta-latina: strobe PROHIBIDO (degradado a pulsos)
     * - techno-club: SIN RESTRICCIONES
     * - pop-rock: strobe con límite de 10Hz
     * - idle: BLOQUEO TOTAL (no hay show)
     */
    validateWithShield(effectType, vibeId) {
        const rules = EFFECT_VIBE_RULES[effectType];
        // Si no hay reglas para este efecto, permitir
        if (!rules) {
            return { allowed: true, degraded: false, message: 'No rules defined' };
        }
        // Obtener restricciones del Vibe
        let vibeEffects;
        try {
            const vibe = VibeManager.getInstance().getActiveVibe();
            vibeEffects = {
                allowed: vibe.effects.allowed,
                maxStrobeRate: vibe.effects.maxStrobeRate,
                maxIntensity: vibe.effects.maxIntensity,
            };
        }
        catch {
            // Fallback restrictivo si VibeManager falla
            vibeEffects = { allowed: [], maxStrobeRate: 0, maxIntensity: 0 };
        }
        // ═══════════════════════════════════════════════════════════════
        // REGLA 1: chill-lounge e idle = BLOQUEO TOTAL de dinámicos
        // ═══════════════════════════════════════════════════════════════
        if ((vibeId === 'chill-lounge' || vibeId === 'idle') && rules.isDynamic) {
            return {
                allowed: false,
                degraded: false,
                message: `Dynamic effects blocked in ${vibeId}`,
            };
        }
        // ═══════════════════════════════════════════════════════════════
        // REGLA 2: Strobe check - si maxStrobeRate = 0, degradar o bloquear
        // ═══════════════════════════════════════════════════════════════
        if (rules.requiresStrobe) {
            if (vibeEffects.maxStrobeRate === 0) {
                // fiesta-latina: degradar a pulsos simples (no strobe real)
                if (vibeId === 'fiesta-latina') {
                    return {
                        allowed: true,
                        degraded: true,
                        message: `Strobe degraded to pulses (no real strobe in ${vibeId})`,
                        constraints: {
                            maxStrobeRate: 0,
                            maxIntensity: vibeEffects.maxIntensity,
                        },
                    };
                }
                // Otros vibes con maxStrobeRate=0: bloquear
                return {
                    allowed: false,
                    degraded: false,
                    message: `Strobe effects blocked (maxStrobeRate=0)`,
                };
            }
            // Strobe permitido pero con límite de frecuencia
            return {
                allowed: true,
                degraded: vibeEffects.maxStrobeRate < 8, // Degradado si <8Hz
                message: `Strobe allowed (max ${vibeEffects.maxStrobeRate}Hz)`,
                constraints: {
                    maxStrobeRate: vibeEffects.maxStrobeRate,
                    maxIntensity: vibeEffects.maxIntensity,
                },
            };
        }
        // ═══════════════════════════════════════════════════════════════
        // REGLA 3: Efectos dinámicos con maxIntensity < 0.5 = degradados
        // ═══════════════════════════════════════════════════════════════
        if (rules.isDynamic && vibeEffects.maxIntensity < 0.5) {
            return {
                allowed: true,
                degraded: true,
                message: `Effect intensity capped at ${vibeEffects.maxIntensity}`,
                constraints: {
                    maxIntensity: vibeEffects.maxIntensity,
                },
            };
        }
        // ═══════════════════════════════════════════════════════════════
        // DEFAULT: Permitido sin restricciones
        // ═══════════════════════════════════════════════════════════════
        return {
            allowed: true,
            degraded: false,
            message: 'No restrictions',
        };
    }
    /**
     * 🛡️ APPLY SHIELD CONSTRAINTS
     *
     * Aplica constraints del Shield a un efecto antes de dispararlo.
     */
    applyShieldConstraints(effect, constraints) {
        // Si el efecto tiene método setVibeConstraints, usarlo
        if ('setVibeConstraints' in effect && typeof effect.setVibeConstraints === 'function') {
            const degraded = constraints.maxStrobeRate === 0;
            effect.setVibeConstraints(constraints.maxStrobeRate ?? 15, degraded);
        }
    }
}
// ─────────────────────────────────────────────────────────────────────────
// � WAVE 700.7: TRAFFIC CONTROL - The Traffic Light
// ─────────────────────────────────────────────────────────────────────────
/**
 * 🚦 CRITICAL EFFECT TYPES
 * Efectos que bloquean el tráfico mientras están activos.
 * Ningún otro efecto puede dispararse mientras hay uno crítico.
 *
 * 🔥 WAVE 930.1 FIX: AbyssalRise REMOVIDO de CRITICAL
 * Razón: Es un efecto largo (~16s) que bloqueaba todo el sistema.
 * AbyssalRise usa mixBus='global' que ya garantiza control total del output,
 * no necesita además bloquear el traffic de otros efectos.
 */
EffectManager.CRITICAL_EFFECTS = new Set([
    'solar_flare', // Takeover total - nada más puede competir
    'strobe_storm', // Strobe intenso - no mezclar
    'blackout', // Blackout manual
    // 'abyssal_rise' - REMOVIDO WAVE 930.1: mixBus='global' es suficiente
]);
/**
 * 🚦 AMBIENT EFFECT TYPES
 * Efectos que son bloqueados por efectos críticos Y no pueden duplicarse.
 */
EffectManager.AMBIENT_EFFECTS = new Set([
    'tropical_pulse',
    'clave_rhythm',
    'cumbia_moon',
    'salsa_fire',
    'ghost_breath',
    'tidal_wave',
    'strobe_burst',
]);
// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════
let effectManagerInstance = null;
/**
 * Obtiene el singleton del EffectManager
 */
export function getEffectManager() {
    if (!effectManagerInstance) {
        effectManagerInstance = new EffectManager();
    }
    return effectManagerInstance;
}
/**
 * Reset del singleton (para tests)
 */
export function resetEffectManager() {
    if (effectManagerInstance) {
        effectManagerInstance.abortAll();
    }
    effectManagerInstance = null;
}

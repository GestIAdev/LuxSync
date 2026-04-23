/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌊 CHILL STEREO PHYSICS: THE LIVING OCEAN
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 1070.6: Original implementation
 * WAVE 1072: THE OCEAN TRANSLATOR - Integrated OceanicContextAdapter
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Motor hidrostático que controla profundidad oceánica y triggers de criaturas.
 *
 * ZONAS OCEÁNICAS:
 *  SHALLOWS (0-1000m):     Superficie - Verde esmeralda
 *  OCEAN (1000-3000m):     Aguas abiertas - Azul tropical
 *  TWILIGHT (3000-6000m):  Zona crepuscular - Índigo
 *  MIDNIGHT (6000+m):      Abismo profundo - Bioluminiscencia
 *
 * CRIATURAS (Efectos RAROS - Tier 1):
 * - SolarCaustics: clarity alta + TIEMPO en SHALLOWS
 * - SchoolOfFish: transientDensity alta + TIEMPO en OCEAN
 * - WhaleSong: bassEnergy alta + TIEMPO en TWILIGHT
 * - AbyssalJellyfish: spectralFlatness bajo + TIEMPO en MIDNIGHT
 *
 * WAVE 1072: Los triggers ahora requieren TIEMPO EN ZONA, no solo profundidad.
 * Esto evita que los efectos se disparen "con prisas" al llegar a una zona.
 */
import { translateOceanicContext, resetOceanicSmoothing } from './OceanicContextAdapter';
// CONFIGURACIÓN DE ZONAS
const ZONES = {
    SHALLOWS: { min: 0, max: 1000, label: '🌊' },
    OCEAN: { min: 1000, max: 3000, label: '🐠' },
    TWILIGHT: { min: 3000, max: 6000, label: '🐋' },
    MIDNIGHT: { min: 6000, max: 10000, label: '🪼' }
};
// CONFIGURACIÓN MOTOR HIDROSTÁTICO
const HYDROSTATIC_CONFIG = {
    TIDE_CYCLE_MS: 12 * 60 * 1000, // 12 minutos por ciclo completo
    DEBUG_SPEED: 1,
    SURFACE_DEPTH: 0,
    MAX_DEPTH: 10000,
    NEUTRAL_DEPTH: 5000,
    DEPTH_INERTIA: 0.992,
    BUOYANCY_SENSITIVITY: 0,
    BUOYANCY_NEUTRAL_CENTROID: 1200,
};
// CONFIGURACIÓN DE TRIGGERS - CHILL MODE: Cooldowns largos, thresholds altos
// WAVE 1072: Ahora incluye TIME_IN_ZONE_MS - tiempo mínimo en zona antes de trigger
const TRIGGER_CONFIG = {
    // ═══════════════════════════════════════════════════════════════════════════
    // 🐋 MAJOR EFFECTS (45-90s cooldowns) - Los protagonistas
    // ═══════════════════════════════════════════════════════════════════════════
    solarCaustics: {
        cooldownMs: 45000, // 45 segundos entre triggers (era 8s)
        clarityThreshold: 0.75, // 🌊 WAVE 1073.2: 0.88 → 0.75 (más permisivo para chill)
        maxDepth: 1000,
        timeInZoneMs: 10000, // WAVE 1072: 10 segundos mínimo en SHALLOWS
    },
    schoolOfFish: {
        cooldownMs: 35000, // 35 segundos (era 5s)
        transientThreshold: 0.55, // 🌊 WAVE 1073.2: 0.72 → 0.55 (chill music tiene menos transientes)
        minDepth: 1000,
        maxDepth: 3000,
        timeInZoneMs: 8000, // WAVE 1072: 8 segundos mínimo en OCEAN
    },
    whaleSong: {
        cooldownMs: 60000, // 60 segundos - ballenas son raras (era 15s)
        bassThreshold: 0.30, // 🌊 WAVE 1073.5: 0.55 → 0.30 (chill bass es SUAVE)
        minDepth: 3000,
        maxDepth: 6000,
        timeInZoneMs: 15000, // WAVE 1072: 15 segundos mínimo en TWILIGHT
    },
    abyssalJellyfish: {
        cooldownMs: 90000, // 90 segundos - evento especial (era 25s)
        flatnessThreshold: 0.30, // 🌊 WAVE 1073.2: 0.22 → 0.30 (más permisivo)
        minDepth: 6000,
        timeInZoneMs: 20000, // WAVE 1072: 20 segundos mínimo en MIDNIGHT
    },
    // ═══════════════════════════════════════════════════════════════════════════
    // 🎭 WAVE 1074.1: MICRO-FAUNA FILLERS (18-35s cooldowns) - Ambiente de fondo
    // ═══════════════════════════════════════════════════════════════════════════
    surfaceShimmer: {
        cooldownMs: 18000, // 18 segundos - relleno sutil
        maxDepth: 200, // Solo en superficie (<200m)
        timeInZoneMs: 5000, // 5 segundos mínimo
    },
    planktonDrift: {
        cooldownMs: 22000, // 22 segundos
        minDepth: 200,
        maxDepth: 1000, // 200-1000m (transición SHALLOWS→OCEAN)
        timeInZoneMs: 6000,
    },
    deepCurrentPulse: {
        cooldownMs: 28000, // 28 segundos
        minDepth: 1000,
        maxDepth: 6000, // 1000-6000m (OCEAN→TWILIGHT) - Incluye frontera
        timeInZoneMs: 8000,
    },
    bioluminescentSpore: {
        cooldownMs: 35000, // 35 segundos
        minDepth: 6000, // Solo abismo profundo (>6000m) - Sincronizado con lógica de disparo
        timeInZoneMs: 10000,
    },
};
const state = {
    currentDepth: 500,
    currentZone: 'OCEAN',
    lastLoggedDepth: 500,
    lastTriggerTime: {
        // 🌊 WAVE 1073.8: Cooldowns negativos = primer disparo inmediato
        // Major Effects
        solarCaustics: -999999,
        schoolOfFish: -999999,
        whaleSong: -999999,
        abyssalJellyfish: -999999,
        // 🦠 WAVE 1074: Micro-Fauna
        surfaceShimmer: -999999,
        planktonDrift: -999999,
        deepCurrentPulse: -999999,
        bioluminescentSpore: -999999,
    },
    // ⚡ WAVE 2750: WOODSTOCK CHRONO-PURGE — performance.now() monotónico
    // Date.now() puede retroceder con ajustes NTP → delta negativo → physics explota
    startTime: performance.now(),
    zoneEntryTime: performance.now(),
    previousZone: null,
    // ═══════════════════════════════════════════════════════════════════════════
    // 🩰 WAVE 1102: ELASTIC TIME - oceanTime acumula tiempo escalado por BPM
    // El océano respira más rápido cuando la música acelera
    // Base: 60 BPM = 1.0x, 120 BPM = 2.0x, 80 BPM = 1.33x
    // ═══════════════════════════════════════════════════════════════════════════
    oceanTime: 0,
    lastOceanUpdate: performance.now(),
};
// UTILIDADES
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
function lerp(a, b, t) {
    return a + (b - a) * t;
}
function smoothstep(edge0, edge1, x) {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
}
function getZoneFromDepth(depth) {
    if (depth < ZONES.SHALLOWS.max)
        return 'SHALLOWS';
    if (depth < ZONES.OCEAN.max)
        return 'OCEAN';
    if (depth < ZONES.TWILIGHT.max)
        return 'TWILIGHT';
    return 'MIDNIGHT';
}
// MOTOR HIDROSTÁTICO
function calculateHydrostaticDepth(now, godEar) {
    const config = HYDROSTATIC_CONFIG;
    const effectiveTime = (now - state.startTime) * config.DEBUG_SPEED;
    const tidePhase = (effectiveTime % config.TIDE_CYCLE_MS) / config.TIDE_CYCLE_MS;
    const tideWave = (1 - Math.cos(tidePhase * Math.PI * 2)) / 2;
    const tideDepth = config.SURFACE_DEPTH + tideWave * config.MAX_DEPTH;
    // Inercia suave
    state.currentDepth = state.currentDepth * config.DEPTH_INERTIA +
        tideDepth * (1 - config.DEPTH_INERTIA);
    return state.currentDepth;
}
// COLOR GRADING POR PROFUNDIDAD
function calculateColorGrading(depth, energy, now) {
    const zone = getZoneFromDepth(depth);
    let baseHue, baseSat, baseLightness;
    if (zone === 'SHALLOWS') {
        // Verde esmeralda brillante
        baseHue = 160 + Math.sin(now / 5000) * 20;
        baseSat = 75 + energy * 15;
        baseLightness = 55 + energy * 10;
    }
    else if (zone === 'OCEAN') {
        // Azul tropical
        baseHue = 200 + Math.sin(now / 6000) * 15;
        baseSat = 70 + energy * 20;
        baseLightness = 50 + energy * 15;
    }
    else if (zone === 'TWILIGHT') {
        // Índigo profundo
        baseHue = 240 + Math.sin(now / 7000) * 20;
        baseSat = 65 + energy * 15;
        baseLightness = 35 + energy * 10;
    }
    else {
        // Bioluminiscencia (magenta/cyan alternando)
        baseHue = 290 + Math.sin(now / 8000) * 60;
        baseSat = 85 + energy * 10;
        baseLightness = 25 + energy * 15;
    }
    return {
        hue: baseHue,
        saturation: clamp(baseSat, 0, 100),
        lightness: clamp(baseLightness, 0, 100),
    };
}
// FÍSICA DE FLUIDOS
function calculateFluidPhysics(now, energy, depth, godEar) {
    const zone = getZoneFromDepth(depth);
    const pressureFactor = 1 - (depth / HYDROSTATIC_CONFIG.MAX_DEPTH) * 0.5;
    // Osciladores con números primos
    const oscL = Math.sin(now / 3659) + Math.sin(now / 2069) * 0.25;
    const oscR = Math.cos(now / 3023) + Math.sin(now / 2707) * 0.25;
    const breathDepth = (0.35 + energy * 0.3) * pressureFactor;
    const frontL = clamp(0.5 + oscL * breathDepth, 0, 1);
    const frontR = clamp(0.5 + oscR * breathDepth, 0, 1);
    const backL = clamp(0.4 + Math.sin(now / 4007 - 1.8) * 0.35 * pressureFactor, 0, 1);
    const backR = clamp(0.4 + Math.cos(now / 3511 - 2.2) * 0.35 * pressureFactor, 0, 1);
    // Movers
    const moverPanL = 0.5 + Math.sin(now / 5003) * 0.4 * pressureFactor;
    const moverPanR = 0.5 + Math.sin(now / 4003 + Math.PI) * 0.4 * pressureFactor;
    const baseTilt = zone === 'MIDNIGHT' ? 0.7 : zone === 'TWILIGHT' ? 0.6 : 0.5;
    const moverTiltL = baseTilt + Math.cos(now / 2503) * 0.2;
    const moverTiltR = baseTilt + Math.cos(now / 1753 + 0.5) * 0.2;
    const baseIntensity = zone === 'SHALLOWS' ? 0.5 :
        zone === 'OCEAN' ? 0.4 :
            zone === 'TWILIGHT' ? 0.25 : 0.15;
    const clarity = godEar.clarity || 0;
    const lifeActivity = (clarity > 0.7 || energy > 0.65) ? 0.3 : 0;
    const lifePulse = Math.sin(now / 800) > 0.7 ? lifeActivity : 0;
    // ⚡ WAVE 2750: BREATHING GHOST EXORCISM — Movers son fixtures mecánicos.
    // Un dimmer pulsante en un cabezal móvil es ruido visual, no arte.
    // El sinusoidal de ±15% y lifePulse se eliminan del cálculo de movers.
    // PARs/air mantienen lifePulse porque son LED y el efecto es sutil.
    const moverIntL = clamp(baseIntensity + energy * 0.2, 0, 1);
    const moverIntR = clamp(baseIntensity + energy * 0.2, 0, 1);
    const airBase = zone === 'SHALLOWS' ? 0.4 : zone === 'OCEAN' ? 0.25 : 0.1;
    const airIntensity = clamp(airBase + energy * 0.2 + lifePulse * 0.5, 0, 0.7);
    return {
        frontL, frontR, backL, backR,
        moverL: { intensity: moverIntL, pan: moverPanL, tilt: moverTiltL },
        moverR: { intensity: moverIntR, pan: moverPanR, tilt: moverTiltR },
        airIntensity,
    };
}
// TEXTURE MONITOR - Detección de Criaturas
// WAVE 1072: Ahora requiere TIEMPO EN ZONA antes de disparar
function checkOceanicTriggers(godEar, depth, now) {
    const clarity = godEar.clarity || 0;
    const transientDensity = godEar.transientDensity || 0;
    const spectralFlatness = godEar.spectralFlatness ?? 0.5;
    const bassEnergy = godEar.bassEnergy || godEar.bass || 0;
    // WAVE 1072: Tiempo que llevamos en la zona actual
    const timeInZone = now - state.zoneEntryTime;
    const triggers = {
        // Major Effects
        solarCaustics: false,
        schoolOfFish: false,
        whaleSong: false,
        abyssalJellyfish: false,
        // 🦠 WAVE 1074: Micro-Fauna
        surfaceShimmer: false,
        planktonDrift: false,
        deepCurrentPulse: false,
        bioluminescentSpore: false,
    };
    // 🌊 SOLAR CAUSTICS - Solo en SHALLOWS y tras tiempo de aclimatación
    const causticsConfig = TRIGGER_CONFIG.solarCaustics;
    const inShallows = depth < causticsConfig.maxDepth;
    if (inShallows &&
        timeInZone > causticsConfig.timeInZoneMs && // WAVE 1072: Requiere 10s en zona
        clarity > causticsConfig.clarityThreshold &&
        now - state.lastTriggerTime.solarCaustics > causticsConfig.cooldownMs) {
        triggers.solarCaustics = true;
        state.lastTriggerTime.solarCaustics = now;
    }
    // 🐠 SCHOOL OF FISH - Solo en OCEAN y tras tiempo de aclimatación
    const fishConfig = TRIGGER_CONFIG.schoolOfFish;
    const inOcean = depth >= fishConfig.minDepth && depth < fishConfig.maxDepth;
    if (inOcean &&
        timeInZone > fishConfig.timeInZoneMs && // WAVE 1072: Requiere 8s en zona
        transientDensity > fishConfig.transientThreshold &&
        now - state.lastTriggerTime.schoolOfFish > fishConfig.cooldownMs) {
        triggers.schoolOfFish = true;
        state.lastTriggerTime.schoolOfFish = now;
    }
    // 🐋 WHALE SONG - Solo en TWILIGHT y tras tiempo de aclimatación
    const whaleConfig = TRIGGER_CONFIG.whaleSong;
    const inTwilight = depth >= whaleConfig.minDepth && depth <= whaleConfig.maxDepth; // <= para incluir 6000m
    if (inTwilight &&
        timeInZone > whaleConfig.timeInZoneMs && // WAVE 1072: Requiere 15s en zona
        bassEnergy > whaleConfig.bassThreshold &&
        now - state.lastTriggerTime.whaleSong > whaleConfig.cooldownMs) {
        triggers.whaleSong = true;
        state.lastTriggerTime.whaleSong = now;
        console.log(`[🐋 WHALE FIRED] depth=${depth}m bass=${bassEnergy.toFixed(3)} time=${(timeInZone / 1000).toFixed(1)}s`);
    }
    // 🪼 ABYSSAL JELLYFISH - Solo en MIDNIGHT y tras tiempo de aclimatación
    const jellyConfig = TRIGGER_CONFIG.abyssalJellyfish;
    const inMidnight = depth >= jellyConfig.minDepth;
    if (inMidnight &&
        timeInZone > jellyConfig.timeInZoneMs && // WAVE 1072: Requiere 20s en zona
        spectralFlatness < jellyConfig.flatnessThreshold &&
        now - state.lastTriggerTime.abyssalJellyfish > jellyConfig.cooldownMs) {
        triggers.abyssalJellyfish = true;
        state.lastTriggerTime.abyssalJellyfish = now;
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // 🦠 WAVE 1074: MICRO-FAUNA - Ambient Fillers
    // Disparos más frecuentes, menos espectaculares, relleno ambiental
    // ═══════════════════════════════════════════════════════════════════════════
    // ✨ SURFACE SHIMMER - Destellos de superficie (0-1000m SHALLOWS)
    // Dispara con claridad media, cooldown corto
    if (depth < 1000 &&
        clarity > 0.4 &&
        now - state.lastTriggerTime.surfaceShimmer > 18000 // 18s cooldown
    ) {
        triggers.surfaceShimmer = true;
        state.lastTriggerTime.surfaceShimmer = now;
    }
    // 🦠 PLANKTON DRIFT - Deriva de plancton (1000-3000m OCEAN)
    // Dispara con actividad media, cooldown moderado
    if (depth >= 1000 && depth < 3000 &&
        transientDensity > 0.25 &&
        now - state.lastTriggerTime.planktonDrift > 22000 // 22s cooldown
    ) {
        triggers.planktonDrift = true;
        state.lastTriggerTime.planktonDrift = now;
    }
    // 🌀 DEEP CURRENT PULSE - Corrientes profundas (3000-6000m TWILIGHT)
    // Dispara con bass suave, cooldown más largo (no competir con whale)
    if (depth >= 3000 && depth <= 6000 && // <= para incluir 6000m
        bassEnergy > 0.20 && bassEnergy < 0.50 && // Bass suave, no explosivo
        now - state.lastTriggerTime.deepCurrentPulse > 28000 // 28s cooldown
    ) {
        triggers.deepCurrentPulse = true;
        state.lastTriggerTime.deepCurrentPulse = now;
    }
    // ✨ BIOLUMINESCENT SPORE - Esporas abisales (6000m+ MIDNIGHT)
    // Dispara en silencio relativo (flatness muy bajo), cooldown largo
    if (depth >= 6000 &&
        spectralFlatness < 0.15 && // Silencio casi total
        now - state.lastTriggerTime.bioluminescentSpore > 35000 // 35s cooldown
    ) {
        triggers.bioluminescentSpore = true;
        state.lastTriggerTime.bioluminescentSpore = now;
    }
    return triggers;
}
// FUNCIÓN PRINCIPAL
// 🩰 WAVE 1102: Añadido parámetro bpm para Elastic Time
export const calculateChillStereo = (time, energy, air, isKick, godEar = {}, bpm = 60 // 🩰 WAVE 1102: BPM del Pacemaker (default 60 = 1.0x time)
) => {
    // ⚡ WAVE 2750: WOODSTOCK PURGE — monotonic clock
    const now = performance.now();
    // ═══════════════════════════════════════════════════════════════════════════
    // 🩰 WAVE 1102: ELASTIC TIME - El océano respira con la música
    // 
    // En lugar de usar Date.now() directamente para los osciladores,
    // usamos un acumulador de tiempo que escala con el BPM.
    // 
    // - 60 BPM = 1.0x (tempo base, el océano respira normal)
    // - 120 BPM = 2.0x (tempo alto, el océano acelera)
    // - 80 BPM = 1.33x (tempo medio, el océano fluye suave)
    // 
    // Esto sincroniza imperceptiblemente las olas con el pulso de la música.
    // ═══════════════════════════════════════════════════════════════════════════
    const deltaMs = now - state.lastOceanUpdate;
    state.lastOceanUpdate = now;
    // timeScaler: 60 BPM = 1.0x, 120 BPM = 2.0x
    // Si BPM < 40 (silencio o error), fallback a 60 BPM
    const safeBpm = (bpm > 40 && isFinite(bpm)) ? bpm : 60;
    const timeScaler = safeBpm / 60;
    // Acumular tiempo elástico
    state.oceanTime += deltaMs * timeScaler;
    // Usar oceanTime para los osciladores (en lugar de now)
    const elasticTime = state.oceanTime;
    const depth = calculateHydrostaticDepth(now, godEar);
    const zone = getZoneFromDepth(depth);
    // WAVE 1072: Detectar cambio de zona y actualizar zoneEntryTime
    if (state.previousZone !== zone) {
        if (state.previousZone !== null) {
            console.log(`[🌊 ZONE] ${state.previousZone} → ${zone} | Depth: ${depth.toFixed(0)}m`);
        }
        state.zoneEntryTime = now;
        state.previousZone = zone;
    }
    state.currentZone = zone;
    // 🩰 WAVE 1102: Pasar elasticTime a los cálculos de física y color
    const color = calculateColorGrading(depth, energy, elasticTime);
    const physics = calculateFluidPhysics(elasticTime, energy, depth, godEar);
    const oceanicTriggers = checkOceanicTriggers(godEar, depth, now); // Triggers usan tiempo real
    // WAVE 1072: Construir contexto oceánico usando el adapter
    // Calcular tidePhase del ciclo de marea actual (0=superficie, 1=abismo)
    const effectiveTime = (now - state.startTime) * HYDROSTATIC_CONFIG.DEBUG_SPEED;
    const tidePhase = (effectiveTime % HYDROSTATIC_CONFIG.TIDE_CYCLE_MS) / HYDROSTATIC_CONFIG.TIDE_CYCLE_MS;
    const stableMetrics = {
        clarity: godEar.clarity ?? 0.95,
        spectralFlatness: godEar.spectralFlatness ?? 0.35,
        smoothedEnergy: energy, // Ya viene smoothed de arriba en el pipeline
        bassEnergy: godEar.bassEnergy ?? godEar.bass ?? 0,
        crestFactor: godEar.crestFactor ?? 10,
    };
    // translateOceanicContext(depth, zone, tidePhase, godEar?)
    const oceanicContext = translateOceanicContext(depth, zone, tidePhase, stableMetrics);
    const depthChanged = Math.abs(depth - state.lastLoggedDepth) > 500;
    if (depthChanged) {
        state.lastLoggedDepth = depth;
    }
    // 📟 TELEMETRÍA SUBMARINA (Cada ~2 segundos)
    const timeInZone = now - state.zoneEntryTime;
    if (Math.floor(now / 1000) % 2 === 0 && Math.sin(now / 100) > 0.95) {
        console.log(`[🌊 OCEAN] ${ZONES[zone].label} ${depth.toFixed(0)}m | ` +
            `🕐 ${(timeInZone / 1000).toFixed(0)}s in zone | ` +
            `🎨 H:${oceanicContext.hueInfluence.toFixed(0)}° S:${oceanicContext.saturationMod.toFixed(0)} L:${oceanicContext.lightnessMod.toFixed(0)} | ` +
            `⚡ E:${(energy * 100).toFixed(0)}%`);
    }
    // Log de triggers con tiempo en zona
    if (oceanicTriggers.solarCaustics) {
        console.log(`[☀️ CAUSTICS] Solar rays! Depth:${depth.toFixed(0)}m Clarity:${(godEar.clarity || 0).toFixed(2)} | Zone time: ${(timeInZone / 1000).toFixed(0)}s`);
    }
    if (oceanicTriggers.schoolOfFish) {
        console.log(`[🐠 FISH] School crossing! Depth:${depth.toFixed(0)}m Transients:${(godEar.transientDensity || 0).toFixed(2)} | Zone time: ${(timeInZone / 1000).toFixed(0)}s`);
    }
    if (oceanicTriggers.abyssalJellyfish) {
        console.log(`[🪼 JELLY] Bioluminescence! Depth:${depth.toFixed(0)}m Flatness:${(godEar.spectralFlatness ?? 0.5).toFixed(2)} | Zone time: ${(timeInZone / 1000).toFixed(0)}s`);
    }
    const debugMsg = `${ZONES[zone].label} ${depth.toFixed(0)}m | 🕐${(timeInZone / 1000).toFixed(0)}s | H:${oceanicContext.hueInfluence.toFixed(0)}°`;
    return {
        frontL: physics.frontL,
        frontR: physics.frontR,
        backL: physics.backL,
        backR: physics.backR,
        moverL: physics.moverL,
        moverR: physics.moverR,
        // @deprecated: colorOverride se mantiene por retrocompatibilidad
        colorOverride: {
            h: color.hue / 360,
            s: color.saturation / 100,
            l: color.lightness / 100,
        },
        // WAVE 1072: oceanicContext es la forma correcta de modular color
        oceanicContext,
        airIntensity: physics.airIntensity,
        currentDepth: depth,
        currentZone: zone,
        oceanicTriggers,
        debug: depthChanged ? `[DEPTH CHANGE] ${debugMsg}` : debugMsg,
    };
};
// API DE ESTADO
export const resetDeepFieldState = () => {
    state.currentDepth = 500;
    state.currentZone = 'OCEAN';
    state.lastLoggedDepth = 500;
    state.lastTriggerTime = {
        // Major Effects
        solarCaustics: 0, schoolOfFish: 0, whaleSong: 0, abyssalJellyfish: 0,
        // 🦠 WAVE 1074: Micro-Fauna
        surfaceShimmer: 0, planktonDrift: 0, deepCurrentPulse: 0, bioluminescentSpore: 0,
    };
    state.startTime = performance.now();
    state.zoneEntryTime = performance.now(); // WAVE 1072
    state.previousZone = null; // WAVE 1072
    // Reset también el smoothing del adapter oceánico
    resetOceanicSmoothing();
    console.log('[🌊 OCEAN] State reset - returning to surface');
};
export const getDeepFieldState = () => ({
    depth: state.currentDepth,
    zone: state.currentZone,
    triggers: state.lastTriggerTime,
    uptime: performance.now() - state.startTime,
});
/**
 * 🌊 WAVE 2470: THE HYDROSTATIC BRIDGE
 * Calcula el morphFactor oceánico desde la tide machine.
 *
 * morphFactor = 1.0 - (currentDepth / MAX_DEPTH)
 *   - Superficie (0m)    → morphFactor = 1.0 (vibe alto, envelopes máximo rango)
 *   - Abismo (10000m)    → morphFactor = 0.0 (presión total, envelopes planos)
 *
 * Este valor se inyecta al LiquidEngineBase cuando el vibe es chill-lounge,
 * sobreescribiendo el morphFactor calculado por centroid espectral.
 * La tide machine hidrostática es temporalmente determinista — no audio-driven.
 */
export const getOceanicMorphFactor = () => {
    const depth = state.currentDepth;
    const morphFactor = 1.0 - (depth / HYDROSTATIC_CONFIG.MAX_DEPTH);
    return Math.min(1.0, Math.max(0.0, morphFactor));
};
// DEPTH VALIDATION
// 🛡️ WAVE 1074.1: DEPTH GUARD EXTENSION - Incluye micro-fauna
export const isOceanicEffectValidForDepth = (effectType) => {
    const depth = state.currentDepth;
    const zone = state.currentZone;
    switch (effectType) {
        // ═══════════════════════════════════════════════════════════════════════════
        // 🐋 MAJOR EFFECTS - Depth Validation
        // ═══════════════════════════════════════════════════════════════════════════
        case 'solar_caustics':
            if (depth > TRIGGER_CONFIG.solarCaustics.maxDepth) {
                return {
                    valid: false,
                    reason: `🛡️ DEPTH BLOCK: solar_caustics requiere depth<1000m, actual=${Math.round(depth)}m (${zone})`
                };
            }
            return { valid: true, reason: '' };
        case 'school_of_fish':
            if (depth < TRIGGER_CONFIG.schoolOfFish.minDepth || depth > TRIGGER_CONFIG.schoolOfFish.maxDepth) {
                return {
                    valid: false,
                    reason: `🛡️ DEPTH BLOCK: school_of_fish requiere 1000-3000m, actual=${Math.round(depth)}m (${zone})`
                };
            }
            return { valid: true, reason: '' };
        case 'whale_song':
            if (depth < TRIGGER_CONFIG.whaleSong.minDepth || depth > TRIGGER_CONFIG.whaleSong.maxDepth) {
                return {
                    valid: false,
                    reason: `🛡️ DEPTH BLOCK: whale_song requiere 3000-6000m, actual=${Math.round(depth)}m (${zone})`
                };
            }
            return { valid: true, reason: '' };
        case 'abyssal_jellyfish':
            if (depth < TRIGGER_CONFIG.abyssalJellyfish.minDepth) {
                return {
                    valid: false,
                    reason: `🛡️ DEPTH BLOCK: abyssal_jellyfish requiere depth>6000m, actual=${Math.round(depth)}m (${zone})`
                };
            }
            return { valid: true, reason: '' };
        // ═══════════════════════════════════════════════════════════════════════════
        // 🎭 WAVE 1074.1: MICRO-FAUNA DEPTH GUARD
        // Evita que el DecisionMaker dispare efectos de fondo en la zona incorrecta
        // ═══════════════════════════════════════════════════════════════════════════
        case 'surface_shimmer':
            if (depth > TRIGGER_CONFIG.surfaceShimmer.maxDepth) {
                return {
                    valid: false,
                    reason: `🛡️ DEPTH BLOCK: surface_shimmer requiere depth<200m, actual=${Math.round(depth)}m (${zone})`
                };
            }
            return { valid: true, reason: '' };
        case 'plankton_drift':
            if (depth < TRIGGER_CONFIG.planktonDrift.minDepth || depth > TRIGGER_CONFIG.planktonDrift.maxDepth) {
                return {
                    valid: false,
                    reason: `🛡️ DEPTH BLOCK: plankton_drift requiere 200-1000m, actual=${Math.round(depth)}m (${zone})`
                };
            }
            return { valid: true, reason: '' };
        case 'deep_current_pulse':
            if (depth < TRIGGER_CONFIG.deepCurrentPulse.minDepth || depth > TRIGGER_CONFIG.deepCurrentPulse.maxDepth) {
                return {
                    valid: false,
                    reason: `🛡️ DEPTH BLOCK: deep_current_pulse requiere 1000-6000m, actual=${Math.round(depth)}m (${zone})`
                };
            }
            return { valid: true, reason: '' };
        case 'bioluminescent_spore':
            if (depth < TRIGGER_CONFIG.bioluminescentSpore.minDepth) {
                return {
                    valid: false,
                    reason: `🛡️ DEPTH BLOCK: bioluminescent_spore requiere depth>6000m, actual=${Math.round(depth)}m (${zone})`
                };
            }
            return { valid: true, reason: '' };
        default:
            return { valid: true, reason: '' };
    }
};
// Exportar configuración para UI/debug
export const OCEAN_CONFIG = {
    ZONES,
    HYDROSTATIC: HYDROSTATIC_CONFIG,
    TRIGGERS: TRIGGER_CONFIG,
};

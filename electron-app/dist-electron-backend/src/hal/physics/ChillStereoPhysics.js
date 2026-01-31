/**
 * ═══════════════════════════════════════════════════════════════════════════
 * � CHILL STEREO PHYSICS: THE LIVING OCEAN (WAVE 1070)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 1064: THE FOUR WORLDS - Color Grading por Profundidad
 * WAVE 1070: THE LIVING OCEAN - Ecosistema Hidrostático Generativo
 *
 * ZONAS OCEÁNICAS:
 * 🌿 SHALLOWS (0-200m):     "Sunlight" - Verde Esmeralda brillante
 * 🐬 OPEN_OCEAN (200-1000m): "Clear Water" - Azul Tropical
 * 🐋 TWILIGHT (1000-4000m):  "Deep Pressure" - Índigo Puro
 * 🪼 MIDNIGHT (4000+m):      "Bioluminescence" - Neón oscuro
 *
 * MOTOR HIDROSTÁTICO:
 * - Ciclo de marea: 45 minutos (configurable con DEBUG_SPEED)
 * - Profundidad máxima: 8000m (Fosa de las Marianas)
 * - Lastre musical: centroid controla flotabilidad
 * - Presión visual: lightness decrece con profundidad
 *
 * CRIATURAS OCEÁNICAS (Triggers para EffectManager):
 * - SolarCaustics: clarity alta en SHALLOWS
 * - SchoolOfFish: transientDensity alta en OPEN_OCEAN
 * - AbyssalJellyfish: spectralFlatness bajo en MIDNIGHT
 */
// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE ZONAS
// ═══════════════════════════════════════════════════════════════════════════
const ZONES = {
    SHALLOWS: { min: 0, max: 200, label: '🌿' },
    OPEN_OCEAN: { min: 200, max: 1000, label: '🐬' },
    TWILIGHT: { min: 1000, max: 4000, label: '🐋' },
    MIDNIGHT: { min: 4000, max: 11000, label: '🪼' }
};
// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN DEL MOTOR HIDROSTÁTICO
// ═══════════════════════════════════════════════════════════════════════════
const HYDROSTATIC_CONFIG = {
    // Ciclo de marea (45 minutos = 1 descenso + 1 ascenso completo)
    TIDE_CYCLE_MS: 45 * 60 * 1000,
    // Multiplicador de velocidad (1 = real, 60 = debug rápido)
    DEBUG_SPEED: 1,
    // Profundidades
    SURFACE_DEPTH: 0,
    MAX_DEPTH: 8000, // Fosa de las Marianas
    NEUTRAL_DEPTH: 4000, // Punto medio del ciclo
    // Inercia del submarino (0.98 = lento, 0.90 = rápido)
    DEPTH_INERTIA: 0.985,
    // Sensibilidad del lastre musical
    BUOYANCY_SENSITIVITY: 5,
    BUOYANCY_NEUTRAL_CENTROID: 800,
};
// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE TRIGGERS (CRIATURAS OCEÁNICAS)
// ═══════════════════════════════════════════════════════════════════════════
const TRIGGER_CONFIG = {
    solarCaustics: {
        cooldownMs: 8000,
        clarityThreshold: 0.75,
        maxDepth: 200,
    },
    schoolOfFish: {
        cooldownMs: 5000,
        transientThreshold: 0.55,
        minDepth: 200,
        maxDepth: 1000,
    },
    abyssalJellyfish: {
        cooldownMs: 10000,
        flatnessThreshold: 0.35,
        minDepth: 4000,
    },
};
const state = {
    currentDepth: 500,
    currentZone: 'OPEN_OCEAN',
    lastLoggedDepth: 500,
    lastTriggerTime: {
        solarCaustics: 0,
        schoolOfFish: 0,
        abyssalJellyfish: 0,
    },
    startTime: Date.now(),
};
// ═══════════════════════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════════════════════
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
    if (depth < ZONES.OPEN_OCEAN.max)
        return 'OPEN_OCEAN';
    if (depth < ZONES.TWILIGHT.max)
        return 'TWILIGHT';
    return 'MIDNIGHT';
}
// ═══════════════════════════════════════════════════════════════════════════
// 🌊 MOTOR HIDROSTÁTICO - Cálculo de Profundidad
// ═══════════════════════════════════════════════════════════════════════════
function calculateHydrostaticDepth(now, godEar) {
    const config = HYDROSTATIC_CONFIG;
    // Tiempo efectivo (con multiplicador de debug)
    const effectiveTime = (now - state.startTime) * config.DEBUG_SPEED;
    // Fase de marea: 0 → 1 → 0 en un ciclo completo
    // Usamos coseno para empezar en superficie (profundidad mínima)
    const tidePhase = (effectiveTime % config.TIDE_CYCLE_MS) / config.TIDE_CYCLE_MS;
    const tideWave = (1 - Math.cos(tidePhase * Math.PI * 2)) / 2; // 0→1→0 suave
    // Profundidad base por marea
    const tideDepth = config.SURFACE_DEPTH + tideWave * config.MAX_DEPTH;
    // Lastre musical: centroid alto = flotabilidad (sube), bajo = gravedad (baja)
    const centroid = godEar.centroid || config.BUOYANCY_NEUTRAL_CENTROID;
    const buoyancy = (centroid - config.BUOYANCY_NEUTRAL_CENTROID) * -config.BUOYANCY_SENSITIVITY;
    // Profundidad objetivo
    const targetDepth = clamp(tideDepth + buoyancy, config.SURFACE_DEPTH, config.MAX_DEPTH);
    // Aplicar inercia (submarino no cambia de profundidad instantáneamente)
    state.currentDepth = lerp(state.currentDepth, targetDepth, 1 - config.DEPTH_INERTIA);
    return state.currentDepth;
}
function calculateColorGrading(depth, energy, now) {
    const zone = getZoneFromDepth(depth);
    // Mapeo base de hue: superficie=verde (150°) → abismo=magenta (300°)
    const depthRatio = Math.min(depth / HYDROSTATIC_CONFIG.MAX_DEPTH, 1);
    const baseHue = 150 + depthRatio * 150;
    // Drift suave del hue (respiración cromática)
    const hueDrift = Math.sin(now / 20000) * 8;
    const hue = baseHue + hueDrift;
    // Color grading por zona
    let saturation;
    let lightness;
    switch (zone) {
        case 'SHALLOWS':
            // 🌿 SUNLIGHT: Verde brillante, destellos solares
            saturation = 90 + energy * 10;
            lightness = 65 + Math.sin(now / 1500) * 12 + energy * 8;
            break;
        case 'OPEN_OCEAN':
            // 🐬 CLEAR WATER: Azul tropical, claridad
            saturation = 85 + energy * 10;
            lightness = 55 + energy * 10;
            break;
        case 'TWILIGHT':
            // 🐋 DEEP PRESSURE: Índigo puro, presión visual
            saturation = 100;
            lightness = 35 + energy * 15; // Oscuro pero reactivo
            break;
        case 'MIDNIGHT':
            // 🪼 BIOLUMINESCENCE: Solo brilla con energía
            saturation = 100;
            lightness = 15 + energy * 35; // Muy oscuro base, brilla con música
            break;
    }
    return { hue, saturation, lightness };
}
function calculateFluidPhysics(now, energy, depth, godEar) {
    const zone = getZoneFromDepth(depth);
    // Presión visual: más profundo = movimientos más lentos y pesados
    const pressureFactor = 1 - (depth / HYDROSTATIC_CONFIG.MAX_DEPTH) * 0.5;
    // Osciladores con números primos (evita patrones repetitivos)
    const oscL = Math.sin(now / 3659) + Math.sin(now / 2069) * 0.25;
    const oscR = Math.cos(now / 3023) + Math.sin(now / 2707) * 0.25;
    // Respiración profunda: amplitud depende de energía y presión
    const breathDepth = (0.35 + energy * 0.3) * pressureFactor;
    // Pars: iluminación base con respiración
    const frontL = clamp(0.5 + oscL * breathDepth, 0, 1);
    const frontR = clamp(0.5 + oscR * breathDepth, 0, 1);
    const backL = clamp(0.4 + Math.sin(now / 4007 - 1.8) * 0.35 * pressureFactor, 0, 1);
    const backR = clamp(0.4 + Math.cos(now / 3511 - 2.2) * 0.35 * pressureFactor, 0, 1);
    // Movers: Pan y Tilt con movimiento orgánico
    // Pan: barrido lento de lado a lado
    const moverPanL = 0.5 + Math.sin(now / 5003) * 0.4 * pressureFactor;
    const moverPanR = 0.5 + Math.sin(now / 4003 + Math.PI) * 0.4 * pressureFactor;
    // Tilt: apunta más hacia abajo en profundidades (buscando el fondo)
    const baseTilt = zone === 'MIDNIGHT' ? 0.7 : zone === 'TWILIGHT' ? 0.6 : 0.5;
    const moverTiltL = baseTilt + Math.cos(now / 2503) * 0.2;
    const moverTiltR = baseTilt + Math.cos(now / 1753 + 0.5) * 0.2;
    // Intensidad de movers: más brillante en superficie, más tenue en profundidad
    const baseIntensity = zone === 'SHALLOWS' ? 0.5 :
        zone === 'OPEN_OCEAN' ? 0.4 :
            zone === 'TWILIGHT' ? 0.25 : 0.15;
    // Pulso de vida (plancton/bioluminiscencia)
    const clarity = godEar.clarity || 0;
    const lifeActivity = (clarity > 0.7 || energy > 0.65) ? 0.3 : 0;
    const lifePulse = Math.sin(now / 800) > 0.7 ? lifeActivity : 0;
    const moverIntL = clamp(baseIntensity + Math.sin(now / 2500) * 0.15 + lifePulse + energy * 0.2, 0, 1);
    const moverIntR = clamp(baseIntensity + Math.sin(now / 3100 + 2) * 0.15 + lifePulse + energy * 0.2, 0, 1);
    // Air intensity: burbujas más frecuentes cerca de superficie
    const airBase = zone === 'SHALLOWS' ? 0.4 : zone === 'OPEN_OCEAN' ? 0.25 : 0.1;
    const airIntensity = clamp(airBase + energy * 0.2 + lifePulse * 0.5, 0, 0.7);
    return {
        frontL, frontR, backL, backR,
        moverL: { intensity: moverIntL, pan: moverPanL, tilt: moverTiltL },
        moverR: { intensity: moverIntR, pan: moverPanR, tilt: moverTiltR },
        airIntensity,
    };
}
// ═══════════════════════════════════════════════════════════════════════════
// 🦑 TEXTURE MONITOR - Detección de Criaturas Oceánicas
// ═══════════════════════════════════════════════════════════════════════════
function checkOceanicTriggers(godEar, depth, now) {
    const clarity = godEar.clarity || 0;
    const transientDensity = godEar.transientDensity || 0;
    const spectralFlatness = godEar.spectralFlatness ?? 0.5;
    const triggers = {
        solarCaustics: false,
        schoolOfFish: false,
        abyssalJellyfish: false,
    };
    // 🌞 SOLAR CAUSTICS: Rayos de sol en aguas superficiales
    const causticsConfig = TRIGGER_CONFIG.solarCaustics;
    if (depth < causticsConfig.maxDepth &&
        clarity > causticsConfig.clarityThreshold &&
        now - state.lastTriggerTime.solarCaustics > causticsConfig.cooldownMs) {
        triggers.solarCaustics = true;
        state.lastTriggerTime.solarCaustics = now;
    }
    // 🐟 SCHOOL OF FISH: Banco de peces en aguas abiertas
    const fishConfig = TRIGGER_CONFIG.schoolOfFish;
    if (depth >= fishConfig.minDepth &&
        depth < fishConfig.maxDepth &&
        transientDensity > fishConfig.transientThreshold &&
        now - state.lastTriggerTime.schoolOfFish > fishConfig.cooldownMs) {
        triggers.schoolOfFish = true;
        state.lastTriggerTime.schoolOfFish = now;
    }
    // 🪼 ABYSSAL JELLYFISH: Medusas bioluminiscentes en el abismo
    const jellyConfig = TRIGGER_CONFIG.abyssalJellyfish;
    if (depth >= jellyConfig.minDepth &&
        spectralFlatness < jellyConfig.flatnessThreshold &&
        now - state.lastTriggerTime.abyssalJellyfish > jellyConfig.cooldownMs) {
        triggers.abyssalJellyfish = true;
        state.lastTriggerTime.abyssalJellyfish = now;
    }
    return triggers;
}
// ═══════════════════════════════════════════════════════════════════════════
// 🎯 FUNCIÓN PRINCIPAL - El Orquestador del Océano
// ═══════════════════════════════════════════════════════════════════════════
export const calculateChillStereo = (time, energy, air, isKick, godEar = {}) => {
    const now = Date.now();
    // 1. MOTOR HIDROSTÁTICO: Calcular profundidad
    const depth = calculateHydrostaticDepth(now, godEar);
    const zone = getZoneFromDepth(depth);
    state.currentZone = zone;
    // 2. COLOR GRADING: Los 4 Mundos
    const color = calculateColorGrading(depth, energy, now);
    // 3. FÍSICA DE FLUIDOS: Movimiento orgánico
    const physics = calculateFluidPhysics(now, energy, depth, godEar);
    // 4. TEXTURE MONITOR: Detectar criaturas
    const oceanicTriggers = checkOceanicTriggers(godEar, depth, now);
    // 5. TELEMETRÍA
    const depthChanged = Math.abs(depth - state.lastLoggedDepth) > 500;
    if (depthChanged) {
        state.lastLoggedDepth = depth;
    }
    // 🔍 TELEMETRÍA SUBMARINA (Cada ~2 segundos)
    if (Math.floor(now / 1000) % 2 === 0 && Math.sin(now / 100) > 0.95) {
        const centroid = godEar.centroid || 0;
        console.log(`[⚓ SUBMARINE] Z:${ZONES[zone].label} | 📏 ${depth.toFixed(0)}m | ` +
            `🌡️ C:${centroid.toFixed(0)} | 🎨 H:${color.hue.toFixed(0)}° L:${color.lightness.toFixed(0)}% | ` +
            `⚡ E:${(energy * 100).toFixed(0)}%`);
    }
    // Log de triggers cuando se activan
    if (oceanicTriggers.solarCaustics) {
        console.log(`[🌞 TRIGGER] Solar Caustics! Depth:${depth.toFixed(0)}m Clarity:${(godEar.clarity || 0).toFixed(2)}`);
    }
    if (oceanicTriggers.schoolOfFish) {
        console.log(`[🐟 TRIGGER] School of Fish! Depth:${depth.toFixed(0)}m Transients:${(godEar.transientDensity || 0).toFixed(2)}`);
    }
    if (oceanicTriggers.abyssalJellyfish) {
        console.log(`[🪼 TRIGGER] Abyssal Jellyfish! Depth:${depth.toFixed(0)}m Flatness:${(godEar.spectralFlatness ?? 0.5).toFixed(2)}`);
    }
    const debugMsg = `${ZONES[zone].label} ${depth.toFixed(0)}m | H:${color.hue.toFixed(0)}° L:${color.lightness.toFixed(0)}%`;
    return {
        frontL: physics.frontL,
        frontR: physics.frontR,
        backL: physics.backL,
        backR: physics.backR,
        moverL: physics.moverL,
        moverR: physics.moverR,
        colorOverride: {
            h: color.hue / 360,
            s: color.saturation / 100,
            l: color.lightness / 100,
        },
        airIntensity: physics.airIntensity,
        currentDepth: depth,
        currentZone: zone,
        oceanicTriggers,
        debug: depthChanged ? `[DEPTH CHANGE] ${debugMsg}` : debugMsg,
    };
};
// ═══════════════════════════════════════════════════════════════════════════
// API DE ESTADO (para debugging/UI)
// ═══════════════════════════════════════════════════════════════════════════
export const resetDeepFieldState = () => {
    state.currentDepth = 500;
    state.currentZone = 'OPEN_OCEAN';
    state.lastLoggedDepth = 500;
    state.lastTriggerTime = { solarCaustics: 0, schoolOfFish: 0, abyssalJellyfish: 0 };
    state.startTime = Date.now();
    console.log('[🌊 OCEAN] State reset - returning to surface');
};
export const getDeepFieldState = () => ({
    depth: state.currentDepth,
    zone: state.currentZone,
    triggers: state.lastTriggerTime,
    uptime: Date.now() - state.startTime,
});
// Exportar configuración para UI/debug
export const OCEAN_CONFIG = {
    ZONES,
    HYDROSTATIC: HYDROSTATIC_CONFIG,
    TRIGGERS: TRIGGER_CONFIG,
};

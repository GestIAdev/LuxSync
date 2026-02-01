/**
 * ---------------------------------------------------------------------------
 * ? CHILL STEREO PHYSICS: THE LIVING OCEAN (WAVE 1070)
 * ---------------------------------------------------------------------------
 *
 * WAVE 1064: THE FOUR WORLDS - Color Grading por Profundidad
 * WAVE 1070: THE LIVING OCEAN - Ecosistema Hidrost�tico Generativo
 *
 * ZONAS OCE�NICAS:
 * ?? SHALLOWS (0-200m):     "Sunlight" - Verde Esmeralda brillante
 * ?? OCEAN (200-1000m): "Clear Water" - Azul Tropical
 * ?? TWILIGHT (1000-4000m):  "Deep Pressure" - �ndigo Puro
 * ?? MIDNIGHT (4000+m):      "Bioluminescence" - Ne�n oscuro
 *
 * MOTOR HIDROST�TICO:
 * - Ciclo de marea: 45 minutos (configurable con DEBUG_SPEED)
 * - Profundidad m�xima: 8000m (Fosa de las Marianas)
 * - Lastre musical: centroid controla flotabilidad
 * - Presi�n visual: lightness decrece con profundidad
 *
 * CRIATURAS OCEÁNICAS (Triggers para EffectManager):
 * - SolarCaustics: clarity alta en SHALLOWS (0-1000m)
 * - SchoolOfFish: transientDensity alta en OCEAN (1000-3000m)
 * - WhaleSong: bass profundo sostenido en TWILIGHT (3000-6000m)
 * - AbyssalJellyfish: spectralFlatness bajo en MIDNIGHT (6000+m)
 */
// ---------------------------------------------------------------------------
// CONFIGURACI�N DE ZONAS (WAVE 1070.4: NUEVA CARTOGRAF�A)
// ---------------------------------------------------------------------------
const ZONES = {
    SHALLOWS: { min: 0, max: 1000, label: '🌿' }, // Superficie extendida
    OCEAN: { min: 1000, max: 3000, label: '🐬' }, // Aguas azules
    TWILIGHT: { min: 3000, max: 6000, label: '🐋' }, // Zona crepuscular
    MIDNIGHT: { min: 6000, max: 10000, label: '🪼' } // Abismo profundo
};
// ---------------------------------------------------------------------------
// CONFIGURACI�N DEL MOTOR HIDROST�TICO
// ---------------------------------------------------------------------------
const HYDROSTATIC_CONFIG = {
    // Ciclo de marea (12 minutos = org�nico y contemplativo)
    // Un ciclo completo = descender al abismo + ascender a superficie
    TIDE_CYCLE_MS: 12 * 60 * 1000, // 12 minutos por ciclo completo
    // Multiplicador de velocidad (1 = real, 10 = demo r�pida)
    DEBUG_SPEED: 1,
    // Profundidades (WAVE 1070.4: Extendidas para nueva cartograf�a)
    SURFACE_DEPTH: 0,
    MAX_DEPTH: 10000, // M�s profundo que Marianas
    NEUTRAL_DEPTH: 5000, // Punto medio del ciclo
    // Inercia del submarino (0.992 = MUY SUAVE, cambios graduales)
    // El oc�ano no tiene prisa. Los cambios de profundidad son org�nicos.
    DEPTH_INERTIA: 0.992,
    // ?? LASTRE MUSICAL ELIMINADO
    // El centroid estaba causando cambios err�ticos de profundidad
    // La marea es el �NICO motor - la m�sica NO afecta la profundidad
    BUOYANCY_SENSITIVITY: 0, // CERO - la marea manda
    BUOYANCY_NEUTRAL_CENTROID: 1200, // (no usado con sensitivity=0)
};
// ---------------------------------------------------------------------------
// CONFIGURACI�N DE TRIGGERS (CRIATURAS OCE�NICAS)
// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE TRIGGERS (WAVE 1070.4: COOLDOWNS ANTI-SPAM)
// ═══════════════════════════════════════════════════════════════════════════
const TRIGGER_CONFIG = {
    solarCaustics: {
        cooldownMs: 8000, // 8 segundos cooldown
        clarityThreshold: 0.75,
        maxDepth: 1000, // Solo en SHALLOWS (0-1000m)
    },
    schoolOfFish: {
        cooldownMs: 5000, // 5 segundos cooldown
        transientThreshold: 0.55,
        minDepth: 1000,
        maxDepth: 3000, // Solo en OCEAN (1000-3000m)
    },
    whaleSong: {
        cooldownMs: 15000, // 🐋 15 segundos - efecto de 8s + silencio
        bassThreshold: 0.60, // Graves sostenidos
        minDepth: 3000,
        maxDepth: 6000, // Solo en TWILIGHT (3000-6000m)
    },
    abyssalJellyfish: {
        cooldownMs: 25000, // 🪼 25 SEGUNDOS - da tiempo al efecto de 8s + silencio visual
        flatnessThreshold: 0.35,
        minDepth: 6000, // Solo en MIDNIGHT (6000+m)
    },
};
const state = {
    currentDepth: 500,
    currentZone: 'OCEAN',
    lastLoggedDepth: 500,
    lastTriggerTime: {
        solarCaustics: 0,
        schoolOfFish: 0,
        whaleSong: 0,
        abyssalJellyfish: 0,
    },
    startTime: Date.now(),
};
// ---------------------------------------------------------------------------
// UTILIDADES
// ---------------------------------------------------------------------------
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
// ═══════════════════════════════════════════════════════════════════════════
// 🌊 MOTOR HIDROSTÁTICO - Cálculo de Profundidad
// ═══════════════════════════════════════════════════════════════════════════
function calculateHydrostaticDepth(now, godEar) {
    const config = HYDROSTATIC_CONFIG;
    // Tiempo efectivo (con multiplicador de debug)
    const effectiveTime = (now - state.startTime) * config.DEBUG_SPEED;
    // Fase de marea: 0 ? 1 ? 0 en un ciclo completo
    // Usamos coseno para empezar en superficie (profundidad m�nima)
    const tidePhase = (effectiveTime % config.TIDE_CYCLE_MS) / config.TIDE_CYCLE_MS;
    const tideWave = (1 - Math.cos(tidePhase * Math.PI * 2)) / 2; // 0?1?0 suave
    // Profundidad base por marea
    const tideDepth = config.SURFACE_DEPTH + tideWave * config.MAX_DEPTH;
    // Lastre musical: centroid alto = flotabilidad (sube), bajo = gravedad (baja)
    const centroid = godEar.centroid || config.BUOYANCY_NEUTRAL_CENTROID;
    const buoyancy = (centroid - config.BUOYANCY_NEUTRAL_CENTROID) * -config.BUOYANCY_SENSITIVITY;
    // Profundidad objetivo
    const targetDepth = clamp(tideDepth + buoyancy, config.SURFACE_DEPTH, config.MAX_DEPTH);
    // Aplicar inercia (submarino no cambia de profundidad instant�neamente)
    state.currentDepth = lerp(state.currentDepth, targetDepth, 1 - config.DEPTH_INERTIA);
    return state.currentDepth;
}
function calculateColorGrading(depth, energy, now) {
    const zone = getZoneFromDepth(depth);
    // ═══════════════════════════════════════════════════════════════════════
    // 🌊 WAVE 1070.4: LUT ESTRICTA - PROHIBIDO BLANCO EN ABISMO
    // ═══════════════════════════════════════════════════════════════════════
    // Cada zona tiene límites DUROS de Hue/Sat/Light que NO SE VIOLAN
    // No más interpolación lineal ciega que produce blancos o colores rotos
    let baseHue;
    let saturation;
    let lightness;
    // Drift suave del hue (respiración cromática ±5°) - REDUCIDO para evitar fugas
    const hueDrift = Math.sin(now / 20000) * 5;
    switch (zone) {
        case 'SHALLOWS':
            // 🌿 SUNLIGHT (0-1000m): Turquesa brillante, superficie visible
            // Reglas: H=160-190° (Menta→Cian), S=85-100%, L=60-80%
            baseHue = 175 + hueDrift; // Turquesa (NUNCA verde ni dorado)
            saturation = 85 + energy * 15; // MÍNIMO 85%, nunca grises
            lightness = 65 + Math.sin(now / 1500) * 8 + energy * 10;
            // Clamp lightness a rango SHALLOWS
            lightness = clamp(lightness, 60, 80);
            break;
        case 'OCEAN':
            // 🐬 BLUE DEEP (1000-3000m): Azul Real, corrientes
            // Reglas: H=200-220° (Azul Océano), S=70-90%, L=45-65%
            baseHue = 210 + hueDrift; // Azul océano clásico
            saturation = 75 + energy * 15;
            saturation = clamp(saturation, 70, 90);
            lightness = 55 + energy * 8;
            lightness = clamp(lightness, 45, 65);
            break;
        case 'TWILIGHT':
            // 🐋 PRESSURE ZONE (3000-6000m): Índigo oscuro
            // Reglas: H=235-255° (Índigo), S=80-95%, L=25-40%
            baseHue = 245 + hueDrift; // Índigo puro
            saturation = 85 + energy * 10;
            saturation = clamp(saturation, 80, 95);
            lightness = 32 + energy * 8;
            lightness = clamp(lightness, 25, 40);
            break;
        case 'MIDNIGHT':
            // 🪼 ABYSS (6000-10000m): Neón violeta, bioluminiscencia alienígena
            // Reglas ESTRICTAS: H=270-300° (Violeta→Magenta), S=100%, L=MAX 30%
            // PROHIBIDO: H<260° (riesgo de cyan), S<100% (riesgo de blanco), L>30% (demasiado brillante)
            baseHue = 285 + hueDrift * 1.5; // Violeta con más drift
            baseHue = clamp(baseHue, 270, 300); // 🚫 LÍMITE DURO - NUNCA menos de 270°
            saturation = 100; // 🚫 FORZAR 100% - NO NEGOCIABLE
            // Lightness: MÁXIMO 30%, pero reactivo a energía
            lightness = 15 + energy * 15; // Base MUY oscuro, sube con música
            lightness = clamp(lightness, 10, 30); // 🚫 NUNCA más de 30%
            break;
    }
    // Clamp final de seguridad (por si acaso)
    baseHue = clamp(baseHue, 0, 360);
    saturation = clamp(saturation, 0, 100);
    lightness = clamp(lightness, 0, 100);
    return { hue: baseHue, saturation, lightness };
}
function calculateFluidPhysics(now, energy, depth, godEar) {
    const zone = getZoneFromDepth(depth);
    // Presi�n visual: m�s profundo = movimientos m�s lentos y pesados
    const pressureFactor = 1 - (depth / HYDROSTATIC_CONFIG.MAX_DEPTH) * 0.5;
    // Osciladores con n�meros primos (evita patrones repetitivos)
    const oscL = Math.sin(now / 3659) + Math.sin(now / 2069) * 0.25;
    const oscR = Math.cos(now / 3023) + Math.sin(now / 2707) * 0.25;
    // Respiraci�n profunda: amplitud depende de energ�a y presi�n
    const breathDepth = (0.35 + energy * 0.3) * pressureFactor;
    // Pars: iluminaci�n base con respiraci�n
    const frontL = clamp(0.5 + oscL * breathDepth, 0, 1);
    const frontR = clamp(0.5 + oscR * breathDepth, 0, 1);
    const backL = clamp(0.4 + Math.sin(now / 4007 - 1.8) * 0.35 * pressureFactor, 0, 1);
    const backR = clamp(0.4 + Math.cos(now / 3511 - 2.2) * 0.35 * pressureFactor, 0, 1);
    // Movers: Pan y Tilt con movimiento org�nico
    // Pan: barrido lento de lado a lado
    const moverPanL = 0.5 + Math.sin(now / 5003) * 0.4 * pressureFactor;
    const moverPanR = 0.5 + Math.sin(now / 4003 + Math.PI) * 0.4 * pressureFactor;
    // Tilt: apunta m�s hacia abajo en profundidades (buscando el fondo)
    const baseTilt = zone === 'MIDNIGHT' ? 0.7 : zone === 'TWILIGHT' ? 0.6 : 0.5;
    const moverTiltL = baseTilt + Math.cos(now / 2503) * 0.2;
    const moverTiltR = baseTilt + Math.cos(now / 1753 + 0.5) * 0.2;
    // Intensidad de movers: m�s brillante en superficie, m�s tenue en profundidad
    const baseIntensity = zone === 'SHALLOWS' ? 0.5 :
        zone === 'OCEAN' ? 0.4 :
            zone === 'TWILIGHT' ? 0.25 : 0.15;
    // Pulso de vida (plancton/bioluminiscencia)
    const clarity = godEar.clarity || 0;
    const lifeActivity = (clarity > 0.7 || energy > 0.65) ? 0.3 : 0;
    const lifePulse = Math.sin(now / 800) > 0.7 ? lifeActivity : 0;
    const moverIntL = clamp(baseIntensity + Math.sin(now / 2500) * 0.15 + lifePulse + energy * 0.2, 0, 1);
    const moverIntR = clamp(baseIntensity + Math.sin(now / 3100 + 2) * 0.15 + lifePulse + energy * 0.2, 0, 1);
    // Air intensity: burbujas m�s frecuentes cerca de superficie
    const airBase = zone === 'SHALLOWS' ? 0.4 : zone === 'OCEAN' ? 0.25 : 0.1;
    const airIntensity = clamp(airBase + energy * 0.2 + lifePulse * 0.5, 0, 0.7);
    return {
        frontL, frontR, backL, backR,
        moverL: { intensity: moverIntL, pan: moverPanL, tilt: moverTiltL },
        moverR: { intensity: moverIntR, pan: moverPanR, tilt: moverTiltR },
        airIntensity,
    };
}
// ---------------------------------------------------------------------------
// ?? TEXTURE MONITOR - Detecci�n de Criaturas Oce�nicas
// ---------------------------------------------------------------------------
function checkOceanicTriggers(godEar, depth, now) {
    const clarity = godEar.clarity || 0;
    const transientDensity = godEar.transientDensity || 0;
    const spectralFlatness = godEar.spectralFlatness ?? 0.5;
    const bassEnergy = godEar.bassEnergy || godEar.bass || 0; // Energía de graves
    const triggers = {
        solarCaustics: false,
        schoolOfFish: false,
        whaleSong: false,
        abyssalJellyfish: false,
    };
    // ☀️ SOLAR CAUSTICS: Rayos de sol en aguas superficiales
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
    // 🐋 WHALE SONG: Canto de ballena en zona crepuscular
    const whaleConfig = TRIGGER_CONFIG.whaleSong;
    if (depth >= whaleConfig.minDepth &&
        depth < whaleConfig.maxDepth &&
        bassEnergy > whaleConfig.bassThreshold &&
        now - state.lastTriggerTime.whaleSong > whaleConfig.cooldownMs) {
        triggers.whaleSong = true;
        state.lastTriggerTime.whaleSong = now;
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
// ---------------------------------------------------------------------------
// ?? FUNCI�N PRINCIPAL - El Orquestador del Oc�ano
// ---------------------------------------------------------------------------
export const calculateChillStereo = (time, energy, air, isKick, godEar = {}) => {
    const now = Date.now();
    // 1. MOTOR HIDROST�TICO: Calcular profundidad
    const depth = calculateHydrostaticDepth(now, godEar);
    const zone = getZoneFromDepth(depth);
    state.currentZone = zone;
    // 2. COLOR GRADING: Los 4 Mundos
    const color = calculateColorGrading(depth, energy, now);
    // 3. F�SICA DE FLUIDOS: Movimiento org�nico
    const physics = calculateFluidPhysics(now, energy, depth, godEar);
    // 4. TEXTURE MONITOR: Detectar criaturas
    const oceanicTriggers = checkOceanicTriggers(godEar, depth, now);
    // 5. TELEMETR�A
    const depthChanged = Math.abs(depth - state.lastLoggedDepth) > 500;
    if (depthChanged) {
        state.lastLoggedDepth = depth;
    }
    // 🌊 TELEMETRÍA SUBMARINA (Cada ~2 segundos)
    if (Math.floor(now / 1000) % 2 === 0 && Math.sin(now / 100) > 0.95) {
        const centroid = godEar.centroid || 0;
        console.log(`[🌊 SUBMARINE] Z:${ZONES[zone].label} | 📍 ${depth.toFixed(0)}m | ` +
            `📡 C:${centroid.toFixed(0)} | 🎨 H:${color.hue.toFixed(0)}° L:${color.lightness.toFixed(0)}% | ` +
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
// ---------------------------------------------------------------------------
// API DE ESTADO (para debugging/UI)
// ---------------------------------------------------------------------------
export const resetDeepFieldState = () => {
    state.currentDepth = 500;
    state.currentZone = 'OCEAN';
    state.lastLoggedDepth = 500;
    state.lastTriggerTime = { solarCaustics: 0, schoolOfFish: 0, whaleSong: 0, abyssalJellyfish: 0 };
    state.startTime = Date.now();
    console.log('[🌊 OCEAN] State reset - returning to surface');
};
export const getDeepFieldState = () => ({
    depth: state.currentDepth,
    zone: state.currentZone,
    triggers: state.lastTriggerTime,
    uptime: Date.now() - state.startTime,
});
/**
 * ?? WAVE 1070.3: DEPTH VALIDATION
 * Valida si un efecto oce�nico puede dispararse en la profundidad actual
 * Usado por EffectManager para bloquear efectos fuera de su zona
 */
export const isOceanicEffectValidForDepth = (effectType) => {
    const depth = state.currentDepth;
    const zone = state.currentZone;
    switch (effectType) {
        case 'solar_caustics':
            // ?? Solo en superficie (SHALLOWS: 0-200m)
            if (depth > TRIGGER_CONFIG.solarCaustics.maxDepth) {
                return {
                    valid: false,
                    reason: `?? DEPTH BLOCK: solar_caustics requiere depth<200m, actual=${Math.round(depth)}m (${zone})`
                };
            }
            return { valid: true, reason: '' };
        case 'school_of_fish':
            // ?? En aguas abiertas (OCEAN: 200-1000m)
            if (depth < TRIGGER_CONFIG.schoolOfFish.minDepth || depth > TRIGGER_CONFIG.schoolOfFish.maxDepth) {
                return {
                    valid: false,
                    reason: `?? DEPTH BLOCK: school_of_fish requiere 200-1000m, actual=${Math.round(depth)}m (${zone})`
                };
            }
            return { valid: true, reason: '' };
        case 'abyssal_jellyfish':
            // ?? Solo en abismo (MIDNIGHT: >4000m)
            if (depth < TRIGGER_CONFIG.abyssalJellyfish.minDepth) {
                return {
                    valid: false,
                    reason: `?? DEPTH BLOCK: abyssal_jellyfish requiere depth>4000m, actual=${Math.round(depth)}m (${zone})`
                };
            }
            return { valid: true, reason: '' };
        default:
            // Efectos no oce�nicos siempre v�lidos (aunque ser�n bloqueados por Shield)
            return { valid: true, reason: '' };
    }
};
// Exportar configuraci�n para UI/debug
export const OCEAN_CONFIG = {
    ZONES,
    HYDROSTATIC: HYDROSTATIC_CONFIG,
    TRIGGERS: TRIGGER_CONFIG,
};

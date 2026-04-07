/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎨 WAVE 1000: FIXTURE PROFILES - EL DICCIONARIO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Define las CAPACIDADES FÍSICAS de cada tipo de fixture.
 * Esto NO son los canales DMX (eso lo hace FXTParser), sino las
 * capacidades reales del hardware: tipo de mezcla de color, velocidades
 * seguras, rueda de colores física, etc.
 *
 * FILOSOFÍA:
 * - LED RGB → "Habla todos los idiomas" (cualquier color, instantáneo)
 * - Beam 2R → "Solo habla su dialecto" (colores fijos, lento)
 * - El HAL es el intérprete universal
 *
 * @module hal/translation/FixtureProfiles
 * @version WAVE 1000
 */
// ═══════════════════════════════════════════════════════════════════════════
// PERFILES PREDEFINIDOS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * 🔦 BEAM 2R / LB230N - El clásico beam de discoteca
 *
 * Rueda de colores física, 8 colores, lámpara de descarga.
 * REQUIERE PROTECCIÓN MECÁNICA - no puede cambiar color rápido.
 */
export const BEAM_2R_PROFILE = {
    id: 'beam-2r',
    name: 'Beam 2R / LB230N / Sharpy Clone',
    type: 'beam',
    colorEngine: {
        mixing: 'wheel',
        colorWheel: {
            colors: [
                // Rueda típica de un Beam 2R (puede variar según fabricante)
                { dmx: 0, name: 'Open (White)', rgb: { r: 255, g: 255, b: 255 } },
                { dmx: 15, name: 'Red', rgb: { r: 255, g: 0, b: 0 } },
                { dmx: 30, name: 'Orange', rgb: { r: 255, g: 128, b: 0 } },
                { dmx: 45, name: 'Yellow', rgb: { r: 255, g: 255, b: 0 } },
                { dmx: 60, name: 'Green', rgb: { r: 0, g: 255, b: 0 } },
                { dmx: 75, name: 'Cyan', rgb: { r: 0, g: 255, b: 255 } },
                { dmx: 90, name: 'Blue', rgb: { r: 0, g: 0, b: 255 } },
                { dmx: 105, name: 'Magenta', rgb: { r: 255, g: 0, b: 255 } },
                { dmx: 120, name: 'Light Blue', rgb: { r: 128, g: 128, b: 255 } },
                { dmx: 135, name: 'Pink', rgb: { r: 255, g: 128, b: 255 } },
                { dmx: 150, name: 'UV Purple', rgb: { r: 128, g: 0, b: 255 } },
                { dmx: 165, name: 'CTO (Warm White)', rgb: { r: 255, g: 200, b: 150 } },
                // 190-255: Giro continuo (rainbow spin)
            ],
            allowsContinuousSpin: true,
            spinStartDmx: 190,
            minChangeTimeMs: 500, // ¡CRÍTICO! No cambiar más rápido que esto
        },
    },
    shutter: {
        type: 'mechanical',
        maxStrobeHz: 12, // El shutter mecánico no aguanta más
    },
    movement: {
        type: 'stepper',
        maxPanSpeed: 180, // grados/segundo
        maxTiltSpeed: 120,
    },
    safety: {
        blackoutOnColorChange: false, // El beam 2R cambia limpio
        maxContinuousOnTime: 0, // Sin límite real
        isDischarge: true, // ¡LÁMPARA DE DESCARGA!
        cooldownTime: 300, // 5 minutos de enfriamiento mínimo
    },
};
/**
 * 🌈 LED PAR RGB Genérico
 *
 * El fixture más común. LED RGB directo, sin rueda.
 * Puede hacer cualquier color al instante.
 */
export const LED_PAR_RGB_PROFILE = {
    id: 'led-par-rgb',
    name: 'LED PAR RGB Generic',
    type: 'par',
    colorEngine: {
        mixing: 'rgb',
        // Sin rueda de colores
    },
    shutter: {
        type: 'digital',
        // Sin límite de strobe
    },
    // Sin movimiento (es un PAR fijo)
    safety: {
        blackoutOnColorChange: false,
        maxContinuousOnTime: 0, // LEDs aguantan todo el día
        isDischarge: false,
        cooldownTime: 0,
    },
};
/**
 * 🌟 LED Moving Head Wash
 *
 * Moving head con LEDs RGB/RGBW. Puede hacer cualquier color.
 * Movimiento más suave que los beams mecánicos.
 */
export const LED_WASH_PROFILE = {
    id: 'led-wash',
    name: 'LED Moving Head Wash',
    type: 'wash',
    colorEngine: {
        mixing: 'rgbw',
    },
    shutter: {
        type: 'digital',
    },
    movement: {
        type: 'stepper',
        maxPanSpeed: 200,
        maxTiltSpeed: 150,
    },
    safety: {
        blackoutOnColorChange: false,
        maxContinuousOnTime: 0,
        isDischarge: false,
        cooldownTime: 0,
    },
};
/**
 * 💥 Strobe LED
 *
 * Strobe puro. Solo blanco, pero a velocidades brutales.
 */
export const LED_STROBE_PROFILE = {
    id: 'led-strobe',
    name: 'LED Strobe',
    type: 'strobe',
    colorEngine: {
        mixing: 'rgb', // Algunos tienen RGB
    },
    shutter: {
        type: 'digital',
        // Sin límite - es su propósito
    },
    safety: {
        blackoutOnColorChange: false,
        maxContinuousOnTime: 30, // 30 segundos máximo a full (seguridad epilepsia)
        isDischarge: false,
        cooldownTime: 0,
    },
};
// ═══════════════════════════════════════════════════════════════════════════
// REGISTRY DE PERFILES
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Mapa de perfiles por ID
 */
const PROFILE_REGISTRY = new Map([
    [BEAM_2R_PROFILE.id, BEAM_2R_PROFILE],
    [LED_PAR_RGB_PROFILE.id, LED_PAR_RGB_PROFILE],
    [LED_WASH_PROFILE.id, LED_WASH_PROFILE],
    [LED_STROBE_PROFILE.id, LED_STROBE_PROFILE],
]);
/**
 * 🔍 Mapeo heurístico de nombres de fixture a perfiles
 * Usado cuando no hay profileId explícito
 */
const MODEL_TO_PROFILE = [
    // Beams
    [/beam.?2r/i, 'beam-2r'],
    [/lb230/i, 'beam-2r'],
    [/sharpy/i, 'beam-2r'],
    [/beam.?230/i, 'beam-2r'],
    [/5r.?beam/i, 'beam-2r'],
    [/7r.?beam/i, 'beam-2r'],
    // LED Washes
    [/wash.*led/i, 'led-wash'],
    [/led.*wash/i, 'led-wash'],
    [/moving.*head.*led/i, 'led-wash'],
    // LED PARs
    [/par.*led/i, 'led-par-rgb'],
    [/led.*par/i, 'led-par-rgb'],
    [/slim.*par/i, 'led-par-rgb'],
    [/flat.*par/i, 'led-par-rgb'],
    // Strobes
    [/strobe/i, 'led-strobe'],
    [/atomic/i, 'led-strobe'],
];
// ═══════════════════════════════════════════════════════════════════════════
// API PÚBLICA
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Obtiene un perfil por ID
 */
export function getProfile(profileId) {
    return PROFILE_REGISTRY.get(profileId);
}
/**
 * Obtiene un perfil basado en el nombre/modelo del fixture (heurístico)
 */
export function getProfileByModel(modelName) {
    for (const [pattern, profileId] of MODEL_TO_PROFILE) {
        if (pattern.test(modelName)) {
            return PROFILE_REGISTRY.get(profileId);
        }
    }
    return undefined;
}
/**
 * Detecta si un fixture necesita traducción de color (tiene rueda)
 * 🚑 WAVE 2058: Compatibilidad con Forja V1 y V2
 */
export function needsColorTranslation(profile) {
    if (!profile)
        return false;
    // 0. 🔧 WAVE 2192: Si el fixture declara rueda de color, necesita traducción
    //    independientemente de lo que diga colorEngine (puede ser 'rgb' por error)
    if (profile.capabilities?.hasColorWheel === true)
        return true;
    // 1. Formato Forja V2 (Nueva)
    const capEngine = profile.capabilities?.colorEngine;
    if (capEngine === 'wheel' || capEngine === 'hybrid' || capEngine === 'rgbw' || capEngine === 'cmy')
        return true;
    // 2. Formato Forja V1 (Vieja)
    const mixEngine = profile.colorEngine?.mixing;
    if (mixEngine === 'wheel' || mixEngine === 'hybrid' || mixEngine === 'rgbw' || mixEngine === 'cmy')
        return true;
    // 3. Fallback string directo
    if (profile.colorEngine === 'wheel' || profile.colorEngine === 'hybrid' || profile.colorEngine === 'rgbw' || profile.colorEngine === 'cmy')
        return true;
    return false;
}
/**
 * Detecta si un fixture es mecánico (necesita protección de velocidad)
 * 🚑 WAVE 2061: Safe against live profiles (fixture as profile)
 */
export function isMechanicalFixture(profile) {
    if (!profile)
        return false;
    // Si no tiene estructura de perfil, no es mecánico (live profile fallback)
    if (!profile.shutter || !profile.safety)
        return false;
    return profile.shutter.type === 'mechanical' || profile.safety.isDischarge;
}
/**
 * Registra un perfil personalizado
 */
export function registerProfile(profile) {
    PROFILE_REGISTRY.set(profile.id, profile);
    console.log(`[FixtureProfiles] 📚 Registered profile: ${profile.id}`);
}
/**
 * Lista todos los perfiles registrados
 */
export function listProfiles() {
    return Array.from(PROFILE_REGISTRY.keys());
}
/**
 * 🔧 WAVE 2093.3 (CW-AUDIT-6): Generate a HAL FixtureProfile from fixture inline data.
 *
 * Deterministic derivation — no heuristics, no randomness.
 * The generated profile is auto-registered in the registry.
 *
 * @returns The generated profile, or undefined if insufficient data
 */
export function generateProfileFromDefinition(data) {
    if (!data.id || !data.name)
        return undefined;
    // ── Don't regenerate if already registered ──
    const existing = PROFILE_REGISTRY.get(data.id);
    if (existing)
        return existing;
    // ── Need at least channels or capabilities to generate ──
    const channels = data.channels || [];
    const caps = data.capabilities || {};
    if (channels.length === 0 && !caps.colorEngine && !caps.hasColorWheel) {
        return undefined;
    }
    // ── Derive channel types set ──
    const channelTypes = new Set(channels.map(ch => ch.type));
    // ═══ COLOR ENGINE ═══
    const hasRGB = channelTypes.has('red') && channelTypes.has('green') && channelTypes.has('blue');
    const hasWhite = channelTypes.has('white');
    const hasCMY = channelTypes.has('cyan') && channelTypes.has('magenta') && channelTypes.has('yellow');
    const hasColorWheel = channelTypes.has('color_wheel') || caps.hasColorWheel === true;
    // Determine mixing type
    let mixing = 'rgb'; // safe default for LED
    if (caps.colorEngine === 'wheel' || (hasColorWheel && !hasRGB && !hasCMY)) {
        mixing = 'wheel';
    }
    else if (caps.colorEngine === 'hybrid' || (hasColorWheel && (hasRGB || hasCMY))) {
        mixing = 'hybrid';
    }
    else if (caps.colorEngine === 'cmy' || hasCMY) {
        mixing = 'cmy';
    }
    else if (caps.colorEngine === 'rgbw' || (hasRGB && hasWhite)) {
        mixing = 'rgbw';
    }
    else if (caps.colorEngine === 'rgb' || hasRGB) {
        mixing = 'rgb';
    }
    // ═══ COLOR WHEEL (from capabilities.colorWheel or wheels.colors) ═══
    let colorWheel = undefined;
    const wheelSource = caps.colorWheel || (data.wheels ? { colors: data.wheels.colors } : undefined);
    if (wheelSource && wheelSource.colors && wheelSource.colors.length > 0) {
        colorWheel = {
            colors: wheelSource.colors.map(c => ({
                dmx: c.dmx,
                name: c.name,
                rgb: { r: c.rgb.r, g: c.rgb.g, b: c.rgb.b },
                hasTexture: c.hasTexture,
            })),
            allowsContinuousSpin: wheelSource.allowsContinuousSpin ?? false,
            spinStartDmx: wheelSource.spinStartDmx,
            minChangeTimeMs: wheelSource.minChangeTimeMs ?? 200,
        };
    }
    // ═══ FIXTURE TYPE ═══
    const fixtureType = data.type || 'generic';
    let profileType = 'generic';
    if (fixtureType === 'moving-head' || fixtureType === 'scanner')
        profileType = 'beam';
    else if (fixtureType === 'spot')
        profileType = 'spot';
    else if (fixtureType === 'wash')
        profileType = 'wash';
    else if (fixtureType === 'par')
        profileType = 'par';
    else if (fixtureType === 'strobe' || fixtureType === 'blinder')
        profileType = 'strobe';
    else if (fixtureType === 'laser')
        profileType = 'laser';
    // ═══ SHUTTER ═══
    // Discharge fixtures and fixtures with mechanical shutters get mechanical type
    const motorType = data.physics?.motorType || '';
    const isDischarge = motorType.includes('discharge') ||
        (mixing === 'wheel' && !hasRGB && !hasCMY); // Pure wheel = likely discharge lamp
    const shutterType = isDischarge ? 'mechanical' : 'digital';
    const maxStrobeHz = shutterType === 'mechanical' ? 12 : undefined;
    // ═══ MOVEMENT ═══
    const hasPan = channelTypes.has('pan') || channelTypes.has('pan_fine') || caps.hasMovementChannels;
    const hasTilt = channelTypes.has('tilt') || channelTypes.has('tilt_fine');
    let movement = undefined;
    if (hasPan || hasTilt) {
        // Derive movement type from physics motorType
        let movementType = 'stepper';
        if (motorType.includes('servo'))
            movementType = 'servo';
        else if (motorType.includes('galvo'))
            movementType = 'galvo';
        // Derive speeds from physics maxVelocity or use conservative defaults
        const maxVelocity = data.physics?.maxVelocity || 0;
        const panSpeed = maxVelocity > 0 ? Math.round(maxVelocity * 0.45) : 180;
        const tiltSpeed = maxVelocity > 0 ? Math.round(maxVelocity * 0.35) : 120;
        movement = {
            type: movementType,
            maxPanSpeed: panSpeed,
            maxTiltSpeed: tiltSpeed,
        };
    }
    // ═══ SAFETY ═══
    const safety = {
        blackoutOnColorChange: mixing === 'wheel' && !hasRGB, // Pure wheel needs blackout
        maxContinuousOnTime: fixtureType === 'strobe' ? 30 : 0,
        isDischarge,
        cooldownTime: isDischarge ? 300 : 0,
    };
    // ═══ ASSEMBLE PROFILE ═══
    const profile = {
        id: data.id,
        name: `${data.name} (Auto-HAL)`,
        type: profileType,
        colorEngine: {
            mixing,
            colorWheel,
        },
        shutter: {
            type: shutterType,
            maxStrobeHz,
        },
        movement,
        safety,
    };
    // ═══ AUTO-REGISTER ═══
    registerProfile(profile);
    console.log(`[FixtureProfiles] 🔧 CW-AUDIT-6: Auto-generated HAL profile for "${data.name}" → mixing=${mixing}, shutter=${shutterType}, movement=${movement ? movement.type : 'none'}`);
    return profile;
}
// WAVE 2098: Boot silence

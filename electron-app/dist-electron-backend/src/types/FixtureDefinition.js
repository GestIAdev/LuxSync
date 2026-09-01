/**
 * 🧠 WAVE 1120: CAPABILITIES ENGINE
 * Derive features from channel definitions - ZERO user input required
 */
export function deriveCapabilities(channels) {
    const types = new Set(channels.map(ch => ch.type));
    // RGB detection
    const hasRGB = types.has('red') && types.has('green') && types.has('blue');
    const hasWhite = types.has('white');
    // CMY detection
    const hasCMY = types.has('cyan') && types.has('magenta') && types.has('yellow');
    // Determine color mixing type
    let colorMixingType = 'none';
    if (hasCMY)
        colorMixingType = 'cmy';
    else if (hasRGB && hasWhite)
        colorMixingType = 'rgbw';
    else if (hasRGB)
        colorMixingType = 'rgb';
    return {
        hasPanTilt: types.has('pan') || types.has('tilt'),
        hasColorMixing: hasRGB || hasCMY,
        colorMixingType,
        hasColorWheel: types.has('color_wheel'),
        hasGobos: types.has('gobo'),
        hasGoboRotation: types.has('gobo_rotation'),
        hasZoom: types.has('zoom'),
        hasFocus: types.has('focus'),
        hasPrism: types.has('prism'),
        hasPrismRotation: types.has('prism_rotation'),
        hasShutter: types.has('shutter') || types.has('strobe'),
        hasDimmer: types.has('dimmer'),
        hasFrost: types.has('frost'),
        is16bit: channels.some(ch => ch.is16bit || ch.type.includes('_fine')),
        channelCount: channels.length,
        // 🔥 WAVE 2084: INGENIOS capabilities detection
        hasRotation: types.has('rotation') || channels.some(ch => ch.continuousRotation === true),
        hasCustomChannels: types.has('custom'),
        hasMacro: types.has('macro'),
        hasSpeed: types.has('speed'),
        customChannelNames: channels
            .filter(ch => ch.type === 'custom' && ch.customName)
            .map(ch => ch.customName),
        // 🟢 WAVE 7737: LASER & ATMOSPHERE capabilities detection
        hasLaserGeometry: types.has('scale_x') || types.has('scale_y') || types.has('rot_x') || types.has('rot_y'),
        hasAtmosphere: types.has('smoke_pump') || types.has('smoke_density') || types.has('fan_speed'),
        hasPyro: types.has('fire_valve') || types.has('fire_ignite'),
        hasEmissionGate: types.has('emission_gate'),
    };
}
// ═══════════════════════════════════════════════════════════════════════════
// 🚨 WAVE 7737: HARD SAFETY GOVERNORS — reglas fail-closed de referencia.
//
// Estas NO se inyectan automáticamente en ningún perfil. Son un catálogo que
// el Forge (o un fixture JSON de librería) debe spreadear explícitamente en
// `dmxGovernors` al crear un perfil de láser/pirotecnia/humo, indexando cada
// entrada al `channelIndex` real del canal en ESE fixture concreto.
//
// Uso típico en un builder de perfil:
// ```ts
// dmxGovernors: [
//   { ...HARD_SAFETY_GOVERNORS.emissionGate, channelIndex: emissionChannelIdx },
//   { ...HARD_SAFETY_GOVERNORS.fireIgnite,    channelIndex: igniteChannelIdx },
//   { ...HARD_SAFETY_GOVERNORS.smokePumpCap,  channelIndex: pumpChannelIdx },
// ]
// ```
//
// Estas reglas son la ÚLTIMA MILLA: se evalúan en _writeNode() DESPUÉS de
// todos los transforms de calibración/personality (ver DMXGovernorEvaluator).
// Ninguna capa del Arbiter (ni siquiera L3++ Calibration) puede sortearlas.
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Cada entrada es un `IDMXGovernor` SIN `channelIndex` (se rellena en el
 * sitio de uso, ya que depende del layout físico del fixture concreto).
 */
export const HARD_SAFETY_GOVERNORS = Object.freeze({
    /**
     * emission_gate: forzado a 0 (cerrado) salvo que el valor normalizado
     * sea exactamente el máximo (armado explícito, sin zona gris analógica).
     */
    emissionGate: {
        description: 'WAVE 7737: Emission gate fail-closed — solo 100% arma la emisión.',
        rules: [
            { when: { intentType: 'emission', max: 1.0 }, then: { forceByte: 0 } },
        ],
    },
    /**
     * fire_ignite: solo un comando literal a escala completa (normalizado
     * >= 254/255) dispara la ignición. Cualquier valor intermedio —ruido,
     * fade accidental, redondeo— se fuerza a 0.
     */
    fireIgnite: {
        description: 'WAVE 7737: Fire ignite fail-closed — requiere full-scale exacto.',
        rules: [
            { when: { intentType: 'fire', max: 254 / 255 }, then: { forceByte: 0 } },
        ],
    },
    /**
     * smoke_pump: cap duro al 70% del rango físico, independientemente de
     * lo que pida la capa de arbitraje — protección de duty cycle continuo.
     */
    smokePumpCap: {
        description: 'WAVE 7737: Smoke pump — cap duro al 70% de duty cycle.',
        rules: [
            { when: { intentType: 'smoke' }, then: { mapToRange: [0, 178] } },
        ],
    },
});
// ═══════════════════════════════════════════════════════════════════════════
// WAVE 4548.3: UNIFIED CAPABILITIES — Canales + wheels + physics
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Unified capability derivation.
 *
 * DOGMA 4: capabilities se deduce estrictamente de channels, wheels y physics.
 * No acepta overrides manuales.
 *
 * @param channels — Canales físicos DMX
 * @param wheels   — Rueda de color y motor de mezcla
 * @param physics  — Física del motor (puede influir en detection futura)
 */
export function deriveCapabilitiesUnified(channels, wheels, physics) {
    const base = deriveCapabilities([...channels]);
    let colorMixingType = base.colorMixingType;
    let hasColorWheel = base.hasColorWheel;
    if (wheels) {
        if (wheels.colors.length > 0) {
            hasColorWheel = true;
        }
        if (wheels.colorEngine === 'wheel') {
            colorMixingType = 'none';
        }
        else if (wheels.colorEngine === 'rgb' || wheels.colorEngine === 'cmy' || wheels.colorEngine === 'rgbw') {
            if (colorMixingType === 'none') {
                colorMixingType = wheels.colorEngine;
            }
        }
    }
    // physics se reserva para future capabilities (ej. tilt range limits, etc.)
    void physics;
    return {
        ...base,
        hasColorWheel,
        colorMixingType,
    };
}

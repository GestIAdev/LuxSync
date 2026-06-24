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
    };
}
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

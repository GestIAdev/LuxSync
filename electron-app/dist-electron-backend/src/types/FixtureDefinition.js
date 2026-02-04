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
    };
}

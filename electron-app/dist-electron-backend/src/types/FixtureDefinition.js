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
/**
 * Unified capability derivation that checks nodeGraph first.
 *
 * If the fixture has a nodeGraph, capabilities are derived from the
 * output_dmx nodes' channelType. Otherwise falls back to the legacy
 * channels[] scan via deriveCapabilities().
 *
 * @param fixture — Any fixture (FixtureDefinition or FixtureDefinitionV2)
 */
export function deriveCapabilitiesUnified(fixture) {
    const graph = fixture.nodeGraph;
    if (graph && graph.nodes.length > 0) {
        // Extract output_dmx nodes and build synthetic FixtureChannel[] for the existing engine
        const outputNodes = graph.nodes.filter(n => n.type === 'output_dmx');
        const syntheticChannels = outputNodes.map((n) => {
            const cfg = n.config;
            return {
                index: cfg.dmxOffset,
                name: cfg.channelName || cfg.channelType,
                type: cfg.channelType,
                defaultValue: cfg.defaultDmxValue,
                is16bit: cfg.is16bit ?? false,
                continuousRotation: cfg.continuousRotation,
                customName: cfg.channelName,
            };
        });
        return deriveCapabilities(syntheticChannels);
    }
    // Fallback: legacy channels[] scan
    return deriveCapabilities(fixture.channels);
}

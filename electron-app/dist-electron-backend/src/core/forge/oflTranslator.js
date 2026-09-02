// ═══════════════════════════════════════════════════════════════════════════
// OFL TRANSLATOR — Open Fixture Library → LuxSync FixtureDefinition adapter
// Determinístico, puro, sin side-effects.
// ═══════════════════════════════════════════════════════════════════════════
import { deriveCapabilitiesUnified, } from '../../types/FixtureDefinition';
// ── Helpers ────────────────────────────────────────────────────────────────
const sanitize = (s) => String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
const parsePercent = (val) => {
    if (typeof val === 'number')
        return Math.max(0, Math.min(255, Math.round(val)));
    if (typeof val !== 'string')
        return 0;
    const trimmed = val.trim();
    if (trimmed.endsWith('%')) {
        const pct = parseFloat(trimmed.slice(0, -1));
        if (Number.isFinite(pct))
            return Math.max(0, Math.min(255, Math.round((pct / 100) * 255)));
    }
    const n = parseFloat(trimmed);
    return Number.isFinite(n) ? Math.max(0, Math.min(255, Math.round(n))) : 0;
};
const hexToRgb = (hex) => {
    const h = hex.replace('#', '').trim();
    if (h.length === 3) {
        return {
            r: parseInt(h[0] + h[0], 16) || 0,
            g: parseInt(h[1] + h[1], 16) || 0,
            b: parseInt(h[2] + h[2], 16) || 0,
        };
    }
    if (h.length === 6) {
        return {
            r: parseInt(h.slice(0, 2), 16) || 0,
            g: parseInt(h.slice(2, 4), 16) || 0,
            b: parseInt(h.slice(4, 6), 16) || 0,
        };
    }
    return { r: 0, g: 0, b: 0 };
};
const COLOR_INTENSITY_MAP = {
    Red: 'red',
    Green: 'green',
    Blue: 'blue',
    White: 'white',
    Amber: 'amber',
    UV: 'uv',
    Cyan: 'cyan',
    Magenta: 'magenta',
    Yellow: 'yellow',
};
// ── Type translation (OFL capability → ChannelType) ────────────────────────
function translateChannelType(chName, def) {
    const primary = def?.capability ?? def?.capabilities?.find((c) => c?.type !== 'NoFunction') ?? def?.capabilities?.[0];
    const oflType = primary?.type;
    const lower = chName.toLowerCase();
    switch (oflType) {
        case 'Intensity':
            return 'dimmer';
        case 'ShutterStrobe':
            return 'strobe';
        case 'Pan':
            return 'pan';
        case 'Tilt':
            return 'tilt';
        case 'ColorIntensity': {
            const color = primary?.color;
            if (color && COLOR_INTENSITY_MAP[color])
                return COLOR_INTENSITY_MAP[color];
            return 'custom';
        }
        case 'WheelSlot':
        case 'ColorPreset':
            if (lower.includes('color'))
                return 'color_wheel';
            if (lower.includes('gobo'))
                return 'gobo';
            return 'custom';
        case 'WheelRotation':
        case 'WheelSlotRotation':
            if (lower.includes('gobo'))
                return 'gobo_rotation';
            return 'rotation';
        case 'Prism':
            return 'prism';
        case 'PrismRotation':
            return 'prism_rotation';
        case 'Frost':
            return 'frost';
        case 'Focus':
            return 'focus';
        case 'Zoom':
            return 'zoom';
        case 'Iris':
            return 'iris';
        case 'PanContinuous':
        case 'TiltContinuous':
        case 'Rotation':
            return 'rotation';
        case 'Speed':
        case 'EffectSpeed':
        case 'StrobeSpeed':
            return 'speed';
        case 'Maintenance':
        case 'NoFunction':
            return 'control';
        default: {
            if (lower.includes('pan'))
                return 'pan';
            if (lower.includes('tilt'))
                return 'tilt';
            if (lower.includes('dimmer') || lower.includes('intensity'))
                return 'dimmer';
            if (lower.includes('strob'))
                return 'strobe';
            if (lower.includes('shutter'))
                return 'shutter';
            if (lower.includes('gobo'))
                return 'gobo';
            if (lower.includes('color'))
                return 'color_wheel';
            if (lower.includes('prism'))
                return 'prism';
            if (lower.includes('frost'))
                return 'frost';
            if (lower.includes('focus'))
                return 'focus';
            if (lower.includes('zoom'))
                return 'zoom';
            if (lower.includes('iris'))
                return 'iris';
            return 'custom';
        }
    }
}
// ── FixtureType detection ─────────────────────────────────────────────────
function detectFixtureType(oflJson, channels) {
    const categories = Array.isArray(oflJson?.categories) ? oflJson.categories : [];
    const catLower = categories.map(c => String(c).toLowerCase());
    const hasPanTilt = channels.some(c => c.type === 'pan') && channels.some(c => c.type === 'tilt');
    if (catLower.some(c => c.includes('moving head')))
        return 'moving-head';
    if (catLower.some(c => c.includes('scanner')))
        return 'scanner';
    if (catLower.some(c => c.includes('strobe')))
        return 'strobe';
    if (catLower.some(c => c.includes('blinder')))
        return 'blinder';
    if (catLower.some(c => c.includes('laser')))
        return 'laser';
    if (catLower.some(c => c.includes('smoke') || c.includes('fog') || c.includes('hazer')))
        return 'fog';
    if (catLower.some(c => c.includes('fan')))
        return 'fan';
    if (catLower.some(c => c.includes('barrel') || c.includes('mirror')))
        return 'mirror-ball';
    if (catLower.some(c => c.includes('effect')))
        return 'effect';
    if (catLower.some(c => c.includes('bar')))
        return 'bar';
    if (catLower.some(c => c.includes('par')))
        return 'par';
    if (catLower.some(c => c.includes('wash')))
        return 'wash';
    if (hasPanTilt)
        return 'moving-head';
    return 'generic';
}
// ── Wheel extraction ──────────────────────────────────────────────────────
function extractWheels(oflJson, channels) {
    const wheel = oflJson?.wheels?.['Color Wheel'];
    const slots = Array.isArray(wheel?.slots) ? wheel.slots : [];
    const hasColorWheelChannel = channels.some(c => c.type === 'color_wheel');
    const hasRgb = channels.some(c => c.type === 'red') &&
        channels.some(c => c.type === 'green') &&
        channels.some(c => c.type === 'blue');
    const hasW = channels.some(c => c.type === 'white');
    const hasCmy = channels.some(c => c.type === 'cyan') &&
        channels.some(c => c.type === 'magenta') &&
        channels.some(c => c.type === 'yellow');
    // WAVE 7749.40: Count ALL slots (including Open) for engine detection.
    // Previously only colorSlots were counted, causing wheel fixtures with
    // an Open slot + few colors to be misclassified as 'hybrid' or 'none'.
    const hasAnySlots = slots.length > 0;
    let colorEngine = 'none';
    if (hasRgb && hasW)
        colorEngine = 'rgbw';
    else if (hasRgb)
        colorEngine = 'rgb';
    else if (hasCmy)
        colorEngine = 'cmy';
    else if (hasColorWheelChannel && hasAnySlots)
        colorEngine = 'wheel';
    else if (hasRgb || hasCmy || hasColorWheelChannel)
        colorEngine = 'hybrid';
    if (slots.length === 0 && colorEngine === 'none')
        return null;
    // ── WAVE 7749.40: Real DMX mapping from availableChannels ───────────────
    // Build slotNumber → center DMX lookup from the OFL capabilities array.
    // The OFL spec stores per-slot DMX ranges in availableChannels[channelName]
    // .capabilities[], with entries like:
    //   { dmxRange: [8, 15], type: "WheelSlot", slotNumber: 2 }
    // We compute the center of each range as the slot's DMX value.
    // Only WheelSlot entries are mapped; WheelRotation entries are skipped.
    const wheelChannelDef = oflJson?.availableChannels?.['Color Wheel'];
    const wheelCapabilities = Array.isArray(wheelChannelDef?.capabilities)
        ? wheelChannelDef.capabilities
        : [];
    const slotDmxLookup = new Map(); // slotNumber (1-based) → center DMX
    for (const cap of wheelCapabilities) {
        if (cap?.type === 'WheelSlot' && typeof cap.slotNumber === 'number' && Array.isArray(cap.dmxRange)) {
            const [min, max] = cap.dmxRange;
            if (typeof min === 'number' && typeof max === 'number') {
                slotDmxLookup.set(cap.slotNumber, Math.round((min + max) / 2));
            }
        }
    }
    // WAVE 7749.40: Include ALL slots — do NOT filter out Open.
    // Open slots are assigned white RGB so they can be targeted mathematically
    // by the neutral fallback in ColorTranslator.
    const colors = slots.map((s, i) => {
        const slotNumber = i + 1; // OFL slots are 1-indexed
        const hasColors = Array.isArray(s?.colors) && s.colors.length > 0;
        const isOpen = !hasColors || s?.type === 'Open';
        let rgb;
        let name;
        if (isOpen) {
            // Open slot: white/transparent — targetable by neutral fallback
            rgb = { r: 255, g: 255, b: 255 };
            name = s?.name || 'Open';
        }
        else {
            const hex = String(s.colors[0]);
            rgb = hexToRgb(hex);
            name = s.name || s.type || 'Color';
        }
        // Use real DMX from capabilities if available; fall back to linear spread
        // only if the OFL fixture lacks capability ranges (rare/legacy).
        const dmx = slotDmxLookup.get(slotNumber) ?? Math.round((i / Math.max(1, slots.length)) * 255);
        return { dmx, name, rgb };
    });
    return {
        colors,
        colorEngine,
    };
}
// ── Mode resolution ───────────────────────────────────────────────────────
function resolveMode(oflJson, preferredMode) {
    const modes = Array.isArray(oflJson?.modes) ? oflJson.modes : [];
    if (modes.length === 0)
        return null;
    if (preferredMode) {
        const match = modes.find(m => m?.name === preferredMode || m?.shortName === preferredMode);
        if (match)
            return match;
    }
    return modes[0];
}
// ── MAIN TRANSLATOR ───────────────────────────────────────────────────────
export function translateOflFixture(oflJson, preferredMode) {
    const mode = resolveMode(oflJson, preferredMode);
    const channelNames = Array.isArray(mode?.channels) ? mode.channels : [];
    const availableChannels = (oflJson?.availableChannels && typeof oflJson.availableChannels === 'object')
        ? oflJson.availableChannels
        : {};
    // Build a fine-alias lookup: aliasName → { parentName, parentDef, fineIndex }
    const fineAliasLookup = {};
    for (const [parentName, parentDef] of Object.entries(availableChannels)) {
        const aliases = Array.isArray(parentDef?.fineChannelAliases)
            ? parentDef.fineChannelAliases
            : [];
        aliases.forEach((alias, i) => {
            fineAliasLookup[alias] = { parentName, parentDef, fineIndex: i };
        });
    }
    const channels = channelNames.map((chName, idx) => {
        if (chName === null || chName === undefined || chName === '') {
            return {
                index: idx,
                name: `Reserved ${idx + 1}`,
                type: 'unknown',
                defaultValue: 0,
                is16bit: false,
            };
        }
        const directDef = availableChannels[chName];
        if (directDef) {
            const type = translateChannelType(chName, directDef);
            return {
                index: idx,
                name: chName,
                type,
                defaultValue: parsePercent(directDef?.defaultValue),
                is16bit: Array.isArray(directDef?.fineChannelAliases) && directDef.fineChannelAliases.length > 0,
            };
        }
        const fine = fineAliasLookup[chName];
        if (fine) {
            const parentType = translateChannelType(fine.parentName, fine.parentDef);
            let fineType = parentType;
            if (parentType === 'pan')
                fineType = 'pan_fine';
            else if (parentType === 'tilt')
                fineType = 'tilt_fine';
            // WAVE 7644-16BIT-DIMMER: Map dimmer fine alias → dimmer_fine so the
            // ingestion pipeline can pair it with the coarse dimmer channel.
            else if (parentType === 'dimmer')
                fineType = 'dimmer_fine';
            return {
                index: idx,
                name: chName,
                type: fineType,
                defaultValue: 0,
                is16bit: true,
            };
        }
        return {
            index: idx,
            name: chName,
            type: 'custom',
            defaultValue: 0,
            is16bit: false,
        };
    });
    const wheels = extractWheels(oflJson, channels);
    const capabilities = deriveCapabilitiesUnified(channels, wheels, null);
    const fixtureType = detectFixtureType(oflJson, channels);
    const manufacturerKey = String(oflJson?.manufacturerKey || 'ofl');
    const fixtureKey = String(oflJson?.fixtureKey || oflJson?.name || 'fixture');
    const id = `user-hybrid-${sanitize(manufacturerKey)}-${sanitize(fixtureKey)}`;
    return {
        id,
        name: String(oflJson?.name || fixtureKey),
        manufacturer: oflJson?.manufacturerKey ? String(oflJson.manufacturerKey) : 'OFL',
        type: fixtureType,
        channels,
        capabilities,
        wheels: wheels || null,
        physics: null,
        dmxGovernors: [],
    };
}

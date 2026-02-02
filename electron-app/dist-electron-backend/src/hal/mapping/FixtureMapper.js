/**
 * 🏛️ WAVE 210 + WAVE 1001: FIXTURE MAPPER
 *
 * Extracted from main.ts fixtureStates.map() logic
 *
 * RESPONSIBILITIES:
 * - Convert LightingIntent to per-fixture state
 * - Apply color roles (primary/secondary/accent/ambient)
 * - Calculate DMX channel values
 * - Handle pan/tilt for movers
 * - Support effects override (strobe, blinder, police, rainbow)
 * - 🎨 WAVE 1001: Color translation for wheel-based fixtures (Beams)
 * - 🛡️ WAVE 1001: Safety layer for mechanical color wheels
 *
 * DOES NOT:
 * - Calculate intensity (that's ZoneRouter + PhysicsEngine)
 * - Know about audio analysis (that's Brain's job)
 * - Send DMX (that's the Driver's job)
 */
import { hslToRgb } from '../../core/protocol/LightingIntent';
// 🎨 WAVE 1001: HAL Translation imports
import { getColorTranslator, getHardwareSafetyLayer, } from '../translation';
// ═══════════════════════════════════════════════════════════════════════════
// FIXTURE MAPPER CLASS
// ═══════════════════════════════════════════════════════════════════════════
export class FixtureMapper {
    constructor() {
        // Installation type affects tilt inversion
        this.installationType = 'floor';
        // Manual overrides storage
        this.manualOverrides = new Map();
        // Active effects
        this.activeEffects = new Set();
        // Blackout state
        this.blackoutActive = false;
        // 🔍 WAVE 338.2: Current optics (set by HAL on vibe change)
        this.currentOptics = { zoom: 127, focus: 127 };
        // 🎨 WAVE 1001: HAL Translation components (singletons)
        this.colorTranslator = getColorTranslator();
        this.safetyLayer = getHardwareSafetyLayer();
        // 🎨 WAVE 1001: Profile cache (avoid repeated lookups)
        this.profileCache = new Map();
        // 🎨 WAVE 1001: Debug flag
        this.halDebug = false;
        this.halDebugLastLog = 0;
        console.log('[FixtureMapper] 🎛️ Initialized (WAVE 210 + WAVE 1001 HAL)');
    }
    /**
     * 🎨 WAVE 1001: Enable/disable HAL debug logging
     */
    setHALDebug(enabled) {
        this.halDebug = enabled;
        console.log(`[FixtureMapper] 🎨 HAL Debug: ${enabled ? 'ON' : 'OFF'}`);
    }
    /**
     * 🔍 WAVE 338.2: Update optics from HAL
     */
    setCurrentOptics(optics) {
        this.currentOptics = optics;
    }
    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Map a LightingIntent to a single fixture's state.
     */
    mapFixture(fixture, intent, intensity, movement) {
        const zone = (fixture.zone || 'UNASSIGNED');
        // Convert intent palette to RGB
        const palette = this.intentPaletteToRGB(intent);
        // Determine which color role this zone uses
        const colorRole = this.getColorRoleForZone(zone);
        const fixtureColor = palette[colorRole];
        // Calculate pan/tilt with installation type correction
        let panValue = movement.pan;
        let tiltValue = movement.tilt;
        const isMovingFixture = this.isMovingZone(zone) ||
            fixture.type?.toLowerCase().includes('moving');
        // ═══════════════════════════════════════════════════════════════════════
        // 🔧 WAVE 343: ELIMINADO MIRROR DUPLICADO
        // 
        // El mirror para MOVING_RIGHT ahora se aplica en HAL.applyPhaseOffset()
        // Mantenerlo aquí causaba DOBLE inversión (RIGHT volvía al original)
        // 
        // ANTES: if (zone === 'MOVING_RIGHT') { panValue = 1 - panValue } ← BUG!
        // AHORA: HAL es el único responsable de la inversión mirror
        // ═══════════════════════════════════════════════════════════════════════
        // Ceiling tilt inversion (WAVE 24.6)
        if (this.installationType === 'ceiling' && isMovingFixture) {
            tiltValue = 1 - tiltValue;
        }
        return {
            dmxAddress: fixture.dmxAddress,
            universe: fixture.universe,
            name: fixture.name,
            zone: zone,
            type: fixture.type || 'unknown',
            dimmer: Math.round(intensity * 255),
            r: fixtureColor.r,
            g: fixtureColor.g,
            b: fixtureColor.b,
            pan: isMovingFixture ? Math.round(panValue * 255) : 0,
            tilt: isMovingFixture ? Math.round(tiltValue * 255) : 0,
            // 🔍 WAVE 338.2: Optics (will be set by HAL via setCurrentOptics)
            zoom: this.currentOptics.zoom,
            focus: this.currentOptics.focus,
            // 🎨 WAVE 687: Dynamic channel mapping
            channels: fixture.channels,
            // 🎨 WAVE 1001: HAL Translation metadata
            hasColorWheel: fixture.hasColorWheel,
            hasColorMixing: fixture.hasColorMixing,
            profileId: fixture.profileId,
            fixtureId: fixture.id ?? `fixture-${fixture.dmxAddress}`,
        };
    }
    /**
     * Apply effects and overrides to fixture states.
     * This is called AFTER mapFixture to modify the final output.
     */
    applyEffectsAndOverrides(states, timestamp) {
        return states.map(state => {
            let finalState = { ...state };
            // Apply manual override if exists
            const fixtureId = `fixture-${state.dmxAddress}`;
            const override = this.manualOverrides.get(fixtureId) ||
                this.manualOverrides.get(state.name);
            if (override) {
                finalState = this.applyOverride(finalState, override, timestamp);
            }
            // Apply active effects
            finalState = this.applyActiveEffects(finalState, timestamp);
            // Apply blackout (overrides everything)
            if (this.blackoutActive) {
                finalState.dimmer = 0;
                finalState.r = 0;
                finalState.g = 0;
                finalState.b = 0;
            }
            return finalState;
        });
    }
    /**
     * 🎨 WAVE 687 + WAVE 1001: DYNAMIC CHANNEL MAPPER WITH HAL TRANSLATION
     *
     * Convert fixture states to DMX packets using the fixture's channel definition.
     * This is the ARCHITECTURALLY CORRECT solution - no more hardcoded 8 channels.
     *
     * WAVE 1001 ADDITION: Before generating DMX, translate colors through HAL:
     * - RGB fixtures: Pass-through (Selene's color goes directly)
     * - Wheel fixtures: Translate RGB → nearest wheel color
     * - Safety Layer: Debounce rapid changes to protect mechanical wheels
     *
     * Each fixture's JSON defines its channels (pan, tilt, dimmer, color_wheel, etc.)
     * and this method constructs the DMX packet dynamically based on that definition.
     *
     * @param states - Array of fixture states with control values
     * @returns DMX packets ready to send to driver
     */
    statesToDMXPackets(states) {
        return states.map(state => {
            // 🎨 WAVE 1001: Apply HAL translation BEFORE building channels
            const translatedState = this.applyHALTranslation(state);
            // 🎨 WAVE 687: Build channel array dynamically from fixture definition
            const channels = this.buildDynamicChannels(translatedState);
            return {
                universe: translatedState.universe,
                address: translatedState.dmxAddress,
                channels,
                fixtureId: translatedState.fixtureId ?? `fixture-${translatedState.dmxAddress}`
            };
        });
    }
    /**
     * 🎨 WAVE 1001: HAL TRANSLATION - The Magic Happens Here
     *
     * Translates Selene's RGB dreams into physical DMX reality:
     * 1. Detect if fixture has color wheel or RGB
     * 2. If wheel: Find nearest color, apply safety debounce
     * 3. If RGB: Pass-through (no translation needed)
     *
     * PHILOSOPHY: "Selene dreams in RGB, Beams speak their dialect"
     */
    applyHALTranslation(state) {
        // Skip if fixture has RGB mixing (no translation needed)
        if (state.hasColorMixing && !state.hasColorWheel) {
            return state;
        }
        // Skip if fixture explicitly has no color wheel
        if (!state.hasColorWheel) {
            return state;
        }
        // ═══════════════════════════════════════════════════════════════════
        // 🎨 FIXTURE HAS COLOR WHEEL - TRANSLATE!
        // ═══════════════════════════════════════════════════════════════════
        // Get or cache the fixture profile
        const profile = this.getFixtureProfile(state.name, state.profileId);
        // If no profile found, pass-through (assume RGB)
        if (!profile) {
            return state;
        }
        // Translate RGB to wheel color
        const targetRGB = { r: state.r, g: state.g, b: state.b };
        const translation = this.colorTranslator.translate(targetRGB, profile);
        // If not translated (RGB fixture detected by profile), pass-through
        if (!translation.wasTranslated) {
            return state;
        }
        // Apply safety filter (debounce, latch, strobe delegation)
        const fixtureId = state.fixtureId ?? `fixture-${state.dmxAddress}`;
        const safetyResult = this.safetyLayer.filter(fixtureId, translation.colorWheelDmx ?? 0, profile, state.dimmer);
        // Create translated state
        const translatedState = {
            ...state,
            // 🎨 Replace RGB with translated color (for consistency)
            r: translation.outputRGB.r,
            g: translation.outputRGB.g,
            b: translation.outputRGB.b,
            // 🎨 Set color wheel DMX value
            colorWheel: safetyResult.finalColorDmx,
        };
        // 🛡️ Handle strobe delegation (if color is changing too fast)
        if (safetyResult.delegateToStrobe) {
            // Force strobe instead of color changes
            translatedState.strobe = safetyResult.suggestedShutter;
        }
        // 🔍 Debug logging (throttled)
        if (this.halDebug) {
            const now = Date.now();
            if (now - this.halDebugLastLog > 1000) { // Log max once per second
                this.halDebugLastLog = now;
                console.log(`[HAL 🎨] ${state.name}: RGB(${state.r},${state.g},${state.b}) → ${translation.colorName} (DMX ${safetyResult.finalColorDmx})${safetyResult.wasBlocked ? ' [BLOCKED]' : ''}${safetyResult.delegateToStrobe ? ' [→STROBE]' : ''}`);
            }
        }
        return translatedState;
    }
    /**
     * 🎨 WAVE 1001: Get fixture profile (with caching)
     */
    getFixtureProfile(fixtureName, profileId) {
        const cacheKey = profileId ?? fixtureName;
        // Check cache
        if (this.profileCache.has(cacheKey)) {
            return this.profileCache.get(cacheKey) ?? null;
        }
        // Import here to avoid circular dependencies
        const { getProfile, getProfileByModel } = require('../translation');
        // Try explicit profileId first, then model name detection
        const profile = profileId
            ? getProfile(profileId)
            : getProfileByModel(fixtureName);
        // Cache result (including null)
        this.profileCache.set(cacheKey, profile ?? null);
        if (profile && this.halDebug) {
            console.log(`[HAL 🎨] Profile loaded for "${fixtureName}": ${profile.id} (${profile.colorEngine.mixing})`);
        }
        return profile ?? null;
    }
    /**
     * 🎨 WAVE 687: Build DMX channel array from fixture definition
     *
     * Maps logical control values (dimmer, pan, tilt, etc.) to physical DMX channels
     * based on the fixture's channel definition JSON.
     *
     * Supports ALL channel types defined in ChannelType:
     * - Movement: pan, pan_fine, tilt, tilt_fine
     * - Intensity: dimmer, strobe, shutter
     * - Color: red, green, blue, white, amber, uv, color_wheel
     * - Effects: gobo, prism, focus, zoom, speed, macro, control
     *
     * @param state - Fixture state with control values and channel definitions
     * @returns Array of DMX values (0-255) in channel order
     */
    buildDynamicChannels(state) {
        // If no channel definition, fall back to legacy 8-channel format
        if (!state.channels || state.channels.length === 0) {
            return this.buildLegacyChannels(state);
        }
        // Sort channels by index to ensure correct DMX order
        const sortedChannels = [...state.channels].sort((a, b) => a.index - b.index);
        // Map each channel to its DMX value based on type
        return sortedChannels.map(channel => {
            return this.getChannelValue(state, channel);
        });
    }
    /**
     * 🎨 WAVE 687: Get DMX value for a specific channel based on its type
     */
    getChannelValue(state, channel) {
        const type = channel.type;
        switch (type) {
            // ═══════════════════════════════════════════════════════════════════
            // MOVEMENT CHANNELS
            // ═══════════════════════════════════════════════════════════════════
            case 'pan':
                // Use physics-interpolated position if available, otherwise target
                return Math.round(state.physicalPan ?? state.pan);
            case 'pan_fine':
                // Fine control: fractional part of 16-bit pan (future implementation)
                return 0;
            case 'tilt':
                // Use physics-interpolated position if available, otherwise target
                return Math.round(state.physicalTilt ?? state.tilt);
            case 'tilt_fine':
                // Fine control: fractional part of 16-bit tilt (future implementation)
                return 0;
            // ═══════════════════════════════════════════════════════════════════
            // INTENSITY CHANNELS
            // ═══════════════════════════════════════════════════════════════════
            case 'dimmer':
                return Math.round(state.dimmer);
            case 'shutter':
                // Shutter: use state value if available, otherwise use defaultValue from definition
                // 0 = closed, 255 = open, intermediate = strobe speed on some fixtures
                return state.shutter ?? (channel.defaultValue ?? 255);
            case 'strobe':
                // Strobe speed: 0 = no strobe, higher = faster
                return state.strobe ?? (channel.defaultValue ?? 0);
            // ═══════════════════════════════════════════════════════════════════
            // COLOR CHANNELS
            // ═══════════════════════════════════════════════════════════════════
            case 'red':
                return Math.round(state.r);
            case 'green':
                return Math.round(state.g);
            case 'blue':
                return Math.round(state.b);
            case 'white':
                return state.white ?? (channel.defaultValue ?? 0);
            case 'amber':
                return state.amber ?? (channel.defaultValue ?? 0);
            case 'uv':
                return state.uv ?? (channel.defaultValue ?? 0);
            case 'color_wheel':
                // Color wheel position: 0 = white/open, then colors by position
                return state.colorWheel ?? (channel.defaultValue ?? 0);
            // ═══════════════════════════════════════════════════════════════════
            // EFFECT CHANNELS
            // ═══════════════════════════════════════════════════════════════════
            case 'gobo':
                // Gobo wheel: 0 = open (no gobo)
                return state.gobo ?? (channel.defaultValue ?? 0);
            case 'prism':
                // Prism: 0 = out/off
                return state.prism ?? (channel.defaultValue ?? 0);
            case 'focus':
                return Math.round(state.focus);
            case 'zoom':
                return Math.round(state.zoom);
            case 'speed':
                // 🔥 WAVE 1008.2: Pan/Tilt movement speed (0=fast, 255=slow)
                // Use state.speed if set by manual override, otherwise use fixture default
                return state.speed ?? (channel.defaultValue ?? 128);
            case 'macro':
                // Macro/program channel
                return channel.defaultValue ?? 0;
            case 'control':
                // Control/reset channel - use default (usually 0 or specific value for normal operation)
                return channel.defaultValue ?? 0;
            // ═══════════════════════════════════════════════════════════════════
            // UNKNOWN/CUSTOM CHANNELS
            // ═══════════════════════════════════════════════════════════════════
            case 'unknown':
            default:
                // For unknown channels, use the default value from fixture definition
                return channel.defaultValue ?? 0;
        }
    }
    /**
     * 🎨 WAVE 687: Legacy fallback for fixtures without channel definition
     *
     * This is the original hardcoded 8-channel format for backwards compatibility
     * with fixtures that don't have a JSON definition.
     */
    buildLegacyChannels(state) {
        return [
            Math.round(state.dimmer),
            Math.round(state.r),
            Math.round(state.g),
            Math.round(state.b),
            Math.round(state.pan),
            Math.round(state.tilt),
            Math.round(state.zoom),
            Math.round(state.focus),
        ];
    }
    // ═══════════════════════════════════════════════════════════════════════
    // STATE MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════
    setInstallationType(type) {
        this.installationType = type;
    }
    setManualOverride(fixtureId, override) {
        this.manualOverrides.set(fixtureId, override);
    }
    clearManualOverride(fixtureId) {
        this.manualOverrides.delete(fixtureId);
    }
    clearAllOverrides() {
        this.manualOverrides.clear();
    }
    setEffect(effect, active) {
        if (active) {
            this.activeEffects.add(effect);
        }
        else {
            this.activeEffects.delete(effect);
        }
    }
    setBlackout(active) {
        this.blackoutActive = active;
    }
    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE METHODS
    // ═══════════════════════════════════════════════════════════════════════
    intentPaletteToRGB(intent) {
        return {
            primary: hslToRgb(intent.palette.primary),
            secondary: hslToRgb(intent.palette.secondary),
            accent: hslToRgb(intent.palette.accent),
            ambient: hslToRgb(intent.palette.ambient),
        };
    }
    getColorRoleForZone(zone) {
        const roleMap = {
            'FRONT_PARS': 'primary',
            'BACK_PARS': 'accent',
            'MOVING_LEFT': 'secondary',
            'MOVING_RIGHT': 'ambient',
            'STROBES': 'accent',
            'AMBIENT': 'ambient',
            'FLOOR': 'primary',
            'UNASSIGNED': 'primary',
        };
        return roleMap[zone] || 'primary';
    }
    isMovingZone(zone) {
        return zone.includes('MOVING') ||
            zone.toLowerCase().includes('left') ||
            zone.toLowerCase().includes('right');
    }
    applyOverride(state, override, timestamp) {
        const result = { ...state };
        if (override.pan !== undefined)
            result.pan = override.pan;
        if (override.tilt !== undefined)
            result.tilt = override.tilt;
        if (override.dimmer !== undefined)
            result.dimmer = override.dimmer;
        if (override.r !== undefined)
            result.r = override.r;
        if (override.g !== undefined)
            result.g = override.g;
        if (override.b !== undefined)
            result.b = override.b;
        // Pattern movement
        if (override.patternEnabled && override.movementPattern &&
            override.movementPattern !== 'static') {
            const patternResult = this.calculatePatternMovement(override, result.pan, result.tilt, timestamp);
            result.pan = patternResult.pan;
            result.tilt = patternResult.tilt;
        }
        return result;
    }
    calculatePatternMovement(override, basePan, baseTilt, timestamp) {
        const speed = (override.patternSpeed || 50) / 100;
        const phase = ((timestamp * speed) / 1000) % (Math.PI * 2);
        const amplitude = ((override.patternAmplitude || 50) / 100) * 127;
        const centerPan = override.pan !== undefined ? override.pan : 127;
        const centerTilt = override.tilt !== undefined ? override.tilt : 127;
        let pan = basePan;
        let tilt = baseTilt;
        switch (override.movementPattern) {
            case 'circle':
                pan = Math.round(centerPan + Math.cos(phase) * amplitude);
                tilt = Math.round(centerTilt + Math.sin(phase) * amplitude);
                break;
            case 'figure8':
                pan = Math.round(centerPan + Math.sin(phase) * amplitude);
                tilt = Math.round(centerTilt + Math.sin(phase * 2) * amplitude * 0.5);
                break;
            case 'sweep':
                pan = Math.round(centerPan + Math.sin(phase) * amplitude);
                tilt = centerTilt;
                break;
            case 'random':
                pan = Math.round(centerPan + (Math.random() - 0.5) * amplitude * 0.3);
                tilt = Math.round(centerTilt + (Math.random() - 0.5) * amplitude * 0.3);
                break;
        }
        // Clamp to valid DMX range
        pan = Math.max(0, Math.min(255, pan));
        tilt = Math.max(0, Math.min(255, tilt));
        return { pan, tilt };
    }
    applyActiveEffects(state, timestamp) {
        const result = { ...state };
        if (this.activeEffects.has('strobe')) {
            const strobeOn = (Math.floor(timestamp / 50) % 2) === 0;
            result.dimmer = strobeOn ? 255 : 0;
        }
        if (this.activeEffects.has('blinder')) {
            result.dimmer = 255;
            result.r = 255;
            result.g = 255;
            result.b = 255;
        }
        if (this.activeEffects.has('police')) {
            const policePhase = (Math.floor(timestamp / 250) % 2) === 0;
            result.dimmer = 255;
            result.r = policePhase ? 255 : 0;
            result.g = 0;
            result.b = policePhase ? 0 : 255;
        }
        if (this.activeEffects.has('rainbow')) {
            const hue = (timestamp / 3000) % 1;
            const rgb = this.hslToRgbLocal(hue, 1.0, 0.5);
            result.r = rgb.r;
            result.g = rgb.g;
            result.b = rgb.b;
            result.dimmer = 255;
        }
        return result;
    }
    /**
     * Local HSL to RGB for effects (normalized h 0-1).
     */
    hslToRgbLocal(h, s, l) {
        let r, g, b;
        if (s === 0) {
            r = g = b = l;
        }
        else {
            const hue2rgb = (p, q, t) => {
                if (t < 0)
                    t += 1;
                if (t > 1)
                    t -= 1;
                if (t < 1 / 6)
                    return p + (q - p) * 6 * t;
                if (t < 1 / 2)
                    return q;
                if (t < 2 / 3)
                    return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }
        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255),
        };
    }
    // ═══════════════════════════════════════════════════════════════════════
    // CLEANUP
    // ═══════════════════════════════════════════════════════════════════════
    destroy() {
        this.manualOverrides.clear();
        this.activeEffects.clear();
        console.log('[FixtureMapper] 🛑 Destroyed');
    }
}
// Export singleton for easy use
export const fixtureMapper = new FixtureMapper();

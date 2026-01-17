/**
 * 🏛️ WAVE 210: FIXTURE MAPPER
 *
 * Extracted from main.ts fixtureStates.map() logic
 *
 * RESPONSIBILITIES:
 * - Convert LightingIntent to per-fixture state
 * - Apply color roles (primary/secondary/accent/ambient)
 * - Calculate DMX channel values
 * - Handle pan/tilt for movers
 * - Support effects override (strobe, blinder, police, rainbow)
 *
 * DOES NOT:
 * - Calculate intensity (that's ZoneRouter + PhysicsEngine)
 * - Know about audio analysis (that's Brain's job)
 * - Send DMX (that's the Driver's job)
 */
import { hslToRgb } from '../../core/protocol/LightingIntent';
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
        console.log('[FixtureMapper] 🎛️ Initialized (WAVE 210)');
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
     * 🎨 WAVE 687: DYNAMIC CHANNEL MAPPER
     *
     * Convert fixture states to DMX packets using the fixture's channel definition.
     * This is the ARCHITECTURALLY CORRECT solution - no more hardcoded 8 channels.
     *
     * Each fixture's JSON defines its channels (pan, tilt, dimmer, color_wheel, etc.)
     * and this method constructs the DMX packet dynamically based on that definition.
     *
     * @param states - Array of fixture states with control values
     * @returns DMX packets ready to send to driver
     */
    statesToDMXPackets(states) {
        return states.map(state => {
            // 🎨 WAVE 687: Build channel array dynamically from fixture definition
            const channels = this.buildDynamicChannels(state);
            return {
                universe: state.universe,
                address: state.dmxAddress,
                channels,
                fixtureId: `fixture-${state.dmxAddress}`
            };
        });
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
                // Movement speed/motor speed
                return channel.defaultValue ?? 128;
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

/**
 * 🏛️ WAVE 207: ZONE ROUTER
 *
 * Extracted from main.ts switch(zone) block (~300 lines)
 *
 * RESPONSIBILITIES:
 * - Map abstract zones to fixture indices
 * - Determine which fixtures respond to which audio signals
 * - Provide zone-specific physics parameters
 * - Route LightingIntent zones to actual fixture addresses
 *
 * DOES NOT:
 * - Calculate actual DMX values (that's FixtureMapper's job)
 * - Know about specific fixture channels (that's FixtureMapper's job)
 * - Apply physics (that's PhysicsEngine's job)
 */
// ═══════════════════════════════════════════════════════════════════════════
// ZONE ROUTER CLASS
// ═══════════════════════════════════════════════════════════════════════════
export class ZoneRouter {
    constructor() {
        this.debugCounter = 0; // 🔥 WAVE 279.4: Debug counter
        this.zoneConfig = this.buildZoneConfig();
        console.log('[ZoneRouter] 🗺️ Initialized (WAVE 207)');
    }
    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Get routing configuration for a physical zone.
     */
    getZoneConfig(zone) {
        return this.zoneConfig.get(zone);
    }
    /**
     * Calculate target intensity for FRONT_PARS zone.
     * Based on main.ts WAVE 107 implementation.
     */
    calculateFrontParIntensity(input, preset) {
        // VOCAL LOCK: If silence, PARs off
        if (input.isRealSilence) {
            return 0;
        }
        // KICK GUARD - Sidechain Visual (WAVE 117)
        let isolationFactor = 1.0;
        if (input.treblePulse > 0.2) {
            isolationFactor = 0.4; // Strong snare snap
        }
        else if (input.treblePulse > 0.1) {
            isolationFactor = 0.7; // Hi-hat or minor transient
        }
        // Check if bass exceeds gate
        if (input.bassPulse > preset.parGate) {
            const isolatedPulse = input.bassPulse * isolationFactor;
            let rawIntensity = Math.min(1, (isolatedPulse - preset.parGate) * preset.parGain);
            // Visual headroom ceiling
            rawIntensity = Math.min(preset.parMax, rawIntensity);
            // Soft knee clipper
            rawIntensity = this.applySoftKnee(rawIntensity);
            // WAVE 256.5: Reduced Vanta Black hard floor (was 0.20 - too aggressive)
            if (rawIntensity < 0.05)
                rawIntensity = 0;
            // AGC Trap
            if (input.isAGCTrap)
                rawIntensity = 0;
            return rawIntensity;
        }
        return 0;
    }
    /**
     * Calculate target intensity for BACK_PARS zone.
     * 🎚️ WAVE 275: Back PARs respond ONLY to MID (Snare/Clap, contratiempo)
     * No mezclar con treble - eso va a los movers
     */
    calculateBackParIntensity(input, preset) {
        if (input.isRealSilence) {
            return 0;
        }
        // 🎚️ WAVE 275: SOLO MID - el contratiempo, snare, claps
        // El treble ahora es exclusivo de los movers
        const midSignal = input.rawMid;
        const pulseBoost = input.treblePulse > 0.3 ? 1.2 : 1.0; // Solo boost en transientes fuertes
        // 🔥 WAVE 279.4: DEBUG - ver qué está pasando
        const passesGate = midSignal > preset.backParGate;
        if (passesGate) {
            let rawIntensity = Math.min(1, (midSignal - preset.backParGate) * preset.backParGain * pulseBoost);
            // Visual headroom ceiling
            rawIntensity = Math.min(preset.backParMax, rawIntensity);
            // Soft knee clipper
            rawIntensity = this.applySoftKnee(rawIntensity);
            // WAVE 256.5: Reduced Vanta Black hard floor (was 0.20)
            if (rawIntensity < 0.05)
                rawIntensity = 0;
            // AGC Trap
            if (input.isAGCTrap)
                rawIntensity = 0;
            // 🔥 WAVE 279.4: DEBUG log cada 60 frames
            if (this.debugCounter++ % 60 === 0 && rawIntensity > 0) {
                console.log(`[HAL BACK_PARS] mid=${midSignal.toFixed(2)} gate=${preset.backParGate} → intensity=${rawIntensity.toFixed(2)}`);
            }
            return rawIntensity;
        }
        return 0;
    }
    /**
     * Get shimmer decay speed for back PARs.
     * Slower decay for cymbals/hi-hats (WAVE 109).
     */
    getShimmerDecaySpeed(baseDecaySpeed) {
        return Math.min(10, baseDecaySpeed * 1.5);
    }
    /**
     * Get effective mover decay speed.
     * Uses separate moverDecaySpeed if defined (WAVE 161.5).
     */
    getEffectiveMoverDecay(preset) {
        return preset.moverDecaySpeed ?? preset.decaySpeed;
    }
    /**
     * Map abstract zone from LightingIntent to physical zones.
     */
    mapAbstractToPhysical(abstractZone) {
        const mapping = {
            'front': ['FRONT_PARS'],
            'back': ['BACK_PARS'],
            'left': ['MOVING_LEFT'],
            'right': ['MOVING_RIGHT'],
            'center': ['FRONT_PARS', 'BACK_PARS'],
            'floor': ['FRONT_PARS', 'BACK_PARS'],
            'elevated': ['MOVING_LEFT', 'MOVING_RIGHT'],
            'ambient': ['AMBIENT'],
        };
        return mapping[abstractZone] || ['UNASSIGNED'];
    }
    /**
     * Get all zones that match a filter.
     */
    getZonesByType(filter) {
        if (filter === 'ALL') {
            return Array.from(this.zoneConfig.keys());
        }
        const result = [];
        this.zoneConfig.forEach((config, zone) => {
            if (config.physics.type === filter) {
                result.push(zone);
            }
        });
        return result;
    }
    /**
     * Check if a zone string contains MOVING identifier.
     */
    isMovingZone(zone) {
        return zone.includes('MOVING') ||
            zone.toLowerCase().includes('left') ||
            zone.toLowerCase().includes('right');
    }
    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE METHODS
    // ═══════════════════════════════════════════════════════════════════════
    buildZoneConfig() {
        const config = new Map();
        config.set('FRONT_PARS', {
            zone: 'FRONT_PARS',
            respondsTo: 'bass',
            physics: { type: 'PAR', decayMultiplier: 1.0, colorRole: 'primary' },
            gateThreshold: 0.20,
            gainMultiplier: 2.0,
            maxIntensity: 0.78
        });
        config.set('BACK_PARS', {
            zone: 'BACK_PARS',
            respondsTo: 'treble',
            physics: { type: 'PAR', decayMultiplier: 1.5, colorRole: 'accent' },
            gateThreshold: 0.15,
            gainMultiplier: 2.5,
            maxIntensity: 0.85
        });
        config.set('MOVING_LEFT', {
            zone: 'MOVING_LEFT',
            respondsTo: 'melody',
            physics: { type: 'MOVER', decayMultiplier: 1.0, colorRole: 'secondary' },
            gateThreshold: 0.25,
            gainMultiplier: 1.5,
            maxIntensity: 1.0
        });
        config.set('MOVING_RIGHT', {
            zone: 'MOVING_RIGHT',
            respondsTo: 'melody',
            physics: { type: 'MOVER', decayMultiplier: 1.0, colorRole: 'ambient' },
            gateThreshold: 0.25,
            gainMultiplier: 1.5,
            maxIntensity: 1.0
        });
        config.set('STROBES', {
            zone: 'STROBES',
            respondsTo: 'beat',
            physics: { type: 'PAR', decayMultiplier: 0.5, colorRole: 'accent' },
            gateThreshold: 0.80,
            gainMultiplier: 1.0,
            maxIntensity: 1.0
        });
        config.set('AMBIENT', {
            zone: 'AMBIENT',
            respondsTo: 'ambient',
            physics: { type: 'PAR', decayMultiplier: 2.0, colorRole: 'ambient' },
            gateThreshold: 0.10,
            gainMultiplier: 1.0,
            maxIntensity: 0.50
        });
        config.set('FLOOR', {
            zone: 'FLOOR',
            respondsTo: 'bass',
            physics: { type: 'PAR', decayMultiplier: 1.2, colorRole: 'primary' },
            gateThreshold: 0.25,
            gainMultiplier: 1.8,
            maxIntensity: 0.70
        });
        config.set('UNASSIGNED', {
            zone: 'UNASSIGNED',
            respondsTo: 'ambient',
            physics: { type: 'PAR', decayMultiplier: 1.0, colorRole: 'primary' },
            gateThreshold: 0.30,
            gainMultiplier: 1.0,
            maxIntensity: 0.60
        });
        return config;
    }
    /**
     * Soft knee clipper (same as PhysicsEngine).
     */
    applySoftKnee(value) {
        if (value < 0.15)
            return 0;
        if (value < 0.25) {
            const normalized = (value - 0.15) / 0.10;
            return normalized * 0.25;
        }
        return value;
    }
    // ═══════════════════════════════════════════════════════════════════════
    // CLEANUP
    // ═══════════════════════════════════════════════════════════════════════
    destroy() {
        this.zoneConfig.clear();
        console.log('[ZoneRouter] 🛑 Destroyed');
    }
}
// Export singleton for easy use
export const zoneRouter = new ZoneRouter();

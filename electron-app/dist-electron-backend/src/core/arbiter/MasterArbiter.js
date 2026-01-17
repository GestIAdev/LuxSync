/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎭 MASTER ARBITER - CENTRAL CONTROL HIERARCHY
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 373: The single source of truth for all lighting control.
 *
 * THE PROBLEM IT SOLVES:
 * Before MasterArbiter, we had:
 * - TitanEngine generating LightingIntent
 * - SeleneLuxConscious existing but disconnected
 * - Manual controls not integrated
 * - No clear priority system
 *
 * NOW:
 * Every layer submits to MasterArbiter → MasterArbiter arbitrates → Single output to HAL
 *
 * LAYER PRIORITY (highest wins):
 * - Layer 4: BLACKOUT (emergency, always wins)
 * - Layer 3: EFFECTS (strobe, flash, etc.)
 * - Layer 2: MANUAL (user overrides)
 * - Layer 1: CONSCIOUSNESS (CORE 3 - SeleneLuxConscious)
 * - Layer 0: TITAN_AI (base from TitanEngine)
 *
 * MERGE STRATEGY:
 * - Dimmer: HTP (Highest Takes Precedence)
 * - Position/Color: LTP (Latest Takes Precedence)
 * - Transitions: Smooth crossfade on release
 *
 * @module core/arbiter/MasterArbiter
 * @version WAVE 373
 */
import { EventEmitter } from 'events';
import { ControlLayer, DEFAULT_ARBITER_CONFIG, } from './types';
import { mergeChannel, clampDMX } from './merge/MergeStrategies';
import { CrossfadeEngine } from './CrossfadeEngine';
export class MasterArbiter extends EventEmitter {
    constructor(config = {}) {
        super();
        // Layer state
        this.layer0_titan = null;
        this.layer1_consciousness = null;
        this.layer2_manualOverrides = new Map();
        this.layer3_effects = [];
        this.layer4_blackout = false;
        // Fixtures (populated from HAL or StageStore)
        this.fixtures = new Map();
        // Grand Master (WAVE 376)
        this.grandMaster = 1.0; // 0-1, multiplies dimmer globally
        // Pattern Engine (WAVE 376)
        this.activePatterns = new Map();
        // Group Formations (WAVE 376)
        this.activeFormations = new Map();
        // State tracking
        this.frameNumber = 0;
        this.lastOutputTimestamp = 0;
        // 🩸 WAVE 382: Track mover count for spread calculation
        this.moverCount = 0;
        this.config = { ...DEFAULT_ARBITER_CONFIG, ...config };
        this.crossfadeEngine = new CrossfadeEngine(this.config.defaultCrossfadeMs);
        if (this.config.debug) {
            console.log('[MasterArbiter] Initialized with config:', this.config);
        }
    }
    // ═══════════════════════════════════════════════════════════════════════
    // FIXTURE MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * 🩸 WAVE 382: Register fixtures for arbitration
     * NOW PRESERVES: capabilities, hasMovementChannels, channels, type
     * Call this when patch changes or on init.
     *
     * 🔥 WAVE 384.5: Enhanced logging to verify channel propagation
     */
    setFixtures(fixtures) {
        this.fixtures.clear();
        // 🩸 Track movers for individual movement calculation
        let moverCount = 0;
        let totalChannels = 0;
        for (const fixture of fixtures) {
            const id = fixture.id ?? fixture.name;
            // 🩸 WAVE 382: Preserve ALL metadata, don't strip
            const isMover = this.isMovingFixture(fixture);
            const channelCount = fixture.channels?.length || 0;
            totalChannels += channelCount;
            this.fixtures.set(id, {
                ...fixture,
                id,
                type: fixture.type || 'generic',
                // Preserve capabilities if sent, or infer from type
                capabilities: fixture.capabilities || {
                    hasColor: true,
                    hasDimmer: true,
                    hasMovement: isMover,
                    hasZoom: isMover,
                    hasFocus: isMover,
                },
                hasMovementChannels: fixture.hasMovementChannels ?? isMover,
                channels: fixture.channels || [],
            });
            if (isMover)
                moverCount++;
            // 🔥 WAVE 384.5: Log each fixture's channel info
            if (this.config.debug && channelCount > 0) {
                console.log(`[MasterArbiter] 📦 Fixture "${fixture.name}": ${channelCount} channels, movement=${fixture.hasMovementChannels}`);
            }
        }
        // Store mover count for spread calculations
        this.moverCount = moverCount;
        // 🔥 WAVE 384.5: Summary log for verification
        console.log(`[MasterArbiter] 🩸 Registered ${this.fixtures.size} fixtures (${moverCount} movers, ${totalChannels} total channels)`);
    }
    /**
     * 🩸 WAVE 382: Helper to detect moving fixtures
     */
    isMovingFixture(fixture) {
        const type = (fixture.type || '').toLowerCase();
        const zone = (fixture.zone || '').toUpperCase();
        return type.includes('moving') ||
            type.includes('spot') ||
            type.includes('beam') ||
            zone.includes('MOVING') ||
            fixture.hasMovementChannels === true;
    }
    /**
     * Get fixture by ID
     */
    getFixture(id) {
        return this.fixtures.get(id);
    }
    /**
     * Get all fixture IDs
     */
    getFixtureIds() {
        return Array.from(this.fixtures.keys());
    }
    // ═══════════════════════════════════════════════════════════════════════
    // LAYER 0: TITAN AI INPUT
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Set Layer 0 input from TitanEngine
     * Called every frame by TitanOrchestrator.
     */
    setTitanIntent(intent) {
        this.layer0_titan = intent;
    }
    /**
     * Get current Titan intent (for debugging)
     */
    getTitanIntent() {
        return this.layer0_titan;
    }
    // ═══════════════════════════════════════════════════════════════════════
    // LAYER 1: CONSCIOUSNESS INPUT (CORE 3 - PLACEHOLDER)
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Set Layer 1 input from SeleneLuxConscious
     * CORE 3: This will be connected when consciousness is integrated.
     */
    setConsciousnessModifier(modifier) {
        if (!this.config.consciousnessEnabled) {
            return; // Silently ignore if consciousness is disabled
        }
        this.layer1_consciousness = modifier;
    }
    /**
     * Clear consciousness modifier
     */
    clearConsciousnessModifier() {
        this.layer1_consciousness = null;
    }
    /**
     * Get current consciousness state (for debugging)
     */
    getConsciousnessState() {
        return this.layer1_consciousness;
    }
    // ═══════════════════════════════════════════════════════════════════════
    // LAYER 2: MANUAL OVERRIDE
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Set manual override for a fixture
     * WAVE 440: Now MERGES with existing override instead of replacing.
     */
    setManualOverride(override) {
        // Check limit
        if (this.layer2_manualOverrides.size >= this.config.maxManualOverrides &&
            !this.layer2_manualOverrides.has(override.fixtureId)) {
            console.warn(`[MasterArbiter] Max manual overrides reached (${this.config.maxManualOverrides})`);
            return;
        }
        // Check if fixture exists
        if (!this.fixtures.has(override.fixtureId)) {
            console.warn(`[MasterArbiter] ❌ Unknown fixture: ${override.fixtureId}`);
            console.warn(`[MasterArbiter] 📋 Known fixtures: ${Array.from(this.fixtures.keys()).join(', ')}`);
            return;
        }
        // WAVE 440: MEMORY MERGE - Fuse with existing override instead of replacing
        const existingOverride = this.layer2_manualOverrides.get(override.fixtureId);
        if (existingOverride) {
            // Merge controls: new values override existing, but keep non-conflicting ones
            const mergedControls = {
                ...existingOverride.controls,
                ...override.controls,
            };
            // Merge channels: union of both sets (no duplicates)
            const mergedChannels = [...new Set([
                    ...existingOverride.overrideChannels,
                    ...override.overrideChannels,
                ])];
            // Store merged override
            this.layer2_manualOverrides.set(override.fixtureId, {
                ...existingOverride,
                ...override,
                controls: mergedControls,
                overrideChannels: mergedChannels,
                timestamp: performance.now()
            });
            if (this.config.debug) {
                console.log(`[MasterArbiter] 🔀 Merged override: ${override.fixtureId}`, {
                    newChannels: override.overrideChannels,
                    totalChannels: mergedChannels
                });
            }
        }
        else {
            // No existing override, store as new
            this.layer2_manualOverrides.set(override.fixtureId, {
                ...override,
                timestamp: performance.now()
            });
            if (this.config.debug) {
                console.log(`[MasterArbiter] ➕ New override: ${override.fixtureId}`, override.overrideChannels);
            }
        }
        // Emit event
        this.emit('manualOverride', override.fixtureId, override.overrideChannels);
    }
    /**
     * Release manual override for a fixture
     * Starts crossfade transition back to AI control.
     */
    releaseManualOverride(fixtureId, channels) {
        const override = this.layer2_manualOverrides.get(fixtureId);
        if (!override)
            return;
        const channelsToRelease = channels ?? override.overrideChannels;
        // For each channel being released, start a crossfade
        const titanValues = this.getTitanValuesForFixture(fixtureId);
        for (const channel of channelsToRelease) {
            const currentValue = this.getManualChannelValue(override, channel);
            const targetValue = titanValues[channel] ?? 0;
            this.crossfadeEngine.startTransition(fixtureId, channel, currentValue, targetValue, override.releaseTransitionMs || this.config.defaultCrossfadeMs);
        }
        // Update or remove override
        if (channels) {
            // Partial release - remove only specified channels
            const remainingChannels = override.overrideChannels.filter(c => !channels.includes(c));
            if (remainingChannels.length === 0) {
                this.layer2_manualOverrides.delete(fixtureId);
            }
            else {
                override.overrideChannels = remainingChannels;
            }
        }
        else {
            // Full release
            this.layer2_manualOverrides.delete(fixtureId);
        }
        // Emit event
        this.emit('manualRelease', fixtureId, channelsToRelease);
        if (this.config.debug) {
            console.log(`[MasterArbiter] Manual released: ${fixtureId}`, channelsToRelease);
        }
    }
    /**
     * Release all manual overrides
     */
    releaseAllManualOverrides() {
        for (const fixtureId of this.layer2_manualOverrides.keys()) {
            this.releaseManualOverride(fixtureId);
        }
    }
    /**
     * Get manual override for a fixture
     */
    getManualOverride(fixtureId) {
        return this.layer2_manualOverrides.get(fixtureId);
    }
    /**
     * Check if fixture has manual override
     */
    hasManualOverride(fixtureId, channel) {
        const override = this.layer2_manualOverrides.get(fixtureId);
        if (!override)
            return false;
        if (channel)
            return override.overrideChannels.includes(channel);
        return true;
    }
    /**
     * Get all fixtures with manual overrides
     */
    getManualOverrideFixtures() {
        return Array.from(this.layer2_manualOverrides.keys());
    }
    // ═══════════════════════════════════════════════════════════════════════
    // LAYER 3: EFFECTS
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Add an effect
     */
    addEffect(effect) {
        if (this.layer3_effects.length >= this.config.maxActiveEffects) {
            // Remove oldest effect
            this.layer3_effects.shift();
        }
        effect.startTime = performance.now();
        this.layer3_effects.push(effect);
        this.emit('effectStart', effect);
        if (this.config.debug) {
            console.log(`[MasterArbiter] Effect started: ${effect.type}`);
        }
    }
    /**
     * Remove an effect
     */
    removeEffect(type) {
        const index = this.layer3_effects.findIndex(e => e.type === type);
        if (index !== -1) {
            this.layer3_effects.splice(index, 1);
            this.emit('effectEnd', type);
        }
    }
    /**
     * Clear all effects
     */
    clearEffects() {
        this.layer3_effects = [];
    }
    /**
     * Clean up expired effects
     */
    cleanupExpiredEffects() {
        const now = performance.now();
        this.layer3_effects = this.layer3_effects.filter(effect => {
            const elapsed = now - effect.startTime;
            if (elapsed >= effect.durationMs) {
                this.emit('effectEnd', effect.type);
                return false;
            }
            return true;
        });
    }
    // ═══════════════════════════════════════════════════════════════════════
    // LAYER 4: BLACKOUT
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Set blackout state
     * When true, all fixtures go to 0 regardless of other layers.
     */
    setBlackout(active) {
        const changed = this.layer4_blackout !== active;
        this.layer4_blackout = active;
        if (changed) {
            this.emit('blackout', active);
            if (this.config.debug) {
                console.log(`[MasterArbiter] Blackout: ${active}`);
            }
        }
    }
    /**
     * Toggle blackout
     */
    toggleBlackout() {
        this.setBlackout(!this.layer4_blackout);
        return this.layer4_blackout;
    }
    /**
     * Get blackout state
     */
    isBlackoutActive() {
        return this.layer4_blackout;
    }
    // ═══════════════════════════════════════════════════════════════════════
    // GRAND MASTER (WAVE 376)
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Set Grand Master level (0-1)
     * Multiplies dimmer for ALL fixtures globally.
     * If set to 0.5, no fixture can be brighter than 50%.
     */
    setGrandMaster(value) {
        this.grandMaster = Math.max(0, Math.min(1, value));
        if (this.config.debug) {
            console.log(`[MasterArbiter] Grand Master: ${Math.round(this.grandMaster * 100)}%`);
        }
    }
    /**
     * Get current Grand Master level
     */
    getGrandMaster() {
        return this.grandMaster;
    }
    // ═══════════════════════════════════════════════════════════════════════
    // PATTERN ENGINE (WAVE 376)
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Set pattern for a fixture or group
     * Pattern generates procedural movement (Circle, Eight, Sweep).
     */
    setPattern(fixtureIds, pattern) {
        const config = {
            ...pattern,
            startTime: performance.now(),
        };
        for (const fixtureId of fixtureIds) {
            if (!this.fixtures.has(fixtureId)) {
                console.warn(`[MasterArbiter] Unknown fixture for pattern: ${fixtureId}`);
                continue;
            }
            this.activePatterns.set(fixtureId, config);
        }
        if (this.config.debug) {
            console.log(`[MasterArbiter] Pattern set (${pattern.type}): ${fixtureIds.length} fixtures`);
        }
    }
    /**
     * Clear pattern for fixtures
     */
    clearPattern(fixtureIds) {
        for (const fixtureId of fixtureIds) {
            this.activePatterns.delete(fixtureId);
        }
        if (this.config.debug) {
            console.log(`[MasterArbiter] Pattern cleared: ${fixtureIds.length} fixtures`);
        }
    }
    /**
     * Get pattern for a fixture
     */
    getPattern(fixtureId) {
        return this.activePatterns.get(fixtureId);
    }
    // ═══════════════════════════════════════════════════════════════════════
    // GROUP FORMATION (WAVE 376)
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Set group formation (Radar control)
     * Moves group center while maintaining relative spacing.
     * Calculates offsets from group center on first call.
     */
    setGroupFormation(groupId, fixtureIds, center, fan) {
        // Get or create formation
        let formation = this.activeFormations.get(groupId);
        if (!formation) {
            // First time: calculate offsets from current positions
            const offsets = new Map();
            for (const fixtureId of fixtureIds) {
                // Get current position from manual override or AI
                const manualOverride = this.layer2_manualOverrides.get(fixtureId);
                const titanValues = this.getTitanValuesForFixture(fixtureId);
                const currentPan = manualOverride?.controls.pan ?? titanValues.pan;
                const currentTilt = manualOverride?.controls.tilt ?? titanValues.tilt;
                const panOffset = currentPan - center.pan;
                const tiltOffset = currentTilt - center.tilt;
                offsets.set(fixtureId, { panOffset, tiltOffset });
            }
            formation = {
                fixtureIds,
                center,
                offsets,
                fan,
                timestamp: performance.now(),
            };
            this.activeFormations.set(groupId, formation);
        }
        else {
            // Update center and fan
            formation.center = center;
            formation.fan = fan;
            formation.timestamp = performance.now();
        }
        if (this.config.debug) {
            console.log(`[MasterArbiter] Group formation: ${groupId} center=(${center.pan},${center.tilt}) fan=${fan}`);
        }
    }
    /**
     * Clear group formation
     */
    clearGroupFormation(groupId) {
        this.activeFormations.delete(groupId);
        if (this.config.debug) {
            console.log(`[MasterArbiter] Group formation cleared: ${groupId}`);
        }
    }
    /**
     * Get group formation
     */
    getGroupFormation(groupId) {
        return this.activeFormations.get(groupId);
    }
    // ═══════════════════════════════════════════════════════════════════════
    // MAIN ARBITRATION
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * 🎭 MAIN ARBITRATION FUNCTION
     *
     * Merges all layers and produces final lighting target.
     * Call this every frame to get the output for HAL.
     *
     * @returns Final lighting target ready for HAL
     */
    arbitrate() {
        const now = performance.now();
        this.frameNumber++;
        // Clean up expired effects
        this.cleanupExpiredEffects();
        // 🧹 WAVE 671.5: Silenced fixture processing spam (every 5s)
        // WAVE 380: Debug fixture IDs being processed
        // if (this.frameNumber % 300 === 0) { // Every ~5s at 60fps
        //   console.log(`[MasterArbiter] 🩸 Processing ${this.fixtures.size} fixtures:`, 
        //     Array.from(this.fixtures.keys()).slice(0, 3).join(', '), '...')
        // }
        // Arbitrate each fixture
        const fixtureTargets = [];
        for (const [fixtureId] of this.fixtures) {
            const target = this.arbitrateFixture(fixtureId, now);
            fixtureTargets.push(target);
        }
        // Build global effects state
        const globalEffects = this.buildGlobalEffectsState();
        // Build final output
        const output = {
            fixtures: fixtureTargets,
            globalEffects,
            timestamp: now,
            frameNumber: this.frameNumber,
            _layerActivity: {
                titanActive: this.layer0_titan !== null,
                titanVibeId: this.layer0_titan?.vibeId ?? '',
                consciousnessActive: this.layer1_consciousness?.active ?? false,
                consciousnessStatus: this.layer1_consciousness?.status,
                manualOverrideCount: this.layer2_manualOverrides.size,
                manualFixtureIds: Array.from(this.layer2_manualOverrides.keys()),
                activeEffects: this.layer3_effects.map(e => e.type),
            }
        };
        this.lastOutputTimestamp = now;
        this.emit('output', output);
        return output;
    }
    /**
     * Arbitrate a single fixture
     */
    arbitrateFixture(fixtureId, now) {
        const controlSources = {};
        // LAYER 4: Check blackout first (highest priority)
        if (this.layer4_blackout) {
            return this.createBlackoutTarget(fixtureId, controlSources);
        }
        // Get values from each layer
        const titanValues = this.getTitanValuesForFixture(fixtureId);
        const manualOverride = this.layer2_manualOverrides.get(fixtureId);
        // Merge each channel
        const dimmer = this.mergeChannelForFixture(fixtureId, 'dimmer', titanValues, manualOverride, now, controlSources);
        const red = this.mergeChannelForFixture(fixtureId, 'red', titanValues, manualOverride, now, controlSources);
        const green = this.mergeChannelForFixture(fixtureId, 'green', titanValues, manualOverride, now, controlSources);
        const blue = this.mergeChannelForFixture(fixtureId, 'blue', titanValues, manualOverride, now, controlSources);
        // Get position (with pattern/formation applied)
        const { pan, tilt } = this.getAdjustedPosition(fixtureId, titanValues, manualOverride, now);
        const zoom = this.mergeChannelForFixture(fixtureId, 'zoom', titanValues, manualOverride, now, controlSources);
        const focus = this.mergeChannelForFixture(fixtureId, 'focus', titanValues, manualOverride, now, controlSources);
        // Check if any crossfade is active
        const crossfadeActive = this.isAnyCrossfadeActive(fixtureId);
        const crossfadeProgress = crossfadeActive ? this.getAverageCrossfadeProgress(fixtureId) : 0;
        // Apply Grand Master to dimmer (final step before clamping)
        const dimmerfinal = clampDMX(dimmer * this.grandMaster);
        const target = {
            fixtureId,
            dimmer: dimmerfinal,
            color: {
                r: clampDMX(red),
                g: clampDMX(green),
                b: clampDMX(blue),
            },
            pan: clampDMX(pan),
            tilt: clampDMX(tilt),
            zoom: clampDMX(zoom),
            focus: clampDMX(focus),
            _controlSources: controlSources,
            _crossfadeActive: crossfadeActive,
            _crossfadeProgress: crossfadeProgress,
        };
        return target;
    }
    /**
     * Merge a single channel for a fixture
     */
    mergeChannelForFixture(fixtureId, channel, titanValues, manualOverride, now, controlSources) {
        const values = [];
        // WAVE 380: TEST MODE - Heartbeat artificial cuando no hay Titan
        // Si no hay Titan activo (silencio de Selene), generar pulso suave
        const titanActive = this.layer0_titan !== null;
        if (!titanActive && channel === 'dimmer') {
            // Pulso sinusoidal: 20% base + 10% oscilación = rango 10-30%
            const phase = (now / 3000) * Math.PI * 2; // 3 segundos por ciclo
            const pulse = 51 + Math.sin(phase) * 25; // DMX 26-76 (~10-30%)
            values.push({
                layer: ControlLayer.TITAN_AI,
                value: pulse,
                timestamp: now,
            });
            controlSources[channel] = ControlLayer.TITAN_AI;
            // No agregar otros layers cuando test mode está activo
            return pulse;
        }
        // Layer 0: Titan AI
        const titanValue = titanValues[channel] ?? 0;
        // 🩸 WAVE 380.5: Kickstart REMOVED - data flow confirmed working
        // The system now properly shows colors from vibes
        values.push({
            layer: ControlLayer.TITAN_AI,
            value: titanValue,
            timestamp: this.layer0_titan?.timestamp ?? now,
        });
        // Layer 1: Consciousness (CORE 3 - placeholder)
        // Will be implemented when consciousness is connected
        // ═══════════════════════════════════════════════════════════════════════
        // 🔧 WAVE 440.5: MANUAL OVERRIDE = ABSOLUTE PRIORITY
        // 
        // The previous LTP (Latest Takes Precedence) strategy was WRONG for manual.
        // Titan updates every frame with a new timestamp, so it always won.
        // 
        // FIX: Manual overrides WIN unconditionally. No timestamp comparison.
        // When user grabs control, they KEEP it until they release.
        // ═══════════════════════════════════════════════════════════════════════
        if (manualOverride && manualOverride.overrideChannels.includes(channel)) {
            const manualValue = this.getManualChannelValue(manualOverride, channel);
            controlSources[channel] = ControlLayer.MANUAL;
            // DIRECT RETURN - Manual wins, skip merge entirely
            return manualValue;
        }
        // Layer 3: Effects
        const effectValue = this.getEffectValueForChannel(fixtureId, channel, now);
        if (effectValue !== null) {
            values.push({
                layer: ControlLayer.EFFECTS,
                value: effectValue,
                timestamp: now,
            });
        }
        // Check if crossfade is active for this channel
        if (this.crossfadeEngine.isTransitioning(fixtureId, channel)) {
            // Get interpolated value from crossfade
            const crossfadedValue = this.crossfadeEngine.getCurrentValue(fixtureId, channel, titanValue, titanValue);
            controlSources[channel] = ControlLayer.TITAN_AI; // Transitioning back to AI
            return crossfadedValue;
        }
        // Merge values using channel's strategy
        const result = mergeChannel(channel, values);
        controlSources[channel] = result.source;
        return result.value;
    }
    // ═══════════════════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Calculate pattern offset (Circle, Eight, Sweep)
     * Returns pan/tilt offset as fractions (-1 to +1)
     */
    calculatePatternOffset(pattern, now) {
        const elapsedMs = now - pattern.startTime;
        const cycleDurationMs = (1000 / pattern.speed); // speed = cycles per second
        const phase = (elapsedMs % cycleDurationMs) / cycleDurationMs;
        const t = phase * 2 * Math.PI; // 0 to 2π
        const amplitude = pattern.size * 0.3; // 30% max swing of range
        let panOffset = 0;
        let tiltOffset = 0;
        switch (pattern.type) {
            case 'circle':
                // Circle: x = cos(t), y = sin(t)
                panOffset = Math.cos(t) * amplitude;
                tiltOffset = Math.sin(t) * amplitude;
                break;
            case 'eight':
                // Eight: x = sin(t), y = sin(2t) / 2
                panOffset = Math.sin(t) * amplitude;
                tiltOffset = (Math.sin(t * 2) / 2) * amplitude;
                break;
            case 'sweep':
                // Sweep: x = sin(t), y = 0
                panOffset = Math.sin(t) * amplitude;
                tiltOffset = 0;
                break;
        }
        return { panOffset, tiltOffset };
    }
    /**
     * Get adjusted position with patterns and formations applied
     */
    getAdjustedPosition(fixtureId, titanValues, manualOverride, now) {
        // Get base position
        const basePan = manualOverride?.controls.pan ?? titanValues.pan;
        const baseTilt = manualOverride?.controls.tilt ?? titanValues.tilt;
        // Apply pattern if active
        const pattern = this.activePatterns.get(fixtureId);
        if (pattern) {
            const offset = this.calculatePatternOffset(pattern, now);
            const adjustedPan = basePan + (offset.panOffset * 65535);
            const adjustedTilt = baseTilt + (offset.tiltOffset * 65535);
            return { pan: adjustedPan, tilt: adjustedTilt };
        }
        // Apply group formation if active
        for (const [groupId, formation] of this.activeFormations) {
            if (!formation.fixtureIds.includes(fixtureId))
                continue;
            const offset = formation.offsets.get(fixtureId);
            if (!offset)
                continue;
            // Apply fan multiplier to offsets
            const fanAdjustedPan = formation.center.pan + (offset.panOffset * formation.fan);
            const fanAdjustedTilt = formation.center.tilt + (offset.tiltOffset * formation.fan);
            return { pan: fanAdjustedPan, tilt: fanAdjustedTilt };
        }
        // No pattern or formation: return base position
        return { pan: basePan, tilt: baseTilt };
    }
    /**
     * 🩸 WAVE 382: Get Titan values for a specific fixture
     * NOW WITH: Zone-based color mapping + Individual mover movement
     */
    getTitanValuesForFixture(fixtureId) {
        const defaults = {
            dimmer: 0,
            red: 0,
            green: 0,
            blue: 0,
            white: 0,
            pan: 128,
            tilt: 128,
            zoom: 128,
            focus: 128,
            gobo: 0,
            prism: 0,
        };
        if (!this.layer0_titan?.intent)
            return defaults;
        const intent = this.layer0_titan.intent;
        const fixture = this.fixtures.get(fixtureId);
        // ═══════════════════════════════════════════════════════════════════════
        // 🔦 WAVE 411 FIX: OPTICS HANDOFF
        // Si Titan envía óptica, úsala. Si no, usa el default (128).
        // ═══════════════════════════════════════════════════════════════════════
        if (intent.optics) {
            defaults.zoom = intent.optics.zoom ?? 128;
            defaults.focus = intent.optics.focus ?? 128;
            // Si tuvieras iris, también aquí:
            // defaults.iris = intent.optics.iris ?? 0
        }
        // ═══════════════════════════════════════════════════════════════════════
        // 🧱 WAVE 410: DEMOLICIÓN DEL "MURO DE LUZ"
        // Use zone-specific intensity instead of flat masterIntensity
        // ═══════════════════════════════════════════════════════════════════════
        const zone = (fixture?.zone || 'UNASSIGNED').toLowerCase();
        const fixtureType = (fixture?.type || 'generic').toLowerCase();
        // Map fixture zone to intent zone (handle legacy and new naming)
        let intentZone = 'front'; // default
        if (zone.includes('front')) {
            intentZone = 'front';
        }
        else if (zone.includes('back')) {
            intentZone = 'back';
        }
        else if (zone.includes('left')) {
            intentZone = 'left';
        }
        else if (zone.includes('right')) {
            intentZone = 'right';
        }
        else if (zone.includes('ambient') || zone === 'unassigned') {
            intentZone = 'ambient';
        }
        // � FIX: Get zone-specific intensity, fallback to masterIntensity
        const zoneIntent = intent.zones?.[intentZone];
        const zoneIntensity = zoneIntent?.intensity ?? intent.masterIntensity;
        defaults.dimmer = zoneIntensity * 255;
        // ═══════════════════════════════════════════════════════════════════════
        // 🎨 WAVE 382: ZONE-BASED COLOR MAPPING (No more monochrome!)
        // NOW WITH: Zone-based paletteRole mapping
        // ═══════════════════════════════════════════════════════════════════════
        const zoneUpper = zone.toUpperCase();
        // 🎨 WAVE 410: Determine which palette color to use based on zone + paletteRole
        let selectedColor = intent.palette?.primary; // Default fallback
        const paletteRole = zoneIntent?.paletteRole || 'primary'; // Get role from intent
        // Map paletteRole to actual palette color
        switch (paletteRole) {
            case 'primary':
                selectedColor = intent.palette?.primary;
                break;
            case 'secondary':
                selectedColor = intent.palette?.secondary || intent.palette?.primary;
                break;
            case 'accent':
                selectedColor = intent.palette?.accent || intent.palette?.secondary || intent.palette?.primary;
                break;
            case 'ambient':
                // 🎨 WAVE 412 FIX: Use palette.ambient directly (SeleneLux provides 4-color palette)
                // ANTES: Darkened primary (legacy assumption: ambient = dark version of primary)
                // AHORA: Use ambient color from palette (e.g., Cyan in Complementary scheme)
                selectedColor = intent.palette?.ambient || intent.palette?.primary;
                break;
            default:
                selectedColor = intent.palette?.primary;
        }
        // Legacy zone-based fallback (if paletteRole not set)
        if (!zoneIntent?.paletteRole) {
            if (zoneUpper.includes('FRONT')) {
                // 🟡 FRONT: Warm wash - PRIMARY color
                selectedColor = intent.palette?.primary;
            }
            else if (zoneUpper.includes('BACK')) {
                // � BACK: Cool contrast - ACCENT color (NOT secondary!)
                selectedColor = intent.palette?.accent || intent.palette?.secondary || intent.palette?.primary;
            }
            else if (zoneUpper.includes('LEFT') || zoneUpper.includes('RIGHT')) {
                // 🟢 SIDES: Secondary
                selectedColor = intent.palette?.secondary || intent.palette?.primary;
            }
            else if (zoneUpper.includes('MOVING') || this.isMovingFixture(fixture)) {
                // 🟣 MOVERS: Dramatic accent - ACCENT or SECONDARY
                selectedColor = intent.palette?.accent || intent.palette?.secondary || intent.palette?.primary;
            }
        }
        // Convert selected HSL to RGB
        if (selectedColor) {
            const rgb = this.hslToRgb(selectedColor);
            defaults.red = rgb.r;
            defaults.green = rgb.g;
            defaults.blue = rgb.b;
        }
        // ═══════════════════════════════════════════════════════════════════════
        // 🎯 WAVE 382: INDIVIDUAL MOVER MOVEMENT (No more Borg convergence!)
        // ═══════════════════════════════════════════════════════════════════════
        if (intent.movement && fixture) {
            const isMover = this.isMovingFixture(fixture);
            if (isMover && this.moverCount > 1) {
                // Calculate this mover's index among all movers
                const moverIndex = this.getMoverIndex(fixtureId);
                // Calculate spread offset based on mover index
                // Formula: Creates a fan pattern centered around the base position
                const spreadFactor = 0.15; // How much to spread (0.15 = 15% of full range per mover)
                const totalSpread = spreadFactor * (this.moverCount - 1);
                const offset = (moverIndex * spreadFactor) - (totalSpread / 2);
                // Apply offset to base position, clamped to 0-1 range
                const basePan = intent.movement.centerX;
                const baseTilt = intent.movement.centerY;
                // Pan spreads horizontally, Tilt stays mostly centered with slight variation
                const finalPan = Math.max(0, Math.min(1, basePan + offset));
                const finalTilt = Math.max(0, Math.min(1, baseTilt + (offset * 0.3))); // Less vertical spread
                defaults.pan = finalPan * 255;
                defaults.tilt = finalTilt * 255;
            }
            else {
                // Single mover or non-mover: use base position
                defaults.pan = intent.movement.centerX * 255;
                defaults.tilt = intent.movement.centerY * 255;
            }
        }
        return defaults;
    }
    /**
     * 🩸 WAVE 382: Get mover index for spread calculation
     */
    getMoverIndex(fixtureId) {
        let moverIndex = 0;
        for (const [id, fixture] of this.fixtures) {
            if (this.isMovingFixture(fixture)) {
                if (id === fixtureId)
                    return moverIndex;
                moverIndex++;
            }
        }
        return 0; // Fallback
    }
    /**
     * Get manual value for a specific channel
     */
    getManualChannelValue(override, channel) {
        const controls = override.controls;
        switch (channel) {
            case 'dimmer': return controls.dimmer ?? 0;
            case 'red': return controls.red ?? 0;
            case 'green': return controls.green ?? 0;
            case 'blue': return controls.blue ?? 0;
            case 'white': return controls.white ?? 0;
            case 'pan': return controls.pan ?? 128;
            case 'tilt': return controls.tilt ?? 128;
            case 'zoom': return controls.zoom ?? 128;
            case 'focus': return controls.focus ?? 128;
            default: return 0;
        }
    }
    /**
     * Get effect value for a channel (if any effect affects it)
     */
    getEffectValueForChannel(fixtureId, channel, now) {
        for (const effect of this.layer3_effects) {
            // Check if effect applies to this fixture
            if (effect.fixtureIds.length > 0 && !effect.fixtureIds.includes(fixtureId)) {
                continue;
            }
            // Apply effect based on type
            switch (effect.type) {
                case 'strobe':
                    if (channel === 'dimmer') {
                        const strobeHz = effect.params.speed ?? 10;
                        const period = 1000 / strobeHz;
                        const phase = (now - effect.startTime) % period;
                        return phase < period / 2 ? 255 * effect.intensity : 0;
                    }
                    break;
                case 'blinder':
                    if (channel === 'dimmer')
                        return 255 * effect.intensity;
                    if (channel === 'red')
                        return 255;
                    if (channel === 'green')
                        return 255;
                    if (channel === 'blue')
                        return 255;
                    break;
                case 'flash':
                    if (channel === 'dimmer') {
                        const elapsed = now - effect.startTime;
                        const progress = elapsed / effect.durationMs;
                        return 255 * effect.intensity * (1 - progress); // Decay
                    }
                    break;
                case 'freeze':
                    // Freeze returns null to indicate "keep current value"
                    // This is handled by not including it in merge
                    return null;
            }
        }
        return null;
    }
    /**
     * Create blackout target
     */
    createBlackoutTarget(fixtureId, controlSources) {
        // All channels sourced from BLACKOUT layer
        const channels = ['dimmer', 'red', 'green', 'blue', 'pan', 'tilt', 'zoom', 'focus'];
        for (const ch of channels) {
            controlSources[ch] = ControlLayer.BLACKOUT;
        }
        return {
            fixtureId,
            dimmer: 0,
            color: { r: 0, g: 0, b: 0 },
            pan: 128,
            tilt: 128,
            zoom: 128,
            focus: 128,
            _controlSources: controlSources,
            _crossfadeActive: false,
            _crossfadeProgress: 0,
        };
    }
    /**
     * Build global effects state
     */
    buildGlobalEffectsState() {
        return {
            strobeActive: this.layer3_effects.some(e => e.type === 'strobe'),
            strobeSpeed: this.layer3_effects.find(e => e.type === 'strobe')?.params.speed ?? 0,
            blinderActive: this.layer3_effects.some(e => e.type === 'blinder'),
            blinderIntensity: this.layer3_effects.find(e => e.type === 'blinder')?.intensity ?? 0,
            blackoutActive: this.layer4_blackout,
            freezeActive: this.layer3_effects.some(e => e.type === 'freeze'),
        };
    }
    /**
     * Check if any crossfade is active for a fixture
     */
    isAnyCrossfadeActive(fixtureId) {
        const channels = ['dimmer', 'red', 'green', 'blue', 'pan', 'tilt', 'zoom', 'focus'];
        return channels.some(ch => this.crossfadeEngine.isTransitioning(fixtureId, ch));
    }
    /**
     * Get average crossfade progress for a fixture
     */
    getAverageCrossfadeProgress(fixtureId) {
        const channels = ['dimmer', 'red', 'green', 'blue', 'pan', 'tilt', 'zoom', 'focus'];
        let total = 0;
        let count = 0;
        for (const ch of channels) {
            const state = this.crossfadeEngine.getTransitionState(fixtureId, ch);
            if (state) {
                total += state.progress;
                count++;
            }
        }
        return count > 0 ? total / count : 0;
    }
    /**
     * HSL to RGB conversion
     * 🩸 WAVE 380 FIX: HSL values are already normalized (0-1), don't divide by 360!
     */
    hslToRgb(hsl) {
        const { h, s, l } = hsl;
        // 🩸 WAVE 380: h is already 0-1 from ColorPalette (HSLColor interface)
        // Don't divide by 360 - that was destroying all colors to red!
        const hNorm = h;
        const sNorm = s;
        const lNorm = l;
        let r, g, b;
        if (sNorm === 0) {
            r = g = b = lNorm;
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
            const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
            const p = 2 * lNorm - q;
            r = hue2rgb(p, q, hNorm + 1 / 3);
            g = hue2rgb(p, q, hNorm);
            b = hue2rgb(p, q, hNorm - 1 / 3);
        }
        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255),
        };
    }
    // ═══════════════════════════════════════════════════════════════════════
    // STATUS & DEBUG
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Get arbiter status for debugging/UI
     */
    getStatus() {
        return {
            fixtureCount: this.fixtures.size,
            frameNumber: this.frameNumber,
            blackoutActive: this.layer4_blackout,
            titanActive: this.layer0_titan !== null,
            titanVibeId: this.layer0_titan?.vibeId ?? null,
            consciousnessActive: this.layer1_consciousness?.active ?? false,
            consciousnessStatus: this.layer1_consciousness?.status ?? null,
            manualOverrideCount: this.layer2_manualOverrides.size,
            manualFixtureIds: Array.from(this.layer2_manualOverrides.keys()),
            activeEffects: this.layer3_effects.map(e => e.type),
            activeCrossfades: this.crossfadeEngine.getActiveCount(),
        };
    }
    /**
     * Reset arbiter state
     */
    reset() {
        this.layer0_titan = null;
        this.layer1_consciousness = null;
        this.layer2_manualOverrides.clear();
        this.layer3_effects = [];
        this.layer4_blackout = false;
        this.crossfadeEngine.clearAll();
        this.frameNumber = 0;
        if (this.config.debug) {
            console.log('[MasterArbiter] Reset complete');
        }
    }
    /**
     * Update configuration
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        this.crossfadeEngine.setDefaultDuration(this.config.defaultCrossfadeMs);
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Global MasterArbiter instance
 * Use this for production - single source of truth.
 */
export const masterArbiter = new MasterArbiter();

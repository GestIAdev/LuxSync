/**
 * 🏛️ WAVE 205: PHYSICS ENGINE - GLOBAL PHYSICS ONLY
 *
 * ⚠️ ADVERTENCIA WAVE 290.3: Este es un motor de FISICAS GLOBALES.
 * NO debe contener logica especifica de ningun vibe (Techno, Latino, etc).
 *
 * Cada vibe tiene su propio motor de fisicas:
 * - TechnoStereoPhysics.ts → Fisicas especificas de Techno
 * - LatinoStereoPhysics.ts → Fisicas especificas de Latino (Salsa, Cumbia, etc)
 *
 * RESPONSABILIDADES GLOBALES:
 * - Decay buffers management (per-fixture state)
 * - Asymmetric attack/decay physics genericas (PAR vs MOVER)
 * - Soft knee clipping to eliminate noise
 *
 * DEPRECATED:
 * - calculateMoverTarget() → Migrado a TechnoStereoPhysics (WAVE 290.3)
 *
 * DOES NOT:
 * - Analyze audio (that's Brain's job)
 * - Know about specific fixtures (that's HAL's job)
 * - Calculate colors (that's Engine's job)
 * - Apply vibe-specific physics (that's XxxStereoPhysics.ts job)
 */
// ═══════════════════════════════════════════════════════════════════════════
// PHYSICS ENGINE CLASS
// ═══════════════════════════════════════════════════════════════════════════
export class PhysicsEngine {
    constructor() {
        // Internal state
        this.decayBuffers = new Map();
        this.moverHysteresisState = new Map();
        this.moverIntensityBuffer = new Map(); // 🔧 WAVE 280: Hysteresis buffer
        // Physics constants (from WAVE 109)
        this.SMOOTHING_DECAY = 0.75; // 25% decay per frame
        // 🔧 WAVE 280.5: HYSTERESIS CONSTANTS - TECHNO CLUB TUNING
        // Más agresivo que WAVE 280 original, pero sin parpadeo
        this.MOVER_HYSTERESIS_MARGIN = 0.06; // 6% gap (was 12%) - permite apagarse más fácil
        this.MOVER_INTENSITY_SMOOTHING = 0.4; // 40% previous (was 70%) - más contraste
        this.MOVER_MIN_STABLE_FRAMES = 2; // 2 frames (was 3) - respuesta más rápida
        this.moverStabilityCounter = new Map(); // Frame counter per mover
        // WAVE 2098: Boot silence
    }
    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Apply physics to a target value with decay buffer tracking.
     * Uses asymmetric attack (instant) and decay (gradual).
     *
     * @param key - Unique identifier for the fixture+zone
     * @param targetValue - Target intensity (0-1)
     * @param decaySpeed - Speed from preset (1=instant, 10=liquid)
     * @param zoneType - PAR for flash physics, MOVER for inertia physics
     */
    applyDecayWithPhysics(key, targetValue, decaySpeed, zoneType) {
        const prevValue = this.decayBuffers.get(key) ?? 0;
        const newValue = this.applyPhysics(targetValue, prevValue, decaySpeed, zoneType);
        this.decayBuffers.set(key, newValue);
        return newValue;
    }
    /**
     * Legacy decay function for compatibility.
     * Uses multiplicative decay instead of linear.
     */
    applyDecay(key, targetValue, decayRate) {
        const prevValue = this.decayBuffers.get(key) ?? 0;
        let newValue;
        if (targetValue > prevValue) {
            // Attack: instant rise
            newValue = targetValue;
        }
        else {
            // Decay: multiplicative falloff
            newValue = Math.max(prevValue * decayRate, targetValue);
        }
        this.decayBuffers.set(key, newValue);
        return newValue;
    }
    /**
     * Calculate mover target with hysteresis.
     *
     * @deprecated WAVE 290.3: Esta funcion ha sido migrada a TechnoStereoPhysics.
     * Para Techno, usar TechnoStereoPhysics.apply() que retorna moverIntensity.
     * Para Latino, usar LatinoStereoPhysics.apply() que maneja movers con MID.
     *
     * Se mantiene por compatibilidad pero sera eliminada en futuras versiones.
     */
    calculateMoverTarget(input) {
        console.warn('[PhysicsEngine] DEPRECATED: calculateMoverTarget() - Use TechnoStereoPhysics.apply() instead');
        const { moverKey, // 🔧 WAVE 280: Use unique key from caller
        melodyThreshold, rawMid, rawBass, rawTreble, moverState, isRealSilence, isAGCTrap } = input;
        // A. SILENCIO TOTAL o AGC TRAP: Reset completo
        if (isRealSilence || isAGCTrap) {
            this.moverIntensityBuffer.set(moverKey, 0);
            this.moverStabilityCounter.set(moverKey, 0);
            return { intensity: 0, newState: false };
        }
        // 🔊 WAVE 282: VITAMINAS PARA MOVERS - Compensar compresión MP3/YouTube/Spotify
        // El treble es la banda más afectada por la compresión de audio
        // 1.4× era insuficiente, 2.2× da presencia real a voces y melodías
        const TREBLE_VITAMIN = 2.2; // Was 1.4 - ahora compensamos compresión agresiva
        const audioSignal = rawTreble * TREBLE_VITAMIN;
        // 🔧 WAVE 280: Get previous intensity for smoothing
        const prevIntensity = this.moverIntensityBuffer.get(moverKey) ?? 0;
        const stabilityFrames = this.moverStabilityCounter.get(moverKey) ?? 0;
        // 🗡️ WAVE 281: THRESHOLDS AGRESIVOS PARA TECHNO - Solo picos significativos
        const ACTIVATION_THRESHOLD = 0.15; // Was 0.10 - ahora solo caja y picos fuertes
        const DEACTIVATION_THRESHOLD = ACTIVATION_THRESHOLD - this.MOVER_HYSTERESIS_MARGIN;
        const effectiveDeactivation = Math.max(0.08, DEACTIVATION_THRESHOLD); // Minimum 8% para apagar
        let rawTarget = 0;
        let shouldBeOn = moverState; // Start with previous state
        // B. ACTIVATION LOGIC with hysteresis
        if (audioSignal > ACTIVATION_THRESHOLD) {
            // Above activation threshold - definitely ON
            shouldBeOn = true;
            // 🗡️ WAVE 281: Map más agresivo - 0.15 → 0.25 (mínimo visible), 1.0 → 1.0
            rawTarget = 0.25 + (audioSignal - ACTIVATION_THRESHOLD) * 0.75 / (1 - ACTIVATION_THRESHOLD);
        }
        else if (audioSignal > effectiveDeactivation && moverState) {
            // �️ WAVE 281: Decay BRUTAL - 0.4× para máximo contraste
            shouldBeOn = true;
            rawTarget = prevIntensity * 0.4;
        }
        else {
            // Below deactivation threshold - should turn off
            shouldBeOn = false;
            rawTarget = 0;
        }
        // C. � WAVE 280: STABILITY COUNTER - Prevent rapid state flipping
        let finalState = moverState;
        if (shouldBeOn !== moverState) {
            // State wants to change - check stability
            if (stabilityFrames >= this.MOVER_MIN_STABLE_FRAMES) {
                // Enough stable frames - allow state change
                finalState = shouldBeOn;
                this.moverStabilityCounter.set(moverKey, 0);
            }
            else {
                // Not enough stable frames - increment and keep old state
                this.moverStabilityCounter.set(moverKey, stabilityFrames + 1);
                finalState = moverState;
                // If keeping ON state, maintain some intensity
                if (moverState && rawTarget === 0) {
                    rawTarget = prevIntensity * 0.7; // Decay while waiting
                }
            }
        }
        else {
            // State is stable - reset counter
            this.moverStabilityCounter.set(moverKey, 0);
        }
        // D. 🔧 WAVE 280: SMOOTH TRANSITIONS - No instant jumps
        let smoothedIntensity;
        if (rawTarget > prevIntensity) {
            // 🗡️ WAVE 281: Attack más instantáneo - 85% respuesta (era 70%)
            smoothedIntensity = prevIntensity + (rawTarget - prevIntensity) * 0.85;
        }
        else {
            // Decay: Use smoothing constant
            smoothedIntensity = prevIntensity * this.MOVER_INTENSITY_SMOOTHING + rawTarget * (1 - this.MOVER_INTENSITY_SMOOTHING);
        }
        // E. 🗡️ WAVE 281: NOISE GATE ALTO - Si no es visible, mejor apagar
        // Movers al 15% no se ven en la vida real, solo desperdician energía
        const VISIBILITY_FLOOR = 0.18; // Was 0.05 - ahora 18% mínimo
        const cleanedIntensity = smoothedIntensity < VISIBILITY_FLOOR ? 0 : Math.min(1, smoothedIntensity);
        // F. Update buffer for next frame
        this.moverIntensityBuffer.set(moverKey, cleanedIntensity);
        // G. 🔧 WAVE 280 FIX: Ensure state and intensity are CONSISTENT
        // If intensity is 0, state MUST be false
        const consistentState = cleanedIntensity > 0 ? finalState : false;
        return {
            intensity: cleanedIntensity,
            newState: consistentState
        };
    }
    /**
     * Get mover hysteresis state.
     */
    getMoverHysteresisState(key) {
        return this.moverHysteresisState.get(key) ?? false;
    }
    /**
     * Set mover hysteresis state.
     */
    setMoverHysteresisState(key, state) {
        this.moverHysteresisState.set(key, state);
    }
    /**
     * Soft knee clipper to eliminate noise.
     * Values below 0.15 are considered noise.
     */
    applySoftKneeClipper(value) {
        // Noise gate: below 0.15 = 0
        if (value < 0.15)
            return 0;
        // Soft knee: 0.15-0.25 range gets compressed
        if (value < 0.25) {
            // Remap 0.15-0.25 to 0-0.25 with soft curve
            const normalized = (value - 0.15) / 0.10;
            return normalized * 0.25;
        }
        return value;
    }
    /**
     * Reset all state (for system restart).
     */
    reset() {
        this.decayBuffers.clear();
        this.moverHysteresisState.clear();
        console.log('[PhysicsEngine] 🔄 State reset');
    }
    /**
     * Get current buffer value for debugging.
     */
    getBufferValue(key) {
        return this.decayBuffers.get(key) ?? 0;
    }
    /**
     * Force set a buffer value (for blackout).
     */
    setBufferValue(key, value) {
        this.decayBuffers.set(key, value);
    }
    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE METHODS
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Core physics calculation (WAVE 109: Asymmetric Physics).
     * Attack is always instant, decay varies by zone type.
     *
     * 🗡️ WAVE 277: EXPONENTIAL DECAY - Katana cuts, not broom sweeps
     * Multiplicative decay for aggressive falloff + noise gate
     */
    applyPhysics(target, current, decaySpeed, zoneType) {
        // A. ATTACK (Subida): Siempre instantáneo para mantener sync musical
        if (target >= current) {
            return target;
        }
        // B. DECAY (Bajada): 🗡️ WAVE 277 - EXPONENTIAL (multiplicativo)
        // El usuario pidió: "decay 0.75 en vez de 0.9"
        // Exponencial = cada frame mantiene un % del valor anterior
        let decayFactor;
        if (zoneType === 'PAR') {
            // FLASH PHYSICS: Corte agresivo para PARs
            // decaySpeed 1 → factor 0.65 (corte brutal)
            // decaySpeed 10 → factor 0.92 (respiro Chill)
            decayFactor = 0.65 + (decaySpeed - 1) * 0.03; // Range: 0.65 → 0.92
        }
        else {
            // MOVER PHYSICS: 🗡️ WAVE 277 - Agresivo como el usuario pidió (0.75)
            // decaySpeed 1 → factor 0.70 (katana)
            // decaySpeed 10 → factor 0.88 (sable)
            decayFactor = 0.70 + (decaySpeed - 1) * 0.02; // Range: 0.70 → 0.88
        }
        // Aplicar Exponential Decay (multiplicación, no resta)
        let nextValue = current * decayFactor;
        // 🗡️ WAVE 277: NOISE GATE - Si está muy bajo, cortar a CERO
        // "Si la música calla, la luz muere"
        if (nextValue < 0.02) {
            nextValue = 0;
        }
        return Math.max(0, nextValue);
    }
    // ═══════════════════════════════════════════════════════════════════════
    // CLEANUP
    // ═══════════════════════════════════════════════════════════════════════
    destroy() {
        this.reset();
        console.log('[PhysicsEngine] 🛑 Destroyed');
    }
}
// Export singleton for easy use (optional)
export const physicsEngine = new PhysicsEngine();

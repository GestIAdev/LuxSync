/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 2435: LiquidEngineBase — Clase Abstracta del Omni-Liquid Engine
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Toda la matemática pesada:
 *  - 6 instancias de LiquidEnvelope
 *  - MorphFactor calculation
 *  - Silence / AGC rebound
 *  - Kick edge detection + veto
 *  - Transient Shaper (WAVE 2427)
 *  - Strobe logic
 *  - Sidechain Guillotine
 *  - Apocalypse Mode
 *
 * Las clases hijas (LiquidEngine41, LiquidEngine71) solo implementan
 * routeZones() — el mapeo de bandas procesadas a zonas de salida.
 *
 * WAVE 2435: layout '4.1'|'7.1' inyectado en constructor.
 * fuseProfileFor41() fusiona overrides en setProfile().
 * El hot-path (applyBands, process) es layout-agnostic.
 *
 * @module hal/physics/LiquidEngineBase
 * @version WAVE 2435 — OMNILIQUID OVERRIDES
 */
import { LiquidEnvelope } from './LiquidEnvelope';
import { TECHNO_PROFILE } from './profiles/techno';
// ═══════════════════════════════════════════════════════════════════════════
// 🩸 WAVE 7749.27: LASER DOMAIN — Fallback envelope configs for Air & Floor.
// Used when a profile does not define envelopeAir / envelopeFloor.
// These give the zones their "light-saber" identity: zero-attack, fast decay,
// high gate, high crush. See WAVE 7749.26 audit for the kinematic rationale.
// ═══════════════════════════════════════════════════════════════════════════
const DEFAULT_ENVELOPE_AIR = {
    name: 'Air (Aerial Laser)',
    gateOn: 0.35, // High — only sharp HF transients pass (hi-hats blocked)
    boost: 4.0, // Compensate for high gate
    crushExponent: 2.5, // Convex — silence stays black, only peaks ignite
    decayBase: 0.08, // Fast cut ~45-65ms — the saber retracts
    decayRange: 0.03, // Narrow morph range — laser identity consistent across genres
    maxIntensity: 1.0, // Full brightness — lasers are binary
    squelchBase: 0.02, // Minimal — let the gate discriminate
    squelchSlope: 0.0, // No morph-dependent squelch
    ghostCap: 0.0, // Absolute black between stabs
    gateMargin: 0.02, // Tight — fast response
    riseRate: 1.0, // Instantaneous attack — zero-attack is the laser identity
    attackSlopeMin: 0.02, // Require minimum velocity — filters out slow swells
};
const DEFAULT_ENVELOPE_FLOOR = {
    name: 'Floor (Ground Sweep Laser)',
    gateOn: 0.12, // Moderate — above spectralFlux baseline (~0.044-0.076), below arpeggio onsets (0.15-0.40)
    boost: 3.0, // Compensate for moderate gate
    crushExponent: 2.0, // Convex — only onset spikes sweep the floor
    decayBase: 0.12, // Fast sweep ~70ms — tiny trail, faster than kick (0.08)
    decayRange: 0.05, // Narrow — consistent sweep speed
    maxIntensity: 0.90, // Near-full — slightly dimmer than air (floor lasers less blinding)
    squelchBase: 0.04, // Low — let gate + crush discriminate
    squelchSlope: 0.0, // No morph-dependent squelch
    ghostCap: 0.0, // Absolute black between sweeps
    gateMargin: 0.015, // Tight — fast response to onsets
    riseRate: 1.0, // Instantaneous attack — zero-attack laser identity
    attackSlopeMin: 0.0, // No minimum velocity — spectralFlux already encodes velocity
};
// ═══════════════════════════════════════════════════════════════════════════
// AGC REBOUND — Constante de hardware, invariante entre perfiles
// ═══════════════════════════════════════════════════════════════════════════
const RECOVERY_DURATION = 250;
/**
 * Fusiona un envelope config base con overrides parciales.
 * Retorna el config original si no hay overrides para este bloque.
 */
function fuseEnvelope(base, override) {
    if (!override)
        return base;
    return { ...base, ...override };
}
/**
 * Fusiona un perfil base (7.1) con sus overrides para layout 4.1.
 * Retorna un ILiquidProfile NUEVO — el original queda intacto.
 *
 * Complejidad: O(n) donde n = campos del perfil (~40) — constante.
 * Se llama UNA VEZ en setProfile(). NUNCA en el hot-path.
 */
function fuseProfileFor41(base) {
    const ov = base.overrides41;
    if (!ov)
        return base;
    return {
        ...base,
        // Fusión de envelopes
        envelopeSubBass: fuseEnvelope(base.envelopeSubBass, ov.envelopeSubBass),
        envelopeKick: fuseEnvelope(base.envelopeKick, ov.envelopeKick),
        envelopeVocal: fuseEnvelope(base.envelopeVocal, ov.envelopeVocal),
        envelopeSnare: fuseEnvelope(base.envelopeSnare, ov.envelopeSnare),
        envelopeHighMid: fuseEnvelope(base.envelopeHighMid, ov.envelopeHighMid),
        envelopeTreble: fuseEnvelope(base.envelopeTreble, ov.envelopeTreble),
        // Fusión de escalares: override si presente, base si ausente
        percGate: ov.percGate ?? base.percGate,
        percBoost: ov.percBoost ?? base.percBoost,
        percExponent: ov.percExponent ?? base.percExponent,
        percMidSubtract: ov.percMidSubtract ?? base.percMidSubtract,
        backLLowMidWeight: ov.backLLowMidWeight ?? base.backLLowMidWeight,
        backLMidWeight: ov.backLMidWeight ?? base.backLMidWeight,
        backLTrebleSub: ov.backLTrebleSub ?? base.backLTrebleSub,
        backLBassSub: ov.backLBassSub ?? base.backLBassSub,
        moverLTonalThreshold: ov.moverLTonalThreshold ?? base.moverLTonalThreshold,
        moverLHighMidWeight: ov.moverLHighMidWeight ?? base.moverLHighMidWeight,
        moverLTrebleWeight: ov.moverLTrebleWeight ?? base.moverLTrebleWeight,
        moverLMidWeight: ov.moverLMidWeight ?? base.moverLMidWeight,
        bassSubtractBase: ov.bassSubtractBase ?? base.bassSubtractBase,
        bassSubtractRange: ov.bassSubtractRange ?? base.bassSubtractRange,
        moverRTrebleSub: ov.moverRTrebleSub ?? base.moverRTrebleSub,
        sidechainThreshold: ov.sidechainThreshold ?? base.sidechainThreshold,
        sidechainDepth: ov.sidechainDepth ?? base.sidechainDepth,
        snareSidechainDepth: ov.snareSidechainDepth ?? base.snareSidechainDepth,
        frontKickSidechainThreshold: ov.frontKickSidechainThreshold ?? base.frontKickSidechainThreshold,
        auraCapBase: ov.auraCapBase ?? base.auraCapBase,
        auraCapExponent: ov.auraCapExponent ?? base.auraCapExponent,
        layout41Strategy: ov.layout41Strategy ?? base.layout41Strategy,
        // WAVE 7749: Tonality Veto + Sustain Choke — fusionar overrides41 al perfil efectivo
        snareVetoFlatnessFloor: ov.snareVetoFlatnessFloor ?? base.snareVetoFlatnessFloor,
        snareVetoFlatnessKnee: ov.snareVetoFlatnessKnee ?? base.snareVetoFlatnessKnee,
        snareVetoWnsFloor: ov.snareVetoWnsFloor ?? base.snareVetoWnsFloor,
        snareVetoWnsKnee: ov.snareVetoWnsKnee ?? base.snareVetoWnsKnee,
        snareVetoFluxFloor: ov.snareVetoFluxFloor ?? base.snareVetoFluxFloor,
        snareVetoFluxKnee: ov.snareVetoFluxKnee ?? base.snareVetoFluxKnee,
        snareChokeFrames: ov.snareChokeFrames ?? base.snareChokeFrames,
        snareChokeRate: ov.snareChokeRate ?? base.snareChokeRate,
        // WAVE 7749.7: Impulse decay — fusionar al perfil efectivo
        snareImpulseDecay: ov.snareImpulseDecay ?? base.snareImpulseDecay,
    };
}
// ═══════════════════════════════════════════════════════════════════════════
// ABSTRACT BASE
// ═══════════════════════════════════════════════════════════════════════════
export class LiquidEngineBase {
    // ─────────────────────────────────────────────────────────────────────
    // WAVE 9001: PASSIVE TELEMETRY ACCESSORS — read-only probes for observers.
    // These expose the internal envelope state AFTER applyBands() has run,
    // allowing a passive observer to collect metrics without being a motor.
    // ─────────────────────────────────────────────────────────────────────
    getEnvelopeProbes() {
        return {
            kick: this.envKick.probe,
            snare: this.envSnare.probe,
            highMid: this.envHighMid.probe,
            subBass: this.envSubBass.probe,
            treble: this.envTreble.probe,
            vocal: this.envVocal.probe,
        };
    }
    get lastHybridSnare() {
        return this._lastHybridSnare;
    }
    constructor(profile = TECHNO_PROFILE, layout = '7.1') {
        // morphFactor state
        this.avgMidProfiler = 0.0;
        // Silence / AGC rebound state
        this.lastSilenceTime = 0;
        this.inSilence = false;
        // Strobe state
        this._strobeActive = false;
        this.strobeStartTime = 0;
        // Kick edge detection state
        this._lastKickTime = 0;
        this._kickIntervalMs = 0;
        // WAVE 2439.8: Naked Delta — estado para filtrar aceleración pura del bombo
        this._prevBassEnergy = 0;
        // WAVE 2439.9: Frame Hold — extiende el pulso del bombo ~110ms para hardware DMX
        // Un único fotograma (22ms) es indigerible para dimmers/LEDs físicos.
        this._kickHoldCounter = 0;
        // WAVE 8010: Kick debounce temporal — después del hold counter, esperar
        // KICK_COOLDOWN_MS antes de permitir un nuevo impacto. Evita que el tail
        // del bombo o un sinte re-disparen el detector en el mismo beat.
        this._lastKickImpactTime = 0;
        // WAVE 8008 ADAPTER: Pre-procesador snare_energy EMA → impulso binario
        // Convierte la señal continua del RhythmicPercussionTracker en impulsos
        // compatibles con LiquidEnvelope (diseñado para señales binarias 0/1)
        this._prevSnareEnergy = 0;
        this._snareImpulse = 0;
        // WAVE 7749.16: WNS confirmation window — pending onset waiting for WNS.
        this._snarePendingWns = false;
        this._lastHybridSnare = 0;
        // WAVE 7749.21: OPUS AUDIT — Slow EMA of spectralFlux to track buildup density
        this._fluxBaseline = 0;
        // WAVE 7749.42: TCT RE-ARM DISCRIMINATOR — tracks the previous frame's rawSnareDelta
        // to enforce that the physical energy delta has decayed before re-arming the onset
        // detector. A sustained synth lead keeps crackDelta elevated frame after frame;
        // a real snare transient spikes and decays within 1-2 frames. Requiring the delta
        // to have fallen below 0.02 before allowing a new onset prevents the synth lead
        // from re-triggering every 68ms via the _snareImpulse retrigger guard.
        this._prevRawSnareDelta = 0;
        this._snareReArmed = true;
        // WAVE 7748: HH ENERGY ADAPTER — Pre-allocated state for hi-hat impulse
        // Mirrors _prevSnareEnergy/_lastSnareOnset/_snareImpulse pattern.
        // All scalars, zero allocation in hot path.
        this._prevHhEnergy = 0;
        this._lastHhOnset = 0;
        this._hhImpulse = 0;
        // WAVE 7749: SUSTAIN CHOKE — kills vocal bleed tails in envSnare
        // Tracks how long snare_energy has been elevated without a new onset.
        // If it sustains > chokeFrames (~50ms at 44Hz = ~2 frames), choke the envelope.
        this._snareSustainFrames = 0;
        this._snareChokeFactor = 1.0;
        // Kick Veto state
        this._kickVetoFrames = 0;
        // Transient Shaper state (WAVE 2427 → WAVE 2446)
        this.lastTreble = 0;
        this.lastHighMid = 0;
        this.lastMid = 0;
        // WAVE 4520.2: 9-zone EMA state
        // Ambient: slow follower of subBass. Attack ~5 frames, release ~33 frames.
        this._ambientEMA = 0;
        // 🩸 WAVE 7749.27: _airEMA REMOVED — Air zone now uses envAir (LiquidEnvelope).
        // WAVE 4812 M3: Vocal Sustain Detector — EMA rápida de mid para detectar vocales sostenidas.
        // Attack muy rápido (alpha=0.25, ~4 frames) para capturar vocales al instante.
        // Release lento (alpha=0.04, ~25 frames) para que la penalización persista post-frase vocal.
        this._vocalSustainEMA = 0;
        // WAVE 4521.3: El último ProcessedFrame producido por applyBands().
        // Expuesto para que LiquidAetherAdapter pueda consumirlo sin re-llamar al engine.
        // Nunca es null después del primer frame procesado.
        this.lastFrame = null;
        // WAVE 4521.3: El último LiquidStereoResult producido por routeZones().
        // Disponible tras el primer applyBands(). LiquidAetherAdapter lo consume como L0 input.
        this.lastResult = null;
        this.layout = layout;
        // Fusión condicional: si layout === '4.1' y el perfil tiene overrides, aplicar
        const effective = layout === '4.1' ? fuseProfileFor41(profile) : profile;
        this.profile = effective;
        this.envSubBass = new LiquidEnvelope(effective.envelopeSubBass);
        this.envKick = new LiquidEnvelope(effective.envelopeKick);
        this.envVocal = new LiquidEnvelope(effective.envelopeVocal);
        this.envSnare = new LiquidEnvelope(effective.envelopeSnare);
        this.envHighMid = new LiquidEnvelope(effective.envelopeHighMid);
        this.envTreble = new LiquidEnvelope(effective.envelopeTreble);
        // 🩸 WAVE 7749.27: LASER DOMAIN — Air & Floor envelopes with fallback defaults
        this.envAir = new LiquidEnvelope(effective.envelopeAir ?? DEFAULT_ENVELOPE_AIR);
        this.envFloor = new LiquidEnvelope(effective.envelopeFloor ?? DEFAULT_ENVELOPE_FLOOR);
    }
    // ─────────────────────────────────────────────────────────────────────
    // 🌊 WAVE 2435: HOT-SWAP PROFILE — Cambio de género sin destruir instancia
    // ─────────────────────────────────────────────────────────────────────
    /**
     * Inyecta un nuevo perfil de género al motor en caliente.
     * La fusión con overrides41 ocurre aquí si el layout es 4.1.
     * Recrea las 6 envelopes con la configuración efectiva.
     * El estado interno (avgMid, silence, etc.) se preserva — el motor no "salta".
     */
    setProfile(profile) {
        const effective = this.layout === '4.1' ? fuseProfileFor41(profile) : profile;
        this.profile = effective;
        this.envSubBass = new LiquidEnvelope(effective.envelopeSubBass);
        this.envKick = new LiquidEnvelope(effective.envelopeKick);
        this.envVocal = new LiquidEnvelope(effective.envelopeVocal);
        this.envSnare = new LiquidEnvelope(effective.envelopeSnare);
        this.envHighMid = new LiquidEnvelope(effective.envelopeHighMid);
        this.envTreble = new LiquidEnvelope(effective.envelopeTreble);
        // 🩸 WAVE 7749.27: LASER DOMAIN — hot-swap air & floor envelopes
        this.envAir = new LiquidEnvelope(effective.envelopeAir ?? DEFAULT_ENVELOPE_AIR);
        this.envFloor = new LiquidEnvelope(effective.envelopeFloor ?? DEFAULT_ENVELOPE_FLOOR);
    }
    // ─────────────────────────────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────────────────────────────
    applyBands(input) {
        const { bands, sectionType = 'drop', isRealSilence, isAGCTrap, harshness = 0.45, flatness = 0.35, } = input;
        const now = Date.now();
        const p = this.profile;
        // [WAVE 4941.5] HARMONIC REJECTION GATE + WHISPER GATE
        const harmonicBase = bands.mid;
        // midHigh/air en la directiva -> highMid/ultraAir en GodEarBands.
        const transientTop = bands.highMid + bands.treble + (bands.ultraAir * 0.5);
        let tonalSquelch = 1.0;
        let percussiveRatio = 0; // hoisted para telemetría y probes
        // 1. BAJAMOS EL SUELO: evaluamos ratio incluso en susurros y pianos suaves.
        if (harmonicBase > 0.05) {
            percussiveRatio = transientTop / (harmonicBase || 0.01);
            // WAVE 4948 — LATINO VOCAL KILL HARDENING
            // Endurece el rechazo armónico para cortar voz/autotune en back pars.
            if (percussiveRatio < 0.88) {
                tonalSquelch = 0.30; // WAVE 8009.2: 0.0→0.30 — sin muerte absoluta, transitorios sutiles conservan escala
            }
            else if (percussiveRatio < 1.12) {
                tonalSquelch = 0.50; // WAVE 8009.2: 0.22→0.50 — zona mixta menos castigada
            }
            // Ratio >= 1.12 -> tonalSquelch queda en 1.0 (transiente realmente percusivo)
        }
        // 2. THE WHISPER GATE: anti-fantasmas en pasajes de baja energía.
        if (transientTop < 0.15 && harmonicBase < 0.3) {
            tonalSquelch = 0.0; // WAVE 4945: cero puro en apagones
        }
        // [WAVE 4941.3→4] DSP SQUELCH PROBE silenciado (WAVE 4947.2)
        // if (bands.highMid > 0.45) {
        //   console.log(`[DSP PROBE] 🥁 Snare Hit Validado`, {
        //     ratio: percussiveRatio.toFixed(3),
        //     squelch: tonalSquelch,
        //   })
        // }
        // Entradas rítmicas crudas filtradas ANTES de los envelopes de percusión.
        // WAVE 6050: resta de graves directa — corta resonancia del bombo en medios
        const bassLeakage = bands.lowMid * 1.5; // detecta resonancia del bombo en medios
        const rawSnare = Math.max(0, bands.highMid * tonalSquelch - bassLeakage);
        const rawHat = bands.treble * tonalSquelch;
        // ═══════════════════════════════════════════════════════════════════
        // 1. MORPHFACTOR
        // WAVE 2470 — HYDROSTATIC BRIDGE:
        //   Si el input suministra morphFactorOverride (chill-lounge inyecta la
        //   profundidad oceánica), lo usamos directamente y saltamos el avgMidProfiler.
        //   Para todos los demás vibes, comportamiento estándar sin cambios.
        // ═══════════════════════════════════════════════════════════════════
        let morphFactor;
        if (input.morphFactorOverride !== undefined) {
            morphFactor = Math.min(1.0, Math.max(0.0, input.morphFactorOverride));
            // El avgMidProfiler sigue actualizándose en background para cuando
            // se vuelva a un vibe no-chill (sin salto brusco en la transición)
            if (bands.mid > this.avgMidProfiler) {
                this.avgMidProfiler = this.avgMidProfiler * 0.85 + bands.mid * 0.15;
            }
            else {
                this.avgMidProfiler = this.avgMidProfiler * 0.98 + bands.mid * 0.02;
            }
        }
        else {
            if (bands.mid > this.avgMidProfiler) {
                this.avgMidProfiler = this.avgMidProfiler * 0.85 + bands.mid * 0.15;
            }
            else {
                this.avgMidProfiler = this.avgMidProfiler * 0.98 + bands.mid * 0.02;
            }
            morphFactor = Math.min(1.0, Math.max(0.0, (this.avgMidProfiler - p.morphFloor) / Math.max(0.0001, (p.morphCeiling - p.morphFloor))));
        }
        // ═══════════════════════════════════════════════════════════════════
        // WAVE 4845 — THE ABSOLUTE ZERO (CHILLOUT ISOLATION)
        // Modo chill/ambient: cortocircuito total del flujo audio-reactivo.
        // Nada de kick, transientes, strobe ni sidechain entra en L0.
        // ═══════════════════════════════════════════════════════════════════
        if (this.isAbsoluteChillProfile()) {
            this.clearAudioTransients();
            const glacierMorph = this.applyGlacierPalette(morphFactor);
            return this.renderPureGlacierPayload(glacierMorph, now);
        }
        // ═══════════════════════════════════════════════════════════════════
        // 2. MODES
        // ═══════════════════════════════════════════════════════════════════
        const acidMode = harshness > p.harshnessAcidThreshold;
        const noiseMode = flatness > p.flatnessNoiseThreshold;
        // ═══════════════════════════════════════════════════════════════════
        // WAVE 4520.2: EMA UPDATES — run every frame, before silence check
        // Updates happen unconditionally so EMA decays naturally during silence,
        // avoiding a hard-freeze of the state when audio resumes.
        // ═══════════════════════════════════════════════════════════════════
        // WAVE 4684: Ambient EMA — profile-configurable viscosity.
        // Attack/Release time constants in ms → alpha = 1000/(ms×44).
        // Default: attack ~800ms (gentle rise), release ~10000ms (ultra-slow lung).
        // WAVE 4812 M2: EL OCÉANO — El ambient se alimenta exclusivamente de subBass.
        // Antes: bass×0.40 + mid×0.60 (contaminado por vocales).
        // Ahora: subBass puro — late con el graves del reguetón, invisáble a voces.
        // WAVE 2522: AMBIENT MID INJECTION — perfiles con ambientMidWeight > 0
        // inyectan energía de medios (guitarras rock, teclados) en el ambient.
        // Default 0 = comportamiento WAVE 4812 M2 (solo subBass).
        const _ambAttackAlpha = Math.min(1.0, 1000 / ((p.ambientAttackMs ?? 800) * 44));
        const _ambReleaseAlpha = Math.min(1.0, 1000 / ((p.ambientReleaseMs ?? 10000) * 44));
        const _ambMidWeight = p.ambientMidWeight ?? 0;
        const _ambMix = bands.subBass + bands.mid * _ambMidWeight;
        if (_ambMix > this._ambientEMA) {
            this._ambientEMA = this._ambientEMA * (1 - _ambAttackAlpha) + _ambMix * _ambAttackAlpha;
        }
        else {
            this._ambientEMA = this._ambientEMA * (1 - _ambReleaseAlpha) + _ambMix * _ambReleaseAlpha;
        }
        // WAVE 4812 M3: Vocal Sustain EMA — detecta energía mid sostenida (vocales continuas).
        // La vocal tiene EMA alta + delta baja. El snare tiene delta alta + EMA baja.
        if (bands.mid > this._vocalSustainEMA) {
            this._vocalSustainEMA = this._vocalSustainEMA * 0.75 + bands.mid * 0.25;
        }
        else {
            this._vocalSustainEMA = this._vocalSustainEMA * 0.96 + bands.mid * 0.04;
        }
        // 🩸 WAVE 7749.27: Air EMA REMOVED — Air zone now processed by envAir
        // (LiquidEnvelope) later in the pipeline with zero-attack laser kinematics.
        // ═══════════════════════════════════════════════════════════════════
        // 3. SILENCE / AGC TRAP
        // ═══════════════════════════════════════════════════════════════════
        if (isRealSilence || isAGCTrap) {
            this.inSilence = true;
            this.lastSilenceTime = now;
            return this.buildSilenceResult(acidMode, noiseMode);
        }
        else if (this.inSilence) {
            this.inSilence = false;
        }
        const timeSinceSilence = now - this.lastSilenceTime;
        const isRecovering = this.lastSilenceTime > 0 && timeSinceSilence < RECOVERY_DURATION;
        const recoveryFactor = isRecovering
            ? Math.min(1.0, timeSinceSilence / RECOVERY_DURATION)
            : 1.0;
        // ═══════════════════════════════════════════════════════════════════
        // 4. SECTION ANALYSIS
        // ═══════════════════════════════════════════════════════════════════
        const isBreakdown = sectionType === 'breakdown' || sectionType === 'buildup';
        // ═══════════════════════════════════════════════════════════════════
        // 5. KICK DETECTION + VETO
        // ═══════════════════════════════════════════════════════════════════
        // WAVE 2439.8: Naked Delta — filtro de aceleración pura sin time-locks.
        // El sinte oscila con deltas de ~0.01. El bombo salta violentamente (>0.05).
        // Esto decapita el sustain del sintetizador y aisla transitorios verticales.
        // DESCONTAMINACIÓN EXACTA: Revertimos la inyección de WAVE 3421
        // Le quitamos el 40% de lowMid para aislar el grave original (0-250Hz)
        const pureBassEnergy = Math.max(0, bands.bass - (bands.lowMid * 0.40));
        const bassDelta = pureBassEnergy - this._prevBassEnergy;
        this._prevBassEnergy = pureBassEnergy;
        // WAVE 2439.10: Reload Lock + Shielded Delta
        // RELOAD LOCK: Solo evaluamos impacto si el hold está inactivo.
        // Esto impide que el pumping del sidechain extienda o reinicie el contador.
        // ADAPTIVE DELTA: Curva inversa de compresión sobre señal purificada.
        // Bass 1.0 → delta 0.040 | Bass 0.5 → delta 0.080. Evita falsos positivos en build-ups.
        let isImpact = false;
        // WAVE 8010: Cooldown temporal además del hold counter.
        // El hold counter (6 frames ~136ms) bloquea re-detección durante el pulso,
        // pero tras expirar, el tail del bombo o un sinte pueden re-disparar.
        // 150ms de cooldown asegura un único disparo por beat (>400ms a 130 BPM).
        if (this._kickHoldCounter === 0 && (now - this._lastKickImpactTime > LiquidEngineBase.KICK_COOLDOWN_MS)) {
            const dynamicDelta = 0.120 - (pureBassEnergy * 0.080);
            isImpact = pureBassEnergy > p.envelopeKick.gateOn && bassDelta > dynamicDelta;
            if (isImpact) {
                this._kickHoldCounter = 6;
                this._lastKickImpactTime = now;
            }
        }
        const isKick = this._kickHoldCounter > 0;
        if (this._kickHoldCounter > 0)
            this._kickHoldCounter--;
        if (isKick && this._lastKickTime > 0) {
            this._kickIntervalMs = now - this._lastKickTime;
        }
        if (isKick)
            this._lastKickTime = now;
        const isKickEdge = isKick && this._kickIntervalMs > p.kickEdgeMinInterval;
        if (isKick) {
            this._kickVetoFrames = p.kickVetoFrames;
        }
        const isVetoed = this._kickVetoFrames > 0;
        if (this._kickVetoFrames > 0)
            this._kickVetoFrames--;
        // ═══════════════════════════════════════════════════════════════════
        // 6. PROCESS ALL ENVELOPES
        // ═══════════════════════════════════════════════════════════════════
        // --- FRONT L: SubBass continuo (El Océano) ---
        let frontLeft = this.envSubBass.process(bands.subBass, morphFactor, now, isBreakdown);
        // --- FRONT R: Kick Naked Delta (El Francotirador) ---
        // WAVE 2439.8: kickSignal alimentado solo por transitorios verticales (delta > 0.05).
        // El envelope con su decayBase ultrarrápido y maxIntensity dará forma al impulso.
        const kickSignal = isKick ? pureBassEnergy : 0;
        let frontRight = this.envKick.process(kickSignal, morphFactor, now, isBreakdown);
        // WAVE 8005.2: PHOTON STROBE — Front Channel modulation (overlay, not replace)
        // On-phase: flash to full brightness on top of normal physics.
        // Off-phase: normal physics preserved (no override).
        if (input.photon?.strobe?.active) {
            const _strobe = input.photon.strobe;
            const _periodMs = 1000 / Math.max(0.1, _strobe.rateHz);
            const _phase = (now % _periodMs) / _periodMs;
            if (_phase < _strobe.duty)
                frontRight = Math.max(frontRight, 1.0);
        }
        // --- BACK R (El Látigo): WAVE 2449 MORPHOLOGIC CENTROID SHIELD ---
        // WAVE 2441 Monte Carlo: fitness=6260 | 0 leaks | coefs verificados en 616 frames reales.
        // WAVE 2443: Centroid Shield 5000Hz → demasiado alto.
        // WAVE 2444: highMidDelta incorporado. WAVE 2445: Centroid Shield condicional (isKick only).
        // WAVE 2446: midDelta * 0.8 añadido (snare gordo 808-style).
        // WAVE 2447: Centroid Shield Universal → elimina snare invertido (cent < 900Hz → 0).
        // WAVE 2449: animalog.md revela que Anyma vive en cent:240-600Hz — el escudo de 900Hz fijo
        //   lo mataba en techno melódico. El centroide del stab de Anyma ≡ centroide del bombo.
        //   No se puede separar por frecuencia fija. Se separa por MORFOLOGÍA.
        //   centroidFloor = 900 * (1 - morphFactor): en Anyma el suelo cae a ~180Hz (todo pasa),
        //   en techno industrial sube a ~810Hz (bloqueo total del cuerpo del bombo).
        //   El Salvoconducto Dubstep (harshness ≥ 0.024) permite snare fills sobre el bombo.
        const currentTreble = rawHat;
        const currentHighMid = rawSnare;
        const currentMid = bands.mid;
        const trebleDelta = Math.max(0, currentTreble - this.lastTreble);
        const highMidDelta = Math.max(0, currentHighMid - this.lastHighMid);
        const midDelta = Math.max(0, currentMid - this.lastMid);
        this.lastTreble = currentTreble;
        this.lastHighMid = currentHighMid;
        this.lastMid = currentMid;
        // WAVE 7749.9: LEGACY TRANSIENT SHAPER EXTERMINATED.
        // The old isSnareImpact / _snareHoldCounter / percRaw path was a separate
        // detection logic (rawSpike * snareSpectrum * 10.0 > 0.19) that fired on
        // spectral spikes from hi-hats, synths, and noise — not just snares.
        // It held percRaw=1.0 for ~90ms (4 frames) after ANY spectral spike,
        // causing the "fairground lights" effect. Now fully removed.
        // The ONLY snare detection path is the pure physics rawOnset below.
        let hybridSnare = 0;
        // ═══════════════════════════════════════════════════════════════════
        // WAVE 8008 ADAPTER: Pre-procesador snare_energy EMA → impulso binario
        // Cuando GodEarFFT V3 suministra snare_energy (EMA continua del
        // RhythmicPercussionTracker), convertirla a impulso binario con decay
        // rápido antes de alimentar LiquidEnvelope. Esto preserva la lógica
        // original del envelope sin modificaciones.
        // ═══════════════════════════════════════════════════════════════════
        let snareOnsetThisFrame = false;
        if (input.snare_energy !== undefined) {
            const rawSnareEnergy = input.snare_energy;
            // WAVE 7749.3: Reset prev energy on silence — after a break/drop, the
            // _prevSnareEnergy was stuck high from the last beat. When audio resumes,
            // the delta was negative → no onset → slow recovery. Reset to 0 when
            // energy drops to near-silence so the first returning beat triggers.
            if (this._prevSnareEnergy > 0.10 && rawSnareEnergy < 0.03) {
                this._prevSnareEnergy = 0;
            }
            // ═══════════════════════════════════════════════════════════════════════════
            // WAVE 7749.7: RAW TRANSIENT ONSET DETECTION — The isKick methodology
            // ═══════════════════════════════════════════════════════════════════════════
            //
            // PROBLEM (WAVE 7749.0-7749.4): snare_energy is an EMA from GodEarFFT's
            // RhythmicPercussionTracker. In dense compressed techno, the EMA smoothing
            // destroys the transient edge — frame-to-frame deltas are <0.008 even when
            // real snares are firing. The deltaOnset and fluxOnset triggers were deaf.
            //
            // SOLUTION: GodEarFFT now exports raw_snare_delta — the frame-to-frame delta
            // of the RAW (pre-EMA) snare energy. This is the same principle as isKick:
            //   isKick:  bassDelta = pureBassEnergy - _prevBassEnergy  (raw FFT band)
            //   snare:   rawSnareDelta = snareEnergyRaw - _prevSnareEnergyRaw  (raw FFT sub-band)
            //
            // The raw signal has sharp transients even under heavy compression because
            // compression reduces amplitude but doesn't eliminate the transient edge.
            //
            // THREE triggers (all agnostic, no profile brute-force):
            //
            // WAVE 7749.9: THE PURIST METRONOME — No cooldowns, no hacks.
            // The engine operates on pure physics. If the raw signal dictates 4 rapid
            // hits, the lights flood. If it double-triggers falsely, we see it in
            // telemetry and fix the math — we don't hide it with cooldowns.
            //
            // All legacy EMA-based triggers (emaOnset, fluxOnset) have been exterminated.
            // They were firing on negative raw deltas and spectral flux noise during
            // decays — physically impossible false positives.
            //
            // The snare onset is now a single line of physics:
            //   1. raw_snare_delta > 0.08 — a real positive transient edge in the crack band
            //   2. snare_energy > 0.05   — sufficient total energy (not a near-zero jump)
            //
            // The Tonality Veto (downstream) acts as the Liquid Morphology filter,
            // scaling the intensity based on the track's fluid density.
            // WAVE 7749.16: WNS CONFIRMATION WINDOW — The 1-Frame Latency Fix
            // The WNS detector has a 1-frame latency: on the first frame of a snare
            // hit, crack-delta and spectral flux fire immediately, but WNS is still 0
            // (the HF noise content hasn't been integrated yet). On the next frame,
            // WNS spikes to 0.1-0.7. In ~90% of cases, RawΔ stays > 0.12 on frame 2
            // and the onset fires normally. In ~10% of cases, RawΔ drops below 0.12
            // by frame 2 and the snare is missed — the "1 negro" in a 3-4-1 pattern.
            //
            // Solution: when crack+flux say snare but WNS hasn't arrived, set a
            // "pending" flag. On the next frame, if WNS > 0.05 AND Flux is still
            // active (> 0.15), fire retroactively — the snare body is still
            // resonating. If WNS stays 0, it was a kick — discard the pending.
            //
            // This is physically motivated: the crack band and flux are fast
            // detectors (1-frame response), while WNS is a slower detector (2-frame
            // response). We give WNS 1 extra frame to confirm. Kicks never confirm
            // because their WNS stays 0 on both frames.
            const rawSnareDelta = input.raw_snare_delta ?? 0;
            const photon = input.photon;
            // WAVE 7749.42: STRICT PHOTON FALLBACK — fail-closed, not fail-open.
            // If the photon block is missing (IPC drop, worker lag, first frame),
            // spectralFlux and wns default to 0, blocking all onset paths. The old
            // ?? 1 fallbacks allowed any rawSnareDelta > 0.06 to fire as a snare
            // during photon glitches, causing burst false positives.
            const spectralFlux = photon?.spectralFlux ?? 0; // fail-closed
            const wns = photon?.whiteNoiseScore ?? 0; // fail-closed
            const snareEnergy = input.snare_energy ?? 0;
            // WAVE 7749.22: DYNAMIC FBL THRESHOLD — Opus Paradox resolved.
            // During massive buildups (Eric Prydz "Opus"), snare_energy EMA dies to 0
            // because white noise asphyxiates the RhythmicPercussionTracker. But
            // spectralFlux baseline (fBL) rises from 0.044 (normal) to 0.06-0.076
            // (buildup). This is the reliable density signal.
            // Formula: threshold = 0.12 - max(0, fBL - 0.05) × 2.0, clamped to 0.08.
            //   fBL = 0.05 (normal) → threshold = 0.12 (strict, hi-hats blocked)
            //   fBL = 0.06 (buildup) → threshold = 0.10
            //   fBL = 0.07 (peak)    → threshold = 0.08
            // WAVE 7749.42: Floor raised 0.06→0.08. The old 0.06 floor let synth lead
            // crackDelta noise (0.06-0.08 from filter modulation) breach the gate
            // during dense buildups. 0.08 sits above the synth lead noise floor and
            // below the compressed snare roll delta (empirical min 0.08-0.11).
            this._fluxBaseline = this._fluxBaseline * 0.98 + spectralFlux * 0.02; // tau ~500ms at 44Hz
            const dynamicSnareThreshold = 0.12 - (Math.max(0, this._fluxBaseline - 0.05) * 2.0);
            const finalSnareThreshold = Math.max(0.08, dynamicSnareThreshold);
            // WAVE 7749.23: DYNAMIC FLUX GATE — Opus Paradox Part 2.
            // The delta threshold fix (7749.22) worked, but ~150 snares in the roll
            // have Flux 0.10-0.15 and are blocked by the static 0.15 Flux gate.
            // During dense buildups, the AGC compresses individual hit flux — a snare
            // that normally has Flux 0.20 gets crushed to 0.12.
            // Empirical: kicks max out at Flux 0.097. Snares in the roll: 0.10-0.15.
            // Gap is clean at 0.10. Dynamic gate scales with fBL, clamped to 0.12.
            //   fBL = 0.05 (normal)  → Flux gate = 0.15 (strict, hi-hats blocked)
            //   fBL = 0.08 (buildup) → Flux gate = 0.12
            //   fBL = 0.10+ (peak)   → Flux gate = 0.12 (clamp — kicks still blocked)
            // WAVE 7749.42: Floor raised 0.10→0.12. The old 0.10 floor let synth
            // leads with sustained Flux 0.10-0.12 pass the gate. 0.12 is above the
            // synth lead Flux ceiling (0.10-0.11) and below compressed snare Flux
            // (empirical min 0.12-0.15 in rolls).
            const dynamicFluxGate = Math.max(0.12, 0.15 - (Math.max(0, this._fluxBaseline - 0.05) * 1.0));
            // WAVE 7749.42: TCT RE-ARM DISCRIMINATOR — Delta Decay Test.
            // A real snare transient spikes crackDelta and decays within 1-2 frames.
            // A sustained synth lead keeps crackDelta elevated frame after frame.
            // We require the PREVIOUS frame's rawSnareDelta to have settled to near
            // zero (|Δ| < 0.02) before allowing a new onset. This prevents the synth
            // lead from re-triggering every 68ms via the _snareImpulse retrigger guard.
            // The _snareReArmed flag is set true when the delta decays below 0.02 in
            // ABSOLUTE value, and consumed (set false) when an onset fires. A real
            // snare roll has ~45-125ms between hits — the delta drops to ~0 between
            // hits, re-arming the detector. A synth lead never drops, so the detector
            // stays choked.
            // WAVE 7749.43: BUGFIX — use Math.abs(). The original `< 0.02` check let
            // negative deltas (energy decay: -0.154, -0.570) re-arm the detector on
            // the very next frame after an onset, causing "3 beats pegados" — the
            // decay frame re-armed, then a bypass path (Energy>0.40 or Flux>0.20)
            // fired a second onset, then its decay re-armed again for a third. With
            // Math.abs(), the decay frame (|Δ|=0.154-0.570) does NOT re-arm; only a
            // true settle to |Δ|<0.02 between separate hits re-arms.
            if (Math.abs(this._prevRawSnareDelta) < 0.02) {
                this._snareReArmed = true;
            }
            let rawOnset = false;
            if (rawSnareDelta > finalSnareThreshold && spectralFlux > dynamicFluxGate && this._snareImpulse < 0.15 && this._snareReArmed) {
                if (wns > 0.05) {
                    // Primary path: all 4 conditions met — fire immediately.
                    rawOnset = true;
                }
                else if (spectralFlux > 0.20) {
                    // WAVE 7749.18: HIGH-FLUX BYPASS — Synthesized snare detection
                    // In melodic techno (Anyma, Tale of Us, etc.), snares are synthesized
                    // noise bursts or electronic claps that don't produce the broadband HF
                    // noise content WNS expects. They have WNS = 0 across ALL frames.
                    // But they DO have explosive spectral flux (> 0.20) that kicks never
                    // reach (kicks are bass-band only, Flux < 0.10) and synth stabs never
                    // reach (stabs are 0.10-0.15). The Flux > 0.20 threshold cleanly
                    // separates synthesized snares from kicks/stabs in the WNS = 0 zone.
                    // Empirical data from techno14melodic (Anyma): 27 synth snares with
                    // Flux 0.20-0.32, WNS = 0 — all blocked by old WNS gate. 0 kicks with
                    // Flux > 0.20. Genre-agnostic: works for acoustic (WNS path) and
                    // electronic (Flux bypass) snares.
                    rawOnset = true;
                }
                else if (snareEnergy > 0.40) {
                    // WAVE 7749.19: ENERGY-CONDITIONED BORDER ZONE BYPASS
                    // Some synth snares in melodic techno have moderate Flux (0.15-0.20)
                    // — not enough to trigger the 0.20 bypass, and WNS = 0 (synthesized).
                    // These are missed by both the WNS path and the Flux bypass.
                    // Discriminator: snare_energy. Real snares have high crack-band
                    // energy (> 0.40) because the noise burst is loud. Kicks in the same
                    // Flux zone have E < 0.36 (their energy is in the bass band, not the
                    // crack band). Empirical data:
                    //   techno11 kicks (Flux 0.15-0.40, WNS=0): E = 0.14-0.36
                    //   techno15 border snares (Flux 0.15-0.20, WNS=0): E = 0.30-0.87
                    // Threshold 0.40 sits in the clean gap above kick max (0.36).
                    rawOnset = true;
                }
                else {
                    // Pending: crack+flux say snare, but WNS hasn't arrived yet.
                    // Wait 1 frame for WNS confirmation.
                    this._snarePendingWns = true;
                }
            }
            else if (this._snarePendingWns && wns > 0.05 && this._snareImpulse < 0.15 && this._snareReArmed) {
                // WAVE 7749.17: Confirmation only needs WNS — Flux was already validated
                // on the pending frame. The snare body's spectral change rate decays
                // faster than WNS: in 4/57 cases (the "negros"), Flux dropped to 0.11-0.14
                // on the confirmation frame while WNS arrived strong (0.28-0.70). Requiring
                // Flux > 0.15 again blocked these real snares. WNS alone is sufficient to
                // confirm snare vs kick — kicks never produce WNS on either frame.
                rawOnset = true;
                this._snarePendingWns = false;
            }
            else {
                // No onset and no pending confirmation — clear the pending flag.
                this._snarePendingWns = false;
            }
            snareOnsetThisFrame = rawOnset;
            if (rawOnset) {
                this._snareImpulse = 1.0;
                // WAVE 7749.42: Consume the re-arm flag — the detector is now choked
                // until the delta decays below 0.02 again. This prevents a sustained
                // synth lead (constant crackDelta > 0.08) from re-triggering via the
                // _snareImpulse guard every 68ms.
                this._snareReArmed = false;
            }
            // WAVE 7749.3: Use pre-decay impulse for THIS frame's output.
            // WAVE 7749.7: Impulse decay is now profile-tunable (snareImpulseDecay).
            // WAVE 7749.13: Default 0.40 (techno snap — ~120ms to decay 1.0→0.01).
            const snareImpulseThisFrame = this._snareImpulse;
            this._snareImpulse *= (p.snareImpulseDecay ?? 0.40);
            this._prevSnareEnergy = rawSnareEnergy;
            // WAVE 7749.42: Track rawSnareDelta for the TCT re-arm discriminator.
            this._prevRawSnareDelta = rawSnareDelta;
            // WAVE 7749.9: hybridSnare is driven EXCLUSIVELY by the pure physics
            // impulse. No max-blend with the legacy percRaw (which was exterminated).
            hybridSnare = snareImpulseThisFrame;
        }
        // ═══════════════════════════════════════════════════════════════════
        // WAVE 7749: SUSTAIN CHOKE — A snare explodes and decays in <100ms.
        // A vocal sustains. If snare_energy stays elevated without new onsets,
        // it's a vocal/synth tail, not a snare. Choke the envelope exponentially.
        //
        // Mechanism: Track frames since last TRUE onset. If frames > chokeThreshold,
        // apply exponential decay to hybridSnare. The choke releases instantly
        // when a new true onset fires. This kills sustained tails within ~100ms.
        //
        // WAVE 7749.3: HIGH-ENERGY GUARD — In dense techno, snare_energy stays
        // high (0.3-0.6) but flat (no delta → no onsets). The choke was killing
        // real continuous percussion. Fix: if snare_energy > 0.15, the percussion
        // is still active — don't choke. Only choke when energy is actually fading
        // (low energy sustained = vocal/synth tail, not percussion).
        // ZERO-ALLOC: All state is pre-allocated on the class.
        // ═══════════════════════════════════════════════════════════════════
        if (input.snare_energy !== undefined) {
            const rawSnareEnergy = input.snare_energy;
            if (snareOnsetThisFrame) {
                // New true onset — reset sustain counter, release choke
                this._snareSustainFrames = 0;
                this._snareChokeFactor = 1.0;
            }
            else {
                this._snareSustainFrames++;
                // After chokeThreshold frames without a new onset, start choking —
                // BUT only if snare_energy has faded below 0.15.
                // High sustained energy = continuous percussion (techno), not a tail.
                const chokeThreshold = p.snareChokeFrames ?? 2;
                if (this._snareSustainFrames > chokeThreshold && rawSnareEnergy < 0.15) {
                    // Exponential choke: 0.70 per frame (~15ms half-life at 44Hz)
                    this._snareChokeFactor *= (p.snareChokeRate ?? 0.70);
                }
                else if (rawSnareEnergy >= 0.15) {
                    // Energy still high — percussion is active, not a tail. Hold the choke.
                    this._snareChokeFactor = 1.0;
                }
            }
            hybridSnare *= this._snareChokeFactor;
        }
        // ═══════════════════════════════════════════════════════════════════
        // WAVE 7749: TONALITY VETO — Multi-dimensional snare isolation
        // A snare is broadband noise. A vocal/synth is tonal. If a snare
        // onset is detected in frequency but the signal is tonal, VETO it.
        // This kills vocal consonants, synth stabs, and bass pops that
        // masquerade as snares in the frequency-band detector.
        //
        // THREE ORTHOGONAL AXES:
        //   1. flatness (Wiener entropy) — tonal vs noise
        //   2. whiteNoiseScore (HF broadband) — cymbal/snare sizzle vs vocal/synth
        //   3. spectralFlux (spectral change rate) — impulse vs sustain
        //
        // The veto is a multiplicative AND-gate, not a binary kill. This
        // preserves snare hits that are slightly tonal (rimshots, claps)
        // while killing sustained tonal bleed. ZERO-ALLOC: scalar math only.
        // ═══════════════════════════════════════════════════════════════════
        const photon = input.photon;
        if (photon !== undefined && hybridSnare > 0) {
            const wns = photon.whiteNoiseScore; // [0,1] — HF broadband
            const flux = photon.spectralFlux; // [0,~1] — spectral change rate
            // AXIS 1: Flatness gate — tonal signals get penalized
            // flatness < floor = pure tonal (vocal/synth) → veto factor 0
            // flatness floor-knee = mixed → linear ramp
            // flatness > knee = noise-like (snare/cymbal) → full pass
            // WAVE 7749.8: Defaults raised — 0.12→0.04 floor for flatness, 0.15→0.04 for wns,
            // 0.10→0.05 for flux. These are the fallbacks when no profile override exists.
            // Profile overrides (techno/latino) now also use 0.04/0.04/0.05.
            const flatFloor = p.snareVetoFlatnessFloor ?? 0.04;
            const flatKnee = p.snareVetoFlatnessKnee ?? 0.25;
            const flatnessGate = flatness < flatFloor
                ? 0.0
                : flatness < flatKnee
                    ? (flatness - flatFloor) / (flatKnee - flatFloor)
                    : 1.0;
            // AXIS 2: whiteNoiseScore gate — broadband HF discriminates snare from vocal
            // wns < floor = no HF broadband (vocal consonant) → veto
            // wns floor-knee = partial (rimshot, clap) → partial pass
            // wns > knee = strong broadband (snare, cymbal) → full pass
            const wnsFloor = p.snareVetoWnsFloor ?? 0.04;
            const wnsKnee = p.snareVetoWnsKnee ?? 0.35;
            const wnsGate = wns < wnsFloor
                ? 0.0
                : wns < wnsKnee
                    ? (wns - wnsFloor) / (wnsKnee - wnsFloor)
                    : 1.0;
            // AXIS 3: spectralFlux gate — sustained tonal energy has low flux
            // A snare hit = explosive flux spike. A vocal sustain = low flux.
            // flux < floor = sustained (vocal tail) → veto
            // flux > knee = explosive (snare) → full pass
            const fluxFloor = p.snareVetoFluxFloor ?? 0.05;
            const fluxKnee = p.snareVetoFluxKnee ?? 0.30;
            const fluxGate = flux < fluxFloor
                ? 0.0
                : flux < fluxKnee
                    ? (flux - fluxFloor) / (fluxKnee - fluxFloor)
                    : 1.0;
            // COMBINED VETO: AVERAGE (not multiplication) — WAVE 7749.4
            // Real-world dense techno (Brejcha @ 100% volume) proves flatness and WNS
            // are crushed by sub-bass density (flatness 0.03-0.07, WNS mostly 0.000).
            // Only spectralFlux survives as a discriminator. The average lets 1 strong
            // axis compensate for 2 weak axes. Soft-knee at 0.15 lets borderline hits through.
            // A vocal consonant: flatnessGate=0.02, wnsGate=0, fluxGate=0.05 → avg=0.02 (suppressed)
            // A techno snare:    flatnessGate=0.34, wnsGate=0, fluxGate=0.97 → avg=0.44 (PASSES)
            const vetoFactor = (flatnessGate + wnsGate + fluxGate) / 3.0;
            // WAVE 7749.4: Soft-knee lowered 0.20→0.15. Below 0.15, ramp up linearly
            // (vetoFactor / 0.15) instead of 2x gain, for smoother transition.
            hybridSnare *= (vetoFactor > 0.15 ? 1.0 : (vetoFactor / 0.15));
            // WAVE 7749.9: Telemetry Transparency — log EVERY frame with no throttling.
            // We need to see the absolute raw truth of what the math is detecting
            // frame-by-frame. If there are false positives, we see them and fix the math.
            // WAVE 7749.22: DISABLED — snare 4D is now production-ready across all
            // genres (techno acoustic, techno melodic/Anyma, latino). Back R is perfect.
            // Commented out to stop console spam. Re-enable for future debugging.
            // WAVE 7749.42: RE-ENABLED with TCT state + activity gating. Only logs when
            // there's meaningful activity (onset, near-onset delta, or active impulse) to
            // avoid the 44Hz spam that caused WAVE 7749.25 to retire it.
            const hasActivity = snareOnsetThisFrame
                || (input.raw_snare_delta ?? 0) > 0.04
                || this._snareImpulse > 0.05
                || this._snarePendingWns;
            if (hasActivity) {
                console.log(`[SNARE_T] ` +
                    `E:${input.snare_energy?.toFixed(3) ?? 'N/A'} | ` +
                    `Δ:${input.raw_snare_delta === undefined ? 'UNDEF' : input.raw_snare_delta.toFixed(3)} | ` +
                    `prevΔ:${this._prevRawSnareDelta.toFixed(3)} | ` +
                    `Flux:${flux.toFixed(3)} | ` +
                    `WNS:${wns.toFixed(3)} | ` +
                    `Flat:${flatness.toFixed(3)}(g:${flatnessGate.toFixed(2)}) | ` +
                    `Veto:${vetoFactor.toFixed(3)} -> Out:${hybridSnare.toFixed(3)} | ` +
                    `Imp:${this._snareImpulse.toFixed(2)} | ` +
                    `ReArm:${this._snareReArmed ? 'Y' : 'N'} | ` +
                    `fBL:${this._fluxBaseline.toFixed(3)}` +
                    (snareOnsetThisFrame ? ' [ONSET]' : '') +
                    (this._snarePendingWns ? ' [PEND]' : ''));
            }
            // WAVE 7749.21: OPUS AUDIT — Frame-by-frame diagnostic for buildup collapse.
            // 🩸 WAVE 7749.25: REMOVED. The diagnostic log was spamming the console at
            // ~44Hz on every frame with bass/snare activity, contributing to backend
            // memory pressure and console-pipe leaks. The 3 theories it validated
            // (delta compression, WNS saturation, retrigger guard) are now confirmed
            // and patched. Telemetry retired.
        }
        // 2. THE MORPHOLOGIC CENTROID SHIELD (WAVE 2449)
        // El bombo puede coexistir con synths en techno melódico (Anyma) porque el bombo
        // es el instrumento melódico — mismo centroide, indistinguibles con frecuencia fija.
        // morphFactor resuelve la ambigüedad: en Anyma es alto, el suelo baja, los synths pasan.
        // En techno industrial el suelo sube y bloquea el cuerpo del bombo sin compasión.
        //
        // morphFactor 0.1 (militar/duro)     → centroidFloor ≈ 810 Hz (bloqueo total)
        // morphFactor 0.8 (melódico/líquido) → centroidFloor ≈ 180 Hz (puerta abierta)
        //
        // El Salvoconducto Dubstep: harshness alto sobre un bombo = snare fill / efecto brutal.
        // Si harshness < 0.024 es bombo puro o decay — se bloquea. Si ≥ 0.024 hay acción real.
        if (isKick) {
            const centroidFloor = 900 * (1.0 - morphFactor);
            const currentCentroid = input.spectralCentroid ?? 0;
            const DUBSTEP_SNARE_MIN_HARSHNESS = 0.024;
            if (currentCentroid < centroidFloor && harshness < DUBSTEP_SNARE_MIN_HARSHNESS) {
                hybridSnare = 0.0;
            }
        }
        this._lastHybridSnare = hybridSnare;
        const snareAttack = hybridSnare;
        // WAVE 2451: morphFactor real (antes 1.0 hardcodeado).
        // En Anyma (morph≈0.8) el decay = decayBase + decayRange×0.8 → más flote, más relleno.
        // En techno industrial (morph≈0.1) el decay = decayBase + decayRange×0.1 → percutivo.
        let backRight = this.envSnare.process(hybridSnare, morphFactor, now, false);
        // ═══════════════════════════════════════════════════════════════════
        // MOVERS: WAVE 911 (strict-split) vs ENVELOPE CROSS-FILTER (otros)
        // ═══════════════════════════════════════════════════════════════════
        //
        // El motor es AGNOSTICO — cada perfil define su propio ADN de movers.
        // 'strict-split' (techno industrial) usa WAVE 911: raw math de bandas,
        //   hardcodeado para el espectro especifico de techno (mid-heavy, sin highMid).
        // Cualquier otro perfil usa el sistema de envolventes parametrizado:
        //   - Mover L: cross-filter (highMid × weight + treble × weight + mid × weight)
        //              filtrado por gate tonal (flatness < moverLTonalThreshold)
        //              procesado por envTreble (El Galan, decay largo latino)
        //   - Mover R: cleanMid (mid - bass × subtractFactor) - treble × moverRTrebleSub
        //              procesado por envVocal (La Dama, brillo + trompetas)
        // Esto garantiza que Latino, Pop-Rock, Chill y futuros perfiles tengan su
        // fisica propia sin tocar una sola linea del motor.
        let moverLeft;
        let moverRight;
        // --- ENVELOPE CROSS-FILTER — Motor Parametrizado por Perfil (WAVE 2457) ---
        // WAVE 6064: Desacoplado de layout41Strategy. Todos los perfiles usan envelopes.
        // El layout solo decide enrutamiento espacial (frontPar/backPar), no física.
        // MOVER L: cross-filter tonal (El Galan / Melodista / segun perfil)
        //   input = max(0, highMid×mH + treble×tW + mid×mW)
        //   Gate tonal: si flatness >= moverLTonalThreshold → ruido, cortar
        const moverLRaw = Math.max(0, bands.highMid * p.moverLHighMidWeight +
            bands.treble * p.moverLTrebleWeight +
            bands.mid * p.moverLMidWeight);
        const isTonal = flatness < p.moverLTonalThreshold ? 1.0 : 0.0;
        const moverLInput = moverLRaw * isTonal;
        moverLeft = this.envTreble.process(moverLInput, morphFactor, now, isBreakdown);
        // MOVER R: cleanMid con bass-subtractor adaptativo (La Dama / Terminator vocal)
        //   subtractFactor = base - morphFactor × range
        //   cleanMid = max(0, mid - bass × subtractFactor)
        //   crossInput = max(0, cleanMid - treble × moverRTrebleSub)
        const subtractFactor = p.bassSubtractBase - morphFactor * p.bassSubtractRange;
        const cleanMid = Math.max(0, bands.mid - bands.bass * subtractFactor);
        const moverRInput = Math.max(0, cleanMid - bands.treble * p.moverRTrebleSub);
        moverRight = this.envVocal.process(moverRInput, morphFactor, now, isBreakdown);
        // Sidechain del kick inline — universal (WAVE 2439)
        if (isKick) {
            moverLeft *= (1.0 - p.sidechainDepth);
            moverRight *= (1.0 - p.sidechainDepth);
        }
        // WAVE 4812 M3: BACK L VOCAL GATE — vocalPenalty reubicado desde transient shaper legacy.
        // OPERACIÓN: Bypass para techno — no hay vocales dominantes, los sintes activan falsamente este mute.
        const isTechnoProfile = this.profile.id === 'techno-industrial';
        const vocalPenalty = isTechnoProfile ? 0 : Math.min(0.75, this._vocalSustainEMA * Math.max(0, 1.0 - midDelta / Math.max(0.001, this._vocalSustainEMA)));
        // --- BACK L (El Coro): WAVE 2417 RESURRECTION → WAVE 2430 PARAMETRIZADO ---
        // WAVE 4812 M3: BACK L VOCAL GATE — vocalPenalty suprime el componente mid
        // cuando hay vocal sostenida. El lowMid se conserva (instrumentos de armonia,
        // sintetizadores de cuerpo) pero el mid puro se atenúa junto con las vocales.
        // DMZ ACÚSTICA: sustracción espectral del bombo en medios antes de envHighMid
        const dmzFactor = isTechnoProfile ? 0.55 : 0.30; // WAVE 6065: DMZ adaptativa — techno bombo seco (0.55), latino bombo con cuerpo (0.30)
        const cleanMidL = Math.max(0, bands.mid - (bands.bass * dmzFactor));
        const midSynthInput = Math.max(0, bands.lowMid * p.backLLowMidWeight + cleanMidL * p.backLMidWeight * (1.0 - vocalPenalty * 0.80)
            - bands.treble * p.backLTrebleSub - bands.bass * p.backLBassSub);
        // WAVE 7748: HH ENERGY ADAPTER — Back L hi-hat isolation
        // Mirror of WAVE 8008 snare adapter. Converts hh_energy EMA from
        // RhythmicPercussionTracker into a shaped impulse and max-blends it
        // with midSynthInput. Preserves the mid-synth pad texture while letting
        // isolated hi-hat transients punch through Back L.
        // ZERO-ALLOC: All state is pre-allocated on the class. No closures,
        // no object spreading, no arrays. Only scalar math in the hot path.
        let hhBlendInput = midSynthInput;
        if (input.hh_energy !== undefined) {
            const rawHhEnergy = input.hh_energy;
            const hhDelta = rawHhEnergy - this._prevHhEnergy;
            // Onset detection: derivative + absolute threshold + 60ms cooldown
            // Hi-hats fire faster than snares — 60ms allows 16th notes at 160 BPM
            const hhOnset = hhDelta > 0.008 && rawHhEnergy > 0.04 && (now - this._lastHhOnset > 60);
            if (hhOnset) {
                this._lastHhOnset = now;
                this._hhImpulse = 1.0;
            }
            // Fast decay — 3% retained per frame (~70ms at 44Hz)
            // Shorter hold than snare (4% / ~90ms) — hi-hats are staccato
            this._hhImpulse *= 0.03;
            this._prevHhEnergy = rawHhEnergy;
            // Max-blend: existing midSynthInput survives as pad texture,
            // hhImpulse punches isolated hi-hat transients on top.
            hhBlendInput = Math.max(midSynthInput, this._hhImpulse * (p.hhBlendGain ?? 0.6));
        }
        const backLeftGain = isTechnoProfile ? 1.45 : 1.75; // WAVE 6065: gain adaptativo — latino necesita más empuje para llegar a 1.0
        let backLeft = Math.min(1.0, this.envHighMid.process(hhBlendInput, morphFactor, now, isBreakdown) * backLeftGain); // OPERACIÓN: Gain para cruzar el umbral hacia 1.0 en pico
        // moverLeft y moverRight calculados por envelopes cross-filter arriba
        // WAVE 8005.2: PHOTON STROBE — Back channels preserved (strobe only affects front)
        // ═══════════════════════════════════════════════════════════════════
        // 7. APOCALYPSE MODE (universal)
        // ═══════════════════════════════════════════════════════════════════
        const isApocalypse = harshness > p.apocalypseHarshness && flatness > p.apocalypseFlatness;
        if (isApocalypse) {
            const chaosEnergy = Math.max(bands.mid, bands.treble);
            backRight = Math.max(backRight, chaosEnergy);
            moverLeft = Math.max(moverLeft, chaosEnergy);
            moverRight = Math.max(moverRight, chaosEnergy);
        }
        // ═══════════════════════════════════════════════════════════════════
        // 8. STROBE
        // ═══════════════════════════════════════════════════════════════════
        const strobeResult = this.calculateStrobe(bands.treble, bands.ultraAir, noiseMode);
        // WAVE 4826.5 — EFECTO GÜIRO INYECTADO EN STROBE (El verdadero FLASH dorado)
        // Detectar drops realistas e inyectar trebleDelta puro para flashes dorados en Tungsten
        const isDrop = bands.bass < 0.35 && bands.lowMid < 0.4;
        if (isDrop && trebleDelta > 0.25) {
            strobeResult.active = true;
            strobeResult.intensity = Math.min(1.0, strobeResult.intensity + trebleDelta * 2.0);
        }
        // ═══════════════════════════════════════════════════════════════════
        // 9. AGC REBOUND ATTENUATION
        // ═══════════════════════════════════════════════════════════════════
        if (isRecovering) {
            frontLeft *= recoveryFactor;
            frontRight *= recoveryFactor;
            backLeft *= recoveryFactor;
            backRight *= recoveryFactor;
            moverLeft *= recoveryFactor;
            moverRight *= recoveryFactor;
        }
        // ═══════════════════════════════════════════════════════════════════
        // 10. DELEGATE TO CHILD — routeZones()
        // ═══════════════════════════════════════════════════════════════════
        // ═══════════════════════════════════════════════════════════════════
        // WAVE 4520.2: 9-ZONE FINAL SIGNALS
        // 🩸 WAVE 7749.27: LASER DOMAIN — Air & Floor now use LiquidEnvelope.
        // ═══════════════════════════════════════════════════════════════════
        // floor: Ground sweep laser — spectralFlux + bassDelta onset-driven.
        // Distinct from frontLeft (subBass amplitude) and frontRight (kick velocity):
        // reacts to spectral CHANGE (any note onset), not band amplitude.
        const _flux = photon?.spectralFlux ?? 0;
        const _floorInput = Math.max(_flux * 0.7, Math.max(0, bassDelta) * 2.0);
        const floorIntensity = this.envFloor.process(_floorInput, morphFactor, now, isBreakdown);
        // ambient: slow EMA of subBass, no morphGain baseline — NOT gated by recoveryFactor.
        // WAVE 4812 M2: gain=1.0 — el ambient no tiene onda estática; solo brilla cuando
        // hay energía sub-grave real. El morphFactor ya no infla el baseline.
        const _ambientRaw = Math.min(1.0, Math.max(0.0, this._ambientEMA));
        // 🌊 WAVE 4814: Curva cuadrática (antes cúbica ^3.5) + noise-gate bajado.
        // ^2.0: subBass=0.40 → 0.16, subBass=0.60 → 0.36. El sub-grave real brilla.
        // gate=0.03 (antes 0.15): valores típicos de subBass (0.25-0.50) ahora pasan.
        // WAVE 7573: exponentes configurables via perfil (defaults 2.0 / 1.3).
        const _ambientCrushExp = p.ambientCrushExponent ?? 2.0;
        const _ambientCrushed = Math.pow(_ambientRaw, _ambientCrushExp);
        // WAVE 4826.3 — PRE-GAIN + CONTRASTE EXTREMO
        // Ganancia pre-curva para compensar falta de graves en latino (1.35x boost)
        // Luego expansión ^1.3 para contraste más suave (es ^1.6 era demasiado agresivo)
        // WAVE 2522: ambientGain configurable — default 1.35 (valor WAVE 4826.3).
        // Perfiles con ambientGain > 1.35 boostean la intensidad ambiental.
        const _ambientGain = p.ambientGain ?? 1.35;
        let preGainAmbient = Math.min(1.0, _ambientCrushed * _ambientGain);
        const _ambientOutputExp = p.ambientOutputExponent ?? 1.3;
        let ambientIntensity = Math.pow(preGainAmbient, _ambientOutputExp);
        // WAVE 4826.1 — Reemplazar gate binario por fade exponencial suave para Tungsten en Ambient
        if (ambientIntensity < 0.03) {
            ambientIntensity *= 0.85;
            if (ambientIntensity < 0.001)
                ambientIntensity = 0;
        }
        // 🩸 WAVE 7749.27: Air — Aerial laser. treble + ultraAir velocity-driven.
        // Spectrally isolated above snare body (2-6kHz): 6-22kHz range.
        // envAir gives zero-attack, fast decay (0.08), high gate (0.35), high crush (2.5).
        const _airInput = bands.treble * 0.8 + bands.ultraAir * 0.2;
        const airIntensity = this.envAir.process(_airInput, morphFactor, now, isBreakdown);
        const frame = {
            bands,
            morphFactor,
            recoveryFactor,
            isBreakdown,
            isVetoed,
            isKick,
            isKickEdge,
            acidMode,
            noiseMode,
            harshness,
            flatness,
            spectralCentroid: input.spectralCentroid ?? 0,
            rawTrebleDelta: trebleDelta,
            rawHighMidDelta: highMidDelta,
            rawMidDelta: midDelta,
            now,
            frontLeft,
            frontRight,
            backRight,
            snareAttack,
            backLeft,
            moverLeft,
            moverRight,
            strobeActive: strobeResult.active,
            strobeIntensity: strobeResult.intensity,
            floorIntensity,
            ambientIntensity,
            airIntensity,
        };
        this.lastFrame = frame;
        const result = this.routeZones(frame);
        this.lastResult = result;
        return result;
    }
    /** Resetea todo el estado interno */
    reset() {
        this.envSubBass.reset();
        this.envKick.reset();
        this.envVocal.reset();
        this.envSnare.reset();
        this.envHighMid.reset();
        this.envTreble.reset();
        // 🩸 WAVE 7749.27: LASER DOMAIN — reset air & floor envelopes
        this.envAir.reset();
        this.envFloor.reset();
        this.avgMidProfiler = 0;
        this.lastSilenceTime = 0;
        this.inSilence = false;
        this._strobeActive = false;
        this.strobeStartTime = 0;
        this.lastTreble = 0;
        this._ambientEMA = 0;
    }
    // ─────────────────────────────────────────────────────────────────────
    // WAVE 2513 — AMBIENT GENERATIVE ENGINE
    // Motor trigonométrico puro: sin GodEar, sin kicks, sin strobe.
    // Los seis osciladores tienen períodos primos entre sí (ms) para que
    // NUNCA coincidan en fase → nunca producen periodicidad perceptible.
    // El resultado es idéntico con música, en silencio o a 0 de volumen.
    // ─────────────────────────────────────────────────────────────────────
    applyAmbientGenerative(morphFactor, now) {
        // WAVE 2516 — THE ABSOLUTE SWELL: valores absolutos hardcodeados.
        // Sin dependencias de morphVariance ni variables dinámicas que puedan ser 0
        // cuando el audio está desconectado. Cada oscilador es completamente autónomo.
        // PARES — mínimo 0.10, rango 0.50 → [0.10 .. 0.60]
        const frontLeft = 0.10 + ((Math.sin(now / 4003 + 0.000) + 1) / 2) * 0.50; // El Pulso del Abismo
        const frontRight = 0.10 + ((Math.sin(now / 3109 + 1.047) + 1) / 2) * 0.50; // La Corriente
        const backLeft = 0.10 + ((Math.sin(now / 5303 + 0.628) + 1) / 2) * 0.50; // Las Algas
        const backRight = 0.10 + ((Math.sin(now / 1901 + 1.571) + 1) / 2) * 0.20; // El Destello (rango estrecho)
        // MOVERS — mínimo 0.05, rango 0.55 → [0.05 .. 0.60]
        const moverLeft = 0.05 + ((Math.sin(now / 9109 + 2.094) + 1) / 2) * 0.55; // La Voz del Mar
        const moverRight = 0.05 + ((Math.sin(now / 10303 + 3.926) + 1) / 2) * 0.55; // La Bioluminiscencia
        // Construimos el ProcessedFrame con GodEar vacío y osciladores como señales
        const frame = {
            bands: { subBass: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, treble: 0, ultraAir: 0 },
            morphFactor,
            recoveryFactor: 1.0,
            isBreakdown: false,
            isVetoed: false,
            isKick: false,
            isKickEdge: false,
            acidMode: false,
            noiseMode: false,
            harshness: 0,
            flatness: 0,
            spectralCentroid: 0,
            rawTrebleDelta: 0,
            rawHighMidDelta: 0,
            rawMidDelta: 0,
            now,
            frontLeft,
            frontRight,
            backRight,
            snareAttack: 0,
            backLeft,
            moverLeft,
            moverRight,
            strobeActive: false,
            strobeIntensity: 0,
            // WAVE 4520.2: pure ambient — no audio, no floor/air reaction
            // ambient is driven by morphFactor directly (ocean depth = ambient depth)
            floorIntensity: 0,
            ambientIntensity: Math.min(1.0, morphFactor * 0.60),
            airIntensity: 0,
        };
        this.lastFrame = frame;
        const ambResult = this.routeZones(frame);
        this.lastResult = ambResult;
        return ambResult;
    }
    isAbsoluteChillProfile() {
        if (this.profile.isPureAmbient)
            return true;
        const id = this.profile.id.toLowerCase();
        return id.includes('chill') || id.includes('ambient');
    }
    clearAudioTransients() {
        this._kickVetoFrames = 0;
        this._kickIntervalMs = 0;
        this._lastKickTime = 0;
        this._lastKickImpactTime = 0;
        this._strobeActive = false;
        this.strobeStartTime = 0;
        this.lastTreble = 0;
        this._vocalSustainEMA = 0;
        // 🩸 WAVE 7749.27: _airEMA removed — envAir.reset() handles this in reset()
        // WAVE 7748: Reset HH adapter state
        this._prevHhEnergy = 0;
        this._lastHhOnset = 0;
        this._hhImpulse = 0;
        // WAVE 7749: Reset Sustain Choke state
        this._snareSustainFrames = 0;
        this._snareChokeFactor = 1.0;
        // WAVE 7749.42: Reset TCT re-arm discriminator state
        this._prevRawSnareDelta = 0;
        this._snareReArmed = true;
    }
    applyGlacierPalette(morphFactor) {
        return Math.min(1.0, Math.max(0.0, morphFactor));
    }
    renderPureGlacierPayload(morphFactor, now) {
        return this.applyAmbientGenerative(morphFactor, now);
    }
    // ─────────────────────────────────────────────────────────────────────
    // PRIVATE
    // ─────────────────────────────────────────────────────────────────────
    buildSilenceResult(acidMode, noiseMode) {
        return {
            frontLeftIntensity: 0,
            frontRightIntensity: 0,
            backLeftIntensity: 0,
            backRightIntensity: 0,
            moverLeftIntensity: 0,
            moverRightIntensity: 0,
            strobeActive: false,
            strobeIntensity: 0,
            floorIntensity: 0,
            ambientIntensity: 0,
            airIntensity: 0,
            frontParIntensity: 0,
            backParIntensity: 0,
            moverIntensityL: 0,
            moverIntensityR: 0,
            moverIntensity: 0,
            moverActive: false,
            physicsApplied: 'liquid-stereo',
            acidMode,
            noiseMode,
        };
    }
    calculateStrobe(treble, ultraAir, noiseMode) {
        const now = Date.now();
        const p = this.profile;
        if (this._strobeActive && now - this.strobeStartTime > p.strobeDuration) {
            this._strobeActive = false;
        }
        const effectiveThreshold = noiseMode
            ? p.strobeThreshold * p.strobeNoiseDiscount
            : p.strobeThreshold;
        const isPureTreblePeak = treble > effectiveThreshold;
        const isUltraAirCombo = ultraAir > 0.70 && treble > 0.60;
        if ((isPureTreblePeak || isUltraAirCombo) && !this._strobeActive) {
            this._strobeActive = true;
            this.strobeStartTime = now;
        }
        return {
            active: this._strobeActive,
            intensity: this._strobeActive ? 1.0 : 0,
        };
    }
}
LiquidEngineBase.KICK_COOLDOWN_MS = 150;

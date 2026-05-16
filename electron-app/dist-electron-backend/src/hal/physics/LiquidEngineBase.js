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
// AGC REBOUND — Constante de hardware, invariante entre perfiles
// ═══════════════════════════════════════════════════════════════════════════
const RECOVERY_DURATION = 2000;
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
    };
}
// ═══════════════════════════════════════════════════════════════════════════
// ABSTRACT BASE
// ═══════════════════════════════════════════════════════════════════════════
export class LiquidEngineBase {
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
        // Kick Veto state
        this._kickVetoFrames = 0;
        // Transient Shaper state (WAVE 2427 → WAVE 2446)
        this.lastTreble = 0;
        this.lastHighMid = 0;
        this.lastMid = 0;
        // WAVE 4520.2: 9-zone EMA state
        // Ambient: slow follower of subBass. Attack ~5 frames, release ~33 frames.
        this._ambientEMA = 0;
        // Air: soft-compressed follower of (treble × 0.6 + highMid × 0.4). Attack ~8 frames, release ~20 frames.
        this._airEMA = 0;
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
    }
    // ─────────────────────────────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────────────────────────────
    applyBands(input) {
        const { bands, sectionType = 'drop', isRealSilence, isAGCTrap, harshness = 0.45, flatness = 0.35, } = input;
        const now = Date.now();
        const p = this.profile;
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
            morphFactor = Math.min(1.0, Math.max(0.0, (this.avgMidProfiler - p.morphFloor) / (p.morphCeiling - p.morphFloor)));
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
        const _ambAttackAlpha = Math.min(1.0, 1000 / ((p.ambientAttackMs ?? 800) * 44));
        const _ambReleaseAlpha = Math.min(1.0, 1000 / ((p.ambientReleaseMs ?? 10000) * 44));
        const _ambMix = bands.subBass;
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
        // Air EMA: soft-compressed follower of (treble × 0.6 + highMid × 0.4)
        // Compression: 1 - e^(-x*3) — prevents ultraAir spikes from causing hysterics
        // Attack alpha=0.12 (~8 frames), release alpha=0.05 (~20 frames)
        const _airSignal = 1.0 - Math.exp(-(bands.treble * 0.60 + bands.highMid * 0.40) * 3.0);
        if (_airSignal > this._airEMA) {
            this._airEMA = this._airEMA * 0.88 + _airSignal * 0.12;
        }
        else {
            this._airEMA = this._airEMA * 0.95 + _airSignal * 0.05;
        }
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
        const isKick = input.isKick ?? false;
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
        // --- FRONT R: Kick edge detection (El Francotirador) ---
        // WAVE 2439.2: Candado del Metrónomo — en strict-split, el IntervalBPMTracker
        // es la única fuente de verdad. Si !isKick, energia = 0, sin excepciones.
        // En modo default la energía cruda del isKickEdge puede seguir disparando.
        const kickLocked = this.profile.layout41Strategy === 'strict-split' && !isKick;
        const kickSignal = kickLocked ? 0 : (isKickEdge ? bands.bass : 0);
        let frontRight = this.envKick.process(kickSignal, morphFactor, now, isBreakdown);
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
        const currentTreble = bands.treble;
        const currentHighMid = bands.highMid;
        const currentMid = bands.mid;
        const trebleDelta = Math.max(0, currentTreble - this.lastTreble);
        const highMidDelta = Math.max(0, currentHighMid - this.lastHighMid);
        const midDelta = Math.max(0, currentMid - this.lastMid);
        this.lastTreble = currentTreble;
        this.lastHighMid = currentHighMid;
        this.lastMid = currentMid;
        // 1. Detector de Bofetadas — Transient Shaper Full-Spectrum
        // trebleDelta: hi-hats, crashes, platillos.
        // highMidDelta: rimshot, clap grave, caja minimal.
        // midDelta: snare gordo 808-style, caja con cuerpo, snare acústico.
        // WAVE 2451: midDelta peso morfológico por centroide.
        //   En Anyma (cent > 1500Hz) los synths mid son los "percutores" — midDelta×1.5.
        //   En techno industrial (cent < 500Hz = bombo puro) — midDelta×0.8 como antes.
        // WAVE 4812 M3: ANTI-VOCAL GATE en midDelta.
        //   Si _vocalSustainEMA es alta (vocal sostenida activa) Y midDelta es bajo
        //   (no hay transiente real), penalizar el peso de mid en el transient shaper.
        //   vocalPenalty: 0 cuando la EMA es baja (sin vocales), hasta 0.75 cuando
        //   la EMA es alta y midDelta es menor que la EMA (energía sostenida, no percutiva).
        //   Un snare REAL tiene delta >> EMA — no se ve penalizado.
        const MIN_DELTA = 0.020;
        const midCentWeight = Math.min(1.0, (input.spectralCentroid ?? 0) / 1500);
        const vocalPenalty = Math.min(0.75, this._vocalSustainEMA * Math.max(0, 1.0 - midDelta / Math.max(0.001, this._vocalSustainEMA)));
        const midDeltaGated = midDelta * (1.0 - vocalPenalty);
        const impactDelta = trebleDelta + (highMidDelta * 1.5) + (midDeltaGated * (0.8 + 0.7 * midCentWeight));
        const cleanDelta = Math.max(0, impactDelta - MIN_DELTA);
        const baseSnare = cleanDelta * 2.0;
        const clapBonus = baseSnare * harshness * 2.0;
        let hybridSnare = baseSnare + clapBonus;
        // WAVE 4826.3 — RESCATE DEL GÜIRO: Mover a impactSignal con umbrales realistas
        // (Removido de aquí; ver línea ~480-610 donde se calcula backRight)
        // WAVE 4826.3 — ANTI-VOCAL GATE en hybridSnare (Back R)
        // Permitir pasar si es un impacto fuerte, o si la voz no es dominante.
        // Snares reales tienen trebleDelta alto o hybridSnare alto → pasan.
        if (trebleDelta < vocalPenalty * 0.35 && hybridSnare < 0.6) {
            hybridSnare *= 0.15; // Más estricto que 0.2, menos que 0.1
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
        if (p.layout41Strategy === 'strict-split') {
            // --- WAVE 911 LEGACY → WAVE 2541.3 RECALIBRATION ---
            // Exclusivo para techno industrial en modo strict-split.
            //
            // WAVE 2541.3: RATIO-BASED SEPARATOR
            // The old formula `mid - bass*0.50` was calibrated for raw RMS values
            // (0.01-0.05 range). With WAVE 2541.1 peak normalization (0-1 range),
            // bass=1.0 → bass*0.50=0.50 annihilates mid in most frames.
            //
            // New approach: ratio-based attenuation.
            // When bass dominates (bass > mid), attenuate mid proportionally
            // but NEVER kill it below a floor. The synth mid component is real —
            // it just coexists with kick energy in the 500-2000Hz range.
            //
            // MOVER L = EL OSCURO (500-2000Hz: mid tonal del synth)
            //   bassRatio: how much bass dominates over mid (0=no bass, 1=equal, >1=bass dominant)
            //   attenuation: 1.0 when bass is low, decays to FLOOR when bass is very high
            //   rawMoverL retains mid presence even during kick hits
            //
            // MOVER R = EL TERMINATOR (2kHz - 20kHz: treble puro)
            //   No change needed — treble is independently normalized.
            const calculateMover = (signal, gate, boost) => {
                if (signal < gate)
                    return 0.0;
                const gated = (signal - gate) / (1.0 - gate);
                return Math.min(1.0, Math.max(0, Math.pow(gated, 1.2) * boost));
            };
            // Ratio-based bass separator: mid keeps a floor even when bass dominates
            const BASS_ATTENUATION_FACTOR = 0.60; // How much bass can reduce mid (0=none, 1=full kill)
            const MID_FLOOR = 0.08; // Minimum mid that always survives
            const bassRatio = bands.bass > 0.001 ? Math.min(2.0, bands.bass / Math.max(0.001, bands.mid)) : 0;
            const bassAttenuation = 1.0 - Math.min(BASS_ATTENUATION_FACTOR, bassRatio * 0.30);
            const rawMoverL = Math.max(MID_FLOOR, bands.mid * bassAttenuation);
            const rawMoverR = bands.treble;
            // Gates/boosts recalibrated for 0-1 normalized range (WAVE 2541.3)
            moverLeft = calculateMover(rawMoverL, 0.10, 3.0);
            moverRight = calculateMover(rawMoverR, 0.10, 3.0);
            // Sidechain del kick inline (strict-split: guillotina directa)
            if (isKick) {
                moverLeft *= (1.0 - p.sidechainDepth);
                moverRight *= (1.0 - p.sidechainDepth);
            }
        }
        else {
            // --- ENVELOPE CROSS-FILTER — Motor Parametrizado por Perfil (WAVE 2457) ---
            // Latino, Pop-Rock, Chill, etc. usan su ADN definido en ILiquidProfile.
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
        }
        // --- BACK L (El Coro): WAVE 2417 RESURRECTION → WAVE 2430 PARAMETRIZADO ---
        // WAVE 4812 M3: BACK L VOCAL GATE — vocalPenalty suprime el componente mid
        // cuando hay vocal sostenida. El lowMid se conserva (instrumentos de armonia,
        // sintetizadores de cuerpo) pero el mid puro se atenúa junto con las vocales.
        const midSynthInput = Math.max(0, bands.lowMid * p.backLLowMidWeight + bands.mid * p.backLMidWeight * (1.0 - vocalPenalty * 0.80)
            - bands.treble * p.backLTrebleSub - bands.bass * p.backLBassSub);
        let backLeft = this.envHighMid.process(midSynthInput, morphFactor, now, isBreakdown);
        // moverLeft y moverRight ya calculados arriba (WAVE 911 legacy block)
        // ═══════════════════════════════════════════════════════════════════
        // 7. SIDECHAIN GUILLOTINE
        // ═══════════════════════════════════════════════════════════════════
        // ═══════════════════════════════════════════════════════════════════
        // 7. SIDECHAIN GUILLOTINE
        // ═══════════════════════════════════════════════════════════════════
        // strict-split ya aplico sidechain inline en el bloque WAVE 911 arriba.
        // Para otros perfiles, la Guillotina general actua aqui.
        const frontMax = Math.max(frontLeft, frontRight);
        if (p.layout41Strategy !== 'strict-split' && frontMax > p.sidechainThreshold) {
            const ducking = 1.0 - frontMax * p.sidechainDepth;
            moverLeft *= ducking;
            moverRight *= ducking;
        }
        else if (p.layout41Strategy !== 'strict-split') {
            const isApocalypse = harshness > p.apocalypseHarshness && flatness > p.apocalypseFlatness;
            if (isApocalypse) {
                const chaosEnergy = Math.max(bands.mid, bands.treble);
                backRight = Math.max(backRight, chaosEnergy);
                moverLeft = Math.max(moverLeft, chaosEnergy);
                moverRight = Math.max(moverRight, chaosEnergy);
            }
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
        // ═══════════════════════════════════════════════════════════════════
        // floor: instant reaction to subBass+lowMid, gated by AGC recovery
        const floorIntensity = Math.min(1.0, Math.max(0.0, (bands.subBass * 0.65 + bands.lowMid * 0.35) * recoveryFactor));
        // ambient: slow EMA of subBass, no morphGain baseline — NOT gated by recoveryFactor.
        // WAVE 4812 M2: gain=1.0 — el ambient no tiene onda estática; solo brilla cuando
        // hay energía sub-grave real. El morphFactor ya no infla el baseline.
        const _ambientRaw = Math.min(1.0, Math.max(0.0, this._ambientEMA));
        // 🌊 WAVE 4814: Curva cuadrática (antes cúbica ^3.5) + noise-gate bajado.
        // ^2.0: subBass=0.40 → 0.16, subBass=0.60 → 0.36. El sub-grave real brilla.
        // gate=0.03 (antes 0.15): valores típicos de subBass (0.25-0.50) ahora pasan.
        const _ambientCrushed = Math.pow(_ambientRaw, 2.0);
        // WAVE 4826.3 — PRE-GAIN + CONTRASTE EXTREMO
        // Ganancia pre-curva para compensar falta de graves en latino (1.35x boost)
        // Luego expansión ^1.3 para contraste más suave (es ^1.6 era demasiado agresivo)
        let preGainAmbient = Math.min(1.0, _ambientCrushed * 1.35);
        let ambientIntensity = Math.pow(preGainAmbient, 1.3);
        // WAVE 4826.1 — Reemplazar gate binario por fade exponencial suave para Tungsten en Ambient
        if (ambientIntensity < 0.03) {
            ambientIntensity *= 0.85;
            if (ambientIntensity < 0.001)
                ambientIntensity = 0;
        }
        // air: soft-compressed EMA, gated by AGC recovery to prevent rebound blasts
        // WAVE 4826.3 — BOOST AIR: 1.4x directo para resucitar con brillo
        const airIntensity = Math.min(1.0, Math.max(0.0, this._airEMA * recoveryFactor * 1.4));
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
        this.avgMidProfiler = 0;
        this.lastSilenceTime = 0;
        this.inSilence = false;
        this._strobeActive = false;
        this.strobeStartTime = 0;
        this.lastTreble = 0;
        this._ambientEMA = 0;
        this._airEMA = 0;
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
        this._strobeActive = false;
        this.strobeStartTime = 0;
        this.lastTreble = 0;
        this._vocalSustainEMA = 0;
        this._airEMA = 0;
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

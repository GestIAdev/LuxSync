/**
 * ⚡ WAVE 217: TITAN ENGINE
 * 🧠 WAVE 271: SYNAPTIC RESURRECTION
 *
 * Motor de iluminación reactiva PURO. No conoce DMX ni hardware.
 * Recibe MusicalContext del Cerebro → Devuelve LightingIntent al HAL.
 *
 * FILOSOFÍA:
 * - Este motor es AUTÓNOMO: no depende de Workers, lastColors, ni trinityData
 * - Solo calcula QUÉ queremos expresar, no CÓMO se hace en hardware
 * - Los Vibes definen las restricciones, el motor las respeta
 *
 * 🧠 WAVE 271: STABILIZATION LAYER
 * - KeyStabilizer: Buffer 12s, locking 10s - evita cambios frenéticos de Key
 * - EnergyStabilizer: Rolling 2s, DROP FSM - suaviza energía, detecta drops
 * - MoodArbiter: Buffer 10s, locking 5s - BRIGHT/DARK/NEUTRAL estables
 * - StrategyArbiter: Rolling 15s, locking 15s - Analogous/Complementary estable
 *
 * @layer ENGINE (Motor)
 * @version TITAN 2.0 + WAVE 271
 */
import { EventEmitter } from 'events';
import { createDefaultLightingIntent, withHex, } from '../core/protocol/LightingIntent';
import { SeleneColorEngine } from './color/SeleneColorEngine';
import { getColorConstitution } from './color/colorConstitutions';
import { VibeManager } from './vibe/VibeManager';
// 🧠 WAVE 271: SYNAPTIC RESURRECTION - Stabilization Layer
import { KeyStabilizer } from './color/KeyStabilizer';
import { EnergyStabilizer } from './color/EnergyStabilizer';
import { MoodArbiter } from './color/MoodArbiter';
import { StrategyArbiter } from './color/StrategyArbiter';
// ⚡ WAVE 274: ORGAN HARVEST - Sistema Nervioso (Reactivo a Género)
import { SeleneLux } from '../core/reactivity';
import { getModifiersFromKey } from './physics/ElementalModifiers';
// 🎯 WAVE 343: OPERATION CLEAN SLATE - Movement Manager
import { vibeMovementManager } from './movement/VibeMovementManager';
// 🔦 WAVE 410: OPERATION SYNAPSE RECONNECT - Optics Config
import { getOpticsConfig } from './movement/VibeMovementPresets';
// 🧬 WAVE 500: PROJECT GENESIS - Consciencia Nativa
import { SeleneTitanConscious, } from '../core/intelligence';
// 🧨 WAVE 600: EFFECT ARSENAL - Sistema de Efectos
import { getEffectManager, } from '../core/effects';
// ═══════════════════════════════════════════════════════════════════════════
// TITAN ENGINE CLASS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * ⚡ TITAN ENGINE
 *
 * El corazón del sistema de iluminación reactiva.
 *
 * @example
 * ```typescript
 * const engine = new TitanEngine()
 * engine.setVibe('fiesta-latina')
 *
 * // En el loop:
 * const intent = engine.update(context, audioMetrics)
 * hal.render(intent, fixtures)
 * ```
 */
export class TitanEngine extends EventEmitter {
    // ═══════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════
    constructor(config = {}) {
        super();
        // 🧠 WAVE 271: Cached stabilized state (for telemetry/debug)
        // 🌡️ WAVE 283: Added thermalTemperature for UI sync
        // 🔥 WAVE 642: Added rawEnergy (GAMMA sin tocar)
        this.lastStabilizedState = {
            stableKey: null,
            stableEmotion: 'NEUTRAL',
            stableStrategy: 'analogous',
            rawEnergy: 0, // 🔥 WAVE 642
            smoothedEnergy: 0,
            isDropActive: false,
            thermalTemperature: 4500,
        };
        // 🧬 WAVE 550: Cached consciousness output for telemetry HUD
        this.lastConsciousnessOutput = null;
        // 🧨 WAVE 610: Manual strike trigger (force effect without HuntEngine decision)
        this.manualStrikePending = null;
        // ═══════════════════════════════════════════════════════════════════════
        // 📜 WAVE 560: TACTICAL LOG EMISSION
        // ═══════════════════════════════════════════════════════════════════════
        /**
         * Estado anterior para detectar cambios en Hunt/Prediction
         */
        this.lastHuntState = 'sleeping';
        this.lastPredictionType = null;
        this.lastStrikeCount = 0;
        this.config = {
            targetFps: config.targetFps ?? 60,
            debug: config.debug ?? false,
            // WAVE 255: Force IDLE on startup - system starts in blackout
            initialVibe: config.initialVibe ?? 'idle',
        };
        // Inicializar sub-módulos
        // 🔥 WAVE 269: SeleneColorEngine es estático, no necesita instanciarse
        this.vibeManager = VibeManager.getInstance();
        // 🧠 WAVE 271: SYNAPTIC RESURRECTION - Instanciar Stabilizers
        this.keyStabilizer = new KeyStabilizer();
        this.energyStabilizer = new EnergyStabilizer();
        this.moodArbiter = new MoodArbiter();
        this.strategyArbiter = new StrategyArbiter();
        // ⚡ WAVE 274: ORGAN HARVEST - Sistema Nervioso (Reactivo a Género)
        this.nervousSystem = new SeleneLux({ debug: this.config.debug });
        // 🧬 WAVE 500: PROJECT GENESIS - Consciencia Nativa V2
        this.selene = new SeleneTitanConscious({ debug: this.config.debug });
        // 🧨 WAVE 600: EFFECT ARSENAL - Sistema de Efectos Singleton
        this.effectManager = getEffectManager();
        // Establecer vibe inicial
        this.vibeManager.setActiveVibe(this.config.initialVibe);
        // Inicializar estado
        this.state = {
            currentIntent: createDefaultLightingIntent(),
            lastPalette: this.createDefaultPalette(),
            frameCount: 0,
            lastFrameTime: Date.now(),
            previousEnergy: 0,
            previousBass: 0,
            lastGlobalOverrideState: false, // 🧹 WAVE 930.2: Para evitar spam de logs
        };
        console.log(`[TitanEngine] ⚡ Initialized (WAVE 217 + WAVE 271 SYNAPTIC + WAVE 274 ORGAN HARVEST + WAVE 500 GENESIS + WAVE 600 ARSENAL)`);
        console.log(`[TitanEngine]    Vibe: ${this.config.initialVibe}`);
        console.log(`[TitanEngine]    🧠 Stabilizers: Key✓ Energy✓ Mood✓ Strategy✓`);
        console.log(`[TitanEngine]    ⚡ NervousSystem: SeleneLux✓ (StereoPhysics CONNECTED)`);
        console.log(`[TitanEngine]    🧬 Consciousness: SeleneTitanConscious V2✓ (Native Intelligence)`);
        console.log(`[TitanEngine]    🧨 EffectManager: ${this.effectManager.getState().activeEffects} effects ready`);
    }
    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * 🎯 MÉTODO PRINCIPAL: Actualiza el motor con el contexto musical actual.
     *
     * Este es el punto de entrada del loop de renderizado.
     * Recibe el análisis musical del Cerebro y produce un LightingIntent
     * que describe QUÉ queremos expresar visualmente.
     * 🧬 WAVE 972: ASYNC para permitir DNA Brain sincrónico
     *
     * @param context - Contexto musical del Cerebro (TrinityBrain)
     * @param audio - Métricas de audio en tiempo real
     * @returns LightingIntent para el HAL
     */
    async update(context, audio) {
        const now = Date.now();
        const deltaTime = now - this.state.lastFrameTime;
        this.state.lastFrameTime = now;
        this.state.frameCount++;
        // Obtener perfil del vibe actual
        const vibeProfile = this.vibeManager.getActiveVibe();
        // ─────────────────────────────────────────────────────────────────────
        // 🧠 WAVE 271: STABILIZATION LAYER
        // Procesar datos crudos → datos estabilizados (anti-epilepsia)
        // ─────────────────────────────────────────────────────────────────────
        // 1. ENERGY STABILIZER: Rolling 2s + DROP State Machine
        const energyOutput = this.energyStabilizer.update(context.energy);
        // 2. KEY STABILIZER: Buffer 12s, locking 10s
        const keyInput = {
            key: context.key,
            confidence: context.confidence,
            energy: energyOutput.smoothedEnergy, // Usar energía suavizada para ponderación
        };
        const keyOutput = this.keyStabilizer.update(keyInput);
        // 3. MOOD ARBITER: Buffer 10s, locking 5s → BRIGHT/DARK/NEUTRAL
        const moodInput = {
            mode: context.mode,
            mood: context.mood,
            confidence: context.confidence,
            energy: energyOutput.smoothedEnergy,
            key: keyOutput.stableKey, // Usar key estabilizada
        };
        const moodOutput = this.moodArbiter.update(moodInput);
        // 4. STRATEGY ARBITER: Rolling 15s → Analogous/Complementary/Triadic
        const strategyInput = {
            syncopation: context.syncopation,
            sectionType: context.section.type,
            energy: energyOutput.instantEnergy, // Usar energía instantánea para drops
            confidence: context.confidence,
            isRelativeDrop: energyOutput.isRelativeDrop,
            isRelativeBreakdown: energyOutput.isRelativeBreakdown,
            vibeId: vibeProfile.id,
        };
        const strategyOutput = this.strategyArbiter.update(strategyInput);
        // 🧠 Cachear estado estabilizado (para telemetría y debug)
        // 🌡️ WAVE 283: Ahora incluye thermalTemperature del MoodArbiter
        // 🔥 WAVE 642: Ahora incluye rawEnergy (GAMMA sin tocar)
        this.lastStabilizedState = {
            stableKey: keyOutput.stableKey,
            stableEmotion: moodOutput.stableEmotion,
            stableStrategy: strategyOutput.stableStrategy,
            rawEnergy: energyOutput.rawEnergy, // 🔥 WAVE 642: GAMMA RAW para strikes
            smoothedEnergy: energyOutput.smoothedEnergy,
            isDropActive: energyOutput.isRelativeDrop,
            thermalTemperature: moodOutput.thermalTemperature,
        };
        // Log cambios importantes de estabilización (cada 60 frames si cambio relevante)
        // 🌡️ WAVE 283: Añadido thermalTemperature al log
        if (this.state.frameCount % 60 === 0 && context.energy > 0.05) {
            if (keyOutput.isChanging || moodOutput.emotionChanged || strategyOutput.strategyChanged) {
                console.log(`[TitanEngine 🧠] Stabilization: Key=${keyOutput.stableKey ?? '?'} Emotion=${moodOutput.stableEmotion} Strategy=${strategyOutput.stableStrategy} Temp=${moodOutput.thermalTemperature.toFixed(0)}K`);
            }
        }
        // ─────────────────────────────────────────────────────────────────────
        // 1. 🔥 WAVE 269: CALCULAR PALETA CON SELENE COLOR ENGINE (EL FERRARI)
        //    🧠 WAVE 271: Ahora usa datos ESTABILIZADOS
        // ─────────────────────────────────────────────────────────────────────
        // Construir ExtendedAudioAnalysis desde MusicalContext + Audio + STABILIZED
        const audioAnalysis = {
            timestamp: now,
            frameId: this.state.frameCount,
            // Trinity Core
            bpm: context.bpm,
            onBeat: audio.isBeat,
            beatPhase: context.beatPhase,
            beatStrength: audio.bass,
            // Spectrum
            bass: audio.bass,
            mid: audio.mid,
            treble: audio.high,
            // 🧠 WAVE 271: Top-level usa datos ESTABILIZADOS (no crudos)
            syncopation: context.syncopation,
            // Mood estabilizado: BRIGHT→'bright', DARK→'dark', NEUTRAL→'neutral'
            mood: moodOutput.stableEmotion === 'BRIGHT' ? 'bright' :
                moodOutput.stableEmotion === 'DARK' ? 'dark' : 'neutral',
            // Key ESTABILIZADA (no la cruda que cambia cada frame)
            key: keyOutput.stableKey ?? undefined,
            // Energy SUAVIZADA (no la cruda que parpadea)
            energy: energyOutput.smoothedEnergy,
            vibeId: vibeProfile.id,
            // Wave8 rich data (reconstruido con datos estabilizados)
            wave8: {
                harmony: {
                    key: keyOutput.stableKey, // 🧠 KEY ESTABILIZADA
                    mode: context.mode === 'major' ? 'major' :
                        context.mode === 'minor' ? 'minor' : 'minor',
                    mood: context.mood,
                },
                rhythm: {
                    syncopation: context.syncopation,
                },
                genre: {
                    primary: context.genre.subGenre || context.genre.macro || 'unknown',
                },
                section: {
                    type: context.section.current,
                },
            },
        };
        // Obtener la Constitución del Vibe actual
        const constitution = getColorConstitution(vibeProfile.id);
        // 🎨 GENERAR PALETA CON EL FERRARI
        const selenePalette = SeleneColorEngine.generate(audioAnalysis, constitution);
        // Convertir SelenePalette → ColorPalette
        const palette = this.selenePaletteToColorPalette(selenePalette);
        this.state.lastPalette = palette;
        // Log cromático (cada 60 frames = 1 segundo)
        if (this.state.frameCount % 60 === 0 && audio.energy > 0.05) {
            SeleneColorEngine.logChromaticAudit({ key: context.key, mood: context.mood, energy: context.energy }, selenePalette, vibeProfile.id);
        }
        // ─────────────────────────────────────────────────────────────────────
        // ⚡ WAVE 274: SISTEMA NERVIOSO - Procesar física reactiva por género
        // ─────────────────────────────────────────────────────────────────────
        const elementalMods = getModifiersFromKey(keyOutput.stableKey);
        // Extraer hue primario de la paleta Selene (HSL)
        const primaryHue = selenePalette.primary.h;
        // Actualizar sistema nervioso con datos de la trinidad + paleta + mods zodiacales
        // 🎸 WAVE 1011: Extended audio metrics con FFT para RockStereoPhysics2
        // 🔮 WAVE 1026: ROSETTA STONE - clarity + ultraAir for full spectral awareness
        const nervousOutput = this.nervousSystem.updateFromTitan({
            activeVibe: vibeProfile.id,
            primaryHue: primaryHue,
            stableKey: keyOutput.stableKey,
            bpm: context.bpm,
            section: context.section.type, // 🆕 WAVE 290: Sección para White Puncture
        }, palette, {
            normalizedBass: audio.bass,
            normalizedMid: audio.mid,
            normalizedTreble: audio.high,
            avgNormEnergy: energyOutput.smoothedEnergy,
            // 🎸 WAVE 1011: Métricas espectrales FFT para Rock (harshness, flatness, centroid)
            harshness: audio.harshness,
            spectralFlatness: audio.spectralFlatness,
            spectralCentroid: audio.spectralCentroid,
            // 🔮 WAVE 1026: ROSETTA STONE - Clarity & UltraAir for full spectral integration
            clarity: audio.clarity, // Production quality for Hunt ethics
            ultraAir: audio.ultraAir, // 16-22kHz shimmer for lasers/scanners
            // 🎸 WAVE 1011: Bandas extendidas para 4-band physics
            subBass: audio.subBass,
            lowMid: audio.lowMid,
            highMid: audio.highMid,
            // 🎸 WAVE 1011: Transientes para rock dynamics
            kickDetected: audio.kickDetected,
            snareDetected: audio.snareDetected,
            hihatDetected: audio.hihatDetected,
        }, elementalMods);
        // Log del sistema nervioso (cada 60 frames si hay energía)
        if (this.state.frameCount % 60 === 0 && audio.energy > 0.05) {
            console.log(`[TitanEngine ⚡] NervousSystem: Physics=${nervousOutput.physicsApplied} Strobe=${nervousOutput.isStrobeActive} Element=${elementalMods.elementName}`);
        }
        // ─────────────────────────────────────────────────────────────────────
        // 2. CALCULAR INTENSIDAD GLOBAL
        // ─────────────────────────────────────────────────────────────────────
        const masterIntensity = this.calculateMasterIntensity(audio, vibeProfile);
        // ─────────────────────────────────────────────────────────────────────
        // 3. CALCULAR INTENCIONES POR ZONA
        // 🔥 WAVE 290.1: Si physics=latino, usar zoneIntensities del NervousSystem
        // ⚡ WAVE 290.3: Si physics=techno, usar zoneIntensities del NervousSystem
        // 🎸 WAVE 298.5: Si physics=rock, usar zoneIntensities del NervousSystem
        // 🌊 WAVE 315.3: Si physics=chill, usar zoneIntensities del NervousSystem
        // ─────────────────────────────────────────────────────────────────────
        let zones = this.calculateZoneIntents(audio, context, vibeProfile);
        // 🔥 WAVE 290.1/290.3/298.5/315.3: Latino/Techno/Rock/Chill override - El NervousSystem manda
        // 🧪 WAVE 908: THE DUEL - Si Techno tiene L/R split, respetarlo
        // 🎺 WAVE 1004.1: LATINO STEREO - Si Latino tiene L/R split, respetarlo
        // 🌊 WAVE 1035: CHILL 7-ZONE - Si Chill tiene Front/Back L/R, usarlos
        if (nervousOutput.physicsApplied === 'latino' ||
            nervousOutput.physicsApplied === 'techno' ||
            nervousOutput.physicsApplied === 'rock' ||
            nervousOutput.physicsApplied === 'chill') {
            const ni = nervousOutput.zoneIntensities;
            // 🧪 WAVE 908 + 🎺 WAVE 1004.1: Si tenemos L/R separados (Techno/Latino), usarlos
            const moverL = ni.moverL ?? ni.mover; // Si no hay L, fallback a mono
            const moverR = ni.moverR ?? ni.mover; // Si no hay R, fallback a mono
            // 🌊 WAVE 1035: 7-Zone Stereo - Si Chill tiene Front/Back L/R, usarlos
            // Fallback: Si no hay stereo, usar mono y dividir
            const frontL = ni.frontL ?? (ni.front ?? 0); // Fallback a mono front
            const frontR = ni.frontR ?? (ni.front ?? 0); // Fallback a mono front
            const backL = ni.backL ?? (ni.back ?? 0); // Fallback a mono back
            const backR = ni.backR ?? (ni.back ?? 0); // Fallback a mono back
            // 🌊 WAVE 1035: Si tenemos valores stereo, construir zonas expandidas
            const hasChillStereo = nervousOutput.physicsApplied === 'chill' &&
                (ni.frontL !== undefined || ni.frontR !== undefined);
            if (hasChillStereo) {
                // CHILL 7-ZONE MODE: Todas las zonas stereo
                zones = {
                    // Stereo Front (new)
                    frontL: { intensity: frontL, paletteRole: 'primary' },
                    frontR: { intensity: frontR, paletteRole: 'primary' },
                    // Stereo Back (new)
                    backL: { intensity: backL, paletteRole: 'accent' },
                    backR: { intensity: backR, paletteRole: 'accent' },
                    // Movers (existing stereo)
                    left: { intensity: moverL, paletteRole: 'secondary' },
                    right: { intensity: moverR, paletteRole: 'ambient' },
                    // Legacy mono (for backward compat)
                    front: { intensity: ni.front ?? (frontL + frontR) * 0.5, paletteRole: 'primary' },
                    back: { intensity: ni.back ?? (backL + backR) * 0.5, paletteRole: 'accent' },
                    ambient: { intensity: audio.energy * 0.3, paletteRole: 'ambient' },
                };
                // Log de debug para ver 7-zone en acción
                if (this.state.frameCount % 60 === 0) {
                    console.log(`[TitanEngine �] CHILL 7-ZONE: FL:${(frontL * 100).toFixed(0)}% FR:${(frontR * 100).toFixed(0)}% BL:${(backL * 100).toFixed(0)}% BR:${(backR * 100).toFixed(0)}%`);
                }
            }
            else {
                // LEGACY MODE: Mono front/back + stereo movers
                zones = {
                    front: { intensity: ni.front, paletteRole: 'primary' },
                    back: { intensity: ni.back, paletteRole: 'accent' },
                    left: { intensity: moverL, paletteRole: 'secondary' },
                    right: { intensity: moverR, paletteRole: 'ambient' },
                    ambient: { intensity: audio.energy * 0.3, paletteRole: 'ambient' },
                };
            }
        }
        // ─────────────────────────────────────────────────────────────────────
        // 4. CALCULAR MOVIMIENTO
        // ═══════════════════════════════════════════════════════════════════════
        // 🔧 WAVE 1046: THE MECHANICS BYPASS
        // Si la física envía coordenadas directas (THE DEEP FIELD), usarlas.
        // Si no, delegar al VMM como siempre.
        // ═══════════════════════════════════════════════════════════════════════
        let movement;
        if (nervousOutput.mechanics) {
            // 🔧 MECHANICS BYPASS: La física manda, VMM calla
            // THE DEEP FIELD envía coordenadas 0-1 normalizadas
            const mech = nervousOutput.mechanics;
            // Usar promedio de L/R para el centerX/centerY global
            // (MasterArbiter se encargará del spread per-mover)
            const avgPan = (mech.moverL.pan + mech.moverR.pan) / 2;
            const avgTilt = (mech.moverL.tilt + mech.moverR.tilt) / 2;
            movement = {
                pattern: 'CELESTIAL_MOVERS',
                speed: 0.1, // Lento - la velocidad está implícita en las coordenadas
                amplitude: 0.5, // El amplitud ya está en las coordenadas
                centerX: Math.max(0, Math.min(1, avgPan)),
                centerY: Math.max(0, Math.min(1, avgTilt)),
                beatSync: false, // THE DEEP FIELD no usa beatSync
                // 🔧 WAVE 1046: Include raw L/R coordinates for MasterArbiter stereo routing
                mechanicsL: mech.moverL,
                mechanicsR: mech.moverR,
            };
            // Debug log cada 60 frames (~1s)
            if (this.state.frameCount % 60 === 0) {
                console.log(`[🔧 MECHANICS BYPASS] ${mech.source}: L(${mech.moverL.pan.toFixed(2)},${mech.moverL.tilt.toFixed(2)}) R(${mech.moverR.pan.toFixed(2)},${mech.moverR.tilt.toFixed(2)})`);
            }
        }
        else {
            // Sin mechanics: Delegar al VMM normalmente
            movement = this.calculateMovement(audio, context, vibeProfile);
        }
        // ─────────────────────────────────────────────────────────────────────
        // ─────────────────────────────────────────────────────────────────────
        // 5. CALCULAR EFECTOS ACTIVOS
        // ─────────────────────────────────────────────────────────────────────
        const effects = this.calculateEffects(audio, context, vibeProfile);
        // ─────────────────────────────────────────────────────────────────────
        // 🔦 WAVE 410: RECONEXIÓN ÓPTICA - Recuperar configuración de Zoom/Focus
        // ─────────────────────────────────────────────────────────────────────
        const opticsConfig = getOpticsConfig(vibeProfile.id);
        const optics = {
            zoom: opticsConfig.zoomDefault,
            focus: opticsConfig.focusDefault,
            iris: opticsConfig.irisDefault,
        };
        // ─────────────────────────────────────────────────────────────────────
        // 🧬 WAVE 500: PROJECT GENESIS - Consciencia Nativa V2
        // El cerebro de Selene procesa el estado estabilizado y genera decisiones
        // 🔥 WAVE 642: Ahora incluye rawEnergy (GAMMA sin tocar)
        // ─────────────────────────────────────────────────────────────────────
        const titanStabilizedState = {
            // Contexto del Vibe
            vibeId: vibeProfile.id,
            constitution: constitution,
            // Datos estabilizados (anti-epilepsia)
            stableKey: keyOutput.stableKey,
            stableEmotion: moodOutput.stableEmotion,
            stableStrategy: strategyOutput.stableStrategy,
            rawEnergy: energyOutput.rawEnergy, // 🔥 WAVE 642: GAMMA RAW para strikes
            smoothedEnergy: energyOutput.smoothedEnergy,
            isDropActive: energyOutput.isRelativeDrop,
            thermalTemperature: moodOutput.thermalTemperature,
            // Audio en tiempo real
            bass: audio.bass,
            mid: audio.mid,
            high: audio.high,
            // 🎛️ WAVE 661: Textura espectral (defaults a neutro si no hay datos)
            harshness: audio.harshness ?? 0,
            spectralFlatness: audio.spectralFlatness ?? 0,
            spectralCentroid: audio.spectralCentroid ?? 1000,
            // 🔮 WAVE 1026: ROSETTA STONE - God Ear Signal Integration
            clarity: audio.clarity ?? 0.5, // Default neutral si no disponible
            ultraAir: audio.ultraAir ?? 0, // Default silencio si no disponible
            // Contexto musical
            bpm: context.bpm,
            beatPhase: context.beatPhase,
            syncopation: context.syncopation,
            sectionType: this.normalizeSectionType(context.section.type),
            // Paleta actual
            currentPalette: selenePalette,
            // Timing
            frameId: this.state.frameCount,
            timestamp: now,
        };
        // 🧬 Ejecutar la consciencia (sense → think → dream → validate)
        const consciousnessOutput = await this.selene.process(titanStabilizedState);
        // 🧬 WAVE 550: Cachear output para telemetría HUD
        this.lastConsciousnessOutput = consciousnessOutput;
        // ─────────────────────────────────────────────────────────────────────
        // 📜 WAVE 560: TACTICAL LOG - Emitir eventos de consciencia
        // ─────────────────────────────────────────────────────────────────────
        this.emitConsciousnessLogs(consciousnessOutput, audio.energy);
        // ─────────────────────────────────────────────────────────────────────
        // 🧨 WAVE 600: EFFECT ARSENAL - Procesar Effects
        // ─────────────────────────────────────────────────────────────────────
        // 🧨 WAVE 610: Procesar manual strike si está pendiente (prioridad sobre AI)
        if (this.manualStrikePending) {
            const { effect, intensity } = this.manualStrikePending;
            this.effectManager.trigger({
                effectType: effect,
                intensity,
                source: 'manual',
                reason: 'Manual strike from FORCE STRIKE button',
            });
            console.log(`[TitanEngine] 🧨 MANUAL STRIKE: ${effect} @ ${intensity.toFixed(2)}`);
            this.manualStrikePending = null; // Consumir la flag
        }
        // Si la consciencia decidió disparar un efecto, hacerlo (solo si no hay manual strike)
        else if (consciousnessOutput.effectDecision) {
            const { effectType, intensity, reason, confidence } = consciousnessOutput.effectDecision;
            // Solo disparar si confianza > 0.6
            if (confidence > 0.6) {
                // 🎯 WAVE 685: Inyectar contexto musical para efectos que respiran
                this.effectManager.trigger({
                    effectType,
                    intensity,
                    source: 'hunt_strike', // Disparado por decisión de consciencia/HuntEngine
                    reason,
                    musicalContext: {
                        zScore: this.selene.getEnergyZScore(), // 🧠 Desde SeleneTitanConscious
                        bpm: context.bpm,
                        energy: energyOutput.rawEnergy,
                        vibeId: vibeProfile.id,
                        beatPhase: context.beatPhase,
                        inDrop: titanStabilizedState.sectionType === 'drop',
                    },
                });
                // Log throttled (solo 1 cada 30 frames)
                if (this.state.frameCount % 30 === 0) {
                    console.log(`[TitanEngine] 🧨 Effect triggered: ${effectType} (intensity=${intensity.toFixed(2)}, reason=${reason})`);
                }
            }
        }
        // Update all active effects (EffectManager maneja su propio deltaTime)
        this.effectManager.update();
        // Get aggregated effect output (HTP blending)
        const effectOutput = this.effectManager.getCombinedOutput();
        // ─────────────────────────────────────────────────────────────────────
        // 6. CONSTRUIR LIGHTING INTENT
        // 🧬 WAVE 500: Aplicar decisiones de consciencia
        // ─────────────────────────────────────────────────────────────────────
        // 🧬 Aplicar modificaciones de consciencia a la paleta (si hay decisión)
        let finalPalette = palette;
        if (consciousnessOutput.colorDecision && consciousnessOutput.confidence > 0.5) {
            finalPalette = this.applyConsciousnessColorDecision(palette, consciousnessOutput.colorDecision);
        }
        // 🧬 Aplicar modificaciones de consciencia a los efectos (respetando Energy Override)
        let finalEffects = effects;
        if (consciousnessOutput.physicsModifier && consciousnessOutput.confidence > 0.5) {
            // ⚠️ ENERGY OVERRIDE: Si energía > 0.85, física tiene VETO TOTAL
            if (energyOutput.smoothedEnergy < 0.85) {
                finalEffects = this.applyConsciousnessPhysicsModifier(effects, consciousnessOutput.physicsModifier);
            }
        }
        // 🧨 WAVE 600: Aplicar Effect Arsenal overrides (HTP - Highest Takes Precedence)
        let finalMasterIntensity = masterIntensity;
        if (effectOutput.hasActiveEffects && effectOutput.dimmerOverride !== undefined) {
            // HTP: Solo aplicar si el efecto es más brillante
            finalMasterIntensity = Math.max(masterIntensity, effectOutput.dimmerOverride);
        }
        // 🧨 WAVE 630: GLOBAL OVERRIDE - Si el efecto tiene flag, bypasear zonas
        if (effectOutput.hasActiveEffects && effectOutput.globalOverride) {
            // Override TODAS las zonas al máximo (el efecto manda)
            const overrideIntensity = effectOutput.dimmerOverride ?? 1.0;
            zones = {
                front: { intensity: overrideIntensity, paletteRole: 'primary' },
                back: { intensity: overrideIntensity, paletteRole: 'primary' },
                left: { intensity: overrideIntensity, paletteRole: 'primary' },
                right: { intensity: overrideIntensity, paletteRole: 'primary' },
                ambient: { intensity: overrideIntensity, paletteRole: 'primary' },
            };
            // 🧹 WAVE 930.2: Only log on STATE TRANSITIONS (not every frame)
            if (!this.state.lastGlobalOverrideState) {
                console.log(`[TitanEngine 🧨] GLOBAL OVERRIDE ACTIVATED`);
                this.state.lastGlobalOverrideState = true;
            }
        }
        else if (this.state.lastGlobalOverrideState) {
            // 🧹 WAVE 930.2: Log release only once
            console.log(`[TitanEngine 🧨] GLOBAL OVERRIDE RELEASED`);
            this.state.lastGlobalOverrideState = false;
        }
        // Aplicar color override del efecto (si existe)
        if (effectOutput.hasActiveEffects && effectOutput.colorOverride) {
            // Override completo del color primario con el flare
            const flareColor = effectOutput.colorOverride;
            finalPalette = {
                ...finalPalette,
                primary: {
                    ...finalPalette.primary,
                    h: flareColor.h,
                    s: flareColor.s,
                    l: Math.min(100, flareColor.l * 1.2), // Más brillo
                },
            };
        }
        const intent = {
            palette: finalPalette,
            masterIntensity: finalMasterIntensity, // 🧨 WAVE 600: Puede ser boosteado por efectos
            zones,
            movement,
            optics, // 🔦 WAVE 410: Inyectar configuración óptica
            effects: finalEffects,
            source: 'procedural',
            timestamp: now,
        };
        // ─────────────────────────────────────────────────────────────────────
        // WAVE 257: Throttled debug log (every second = 30 frames)
        // 🔋 WAVE 935: Usar context.energy (normalizado) en lugar de audio.energy (antiguo)
        // 🔇 WAVE 982.5: Silenciado (arqueología del día 2)
        // ─────────────────────────────────────────────────────────────────────
        // if (this.state.frameCount % 30 === 0 && context.energy > 0.05) {
        //   console.log(`[TitanEngine] 🎨 Palette: P=${palette.primary.hex || '#???'} S=${palette.secondary.hex || '#???'} | Energy=${context.energy.toFixed(2)} | Master=${masterIntensity.toFixed(2)}`)
        // }
        // Guardar estado para deltas
        this.state.previousEnergy = context.energy;
        this.state.previousBass = audio.bass;
        this.state.currentIntent = intent;
        // Debug logging
        // � WAVE 982.5: Silenciado (arqueología del día 2)
        // �🔋 WAVE 935: Usar context.energy (normalizado) en lugar de audio.energy
        // if (this.config.debug && this.state.frameCount % 60 === 0) {
        //   console.log(`[TitanEngine] Frame ${this.state.frameCount}:`, {
        //     vibe: vibeProfile.id,
        //     energy: context.energy.toFixed(2),
        //     intensity: masterIntensity.toFixed(2),
        //   })
        // }
        return intent;
    }
    /**
     * Cambia el vibe activo del motor.
     */
    setVibe(vibeId) {
        this.vibeManager.setActiveVibe(vibeId);
        console.log(`[TitanEngine] 🎭 Vibe changed to: ${vibeId}`);
        this.emit('vibe-changed', vibeId);
    }
    /**
     * 🧬 WAVE 500: Kill Switch para la Consciencia
     *
     * Cuando enabled = false, Selene V2 se apaga y el sistema vuelve
     * a física reactiva pura (Layer 0 solamente).
     *
     * @param enabled - true = Consciencia ON, false = Solo Física Reactiva
     */
    setConsciousnessEnabled(enabled) {
        this.selene.setEnabled(enabled);
        console.log(`[TitanEngine] 🧬 Consciousness ${enabled ? 'ENABLED ✅' : 'DISABLED ⏸️'}`);
        this.emit('consciousness-toggled', enabled);
    }
    /**
     * 🧬 WAVE 500: Obtiene estado de la consciencia
     */
    isConsciousnessEnabled() {
        return this.selene.isEnabled();
    }
    /**
     * 🧬 WAVE 550: Obtiene telemetría de consciencia para el HUD táctico
     *
     * Devuelve datos del cerebro de Selene en formato listo para UI.
     */
    getConsciousnessTelemetry() {
        const output = this.lastConsciousnessOutput;
        const isEnabled = this.selene.isEnabled();
        // Si no hay output o la consciencia está deshabilitada, devolver valores por defecto
        if (!output || !isEnabled) {
            return {
                enabled: isEnabled,
                huntState: 'sleeping',
                confidence: 0,
                prediction: null,
                predictionProbability: 0,
                predictionTimeMs: 0,
                beautyScore: 0.5,
                beautyTrend: 'stable',
                consonance: 1,
                lastDecision: null,
                decisionSource: null,
                reasoning: null,
                biasesDetected: [],
                energyOverrideActive: false
            };
        }
        const debugInfo = output.debugInfo;
        const activePred = debugInfo.activePrediction;
        // Construir texto de predicción
        let predictionText = null;
        if (activePred) {
            const pct = Math.round(activePred.probability * 100);
            predictionText = `${activePred.type.toUpperCase()} - ${pct}%`;
        }
        // Determinar última decisión
        let lastDecision = null;
        if (output.colorDecision) {
            lastDecision = 'Palette Adjustment';
        }
        else if (output.physicsModifier) {
            lastDecision = 'Effects Modifier';
        }
        else if (output.movementDecision) {
            lastDecision = 'Movement Change';
        }
        // Determinar si Energy Override está activo
        const energyOverrideActive = this.lastStabilizedState.smoothedEnergy >= 0.85;
        return {
            enabled: true,
            huntState: debugInfo.huntState,
            confidence: output.confidence,
            prediction: predictionText,
            predictionProbability: activePred?.probability ?? 0,
            predictionTimeMs: activePred?.timeUntilMs ?? 0,
            beautyScore: debugInfo.beautyScore,
            beautyTrend: debugInfo.beautyTrend,
            consonance: debugInfo.consonance,
            lastDecision,
            decisionSource: output.source,
            reasoning: debugInfo.reasoning ?? null,
            biasesDetected: debugInfo.biasesDetected,
            energyOverrideActive
        };
    }
    /**
     * Obtiene el vibe actual.
     */
    getCurrentVibe() {
        return this.vibeManager.getActiveVibe().id;
    }
    /**
     * 🧨 WAVE 610: FORCE STRIKE - Manual Effect Detonator
     *
     * Fuerza un disparo de efecto en el próximo frame, sin esperar decisión del HuntEngine.
     * Útil para testeo manual de efectos sin alterar umbrales de algoritmos.
     *
     * @param config - { effect: string, intensity: number }
     * @example engine.forceStrikeNextFrame({ effect: 'solar_flare', intensity: 1.0 })
     */
    forceStrikeNextFrame(config) {
        this.manualStrikePending = config;
        console.log(`[TitanEngine] 🧨 Manual strike queued: ${config.effect} @ ${config.intensity.toFixed(2)}`);
    }
    /**
     * Obtiene el intent actual (para UI/debug).
     */
    getCurrentIntent() {
        return this.state.currentIntent;
    }
    /**
     * Obtiene estadísticas del motor.
     */
    getStats() {
        return {
            frameCount: this.state.frameCount,
            fps: this.config.targetFps,
            vibeId: this.vibeManager.getActiveVibe().id,
        };
    }
    /**
     * 📜 WAVE 560: Emite logs de consciencia para el Tactical Log
     *
     * Solo emite cuando hay cambios de estado significativos, no cada frame.
     */
    emitConsciousnessLogs(output, energy) {
        // No emitir si no hay energía o consciencia deshabilitada
        if (energy < 0.05 || !this.selene.isEnabled())
            return;
        const debug = output.debugInfo;
        const huntState = debug.huntState;
        const activePred = debug.activePrediction;
        // ─────────────────────────────────────────────────────────────────────
        // 🎯 HUNT STATE CHANGES
        // ─────────────────────────────────────────────────────────────────────
        if (huntState !== this.lastHuntState) {
            const huntMessages = {
                'sleeping': '💤 Hunt: Sleeping...',
                'stalking': '🐆 Hunt: Stalking target...',
                'evaluating': '🎯 Hunt: Evaluating worthiness...',
                'striking': '⚡ Hunt: STRIKING!',
                'learning': '📚 Hunt: Learning from strike...',
            };
            this.emit('log', {
                category: 'Hunt',
                message: huntMessages[huntState] || `Hunt: ${huntState}`,
                data: {
                    confidence: Math.round(output.confidence * 100),
                    beauty: Math.round(debug.beautyScore * 100),
                }
            });
            this.lastHuntState = huntState;
        }
        // ─────────────────────────────────────────────────────────────────────
        // 🔮 PREDICTION CHANGES
        // ─────────────────────────────────────────────────────────────────────
        const predType = activePred?.type ?? null;
        if (predType !== this.lastPredictionType && predType !== null) {
            const pct = Math.round((activePred?.probability ?? 0) * 100);
            const timeMs = activePred?.timeUntilMs ?? 0;
            this.emit('log', {
                category: 'Brain',
                message: `🔮 Prediction: ${predType.toUpperCase()} (${pct}%) in ${timeMs}ms`,
                data: {
                    type: predType,
                    probability: pct,
                    timeUntilMs: timeMs,
                }
            });
            this.lastPredictionType = predType;
        }
        else if (predType === null && this.lastPredictionType !== null) {
            // Predicción terminó
            this.emit('log', {
                category: 'Brain',
                message: '🔮 Prediction: Cleared',
            });
            this.lastPredictionType = null;
        }
        // ─────────────────────────────────────────────────────────────────────
        // ⚡ STRIKE EXECUTED (detectado por transición a 'striking')
        // ─────────────────────────────────────────────────────────────────────
        if (huntState === 'striking' && this.lastHuntState !== 'striking') {
            const colorDecision = output.colorDecision;
            this.emit('log', {
                category: 'Hunt',
                message: `⚡ STRIKE EXECUTED: ${colorDecision?.suggestedStrategy ?? 'palette change'}`,
                data: {
                    confidence: Math.round(output.confidence * 100),
                    satMod: colorDecision?.saturationMod?.toFixed(2) ?? 'N/A',
                    brightMod: colorDecision?.brightnessMod?.toFixed(2) ?? 'N/A',
                }
            });
        }
        // ─────────────────────────────────────────────────────────────────────
        // ⚡ ENERGY OVERRIDE (detectado por alta energía + confidence bajo)
        // ─────────────────────────────────────────────────────────────────────
        const isEnergyOverride = this.lastStabilizedState.smoothedEnergy >= 0.85;
        if (isEnergyOverride && this.state.frameCount % 30 === 0) {
            this.emit('log', {
                category: 'Mode',
                message: `⚡ ENERGY OVERRIDE: Physics rules! (${Math.round(this.lastStabilizedState.smoothedEnergy * 100)}%)`,
            });
        }
        // ─────────────────────────────────────────────────────────────────────
        // 💭 DREAM SIMULATION (throttled)
        // ─────────────────────────────────────────────────────────────────────
        if (debug.lastDream && this.state.frameCount % 60 === 0) {
            const dream = debug.lastDream;
            if (dream.recommendation === 'execute') {
                this.emit('log', {
                    category: 'Brain',
                    message: `💭 Dream: Recommending ${dream.scenario.replace(/_/g, ' ')}`,
                    data: {
                        beautyDelta: dream.beautyDelta.toFixed(2),
                    }
                });
            }
        }
    }
    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE: CÁLCULOS INTERNOS
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * 🔥 WAVE 269: Convierte SelenePalette a ColorPalette
     * SelenePalette usa HSL en rango 0-360/0-100, ColorPalette usa 0-1
     */
    selenePaletteToColorPalette(selene) {
        // Función para normalizar HSL de Selene (0-360, 0-100, 0-100) a LightingIntent (0-1)
        const normalizeHSL = (color) => {
            const normalized = {
                h: color.h / 360,
                s: color.s / 100,
                l: color.l / 100,
            };
            return withHex(normalized);
        };
        return {
            primary: normalizeHSL(selene.primary),
            secondary: normalizeHSL(selene.secondary),
            accent: normalizeHSL(selene.accent),
            ambient: normalizeHSL(selene.ambient),
            strategy: selene.meta.strategy,
        };
    }
    /**
     * 🧬 WAVE 500: Normaliza el tipo de sección al formato esperado por TitanStabilizedState
     */
    normalizeSectionType(sectionType) {
        const normalized = sectionType?.toLowerCase() ?? 'unknown';
        // Mapeo de secciones comunes
        const sectionMap = {
            intro: 'intro',
            verse: 'verse',
            chorus: 'chorus',
            drop: 'drop',
            bridge: 'bridge',
            outro: 'outro',
            build: 'build',
            buildup: 'build',
            breakdown: 'breakdown',
            hook: 'chorus',
            prechorus: 'build',
            postchorus: 'verse',
        };
        return sectionMap[normalized] ?? 'unknown';
    }
    /**
     * 🧬 WAVE 500: Aplica decisiones de color de la consciencia a la paleta
     *
     * La consciencia puede modificar saturación y brillo de los colores,
     * pero RESPETA la paleta base generada por SeleneColorEngine.
     */
    applyConsciousnessColorDecision(palette, decision) {
        // Clonar paleta para no mutar
        const newPalette = {
            primary: { ...palette.primary },
            secondary: { ...palette.secondary },
            accent: { ...palette.accent },
            ambient: { ...palette.ambient },
            strategy: palette.strategy,
        };
        // Aplicar modificadores de saturación (0.8-1.2)
        const satMod = decision.saturationMod ?? 1;
        const clampedSatMod = Math.max(0.8, Math.min(1.2, satMod));
        // Aplicar modificadores de brillo (0.8-1.2)
        const brightMod = decision.brightnessMod ?? 1;
        const clampedBrightMod = Math.max(0.8, Math.min(1.2, brightMod));
        // Modificar cada color de la paleta
        for (const role of ['primary', 'secondary', 'accent', 'ambient']) {
            const color = newPalette[role];
            // Aplicar saturación (clamped 0-1)
            color.s = Math.max(0, Math.min(1, color.s * clampedSatMod));
            // Aplicar brillo (clamped 0-1)
            color.l = Math.max(0, Math.min(1, color.l * clampedBrightMod));
        }
        return newPalette;
    }
    /**
     * 🧬 WAVE 500: Aplica modificadores de física de la consciencia a los efectos
     *
     * ⚠️ ESTE MÉTODO SOLO SE LLAMA SI energy < 0.85
     * En drops (energy >= 0.85), la física tiene VETO TOTAL.
     */
    applyConsciousnessPhysicsModifier(effects, modifier) {
        if (!modifier)
            return effects;
        return effects.map(effect => {
            const newEffect = { ...effect };
            // Modificar intensidad de strobe/flash
            if (effect.type === 'strobe' && modifier.strobeIntensity !== undefined) {
                newEffect.intensity *= modifier.strobeIntensity;
            }
            if (effect.type === 'flash' && modifier.flashIntensity !== undefined) {
                newEffect.intensity *= modifier.flashIntensity;
            }
            // Clamp final
            newEffect.intensity = Math.max(0, Math.min(1, newEffect.intensity));
            return newEffect;
        });
    }
    /**
     * Calcula la intensidad global basada en audio y restricciones del vibe.
     */
    calculateMasterIntensity(audio, vibeProfile) {
        const { floor, ceiling } = vibeProfile.dimmer;
        // Mapear energía al rango permitido
        const rawIntensity = audio.energy;
        const mappedIntensity = floor + (rawIntensity * (ceiling - floor));
        return Math.max(0, Math.min(1, mappedIntensity));
    }
    /**
     * Calcula las intenciones de color/intensidad por zona.
     */
    calculateZoneIntents(audio, _context, _vibeProfile) {
        // Distribución básica por zona basada en frecuencias
        const zones = {
            front: {
                intensity: audio.mid * 0.8 + audio.bass * 0.2,
                paletteRole: 'primary',
            },
            back: {
                intensity: audio.bass * 0.6 + audio.energy * 0.4,
                paletteRole: 'accent',
            },
            left: {
                intensity: audio.high * 0.5 + audio.energy * 0.5,
                paletteRole: 'secondary', // 🎨 Mov L → Secondary (Blue)
            },
            right: {
                intensity: audio.high * 0.5 + audio.energy * 0.5,
                paletteRole: 'ambient', // 🎨 WAVE 412: Mov R → Ambient (Cyan)
            },
            ambient: {
                intensity: audio.energy * 0.3,
                paletteRole: 'ambient',
            },
        };
        return zones;
    }
    /**
     * ═══════════════════════════════════════════════════════════════════════════
     * 🎯 WAVE 343: OPERATION CLEAN SLATE
     * ═══════════════════════════════════════════════════════════════════════════
     *
     * Calcula el movimiento de fixtures motorizados.
     *
     * ANTES (WAVE 340-342): Matemática de patrones HARDCODED aquí 🚮
     * AHORA: Delega TODO al VibeMovementManager ✅
     *
     * TitanEngine ya no conoce:
     * - Math.sin/cos para patrones
     * - Frecuencias por vibe
     * - Amplitudes por vibe
     * - Lógica de figure8/mirror/circle/etc
     *
     * Solo sabe: "Oye VMM, dame movimiento para este vibe y audio"
     * ═══════════════════════════════════════════════════════════════════════════
     */
    calculateMovement(audio, context, _vibeProfile) {
        // Obtener vibe actual
        const currentVibeId = this.vibeManager.getActiveVibe().id;
        // Construir contexto de audio para VMM
        // WAVE 345: Incluir beatCount para phrase detection
        // 🔋 WAVE 935: Usar context.energy (normalizado) en lugar de audio.energy
        const vmmContext = {
            energy: context.energy, // 🔋 WAVE 935: Normalizado con AGC
            bass: audio.bass,
            mids: audio.mid,
            highs: audio.high,
            bpm: context.bpm,
            beatPhase: audio.beatPhase,
            beatCount: audio.beatCount || 0,
        };
        // 🎯 DELEGAR al VibeMovementManager
        // WAVE 347: VMM devuelve VMMMovementIntent (x, y), debemos convertir a MovementIntent del protocolo (centerX, centerY)
        const vmmIntent = vibeMovementManager.generateIntent(currentVibeId, vmmContext);
        // ═══════════════════════════════════════════════════════════════════════
        // WAVE 345: Convertir coordenadas con FULL RANGE
        // ═══════════════════════════════════════════════════════════════════════
        // VMM: -1 = extremo izq/arriba, +1 = extremo der/abajo
        // HAL espera: 0 = extremo, 0.5 = centro, 1 = extremo opuesto
        // 
        // ANTES (BUG): * 0.4 limitaba a 80% del rango (¡causa de los 15°!)
        // AHORA: * 0.5 usa 100% del rango
        // ═══════════════════════════════════════════════════════════════════════
        const centerX = 0.5 + (vmmIntent.x * 0.5); // FULL RANGE: 0.0 - 1.0
        const centerY = 0.5 + (vmmIntent.y * 0.5); // FULL RANGE: 0.0 - 1.0
        // 🧹 WAVE 671.5: Silenced TITAN OUT spam (kept for future debug if needed)
        // 🔍 WAVE 347: Debug TitanEngine output (sample 3%)
        // if (Math.random() < 0.03) {
        //   const outPan = Math.round((centerX - 0.5) * 540)
        //   const outTilt = Math.round((centerY - 0.5) * 270)
        //   console.log(`[🔍 TITAN OUT] VMM.x:${vmmIntent.x.toFixed(3)} VMM.y:${vmmIntent.y.toFixed(3)} → centerX:${centerX.toFixed(3)} centerY:${centerY.toFixed(3)} | Pan:${outPan}° Tilt:${outTilt}°`)
        // }
        // Convertir VMMMovementIntent → MovementIntent del protocolo
        const protocolIntent = {
            pattern: vmmIntent.pattern,
            speed: Math.max(0, Math.min(1, vmmIntent.speed)),
            amplitude: vmmIntent.amplitude,
            centerX: Math.max(0, Math.min(1, centerX)), // WAVE 345: Full range 0-1
            centerY: Math.max(0, Math.min(1, centerY)), // WAVE 345: Full range 0-1
            beatSync: true,
            phaseType: vmmIntent.phaseType, // 🔧 WAVE 350: Pasar phaseType del VMM a HAL
        };
        return protocolIntent;
    }
    /**
     * Calcula los efectos activos.
     */
    calculateEffects(audio, _context, vibeProfile) {
        const effects = [];
        const { allowed, maxStrobeRate } = vibeProfile.effects;
        // Strobe en peaks extremos (si está permitido)
        if (allowed.includes('strobe') && maxStrobeRate > 0 && audio.energy > 0.95) {
            effects.push({
                type: 'strobe',
                intensity: audio.energy,
                speed: maxStrobeRate / 20, // Normalizar a 0-1
                duration: 0,
                zones: [],
            });
        }
        return effects;
    }
    /**
     * Crea una paleta por defecto (para inicialización).
     */
    createDefaultPalette() {
        return {
            primary: { h: 0.08, s: 1.0, l: 0.5 }, // Oro
            secondary: { h: 0.95, s: 0.9, l: 0.5 }, // Magenta
            accent: { h: 0.55, s: 1.0, l: 0.5 }, // Cyan
            ambient: { h: 0.08, s: 0.3, l: 0.2 }, // Oro oscuro
        };
    }
    // ═══════════════════════════════════════════════════════════════════════
    // 🧠 WAVE 271: STABILIZATION GETTERS (para telemetría/UI)
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Obtener el estado estabilizado actual (para debug/telemetría)
     */
    getStabilizedState() {
        return { ...this.lastStabilizedState };
    }
    /**
     * Obtener la Key estabilizada (12s buffer, 10s locking)
     */
    getStableKey() {
        return this.lastStabilizedState.stableKey;
    }
    /**
     * Obtener la emoción estabilizada (BRIGHT/DARK/NEUTRAL)
     */
    getStableEmotion() {
        return this.lastStabilizedState.stableEmotion;
    }
    /**
     * Obtener la estrategia de color estabilizada
     */
    getStableStrategy() {
        return this.lastStabilizedState.stableStrategy;
    }
    /**
     * ¿Está activo un DROP?
     */
    isDropActive() {
        return this.lastStabilizedState.isDropActive;
    }
    /**
     * 🌡️ WAVE 283: Obtener la temperatura térmica calculada por MoodArbiter
     */
    getThermalTemperature() {
        return this.lastStabilizedState.thermalTemperature;
    }
    /**
     * 🧹 WAVE 271: Reset de stabilizers (para cambio de canción o vibe)
     */
    resetStabilizers() {
        this.keyStabilizer = new KeyStabilizer();
        this.energyStabilizer = new EnergyStabilizer();
        this.moodArbiter = new MoodArbiter();
        this.strategyArbiter = new StrategyArbiter();
        // 🔥 WAVE 642: Añadido rawEnergy al reset
        this.lastStabilizedState = {
            stableKey: null,
            stableEmotion: 'NEUTRAL',
            stableStrategy: 'analogous',
            rawEnergy: 0, // 🔥 WAVE 642
            smoothedEnergy: 0,
            isDropActive: false,
            thermalTemperature: 4500,
        };
        console.log(`[TitanEngine 🧠] Stabilizers RESET`);
    }
}

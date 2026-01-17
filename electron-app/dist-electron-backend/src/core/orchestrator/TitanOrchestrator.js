/**
 * WAVE 243.5: TITAN ORCHESTRATOR - SIMPLIFIED V2
 * WAVE 374: MASTER ARBITER INTEGRATION
 *
 * Orquesta Brain -> Engine -> Arbiter -> HAL pipeline.
 * main.ts se encarga de IPC handlers, este módulo solo orquesta el flujo de datos.
 *
 * @module TitanOrchestrator
 */
import { TrinityBrain } from '../../brain/TrinityBrain';
import { TitanEngine } from '../../engine/TitanEngine';
import { HardwareAbstraction } from '../../hal/HardwareAbstraction';
import { getEventRouter } from './EventRouter';
import { getTrinity } from '../../workers/TrinityOrchestrator';
import { createDefaultCognitive } from '../protocol/SeleneProtocol';
// 🎭 WAVE 374: Import MasterArbiter
import { masterArbiter } from '../arbiter';
// 🧨 WAVE 635: Import EffectManager para color override global
import { getEffectManager } from '../effects/EffectManager';
/**
 * TitanOrchestrator - Simple orchestration of Brain -> Engine -> HAL
 */
export class TitanOrchestrator {
    constructor(config = {}) {
        this.brain = null;
        this.engine = null;
        this.hal = null;
        this.trinity = null; // 🧠 WAVE 258: Trinity reference
        this.isInitialized = false;
        this.isRunning = false;
        this.mainLoopInterval = null;
        this.frameCount = 0;
        // WAVE 252: Real fixtures from ConfigManager (no more mocks)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.fixtures = [];
        // Vibe rotation for demo
        this.vibeSequence = ['fiesta-latina', 'techno-club', 'pop-rock', 'chill-lounge'];
        this.currentVibeIndex = 0;
        // WAVE 254: Control state
        this.mode = 'auto';
        this.useBrain = true;
        this.inputGain = 1.0;
        // 🧬 WAVE 560: Separated consciousness toggle (Layer 1 only)
        // useBrain = Layer 0 (reactiva) + Layer 1 (consciousness)
        // consciousnessEnabled = ONLY Layer 1 (consciousness)
        this.consciousnessEnabled = true;
        // WAVE 255: Real audio buffer from frontend
        // 🎛️ WAVE 661: Ampliado para incluir textura espectral
        this.lastAudioData = {
            bass: 0, mid: 0, high: 0, energy: 0
        };
        this.hasRealAudio = false;
        // 🗡️ WAVE 265: STALENESS DETECTION - Anti-Simulación
        // Si no llega audio fresco en AUDIO_STALENESS_THRESHOLD_MS, hasRealAudio = false
        // Esto evita que el sistema siga "animando" con datos congelados cuando el frontend muere
        this.lastAudioTimestamp = 0;
        this.AUDIO_STALENESS_THRESHOLD_MS = 500; // 500ms = medio segundo sin audio = stale
        // WAVE 255.5: Callback to broadcast fixture states to frontend
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.onBroadcast = null;
        /**
         * WAVE 257: Set callback for sending logs to frontend (Tactical Log)
         */
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.onLog = null;
        /**
         * 🩸 WAVE 259: RAW VEIN - Process raw audio buffer from frontend
         * This sends the Float32Array directly to BETA Worker for real FFT analysis
         */
        this.audioBufferRejectCount = 0;
        this.config = {
            debug: false,
            // WAVE 255: Force IDLE on startup - system starts in blackout
            initialVibe: 'idle',
            ...config,
        };
        this.eventRouter = getEventRouter();
        console.log('[TitanOrchestrator] Created (WAVE 243.5)');
    }
    /**
     * Initialize all TITAN modules
     */
    async init() {
        if (this.isInitialized) {
            console.log('[TitanOrchestrator] Already initialized');
            return;
        }
        console.log('[TitanOrchestrator] ===============================================');
        console.log('[TitanOrchestrator]   INITIALIZING TITAN 2.0');
        console.log('[TitanOrchestrator] ===============================================');
        // Initialize Brain
        this.brain = new TrinityBrain();
        console.log('[TitanOrchestrator] TrinityBrain created');
        // Connect Brain to Trinity Orchestrator and START the neural network
        try {
            const trinity = getTrinity();
            this.trinity = trinity; // 🧠 WAVE 258: Save reference for audio feeding
            this.brain.connectToOrchestrator(trinity);
            console.log('[TitanOrchestrator] Brain connected to Trinity');
            // 🧠 WAVE 258 CORTEX KICKSTART: Start the Workers!
            console.log('[TitanOrchestrator] 🧠 Starting Trinity Neural Network...');
            await trinity.start();
            console.log('[TitanOrchestrator] ✅ Trinity Workers are LIVE!');
        }
        catch (e) {
            console.error('[TitanOrchestrator] ❌ Trinity startup failed:', e);
            console.log('[TitanOrchestrator] Brain will use simulated context as fallback');
        }
        // Initialize Engine with initial vibe
        this.engine = new TitanEngine({
            debug: this.config.debug,
            initialVibe: this.config.initialVibe
        });
        console.log('[TitanOrchestrator] TitanEngine created');
        // 📜 WAVE 560: Subscribe to TitanEngine log events for Tactical Log
        this.engine.on('log', (logEntry) => {
            this.log(logEntry.category, logEntry.message, logEntry.data);
        });
        console.log('[TitanOrchestrator] 📜 Tactical Log connected to TitanEngine');
        // Initialize HAL
        // 🎨 WAVE 686.10: Pass external driver if provided
        this.hal = new HardwareAbstraction({
            debug: this.config.debug,
            externalDriver: this.config.dmxDriver
        });
        console.log('[TitanOrchestrator] HardwareAbstraction created');
        if (this.config.dmxDriver) {
            console.log('[TitanOrchestrator] 🎨 Using external DMX driver (WAVE 686.10)');
        }
        // 🎭 WAVE 374: Initialize MasterArbiter
        console.log('[TitanOrchestrator] 🎭 MasterArbiter ready (Layer 0-4 arbitration)');
        // TODO: EventRouter connection needs interface alignment
        // this.eventRouter.connect(this.brain, this.engine, this.hal)
        console.log('[TitanOrchestrator] EventRouter ready (direct mode)');
        this.isInitialized = true;
        console.log('[TitanOrchestrator] ===============================================');
        console.log('[TitanOrchestrator]   TITAN 2.0 INITIALIZED');
        console.log('[TitanOrchestrator] ===============================================');
    }
    /**
     * Start the main loop
     */
    start() {
        if (!this.isInitialized) {
            console.error('[TitanOrchestrator] Cannot start - not initialized');
            return;
        }
        if (this.isRunning) {
            console.log('[TitanOrchestrator] Already running');
            return;
        }
        console.log('[TitanOrchestrator] Starting main loop @ 30fps');
        this.isRunning = true;
        this.mainLoopInterval = setInterval(() => {
            this.processFrame();
        }, 33); // ~30fps
        // WAVE 257: Log system start to Tactical Log (delayed to ensure callback is set)
        setTimeout(() => {
            this.log('System', '🚀 TITAN 2.0 ONLINE - Main loop started @ 30fps');
            this.log('Info', `📊 Fixtures loaded: ${this.fixtures.length}`);
        }, 100);
    }
    /**
     * Stop the main loop
     */
    stop() {
        if (this.mainLoopInterval) {
            clearInterval(this.mainLoopInterval);
            this.mainLoopInterval = null;
        }
        this.isRunning = false;
        console.log('[TitanOrchestrator] Stopped');
    }
    /**
     * Process a single frame of the Brain -> Engine -> HAL pipeline
     */
    processFrame() {
        if (!this.brain || !this.engine || !this.hal)
            return;
        this.frameCount++;
        // WAVE 255: No more auto-rotation, system stays in selected vibe
        // Vibe changes only via IPC lux:setVibe
        const shouldLog = this.frameCount % 30 === 0; // Log every ~1 second
        // � WAVE 671.5: Silenced heartbeat spam (every 5s)
        // �🫁 WAVE 266: IRON LUNG - Heartbeat cada 5 segundos (150 frames @ 30fps)
        // const shouldHeartbeat = this.frameCount % 150 === 0
        // if (shouldHeartbeat) {
        //   const timeSinceLastAudio = Date.now() - this.lastAudioTimestamp
        //   console.log(`[Titan] 🫁 Heartbeat #${this.frameCount}: Audio flowing? ${this.hasRealAudio} | Last Packet: ${timeSinceLastAudio}ms ago`)
        // }
        // 1. Brain produces MusicalContext
        const context = this.brain.getCurrentContext();
        // 🗡️ WAVE 265: STALENESS DETECTION - Verificar frescura del audio
        // Si el último audio llegó hace más de AUDIO_STALENESS_THRESHOLD_MS, es stale
        const now = Date.now();
        if (this.hasRealAudio && (now - this.lastAudioTimestamp) > this.AUDIO_STALENESS_THRESHOLD_MS) {
            if (shouldLog) {
                console.warn(`[TitanOrchestrator] ⚠️ AUDIO STALE - no data for ${now - this.lastAudioTimestamp}ms, switching to silence`);
            }
            this.hasRealAudio = false;
            // Reset lastAudioData para no mentir con datos viejos
            // 🎛️ WAVE 661: Incluir reset de textura espectral
            this.lastAudioData = { bass: 0, mid: 0, high: 0, energy: 0, harshness: undefined, spectralFlatness: undefined, spectralCentroid: undefined };
        }
        // 2. WAVE 255: Use real audio if available, otherwise silence (IDLE mode)
        let bass, mid, high, energy;
        if (this.hasRealAudio) {
            bass = this.lastAudioData.bass * this.inputGain;
            mid = this.lastAudioData.mid * this.inputGain;
            high = this.lastAudioData.high * this.inputGain;
            energy = this.lastAudioData.energy * this.inputGain;
        }
        else {
            // Silence - system in standby
            bass = 0;
            mid = 0;
            high = 0;
            energy = 0;
        }
        // For TitanEngine
        // 🎛️ WAVE 661: Incluir textura espectral
        const engineAudioMetrics = {
            bass,
            mid,
            high,
            energy,
            beatPhase: (this.frameCount % 30) / 30,
            isBeat: this.frameCount % 30 === 0 && energy > 0.3,
            harshness: this.lastAudioData.harshness,
            spectralFlatness: this.lastAudioData.spectralFlatness,
            spectralCentroid: this.lastAudioData.spectralCentroid,
        };
        // For HAL
        const halAudioMetrics = {
            rawBass: bass,
            rawMid: mid,
            rawTreble: high,
            energy,
            isRealSilence: false,
            isAGCTrap: false,
        };
        // 3. Engine processes context -> produces LightingIntent
        const intent = this.engine.update(context, engineAudioMetrics);
        // ═══════════════════════════════════════════════════════════════════════════
        // 🎭 WAVE 374: MASTER ARBITER INTEGRATION
        // Instead of sending intent directly to HAL, we now:
        // 1. Feed the intent to Layer 0 (TITAN_AI) of the Arbiter
        // 2. Arbiter merges all layers (manual overrides, effects, blackout)
        // 3. Send arbitrated result to HAL
        // ═══════════════════════════════════════════════════════════════════════════
        // Feed Layer 0: AI Intent
        const titanLayer = {
            intent,
            timestamp: Date.now(),
            vibeId: this.engine.getCurrentVibe(),
            frameNumber: this.frameCount,
        };
        masterArbiter.setTitanIntent(titanLayer);
        // Arbitrate all layers (this merges manual overrides, effects, blackout)
        const arbitratedTarget = masterArbiter.arbitrate();
        // WAVE 380: Debug - verify fixtures are present in loop
        if (this.frameCount === 1 || this.frameCount % 300 === 0) {
            console.log(`[TitanOrchestrator] 🔄 Loop running with ${this.fixtures.length} fixtures in memory`);
            console.log(`[TitanOrchestrator] 🎭 Arbitrated fixtures: ${arbitratedTarget.fixtures.length}`);
        }
        // 4. HAL renders arbitrated target -> produces fixture states
        // Now using the new renderFromTarget method that accepts FinalLightingTarget
        let fixtureStates = this.hal.renderFromTarget(arbitratedTarget, this.fixtures, halAudioMetrics);
        // 🧨 WAVE 635 → WAVE 692.2: EFFECT COLOR OVERRIDE
        // Si hay un efecto activo con globalOverride, usar SU color (no hardcoded dorado)
        const effectManager = getEffectManager();
        const effectOutput = effectManager.getCombinedOutput();
        if (effectOutput.hasActiveEffects && effectOutput.globalOverride && effectOutput.dimmerOverride !== undefined) {
            const flareIntensity = effectOutput.dimmerOverride; // 0-1
            // 🎨 WAVE 692.2: Usar el colorOverride del efecto, fallback a dorado solo para SolarFlare
            let flareR = 255, flareG = 200, flareB = 80; // Default: dorado (SolarFlare legacy)
            if (effectOutput.colorOverride) {
                // Convertir HSL a RGB
                const { h, s, l } = effectOutput.colorOverride;
                const rgb = this.hslToRgb(h, s, l);
                flareR = rgb.r;
                flareG = rgb.g;
                flareB = rgb.b;
            }
            // Override color y dimmer de TODAS las fixtures
            fixtureStates = fixtureStates.map(f => ({
                ...f,
                r: flareR,
                g: flareG,
                b: flareB,
                dimmer: Math.max(f.dimmer, Math.round(flareIntensity * 255)), // HTP dimmer
            }));
            // Log throttled
            if (this.frameCount % 10 === 0) {
                console.log(`[TitanOrchestrator �] EFFECT COLOR: RGB(${flareR},${flareG},${flareB}) @ ${(flareIntensity * 100).toFixed(0)}%`);
            }
        }
        // WAVE 257: Throttled logging to Tactical Log (every second = 30 frames)
        const shouldLogToTactical = this.frameCount % 30 === 0;
        if (shouldLogToTactical && this.hasRealAudio) {
            const avgDimmer = fixtureStates.length > 0
                ? fixtureStates.reduce((sum, f) => sum + f.dimmer, 0) / fixtureStates.length
                : 0;
            const movers = fixtureStates.filter(f => f.zone.includes('MOVING'));
            const avgMover = movers.length > 0 ? movers.reduce((s, f) => s + f.dimmer, 0) / movers.length : 0;
            const frontPars = fixtureStates.filter(f => f.zone === 'FRONT_PARS');
            const avgFront = frontPars.length > 0 ? frontPars.reduce((s, f) => s + f.dimmer, 0) / frontPars.length : 0;
            // Send to Tactical Log
            this.log('Visual', `🎨 P:${intent.palette.primary.hex || '#???'} | Front:${avgFront.toFixed(0)} Mover:${avgMover.toFixed(0)}`, {
                bass, mid, high, energy,
                avgDimmer: avgDimmer.toFixed(0),
                paletteStrategy: intent.palette.strategy
            });
        }
        // 5. WAVE 256: Broadcast VALID SeleneTruth to frontend for StageSimulator
        if (this.onBroadcast) {
            const currentVibe = this.engine.getCurrentVibe();
            // Build a valid SeleneTruth structure
            const truth = {
                system: {
                    frameNumber: this.frameCount,
                    timestamp: Date.now(),
                    deltaTime: 33,
                    targetFPS: 30,
                    actualFPS: 30,
                    mode: this.mode === 'auto' ? 'selene' : 'manual',
                    vibe: currentVibe,
                    brainStatus: 'peaceful',
                    uptime: this.frameCount * 33,
                    titanEnabled: true,
                    sessionId: 'titan-2.0',
                    version: '2.0.0',
                    performance: {
                        audioProcessingMs: 0,
                        brainProcessingMs: 0,
                        colorEngineMs: 0,
                        dmxOutputMs: 0,
                        totalFrameMs: 0
                    }
                },
                sensory: {
                    audio: {
                        energy,
                        peak: energy,
                        average: energy * 0.8,
                        bass,
                        mid,
                        high,
                        spectralCentroid: 0,
                        spectralFlux: 0,
                        zeroCrossingRate: 0
                    },
                    fft: new Array(256).fill(0),
                    beat: {
                        onBeat: engineAudioMetrics.isBeat,
                        confidence: 0.8,
                        bpm: context.bpm || 120,
                        beatPhase: context.beatPhase || 0,
                        barPhase: 0,
                        timeSinceLastBeat: 0
                    },
                    input: {
                        gain: this.inputGain,
                        device: 'Microphone',
                        active: this.hasRealAudio,
                        isClipping: false
                    }
                },
                // 🌡️ WAVE 283: Usar datos REALES del TitanEngine en vez de defaults
                // 🧬 WAVE 550: Añadir telemetría de IA para el HUD táctico
                consciousness: {
                    ...createDefaultCognitive(),
                    stableEmotion: this.engine.getStableEmotion(),
                    thermalTemperature: this.engine.getThermalTemperature(),
                    ai: this.engine.getConsciousnessTelemetry(),
                },
                // 🧠 WAVE 260: SYNAPTIC BRIDGE - Usar el contexto REAL del Brain
                // Antes esto estaba hardcodeado a UNKNOWN/null. Ahora propagamos
                // el contexto que ya obtuvimos de brain.getCurrentContext()
                context: {
                    key: context.key,
                    mode: context.mode,
                    bpm: context.bpm,
                    beatPhase: context.beatPhase,
                    syncopation: context.syncopation,
                    section: context.section,
                    energy: context.energy,
                    mood: context.mood,
                    genre: context.genre,
                    confidence: context.confidence,
                    timestamp: context.timestamp
                },
                intent: {
                    palette: intent.palette,
                    masterIntensity: intent.masterIntensity,
                    zones: intent.zones,
                    movement: intent.movement,
                    effects: intent.effects,
                    source: 'procedural',
                    timestamp: Date.now()
                },
                hardware: {
                    dmx: {
                        connected: true,
                        driver: 'none',
                        universe: 1,
                        frameRate: 30,
                        port: null
                    },
                    dmxOutput: new Array(512).fill(0),
                    fixturesActive: fixtureStates.filter(f => f.dimmer > 0).length,
                    fixturesTotal: fixtureStates.length,
                    // Map HAL FixtureState to Protocol FixtureState
                    // WAVE 256.3: Normalize DMX values (0-255) to frontend values (0-1)
                    // WAVE 256.7: Map zone names for StageSimulator2 compatibility
                    fixtures: fixtureStates.map((f, i) => {
                        // Map HAL zones to StageSimulator2 zones
                        const zoneMap = {
                            'FRONT_PARS': 'front',
                            'BACK_PARS': 'back',
                            'MOVING_LEFT': 'left',
                            'MOVING_RIGHT': 'right',
                            'STROBES': 'center',
                            'AMBIENT': 'center',
                            'FLOOR': 'front',
                            'UNASSIGNED': 'center'
                        };
                        const mappedZone = zoneMap[f.zone] || 'center';
                        // 🩸 WAVE 380: Use REAL fixture ID from this.fixtures, not generated index
                        // This is critical for runtimeStateMap matching in StageSimulator2
                        const originalFixture = this.fixtures[i];
                        const realId = originalFixture?.id || `fix_${i}`;
                        return {
                            id: realId,
                            name: f.name,
                            type: f.type,
                            zone: mappedZone,
                            dmxAddress: f.dmxAddress,
                            universe: f.universe,
                            dimmer: f.dimmer / 255, // Normalize 0-255 → 0-1
                            intensity: f.dimmer / 255, // Normalize 0-255 → 0-1
                            color: {
                                r: Math.round(f.r), // Keep 0-255 for RGB
                                g: Math.round(f.g),
                                b: Math.round(f.b)
                            },
                            pan: f.pan / 255, // Normalize 0-255 → 0-1
                            tilt: f.tilt / 255, // Normalize 0-255 → 0-1
                            // 🔍 WAVE 339: Optics (from HAL/FixtureMapper)
                            zoom: f.zoom, // 0-255 DMX
                            focus: f.focus, // 0-255 DMX
                            // 🎛️ WAVE 339: Physics (interpolated positions from FixturePhysicsDriver)
                            physicalPan: (f.physicalPan ?? f.pan) / 255, // Normalize 0-255 → 0-1
                            physicalTilt: (f.physicalTilt ?? f.tilt) / 255, // Normalize 0-255 → 0-1
                            panVelocity: f.panVelocity ?? 0, // DMX/s (raw)
                            tiltVelocity: f.tiltVelocity ?? 0, // DMX/s (raw)
                            online: true,
                            active: f.dimmer > 0
                        };
                    })
                },
                timestamp: Date.now()
            };
            // 🧹 WAVE 671.5: Silenced BROADCAST debug spam (every 2s)
            // 🔍 WAVE 347.8: Debug broadcast pan/tilt values
            // 🩸 WAVE 380: Updated to show REAL fixture IDs
            // if (this.frameCount % 60 === 0 && truth.hardware.fixtures.length > 0) {
            //   const f0 = truth.hardware.fixtures[0]
            //   const fixtureIds = truth.hardware.fixtures.map(f => f.id).slice(0, 3).join(', ')
            //   console.log(`[📡 BROADCAST] ${truth.hardware.fixtures.length} fixtures | IDs: ${fixtureIds}...`)
            //   console.log(`[📡 BROADCAST] f0.id=${f0.id} | dimmer=${f0.dimmer.toFixed(2)} | R=${f0.color.r} G=${f0.color.g} B=${f0.color.b}`)
            // }
            this.onBroadcast(truth);
            // 🧹 WAVE 671.5: Silenced SYNAPTIC BRIDGE spam (kept for future debug if needed)
            // 🧠 WAVE 260: Debug log para verificar que el contexto fluye a la UI
            // Log cada 2 segundos (60 frames @ 30fps)
            // if (this.frameCount % 60 === 0) {
            //   console.log(
            //     `[Titan] 🌉 SYNAPTIC BRIDGE: Key=${context.key ?? '---'} ${context.mode} | ` +
            //     `Genre=${context.genre.macro}/${context.genre.subGenre ?? 'none'} | ` +
            //     `BPM=${context.bpm} | Energy=${(context.energy * 100).toFixed(0)}%`
            //   )
            // }
        }
        // 🧹 WAVE 671.5: Silenced frame count spam (7-8 logs/sec)
        // Log every second
        // if (shouldLog && this.config.debug) {
        //   const currentVibe = this.engine.getCurrentVibe()
        //   console.log(`[TitanOrchestrator] Frame ${this.frameCount}: Vibe=${currentVibe}, Fixtures=${fixtureStates.length}`)
        // }
    }
    /**
     * Set the current vibe
     * 🎯 WAVE 289: Propagate vibe to Workers for Vibe-Aware Section Tracking
     */
    setVibe(vibeId) {
        if (this.engine) {
            this.engine.setVibe(vibeId);
            console.log(`[TitanOrchestrator] Vibe set to: ${vibeId}`);
            // WAVE 257: Log vibe change to Tactical Log
            this.log('Mode', `🎭 Vibe changed to: ${vibeId.toUpperCase()}`);
            // 🎯 WAVE 289: Propagate vibe to Trinity Workers
            // El SectionTracker en los Workers usará perfiles vibe-aware
            if (this.trinity) {
                this.trinity.setVibe(vibeId);
                console.log(`[TitanOrchestrator] 🎯 WAVE 289: Vibe propagated to Workers`);
            }
            // 🎯 WAVE 338: Propagate vibe to HAL for Movement Physics
            // Los movers usarán física diferente según el vibe
            if (this.hal) {
                this.hal.setVibe(vibeId);
                console.log(`[TitanOrchestrator] 🎛️ WAVE 338: Movement physics updated for vibe`);
            }
        }
    }
    /**
     * WAVE 254: Set mode (auto/manual)
     */
    setMode(mode) {
        this.mode = mode;
        console.log(`[TitanOrchestrator] Mode set to: ${mode}`);
        // WAVE 257: Log mode change to Tactical Log
        this.log('System', `⚙️ Mode: ${mode.toUpperCase()}`);
    }
    /**
     * WAVE 254: Enable/disable brain processing (Layer 0 + Layer 1)
     * 🔴 DEPRECATED for consciousness control - use setConsciousnessEnabled instead
     * This kills EVERYTHING (blackout) - only use for full system stop
     */
    setUseBrain(enabled) {
        this.useBrain = enabled;
        console.log(`[TitanOrchestrator] Brain ${enabled ? 'enabled' : 'disabled'} (FULL SYSTEM)`);
        this.log('System', `🧠 Brain: ${enabled ? 'ONLINE' : 'OFFLINE'}`);
    }
    /**
     * 🧬 WAVE 560: Enable/disable consciousness ONLY (Layer 1)
     *
     * This is the CORRECT toggle for the AI switch:
     * - When OFF: Layer 0 (física reactiva) keeps running
     * - When ON: Layer 1 (consciousness) provides recommendations
     *
     * NO MORE BLACKOUT!
     */
    setConsciousnessEnabled(enabled) {
        this.consciousnessEnabled = enabled;
        // Propagar al TitanEngine (Selene V2)
        if (this.engine) {
            this.engine.setConsciousnessEnabled(enabled);
        }
        console.log(`[TitanOrchestrator] 🧬 Consciousness ${enabled ? 'ENABLED ✅' : 'DISABLED ⏸️'}`);
        this.log('Brain', `🧬 Consciousness: ${enabled ? 'ACTIVE' : 'STANDBY'}`);
    }
    /**
     * 🧬 WAVE 560: Get consciousness state
     */
    isConsciousnessEnabled() {
        return this.consciousnessEnabled;
    }
    /**
     * 🧨 WAVE 610: FORCE STRIKE - Manual Effect Detonator
     *
     * Dispara un efecto manualmente sin esperar decisión de HuntEngine.
     * Útil para testear efectos visuales sin alterar umbrales de los algoritmos.
     *
     * FLOW:
     * 1. Frontend llama window.lux.forceStrike({ effect: 'solar_flare', intensity: 1.0 })
     * 2. IPC handler llama titanOrchestrator.forceStrikeNextFrame(config)
     * 3. Este método llama engine's forceStrikeNextFrame(config)
     * 4. TitanEngine fuerza un trigger de EffectManager en el próximo frame
     *
     * @param config - { effect: string, intensity: number }
     */
    forceStrikeNextFrame(config) {
        if (!this.engine) {
            console.warn('[TitanOrchestrator] 🧨 Cannot force strike - Engine not initialized');
            return;
        }
        console.log(`[TitanOrchestrator] 🧨 FORCE STRIKE: ${config.effect} @ ${config.intensity.toFixed(2)}`);
        this.log('Effect', `🧨 Manual Strike: ${config.effect}`, { intensity: config.intensity });
        // Delegar al TitanEngine
        this.engine.forceStrikeNextFrame(config);
    }
    /**
     * WAVE 254: Set input gain for audio
     */
    setInputGain(gain) {
        this.inputGain = Math.max(0, Math.min(2, gain));
        console.log(`[TitanOrchestrator] Input gain set to: ${this.inputGain}`);
    }
    /**
     * WAVE 255.5: Set callback for broadcasting truth to frontend
     * This enables StageSimulator2 to receive fixture states
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setBroadcastCallback(callback) {
        this.onBroadcast = callback;
        console.log('[TitanOrchestrator] Broadcast callback registered');
    }
    setLogCallback(callback) {
        this.onLog = callback;
        console.log('[TitanOrchestrator] Log callback registered');
    }
    /**
     * WAVE 257: Send a log entry to the frontend Tactical Log
     * @param category - Log category (Brain, Mode, Hunt, Beat, Music, Genre, Visual, DMX, System, Error, Info)
     * @param message - The log message
     * @param data - Optional additional data
     */
    log(category, message, data) {
        if (!this.onLog)
            return;
        this.onLog({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            timestamp: Date.now(),
            category,
            message,
            data: data || null,
            level: category === 'Error' ? 'error' : 'info'
        });
    }
    /**
     * WAVE 255: Process incoming audio frame from frontend
     * This method receives audio data and stores it for the main loop
     * 🎛️ WAVE 661: Ahora incluye textura espectral (harshness, spectralFlatness, spectralCentroid)
     */
    processAudioFrame(data) {
        if (!this.isRunning || !this.useBrain)
            return;
        // Extract audio metrics from incoming data
        const bass = typeof data.bass === 'number' ? data.bass : 0;
        const mid = typeof data.mid === 'number' ? data.mid : 0;
        const high = typeof data.high === 'number' ? data.high :
            typeof data.treble === 'number' ? data.treble : 0;
        const energy = typeof data.energy === 'number' ? data.energy :
            typeof data.volume === 'number' ? data.volume : 0;
        // 🎛️ WAVE 661: Extraer textura espectral
        const harshness = typeof data.harshness === 'number' ? data.harshness : undefined;
        const spectralFlatness = typeof data.spectralFlatness === 'number' ? data.spectralFlatness : undefined;
        const spectralCentroid = typeof data.spectralCentroid === 'number' ? data.spectralCentroid : undefined;
        // Store for main loop (used by TitanEngine for immediate visual response)
        this.lastAudioData = { bass, mid, high, energy, harshness, spectralFlatness, spectralCentroid };
        this.hasRealAudio = energy > 0.01; // Mark as having real audio if not silent
        // 🗡️ WAVE 265: Update timestamp para staleness detection
        this.lastAudioTimestamp = Date.now();
        // 🗡️ WAVE 261.5: PURGA DEL BYPASS
        // ====================================================================
        // ELIMINADO: feedAudioMetrics() - Este era un bypass que enviaba datos
        // directamente a GAMMA sin pasar por BETA, violando WAVE 15.3.
        // 
        // El flujo correcto es:
        //   Frontend → audioBuffer() → BETA (FFT real) → GAMMA (análisis) → Brain
        // 
        // audioFrame() ahora SOLO almacena métricas para el Engine,
        // NO alimenta el análisis musical. Eso lo hace audioBuffer().
        // ====================================================================
        // 🧹 WAVE 671.5: Silenced audio metrics spam (every 1s)
        // if (this.config.debug && this.frameCount % 30 === 0) {
        //   console.log(`[TitanOrchestrator] 👂 Audio metrics stored: bass=${bass.toFixed(2)} mid=${mid.toFixed(2)} energy=${energy.toFixed(2)}`)
        // }
    }
    processAudioBuffer(buffer) {
        // 🔍 WAVE 264.7: LOG CUANDO SE RECHAZA
        if (!this.isRunning || !this.useBrain) {
            this.audioBufferRejectCount++;
            if (this.audioBufferRejectCount % 60 === 1) { // Log cada ~1 segundo
                console.warn(`[TitanOrchestrator] ⛔ audioBuffer REJECTED #${this.audioBufferRejectCount} | isRunning=${this.isRunning} | useBrain=${this.useBrain}`);
            }
            return;
        }
        // 🔍 WAVE 262 DEBUG: Verificar que el buffer llega
        if (this.frameCount % 300 === 0) {
            console.log(`[TitanOrchestrator] 📡 audioBuffer received: ${buffer.length} samples, rms=${Math.sqrt(buffer.reduce((sum, v) => sum + v * v, 0) / buffer.length).toFixed(4)}`);
        }
        // 🗡️ WAVE 265: Update timestamp - el buffer llegando ES la señal de que el frontend vive
        this.lastAudioTimestamp = Date.now();
        // 🩸 Send raw buffer to Trinity -> BETA Worker for FFT
        if (this.trinity) {
            this.trinity.feedAudioBuffer(buffer);
        }
        else {
            console.warn(`[TitanOrchestrator] ⚠️ trinity is null! Buffer discarded.`);
        }
    }
    /**
     * WAVE 252: Set fixtures from ConfigManager (real data, no mocks)
     * WAVE 339.6: Register movers in PhysicsDriver for real interpolated movement
     * WAVE 374: Register fixtures in MasterArbiter
     * WAVE 382: Pass FULL fixture data including capabilities and hasMovementChannels
     * WAVE 686.11: Normalize address field (ShowFileV2 uses "address", legacy uses "dmxAddress")
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setFixtures(fixtures) {
        // 🎨 WAVE 686.11: Normalize address field for ALL downstream consumers (Arbiter + HAL)
        this.fixtures = fixtures.map(f => ({
            ...f,
            dmxAddress: f.dmxAddress || f.address // Ensure dmxAddress exists regardless of format
        }));
        // WAVE 380: Log fixture ingestion
        console.log(`[TitanOrchestrator] 📥 Ingesting ${fixtures.length} fixtures into Engine loop`);
        console.log(`[TitanOrchestrator] 📥 Fixture IDs:`, fixtures.map(f => f.id).slice(0, 5).join(', '), '...');
        // 🎭 WAVE 382: Register fixtures in MasterArbiter with FULL metadata
        // 🎨 WAVE 686.11: Use normalized fixtures (dmxAddress already set above)
        masterArbiter.setFixtures(this.fixtures.map(f => ({
            id: f.id,
            name: f.name,
            zone: f.zone,
            type: f.type || 'generic',
            dmxAddress: f.dmxAddress, // 🎨 WAVE 686.11: Already normalized above
            universe: f.universe || 1,
            capabilities: f.capabilities,
            hasMovementChannels: f.hasMovementChannels,
            channels: f.channels,
        })));
        // 🔥 WAVE 339.6: Register movers in PhysicsDriver
        // Without this, PhysicsDriver doesn't know about the fixtures and returns fallback values
        let moverCount = 0;
        for (const fixture of fixtures) {
            if (fixture.hasMovementChannels) {
                // Register in HAL's physics driver
                if (this.hal) {
                    this.hal.registerMover(fixture.id, fixture.installationType || 'ceiling');
                    moverCount++;
                }
            }
        }
        console.log(`[TitanOrchestrator] Fixtures loaded: ${fixtures.length} total, ${moverCount} movers registered in PhysicsDriver + Arbiter`);
    }
    /**
     * WAVE 252: Get current fixtures count
     */
    getFixturesCount() {
        return this.fixtures.length;
    }
    /**
     * Get current state for diagnostics
     */
    getState() {
        return {
            isInitialized: this.isInitialized,
            isRunning: this.isRunning,
            frameCount: this.frameCount,
            currentVibe: this.engine?.getCurrentVibe() ?? null,
            fixturesCount: this.fixtures.length,
        };
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // 🎨 WAVE 692.2: HSL to RGB conversion for effect colors
    // ═══════════════════════════════════════════════════════════════════════════
    hslToRgb(h, s, l) {
        // h: 0-360, s: 0-100, l: 0-100
        const hNorm = h / 360;
        const sNorm = s / 100;
        const lNorm = l / 100;
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
            const q = lNorm < 0.5
                ? lNorm * (1 + sNorm)
                : lNorm + sNorm - lNorm * sNorm;
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
}
// Singleton instance
let orchestratorInstance = null;
/**
 * Get the TitanOrchestrator singleton
 * WAVE 380: Returns the registered instance (from main.ts) or creates a new one
 */
export function getTitanOrchestrator() {
    if (!orchestratorInstance) {
        console.warn('[TitanOrchestrator] ⚠️ No instance registered, creating new one');
        orchestratorInstance = new TitanOrchestrator();
    }
    return orchestratorInstance;
}
/**
 * WAVE 380: Register an existing instance as the singleton
 * Call this from main.ts after creating the orchestrator
 */
export function registerTitanOrchestrator(instance) {
    if (orchestratorInstance && orchestratorInstance !== instance) {
        console.warn('[TitanOrchestrator] ⚠️ Replacing existing singleton instance');
    }
    orchestratorInstance = instance;
    console.log('[TitanOrchestrator] ✅ Instance registered as singleton');
}

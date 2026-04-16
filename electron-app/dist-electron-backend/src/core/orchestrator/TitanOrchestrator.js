/**
 * WAVE 243.5: TITAN ORCHESTRATOR - SIMPLIFIED V2
 * WAVE 374: MASTER ARBITER INTEGRATION
 * ⚒️ WAVE 2030.4: HEPHAESTUS INTEGRATION
 * 🔒 WAVE 2211: PIPELINE EXORCISM — Async Stampede Guard + IPC Throttle + GC reduction
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
// ❤️ WAVE 1153: THE PACEMAKER - Real Beat Detection
import { BeatDetector } from '../../engine/audio/BeatDetector';
// 🎭 WAVE 700.5.4: Import MoodController for backend mood control
import { MoodController } from '../mood/MoodController';
// ⚒️ WAVE 2030.19: HephaestusRuntime for .lfx execution
import { getHephaestusRuntime } from './IPCHandlers';
// 🧟 ZOMBIE KILLER: singleton DMX para flushing físico en stop()
import { universalDMX } from '../../hal/drivers/UniversalDMXDriver';
// 🧹 WAVE 2227: VMM singleton para cleanup en stop()
import { vibeMovementManager } from '../../engine/movement/VibeMovementManager';
// 🗺️ WAVE 2543.4: Centralized zone resolution
import { fixtureMatchesZone as zoneMapperMatch } from '../zones/ZoneMapper';
/**
 * TitanOrchestrator - Simple orchestration of Brain -> Engine -> HAL
 */
export class TitanOrchestrator {
    constructor(config = {}) {
        this.brain = null;
        this.engine = null;
        this.hal = null;
        this.trinity = null; // 🧠 WAVE 258: Trinity reference
        // ❤️ WAVE 1153: THE PACEMAKER - Heart of the rhythm system
        this.beatDetector = null;
        // 🔥 WAVE 2179: FREEWHEEL MEMORY — Cerebro retiene el último BPM estable del Worker
        // Cuando Worker conf=0 (break, silencio, transición), el PLL freewheela
        // en la frecuencia correcta en lugar de caer al default 120 BPM del Pacemaker.
        // Timeout: 300 frames (~5s a 60fps) → luego cede al Pacemaker interno.
        this.lastStableWorkerBpm = 0;
        this.lastStableWorkerBpmFrame = 0;
        this.FREEWHEEL_TIMEOUT_FRAMES = 125; // ~5s a 25fps
        this.isInitialized = false;
        this.isRunning = false;
        this.mainLoopInterval = null;
        this.frameCount = 0;
        // ═══════════════════════════════════════════════════════════════════════════
        // 🔒 WAVE 2211: ASYNC STAMPEDE GUARD
        // setInterval fires every Xms regardless of whether the previous
        // processFrame() has finished. Since processFrame() is async (await engine.update()),
        // overlapping calls corrupt shared state (HAL dt, arbiter positions, physics).
        // This flag ensures only ONE processFrame() runs at a time.
        // ═══════════════════════════════════════════════════════════════════════════
        this.isProcessingFrame = false;
        // ═══════════════════════════════════════════════════════════════════════════
        // 🔧 DMX TIMING — Frame-drop protection for physical DMX timing
        // DMX512 spec: 1 frame = ~25ms (Break 88µs + MAB 8µs + 512ch × 44µs).
        // Combined with isProcessingFrame (WAVE 2211), the 40ms loop interval
        // guarantees ~13ms of margin for the FTDI chip to drain its buffer before
        // the next frame arrives. No explicit isSendingDMX flag needed: the
        // Stampede Guard already ensures the pipeline is never re-entered.
        // ═══════════════════════════════════════════════════════════════════════════
        // ═══════════════════════════════════════════════════════════════════════════
        // 🗑️ WAVE 2211: PRE-ALLOCATED FFT BUFFER — GC pressure reduction
        // BEFORE: `new Array(256).fill(0)` every frame = 256 floats × 30fps = 7,680 allocs/sec
        // AFTER: Single buffer reused across frames. Zero GC from FFT.
        // ═══════════════════════════════════════════════════════════════════════════
        this.EMPTY_FFT_BUFFER = Object.freeze(new Array(256).fill(0));
        // WAVE 252: Real fixtures from ConfigManager (no more mocks)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.fixtures = [];
        // Vibe rotation for demo
        this.vibeSequence = ['fiesta-latina', 'techno-club', 'pop-rock', 'chill-lounge'];
        this.currentVibeIndex = 0;
        // 🔒 WAVE 2490: THE TIER SEPARATION PROTOCOL — Hephaestus gate
        this._licenseTier = 'FULL_SUITE';
        // WAVE 254: Control state
        this.mode = 'auto';
        this.useBrain = true;
        this.inputGain = 1.0;
        // 🧬 WAVE 560: Separated consciousness toggle (Layer 1 only)
        // useBrain = Layer 0 (reactiva) + Layer 1 (consciousness)
        // consciousnessEnabled = ONLY Layer 1 (consciousness)
        this.consciousnessEnabled = true;
        // WAVE 255: Real audio buffer from frontend
        // 🎸 WAVE 1011: Extended para RockStereoPhysics2 (subBass, lowMid, highMid, transients)
        // 🔥 WAVE 1162: THE BYPASS - rawBassEnergy para BeatDetector
        this.lastAudioData = {
            bass: 0, mid: 0, high: 0, energy: 0
        };
        this.hasRealAudio = false;
        // ═══════════════════════════════════════════════════════════════════════════
        // 🌊 WAVE 1011.5: THE DAM - Exponential Moving Average Smoothing
        // Elimina el "ruido digital" del FFT crudo que causa parpadeo en los Pars
        // ═══════════════════════════════════════════════════════════════════════════
        this.EMA_ALPHA_FAST = 0.25; // Para métricas reactivas (harshness, transients)
        this.EMA_ALPHA_SLOW = 0.08; // Para contexto ambiental (centroid, flatness)
        this.smoothedMetrics = {
            harshness: 0,
            spectralFlatness: 0.5,
            spectralCentroid: 2000,
            subBass: 0,
            lowMid: 0,
            highMid: 0,
            crestFactor: 0, // 💥 WAVE 2347: Relación pico/RMS espectral (kicks vs rolling bass)
        };
        // ═══════════════════════════════════════════════════════════════════════════
        // 🩸 WAVE 2094: PACEMAKER TRANSPLANT — Main-thread syncopation estimator
        // Since BETA worker no longer has beatPhase (Pacemaker is in main thread),
        // syncopation must be estimated HERE using Pacemaker's real beatPhase.
        // Uses same algorithm as SimpleRhythmDetector but with real phase data.
        // ═══════════════════════════════════════════════════════════════════════════
        this.syncopationPhaseHistory = [];
        this.smoothedSyncopation = 0.35; // Neutral default (same as Worker)
        this.SYNC_HISTORY_SIZE = 32;
        this.SYNC_EMA_ALPHA = 0.08; // Same smoothing factor as Worker
        // 🗡️ WAVE 265: STALENESS DETECTION - Anti-Simulación
        // Si no llega audio fresco en AUDIO_STALENESS_THRESHOLD_MS, hasRealAudio = false
        // Esto evita que el sistema siga "animando" con datos congelados cuando el frontend muere
        this.lastAudioTimestamp = 0;
        this.AUDIO_STALENESS_THRESHOLD_MS = 500; // 500ms = medio segundo sin audio = stale
        // 📜 WAVE 1198: THE WARLOG HEARTBEAT - State tracking for tactical logs
        this.hasLoggedFirstAudio = false;
        this.lastLoggedVibe = '';
        this.lastLoggedMood = '';
        this.lastLoggedBrainState = false;
        this.warlogHeartbeatFrame = 0; // For periodic heartbeat logs
        // WAVE 255.5: Callback to broadcast fixture states to frontend
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.onBroadcast = null;
        // ⚡ WAVE 2510: Hot Frame callback — high-frequency fixture data at 44Hz
        // Carries ONLY dynamic fixture data (fixtures array + beat flag + frame number)
        // Separate from full SeleneTruth which broadcasts at ~7Hz
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.onHotFrame = null;
        // ⚡ WAVE 2464: PEAK HOLD — Captura el pico de intensidad del frame skipeado.
        // El throttle frameCount % 2 hace que broadcasts salten 1 de cada 2 frames (40ms).
        // Un beat con decay de 40ms puede nacer y morir en ese frame skipeado — el canvas
        // nunca lo ve. Solución: guardar el dimmer máximo visto entre dos broadcasts.
        // El siguiente broadcast manda el PICO, no el valor actual.
        // RESET: tras cada broadcast, se reinicia a 0 para el siguiente ciclo.
        this.peakHoldMap = new Map(); // fixtureId → peak dimmer (0-255)
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
        // WAVE 2098: Boot silence
    }
    /**
     * 🔒 WAVE 2490: Set license tier — DJ_FOUNDER silences Hephaestus output
     */
    setLicenseTier(tier) {
        this._licenseTier = tier;
    }
    /**
     * Initialize all TITAN modules
     */
    async init() {
        if (this.isInitialized) {
            return;
        }
        // Initialize Brain
        this.brain = new TrinityBrain();
        // Connect Brain to Trinity Orchestrator and START the neural network
        try {
            const trinity = getTrinity();
            this.trinity = trinity; // 🧠 WAVE 258: Save reference for audio feeding
            this.brain.connectToOrchestrator(trinity);
            // ═══════════════════════════════════════════════════════════════════════════
            // 🔥 WAVE 1012.5: HYBRID SOURCE ARCHITECTURE
            // 
            // Frontend (30fps) → bass/mid/high/energy → processAudioFrame()
            // Worker (10fps) → harshness/flatness/centroid/transients → brain.on('audio-levels')
            // 
            // El Worker TAMBIÉN envía bass/mid/high, pero los IGNORAMOS aquí porque
            // el Frontend tiene mayor frecuencia (30fps vs 10fps) y da fluidez visual.
            // El Worker es autoritativo SOLO para métricas FFT extendidas.
            // ═══════════════════════════════════════════════════════════════════════════
            this.brain.on('audio-levels', (levels) => {
                // 🔥 WAVE 1012.5: Worker = SPECTRAL SOURCE ONLY
                // NO sobrescribir bass/mid/high/energy - Frontend tiene prioridad temporal (30fps)
                // SÍ actualizar métricas FFT extendidas - Worker tiene precisión espectral
                this.lastAudioData = {
                    ...this.lastAudioData,
                    // Core bands - IGNORADOS (Frontend es más rápido a 30fps)
                    // bass: levels.bass,     // ❌ Frontend tiene prioridad
                    // mid: levels.mid,       // ❌ Frontend tiene prioridad  
                    // high: levels.treble,   // ❌ Frontend tiene prioridad
                    // energy: levels.energy, // ❌ Frontend tiene prioridad
                    // Extended FFT metrics - WORKER AUTHORITATIVE (precisión espectral)
                    subBass: levels.subBass ?? this.lastAudioData.subBass,
                    lowMid: levels.lowMid ?? this.lastAudioData.lowMid,
                    highMid: levels.highMid ?? this.lastAudioData.highMid,
                    harshness: levels.harshness ?? this.lastAudioData.harshness,
                    spectralFlatness: levels.spectralFlatness ?? this.lastAudioData.spectralFlatness,
                    spectralCentroid: levels.spectralCentroid ?? this.lastAudioData.spectralCentroid,
                    // 💥 WAVE 2347: EL TUBO ARREGLADO — crestFactor llega al lastAudioData
                    crestFactor: levels.crestFactor ?? this.lastAudioData.crestFactor,
                    // Transient detection - WORKER AUTHORITATIVE (detección precisa)
                    kickDetected: levels.kickDetected ?? this.lastAudioData.kickDetected,
                    snareDetected: levels.snareDetected ?? this.lastAudioData.snareDetected,
                    hihatDetected: levels.hihatDetected ?? this.lastAudioData.hihatDetected,
                    // 🔥 WAVE 1162: THE BYPASS - RAW BASS FOR PACEMAKER
                    // Energía de graves SIN normalizar por AGC - crítico para detección de kicks
                    rawBassEnergy: levels.rawBassEnergy ?? this.lastAudioData.rawBassEnergy,
                    // 🔥 WAVE 2112: THE RESURRECTION — Worker BPM is the authority
                    // GodEarBPMTracker runs IN the Worker where FFT data is fresh every ~21ms
                    // WAVE 2130.3: ?? no bloquea 0 — usar guard explícito para preservar BPM bloqueado
                    workerBpm: (levels.bpm != null && levels.bpm > 0) ? levels.bpm : this.lastAudioData.workerBpm,
                    workerBpmConfidence: (levels.bpmConfidence != null && levels.bpmConfidence > 0) ? levels.bpmConfidence : this.lastAudioData.workerBpmConfidence,
                    workerOnBeat: levels.onBeat ?? this.lastAudioData.workerOnBeat,
                    workerBeatPhase: levels.beatPhase ?? this.lastAudioData.workerBeatPhase,
                    workerBeatStrength: levels.beatStrength ?? this.lastAudioData.workerBeatStrength,
                    // 🥁 WAVE 2213: Reconectar el cable roto — kickCount es monotónico, siempre avanza
                    workerKickCount: (levels.kickCount != null && levels.kickCount > 0)
                        ? levels.kickCount
                        : this.lastAudioData.workerKickCount,
                };
            });
            await trinity.start();
        }
        catch (e) {
            console.error('[TitanOrchestrator] ❌ Trinity startup failed:', e);
        }
        // Initialize Engine with initial vibe
        this.engine = new TitanEngine({
            debug: this.config.debug,
            initialVibe: this.config.initialVibe
        });
        this.beatDetector = new BeatDetector({
            sampleRate: 44100,
            fftSize: 2048,
            smoothingTimeConstant: 0.8,
            minBpm: 60,
            maxBpm: 200,
        });
        this.engine.on('log', (logEntry) => {
            this.log(logEntry.category, logEntry.message, logEntry.data);
        });
        this.hal = new HardwareAbstraction({
            debug: this.config.debug,
            // 🔥 WAVE: USB por defecto. Si hay externalDriver, HardwareAbstraction lo usa y este valor no estorba.
            driverType: 'usb',
            externalDriver: this.config.dmxDriver
        });
        this.isInitialized = true;
        // WAVE 2098: Boot silence — all init logs removed, unified banner in main.ts
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
            return;
        }
        this.isRunning = true;
        this.mainLoopInterval = setInterval(() => {
            this.processFrame();
        }, 23); // ⚡ WAVE 2510: 44fps — feeds RenderWorker hot-frames at Nyquist-safe rate
        // Strobes up to 22Hz resolvable. DMX dispatch is hardware-adaptive:
        // Enttec Pro/Art-Net @ 44Hz, generic USB @ 30Hz (separate from tick rate)
        // WAVE 257: Log system start to Tactical Log (delayed to ensure callback is set)
        setTimeout(() => {
            this.log('System', '🚀 TITAN 2.0 ONLINE - Main loop started @ 44fps (WAVE 2510 hot-frame)');
            this.log('Info', `📊 Fixtures loaded: ${this.fixtures.length}`);
        }, 100);
    }
    /**
     * Stop the main loop.
     *
     * 🧟 ZOMBIE KILLER: antes de matar el loop, forzamos un frame de ceros
     * físico al hardware. Sin esto, el último frame de luz queda "congelado"
     * en el buffer FTDI → los cabezales móviles siguen recibiendo su último
     * comando y sus motores oscilan (micro-tug-of-war → pérdida de pasos).
     *
     * Secuencia:
     *   1. Blackout lógico en el HAL (mapper + driver)
     *   2. Flush físico del buffer a cero vía universalDMX.blackout() + sendAll()
     *   3. Espera 30ms para que el chip FTDI drene los bytes al cable RS-485
     *   4. clearInterval + isRunning = false
     */
    async stop() {
        // Paso 1: Blackout lógico en el HAL (si ya fue inicializado)
        if (this.hal) {
            this.hal.setBlackout(true);
        }
        // Paso 2: Forzar buffer de ceros directo al driver serial
        universalDMX.blackout();
        await universalDMX.sendAll();
        // Paso 3: Dar tiempo al chip FTDI para drenar los bytes al cable RS-485
        await new Promise(resolve => setTimeout(resolve, 30));
        // Paso 4: Ahora sí podemos matar el loop sin dejar zombis
        if (this.mainLoopInterval) {
            clearInterval(this.mainLoopInterval);
            this.mainLoopInterval = null;
        }
        this.isRunning = false;
        // ═══════════════════════════════════════════════════════════════════
        // 🧹 WAVE 2227: REACTOR CLEANUP — Purgar estado residual
        // Sin esto, al re-armar el engine retoma desde la fase congelada:
        // VMM con acumuladores viejos, Arbiter con ghost positions, BeatDetector
        // con BPM acumulado. El resultado: saltos de posición al rearmar.
        // ═══════════════════════════════════════════════════════════════════
        // Purgar acumuladores de fase del movement engine
        vibeMovementManager.resetTime();
        // Purgar caches AI del Arbiter (preserva manual overrides + outputEnabled)
        masterArbiter.clearTitanState();
        // Purgar estado acumulado del beat detector
        if (this.beatDetector) {
            this.beatDetector.reset();
        }
    }
    /**
     * Process a single frame of the Brain -> Engine -> HAL pipeline
     */
    /**
     * 🎬 PROCESAR FRAME: El latido del universo
     * 🧬 WAVE 972: ASYNC para DNA Brain sincrónico
     * 🔒 WAVE 2211: ASYNC STAMPEDE GUARD — prevents overlapping processFrame() calls
     */
    async processFrame() {
        // ═══════════════════════════════════════════════════════════════════════
        // 🔒 WAVE 2211: STAMPEDE GUARD
        // setInterval(16) doesn't wait for async completion. If engine.update()
        // takes >16ms, multiple processFrame() calls stack up, corrupting:
        //   - HAL.measurePhysicsDeltaTime() (dt becomes ~0ms for the interloper)
        //   - FixturePhysicsDriver positions (two frames writing simultaneously)
        //   - MasterArbiter state (two arbitrate() calls with different intents)
        // Result: erratic movement, "chill acting like rock", position jumps.
        // FIX: Skip frame if previous is still processing. No data loss —
        //   the NEXT interval will pick up with correct dt measurement.
        // ═══════════════════════════════════════════════════════════════════════
        if (this.isProcessingFrame)
            return;
        this.isProcessingFrame = true;
        try {
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
                // 🎸 WAVE 1011: Incluir reset de bandas extendidas y transientes
                // 🔥 WAVE 1162.2: Incluir reset de rawBassEnergy
                this.lastAudioData = {
                    bass: 0, mid: 0, high: 0, energy: 0,
                    harshness: undefined, spectralFlatness: undefined, spectralCentroid: undefined,
                    subBass: undefined, lowMid: undefined, highMid: undefined,
                    kickDetected: undefined, snareDetected: undefined, hihatDetected: undefined,
                    rawBassEnergy: undefined, // 🔥 WAVE 1162.2: Reset también el bypass
                    // 🔥 WAVE 2213: PRESERVAR MEMORIA DEL WORKER DURANTE EL SILENCIO
                    // Sin esto: workerBpm → undefined → zombie BeatDetector → 200 BPM hardcodeado
                    workerBpm: this.lastAudioData.workerBpm,
                    workerBpmConfidence: this.lastAudioData.workerBpmConfidence,
                    workerOnBeat: false, // Es silencio, no hay beat activo
                    workerBeatPhase: this.lastAudioData.workerBeatPhase,
                    workerBeatStrength: 0,
                    workerKickCount: this.lastAudioData.workerKickCount,
                };
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
            // ═══════════════════════════════════════════════════════════════════════════
            // 🌊 WAVE 1011.5: THE DAM - Apply EMA smoothing to FFT metrics
            // Esto elimina el parpadeo causado por picos/caídas bruscas del FFT crudo
            // Bass/Mid/Treble ya están normalizados por AGC - NO los tocamos
            // ═══════════════════════════════════════════════════════════════════════════
            this.applyEMASmoothing();
            // ═══════════════════════════════════════════════════════════════════════════
            // 🔥 WAVE 2112: THE RESURRECTION — Worker BPM + PLL Flywheel
            // GodEarBPMTracker in Worker is the BPM AUTHORITY (fresh FFT every ~21ms).
            // Pacemaker is DEMOTED to PLL/Flywheel only — no more kick detection here.
            // The old process() was broken: rawBassEnergy arrived at 10fps via IPC,
            // but process() ran at 60fps → same frozen value 6x → transient=0 → BPM chaos.
            // ═══════════════════════════════════════════════════════════════════════════
            let beatState = {
                bpm: 120,
                phase: 0,
                beatCount: 0,
                onBeat: false,
                confidence: 0,
                kickDetected: false,
                snareDetected: false,
                hihatDetected: false,
                // PLL defaults
                pllPhase: 0,
                pllOnBeat: false,
                predictedNextBeatTime: 0,
                phaseError: 0,
                pllLocked: false,
            };
            // 🔥 WAVE 2112: Worker BPM — the source of truth
            const workerBpm = this.lastAudioData.workerBpm ?? 0;
            const workerConfidence = this.lastAudioData.workerBpmConfidence ?? 0;
            const workerOnBeat = this.lastAudioData.workerOnBeat ?? false;
            const workerBeatPhase = this.lastAudioData.workerBeatPhase ?? 0;
            if (this.beatDetector && this.hasRealAudio) {
                // 🔥 WAVE 2112 + WAVE 2179: WORKER BPM → PLL
                // Worker con señal → setBpm() = lock real (PLL anclado a la verdad física)
                // Worker sordo pero memoria reciente → freewheelAt() = inercia correcta
                // Worker sordo Y memoria expirada → PLL cae al Pacemaker interno (120 default)
                // PunkArchytect doctrine: Worker = Oídos (honesto). Cerebro = Memoria (inerte).
                // ═══════════════════════════════════════════════════════════════════════
                if (workerBpm > 0 && workerConfidence > 0.2) {
                    // 🔥 Worker activo: lock real + actualizar memoria
                    this.beatDetector.setBpm(workerBpm);
                    this.lastStableWorkerBpm = workerBpm;
                    this.lastStableWorkerBpmFrame = this.frameCount;
                }
                else {
                    // 🔥 WAVE 2179: Worker sordo → ¿tenemos memoria reciente?
                    const framesSinceStable = this.frameCount - this.lastStableWorkerBpmFrame;
                    if (this.lastStableWorkerBpm > 0 && framesSinceStable <= this.FREEWHEEL_TIMEOUT_FRAMES) {
                        // FREEWHEEL: PLL gira en la frecuencia real, no en 120 BPM
                        this.beatDetector.freewheelAt(this.lastStableWorkerBpm);
                    }
                    // Si el timeout expiró → sin freewheelAt(), PLL se suelta al Pacemaker interno
                }
                // PLL Flywheel: advances phase continuously for smooth beat prediction
                beatState = this.beatDetector.tick(Date.now());
                // Override onBeat with Worker's real detection (PLL can predict, but Worker detects)
                if (workerOnBeat) {
                    beatState.onBeat = true;
                    beatState.kickDetected = true;
                }
                if (this.frameCount % 60 === 0) {
                    const pllInfo = beatState.pllLocked ? 'LOCKED' : 'FREEWHEEL';
                    const syncInfo = this.smoothedSyncopation.toFixed(2);
                    const _framesSinceLog = this.frameCount - this.lastStableWorkerBpmFrame;
                    const freewheelTag = (!beatState.pllLocked && this.lastStableWorkerBpm > 0 && _framesSinceLog <= this.FREEWHEEL_TIMEOUT_FRAMES)
                        ? ` [mem=${this.lastStableWorkerBpm.toFixed(0)}@-${_framesSinceLog}f]`
                        : '';
                    console.log(`[TitanOrchestrator] 🎧 WORKER BPM=${workerBpm.toFixed(0)} conf=${workerConfidence.toFixed(2)} | PLL=${pllInfo}${freewheelTag} phase=${beatState.pllPhase.toFixed(2)} sync=${syncInfo} | beat #${this.lastAudioData.workerKickCount ?? 0}`);
                }
            }
            else if (this.beatDetector) {
                // WAVE 2090.3: THE FLYWHEEL - tick even without audio
                // The metronome keeps spinning on inertia (freewheel mode)
                beatState = this.beatDetector.tick(Date.now());
            }
            // ═══════════════════════════════════════════════════════════════════════════
            //  WAVE 2112: BRIDGE REVERSED — Worker no longer needs SET_BPM
            // ═══════════════════════════════════════════════════════════════════════════
            // 🔥 rBPM INJECTION — cadena de prioridad con freewheel memory (WAVE 2179)
            // ═══════════════════════════════════════════════════════════════════════════
            // Priority chain:
            //   1. Worker activo (conf > 0.2)         → BPM del Worker (verdad física)
            //   2. Worker sordo + memoria reciente    → último BPM estable (inercia)
            //   3. Sin memoria / timeout expirado     → Pacemaker interno (último recurso)
            // ═══════════════════════════════════════════════════════════════════════════
            const _framesSinceStable = this.frameCount - this.lastStableWorkerBpmFrame;
            const hasFreewheelMemory = this.lastStableWorkerBpm > 0 && _framesSinceStable <= this.FREEWHEEL_TIMEOUT_FRAMES;
            if (workerBpm > 0 && workerConfidence > 0.2) {
                // Priority 1: Worker activo
                context.bpm = workerBpm;
                context.beatPhase = beatState.pllLocked
                    ? (beatState.pllPhase ?? beatState.phase)
                    : workerBeatPhase;
                context.syncopation = this.estimateSyncopation(context.beatPhase, bass, mid);
            }
            else if (hasFreewheelMemory) {
                // 🔥 WAVE 2179: Priority 2 — FREEWHEEL MEMORY
                // Las luces no se enteran del break. El show continúa en el BPM real.
                context.bpm = this.lastStableWorkerBpm;
                context.beatPhase = beatState.pllPhase ?? beatState.phase;
                context.syncopation = this.estimateSyncopation(context.beatPhase, bass, mid);
            }
            else if (beatState.bpm > 0 && beatState.confidence > 0) {
                // Priority 3: Pacemaker interno (cuando no hay ningún recuerdo del Worker)
                context.bpm = beatState.bpm;
                context.beatPhase = beatState.pllPhase ?? beatState.phase;
                context.syncopation = this.estimateSyncopation(beatState.pllPhase ?? beatState.phase, bass, mid);
            }
            // For TitanEngine
            // 🎛️ WAVE 661: Incluir textura espectral
            // 🎸 WAVE 1011.5: Usar métricas SUAVIZADAS (no crudas) para evitar parpadeo
            // ❤️ WAVE 1153: beatPhase/isBeat/beatCount FROM REAL PACEMAKER
            // � WAVE 2112: THE RESURRECTION — Worker BPM + PLL phase + Worker transients
            const engineAudioMetrics = {
                bass, // Ya normalizado por AGC - INTOCABLE
                mid, // Ya normalizado por AGC - INTOCABLE
                high, // Ya normalizado por AGC - INTOCABLE
                energy, // Ya normalizado por AGC - INTOCABLE
                // 🔥 WAVE 2112: BPM from Worker (authority), phase from PLL (smooth prediction)
                beatPhase: beatState.pllLocked ? (beatState.pllPhase ?? beatState.phase) : workerBeatPhase,
                // 🛡️ WAVE 2512 FIX 3: IBeat Silence Guard
                // PLL onBeat only propagates as isBeat if the PLL is locked (has real evidence).
                // Redundancy layer: FIX 1 already silences beatState.onBeat in freewheel,
                // but this guard ensures the merge logic itself is architecturally correct.
                isBeat: workerOnBeat || (beatState.pllLocked && beatState.onBeat),
                // 🥁 WAVE 2213: beatCount RECONNECTED — Worker kickCount is the real monotonic counter.
                // beatState.beatCount (PLL) was always 0 because process() was retired in WAVE 2112.
                // The Worker's IntervalBPMTracker.totalKicks is the only real beat counter alive.
                beatCount: this.lastAudioData.workerKickCount ?? beatState.beatCount,
                bpm: workerBpm > 0 ? workerBpm : beatState.bpm,
                beatConfidence: workerConfidence > 0 ? workerConfidence : beatState.confidence,
                // 🌊 WAVE 1011.5: Métricas FFT SUAVIZADAS
                harshness: this.smoothedMetrics.harshness,
                spectralFlatness: this.smoothedMetrics.spectralFlatness,
                spectralCentroid: this.smoothedMetrics.spectralCentroid,
                // 💥 WAVE 2352: crestFactor RAW para physics engines - los transitorios de kick NO se suavizan
                // El EMA destruye el pico que diferencia un bombo de un rolling bass
                crestFactor: this.lastAudioData.crestFactor ?? this.smoothedMetrics.crestFactor,
                // 🎸 WAVE 1011.5: Bandas extendidas SUAVIZADAS
                subBass: this.smoothedMetrics.subBass,
                lowMid: this.smoothedMetrics.lowMid,
                highMid: this.smoothedMetrics.highMid,
                // 🔥 WAVE 2112: Transients from Worker (fresh FFT) — Pacemaker no longer detects kicks
                // 🛡️ WAVE 2512 FIX 2: Kick Signal Veto in Freewheel
                // kickDetected only fires if Worker directly detected OR PLL has a real lock.
                // Prevents phantom Pacemaker kicks from polluting physics engines (LiquidEngineBase isKick).
                kickDetected: workerOnBeat || (beatState.pllLocked && this.lastAudioData.kickDetected),
                snareDetected: this.lastAudioData.snareDetected,
                hihatDetected: this.lastAudioData.hihatDetected,
                // ⏱️ WAVE 2305: THE INFALLIBLE METRONOME — PLL beat prediction
                isPLLBeat: beatState.pllOnBeat,
            };
            // For HAL
            // 🎵 WAVE 2211: Inject REAL beatPhase + BPM from PLL/Worker
            // BEFORE: HAL calculated its own fake beatPhase from hardcoded 120 BPM
            // → optics pulsed at constant 2Hz regardless of actual music tempo
            // → chill-lounge got rock-speed focus punches
            // AFTER: Real PLL phase flows from Worker → Pacemaker → here → HAL
            const halBeatPhase = beatState.pllLocked
                ? (beatState.pllPhase ?? beatState.phase)
                : workerBeatPhase;
            const halBpm = workerBpm > 0 ? workerBpm : beatState.bpm;
            const halAudioMetrics = {
                rawBass: bass,
                rawMid: mid,
                rawTreble: high,
                energy,
                isRealSilence: false,
                isAGCTrap: false,
                beatPhase: halBeatPhase,
                bpm: halBpm,
                // 🎵 WAVE 2720: LA LEY UNIVERSAL DEL PÉNDULO — Propagar bpmConfidence al HAL
                // para que HarmonicQuantizer funcione universalmente en translateColorToWheel()
                bpmConfidence: this.lastAudioData?.workerBpmConfidence ?? 0,
            };
            // 3. Engine processes context -> produces LightingIntent (🧬 DNA Brain now awaited)
            const intent = await this.engine.update(context, engineAudioMetrics);
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
            // ═══════════════════════════════════════════════════════════════════════
            // 🎯 WAVE 2662: EL ÁRBITRO ABSOLUTO — EffectIntents injection
            //
            // BEFORE: Effects mutated fixtureStates AFTER HAL.renderFromTarget().
            //   → Dual pipeline bug: UI saw effects, DMX didn't (ghost effect).
            //
            // NOW: EffectManager produces CombinedEffectOutput (pure function).
            //   → Orchestrator resolves zones → fixture IDs → EffectIntentMap.
            //   → Arbiter consumes intents as Layer 3 during arbitrate().
            //   → HAL.renderFromTarget() sends the COMPLETE target to DMX.
            //   → Single Source of Truth. No post-HAL mutation. Zero ghosts.
            // ═══════════════════════════════════════════════════════════════════════
            const effectManager = getEffectManager();
            const effectOutput = effectManager.getCombinedOutput();
            // Chronos protection: fixtures being painted by Chronos are off-limits
            const chronosFixtureIds = masterArbiter.getPlaybackAffectedFixtureIds();
            if (effectOutput.hasActiveEffects) {
                const intentMap = new Map();
                // ── ZONE OVERRIDES (pinceles finos) ──────────────────────────────
                if (effectOutput.zoneOverrides) {
                    const activeZones = Object.keys(effectOutput.zoneOverrides);
                    for (const zoneId of activeZones) {
                        const zoneData = effectOutput.zoneOverrides[zoneId];
                        const fixtureIds = masterArbiter.getFixtureIdsByZone(zoneId);
                        for (const fixtureId of fixtureIds) {
                            // Skip Chronos-protected fixtures
                            if (chronosFixtureIds.has(fixtureId))
                                continue;
                            // Build the effect intent for this fixture
                            const fixtureIntent = {
                                mixBus: effectOutput.mixBus || 'htp',
                                globalComposition: effectOutput.globalComposition ?? 1,
                            };
                            // Color: HSL → RGB conversion
                            if (zoneData.color) {
                                const rgb = this.hslToRgb(zoneData.color.h, zoneData.color.s, zoneData.color.l);
                                fixtureIntent.color = rgb;
                            }
                            // Dimmer: convert 0-1 → 0-255
                            if (zoneData.dimmer !== undefined) {
                                fixtureIntent.dimmer = Math.round(zoneData.dimmer * 255);
                            }
                            // White/Amber: convert 0-1 → 0-255
                            if (zoneData.white !== undefined) {
                                fixtureIntent.white = Math.round(zoneData.white * 255);
                            }
                            else if (effectOutput.mixBus === 'global') {
                                // 🛡️ WAVE 993: THE IRON CURTAIN — unspecified channels die under global bus
                                fixtureIntent.white = 0;
                            }
                            if (zoneData.amber !== undefined) {
                                fixtureIntent.amber = Math.round(zoneData.amber * 255);
                            }
                            else if (effectOutput.mixBus === 'global') {
                                fixtureIntent.amber = 0;
                            }
                            // Movement: preserve original format for MasterArbiter
                            if (zoneData.movement) {
                                fixtureIntent.movement = {
                                    pan: zoneData.movement.pan !== undefined
                                        ? (zoneData.movement.isAbsolute ? Math.round(zoneData.movement.pan * 255) : Math.round((zoneData.movement.pan - 0.5) * 255))
                                        : undefined,
                                    tilt: zoneData.movement.tilt !== undefined
                                        ? (zoneData.movement.isAbsolute ? Math.round(zoneData.movement.tilt * 255) : Math.round((zoneData.movement.tilt - 0.5) * 255))
                                        : undefined,
                                    isAbsolute: zoneData.movement.isAbsolute,
                                };
                            }
                            // Merge: if fixture already has an intent (from another zone), keep highest priority
                            const existing = intentMap.get(fixtureId);
                            if (existing) {
                                // HTP merge for dimmer, LTP for color (last zone wins)
                                if (fixtureIntent.dimmer !== undefined && existing.dimmer !== undefined) {
                                    fixtureIntent.dimmer = Math.max(fixtureIntent.dimmer, existing.dimmer);
                                }
                            }
                            intentMap.set(fixtureId, fixtureIntent);
                        }
                    }
                }
                // ── GLOBAL BROCHA GORDA (legacy: one color for all affected fixtures) ──
                if (!effectOutput.zoneOverrides && effectOutput.dimmerOverride !== undefined) {
                    // Determine affected fixture IDs
                    const zones = effectOutput.zones || [];
                    const globalComp = effectOutput.globalComposition ?? 0;
                    // Color: use colorOverride or default dorado
                    let color = { r: 255, g: 200, b: 80 }; // Default dorado (SolarFlare legacy)
                    if (effectOutput.colorOverride) {
                        color = this.hslToRgb(effectOutput.colorOverride.h, effectOutput.colorOverride.s, effectOutput.colorOverride.l);
                    }
                    for (let i = 0; i < this.fixtures.length; i++) {
                        const fixture = this.fixtures[i];
                        if (!fixture?.id)
                            continue;
                        if (chronosFixtureIds.has(fixture.id))
                            continue;
                        // Check if this fixture should be affected
                        let shouldApply = false;
                        if (globalComp > 0) {
                            shouldApply = true; // globalComposition affects ALL fixtures
                        }
                        else if (zones.length > 0) {
                            const fixtureZone = (fixture.zone || '').toLowerCase();
                            const positionX = fixture.position?.x ?? 0;
                            for (const zone of zones) {
                                if (this.fixtureMatchesZoneStereo(fixtureZone, zone, positionX)) {
                                    shouldApply = true;
                                    break;
                                }
                            }
                        }
                        if (!shouldApply)
                            continue;
                        intentMap.set(fixture.id, {
                            dimmer: Math.round(effectOutput.dimmerOverride * 255),
                            color,
                            mixBus: effectOutput.mixBus || 'htp',
                            globalComposition: globalComp,
                        });
                    }
                }
                // ── MOVEMENT OVERRIDE (global fallback for all movers) ──
                // 🚫 WAVE 2900: CHRONOS SELECTIVE SEAL — La IA tiene prohibido emitir movimiento.
                // movementOverride proviene de Core Effects procedurales (IA/Selene).
                // El movimiento de movers es exclusivo del usuario (Hephaestus/XY pad/manual override).
                // Este bloque queda desactivado permanentemente.
                // if (effectOutput.movementOverride) { ... }
                // ═══════════════════════════════════════════════════════════════════
                // 🎵 WAVE 2672→2720: HARMONIC QUANTIZER — MIGRADO AL HAL
                // La cuantización armónica ahora vive en HAL.translateColorToWheel()
                // (LA LEY UNIVERSAL DEL PÉNDULO). Toda orden de color dirigida a un
                // fixture mecánico es cuantizada en HAL, sin importar la fuente:
                // Titan, Chronos, Timeline, UI Manual — TODOS son gateados.
                // El bloque de cuantización por efecto en Titan ya no es necesario.
                // ═══════════════════════════════════════════════════════════════════
                // Inject intents into the Arbiter BEFORE arbitration
                masterArbiter.setEffectIntents(intentMap);
                // Throttled telemetry
                if (this.frameCount % 60 === 0 && intentMap.size > 0) {
                    console.log(`[TitanOrchestrator 🎯] WAVE 2662: ${intentMap.size} effect intents injected | mixBus=${effectOutput.mixBus} | globalComp=${(effectOutput.globalComposition ?? 0).toFixed(2)}`);
                }
            }
            // Arbitrate all layers (this merges manual overrides, effects, blackout)
            const arbitratedTarget = masterArbiter.arbitrate();
            // ═══════════════════════════════════════════════════════════════════════
            // 🔎 FORENSIC TRACE (CP2): Arbiter → HAL handoff snapshot
            // Enabled via env: LUXSYNC_TRACE_DMX=1 (optional LUXSYNC_TRACE_DMX_EVERY)
            // Optional focus: LUXSYNC_TRACE_FIXTURE_ID=<fixtureId>
            // ═══════════════════════════════════════════════════════════════════════
            try {
                const traceEnabled = String(process?.env?.LUXSYNC_TRACE_DMX ?? '') === '1';
                if (traceEnabled) {
                    const everyRaw = Number.parseInt(String(process?.env?.LUXSYNC_TRACE_DMX_EVERY ?? ''), 10);
                    const every = Number.isFinite(everyRaw) && everyRaw > 0 ? everyRaw : 60;
                    if (this.frameCount % every === 0) {
                        const traceFixtureId = process?.env?.LUXSYNC_TRACE_FIXTURE_ID
                            ? String(process.env.LUXSYNC_TRACE_FIXTURE_ID)
                            : undefined;
                        // const traced = traceFixtureId
                        //   ? arbitratedTarget.fixtures.find(f => f.fixtureId === traceFixtureId)
                        //   : null
                        // 🔎 TRACE CP2 DISABLED: Remove this for now; keeping CP3 + CP4 for final mile forensics
                    }
                }
            }
            catch {
                // never block the render loop
            }
            // 📜 WAVE 1198: WARLOG HEARTBEAT - Periodic status every ~4 seconds (240 frames at 60fps)
            // 🎛️ WAVE 1198.8: De 120 a 240 frames para reducir spam
            this.warlogHeartbeatFrame++;
            if (this.warlogHeartbeatFrame >= 240) {
                this.warlogHeartbeatFrame = 0;
                const currentVibe = this.engine.getCurrentVibe();
                const brainEnabled = this.useBrain;
                const audioStatus = this.hasRealAudio ? 'LIVE' : 'SILENT';
                const bpm = context.bpm || 120;
                // Emit heartbeat log
                this.log('System', `💓 HEARTBEAT: ${audioStatus} | ${bpm} BPM | ${currentVibe.toUpperCase()}`, {
                    audioActive: this.hasRealAudio,
                    bpm,
                    vibe: currentVibe,
                    brainEnabled,
                    fixtureCount: this.fixtures.length,
                });
            }
            // WAVE 380: Debug - verify fixtures are present in loop (WAVE 2098: silenced)
            // 4. HAL renders arbitrated target -> produces fixture states
            // Now using the new renderFromTarget method that accepts FinalLightingTarget
            // 🔧 DMX TIMING: isProcessingFrame (WAVE 2211) garantiza que este bloque
            // no se ejecuta en paralelo. El intervalo de 40ms da ~13ms de margen
            // sobre el frame DMX512 físico (~27ms), eliminando el corrupting de Break/MAB.
            let fixtureStates = this.hal.renderFromTarget(arbitratedTarget, this.fixtures, halAudioMetrics);
            // ═══════════════════════════════════════════════════════════════════════
            // � WAVE 2662: POST-HAL MUTATION ELIMINATED
            //
            // BEFORE (WAVE 635 → 993 → 2065): ~500 lines of zone overrides, brocha gorda,
            // stereo movement, movement override — all mutating fixtureStates post-HAL.
            // This was the root cause of ghost effects (WAVE 2660): UI got the mutation,
            // DMX didn't (conditional re-send gated behind Hephaestus).
            //
            // NOW: Effects are injected as EffectIntents BEFORE arbitrate().
            // The Arbiter produces a FinalLightingTarget that ALREADY includes effects.
            // HAL.renderFromTarget() sends the COMPLETE truth to DMX.
            // Single Source of Truth. Zero ghosts. Clean cascade.
            //
            // The only post-HAL mutation that remains is Hephaestus (.lfx clips),
            // which has its own legitimate re-send path.
            // ═══════════════════════════════════════════════════════════════════════
            // Chronos telemetry (post-HAL, for diagnostics only)
            const isChronosPlaying = masterArbiter.isPlaybackActive();
            if (isChronosPlaying && this.frameCount % 300 === 1) {
                const f0 = fixtureStates[0];
                console.log(`[TitanOrchestrator 🎬] CHRONOS OVERLAY: ${chronosFixtureIds.size}/${fixtureStates.length} fixtures protected | ` +
                    `f0: dim=${f0?.dimmer} RGB(${f0?.r},${f0?.g},${f0?.b})`);
            }
            // WAVE 257: Throttled logging to Tactical Log (every 4 seconds = 240 frames @ 60fps)
            // 🎛️ WAVE 1198.8: De 120 a 240 frames para reducir spam
            const shouldLogToTactical = this.frameCount % 240 === 0;
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
            // ═══════════════════════════════════════════════════════════════════════════
            // ⚒️ WAVE 2030.19: THE MERGER - HephaestusRuntime Integration
            // Evaluate all active .lfx clips and merge their outputs with DMX
            // 
            // MERGE STRATEGY:
            //   - Intensity/Dimmer: HTP (Highest Takes Precedence)
            //   - Color (RGB): LTP (Hephaestus overwrites if present)
            //   - Pan/Tilt: Overlay (Hephaestus controls movement if present)
            //   - Strobe: Additive (sum clamped to max)
            //
            // 🎬 WAVE 2065: Heph always runs. Per-fixture Chronos check applied inside.
            // ═══════════════════════════════════════════════════════════════════════════
            const hephRuntime = getHephaestusRuntime();
            const hephOutputs = hephRuntime.tick(Date.now());
            // 🔒 WAVE 2490: THE TIER SEPARATION PROTOCOL — Hephaestus DMX Gate
            // DJ_FOUNDER: Hephaestus runtime ticks are silently discarded.
            // The engine runs but its output never reaches fixtures.
            if (hephOutputs.length > 0 && this._licenseTier !== 'DJ_FOUNDER') {
                // Group outputs by parameter for efficient processing
                // 🎯 WAVE 2544.3: Separate outputs into two buckets:
                //   - fixtureId bucket: output targets a specific fixture by ID (new tickLegacy path)
                //   - zone bucket: output targets a zone string (tickWithPhase legacy path)
                const hephByFixtureId = new Map();
                const hephByZone = new Map();
                for (const output of hephOutputs) {
                    // If fixtureId looks like a real fixture ID (not 'zone:xxx'), use fixture bucket
                    if (output.fixtureId && !output.fixtureId.startsWith('zone:')) {
                        if (!hephByFixtureId.has(output.fixtureId)) {
                            hephByFixtureId.set(output.fixtureId, []);
                        }
                        hephByFixtureId.get(output.fixtureId).push(output);
                    }
                    else {
                        const zoneKey = output.zone === 'all' ? 'all' : output.zone.toString();
                        if (!hephByZone.has(zoneKey)) {
                            hephByZone.set(zoneKey, []);
                        }
                        hephByZone.get(zoneKey).push(output);
                    }
                }
                // Apply Hephaestus outputs to fixtures
                fixtureStates = fixtureStates.map((f, index) => {
                    // 🎬 WAVE 2065: Skip fixtures that Chronos is currently painting
                    const fixtureId = this.fixtures[index]?.id;
                    if (fixtureId && chronosFixtureIds.has(fixtureId))
                        return f;
                    const applicableOutputs = [];
                    // 🎯 WAVE 2544.3: Check fixture-ID-specific outputs first (AND-gated path)
                    if (fixtureId) {
                        const directOutputs = hephByFixtureId.get(fixtureId);
                        if (directOutputs)
                            applicableOutputs.push(...directOutputs);
                    }
                    // Check 'all' zone outputs (legacy / global clips)
                    const allZoneOutputs = hephByZone.get('all');
                    if (allZoneOutputs)
                        applicableOutputs.push(...allZoneOutputs);
                    // Check zone-specific outputs (old zone-string path)
                    // 🗺️ WAVE 2543.5: Pass positionX for stereo zone support in Hephaestus outputs
                    const fixtureZone = (f.zone || '').toLowerCase();
                    const positionX = this.fixtures[index]?.position?.x ?? 0;
                    for (const [zoneKey, outputs] of hephByZone) {
                        if (zoneKey === 'all')
                            continue;
                        if (this.fixtureMatchesZoneStereo(fixtureZone, zoneKey, positionX)) {
                            applicableOutputs.push(...outputs);
                        }
                    }
                    if (applicableOutputs.length === 0)
                        return f;
                    // Apply each parameter with appropriate merge strategy
                    let newF = { ...f };
                    // ⚒️ WAVE 2030.21: THE TRANSLATOR
                    // Values arrive PRE-SCALED from HephaestusRuntime.
                    // DMX params: already 0-255. Color: already rgb {r,g,b} 0-255.
                    // TitanOrchestrator ONLY merges. Zero scaling here.
                    for (const output of applicableOutputs) {
                        switch (output.parameter) {
                            case 'intensity': {
                                // HTP: Highest Takes Precedence (value is already 0-255)
                                newF.dimmer = Math.max(newF.dimmer, output.value);
                                break;
                            }
                            case 'strobe': {
                                // Additive: sum clamped to 255 (value is already 0-255)
                                newF = { ...newF, strobe: Math.min(255, (newF.strobe || 0) + output.value) };
                                break;
                            }
                            case 'pan': {
                                // ⚒️ WAVE 2030.24: LTP with 16-bit precision
                                // value = coarse (MSB), fine = LSB. Together: (coarse << 8) | fine
                                // 🛡️ WAVE 2085: ONLY set TARGET. physicalPan is SACRED — owned exclusively
                                // by FixturePhysicsDriver. HAL will interpolate toward this target.
                                newF.pan = output.value;
                                // panFine carried in output.fine (if fixture supports 16-bit)
                                if (output.fine !== undefined) {
                                    newF.panFine = output.fine;
                                }
                                break;
                            }
                            case 'tilt': {
                                // ⚒️ WAVE 2030.24: LTP with 16-bit precision
                                // 🛡️ WAVE 2085: ONLY set TARGET. physicalTilt is SACRED.
                                newF.tilt = output.value;
                                if (output.fine !== undefined) {
                                    newF.tiltFine = output.fine;
                                }
                                break;
                            }
                            case 'color': {
                                // LTP: RGB pre-converted from HSL in Runtime
                                if (output.rgb) {
                                    newF.r = output.rgb.r;
                                    newF.g = output.rgb.g;
                                    newF.b = output.rgb.b;
                                }
                                break;
                            }
                            case 'white': {
                                // LTP overlay (value is already 0-255)
                                newF.white = output.value;
                                break;
                            }
                            case 'amber': {
                                // LTP overlay (value is already 0-255)
                                newF.amber = output.value;
                                break;
                            }
                            // ⚒️ WAVE 2030.24: Extended DMX params (8-bit, LTP overlay)
                            case 'zoom': {
                                newF.zoom = output.value;
                                break;
                            }
                            case 'focus': {
                                newF.focus = output.value;
                                break;
                            }
                            case 'iris': {
                                // FixtureState doesn't have iris yet — store as dynamic channel
                                newF.iris = output.value;
                                break;
                            }
                            case 'gobo1': {
                                newF.gobo = output.value;
                                break;
                            }
                            case 'gobo2': {
                                // Secondary gobo — store as dynamic channel
                                newF.gobo2 = output.value;
                                break;
                            }
                            case 'prism': {
                                newF.prism = output.value;
                                break;
                            }
                            // speed/width/direction/globalComp: engine-internal (0-1 float)
                            // No DMX channel mapping - consumed by engine subsystems only
                        }
                    }
                    return newF;
                });
                // Throttled debug log
                if (this.frameCount % 60 === 0) {
                    const activeClips = hephRuntime.getStats().activeClips;
                    console.log(`[TitanOrchestrator ⚒️] HEPHAESTUS: ${activeClips} clips, ${hephOutputs.length} outputs`);
                }
            }
            // ⚒️ WAVE 3010: SINGLE SEND PER FRAME
            // renderFromTarget() no longer sends to hardware — it's pure calculation now.
            // We send ONCE here, AFTER all processing (including Hephaestus overlays).
            // This eliminates the double-send race condition where two sendAll() calls
            // competed for the isTransmitting semaphore (the second was always dropped).
            this.hal.sendStatesWithPhysics(fixtureStates);
            // ═══════════════════════════════════════════════════════════════════════════
            // 🧹 WAVE 2227: VISUAL GATE REMOVED
            // Previously (WAVE 1133), this block zerified ALL fixtureStates when
            // outputEnabled=false, killing the HyperionView preview. The DMX gate
            // already lives in MasterArbiter.arbitrateFixture() — that's the real
            // enforcement. The UI now receives live engine data for private preview
            // regardless of the DMX gate state.
            // ═══════════════════════════════════════════════════════════════════════════
            // ═══════════════════════════════════════════════════════════════════════
            // ⚡ WAVE 2510: DUAL-CHANNEL BROADCAST — Hot Frame (44Hz) + Full Truth (~7Hz)
            //
            // Hot Frame: EVERY tick (44Hz). Carries ONLY fixture dynamic data + beat flag.
            //   → Frontend forwards to RenderWorker for 60fps interpolation.
            //   → Lightweight: just fixtures array + beat + frame number.
            //
            // Full Truth: Every TRUTH_BROADCAST_DIVIDER ticks (~7Hz).
            //   → Full SeleneTruth (sensory, consciousness, context, hardware).
            //   → Feeds React stores, HUD, audio meters, etc.
            //
            // 👻 WAVE 2540.7: CHRONOS BYPASS — During Chronos playback, broadcast
            // full truth at full rate (44fps) since Cinema needs complete data.
            // ═══════════════════════════════════════════════════════════════════════
            // 👻 Chronos bypass check
            const chronosPlaying = this.engine?.isChronosPlaybackActive() ?? false;
            const shouldBroadcastFullTruth = chronosPlaying || (this.frameCount % TitanOrchestrator.TRUTH_BROADCAST_DIVIDER === 0);
            // ⚡ WAVE 2464: PEAK HOLD — Acumula picos entre full truth broadcasts
            if (!chronosPlaying) {
                for (let _pi = 0; _pi < fixtureStates.length; _pi++) {
                    const _f = fixtureStates[_pi];
                    const _id = this.fixtures[_pi]?.id || `fix_${_pi}`;
                    const _prev = this.peakHoldMap.get(_id) ?? 0;
                    if (_f.dimmer > _prev)
                        this.peakHoldMap.set(_id, _f.dimmer);
                }
            }
            // ── HOT FRAME — Every tick (44Hz) ──────────────────────────────────
            if (this.onHotFrame) {
                const hotFrame = {
                    frameNumber: this.frameCount,
                    timestamp: Date.now(),
                    onBeat: engineAudioMetrics.isBeat,
                    beatConfidence: engineAudioMetrics.beatConfidence,
                    bpm: engineAudioMetrics.bpm,
                    fixtures: fixtureStates.map((f, i) => {
                        const originalFixture = this.fixtures[i];
                        const realId = originalFixture?.id || `fix_${i}`;
                        return {
                            id: realId,
                            dimmer: f.dimmer / 255,
                            r: Math.round(f.r),
                            g: Math.round(f.g),
                            b: Math.round(f.b),
                            pan: f.pan / 255,
                            tilt: f.tilt / 255,
                            zoom: f.zoom,
                            focus: f.focus,
                            physicalPan: (f.physicalPan ?? f.pan) / 255,
                            physicalTilt: (f.physicalTilt ?? f.tilt) / 255,
                            panVelocity: f.panVelocity ?? 0,
                            tiltVelocity: f.tiltVelocity ?? 0,
                        };
                    })
                };
                this.onHotFrame(hotFrame);
            }
            // ── FULL TRUTH — Every TRUTH_BROADCAST_DIVIDER ticks (~7Hz) ────────
            if (this.onBroadcast && shouldBroadcastFullTruth) {
                const currentVibe = this.engine.getCurrentVibe();
                // Build a valid SeleneTruth structure
                const truth = {
                    system: {
                        frameNumber: this.frameCount,
                        timestamp: Date.now(),
                        deltaTime: 23,
                        targetFPS: 44,
                        actualFPS: 44,
                        mode: this.mode === 'auto' ? 'selene' : 'manual',
                        vibe: currentVibe,
                        brainStatus: 'peaceful',
                        uptime: this.frameCount * 23,
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
                        fft: this.EMPTY_FFT_BUFFER,
                        beat: {
                            onBeat: engineAudioMetrics.isBeat,
                            confidence: engineAudioMetrics.beatConfidence,
                            bpm: engineAudioMetrics.bpm, // 🕰️ WAVE 2090.3: Pacemaker PLL BPM
                            beatPhase: engineAudioMetrics.beatPhase, // 🕰️ WAVE 2090.3: PLL-driven phase
                            barPhase: 0,
                            timeSinceLastBeat: 0
                        },
                        input: {
                            gain: this.inputGain,
                            device: 'Microphone',
                            active: this.hasRealAudio,
                            isClipping: false
                        },
                        // 🧠 WAVE 1195: BACKEND TELEMETRY EXPANSION - 7 GodEar Tactical Bands
                        spectrumBands: {
                            subBass: this.smoothedMetrics.subBass,
                            bass: bass, // Use the already available bass from engineAudioMetrics
                            lowMid: this.smoothedMetrics.lowMid,
                            mid: mid, // Use the already available mid from engineAudioMetrics
                            highMid: this.smoothedMetrics.highMid,
                            treble: high * 0.8, // Approximate from high
                            ultraAir: high * 0.3, // Approximate ultra-high from high
                            dominant: bass > mid && bass > high ? 'bass' :
                                mid > bass && mid > high ? 'mid' : 'treble',
                            flux: Math.abs((this.lastAudioData.energy || 0) - energy)
                        }
                    },
                    // 🌡️ WAVE 283: Usar datos REALES del TitanEngine en vez de defaults
                    // 🧬 WAVE 550: Añadir telemetría de IA para el HUD táctico
                    // 🔌 WAVE 1175: DATA PIPE FIX - Inyectar vibe REAL desde el engine
                    consciousness: {
                        ...createDefaultCognitive(),
                        stableEmotion: this.engine.getStableEmotion(),
                        thermalTemperature: this.engine.getThermalTemperature(),
                        ai: this.engine.getConsciousnessTelemetry(),
                        // 🔌 WAVE 1175: Vibe activo REAL (no el default 'idle')
                        vibe: {
                            active: currentVibe,
                            transitioning: false // TODO: implementar transición real
                        }
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
                            universe: 0, // 🔥 WAVE 1219: ArtNet 0-indexed
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
                            // 🔧 WAVE 700.9.4: Map HAL zones to StageSimulator2 zones
                            // Soporta AMBOS sistemas de zonas:
                            //   - Legacy canvas: FRONT_PARS, BACK_PARS, MOVING_LEFT, MOVING_RIGHT
                            //   - Constructor 3D: ceiling-left, ceiling-right, floor-front, floor-back
                            const zoneMap = {
                                // Legacy canvas zones
                                'FRONT_PARS': 'front',
                                'BACK_PARS': 'back',
                                'MOVING_LEFT': 'left',
                                'MOVING_RIGHT': 'right',
                                'STROBES': 'center',
                                'AMBIENT': 'center',
                                'FLOOR': 'front',
                                'UNASSIGNED': 'center',
                                // Constructor 3D zones
                                'ceiling-left': 'left',
                                'ceiling-right': 'right',
                                'floor-front': 'front',
                                'floor-back': 'back'
                            };
                            const mappedZone = zoneMap[f.zone] || f.zone || 'center';
                            // 🩸 WAVE 380: Use REAL fixture ID from this.fixtures, not generated index
                            // This is critical for runtimeStateMap matching in StageSimulator2
                            const originalFixture = this.fixtures[i];
                            const realId = originalFixture?.id || `fix_${i}`;
                            // ⚡ WAVE 2464: PEAK HOLD — Usa el pico acumulado en el frame skipeado.
                            // Si el fixture brilló al máximo en el frame que el throttle saltó, aquí
                            // mandamos ese pico al canvas. Después de leerlo: reset a 0 para el ciclo.
                            // 👻 WAVE 2540.7: Skip peak hold during Chronos — every frame is broadcast,
                            // no skipped frames means no peaks to accumulate.
                            let broadcastDimmer;
                            if (chronosPlaying) {
                                broadcastDimmer = f.dimmer;
                            }
                            else {
                                const peakDimmer = this.peakHoldMap.get(realId) ?? f.dimmer;
                                broadcastDimmer = Math.max(f.dimmer, peakDimmer);
                                this.peakHoldMap.set(realId, 0); // Reset peak tras broadcast
                            }
                            return {
                                id: realId,
                                name: f.name,
                                type: f.type,
                                zone: mappedZone,
                                dmxAddress: f.dmxAddress,
                                universe: f.universe,
                                dimmer: broadcastDimmer / 255, // Normalize 0-255 → 0-1 (con peak hold)
                                intensity: broadcastDimmer / 255, // Normalize 0-255 → 0-1 (con peak hold)
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
                                // ⚒️ WAVE 2030.22g: Extended LED channels
                                white: f.white ?? 0, // 0-255 DMX
                                amber: f.amber ?? 0, // 0-255 DMX
                                // 🎛️ WAVE 339: Physics (interpolated positions from FixturePhysicsDriver)
                                physicalPan: (f.physicalPan ?? f.pan) / 255, // Normalize 0-255 → 0-1
                                physicalTilt: (f.physicalTilt ?? f.tilt) / 255, // Normalize 0-255 → 0-1
                                panVelocity: f.panVelocity ?? 0, // DMX/s (raw)
                                tiltVelocity: f.tiltVelocity ?? 0, // DMX/s (raw)
                                online: true,
                                active: f.dimmer > 0,
                                // 🔥 WAVE 2084.6: THE PHANTOM DATA LINK — Robust profileId cascade
                                // Priority: originalFixture.profileId > fixtureState.profileId > originalFixture.id
                                // NEVER let profileId be undefined — the ExtrasSection IPC depends on it
                                profileId: originalFixture?.profileId || f.profileId || originalFixture?.id || realId
                            };
                        })
                    },
                    timestamp: Date.now()
                };
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
        finally {
            // 🔒 WAVE 2211: ALWAYS release the guard, even if processFrame() throws
            this.isProcessingFrame = false;
        }
    }
    /**
     * Set the current vibe
     * 🎯 WAVE 289: Propagate vibe to Workers for Vibe-Aware Section Tracking
     * 🔧 WAVE 2040.3: Fixed HAL receiving legacy alias instead of normalized ID
     */
    setVibe(vibeId) {
        if (this.engine) {
            // 1️⃣ Set vibe in engine (normalizes legacy aliases internally)
            this.engine.setVibe(vibeId);
            // 2️⃣ Get the ACTUAL normalized vibe ID from engine
            // This ensures HAL receives 'techno-club' not 'techno'
            const normalizedVibeId = this.engine.getCurrentVibe();
            console.log(`[TitanOrchestrator] Vibe set to: ${normalizedVibeId}`);
            // WAVE 257: Log vibe change to Tactical Log
            this.log('Mode', `🎭 Vibe changed to: ${normalizedVibeId.toUpperCase()}`);
            // 🎯 WAVE 289: Propagate vibe to Trinity Workers
            // El SectionTracker en los Workers usará perfiles vibe-aware
            if (this.trinity) {
                this.trinity.setVibe(normalizedVibeId);
                console.log(`[TitanOrchestrator] 🎯 WAVE 289: Vibe propagated to Workers`);
            }
            // 🎯 WAVE 338: Propagate vibe to HAL for Movement Physics
            // 🔧 WAVE 2040.3: FIX - Use normalizedVibeId so HAL gets 'techno-club' not 'techno'
            // Los movers usarán física diferente según el vibe
            if (this.hal) {
                this.hal.setVibe(normalizedVibeId);
                console.log(`[TitanOrchestrator] 🎛️ WAVE 338: Movement physics updated for vibe`);
            }
            // 🧨 WAVE 2140: AMNESIA PROTOCOL — Hard reset del Pacemaker en BETA.
            // Un cambio de Vibe = nuevo track = el BPM anterior es basura.
            // Obligamos al motor a escuchar en blanco.
            if (this.trinity) {
                this.trinity.resetPacemaker();
                console.log(`[TitanOrchestrator] 🧨 WAVE 2140: Pacemaker reset triggered by vibe change → ${normalizedVibeId}`);
            }
            // 🌊 WAVE 2432: THE GREAT WIRING — Hot-swap profile on vibe change
            this.engine.setActiveProfile(normalizedVibeId);
        }
    }
    /**
     * 🎨 WAVE 2019.6: Force Palette Sync
     *
     * Regenera la paleta del Engine usando el color constitution del Vibe activo.
     * Usado por Chronos Timeline para sincronizar Stage color al cambiar Vibe.
     */
    forcePaletteSync() {
        if (this.engine) {
            this.engine.forcePaletteRefresh();
            console.log(`[TitanOrchestrator] 🎨 Palette forcefully synced to current vibe`);
        }
    }
    /**
     * 🎭 WAVE 700.5.4: Set the current mood (calm/balanced/punk)
     *
     * Mood controls effect frequency and intensity:
     * - CALM: 1-3 EPM (effects minimal, paleta respira)
     * - BALANCED: 4-6 EPM (narrativa visual)
     * - PUNK: 8-10 EPM (caos controlado)
     */
    setMood(moodId) {
        if (this.engine) {
            // Access backend MoodController singleton (already imported at top)
            MoodController.getInstance().setMood(moodId);
            console.log(`[TitanOrchestrator] 🎭 Mood set to: ${moodId.toUpperCase()}`);
            this.log('Mode', `🎭 Mood changed to: ${moodId.toUpperCase()}`);
        }
    }
    /**
     * 🎭 WAVE 700.5.4: Get the current mood
     */
    getMood() {
        return MoodController.getInstance().getCurrentMood();
    }
    /**
     * 👻 WAVE 2540.4: THE PHANTOM BUFFER — Cache pre-calculated GodEar heatmap
     * in TitanEngine for offline band lookup during timeline playback.
     */
    setChronosHeatmap(heatmap) {
        if (this.engine) {
            this.engine.setChronosHeatmap(heatmap);
        }
    }
    /**
     * 👻 WAVE 2540.5: PLAYHEAD SYNC — Forward Chronos playhead to TitanEngine.
     * Called every frame from the frontend during Chronos playback.
     */
    setChronosPlayhead(timeMs, isPlaying) {
        if (this.engine) {
            this.engine.setChronosPlayhead(timeMs, isPlaying);
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
     * 🌊 WAVE 2401: Set Liquid Stereo mode (7-band per-zone envelopes)
     */
    setLiquidStereo(enabled) {
        if (this.engine) {
            this.engine.setLiquidStereo(enabled);
        }
        console.log(`[TitanOrchestrator] 🌊 Liquid Stereo: ${enabled ? 'ACTIVE' : 'OFF'}`);
        this.log('Physics', `🌊 Liquid Stereo: ${enabled ? '7-BAND' : 'GOD MODE'}`);
    }
    /**
     * 🌊 WAVE 2432: THE GREAT WIRING — Layout Switch (4.1 / 7.1)
     */
    setLiquidLayout(mode) {
        if (this.engine) {
            this.engine.setLiquidLayout(mode);
        }
        console.log(`[TitanOrchestrator] 🌊 Layout: ${mode}`);
        this.log('Physics', `🌊 Layout switched to ${mode}`);
    }
    /**
     * 🧬 WAVE 560: Get consciousness state
     */
    isConsciousnessEnabled() {
        return this.consciousnessEnabled;
    }
    /**
     * 🧨 WAVE 610: FORCE STRIKE - Manual Effect Detonator
     * ⚒️ WAVE 2030.4: Hephaestus curve automation support
     *
     * Dispara un efecto manualmente sin esperar decisión de HuntEngine.
     * Útil para testear efectos visuales sin alterar umbrales de los algoritmos.
     *
     * FLOW:
     * 1. Frontend llama window.lux.forceStrike({ effect: 'solar_flare', intensity: 1.0 })
     * 2. IPC handler llama titanOrchestrator.forceStrikeNextFrame(config)
     * 3. Este método llama engine's forceStrikeNextFrame(config)
     * 4. TitanEngine fuerza un trigger de EffectManager en el próximo frame
     * 5. ⚒️ WAVE 2030.4: Si config.hephCurves existe, EffectManager crea un overlay
     *
     * @param config - ForceStrikeConfig with effect, intensity, source, and optional hephCurves
     */
    forceStrikeNextFrame(config) {
        if (!this.engine) {
            console.warn('[TitanOrchestrator] 🧨 Cannot force strike - Engine not initialized');
            return;
        }
        const sourceLabel = config.source === 'chronos' ? 'CHRONOS' : 'Manual';
        const hephTag = config.hephCurves ? ` ⚒️[HEPH: ${config.hephCurves.curves.size}]` : '';
        console.log(`[TitanOrchestrator] 🧨 ${sourceLabel} STRIKE: ${config.effect} @ ${config.intensity.toFixed(2)}${hephTag}`);
        this.log('Effect', `🧨 ${sourceLabel} Strike: ${config.effect}`, { intensity: config.intensity });
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
    }
    /**
     * ⚡ WAVE 2510: Set callback for hot-frame broadcast (44Hz fixture data)
     * Carries only dynamic fixture data for the RenderWorker.
     * Separate from full SeleneTruth which continues at ~7Hz.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setHotFrameCallback(callback) {
        this.onHotFrame = callback;
    }
    setLogCallback(callback) {
        this.onLog = callback;
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
     * 🎸 WAVE 1011: Extended para RockStereoPhysics2 (subBass, lowMid, highMid, transients)
     *
     * ═══════════════════════════════════════════════════════════════════════════
     * 🔥 WAVE 1011.9: THE SINGLE SOURCE OF TRUTH
     * ═══════════════════════════════════════════════════════════════════════════
     * ANTES: Este método sobrescribía bass/mid/high con datos del Frontend,
     *        mientras brain.on('audio-levels') los sobrescribía con datos del Worker.
     *        Esto creaba una RACE CONDITION que causaba PARPADEO en todas las vibes.
    /**
     * ═══════════════════════════════════════════════════════════════════════════
     * 🔥 WAVE 1012.5: HYBRID SOURCE ARCHITECTURE
     * ═══════════════════════════════════════════════════════════════════════════
     *
     * PROBLEMA DETECTADO:
     * - WAVE 1011.9 hizo al Worker "single source of truth" para bass/mid/high/energy
     * - PERO el Worker solo recibe buffers cada 100ms (10fps)
     * - El Frontend envía métricas cada 33ms (30fps)
     * - Resultado: Sistema corriendo a 10fps visual, no 30fps
     *
     * SOLUCIÓN HÍBRIDA:
     * - Frontend (30fps) → bass/mid/high/energy básicos (para fluidez visual)
     * - Worker (10fps) → harshness/flatness/centroid (para precisión espectral)
     * - AMBOS coexisten sin sobrescribirse
     *
     * El Worker TAMBIÉN envía bass/mid/high, pero el Frontend tiene prioridad
     * temporal porque es más frecuente. Cuando llega data del Worker, las métricas
     * FFT extendidas se actualizan pero bass/mid/high se mantienen del Frontend.
     * ═══════════════════════════════════════════════════════════════════════════
     */
    processAudioFrame(data) {
        if (!this.isRunning || !this.useBrain)
            return;
        // ═══════════════════════════════════════════════════════════════════════════
        // 🔥 WAVE 1012.5: FRONTEND = HIGH FREQUENCY SOURCE (30fps)
        // El Frontend provee bass/mid/high/energy a 30fps para fluidez visual
        // El Worker provee métricas FFT a 10fps para precisión espectral
        // ═══════════════════════════════════════════════════════════════════════════
        // Core bands - FRONTEND SOURCE (30fps)
        const bass = typeof data.bass === 'number' ? data.bass : this.lastAudioData.bass;
        const mid = typeof data.mid === 'number' ? data.mid : this.lastAudioData.mid;
        const high = typeof data.treble === 'number' ? data.treble :
            typeof data.high === 'number' ? data.high : this.lastAudioData.high;
        const energy = typeof data.energy === 'number' ? data.energy : this.lastAudioData.energy;
        // 🎛️ WAVE 661: Extraer textura espectral (si viene del frontend, raro pero posible)
        const harshness = typeof data.harshness === 'number' ? data.harshness : undefined;
        const spectralFlatness = typeof data.spectralFlatness === 'number' ? data.spectralFlatness : undefined;
        const spectralCentroid = typeof data.spectralCentroid === 'number' ? data.spectralCentroid : undefined;
        // 🎸 WAVE 1011: Extraer bandas extendidas
        const subBass = typeof data.subBass === 'number' ? data.subBass : undefined;
        const lowMid = typeof data.lowMid === 'number' ? data.lowMid : undefined;
        const highMid = typeof data.highMid === 'number' ? data.highMid : undefined;
        // 🎸 WAVE 1011: Extraer detección de transientes
        const kickDetected = typeof data.kickDetected === 'boolean' ? data.kickDetected : undefined;
        const snareDetected = typeof data.snareDetected === 'boolean' ? data.snareDetected : undefined;
        const hihatDetected = typeof data.hihatDetected === 'boolean' ? data.hihatDetected : undefined;
        // 🔥 WAVE 1012.5: HYBRID MERGE
        // - bass/mid/high/energy: FRONTEND (30fps, prioridad visual)
        // - métricas FFT: WORKER vía brain.on('audio-levels') (10fps, prioridad espectral)
        this.lastAudioData = {
            // Core bands - FRONTEND SOURCE (30fps para fluidez)
            bass,
            mid,
            high,
            energy,
            // Métricas FFT extendidas - PRESERVAR del Worker si frontend no las tiene
            harshness: harshness ?? this.lastAudioData.harshness,
            spectralFlatness: spectralFlatness ?? this.lastAudioData.spectralFlatness,
            spectralCentroid: spectralCentroid ?? this.lastAudioData.spectralCentroid,
            subBass: subBass ?? this.lastAudioData.subBass,
            lowMid: lowMid ?? this.lastAudioData.lowMid,
            highMid: highMid ?? this.lastAudioData.highMid,
            kickDetected: kickDetected ?? this.lastAudioData.kickDetected,
            snareDetected: snareDetected ?? this.lastAudioData.snareDetected,
            hihatDetected: hihatDetected ?? this.lastAudioData.hihatDetected,
            // 🔥 WAVE 1162.2: CRITICAL FIX - Preservar rawBassEnergy del Worker!
            // El Frontend NO tiene esta métrica, viene solo del BETA Worker vía GOD EAR
            // Sin esta línea, el Frontend (30fps) BORRABA el valor que el Worker (10fps) enviaba
            rawBassEnergy: this.lastAudioData.rawBassEnergy,
            // 🔥 WAVE 2130.5: CRITICAL FIX - Preservar Worker BPM del Frontend overwrite!
            // Frontend (30fps) NO tiene BPM — viene solo del Worker vía brain.on('audio-levels')
            // Sin estas líneas, el Frontend BORRABA workerBpm=185 → undefined → ?? 0 → BPM=0
            // Resultado: 2 de cada 3 render cycles mostraban BPM=0 (30fps sobrescribe 10fps)
            workerBpm: this.lastAudioData.workerBpm,
            workerBpmConfidence: this.lastAudioData.workerBpmConfidence,
            workerOnBeat: this.lastAudioData.workerOnBeat,
            workerBeatPhase: this.lastAudioData.workerBeatPhase,
            workerBeatStrength: this.lastAudioData.workerBeatStrength,
            // 🥁 WAVE 2213: NO BORRAR EL CONTADOR DEL WORKER 30 VECES POR SEGUNDO
            // processAudioFrame() corre a 30fps — sin esta línea, workerKickCount → undefined
            // → beatCount=0 → VMM atascado en Bar:0 para siempre, patrones nunca cambian
            workerKickCount: this.lastAudioData.workerKickCount,
        };
        // 🔥 WAVE 1012.5: Frontend también detecta audio real
        const wasAudioActive = this.hasRealAudio;
        this.hasRealAudio = energy > 0.01;
        // 📜 WAVE 1198: Log first audio detection (only once per session)
        if (this.hasRealAudio && !this.hasLoggedFirstAudio) {
            this.hasLoggedFirstAudio = true;
            this.log('System', '🎧 AUDIO DETECTED - Selene is now listening!');
        }
        else if (!this.hasRealAudio && wasAudioActive) {
            // Audio lost - log it
            this.log('System', '🔇 AUDIO LOST - Waiting for signal...');
        }
        // 🗡️ WAVE 265: Update timestamp para staleness detection
        this.lastAudioTimestamp = Date.now();
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
        // 🔥 WAVE 2183: GHOST EXORCISM — Invalidate HAL profile caches on fixture sync
        // When the Forge renames/edits a profile, reconcileFixturesWithProfile updates the
        // stageStore, TitanSyncBridge re-sends fixtures here, and HAL must drop its stale cache.
        if (this.hal) {
            this.hal.invalidateProfileCache();
        }
        // 🎭 WAVE 382: Register fixtures in MasterArbiter with FULL metadata
        // 🎨 WAVE 686.11: Use normalized fixtures (dmxAddress already set above)
        // 🎨 WAVE 1001: Include HAL color flags
        // 🔧 WAVE 1055: IDENTITY CRISIS FIX - INCLUDE POSITION!!!
        masterArbiter.setFixtures(this.fixtures.map(f => ({
            id: f.id,
            name: f.name,
            zone: f.zone,
            type: f.type || 'generic',
            dmxAddress: f.dmxAddress, // 🎨 WAVE 686.11: Already normalized above
            universe: f.universe ?? 0, // 🔥 WAVE 1219: ArtNet 0-indexed
            capabilities: f.capabilities,
            hasMovementChannels: f.hasMovementChannels,
            hasColorWheel: f.hasColorWheel, // 🎨 WAVE 1001: HAL Translation
            hasColorMixing: f.hasColorMixing, // 🎨 WAVE 1001: HAL Translation
            profileId: f.profileId || f.id, // 🎨 WAVE 1001: HAL Translation
            channels: f.channels,
            // ═══════════════════════════════════════════════════════════════════════
            // 🕵️ WAVE 1055: THE MISSING LINK - Position for L/R stereo detection
            // WITHOUT THIS, Arbiter receives position=undefined, assumes x=0, ALL → RIGHT
            // ═══════════════════════════════════════════════════════════════════════
            position: f.position, // 🔧 WAVE 1055: CRITICAL FOR STEREO ROUTING
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
        // WAVE 2098: Boot silence
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
    // ═══════════════════════════════════════════════════════════════════════════
    // 🗺️ WAVE 2543.5: Single zone matcher — ZoneMapper handles stereo detection internally
    // fixtureMatchesZone (no-position) eliminated — always pass positionX for correctness
    // ═══════════════════════════════════════════════════════════════════════════
    fixtureMatchesZoneStereo(fixtureZone, targetZone, positionX) {
        return zoneMapperMatch(fixtureZone, targetZone, positionX);
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // 🌊 WAVE 1011.5: THE DAM - Exponential Moving Average Smoothing
    // Elimina el "ruido digital" del FFT crudo que causa parpadeo en los Pars
    // 
    // EMA Formula: smoothed = (1 - alpha) * smoothed + alpha * raw
    // - ALPHA_FAST (0.25): Reacciona en ~4 frames (~133ms) - para harshness/guitarras
    // - ALPHA_SLOW (0.08): Reacciona en ~12 frames (~400ms) - para contexto/ambiente
    // ═══════════════════════════════════════════════════════════════════════════
    applyEMASmoothing() {
        const raw = this.lastAudioData;
        // Harshness: FAST - queremos que responda a guitarras distorsionadas
        if (typeof raw.harshness === 'number') {
            this.smoothedMetrics.harshness =
                (1 - this.EMA_ALPHA_FAST) * this.smoothedMetrics.harshness +
                    this.EMA_ALPHA_FAST * raw.harshness;
        }
        // SpectralFlatness: SLOW - contexto ambiental, no debería saltar
        if (typeof raw.spectralFlatness === 'number') {
            this.smoothedMetrics.spectralFlatness =
                (1 - this.EMA_ALPHA_SLOW) * this.smoothedMetrics.spectralFlatness +
                    this.EMA_ALPHA_SLOW * raw.spectralFlatness;
        }
        // SpectralCentroid: SLOW - el "brillo" tonal es contexto, no evento
        if (typeof raw.spectralCentroid === 'number') {
            this.smoothedMetrics.spectralCentroid =
                (1 - this.EMA_ALPHA_SLOW) * this.smoothedMetrics.spectralCentroid +
                    this.EMA_ALPHA_SLOW * raw.spectralCentroid;
        }
        // SubBass: FAST - kicks profundos deben sentirse
        if (typeof raw.subBass === 'number') {
            this.smoothedMetrics.subBass =
                (1 - this.EMA_ALPHA_FAST) * this.smoothedMetrics.subBass +
                    this.EMA_ALPHA_FAST * raw.subBass;
        }
        // LowMid: FAST - presencia de guitarras/voces
        if (typeof raw.lowMid === 'number') {
            this.smoothedMetrics.lowMid =
                (1 - this.EMA_ALPHA_FAST) * this.smoothedMetrics.lowMid +
                    this.EMA_ALPHA_FAST * raw.lowMid;
        }
        // HighMid: FAST - claridad/ataque
        if (typeof raw.highMid === 'number') {
            this.smoothedMetrics.highMid =
                (1 - this.EMA_ALPHA_FAST) * this.smoothedMetrics.highMid +
                    this.EMA_ALPHA_FAST * raw.highMid;
        }
        // 💥 WAVE 2347: CrestFactor: FAST - los transients de kick son eventos, deben sentirse
        if (typeof raw.crestFactor === 'number') {
            this.smoothedMetrics.crestFactor =
                (1 - this.EMA_ALPHA_FAST) * this.smoothedMetrics.crestFactor +
                    this.EMA_ALPHA_FAST * raw.crestFactor;
        }
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // 🩸 WAVE 2094: PACEMAKER TRANSPLANT — Syncopation estimator
    // ═══════════════════════════════════════════════════════════════════════════
    // Mirror of SimpleRhythmDetector algorithm but using REAL beatPhase
    // from Pacemaker instead of the dead beatPhase=0 from Worker.
    //
    // Syncopation = ratio of off-beat energy to total energy.
    // On-beat: phase < 0.25 || phase > 0.75 (50% window around beat)
    // Off-beat: everything else (the "and" of the beat)
    // High syncopation = energy concentrated off-beat (funk, breakbeat)
    // Low syncopation = energy on-beat (four-on-floor techno)
    // ═══════════════════════════════════════════════════════════════════════════
    estimateSyncopation(beatPhase, bass, mid) {
        const energy = bass + mid * 0.5;
        this.syncopationPhaseHistory.push({ phase: beatPhase, energy });
        if (this.syncopationPhaseHistory.length > this.SYNC_HISTORY_SIZE) {
            this.syncopationPhaseHistory.shift();
        }
        let onBeatEnergy = 0;
        let offBeatEnergy = 0;
        for (const frame of this.syncopationPhaseHistory) {
            const isOnBeat = frame.phase < 0.25 || frame.phase > 0.75;
            if (isOnBeat) {
                onBeatEnergy += frame.energy;
            }
            else {
                offBeatEnergy += frame.energy;
            }
        }
        const totalEnergy = onBeatEnergy + offBeatEnergy;
        const instantSync = totalEnergy > 0 ? offBeatEnergy / totalEnergy : 0;
        // EMA smoothing — same alpha as Worker for behavioral parity
        this.smoothedSyncopation =
            (this.SYNC_EMA_ALPHA * instantSync) +
                ((1 - this.SYNC_EMA_ALPHA) * this.smoothedSyncopation);
        return this.smoothedSyncopation;
    }
}
// ⚡ WAVE 2510: Full truth broadcast divider
// At 44Hz tick, send full SeleneTruth every TRUTH_BROADCAST_DIVIDER ticks (~7Hz)
TitanOrchestrator.TRUTH_BROADCAST_DIVIDER = 6;
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
}

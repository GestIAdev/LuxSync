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
// 🎭 WAVE 700.5.4: Import MoodController for backend mood control
import { MoodController } from '../mood/MoodController';
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
        // 🎸 WAVE 1011: Extended para RockStereoPhysics2 (subBass, lowMid, highMid, transients)
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
        };
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
                    // Transient detection - WORKER AUTHORITATIVE (detección precisa)
                    kickDetected: levels.kickDetected ?? this.lastAudioData.kickDetected,
                    snareDetected: levels.snareDetected ?? this.lastAudioData.snareDetected,
                    hihatDetected: levels.hihatDetected ?? this.lastAudioData.hihatDetected,
                };
                // 🔥 WAVE 1012.5: NO tocar hasRealAudio ni lastAudioTimestamp
                // Frontend los gestiona a 30fps
            });
            console.log('[TitanOrchestrator] 🔥 WAVE 1012.5: HYBRID SOURCE - Frontend(30fps)=bass/mid/high, Worker(10fps)=FFT metrics');
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
        // 🏎️ WAVE 1013: NITRO BOOST - Overclock to 60fps
        console.log('[TitanOrchestrator] 🏎️ Starting main loop @ 60fps (WAVE 1013: NITRO BOOST)');
        this.isRunning = true;
        this.mainLoopInterval = setInterval(() => {
            this.processFrame();
        }, 16); // ~60fps (was 33ms/30fps)
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
    /**
     * 🎬 PROCESAR FRAME: El latido del universo
     * 🧬 WAVE 972: ASYNC para DNA Brain sincrónico
     */
    async processFrame() {
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
            this.lastAudioData = {
                bass: 0, mid: 0, high: 0, energy: 0,
                harshness: undefined, spectralFlatness: undefined, spectralCentroid: undefined,
                subBass: undefined, lowMid: undefined, highMid: undefined,
                kickDetected: undefined, snareDetected: undefined, hihatDetected: undefined
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
        // For TitanEngine
        // 🎛️ WAVE 661: Incluir textura espectral
        // 🎸 WAVE 1011.5: Usar métricas SUAVIZADAS (no crudas) para evitar parpadeo
        const engineAudioMetrics = {
            bass, // Ya normalizado por AGC - INTOCABLE
            mid, // Ya normalizado por AGC - INTOCABLE
            high, // Ya normalizado por AGC - INTOCABLE
            energy, // Ya normalizado por AGC - INTOCABLE
            beatPhase: (this.frameCount % 30) / 30,
            isBeat: this.frameCount % 30 === 0 && energy > 0.3,
            // 🌊 WAVE 1011.5: Métricas FFT SUAVIZADAS
            harshness: this.smoothedMetrics.harshness,
            spectralFlatness: this.smoothedMetrics.spectralFlatness,
            spectralCentroid: this.smoothedMetrics.spectralCentroid,
            // 🎸 WAVE 1011.5: Bandas extendidas SUAVIZADAS
            subBass: this.smoothedMetrics.subBass,
            lowMid: this.smoothedMetrics.lowMid,
            highMid: this.smoothedMetrics.highMid,
            // 🎸 WAVE 1011: Transientes (estos SÍ son instantáneos - no suavizar)
            kickDetected: this.lastAudioData.kickDetected,
            snareDetected: this.lastAudioData.snareDetected,
            hihatDetected: this.lastAudioData.hihatDetected,
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
        // 🧨 WAVE 635 → WAVE 692.2 → WAVE 700.8.5: EFFECT COLOR OVERRIDE
        // Si hay un efecto activo con globalOverride, usar SU color (no hardcoded dorado)
        // Si globalOverride=false, MEZCLAR con lo que ya renderizó el HAL (no machacar)
        const effectManager = getEffectManager();
        const effectOutput = effectManager.getCombinedOutput();
        // 🎨 WAVE 725: ZONE OVERRIDES SUPPORT - "PINCELES FINOS"
        // Nueva arquitectura: si hay zoneOverrides, procesar por zona específica
        // Si no, usar la lógica legacy con colorOverride global
        if (effectOutput.hasActiveEffects && effectOutput.zoneOverrides) {
            // 🔥 WAVE 930.1: DEBUG REMOVED - Era spam de 600 líneas por frame
            // Los logs de zoneOverrides están en el EffectManager, no aquí
            // ═══════════════════════════════════════════════════════════════════════
            // 🎨 WAVE 740: STRICT ZONAL ISOLATION
            // PARADIGMA NUEVO: Iterar SOLO sobre las zonas explícitas del efecto.
            // Las fixtures que NO están en esas zonas NO SE TOCAN - permanecen
            // con su estado base (del HAL/Vibe) sin modificación alguna.
            // ═══════════════════════════════════════════════════════════════════════
            // 1. Obtener las zonas activas del efecto (SOLO estas se procesan)
            const activeZones = Object.keys(effectOutput.zoneOverrides);
            // 2. Crear un Set de índices de fixtures afectadas para tracking
            const affectedFixtureIndices = new Set();
            // 3. Para cada zona activa, encontrar y modificar SOLO sus fixtures
            for (const zoneId of activeZones) {
                const zoneData = effectOutput.zoneOverrides[zoneId];
                // Encontrar fixtures que pertenecen a esta zona
                fixtureStates.forEach((f, index) => {
                    const fixtureZone = (f.zone || '').toLowerCase();
                    if (this.fixtureMatchesZone(fixtureZone, zoneId)) {
                        // 🔥 WAVE 930.1: DEBUG REMOVED - Spam removed
                        // Esta fixture SÍ pertenece a la zona activa - MODIFICAR
                        affectedFixtureIndices.add(index);
                        // 🔗 WAVE 991: mixBus='global' determina el modo de mezcla para TODA la fixture
                        const isGlobalBus = effectOutput.mixBus === 'global';
                        // Aplicar color si existe
                        if (zoneData.color) {
                            const rgb = this.hslToRgb(zoneData.color.h, zoneData.color.s, zoneData.color.l);
                            // REEMPLAZO DIRECTO - El efecto toma control total del color
                            fixtureStates[index] = {
                                ...f,
                                r: rgb.r,
                                g: rgb.g,
                                b: rgb.b,
                            };
                        }
                        // ═══════════════════════════════════════════════════════════════════════
                        // 🎚️ WAVE 780: SMART BLEND MODES - El mejor de dos mundos
                        // 
                        // ANTES (WAVE 765): LTP puro - El efecto siempre manda
                        // PROBLEMA: TropicalPulse empezaba tenue y "apagaba" la fiesta
                        // 
                        // AHORA: Cada efecto declara su intención via blendMode:
                        // - 'replace' (LTP): El efecto manda aunque sea más oscuro (TidalWave, GhostBreath)
                        // - 'max' (HTP): El más brillante gana, nunca bajamos (TropicalPulse, ClaveRhythm)
                        // 
                        // DEFAULT: 'max' - Más seguro para energía general
                        // 
                        // 🔗 WAVE 991: THE MISSING LINK
                        // Si el efecto tiene mixBus='global', forzamos 'replace' SIEMPRE
                        // El mixBus de la clase es la autoridad máxima
                        // ═══════════════════════════════════════════════════════════════════════
                        if (zoneData.dimmer !== undefined) {
                            const effectDimmer = Math.round(zoneData.dimmer * 255);
                            // 🔗 WAVE 991: mixBus='global' SIEMPRE es 'replace' (LTP dictador)
                            const blendMode = isGlobalBus ? 'replace' : (zoneData.blendMode || 'max');
                            const physicsDimmer = fixtureStates[index].dimmer;
                            let finalDimmer;
                            if (blendMode === 'replace') {
                                // 🌊 REPLACE (LTP): El efecto manda - para efectos espaciales con valles
                                // 🔗 WAVE 991: También forzado cuando mixBus='global'
                                finalDimmer = effectDimmer;
                            }
                            else {
                                // 🔥 MAX (HTP): El más brillante gana - para efectos de energía
                                finalDimmer = Math.max(physicsDimmer, effectDimmer);
                            }
                            fixtureStates[index] = {
                                ...fixtureStates[index],
                                dimmer: finalDimmer,
                            };
                        }
                        // ═══════════════════════════════════════════════════════════════════════
                        // 🔥 WAVE 800: FLASH DORADO - Procesar white/amber de zoneOverrides
                        // 🔗 WAVE 991: Respetar mixBus='global' también para white/amber
                        // 🛡️ WAVE 993: THE IRON CURTAIN - Zero-fill para canales no especificados
                        // 
                        // PROBLEMA WAVE 991: TropicalPulse/ClaveRhythm enviaban white/amber pero el
                        // Orchestrator los ignoraba completamente.
                        // 
                        // PROBLEMA WAVE 993: Efectos con mixBus='global' no mataban los canales
                        // que NO especificaban → Physics "sangraba" a través de los huecos.
                        // 
                        // SOLUCIÓN WAVE 993 - THE IRON CURTAIN:
                        // - mixBus='global' → TELÓN DE ACERO: Todo lo no especificado MUERE (0)
                        // - mixBus='htp' → COLABORACIÓN: Solo procesa lo que trae el efecto
                        // 
                        // Ejemplo crítico: DigitalRain (verde puro techno)
                        //   - Trae: RGB verde, dimmer
                        //   - NO trae: white, amber
                        //   - ANTES: white/amber quedaban con valor de physics (dorado bleeding)
                        //   - AHORA: white=0, amber=0 → VERDE PURO ✅
                        // ═══════════════════════════════════════════════════════════════════════
                        if (isGlobalBus) {
                            // 🛡️ WAVE 993: THE IRON CURTAIN
                            // Dictador global: Los canales no mencionados MUEREN
                            // No permitimos que la física "sangre" a través de los huecos
                            const effectWhite = zoneData.white !== undefined ? Math.round(zoneData.white * 255) : 0;
                            const effectAmber = zoneData.amber !== undefined ? Math.round(zoneData.amber * 255) : 0;
                            fixtureStates[index].white = effectWhite;
                            fixtureStates[index].amber = effectAmber;
                        }
                        else {
                            // 🎉 HTP MODE (Fiesta Latina): COLABORACIÓN
                            // Solo procesa los canales que el efecto trae explícitamente
                            // Si el efecto no menciona white/amber, deja que physics brille
                            if (zoneData.white !== undefined) {
                                const effectWhite = Math.round(zoneData.white * 255);
                                const physicsWhite = fixtureStates[index].white || 0;
                                fixtureStates[index].white = Math.max(physicsWhite, effectWhite);
                            }
                            if (zoneData.amber !== undefined) {
                                const effectAmber = Math.round(zoneData.amber * 255);
                                const physicsAmber = fixtureStates[index].amber || 0;
                                fixtureStates[index].amber = Math.max(physicsAmber, effectAmber);
                            }
                        }
                    }
                    // Si NO pertenece a la zona → NO HACER NADA (ni siquiera tocarla)
                });
            }
            // Log throttled para debug
            if (this.frameCount % 60 === 0) {
                const zoneList = activeZones.join(', ');
                const unaffectedCount = fixtureStates.length - affectedFixtureIndices.size;
                console.log(`[TitanOrchestrator 740] � STRICT ZONAL: [${zoneList}] | Affected: ${affectedFixtureIndices.size}/${fixtureStates.length} | UNTOUCHED: ${unaffectedCount}`);
                for (const zoneId of activeZones) {
                    const zoneData = effectOutput.zoneOverrides[zoneId];
                    if (zoneData.color) {
                        const rgb = this.hslToRgb(zoneData.color.h, zoneData.color.s, zoneData.color.l);
                        console.log(`  🖌️ [${zoneId}] → RGB(${rgb.r},${rgb.g},${rgb.b}) dimmer=${(zoneData.dimmer ?? 1).toFixed(2)}`);
                    }
                }
            }
            // 🛑 WAVE 740: STOP. Las fixtures fuera de activeZones mantienen su estado BASE.
            // NO hay fallback, NO hay "relleno de huecos", NO hay blanco por defecto.
        }
        else if (effectOutput.hasActiveEffects && effectOutput.dimmerOverride !== undefined) {
            // ═══════════════════════════════════════════════════════════════════════
            // LEGACY: BROCHA GORDA - Un solo color para todas las zonas afectadas
            // ═══════════════════════════════════════════════════════════════════════
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
            // 🌴 WAVE 700.8.5 → 700.9: Filtrado inteligente por zona
            // Soporta AMBOS sistemas de zonas:
            //   - Legacy canvas: FRONT_PARS, BACK_PARS, MOVING_LEFT, MOVING_RIGHT
            //   - Constructor 3D: ceiling-left, ceiling-right, floor-front, floor-back
            const shouldApplyToFixture = (f) => {
                if (effectOutput.globalOverride)
                    return true; // Global afecta todo
                // Sin globalOverride, verificar zones
                const zones = effectOutput.zones || [];
                if (zones.length === 0)
                    return false;
                const fixtureZone = (f.zone || '').toLowerCase();
                for (const zone of zones) {
                    if (zone === 'all')
                        return true;
                    // FRONT: floor-front, FRONT_PARS, o cualquier cosa con 'front'
                    if (zone === 'front') {
                        if (fixtureZone.includes('front') || fixtureZone.includes('floor-front'))
                            return true;
                    }
                    // BACK: floor-back, BACK_PARS, o cualquier cosa con 'back'
                    if (zone === 'back') {
                        if (fixtureZone.includes('back') || fixtureZone.includes('floor-back'))
                            return true;
                    }
                    // MOVERS: ceiling-*, MOVING_* (NO usar pan/tilt porque HAL asigna a todos)
                    if (zone === 'movers') {
                        if (fixtureZone.includes('ceiling') ||
                            fixtureZone.includes('moving'))
                            return true;
                    }
                    // PARS: floor-*, *_PARS, pero NO movers
                    if (zone === 'pars') {
                        const isMover = fixtureZone.includes('ceiling') || fixtureZone.includes('moving');
                        if (!isMover && (fixtureZone.includes('floor') || fixtureZone.includes('par')))
                            return true;
                    }
                }
                return false;
            };
            // � WAVE 800: RAILWAY SWITCH
            // mixBus='global' → REEMPLAZA todo (modo dictador)
            // mixBus='htp' → MEZCLA con HTP (respeta lo que ya renderizó el HAL)
            const isGlobalMode = effectOutput.mixBus === 'global' || effectOutput.globalOverride;
            fixtureStates = fixtureStates.map(f => {
                const shouldApply = shouldApplyToFixture(f);
                if (!shouldApply)
                    return f; // No afectar esta fixture
                if (isGlobalMode) {
                    // ═══════════════════════════════════════════════════════════════════════
                    // 🚂 WAVE 800: VÍA GLOBAL - El efecto manda, ignora física
                    // El efecto REEMPLAZA completamente lo que había.
                    // Perfecto para: SolarFlare, CumbiaMoon, TidalWave, etc.
                    // ═══════════════════════════════════════════════════════════════════════
                    return {
                        ...f,
                        r: flareR,
                        g: flareG,
                        b: flareB,
                        dimmer: Math.round(flareIntensity * 255), // LTP: El efecto dicta
                    };
                }
                else {
                    // ═══════════════════════════════════════════════════════════════════════
                    // 🚂 WAVE 800: VÍA HTP - El efecto suma, respeta física
                    // HTP: El más brillante gana. El efecto complementa, no reemplaza.
                    // Perfecto para: TropicalPulse, ClaveRhythm, etc.
                    // ═══════════════════════════════════════════════════════════════════════
                    const effectDimmer = Math.round(flareIntensity * 255);
                    const finalDimmer = Math.max(f.dimmer, effectDimmer); // HTP: El más alto gana
                    // Color: Winner Takes All - si el efecto brilla más, gana el color
                    if (effectDimmer >= f.dimmer * 0.8) {
                        return {
                            ...f,
                            r: flareR,
                            g: flareG,
                            b: flareB,
                            dimmer: finalDimmer,
                        };
                    }
                    else {
                        // La física gana, mantener su color
                        return {
                            ...f,
                            dimmer: finalDimmer,
                        };
                    }
                }
            });
            // Log throttled
            if (this.frameCount % 60 === 0) {
                const affectedFixtures = fixtureStates.filter(shouldApplyToFixture);
                const mode = isGlobalMode ? 'GLOBAL' : 'HTP';
                // WAVE 800 DEBUG: Show mixBus mode
                const fixtureZoneList = fixtureStates.map(f => `${f.zone}:${shouldApplyToFixture(f) ? 'Y' : 'N'}`).join(', ');
                console.log(`[TitanOrchestrator 800] 🚂 EFFECT [${mode}] mixBus=${effectOutput.mixBus} zones=${JSON.stringify(effectOutput.zones)}: RGB(${flareR},${flareG},${flareB}) @ ${(flareIntensity * 100).toFixed(0)}%`);
                console.log(`[TitanOrchestrator 800] Fixtures: ${fixtureZoneList} | Affected: ${affectedFixtures.length}/${fixtureStates.length}`);
            }
        }
        // ═══════════════════════════════════════════════════════════════════════
        // ✂️ WAVE 930.2: STEREO MOVEMENT - Movimiento L/R independiente
        // Para efectos como SkySaw que necesitan scissors pan/tilt
        // ═══════════════════════════════════════════════════════════════════════
        if (effectOutput.hasActiveEffects && effectOutput.zoneOverrides) {
            const leftMovement = effectOutput.zoneOverrides['movers_left']?.movement;
            const rightMovement = effectOutput.zoneOverrides['movers_right']?.movement;
            if (leftMovement || rightMovement) {
                fixtureStates = fixtureStates.map(f => {
                    const fixtureZone = (f.zone || '').toLowerCase();
                    const isMover = f.zone?.includes('MOVING') || fixtureZone.includes('ceiling') || (f.pan !== undefined && f.tilt !== undefined);
                    if (!isMover)
                        return f;
                    // Determinar si es izquierda o derecha
                    const isLeft = fixtureZone.includes('left') || f.zone?.includes('LEFT');
                    const isRight = fixtureZone.includes('right') || f.zone?.includes('RIGHT');
                    // Seleccionar el movement correcto según lado
                    let mov;
                    if (isLeft && leftMovement) {
                        mov = leftMovement;
                    }
                    else if (isRight && rightMovement) {
                        mov = rightMovement;
                    }
                    else {
                        // Si no es claramente L/R, usar el promedio o el que exista
                        mov = leftMovement || rightMovement;
                    }
                    if (!mov)
                        return f;
                    let newPan = f.pan;
                    let newTilt = f.tilt;
                    let newPhysicalPan = f.physicalPan ?? f.pan;
                    let newPhysicalTilt = f.physicalTilt ?? f.tilt;
                    if (mov.isAbsolute) {
                        // ABSOLUTE MODE: Reemplaza completamente
                        if (mov.pan !== undefined) {
                            // Convertir 0..1 → 0..255 (zoneOverrides usa 0-1 no -1..1)
                            newPan = Math.round(mov.pan * 255);
                            newPhysicalPan = newPan;
                        }
                        if (mov.tilt !== undefined) {
                            newTilt = Math.round(mov.tilt * 255);
                            newPhysicalTilt = newTilt;
                        }
                    }
                    else {
                        // OFFSET MODE: Suma
                        if (mov.pan !== undefined) {
                            const panOffset = Math.round((mov.pan - 0.5) * 255);
                            newPan = Math.max(0, Math.min(255, f.pan + panOffset));
                            newPhysicalPan = Math.max(0, Math.min(255, (f.physicalPan ?? f.pan) + panOffset));
                        }
                        if (mov.tilt !== undefined) {
                            const tiltOffset = Math.round((mov.tilt - 0.5) * 255);
                            newTilt = Math.max(0, Math.min(255, f.tilt + tiltOffset));
                            newPhysicalTilt = Math.max(0, Math.min(255, (f.physicalTilt ?? f.tilt) + tiltOffset));
                        }
                    }
                    return {
                        ...f,
                        pan: newPan,
                        tilt: newTilt,
                        physicalPan: newPhysicalPan,
                        physicalTilt: newPhysicalTilt,
                    };
                });
                // Log throttled
                if (this.frameCount % 30 === 0) {
                    console.log(`[TitanOrchestrator ✂️] STEREO MOVEMENT: L=${leftMovement ? `P${leftMovement.pan?.toFixed(2)}/T${leftMovement.tilt?.toFixed(2)}` : 'N/A'} R=${rightMovement ? `P${rightMovement.pan?.toFixed(2)}/T${rightMovement.tilt?.toFixed(2)}` : 'N/A'}`);
                }
            }
        }
        // 🥁 WAVE 700.7: MOVEMENT OVERRIDE - Efectos controlan Pan/Tilt de movers
        // Solo se aplica si NO hay zoneOverrides con movement (fallback global)
        const hasZoneMovement = effectOutput.zoneOverrides &&
            (effectOutput.zoneOverrides['movers_left']?.movement || effectOutput.zoneOverrides['movers_right']?.movement);
        if (effectOutput.hasActiveEffects && effectOutput.movementOverride && !hasZoneMovement) {
            const mov = effectOutput.movementOverride;
            // Solo aplicar a fixtures que son movers (tienen pan/tilt)
            fixtureStates = fixtureStates.map(f => {
                // Detectar si es un mover (zone contiene MOVING o tiene pan/tilt definido)
                const isMover = f.zone?.includes('MOVING') || (f.pan !== undefined && f.tilt !== undefined);
                if (!isMover)
                    return f;
                let newPan = f.pan;
                let newTilt = f.tilt;
                let newPhysicalPan = f.physicalPan ?? f.pan;
                let newPhysicalTilt = f.physicalTilt ?? f.tilt;
                if (mov.isAbsolute) {
                    // ABSOLUTE MODE: Reemplaza completamente las físicas
                    // Convertir -1.0..1.0 → 0..255
                    if (mov.pan !== undefined) {
                        newPan = Math.round(((mov.pan + 1) / 2) * 255);
                        newPhysicalPan = newPan;
                    }
                    if (mov.tilt !== undefined) {
                        newTilt = Math.round(((mov.tilt + 1) / 2) * 255);
                        newPhysicalTilt = newTilt;
                    }
                }
                else {
                    // OFFSET MODE: Suma a las físicas existentes
                    // Convertir offset -1.0..1.0 → -127..127 y sumar
                    if (mov.pan !== undefined) {
                        const panOffset = Math.round(mov.pan * 127);
                        newPan = Math.max(0, Math.min(255, f.pan + panOffset));
                        newPhysicalPan = Math.max(0, Math.min(255, (f.physicalPan ?? f.pan) + panOffset));
                    }
                    if (mov.tilt !== undefined) {
                        const tiltOffset = Math.round(mov.tilt * 127);
                        newTilt = Math.max(0, Math.min(255, f.tilt + tiltOffset));
                        newPhysicalTilt = Math.max(0, Math.min(255, (f.physicalTilt ?? f.tilt) + tiltOffset));
                    }
                }
                return {
                    ...f,
                    pan: newPan,
                    tilt: newTilt,
                    physicalPan: newPhysicalPan,
                    physicalTilt: newPhysicalTilt,
                };
            });
            // Log throttled
            if (this.frameCount % 15 === 0) {
                const mode = mov.isAbsolute ? 'ABSOLUTE' : 'OFFSET';
                console.log(`[TitanOrchestrator 🥁] MOVEMENT OVERRIDE [${mode}]: Pan=${mov.pan?.toFixed(2) ?? 'N/A'} Tilt=${mov.tilt?.toFixed(2) ?? 'N/A'}`);
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
            hihatDetected: hihatDetected ?? this.lastAudioData.hihatDetected
        };
        // 🔥 WAVE 1012.5: Frontend también detecta audio real
        this.hasRealAudio = energy > 0.01;
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
        // WAVE 380: Log fixture ingestion
        console.log(`[TitanOrchestrator] 📥 Ingesting ${fixtures.length} fixtures into Engine loop`);
        console.log(`[TitanOrchestrator] 📥 Fixture IDs:`, fixtures.map(f => f.id).slice(0, 5).join(', '), '...');
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
            universe: f.universe || 1,
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
    // ═══════════════════════════════════════════════════════════════════════════
    // 🎨 WAVE 725: ZONE MATCHING HELPER - Pinceles Finos
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * Determina si una fixture pertenece a una zona específica
     * Soporta AMBOS sistemas de zonas:
     *   - Legacy canvas: FRONT_PARS, BACK_PARS, MOVING_LEFT, MOVING_RIGHT
     *   - Constructor 3D: ceiling-left, ceiling-right, floor-front, floor-back
     *
     * @param fixtureZone Zona de la fixture (lowercase)
     * @param targetZone Zona objetivo del efecto
     * @returns true si la fixture pertenece a la zona
     */
    fixtureMatchesZone(fixtureZone, targetZone) {
        const fz = fixtureZone.toLowerCase();
        const tz = targetZone.toLowerCase();
        // ═══════════════════════════════════════════════════════════════════════
        // 🔥 WAVE 730: MAPEO ESTRICTO DE ZONAS
        // No más includes() vagos que causan matches falsos
        // ═══════════════════════════════════════════════════════════════════════
        switch (tz) {
            case 'all':
                return true;
            case 'front':
                // SOLO front pars, NO movers aunque estén "en frente"
                return fz === 'front_pars' || fz === 'floor-front';
            // 🪼 WAVE 1070.3: STEREO PARs support
            case 'frontl':
                return fz === 'front_pars' || fz === 'floor-front'; // Front left PARs
            case 'frontr':
                return fz === 'front_pars' || fz === 'floor-front'; // Front right PARs
            case 'back':
                // SOLO back pars, NO movers aunque estén "atrás"
                return fz === 'back_pars' || fz === 'floor-back';
            // 🪼 WAVE 1070.3: STEREO PARs support
            case 'backl':
                return fz === 'back_pars' || fz === 'floor-back'; // Back left PARs
            case 'backr':
                return fz === 'back_pars' || fz === 'floor-back'; // Back right PARs
            case 'movers':
                // SOLO cabezas móviles - CRITICAL: NO incluir pars
                return fz === 'moving_left' || fz === 'moving_right' ||
                    fz === 'MOVING_LEFT' || fz === 'MOVING_RIGHT' || // 🔥 WAVE 810.5: Legacy uppercase
                    fz === 'ceiling-left' || fz === 'ceiling-right' ||
                    fz.startsWith('moving') || fz.startsWith('ceiling');
            // 🔥 WAVE 810: UNLOCK THE TWINS - Targeting L/R específico
            case 'movers_left':
                // SOLO movers del lado izquierdo
                return fz === 'moving_left' || fz === 'ceiling-left' || fz === 'MOVING_LEFT'; // 🔥 WAVE 810.5: uppercase
            case 'movers_right':
                // SOLO movers del lado derecho
                return fz === 'moving_right' || fz === 'ceiling-right' || fz === 'MOVING_RIGHT'; // 🔥 WAVE 810.5: uppercase
            case 'pars':
                // Todos los PARs (front + back) pero NUNCA movers
                return fz === 'front_pars' || fz === 'back_pars' ||
                    fz === 'floor-front' || fz === 'floor-back';
            case 'left':
                // Solo fixtures del lado izquierdo
                return fz === 'moving_left' || fz === 'ceiling-left';
            case 'right':
                // Solo fixtures del lado derecho
                return fz === 'moving_right' || fz === 'ceiling-right';
            default:
                // 🔥 WAVE 730: Sin fallback permisivo
                // Si no reconocemos la zona, NO ENTREGAMOS NADA
                console.warn(`[fixtureMatchesZone] Unknown target zone: '${tz}' for fixture zone: '${fz}'`);
                return false;
        }
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

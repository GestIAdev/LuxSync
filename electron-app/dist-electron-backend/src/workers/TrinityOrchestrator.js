/**
 * 🛡️ TRINITY ORCHESTRATOR - ALPHA (Main Process)
 *
 * El orquestador principal que coordina los Worker Threads:
 * - Spawning y lifecycle management de BETA y GAMMA
 * - Routing de mensajes entre workers
 * - Phoenix Protocol (resurrections)
 * - Heartbeat monitoring
 * - DMX output (baja latencia)
 *
 * ALPHA vive en el Main Process de Electron para:
 * 1. Acceso directo a USB/Serial (DMX)
 * 2. Mínima latencia en output
 * 3. Control total sobre workers
 */
import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import * as path from 'path';
import { MessageType, MessagePriority, NODE_NAMES, DEFAULT_CONFIG, createMessage, isWorkerHealth, isMusicalContext // 🧠 WAVE 230: THE LOBOTOMY
 } from './WorkerProtocol';
// ============================================
// CIRCUIT BREAKER (Adapted from Swarm)
// ============================================
var CircuitState;
(function (CircuitState) {
    CircuitState["CLOSED"] = "closed";
    CircuitState["OPEN"] = "open";
    CircuitState["HALF_OPEN"] = "half_open"; // Testing if recovered
})(CircuitState || (CircuitState = {}));
const CIRCUIT_THRESHOLD = 3; // Failures before opening
const CIRCUIT_TIMEOUT = 5000; // ms before trying half-open
const CIRCUIT_HALF_OPEN_SUCCESS = 2; // Successes to close again
// ============================================
// TRINITY ORCHESTRATOR CLASS
// ============================================
export class TrinityOrchestrator extends EventEmitter {
    static getWorkerDir() {
        // In Electron bundled with Vite, we need to find dist-electron
        // Try multiple strategies:
        // Strategy 1: Check if __dirname points to dist-electron
        if (__dirname.includes('dist-electron')) {
            return __dirname;
        }
        // Strategy 2: Look relative to process.cwd() (electron app root)
        const distElectron = path.join(process.cwd(), 'dist-electron');
        // Strategy 3: Try to use app.getAppPath() if available (Electron main process)
        try {
            // Dynamic import to avoid issues in non-Electron contexts
            const { app } = require('electron');
            if (app) {
                const appPath = app.getAppPath();
                const electronDist = path.join(appPath, 'dist-electron');
                console.log('[ALPHA] Using Electron app path:', electronDist);
                return electronDist;
            }
        }
        catch (e) {
            // Not in Electron main process, continue with other strategies
        }
        console.log('[ALPHA] Using dist-electron from cwd:', distElectron);
        return distElectron;
    }
    constructor(config = {}) {
        super();
        this.nodes = new Map();
        this.isRunning = false;
        this.heartbeatInterval = null;
        this.healthCheckInterval = null;
        this.startTime = Date.now();
        // ============================================
        // AUDIO INPUT
        // ============================================
        /**
         * Feed audio buffer to BETA for analysis.
         * Called from audio input system via IPC lux:audio-buffer.
         *
         * 🗡️ WAVE 15.3 REAL: This is the ONLY way audio enters the system.
         * NO BYPASS. NO PRE-PROCESSED DATA. RAW BUFFER → BETA → FFT → GAMMA.
         */
        this.audioBufferCount = 0; // 🔍 WAVE 263: Contador para debug
        this.audioRejectCount = 0; // 🔍 WAVE 264.7: Contador de rechazos
        // ============================================
        // SEND TO WORKER
        // ============================================
        // 🔧 WAVE 15.1: Cola de configuración pendiente
        this.pendingConfig = null;
        this.config = { ...DEFAULT_CONFIG, ...config };
        // Initialize worker paths
        const workerDir = TrinityOrchestrator.getWorkerDir();
        this.WORKER_PATHS = {
            beta: path.join(workerDir, 'senses.js'),
            gamma: path.join(workerDir, 'mind.js')
        };
        console.log('[ALPHA] Worker paths:', this.WORKER_PATHS);
        this.initializeNodes();
    }
    // ============================================
    // INITIALIZATION
    // ============================================
    initializeNodes() {
        // Initialize node tracking (workers not spawned yet)
        const nodeIds = ['beta', 'gamma'];
        for (const id of nodeIds) {
            this.nodes.set(id, {
                id,
                worker: null,
                health: null,
                circuit: {
                    state: CircuitState.CLOSED,
                    failures: 0,
                    lastFailure: 0,
                    successesInHalfOpen: 0
                },
                resurrections: 0,
                lastHeartbeat: 0,
                lastHeartbeatLatency: 0,
                heartbeatSequence: 0,
                isReady: false,
                stateSnapshot: null
            });
        }
        console.log('[ALPHA] 🛡️ Trinity Orchestrator initialized');
    }
    // ============================================
    // START / STOP
    // ============================================
    async start() {
        if (this.isRunning) {
            console.warn('[ALPHA] Already running');
            return;
        }
        console.log('[ALPHA] 🚀 Starting Trinity...');
        this.startTime = Date.now();
        this.isRunning = true;
        try {
            // Spawn workers
            await this.spawnWorker('beta');
            await this.spawnWorker('gamma');
            // Start heartbeat monitoring
            this.startHeartbeat();
            this.startHealthCheck();
            // Wait for both workers to be ready
            await this.waitForReady();
            console.log('[ALPHA] ✅ Trinity is LIVE');
            this.emit('ready');
        }
        catch (error) {
            console.error('[ALPHA] Failed to start:', error);
            await this.stop();
            throw error;
        }
    }
    async stop() {
        console.log('[ALPHA] 🛑 Stopping Trinity...');
        this.isRunning = false;
        // Stop intervals
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        // Gracefully shutdown workers
        for (const [nodeId, node] of this.nodes) {
            if (node.worker) {
                this.sendToWorker(nodeId, MessageType.SHUTDOWN, {});
                // Give worker time to cleanup
                await new Promise(resolve => setTimeout(resolve, 500));
                try {
                    await node.worker.terminate();
                }
                catch (e) {
                    console.warn(`[ALPHA] Error terminating ${nodeId}:`, e);
                }
                node.worker = null;
                node.isReady = false;
            }
        }
        this.emit('shutdown');
        console.log('[ALPHA] Trinity stopped');
    }
    // ============================================
    // WORKER SPAWNING
    // ============================================
    async spawnWorker(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node)
            return;
        // Check circuit breaker
        if (node.circuit.state === CircuitState.OPEN) {
            const elapsed = Date.now() - node.circuit.lastFailure;
            if (elapsed < CIRCUIT_TIMEOUT) {
                console.log(`[ALPHA] Circuit OPEN for ${nodeId}, waiting...`);
                return;
            }
            // Try half-open
            node.circuit.state = CircuitState.HALF_OPEN;
            console.log(`[ALPHA] Circuit HALF-OPEN for ${nodeId}, testing...`);
        }
        console.log(`[ALPHA] Spawning ${NODE_NAMES[nodeId]}...`);
        const workerPath = this.WORKER_PATHS[nodeId];
        // 🧠 WAVE 10: Check if worker file exists before spawning
        const fs = await import('fs');
        if (!fs.existsSync(workerPath)) {
            console.warn(`[ALPHA] ⚠️ Worker file not found: ${workerPath}`);
            console.warn(`[ALPHA] ⚠️ ${NODE_NAMES[nodeId]} will run in MAIN THREAD mode`);
            // Mark as "ready" but without actual worker
            node.isReady = true;
            return;
        }
        const worker = new Worker(workerPath, {
            workerData: { config: this.config }
        });
        // Set up message handler
        worker.on('message', (message) => {
            this.handleWorkerMessage(nodeId, message);
        });
        // Handle errors
        worker.on('error', (error) => {
            console.error(`[ALPHA] Worker ${nodeId} error:`, error);
            this.handleWorkerFailure(nodeId, error.message);
        });
        // Handle exit
        worker.on('exit', (code) => {
            console.log(`[ALPHA] Worker ${nodeId} exited with code ${code}`);
            if (this.isRunning && code !== 0) {
                this.handleWorkerDeath(nodeId);
            }
        });
        node.worker = worker;
        // Send init message
        this.sendToWorker(nodeId, MessageType.INIT, {
            config: this.config,
            timestamp: Date.now()
        });
    }
    async waitForReady() {
        const timeout = 10000; // 10 seconds
        const startTime = Date.now();
        return new Promise((resolve, reject) => {
            const check = () => {
                const beta = this.nodes.get('beta');
                const gamma = this.nodes.get('gamma');
                if (beta?.isReady && gamma?.isReady) {
                    resolve();
                    return;
                }
                if (Date.now() - startTime > timeout) {
                    reject(new Error('Timeout waiting for workers to be ready'));
                    return;
                }
                setTimeout(check, 100);
            };
            check();
        });
    }
    // ============================================
    // MESSAGE HANDLING
    // ============================================
    handleWorkerMessage(sourceId, message) {
        const node = this.nodes.get(sourceId);
        if (!node)
            return;
        switch (message.type) {
            case MessageType.READY:
                node.isReady = true;
                node.circuit.state = CircuitState.CLOSED;
                node.circuit.failures = 0;
                console.log(`[ALPHA] ${NODE_NAMES[sourceId]} is READY`);
                // 🔧 WAVE 15.1: Enviar configuración pendiente ahora que está listo
                this.flushPendingConfig(sourceId);
                break;
            case MessageType.HEARTBEAT_ACK:
                const ack = message.payload;
                node.lastHeartbeat = Date.now();
                node.lastHeartbeatLatency = ack.latency;
                // Circuit breaker success in half-open
                if (node.circuit.state === CircuitState.HALF_OPEN) {
                    node.circuit.successesInHalfOpen++;
                    if (node.circuit.successesInHalfOpen >= CIRCUIT_HALF_OPEN_SUCCESS) {
                        node.circuit.state = CircuitState.CLOSED;
                        node.circuit.failures = 0;
                        console.log(`[ALPHA] Circuit CLOSED for ${sourceId}`);
                    }
                }
                break;
            case MessageType.HEALTH_REPORT:
                if (isWorkerHealth(message.payload)) {
                    node.health = message.payload;
                    this.emit('health-update', sourceId, message.payload);
                }
                break;
            case MessageType.AUDIO_ANALYSIS:
                // BETA → ALPHA: Forward to GAMMA
                this.emit('audio-analysis', message.payload);
                this.sendToWorker('gamma', MessageType.AUDIO_ANALYSIS, message.payload);
                break;
            // 🔪 WAVE 230.5: DEPRECATED - Worker ya NO emite LIGHTING_DECISION
            // El color ahora lo decide TitanEngine (TITAN 2.0), no el Worker
            // case MessageType.LIGHTING_DECISION:
            //   if (isLightingDecision(message.payload)) {
            //     this.emit('lighting-decision', message.payload);
            //     this.processLightingDecision(message.payload);
            //   }
            //   break;
            // 🧠 WAVE 230: THE LOBOTOMY - Musical Context for TITAN 2.0
            case MessageType.MUSICAL_CONTEXT:
                // GAMMA → ALPHA: Pure musical context (no color decisions)
                // TITAN 2.0's TrinityBrain receives this; Legacy V1 ignores it
                if (isMusicalContext(message.payload)) {
                    this.emit('context-update', message.payload);
                }
                break;
            case MessageType.WORKER_ERROR:
                const errorPayload = message.payload;
                console.error(`[ALPHA] Error from ${sourceId}:`, errorPayload.error);
                this.emit('worker-error', sourceId, errorPayload.error);
                if (errorPayload.fatal) {
                    this.handleWorkerFailure(sourceId, errorPayload.error);
                }
                break;
            default:
                console.warn(`[ALPHA] Unhandled message type: ${message.type}`);
        }
    }
    // ============================================
    // DMX OUTPUT
    // ============================================
    processLightingDecision(decision) {
        // This is where we'd convert the decision to DMX values
        // and send to the USB DMX interface
        // � WAVE 230.5: processLightingDecision ya no se usa
        // Los cambios de estado ahora van por context-update → TitanEngine
        // if (decision.confidence > 0.8) {
        //   console.log(
        //     `[ALPHA] 💡 DMX: palette=${decision.palette.intensity.toFixed(2)}, ` +
        //     `movement=${decision.movement.pattern}, beauty=${decision.beautyScore.toFixed(2)}`
        //   );
        // }
        // TODO: Integrate with actual DMX driver
        // this.dmxDriver.sendDecision(decision);
    }
    // ============================================
    // HEARTBEAT
    // ============================================
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            for (const [nodeId, node] of this.nodes) {
                if (node.worker && node.isReady) {
                    node.heartbeatSequence++;
                    const payload = {
                        timestamp: Date.now(),
                        sequence: node.heartbeatSequence
                    };
                    this.sendToWorker(nodeId, MessageType.HEARTBEAT, payload, MessagePriority.HIGH);
                    // Check for missed heartbeats
                    const timeSinceLastHB = Date.now() - node.lastHeartbeat;
                    if (node.lastHeartbeat > 0 && timeSinceLastHB > this.config.heartbeatTimeout) {
                        console.warn(`[ALPHA] ${nodeId} missed heartbeat (${timeSinceLastHB}ms)`);
                        this.handleWorkerFailure(nodeId, 'Heartbeat timeout');
                    }
                }
            }
        }, this.config.heartbeatInterval);
    }
    startHealthCheck() {
        this.healthCheckInterval = setInterval(() => {
            for (const [nodeId, node] of this.nodes) {
                if (node.worker && node.isReady) {
                    this.sendToWorker(nodeId, MessageType.HEALTH_REQUEST, {});
                }
            }
        }, 5000);
    }
    // ============================================
    // PHOENIX PROTOCOL
    // ============================================
    handleWorkerFailure(nodeId, _reason) {
        const node = this.nodes.get(nodeId);
        if (!node)
            return;
        // Only beta and gamma can be resurrected
        if (nodeId === 'alpha')
            return;
        node.circuit.failures++;
        node.circuit.lastFailure = Date.now();
        if (node.circuit.failures >= CIRCUIT_THRESHOLD) {
            node.circuit.state = CircuitState.OPEN;
            console.log(`[ALPHA] Circuit OPEN for ${nodeId} after ${node.circuit.failures} failures`);
        }
        // Trigger resurrection if not too many
        if (node.resurrections < this.config.maxResurrections) {
            this.resurrectWorker(nodeId);
        }
        else {
            console.error(`[ALPHA] ${nodeId} exceeded max resurrections (${this.config.maxResurrections})`);
            this.emit('worker-died', nodeId);
        }
    }
    handleWorkerDeath(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node)
            return;
        console.log(`[ALPHA] 💀 ${NODE_NAMES[nodeId]} died unexpectedly`);
        node.worker = null;
        node.isReady = false;
        this.handleWorkerFailure(nodeId, 'Unexpected death');
    }
    async resurrectWorker(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node)
            return;
        // Save state snapshot before killing
        if (node.worker) {
            try {
                await node.worker.terminate();
            }
            catch (e) {
                // Worker may already be dead
            }
            node.worker = null;
        }
        node.resurrections++;
        console.log(`[ALPHA] 🔥 PHOENIX: Resurrecting ${NODE_NAMES[nodeId]} (attempt ${node.resurrections})`);
        // Wait before respawn
        await new Promise(resolve => setTimeout(resolve, this.config.resurrectionDelay));
        await this.spawnWorker(nodeId);
        // Restore state if available
        if (node.stateSnapshot) {
            this.sendToWorker(nodeId, MessageType.STATE_RESTORE, {
                state: node.stateSnapshot
            });
        }
        this.emit('worker-resurrected', nodeId);
    }
    feedAudioBuffer(buffer) {
        if (!this.isRunning) {
            // 🔍 WAVE 264.7: Log AGRESIVO cuando no está corriendo
            this.audioRejectCount++;
            if (this.audioRejectCount % 60 === 1) { // Cada ~1 segundo
                console.warn(`[ALPHA] ⛔ feedAudioBuffer REJECTED #${this.audioRejectCount} | isRunning=false`);
            }
            this.audioBufferCount++;
            return;
        }
        this.audioBufferCount++;
        const beta = this.nodes.get('beta');
        // 🧹 WAVE 671.5: Silenced audio buffer spam (every 2s)
        // 🔍 WAVE 264.7: Log cada 2 segundos (~120 frames a 60fps)
        // if (this.audioBufferCount % 120 === 0) {
        //   console.log(`[ALPHA 📡] feedAudioBuffer #${this.audioBufferCount} | beta.ready=${beta?.isReady} | circuit=${beta?.circuit.state} | failures=${beta?.circuit.failures}`);
        // }
        // 🔍 WAVE 262 DEBUG: ¿Por qué BETA no recibe audio?
        if (!beta?.worker) {
            console.warn('[ALPHA] ⚠️ BETA worker not available!');
            return;
        }
        if (!beta.isReady) {
            console.warn('[ALPHA] ⚠️ BETA worker not ready!');
            return;
        }
        if (beta.circuit.state === CircuitState.OPEN) {
            console.warn(`[ALPHA] ⛔ BETA circuit breaker OPEN! failures=${beta.circuit.failures}`);
            return;
        }
        this.sendToWorker('beta', MessageType.AUDIO_BUFFER, buffer, MessagePriority.HIGH);
    }
    // ============================================
    // 🗡️ WAVE 261.5: DEPRECATED - feedAudioMetrics
    // ============================================
    // 
    // ⚠️ DEPRECATED: Este método viola el principio de WAVE 15.3:
    //    "This is the ONLY way audio enters the system. NO BYPASS."
    //
    // El problema: feedAudioMetrics enviaba datos directamente a GAMMA
    // sin pasar por BETA, lo que causaba:
    //   1. AudioAnalysis sin wave8 data → GAMMA no puede detectar género
    //   2. BPM hardcodeado o simplificado
    //   3. Contexto musical siempre UNKNOWN
    //
    // El flujo correcto es SOLO:
    //   Frontend → audioBuffer() → feedAudioBuffer() → BETA (FFT) → GAMMA
    //
    // Este método se mantiene solo por compatibilidad temporal.
    // NO LO USES. Será eliminado en una futura wave.
    // ============================================
    /**
     * @deprecated Use feedAudioBuffer() instead. This method bypasses BETA worker
     * and produces incomplete AudioAnalysis without wave8 data.
     */
    feedAudioMetrics(_metrics) {
        // 🗡️ WAVE 261.5: Method body intentionally disabled
        // This was causing GAMMA to receive incomplete data
        console.warn('[ALPHA] ⚠️ feedAudioMetrics() is DEPRECATED. Use feedAudioBuffer() instead.');
    }
    sendToWorker(nodeId, type, payload, priority = MessagePriority.NORMAL) {
        const node = this.nodes.get(nodeId);
        if (!node?.worker) {
            console.warn(`[ALPHA] Cannot send to ${nodeId}: no worker`);
            // 🔧 WAVE 15.1: Si es CONFIG_UPDATE, guardar para enviar después
            if (type === MessageType.CONFIG_UPDATE) {
                this.pendingConfig = payload;
                console.log(`[ALPHA] 📦 Config queued for ${nodeId} (will send when worker ready)`);
            }
            return;
        }
        const message = createMessage(type, 'alpha', nodeId, payload, priority);
        node.worker.postMessage(message);
    }
    /**
     * 🔧 WAVE 15.2: SIEMPRE inyectar configuración completa cuando worker nace
     * No esperar a que haya config pendiente - inyectar la config actual siempre
     */
    flushPendingConfig(nodeId) {
        // 💉 FORCE FEED: Inyectar configuración actual SIEMPRE al worker que nace
        const configToInject = this.pendingConfig || this.config;
        const gainPercent = ((configToInject.inputGain || 1.0) * 100).toFixed(0);
        console.log(`[ALPHA] � Injecting initial config to ${nodeId} (Gain: ${gainPercent}%)`);
        this.sendToWorker(nodeId, MessageType.CONFIG_UPDATE, configToInject);
        // Limpiar config pendiente si existía
        if (this.pendingConfig) {
            this.pendingConfig = null;
        }
    }
    // ============================================
    // STATUS
    // ============================================
    getStatus() {
        const nodes = {};
        for (const [id, node] of this.nodes) {
            nodes[id] = {
                isReady: node.isReady,
                circuitState: node.circuit.state,
                resurrections: node.resurrections,
                lastHeartbeatLatency: node.lastHeartbeatLatency,
                health: node.health
            };
        }
        return {
            isRunning: this.isRunning,
            uptime: Date.now() - this.startTime,
            nodes: nodes
        };
    }
    /**
     * Update configuration dynamically
     */
    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
        // Propagate to workers
        for (const [nodeId] of this.nodes) {
            this.sendToWorker(nodeId, MessageType.CONFIG_UPDATE, this.config);
        }
        console.log('[ALPHA] Config updated and propagated');
    }
    // ============================================
    // 🧠 WAVE 10: BRAIN CONTROL
    // ============================================
    /**
     * Enable the Brain in GAMMA worker
     * Called when user switches to SELENE mode
     */
    enableBrain() {
        const gamma = this.nodes.get('gamma');
        if (!gamma?.worker) {
            console.warn('[ALPHA] ⚠️ Cannot enable brain: GAMMA worker not spawned yet');
            return;
        }
        console.log('[ALPHA] 🧠 Sending ENABLE_BRAIN to GAMMA...');
        this.sendToWorker('gamma', MessageType.ENABLE_BRAIN, {}, MessagePriority.HIGH);
    }
    /**
     * Disable the Brain in GAMMA worker
     * Called when user switches to FLOW mode
     */
    disableBrain() {
        const gamma = this.nodes.get('gamma');
        if (!gamma?.worker) {
            // No worker yet - this is expected if Trinity hasn't started
            // (e.g., app started in FLOW mode)
            return;
        }
        console.log('[ALPHA] 💤 Sending DISABLE_BRAIN to GAMMA...');
        this.sendToWorker('gamma', MessageType.DISABLE_BRAIN, {}, MessagePriority.HIGH);
    }
    /**
     * Set operation mode on GAMMA worker
     */
    setGammaMode(mode) {
        console.log(`[ALPHA] 🎚️ Setting GAMMA mode to: ${mode}`);
        this.sendToWorker('gamma', MessageType.SET_MODE, { mode }, MessagePriority.HIGH);
    }
    /**
     * 🎛️ WAVE 62: Set active Vibe profile on workers
     * 🎯 WAVE 289.5: NOW PROPAGATES TO BETA TOO!
     *
     * Routes UI vibe selection to:
     * - GAMMA (Mind worker) for VibeManager
     * - BETA (Senses worker) for VibeSectionTracker (NEW!)
     *
     * The SimpleSectionTracker in BETA needs to know the vibe
     * to use correct thresholds for DROP detection.
     */
    setVibe(vibeId) {
        console.log(`[ALPHA] 🎛️ Setting VIBE to: ${vibeId}`);
        // 🎯 WAVE 289.5: Send to BOTH workers
        const gamma = this.nodes.get('gamma');
        const beta = this.nodes.get('beta');
        if (gamma?.worker) {
            this.sendToWorker('gamma', MessageType.SET_VIBE, { vibeId }, MessagePriority.HIGH);
        }
        else {
            console.warn('[ALPHA] ⚠️ Cannot set vibe on GAMMA: worker not spawned yet');
        }
        // � WAVE 289.5: NUEVO - También a BETA para el SectionTracker
        if (beta?.worker) {
            this.sendToWorker('beta', MessageType.SET_VIBE, { vibeId }, MessagePriority.HIGH);
            console.log(`[ALPHA] 🎯 WAVE 289.5: Vibe propagated to BETA SectionTracker`);
        }
        else {
            console.warn('[ALPHA] ⚠️ Cannot set vibe on BETA: worker not spawned yet');
        }
    }
    /**
     * 🔌 WAVE 63.95: System Sleep - Pause all workers
     * Sends SYSTEM_SLEEP to Mind worker to stop processing audio
     */
    systemSleep() {
        const gamma = this.nodes.get('gamma');
        if (!gamma?.worker) {
            console.warn('[ALPHA] ⚠️ Cannot sleep: GAMMA worker not spawned');
            return;
        }
        console.log('[ALPHA] 💤 Sending SYSTEM_SLEEP to workers');
        this.sendToWorker('gamma', MessageType.SYSTEM_SLEEP, {}, MessagePriority.HIGH);
    }
    /**
     * 🔌 WAVE 63.95: System Wake - Resume all workers
     * Sends SYSTEM_WAKE to Mind worker to resume processing
     */
    systemWake() {
        const gamma = this.nodes.get('gamma');
        if (!gamma?.worker) {
            console.warn('[ALPHA] ⚠️ Cannot wake: GAMMA worker not spawned');
            return;
        }
        console.log('[ALPHA] ☀️ Sending SYSTEM_WAKE to workers');
        this.sendToWorker('gamma', MessageType.SYSTEM_WAKE, {}, MessagePriority.HIGH);
    }
}
// ============================================
// SINGLETON INSTANCE
// ============================================
let trinityInstance = null;
export function getTrinity() {
    if (!trinityInstance) {
        trinityInstance = new TrinityOrchestrator();
    }
    return trinityInstance;
}
export function createTrinity(config) {
    if (trinityInstance) {
        console.warn('[ALPHA] Trinity already exists, returning existing instance');
        return trinityInstance;
    }
    trinityInstance = new TrinityOrchestrator(config);
    return trinityInstance;
}

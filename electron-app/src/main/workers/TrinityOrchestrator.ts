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
import {
  WorkerMessage,
  MessageType,
  MessagePriority,
  NodeId,
  NODE_NAMES,
  WorkerHealth,
  AudioAnalysis,
  LightingDecision,
  HeartbeatPayload,
  HeartbeatAckPayload,
  TrinityConfig,
  DEFAULT_CONFIG,
  createMessage,
  isLightingDecision,
  isWorkerHealth
} from './WorkerProtocol';

// ============================================
// CIRCUIT BREAKER (Adapted from Swarm)
// ============================================

enum CircuitState {
  CLOSED = 'closed',      // Normal operation
  OPEN = 'open',          // Failing, rejecting calls
  HALF_OPEN = 'half_open' // Testing if recovered
}

interface CircuitBreaker {
  state: CircuitState;
  failures: number;
  lastFailure: number;
  successesInHalfOpen: number;
}

const CIRCUIT_THRESHOLD = 3;        // Failures before opening
const CIRCUIT_TIMEOUT = 5000;       // ms before trying half-open
const CIRCUIT_HALF_OPEN_SUCCESS = 2; // Successes to close again

// ============================================
// WORKER NODE
// ============================================

interface WorkerNode {
  id: NodeId;
  worker: Worker | null;
  health: WorkerHealth | null;
  circuit: CircuitBreaker;
  resurrections: number;
  lastHeartbeat: number;
  lastHeartbeatLatency: number;
  heartbeatSequence: number;
  isReady: boolean;
  stateSnapshot: unknown;
}

// ============================================
// EVENTS
// ============================================

export interface TrinityEvents {
  'ready': () => void;
  'lighting-decision': (decision: LightingDecision) => void;
  'audio-analysis': (analysis: AudioAnalysis) => void;
  'health-update': (nodeId: NodeId, health: WorkerHealth) => void;
  'worker-error': (nodeId: NodeId, error: string) => void;
  'worker-died': (nodeId: NodeId) => void;
  'worker-resurrected': (nodeId: NodeId) => void;
  'shutdown': () => void;
}

// ============================================
// TRINITY ORCHESTRATOR CLASS
// ============================================

export class TrinityOrchestrator extends EventEmitter {
  private config: TrinityConfig;
  private nodes: Map<NodeId, WorkerNode> = new Map();
  private isRunning = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private startTime = Date.now();
  
  // Worker script paths (relative to dist)
  private readonly WORKER_PATHS = {
    beta: path.join(__dirname, 'senses.js'),
    gamma: path.join(__dirname, 'mind.js')
  };
  
  constructor(config: Partial<TrinityConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeNodes();
  }
  
  // ============================================
  // INITIALIZATION
  // ============================================
  
  private initializeNodes(): void {
    // Initialize node tracking (workers not spawned yet)
    const nodeIds: NodeId[] = ['beta', 'gamma'];
    
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
  
  async start(): Promise<void> {
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
      
    } catch (error) {
      console.error('[ALPHA] Failed to start:', error);
      await this.stop();
      throw error;
    }
  }
  
  async stop(): Promise<void> {
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
        } catch (e) {
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
  
  private async spawnWorker(nodeId: 'beta' | 'gamma'): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    
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
    
    const worker = new Worker(workerPath, {
      workerData: { config: this.config }
    });
    
    // Set up message handler
    worker.on('message', (message: WorkerMessage) => {
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
  
  private async waitForReady(): Promise<void> {
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
  
  private handleWorkerMessage(sourceId: NodeId, message: WorkerMessage): void {
    const node = this.nodes.get(sourceId);
    if (!node) return;
    
    switch (message.type) {
      case MessageType.READY:
        node.isReady = true;
        node.circuit.state = CircuitState.CLOSED;
        node.circuit.failures = 0;
        console.log(`[ALPHA] ${NODE_NAMES[sourceId]} is READY`);
        break;
        
      case MessageType.HEARTBEAT_ACK:
        const ack = message.payload as HeartbeatAckPayload;
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
        this.emit('audio-analysis', message.payload as AudioAnalysis);
        this.sendToWorker('gamma', MessageType.AUDIO_ANALYSIS, message.payload);
        break;
        
      case MessageType.LIGHTING_DECISION:
        // GAMMA → ALPHA: Process for DMX output
        if (isLightingDecision(message.payload)) {
          this.emit('lighting-decision', message.payload);
          // Here you would send to DMX driver
          this.processLightingDecision(message.payload);
        }
        break;
        
      case MessageType.WORKER_ERROR:
        const errorPayload = message.payload as { error: string; fatal?: boolean };
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
  
  private processLightingDecision(decision: LightingDecision): void {
    // This is where we'd convert the decision to DMX values
    // and send to the USB DMX interface
    
    // For now, just log high-confidence decisions
    if (decision.confidence > 0.8) {
      console.log(
        `[ALPHA] 💡 DMX: palette=${decision.palette.intensity.toFixed(2)}, ` +
        `movement=${decision.movement.pattern}, beauty=${decision.beautyScore.toFixed(2)}`
      );
    }
    
    // TODO: Integrate with actual DMX driver
    // this.dmxDriver.sendDecision(decision);
  }
  
  // ============================================
  // HEARTBEAT
  // ============================================
  
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const [nodeId, node] of this.nodes) {
        if (node.worker && node.isReady) {
          node.heartbeatSequence++;
          
          const payload: HeartbeatPayload = {
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
  
  private startHealthCheck(): void {
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
  
  private handleWorkerFailure(nodeId: NodeId, _reason: string): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    
    // Only beta and gamma can be resurrected
    if (nodeId === 'alpha') return;
    
    node.circuit.failures++;
    node.circuit.lastFailure = Date.now();
    
    if (node.circuit.failures >= CIRCUIT_THRESHOLD) {
      node.circuit.state = CircuitState.OPEN;
      console.log(`[ALPHA] Circuit OPEN for ${nodeId} after ${node.circuit.failures} failures`);
    }
    
    // Trigger resurrection if not too many
    if (node.resurrections < this.config.maxResurrections) {
      this.resurrectWorker(nodeId as 'beta' | 'gamma');
    } else {
      console.error(`[ALPHA] ${nodeId} exceeded max resurrections (${this.config.maxResurrections})`);
      this.emit('worker-died', nodeId);
    }
  }
  
  private handleWorkerDeath(nodeId: NodeId): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    
    console.log(`[ALPHA] 💀 ${NODE_NAMES[nodeId]} died unexpectedly`);
    node.worker = null;
    node.isReady = false;
    
    this.handleWorkerFailure(nodeId, 'Unexpected death');
  }
  
  private async resurrectWorker(nodeId: 'beta' | 'gamma'): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    
    // Save state snapshot before killing
    if (node.worker) {
      try {
        await node.worker.terminate();
      } catch (e) {
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
  
  // ============================================
  // AUDIO INPUT
  // ============================================
  
  /**
   * Feed audio buffer to BETA for analysis.
   * Called from audio input system.
   */
  feedAudioBuffer(buffer: Float32Array): void {
    if (!this.isRunning) return;
    
    const beta = this.nodes.get('beta');
    if (beta?.worker && beta.isReady && beta.circuit.state !== CircuitState.OPEN) {
      this.sendToWorker('beta', MessageType.AUDIO_BUFFER, buffer, MessagePriority.HIGH);
    }
  }
  
  // ============================================
  // SEND TO WORKER
  // ============================================
  
  private sendToWorker<T>(
    nodeId: NodeId,
    type: MessageType,
    payload: T,
    priority: MessagePriority = MessagePriority.NORMAL
  ): void {
    const node = this.nodes.get(nodeId);
    if (!node?.worker) {
      console.warn(`[ALPHA] Cannot send to ${nodeId}: no worker`);
      return;
    }
    
    const message = createMessage(type, 'alpha', nodeId, payload, priority);
    node.worker.postMessage(message);
  }
  
  // ============================================
  // STATUS
  // ============================================
  
  getStatus(): {
    isRunning: boolean;
    uptime: number;
    nodes: Record<NodeId, {
      isReady: boolean;
      circuitState: CircuitState;
      resurrections: number;
      lastHeartbeatLatency: number;
      health: WorkerHealth | null;
    }>;
  } {
    const nodes: Record<string, unknown> = {};
    
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
      nodes: nodes as Record<NodeId, {
        isReady: boolean;
        circuitState: CircuitState;
        resurrections: number;
        lastHeartbeatLatency: number;
        health: WorkerHealth | null;
      }>
    };
  }
  
  /**
   * Update configuration dynamically
   */
  updateConfig(newConfig: Partial<TrinityConfig>): void {
    Object.assign(this.config, newConfig);
    
    // Propagate to workers
    for (const [nodeId] of this.nodes) {
      this.sendToWorker(nodeId, MessageType.CONFIG_UPDATE, this.config);
    }
    
    console.log('[ALPHA] Config updated and propagated');
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let trinityInstance: TrinityOrchestrator | null = null;

export function getTrinity(): TrinityOrchestrator {
  if (!trinityInstance) {
    trinityInstance = new TrinityOrchestrator();
  }
  return trinityInstance;
}

export function createTrinity(config?: Partial<TrinityConfig>): TrinityOrchestrator {
  if (trinityInstance) {
    console.warn('[ALPHA] Trinity already exists, returning existing instance');
    return trinityInstance;
  }
  trinityInstance = new TrinityOrchestrator(config);
  return trinityInstance;
}

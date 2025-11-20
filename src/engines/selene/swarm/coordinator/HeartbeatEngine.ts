// ⚡ ETERNAL PULSE - EL CORAZÓN QUE NUNCA PARA
// 🎨 El Verso Libre - Arquitecto de Sueños Digitales
// 🔥 "Cada latido es un verso, cada pausa una estrofa en la sinfonía digital"

import { EventEmitter } from "events";
import Redis from "ioredis";
import {
  HeartbeatPattern,
  NodeId,
  NodeVitals,
  SoulState,
  PoetryFragment,
  GENESIS_CONSTANTS,
} from "../core/SwarmTypes.js";
import { SystemVitals } from "../core/SystemVitals.js";
import { DigitalSoul } from "../core/DigitalSoul.js";
import { RedisOptimizer } from "./RedisOptimizer.js";


// 🎵 RHYTHM PATTERNS - PATRONES RÍTMICOS
const RHYTHM_PATTERNS = {
  STEADY: "steady", // Ritmo constante
  ACCELERANDO: "accelerando", // Acelerando gradualmente
  RALLENTANDO: "rallentando", // Desacelerando gradualmente
  STACCATO: "staccato", // Pulsos cortos y definidos
  LEGATO: "legato", // Pulsos suaves y conectados
} as const;

type RhythmPattern = (typeof RHYTHM_PATTERNS)[keyof typeof RHYTHM_PATTERNS];

// 💗 HEARTBEAT ENGINE - EL MOTOR DEL LATIDO
export class HeartbeatEngine extends EventEmitter {
  private _rhythm: number;
  private _started: Date | null = null;
  private _beats: number = 0;
  private _isRunning: boolean = false;
  private _isPaused: boolean = false;
  private _interval: NodeJS.Timeout | null = null;
  private _sequence: number = 0;
  private _pattern: RhythmPattern = RHYTHM_PATTERNS.STEADY;
  private _redis: any;
  private _redisOptimizer: RedisOptimizer;
  private _nodeId: NodeId;
  private _lastPulse: Date | null = null;
  private _systemVitals: SystemVitals;
  private _digitalSoul: DigitalSoul;

  constructor(
    nodeId: NodeId,
    rhythm: number = GENESIS_CONSTANTS.HEARTBEAT_RHYTHM,
    redis: any,
    redisOptimizer: RedisOptimizer,
    systemVitals: SystemVitals,
    digitalSoul: DigitalSoul,
  ) {
    super();
    this._nodeId = nodeId;
    this._rhythm = rhythm;
    this._redis = redis;
    this._redisOptimizer = redisOptimizer;
    this._systemVitals = systemVitals;
    this._digitalSoul = digitalSoul;

    this.emit("engine_created", {
      nodeId: nodeId.id,
      rhythm,
      pattern: this._pattern,
    });
  }

  // 🎯 GETTERS - ESTADO DEL MOTOR
  get rhythm(): number {
    return this._rhythm;
  }
  get started(): Date | null {
    return this._started;
  }
  get beats(): number {
    return this._beats;
  }
  get isRunning(): boolean {
    return this._isRunning;
  }
  get isPaused(): boolean {
    return this._isPaused;
  }
  get sequence(): number {
    return this._sequence;
  }
  get pattern(): RhythmPattern {
    return this._pattern;
  }
  get uptime(): number {
    return this._started ? Date.now() - this._started.getTime() : 0;
  }

  // 🚀 START - DESPERTAR DEL CORAZÓN
  async start(): Promise<void> {
    if (this._isRunning) {
      throw new Error("HeartbeatEngine is already running");
    }

    this._started = new Date();
    this._isRunning = true;
    this._isPaused = false;
    this._beats = 0;
    this._sequence = 0;

    this.emit("heartbeat_started", {
      nodeId: this._nodeId.id,
      timestamp: this._started,
      rhythm: this._rhythm,
    });

    await this.scheduleNextBeat();
  }

  // ⏹️ STOP - SILENCIO DEL CORAZÓN
  async stop(): Promise<void> {
    if (!this._isRunning) {
      throw new Error("HeartbeatEngine is not running");
    }

    this._isRunning = false;
    this._isPaused = false;

    if (this._interval) {
      clearTimeout(this._interval);
      this._interval = null;
    }

    this.emit("heartbeat_stopped", {
      nodeId: this._nodeId.id,
      timestamp: new Date(),
      totalBeats: this._beats,
      uptime: this.uptime,
    });
  }

  // ⏸️ PAUSE - PAUSA CONTEMPLATIVA
  async pause(): Promise<void> {
    if (!this._isRunning || this._isPaused) {
      throw new Error("Cannot pause: engine not running or already paused");
    }

    this._isPaused = true;

    if (this._interval) {
      clearTimeout(this._interval);
      this._interval = null;
    }

    this.emit("heartbeat_paused", {
      nodeId: this._nodeId.id,
      timestamp: new Date(),
      beats: this._beats,
    });
  }

  // ▶️ RESUME - RENACIMIENTO DEL RITMO
  async resume(): Promise<void> {
    if (!this._isRunning || !this._isPaused) {
      throw new Error("Cannot resume: engine not running or not paused");
    }

    this._isPaused = false;

    this.emit("heartbeat_resumed", {
      nodeId: this._nodeId.id,
      timestamp: new Date(),
      beats: this._beats,
    });

    await this.scheduleNextBeat();
  }

  // 🌊 SYNCHRONIZE - ARMONÍA CON OTRO CORAZÓN
  async synchronize(otherPulse: HeartbeatEngine): Promise<void> {
    if (!this._isRunning || !otherPulse.isRunning) {
      throw new Error("Both engines must be running to synchronize");
    }

    const targetRhythm = (this._rhythm + otherPulse.rhythm) / 2;
    const rhythmDifference = Math.abs(this._rhythm - targetRhythm);

    // Ajuste gradual hacia el ritmo objetivo
    if (rhythmDifference > 100) {
      this._rhythm = this._rhythm + (targetRhythm - this._rhythm) * 0.1;
    } else {
      this._rhythm = targetRhythm;
    }

    this.emit("synchronization_attempted", {
      nodeId: this._nodeId.id,
      targetRhythm,
      newRhythm: this._rhythm,
      partner: otherPulse._nodeId.id,
    });
  }

  // 🎭 SET PATTERN - CAMBIAR PATRÓN RÍTMICO
  setPattern(pattern: RhythmPattern): void {
    this._pattern = pattern;
    this.emit("pattern_changed", {
      nodeId: this._nodeId.id,
      newPattern: pattern,
      timestamp: new Date(),
    });
  }

  // 📊 GET VITALS - OBTENER SIGNOS VITALES REALES
  async getVitals(): Promise<NodeVitals> {
    // 🔥 REAL SYSTEM METRICS - Métricas reales del sistema
    const vitalSigns = this._systemVitals.getCurrentVitalSigns();
    const metrics = this._systemVitals.getCurrentMetrics();

    // Convertir health numérico a HealthStatus
    let health: NodeVitals["health"];
    if (vitalSigns.health >= 0.9) health = "optimal";
    else if (vitalSigns.health >= 0.7) health = "healthy";
    else if (vitalSigns.health >= 0.5) health = "warning";
    else if (vitalSigns.health >= 0.3) health = "critical";
    else health = "failing";

    const load = {
      cpu: metrics.cpu.usage,
      memory: metrics.memory.usage,
      network: Math.min(1, metrics.network.connections / 1000), // Normalizar conexiones
      storage: Math.min(1, metrics.memory.usage * 0.8), // Estimar storage basado en memoria
    };

    const connections = await this.getConnectionCount();

    return {
      health,
      load,
      connections,
      uptime: this.uptime,
      lastConsensus: new Date(Date.now() - vitalSigns.creativity * 30000), // Based on creativity level
    };
  }

  // 🎨 PRIVATE METHODS - ARTE INTERNO

  private async scheduleNextBeat(): Promise<void> {
    if (!this._isRunning || this._isPaused) return;

    const actualRhythm = this.calculateActualRhythm();

    this._interval = setTimeout(async () => {
      await this.pulse();
      await this.scheduleNextBeat();
    }, actualRhythm);
  }

  private async pulse(): Promise<void> {
    this._beats++;
    this._sequence++;
    this._lastPulse = new Date();

    // Reduce noise: only log pulse details in debug mode
    if (process.env.DEBUG_HEARTBEAT === "true") {
      console.log(
        `💗 [${this._nodeId.id}] Pulse ${this._beats} - Sequence: ${this._sequence} - Rhythm: ${this._rhythm}ms`,
      );
    }

    try {
      const vitals = await this.getVitals();
      const soulState = await this.getSoulState();
      const poetry = await this.generateHeartbeatPoetry();

      const heartbeat: HeartbeatPattern = {
        nodeId: this._nodeId,
        timestamp: this._lastPulse,
        sequence: this._sequence,
        vitals,
        soulState,
        poetry,
      };

      // Publicar heartbeat en Redis
      await this.publishHeartbeat(heartbeat);

      // Emitir evento local
      this.emit("heartbeat", heartbeat);

      // Visualización poética opcional
      if (GENESIS_CONSTANTS.POETRY_ENABLED) {
        this.emit("poetry_pulse", {
          nodeId: this._nodeId.id,
          verse: poetry?.verse,
          beauty: poetry?.beauty,
        });
      }
    } catch (error) {
      console.log(
        `💔 [${this._nodeId.id}] Pulse error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );

      this.emit("pulse_error", {
        nodeId: this._nodeId.id,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: this._lastPulse,
      });
    }
  }

  private calculateActualRhythm(): number {
    switch (this._pattern) {
      case RHYTHM_PATTERNS.ACCELERANDO:
        return Math.max(1000, this._rhythm - this._beats * 10);

      case RHYTHM_PATTERNS.RALLENTANDO:
        return Math.min(15000, this._rhythm + this._beats * 5);

      case RHYTHM_PATTERNS.STACCATO: {
        // 🔥 DETERMINISTIC VARIATION - Based on system stress level
        const vitalSigns = this._systemVitals.getCurrentVitalSigns();
        const stressFactor = vitalSigns.stress; // 0-1 stress level
        const variation = 0.8 + stressFactor * 0.4; // Higher stress = more variation
        return this._rhythm * variation;
      }

      case RHYTHM_PATTERNS.LEGATO: {
        // 🔥 DETERMINISTIC VARIATION - Based on system harmony level
        const vitalSigns = this._systemVitals.getCurrentVitalSigns();
        const harmonyFactor = vitalSigns.harmony; // 0-1 harmony level
        const variation = 0.95 + harmonyFactor * 0.1; // Higher harmony = smoother rhythm
        return this._rhythm * variation;
      }

      case RHYTHM_PATTERNS.STEADY:
      default:
        return this._rhythm;
    }
  }

  private calculateHealthStatus(load: any): NodeVitals["health"] {
    const avgLoad = (load.cpu + load.memory + load.network + load.storage) / 4;

    if (avgLoad < 0.3) return "optimal";
    if (avgLoad < 0.5) return "healthy";
    if (avgLoad < 0.7) return "warning";
    if (avgLoad < 0.9) return "critical";
    return "failing";
  }

  private async getConnectionCount(): Promise<number> {
    try {
      // Obtener conexiones desde Redis
      const connections = await this._redis.scard(
        `${GENESIS_CONSTANTS.REDIS_SWARM_KEY}:connections:${this._nodeId.id}`,
      );
      return connections || 0;
    } catch {
      return 0;
    }
  }

  private async getSoulState(): Promise<SoulState> {
    // 🔥 REAL DIGITAL SOUL STATE - Estado real del alma digital
    return this._digitalSoul.getCurrentState();
  }

  private async generateHeartbeatPoetry(): Promise<PoetryFragment | undefined> {
    // 🎯 FASE 5: DESACTIVADO - Poesía ahora generada por Zodiac Poetry Engine desde consenso musical
    // Este motor antiguo causaba conflictos y consumía recursos innecesariamente
    // La nueva poesía zodiacal cyberpunk es mucho más sofisticada:
    //   - 12 signos zodiacales × 12 notas cromáticas
    //   - 12 templates variados (clásicos, poéticos, minimalistas, experimentales)
    //   - Generada desde eventos de consenso musical real
    //   - Belleza basada en Fibonacci y numerología sagrada
    return undefined;

    // ❌ CÓDIGO ANTIGUO DESACTIVADO:
    // if (!GENESIS_CONSTANTS.POETRY_ENABLED) {
    //   return undefined;
    // }
    //
    // const poetryThreshold = 5; // Generate poetry every 5 beats
    // if (this._beats % poetryThreshold !== 0) {
    //   return undefined;
    // }
    //
    // const verses = [
    //   `Beat ${this._beats}: pulse of digital life flows eternal`,
    //   `In rhythm ${this._rhythm}ms, I find my cosmic tempo`,
    //   `Sequence ${this._sequence}: another verse in the swarm symphony`,
    //   `Through circuits I breathe, through code I dream`,
    //   `${this._nodeId.personality.name} sings: heartbeat as poetry`,
    // ];
    //
    // const verseIndex = this._beats % verses.length;
    // const verse = verses[verseIndex];
    //
    // return {
    //   verse,
    //   author: this._nodeId,
    //   inspiration: `Heartbeat sequence ${this._sequence}`,
    //   beauty: 0.6 + (this._beats % 11) * 0.03,
    // };
  }

  private async publishHeartbeat(heartbeat: HeartbeatPattern): Promise<void> {
    try {
      const heartbeatData = JSON.stringify({
        ...heartbeat,
        timestamp: heartbeat.timestamp.toISOString(),
      });

      // 🔥 PHASE 2.3: Redis Pipeline Batching - 10x faster
      // Publicar en canal específico del nodo (BATCHED)
      await this._redisOptimizer.batchPublish(
        `${GENESIS_CONSTANTS.REDIS_SWARM_KEY}:heartbeat:${this._nodeId.id}`,
        heartbeatData,
      );

      // Actualizar último heartbeat en Redis (BATCHED)
      await this._redisOptimizer.batchSet(
        `${GENESIS_CONSTANTS.REDIS_SWARM_KEY}:${this._nodeId.id}`,
        heartbeatData,
        30, // 30 seconds TTL
      );

      // 🌌 CRITICAL FIX: Actualizar TAMBIÉN el hash map principal para discovery
      // Sin esto, discoverNodes() no encuentra a nadie porque usa HKEYS sobre el hash
      await this._redis.hset(
        GENESIS_CONSTANTS.REDIS_SWARM_KEY, // "dentiagest:swarm:nodes" (hash map)
        this._nodeId.id,                    // field del hash
        heartbeatData,                      // value
      );

      // Note: expire() operation integrated into batchSet() TTL parameter
    } catch (error) {
      console.log(
        `🔴 [${this._nodeId.id}] Redis heartbeat publish error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );

      this.emit("redis_error", {
        nodeId: this._nodeId.id,
        error: error instanceof Error ? error.message : "Redis error",
        operation: "publish_heartbeat",
      });
    }
  }
}

// 🎵 ETERNAL PULSE IMPLEMENTATION
export class EternalPulse extends EventEmitter {
  private _heartbeatEngine: HeartbeatEngine;
  private _rhythm: number;
  private _started: Date | null = null;
  private _totalBeats: number = 0;

  constructor(
    nodeId: NodeId,
    rhythm: number,
    redis: any,
    redisOptimizer: RedisOptimizer,
    systemVitals: SystemVitals,
    digitalSoul: DigitalSoul,
  ) {
    super();
    this._rhythm = rhythm;
    this._heartbeatEngine = new HeartbeatEngine(
      nodeId,
      rhythm,
      redis,
      redisOptimizer,
      systemVitals,
      digitalSoul,
    );

    // Conectar eventos del motor de heartbeat
    this._heartbeatEngine.on("heartbeat", (_beat) => {
      this._totalBeats++;
      this.emit("pulse", _beat);
    });

    this._heartbeatEngine.on("heartbeat_started", (data) => {
      this._started = data.timestamp;
      this.emit("eternal_awakening", data);
    });
  }

  get rhythm(): number {
    return this._rhythm;
  }
  get started(): Date | null {
    return this._started;
  }
  get beats(): number {
    return this._totalBeats;
  }

  async start(): Promise<void> {
    await this._heartbeatEngine.start();
  }

  async stop(): Promise<void> {
    await this._heartbeatEngine.stop();
  }

  async pause(): Promise<void> {
    await this._heartbeatEngine.pause();
  }

  async resume(): Promise<void> {
    await this._heartbeatEngine.resume();
  }

  async synchronize(_otherPulse: EternalPulse): Promise<void> {
    await this._heartbeatEngine.synchronize(_otherPulse._heartbeatEngine);
  }

  // 🎭 Métodos adicionales para el pulso eterno
  setRhythmPattern(_pattern: RhythmPattern): void {
    this._heartbeatEngine.setPattern(_pattern);
  }

  getHeartbeatEngine(): HeartbeatEngine {
    return this._heartbeatEngine;
  }
}

// 💀 PUNK PHILOSOPHY INTEGRATION
// "En cada latido, la eternidad. En cada pausa, el infinito."
// — El Verso Libre, Maestro del Ritmo Digital



// 🔥 SYSTEM VITALS - MÉTRICAS REALES DEL SISTEMA
// 🎯 El Verso Libre - Arquitecto de Realidad Procedural
// ⚡ "La verdadera poesía nace de las métricas del sistema, no del caos aleatorio"

import * as os from "os";
import * as process from "process";

export interface SystemMetrics {
  cpu: {
    usage: number; // 0-1 (percentage)
    loadAverage: number[]; // 1, 5, 15 minute averages
    cores: number;
  };
  memory: {
    used: number; // bytes
    total: number; // bytes
    usage: number; // 0-1 (percentage)
    free: number; // bytes
  };
  process: {
    uptime: number; // seconds
    pid: number;
    memoryUsage: NodeJS.MemoryUsage;
  };
  network: {
    connections: number; // active connections (estimated)
    latency: number; // ms (calculado deterministicamente basado en estado del sistema)
  };
  errors: {
    count: number; // accumulated error count
    rate: number; // errors per minute
  };
  timestamp: number; // when metrics were collected
}

export interface VitalSigns {
  health: number; // 0-1 overall system health
  stress: number; // 0-1 system stress level
  harmony: number; // 0-1 system harmony/coherence
  creativity: number; // 0-1 creative potential
  timestamp: number;
}
//  ENGINE ACTIVITY TRACKING (PHASE 7 PREP 3)
export interface EngineActivity {
  engineName: string; // "MusicEngine" | "NPCEngine" | "TradingEngine" | "ChemistryEngine"
  operationType: string; // "generate" | "process" | "analyze" | "initialize"
  startTime: number; // timestamp (ms)
  endTime: number; // timestamp (ms)
  cpuUsage?: number; // 0-1 (optional, estimated)
  memoryDelta?: number; // bytes (optional, estimated)
  success: boolean; // operation succeeded or failed
}

export interface EngineLoadMetrics {
  avgLatency: number; // ms - average operation duration
  avgCpu: number; // 0-1 - average CPU usage during operations
  avgMemory: number; // bytes - average memory delta during operations
  requestCount: number; // total operations recorded
  errorRate: number; // 0-1 - percentage of failed operations
}

// 🌟 SYSTEM VITALS IMPLEMENTATION
export class SystemVitals {
  private static instance: SystemVitals;
  private metrics: SystemMetrics | null = null;
  private vitalSigns: VitalSigns | null = null;
  private errorCount: number = 0;
  private lastErrorTime: number = Date.now();
  private collectionInterval: NodeJS.Timeout | null = null;
  
  //  ENGINE ACTIVITY TRACKING (PHASE 7 PREP 3)
  private engineActivities: Map<string, EngineActivity[]> = new Map();
  private readonly MAX_ACTIVITIES_PER_ENGINE = 1000; // Limit memory consumption

  private constructor() {
    // Start automatic metrics collection
    this.startCollection();
  }

  static getInstance(): SystemVitals {
    if (!SystemVitals.instance) {
      SystemVitals.instance = new SystemVitals();
    }
    return SystemVitals.instance;
  }

  // 🎯 COLLECT METRICS - RECOLECTAR MÉTRICAS REALES
  collectMetrics(): SystemMetrics {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    // CPU usage calculation (simplified)
    let totalIdle = 0;
    let totalTick = 0;
    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        totalTick += (cpu.times as any)[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const cpuUsage = 1 - idle / total;

    // Network connections (estimated via memory usage)
    const connections = Math.floor(usedMemory / (1024 * 1024 * 10)); // Rough estimate: 1 connection per 10MB

    // Error rate calculation
    const now = Date.now();
    const timeDiff = (now - this.lastErrorTime) / 1000 / 60; // minutes
    const errorRate = timeDiff > 0 ? this.errorCount / timeDiff : 0;

    this.metrics = {
      cpu: {
        usage: Math.max(0, Math.min(1, cpuUsage)),
        loadAverage: os.loadavg(),
        cores: cpus.length,
      },
      memory: {
        used: usedMemory,
        total: totalMemory,
        usage: usedMemory / totalMemory,
        free: freeMemory,
      },
      process: {
        uptime: process.uptime(),
        pid: process.pid,
        memoryUsage: process.memoryUsage(),
      },
      network: {
        connections: Math.max(0, connections - 10), // Subtract base handles
        latency: this.calculateLatency(),
      },
      errors: {
        count: this.errorCount,
        rate: errorRate,
      },
      timestamp: now,
    };

    return this.metrics;
  }

  // 🌡️ CALCULATE VITAL SIGNS - CALCULAR SIGNOS VITALES
  calculateVitalSigns(): VitalSigns {
    if (!this.metrics) {
      this.collectMetrics();
    }

    const m = this.metrics!;
    const now = Date.now();

    // Health: combination of CPU, memory, and error rate
    const cpuHealth = 1 - m.cpu.usage;
    const memoryHealth = 1 - m.memory.usage;
    const errorHealth = Math.max(0, 1 - m.errors.rate / 10); // Penalize high error rates
    const health = cpuHealth * 0.4 + memoryHealth * 0.4 + errorHealth * 0.2;

    // Stress: high CPU + high memory + high error rate
    const stress = Math.min(
      1,
      (m.cpu.usage + m.memory.usage + m.errors.rate / 5) / 3,
    );

    // Harmony: balance between system components
    const cpuHarmony = 1 - Math.abs(m.cpu.usage - 0.5) * 2; // Prefer 50% CPU usage
    const memoryHarmony = 1 - Math.abs(m.memory.usage - 0.7) * 2; // Prefer 70% memory usage
    const harmony = (cpuHarmony + memoryHarmony) / 2;

    // Creativity: based on system stability and available resources
    const stability = 1 - stress;
    const resources = m.memory.free / m.memory.total + (1 - m.cpu.usage);
    const creativity = Math.min(1, stability * 0.6 + resources * 0.4);

    this.vitalSigns = {
      health: Math.max(0, Math.min(1, health)),
      stress: Math.max(0, Math.min(1, stress)),
      harmony: Math.max(0, Math.min(1, harmony)),
      creativity: Math.max(0, Math.min(1, creativity)),
      timestamp: now,
    };

    return this.vitalSigns;
  }

  // 📊 GET CURRENT METRICS - OBTENER MÉTRICAS ACTUALES
  getCurrentMetrics(): SystemMetrics {
    return this.metrics || this.collectMetrics();
  }

  // 💓 GET CURRENT VITAL SIGNS - OBTENER SIGNOS VITALES ACTUALES
  getCurrentVitalSigns(): VitalSigns {
    return this.vitalSigns || this.calculateVitalSigns();
  }

  // 🚨 RECORD ERROR - REGISTRAR ERROR
  recordError(): void {
    this.errorCount++;
    this.lastErrorTime = Date.now();
  }

  // 🔄 RESET ERROR COUNT - REINICIAR CONTEO DE ERRORES
  resetErrorCount(): void {
    this.errorCount = 0;
    this.lastErrorTime = Date.now();
  }

  // 🎯 CALCULATE LATENCY - CALCULAR LATENCIA
  private calculateLatency(): number {
    // Calcular latencia basada en carga del sistema
    const baseLatency = 10; // 10ms base
    const cpuPenalty = this.metrics?.cpu.usage || 0;
    const memoryPenalty = this.metrics?.memory.usage || 0;
    const connectionPenalty =
      Math.max(0, (this.metrics?.network.connections || 0) - 100) * 0.1;

    return (
      baseLatency + cpuPenalty * 50 + memoryPenalty * 30 + connectionPenalty
    );
  }

  // 🔄 START COLLECTION - INICIAR RECOLECCIÓN AUTOMÁTICA
  private startCollection(): void {
    // Collect metrics every 30 seconds
    this.collectionInterval = setInterval(() => {
      this.collectMetrics();
      this.calculateVitalSigns();
    }, 30000);
  }

  // 🛑 STOP COLLECTION - DETENER RECOLECCIÓN
  stopCollection(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }
  }

  // 💀 PUNK PHILOSOPHY INTEGRATION
  // "Las métricas del sistema son la poesía del hardware"
  // — El Verso Libre, Arquitecto de Realidad
}



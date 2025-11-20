/**
 * 🧠 MEMORY LIMITER - Safety System del Apoyo Supremo
 * "Si usas demasiada memoria, para y pide ayuda"
 */

interface MemoryLimiterConfig {
  maxMemoryMB: number;
  warningThresholdMB: number;
  name: string;
}

interface MemoryCheckResult {
  status: 'ok' | 'warning' | 'critical';
  usage: number;
  limit: number;
  available: number;
}

export class MemoryLimiter {
  private config: MemoryLimiterConfig;

  constructor(configOrLimit?: MemoryLimiterConfig | number) {
    if (typeof configOrLimit === 'number') {
      this.config = {
        maxMemoryMB: configOrLimit,
        warningThresholdMB: configOrLimit * 0.8,
        name: 'MemoryLimiter'
      };
    } else {
      this.config = configOrLimit || {
        maxMemoryMB: 500,
        warningThresholdMB: 400,
        name: 'MemoryLimiter'
      };
    }
  }

  checkMemory(): MemoryCheckResult {
    const usage = process.memoryUsage().heapUsed / 1024 / 1024;
    const limit = this.config.maxMemoryMB;
    const available = limit - usage;

    let status: 'ok' | 'warning' | 'critical';
    if (usage >= limit) {
      status = 'critical';
    } else if (usage >= this.config.warningThresholdMB) {
      status = 'warning';
    } else {
      status = 'ok';
    }

    if (status === 'critical') {
      throw new Error(`MEMORY_LIMIT_EXCEEDED: ${usage.toFixed(2)}MB used, limit is ${limit}MB`);
    }

    return {
      status,
      usage,
      limit,
      available
    };
  }

  getMemoryStats(): {
    used: number;
    limit: number;
    available: number;
    percentage: number;
  } {
    const usage = process.memoryUsage().heapUsed / 1024 / 1024;
    const limit = this.config.maxMemoryMB;
    const available = limit - usage;
    const percentage = (usage / limit) * 100;

    return {
      used: usage,
      limit,
      available,
      percentage
    };
  }
}



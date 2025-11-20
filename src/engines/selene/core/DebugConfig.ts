/**
 * 🔧 SELENE DEBUG CONFIGURATION
 * Centralized debug flags for conditional logging
 */

// Debug level type

type DebugLevel = keyof typeof DEBUG_CONFIG;

// Debug mode configuration
export const DEBUG_CONFIG = {
  // Core system logs
  CORE_STARTUP: process.env.DEBUG_CORE_STARTUP === 'true',
  CORE_HEALTH: process.env.DEBUG_CORE_HEALTH === 'true',
  CORE_MEMORY: process.env.DEBUG_CORE_MEMORY === 'true',

  // Healing system logs
  HEALING_ACTIONS: process.env.DEBUG_HEALING_ACTIONS === 'true',
  HEALING_DIAGNOSTICS: process.env.DEBUG_HEALING_DIAGNOSTICS === 'true',
  HEALING_MEMORY: process.env.DEBUG_HEALING_MEMORY === 'true',

  // Emergency logs (always enabled in development)
  EMERGENCY: process.env.NODE_ENV !== 'production' || process.env.DEBUG_EMERGENCY === 'true',

  // Performance logs
  PERFORMANCE: process.env.DEBUG_PERFORMANCE === 'true',
  TIMEOUTS: process.env.DEBUG_TIMEOUTS === 'true',

  // Development helpers
  VERBOSE: process.env.DEBUG_VERBOSE === 'true',
  TRACE: process.env.DEBUG_TRACE === 'true'
};

/**
 * Debug logger with conditional output
 */
export class DebugLogger {
  static log(level: DebugLevel, message: string, ...args: any[]): void {
    if (DEBUG_CONFIG[level]) {
      console.log(`[${level}] ${message}`, ...args);
    }
  }

  static error(level: DebugLevel, message: string, ...args: any[]): void {
    if (DEBUG_CONFIG[level] || DEBUG_CONFIG.EMERGENCY) {
      console.error(`[${level}] ${message}`, ...args);
    }
  }

  static warn(level: DebugLevel, message: string, ...args: any[]): void {
    if (DEBUG_CONFIG[level] || DEBUG_CONFIG.EMERGENCY) {
      console.warn(`[${level}] ${message}`, ...args);
    }
  }
}

// Global debug helper
(global as any).DEBUG_LOG = DebugLogger.log.bind(DebugLogger);
(global as any).DEBUG_ERROR = DebugLogger.error.bind(DebugLogger);
(global as any).DEBUG_WARN = DebugLogger.warn.bind(DebugLogger);



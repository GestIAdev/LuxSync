/**
 * 👂 BETA WORKER - SENSES (Audio Analysis) — SHELL
 *
 * WAVE 3504-EXT.5: Worker refactorizado a shell puro de transporte.
 *
 * Responsabilidades de este archivo:
 *   1. Inicializar el entorno del Worker (SAB, console blackout, config)
 *   2. Instanciar SensesPipeline (el único coordinador de análisis)
 *   3. Escuchar parentPort.on('message') y despachar al pipeline
 *
 * TODO el análisis de audio vive en:
 *   src/core/senses/pipeline/SensesPipeline.ts  ← pipeline coordinator
 *   src/core/senses/services/BPMService.ts       ← rhythm + shadow logger
 *   src/core/senses/services/ShadowLogger.ts     ← telemetría offline
 *   src/core/senses/tracking/RhythmTracker.ts    ← BPM detection (EXT.3)
 *   src/core/senses/tracking/SectionTracker.ts   ← Wave8 suite (EXT.3)
 *   src/core/senses/spectrum/SpectrumAnalyzer.ts ← FFT wrapper (EXT.3)
 *   src/core/senses/io/AudioRingBuffer.ts        ← ring buffer (EXT.4)
 *   src/core/senses/io/AnalysisResponseBuilder.ts ← payload (EXT.4)
 */

// 🔇 WAVE 3290: SENSES WORKER — Blackout del hilo de audio.
// WAVE 3411 LIFT: Logs de [IntervalBPMTracker] y [GodEarFFT] DESBLOQUEADOS
// para auditoría de rawBassEnergy y rollingAverage post-fix.
// WAVE 3418 LIFT: Logs de Peak SAB vs LegacyBridge DESBLOQUEADOS
// para medir diferencia de voltaje digital entre fuentes.
// Re-comentar esta sección cuando la auditoría de señal esté confirmada.
//
// ACTIVO (bloqueado): console.info, console.debug
// INACTIVO (libre):   console.log, console.warn, console.error
;(function(){const _n=()=>{};console.info=_n;console.debug=_n;})()

import { parentPort, workerData } from 'worker_threads';
import {
  WorkerMessage,
  MessageType,
  MessagePriority,
  WorkerHealth,
  HeartbeatPayload,
  HeartbeatAckPayload,
  createMessage,
  TrinityConfig,
  DEFAULT_CONFIG,
} from './WorkerProtocol';
import { SharedRingBufferReader } from '../core/audio/SharedRingBuffer';
import { OMNI_CONSTANTS } from '../core/audio/OmniInputTypes';
import { SensesPipeline } from '../core/senses/pipeline/SensesPipeline';

// ============================================
// CONFIGURATION
// ============================================

const config: TrinityConfig = workerData?.config ?? DEFAULT_CONFIG;
const NODE_ID = 'beta' as const;

// ============================================
// WAVE 3401: SHARED RING BUFFER — SAB Consumer Setup
// ============================================

const sharedAudioBuffer: SharedArrayBuffer | null = workerData?.sharedAudioBuffer ?? null;
const sabReader: SharedRingBufferReader | null = sharedAudioBuffer
  ? new SharedRingBufferReader(sharedAudioBuffer)
  : null;

const sabReadBuffer = new Float32Array(OMNI_CONSTANTS.FFT_SIZE);
let sabPollInterval: ReturnType<typeof setInterval> | null = null;

// ============================================
// WAVE 3432: ZOMBIE FLUSH — IPC guard after reset/hot-swap
// ============================================

const W3432_ZOMBIE_FLUSH_MS = 250;
let dropLegacyIpcUntilTimestamp = 0;

// ============================================
// WAVE 3418: RAW PEAK TELEMETRY — Counters por path de entrada
// ============================================

let _sabPeakFrameCount = 0;
let _legacyPeakFrameCount = 0;
const PEAK_LOG_INTERVAL = 94; // ~2s a 47fps

function _calcPeakAbs(buf: Float32Array, len: number): number {
  let peak = 0;
  for (let i = 0; i < len; i++) {
    const abs = Math.abs(buf[i]);
    if (abs > peak) peak = abs;
  }
  return peak;
}

// ============================================
// PIPELINE — Único coordinador de análisis (WAVE 3504-EXT.5)
// ============================================

const pipeline = new SensesPipeline(config);

// ============================================
// STATE — Solo ciclo de vida del Worker
// ============================================

interface BetaState {
  isRunning: boolean;
  frameCount: number;
  startTime: number;
  lastHeartbeat: number;
  messagesProcessed: number;
  totalProcessingTime: number;
  errors: string[];
}

const state: BetaState = {
  isRunning: false,
  frameCount: 0,
  startTime: Date.now(),
  lastHeartbeat: Date.now(),
  messagesProcessed: 0,
  totalProcessingTime: 0,
  errors: [],
};

// ============================================
// SAB POLLING — WAVE 3401
// ============================================

function pollSharedRingBuffer(): void {
  if (!sabReader || !state.isRunning) return;

  const available = sabReader.available;
  if (available === 0) return;

  const toRead = Math.min(available, OMNI_CONSTANTS.FFT_SIZE);
  const samplesRead = sabReader.read(sabReadBuffer, toRead);

  if (samplesRead > 0) {
    const slice = sabReadBuffer.subarray(0, samplesRead);

    // WAVE 3418: Peak crudo del buffer SAB antes del ring/FFT
    _sabPeakFrameCount++;
    if (_sabPeakFrameCount % PEAK_LOG_INTERVAL === 0) {
      const peakAbs = _calcPeakAbs(slice, samplesRead);
      const rms = Math.sqrt(slice.reduce((acc, s) => acc + s * s, 0) / samplesRead);
      console.log(
        `[🔬 PEAK-SAB] frame=${_sabPeakFrameCount} ` +
        `samples=${samplesRead} ` +
        `peak=${peakAbs.toFixed(5)} ` +
        `rms=${rms.toFixed(5)}`
      );
    }

    state.frameCount++;
    const analysis = pipeline.processFrame(slice);
    sendMessage(
      MessageType.AUDIO_ANALYSIS,
      'alpha',
      analysis,
      analysis.onBeat ? MessagePriority.HIGH : MessagePriority.NORMAL,
    );
  }
}

// ============================================
// HEALTH REPORTING
// ============================================

function generateHealthReport(): WorkerHealth {
  const uptime = Date.now() - state.startTime;
  const memUsage = process.memoryUsage();
  let status: WorkerHealth['status'] = 'healthy';
  if (memUsage.heapUsed / memUsage.heapTotal > 0.9) status = 'critical';
  else if (memUsage.heapUsed / memUsage.heapTotal > 0.7) status = 'degraded';

  return {
    nodeId: NODE_ID,
    timestamp: Date.now(),
    cpuUsage: 0,
    memoryUsage: memUsage.heapUsed / memUsage.heapTotal,
    heapUsed: memUsage.heapUsed,
    heapTotal: memUsage.heapTotal,
    messagesProcessed: state.messagesProcessed,
    messagesPerSecond: state.messagesProcessed / (uptime / 1000),
    avgProcessingTime:
      state.messagesProcessed > 0 ? state.totalProcessingTime / state.messagesProcessed : 0,
    status,
    lastError: state.errors[state.errors.length - 1],
    uptime,
    framesProcessed: state.frameCount,
  };
}

// ============================================
// MESSAGE HANDLER
// ============================================

function handleMessage(message: WorkerMessage): void {
  try {
    switch (message.type) {
      case MessageType.INIT:
        state.isRunning = true;
        state.startTime = Date.now();
        if (sabReader && !sabPollInterval) {
          sabPollInterval = setInterval(pollSharedRingBuffer, 21);
          console.log('[BETA] WAVE 3401: SharedRingBuffer consumer active (SAB poll @ 47Hz)');
        }
        sendMessage(MessageType.READY, 'alpha', { nodeId: NODE_ID });
        break;

      case MessageType.SHUTDOWN:
        console.log('[BETA] Shutting down...');
        state.isRunning = false;
        if (sabPollInterval) {
          clearInterval(sabPollInterval);
          sabPollInterval = null;
        }
        sendMessage(MessageType.HEALTH_REPORT, 'alpha', generateHealthReport());
        process.exit(0);
        break;

      case MessageType.HEARTBEAT: {
        const hbPayload = message.payload as HeartbeatPayload;
        const ackPayload: HeartbeatAckPayload = {
          originalTimestamp: hbPayload.timestamp,
          ackTimestamp: Date.now(),
          sequence: hbPayload.sequence,
          latency: Date.now() - hbPayload.timestamp,
        };
        sendMessage(MessageType.HEARTBEAT_ACK, 'alpha', ackPayload, MessagePriority.HIGH);
        state.lastHeartbeat = Date.now();
        break;
      }

      case MessageType.HEALTH_REQUEST:
        sendMessage(MessageType.HEALTH_REPORT, 'alpha', generateHealthReport());
        break;

      case MessageType.AUDIO_BUFFER: {
        // WAVE 3434: IPC GAG — si SAB polling está activo, ignorar IPC
        if (sabPollInterval !== null) {
          const zombieText = `[ZOMBIE RADAR] Paquete IPC recibido. SAB Poll Activo?: true`;
          sendMessage(
            MessageType.FORENSIC_LOG,
            'alpha',
            { tag: 'ZOMBIE_RADAR', text: zombieText },
            MessagePriority.HIGH,
          );
          console.error(zombieText);
          return;
        }

        if (!state.isRunning) break;
        if (message.timestamp <= dropLegacyIpcUntilTimestamp) break;

        const buffer = message.payload as Float32Array;

        if (state.frameCount % 300 === 0) {
          console.log(`[BETA 📡] AUDIO_BUFFER #${state.frameCount} | size=${buffer?.length || 0}`);
        }

        // WAVE 3418: Peak crudo del buffer IPC antes del ring/FFT
        _legacyPeakFrameCount++;
        if (_legacyPeakFrameCount % PEAK_LOG_INTERVAL === 0) {
          const legacyPeak = _calcPeakAbs(buffer, buffer.length);
          const legacyRms =
            buffer.length > 0
              ? Math.sqrt(buffer.reduce((acc, s) => acc + s * s, 0) / buffer.length)
              : 0;
          console.log(
            `[🔬 PEAK-IPC] frame=${_legacyPeakFrameCount} ` +
              `samples=${buffer.length} ` +
              `peak=${legacyPeak.toFixed(5)} ` +
              `rms=${legacyRms.toFixed(5)}`,
          );
        }

        state.frameCount++;
        const analysis = pipeline.processFrame(buffer);
        sendMessage(
          MessageType.AUDIO_ANALYSIS,
          'alpha',
          analysis,
          analysis.onBeat ? MessagePriority.HIGH : MessagePriority.NORMAL,
        );
        break;
      }

      case MessageType.STATE_RESTORE: {
        const snap = message.payload as { state: unknown };
        const s = snap?.state as Record<string, unknown> | null;
        if (s && typeof s.frameCount === 'number') state.frameCount = s.frameCount;
        console.log(`[BETA] State restored: frame ${state.frameCount}`);
        break;
      }

      case MessageType.CONFIG_UPDATE: {
        const newConfig = message.payload as Partial<TrinityConfig>;
        Object.assign(config, newConfig);
        if (newConfig.inputGain !== undefined) {
          console.log(`[BETA] 🎚️ Gain updated to: ${(newConfig.inputGain * 100).toFixed(0)}%`);
        } else {
          console.log('[BETA] Config updated');
        }
        break;
      }

      case MessageType.SET_VIBE: {
        const vibePayload = message.payload as { vibeId: string };
        pipeline.setVibe(vibePayload.vibeId);
        console.log(`[BETA] 🎯 WAVE 289.5: Vibe set to "${vibePayload.vibeId}"`);
        break;
      }

      case MessageType.SET_BPM:
        // No-op — Worker es la Single Source of Truth del BPM
        break;

      case MessageType.RESET_PACEMAKER:
        // WAVE 2161 / 3430 / 3414: Amnesia Protocol
        pipeline.reset();
        dropLegacyIpcUntilTimestamp = Date.now() + W3432_ZOMBIE_FLUSH_MS;
        console.log('[BETA] 🧨 WAVE 3430: Amnesia Protocol — pipeline reseteado');
        break;

      default:
        console.warn(`[BETA] Unknown message type: ${message.type}`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    state.errors.push(errorMsg);
    console.error(`[BETA] Error handling ${message.type}:`, errorMsg);
    sendMessage(
      MessageType.WORKER_ERROR,
      'alpha',
      { nodeId: NODE_ID, error: errorMsg, messageType: message.type },
      MessagePriority.CRITICAL,
    );
  }
}

// ============================================
// SEND MESSAGE
// ============================================

function sendMessage<T>(
  type: MessageType,
  target: 'alpha' | 'gamma' | 'broadcast',
  payload: T,
  priority: MessagePriority = MessagePriority.NORMAL,
): void {
  const message = createMessage(type, NODE_ID, target, payload, priority);
  parentPort?.postMessage(message);
}

// ============================================
// MAIN LISTENER
// ============================================

if (parentPort) {
  parentPort.on('message', handleMessage);

  (process as NodeJS.EventEmitter).on('uncaughtException', (error: Error) => {
    console.error('[BETA] Uncaught exception:', error);
    sendMessage(
      MessageType.WORKER_ERROR,
      'alpha',
      { nodeId: NODE_ID, error: error.message, fatal: true },
      MessagePriority.CRITICAL,
    );
  });

  (process as NodeJS.EventEmitter).on('unhandledRejection', (reason: unknown) => {
    console.error('[BETA] Unhandled rejection:', reason);
    sendMessage(
      MessageType.WORKER_ERROR,
      'alpha',
      { nodeId: NODE_ID, error: String(reason), fatal: false },
      MessagePriority.CRITICAL,
    );
  });
} else {
  console.error('[BETA] No parentPort - not running as worker thread!');
  process.exit(1);
}

// ============================================
// PERIODIC HEALTH REPORT
// ============================================

setInterval(() => {
  if (state.isRunning) {
    sendMessage(MessageType.HEALTH_REPORT, 'alpha', generateHealthReport());
  }
}, 5000);


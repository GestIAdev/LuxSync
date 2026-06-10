/**
 * WAVE 6019 — DMX SAB WORKER (worker_thread)
 *
 * Reemplaza el child_process openDmxWorker (WAVE 2021.5) con una arquitectura
 * basada en worker_threads + SharedArrayBuffer (SAB).
 *
 * DIFERENCIAS CLAVE vs versión child_process:
 *   - Recibe el SAB directamente via workerData (zero-copy con el Main Process).
 *   - Lee DMX vía DmxUniverseReader en lugar de esperar UPDATE_BUFFER por IPC.
 *   - Usa parentPort en lugar de process.send/process.on('message').
 *   - El universo a extraer del SAB se configura en workerData.universe.
 *   - El BREAK/MAB/baudrate-switch permanece IDÉNTICO (probado y certificado).
 *
 * ⚠️ CONTINGENCIA N-API (WAVE 6019):
 *   serialport usa un addon nativo (bindings.node). En worker_threads de Electron,
 *   si el módulo no está compilado como "context-aware" (N-API), puede producir:
 *     "Error: Module is not context-aware"
 *   Si el boot() falla con ese mensaje, el worker notifica ERROR y sale.
 *   SOLUCIÓN: electron-rebuild con serialport v12+ (N-API context-agnostic):
 *     ./node_modules/.bin/electron-rebuild -f -w serialport
 *   FALLBACK: Si electron-rebuild no resuelve el crash, revertir al proxy IPC
 *   descrito en Blueprint WAVE-6019 §1.7 (SabProxy + child_process fork).
 *
 * PROTOCOLO DE MENSAJES (worker_thread ↔ Main):
 *   Main → Worker (parentPort.postMessage):
 *     { type: 'DISCONNECT' }
 *     { type: 'RESET_BUFFER' }    — purga lastSabFrameId, fuerza re-lectura SAB
 *
 *   Worker → Main (parentPort.postMessage):
 *     { type: 'READY' }
 *     { type: 'CONNECTED' }
 *     { type: 'DISCONNECTED' }
 *     { type: 'ERROR',   message: string }
 *     { type: 'LOG',     message: string }
 *     { type: 'WARN',    message: string }
 *
 * TIMING DMX512:
 *   BREAK  ≥88µs  → 110µs via baudrate-switch a 76923 baud
 *   MAB    ≥8µs   → 20µs via spinWaitNs
 *   Frame  total  → 33ms (~30Hz)
 */
import { workerData, parentPort, isMainThread } from 'worker_threads';
import * as os from 'os';
import { DmxUniverseReader } from '../../core/aether/glass/DmxSabHandlers';
import { CHANNELS_PER_UNI, DMX_HEADER_I32 } from '../../core/aether/glass/layout';
// ─────────────────────────────────────────────────────────────────────────────
// Guard: este módulo SOLO puede correr como worker_thread
// ─────────────────────────────────────────────────────────────────────────────
if (isMainThread) {
    throw new Error('[openDmxWorker v2] Este archivo debe ejecutarse como worker_thread, no en el Main Process.');
}
// ─────────────────────────────────────────────────────────────────────────────
// Config inyectada por workerData
// ─────────────────────────────────────────────────────────────────────────────
const { sab, // SharedArrayBuffer completo (header + datos, 25 664 bytes)
portPath, // string — ej. 'COM3' o '/dev/ttyUSB0'
universe, // number — universo DMX a extraer del SAB (0-49)
hz, // number — cadencia de salida (recomendado: 30-33)
 } = workerData;
// ─────────────────────────────────────────────────────────────────────────────
// SAB: reader coherente + vista del header para Atomics
// ─────────────────────────────────────────────────────────────────────────────
const sabReader = new DmxUniverseReader(sab);
const sabHdr = new Int32Array(sab, 0, DMX_HEADER_I32);
// Offset en bytes dentro del blob de datos del SAB para nuestro universo objetivo
const UNI_BYTE_OFFSET = universe * CHANNELS_PER_UNI; // = universe * 512
// ─────────────────────────────────────────────────────────────────────────────
// Prioridad de proceso — NOTA worker_thread edition
// ─────────────────────────────────────────────────────────────────────────────
// os.setPriority() en un worker_thread afecta al PROCESO completo (Electron).
// Usamos PRIORITY_ABOVE_NORMAL (no PRIORITY_HIGHEST) para no degradar la UI.
// PRIORITY_ABOVE_NORMAL garantiza que el scheduler de Windows nos ejecute antes
// que procesos de fondo sin comprometer el renderizado de Chromium.
try {
    os.setPriority(0, os.constants.priority.PRIORITY_ABOVE_NORMAL);
}
catch {
    // Ignorar si el OS no permite subir prioridad (entornos sandbox, etc.)
}
// ─────────────────────────────────────────────────────────────────────────────
// Estado interno del worker
// ─────────────────────────────────────────────────────────────────────────────
let port = null;
let isOpen = false;
let outputLoop = null;
// SAB frame tracking — para el loop de salida
let lastSabFrameId = -1;
// Double buffer: port.write() retiene la referencia en el kernel hasta que el
// callback se dispara. dmxSendBuffer es el snapshot inmutable en vuelo.
// dmxSendBuffer[0] = 0x00 (DMX start code), [1..512] = canales del universo.
const dmxSendBuffer = Buffer.alloc(513, 0);
dmxSendBuffer[0] = 0x00;
// ─────────────────────────────────────────────────────────────────────────────
// Timing — idéntico al openDmxWorker v1 (child_process)
// ─────────────────────────────────────────────────────────────────────────────
// minFrameNs se calcula desde el hz recibido en workerData.
// WAVE 4942 FORCE: siempre baudrate-switch — compatibilidad con chips genéricos.
const safeHz = (hz > 0 && hz <= 44) ? hz : 30;
let minFrameNs = BigInt(Math.floor((1000 / safeHz) * 1000000));
let lastFrameStart = BigInt(0);
// BREAK: 110µs mínimo seguro (estándar ≥88µs). A 76923 baud, 0x00 = ~130µs LOW.
const BREAK_NS = BigInt(110000);
// MAB: 20µs explícito post baud-switch.
const MAB_NS = BigInt(20000);
// Byte 0x00 para el BREAK via baudrate-switch
const BREAK_BYTE = Buffer.from([0x00]);
// Max spin para pacing: 5ms. Si falta más, ceder al event loop del worker.
const MAX_PACING_SPIN_NS = BigInt(5000000);
// ─────────────────────────────────────────────────────────────────────────────
// 🫠 WAVE 5037: PHANTOM HEARTBEAT — monitor de inanición del frame loop
// ─────────────────────────────────────────────────────────────────────────────
let _phantomLastFrame = process.hrtime.bigint();
let _phantomPeakMs = 0;
let _phantomPeakReportTime = process.hrtime.bigint();
const _PHANTOM_REPORT_NS = BigInt(5000000000); // reporte cada 5s
const _PHANTOM_STARVATION_MS = 40;
let _overlapPeakMs = 0;
let _overlapCount = 0;
// ─────────────────────────────────────────────────────────────────────────────
// Log helper — usa parentPort en lugar de process.send
// ─────────────────────────────────────────────────────────────────────────────
function log(message) {
    parentPort?.postMessage({ type: 'LOG', message: `[DMX-Worker v2] ${message}` });
}
// ─────────────────────────────────────────────────────────────────────────────
// Spin-wait HARDCORE de alta resolución — idéntico al original (WAVE 3180)
// Bloquea el event loop del worker durante `ns` nanosegundos.
// En un worker_thread dedicado a DMX, bloquear 100µs es imperceptible.
// ─────────────────────────────────────────────────────────────────────────────
function spinWaitNs(ns) {
    const end = process.hrtime.bigint() + ns;
    // eslint-disable-next-line no-empty
    while (process.hrtime.bigint() < end) { }
}
// ─────────────────────────────────────────────────────────────────────────────
// Output loop — corazón del bit-banging
// ─────────────────────────────────────────────────────────────────────────────
function startOutputLoop() {
    if (outputLoop)
        return;
    log(`Output loop started — hrtime pacing, setImmediate scheduling @${safeHz}Hz`);
    log(`BREAK mode: baudrate-switch (WAVE 4942 forced) | BREAK=${Number(BREAK_NS) / 1000}µs | MAB=${Number(MAB_NS) / 1000}µs`);
    log(`Universo SAB objetivo: ${universe} (offset byte ${UNI_BYTE_OFFSET})`);
    lastFrameStart = process.hrtime.bigint();
    scheduleNextFrame();
}
function scheduleNextFrame() {
    if (!isOpen || !port)
        return;
    outputLoop = setImmediate(() => {
        if (!isOpen || !port)
            return;
        // 🫠 WAVE 5037: PHANTOM HEARTBEAT
        const _pNow = process.hrtime.bigint();
        const _pDeltaMs = Number((_pNow - _phantomLastFrame) / BigInt(1000000));
        _phantomLastFrame = _pNow;
        if (_pDeltaMs > _phantomPeakMs)
            _phantomPeakMs = _pDeltaMs;
        if (_pDeltaMs > _PHANTOM_STARVATION_MS) {
            log(`[CARDIOGRAMA] 🚨 STARVATION! frame delta: ${_pDeltaMs.toFixed(1)}ms (umbral: ${_PHANTOM_STARVATION_MS}ms)`);
        }
        // 🛡️ WAVE 5037: OVERLAP DETECT
        const _cycleMs = Number((_pNow - lastFrameStart) / BigInt(1000000));
        const _periodMs = Number(minFrameNs) / 1000000;
        if (_cycleMs > _periodMs) {
            _overlapCount++;
            if (_cycleMs > _overlapPeakMs)
                _overlapPeakMs = _cycleMs;
        }
        // Reporte de pico cada 5s
        if (_pNow - _phantomPeakReportTime >= _PHANTOM_REPORT_NS) {
            log(`[CARDIOGRAMA] heartbeat — peak:${_phantomPeakMs.toFixed(1)}ms (last 5s)`);
            if (_overlapCount > 0) {
                log(`[CARDIOGRAMA] 🚨 OVERLAP: ${_overlapCount} frames superaron periodo (${_periodMs.toFixed(1)}ms), peak:${_overlapPeakMs.toFixed(1)}ms`);
                _overlapCount = 0;
                _overlapPeakMs = 0;
            }
            _phantomPeakMs = 0;
            _phantomPeakReportTime = _pNow;
        }
        const now = process.hrtime.bigint();
        const remaining = (lastFrameStart + minFrameNs) - now;
        if (remaining > MAX_PACING_SPIN_NS) {
            // Falta mucho — ceder al event loop y reintentar
            scheduleNextFrame();
            return;
        }
        if (remaining > BigInt(0)) {
            // Falta poco (≤5ms) — spin-wait preciso hasta el momento exacto
            spinWaitNs(remaining);
        }
        lastFrameStart = process.hrtime.bigint();
        sendFrame();
    });
}
function stopOutputLoop() {
    if (outputLoop) {
        clearImmediate(outputLoop);
        outputLoop = null;
        log('Output loop stopped');
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// sendFrame: lee el SAB y envía el frame DMX con BREAK/MAB preciso
// ─────────────────────────────────────────────────────────────────────────────
function sendFrame() {
    if (!port || !isOpen) {
        scheduleNextFrame();
        return;
    }
    // ── Leer SAB (coherente via seqlock) ────────────────────────────────────
    // readCoherent() retorna null si no hay frame nuevo desde lastSabFrameId.
    // En ese caso, reutilizamos dmxSendBuffer tal cual (keepalive — el hardware
    // NUNCA queda en negro por ausencia de escrituras del TickEngine).
    //
    // ℹ️ Atomics.waitAsync (nota para el Arquitecto):
    //   Si se quisiera despertar REACTIVAMENTE cuando el TickEngine hace commitFrame(),
    //   se podría usar aquí Atomics.waitAsync(sabHdr, DmxHdr.SEQLOCK, currentSeq, 30).
    //   Sin embargo, como el loop ya corre a frecuencia fija (33Hz) y el SAB llega a
    //   44Hz (más rápido), el polling es suficiente. Atomics.waitAsync ahorraría CPU
    //   si la cadencia de salida fuera reactiva en lugar de fija.
    const frame = sabReader.readCoherent(lastSabFrameId);
    if (frame) {
        lastSabFrameId = frame.frameId;
        // Snapshot del universo objetivo en dmxSendBuffer (zero-tearing, O(512))
        // frame.data es el blob completo de 25 600 bytes (50 universos × 512).
        // Universo N vive en [N*512 ... (N+1)*512).
        dmxSendBuffer[0] = 0x00; // DMX start code
        const uniSlice = frame.data.subarray(UNI_BYTE_OFFSET, UNI_BYTE_OFFSET + CHANNELS_PER_UNI);
        Buffer.from(uniSlice).copy(dmxSendBuffer, 1);
    }
    // else: No hay frame nuevo → dmxSendBuffer mantiene el último dato válido
    // Despachar al hardware con BREAK/MAB via baudrate-switch
    sendFrameBaudrateBreak();
}
// ─────────────────────────────────────────────────────────────────────────────
// Baudrate-Switch BREAK — compatible con chips genéricos (WAVE 4942 certified)
//
// Técnica estándar usada por Freestyler, QLC+, DMXControl:
//   1. Bajar baud a 76923 → 0x00 dura ~130µs = BREAK válido (≥88µs)
//   2. Emitir 0x00 + drain
//   3. Subir baud a 250000 (velocidad DMX estándar)
//   4. spinWaitNs(MAB_NS) = 20µs
//   5. Emitir dmxSendBuffer (513 bytes)
// ─────────────────────────────────────────────────────────────────────────────
function sendFrameBaudrateBreak() {
    const portAny = port;
    if (typeof portAny.update !== 'function') {
        // Chip sin soporte de baudrate update — envío directo sin BREAK (último recurso)
        port.write(dmxSendBuffer, (err) => {
            if (err)
                log(`Write error (no-break fallback): ${err.message}`);
            scheduleNextFrame();
        });
        return;
    }
    // PASO 1: Bajar baud para generar BREAK
    portAny.update({ baudRate: 76923 }, (err1) => {
        if (err1 || !port || !isOpen) {
            scheduleNextFrame();
            return;
        }
        // PASO 2: Emitir 0x00 → señal LOW ~130µs en la línea = BREAK DMX512
        port.write(BREAK_BYTE, (err2) => {
            if (err2 || !port || !isOpen) {
                scheduleNextFrame();
                return;
            }
            // Drain: esperar que el UART vacíe el byte antes de cambiar baud
            port.drain((err3) => {
                if (err3 || !port || !isOpen) {
                    scheduleNextFrame();
                    return;
                }
                // PASO 3: Volver a 250000 baud
                portAny.update({ baudRate: 250000 }, (err4) => {
                    if (err4 || !port || !isOpen) {
                        scheduleNextFrame();
                        return;
                    }
                    // PASO 4: MAB — 20µs mínimo via spin-wait preciso
                    spinWaitNs(MAB_NS);
                    // PASO 5: Emitir los 513 bytes del universo DMX
                    port.write(dmxSendBuffer, (err5) => {
                        if (err5)
                            log(`Write error: ${err5.message}`);
                        scheduleNextFrame();
                    });
                });
            });
        });
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// Desconexión limpia
// ─────────────────────────────────────────────────────────────────────────────
function handleDisconnect() {
    stopOutputLoop();
    const cleanup = () => {
        port = null;
        isOpen = false;
        log('Disconnected');
        parentPort?.postMessage({ type: 'DISCONNECTED' });
    };
    if (port && isOpen) {
        try {
            port.close(() => cleanup());
        }
        catch {
            cleanup();
        }
    }
    else {
        cleanup();
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Boot — abre serialport y arranca el loop
// ─────────────────────────────────────────────────────────────────────────────
async function boot() {
    log(`Booting worker_thread — port:${portPath} | universe:${universe} | ${safeHz}Hz | SAB:${sab.byteLength}b`);
    // ⚠️ N-API CONTINGENCY: import dinámico de serialport.
    // Si Electron no tiene serialport compilado como N-API (context-aware), este
    // import lanzará "Error: Module is not context-aware". El catch reporta el
    // error al Main Process y el worker termina limpiamente. El Arquitecto debe
    // ejecutar: ./node_modules/.bin/electron-rebuild -f -w serialport
    let SerialPort;
    try {
        const serialportModule = await import('serialport');
        SerialPort = serialportModule.SerialPort ?? serialportModule.default?.SerialPort;
        if (!SerialPort) {
            throw new Error('serialport cargado pero clase SerialPort no encontrada en el módulo');
        }
    }
    catch (importErr) {
        const msg = importErr instanceof Error ? importErr.message : String(importErr);
        log(`ERROR: import('serialport') falló — ${msg}`);
        log('CONTINGENCIA N-API: Si el error es "Module is not context-aware", ejecutar electron-rebuild -f -w serialport');
        parentPort?.postMessage({ type: 'ERROR', message: `serialport import failed: ${msg}` });
        return;
    }
    // Instanciar SerialPort — el handle nativo nace y muere en este thread
    port = new SerialPort({
        path: portPath,
        baudRate: 250000,
        dataBits: 8,
        stopBits: 2,
        parity: 'none',
        autoOpen: false,
    });
    const openTimeout = setTimeout(() => {
        log(`ERROR: Connect timeout (8s) — ${portPath}`);
        parentPort?.postMessage({ type: 'ERROR', message: `Connection timeout: ${portPath}` });
        port = null;
    }, 8000);
    port.open((err) => {
        clearTimeout(openTimeout);
        if (err) {
            log(`ERROR: Open failed — ${err.message}`);
            parentPort?.postMessage({ type: 'ERROR', message: err.message });
            port = null;
            return;
        }
        isOpen = true;
        log(`Puerto abierto: ${portPath} @ 250000 baud`);
        // Sink de ecos RS-485 — evita que el buffer de lectura se llene y emita
        // 'data' events que interrumpan el event loop del worker (WAVE 3080)
        port.on('data', () => { });
        port.on('error', (portErr) => {
            log(`ERROR de puerto: ${portErr.message}`);
            stopOutputLoop();
            isOpen = false;
            parentPort?.postMessage({ type: 'ERROR', message: portErr.message });
        });
        port.on('close', () => {
            log('Puerto cerrado externamente');
            stopOutputLoop();
            isOpen = false;
            parentPort?.postMessage({ type: 'DISCONNECTED' });
        });
        parentPort?.postMessage({ type: 'CONNECTED' });
        // TWO-PHASE STARTUP: 100ms de asentamiento del hardware antes de comenzar
        setTimeout(() => {
            if (!isOpen || !port)
                return;
            startOutputLoop();
            log('Output loop activo — READY');
            parentPort?.postMessage({ type: 'READY' });
        }, 100);
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// Mensajes del Main Thread
// ─────────────────────────────────────────────────────────────────────────────
parentPort?.on('message', (msg) => {
    switch (msg.type) {
        case 'DISCONNECT':
            handleDisconnect();
            break;
        case 'RESET_BUFFER':
            // Forzar re-lectura del SAB en el próximo frame (purga el frame ID cacheado)
            lastSabFrameId = -1;
            log('SAB frame ID reseteado — re-lectura forzada en el próximo frame');
            break;
        default:
            break;
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// Arranque
// ─────────────────────────────────────────────────────────────────────────────
boot().catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    log(`FATAL: boot() lanzó excepción — ${msg}`);
    parentPort?.postMessage({ type: 'ERROR', message: msg });
    process.exit(1);
});

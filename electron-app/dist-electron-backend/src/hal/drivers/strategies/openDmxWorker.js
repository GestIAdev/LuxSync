/**
 * 👻 WAVE 2021.5: DMX PHANTOM PROCESS — Open DMX Bit-Banging (child_process)
 *
 * AISLAMIENTO TOTAL V2: Este script corre como child_process.fork(),
 * NO como worker_threads. Cada child_process tiene su PROPIO V8 isolate
 * en un PROCESO SEPARADO — cero contención de HandleScope, cero crash.
 *
 * ¿POR QUÉ child_process EN VEZ DE worker_threads?
 *
 *   Electron 28 + worker_threads + native addons (serialport) = CRASH.
 *   El addon nativo bindings.node se carga en ambos V8 isolates (main + worker)
 *   y comparte estado C++ global a nivel de proceso. Cuando V8 GC del main
 *   recorre weak references del addon mientras el worker ejecuta callbacks
 *   nativos del mismo addon → Fatal error: HandleScope::HandleScope.
 *
 *   child_process.fork() crea un PROCESO Node.js independiente con su propio
 *   V8 heap, su propio GC, su propias weak references. El addon nativo se
 *   carga en un address space completamente separado. CERO contención.
 *
 * COMUNICACIÓN: process.send() / process.on('message')
 *   El IPC de child_process usa un pipe del OS (no V8 structured clone).
 *   Los buffers DMX se envían como arrays planos de bytes.
 *   A 30Hz × 513 bytes ≈ 15KB/s por un kernel pipe — trivial.
 *
 * PROTOCOLO DE MENSAJES:
 *   Main → Child:
 *     { type: 'CONNECT',       portPath: string }
 *     { type: 'UPDATE_BUFFER', channels: number[] }  ← array plano, no ArrayBuffer
 *     { type: 'DISCONNECT' }
 *
 *   Child → Main:
 *     { type: 'CONNECTED', success: boolean, error?: string }
 *     { type: 'READY' }
 *     { type: 'DISCONNECTED' }
 *     { type: 'ERROR',      error: string }
 *     { type: 'LOG',        message: string }
 *
 * TIMING DMX512:
 *   BREAK ≥88µs  → usamos 2ms
 *   MAB   ≥8µs   → usamos 1ms
 *   Frame total  → 33ms (~30Hz)
 */
// ─────────────────────────────────────────────────────────────────────────────
// PRIORIDAD REAL-TIME: Elevar este proceso por encima de la UI de Windows.
// Windows da prioridad a eventos visuales (cursor, teclado) sobre procesos normales.
// PRIORITY_HIGHEST (o PRIORITY_ABOVE_NORMAL como fallback) hace que el scheduler
// del OS ejecute nuestro loop DMX ANTES que el renderizado del cursor.
// ─────────────────────────────────────────────────────────────────────────────
import * as os from 'os';
try {
    // PRIORITY_HIGHEST = -20 en POSIX, REALTIME_PRIORITY_CLASS en Windows.
    // Requiere privilegios elevados en algunos OS. Si falla, intentamos ABOVE_NORMAL.
    os.setPriority(0, os.constants.priority.PRIORITY_HIGHEST);
}
catch {
    try {
        os.setPriority(0, os.constants.priority.PRIORITY_ABOVE_NORMAL);
    }
    catch {
        // Si ni siquiera ABOVE_NORMAL funciona, seguimos con prioridad normal.
        // El proceso sigue siendo funcional, solo sin ventaja de scheduling.
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Estado interno — TODO local a este PROCESO, ningún handle cruzado
// ─────────────────────────────────────────────────────────────────────────────
let port = null;
let isOpen = false;
// Buffer DMX local — 513 bytes (start code + 512 canales).
// El main envía UPDATE_BUFFER con los canales frescos via IPC.
// El output loop lee este buffer en cada sendFrame().
const dmxBuffer = Buffer.alloc(513, 0);
dmxBuffer[0] = 0; // DMX start code siempre 0
// JITTER GUARD: Timestamp del último UPDATE_BUFFER recibido.
// Si no llega un UPDATE_BUFFER en más de STALE_LIMIT_MS, el worker simplemente
// sigue enviando el último buffer válido — el hardware NUNCA queda en negro.
// No hay acción correctiva: la ausencia de actualización = escena estática.
// El valor 0 indica "sin datos aún" (estado inicial antes del primer UPDATE_BUFFER).
let lastBufferUpdateNs = BigInt(0);
let outputLoop = null;
// Timing preciso via process.hrtime — independiente del timer del OS.
// Windows tiene resolución de setTimeout de 15.6ms por defecto.
// process.hrtime tiene resolución de nanosegundos.
// DMX frame mínimo: BREAK(88µs) + MAB(8µs) + DATA(~22.7ms @ 250kbaud) ≈ 23ms
// 🔥 WAVE 2100: ADAPTIVE PACING — el Worker recibe refreshRate via IPC CONNECT.
// Interfaces baratas (Tornado, clones FTDI) solo aguantan 33fps.
// El valor por defecto (30Hz = 33.3ms) es conservador para cables desconocidos.
// Interfaces Pro (EnttecPro con microcontrolador) no usan este Worker.
let minFrameNs = BigInt(33333333); // 30Hz default (33.3ms)
let lastFrameStart = BigInt(0);
// BREAK mode: 'set' usa port.set({brk}) — funciona con FTDI auténtico.
// 'baudrate' cambia baud a 76923 → envía 0x00 (~130µs LOW) → vuelve a 250000.
// Los chips genéricos (no-FTDI, clones baratos) a veces ignoran port.set({brk})
// porque su driver Windows no implementa SetCommBreak. El baudrate-switch es
// el método que usa Freestyler/QLC+ como fallback universal.
// DEFAULT: 'baudrate' — funciona con cualquier chip USB-serial sin excepción.
let breakMode = 'baudrate';
// Buffer de break para baudrate-switch: un byte 0x00 a 76923 baud = ~130µs
const BREAK_BYTE = Buffer.from([0x00]);
function log(message) {
    process.send?.({ type: 'LOG', message: `[DMX-Worker] ${message}` });
}
// ─────────────────────────────────────────────────────────────────────────────
// Conexión serial — import DINÁMICO y LOCAL, nunca heredado del main process
// ─────────────────────────────────────────────────────────────────────────────
function handleConnect(portPath, refreshRate, requestedBreakMode) {
    // 🔥 WAVE 2100: Adaptive Pacing — calcular intervalo desde refreshRate
    if (refreshRate && refreshRate > 0 && refreshRate <= 44) {
        minFrameNs = BigInt(Math.floor((1000 / refreshRate) * 1000000));
        log(`⏱️ Adaptive Pacing: ${refreshRate}Hz → ${Number(minFrameNs / BigInt(1000000))}ms/frame`);
    }
    // BREAK mode: default 'set' para FTDI puro, 'baudrate' para chips genéricos
    if (requestedBreakMode === 'baudrate' || requestedBreakMode === 'set') {
        breakMode = requestedBreakMode;
        log(`🔧 BREAK mode: ${breakMode}`);
    }
    import('serialport').then((serialportModule) => {
        const SerialPort = serialportModule.SerialPort ??
            serialportModule.default?.SerialPort;
        if (!SerialPort) {
            process.send?.({
                type: 'CONNECTED',
                success: false,
                error: 'serialport module loaded but SerialPort class not found',
            });
            return;
        }
        // Instanciar SerialPort en ESTE proceso — el handle nativo nace y muere aquí
        port = new SerialPort({
            path: portPath,
            baudRate: 250000,
            dataBits: 8,
            stopBits: 2,
            parity: 'none',
            autoOpen: false,
        });
        const openTimeout = setTimeout(() => {
            log('❌ Connect timeout (3s)');
            process.send?.({ type: 'CONNECTED', success: false, error: 'Connection timeout' });
            port = null;
        }, 3000);
        port.open((err) => {
            clearTimeout(openTimeout);
            if (err) {
                log(`❌ Open failed: ${err.message}`);
                process.send?.({ type: 'CONNECTED', success: false, error: err.message });
                port = null;
                return;
            }
            isOpen = true;
            log(`✅ Connected to ${portPath} @ 250000 baud`);
            port.on('error', (portErr) => {
                log(`❌ Port error: ${portErr.message}`);
                stopOutputLoop();
                isOpen = false;
                process.send?.({ type: 'ERROR', error: portErr.message });
            });
            port.on('close', () => {
                log('⚠️ Port closed externally');
                stopOutputLoop();
                isOpen = false;
                process.send?.({ type: 'DISCONNECTED' });
            });
            // TWO-PHASE STARTUP PROTOCOL
            // FASE 1 — CONNECTED: puerto abierto
            // FASE 2 — 100ms delay → READY: output loop activo
            process.send?.({ type: 'CONNECTED', success: true });
            setTimeout(() => {
                if (!isOpen || !port)
                    return;
                startOutputLoop();
                log('🚀 Output loop live — READY for DMX output');
                process.send?.({ type: 'READY' });
            }, 100);
        });
    }).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        log(`❌ import('serialport') failed: ${msg}`);
        process.send?.({ type: 'CONNECTED', success: false, error: msg });
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// Output loop — el corazón del bit-banging aislado
// ─────────────────────────────────────────────────────────────────────────────
function startOutputLoop() {
    if (outputLoop)
        return;
    const sinceLastUpdate = lastBufferUpdateNs === BigInt(0)
        ? 'no data yet'
        : `${Number((process.hrtime.bigint() - lastBufferUpdateNs) / BigInt(1000000))}ms since last UPDATE_BUFFER`;
    log(`Output loop started — hrtime pacing, setImmediate scheduling (${sinceLastUpdate})`);
    lastFrameStart = process.hrtime.bigint();
    scheduleNextFrame();
}
// Max spin-wait para pacing: 5ms. Si falta más, ceder al event loop
// para procesar IPC messages (UPDATE_BUFFER).
const MAX_PACING_SPIN_NS = BigInt(5000000);
function scheduleNextFrame() {
    if (!isOpen || !port)
        return;
    // setImmediate: cede al event loop para procesar I/O callbacks
    // (port.set, port.write, IPC UPDATE_BUFFER) antes del siguiente frame.
    outputLoop = setImmediate(() => {
        if (!isOpen || !port)
            return;
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
        // setImmediate retorna un Immediate, pero TypeScript lo tipa como retorno de setImmediate
        clearImmediate(outputLoop);
        outputLoop = null;
        log('Output loop stopped');
    }
}
/**
 * Spin-wait HARDCORE de alta resolución.
 * Bloquea el event loop durante `ns` nanosegundos.
 *
 * BLINDAJE ANTI-YIELD:
 *   - NO usa setTimeout, setImmediate, process.nextTick, ni ninguna API que
 *     ceda control al event loop de Node.js o al scheduler del OS.
 *   - El while loop es un busy-wait PURO: solo lee hrtime y compara.
 *   - process.hrtime.bigint() es una syscall directa a QueryPerformanceCounter
 *     en Windows — resolución sub-microsegundo, sin allocation de memoria.
 *   - Este proceso tiene PRIORITY_HIGHEST — el OS no nos va a preemptar
 *     por un evento de cursor durante 100µs.
 *   - En un child process DEDICADO a DMX, bloquear 100µs es imperceptible.
 *     El child no tiene UI, no tiene React, no tiene ventanas — SOLO DMX.
 */
function spinWaitNs(ns) {
    const end = process.hrtime.bigint() + ns;
    // eslint-disable-next-line no-empty
    while (process.hrtime.bigint() < end) { }
}
// BREAK: 1ms (spec mínimo 88µs, máximo no definido en práctica ≤1s)
// Usado solo en modo 'set'. En modo 'baudrate' el break lo genera el propio byte 0x00.
const BREAK_NS = BigInt(1000000);
// MAB mínimo en modo baudrate-switch: 8µs. El cambio de baud + drain del UART
// ya tarda >8µs, pero añadimos un spin explícito de 20µs por seguridad.
const MAB_NS = BigInt(20000);
/**
 * Envía un frame DMX completo.
 *
 * MODO 'set' (FTDI/Tornado):
 *   port.set({brk:true}) → spin 1ms → port.set({brk:false}) → port.write(513b)
 *
 * MODO 'baudrate' (chips genéricos, QLC+/Freestyler compatible):
 *   port.update({baudRate: 76923}) → port.write(0x00) → drain
 *   → port.update({baudRate: 250000}) → spin MAB → port.write(513b)
 *
 *   A 76923 baud, un byte 0x00 (start bit + 8 bits + stop) dura ~130µs → BREAK válido.
 *   Este es el método universal: funciona con CUALQUIER chip USB-serial en Windows
 *   porque solo usa operaciones de write, sin depender de SetCommBreak.
 */
function sendFrame() {
    if (!port || !isOpen) {
        scheduleNextFrame();
        return;
    }
    if (breakMode === 'baudrate') {
        sendFrameBaudrateBreak();
    }
    else {
        sendFrameSetBreak();
    }
}
/**
 * BREAK via port.set({brk}) — para FTDI puro (Tornado, Enttec Open DMX).
 */
function sendFrameSetBreak() {
    const portAny = port;
    // Si el driver no expone port.set, degradar a baudrate-switch automáticamente
    if (typeof portAny.set !== 'function') {
        log('⚠️ port.set no disponible — degradando a baudrate-switch');
        breakMode = 'baudrate';
        sendFrameBaudrateBreak();
        return;
    }
    portAny.set({ brk: true }, (err) => {
        if (err || !port || !isOpen) {
            scheduleNextFrame();
            return;
        }
        spinWaitNs(BREAK_NS);
        portAny.set({ brk: false }, (err2) => {
            if (err2 || !port || !isOpen) {
                scheduleNextFrame();
                return;
            }
            port.write(dmxBuffer, (err3) => {
                if (err3)
                    log(`Write error: ${err3.message}`);
                scheduleNextFrame();
            });
        });
    });
}
/**
 * BREAK via baudrate-switch — compatible con chips genéricos (CH340, PL2303, CP210x, etc.).
 *
 * Técnica estándar usada por Freestyler, QLC+, DMXControl:
 *   1. Bajar baud a 76923 (1/250000 × 250000/76923 ≈ 3.25 bit-times por bit DMX)
 *      → un byte 0x00 dura ~130µs en la línea = BREAK válido (≥88µs)
 *   2. Emitir 0x00
 *   3. Subir baud a 250000 (velocidad DMX estándar)
 *   4. Spin 20µs = MAB
 *   5. Emitir los 513 bytes del frame DMX
 */
function sendFrameBaudrateBreak() {
    const portAny = port;
    if (typeof portAny.update !== 'function') {
        // Último recurso: sin BREAK, enviar directo (mejor que nada)
        port.write(dmxBuffer, () => { scheduleNextFrame(); });
        return;
    }
    // PASO 1: Bajar baud para generar BREAK
    portAny.update({ baudRate: 76923 }, (err) => {
        if (err || !port || !isOpen) {
            scheduleNextFrame();
            return;
        }
        // PASO 2: Emitir 0x00 → genera señal LOW ~130µs = BREAK DMX512
        port.write(BREAK_BYTE, (err2) => {
            if (err2 || !port || !isOpen) {
                scheduleNextFrame();
                return;
            }
            // Drain: esperar que el UART vacíe el byte antes de cambiar baud
            // port.drain() garantiza que el byte se emitió por el RS-485 antes de continuar
            port.drain((err3) => {
                if (err3 || !port || !isOpen) {
                    scheduleNextFrame();
                    return;
                }
                // PASO 3: Volver a 250000 baud para el frame DMX
                portAny.update({ baudRate: 250000 }, (err4) => {
                    if (err4 || !port || !isOpen) {
                        scheduleNextFrame();
                        return;
                    }
                    // PASO 4: MAB — 20µs mínimo
                    spinWaitNs(MAB_NS);
                    // PASO 5: Emitir los 513 bytes del universo DMX
                    port.write(dmxBuffer, (err5) => {
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
        log('🔌 Disconnected');
        process.send?.({ type: 'DISCONNECTED' });
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
// Message handler — IPC via process.on('message')
// ─────────────────────────────────────────────────────────────────────────────
process.on('message', (msg) => {
    switch (msg.type) {
        case 'CONNECT':
            if (typeof msg.portPath === 'string') {
                handleConnect(msg.portPath, msg.refreshRate, msg.breakMode);
            }
            break;
        case 'UPDATE_BUFFER':
            // Recibir canales DMX frescos del main process via IPC pipe.
            // El array se copia al Buffer local — operación O(512), ~1µs.
            // JITTER GUARD: timestamp para detectar ausencia de actualizaciones.
            // Si el main está saturado (UI render, GC) y no envía UPDATE_BUFFER,
            // el worker sigue enviando el buffer anterior — CERO parpadeo.
            if (Array.isArray(msg.channels)) {
                const len = Math.min(msg.channels.length, dmxBuffer.length);
                for (let i = 0; i < len; i++) {
                    dmxBuffer[i] = msg.channels[i];
                }
                dmxBuffer[0] = 0; // start code siempre 0
                lastBufferUpdateNs = process.hrtime.bigint();
            }
            break;
        case 'DISCONNECT':
            handleDisconnect();
            break;
    }
});

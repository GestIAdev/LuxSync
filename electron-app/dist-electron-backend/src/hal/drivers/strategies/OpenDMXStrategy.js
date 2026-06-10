/**
 * WAVE 6019.1: OPEN DMX STRATEGY — Main Process Micro-Blocking
 *
 * Para interfaces SIN microcontrolador (cables tontos):
 * - Enttec Open DMX USB
 * - Clones chinos FTDI directos
 * - IMC UD 7S / Tornado (chip FTDI puro)
 * - Cualquier cable USB-Serial con chip FTDI/CH340/PL2303
 *
 * ARQUITECTURA (Main Process + SAB):
 *
 *   WAVE 6019.1: SerialPort vive en el Main Process. Lee del SAB
 *   directamente via DmxUniverseReader. El BREAK/MAB se ejecuta
 *   con micro-bloqueo (spinWaitNs) en el hilo principal.
 *
 *   Flujo de datos:
 *   TickEngine ──(SAB write @44Hz)──→ OpenDMXStrategy ──(SAB read @33Hz)──→ SerialPort
 *
 *   ¿Por qué Main Process y no worker_thread?
 *   serialport usa uv_poll_t internamente, que no es seguro en worker_threads
 *   de Electron. El callback de uv_poll_t llama a node::MakeCallback, que
 *   puede fallar con "HandleScope" bajo carga real. En Main Process,
 *   node_bindings.cc de Electron maneja correctamente el locking V8+Chromium.
 *
 * El UniversalDMXDriver no crea SerialPort para esta estrategia (selfManaged=true).
 */
import { SerialPort } from 'serialport';
import { DmxUniverseReader } from '../../../core/aether/glass/DmxSabHandlers';
import { CHANNELS_PER_UNI } from '../../../core/aether/glass/layout';
import { getDmxSab } from '../../../core/aether/glass/GlassMemory';
const DMX_OUTPUT_HZ = 33;
const BREAK_BAUD = 76923;
const DMX_BAUD = 250000;
const BREAK_HOLD_NS = 160000n;
const MAB_NS = 20000n;
const spinWaitNs = (nanoseconds) => {
    const start = process.hrtime.bigint();
    while (process.hrtime.bigint() - start < nanoseconds) { }
};
export class OpenDMXStrategy {
    constructor() {
        this.name = 'Open DMX Main Process (WAVE 6019.1)';
        this.selfManaged = true;
        this.port = null;
        this.reader = null;
        this.loopTimer = null;
        this.lastFrameId = -1;
        this.universe = 0;
        this.dmxBuffer = Buffer.alloc(513, 0);
        this.isSending = false;
        this.isRunning = false;
    }
    resetBuffer(log) {
        this.lastFrameId = -1;
        log('[OpenDMX] resetBuffer: lastFrameId reseteado — forzando re-lectura del SAB');
    }
    async connect(portPath, universe, log) {
        if (this.port || this.loopTimer) {
            log('[OpenDMX] Conexion previa detectada — destruyendo...');
            await this.destroy(log);
        }
        const sab = getDmxSab();
        this.reader = new DmxUniverseReader(sab);
        this.universe = universe;
        this.lastFrameId = -1;
        log(`[OpenDMX] Abriendo ${portPath} (universo ${universe}, ${DMX_OUTPUT_HZ}Hz)`);
        try {
            this.port = new SerialPort({ path: portPath, baudRate: DMX_BAUD });
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            log(`[OpenDMX] ERROR al abrir SerialPort: ${msg}`);
            return false;
        }
        this.startOutputLoop(log);
        log(`[OpenDMX] Puerto abierto — loop activo @${DMX_OUTPUT_HZ}Hz`);
        return true;
    }
    startOutputLoop(log) {
        this.isSending = false;
        this.isRunning = true;
        this.loopTimer = null;
        const tick = () => this.runTick(log);
        setTimeout(tick, 0);
    }
    runTick(log) {
        if (!this.isRunning || !this.port?.isOpen || !this.reader)
            return;
        if (this.isSending) {
            setTimeout(() => this.runTick(log), 5);
            return;
        }
        const frame = this.reader.readCoherent(this.lastFrameId);
        if (frame) {
            this.lastFrameId = frame.frameId;
            const offset = this.universe * CHANNELS_PER_UNI;
            const uniData = frame.data.subarray(offset, offset + CHANNELS_PER_UNI);
            this.dmxBuffer[0] = 0x00;
            for (let i = 0; i < CHANNELS_PER_UNI; i++) {
                this.dmxBuffer[i + 1] = uniData[i];
            }
        }
        this.isSending = true;
        this.sendFrame(log);
    }
    sendFrame(log) {
        const port = this.port;
        if (!port?.isOpen) {
            this.isSending = false;
            return;
        }
        port.update({ baudRate: BREAK_BAUD }, (err) => {
            if (err) {
                log(`[OpenDMX] ERROR BREAK update: ${err.message}`);
                this.isSending = false;
                return;
            }
            if (!this.isRunning) {
                this.isSending = false;
                return;
            }
            port.write(Buffer.from([0x00]));
            spinWaitNs(BREAK_HOLD_NS);
            port.update({ baudRate: DMX_BAUD }, (err) => {
                if (err) {
                    log(`[OpenDMX] ERROR MAB update: ${err.message}`);
                    this.isSending = false;
                    return;
                }
                if (!this.isRunning) {
                    this.isSending = false;
                    return;
                }
                spinWaitNs(MAB_NS);
                port.write(this.dmxBuffer, (writeErr) => {
                    if (writeErr)
                        log(`[OpenDMX] ERROR payload: ${writeErr.message}`);
                    this.isSending = false;
                    if (this.isRunning)
                        setTimeout(() => this.runTick(log), 25);
                });
            });
        });
    }
    async send(_port, _buffer, _universe, _log) {
        // No-op: el loop interno lee directamente del SAB.
        // TickEngine ya escribió en el SAB via DmxUniverseWriter.commitFrame().
    }
    async destroy(log) {
        this.isRunning = false;
        this.isSending = false;
        if (this.port) {
            try {
                this.port.close();
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                log(`[OpenDMX] ERROR al cerrar puerto: ${msg}`);
            }
            this.port = null;
        }
        this.reader = null;
        this.lastFrameId = -1;
        log('[OpenDMX] Estrategia destruida');
    }
}

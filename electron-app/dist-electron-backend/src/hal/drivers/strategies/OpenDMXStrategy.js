/**
 * WAVE 6012: OPEN DMX STRATEGY — SerialPort nativo en Main Process
 *
 * Para interfaces SIN microcontrolador (cables tontos):
 * - Enttec Open DMX USB
 * - Clones chinos FTDI directos
 * - IMC UD 7S / Tornado (chip FTDI puro)
 * - Cualquier cable USB-Serial con chip FTDI/CH340/PL2303
 *
 * ARQUITECTURA (Main Process Direct I/O):
 *
 *   WAVE 6012 ORACLE DIAG: serialport NO puede vivir en worker_threads dentro
 *   de Electron. El addon nativo bindings.node compite por el V8 Isolate lock
 *   con Chromium (node_bindings.cc:159). La solucion es reubicar SerialPort
 *   en el Main Process, donde node_bindings.cc coordina correctamente los
 *   event loops de Node.js y Chromium.
 *
 *   Flujo de datos:
 *   TickEngine ──(SAB write @44Hz)──→ DmxUniverseReader ──→ SerialPort.write()
 *   Todo en el Main Process. Cero worker_threads. Cero child_process.
 *
 * El UniversalDMXDriver no crea SerialPort para esta estrategia (selfManaged=true).
 */
import { SerialPort } from 'serialport';
import { DmxUniverseReader } from '../../../core/aether/glass/DmxSabHandlers';
import { getDmxSab } from '../../../core/aether/glass/GlassMemory';
const DMX_OUTPUT_HZ = 30;
const DMX_OUTPUT_MS = Math.round(1000 / DMX_OUTPUT_HZ);
export class OpenDMXStrategy {
    constructor() {
        this.name = 'Open DMX (Main Process Direct)';
        this.selfManaged = true;
        this.port = null;
        this.reader = null;
        this.lastFrameId = -1;
        this.outputTimer = null;
        this._probeTick = 0;
        this._probeLog = null;
    }
    resetBuffer(_log) {
        // No-op: el outputLoop lee del SAB, no hay buffer residual que purgar
    }
    async connect(portPath, universe, log) {
        try {
            const sab = getDmxSab();
            this.reader = new DmxUniverseReader(sab);
            log(`[Univ ${universe}] Opening DMX port directly in Main Process: ${portPath}`);
            this.port = new SerialPort({
                path: portPath,
                baudRate: 250000,
                dataBits: 8,
                stopBits: 2,
                parity: 'none',
            });
            const connected = await new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    log(`[Univ ${universe}] DMX port open timeout (8s)`);
                    resolve(false);
                }, 8000);
                this.port.on('open', () => {
                    clearTimeout(timeout);
                    log(`[Univ ${universe}] DMX port OPEN — starting output loop @ ${DMX_OUTPUT_HZ}Hz`);
                    this.startOutputLoop(log, universe);
                    resolve(true);
                });
                this.port.on('error', (err) => {
                    clearTimeout(timeout);
                    log(`[Univ ${universe}] DMX port error: ${err.message}`);
                    resolve(false);
                });
            });
            if (connected) {
                log(`[Univ ${universe}] DMX Main Process Direct fully operational`);
                // WAVE 6018 TELEMETRY: listener persistente de errores post-conexión
                this.port.on('error', (err) => {
                    log(`[Univ ${universe}] DMX port RUNTIME error: ${err.message}`);
                });
            }
            return connected;
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            log(`[Univ ${universe}] Failed to open DMX port: ${msg}`);
            return false;
        }
    }
    async send(_port, _buffer, _universe, _log) {
        // No-op: outputLoop lee directamente del SAB via DmxUniverseReader.
        // TickEngine escribe en el SAB con DmxUniverseWriter.commitFrame() cada tick.
    }
    async destroy(log) {
        this.stopOutputLoop();
        if (!this.port)
            return;
        log('Closing DMX port...');
        await new Promise((resolve) => {
            const timeout = setTimeout(() => {
                log('DMX port close timeout — forcing cleanup');
                resolve();
            }, 2000);
            this.port.close((err) => {
                clearTimeout(timeout);
                if (err)
                    log(`DMX port close error: ${err.message}`);
                resolve();
            });
        });
        this.port = null;
        this.reader = null;
        this.lastFrameId = -1;
        log('DMX port closed');
    }
    startOutputLoop(log, universe) {
        if (this.outputTimer)
            return;
        this._probeLog = log;
        this.outputTimer = setInterval(() => {
            if (!this.reader || !this.port?.isOpen)
                return;
            const frame = this.reader.readCoherent(this.lastFrameId);
            if (frame) {
                this.lastFrameId = frame.frameId;
                const dmxData = frame.data.subarray(0, 512);
                const dmxPacket = Buffer.alloc(513);
                dmxPacket[0] = 0x00; // DMX Start Code
                Buffer.from(new Uint8Array(dmxData)).copy(dmxPacket, 1);
                // ── WAVE 6018 TELEMETRY SAMPLER ──
                this._probeTick++;
                const doSample = this._probeTick % 60 === 0; // ~2 segundos @30Hz
                if (doSample) {
                    let maxVal = 0;
                    let maxIdx = -1;
                    for (let i = 0; i < 512; i++) {
                        if (dmxData[i] > maxVal) {
                            maxVal = dmxData[i];
                            maxIdx = i;
                        }
                    }
                    log(`[OpenDMX 🩺] frameId=${frame.frameId} maxVal=${maxVal}@ch${maxIdx + 1} ` +
                        `ch1-6=[${dmxPacket[1]},${dmxPacket[2]},${dmxPacket[3]},${dmxPacket[4]},${dmxPacket[5]},${dmxPacket[6]}] ` +
                        `ch${maxIdx + 1}=${maxIdx >= 0 ? dmxPacket[maxIdx + 1] : 'N/A'}`);
                }
                // ── Bit-banging BREAK manual para DMX512 (WAVE 2021.1) ──
                // Para cables FTDI/CH340 puros, necesitamos generar el señal BREAK
                // bajando la línea de TX antes de mandar los datos.
                this.port.set({ brk: true }, (errSetBrk) => {
                    if (errSetBrk) {
                        if (this._probeLog)
                            this._probeLog(`[OpenDMX 🚨] Set break error: ${errSetBrk.message}`);
                        return;
                    }
                    // Esperar mínimo 88µs para el DMX Break (usamos 1ms que es seguro)
                    setTimeout(() => {
                        this.port?.set({ brk: false }, (errClearBrk) => {
                            if (errClearBrk) {
                                if (this._probeLog)
                                    this._probeLog(`[OpenDMX 🚨] Clear break error: ${errClearBrk.message}`);
                                return;
                            }
                            // MAB (Mark After Break) - mínimo 8µs, un setTimeout de 1ms cumple de sobra
                            setTimeout(() => {
                                // 1. Crear el paquete estándar DMX512 (1 byte Start Code + 512 canales)
                                const dmx513 = Buffer.alloc(513);
                                // 2. Byte 0 se queda en 0x00 automáticamente por el alloc (Start Code)
                                // 3. Copiar los canales calculados a partir del índice 1
                                // NOTA: dmxData (que sale de frame.data) ya son solo 512 bytes de canales
                                Buffer.from(new Uint8Array(dmxData)).copy(dmx513, 1);
                                // 4. Enviar el paquete corregido al puerto serie
                                this.port?.write(dmx513, (errWrite) => {
                                    if (errWrite && this._probeLog) {
                                        this._probeLog(`[OpenDMX 🚨] Serial write error: ${errWrite.message}`);
                                    }
                                });
                                if (this.port?.drain) {
                                    this.port.drain();
                                }
                            }, 1); // 1ms MAB
                        });
                    }, 1); // 1ms BREAK
                });
            }
        }, DMX_OUTPUT_MS);
        log(`[Univ ${universe}] Output loop started @ ${DMX_OUTPUT_HZ}Hz (${DMX_OUTPUT_MS}ms interval)`);
    }
    stopOutputLoop() {
        if (this.outputTimer) {
            clearInterval(this.outputTimer);
            this.outputTimer = null;
        }
    }
}

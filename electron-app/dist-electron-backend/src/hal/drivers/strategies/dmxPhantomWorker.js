import { parentPort, workerData } from 'node:worker_threads';
import { SerialPort } from 'serialport';
import { DmxUniverseReader } from '../../../core/aether/glass/DmxSabHandlers';
// ═══════════════════════════════════════════════════════════════════════════
// VID/PID database — misma que UniversalDMXDriver
// ═══════════════════════════════════════════════════════════════════════════
const KNOWN_CHIPS = {
    FTDI: { vid: '0403', pids: ['6001', '6010', '6011', '6014', '6015'], name: 'FTDI', confidence: 95 },
    IMC_UD7S: { vid: '0403', pids: ['6001'], name: 'IMC UD 7S', confidence: 98 },
    CH340: { vid: '1a86', pids: ['7523', '5523', '7522'], name: 'CH340/CH341', confidence: 80 },
    PROLIFIC: { vid: '067b', pids: ['2303', '23a3', '23b3', '23c3', '23d3'], name: 'Prolific PL2303', confidence: 70 },
    CP210X: { vid: '10c4', pids: ['ea60', 'ea61', 'ea70', 'ea71'], name: 'Silicon Labs CP210x', confidence: 85 },
    CH9102: { vid: '1a86', pids: ['55d4'], name: 'QinHeng CH9102', confidence: 75 },
};
async function detectDmxPort() {
    const ports = await SerialPort.list();
    const candidates = [];
    for (const p of ports) {
        const vid = (p.vendorId ?? '').toLowerCase();
        const pid = (p.productId ?? '').toLowerCase();
        const mfr = (p.manufacturer ?? '').toLowerCase();
        for (const chip of Object.values(KNOWN_CHIPS)) {
            if (vid === chip.vid && chip.pids.includes(pid)) {
                let confidence = chip.confidence;
                if (mfr.includes('dmx') || mfr.includes('enttec'))
                    confidence = Math.min(100, confidence + 20);
                candidates.push({ path: p.path, name: chip.name, confidence });
                break;
            }
        }
    }
    candidates.sort((a, b) => b.confidence - a.confidence);
    return candidates[0] ?? null;
}
// ═══════════════════════════════════════════════════════════════════════════
// Bootstrap
// ═══════════════════════════════════════════════════════════════════════════
const sab = workerData?.sab;
const explicitPath = workerData?.portPath;
if (!sab || !(sab instanceof SharedArrayBuffer)) {
    throw new Error('[DMX Phantom Worker] DMX_UNIVERSE_SAB no proporcionado o inválido.');
}
const reader = new DmxUniverseReader(sab);
let lastFrameId = -1;
async function bootstrap() {
    const resolvedPath = explicitPath ?? (await detectDmxPort())?.path;
    if (!resolvedPath) {
        parentPort?.postMessage({ type: 'dmx:error', message: 'No DMX port found (auto-detect failed, no portPath provided)' });
        return;
    }
    parentPort?.postMessage({ type: 'dmx:detected', portPath: resolvedPath, explicit: !!explicitPath });
    const port = new SerialPort({
        path: resolvedPath,
        baudRate: 250000,
        dataBits: 8,
        stopBits: 2,
        parity: 'none',
    });
    function outputLoop() {
        const frame = reader.readCoherent(lastFrameId);
        if (frame) {
            lastFrameId = frame.frameId;
            port.write(Buffer.from(frame.data.subarray(0, 512)));
        }
        setImmediate(outputLoop);
    }
    port.on('open', () => {
        parentPort?.postMessage({ type: 'dmx:ready', portPath: resolvedPath });
        outputLoop();
    });
    port.on('error', (err) => {
        parentPort?.postMessage({ type: 'dmx:error', message: err.message });
        throw err;
    });
    parentPort?.on('message', (msg) => {
        if (msg === 'STOP')
            port.close(() => process.exit(0));
    });
}
void bootstrap();

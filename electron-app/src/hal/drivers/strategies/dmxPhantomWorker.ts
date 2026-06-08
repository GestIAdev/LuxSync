import { parentPort, workerData } from 'node:worker_threads'
import { SerialPort } from 'serialport'
import { DmxUniverseReader } from '../../../core/aether/glass/DmxSabHandlers'

// 1. Extraer SAB y ruta del puerto desde workerData
const sab = workerData?.sab as SharedArrayBuffer
const portPath = workerData?.portPath as string

if (!sab || !(sab instanceof SharedArrayBuffer)) {
  throw new Error('[DMX Phantom Worker] DMX_UNIVERSE_SAB no proporcionado o inválido.')
}
if (!portPath || typeof portPath !== 'string') {
  throw new Error('[DMX Phantom Worker] portPath no proporcionado o inválido.')
}

// 2. Instanciar el lector lock-free
const reader = new DmxUniverseReader(sab)

let lastFrameId = -1

// 3. Configurar SerialPort para DMX (estándar DMX512-A)
const port = new SerialPort({
  path: portPath,
  baudRate: 250000,
  dataBits: 8,
  stopBits: 2,
  parity: 'none',
})

// 4. Bucle de salida — solo arranca tras puerto abierto
function outputLoop(): void {
  const frame = reader.readCoherent(lastFrameId)

  if (frame) {
    lastFrameId = frame.frameId

    // Extraer el primer universo (512 bytes) y enviarlo al hardware
    const universe = frame.data.subarray(0, 512)
    port.write(Buffer.from(universe))
  }

  setImmediate(outputLoop)
}

// 5. Arranque seguro: esperar evento 'open' antes de girar
port.on('open', () => {
  parentPort?.postMessage({ type: 'dmx:ready', portPath })
  outputLoop()
})

port.on('error', (err) => {
  parentPort?.postMessage({ type: 'dmx:error', message: err.message })
  throw err
})

// 6. Manejar mensajes del parent
parentPort?.on('message', (msg) => {
  if (msg === 'STOP') {
    port.close(() => process.exit(0))
  }
})

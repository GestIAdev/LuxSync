import { parentPort, workerData } from 'node:worker_threads'
import { DmxUniverseReader } from '../../../core/aether/glass/DmxSabHandlers'

// 1. Recibir el DMX_UNIVERSE_SAB a través de workerData
const sab = workerData?.sab as SharedArrayBuffer

if (!sab || !(sab instanceof SharedArrayBuffer)) {
  throw new Error('[DMX Phantom Worker] DMX_UNIVERSE_SAB no proporcionado o inválido.')
}

// 2. Instanciar el lector lock-free
const reader = new DmxUniverseReader(sab)

let lastFrameId = -1

// Helper mock simulando la escritura de hardware nativo
function mockSerialportWrite(_frameId: number, _dataLength: number): void {
  // TODO: Inyectar el binding nativo de serialport.write aquí.
  // Ej: serialport.write(data) 
}

// 3. Establecer el bucle de salida
function outputLoop(): void {
  // Lectura coherente (zero-allocation) vía Seqlock
  const frame = reader.readCoherent(lastFrameId)

  if (frame) {
    lastFrameId = frame.frameId
    
    // Simula escritura al driver/hardware (aislado del tick de Node)
    mockSerialportWrite(frame.frameId, frame.data.length)
  }

  // Spin-wait muy ligero usando temporizadores nativos de Node.js
  setImmediate(outputLoop)
}

// Arrancar motor
outputLoop()

// Manejar mensajes del parent
parentPort?.on('message', (msg) => {
  if (msg === 'STOP') {
    process.exit(0)
  }
})

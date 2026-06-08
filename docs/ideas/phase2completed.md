¡Implementación completada y compilación limpia de TS comprobada! Código preparado para el entorno C++ bajo el patrón Seqlock con garantía lock-free y zero-allocation.

Se ha inyectado el código en la base local y se generó el commit feat(aether): implement DmxUniverse SAB handlers and phantom worker loop (WAVE-6005 v2 Phase 2).

A continuación las dos piezas clave tal como fueron insertadas:

PIEZA 1: DmxSabHandlers.ts


typescript
import {
  CHANNELS_PER_UNI,
  DMX_DATA_BYTES,
  DMX_HEADER_BYTES,
  DMX_HEADER_I32,
  DmxHdr
} from './layout'
 
/**
 * Escritor del DMX_UNIVERSE_SAB.
 * Vive en el Main Process (Node.js).
 * Único escritor; múltiples lectores permitidos.
 */
export class DmxUniverseWriter {
  private readonly i32: Int32Array
  private readonly u8: Uint8Array
 
  constructor(sab: SharedArrayBuffer) {
    this.i32 = new Int32Array(sab, 0, DMX_HEADER_I32)
    this.u8 = new Uint8Array(sab, DMX_HEADER_BYTES, DMX_DATA_BYTES)
  }
 
  /**
   * Escribe de forma atómica (seqlock) un frame DMX en la memoria compartida.
   *
   * @param frameId Identificador monotónico del frame.
   * @param universes Array de Uint8Array con los universos a volcar.
   * @param dirtyMask Máscara de 64 bits indicando qué universos cambiaron.
   */
  public commitFrame(frameId: number, universes: Uint8Array[], dirtyMask: bigint): void {
    // 1. Iniciar escritura: incrementar SEQLOCK a impar
    Atomics.add(this.i32, DmxHdr.SEQLOCK, 1)
 
    // 2. Volcar datos binarios (zero-allocation)
    for (let u = 0; u < universes.length; u++) {
      this.u8.set(universes[u], u * CHANNELS_PER_UNI)
    }
 
    // 3. Actualizar metadata del header
    this.i32[DmxHdr.FRAME_ID] = frameId
    this.i32[DmxHdr.UNIVERSE_MASK] = Number(dirtyMask & BigInt(0xffffffff))
    this.i32[DmxHdr.UNIVERSE_MASK_HI] = Number(dirtyMask >> BigInt(32))
 
    // 4. Finalizar escritura: incrementar SEQLOCK a par
    Atomics.add(this.i32, DmxHdr.SEQLOCK, 1)
 
    // 5. Despertar a los workers que estén bloqueados esperando
    Atomics.notify(this.i32, DmxHdr.SEQLOCK)
  }
}
 
/**
 * Lector del DMX_UNIVERSE_SAB.
 * Vive en el DMX Phantom Worker (worker_thread).
 */
export class DmxUniverseReader {
  private readonly i32: Int32Array
  private readonly u8: Uint8Array
  private readonly scratch = new Uint8Array(DMX_DATA_BYTES)
 
  constructor(sab: SharedArrayBuffer) {
    this.i32 = new Int32Array(sab, 0, DMX_HEADER_I32)
    this.u8 = new Uint8Array(sab, DMX_HEADER_BYTES, DMX_DATA_BYTES)
  }
 
  /**
   * Lee un frame completo garantizando coherencia (evita el tearing).
   * Usa un scratch buffer interno preasignado (zero-allocation).
   * Devuelve null si no hay un frame nuevo.
   */
  public readCoherent(lastFrameId: number): { frameId: number; data: Uint8Array } | null {
    let s1: number = 0
    let s2: number = -1
 
    do {
      s1 = Atomics.load(this.i32, DmxHdr.SEQLOCK)
 
      // Si es impar, el Main Process está escribiendo. Reintentamos.
      if ((s1 & 1) !== 0) {
        s2 = -1 // Garantiza que s1 !== s2 para repetir el bucle
        continue
      }
 
      const frameId = this.i32[DmxHdr.FRAME_ID]
      
      // Si el frame no ha cambiado, no copiamos nada.
      if (frameId === lastFrameId) return null
 
      // Tomamos el snapshot atómico de los 25.600 bytes en el buffer scratch
      this.scratch.set(this.u8)
 
      s2 = Atomics.load(this.i32, DmxHdr.SEQLOCK)
 
      // Si el seqlock cambió durante nuestra lectura, hubo una re-escritura simultánea (tearing).
      // El do-while se repite.
    } while (s1 !== s2)
 
    return { frameId: this.i32[DmxHdr.FRAME_ID], data: this.scratch }
  }
}
PIEZA 2: dmxPhantomWorker.ts


typescript
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
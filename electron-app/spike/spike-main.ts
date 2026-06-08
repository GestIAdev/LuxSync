// WAVE-6005-SPIKE: Main — NUNCA importa serialport. Solo el Worker lo carga.

import { Worker } from 'node:worker_threads'
import { resolve } from 'node:path'

const SAB_SIZE = 512
const sab = new SharedArrayBuffer(SAB_SIZE)
const view = new Uint8Array(sab)

const workerPath = resolve(__dirname, 'spike-worker.ts')

const worker = new Worker(workerPath, {
  workerData: { sab },
})

worker.on('message', (msg: string) => {
  console.log(`[MAIN] worker dice: ${msg}`)
})

worker.on('error', (err) => {
  console.error('[MAIN] worker error:', err)
})

worker.on('exit', (code) => {
  console.log(`[MAIN] worker exit code=${code}`)
})

let tick = 0
const INTERVAL_MS = 22 // ~44Hz

const timer = setInterval(() => {
  tick++
  // Escribir en el SAB: byte 0 = contador bajo, byte 1 = contador alto
  view[0] = tick & 0xff
  view[1] = (tick >> 8) & 0xff
  // byte 2 = valor pseudo-aleatorio
  view[2] = (tick * 7 + 13) & 0xff

  if (tick % 100 === 0) {
    console.log(`[MAIN] tick=${tick} | SAB[0]=${view[0]} SAB[1]=${view[1]} SAB[2]=${view[2]}`)
  }
}, INTERVAL_MS)

// Correr 10 segundos y salir limpio
setTimeout(() => {
  clearInterval(timer)
  console.log('[MAIN] finalizando spike...')
  worker.terminate().then(() => {
    console.log('[MAIN] worker terminado. SPIKE COMPLETADO.')
    process.exit(0)
  })
}, 10_000)

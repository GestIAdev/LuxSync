// WAVE-6005-SPIKE: Worker — ÚNICO archivo que importa serialport.

import { workerData, parentPort } from 'node:worker_threads'
import { SerialPort } from 'serialport'

const { sab } = workerData as { sab: SharedArrayBuffer }
const view = new Uint8Array(sab)

function post(msg: string) {
  parentPort?.postMessage(msg)
}

async function probeSerialport() {
  try {
    const ports = await SerialPort.list()
    console.log(`[WORKER] serialport.list() OK — ${ports.length} puerto(s) encontrado(s)`)
    for (const p of ports) {
      console.log(`  → ${p.path} | ${p.manufacturer ?? '?'} | ${p.pnpId ?? '?'}`)
    }
    post(`serialport.list() OK: ${ports.length} puertos`)
  } catch (err: any) {
    console.error('[WORKER] serialport.list() ERROR:', err.message)
    post(`serialport.list() ERROR: ${err.message}`)
  }

  // Intentar abrir puerto ficticio para probar binding C++ vivo
  try {
    const testPort = new SerialPort({ path: 'COM99', baudRate: 115200 }, (err) => {
      if (err) {
        console.log('[WORKER] Apertura COM99 falló (esperado):', err.message)
        post('COM99 open: falló (esperado, binding C++ vivo)')
      } else {
        console.log('[WORKER] COM99 abierto (inesperado)')
        testPort.close()
      }
    })
  } catch (err: any) {
    console.log('[WORKER] SerialPort constructor lanzó (esperado):', err.message)
    post('SerialPort constructor: binding C++ cargado correctamente')
  }
}

// ── Iniciar ────────────────────────────────────────────────────────────────
probeSerialport()

let tick = 0
let lastLogged = 0

const timer = setInterval(() => {
  tick++
  const lo = view[0]
  const hi = view[1]
  const rnd = view[2]
  const counter = lo | (hi << 8)

  if (tick - lastLogged >= 100) {
    lastLogged = tick
    console.log(`[WORKER] tick=${tick} | SAB counter=${counter} | rnd=${rnd}`)
  }
}, 22)

// Auto-terminar después de 10s
setTimeout(() => {
  clearInterval(timer)
  post('worker finalizando')
  process.exit(0)
}, 10_000)

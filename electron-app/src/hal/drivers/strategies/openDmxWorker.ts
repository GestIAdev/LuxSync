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
import * as os from 'os'

try {
  // PRIORITY_HIGHEST = -20 en POSIX, REALTIME_PRIORITY_CLASS en Windows.
  // Requiere privilegios elevados en algunos OS. Si falla, intentamos ABOVE_NORMAL.
  os.setPriority(0, os.constants.priority.PRIORITY_HIGHEST)
} catch {
  try {
    os.setPriority(0, os.constants.priority.PRIORITY_ABOVE_NORMAL)
  } catch {
    // Si ni siquiera ABOVE_NORMAL funciona, seguimos con prioridad normal.
    // El proceso sigue siendo funcional, solo sin ventaja de scheduling.
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Estado interno — TODO local a este PROCESO, ningún handle cruzado
// ─────────────────────────────────────────────────────────────────────────────
let port: any = null
let isOpen = false

// Buffer DMX local — 513 bytes (start code + 512 canales).
// El main envía UPDATE_BUFFER con los canales frescos via IPC.
// El output loop lee este buffer en cada sendFrame().
const dmxBuffer: Buffer = Buffer.alloc(513, 0)
dmxBuffer[0] = 0 // DMX start code siempre 0

// JITTER GUARD: Timestamp del último UPDATE_BUFFER recibido.
// Si no llega un UPDATE_BUFFER en más de STALE_LIMIT_MS, el worker simplemente
// sigue enviando el último buffer válido — el hardware NUNCA queda en negro.
// No hay acción correctiva: la ausencia de actualización = escena estática.
// El valor 0 indica "sin datos aún" (estado inicial antes del primer UPDATE_BUFFER).
let lastBufferUpdateNs: bigint = BigInt(0)

let outputLoop: ReturnType<typeof setTimeout> | ReturnType<typeof setImmediate> | null = null

// Timing preciso via process.hrtime — independiente del timer del OS.
// Windows tiene resolución de setTimeout de 15.6ms por defecto.
// process.hrtime tiene resolución de nanosegundos.
// DMX frame mínimo: BREAK(88µs) + MAB(8µs) + DATA(~22.7ms @ 250kbaud) ≈ 23ms
// 🔥 WAVE 2100: ADAPTIVE PACING — el Worker recibe refreshRate via IPC CONNECT.
// Interfaces baratas (Tornado, clones FTDI) solo aguantan 33fps.
// El valor por defecto (30Hz = 33.3ms) es conservador para cables desconocidos.
// Interfaces Pro (EnttecPro con microcontrolador) no usan este Worker.
let minFrameNs: bigint = BigInt(33_333_333) // 30Hz default (33.3ms)
let lastFrameStart: bigint = BigInt(0)

function log(message: string): void {
  process.send?.({ type: 'LOG', message: `[DMX-Worker] ${message}` })
}

// ─────────────────────────────────────────────────────────────────────────────
// Conexión serial — import DINÁMICO y LOCAL, nunca heredado del main process
// ─────────────────────────────────────────────────────────────────────────────
function handleConnect(portPath: string, refreshRate?: number): void {
  // 🔥 WAVE 2100: Adaptive Pacing — calcular intervalo desde refreshRate
  if (refreshRate && refreshRate > 0 && refreshRate <= 44) {
    minFrameNs = BigInt(Math.floor((1000 / refreshRate) * 1_000_000))
    log(`⏱️ Adaptive Pacing: ${refreshRate}Hz → ${Number(minFrameNs / BigInt(1_000_000))}ms/frame`)
  }

  import('serialport').then((serialportModule) => {
    const SerialPort: any = (serialportModule as any).SerialPort ??
      (serialportModule as any).default?.SerialPort

    if (!SerialPort) {
      process.send?.({
        type: 'CONNECTED',
        success: false,
        error: 'serialport module loaded but SerialPort class not found',
      })
      return
    }

    // Instanciar SerialPort en ESTE proceso — el handle nativo nace y muere aquí
    port = new SerialPort({
      path: portPath,
      baudRate: 250000,
      dataBits: 8,
      stopBits: 2,
      parity: 'none',
      autoOpen: false,
    })

    const openTimeout = setTimeout(() => {
      log('❌ Connect timeout (3s)')
      process.send?.({ type: 'CONNECTED', success: false, error: 'Connection timeout' })
      port = null
    }, 3000)

    port.open((err: Error | null) => {
      clearTimeout(openTimeout)
      if (err) {
        log(`❌ Open failed: ${err.message}`)
        process.send?.({ type: 'CONNECTED', success: false, error: err.message })
        port = null
        return
      }

      isOpen = true
      log(`✅ Connected to ${portPath} @ 250000 baud`)

      port.on('error', (portErr: Error) => {
        log(`❌ Port error: ${portErr.message}`)
        stopOutputLoop()
        isOpen = false
        process.send?.({ type: 'ERROR', error: portErr.message })
      })

      port.on('close', () => {
        log('⚠️ Port closed externally')
        stopOutputLoop()
        isOpen = false
        process.send?.({ type: 'DISCONNECTED' })
      })

      // TWO-PHASE STARTUP PROTOCOL
      // FASE 1 — CONNECTED: puerto abierto
      // FASE 2 — 100ms delay → READY: output loop activo
      process.send?.({ type: 'CONNECTED', success: true })

      setTimeout(() => {
        if (!isOpen || !port) return
        startOutputLoop()
        log('🚀 Output loop live — READY for DMX output')
        process.send?.({ type: 'READY' })
      }, 100)
    })

  }).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err)
    log(`❌ import('serialport') failed: ${msg}`)
    process.send?.({ type: 'CONNECTED', success: false, error: msg })
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Output loop — el corazón del bit-banging aislado
// ─────────────────────────────────────────────────────────────────────────────
function startOutputLoop(): void {
  if (outputLoop) return

  const sinceLastUpdate = lastBufferUpdateNs === BigInt(0)
    ? 'no data yet'
    : `${Number((process.hrtime.bigint() - lastBufferUpdateNs) / BigInt(1_000_000))}ms since last UPDATE_BUFFER`
  log(`Output loop started — hrtime pacing, setImmediate scheduling (${sinceLastUpdate})`)
  lastFrameStart = process.hrtime.bigint()
  scheduleNextFrame()
}

// Max spin-wait para pacing: 5ms. Si falta más, ceder al event loop
// para procesar IPC messages (UPDATE_BUFFER).
const MAX_PACING_SPIN_NS = BigInt(5_000_000)

function scheduleNextFrame(): void {
  if (!isOpen || !port) return

  // setImmediate: cede al event loop para procesar I/O callbacks
  // (port.set, port.write, IPC UPDATE_BUFFER) antes del siguiente frame.
  outputLoop = setImmediate(() => {
    if (!isOpen || !port) return

    const now = process.hrtime.bigint()
    const remaining = (lastFrameStart + minFrameNs) - now

    if (remaining > MAX_PACING_SPIN_NS) {
      // Falta mucho — ceder al event loop y reintentar
      scheduleNextFrame()
      return
    }

    if (remaining > BigInt(0)) {
      // Falta poco (≤5ms) — spin-wait preciso hasta el momento exacto
      spinWaitNs(remaining)
    }

    lastFrameStart = process.hrtime.bigint()
    sendFrame()
  })
}

function stopOutputLoop(): void {
  if (outputLoop) {
    // setImmediate retorna un Immediate, pero TypeScript lo tipa como retorno de setImmediate
    clearImmediate(outputLoop as ReturnType<typeof setImmediate>)
    outputLoop = null
    log('Output loop stopped')
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
function spinWaitNs(ns: bigint): void {
  const end = process.hrtime.bigint() + ns
  // eslint-disable-next-line no-empty
  while (process.hrtime.bigint() < end) {}
}

// BREAK: 100µs (spec mínimo 88µs, damos margen)
const BREAK_NS = BigInt(100_000)

/**
 * Envía un frame DMX completo con BREAK manual y timing preciso.
 *
 * Secuencia:
 *   1. port.set({brk:true}, cb)   → BREAK activado en hardware
 *   2. spinWaitNs(100µs)          → mantener BREAK ≥88µs (spec DMX512)
 *   3. port.set({brk:false}, cb)  → MAB activado en hardware
 *      (el callback round-trip del set() ya dura >8µs = MAB cumplido)
 *   4. port.write(buffer, cb)     → 513 bytes @ 250kbaud ≈ 22.7ms
 *   5. scheduleNextFrame()        → encadenar siguiente
 *
 * Zero setTimeout en el path crítico. Solo I/O nativo + spin-wait.
 */
function sendFrame(): void {
  if (!port || !isOpen) {
    scheduleNextFrame()
    return
  }

  const portAny = port as any

  // Si el puerto no expone port.set (driver muy básico), raw write directo
  if (typeof portAny.set !== 'function') {
    port.write(dmxBuffer, () => {
      scheduleNextFrame()
    })
    return
  }

  // PASO 1: BREAK — activar línea LOW
  portAny.set({ brk: true }, (err: Error | null) => {
    if (err || !port || !isOpen) {
      scheduleNextFrame()
      return
    }

    // PASO 2: Mantener BREAK por ≥88µs (spec DMX512)
    // spin-wait preciso en vez de setTimeout(1) que tarda 15ms en Windows
    spinWaitNs(BREAK_NS)

    // PASO 3: MAB — desactivar BREAK (línea HIGH)
    portAny.set({ brk: false }, (err2: Error | null) => {
      if (err2 || !port || !isOpen) {
        scheduleNextFrame()
        return
      }

      // El MAB ya cumplió: el round-trip del set() callback toma >8µs.
      // PASO 4: DATA — escribir los 513 bytes DMX
      port.write(dmxBuffer, (err3: Error | null) => {
        if (err3) {
          log(`Write error: ${err3.message}`)
        }
        // PASO 5: Encadenar siguiente frame
        scheduleNextFrame()
      })
    })
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Desconexión limpia
// ─────────────────────────────────────────────────────────────────────────────
function handleDisconnect(): void {
  stopOutputLoop()

  const cleanup = () => {
    port = null
    isOpen = false
    log('🔌 Disconnected')
    process.send?.({ type: 'DISCONNECTED' })
  }

  if (port && isOpen) {
    try {
      port.close(() => cleanup())
    } catch {
      cleanup()
    }
  } else {
    cleanup()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Message handler — IPC via process.on('message')
// ─────────────────────────────────────────────────────────────────────────────
process.on('message', (msg: { type: string; portPath?: string; channels?: number[] }) => {
  switch (msg.type) {
    case 'CONNECT':
      if (typeof msg.portPath === 'string') {
        handleConnect(msg.portPath, (msg as any).refreshRate)
      }
      break

    case 'UPDATE_BUFFER':
      // Recibir canales DMX frescos del main process via IPC pipe.
      // El array se copia al Buffer local — operación O(512), ~1µs.
      // JITTER GUARD: timestamp para detectar ausencia de actualizaciones.
      // Si el main está saturado (UI render, GC) y no envía UPDATE_BUFFER,
      // el worker sigue enviando el buffer anterior — CERO parpadeo.
      if (Array.isArray(msg.channels)) {
        const len = Math.min(msg.channels.length, dmxBuffer.length)
        for (let i = 0; i < len; i++) {
          dmxBuffer[i] = msg.channels[i]
        }
        dmxBuffer[0] = 0  // start code siempre 0
        lastBufferUpdateNs = process.hrtime.bigint()
      }
      break

    case 'DISCONNECT':
      handleDisconnect()
      break
  }
})

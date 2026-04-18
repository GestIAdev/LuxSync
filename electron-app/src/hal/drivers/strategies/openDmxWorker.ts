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

// 🔇 OPERACIÓN BLACKOUT — child_process console hijack (RESTAURAR: comentar bloque)
;(function(){const _n=()=>{};console.log=_n;console.info=_n;console.debug=_n;console.warn=_n;console.error=_n;})()

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

// BREAK mode: 'set' usa port.set({brk}) — funciona con FTDI auténtico.
// 'baudrate' cambia baud a 76923 → envía 0x00 (~130µs LOW) → vuelve a 250000.
// Los chips genéricos (no-FTDI, clones baratos) a veces ignoran port.set({brk})
// porque su driver Windows no implementa SetCommBreak. El baudrate-switch es
// el método que usa Freestyler/QLC+ como fallback universal.
// DEFAULT: 'baudrate' — funciona con cualquier chip USB-serial sin excepción.
let breakMode: 'set' | 'baudrate' = 'baudrate'

// Buffer de break para baudrate-switch: un byte 0x00 a 76923 baud = ~130µs
const BREAK_BYTE = Buffer.from([0x00])

function log(message: string): void {
  process.send?.({ type: 'LOG', message: `[DMX-Worker] ${message}` })
}

// ─────────────────────────────────────────────────────────────────────────────
// Conexión serial — import DINÁMICO y LOCAL, nunca heredado del main process
// ─────────────────────────────────────────────────────────────────────────────
function handleConnect(portPath: string, refreshRate?: number, requestedBreakMode?: 'set' | 'baudrate'): void {
  // 🔥 WAVE 2100: Adaptive Pacing — calcular intervalo desde refreshRate
  if (refreshRate && refreshRate > 0 && refreshRate <= 44) {
    minFrameNs = BigInt(Math.floor((1000 / refreshRate) * 1_000_000))
    log(`⏱️ Adaptive Pacing: ${refreshRate}Hz → ${Number(minFrameNs / BigInt(1_000_000))}ms/frame`)
  }

  // BREAK mode: default 'set' para FTDI puro, 'baudrate' para chips genéricos
  if (requestedBreakMode === 'baudrate' || requestedBreakMode === 'set') {
    breakMode = requestedBreakMode
    log(`🔧 BREAK mode: ${breakMode}`)
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

      // 🔇 WAVE 3080: SILENCIAR DATOS ENTRANTES — El puerto OpenDMX es SOLO escritura.
      // Sin este handler, Node.js acumula datos RS-485 reflejados (el chip FTDI/CH340
      // puede ecos los propios bytes escritos) en el buffer de lectura del puerto.
      // Cuando ese buffer se llena, el kernel emite 'data' events que interrumpen
      // el event loop del child process en cada frame → jitter en el timing DMX.
      // El sink vacío drena el buffer sin procesamiento — cero allocations, cero IPC.
      port.on('data', () => { /* sink: descarte silencioso de ecos RS-485 */ })

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
// ─────────────────────────────────────────────────────────────────────────────
// 🫠 WAVE 3030: PHANTOM HEARTBEAT — monitor de inanicion del frame loop real
// Mide el intervalo real entre frames: desde el final de sendFrame() hasta
// el inicio del siguiente setImmediate callback. Si el event loop del
// child process se bloquea (IPC backpressure, GC, drain del serialport),
// este delta sube por encima de minFrameNs y el hardware sufre starvation.
// ─────────────────────────────────────────────────────────────────────────────
let _phantomLastFrame = process.hrtime.bigint()
let _phantomPeakMs = 0
let _phantomPeakReportTime = process.hrtime.bigint()
const _PHANTOM_REPORT_NS = BigInt(5_000_000_000) // reporte cada 5s
const _PHANTOM_STARVATION_MS = 40               // umbral de inanicion segura

// ─────────────────────────────────────────────────────────────────────────────
// 🔬 WAVE 3170: THE MICROSCOPIC TRAP — caza de anomalías en el 100% de los frames
//
// Trampas activas:
//   1. LATENCIA DE CADENCIA: ring buffer de los últimos 10 frame deltas.
//      Si el delta entre frames supera 40ms → volcado inmediato del historial.
//   2. LATENCIA DE BREAK: si la negociación BAUD-BREAK supera 15ms → volcado.
//   3. MUTACIÓN OCULTA: snapshot del buffer pre-write. Si un canal manual
//      cae a 0 entre frames consecutivos → volcado inmediato.
//   4. FRAME CYCLE TIME: tiempo total desde inicio del BREAK hasta fin del
//      port.write() callback. Si supera el período de frame (minFrameNs en ms)
//      → overlap garantizado → parpadeo. Reporta peak cada 5s siempre.
//
// Todo en memoria. CERO console.log por frame. Solo dispara cuando hay anomalía.
// ─────────────────────────────────────────────────────────────────────────────

// Ring buffer de cadencia: últimos 10 deltas de frame (nanosegundos)
const _W3170_RING_SIZE = 10
const _w3170FrameDeltas: number[] = new Array(_W3170_RING_SIZE).fill(0)
let _w3170RingIdx = 0
let _w3170LastFrameEndNs: bigint = BigInt(0)

// Umbrales de disparo
const _W3170_CADENCE_WARN_MS = 40   // delta entre frames > 40ms = apagón (30Hz → 33.3ms máximo)
const _W3170_BREAK_WARN_MS = 15     // negociación BREAK > 15ms = overlapping

// ─── TRAP 4: FRAME CYCLE TIME ────────────────────────────────────────────────
// Mide el tiempo total que tarda un frame completo (BREAK start → write callback).
// A 30Hz el período es 33.3ms. El frame DMX de 513 bytes a 250000 baud = ~22.6ms
// de transmisión pura. Si el ciclo total supera el período → overlap → parpadeo.
let _w3170CycleStartNs: bigint = BigInt(0)
let _w3170CyclePeakMs: number = 0
let _w3170CyclePeakReportNs: bigint = BigInt(0)
const _W3170_CYCLE_REPORT_NS = BigInt(5_000_000_000) // reporte cada 5s

// Snapshot de buffer anterior para trampa de mutación oculta
const _w3170PrevBuffer: Uint8Array = new Uint8Array(513)
let _w3170HasPrev = false

/**
 * 🔬 WAVE 3170 TRAP 1: Registra el delta del frame y dispara si hay apagón.
 * Llamar al INICIO de cada sendFrame(), DESPUÉS de que scheduleNextFrame
 * ya midió el CARDIOGRAMA (que es el heartbeat de scheduling).
 * Esta trampa mide el tiempo REAL entre el fin de un write y el inicio del
 * siguiente — la cadencia que el hardware experimenta.
 */
function _w3170RecordFrameStart(): void {
  const now = process.hrtime.bigint()
  if (_w3170LastFrameEndNs > BigInt(0)) {
    const deltaMs = Number((now - _w3170LastFrameEndNs)) / 1_000_000
    _w3170FrameDeltas[_w3170RingIdx] = deltaMs
    _w3170RingIdx = (_w3170RingIdx + 1) % _W3170_RING_SIZE

    if (deltaMs > _W3170_CADENCE_WARN_MS) {
      // APAGÓN DETECTADO — volcado del historial
      const history = []
      for (let i = 0; i < _W3170_RING_SIZE; i++) {
        const idx = (_w3170RingIdx + i) % _W3170_RING_SIZE
        history.push(_w3170FrameDeltas[idx].toFixed(1))
      }
      log(`[WAVE 3170 TRAP] 🚨 CADENCE GAP ${deltaMs.toFixed(1)}ms (umbral: ${_W3170_CADENCE_WARN_MS}ms) last10=[${history.join(',')}]ms`)
    }
  }
}

/** Marcar el fin del frame (llamar después de port.write callback) */
function _w3170RecordFrameEnd(): void {
  _w3170LastFrameEndNs = process.hrtime.bigint()
}

/**
 * 🔬 WAVE 3170 TRAP 4a: Marcar el inicio del ciclo completo de frame.
 * Llamar justo al inicio de sendFrameBaudrateBreak() o sendFrameSetBreak(),
 * ANTES de cualquier operación serial. Esto marca "el fixture empieza a
 * recibir el BREAK ahora".
 */
function _w3170CycleStart(): void {
  _w3170CycleStartNs = process.hrtime.bigint()
}

/**
 * 🔬 WAVE 3170 TRAP 4b: Calcular y registrar el tiempo total del ciclo.
 * Llamar al final del port.write() callback, ANTES de scheduleNextFrame().
 * Si el ciclo total supera el período de frame → OVERLAP → parpadeo garantizado.
 * Reporta el pico cada 5s siempre (aunque no haya overlap) para tener baseline.
 */
function _w3170CycleEnd(): void {
  if (_w3170CycleStartNs === BigInt(0)) return
  const cycleMs = Number(process.hrtime.bigint() - _w3170CycleStartNs) / 1_000_000
  if (cycleMs > _w3170CyclePeakMs) _w3170CyclePeakMs = cycleMs

  const periodMs = Number(minFrameNs) / 1_000_000
  if (cycleMs > periodMs) {
    log(`[WAVE 3170 TRAP] 🚨 FRAME OVERLAP cycle:${cycleMs.toFixed(1)}ms > period:${periodMs.toFixed(1)}ms — fixture recibió frame incompleto`)
  }

  const now = process.hrtime.bigint()
  if (now - _w3170CyclePeakReportNs >= _W3170_CYCLE_REPORT_NS) {
    log(`[WAVE 3170 TRAP] 📊 CYCLE peak:${_w3170CyclePeakMs.toFixed(1)}ms period:${periodMs.toFixed(1)}ms (last 5s)`)
    _w3170CyclePeakMs = 0
    _w3170CyclePeakReportNs = now
  }
}

/**
 * 🔬 WAVE 3170 TRAP 2: Mide la duración de la negociación BAUD-BREAK.
 * Si supera 15ms, hay riesgo de overlapping con el frame de datos.
 */
function _w3170CheckBreakLatency(breakStartNs: bigint, context: string): void {
  const elapsedMs = Number(process.hrtime.bigint() - breakStartNs) / 1_000_000
  if (elapsedMs > _W3170_BREAK_WARN_MS) {
    log(`[WAVE 3170 TRAP] 🚨 BREAK LATENCY ${elapsedMs.toFixed(1)}ms (umbral: ${_W3170_BREAK_WARN_MS}ms) mode=${context}`)
  }
}

/**
 * 🔬 WAVE 3170 TRAP 3: Trampa de mutación oculta.
 * Compara el buffer actual con el snapshot del frame anterior.
 * Si algún canal que tenía un valor >0 cae a 0 de golpe → volcado.
 * Se llama justo ANTES de port.write().
 */
function _w3170CheckMutation(): void {
  if (!_w3170HasPrev) {
    // Primer frame — solo guardar snapshot
    dmxBuffer.copy(_w3170PrevBuffer)
    _w3170HasPrev = true
    return
  }

  // Buscar canales que cayeron a 0 desde un valor >0
  const drops: string[] = []
  for (let ch = 1; ch <= 512; ch++) {
    const prev = _w3170PrevBuffer[ch]
    const curr = dmxBuffer[ch]
    if (prev > 0 && curr === 0) {
      drops.push(`ch${ch}:${prev}→0`)
    }
  }

  if (drops.length > 0) {
    log(`[WAVE 3170 TRAP] 🚨 MUTATION DROP ${drops.length} channels zeroed: ${drops.slice(0, 10).join(' ')}${drops.length > 10 ? ` (+${drops.length - 10} more)` : ''}`)
  }

  // Actualizar snapshot
  dmxBuffer.copy(_w3170PrevBuffer)
}

function startOutputLoop(): void {
  if (outputLoop) return

  const sinceLastUpdate = lastBufferUpdateNs === BigInt(0)
    ? 'no data yet'
    : `${Number((process.hrtime.bigint() - lastBufferUpdateNs) / BigInt(1_000_000))}ms since last UPDATE_BUFFER`
  log(`Output loop started — hrtime pacing, setImmediate scheduling (${sinceLastUpdate})`)
  log(`🔌 WAVE 3180: BREAK mode = '${breakMode}' | BREAK duration = ${Number(BREAK_NS) / 1000}µs`)
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

    // 🫠 WAVE 3030: PHANTOM HEARTBEAT — medir delta real entre frames
    const _pNow = process.hrtime.bigint()
    const _pDeltaMs = Number((_pNow - _phantomLastFrame) / BigInt(1_000_000))
    _phantomLastFrame = _pNow
    if (_pDeltaMs > _phantomPeakMs) _phantomPeakMs = _pDeltaMs
    if (_pDeltaMs > _PHANTOM_STARVATION_MS) {
      log(`[CARDIOGRAMA WORKER] 🚨 STARVATION! frame delta: ${_pDeltaMs.toFixed(1)}ms (umbral: ${_PHANTOM_STARVATION_MS}ms)`)
    }
    // Reporte de pico cada 5s
    if (_pNow - _phantomPeakReportTime >= _PHANTOM_REPORT_NS) {
      log(`[CARDIOGRAMA WORKER] 🫠 heartbeat — peak:${_phantomPeakMs.toFixed(1)}ms (last 5s)`)
      _phantomPeakMs = 0
      _phantomPeakReportTime = _pNow
    }

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

// BREAK: 110µs — mínimo del estándar DMX512 es 88µs. Usamos 110µs como margen
// conservador pero rápido. QLC+ usa 88µs, Freestyler usa 92µs. 1ms era innecesariamente
// largo y bloqueaba el event loop del worker durante 10× el tiempo mínimo requerido.
// 🔬 WAVE 3180: reducido de 1ms → 110µs para minimizar bloqueo del event loop.
const BREAK_NS = BigInt(110_000)

// MAB mínimo en modo baudrate-switch: 8µs. El cambio de baud + drain del UART
// ya tarda >8µs, pero añadimos un spin explícito de 20µs por seguridad.
const MAB_NS = BigInt(20_000)

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
function sendFrame(): void {
  if (!port || !isOpen) {
    scheduleNextFrame()
    return
  }

  // 🔬 WAVE 3170: Registrar inicio de frame para trampa de cadencia
  _w3170RecordFrameStart()

  if (breakMode === 'baudrate') {
    sendFrameBaudrateBreak()
  } else {
    sendFrameSetBreak()
  }
}

/**
 * BREAK via port.set({brk}) — para FTDI puro (Tornado, Enttec Open DMX).
 */
function sendFrameSetBreak(): void {
  const portAny = port as any

  // Si el driver no expone port.set, degradar a baudrate-switch automáticamente
  // 🔬 WAVE 3170 TRAP 4: Marcar inicio del ciclo completo de frame
  _w3170CycleStart()

  if (typeof portAny.set !== 'function') {
    log('⚠️ port.set no disponible — degradando a baudrate-switch')
    breakMode = 'baudrate'
    sendFrameBaudrateBreak()
    return
  }

  portAny.set({ brk: true }, (err: Error | null) => {
    if (err || !port || !isOpen) {
      scheduleNextFrame()
      return
    }

    spinWaitNs(BREAK_NS)

    portAny.set({ brk: false }, (err2: Error | null) => {
      if (err2 || !port || !isOpen) {
        scheduleNextFrame()
        return
      }

      // 🔬 WAVE 3170: Trampas pre-write (modo set-break)
      _w3170CheckMutation()

      port.write(dmxBuffer, (err3: Error | null) => {
        _w3170RecordFrameEnd()
        _w3170CycleEnd()  // 🔬 WAVE 3170 TRAP 4: ciclo completo medido
        if (err3) log(`Write error: ${err3.message}`)
        scheduleNextFrame()
      })
    })
  })
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
function sendFrameBaudrateBreak(): void {
  const portAny = port as any

  // 🔬 WAVE 3170: Timestamp para medir latencia total del BAUD-BREAK + ciclo completo
  const _breakStartNs = process.hrtime.bigint()
  _w3170CycleStart()

  if (typeof portAny.update !== 'function') {
    // Último recurso: sin BREAK, enviar directo (mejor que nada)
    _w3170CheckMutation()

    port.write(dmxBuffer, () => {
      _w3170RecordFrameEnd()
      _w3170CycleEnd()
      scheduleNextFrame()
    })
    return
  }

  // PASO 1: Bajar baud para generar BREAK
  portAny.update({ baudRate: 76923 }, (err: Error | null) => {
    if (err || !port || !isOpen) { scheduleNextFrame(); return }

    // PASO 2: Emitir 0x00 → genera señal LOW ~130µs = BREAK DMX512
    port.write(BREAK_BYTE, (err2: Error | null) => {
      if (err2 || !port || !isOpen) { scheduleNextFrame(); return }

      // Drain: esperar que el UART vacíe el byte antes de cambiar baud
      // port.drain() garantiza que el byte se emitió por el RS-485 antes de continuar
      port.drain((err3: Error | null) => {
        if (err3 || !port || !isOpen) { scheduleNextFrame(); return }

        // PASO 3: Volver a 250000 baud para el frame DMX
        portAny.update({ baudRate: 250000 }, (err4: Error | null) => {
          if (err4 || !port || !isOpen) { scheduleNextFrame(); return }

          // 🔬 WAVE 3170: Medir latencia total del BAUD-BREAK (PASO 1→PASO 3)
          _w3170CheckBreakLatency(_breakStartNs, 'baudrate')

          // PASO 4: MAB — 20µs mínimo
          spinWaitNs(MAB_NS)

          // PASO 5: Emitir los 513 bytes del universo DMX
          // 🔬 WAVE 3170: Trampa de mutación pre-write
          _w3170CheckMutation()

          port.write(dmxBuffer, (err5: Error | null) => {
            _w3170RecordFrameEnd()
            _w3170CycleEnd()  // 🔬 WAVE 3170 TRAP 4: ciclo completo medido
            if (err5) log(`Write error: ${err5.message}`)
            scheduleNextFrame()
          })
        })
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
        handleConnect(msg.portPath, (msg as any).refreshRate, (msg as any).breakMode)
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

    case 'RESET_BUFFER':
      // 🧹 WAVE 3080: PURGA DE ESTADO RESIDUAL — limpiar buffer al cambio de show.
      // Un buffer con valores del show anterior puede encender fixtures no
      // parcheados en el nuevo show si comparten dirección DMX.
      // fill(0) lleva TODOS los canales a reposo en el próximo frame.
      dmxBuffer.fill(0)
      dmxBuffer[0] = 0  // start code siempre 0
      lastBufferUpdateNs = BigInt(0)  // reset JITTER GUARD
      _w3170HasPrev = false  // 🔬 WAVE 3170: reset mutation snapshot post-purge
      log('🧹 Buffer purgado — todos los canales a 0 (cambio de show)')
      break

    case 'DISCONNECT':
      handleDisconnect()
      break
  }
})

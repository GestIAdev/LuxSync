/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🩺 MAIN THREAD MONITOR — WAVE 8253 · Opción B: MEDIR, no adivinar
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * El `tick gap > N` del worker es el SÍNTOMA; esto busca la CAUSA.
 *
 * Cuatro sondas independientes, todas con timestamp epoch (Date.now() —
 * comparte origen con el worker, así los logs correlacionan a ojo):
 *
 *   1. LONGTASK   — PerformanceObserver('longtask'): toda task JS >50ms.
 *   2. RAF GAP    — cadencia real del rAF (60Hz esperado). Un gap >400ms con
 *                   un longtask coincidente = JS saturó el hilo; sin él =
 *                   bloqueo no-JS (sync GPU, IPC síncrono, suspensión).
 *   3. TRUTH GAP  — llegada de 'selene:truth' (~90ms @11Hz). Gap >900ms con
 *                   rAF sano = el cuello es el backend/IPC, no la página.
 *   4. HEAP       — performance.memory @1Hz: detecta GCs mayores (caídas
 *                   bruscas) y presión de churn sostenida.
 *
 * Dump manual desde F12:  __luxPerf.dump()
 * Resumen rápido:         __luxPerf.summary()
 *
 * Coste: near-zero — los observers solo disparan en eventos >50ms, el
 * sampler corre a 1Hz, los rings son buffers fijos sin realocación.
 */

interface PerfTaskEntry {
  /** Epoch ms (performance.timeOrigin + startTime) — correlaciona con worker logs */
  t: number
  /** Duración de la task en ms */
  d: number
  /** entry.name ('self', 'same-origin-ancestor', …) */
  n: string
  /** Primera atribución (containerType/scriptURL si el runtime lo expone) */
  a?: string
}

interface PerfGapEntry {
  t: number
  d: number
}

interface HeapSample {
  t: number
  /** usedJSHeapSize en MB */
  mb: number
}

interface LuxPerfAPI {
  tasks: PerfTaskEntry[]
  rafGaps: PerfGapEntry[]
  truthGaps: PerfGapEntry[]
  telGaps: PerfGapEntry[]
  heap: HeapSample[]
  dump: () => void
  summary: () => void
  reset: () => void
}

declare global {
  interface Window { __luxPerf?: LuxPerfAPI }
}

const TASK_RING_CAP = 128
const GAP_RING_CAP = 64
const HEAP_RING_CAP = 120 // 2 min a 1Hz

// Umbrales de WARN (todo lo >50ms se bufferiza; estos deciden el console.warn)
const TASK_WARN_MS = 300
const RAF_GAP_WARN_MS = 400
const TRUTH_GAP_WARN_MS = 900
const TEL_GAP_WARN_MS = 400
const GC_DROP_MB = 4       // caída súbita ≥4MB entre muestras = GC mayor probable
const GC_DROP_RATIO = 0.15 // y ≥15% del heap previo

function pushRing<T>(arr: T[], cap: number, item: T): void {
  if (arr.length >= cap) arr.shift()
  arr.push(item)
}

function fmtEpoch(t: number): string {
  const d = new Date(t)
  const p = (n: number, l = 2) => String(n).padStart(l, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`
}

let installed = false

export function installMainThreadMonitor(): void {
  if (installed || typeof window === 'undefined') return
  installed = true

  const tasks: PerfTaskEntry[] = []
  const rafGaps: PerfGapEntry[] = []
  const truthGaps: PerfGapEntry[] = []
  const telGaps: PerfGapEntry[] = []
  const heap: HeapSample[] = []

  const win = window as Window & { __luxPerf?: LuxPerfAPI }

  const api: LuxPerfAPI = {
    tasks, rafGaps, truthGaps, telGaps, heap,
    dump() {
      // eslint-disable-next-line no-console
      console.log('[PERF 🩺] ── last longtasks ──')
      for (const e of tasks) console.log(`  ${fmtEpoch(e.t)}  ${e.d.toFixed(0)}ms  ${e.n}${e.a ? `  (${e.a})` : ''}`)
      // eslint-disable-next-line no-console
      console.log('[PERF 🩺] ── rAF gaps ──')
      for (const e of rafGaps) console.log(`  ${fmtEpoch(e.t)}  ${e.d.toFixed(0)}ms`)
      // eslint-disable-next-line no-console
      console.log('[PERF 🩺] ── truth IPC gaps ──')
      for (const e of truthGaps) console.log(`  ${fmtEpoch(e.t)}  ${e.d.toFixed(0)}ms`)
      // eslint-disable-next-line no-console
      console.log('[PERF 🩺] ── telemetry port gaps ──')
      for (const e of telGaps) console.log(`  ${fmtEpoch(e.t)}  ${e.d.toFixed(0)}ms`)
      // eslint-disable-next-line no-console
      console.log('[PERF 🩺] ── heap (MB) ──')
      for (const e of heap) console.log(`  ${fmtEpoch(e.t)}  ${e.mb.toFixed(1)}`)
    },
    summary() {
      const worst = (a: { d: number }[]) => a.reduce((m, e) => Math.max(m, e.d), 0)
      // eslint-disable-next-line no-console
      console.log(
        `[PERF 🩺] tasks=${tasks.length} (worst ${worst(tasks).toFixed(0)}ms) | ` +
        `rafGaps=${rafGaps.length} (worst ${worst(rafGaps).toFixed(0)}ms) | ` +
        `truthGaps=${truthGaps.length} (worst ${worst(truthGaps).toFixed(0)}ms) | ` +
        `telGaps=${telGaps.length} (worst ${worst(telGaps).toFixed(0)}ms)`,
      )
    },
    reset() {
      tasks.length = rafGaps.length = truthGaps.length = telGaps.length = heap.length = 0
    },
  }
  win.__luxPerf = api

  // ── SONDA 1: LONGTASK ──────────────────────────────────────────────────
  try {
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const rec: PerfTaskEntry = { t: performance.timeOrigin + entry.startTime, d: entry.duration, n: entry.name }
        const attr = (entry as unknown as { attribution?: Array<Record<string, unknown>> }).attribution?.[0]
        if (attr) {
          rec.a = (attr.scriptURL as string) || (attr.containerName as string) || (attr.containerType as string) || undefined
        }
        pushRing(tasks, TASK_RING_CAP, rec)
        if (entry.duration >= TASK_WARN_MS) {
          // eslint-disable-next-line no-console
          console.warn(`[PERF ⚠️] longtask ${entry.duration.toFixed(0)}ms @${fmtEpoch(rec.t)} name=${entry.name}${rec.a ? ` src=${rec.a}` : ''}`)
        }
      }
    })
    obs.observe({ entryTypes: ['longtask'] })
  } catch { /* longtask no soportado en este runtime — las otras sondas siguen */ }

  // ── SONDA 2: RAF GAP ───────────────────────────────────────────────────
  let lastRafAt = performance.now()
  const rafProbe = () => {
    const now = performance.now()
    const gap = now - lastRafAt
    lastRafAt = now
    if (gap >= RAF_GAP_WARN_MS) {
      const rec = { t: Date.now(), d: gap }
      pushRing(rafGaps, GAP_RING_CAP, rec)
      // eslint-disable-next-line no-console
      console.warn(`[PERF ⚠️] rAF gap ${gap.toFixed(0)}ms @${fmtEpoch(rec.t)}`)
    }
    requestAnimationFrame(rafProbe)
  }
  requestAnimationFrame(rafProbe)

  // ── SONDA 3: TRUTH IPC GAP ─────────────────────────────────────────────
  // Listener adicional — ipcRenderer soporta N listeners por canal; esto no
  // interfiere con useSeleneTruth. Esperado ~90ms (11Hz).
  try {
    let lastTruthAt = Date.now()
    window.lux?.onTruthUpdate?.(() => {
      const now = Date.now()
      const gap = now - lastTruthAt
      lastTruthAt = now
      if (gap >= TRUTH_GAP_WARN_MS) {
        const rec = { t: now, d: gap }
        pushRing(truthGaps, GAP_RING_CAP, rec)
        // eslint-disable-next-line no-console
        console.warn(`[PERF ⚠️] selene:truth gap ${gap}ms @${fmtEpoch(now)}`)
      }
    })
  } catch { /* window.lux aún no lista — la sonda se pierde, no es fatal */ }

  // ── SONDA 4: HEAP / GC ─────────────────────────────────────────────────
  const mem = (performance as { memory?: { usedJSHeapSize: number } }).memory
  if (mem) {
    let prevMb = mem.usedJSHeapSize / 1048576
    setInterval(() => {
      const mb = mem.usedJSHeapSize / 1048576
      const now = Date.now()
      pushRing(heap, HEAP_RING_CAP, { t: now, mb })
      const drop = prevMb - mb
      if (drop >= GC_DROP_MB && drop >= prevMb * GC_DROP_RATIO) {
        // eslint-disable-next-line no-console
        console.warn(`[PERF ⚠️] GC? heap ${prevMb.toFixed(1)}→${mb.toFixed(1)}MB (-${drop.toFixed(1)}MB) @${fmtEpoch(now)}`)
      }
      prevMb = mb
    }, 1000)
  }

  // eslint-disable-next-line no-console
  console.log('[PERF 🩺] MainThreadMonitor installed — longtask·rAF·truth·heap probes armed. __luxPerf.summary() para estado.')
}

/**
 * Sonda 5 (inline, para callers con su propio port): mide el gap entre
 * llegadas del telemetry port y lo registra. Llamar desde onmessage —
 * devuelve void, zero-alloc salvo en el evento de gap.
 */
export function noteTelemetryArrival(lastAt: { v: number }, label?: string): void {
  const now = Date.now()
  const prev = lastAt.v
  lastAt.v = now
  if (prev > 0) {
    const gap = now - prev
    if (gap >= TEL_GAP_WARN_MS) {
      const api = (window as Window & { __luxPerf?: LuxPerfAPI }).__luxPerf
      if (api) pushRing(api.telGaps, GAP_RING_CAP, { t: now, d: gap })
      // eslint-disable-next-line no-console
      console.warn(`[PERF ⚠️] telemetry port gap ${gap}ms @${fmtEpoch(now)}${label ? ` ${label}` : ''}`)
    }
  }
}

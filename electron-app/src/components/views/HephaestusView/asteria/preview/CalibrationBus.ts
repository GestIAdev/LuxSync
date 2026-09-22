/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 CALIBRATION BUS — WAVE 8020: EL ÚNICO ESCRITOR DE L3++
 *
 * Singleton del renderer que fusiona las dos fuentes de intención de
 * calibración y publica UNA sola vez por frame vía
 * `window.luxsync.writeCalibration` → `hephaestus:calibration:write` →
 * `TickEngine.writeCalibration` → `NodeArbiter.setCalibrationIntents`.
 *
 * Fuentes (LTP — Last Takes Precedence por nodeId):
 *   - 'clip'  : stream a 44 Hz de useLiveCalibration (valores del clip)
 *   - 'touch' : Protocolo Poke de Asteria (prioridad absoluta — el dedo
 *               del operador machaca la curva sobre el mismo nodo)
 *
 * REGLAS DE SATURACIÓN IPC (blueprint §9.2):
 *   - Publica SOLO cuando el conjunto fusionado cambia (firma dedupe).
 *     El touch es estático → una selección estable NO genera tráfico.
 *   - Coalescencia a 1 rAF: N mutaciones en el mismo tick = 1 IPC.
 *   - Cuando el merged set queda vacío se emite clearCalibration() UNA
 *     vez (libera también el watchdog del NodeArbiter).
 *   - `touchPulse()` fuerza republicación idéntica — el heartbeat de
 *     400 ms del Poke que mantiene vivo el watchdog de 500 ms.
 *
 * @module HephaestusView/asteria/preview/CalibrationBus
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { CalibrationEntry } from '../../../../../core/aether/glass/CalibrationSAB'

// ═══════════════════════════════════════════════════════════════════════════
// POKE CHANNELS — qué escribir al tocar un nodo
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Construye las entries de Poke para un nodeId real del atlas.
 *
 * Por cada nodo se emite la pareja {impact, color} de SU MISMA CELDA:
 * se corta el nodeId por el ÚLTIMO ':' para obtener la base de celda
 * (`fixture:petal-l` desde `fixture:petal-l:kinetic`) y se apunta a los
 * hermanos `:impact` y `:color`.
 *
 * Por qué funciona a nivel de celda sin parches (TickEngine.ts:263-290):
 *   - `fixture:impact`   → el backend expande a TODOS los nodos IMPACT
 *     del fixture → flash de fixture completo.
 *   - `fixture:petal-l:impact` → lastIndexOf da family='impact' pero
 *     deviceId='fixture:petal-l' no existe → fallback usa el nodeId TAL
 *     CUAL → flash SOLO del pétalo. Este comportamiento de fallback es
 *     el contrato del Poke — no "arreglar" la expansión.
 *
 * Nunca se envía `strobe` (G6, seguridad fotosensible — un hover de ratón
 * no dispara strobes).
 */
function buildPokeEntries(nodeId: string, out: Map<string, CalibrationEntry>): void {
  const sep = nodeId.lastIndexOf(':')
  const cellBase = sep > 0 ? nodeId.slice(0, sep) : nodeId

  const impactId = `${cellBase}:impact`
  const colorId = `${cellBase}:color`

  if (!out.has(impactId)) {
    out.set(impactId, {
      nodeId: impactId,
      channels: [
        { channel: 'dimmer', value: 1 },
        { channel: 'shutter', value: 1 },
      ],
    })
  }
  if (!out.has(colorId)) {
    out.set(colorId, {
      nodeId: colorId,
      channels: [
        { channel: 'r', value: 1 },
        { channel: 'g', value: 1 },
        { channel: 'b', value: 1 },
      ],
    })
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BUS
// ═══════════════════════════════════════════════════════════════════════════

class CalibrationBusImpl {
  /** Fuente 'clip': entries construidas por useLiveCalibration cada tick. */
  private _clipEntries: readonly CalibrationEntry[] = []

  /**
   * Fuente 'touch': nodeId → entry. Precedencia absoluta sobre 'clip'
   * en el merge por nodeId (LTP).
   */
  private readonly _touchEntries = new Map<string, CalibrationEntry>()

  /** rAF de publicación pendiente — coalescencia a 1 publicación/frame. */
  private _publishScheduled = false

  /** Firma del último set publicado — dedupe de IPC. */
  private _lastSignature = ''

  /** true tras publicar un clear — evita clears repetidos. */
  private _isClear = true

  /**
   * Fuente CLIP (stream 44 Hz de useLiveCalibration). Guarda la referencia
   * — el merge real ocurre en publish() coalescido.
   */
  setClipEntries(entries: readonly CalibrationEntry[]): void {
    this._clipEntries = entries
    this._schedulePublish()
  }

  /**
   * Fuente TOUCH (Protocolo Poke). Reconstruye el mapa de entries desde el
   * set de nodeIds tocados. Dedupe por firma: si el set no cambió, no hay
   * publicación ni rebuild.
   */
  setTouchNodes(nodeIds: Iterable<string>): void {
    // Firma del set — orden estable para dedupe fiable
    const ids = Array.from(nodeIds).sort()
    const signature = ids.join('|')
    const prevSignature = this._touchSignature ?? ''
    if (signature === prevSignature) return
    this._touchSignature = signature

    this._touchEntries.clear()
    for (const id of ids) {
      buildPokeEntries(id, this._touchEntries)
    }
    this._schedulePublish()
  }

  private _touchSignature: string | null = null

  /**
   * Heartbeat del Poke: republica el merged set ACTUAL aunque la firma no
   * haya cambiado — el watchdog del NodeArbiter (500 ms) solo necesita un
   * inject para seguir vivo. No-op si el bus está vacío.
   */
  touchPulse(): void {
    if (this._touchEntries.size === 0 && this._clipEntries.length === 0) return
    this._publish(true)
  }

  /**
   * Limpieza total e inmediata: ambas fuentes a vacío + clearCalibration.
   * Para kill-switch / unmount / Esc.
   */
  panicClear(): void {
    this._touchEntries.clear()
    this._touchSignature = ''
    this._clipEntries = []
    this._publish(true)
  }

  // ── Internals ─────────────────────────────────────────────────────────

  private _schedulePublish(): void {
    if (this._publishScheduled) return
    this._publishScheduled = true
    requestAnimationFrame(() => {
      this._publishScheduled = false
      this._publish(false)
    })
  }

  /**
   * Merge LTP + dedupe + IPC. `force` salta el dedupe (heartbeat).
   */
  private _publish(force: boolean): void {
    const lux = window.luxsync
    if (!lux?.writeCalibration) return

    // ── Merge: clip primero, touch pisa por nodeId ──
    const merged = new Map<string, CalibrationEntry>()
    for (const e of this._clipEntries) {
      if (e?.nodeId) merged.set(e.nodeId, e)
    }
    for (const [id, e] of this._touchEntries) {
      merged.set(id, e)
    }

    // ── Vacío → clearCalibration una sola vez ──
    if (merged.size === 0) {
      if (!this._isClear) {
        this._isClear = true
        this._lastSignature = ''
        lux.clearCalibration?.()
      }
      return
    }

    // ── Firma: nodeId + canales+valores (el clip cambia valores a 44 Hz;
    //    el touch cambia solo cuando cambia el set) ──
    let sig = ''
    for (const e of merged.values()) {
      sig += e.nodeId
      sig += '{'
      for (const ch of e.channels) {
        sig += ch.channel
        sig += '='
        sig += ch.value
        sig += ','
      }
      sig += '};'
    }

    if (!force && sig === this._lastSignature) return
    this._lastSignature = sig
    this._isClear = false

    lux.writeCalibration(Array.from(merged.values()))
  }
}

/** Singleton del renderer — único escritor de la capa L3++. */
export const asteriaCalibrationBus = new CalibrationBusImpl()
